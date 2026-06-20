// ============================================================
// ui-control.js
// Kontrol tampilan UI: mulai game, reset, menyerah, ejekan,
// edit profil, marquee, dan rematch
// ============================================================

// --- MULAI PERMAINAN ---
function mulaiPermainanNyata() {
    putarSuara(sfxCheckmate);
    document.getElementById("game-action-panel").style.display = "flex";
    document.getElementById("arena-pertandingan").style.display = "block";
    document.getElementById("panel-start").style.display = "none";
    document.getElementById("btn-reset-board").style.display = "block";

    setTimeout(() => {
        if (board) {
            board.resize();
            board.position(game.fen());
        }
    }, 100);

    const btnMenyerah = document.getElementById("btn-menyerah");
    if (btnMenyerah) btnMenyerah.style.display = "block";

    document.getElementById('start-overlay').style.display = 'none';
    aktifkanOnlyGameMode();
    gameDimulai = true;

    // Musik latar
    const audio = document.getElementById('gameBacksound');
    if (audio) {
        audio.volume = 0.2;
        audio.play().catch(error => {
            console.log("Autoplay diblokir browser:", error);
        });
    }

    const modeAktif   = document.getElementById("gameMode").value;
    const jamPutih    = document.getElementById("timer-white");
    const jamHitam    = document.getElementById("timer-black");
    const wadahAtas   = document.getElementById("timer-wrapper-top");
    const wadahBawah  = document.getElementById("timer-wrapper-bottom");

    if (modeAktif === "friend") {
        document.getElementById("timeLimit").disabled = true;

        if (!usernameSaya || !roomId) {
            alert("Data sesi online tidak ditemukan! Silakan masuk via halaman utama.");
            window.location.href = "index.html";
            return;
        }

        if (peranSaya === "b" && board !== null) {
            board.orientation("black");
            if (wadahAtas && wadahBawah) {
                wadahAtas.appendChild(jamPutih);
                wadahBawah.appendChild(jamHitam);
            }
            document.querySelector("#timer-black .timer-label").innerText = "⚫ HITAM (KAMU)";
            document.querySelector("#timer-white .timer-label").innerText = "⚪ PUTIH";
        } else {
            if (board) board.orientation("white");
            if (wadahAtas && wadahBawah) {
                wadahAtas.appendChild(jamHitam);
                wadahBawah.appendChild(jamPutih);
            }
            document.querySelector("#timer-white .timer-label").innerText = "⚪ PUTIH (KAMU)";
            document.querySelector("#timer-black .timer-label").innerText = "⚫ HITAM";
        }

        statusEl.innerText = `🎮 Mode Online Aktif! Anda memegang pion: ${peranSaya === "w" ? "PUTIH" : "HITAM"}`;

    } else if (modeAktif === "puzzle") {
        // Pastikan FEN puzzle yang sudah dipilih di resetGame() tetap terpasang
        // (bukan board default posisi penuh)
        if (board) {
            board.orientation("white");
            board.position(game.fen()); // game.fen() sudah berisi FEN puzzle dari resetGame()
        }

        // Sembunyikan timer (puzzle tidak pakai timer)
        const wrapAtas  = document.getElementById("timer-wrapper-top");
        const wrapBawah = document.getElementById("timer-wrapper-bottom");
        if (wrapAtas)  wrapAtas.style.display  = "none";
        if (wrapBawah) wrapBawah.style.display = "none";

        // Tampilkan label puzzle
        const labelBox = document.getElementById("puzzle-label-box");
        if (labelBox) labelBox.style.display = "block";

        tukarArahJam(); // mulai timer sebagai fallback (tidak aktif di puzzle)

    } else {
        // VS AI
        const warnaPilihan = document.getElementById("playerColor").value;

        // Tampilkan kartu karakter AI
        const levelAI = document.getElementById("aiLevel").value;
        tampilKartuKarakter(levelAI);

        if (warnaPilihan === "black") {
            if (board) board.orientation("black");
            if (wadahAtas && wadahBawah) {
                wadahAtas.appendChild(jamPutih);
                wadahBawah.appendChild(jamHitam);
            }
            document.querySelector("#timer-black .timer-label").innerText = "⚫ HITAM (KAMU)";
            document.querySelector("#timer-white .timer-label").innerText = "⚪ AI (KOMPUTER)";
            statusEl.innerText = "🤖 AI (Putih) sedang berpikir...";
            tukarArahJam();
            setTimeout(pemicuLangkahAI, 600);
            return;
        } else {
            if (board) board.orientation("white");
            if (wadahAtas && wadahBawah) {
                wadahAtas.appendChild(jamHitam);
                wadahBawah.appendChild(jamPutih);
            }
            document.querySelector("#timer-white .timer-label").innerText = "⚪ PUTIH (KAMU)";
            document.querySelector("#timer-black .timer-label").innerText = "⚫ AI (KOMPUTER)";
            statusEl.innerText = "Giliran: Klik Bidak Putih (Kamu) untuk memulai!";
        }
    }

    tukarArahJam();
}

