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

// --- VARIABEL GLOBAL UTOMATIS MEMBACA SESSION ---
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

// Inisialisasi Kejadian DOM Bersiap
document.addEventListener("DOMContentLoaded", function() {
    const gameModeSelect = document.getElementById('gameMode');
    if (gameModeSelect) {
        gameModeSelect.value = modeDariUrl;
        // Panggil reset game agar menyesuaikan layout tampilan berdasarkan mode URL
        resetGame();
    }
    
    const userAktifTeks = document.getElementById('user-aktif-teks');
    if (userAktifTeks && usernameSaya) {
        userAktifTeks.innerText = "Status: Bermain sebagai " + usernameSaya;
    }

    const infoPemainAktif = document.getElementById('info-pemain-aktif');
    if (infoPemainAktif) {
        infoPemainAktif.innerText = usernameSaya ? `👤 Akun Anda: ${usernameSaya} (${peranSaya === 'w' ? 'Putih' : 'Hitam'})` : "👤 Mode Offline (Tamu)";
    }

    if (modeDariUrl === 'friend' && usernameSaya) {
        window.addEventListener('beforeunload', function () {
            db.collection("para_pemain").doc(usernameSaya).delete();
        });
        // Aktifkan sinkronisasi database multiplayer secara otomatis
        aktifkanListenerOnline();
    }
});

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
    const warnaPilihan = document.getElementById('playerColor').value; // Mengambil pilihan warna (white/black)

    // 1. SENSOR ONLINE: Kunci papan jika bukan giliran mu saat online multiplayer
    if (modeGame === 'friend' && game.turn() !== peranSaya) {
        statusEl.innerText = "⏳ Sabar! Ini giliran temanmu.";
        return;
    }
    
    // 2. SENSOR OFFLINE VS AI: Kunci papan jika sekarang giliran AI (Komputer) yang jalan
    if (modeGame === 'ai') {
        // Jika pilih Main Putih, maka saat giliran hitam ('b') papan akan dikunci (karena itu giliran AI)
        if (warnaPilihan === 'white' && game.turn() === 'b') return;
        
        // Jika pilih Main Hitam, maka saat giliran putih ('w') papan akan dikunci (karena itu giliran AI)
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

    // Logika Penghitung Langkah Khusus Mode Puzzle
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

    tukarArahJam(); 
    updateStatus();

    // SINKRONISASI KE FIREBASE (Jika Mode Multi-pemain Online)
    if (modeGame === 'friend') {
        kirimLangkahKeFirebase();
    }

    // Memicu Balasan Mesin Komputer AI
    if (modeGame === 'ai' && !game.game_over()) {
        // AI membalas jika giliran hitam DAN user memilih main sebagai Putih
        // ATAU AI membalas jika giliran putih DAN user memilih main sebagai Hitam
        if ((game.turn() === 'b' && warnaPilihan === 'white') || (game.turn() === 'w' && warnaPilihan === 'black')) {
            statusEl.innerText = "🤖 AI sedang berpikir...";
            setTimeout(pemicuLangkahAI, 500); 
        }
    }
}

function mulaiPermainanNyata() {
    document.getElementById('start-overlay').style.none = 'none'; // Sembunyikan overlay start
    document.getElementById('start-overlay').style.display = 'none';
    gameDimulai = true;
    
    const modeAktif = document.getElementById('gameMode').value;
    tukarArahJam(); 

    if (modeAktif === 'friend') {
        if (!usernameSaya || !roomId) {
            alert("Data sesi online tidak ditemukan! Silakan masuk via halaman utama.");
            window.location.href = "index.html";
            return;
        }
        
        if (peranSaya === 'b' && board !== null) {
            board.orientation('black');
        }
        statusEl.innerText = `🎮 Mode Online Aktif! Anda memegang pion: ${peranSaya === 'w' ? 'PUTIH' : 'HITAM'}`;
    } else if (modeAktif === 'puzzle') {
        statusEl.innerText = "🧩 Mode Puzzle: Habisi lawan dalam 5 langkah mati!";
    } else {
        // Mode VS AI
        const warnaPilihan = document.getElementById('playerColor').value;
        if (warnaPilihan === 'black') {
            board.orientation('black'); // Balik papan agar hitam di bawah
            statusEl.innerText = "🤖 AI (Putih) sedang berpikir untuk langkah pertama...";
            setTimeout(pemicuLangkahAI, 600); // Paksa AI jalan duluan sebagai Putih
        } else {
            board.orientation('white');
            statusEl.innerText = "Giliran: Klik Bidak Putih (Kamu) untuk memulai!";
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

    if (game.turn() === 'w') {
        document.getElementById('timer-white').classList.add('active-timer');
        document.getElementById('timer-black').classList.remove('active-timer');
    } else {
        document.getElementById('timer-black').classList.add('active-timer');
        document.getElementById('timer-white').classList.remove('active-timer');
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
                kalimatEjekan = "AI berkata: 'Waduh... Otakmu perlu diservis, jalan begitu saja tidak lihat! 🤫'";
            } else {
                kalimatEjekan = "🎉 LUAR BIASA! Kamu berhasil merontokkan sekrup prosesor robot AI ini! 🧠💥";
            }
        } else {
            if (turnSekarang === 'w') {
                kalimatEjekan = "⚫ PEMAIN HITAM MENANG! <br> Putih mending pulang aja, bersihin papan tulis sana! 🤫";
            } else {
                kalimatEjekan = "⚪ PEMAIN PUTIH MENANG! <br> Hitam, blundermu epic sekali! Harga dirimu jatuh di petak catur ini! 📉";
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
        board.position(posisiFenAcak); 
    } else {
        modePuzzleAktif = false;
        document.getElementById('puzzle-counter-box').style.display = 'none'; 
        game.reset();
        board.start();

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

    const durasiPilihan = parseInt(document.getElementById('timeLimit').value);
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
    tukarArahJam(); 

    if (modeAktif === 'friend') {
        if (!usernameSaya || !roomId) {
            alert("Data sesi online tidak ditemukan! Silakan masuk via halaman utama.");
            window.location.href = "index.html";
            return;
        }
        
        if (peranSaya === 'b' && board !== null) {
            board.orientation('black');
        }
        statusEl.innerText = `🎮 Mode Online Aktif! Anda memegang pion: ${peranSaya === 'w' ? 'PUTIH' : 'HITAM'}`;
    } else if (modeAktif === 'puzzle') {
        statusEl.innerText = "🧩 Mode Puzzle: Habisi lawan dalam 5 langkah mati!";
    } else {
        const warnaPilihan = document.getElementById('playerColor').value;
        if (warnaPilihan === 'black') {
            board.orientation('black');
            statusEl.innerText = "Giliran: Komputer (Putih) jalan duluan...";
            setTimeout(pemicuLangkahAI, 600);
        } else {
            board.orientation('white');
            statusEl.innerText = "Giliran: Klik Bidak Putih (Kamu) untuk memulai!";
        }
    }
}

// --- KONFIGURASI VISUAL CHESSBOARDJS ---
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

// --- SISTEM FIREBASE ONLINE MULTIPLAYER ---
function kirimLangkahKeFirebase() {
    if (!roomId) return;
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
    if (!roomId) return;
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

// Jalankan sistem reset pertama kali saat halaman dibuka
resetGame();
