// =============================================================================
// 1. CONFIG & INITIALIZATION FIREBASE
// =============================================================================
const firebaseConfig = {
    apiKey: "AIzaSyATIQKEoacfqd_P5mBn915gzwbsLQE-va8",
    authDomain: "spp-unisri-taekwondo.firebaseapp.com",
    projectId: "spp-unisri-taekwondo",
    storageBucket: "spp-unisri-taekwondo.firebasestorage.app",
    messagingSenderId: "888126318699",
    appId: "1:888126318699:web:6e1ef3d5a49908c2b5692e"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// =============================================================================
// 2. VARIABEL GLOBAL (OTOMATIS MEMBACA SESSION DATA DARI INDEX)
// =============================================================================
let usernameSaya = sessionStorage.getItem("catur_username") || "";
let roomId = sessionStorage.getItem("catur_room_id") || "";
let peranSaya = sessionStorage.getItem("catur_peran") || ""; // 'w' = Putih, 'b' = Hitam

let jatahLangkahPuzzle = 5;
let modePuzzleAktif = false;
let langkahPuzzleTerpakai = 0;
const bankPosisiPuzzle = [
    "6k1/5ppp/8/8/8/5Q2/5PPP/6K1 w - - 0 1",
    "6k1/6pp/8/8/8/4Q3/5PPP/6K1 w - - 0 1",
    "7k/5Qpp/8/8/8/8/5PPP/6K1 w - - 0 1"
];

const game = new Chess();
let board = null;
let kotakAsal = null;
const statusEl = document.getElementById('status');

// --- VARIABEL SISTEM JAM ---
let waktuPutih = 300; 
let waktuHitam = 300; 
let intervalJam = null;
let gameDimulai = false; 
let aiEngine = null;

// Deteksi otomatis mode game dari URL parameter (?mode=ai, ?mode=friend, ?mode=puzzle)
const urlParams = new URLSearchParams(window.location.search);
const modeDariUrl = urlParams.get('mode') || 'ai';

// Menghubungkan engine Stockfish AI
try {
    aiEngine = new Worker('JS/stockfish.js');
} catch (e) {
    if (typeof STOCKFISH === 'function') {
        aiEngine = STOCKFISH();
    }
}

if (aiEngine) {
    aiEngine.onmessage = function(event) {
        if (event.data.indexOf('bestmove') > -1) {
            const moveSourceTarget = event.data.split(' ')[1]; 
            const from = moveSourceTarget.substring(0, 2);
            const to = moveSourceTarget.substring(2, 4);
            
            game.move({ from: from, to: to, promotion: 'q' });
            board.position(game.fen());
            
            tukarArahJam();
            updateStatus();
        }
    };
}

// DomContentLoaded untuk inisialisasi komponen visual akun & sinkronisasi mode
document.addEventListener("DOMContentLoaded", function() {
    // 1. Paksa dropdown gameMode mengikuti mode dari URL index
    const gameModeSelect = document.getElementById('gameMode');
    if (gameModeSelect) {
        gameModeSelect.value = modeDariUrl;
    }

    // 2. TAMPILKAN INFORMASI INPUT NAMA DARI DATABASE KE LAYAR SEKAK
    tampilkanInfoAkun();

    // 3. AKTIFKAN RADAR LOBBY ONLINE & RADAR TANTANGAN MASUK DI HALAMAN GAME
    if (usernameSaya) {
        pantauLobbyOnline();
        pantauTantanganMasuk();
    }

    // 4. Jika menutup tab, bersihkan status online di database
    if (usernameSaya) {
        window.addEventListener('beforeunload', function () {
            db.collection("para_pemain").doc(usernameSaya).delete();
        });
    }

    // Jalankan reset game awal agar papan siap sesuai mode
    resetGame();
});

function tampilkanInfoAkun() {
    const infoUserEl = document.getElementById('info-pemain-aktif');
    if (infoUserEl) {
        if (usernameSaya) {
            infoUserEl.innerHTML = `👤 Pemain: <b>${usernameSaya}</b> 
                ${modeDariUrl === 'friend' ? `<span style="background:#28a745; padding:2px 6px; border-radius:4px; font-size:11px; margin-left:5px;">ONLINE (${peranSaya === 'w' ? 'PUTIH' : 'HITAM'})</span>` : '<span style="background:#6c757d; padding:2px 6px; border-radius:4px; font-size:11px; margin-left:5px;">OFFLINE</span>'}`;
        } else {
            infoUserEl.innerHTML = `👤 Pemain: <b style="color:#ff4a4a;">Guest (Belum Login)</b>`;
        }
    }
}

// =============================================================================
// 3. FITUR LOBBY MULTIPLAYER & TANTANGAN (SINKRON DENGAN INDEX)
// =============================================================================

// Fungsi untuk memantau siapa saja pemain lain yang sedang online
function pantauLobbyOnline() {
    db.collection("para_pemain").onSnapshot((snapshot) => {
        const daftarEl = document.getElementById('daftar-pemain-online');
        if (!daftarEl) return;
        
        daftarEl.innerHTML = "";
        let adaPemainLain = false;

        snapshot.forEach((doc) => {
            const namaPemain = doc.id;
            const data = doc.data();

            // Jangan tampilkan nama diri sendiri di daftar online
            if (namaPemain !== usernameSaya && data.status === "di_lobby") {
                adaPemainLain = true;
                daftarEl.innerHTML += `
                    <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:8px 12px; border-radius:6px; margin-bottom:5px; border:1px solid rgba(255,255,255,0.1);">
                        <span>🟢 ${namaPemain}</span>
                        <button onclick="tantangPemain('${namaPemain}')" style="background:#007bff; color:white; border:none; padding:4px 10px; border-radius:4px; cursor:pointer; font-size:12px; font-weight:bold;">Tantang</button>
                    </div>
                `;
            }
        });

        if (!adaPemainLain) {
            daftarEl.innerHTML = `<p style="color:#aaa; font-size:13px; font-style:italic;">Tidak ada pemain lain di lobby...</p>`;
        }
    });
}

// Fungsi untuk mengirimkan tantangan ke pemain lain
function tantangPemain(namaLawan) {
    const buatRoomId = "room_" + Date.now();
    sessionStorage.setItem("catur_peran", "w"); // Penantang otomatis jadi Putih
    sessionStorage.setItem("catur_room_id", buatRoomId);
    peranSaya = "w";
    roomId = buatRoomId;

    // Buat dokumen room catur baru di database
    db.collection("room_catur").doc(buatRoomId).set({
        fen: "start",
        turn: "w",
        waktuUpdate: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Update status lawan agar muncul notifikasi tantangan di layarnya
    db.collection("para_pemain").doc(namaLawan).update({
        status: "ditantang",
        lawan: usernameSaya,
        roomId: buatRoomId
    });

    // Update status diri sendiri sedang menunggu tantangan diterima
    db.collection("para_pemain").doc(usernameSaya).update({
        status: "menunggu",
        lawan: namaLawan,
        roomId: buatRoomId
    });

    alert(`Tantangan terkirim ke ${namaLawan}. Menunggu konfirmasi...`);
}

// Fungsi untuk memantau jika ada tantangan yang masuk ke akun kita atau tantangan kita direspon
function pantauTantanganMasuk() {
    db.collection("para_pemain").doc(usernameSaya).onSnapshot((doc) => {
        if (!doc.exists) return;
        const data = doc.data();
        const notifEl = document.getElementById('notifikasi-tantangan');
        if (!notifEl) return;

        // JIKA ADA ORANG YANG MENANTANG KITA
        if (data.status === "ditantang" && data.lawan) {
            notifEl.innerHTML = `
                <div style="background:#ff9f43; color:#111; padding:12px; border-radius:6px; font-weight:bold; margin-bottom:15px; display:flex; justify-content:space-between; align-items:center;">
                    <span>⚔️ Ditantang oleh: ${data.lawan}</span>
                    <div>
                        <button onclick="terimaTantangan('${data.lawan}', '${data.roomId}')" style="background:#28a745; color:white; border:none; padding:6px 12px; border-radius:4px; font-weight:bold; cursor:pointer; margin-right:5px;">TERIMA</button>
                        <button onclick="tolakTantangan('${data.lawan}')" style="background:#dc3545; color:white; border:none; padding:6px 12px; border-radius:4px; font-weight:bold; cursor:pointer;">TOLAK</button>
                    </div>
                </div>
            `;
        } 
        // JIKA TANTANGAN KITA SUDAH DITERIMA OLEH LAWAN
        else if (data.status === "bermain" && gameDimulai === false) {
            notifEl.innerHTML = "";
            document.getElementById('gameMode').value = 'friend';
            
            // Perbarui visual session data lokal
            peranSaya = sessionStorage.getItem("catur_peran") || peranSaya;
            roomId = sessionStorage.getItem("catur_room_id") || roomId;
            
            tampilkanInfoAkun();
            mulaiPermainanNyata();
        } 
        else {
            notifEl.innerHTML = "";
        }
    });
}

// Fungsi jika kita mengklik tombol TERIMA tantangan
function terimaTantangan(lawan, idRoomMasuk) {
    sessionStorage.setItem("catur_peran", "b"); // Penerima tantangan otomatis jadi Hitam
    sessionStorage.setItem("catur_room_id", idRoomMasuk);
    peranSaya = "b";
    roomId = idRoomMasuk;

    // Update status diri sendiri ke database menjadi sedang bermain
    db.collection("para_pemain").doc(usernameSaya).update({
        status: "bermain"
    });

    // Update status lawan agar dia tahu tantangannya telah kita terima
    db.collection("para_pemain").doc(lawan).update({
        status: "bermain"
    });

    tampilkanInfoAkun();
    document.getElementById('gameMode').value = 'friend';
    mulaiPermainanNyata();
}

// Fungsi jika kita mengklik tombol TOLAK tantangan
function tolakTantangan(lawan) {
    db.collection("para_pemain").doc(usernameSaya).update({
        status: "di_lobby",
        lawan: "",
        roomId: ""
    });
    db.collection("para_pemain").doc(lawan).update({
        status: "di_lobby",
        lawan: "",
        roomId: ""
    });
}

// =============================================================================
// 4. LOGIKA CORE GAMEPLAY CATUR
// =============================================================================
function kembaliKeHome() {
    if (usernameSaya) {
        db.collection("para_pemain").doc(usernameSaya).delete()
        .then(() => { window.location.href = "index.html"; })
        .catch(() => { window.location.href = "index.html"; });
    } else {
        window.location.href = "index.html";
    }
}

function onSquareClick(square) {
    const modeGame = document.getElementById('gameMode').value;

    // ---- SENSOR ONLINE: Kunci papan jika bukan giliranmu ----
    if (modeGame === 'friend' && game.turn() !== peranSaya) {
        statusEl.innerText = "⏳ Sabar! Ini giliran temanmu.";
        return;
    }
    
    if (modeGame === 'ai' && game.turn() === 'b') return;
    if (game.game_over() || waktuPutih <= 0 || waktuHitam <= 0) return;

    if (kotakAsal === null) {
        const piece = game.get(square);
        if (piece && piece.color === game.turn()) {
            kotakAsal = square;
            highlightSquare(square);
        }
        return;
    }

    if (kotakAsal === square) {
        hapusHighlight();
        kotakAsal = null;
        return;
    }

    // Fitur Rokade/Lukir via klik Raja ke Benteng
    const bidakDipilih = game.get(kotakAsal);
    const bidakTujuan = game.get(square);
    if (bidakDipilih && bidakDipilih.type === 'k' && bidakTujuan && bidakTujuan.type === 'r' && bidakDipilih.color === bidakTujuan.color) {
        let kotakTujuanRaja = null;
        if (square === 'h1') kotakTujuanRaja = 'g1';
        if (square === 'a1') kotakTujuanRaja = 'c1';
        if (square === 'h8') kotakTujuanRaja = 'g8';
        if (square === 'a8') kotakTujuanRaja = 'c8';

        if (kotakTujuanRaja) {
            let moveLukir = game.move({ from: kotakAsal, to: kotakTujuanRaja, promotion: 'q' });
            if (moveLukir !== null) { return suksesMelangkah(); }
        }
    }

    let move = game.move({ from: kotakAsal, to: square, promotion: 'q' });
    if (move === null) {
        const piece = game.get(square);
        if (piece && piece.color === game.turn()) {
            hapusHighlight();
            kotakAsal = square;
            highlightSquare(square);
        }
        return;
    }

    suksesMelangkah();
}

function suksesMelangkah() {
    hapusHighlight();
    kotakAsal = null;
    board.position(game.fen()); 
    
    if (!gameDimulai) gameDimulai = true;

    tukarArahJam(); 
    updateStatus();

    // ---- SENSOR ONLINE: Jika bermain mode vs Teman, kirim data ke Firebase ----
    if (document.getElementById('gameMode').value === 'friend') {
        kirimLangkahKeFirebase();
    }

    // Perintah AI membalas jika mode singleplayer AI aktif
    if (document.getElementById('gameMode').value === 'ai' && !game.game_over() && game.turn() === 'b') {
        statusEl.innerText = "🤖 AI sedang berpikir...";
        setTimeout(pemicuLangkahAI, 400); 
    }
}

function pemicuLangkahAI() {
    if (!aiEngine) return;
    aiEngine.postMessage('position fen ' + game.fen());
    aiEngine.postMessage('go movetime 1000'); 
}

function tukarArahJam() {
    clearInterval(intervalJam);
    if (game.game_over()) return;

    const timeLimitEl = document.getElementById('timeLimit');
    const durasiPilihan = timeLimitEl ? parseInt(timeLimitEl.value) : 300;
    waktuPutih = durasiPilihan;
    waktuHitam = durasiPilihan;

    formatTampilanJam('clock-white', waktuPutih);
    formatTampilanJam('clock-black', waktuHitam);

    if (game.turn() === 'w') {
        if(document.getElementById('timer-white')) document.getElementById('timer-white').classList.add('active-timer');
        if(document.getElementById('timer-black')) document.getElementById('timer-black').classList.remove('active-timer');
    } else {
        if(document.getElementById('timer-black')) document.getElementById('timer-black').classList.add('active-timer');
        if(document.getElementById('timer-white')) document.getElementById('timer-white').classList.remove('active-timer');
    }

    intervalJam = setInterval(function() {
        if (game.turn() === 'w') {
            waktuPutih--;
            formatTampilanJam('clock-white', waktuPutih);
            if (waktuPutih <= 0) pemicuKalahWaktu('Putih');
        } else {
            waktuHitam--;
            formatTampilanJam('clock-black', waktuHitam);
            if (waktuHitam <= 0) pemicuKalahWaktu('Hitam');
        }
    }, 1000);
}

function formatTampilanJam(idElemen, totalDetik) {
    const el = document.getElementById(idElemen);
    if (!el) return;
    const menit = Math.floor(totalDetik / 60);
    const detik = totalDetik % 60;
    const teksMenit = menit < 10 ? '0' + menit : menit;
    const teksDetik = detik < 10 ? '0' + detik : detik;
    el.innerText = teksMenit + ':' + teksDetik;
}

function pemicuKalahWaktu(siapaYangHabis) {
    clearInterval(intervalJam);
    if(document.getElementById('timer-white')) document.getElementById('timer-white').classList.remove('active-timer');
    if(document.getElementById('timer-black')) document.getElementById('timer-black').classList.remove('active-timer');
    
    const pemenang = siapaYangHabis === 'Putih' ? 'Hitam' : 'Putih';
    statusEl.innerHTML = `⏰ <b>GAME OVER!</b> Waktu berpikir ${siapaYangHabis} habis. Pemain <b>${pemenang} MENANG!</b>`;
}

function highlightSquare(square) {
    $('#board .square-' + square).css('background', 'rgba(255, 159, 67, 0.5)');
}

function hapusHighlight() {
    $('#board .square-55d63').css('background', '');
}

function updateStatus() {
    if (waktuPutih <= 0 || waktuHitam <= 0) return;

    let status = '';
    const mode = document.getElementById('gameMode').value;
    const turnSekarang = game.turn();

    if (game.in_checkmate()) {
        clearInterval(intervalJam);
        let kalimatEjekan = "";
        
        if (mode === 'ai') {
            if (turnSekarang === 'w') {
                kalimatEjekan = "AI berkata: 'Waduh... Otakmu perlu diservis! 🤫'";
            } else {
                kalimatEjekan = "🎉 LUAR BIASA! Kamu berhasil mengalahkan robot AI! 🧠💥";
            }
        } else {
            if (turnSekarang === 'w') {
                kalimatEjekan = "⚫ PEMAIN HITAM MENANG!";
            } else {
                kalimatEjekan = "⚪ PEMAIN PUTIH MENANG!";
            }
        }

        if(document.getElementById('taunt-text')) document.getElementById('taunt-text').innerHTML = kalimatEjekan;
        if(document.getElementById('gameover-overlay')) document.getElementById('gameover-overlay').style.display = 'flex';
        
        status = '💥 GAME OVER! Skakmat.';
    } else if (game.in_draw()) {
        clearInterval(intervalJam);
        status = '🤝 GAME OVER! Pertandingan Remis.';
    } else {
        let moveColor = turnSekarang === 'w' ? 'Putih' : 'Hitam';
        if (mode === 'ai' && turnSekarang === 'w') moveColor = 'Putih (Kamu)';
        if (mode === 'friend') moveColor = turnSekarang === peranSaya ? 'Kamu (Mikir)' : 'Lawan (Mikir)';
        
        status = 'Giliran: ' + moveColor;
        if (game.in_check()) status += ' (⚠️ SKAK!)';
    }
    statusEl.innerText = status;
}

function resetGame() {
    clearInterval(intervalJam);
    hapusHighlight();
    kotakAsal = null;
    gameDimulai = false;

    if(document.getElementById('gameover-overlay')) document.getElementById('gameover-overlay').style.display = 'none';
    if(document.getElementById('start-overlay')) document.getElementById('start-overlay').style.display = 'flex';

    const mode = document.getElementById('gameMode').value;
    
    if (mode === 'puzzle') {
        modePuzzleAktif = true;
        jatahLangkahPuzzle = 5;
        langkahPuzzleTerpakai = 0;
        if(document.getElementById('sisa-langkah')) document.getElementById('sisa-langkah').innerText = jatahLangkahPuzzle;
        if(document.getElementById('puzzle-counter-box')) document.getElementById('puzzle-counter-box').style.display = 'block';
        if(document.getElementById('difficultyRow')) document.getElementById('difficultyRow').style.display = 'none';
        if(document.getElementById('marquee-duel')) document.getElementById('marquee-duel').style.display = 'none';

        const indeksAcak = Math.floor(Math.random() * bankPosisiPuzzle.length);
        const posisiFenAcak = bankPosisiPuzzle[indeksAcak];
        
        game.load(posisiFenAcak);
        board.position(posisiFenAcak);
    } else {
        modePuzzleAktif = false;
        if(document.getElementById('puzzle-counter-box')) document.getElementById('puzzle-counter-box').style.display = 'none';
        game.reset();
        board.start();

        if (mode === 'ai') {
            if(document.getElementById('difficultyRow')) document.getElementById('difficultyRow').style.display = 'flex';
            if(document.getElementById('marquee-duel')) document.getElementById('marquee-duel').style.display = 'none';
        } else {
            if(document.getElementById('difficultyRow')) document.getElementById('difficultyRow').style.none;
            if(document.getElementById('marquee-duel')) document.getElementById('marquee-duel').style.display = 'block';
        }
    }

    const timeLimitEl = document.getElementById('timeLimit');
    const durasiPilihan = timeLimitEl ? parseInt(timeLimitEl.value) : 300;
    waktuPutih = durasiPilihan;
    waktuHitam = durasiPilihan;

    formatTampilanJam('clock-white', waktuPutih);
    formatTampilanJam('clock-black', waktuHitam);
    if(document.getElementById('timer-white')) document.getElementById('timer-white').classList.remove('active-timer');
    if(document.getElementById('timer-black')) document.getElementById('timer-black').classList.remove('active-timer');

    statusEl.innerText = "Menu Terkunci. Klik START GAME untuk mulai.";
}

function mulaiPermainanNyata() {
    if(document.getElementById('start-overlay')) document.getElementById('start-overlay').style.display = 'none';
    gameDimulai = true;
    
    const modeAktif = document.getElementById('gameMode').value;
    tukarArahJam(); 

    if (modeAktif === 'friend') {
        if (!usernameSaya || !roomId) {
            alert("Sesi Akun tidak terdeteksi! Harap masuk melalui pintu Lobby Utama.");
            window.location.href = "index.html";
            return;
        }

        if (peranSaya === 'b') {
            board.orientation('black');
        }

        aktifkanListenerOnline();
        statusEl.innerText = `🎮 Mode Online Aktif! Kamu memegang pion: ${peranSaya === 'w' ? 'PUTIH' : 'HITAM'}`;
    } else if (modePuzzleAktif) {
        statusEl.innerText = "🧩 Mode Puzzle: Habisi lawan dalam 5 langkah atau kurang!";
    } else {
        statusEl.innerText = "Giliran: Klik Putih (Kamu) - Game Dimulai!";
    }
}

function kirimLangkahKeFirebase() {
    db.collection("room_catur").doc(roomId).set({
        fen: game.fen(),
        turn: game.turn(),
        waktuUpdate: firebase.firestore.FieldValue.serverTimestamp()
    })
    .catch((error) => {
        console.error("Gagal mengirim langkah: ", error);
    });
}

function aktifkanListenerOnline() {
    db.collection("room_catur").doc(roomId)
    .onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data();
            
            if (data.fen !== game.fen()) {
                game.load(data.fen);  
                board.position(data.fen);    
                tukarArahJam();
                updateStatus();
                
                kotakAsal = null;
                hapusHighlight();
            }
        }
    });
}

// Initial binding Chessboard UI
const config = {
    draggable: false,
    position: 'start',
    pieceTheme: 'Aset/{piece}.png'
};

board = Chessboard('board', config);

$('#board').on('click', '.square-55d63', function() {
    const square = $(this).attr('data-square');
    onSquareClick(square);
});