// --- RESET GAME ---
function resetGame() {
    // Sembunyikan kartu karakter AI (hanya relevan di mode AI)
    sembunyikanKartuKarakter();

    document.getElementById("arena-pertandingan").style.display = "none";
    document.getElementById("timeLimit").disabled = false;

    const btnMenyerah = document.getElementById("btn-menyerah");
    if (btnMenyerah) {
        btnMenyerah.style.display = "none";
        putarSuara(sfxClick);
    }

    clearInterval(intervalJam);
    hapusHighlight();
    kotakAsal   = null;
    gameDimulai = false;

    document.getElementById("gameover-overlay").style.display = "none";
    document.getElementById("start-overlay").style.display    = "flex";

    const jamPutih  = document.getElementById("timer-white");
    const jamHitam  = document.getElementById("timer-black");
    const wadahAtas = document.getElementById("timer-wrapper-top");
    const wadahBawah = document.getElementById("timer-wrapper-bottom");

    if (wadahAtas && wadahBawah && jamPutih && jamHitam) {
        wadahAtas.appendChild(jamHitam);
        wadahBawah.appendChild(jamPutih);
    }

    if (jamPutih && jamHitam) {
        document.querySelector("#timer-white .timer-label").innerText = "⚪ PUTIH (KAMU)";
        document.querySelector("#timer-black .timer-label").innerText = "⚫ HITAM";
    }

    const mode = document.getElementById("gameMode").value;

    if (mode === "puzzle") {
        modePuzzleAktif       = true;
        jatahLangkahPuzzle    = 5;
        langkahPuzzleTerpakai = 0;

        const sisaEl = document.getElementById("sisa-langkah");
        if (sisaEl) sisaEl.innerText = jatahLangkahPuzzle;
        document.getElementById("puzzle-counter-box").style.display = "block";
        document.getElementById("difficultyRow").style.display      = "flex"; // tetap tampil agar bisa ganti level
        document.getElementById("playerColorRow").style.display     = "none";
        document.getElementById("marquee-duel").style.display       = "none";

        // Pilih FEN dari bank sesuai level AI yang dipilih
        const levelAI   = document.getElementById("aiLevel")?.value || "3";
        const bankLevel = bankPosisiPuzzle[levelAI] || bankPosisiPuzzle["3"];
        const pilihan   = bankLevel[Math.floor(Math.random() * bankLevel.length)];

        game.load(pilihan.fen);
        if (board) { board.position(pilihan.fen); board.orientation("white"); }

        // Tampilkan label di kotak label
        const labelBox  = document.getElementById("puzzle-label-box");
        const labelTeks = document.getElementById("puzzle-label-teks");
        if (labelBox)  labelBox.style.display  = "block";
        if (labelTeks) labelTeks.innerText      = "🧩 " + pilihan.label;

        if (statusEl) statusEl.innerText = "Klik START GAME untuk memulai puzzle!";

    } else {
        modePuzzleAktif = false;
        document.getElementById("puzzle-counter-box").style.display = "none";

        // Sembunyikan label puzzle, kembalikan timer
        const labelBox  = document.getElementById("puzzle-label-box");
        if (labelBox) labelBox.style.display = "none";
        const wrapAtas  = document.getElementById("timer-wrapper-top");
        const wrapBawah = document.getElementById("timer-wrapper-bottom");
        if (wrapAtas)  wrapAtas.style.display  = "block";
        if (wrapBawah) wrapBawah.style.display = "block";

        game.reset();
        if (board) { board.start(); board.orientation("white"); }

        if (mode === "ai") {
            document.getElementById("difficultyRow").style.display  = "flex";
            document.getElementById("playerColorRow").style.display = "flex";
            document.getElementById("marquee-duel").style.display   = "none";
        } else {
            document.getElementById("difficultyRow").style.display  = "none";
            document.getElementById("playerColorRow").style.display = "none";
            document.getElementById("marquee-duel").style.display   = "block";
        }
    }

    const durasiPilihan = parseInt(document.getElementById("timeLimit").value) || 300;
    waktuPutih = durasiPilihan;
    waktuHitam = durasiPilihan;
    formatTampilanJam("clock-white", waktuPutih);
    formatTampilanJam("clock-black", waktuHitam);
    document.getElementById("timer-white").classList.remove("active-timer");
    document.getElementById("timer-black").classList.remove("active-timer");

    // Puzzle sudah load FEN-nya sendiri di blok atas — jangan di-reset lagi
    if (mode !== "puzzle") {
        statusEl.innerText = "Menu Terkunci. Klik START GAME untuk mulai.";
    }
    document.getElementById("btn-reset-board").style.display = "none";
    hapusHighlight();
    kotakAsal = null;
}

