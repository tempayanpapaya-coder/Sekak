// ============================================================
// firebase-online.js  (VERSI ROOM SYSTEM)
// Sistem room: buat room, share link, penonton, auto-delete
// ============================================================

// ─── UTILITAS ────────────────────────────────────────────────

/** Generate kode room unik */
function generateKodeRoom() {
    const huruf = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let kode = 'SEKAK-';
    for (let i = 0; i < 6; i++) {
        kode += huruf[Math.floor(Math.random() * huruf.length)];
    }
    return kode;
}

/** Baca parameter dari URL */
function getUrlParam(nama) {
    return new URLSearchParams(window.location.search).get(nama);
}

// ─── AUTO-JOIN DARI LINK ──────────────────────────────────────

function cekAutoJoinDariLink() {
    const kodeRoom = getUrlParam('room');
    if (!kodeRoom) return false;

    console.log('Terdeteksi link room:', kodeRoom);

    const sel = document.getElementById('gameMode');
    if (sel) sel.value = 'friend';

    if (!usernameSaya) {
        usernameSaya = sessionStorage.getItem('catur_username')
            || localStorage.getItem('akun_device_ini')
            || ('Pemain_' + Math.floor(1000 + Math.random() * 9000));
        sessionStorage.setItem('catur_username', usernameSaya);
        localStorage.setItem('akun_device_ini', usernameSaya);
    }

    db.collection('room_catur').doc(kodeRoom).get().then(doc => {
        if (!doc.exists) {
            tampilNotifRoom('Room tidak ditemukan atau sudah berakhir.', 'error');
            return;
        }

        const data = doc.data();

        if (!data.pemainPutih) {
            _jadikanHost(kodeRoom);
            return;
        }

        if (!data.pemainHitam && data.pemainPutih !== usernameSaya) {
            _jadikanPemainHitam(kodeRoom, data);
            return;
        }

        if (data.pemainPutih === usernameSaya || data.pemainHitam === usernameSaya) {
            _reconnectKamarRoom(kodeRoom, data);
            return;
        }

        _jadikanPenonton(kodeRoom, data);
    }).catch(err => {
        console.error('Gagal cek room:', err);
        tampilNotifRoom('Gagal terhubung ke room. Periksa koneksi.', 'error');
    });

    return true;
}

// ─── JADIKAN HOST ─────────────────────────────────────────────

function _jadikanHost(kodeRoom) {
    roomId    = kodeRoom;
    peranSaya = 'w';
    sessionStorage.setItem('catur_room_id', roomId);
    sessionStorage.setItem('catur_peran', peranSaya);

    db.collection('room_catur').doc(roomId).update({ pemainPutih: usernameSaya })
    .then(() => {
        tampilNotifRoom('Terhubung kembali sebagai Host (Putih).', 'sukses');
        aktifkanListenerRoom();
        tampilPanelTungguLawan();
    });
}

// ─── JADIKAN PEMAIN HITAM ────────────────────────────────────

function _jadikanPemainHitam(kodeRoom, dataRoom) {
    roomId    = kodeRoom;
    peranSaya = 'b';
    sessionStorage.setItem('catur_room_id', roomId);
    sessionStorage.setItem('catur_peran', peranSaya);

    db.collection('room_catur').doc(roomId).update({
        pemainHitam: usernameSaya,
        statusRoom:  'penuh'
    }).then(() => {
        tampilNotifRoom('Bergabung sebagai Pemain Hitam! Lawan: ' + dataRoom.pemainPutih, 'sukses');
        aktifkanListenerRoom();
        setTimeout(() => mulaiPermainanNyata(), 1200);
    });
}

// ─── JADIKAN PENONTON ────────────────────────────────────────

function _jadikanPenonton(kodeRoom, dataRoom) {
    roomId    = kodeRoom;
    peranSaya = 'viewer';
    sessionStorage.setItem('catur_room_id', roomId);
    sessionStorage.setItem('catur_peran', peranSaya);

    db.collection('room_catur').doc(roomId).update({
        penonton: firebase.firestore.FieldValue.arrayUnion(usernameSaya)
    }).then(() => {
        tampilNotifRoom(
            'Kamu menonton: ' + dataRoom.pemainPutih + ' vs ' + (dataRoom.pemainHitam || '???'),
            'info'
        );
        aktifkanListenerRoom();
        mulaiPermainanNyata();
    });
}

// ─── RECONNECT ───────────────────────────────────────────────

