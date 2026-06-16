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
  "8/8/8/8/8/8/5K2/6Rk w - - 0 1",
  "r5k1/5ppp/8/8/8/5Q2/5PPP/6K1 w - - 0 1",
  "6k1/5ppp/5r2/8/8/5Q2/5PPP/6K1 w - - 0 1",
    "7k/5Qpp/8/8/8/8/5PPP/6K1 w - - 0 1",
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
];

const game = new Chess();
let board = null;
let kotakAsal = null;
const statusEl = document.getElementById("status");

let waktuPutih = 300;
let waktuHitam = 300;
let intervalJam = null;
let gameDimulai = false;
let aiEngine = null;

// --- DETEKSI OTOMATIS MODE DARI URL QUERY ---
const urlParams = new URLSearchParams(window.location.search);
const modeDariUrl = urlParams.get("mode") || "ai";

// --- INISIALISASI ENGINE STOCKFISH ---
try {
    aiEngine = new Worker("JS/stockfish.js");
} catch (e) {
    if (typeof STOCKFISH === "function") {
        aiEngine = STOCKFISH();
    }
}

if (aiEngine) {
    aiEngine.onmessage = function (event) {
        if (event.data.indexOf("bestmove") > -1) {
            const moveSourceTarget = event.data.split(" ")[1];
            const from = moveSourceTarget.substring(0, 2);
            const to = moveSourceTarget.substring(2, 4);

            game.move({ from: from, to: to, promotion: "q" });
            board.position(game.fen());

            tukarArahJam();
            updateStatus();
        }
    };
}

document.addEventListener("DOMContentLoaded", function() {
    const config = {
        draggable: false,
        position: 'start',
        pieceTheme: 'Aset/{piece}.png'
    };
    board = Chessboard('board', config);

setTimeout(() => {
    board.resize();
}, 300);

    $('#board').on('click', '.square-55d63', function() {
        const square = $(this).attr('data-square');
        onSquareClick(square);
    });

    // Ambil cadangan data sesi terakhir
    usernameSaya = sessionStorage.getItem("catur_username") || "";
    roomId = sessionStorage.getItem("catur_room_id") || "";
    peranSaya = sessionStorage.getItem("catur_peran") || "w";

    const gameModeSelect = document.getElementById('gameMode');
    if (gameModeSelect) {
        if (roomId && usernameSaya && peranSaya !== "viewer") {
            gameModeSelect.value = 'friend'; // Paksa kunci ke mode friend jika reconnect
        } else {
            gameModeSelect.value = modeDariUrl;
        }
        
        gameModeSelect.addEventListener('change', function() {
            resetGame();
            daftarkanDiriKeLobby();
        });
    }

    // ⚡ PROSES EMERGENCY RECONNECT JET ⚡
    if (usernameSaya && roomId) {
        console.log("Menyambung kembali ke pertandingan yang terputus...");
        
        const startOverlay = document.getElementById('start-overlay');
        if (startOverlay) startOverlay.style.display = 'none'; // Lewati tombol ready
        gameDimulai = true;

        // Tarik data posisi bidak terakhir dari database room Anda
        db.collection("room_catur").doc(roomId).get().then((doc) => {
            if (doc.exists) {
                const dataRoom = doc.data();
                game.load(dataRoom.fen); // Masukkan posisi catur terakhir
                if (board) {
                    board.position(dataRoom.fen);
                    if (peranSaya === 'b') {
                        board.orientation('black');
                    } else {
                        board.orientation('white');
                    }
                }
                
                aktifkanListenerOnline();
                tukarArahJam();
                updateStatus();
                alert("⚡ Pertandingan berhasil dipulihkan! Lanjutkan permainan.");
            } else {
                sessionStorage.removeItem("catur_room_id");
                roomId = "";
                daftarkanDiriKeLobby();
            }
        }).catch(() => {
            daftarkanDiriKeLobby();
        });
    } else {
        daftarkanDiriKeLobby();
    }
});



function kembaliKeHome() {
    if (usernameSaya) {
        db.collection("para_pemain")
            .doc(usernameSaya)
            .delete()
            .then(() => {
                window.location.href = "index.html";
            })
            .catch(() => {
                window.location.href = "index.html";
            });
    } else {
        window.location.href = "index.html";
    }
}