// --- RESTART HANYA PAPAN (TANPA KEMBALI KE LOBBY) ---
function restartBoardOnly() {
    putarSuara(sfxClick);
    clearInterval(intervalJam);
    hapusHighlight();
    kotakAsal   = null;
    gameDimulai = true;

    const mode = document.getElementById("gameMode").value;

    if (mode === "puzzle") {
        // ── Mode Puzzle: load ulang FEN yang sama, reset counter ──
        langkahPuzzleTerpakai = 0;
        jatahLangkahPuzzle    = 5;

        const sisaEl = document.getElementById("sisa-langkah");
        if (sisaEl) sisaEl.innerText = 5;

        // Ambil FEN baru dari bank (acak lagi sesuai level)
        const levelAI   = document.getElementById("aiLevel")?.value || "3";
        const bankLevel = bankPosisiPuzzle[levelAI] || bankPosisiPuzzle["3"];
        const pilihan   = bankLevel[Math.floor(Math.random() * bankLevel.length)];

        game.load(pilihan.fen);
        if (board) { board.position(pilihan.fen); board.orientation("white"); }

        // Update label
        const labelTeks = document.getElementById("puzzle-label-teks");
        if (labelTeks) labelTeks.innerText = "🧩 " + pilihan.label;

        if (statusEl) statusEl.innerText = "🧩 " + pilihan.label + " — Habisi dalam 5 langkah!";

        // Sembunyikan overlay jika masih tampil
        const overlayEl = document.getElementById("gameover-overlay");
        if (overlayEl) { overlayEl.style.display = "none"; overlayEl.style.flexDirection = ""; }
        const areaTombol = document.getElementById("area-tombol-gameover");
        if (areaTombol) areaTombol.innerHTML = "";

        // Puzzle tidak pakai timer → tidak perlu formatTampilanJam
        return;

    } else {
        // ── Mode AI / Friend: reset penuh ke posisi awal ──
        game.reset();
        if (board) { board.start(); board.orientation("white"); }

        // Sembunyikan overlay gameover
        const overlayEl = document.getElementById("gameover-overlay");
        if (overlayEl) { overlayEl.style.display = "none"; overlayEl.style.flexDirection = ""; }
        const areaTombol = document.getElementById("area-tombol-gameover");
        if (areaTombol) areaTombol.innerHTML = "";
    }

    const durasiPilihan = parseInt(document.getElementById("timeLimit").value) || 300;
    waktuPutih = durasiPilihan;
    waktuHitam = durasiPilihan;
    formatTampilanJam("clock-white", waktuPutih);
    formatTampilanJam("clock-black", waktuHitam);

    document.getElementById("timer-white").classList.remove("active-timer");
    document.getElementById("timer-black").classList.remove("active-timer");

    statusEl.innerText = "Papan berhasil diulang. Klik bidak untuk mulai bermain.";
}

// --- REMATCH ---
function rematchGame() {
    putarSuara(sfxCheckmate);
    document.getElementById("gameover-overlay").style.display = "none";
    restartBoardOnly();
}

