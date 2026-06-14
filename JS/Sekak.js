// --- CONFIG FIREBASE ---
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

// --- VARIABEL GLOBAL OTOMATIS MEMBACA SESSION ---
let usernameSaya = sessionStorage.getItem("catur_username") || "";
let roomId = sessionStorage.getItem("catur_room_id") || "";
let peranSaya = sessionStorage.getItem("catur_peran") || "w"; // 'w' untuk putih, 'b' untuk hitam

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

let waktuPutih = 300; 
let waktuHitam = 300; 
let intervalJam = null;
let gameDimulai = false; 
let aiEngine = null;

// --- DETEKSI OTOMATIS MODE DARI URL QUERY ---
const urlParams = new URLSearchParams(window.location.search);
const modeDariUrl = urlParams.get('mode') || 'ai';

// --- INISIALISASI ENGINE STOCKFISH ---
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

// Inisialisasi Kejadian DOM Bersiap
document.addEventListener("DOMContentLoaded", function() {
    // Jalankan konfigurasi visual papan catur ChessboardJS terlebih dahulu
    const config = {
        draggable: false,
        position: 'start',
        pieceTheme: 'Aset/{piece}.png'
    };
    board = Chessboard('board', config);

    // Ikat event klik petak ke DOM Board milik jQuery
    $('#board').on('click', '.square-55d63', function() {
        const square = $(this).attr('data-square');
        onSquareClick(square);
    });

    const gameModeSelect = document.getElementById('gameMode');
    if (gameModeSelect) {
        gameModeSelect.value = modeDariUrl;
        
        // Listener jika user mengubah mode permainan lewat dropdown di dalam game
        gameModeSelect.addEventListener('change', function() {
            resetGame();
            daftarkanDiriKeLobby(); // Re-register saat mode berubah ke 'friend'
        });
        
        resetGame();
    }
    
    const userAktifTeks = document.getElementById('user-aktif-teks');
    if (userAktifTeks && usernameSaya) {
        userAktifTeks.innerText = "Status: Bermain sebagai " + usernameSaya;
    }

    if (modeDariUrl === 'friend' && usernameSaya) {
        window.addEventListener('beforeunload', function () {
            db.collection("para_pemain").doc(usernameSaya).delete();
        });
    }

    // Daftarkan ke sistem radar online multiplayer
    daftarkanDiriKeLobby();
});

function kembaliKeHome() {
    if (usernameSaya) {
        db.collection("para_pemain").doc(usernameSaya).delete()
        .then(() => { window.location.href = "index.html"; })
        .catch(() => { window.location.href = "index.html"; });
    } else {
        window.location.href = "index.html";
    }
}

// --- LOGIKA KLIK PETAK (Langkah Catur) ---
function onSquareClick(square) {
    const modeGame = document.getElementById('gameMode').value;
    const warnaPilihan = document.getElementById('playerColor').value;

    // 1. SENSOR ONLINE: Kunci papan jika bukan giliran mu saat online multiplayer
    if (modeGame === 'friend' && game.turn() !== peranSaya) {
        statusEl.innerText = "⏳ Sabar! Ini giliran temanmu.";
        return;
    }
    
    // 2. SENSOR OFFLINE VS AI: Kunci papan jika sekarang giliran AI (Komputer) yang jalan
    if (modeGame === 'ai') {
        if (warnaPilihan === 'white' && game.turn() === 'b') return;
        if (warnaPilihan === 'black' && game.turn() === 'w') return;
    }

    // 3. SENSOR MODE PUZZLE: Kunci bidak hitam (hanya boleh main sisi putih)
    if (modeGame === 'puzzle' && game.turn() === 'b') {
        return;
    }

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

    // Fitur Rokade / Lukir via klik Raja bertemu Benteng sendiri
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

    // Eksekusi Langkah Normal
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

    const modeGame = document.getElementById('gameMode').value;
    const warnaPilihan = document.getElementById('playerColor').value;

    if (modeGame === 'puzzle') {
        langkahPuzzleTerpakai++;
        let sisa = jatahLangkahPuzzle - langkahPuzzleTerpakai;
        document.getElementById('sisa-langkah').innerText = sisa;
        if (sisa <= 0 && !game.in_checkmate()) {
            clearInterval(intervalJam);
            statusEl.innerText = "❌ Langkah Gagal! Jatah 5 langkah habis.";
            alert("Kamu gagal menyelesaikan puzzle dalam jatah 5 langkah!");
            return;
        }
    }

    // PENTING: Jalankan tukarArahJam terlebih dahulu untuk mereset waktu sebelum update status
    tukarArahJam(); 
    updateStatus();

    if (modeGame === 'friend') {
        kirimLangkahKeFirebase();
    }

    if (modeGame === 'ai' && !game.game_over()) {
        if ((game.turn() === 'b' && warnaPilihan === 'white') || (game.turn() === 'w' && warnaPilihan === 'black')) {
            statusEl.innerText = "🤖 AI sedang berpikir...";
            setTimeout(pemicuLangkahAI, 500); 
        }
    }
}

