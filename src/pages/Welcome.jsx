import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { setSeoMeta, SITE_URL, getBreadcrumbSchema } from '../utils/seo';

const Welcome = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [liveResults, setLiveResults] = useState([]);
  const [isLiveLoading, setIsLiveLoading] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    setSeoMeta(
      'Ndichan - Nonton Anime & Baca Komik Sub Indo Gratis Tanpa Iklan',
      'Ndichan adalah platform streaming anime dan baca komik subtitle Indonesia terbaik. Nonton ribuan judul anime ongoing & selesai serta baca manga terpopuler gratis tanpa iklan kualitas HD.',
      '/img/welcomebanner.webp',
      `${SITE_URL}/`,
      {
        keywords: 'Ndichan, NdiChan, nonton anime, streaming anime, anime sub indo, baca komik, manga sub indo, manhwa sub indo, anime gratis, nonton anime online',
        schema: {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: 'Ndichan - Nonton Anime & Baca Komik Sub Indo Gratis Tanpa Iklan',
          description: 'Streaming ribuan judul anime dan baca komik manga/manhwa subtitle Indonesia gratis tanpa iklan kualitas HD di Ndichan.',
          url: `${SITE_URL}/`,
          inLanguage: 'id',
          mainEntity: {
            '@type': 'WebApplication',
            name: 'Ndichan',
            applicationCategory: 'EntertainmentApplication',
            operatingSystem: 'Any',
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'IDR'
            }
          }
        }
      }
    );
  }, []);

  useEffect(() => {
    if (searchQuery.length < 3) {
      setLiveResults([]);
      return;
    }
    let isMounted = true;
    const timer = setTimeout(async () => {
      setIsLiveLoading(true);
      try {
        const res = await fetch(`/ndikagantengtobrutbanget/v1/search?q=${encodeURIComponent(searchQuery)}`).then(r => r.json());
        if (isMounted) setLiveResults(res.data || []);
      } catch (e) {
        if (isMounted) setLiveResults([]);
      } finally {
        if (isMounted) setIsLiveLoading(false);
      }
    }, 350);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const navLinks = useMemo(() => [
    { label: 'Home', path: '/home', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/> },
    { label: 'Explore', path: '/explore', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/> },
    { label: 'Ongoing', path: '/ongoing', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/> },
    { label: 'Schedule', path: '/schedule', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/> }
  ], []);

  return (
    <div className="min-h-screen bg-[#0b0b10] flex flex-col text-white">
      {/* ===== SEO SEMANTIC STRUCTURE ===== */}
      <div className="sr-only">
        <h1>Ndichan - Platform Nonton Anime & Baca Komik Sub Indo Gratis</h1>
        <p>Ndichan adalah situs streaming anime dan baca komik online subtitle Indonesia terlengkap. Nikmati ribuan anime ongoing, anime movie, dan komik manga, manhwa, serta manhua gratis tanpa gangguan iklan dalam kualitas HD jernih.</p>
      </div>

      {/* ===== NAVBAR ===== */}
      <nav className="w-full h-24 px-6 md:px-12 flex items-center justify-between shrink-0 z-50">
        <div className="flex items-center cursor-pointer" onClick={() => navigate('/home')}>
          <img src="/img/nefora.webp" alt="Ndichan Logo" width="100" height="100" className="w-16 md:w-24 object-contain" fetchPriority="high" />
        </div>
        <div className="flex gap-4 md:gap-6 bg-[#141419]/70 border border-[#2a2a35] px-5 py-2.5 chip-cut shadow-lg">
          {navLinks.map((link, i) => (
            <button key={i} aria-label={link.label} onClick={() => navigate(link.path)} className="text-white hover:text-[#d4a73c] transition-colors p-1">
              <svg className="w-6 h-6 md:w-7 md:h-7" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">{link.icon}</svg>
            </button>
          ))}
        </div>
      </nav>

      {/* ===== MAIN CONTENT ===== */}
      <main className="flex-1 flex flex-col items-center px-4 pt-2">
        {/* ===== HERO SECTION ===== */}
        <div className="relative w-full max-w-5xl card-cut overflow-hidden border border-[#2a2a35] shadow-2xl bg-[#141419]">
          <img src="/img/welcomebanner.webp" alt="Ndichan Anime Streaming" width="800" height="450" fetchPriority="high" className="w-full object-cover aspect-square md:aspect-video" />
          <div className="absolute inset-0 bg-black/40"></div>

          <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-lg relative">
              <div className="flex items-center bg-[#f0ead9] chip-cut px-5 py-3 shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all">
                <svg className="w-5 h-5 text-gray-500 mr-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                <input
                  type="text"
                  className="w-full bg-transparent text-black text-sm outline-none font-bold placeholder-gray-500"
                  placeholder="Ketik anime yang ingin kamu tonton..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(searchQuery ? `/explore?q=${searchQuery}` : '/home')}
                  aria-label="Search anime on Ndichan"
                />
                <button onClick={() => navigate('/explore')} className="text-gray-600 font-black text-[10px] ml-2 border-l border-gray-300 pl-3 hover:text-black uppercase tracking-widest flex items-center gap-1 shrink-0 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/></svg>
                  FILTER
                </button>
              </div>

              {/* ===== LIVE SEARCH RESULTS ===== */}
              {liveResults.length > 0 && (
                <div className="absolute top-[60px] inset-x-0 bg-[#f0ead9] card-cut-sm overflow-hidden z-[100] max-h-64 shadow-2xl overflow-y-auto custom-scrollbar">
                  {liveResults.map(r => (
                    <div
                      key={r.id}
                      onClick={() => navigate(`/anime/${r.id}-${(r.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`)}
                      className="flex items-center gap-4 p-3 hover:bg-gray-100 border-b border-gray-100 cursor-pointer text-left transition-colors"
                    >
                      <img
                        src={`https://cfelainawanggy.pages.dev/?action=proxy&url=${r.image_poster}`}
                        referrerPolicy="no-referrer"
                        alt={r.title}
                        width="40"
                        height="55"
                        loading="lazy"
                        decoding="async"
                        className="w-10 rounded-sm shadow-sm"
                      />
                      <div className="flex flex-col">
                        <span className="text-black font-black text-xs line-clamp-1">{r.title}</span>
                        <span className="text-gray-500 font-bold text-[9px] uppercase mt-1 tracking-wider">{r.type} • {r.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ===== CTA BUTTON ===== */}
          <div className="absolute bottom-10 left-0 right-0 flex justify-center">
            <button
              onClick={() => navigate('/home')}
              className="bg-[#ff4e2d] hover:bg-[#e6432a] text-[#0b0b10] font-bold px-14 py-3.5 btn-cut active:scale-95 transition-all shadow-[0_10px_30px_rgba(255,78,45,0.3)] tracking-widest text-xs uppercase"
            >
              Masuk Beranda
            </button>
          </div>
        </div>

        {/* ============================================================ */}
        {/* ===== BRAND SECTION - TANPA TEKS PANJANG ===== */}
        {/* ============================================================ */}
        <div className="mt-16 mb-24 flex flex-col items-center text-center px-6">
          <img
            src="/img/kaguya.webp"
            alt="Ndichan"
            width="120"
            height="120"
            loading="lazy"
            decoding="async"
            className="w-28 md:w-32 object-contain mb-6 drop-shadow-2xl"
          />

          {/* ===== BRAND NAME ===== */}
          <h2 className="font-display text-4xl md:text-6xl tracking-wide mb-5">
            <span className="text-[#f0ead9]">Ndi</span>
            <span className="text-[#ff4e2d]">Chan</span>
          </h2>

          {/* ===== SHORT TAGLINE ===== */}
          <p className="text-white/50 text-sm md:text-base font-medium leading-relaxed max-w-2xl">
            Nonton anime subtitle Indonesia gratis tanpa iklan.
          </p>
        </div>
      </main>

      {/* ===== FOOTER ===== */}
      <footer className="w-full py-8 px-6 border-t border-white/5 flex flex-col items-center">
        <p className="text-[10px] md:text-[11px] text-white/50 font-bold leading-relaxed max-w-2xl text-center tracking-wide">
          NdiChan adalah platform streaming anime pihak ketiga. Kami tidak mengunggah atau menyimpan file video apa pun di server kami.
          Semua konten disediakan oleh pihak ketiga yang tidak terafiliasi dengan kami.
        </p>
        <p className="text-[8px] text-white/30 mt-2 tracking-widest">
          &copy; 2024 Ndichan
        </p>
      </footer>
    </div>
  );
};

export default Welcome;