// --- MENYERAH ---
function pemicuMenyerah() {
    putarSuara(sfxClick);
    if (!confirm("Yakin ingin menyerah?")) return;

    const mode = document.getElementById("gameMode").value;

    // ── Mode AI ──
    if (mode === "ai") {
        clearInterval(intervalJam);
        gameDimulai = false;
        document.getElementById('taunt-text').innerHTML =
            "🤖 Kamu menyerah.<br><span style='color:#ef4444'>AI dinyatakan menang!</span>";
        document.getElementById('gameover-overlay').style.display = 'flex';
        document.getElementById('area-tombol-gameover').innerHTML = `
            <button class="btn-rematch" onclick="resetGame()">Main Lagi</button>
        `;
        return;
    }

    // ── Mode Puzzle ──
    if (mode === "puzzle") { resetGame(); return; }

    // ── Mode Online (friend) ──
    if (!roomId) { alert("Pertandingan tidak ditemukan."); return; }

    // Ambil nama lawan dari Firebase — lebih andal dari parse roomId
    db.collection("room_catur").doc(roomId).get().then(doc => {
        if (!doc.exists) { alert("Room tidak ditemukan."); return; }

        const data      = doc.data();
        const namaLawan = peranSaya === 'w'
            ? (data.pemainHitam || 'Lawan')
            : (data.pemainPutih || 'Lawan');

        // Tulis status selesai → listener di sisi lawan akan terpicu otomatis
        return db.collection("room_catur").doc(roomId).update({
            statusGame: "selesai",
            pemenang:   namaLawan,
            keterangan: `${usernameSaya} Menyerah`
        }).then(() => {
            // Tampilkan gameover di sisi yang menyerah
            clearInterval(intervalJam);
            gameDimulai = false;

            document.getElementById('taunt-text').innerHTML =
                `🏳️ Kamu menyerah.<br>
                 <span style='color:#ef4444;'>Pemenangnya adalah ${namaLawan}!</span>`;
            document.getElementById('gameover-overlay').style.display = 'flex';
            document.getElementById('area-tombol-gameover').innerHTML = `
                <button class="btn-rematch" style="background:#374151;"
                        onclick="kembaliKeHome()">🏠 Kembali ke Lobby</button>
            `;
        });
    }).catch(err => { console.error("Gagal menyerah:", err); });
}

// --- KEMBALI KE HALAMAN UTAMA ---
function kembaliKeHome() {
    putarSuara(sfxClick);
    if (usernameSaya) {
        db.collection("para_pemain").doc(usernameSaya).delete()
            .then(() => { window.location.href = "index.html"; })
            .catch(() => { window.location.href = "index.html"; });
    } else {
        window.location.href = "index.html";
    }
}

// --- SEMBUNYIKAN UI SAAT GAME AKTIF ---
function aktifkanOnlyGameMode() {
    document.querySelectorAll('.hide-in-game').forEach(el => { el.style.display = 'none'; });
    if (peranSaya === "viewer") {
        const homeBtn = document.querySelector(".btn-home-gaming");
        if (homeBtn) {
            homeBtn.style.display = "block";
            if (peranSaya !== "viewer") {
                document.getElementById("game-action-panel").style.display = "block";
            }
        }
    }
}

// --- EJEKAN ---
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
    putarSuara(sfxClick);
    const balon = document.getElementById("balon-ejek");
    const acak  = Math.floor(Math.random() * daftarEjekan.length);
    balon.innerText     = daftarEjekan[acak];
    balon.style.display = "block";
    clearTimeout(timerEjek);
    timerEjek = setTimeout(() => { balon.style.display = "none"; }, 2000);
}