function pemicuLangkahAI() {
    if (!aiEngine) return;
    aiEngine.postMessage('position fen ' + game.fen());
    aiEngine.postMessage('go movetime 1000'); 
}

// --- SISTEM DURASI JAM ---
function tukarArahJam() {
    clearInterval(intervalJam);
    if (game.game_over()) return;

    // Jalankan hitung mundur berdasarkan giliran bidak di papan FEN (game.turn())
    intervalJam = setInterval(function() {
        if (game.turn() === 'w') {
            // Giliran Putih melangkah
            waktuPutih--;
            formatTampilanJam('clock-white', waktuPutih);
            
            document.getElementById('timer-white').classList.add('active-timer');
            document.getElementById('timer-black').classList.remove('active-timer');
            
            if (waktuPutih <= 0) pemicuKalahWaktu('Putih');
        } else {
            // Giliran Hitam melangkah
            waktuHitam--;
            formatTampilanJam('clock-black', waktuHitam);
            
            document.getElementById('timer-black').classList.add('active-timer');
            document.getElementById('timer-white').classList.remove('active-timer');
            
            if (waktuHitam <= 0) pemicuKalahWaktu('Hitam');
        }
    }, 1000);
}

function formatTampilanJam(idElemen, totalDetik) {
    if (totalDetik < 0) totalDetik = 0;
    const menit = Math.floor(totalDetik / 60);
    const detik = totalDetik % 60;
    const teksMenit = menit < 10 ? '0' + menit : menit;
    const teksDetik = detik < 10 ? '0' + detik : detik;
    document.getElementById(idElemen).innerText = teksMenit + ':' + teksDetik;
}

function pemicuKalahWaktu(siapaYangHabis) {
    clearInterval(intervalJam);
    document.getElementById('timer-white').classList.remove('active-timer');
    document.getElementById('timer-black').classList.remove('active-timer');
    
    const pemenang = siapaYangHabis === 'Putih' ? 'Hitam' : 'Putih (Kamu)';
    statusEl.innerHTML = `⏰ <b>GAME OVER!</b> Waktu Berpikir ${siapaYangHabis} Habis. Pemain <b>${pemenang} MENANG!</b>`;
}

// --- VISUAL HIGHLIGHT ---
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
                kalimatEjekan = "🎉 LUAR BIASA! Kamu berhasil mengalahkan komputer AI ini! 🧠💥";
            }
        } else {
            if (turnSekarang === 'w') {
                kalimatEjekan = "⚫ PEMAIN HITAM MENANG! 🤫";
            } else {
                kalimatEjekan = "⚪ PEMAIN PUTIH MENANG! 📉";
            }
        }

        document.getElementById('taunt-text').innerHTML = kalimatEjekan;
        document.getElementById('gameover-overlay').style.display = 'flex';
        status = '💥 GAME OVER! Skakmat.';
    } else if (game.in_draw()) {
        clearInterval(intervalJam);
        status = '🤝 GAME OVER! Pertandingan Remis.';
    } else {
        let moveColor = turnSekarang === 'w' ? 'Putih (Kamu)' : 'Hitam';
        if (mode === 'friend') moveColor = turnSekarang === 'w' ? 'Putih' : 'Hitam';
        status = 'Giliran: Klik ' + moveColor;
        if (game.in_check()) status += ' (⚠️ SKAK!)';
    }
    statusEl.innerText = status;
}