function _reconnectKamarRoom(kodeRoom, dataRoom) {
    roomId    = kodeRoom;
    peranSaya = dataRoom.pemainPutih === usernameSaya ? 'w' : 'b';
    sessionStorage.setItem('catur_room_id', roomId);
    sessionStorage.setItem('catur_peran', peranSaya);

    tampilNotifRoom('Berhasil tersambung kembali ke room!', 'sukses');
    aktifkanListenerRoom();

    if (dataRoom.statusGame === 'berjalan') {
        mulaiPermainanNyata();
    } else {
        tampilPanelTungguLawan();
    }
}

// ─── BUAT ROOM BARU ──────────────────────────────────────────

function buatRoomBaru() {
    putarSuara(sfxClick);

    if (!usernameSaya) {
        usernameSaya = sessionStorage.getItem('catur_username')
            || localStorage.getItem('akun_device_ini')
            || ('Pemain_' + Math.floor(1000 + Math.random() * 9000));
        sessionStorage.setItem('catur_username', usernameSaya);
        localStorage.setItem('akun_device_ini', usernameSaya);
    }

    const kodeRoom   = generateKodeRoom();
    const durasiGame = parseInt(document.getElementById('timeLimit')?.value) || 300;

    roomId    = kodeRoom;
    peranSaya = 'w';
    sessionStorage.setItem('catur_room_id', roomId);
    sessionStorage.setItem('catur_peran', peranSaya);

    db.collection('room_catur').doc(kodeRoom).set({
        kode:        kodeRoom,
        pemainPutih: usernameSaya,
        pemainHitam: '',
        penonton:    [],
        fen:         'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        turn:        'w',
        durasiGame:  durasiGame,
        waktuPutih:  durasiGame,
        waktuHitam:  durasiGame,
        statusRoom:  'menunggu',
        statusGame:  'menunggu',
        waktuBuat:   firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        tampilPanelTungguLawan();
        aktifkanListenerRoom();
    }).catch(err => {
        console.error('Gagal buat room:', err);
        tampilNotifRoom('Gagal membuat room. Coba lagi.', 'error');
    });
}

// ─── PANEL TUNGGU LAWAN ──────────────────────────────────────

function tampilPanelTungguLawan() {
    const linkRoom = window.location.origin + window.location.pathname + '?room=' + roomId;

    const panelLama = document.getElementById('panel-tunggu-lawan');
    if (panelLama) panelLama.remove();

    const panel = document.createElement('div');
    panel.id    = 'panel-tunggu-lawan';
    panel.innerHTML = `
        <div style="
            position:fixed;inset:0;z-index:8000;
            background:rgba(0,0,0,0.88);
            display:flex;flex-direction:column;
            align-items:center;justify-content:center;
            backdrop-filter:blur(8px);font-family:sans-serif;
        ">
            <div style="
                background:#1a1d2e;
                border:1px solid rgba(255,255,255,0.12);
                border-radius:16px;padding:32px 28px;
                max-width:420px;width:90%;text-align:center;
                box-shadow:0 20px 60px rgba(0,0,0,0.6);
            ">
                <div style="font-size:48px;margin-bottom:12px;">♟️</div>
                <h2 style="color:#00f2fe;margin:0 0 6px;font-size:20px;letter-spacing:1px;">ROOM DIBUAT!</h2>
                <p style="color:#aaa;font-size:13px;margin:0 0 20px;">
                    Kamu: <b style="color:#fff">${usernameSaya}</b> &nbsp;|&nbsp; Warna: <b style="color:#fff">⚪ PUTIH</b>
                </p>

                <div style="
                    background:rgba(0,242,254,0.08);
                    border:1px dashed #00f2fe;
                    border-radius:10px;padding:14px;margin-bottom:16px;
                ">
                    <p style="color:#aaa;font-size:11px;margin:0 0 6px;text-transform:uppercase;letter-spacing:1px;">Kode Room</p>
                    <span style="font-size:26px;font-weight:900;color:#00f2fe;letter-spacing:4px;">${roomId}</span>
                </div>

                <div style="margin-bottom:16px;">
                    <p style="color:#aaa;font-size:11px;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px;">Link Undangan</p>
                    <div style="
                        display:flex;gap:8px;align-items:center;
                        background:rgba(255,255,255,0.05);
                        border:1px solid rgba(255,255,255,0.1);
                        border-radius:8px;padding:8px 12px;
                    ">
                        <input id="input-link-room" type="text" readonly
                            value="${linkRoom}"
                            style="background:transparent;border:none;outline:none;color:#fff;font-size:12px;flex:1;min-width:0;"
                        />
                        <button onclick="salinLinkRoom()" style="
                            background:#00f2fe;color:#000;border:none;
                            padding:5px 12px;border-radius:6px;
                            font-weight:bold;font-size:12px;cursor:pointer;white-space:nowrap;flex-shrink:0;
                        ">Salin</button>
                    </div>
                </div>

                <button onclick="shareRoomLink('${linkRoom}')" style="
                    width:100%;background:#6c5ce7;color:white;border:none;
                    padding:11px;border-radius:8px;font-weight:bold;
                    font-size:14px;cursor:pointer;margin-bottom:10px;
                ">Bagikan Link ke Teman</button>

                <div id="status-tunggu-lawan" style="
                    display:flex;align-items:center;justify-content:center;
                    gap:10px;color:#aaa;font-size:13px;margin:12px 0;
                ">
                    <div style="
                        width:12px;height:12px;border-radius:50%;background:#ff9f43;
                        animation:kedipOrange 1s infinite;
                    "></div>
                    Menunggu lawan bergabung...
                </div>

                <style>
                    @keyframes kedipOrange{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(0.8)}}
                </style>

                <button onclick="batalkanRoom()" style="
                    width:100%;background:transparent;color:#ef4444;
                    border:1px solid #ef4444;padding:9px;
                    border-radius:8px;font-size:13px;cursor:pointer;margin-top:4px;
                ">Batalkan Room</button>
            </div>
        </div>
    `;

    document.body.appendChild(panel);
}

