// ============================================================
// audio.js
// Semua fungsi yang berkaitan dengan suara dan musik latar
// ============================================================

// --- OBJEK SUARA ---
const sfxMove      = new Audio("Aset/sounds/Move.mp3");
const sfxCapture   = new Audio("Aset/sounds/Capture.mp3");
const sfxCheck     = new Audio("Aset/sounds/Check.mp3");
const sfxCheckmate = new Audio("Aset/sounds/checkmate.mp3");
const sfxClick     = new Audio("Aset/sounds/Click.mp3");

/**
 * Putar efek suara dari awal.
 * @param {HTMLAudioElement} audio
 */
function putarSuara(audio) {
    audio.currentTime = 0;
    audio.play().catch(() => {});
}

/**
 * Toggle musik latar (play / pause).
 * Dipanggil dari tombol 🔈 di HTML.
 */
function toggleAudio() {
    const audio = document.getElementById('gameBacksound');
    const btn   = document.getElementById('btn-toggle-audio');
    if (!audio || !btn) return;

    if (audio.paused) {
        audio.play();
        btn.innerText = "🔈 Mute Music";
    } else {
        audio.pause();
        btn.innerText = "🔊 Play Music";
    }
}
