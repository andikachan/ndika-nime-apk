import React, { useState, useEffect, useRef } from 'react';

const TYPE_STYLES = {
  info: 'bg-[#141419] border-[#d4a73c]/30 text-[#f0ead9]',
  success: 'bg-[#0f1c14] border-emerald-500/30 text-emerald-200',
  warning: 'bg-[#1c150f] border-amber-500/30 text-amber-200',
};

// Banner pengumuman global. Dismiss disimpan per-pesan di localStorage supaya
// kalau admin ganti isi pengumuman, banner baru tetap muncul lagi walau
// pengumuman lama sudah pernah ditutup user.
//
// Bar ini fixed di paling atas (di atas Navbar), dan tingginya dilaporkan ke
// SiteGate lewat onHeightChange supaya Navbar bisa geser ke bawah dan konten
// halaman dikasih spacer, biar gak ada yang numpuk/ketutupan.
const AnnouncementBar = ({ message, type = 'info', onHeightChange }) => {
  const [dismissed, setDismissed] = useState(true);
  const barRef = useRef(null);

  useEffect(() => {
    if (!message) return;
    try {
      const dismissedMessage = localStorage.getItem('ndichan_announcement_dismissed');
      setDismissed(dismissedMessage === message);
    } catch (e) {
      setDismissed(false);
    }
  }, [message]);

  // Ukur & laporkan tinggi bar tiap kali kontennya berubah (termasuk pas
  // teks wrap ke 2 baris di layar kecil), dan laporkan 0 kalau lagi
  // disembunyikan/dismiss/unmount.
  useEffect(() => {
    if (!message || dismissed) {
      onHeightChange?.(0);
      return;
    }
    const el = barRef.current;
    if (!el) return;

    const report = () => onHeightChange?.(el.offsetHeight);
    report();

    const observer = new ResizeObserver(report);
    observer.observe(el);
    window.addEventListener('resize', report);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', report);
      onHeightChange?.(0);
    };
  }, [message, dismissed, onHeightChange]);

  if (!message || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem('ndichan_announcement_dismissed', message);
    } catch (e) {
      // ignore
    }
  };

  return (
    <div
      ref={barRef}
      className={`fixed top-0 inset-x-0 z-[110] w-full border-b px-4 py-2.5 flex items-center justify-center gap-3 text-xs md:text-sm font-medium text-center ${TYPE_STYLES[type] || TYPE_STYLES.info}`}
    >
      <span className="max-w-4xl">{message}</span>
      <button
        onClick={handleDismiss}
        aria-label="Tutup pengumuman"
        className="shrink-0 opacity-60 hover:opacity-100 transition-opacity absolute right-4"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
  );
};

export default AnnouncementBar;