// --- RESET SISTEM DAN PAPAN ---
function resetGame() {
    clearInterval(intervalJam);
    hapusHighlight();
    kotakAsal = null;
    gameDimulai = false;

    document.getElementById('gameover-overlay').style.display = 'none';
    document.getElementById('start-overlay').style.display = 'flex';

    const jamPutih = document.getElementById('timer-white');
    const jamHitam = document.getElementById('timer-black');
    const wadahAtas = document.getElementById('timer-wrapper-top');
    const wadahBawah = document.getElementById('timer-wrapper-bottom');
    
    if(wadahAtas && wadahBawah && jamPutih && jamHitam) {
        wadahAtas.appendChild(jamHitam);
        wadahBawah.appendChild(jamPutih);
    }
    
    if(jamPutih && jamHitam) {
        document.querySelector('#timer-white .timer-label').innerText = "⚪ PUTIH (KAMU)";
        document.querySelector('#timer-black .timer-label').innerText = "⚫ HITAM";
    }

    const mode = document.getElementById('gameMode').value;
    
    if (mode === 'puzzle') {
        modePuzzleAktif = true;
        jatahLangkahPuzzle = 5;
        langkahPuzzleTerpakai = 0;
        document.getElementById('sisa-langkah').innerText = jatahLangkahPuzzle;
        document.getElementById('puzzle-counter-box').style.display = 'block'; 
        document.getElementById('difficultyRow').style.display = 'none';
        document.getElementById('playerColorRow').style.display = 'none';
        document.getElementById('marquee-duel').style.display = 'none';

        const indeksAcak = Math.floor(Math.random() * bankPosisiPuzzle.length);
        const posisiFenAcak = bankPosisiPuzzle[indeksAcak];
        
        game.load(posisiFenAcak); 
        if (board) board.position(posisiFenAcak); 
    } else {
        modePuzzleAktif = false;
        document.getElementById('puzzle-counter-box').style.display = 'none'; 
        game.reset();
        if (board) {
            board.start();
            board.orientation('white');
        }

        if (mode === 'ai') {
            document.getElementById('difficultyRow').style.display = 'flex';
            document.getElementById('playerColorRow').style.display = 'flex';
            document.getElementById('marquee-duel').style.display = 'none';
        } else {
            document.getElementById('difficultyRow').style.display = 'none';
            document.getElementById('playerColorRow').style.display = 'none';
            document.getElementById('marquee-duel').style.display = 'block';
        }
    }

    const durasiPilihan = parseInt(document.getElementById('timeLimit').value) || 300;
    waktuPutih = durasiPilihan;
    waktuHitam = durasiPilihan;

    formatTampilanJam('clock-white', waktuPutih);
    formatTampilanJam('clock-black', waktuHitam);
    document.getElementById('timer-white').classList.remove('active-timer');
    document.getElementById('timer-black').classList.remove('active-timer');

    statusEl.innerText = "Menu Terkunci. Klik START GAME untuk mulai.";
}


