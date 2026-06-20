// ============================================================
// game-engine.js
// Logika inti papan catur: AI Stockfish, klik petak,
// highlight, timer, status, dan kontrol game.
// ============================================================

// --- INISIALISASI STOCKFISH ---
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
            const bagian = event.data.split(" ");
            const moveStr = bagian[1];

            // "bestmove (none)" atau tidak valid → skip
            if (!moveStr || moveStr === "(none)") {
                updateStatus();
                return;
            }

            const from = moveStr.substring(0, 2);
            const to   = moveStr.substring(2, 4);

            const hasilMove = game.move({ from, to, promotion: "q" });
            if (!hasilMove) return;

            if (board) board.position(game.fen());

            const modeGame = document.getElementById("gameMode")?.value;

            // Puzzle: AI balas tapi jangan putar timer (timer hanya untuk player)
            if (modeGame === "puzzle") {
                updateStatus();
                if (game.in_checkmate()) {
                    // Jika AI malah kena mat setelah balas → player menang
                    tampilHasilPuzzle(true);
                }
                return;
            }

            // Mode AI normal
            tukarArahJam();
            updateStatus();
        }
    };
}

// --- INISIALISASI BOARD SAAT DOM SIAP ---
document.addEventListener("DOMContentLoaded", function () {
    const config = {
        draggable:   false,
        position:    'start',
        pieceTheme:  'Aset/{piece}.png'
    };
    board = Chessboard('board', config);

    setTimeout(() => { board.resize(); }, 300);

    // Klik petak via jQuery
    $('#board').on('click', '.square-55d63', function () {
        const square = $(this).attr('data-square');
        onSquareClick(square);
    });

    // Baca ulang sesi dari storage
    usernameSaya = sessionStorage.getItem("catur_username") || "";
    roomId       = sessionStorage.getItem("catur_room_id")  || "";
    peranSaya    = sessionStorage.getItem("catur_peran")    || "w";

    // Atur select mode permainan
    const gameModeSelect = document.getElementById('gameMode');
    if (gameModeSelect) {
        if (roomId && usernameSaya && peranSaya !== "viewer") {
            gameModeSelect.value = 'friend';
        } else {
            gameModeSelect.value = modeDariUrl;
        }
        gameModeSelect.addEventListener('change', function () {
            resetGame();
            daftarkanDiriKeLobby();
        });
    }

    // ⚡ EMERGENCY RECONNECT: Sambung kembali pertandingan yang terputus
    if (usernameSaya && roomId) {
        console.log("Menyambung kembali ke pertandingan yang terputus...");
        const startOverlay = document.getElementById('start-overlay');
        if (startOverlay) startOverlay.style.display = 'none';
        gameDimulai = true;

        db.collection("room_catur").doc(roomId).get().then((doc) => {
            if (doc.exists) {
                const dataRoom = doc.data();
                game.load(dataRoom.fen);
                if (board) {
                    board.position(dataRoom.fen);
                    board.orientation(peranSaya === 'b' ? 'black' : 'white');
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
        }).catch(() => { daftarkanDiriKeLobby(); });
    } else {
        daftarkanDiriKeLobby();
    }
});

// --- LOGIKA KLIK PETAK ---
function onSquareClick(square) {

    // Blokir penonton
    if (peranSaya === "viewer") {
        console.log("Akses ditolak: Anda hanya penonton!");
        return false;
    }

    const modeGame    = document.getElementById("gameMode").value;
    const warnaPilihan = document.getElementById("playerColor").value;

    // Sensor online: kunci jika bukan giliran kita
    if (modeGame === "friend" && game.turn() !== peranSaya) {
        statusEl.innerText = "⏳ Sabar! Ini giliran temanmu.";
        return;
    }

    // Sensor VS AI: kunci saat giliran AI
    if (modeGame === "ai") {
        if (warnaPilihan === "white" && game.turn() === "b") return;
        if (warnaPilihan === "black" && game.turn() === "w") return;
    }

    // Sensor puzzle: blokir input player saat giliran AI membalas
    if (modeGame === "puzzle" && game.turn() === "b") {
        // Giliran hitam = giliran AI membalas, player tidak boleh klik
        return;
    }

    if (game.game_over() || waktuPutih <= 0 || waktuHitam <= 0) return;

    // Pilih bidak
    if (kotakAsal === null) {
        const piece = game.get(square);
        if (piece && piece.color === game.turn()) {
            kotakAsal = square;
            highlightSquare(square);
        }
        return;
    }

    // Batalkan pilihan jika klik kotak yang sama
    if (kotakAsal === square) {
        hapusHighlight();
        kotakAsal = null;
        return;
    }

    // Fitur Rokade via klik Raja → Benteng
    const bidakDipilih = game.get(kotakAsal);
    const bidakTujuan  = game.get(square);
    if (
        bidakDipilih && bidakDipilih.type === "k" &&
        bidakTujuan  && bidakTujuan.type  === "r" &&
        bidakDipilih.color === bidakTujuan.color
    ) {
        const peta = { h1: "g1", a1: "c1", h8: "g8", a8: "c8" };
        const kotakTujuanRaja = peta[square];
        if (kotakTujuanRaja) {
            const moveLukir = game.move({ from: kotakAsal, to: kotakTujuanRaja, promotion: "q" });
            if (moveLukir !== null) return suksesMelangkah();
        }
    }

    // Langkah normal
    const move = game.move({ from: kotakAsal, to: square, promotion: "q" });
    putarSuara(sfxMove);
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

    const modeGame     = document.getElementById("gameMode").value;
    const warnaPilihan = document.getElementById("playerColor").value;

    if (modeGame === "puzzle") {
        // Hitung hanya langkah PLAYER (putih), bukan balasan AI
        langkahPuzzleTerpakai++;
        const sisa = jatahLangkahPuzzle - langkahPuzzleTerpakai;
        const sisaEl = document.getElementById("sisa-langkah");
        if (sisaEl) sisaEl.innerText = sisa;

        // Cek mat setelah langkah player
        if (game.in_checkmate()) {
            tampilHasilPuzzle(true);
            return;
        }

        // Jatah habis tanpa mat
        if (sisa <= 0) {
            tampilHasilPuzzle(false);
            return;
        }

        // AI balas langkah dengan level sesuai pilihan
        updateStatus();
        statusEl.innerText = "🤖 AI membalas...";
        setTimeout(pemicuLangkahAIPuzzle, 600);
        return;
    }

    updateStatus();

    if (modeGame === "friend") {
        // tukarArahJam() sudah dipanggil di dalam kirimLangkahKeFirebase
        // agar tidak double-trigger
        kirimLangkahKeFirebase();
    } else {
        // Mode AI & Puzzle: putar timer langsung di sini
        tukarArahJam();
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
    const levelAI = document.getElementById("aiLevel")?.value || "3";
    aiEngine.postMessage("setoption name Skill Level value " + levelAI);
    aiEngine.postMessage("position fen " + game.fen());
    aiEngine.postMessage("go movetime 1000");
}

// AI balas di mode puzzle — pakai level sesuai pilihan, waktu lebih singkat
function pemicuLangkahAIPuzzle() {
    if (!aiEngine || game.game_over()) return;
    const levelAI = document.getElementById("aiLevel")?.value || "3";
    aiEngine.postMessage("setoption name Skill Level value " + levelAI);
    aiEngine.postMessage("position fen " + game.fen());
    // Waktu pikir AI di puzzle lebih singkat agar tidak terasa lambat
    aiEngine.postMessage("go movetime 500");
}

// Tampilkan hasil puzzle: berhasil atau gagal
function tampilHasilPuzzle(berhasil) {
    clearInterval(intervalJam);
    gameDimulai = false;

    const tauntEl   = document.getElementById('taunt-text');
    const overlayEl = document.getElementById('gameover-overlay');
    const areaTombol = document.getElementById('area-tombol-gameover');

    if (berhasil) {
        if (tauntEl) tauntEl.innerHTML =
            `🎉 BERHASIL! Kamu menyelesaikan puzzle!<br>
             <span style="color:#aaa; font-size:13px;">
                Tersisa ${jatahLangkahPuzzle - langkahPuzzleTerpakai} langkah tidak terpakai.
             </span>`;
    } else {
        if (tauntEl) tauntEl.innerHTML =
            `❌ Gagal! Jatah 5 langkah habis.<br>
             <span style="color:#aaa; font-size:13px;">Coba lagi dengan strategi berbeda!</span>`;
    }

    if (overlayEl) overlayEl.style.display = 'flex';
    if (areaTombol) areaTombol.innerHTML = `
        <button class="btn-rematch" onclick="resetGame()">🔄 Puzzle Baru</button>
    `;
}

// --- SISTEM JAM ---
function tukarArahJam() {
    clearInterval(intervalJam);
    if (game.game_over()) return;

    const durasiAwal = parseInt(document.getElementById('timeLimit').value) || 300;

    if (game.turn() === 'w') {
        waktuHitam = durasiAwal;
        formatTampilanJam('clock-black', waktuHitam);
        document.getElementById('timer-white').classList.add('active-timer');
        document.getElementById('timer-black').classList.remove('active-timer');
    } else {
        waktuPutih = durasiAwal;
        formatTampilanJam('clock-white', waktuPutih);
        document.getElementById('timer-black').classList.add('active-timer');
        document.getElementById('timer-white').classList.remove('active-timer');
    }

    intervalJam = setInterval(function () {
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
    document.getElementById(idElemen).innerText =
        (menit < 10 ? "0" + menit : menit) + ":" +
        (detik < 10 ? "0" + detik : detik);
}

function pemicuKalahWaktu(siapaYangHabis) {
    clearInterval(intervalJam);
    document.getElementById("timer-white").classList.remove("active-timer");
    document.getElementById("timer-black").classList.remove("active-timer");

    const pemenang = siapaYangHabis === "Putih" ? "Hitam" : "Putih (Kamu)";
    statusEl.innerHTML = `⏰ <b>GAME OVER!</b> Waktu ${siapaYangHabis} Habis. Pemain <b>${pemenang} MENANG!</b>`;

    if (roomId) {
        db.collection("room_catur").doc(roomId).update({
            statusGame: "selesai",
            pemenang:   siapaYangHabis === "Putih" ? "Hitam" : "Putih"
        });
    }
}

// --- HIGHLIGHT PETAK ---
function highlightSquare(square) {
    $("#board .square-" + square).css("background", "rgba(255, 159, 67, 0.5)");
}

function hapusHighlight() {
    $("#board .square-55d63").css("background", "");
}

// --- HELPER: RENDER TOMBOL GAMEOVER SESUAI MODE ---
function _tombolGameOver(mode) {
    if (mode === 'ai') {
        return `
            <button class="btn-rematch" onclick="mainLagiSamaWarna()">
                🔄 Main Lagi
            </button>
            <button class="btn-rematch btn-swap" onclick="tukarWarnaAI()">
                🔃 Tukar Warna
            </button>
            <button class="btn-rematch btn-lobby" onclick="kembaliKeHome()">
                🏠 Kembali ke Lobby
            </button>
        `;
    } else if (mode === 'friend') {
        return `
            <button class="btn-rematch" onclick="mainLagiSamaWarna()">
                🔄 Main Lagi (Warna Sama)
            </button>
            <button class="btn-rematch btn-swap" onclick="mintaTukarWarna()">
                🔃 Minta Tukar Warna
            </button>
            <button class="btn-rematch btn-lobby" onclick="kembaliKeHome()">
                🏠 Kembali ke Lobby
            </button>
        `;
    }
    return `<button class="btn-rematch" onclick="resetGame()">🔄 Puzzle Baru</button>`;
}

// --- UPDATE STATUS ---
function updateStatus() {
    if (waktuPutih <= 0 || waktuHitam <= 0) return;

    let status = '';
    const mode         = document.getElementById('gameMode').value;
    const turnSekarang = game.turn();
    const overlayGameOver = document.getElementById('gameover-overlay');
    const tauntTextEl     = document.getElementById('taunt-text');

    if (game.in_checkmate()) {
        clearInterval(intervalJam);
        gameDimulai = false;
        let kalimatEjekan = "";

        if (mode === 'ai') {
            kalimatEjekan = turnSekarang === 'w'
                ? "Aduh... Otakmu perlu diservis! 🤫<br><span style='font-size:16px; color:#aaa;'>Kalah kok sama Komputer...</span>"
                : "🎉 LUAR BIASA! Kamu berhasil mengalahkan komputer AI ini! 🧠💥";
        } else if (mode === 'friend') {
            const sayaKalah = (turnSekarang === peranSaya);
            kalimatEjekan = sayaKalah
                ? "Yahh kalah... cupu banget! 🤫📉<br><span style='font-size:16px; color:#ef4444;'>Jangan nangis, ayo balas dendam!</span>"
                : "👑 MENANG BOS!! Lawanmu kena Mental! 👑<br><span style='font-size:16px; color:#39ff14;'>Tunggu dia nangis minta rematch...</span>";
        } else {
            kalimatEjekan = turnSekarang === 'w' ? "⚫ PEMAIN HITAM MENANG! 🤫" : "⚪ PEMAIN PUTIH MENANG! 📉";
        }

        if (tauntTextEl) tauntTextEl.innerHTML = kalimatEjekan;
        if (overlayGameOver) overlayGameOver.style.display = 'flex';

        // Inject tombol sesuai mode
        const areaTombol = document.getElementById('area-tombol-gameover');
        if (areaTombol) areaTombol.innerHTML = _tombolGameOver(mode);

        status = '💥 GAME OVER! Skakmat.';

    } else if (game.in_draw()) {
        clearInterval(intervalJam);
        gameDimulai = false;
        if (tauntTextEl) tauntTextEl.innerHTML = "🤝 Pertandingan Remis! Sama-sama kuat atau sama-sama... ah sudahlah. 🥴";
        if (overlayGameOver) overlayGameOver.style.display = 'flex';

        const areaTombol = document.getElementById('area-tombol-gameover');
        if (areaTombol) areaTombol.innerHTML = _tombolGameOver(mode);

        status = '🤝 GAME OVER! Pertandingan Remis.';

    } else {
        let moveColor = turnSekarang === 'w' ? 'Putih (Kamu)' : 'Hitam';
        if (mode === 'friend') moveColor = turnSekarang === 'w' ? 'Putih' : 'Hitam';
        status = 'Giliran: Klik ' + moveColor;
        if (game.in_check()) status += ' (⚠️ SKAK!)';
    }

    statusEl.innerText = status;
}

// --- EFEK VISUAL API ---
function tampilkanApi(x, y) {
    const api       = document.createElement("div");
    api.className   = "efek-api";
    api.innerHTML   = "🔥";
    api.style.left  = x + "px";
    api.style.top   = y + "px";
    document.body.appendChild(api);
    setTimeout(() => { api.remove(); }, 600);
}

document.body.classList.add("flash-checkmate");
