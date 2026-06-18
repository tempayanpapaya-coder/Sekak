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
let jatahLangkahPuzzle   = 5;
let modePuzzleAktif      = false;
let langkahPuzzleTerpakai = 0;
const bankPosisiPuzzle = [
    "8/8/8/8/8/8/5K2/6Rk w - - 0 1",
    "r5k1/5ppp/8/8/8/5Q2/5PPP/6K1 w - - 0 1",
    "6k1/5ppp/5r2/8/8/5Q2/5PPP/6K1 w - - 0 1",
    "7k/5Qpp/8/8/8/8/5PPP/6K1 w - - 0 1",
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
];

// --- DETEKSI MODE DARI URL ---
const urlParams   = new URLSearchParams(window.location.search);
const modeDariUrl = urlParams.get("mode") || "ai";