function mulaiPermainanNyata() {
    document.getElementById('start-overlay').style.display = 'none';
    gameDimulai = true;
    
    const modeAktif = document.getElementById('gameMode').value;

    const jamPutih = document.getElementById('timer-white');
    const jamHitam = document.getElementById('timer-black');
    const wadahAtas = document.getElementById('timer-wrapper-top');
    const wadahBawah = document.getElementById('timer-wrapper-bottom');

    if (modeAktif === 'friend') {
        if (!usernameSaya || !roomId) {
            alert("Data sesi online tidak ditemukan! Silakan masuk via halaman utama.");
            window.location.href = "index.html";
            return;
        }
        
        if (peranSaya === 'b' && board !== null) {
            board.orientation('black');
            
            // SAYA HITAM: Pindahkan kontainer jam Hitam ke bawah, jam Putih ke atas
            if(wadahAtas && wadahBawah && jamPutih && jamHitam) {
                wadahAtas.appendChild(jamPutih);
                wadahBawah.appendChild(jamHitam);
            }
            
            document.querySelector('#timer-black .timer-label').innerText = "⚫ HITAM (KAMU)";
            document.querySelector('#timer-white .timer-label').innerText = "⚪ PUTIH";
        } else {
            if (board) board.orientation('white');
            
            // SAYA PUTIH: Jam Putih di bawah, jam Hitam di atas
            if(wadahAtas && wadahBawah && jamPutih && jamHitam) {
                wadahAtas.appendChild(jamHitam);
                wadahBawah.appendChild(jamPutih);
            }
            
            document.querySelector('#timer-white .timer-label').innerText = "⚪ PUTIH (KAMU)";
            document.querySelector('#timer-black .timer-label').innerText = "⚫ HITAM";
        }
        statusEl.innerText = `🎮 Mode Online Aktif! Anda memegang pion: ${peranSaya === 'w' ? 'PUTIH' : 'HITAM'}`;

    } else if (modeAktif === 'puzzle') {
        statusEl.innerText = "🧩 Mode Puzzle: Habisi lawan dalam 5 langkah mati!";
    } else {
        // MODE VS AI
        const warnaPilihan = document.getElementById('playerColor').value;
        if (warnaPilihan === 'black') {
            if (board) board.orientation('black');
            
            // VS AI SEBAGAI HITAM: Pindahkan jam Hitam ke bawah (Klien), jam AI (Putih) ke atas
            if(wadahAtas && wadahBawah && jamPutih && jamHitam) {
                wadahAtas.appendChild(jamPutih);
                wadahBawah.appendChild(jamHitam);
            }
            
            document.querySelector('#timer-black .timer-label').innerText = "⚫ HITAM (KAMU)";
            document.querySelector('#timer-white .timer-label').innerText = "⚪ AI (KOMPUTER)";
            
            statusEl.innerText = "🤖 AI (Putih) sedang berpikir...";
            // Pemicu awal karena AI memegang putih (jalan duluan)
            tukarArahJam(); 
            setTimeout(pemicuLangkahAI, 600);
            return; // Keluar dari fungsi agar tidak double trigger tukarArahJam di bawah
        } else {
            if (board) board.orientation('white');
            
            // VS AI SEBAGAI PUTIH: Jam Putih tetap di bawah
            if(wadahAtas && wadahBawah && jamPutih && jamHitam) {
                wadahAtas.appendChild(jamHitam);
                wadahBawah.appendChild(jamPutih);
            }
            
            document.querySelector('#timer-white .timer-label').innerText = "⚪ PUTIH (KAMU)";
            document.querySelector('#timer-black .timer-label').innerText = "⚫ AI (KOMPUTER)";
            
            statusEl.innerText = "Giliran: Klik Bidak Putih (Kamu) untuk memulai!";
        }
    }

    // Jalankan timer pendukung setelah reposisi HTML selesai
    tukarArahJam(); 
}


// --- FIREBASE ONLINE MULTIPLAYER ENGINE ---
function kirimLangkahKeFirebase() {
    if (!roomId) return;
    db.collection("room_catur").doc(roomId).set({
        fen: game.fen(),
        turn: game.turn(),
        waktuPutih: waktuPutih,
        waktuHitam: waktuHitam,
        waktuUpdate: firebase.firestore.FieldValue.serverTimestamp()
    })
    .catch((error) => {
        console.error("Gagal mengirim langkah: ", error);
    });
}

function aktifkanListenerOnline() {
    if (!roomId) return;
    db.collection("room_catur").doc(roomId)
    .onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data();
            if (data.fen !== game.fen()) {
                game.load(data.fen);  
                if (board) board.position(data.fen);    
                
                if (data.waktuPutih !== undefined) waktuPutih = data.waktuPutih;
                if (data.waktuHitam !== undefined) waktuHitam = data.waktuHitam;
                
                tukarArahJam();
                updateStatus();
                
                kotakAsal = null;
                hapusHighlight();
            }
        }
    });
}