// --- EDIT PROFIL ---
function bukaModalEditProfil() {
    putarSuara(sfxClick);
    const namaSekarang = sessionStorage.getItem("catur_username") || usernameSaya;
    let namaBaru = prompt("Masukkan nama profil baru kamu (Maksimal 15 karakter):", namaSekarang);

    if (namaBaru === null) return;
    namaBaru = namaBaru.trim();

    if (namaBaru === "") { alert("Nama tidak boleh kosong!"); return; }
    if (namaBaru === namaSekarang) { alert("Nama baru sama dengan nama lama."); return; }
    if (namaBaru.length > 15) { alert("Nama terlalu panjang! Maksimal 15 karakter."); return; }

    if (confirm(`Apakah kamu yakin ingin mengubah nama dari "${namaSekarang}" menjadi "${namaBaru}"?`)) {
        db.collection("para_pemain").doc(namaSekarang).delete()
        .then(() => {
            return db.collection("para_pemain").doc(namaBaru).set({
                nama: namaBaru,
                status: "di_lobby",
                lawan: "",
                roomId: "",
                waktuLogin: firebase.firestore.FieldValue.serverTimestamp()
            });
        }).then(() => {
            localStorage.setItem("akun_device_ini", namaBaru);
            sessionStorage.setItem("catur_username", namaBaru);
            usernameSaya = namaBaru;

            const infoProfil = document.getElementById('info-pemain-aktif');
            if (infoProfil) infoProfil.innerHTML = `👤 Akun: <b>${usernameSaya}</b> <span style="color:#39ff14; font-size:11px;">● ONLINE</span>`;

            const userAktifTeks = document.getElementById('user-aktif-teks');
            if (userAktifTeks) userAktifTeks.innerText = "Status: Bermain sebagai " + usernameSaya;

            alert("🎉 Profil berhasil diperbarui! Nama kamu sekarang adalah: " + namaBaru);
            resetGame();
            daftarkanDiriKeLobby();
        }).catch((error) => {
            console.error("Gagal update profil: ", error);
            alert("Gagal mengubah nama karena kendala jaringan database.");
        });
    }
}

// --- MARQUEE OTOMATIS ---
(function () {
    function aturTampilanMarqueeOtomatis() {
        const gameModeSelect = document.getElementById('gameMode');
        const marqueeDuel    = document.getElementById('marquee-duel');
        if (!marqueeDuel) return;

        if (
            (gameModeSelect && gameModeSelect.value === 'friend') ||
            (typeof modeDariUrl !== 'undefined' && modeDariUrl === 'friend')
        ) {
            const startOverlay = document.getElementById('start-overlay');
            if (startOverlay && startOverlay.style.display === 'none') {
                marqueeDuel.style.display = 'block';
                return;
            }
        }
        marqueeDuel.style.display = 'none';
    }

    document.addEventListener('click', function (e) {
        if (e.target && (
            e.target.classList.contains('btn-start') ||
            e.target.classList.contains('btn-rematch') ||
            e.target.onclick?.toString().includes('mulaiPermainanNyata') ||
            e.target.onclick?.toString().includes('resetGame')
        )) {
            setTimeout(aturTampilanMarqueeOtomatis, 100);
        }
    });

    setInterval(aturTampilanMarqueeOtomatis, 1000);
})();

// ============================================================
// SISTEM SWAP WARNA & REMATCH
// ============================================================

// Helper: bersihkan overlay gameover
function _tutupOverlayGameover() {
    const overlayEl = document.getElementById("gameover-overlay");
    if (overlayEl) { overlayEl.style.display = "none"; overlayEl.style.flexDirection = ""; }
    const areaTombol = document.getElementById("area-tombol-gameover");
    if (areaTombol) areaTombol.innerHTML = "";
}

// Helper: reset board & timer tanpa ubah warna/peran
function _resetBoardDanTimer() {
    clearInterval(intervalJam);
    hapusHighlight();
    kotakAsal   = null;
    gameDimulai = true;

    game.reset();

    const durasi = parseInt(document.getElementById("timeLimit").value) || 300;
    waktuPutih = durasi;
    waktuHitam = durasi;
    formatTampilanJam("clock-white", waktuPutih);
    formatTampilanJam("clock-black", waktuHitam);
    document.getElementById("timer-white").classList.remove("active-timer");
    document.getElementById("timer-black").classList.remove("active-timer");
}