// ─── SALIN & SHARE LINK ──────────────────────────────────────

function salinLinkRoom() {
    const input = document.getElementById('input-link-room');
    if (!input) return;
    navigator.clipboard.writeText(input.value).then(() => {
        tampilNotifRoom('Link berhasil disalin!', 'sukses');
    }).catch(() => {
        input.select();
        document.execCommand('copy');
        tampilNotifRoom('Link berhasil disalin!', 'sukses');
    });
}

function shareRoomLink(link) {
    if (navigator.share) {
        navigator.share({
            title: 'Ayo main Sekak Jowo!',
            text:  usernameSaya + ' mengajakmu duel catur! Kode: ' + roomId,
            url:   link
        }).catch(() => {});
    } else {
        salinLinkRoom();
        tampilNotifRoom('Link disalin! Paste ke chat temanmu.', 'info');
    }
}

// ─── BATALKAN ROOM ───────────────────────────────────────────

function batalkanRoom() {
    putarSuara(sfxClick);
    if (!roomId) return;

    db.collection('room_catur').doc(roomId).delete().then(() => {
        roomId    = '';
        peranSaya = 'w';
        sessionStorage.removeItem('catur_room_id');
        sessionStorage.removeItem('catur_peran');

        const panel = document.getElementById('panel-tunggu-lawan');
        if (panel) panel.remove();

        tampilNotifRoom('Room dibatalkan.', 'info');
    });
}

// ─── LISTENER ROOM REALTIME ──────────────────────────────────

let _listenerRoom = null;

function aktifkanListenerRoom() {
    if (!roomId) return;
    if (_listenerRoom) { _listenerRoom(); _listenerRoom = null; }

    _listenerRoom = db.collection('room_catur').doc(roomId).onSnapshot(doc => {
        if (!doc.exists) {
            _listenerRoom = null;
            tampilNotifRoom('Room telah ditutup.', 'info');
            const panel = document.getElementById('panel-tunggu-lawan');
            if (panel) panel.remove();
            return;
        }

        const data = doc.data();

        // Host: lawan masuk → mulai game
        if (peranSaya === 'w' && data.pemainHitam && data.statusRoom === 'penuh') {
            const panel = document.getElementById('panel-tunggu-lawan');
            if (panel) {
                panel.remove();
                tampilNotifRoom(data.pemainHitam + ' bergabung! Game dimulai...', 'sukses');
                setTimeout(() => mulaiPermainanNyata(), 800);
            }
            return;
        }

        // Update jumlah penonton di panel tunggu
        if (data.penonton && data.penonton.length > 0) {
            const elPenonton = document.getElementById('status-tunggu-lawan');
            if (elPenonton && data.statusRoom === 'menunggu') {
                elPenonton.innerHTML = `
                    <div style="width:12px;height:12px;border-radius:50%;background:#ff9f43;animation:kedipOrange 1s infinite;"></div>
                    Menunggu lawan... &nbsp;|&nbsp; ${data.penonton.length} penonton
                `;
            }
        }

        // Sinkronisasi langkah untuk penonton & reconnect
        if (data.fen && data.fen !== game.fen() && gameDimulai) {
            game.load(data.fen);
            if (board) board.position(data.fen);
            if (data.waktuPutih !== undefined) waktuPutih = data.waktuPutih;
            if (data.waktuHitam !== undefined) waktuHitam = data.waktuHitam;
            tukarArahJam();
            updateStatus();
            kotakAsal = null;
            hapusHighlight();
        }

        // Game selesai → hapus room
        if (data.statusGame === 'selesai') {
            if (_listenerRoom) { _listenerRoom(); _listenerRoom = null; }
            _hapusRoomDariFirebase();
        }
    });
}