// --- ADJUSTED SISTEM RADAR LOBBY ---
function daftarkanDiriKeLobby() {
    // Ambil atau buat nama otomatis
    usernameSaya = sessionStorage.getItem("catur_username");
    if (!usernameSaya || usernameSaya === "") {
        usernameSaya = "Pemain_" + Math.floor(1000 + Math.random() * 9000);
        sessionStorage.setItem("catur_username", usernameSaya);
    }

    // Tampilkan ke profil di halaman jika elemennya ada
    const infoProfil = document.getElementById('info-pemain-aktif');
    if (infoProfil) {
        infoProfil.innerHTML = `👤 Akun: <b>${usernameSaya}</b> <span style="color:#39ff14; font-size:11px;">● ONLINE</span>`;
    }

    console.log("Mendaftarkan " + usernameSaya + " ke Firestore para_pemain...");

    // LANGSUNG DAFTARKAN TANPA PERLU CEK DROPDOWN GAME MODE
    db.collection("para_pemain").doc(usernameSaya).set({
        nama: usernameSaya,
        status: "di_lobby",
        lawan: "",
        roomId: "",
        waktuLogin: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
        console.log("🔥 BERHASIL MASUK DATABASE! Menyalakan radar pemain lain...");
        // Langsung paksa jalankan radar pemantau
        pantauPemainLainLobby();
        dengarkanTantanganMasuk();
    })
    .catch((error) => {
        console.error("❌ Gagal mendaftar ke Firestore: ", error);
    });
}


function pantauPemainLainLobby() {
    console.log("📡 Radar aktif! Mencari pemain lain di Firestore...");

    db.collection("para_pemain").onSnapshot((snapshot) => {
        const areaDaftar = document.getElementById('daftar-pemain-online');
        
        // JIKA ELEMEN HTML TIDAK KETEMU, KITA JADIKAN ALERT SUPAYA KETAHUAN ERRORNYA
        if (!areaDaftar) {
            alert("PERINGATAN: Elemen HTML dengan id='daftar-pemain-online' TIDAK DITEMUKAN di file HTML Anda! Silakan buat elemen <div id='daftar-pemain-online'></div> di HTML.");
            return;
        }

        areaDaftar.innerHTML = ""; 
        let adaPemainLain = false;

        console.log("Menerima pembaruan data dari Firebase. Jumlah total dokumen: " + snapshot.size);

        snapshot.forEach((doc) => {
            const dataPemain = doc.data();
            console.log("Memeriksa pemain dari database: ", dataPemain);
            
            // Tampilkan jika namanya ada dan BUKAN nama saya sendiri
            if (dataPemain.nama && dataPemain.nama !== usernameSaya) {
                adaPemainLain = true;
                
                const itemPemain = document.createElement('div');
                itemPemain.style.cssText = "display:flex; justify-content:space-between; align-items:center; background:#1f222f; padding:8px 12px; margin-bottom:8px; border-radius:6px; border:1px solid #2d3246; color:#fff;";
                
                let tombolAksi = "";
                if (dataPemain.status === "di_lobby") {
                    tombolAksi = `<button onclick="kirimTantangan('${dataPemain.nama}')" style="background:#00b894; color:white; border:none; padding:6px 12px; border-radius:4px; font-weight:bold; cursor:pointer; font-size:12px;">⚔️ TANTANG</button>`;
                } else {
                    tombolAksi = `<span style="color:#aaa; font-size:12px; font-style:italic;">🚫 BERMAIN</span>`;
                }

                itemPemain.innerHTML = `<span style="font-weight:bold;">🎮 ${dataPemain.nama}</span> ${tombolAksi}`;
                areaDaftar.appendChild(itemPemain);
            }
        });

        if (!adaPemainLain) {
            console.log("Tidak ada pemain lain selain " + usernameSaya);
            areaDaftar.innerHTML = `<p style="color:#aaa; font-size:13px; font-style:italic; text-align:center;">📭 Lobby sepi, belum ada pemain lain yang online...</p>`;
        }
    }, (error) => {
        console.error("❌ Error Snapshot Radar: ", error);
    });
}



