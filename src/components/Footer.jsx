import React from 'react';

const Footer = () => (
  <footer className="mt-20 bg-[#08080c] border-t border-white/[0.08] pt-14 pb-4 px-6 relative overflow-hidden">
    {/* Ambient Glow */}
    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-[#d4a73c]/50 to-transparent pointer-events-none" />

    <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-10 mb-12">
      {/* Brand */}
      <div className="flex flex-col items-center md:items-start text-center md:text-left">
        <div className="flex items-center gap-3 mb-3">
          <img
            src="https://raw.githubusercontent.com/NdikzOne/NeFora/refs/heads/main/p_images2_064_987_022_original.jpeg"
            alt="NdiChan"
            className="w-12 h-12 rounded-2xl object-contain border border-white/10 shadow-lg"
          />
          <span className="font-display text-2xl text-white tracking-wider">NDICHAN</span>
        </div>
        <p className="text-xs text-white/50 leading-relaxed max-w-sm">
          Platform streaming anime dan baca manga subtitle Indonesia gratis, bebas iklan mengganggu dengan kualitas video terbaik.
        </p>
      </div>

      {/* Disclaimer */}
      <div className="text-center md:text-left">
        <h4 className="font-display text-white mb-3 text-sm tracking-wide uppercase flex items-center justify-center md:justify-start gap-2">
          <span className="w-1.5 h-4 rounded-full bg-[#d4a73c]"></span>
          Disclaimer
        </h4>
        <p className="text-xs text-white/40 leading-relaxed font-normal">
          NdiChan tidak menyimpan file video di server kami. Semua tautan konten disediakan oleh pihak ketiga. Hak cipta sepenuhnya milik masing-masing pembuat dan distributor resmi.
        </p>
      </div>

      {/* Credits */}
      <div className="text-center md:text-left flex flex-col items-center md:items-start">
        <h4 className="font-display text-white mb-3 text-sm tracking-wide uppercase flex items-center justify-center md:justify-start gap-2">
          <span className="w-1.5 h-4 rounded-full bg-[#ff4e2d]"></span>
          Partner & Sumber Data
        </h4>
        <div className="flex flex-wrap justify-center md:justify-start items-center gap-2.5">
          {['animein', 'kuramanime', 'oploverz', 'otakudesu', 'samehadaku'].map(p => (
            <span
              key={p}
              className="px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/10 text-white/60 text-[11px] font-bold uppercase tracking-wider hover:border-[#d4a73c]/40 hover:text-[#d4a73c] transition-colors"
            >
              {p}
            </span>
          ))}
        </div>
      </div>
    </div>

    {/* Copyright */}
    <div className="max-w-7xl mx-auto border-t border-white/5 py-6 text-center">
      <p className="text-xs text-white/40 font-medium">
        &copy; {new Date().getFullYear()} <span className="text-[#d4a73c] font-black">NdiChan</span>. Dibuat dengan segenap cinta untuk wibu Indonesia.
      </p>
    </div>
  </footer>
);

export default Footer;
