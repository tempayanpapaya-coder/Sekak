// ============================================================
// register-sw.js
// Daftarkan Service Worker + handle update PWA
// Sisipkan di SEMUA halaman HTML sebelum </body>
// ============================================================

(function () {
    if (!('serviceWorker' in navigator)) {
        console.warn('Browser ini tidak mendukung Service Worker.');
        return;
    }

    window.addEventListener('load', function () {

        navigator.serviceWorker.register('/sw.js')
        .then(function (registrasi) {
            console.log('[PWA] Service Worker terdaftar:', registrasi.scope);

            // ── Deteksi update tersedia ──
            registrasi.addEventListener('updatefound', function () {
                const swBaru = registrasi.installing;
                if (!swBaru) return;

                swBaru.addEventListener('statechange', function () {
                    if (
                        swBaru.state === 'installed' &&
                        navigator.serviceWorker.controller
                    ) {
                        // Ada versi baru — tampilkan toast update
                        tampilToastUpdate();
                    }
                });
            });
        })
        .catch(function (err) {
            console.error('[PWA] Gagal daftar Service Worker:', err);
        });

        // ── Handle saat SW baru aktif (setelah user klik update) ──
        navigator.serviceWorker.addEventListener('controllerchange', function () {
            window.location.reload();
        });
    });

    // ── Toast notifikasi update tersedia ──
    function tampilToastUpdate() {
        // Hapus toast lama jika ada
        const lama = document.getElementById('toast-update-pwa');
        if (lama) lama.remove();

        const toast = document.createElement('div');
        toast.id    = 'toast-update-pwa';
        toast.innerHTML = `
            <span>🔄 Versi baru tersedia!</span>
            <button id="btn-update-pwa">Update Sekarang</button>
        `;
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #1a1d2e;
            border: 1px solid #00f2fe;
            color: #fff;
            padding: 12px 16px;
            border-radius: 10px;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 12px;
            z-index: 99999;
            box-shadow: 0 4px 20px rgba(0,242,254,0.3);
            white-space: nowrap;
        `;

        document.body.appendChild(toast);

        document.getElementById('btn-update-pwa').addEventListener('click', function () {
            // Kirim pesan ke SW agar skip waiting
            navigator.serviceWorker.ready.then(reg => {
                if (reg.waiting) {
                    reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                }
            });
            toast.remove();
        });
    }

    // ── Tombol install PWA (Add to Home Screen) ──
    let deferredPrompt = null;

    window.addEventListener('beforeinstallprompt', function (e) {
        e.preventDefault();
        deferredPrompt = e;

        // Tampilkan tombol install jika ada elemennya di HTML
        const btnInstall = document.getElementById('btn-install-pwa');
        if (btnInstall) {
            btnInstall.style.display = 'block';
            btnInstall.addEventListener('click', function () {
                deferredPrompt.prompt();
                deferredPrompt.userChoice.then(function (hasil) {
                    if (hasil.outcome === 'accepted') {
                        console.log('[PWA] User menginstall aplikasi.');
                    }
                    deferredPrompt = null;
                    btnInstall.style.display = 'none';
                });
            });
        }
    });

    window.addEventListener('appinstalled', function () {
        console.log('[PWA] Aplikasi berhasil diinstall!');
        deferredPrompt = null;
    });

})();
