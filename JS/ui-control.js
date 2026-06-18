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
        statusEl.innerText = "🧩 Mode Puzzle: Habisi lawan dalam 5 langkah mati!";

    } else {
        // VS AI
        const warnaPilihan = document.getElementById("playerColor").value;

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
        document.getElementById("sisa-langkah").innerText = jatahLangkahPuzzle;
        document.getElementById("puzzle-counter-box").style.display = "block";
        document.getElementById("difficultyRow").style.display      = "none";
        document.getElementById("playerColorRow").style.display     = "none";
        document.getElementById("marquee-duel").style.display       = "none";

        const indeksAcak     = Math.floor(Math.random() * bankPosisiPuzzle.length);
        const posisiFenAcak  = bankPosisiPuzzle[indeksAcak];
        game.load(posisiFenAcak);
        if (board) board.position(posisiFenAcak);

    } else {
        modePuzzleAktif = false;
        document.getElementById("puzzle-counter-box").style.display = "none";
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

    statusEl.innerText = "Menu Terkunci. Klik START GAME untuk mulai.";
    document.getElementById("btn-reset-board").style.display = "none";

    game.reset();
    if (board) board.start();
    hapusHighlight();
    kotakAsal = null;
}

// --- RESTART HANYA PAPAN (TANPA KEMBALI KE LOBBY) ---
function restartBoardOnly() {
    putarSuara(sfxClick);
    clearInterval(intervalJam);
    hapusHighlight();
    kotakAsal   = null;
    gameDimulai = false;

    game.reset();
    if (board) { board.start(); board.orientation("white"); }

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

    if (mode === "ai") {
        clearInterval(intervalJam);
        document.getElementById('taunt-text').innerHTML =
            "🤖 Kamu menyerah.<br><span style='color:#ef4444'>AI dinyatakan menang!</span>";
        document.getElementById('gameover-overlay').style.display = 'flex';
        document.getElementById('area-tombol-gameover').innerHTML = `
            <button class="btn-rematch" onclick="resetGame()">Main Lagi</button>
        `;
        setTimeout(() => { kembaliKeHome(); }, 2000);
        return;
    }

    if (mode === "puzzle") { resetGame(); return; }

    if (!confirm("Apakah kamu yakin ingin menyerah dan mengakhiri pertandingan ini?")) return;
    if (!roomId) { alert("Pertandingan tidak ditemukan."); return; }

    // Deteksi nama lawan dari roomId
    let namaLawan = "";
    const bagian = roomId.split('_vs_');
    if (bagian.length > 1) {
        const penantang = bagian[0].replace('room_', '');
        const ditantang = bagian[1].split('_')[0];
        namaLawan = (usernameSaya === penantang) ? ditantang : penantang;
    }
    if (!namaLawan) namaLawan = "Lawan";

    db.collection("room_catur").doc(roomId).update({
        statusGame: "selesai",
        pemenang:   namaLawan,
        keterangan: `${usernameSaya} Menyerah`
    }).then(() => {
        clearInterval(intervalJam);
        db.collection("para_pemain").doc(usernameSaya).update({ status: "di_lobby", lawan: "", roomId: "" });
        db.collection("para_pemain").doc(namaLawan).update({ status: "di_lobby", lawan: "", roomId: "" });

        document.getElementById('taunt-text').innerHTML =
            `🏳️ Anda telah menyerah.<br><span style='color:#ef4444;'>Pemenangnya adalah ${namaLawan}!</span>`;
        document.getElementById('gameover-overlay').style.display = 'flex';
        document.getElementById('area-tombol-gameover').innerHTML = `
            <button class="btn-rematch" onclick="resetGame()">🔄 Main Lagi</button>
            <button class="btn-rematch" style="margin-top:10px;background:#374151;" onclick="window.location.href='index.html'">🏠 Kembali ke Lobby</button>
        `;
    }).catch((err) => { console.error("Gagal memproses penyerahan: ", err); });
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

// --- REMATCH ONLINE ---
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
aktifkanListenerRoom();  // <--- DISESUAIKAN JADI KANAN
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
