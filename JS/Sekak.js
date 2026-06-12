// --- CONFIG FIREBASE (Tetap seperti milikmu) ---
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

// --- VARIABEL GLOBAL BARU UNTUK LOBBY ---
let usernameSaya = "";
let roomId = "";
let peranSaya = ""; 
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
try {
    // Mencoba mengaktifkan mesin AI Stockfish lokal
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
    // Jika pemain sedang masuk dalam mode online, bersihkan statusnya di database
    if (typeof usernameSaya !== 'undefined' && usernameSaya) {
        db.collection("para_pemain").doc(usernameSaya).delete()
        .then(() => {
            window.location.href = "index.html";
        })
        .catch(() => {
            window.location.href = "index.html";
        });
    } else {
        // Jika hanya main offline/puzzle, langsung alihkan ke index.html
        window.location.href = "index.html";
    }
}

   function onSquareClick(square) {
     
       // ---- SENSOR ONLINE: Kunci papan jika bukan giliranmu ----
    if (document.getElementById('gameMode').value === 'friend' && game.turn() !== peranSaya) {
        statusEl.innerText = "⏳ Sabar! Ini giliran temanmu.";
        return;
    }
    
    // Kode bawaan kamumu yang ke bawah jangan diubah...
    if (document.getElementById('gameMode').value === 'ai' && game.turn() === 'b') return;
    if (game.game_over() || waktuPutih <= 0 || waktuHitam <= 0) return;
    // ... dan seterusnya sampai bawah

    const modeGame = document.getElementById('gameMode').value;
    const levelAI = document.getElementById('aiLevel').value;

    // Kunci bidak hitam pada mode AI dan Puzzle
    if (
        (modeGame === 'ai' || levelAI === 'puzzle')
        && game.turn() === 'b'
    ) {
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

        // Fitur Lukir via klik benteng
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

    // (Logika puzzle disembunyikan agar rapi...)

    tukarArahJam(); 
    updateStatus();

    // ---- SENSOR ONLINE: Jika bermain mode vs Teman, kirim ke Firebase ----
    if (document.getElementById('gameMode').value === 'friend') {
        kirimLangkahKeFirebase();
    }

    // Perintah AI membalas
    if (document.getElementById('gameMode').value !== 'friend' && !game.game_over() && game.turn() === 'b') {
        statusEl.innerText = "🤖 AI sedang berpikir...";
        setTimeout(pemicuLangkahAI, 400); 
    }
}


    function pemicuLangkahAI() {
        if (!aiEngine) return;
        aiEngine.postMessage('position fen ' + game.fen());
        aiEngine.postMessage('go movetime 1000'); 
    }
    // --- UBAH FUNGSI INI DI FILE JAVASCRIPT KAMU ---
function tukarArahJam() {
    // 1. Hentikan hitung mundur langkah sebelumnya
    clearInterval(intervalJam);
    
    if (game.game_over()) return;

    // 2. AMBIL DURASI UTAMA DARI DROPDOWN (Misal: 1 menit / 60 detik)
    // Setiap kali giliran berganti, kita PAKSA waktu kedua pemain kembali penuh!
    const durasiPilihan = parseInt(document.getElementById('timeLimit').value);
    waktuPutih = durasiPilihan;
    waktuHitam = durasiPilihan;

    // 3. Langsung perbarui tampilan angka jam di layar secara instan ke waktu penuh
    formatTampilanJam('clock-white', waktuPutih);
    formatTampilanJam('clock-black', waktuHitam);

    // 4. Berikan efek visual lampu neon (oranye) ke pemain yang sekarang giliran mikir
    if (game.turn() === 'w') {
        document.getElementById('timer-white').classList.add('active-timer');
        document.getElementById('timer-black').classList.remove('active-timer');
    } else {
        document.getElementById('timer-black').classList.add('active-timer');
        document.getElementById('timer-white').classList.remove('active-timer');
    }

    // 5. Mulai hitung mundur durasi langkah untuk pemain yang aktif
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


    // Mengubah angka detik murni menjadi teks berformat "05:00" rapi
    function formatTampilanJam(idElemen, totalDetik) {
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
    
    // Mengubah kalimat agar sesuai dengan sistem durasi mikir per langkah
    statusEl.innerHTML = `⏰ <b>GAME OVER!</b> Waktu berpikir ${siapaYangHabis} habis (Lebih dari 1 Menit). Pemain <b>${pemenang} MENANG!</b>`;
}


    function highlightSquare(square) {
        $('#board .square-' + square).css('background', 'rgba(255, 159, 67, 0.5)');
    }

   function hapusHighlight() {
    // Menghapus background inline dari semua petak di dalam papan catur
    $('#board .square-55d63').css('background', '');
}


    function updateStatus() {
    if (waktuPutih <= 0 || waktuHitam <= 0) return;

    let status = '';
    const mode = document.getElementById('gameMode').value;
    const turnSekarang = game.turn(); // 'w' untuk putih, 'b' untuk hitam

    if (game.in_checkmate()) {
        clearInterval(intervalJam);
        
        let kalimatEjekan = "";
        
        if (mode === 'ai') {
            if (turnSekarang === 'w') {
                // Jika giliran putih yang terjebak, artinya KAMU kalah lawan AI
                kalimatEjekan = "AI berkata: 'Waduh... Otakmu perlu diservis, jalan begitu saja tidak lihat! 🤫'";
            } else {
                // Jika hitam yang terjebak, artinya KAMU berhasil mengalahkan AI
                kalimatEjekan = "🎉 LUAR BIASA! Kamu berhasil merontokkan sekrup prosesor robot AI ini! 🧠💥";
            }
        } else {
            // Mode VS TEMAN
            if (turnSekarang === 'w') {
                kalimatEjekan = "⚫ PEMAIN HITAM MENANG! <br> Putih, mending pulang aja, bersihin papan tulis atau tidur siang sana! 🤫";
            } else {
                kalimatEjekan = "⚪ PEMAIN PUTIH MENANG! <br> Hitam, blundermu epic sekali! Harga dirimu jatuh di petak catur ini! 📉";
            }
        }

        // Suntikkan teks ke dalam pop-up lalu munculkan animasinya!
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

function resetGame() {
    clearInterval(intervalJam);
    hapusHighlight();
    kotakAsal = null;
    gameDimulai = false;

    document.getElementById('gameover-overlay').style.display = 'none';
    document.getElementById('start-overlay').style.display = 'flex';

    const mode = document.getElementById('gameMode').value;
    
    // SAKLAR MODE PUZZLE
    if (mode === 'puzzle') {
    modePuzzleAktif = true;
    jatahLangkahPuzzle = 5;
    langkahPuzzleTerpakai = 0;
        modePuzzleAktif = true;
        jatahLangkahPuzzle = 5;
        document.getElementById('sisa-langkah').innerText = jatahLangkahPuzzle;
        document.getElementById('puzzle-counter-box').style.display = 'block'; // Munculkan bar jatah langkah
        document.getElementById('difficultyRow').style.display = 'none';
        document.getElementById('marquee-duel').style.display = 'none';

        // MENGACAK POSISI BIDAK DARI BANK DATA FEN
        const indeksAcak = Math.floor(Math.random() * bankPosisiPuzzle.length);
        const posisiFenAcak = bankPosisiPuzzle[indeksAcak];
        
        game.load(posisiFenAcak); // Mengatur logika otak internal catur ke posisi acak
        board.position(posisiFenAcak); // Mengatur visual papan catur ke posisi acak
    } else {
        // Mode Normal (Vs AI atau Vs Teman)
        modePuzzleAktif = false;
        document.getElementById('puzzle-counter-box').style.display = 'none'; // Sembunyikan bar jatah langkah
        game.reset();
        board.start();

        if (mode === 'ai') {
            document.getElementById('difficultyRow').style.display = 'flex';
            document.getElementById('marquee-duel').style.display = 'none';
        } else {
            document.getElementById('difficultyRow').style.display = 'none';
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
    tukarArahJam(); 

    // ---- SENSOR ONLINE: Aktifkan radar pemantau room ----
    if (document.getElementById('gameMode').value === 'friend') {
        aktifkanListenerOnline();
        statusEl.innerText = `🎮 Mode Online Aktif! Kamu memegang pion: ${peranSaya === 'w' ? 'PUTIH' : 'HITAM'}`;
    } else if (modePuzzleAktif) {
        statusEl.innerText = "🧩 Mode Puzzle: Habisi lawan dalam 5 langkah atau kurang!";
    } else {
        statusEl.innerText = "Giliran: Klik Putih (Kamu) - Game Dimulai!";
    }
}



    const config = {
        draggable: false,
        position: 'start',
        pieceTheme: '../Aset/{piece}.png'
    };

    board = Chessboard('board', config);

    $('#board').on('click', '.square-55d63', function() {
        const square = $(this).attr('data-square');
        onSquareClick(square);
    });
    
    // =============================================================================
//  SISTEM ONLINE MULTIPLAYER (FIREBASE DETECTOR)
// =============================================================================

// 1. Fungsi untuk mengirim langkah terbaru ke Firebase
function kirimLangkahKeFirebase() {
    db.collection("room_catur").doc(roomId).set({
        fen: game.fen(),
        turn: game.turn(),
        waktuUpdate: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
        console.log("Langkah berhasil dikirim ke awan! ☁️");
    })
    .catch((error) => {
        console.error("Gagal mengirim langkah: ", error);
    });
}

// 2. Fungsi mendengarkan (Listen) gerakan dari Teman secara Realtime
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
        } else {
            console.log("Room belum dibuat, memulai room baru...");
        }
    });
}
// Tambahkan fungsi untuk menangani masuknya pemain ke dalam room
function gabungKeKamarOnline(idKamarDipilih) {
    roomId = idKamarDipilih;
    const roomRef = db.collection("room_catur").doc(roomId);

    roomRef.get().then((doc) => {
        if (!doc.exists) {
            // Jika room belum ada, user ini adalah Pembuat Room (Pemain Putih)
            peranSaya = "w"; 
            roomRef.set({
                fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
                turn: "w",
                pemainPutih: "aktif",
                pemainHitam: "kosong"
            });
            alert("Kamu masuk sebagai PUTIH. Menunggu tantangan teman...");
        } else {
            // Jika room sudah ada, user ini adalah Penantang (Pemain Hitam)
            peranSaya = "b";
            roomRef.update({
                pemainHitam: "aktif"
            });
            alert("Kamu masuk sebagai HITAM. Selamat bertanding!");
            
            // Balik papan catur secara visual agar Hitam berada di bawah (Opsional)
            // board.orientation('black'); 
        }
        
        // Aktifkan radar online setelah peran dipastikan
        aktifkanListenerOnline();
    });
}
function loginPemain() {
    const inputName = document.getElementById('username-input').value.trim();
    
    if (inputName === "") {
        alert("Nama tidak boleh kosong!");
        return;
    }

    usernameSaya = inputName;
    document.getElementById('user-aktif-teks').innerText = "Status: Login sebagai " + usernameSaya;
    
    // Sembunyikan input login, munculkan panel lobby online
    document.getElementById('username-input').disabled = true;
    document.getElementById('lobby-section').style.display = 'block';

    // Daftarkan diri ke Firestore sebagai user AKTIF
    db.collection("para_pemain").doc(usernameSaya).set({
        nama: usernameSaya,
        status: "di_lobby", // status: di_lobby, ditantang, bermain
        lawan: "",
        roomId: "",
        terakhirOnline: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Jalankan radar pemantau lobby dan pemantau jika kita ditantang
    pantauLobbyOnline();
    pantauTantanganMasuk();

    // Hapus data dari database jika player menutup browser/tab
    window.addEventListener('beforeunload', function () {
        db.collection("para_pemain").doc(usernameSaya).delete();
    });
}

// =============================================================================
// 2. RADAR LIVE: Melihat Siapa Saja yang Sedang Online
// =============================================================================
function pantauLobbyOnline() {
    db.collection("para_pemain").onSnapshot((snapshot) => {
        const listUserEl = document.getElementById('daftar-pemain-online');
        listUserEl.innerHTML = ""; // Reset list visual

        snapshot.forEach((doc) => {
            const player = doc.data();
            
            // Jangan tampilkan nama diri sendiri di daftar online
            if (player.nama !== usernameSaya) {
                const li = document.createElement('li');
                li.style.margin = "10px 0";
                li.style.padding = "10px";
                li.style.background = "#333";
                li.style.borderRadius = "5px";
                li.style.display = "flex";
                li.style.justifyContent = "between";

                let tombolAksi = "";
                if (player.status === "di_lobby") {
                    tombolAksi = `<button onclick="kirimTantangan('${player.nama}')" style="background:#007bff; color:white; border:none; padding:5px 10px; cursor:pointer; border-radius:3px;">Tantang ⚔️</button>`;
                } else {
                    tombolAksi = `<span style="color:#aaa; font-style:italic;"> sedang ${player.status}</span>`;
                }

                li.innerHTML = `<span><strong>${player.nama}</strong></span> ${tombolAksi}`;
                listUserEl.appendChild(li);
            }
        });

        if(listUserEl.innerHTML === "") {
            listUserEl.innerHTML = "<li style='color:#aaa;'>Tidak ada pemain lain yang online saat ini...</li>";
        }
    });
}

// =============================================================================
// 3. LOGIKA PLAYER 1: Mengirim Tantangan Ke Player 2
// =============================================================================
function kirimTantangan(namaLawan) {
    roomId = "room_" + usernameSaya + "_vs_" + namaLawan;
    peranSaya = "w"; // Penantang otomatis memegang Putih

    // 1. Buat Room Catur Baru di Firebase dengan posisi awal pion standar
    db.collection("room_catur").doc(roomId).set({
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        turn: "w",
        waktuUpdate: firebase.firestore.FieldValue.serverTimestamp()
    });

    // 2. Ubah status data lawan di Firebase agar memicu pop-up di layar mereka
    db.collection("para_pemain").doc(namaLawan).update({
        status: "ditantang",
        lawan: usernameSaya,
        roomId: roomId
    });

    // 3. Ubah status diri sendiri menjadi bersiap bertanding
    db.collection("para_pemain").doc(usernameSaya).update({
        status: "bermain",
        lawan: namaLawan,
        roomId: roomId
    });

    alert("Tantangan terkirim! Menunggu " + namaLawan + " menerima...");
    
    // Jalankan sensor online game milikmu agar siap sinkronisasi bidak
    aktifkanListenerOnline();
}

// =============================================================================
// 4. LOGIKA PLAYER 2: Menerima / Menolak Tantangan Masuk
// =============================================================================
function pantauTantanganMasuk() {
    db.collection("para_pemain").doc(usernameSaya).onSnapshot((doc) => {
        if (!doc.exists) return;
        const data = doc.data();

        // Jika ada orang yang mengubah status kita menjadi "ditantang"
        if (data.status === "ditantang") {
            const konfirmasi = confirm(`⚔️ Kamu ditantang duel oleh ${data.lawan}! Terima tantangan?`);
            
            if (konfirmasi) {
                roomId = data.roomId;
                peranSaya = "b"; // Yang menerima tantangan otomatis jadi Hitam

                // Update status diri sendiri menjadi sedang bermain
                db.collection("para_pemain").doc(usernameSaya).update({
                    status: "bermain"
                });

                alert("Tantangan diterima! Memulai Game...");
                
                // Set game mode ke 'friend' secara otomatis lewat kode backend
                document.getElementById('gameMode').value = 'friend'; 
                
                // Pemicu mulai permainan nyata (fungsi bawaan kamu)
                mulaiPermainanNyata(); 
                aktifkanListenerOnline();

            } else {
                // Jika Menolak: Kembalikan status ke lobby dan hapus tawaran
                db.collection("para_pemain").doc(usernameSaya).update({
                    status: "di_lobby",
                    lawan: "",
                    roomId: ""
                });
                // Kabari penantang bahwa tantangannya ditolak
                db.collection("para_pemains").doc(data.lawan).update({
                    status: "di_lobby",
                    lawan: "",
                    roomId: ""
                });
            }
        }
        
        // JIKA PLAYER 1 BERHASIL TERHUBUNG (Otomatis start untuk Player 1)
        if (data.status === "bermain" && peranSaya === "w" && gameDimulai === false) {
            document.getElementById('gameMode').value = 'friend';
            mulaiPermainanNyata();
        }
    });
}


    resetGame();
    