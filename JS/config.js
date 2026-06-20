// ============================================================
// config.js
// Konfigurasi Firebase, variabel global, dan inisialisasi awal
// ============================================================

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

// --- VARIABEL SESI PEMAIN ---
let usernameSaya = sessionStorage.getItem("catur_username") || "";
let roomId       = sessionStorage.getItem("catur_room_id") || "";
let peranSaya    = sessionStorage.getItem("catur_peran")   || "w";

// --- VARIABEL GAME ---
const game = new Chess();
let board  = null;
let kotakAsal = null;
const statusEl = document.getElementById("status");

let waktuPutih  = 300;
let waktuHitam  = 300;
let intervalJam = null;
let gameDimulai = false;
let aiEngine    = null;

// --- VARIABEL PUZZLE ---
let jatahLangkahPuzzle    = 5;
let modePuzzleAktif       = false;
let langkahPuzzleTerpakai = 0;  // Hanya langkah PLAYER, bukan AI

// Bank FEN puzzle dikelompokkan per level AI (0=Pemula, 3=Semi Pro, 10=Master)
// Semua posisi: Putih jalan (w), bisa mat dalam ≤5 langkah
const bankPosisiPuzzle = {
    // ── PEMULA (Level 0) ── Mat 1-2 langkah, posisi sangat terbuka
    "0": [
        // Mat 1: Rook ke h1
        { fen: "6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1",   label: "Pemula #1 — Mat dalam 1" },
        // Mat 1: Queen ke g7
        { fen: "6k1/8/6Q1/8/8/8/5PPP/6K1 w - - 0 1",      label: "Pemula #2 — Mat dalam 1" },
        // Mat 1: Queen ke h7
        { fen: "5rk1/5pQp/8/8/8/8/5PPP/6K1 w - - 0 1",    label: "Pemula #3 — Mat dalam 1" },
        // Mat 1: Rook ke a8
        { fen: "R7/6k1/8/8/8/8/6K1/8 w - - 0 1",           label: "Pemula #4 — Mat dalam 1" },
        // Mat 2: Sederhana
        { fen: "7k/5Q1p/8/8/8/8/5PPP/6K1 w - - 0 1",      label: "Pemula #5 — Mat dalam 2" },
        { fen: "6k1/6pp/7K/8/8/8/8/6R1 w - - 0 1",         label: "Pemula #6 — Mat dalam 2" },
        { fen: "8/8/8/8/8/6K1/6Q1/7k w - - 0 1",           label: "Pemula #7 — Mat dalam 2" },
        { fen: "8/8/8/8/8/5K2/5R2/5rk1 w - - 0 1",         label: "Pemula #8 — Mat dalam 2" },
    ],

    // ── SEMI PRO (Level 3) ── Mat 3-4 langkah, ada balasan AI
    "3": [
        // Mat 3: Posisi klasik
        { fen: "r5k1/5ppp/8/8/8/5Q2/5PPP/6K1 w - - 0 1",  label: "Semi Pro #1 — Mat dalam 3" },
        { fen: "6k1/5ppp/5r2/8/8/5Q2/5PPP/6K1 w - - 0 1", label: "Semi Pro #2 — Mat dalam 3" },
        { fen: "3r2k1/5ppp/8/2Q5/8/8/5PPP/6K1 w - - 0 1",  label: "Semi Pro #3 — Mat dalam 3" },
        { fen: "5rk1/r5pp/8/1Q6/8/8/5PPP/1R4K1 w - - 0 1", label: "Semi Pro #4 — Mat dalam 3" },
        { fen: "2r3k1/5ppp/8/3Q4/8/5N2/5PPP/6K1 w - - 0 1",label: "Semi Pro #5 — Mat dalam 3" },
        // Mat 4
        { fen: "r4rk1/5ppp/8/3Q4/1B6/8/5PPP/6K1 w - - 0 1",label: "Semi Pro #6 — Mat dalam 4" },
        { fen: "2kr4/3p4/8/3Q4/8/5B2/5PPP/6K1 w - - 0 1",  label: "Semi Pro #7 — Mat dalam 4" },
        { fen: "r3r1k1/5ppp/8/2Q5/8/2N5/5PPP/6K1 w - - 0 1",label: "Semi Pro #8 — Mat dalam 4" },
    ],

    // ── MASTER (Level 10) ── Mat 4-5 langkah, pertahanan AI kuat
    "10": [
        { fen: "r2q1rk1/5ppp/p7/1p1Q4/8/2N2N2/5PPP/R4RK1 w - - 0 1", label: "Master #1 — Mat dalam 5" },
        { fen: "r3r1k1/1bq2ppp/p7/1p1Q4/8/2NB4/5PPP/R4RK1 w - - 0 1", label: "Master #2 — Mat dalam 5" },
        { fen: "2r2rk1/1bq2ppp/p7/3Q4/1B6/2N2N2/5PPP/R4RK1 w - - 0 1",label: "Master #3 — Mat dalam 5" },
        { fen: "r2r2k1/2q2ppp/p7/3Q4/2B5/2N2N2/5PPP/R4RK1 w - - 0 1", label: "Master #4 — Mat dalam 5" },
        { fen: "r4rk1/2q2ppp/p1p5/3Q4/2B1N3/8/5PPP/R4RK1 w - - 0 1",  label: "Master #5 — Mat dalam 5" },
        { fen: "r2q1rk1/4bppp/p1p5/2Q5/2B1N3/8/5PPP/R4RK1 w - - 0 1", label: "Master #6 — Mat dalam 5" },
        { fen: "2rq1rk1/4bppp/p7/2Q5/2B1N3/2N5/5PPP/R4RK1 w - - 0 1", label: "Master #7 — Mat dalam 5" },
        { fen: "r3r1k1/4bppp/p1q5/2Q5/2B1N3/2N5/5PPP/R4RK1 w - - 0 1",label: "Master #8 — Mat dalam 5" },
    ]
};

// --- DETEKSI MODE DARI URL ---
const urlParams   = new URLSearchParams(window.location.search);
const modeDariUrl = urlParams.get("mode") || "ai";