// ── MAIN LAGI WARNA SAMA (AI & Online) ──
function mainLagiSamaWarna() {
    putarSuara(sfxClick);
    _tutupOverlayGameover();
    _resetBoardDanTimer();

    const mode = document.getElementById("gameMode").value;

    if (mode === 'ai') {
        const warnaPilihan = document.getElementById("playerColor").value;
        if (board) board.position('start');

        if (warnaPilihan === 'black') {
            if (board) board.orientation('black');
            statusEl.innerText = "🤖 AI (Putih) sedang berpikir...";
            tukarArahJam();
            setTimeout(pemicuLangkahAI, 600);
        } else {
            if (board) board.orientation('white');
            statusEl.innerText = "Giliran: Klik Bidak Putih (Kamu)";
            tukarArahJam();
        }

    } else if (mode === 'friend') {
        if (!roomId) return;
        // Reset room di Firebase, peran tetap sama
        const durasi = parseInt(document.getElementById("timeLimit").value) || 300;
        db.collection("room_catur").doc(roomId).update({
            fen:        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            turn:       "w",
            statusGame: "berjalan",
            waktuPutih: durasi,
            waktuHitam: durasi,
            requestTukarWarna: null
        }).then(() => {
            if (board) { board.position('start'); board.orientation(peranSaya === 'b' ? 'black' : 'white'); }
            statusEl.innerText = peranSaya === 'w' ? "Giliran: Klik Bidak Putih (Kamu)" : "⏳ Giliran Putih...";
            tukarArahJam();
        });
    }
}

// ── TUKAR WARNA VS AI (langsung tanpa konfirmasi) ──
function tukarWarnaAI() {
    putarSuara(sfxClick);
    _tutupOverlayGameover();
    _resetBoardDanTimer();

    // Balik pilihan warna
    const selectWarna = document.getElementById("playerColor");
    const warnaLama   = selectWarna.value;
    const warnaBaru   = warnaLama === 'white' ? 'black' : 'white';
    selectWarna.value = warnaBaru;

    if (board) { board.position('start'); board.orientation(warnaBaru === 'black' ? 'black' : 'white'); }

    if (warnaBaru === 'black') {
        // Kita jadi hitam → AI (putih) jalan duluan
        statusEl.innerText = "🤖 AI (Putih) sedang berpikir...";
        tukarArahJam();
        setTimeout(pemicuLangkahAI, 600);
    } else {
        statusEl.innerText = "Giliran: Klik Bidak Putih (Kamu)";
        tukarArahJam();
    }
}

// ── MINTA TUKAR WARNA KE LAWAN (Online) ──
function mintaTukarWarna() {
    putarSuara(sfxClick);
    if (!roomId) return;

    // Kirim request ke Firebase
    db.collection("room_catur").doc(roomId).update({
        requestTukarWarna: usernameSaya
    }).then(() => {
        // Update tombol jadi menunggu
        const areaTombol = document.getElementById("area-tombol-gameover");
        if (areaTombol) areaTombol.innerHTML = `
            <p style="color:#aaa; font-size:13px; margin-bottom:10px;">
                ⏳ Menunggu persetujuan lawan...
            </p>
            <button class="btn-rematch btn-lobby" onclick="batalRequestTukarWarna()">
                ✕ Batalkan
            </button>
        `;
    });
}

// ── BATALKAN REQUEST ──
function batalRequestTukarWarna() {
    putarSuara(sfxClick);
    if (!roomId) return;
    db.collection("room_catur").doc(roomId).update({ requestTukarWarna: null })
    .then(() => {
        const areaTombol = document.getElementById("area-tombol-gameover");
        if (areaTombol) areaTombol.innerHTML = _tombolGameOver('friend');
    });
}

// ── RESPON PERMINTAAN TUKAR WARNA DARI LAWAN ──
function responTukarWarna(setuju) {
    putarSuara(sfxClick);
    if (!roomId) return;

    if (!setuju) {
        // Tolak → hapus request, kembalikan tombol normal
        db.collection("room_catur").doc(roomId).update({ requestTukarWarna: null });
        const areaTombol = document.getElementById("area-tombol-gameover");
        if (areaTombol) areaTombol.innerHTML = _tombolGameOver('friend');
        return;
    }

    // Setuju → tukar peran di Firebase + reset board
    const durasi      = parseInt(document.getElementById("timeLimit").value) || 300;
    const peranBaru   = peranSaya === 'w' ? 'b' : 'w';
    const putihBaru   = peranSaya === 'w' ? usernameSaya : _getNamaLawan();
    const hitamBaru   = peranSaya === 'b' ? usernameSaya : _getNamaLawan();

    db.collection("room_catur").doc(roomId).update({
        fen:               "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        turn:              "w",
        statusGame:        "berjalan",
        waktuPutih:        durasi,
        waktuHitam:        durasi,
        pemainPutih:       putihBaru,
        pemainHitam:       hitamBaru,
        requestTukarWarna: null
    }).then(() => {
        // Update peran lokal
        peranSaya = peranBaru;
        sessionStorage.setItem("catur_peran", peranSaya);

        _tutupOverlayGameover();
        _resetBoardDanTimer();

        if (board) { board.position('start'); board.orientation(peranSaya === 'b' ? 'black' : 'white'); }
        statusEl.innerText = peranSaya === 'w' ? "Giliran: Klik Bidak Putih (Kamu)" : "⏳ Menunggu giliran...";
        tukarArahJam();
    });
}