// --- LOGIKA KLIK PETAK (Langkah Catur) ---
function onSquareClick(square) {
  
  // 🛑 PENGAMAN UTAMA BAGI PENONTON (SPECTATOR)
    if (peranSaya === "viewer") {
        console.log("Akses ditolak: Anda hanya penonton!");
        return false; // Stop fungsi di sini, bidak tidak akan bisa digerakkan sama sekali
    }
  
    const modeGame = document.getElementById("gameMode").value;
    const warnaPilihan = document.getElementById("playerColor").value;

    // 1. SENSOR ONLINE: Kunci papan jika bukan giliran mu saat online multiplayer
    if (modeGame === "friend" && game.turn() !== peranSaya) {
        statusEl.innerText = "⏳ Sabar! Ini giliran temanmu.";
        return;
    }

    // 2. SENSOR OFFLINE VS AI: Kunci papan jika sekarang giliran AI (Komputer) yang jalan
    if (modeGame === "ai") {
        if (warnaPilihan === "white" && game.turn() === "b") return;
        if (warnaPilihan === "black" && game.turn() === "w") return;
    }

    // 3. SENSOR MODE PUZZLE: Kunci bidak hitam (hanya boleh main sisi putih)
    if (modeGame === "puzzle" && game.turn() === "b") {
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
    if (
        bidakDipilih &&
        bidakDipilih.type === "k" &&
        bidakTujuan &&
        bidakTujuan.type === "r" &&
        bidakDipilih.color === bidakTujuan.color
    ) {
        let kotakTujuanRaja = null;
        if (square === "h1") kotakTujuanRaja = "g1";
        if (square === "a1") kotakTujuanRaja = "c1";
        if (square === "h8") kotakTujuanRaja = "g8";
        if (square === "a8") kotakTujuanRaja = "c8";

        if (kotakTujuanRaja) {
            let moveLukir = game.move({
                from: kotakAsal,
                to: kotakTujuanRaja,
                promotion: "q"
            });
            if (moveLukir !== null) {
                return suksesMelangkah();
            }
        }
    }

    // Eksekusi Langkah Normal
    let move = game.move({ from: kotakAsal, to: square, promotion: "q" });
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

    const modeGame = document.getElementById("gameMode").value;
    const warnaPilihan = document.getElementById("playerColor").value;

    if (modeGame === "puzzle") {
        langkahPuzzleTerpakai++;
        let sisa = jatahLangkahPuzzle - langkahPuzzleTerpakai;
        document.getElementById("sisa-langkah").innerText = sisa;
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

    if (modeGame === "friend") {
        kirimLangkahKeFirebase();
    }

    if (modeGame === "ai" && !game.game_over()) {
        if (
            (game.turn() === "b" && warnaPilihan === "white") ||
            (game.turn() === "w" && warnaPilihan === "black")
        ) {
            statusEl.innerText = "🤖 AI sedang berpikir...";
            setTimeout(pemicuLangkahAI, 500);
        }
    }
}

function pemicuLangkahAI() {
    if (!aiEngine) return;
    aiEngine.postMessage("position fen " + game.fen());
    aiEngine.postMessage("go movetime 1000");
}

// --- SISTEM DURASI JAM (RESET PENUH SETIAP PERGANTIAN GILIRAN) ---
function tukarArahJam() {
    // 1. Bersihkan interval yang lama agar tidak menumpuk
    clearInterval(intervalJam);
    if (game.game_over()) return;

    // 2. Ambil batas waktu awal dari dropdown HTML (jika tidak ada, default 300 detik / 5 menit)
    const durasiAwalPilihan = parseInt(document.getElementById('timeLimit').value) || 300;

    // 3. LOGIKA UTAMA: Reset penuh waktu pemain yang BARU SAJA selesai melangkah
    if (game.turn() === 'w') {
        // Jika sekarang giliran PUTIH yang jalan, berarti HITAM baru saja selesai melangkah.
        // Maka, waktu Hitam di-reset penuh kembali ke posisi awal.
        waktuHitam = durasiAwalPilihan;
        formatTampilanJam('clock-black', waktuHitam);

        // Beri efek visual lampu aktif ke jam Putih
        document.getElementById('timer-white').classList.add('active-timer');
        document.getElementById('timer-black').classList.remove('active-timer');
    } else {
        // Jika sekarang giliran HITAM yang jalan, berarti PUTIH baru saja selesai melangkah.
        // Maka, waktu Putih di-reset penuh kembali ke posisi awal.
        waktuPutih = durasiAwalPilihan;
        formatTampilanJam('clock-white', waktuPutih);

        // Beri efek visual lampu aktif ke jam Hitam
        document.getElementById('timer-black').classList.add('active-timer');
        document.getElementById('timer-white').classList.remove('active-timer');
    }

    // 4. Jalankan hitung mundur 1 detik sekali untuk pemain yang sedang giliran berjalan
    intervalJam = setInterval(function() {
        if (game.turn() === 'w') {
            // Putih sedang berpikir, kurangi waktu putih
            waktuPutih--;
            formatTampilanJam('clock-white', waktuPutih);
            if (waktuPutih <= 0) pemicuKalahWaktu('Putih');
        } else {
            // Hitam sedang berpikir, kurangi waktu hitam
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
    const teksMenit = menit < 10 ? "0" + menit : menit;
    const teksDetik = detik < 10 ? "0" + detik : detik;
    document.getElementById(idElemen).innerText = teksMenit + ":" + teksDetik;
}

function pemicuKalahWaktu(siapaYangHabis) {
    clearInterval(intervalJam);
    document.getElementById("timer-white").classList.remove("active-timer");
    document.getElementById("timer-black").classList.remove("active-timer");

    const pemenang = siapaYangHabis === "Putih" ? "Hitam" : "Putih (Kamu)";
    statusEl.innerHTML = `⏰ <b>GAME OVER!</b> Waktu Berpikir ${siapaYangHabis} Habis.
    Pemain <b>${pemenang} MENANG!</b>`;
    if(roomId){

    db.collection("room_catur")
    .doc(roomId)
    .update({

        statusGame: "selesai",

        pemenang:
        siapaYangHabis === "Putih"
        ? "Hitam"
        : "Putih"

    });

}
}

// --- VISUAL HIGHLIGHT ---
function highlightSquare(square) {
    $("#board .square-" + square).css("background", "rgba(255, 159, 67, 0.5)");
}

function hapusHighlight() {
    $("#board .square-55d63").css("background", "");
}

function updateStatus() {
    if (waktuPutih <= 0 || waktuHitam <= 0) return;

    let status = '';
    const mode = document.getElementById('gameMode').value;
    const turnSekarang = game.turn(); 
    const overlayGameOver = document.getElementById('gameover-overlay');
    const tauntTextEl = document.getElementById('taunt-text');

    if (game.in_checkmate()) {
        clearInterval(intervalJam);
        let kalimatEjekan = "";
        
        // 1. PENENTUAN KALIMAT EJEKAN BERDASARKAN MODE DAN MENANG/KALAH
        if (mode === 'ai') {
            if (turnSekarang === 'w') {
                kalimatEjekan = "Aduh... Otakmu perlu diservis! 🤫<br><span style='font-size:16px; color:#aaa;'>Kalah kok sama Komputer...</span>";
            } else {
                kalimatEjekan = "🎉 LUAR BIASA! Kamu berhasil mengalahkan komputer AI ini! 🧠💥";
            }
             // 🔥 KIRIM STATUS SELESAI & PEMENANG KE FIREBASE ROOM
            if (roomId) {
                db.collection("room_catur").doc(roomId).update({
                    statusGame: "selesai",
                    pemenang: pemenangFirebase
                });
            }
        
        } else if (mode === 'friend') {
            // Mode Online: Cek apakah SAYA yang kalah atau MENANG
            let sayaKalah = (turnSekarang === peranSaya);
            if (sayaKalah) {
                kalimatEjekan = "Yahh kalah... cupu banget! 🤫📉<br><span style='font-size:16px; color:#ef4444;'>Jangan nangis, ayo balas dendam!</span>";
            } else {
                kalimatEjekan = "👑 MENANG BOS!! Lawanmu kena Mental! 👑<br><span style='font-size:16px; color:#39ff14;'>Tunggu dia nangis minta rematch...</span>";
            }
        } else {
            // Mode Puzzle atau default
            kalimatEjekan = turnSekarang === 'w' ? "⚫ PEMAIN HITAM MENANG! 🤫" : "⚪ PEMAIN PUTIH MENANG! 📉";
        }

        // 2. TAMPILKAN KALIMAT EJEKAN MENUTUPI BOARD VIA OVERLAY
        if (tauntTextEl) {
            tauntTextEl.innerHTML = kalimatEjekan;
        }
        
        if (overlayGameOver) {
            overlayGameOver.style.display = 'flex'; // Munculkan layer menutupi board
        }

        status = '💥 GAME OVER! Skakmat.';
        
    } else if (game.in_draw()) {
        clearInterval(intervalJam);
        
        if (tauntTextEl) {
            tauntTextEl.innerHTML = "🤝 Pertandingan Remis! Sama-sama kuat atau sama-sama... ah sudahlah. 🥴";
        }
        if (overlayGameOver) {
            overlayGameOver.style.display = 'flex';
        }
        
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
  document.getElementById("arena-pertandingan").style.display = "none";
  document.getElementById("timeLimit").disabled = false;
  
  const btnMenyerah = document.getElementById("btn-menyerah");
if (btnMenyerah) {
    btnMenyerah.style.display = "none";
}
  
    clearInterval(intervalJam);
    hapusHighlight();
    kotakAsal = null;
    gameDimulai = false;

    document.getElementById("gameover-overlay").style.display = "none";
    document.getElementById("start-overlay").style.display = "flex";

    const jamPutih = document.getElementById("timer-white");
    const jamHitam = document.getElementById("timer-black");
    const wadahAtas = document.getElementById("timer-wrapper-top");
    const wadahBawah = document.getElementById("timer-wrapper-bottom");

    if (wadahAtas && wadahBawah && jamPutih && jamHitam) {
        wadahAtas.appendChild(jamHitam);
        wadahBawah.appendChild(jamPutih);
    }

    if (jamPutih && jamHitam) {
        document.querySelector("#timer-white .timer-label").innerText =
            "⚪ PUTIH (KAMU)";
        document.querySelector("#timer-black .timer-label").innerText =
            "⚫ HITAM";
    }

    const mode = document.getElementById("gameMode").value;

    if (mode === "puzzle") {
        modePuzzleAktif = true;
        jatahLangkahPuzzle = 5;
        langkahPuzzleTerpakai = 0;
        document.getElementById("sisa-langkah").innerText = jatahLangkahPuzzle;
        document.getElementById("puzzle-counter-box").style.display = "block";
        document.getElementById("difficultyRow").style.display = "none";
        document.getElementById("playerColorRow").style.display = "none";
        document.getElementById("marquee-duel").style.display = "none";

        const indeksAcak = Math.floor(Math.random() * bankPosisiPuzzle.length);
        const posisiFenAcak = bankPosisiPuzzle[indeksAcak];

        game.load(posisiFenAcak);
        if (board) board.position(posisiFenAcak);
    } else {
        modePuzzleAktif = false;
        document.getElementById("puzzle-counter-box").style.display = "none";
        game.reset();
        if (board) {
            board.start();
            board.orientation("white");
        }

        if (mode === "ai") {
            document.getElementById("difficultyRow").style.display = "flex";
            document.getElementById("playerColorRow").style.display = "flex";
            document.getElementById("marquee-duel").style.display = "none";
        } else {
            document.getElementById("difficultyRow").style.display = "none";
            document.getElementById("playerColorRow").style.display = "none";
            document.getElementById("marquee-duel").style.display = "block";
        }
    }

    const durasiPilihan =
        parseInt(document.getElementById("timeLimit").value) || 300;
    waktuPutih = durasiPilihan;
    waktuHitam = durasiPilihan;

    formatTampilanJam("clock-white", waktuPutih);
    formatTampilanJam("clock-black", waktuHitam);
    document.getElementById("timer-white").classList.remove("active-timer");
    document.getElementById("timer-black").classList.remove("active-timer");

    statusEl.innerText = "Menu Terkunci. Klik START GAME untuk mulai.";
    
    document.getElementById("btn-reset-board").style.display = "block";
}

function mulaiPermainanNyata() {
  document.getElementById("game-action-panel").style.display = "flex";
  document.getElementById("arena-pertandingan").style.display = "block";
document.getElementById("panel-start").style.display = "none";

document.getElementById("btn-reset-board").style.display = "block";


setTimeout(() => {
    if(board){
        board.resize();
        board.position(game.fen());
    }
}, 100);
  
  const btnMenyerah = document.getElementById("btn-menyerah");
if (btnMenyerah) {
    btnMenyerah.style.display = "block";
}
  
    document.getElementById('start-overlay').style.display = 'none';
    aktifkanOnlyGameMode();
    gameDimulai = true;

    // 🎵 PEMICU BACKSOUND: Musik mulai berputar begitu tombol START GAME ditekan
    const audio = document.getElementById('gameBacksound');
    if (audio) {
        audio.volume = 0.4; // Atur volume (0.0 sampai 1.0) agar tidak terlalu keras
        audio.play().catch(error => {
            console.log("Autoplay diblokir oleh browser, membutuhkan klik tambahan:", error);
        });
    }
    const modeAktif = document.getElementById("gameMode").value;

    const jamPutih = document.getElementById("timer-white");
    const jamHitam = document.getElementById("timer-black");
    const wadahAtas = document.getElementById("timer-wrapper-top");
    const wadahBawah = document.getElementById("timer-wrapper-bottom");

    if (modeAktif === "friend") {
      document.getElementById("timeLimit").disabled = true;
      
        if (!usernameSaya || !roomId) {
            alert(
                "Data sesi online tidak ditemukan! Silakan masuk via halaman utama."
            );
            window.location.href = "index.html";
            return;
        }

        if (peranSaya === "b" && board !== null) {
            board.orientation("black");

            // SAYA HITAM: Pindahkan kontainer jam Hitam ke bawah, jam Putih ke atas
            if (wadahAtas && wadahBawah && jamPutih && jamHitam) {
                wadahAtas.appendChild(jamPutih);
                wadahBawah.appendChild(jamHitam);
            }

            document.querySelector("#timer-black .timer-label").innerText =
                "⚫ HITAM (KAMU)";
            document.querySelector("#timer-white .timer-label").innerText =
                "⚪ PUTIH";
        } else {
            if (board) board.orientation("white");

            // SAYA PUTIH: Jam Putih di bawah, jam Hitam di atas
            if (wadahAtas && wadahBawah && jamPutih && jamHitam) {
                wadahAtas.appendChild(jamHitam);
                wadahBawah.appendChild(jamPutih);
            }

            document.querySelector("#timer-white .timer-label").innerText =
                "⚪ PUTIH (KAMU)";
            document.querySelector("#timer-black .timer-label").innerText =
                "⚫ HITAM";
        }
        statusEl.innerText = `🎮 Mode Online Aktif! Anda memegang pion: ${peranSaya === "w" ? "PUTIH" : "HITAM"}`;
    } else if (modeAktif === "puzzle") {
        statusEl.innerText =
            "🧩 Mode Puzzle: Habisi lawan dalam 5 langkah mati!";
    } else {
        // MODE VS AI
        const warnaPilihan = document.getElementById("playerColor").value;
        if (warnaPilihan === "black") {
            if (board) board.orientation("black");

            // VS AI SEBAGAI HITAM: Pindahkan jam Hitam ke bawah (Klien), jam AI (Putih) ke atas
            if (wadahAtas && wadahBawah && jamPutih && jamHitam) {
                wadahAtas.appendChild(jamPutih);
                wadahBawah.appendChild(jamHitam);
            }

            document.querySelector("#timer-black .timer-label").innerText =
                "⚫ HITAM (KAMU)";
            document.querySelector("#timer-white .timer-label").innerText =
                "⚪ AI (KOMPUTER)";

            statusEl.innerText = "🤖 AI (Putih) sedang berpikir...";
            // Pemicu awal karena AI memegang putih (jalan duluan)
            tukarArahJam();
            setTimeout(pemicuLangkahAI, 600);
            return; // Keluar dari fungsi agar tidak double trigger tukarArahJam di bawah
        } else {
            if (board) board.orientation("white");

            // VS AI SEBAGAI PUTIH: Jam Putih tetap di bawah
            if (wadahAtas && wadahBawah && jamPutih && jamHitam) {
                wadahAtas.appendChild(jamHitam);
                wadahBawah.appendChild(jamPutih);
            }

            document.querySelector("#timer-white .timer-label").innerText =
                "⚪ PUTIH (KAMU)";
            document.querySelector("#timer-black .timer-label").innerText =
                "⚫ AI (KOMPUTER)";

            statusEl.innerText =
                "Giliran: Klik Bidak Putih (Kamu) untuk memulai!";
        }
    }

    // Jalankan timer pendukung setelah reposisi HTML selesai
    tukarArahJam();
}

// --- FIREBASE ONLINE MULTIPLAYER ENGINE ---
function kirimLangkahKeFirebase() {
    if (!roomId) return;
    db.collection("room_catur")
        .doc(roomId)
        .set({
            fen: game.fen(),
            turn: game.turn(),
            waktuPutih: waktuPutih,
            waktuHitam: waktuHitam,
            waktuUpdate: firebase.firestore.FieldValue.serverTimestamp()
        })
        .catch(error => {
            console.error("Gagal mengirim langkah: ", error);
        });
}

function aktifkanListenerOnline() {
    if (!roomId) return;
    db.collection("room_catur")
        .doc(roomId)
        .onSnapshot(doc => {
            if (doc.exists) {
                const data = doc.data();
                
                if(data.statusGame === "selesai"){

    clearInterval(intervalJam);

    document.getElementById('taunt-text').innerHTML =
    "⏰ Pertandingan selesai karena waktu habis.";

    document.getElementById('gameover-overlay')
    .style.display = 'flex';

    return;
}
                
                if (data.fen !== game.fen()) {
                    game.load(data.fen);
                    if (board) board.position(data.fen);

                    if (data.waktuPutih !== undefined)
                        waktuPutih = data.waktuPutih;
                    if (data.waktuHitam !== undefined)
                        waktuHitam = data.waktuHitam;

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
    // 1. Cek apakah sudah punya nama di sessionStorage atau localStorage alat pengunci
    if (!usernameSaya) {
        usernameSaya = sessionStorage.getItem("catur_username") || localStorage.getItem("akun_device_ini");
    }
    
    // 2. Jika benar-benar kosong (pemain baru), buatkan nama acak otomatis
    if (!usernameSaya) {
        usernameSaya = "Pemain_" + Math.floor(1000 + Math.random() * 9000);
        sessionStorage.setItem("catur_username", usernameSaya);
        localStorage.setItem("akun_device_ini", usernameSaya); // Amankan ke pengunci alat
    }

    // 3. Deteksi mode permainan yang sedang aktif terpilih di halaman
    const gameModeSelect = document.getElementById('gameMode');
    const modeAktif = gameModeSelect ? gameModeSelect.value : modeDariUrl;
    
    // 4. UPDATE VISUAL: Tampilkan nama terbaru di layar (Sangat penting setelah Edit Profil!)
    const infoProfil = document.getElementById('info-pemain-aktif');
    if (infoProfil) {
        infoProfil.innerHTML = `👤 Akun: <b>${usernameSaya}</b> <span style="color:#39ff14; font-size:11px;">● ONLINE</span>`;
    }

    // 5. JIKA SEDANG MASUK MODE ONLINE (FRIEND)
    if (modeAktif === 'friend') {
        
        // 🔥 KUNCI RECONNECT: Jika mendeteksi ada pertandingan yang sedang berjalan, 
        // JANGAN TIMPA STATUS JADI LOBBY! Langsung aktifkan radar game.
        if (roomId) {
            console.log("Sesi bertanding aktif terdeteksi, mengaktifkan radar permainan...");
            aktifkanListenerOnline();
            return; // Stop fungsi di sini agar data di database tidak ter-reset
        }

        // Jika murni baru masuk lobby utama (tidak sedang dalam game)
        db.collection("para_pemain").doc(usernameSaya).set({
            nama: usernameSaya,
            status: "di_lobby",
            lawan: "",
            roomId: "",
            waktuLogin: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => {
            console.log("Pendaftaran database berhasil untuk nama: " + usernameSaya);
        }).catch((err) => {
            console.error("Gagal mendaftar ke database: ", err);
        });
        
        // Hidupkan radar pencarian pemain dan tantangan masuk
        pantauPemainLainLobby();
        dengarkanTantanganMasuk();
    }
}


function pantauPemainLainLobby() {
    console.log("⚡ Radar Pemantau Pemain Aktif dinyalakan...");
    
    // Pastikan username dibersihkan dari spasi tak terlihat agar filter akurat
    const namaSayaBersih = (usernameSaya || sessionStorage.getItem("catur_username") || "").trim();

    db.collection("para_pemain").onSnapshot((snapshot) => {
        const areaDaftar = document.getElementById('daftar-pemain-online');
        
        if (!areaDaftar) {
            console.error("Error: Elemen dengan ID 'daftar-pemain-online' tidak ditemukan di HTML!");
            return;
        }

        areaDaftar.innerHTML = ""; // Bersihkan tampilan list lama
        let adaPemainLain = false;

        snapshot.forEach((doc) => {
            const dataPemain = doc.data();
            
            // Ambil nama dari document ID atau dari field 'nama' sebagai backup
            const namaUserLawan = (doc.id || dataPemain.nama || "").trim(); 

            // SINKRONISASI: Jika nama kosong ATAU itu adalah diri Anda sendiri, LEWATI!
            if (!namaUserLawan || namaUserLawan === namaSayaBersih) {
                return; 
            }

            // Jika sampai di sini, berarti fix itu adalah player LAIN yang sedang online
            adaPemainLain = true;
            
            // Buat komponen kotak untuk list pemain lain
            const itemPemain = document.createElement('div');
            itemPemain.style.cssText = "display:flex; justify-content:space-between; align-items:center; background:#1f222f; padding:10px 15px; margin-bottom:10px; border-radius:6px; border:1px solid #2d3246;";
            
            let infoStatusTeks = "";
            let tombolAksiTantang = "";

            // Cek status kesibukan pemain lain di database
            if (dataPemain.status === "bermain" || dataPemain.status === "bertanding") {
                infoStatusTeks = `<span style="color:#ef4444; font-size:11px; font-weight:bold;">🔴 SEDANG BERTANDING</span>`;
                tombolAksiTantang = `
                    <button disabled style="background:#3d404e; color:#777; border:none; padding:6px 12px; border-radius:4px; font-size:12px; cursor:not-allowed; font-weight:bold;">
                        🚫 SIBUK
                    </button>
                `;
            } else if (dataPemain.status === "ditantang") {
                infoStatusTeks = `<span style="color:#ff9f43; font-size:11px; font-weight:bold;">⏳ MENUNGGU NOTIF</span>`;
                tombolAksiTantang = `
                    <button disabled style="background:#3d404e; color:#ff9f43; border:none; padding:6px 12px; border-radius:4px; font-size:12px; cursor:not-allowed; font-weight:bold;">
                        PENDING
                    </button>
                `;
            } else {
                // Status default: "di_lobby"
                infoStatusTeks = `<span style="color:#39ff14; font-size:11px; font-weight:bold;">● READY (DI LOBBY)</span>`;
                tombolAksiTantang = `
                    <button onclick="kirimTantangan('${namaUserLawan}')" style="background:#00b894; color:white; border:none; padding:6px 12px; border-radius:4px; font-weight:bold; cursor:pointer; font-size:12px; transition:0.2s; box-shadow: 0 2px 6px rgba(0,184,148,0.3);">
                        ⚔️ TANTANG
                    </button>
                `;
            }

            // Masukkan struktur visual ke dalam item list
            itemPemain.innerHTML = `
                <div style="text-align: left;">
                    <span style="font-weight:bold; color:#fff; font-size:14px; display:block; margin-bottom:2px;">🎮 ${namaUserLawan}</span>
                    ${infoStatusTeks}
                </div>
                <div>
                    ${tombolAksiTantang}
                </div>
            `;
            
            areaDaftar.appendChild(itemPemain);
        });

        // Kondisi jika tidak ada pemain lain sama sekali di database
        if (!adaPemainLain) {
            areaDaftar.innerHTML = `
                <div style="text-align:center; padding:15px; color:#aaa; font-size:13px; font-style:italic;">
                    📭 Lobby sepi... Belum ada pemain lain yang online saat ini.
                </div>
            `;
        }
    }, (error) => {
        console.error("Radar Firebase gagal memantau room lobby: ", error);
    });
}



function dengarkanTantanganMasuk() {
    db.collection("para_pemain")
        .doc(usernameSaya)
        .onSnapshot(doc => {
            if (doc.exists) {
                const dataSaya = doc.data();
                const areaNotif = document.getElementById(
                    "notifikasi-tantangan"
                );

                if (
                    dataSaya.status === "ditantang" &&
                    dataSaya.lawan &&
                    dataSaya.roomId
                ) {
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
    // OTOMATIS PINDAHKAN MODE DROPDOWN KE 'friend' SAAT MENANTANG
    const gameModeSelect = document.getElementById('gameMode');
    if (gameModeSelect) {
        gameModeSelect.value = 'friend';
    }

    // Generate Room ID unik berbasis waktu agar tidak konflik di Firebase
    const uidUnik = Math.floor(100 + Math.random() * 900);
    roomId = "room_" + usernameSaya + "_vs_" + namaLawan + "_" + uidUnik;
    peranSaya = "w"; 
    sessionStorage.setItem("catur_room_id", roomId);
    sessionStorage.setItem("catur_peran", peranSaya);


 // Ambil batas durasi dari dropdown halaman Anda
    const durasiPilihan = parseInt(document.getElementById('timeLimit').value) || 300;

    // 1. Buat dokumen room_catur terlebih dahulu
    const durasiGameDipilih =
parseInt(document.getElementById('timeLimit').value) || 300;

db.collection("room_catur").doc(roomId).set({
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",

    turn: "w",

    durasiGame: durasiGameDipilih,

    waktuPutih: durasiGameDipilih,
    waktuHitam: durasiGameDipilih,

    statusGame: "berjalan",

    waktuUpdate: firebase.firestore.FieldValue.serverTimestamp()
})
    .then(() => {
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
    // OTOMATIS PINDAHKAN MODE DROPDOWN KE 'friend' SAAT MENERIMA TANTANGAN
    const gameModeSelect = document.getElementById('gameMode');
    if (gameModeSelect) {
        gameModeSelect.value = 'friend';
    }

    roomId = idKamar;
    peranSaya = "b"; 
    
    sessionStorage.setItem("catur_room_id", roomId);
    sessionStorage.setItem("catur_peran", peranSaya);

    // Update status diri sendiri ke Firebase
    db.collection("para_pemain").doc(usernameSaya).update({
        status: "bermain"
    }).then(() => {
      db.collection("room_catur")
.doc(roomId)
.get()
.then((doc)=>{

    const data = doc.data();

    if(data.durasiGame){

        document.getElementById("timeLimit").value =
        data.durasiGame;

    }

});
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

// ==========================================
// SCRIPT KHUSUS PENGATUR MARQUEE (100% AMAN)
// ==========================================
(function() {
    // Fungsi internal khusus untuk memeriksa dan mengatur visibilitas marquee
    function aturTampilanMarqueeOtomatis() {
        const gameModeSelect = document.getElementById('gameMode');
        const marqueeDuel = document.getElementById('marquee-duel');
        
        if (!marqueeDuel) return; // Keluar jika elemen HTML tidak ditemukan

        // Jika select ada dan nilainya 'friend', atau jika variabel global mendeteksi mode friend
        if ((gameModeSelect && gameModeSelect.value === 'friend') || (typeof modeDariUrl !== 'undefined' && modeDariUrl === 'friend')) {
            // Jalankan hanya jika game benar-benar sudah dimulai (overlay start hilang)
            const startOverlay = document.getElementById('start-overlay');
            if (startOverlay && startOverlay.style.display === 'none') {
                marqueeDuel.style.display = 'block'; // Tampilkan
                return;
            }
        }
        
        // Sembunyikan untuk kondisi lainnya (AI, Puzzle, atau saat masih di Overlay Start)
        marqueeDuel.style.display = 'none';
    }

    // 1. Jalankan pemeriksaan setiap kali ada klik di tombol START GAME atau tombol REMATCH
    document.addEventListener('click', function(e) {
        if (e.target && (e.target.classList.contains('btn-start') || e.target.classList.contains('btn-rematch') || e.target.onclick?.toString().includes('mulaiPermainanNyata') || e.target.onclick?.toString().includes('resetGame'))) {
            // Beri sedikit jeda 100ms agar fungsi utama selesai memproses overlay-nya terlebih dahulu
            setTimeout(aturTampilanMarqueeOtomatis, 100);
        }
    });

    setInterval(aturTampilanMarqueeOtomatis, 1000);
})();

// ===============================================================
// SCRIPT KHUSUS: SISTEM TANTANG ULANG (REMATCH) ONLINE MULTIPLAYER
// ===============================================================
(function() {
    let intervalPantauSelesai = null;

    // Fungsi untuk mendeteksi siapa lawan kita saat ini berdasarkan data Firestore terbaru
    function dapatkanNamaLawanAktif() {
        if (!usernameSaya) return "";
        // Mencari nama lawan dari string roomId (Format: room_Budi_vs_Andi_123)
        if (roomId) {
            let bagian = roomId.split('_vs_');
            if (bagian.length > 1) {
                let penantang = bagian[0].replace('room_', '');
                let ditantang = bagian[1].split('_')[0];
                return usernameSaya === penantang ? ditantang : penantang;
            }
        }
        return "";
    }

    function aturTombolRematchOtomatis() {
        const overlaySelesai = document.getElementById('gameover-overlay');
        const modeGame = document.getElementById('gameMode')?.value;
        const areaTombol = document.getElementById('area-tombol-gameover');

        // Fitur ini hanya berjalan jika Game Over muncul dan sedang dalam mode online (friend)
        if (overlaySelesai && overlaySelesai.style.display === 'flex' && modeGame === 'friend' && areaTombol) {
            
            // Hentikan pantauan sementara agar tidak melakukan render ulang terus menerus
            clearInterval(intervalPantauSelesai);

            const lawan = dapatkanNamaLawanAktif();
            const turnSekarang = game.turn(); // 'w' atau 'b' saat skakmat terjadi

            // Tentukan apakah SAYA kalah atau menang
            // Jika giliran putih saat skakmat dan peran saya putih (w), berarti putih kalah.
            let sayaKalah = (turnSekarang === peranSaya) && game.in_checkmate();

            if (sayaKalah) {
                // 1. KONDISI BAGI YANG KALAH: Muncul tulisan tantang lagi & bisa diklik
                areaTombol.innerHTML = `
                    <button class="btn-rematch" style="background:#ef4444; color:#fff; animation: pulse 1.5s infinite;" onclick="window.kirimTantanganUlang('${lawan}')">
                        Yahh kalah... TANTANG lagi lah!! ⚔️
                    </button>
                `;
            } else if (game.in_checkmate()) {
                // 2. KONDISI BAGI YANG MENANG: Menunggu tantangan dari yang kalah
                areaTombol.innerHTML = `
                    <p style="color:#39ff14; font-weight:bold; font-size:14px; margin-bottom:10px;">🎉 Kamu Menang! Menunggu lawan menantang kembali...</p>
                    <button class="btn-rematch" style="background:#555; color:#eee;" onclick="resetGame()">Kembali ke Lobby</button>
                `;
            }
        }
    }

    // Fungsi Global Baru: Dipicu ketika si kalah menekan tombol "Yahh kalah... TANTANG lagi lah!!"
    window.kirimTantanganUlang = function(namaLawan) {
        if (!namaLawan) return alert("Gagal mendeteksi nama lawan untuk rematch.");

        // Buat Room ID baru khusus rematch berbasis waktu agar fresh
        const uidUnik = Math.floor(100 + Math.random() * 900);
        roomId = "room_" + usernameSaya + "_vs_" + namaLawan + "_" + uidUnik;
        peranSaya = "w"; // Si penantang ulang memegang putih kembali
        sessionStorage.setItem("catur_room_id", roomId);
        sessionStorage.setItem("catur_peran", peranSaya);

        const areaTombol = document.getElementById('area-tombol-gameover');
        if (areaTombol) {
            areaTombol.innerHTML = `<p style="color:#aaa; font-style:italic;">Mengirim permintaan rematch...</p>`;
        }

        // 1. Buat Room Catur Baru di Firebase
        db.collection("room_catur").doc(roomId).set({
            fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            turn: "w",
            waktuPutih: 300,
            waktuHitam: 300,
            waktuUpdate: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => {
            // 2. Tembak status lawan menjadi 'ditantang' kembali
            db.collection("para_pemain").doc(namaLawan).update({
                status: "ditantang",
                lawan: usernameSaya,
                roomId: roomId
            });

            // 3. Ubah status diri sendiri menjadi 'bermain'
            db.collection("para_pemain").doc(usernameSaya).update({
                status: "bermain",
                lawan: namaLawan,
                roomId: roomId
            });

            alert("Tantangan ulang berhasil dikirim! Menunggu keputusan si pemenang...");
            
            // Sembunyikan overlay game over dan siapkan papan baru
            document.getElementById('gameover-overlay').style.display = 'none';
            aktifkanListenerOnline();
            mulaiPermainanNyata();
        });
    };

    // Fungsi pemantau yang berjalan setiap detik untuk mendeteksi kapan game berakhir
    setInterval(function() {
        const overlaySelesai = document.getElementById('gameover-overlay');
        if (overlaySelesai && overlaySelesai.style.display === 'flex') {
            aturTombolRematchOtomatis();
        } else {
            // Jika game sedang berjalan normal, reset interval siap mengawasi akhir game berikutnya
            if (!intervalPantauSelesai) {
                intervalPantauSelesai = true;
            }
        }
    }, 1000);
})();

// Fungsi pembantu agar pemain bisa mematikan/menyalakan musik saat juri menilai
function toggleAudio() {
    const audio = document.getElementById('gameBacksound');
    const btn = document.getElementById('btn-toggle-audio');
    if (!audio || !btn) return;

    if (audio.paused) {
        audio.play();
        btn.innerText = "🔈 Mute Music";
    } else {
        audio.pause();
        btn.innerText = "🔊 Play Music";
    }
}

// --- FITUR EDIT PROFIL (ANTI TYPO & SYNC DATABASE) ---
function bukaModalEditProfil() {
    // Ambil nama yang saat ini sedang aktif digunakan
    const namaSekarang = sessionStorage.getItem("catur_username") || usernameSaya;
    
    // Tampilkan prompt popup pop-up untuk memasukkan nama baru
    let namaBaru = prompt("Masukkan nama profil baru kamu (Maksimal 15 karakter):", namaSekarang);
    
    // Validasi jika user menekan batal atau input kosong/sama saja
    if (namaBaru === null) return; 
    namaBaru = namaBaru.trim();
    
    if (namaBaru === "") {
        alert("Nama tidak boleh kosong!");
        return;
    }
    
    if (namaBaru === namaSekarang) {
        alert("Nama baru sama dengan nama lama.");
        return;
    }

    if (namaBaru.length > 15) {
        alert("Nama terlalu panjang! Maksimal 15 karakter.");
        return;
    }

    // Konfirmasi final sebelum eksekusi ke database
    if (confirm(`Apakah kamu yakin ingin mengubah nama dari "${namaSekarang}" menjadi "${namaBaru}"?`)) {
        
        // 1. Bersihkan/Hapus dokumen lama di Firestore agar tidak menjadi sampah database
        db.collection("para_pemain").doc(namaSekarang).delete()
        .then(() => {
            
            // 2. Buat dokumen baru dengan nama yang sudah diperbaiki typo-nya
            return db.collection("para_pemain").doc(namaBaru).set({
                nama: namaBaru,
                status: "di_lobby",
                lawan: "",
                roomId: "",
                waktuLogin: firebase.firestore.FieldValue.serverTimestamp()
            });
        })
        .then(() => {
            // 3. Update semua penyimpanan lokal di browser perangkat
            localStorage.setItem("akun_device_ini", namaBaru); // Update Kunci Perangkat
            sessionStorage.setItem("catur_username", namaBaru); // Update Sesi Game
            
            // 4. Perbarui variabel global di script yang sedang berjalan
            usernameSaya = namaBaru;

            // 5. Perbarui tampilan teks di layar secara realtime
            const infoProfil = document.getElementById('info-pemain-aktif');
            if (infoProfil) {
                infoProfil.innerHTML = `👤 Akun: <b>${usernameSaya}</b> <span style="color:#39ff14; font-size:11px;">● ONLINE</span>`;
            }
            
            const userAktifTeks = document.getElementById('user-aktif-teks');
            if (userAktifTeks) {
                userAktifTeks.innerText = "Status: Bermain sebagai " + usernameSaya;
            }

            alert("🎉 Profil berhasil diperbarui! Nama kamu sekarang adalah: " + namaBaru);
            
            // Hubungkan ulang radar lobby dengan identitas baru
            resetGame();
            daftarkanDiriKeLobby();
        })
        .catch((error) => {
            console.error("Gagal update profil: ", error);
            alert("Gagal mengubah nama karena kendala jaringan database.");
        });
    }
}
function pemicuMenyerah() {

    if (!confirm("Yakin ingin menyerah?")) {
        return;
    }

    const mode = document.getElementById("gameMode").value;

    // MODE AI
    if (mode === "ai") {
        clearInterval(intervalJam);

        document.getElementById('taunt-text').innerHTML =
            "🤖 Kamu menyerah.<br><span style='color:#ef4444'>AI dinyatakan menang!</span>";

        document.getElementById('gameover-overlay').style.display = 'flex';

setTimeout(() => {
    kembaliKeHome();
}, 2000);

        document.getElementById('area-tombol-gameover').innerHTML = `
            <button class="btn-rematch" onclick="resetGame()">
                Main Lagi
            </button>
        `;

        return;
    }

    // MODE PUZZLE
    if (mode === "puzzle") {
        resetGame();
        return;
    }

    if (!confirm("Apakah kamu yakin ingin menyerah dan mengakhiri pertandingan ini?")) {
        return;
    }

    if (!roomId) {
        alert("Pertandingan tidak ditemukan.");
        return;
    }

    // 1. Deteksi nama lawan berdasarkan struktur nama Room ID (room_Penantang_vs_Lawan_123)
    let namaLawan = "";
    let bagian = roomId.split('_vs_');
    if (bagian.length > 1) {
        let penantang = bagian[0].replace('room_', '');
        let ditantang = bagian[1].split('_')[0];
        namaLawan = (usernameSaya === penantang) ? ditantang : penantang;
    }

    if (!namaLawan) {
        namaLawan = "Lawan"; // Antisipasi cadangan jika nama gagal terurai
    }

    // 2. Kirim data ke Firebase Room bahwa game selesai karena menyerah
    db.collection("room_catur").doc(roomId).update({
        statusGame: "selesai",
        pemenang: namaLawan,
        keterangan: `${usernameSaya} Menyerah`
    }).then(() => {
        clearInterval(intervalJam);
        
        // 3. Update status diri sendiri dan lawan di database kembali ke lobby
        db.collection("para_pemain").doc(usernameSaya).update({ status: "di_lobby", lawan: "", roomId: "" });
        db.collection("para_pemain").doc(namaLawan).update({ status: "di_lobby", lawan: "", roomId: "" });

        // 4. Tampilkan pemberitahuan kekalahan di layar overlay
        document.getElementById('taunt-text').innerHTML = `🏳️ Anda telah menyerah.<br><span style='color:#ef4444;'>Pemenangnya adalah ${namaLawan}!</span>`;
        document.getElementById('gameover-overlay').style.display = 'flex';
        
        // Ubah tombol gameover menjadi kembali ke lobby
        document.getElementById('area-tombol-gameover').innerHTML = `
    <button class="btn-rematch"
            onclick="resetGame()">
        🔄 Main Lagi
    </button>

    <button class="btn-rematch"
            style="margin-top:10px;background:#374151;"
            onclick="window.location.href='index.html'">
        🏠 Kembali ke Lobby
    </button>
`;
    }).catch((err) => {
        console.error("Gagal memproses penyerahan: ", err);
    });
}
function aktifkanOnlyGameMode() {
    document.querySelectorAll('.hide-in-game').forEach(el => {
        el.style.display = 'none';
    });

    // Jika penonton
    if (peranSaya === "viewer") {
        const homeBtn = document.querySelector(".btn-home-gaming");
        if(homeBtn){
            homeBtn.style.display = "block";
            
            if(peranSaya !== "viewer"){
    document.getElementById("game-action-panel").style.display = "block";
}
        }
    }
}

function restartBoardOnly() {

    clearInterval(intervalJam);

    hapusHighlight();
    kotakAsal = null;
    gameDimulai = false;

    game.reset();

    if (board) {
        board.start();
        board.orientation("white");
    }

    const durasiPilihan =
        parseInt(document.getElementById("timeLimit").value) || 300;

    waktuPutih = durasiPilihan;
    waktuHitam = durasiPilihan;

    formatTampilanJam("clock-white", waktuPutih);
    formatTampilanJam("clock-black", waktuHitam);

    document.getElementById("timer-white")
        .classList.remove("active-timer");

    document.getElementById("timer-black")
        .classList.remove("active-timer");

    statusEl.innerText = "Papan berhasil diulang. Klik bidak untuk mulai bermain.";
}
function rematchGame() {

    document.getElementById("gameover-overlay").style.display = "none";

    restartBoardOnly();

}

const daftarEjekan = [
    "🙂 Semangat ya.",
    "😏 Masih bisa dibalik kok.",
    "😂 Yakin langkah itu benar?",
    "🥱 Lama mikirnya.",
    "🤣 Aku mulai kasihan.",
    "🤡 Strategi atau tersandung?",
    "🔥 Ayo, kasih perlawanan!",
    "💀 Raja-mu mulai panik."
];

let timerEjek = null;

function ejekLawan() {

    const balon = document.getElementById("balon-ejek");

    const acak = Math.floor(Math.random() * daftarEjekan.length);

    balon.innerText = daftarEjekan[acak];
    balon.style.display = "block";

    clearTimeout(timerEjek);

    timerEjek = setTimeout(() => {
        balon.style.display = "none";
    }, 2000);
}