// ─── HAPUS ROOM SETELAH SELESAI ─────────────────────────────

function _hapusRoomDariFirebase() {
    if (!roomId) return;
    setTimeout(() => {
        db.collection('room_catur').doc(roomId).delete()
        .then(() => { console.log('Room', roomId, 'berhasil dihapus.'); })
        .catch(err => { console.warn('Gagal hapus room:', err); });

        roomId = '';
        sessionStorage.removeItem('catur_room_id');
        sessionStorage.removeItem('catur_peran');
    }, 5000);
}

// ─── KIRIM LANGKAH KE FIREBASE ───────────────────────────────

function kirimLangkahKeFirebase() {
    if (!roomId) return;
    db.collection('room_catur').doc(roomId).update({
        fen:         game.fen(),
        turn:        game.turn(),
        waktuPutih:  waktuPutih,
        waktuHitam:  waktuHitam,
        statusGame:  game.game_over() ? 'selesai' : 'berjalan',
        waktuUpdate: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(err => { console.error('Gagal kirim langkah:', err); });
}

// ─── NOTIFIKASI TOAST ────────────────────────────────────────

function tampilNotifRoom(pesan, tipe) {
    const warna = { sukses: '#00b894', error: '#ef4444', info: '#6c5ce7' };

    const s = document.getElementById('notif-style-room');
    if (!s) {
        const style     = document.createElement('style');
        style.id        = 'notif-style-room';
        style.textContent = `@keyframes fadeInUp{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`;
        document.head.appendChild(style);
    }

    const el = document.createElement('div');
    el.textContent = pesan;
    el.style.cssText = `
        position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
        background:${warna[tipe] || warna.info};
        color:#fff;padding:10px 20px;border-radius:8px;
        font-size:13px;font-weight:bold;z-index:99999;
        box-shadow:0 4px 20px rgba(0,0,0,0.4);
        animation:fadeInUp 0.3s ease;white-space:nowrap;
    `;
    document.body.appendChild(el);
    setTimeout(() => { el.remove(); }, 3000);
}

// ─── DAFTARKAN DIRI KE LOBBY ─────────────────────────────────

function daftarkanDiriKeLobby() {
    putarSuara(sfxClick);

    if (!usernameSaya) {
        usernameSaya = sessionStorage.getItem('catur_username')
            || localStorage.getItem('akun_device_ini')
            || ('Pemain_' + Math.floor(1000 + Math.random() * 9000));
        sessionStorage.setItem('catur_username', usernameSaya);
        localStorage.setItem('akun_device_ini', usernameSaya);
    }

    const gameModeSelect = document.getElementById('gameMode');
    const modeAktif      = gameModeSelect ? gameModeSelect.value : modeDariUrl;

    const infoProfil = document.getElementById('info-pemain-aktif');
    if (infoProfil) {
        infoProfil.innerHTML = `Akun: <b>${usernameSaya}</b> <span style="color:#39ff14;font-size:11px;">ONLINE</span>`;
    }

    if (modeAktif === 'friend') {
        if (roomId) {
            aktifkanListenerRoom();
            return;
        }
        _tampilTombolBuatRoom();
    }
}

// ─── TOMBOL BUAT ROOM DI LOBBY ───────────────────────────────

function _tampilTombolBuatRoom() {
    const area = document.getElementById('lobby-panel');
    if (!area) return;

    const lama = document.getElementById('btn-buat-room');
    if (lama) lama.remove();

    const wrapper = document.createElement('div');
    wrapper.id    = 'btn-buat-room';
    wrapper.innerHTML = `
        <button onclick="buatRoomBaru()" style="
            width:100%;background:linear-gradient(135deg,#00f2fe,#4facfe);
            color:#000;border:none;padding:12px;border-radius:8px;
            font-weight:900;font-size:15px;cursor:pointer;
            margin-bottom:14px;letter-spacing:1px;
            box-shadow:0 4px 20px rgba(0,242,254,0.3);
        ">+ BUAT ROOM BARU</button>
        <p style="color:#aaa;font-size:11px;text-align:center;margin:0 0 14px;line-height:1.6;">
            Buat room lalu share link ke teman.<br>Penonton juga bisa masuk via link yang sama.
        </p>
        <hr style="border-color:rgba(255,255,255,0.08);margin-bottom:14px;">
    `;
    area.insertBefore(wrapper, area.firstChild);
}

// ─── INIT ────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function () {
    setTimeout(() => {
        const adaLinkRoom = cekAutoJoinDariLink();
        if (!adaLinkRoom) daftarkanDiriKeLobby();
    }, 400);
});