// Helper ambil nama lawan dari room
function _getNamaLawan() {
    // Diisi dari data Firebase saat listener terpicu
    return window._namaLawanAktif || "Lawan";
}
(function () {
    let intervalPantauSelesai = null;

    function dapatkanNamaLawanAktif() {
        if (!usernameSaya || !roomId) return "";
        const bagian = roomId.split('_vs_');
        if (bagian.length > 1) {
            const penantang = bagian[0].replace('room_', '');
            const ditantang = bagian[1].split('_')[0];
            return usernameSaya === penantang ? ditantang : penantang;
        }
        return "";
    }

    function aturTombolRematchOtomatis() {
        putarSuara(sfxClick);
        const overlaySelesai = document.getElementById('gameover-overlay');
        const modeGame       = document.getElementById('gameMode')?.value;
        const areaTombol     = document.getElementById('area-tombol-gameover');

        if (overlaySelesai && overlaySelesai.style.display === 'flex' && modeGame === 'friend' && areaTombol) {
            clearInterval(intervalPantauSelesai);
            const lawan        = dapatkanNamaLawanAktif();
            const turnSekarang = game.turn();
            const sayaKalah    = (turnSekarang === peranSaya) && game.in_checkmate();

            if (sayaKalah) {
                areaTombol.innerHTML = `
                    <button class="btn-rematch" style="background:#ef4444; color:#fff; animation: pulse 1.5s infinite;" onclick="window.kirimTantanganUlang('${lawan}')">
                        Yahh kalah... TANTANG lagi lah!! ⚔️
                    </button>
                `;
            } else if (game.in_checkmate()) {
                areaTombol.innerHTML = `
                    <p style="color:#39ff14; font-weight:bold; font-size:14px; margin-bottom:10px;">🎉 Kamu Menang! Menunggu lawan menantang kembali...</p>
                    <button class="btn-rematch" style="background:#555; color:#eee;" onclick="resetGame()">Kembali ke Lobby</button>
                `;
            }
        }
    }

    window.kirimTantanganUlang = function (namaLawan) {
        if (!namaLawan) return alert("Gagal mendeteksi nama lawan untuk rematch.");

        const uidUnik = Math.floor(100 + Math.random() * 900);
        roomId        = "room_" + usernameSaya + "_vs_" + namaLawan + "_" + uidUnik;
        peranSaya     = "w";
        sessionStorage.setItem("catur_room_id", roomId);
        sessionStorage.setItem("catur_peran", peranSaya);

        const areaTombol = document.getElementById('area-tombol-gameover');
        if (areaTombol) areaTombol.innerHTML = `<p style="color:#aaa; font-style:italic;">Mengirim permintaan rematch...</p>`;

        db.collection("room_catur").doc(roomId).set({
            fen:         "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            turn:        "w",
            waktuPutih:  300,
            waktuHitam:  300,
            waktuUpdate: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => {
            db.collection("para_pemain").doc(namaLawan).update({ status: "ditantang", lawan: usernameSaya, roomId });
            db.collection("para_pemain").doc(usernameSaya).update({ status: "bermain", lawan: namaLawan, roomId });

            alert("Tantangan ulang berhasil dikirim! Menunggu keputusan si pemenang...");
            document.getElementById('gameover-overlay').style.display = 'none';
            aktifkanListenerOnline();
            mulaiPermainanNyata();
        });
    };

    setInterval(function () {
        const overlaySelesai = document.getElementById('gameover-overlay');
        if (overlaySelesai && overlaySelesai.style.display === 'flex') {
            aturTombolRematchOtomatis();
        } else {
            if (!intervalPantauSelesai) intervalPantauSelesai = true;
        }
    }, 1000);
})();
