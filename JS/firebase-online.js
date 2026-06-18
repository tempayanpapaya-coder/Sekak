// ============================================================
// firebase-online.js
// Semua fungsi Firebase untuk multiplayer online:
// lobby, tantangan, listener game, kirim langkah
// ============================================================

// --- KIRIM LANGKAH KE FIREBASE ---
function kirimLangkahKeFirebase() {
    if (!roomId) return;
    db.collection("room_catur").doc(roomId).set({
        fen:         game.fen(),
        turn:        game.turn(),
        waktuPutih:  waktuPutih,
        waktuHitam:  waktuHitam,
        waktuUpdate: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(error => { console.error("Gagal mengirim langkah: ", error); });
}

// --- LISTENER GAME ONLINE ---
function aktifkanListenerOnline() {
    if (!roomId) return;
    db.collection("room_catur").doc(roomId).onSnapshot(doc => {
        if (doc.exists) {
            const data = doc.data();

            if (data.statusGame === "selesai") {
                clearInterval(intervalJam);
                document.getElementById('taunt-text').innerHTML = "⏰ Pertandingan selesai karena waktu habis.";
                document.getElementById('gameover-overlay').style.display = 'flex';
                return;
            }

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

// --- DAFTARKAN DIRI KE LOBBY ---
function daftarkanDiriKeLobby() {
    putarSuara(sfxClick);

    if (!usernameSaya) {
        usernameSaya = sessionStorage.getItem("catur_username") || localStorage.getItem("akun_device_ini");
    }

    if (!usernameSaya) {
        usernameSaya = "Pemain_" + Math.floor(1000 + Math.random() * 9000);
        sessionStorage.setItem("catur_username", usernameSaya);
        localStorage.setItem("akun_device_ini", usernameSaya);
    }

    const gameModeSelect = document.getElementById('gameMode');
    const modeAktif      = gameModeSelect ? gameModeSelect.value : modeDariUrl;

    const infoProfil = document.getElementById('info-pemain-aktif');
    if (infoProfil) {
        infoProfil.innerHTML = `👤 Akun: <b>${usernameSaya}</b> <span style="color:#39ff14; font-size:11px;">● ONLINE</span>`;
    }

    if (modeAktif === 'friend') {
        // Reconnect: jika sudah dalam sesi aktif
        if (roomId) {
            console.log("Sesi bertanding aktif terdeteksi, mengaktifkan radar permainan...");
            aktifkanListenerOnline();
            return;
        }

        db.collection("para_pemain").doc(usernameSaya).set({
            nama:        usernameSaya,
            status:      "di_lobby",
            lawan:       "",
            roomId:      "",
            waktuLogin:  firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => {
            console.log("Pendaftaran database berhasil: " + usernameSaya);
        }).catch((err) => {
            console.error("Gagal mendaftar ke database: ", err);
        });

        pantauPemainLainLobby();
        dengarkanTantanganMasuk();
    }
}

// --- PANTAU PEMAIN LAIN DI LOBBY ---
function pantauPemainLainLobby() {
    console.log("⚡ Radar Pemantau Pemain Aktif dinyalakan...");
    const namaSayaBersih = (usernameSaya || sessionStorage.getItem("catur_username") || "").trim();

    db.collection("para_pemain").onSnapshot((snapshot) => {
        const areaDaftar = document.getElementById('daftar-pemain-online');
        if (!areaDaftar) {
            console.error("Error: Elemen 'daftar-pemain-online' tidak ditemukan!");
            return;
        }

        areaDaftar.innerHTML = "";
        let adaPemainLain = false;

        snapshot.forEach((doc) => {
            const dataPemain    = doc.data();
            const namaUserLawan = (doc.id || dataPemain.nama || "").trim();

            if (!namaUserLawan || namaUserLawan === namaSayaBersih) return;
            adaPemainLain = true;

            const itemPemain = document.createElement('div');
            itemPemain.style.cssText = "display:flex; justify-content:space-between; align-items:center; background:#1f222f; padding:10px 15px; margin-bottom:10px; border-radius:6px; border:1px solid #2d3246;";

            let infoStatusTeks  = "";
            let tombolAksiTantang = "";

            if (dataPemain.status === "bermain" || dataPemain.status === "bertanding") {
                infoStatusTeks = `<span style="color:#ef4444; font-size:11px; font-weight:bold;">🔴 SEDANG BERTANDING</span>`;
                tombolAksiTantang = `<button disabled style="background:#3d404e; color:#777; border:none; padding:6px 12px; border-radius:4px; font-size:12px; cursor:not-allowed; font-weight:bold;">🚫 SIBUK</button>`;
            } else if (dataPemain.status === "ditantang") {
                infoStatusTeks = `<span style="color:#ff9f43; font-size:11px; font-weight:bold;">⏳ MENUNGGU NOTIF</span>`;
                tombolAksiTantang = `<button disabled style="background:#3d404e; color:#ff9f43; border:none; padding:6px 12px; border-radius:4px; font-size:12px; cursor:not-allowed; font-weight:bold;">PENDING</button>`;
            } else {
                infoStatusTeks = `<span style="color:#39ff14; font-size:11px; font-weight:bold;">● READY (DI LOBBY)</span>`;
                tombolAksiTantang = `<button onclick="kirimTantangan('${namaUserLawan}')" style="background:#00b894; color:white; border:none; padding:6px 12px; border-radius:4px; font-weight:bold; cursor:pointer; font-size:12px; box-shadow: 0 2px 6px rgba(0,184,148,0.3);">⚔️ TANTANG</button>`;
            }

            itemPemain.innerHTML = `
                <div style="text-align: left;">
                    <span style="font-weight:bold; color:#fff; font-size:14px; display:block; margin-bottom:2px;">🎮 ${namaUserLawan}</span>
                    ${infoStatusTeks}
                </div>
                <div>${tombolAksiTantang}</div>
            `;
            areaDaftar.appendChild(itemPemain);
        });

        if (!adaPemainLain) {
            areaDaftar.innerHTML = `<div style="text-align:center; padding:15px; color:#aaa; font-size:13px; font-style:italic;">📭 Lobby sepi... Belum ada pemain lain yang online saat ini.</div>`;
        }
    }, (error) => {
        console.error("Radar Firebase gagal: ", error);
    });
}

// --- DENGARKAN TANTANGAN MASUK ---
function dengarkanTantanganMasuk() {
    db.collection("para_pemain").doc(usernameSaya).onSnapshot(doc => {
        if (doc.exists) {
            const dataSaya  = doc.data();
            const areaNotif = document.getElementById("notifikasi-tantangan");

            if (dataSaya.status === "ditantang" && dataSaya.lawan && dataSaya.roomId) {
                if (areaNotif) {
                    areaNotif.innerHTML = `
                    <div style="background:#2d1515; border:2px solid #ef4444; padding:15px; border-radius:8px; text-align:center; margin-bottom:15px;">
                        <h4 style="margin:0 0 5px 0; color:#ef4444;">⚔️ TANTANGAN MASUK!</h4>
                        <p style="margin:0 0 12px 0; font-size:14px;">Kamu ditantang duel oleh <b>${dataSaya.lawan}</b>!</p>
                        <button onclick="terimaTantangan('${dataSaya.lawan}', '${dataSaya.roomId}')" style="background:#39ff14; color:#000; border:none; padding:8px 16px; font-weight:bold; border-radius:4px; cursor:pointer; margin-right:10px;">TERIMA (GAS)</button>
                        <button onclick="tolakTantangan('${dataSaya.lawan}')" style="background:#ef4444; color:#fff; border:none; padding:8px 16px; font-weight:bold; border-radius:4px; cursor:pointer;">TOLAK</button>
                    </div>`;
                }
            } else if (dataSaya.status === "bermain" && dataSaya.roomId) {
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

// --- KIRIM TANTANGAN ---
function kirimTantangan(namaLawan) {
    putarSuara(sfxClick);

    const gameModeSelect = document.getElementById('gameMode');
    if (gameModeSelect) gameModeSelect.value = 'friend';

    const uidUnik    = Math.floor(100 + Math.random() * 900);
    roomId           = "room_" + usernameSaya + "_vs_" + namaLawan + "_" + uidUnik;
    peranSaya        = "w";
    sessionStorage.setItem("catur_room_id", roomId);
    sessionStorage.setItem("catur_peran", peranSaya);

    const durasiGameDipilih = parseInt(document.getElementById('timeLimit').value) || 300;

    db.collection("room_catur").doc(roomId).set({
        fen:            "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        turn:           "w",
        durasiGame:     durasiGameDipilih,
        waktuPutih:     durasiGameDipilih,
        waktuHitam:     durasiGameDipilih,
        statusGame:     "berjalan",
        waktuUpdate:    firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        db.collection("para_pemain").doc(namaLawan).update({ status: "ditantang", lawan: usernameSaya, roomId });
        db.collection("para_pemain").doc(usernameSaya).update({ status: "bermain", lawan: namaLawan, roomId });

        alert("Tantangan terkirim! Menunggu konfirmasi lawan...");
        aktifkanListenerOnline();
        mulaiPermainanNyata();
    }).catch((err) => { console.error("Gagal membuat room: ", err); });
}

// --- TERIMA TANTANGAN ---
function terimaTantangan(namaLawan, idKamar) {
    const gameModeSelect = document.getElementById('gameMode');
    if (gameModeSelect) gameModeSelect.value = 'friend';

    roomId    = idKamar;
    peranSaya = "b";
    sessionStorage.setItem("catur_room_id", roomId);
    sessionStorage.setItem("catur_peran", peranSaya);

    db.collection("para_pemain").doc(usernameSaya).update({ status: "bermain" })
    .then(() => {
        db.collection("room_catur").doc(roomId).get().then((doc) => {
            const data = doc.data();
            if (data.durasiGame) document.getElementById("timeLimit").value = data.durasiGame;
        });

        alert("Tantangan diterima! Anda memegang bidak HITAM.");

        const areaNotif = document.getElementById('notifikasi-tantangan');
        if (areaNotif) areaNotif.innerHTML = "";

        aktifkanListenerOnline();
        mulaiPermainanNyata();
    });
}

// --- TOLAK TANTANGAN ---
function tolakTantangan(namaLawan) {
    putarSuara(sfxClick);
    db.collection("para_pemain").doc(namaLawan).update({ status: "di_lobby", lawan: "", roomId: "" });
    db.collection("para_pemain").doc(usernameSaya).update({ status: "di_lobby", lawan: "", roomId: "" });
}