function dengarkanTantanganMasuk() {
    db.collection("para_pemain").doc(usernameSaya)
    .onSnapshot((doc) => {
        if (doc.exists) {
            const dataSaya = doc.data();
            const areaNotif = document.getElementById('notifikasi-tantangan');
            
            if (dataSaya.status === "ditantang" && dataSaya.lawan && dataSaya.roomId) {
                if (areaNotif) {
                    areaNotif.innerHTML = `
                        <div style="background:#2d1515; border:2px solid #ef4444; padding:15px; border-radius:8px; text-align:center; margin-bottom:15px;">
                            <h4 style="margin:0 0 5px 0; color:#ef4444;">⚔️ TANTANGAN MASUK!</h4>
                            <p style="margin:0 0 12px 0; font-size:14px;">Kamu ditantang duel oleh <b>${dataSaya.lawan}</b>!</p>
                            <button onclick="terimaTantangan('${dataSaya.lawan}', '${dataSaya.roomId}')" style="background:#39ff14; color:#000; border:none; padding:8px 16px; font-weight:bold; border-radius:4px; cursor:pointer; margin-right:10px;">TERIMA (GAS)</button>
                            <button onclick="tolakTantangan('${dataSaya.lawan}')" style="background:#ef4444; color:#fff; border:none; padding:8px 16px; font-weight:bold; border-radius:4px; cursor:pointer;">TOLAK</button>
                        </div>
                    `;
                }
            } else if (dataSaya.status === "bermain" && dataSaya.roomId) {
                // DIPERBAIKI: Jika penantang melihat tantangannya telah diterima (status berubah jadi bermain)
                if (roomId !== dataSaya.roomId) {
                    roomId = dataSaya.roomId;
                    sessionStorage.setItem("catur_room_id", roomId);
                    aktifkanListenerOnline();
                }
            } else {
                if (areaNotif) areaNotif.innerHTML = "";
            }
        }
    });
}

function kirimTantangan(namaLawan) {
    // Generate Room ID unik berbasis waktu agar tidak konflik di Firebase
    const uidUnik = Math.floor(100 + Math.random() * 900);
    roomId = "room_" + usernameSaya + "_vs_" + namaLawan + "_" + uidUnik;
    peranSaya = "w"; 
    sessionStorage.setItem("catur_room_id", roomId);
    sessionStorage.setItem("catur_peran", peranSaya);

    // 1. Buat dokumen room_catur terlebih dahulu
    db.collection("room_catur").doc(roomId).set({
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        turn: "w",
        waktuPutih: parseInt(document.getElementById('timeLimit').value) || 300,
        waktuHitam: parseInt(document.getElementById('timeLimit').value) || 300,
        waktuUpdate: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        // 2. Beri tahu target lawan bahwa dia ditantang
        db.collection("para_pemain").doc(namaLawan).update({
            status: "ditantang",
            lawan: usernameSaya,
            roomId: roomId
        });

        // 3. Ubah status diri sendiri menjadi bermain
        db.collection("para_pemain").doc(usernameSaya).update({
            status: "bermain",
            lawan: namaLawan,
            roomId: roomId
        });

        alert("Tantangan terkirim! Menunggu konfirmasi lawan...");
        aktifkanListenerOnline();
        mulaiPermainanNyata();
    }).catch((err) => {
        console.error("Gagal membuat room: ", err);
    });
}

function terimaTantangan(namaLawan, idKamar) {
    roomId = idKamar;
    peranSaya = "b"; 
    
    sessionStorage.setItem("catur_room_id", roomId);
    sessionStorage.setItem("catur_peran", peranSaya);

    // Update status diri sendiri ke Firebase
    db.collection("para_pemain").doc(usernameSaya).update({
        status: "bermain"
    }).then(() => {
        alert("Tantangan diterima! Anda memegang bidak HITAM.");
        
        const areaNotif = document.getElementById('notifikasi-tantangan');
        if (areaNotif) areaNotif.innerHTML = "";
        
        aktifkanListenerOnline();
        mulaiPermainanNyata();
    });
}

function tolakTantangan(namaLawan) {
    db.collection("para_pemain").doc(namaLawan).update({
        status: "di_lobby",
        lawan: "",
        roomId: ""
    });
    db.collection("para_pemain").doc(usernameSaya).update({
        status: "di_lobby",
        lawan: "",
        roomId: ""
    });
}
