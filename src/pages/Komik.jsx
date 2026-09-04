import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Shimmer } from '../components/SectionUI';
import { setSeoMeta, SITE_URL, getBreadcrumbSchema, getCollectionSchema } from '../utils/seo';

const MANGA_ENDPOINTS = {
  heroSlider: '/ndikagantengtobrutbanget/v1/manga/heroslider?limit=15',
  popularToday: '/ndikagantengtobrutbanget/v1/manga/populartoday?limit=45',
  latest: '/ndikagantengtobrutbanget/v1/manga/latest',
  latestProject: '/ndikagantengtobrutbanget/v1/manga/latestproject',
};

const HeroSkeleton = () => (
  <div className="w-full h-full bg-[#12121a] relative overflow-hidden flex items-end p-6 md:p-12 gap-5 md:gap-8">
    <div className="w-28 md:w-44 aspect-[3/4.4] bg-white/5 relative overflow-hidden rounded-2xl shrink-0"><Shimmer /></div>
    <div className="flex flex-col gap-2.5 flex-1 pb-2 min-w-0">
      <div className="w-24 h-4 bg-white/5 relative overflow-hidden rounded-lg"><Shimmer /></div>
      <div className="w-1/2 h-8 md:h-10 bg-white/5 relative overflow-hidden rounded-xl"><Shimmer /></div>
      <div className="w-1/3 h-4 bg-white/5 relative overflow-hidden rounded-lg"><Shimmer /></div>
    </div>
  </div>
);

const CardSkeleton = () => (
  <div className="min-w-[130px] sm:min-w-[150px] md:min-w-[170px] w-[130px] sm:w-[150px] md:w-[170px] flex flex-col gap-2.5 shrink-0">
    <div className="aspect-[3/4.4] bg-[#14141e] rounded-2xl border border-white/5 relative overflow-hidden"><Shimmer /></div>
    <div className="w-4/5 h-3 bg-white/5 rounded-md relative overflow-hidden"><Shimmer /></div>
  </div>
);

const ScrollButton = ({ direction, onClick }) => (
  <button
    onClick={onClick}
    className="w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center bg-white/[0.04] hover:bg-[#d4a73c] text-white/50 hover:text-[#0b0b10] border border-white/10 hover:border-[#d4a73c] transition-all shadow-md active:scale-95"
  >
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d={direction === 'left' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'} />
    </svg>
  </button>
);

const SectionHeading = ({ title, subtitle, onClick }) => (
  <div className="flex flex-col cursor-pointer group select-none" onClick={onClick}>
    <div className="flex items-center gap-2">
      <span className="w-1.5 h-5 rounded-full bg-gradient-to-b from-[#d4a73c] to-[#ff4e2d] shadow-sm shadow-[#d4a73c]/50"></span>
      <h2 className="text-lg md:text-xl font-display font-black text-white uppercase tracking-wide group-hover:text-[#d4a73c] transition-colors">
        {title}
      </h2>
      <svg className="w-4 h-4 text-white/30 group-hover:text-[#d4a73c] group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </div>
    <span className="text-[11px] text-white/40 pl-3.5 mt-0.5 font-medium">{subtitle}</span>
  </div>
);

const MangaCard = ({ m, onClick }) => {
  const [loaded, setLoaded] = useState(false);
  const ch = m.chapters && m.chapters[0];

  return (
    <div
      onClick={onClick}
      style={{ contentVisibility: 'auto', containIntrinsicSize: '150px 220px' }}
      className="group min-w-[130px] sm:min-w-[150px] md:min-w-[170px] w-[130px] sm:w-[150px] md:w-[170px] cursor-pointer snap-start transition-all duration-300 active:scale-95 flex flex-col gap-2 shrink-0 select-none contain-layout"
    >
      <div className="relative aspect-[3/4.4] w-full rounded-2xl overflow-hidden bg-[#15151e] border border-white/[0.08] shadow-md group-hover:shadow-2xl group-hover:shadow-[#d4a73c]/15 group-hover:border-[#d4a73c]/40 transition-all duration-300 transform-gpu">
        {m.badge === 'Hot' && (
          <span className="absolute top-2 right-2 z-10 bg-[#ff4e2d] text-[#0b0b10] text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wide shadow-md">
            HOT
          </span>
        )}
        {ch && (
          <span className="absolute bottom-2 left-2 z-10 bg-[#09090e]/85 backdrop-blur-md text-white text-[9px] font-bold px-2 py-0.5 rounded-md border border-white/10 shadow">
            Ch. {ch.chapterNum}
          </span>
        )}
        <img
          src={m.cover}
          referrerPolicy="no-referrer"
          alt={m.title}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          className={`w-full h-full object-cover group-hover:scale-105 transition-all duration-500 ease-out ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
        {/* Read Icon Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b10]/90 via-[#0b0b10]/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center pointer-events-none">
          <div className="w-10 h-10 md:w-11 md:h-11 rounded-full bg-[#d4a73c] text-[#0b0b10] flex items-center justify-center shadow-xl shadow-[#d4a73c]/50 transform scale-75 group-hover:scale-100 transition-transform duration-300">
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M4 4h16v2H4V4zm0 5h16v11H4V9zm2 2v7h12v-7H6z" />
            </svg>
          </div>
        </div>
      </div>
      <h3 className="text-xs md:text-[13px] font-bold text-white/80 group-hover:text-[#d4a73c] line-clamp-2 leading-snug transition-colors pt-0.5">
        {m.title}
      </h3>
    </div>
  );
};

const Komik = () => {
  const navigate = useNavigate();
  const [heroSlider, setHeroSlider] = useState(window.__NDICHAN_KOMIK_CACHE__?.heroSlider || []);
  const [popularToday, setPopularToday] = useState(window.__NDICHAN_KOMIK_CACHE__?.popularToday || []);
  const [latest, setLatest] = useState(window.__NDICHAN_KOMIK_CACHE__?.latest || []);
  const [latestProject, setLatestProject] = useState(window.__NDICHAN_KOMIK_CACHE__?.latestProject || []);
  const [heroIndex, setHeroIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(!window.__NDICHAN_KOMIK_CACHE__);
  const [copyToast, setCopyToast] = useState(false);

  const popularScrollRef = useRef(null);
  const latestScrollRef = useRef(null);

  useEffect(() => {
    setSeoMeta(
      'Baca Komik Manga, Manhwa & Manhua Sub Indo Gratis | Ndichan',
      'Baca ribuan komik Manga, Manhwa, dan Manhua online subtitle Indonesia terlengkap dan terupdate setiap hari gratis tanpa iklan kualitas HD di Ndichan.',
      '/img/welcomebanner.webp',
      `${SITE_URL}/komik`,
      {
        keywords: 'baca komik, komik sub indo, baca manga, baca manhwa, baca manhua, komik online gratis, ndichan komik',
        schema: {
          '@context': 'https://schema.org',
          '@graph': [
            getCollectionSchema({
              name: 'Baca Komik Online Sub Indo | Ndichan',
              description: 'Koleksi komik Manga, Manhwa, dan Manhua subtitle Indonesia terlengkap di Ndichan.',
              url: `${SITE_URL}/komik`
            }),
            getBreadcrumbSchema([
              { name: 'Home', url: '/' },
              { name: 'Komik', url: '/komik' }
            ])
          ]
        }
      }
    );
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (window.__NDICHAN_KOMIK_CACHE__) return;

    let isMounted = true;
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [heroRes, popRes, latestRes, projRes] = await Promise.all([
          fetch(MANGA_ENDPOINTS.heroSlider).then(r => r.json()),
          fetch(MANGA_ENDPOINTS.popularToday).then(r => r.json()),
          fetch(MANGA_ENDPOINTS.latest).then(r => r.json()),
          fetch(MANGA_ENDPOINTS.latestProject).then(r => r.json()),
        ]);

        if (!isMounted) return;
        setHeroSlider(heroRes.data || []);
        setPopularToday(popRes.data || []);
        setLatest(latestRes.data || []);
        setLatestProject(projRes.data || []);

        window.__NDICHAN_KOMIK_CACHE__ = {
          heroSlider: heroRes.data || [],
          popularToday: popRes.data || [],
          latest: latestRes.data || [],
          latestProject: projRes.data || [],
        };
      } catch (e) {
        // silent
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchData();
    return () => { isMounted = false; };
  }, []);

  // Auto rotate hero
  useEffect(() => {
    if (heroSlider.length <= 1) return;
    const timer = setInterval(() => {
      setHeroIndex(prev => (prev + 1) % heroSlider.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [heroSlider]);

  const scroll = (ref, dir) => {
    if (!ref.current) return;
    const offset = dir === 'left' ? -420 : 420;
    ref.current.scrollBy({ left: offset, behavior: 'smooth' });
  };

  const goToDetail = (m) => navigate(`/komik/${m.slug}`);

  const handleShare = (platform) => {
    const url = window.location.href;
    const text = 'Baca Komik Online Sub Indo di NdiChan';
    const encodedUrl = encodeURIComponent(url);
    const encodedText = encodeURIComponent(text);

    if (platform === 'copy') {
      navigator.clipboard.writeText(url);
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 2000);
    }
    if (platform === 'fb') window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, '_blank');
    if (platform === 'x') window.open(`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`, '_blank');
    if (platform === 'tg') window.open(`https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`, '_blank');
  };

  const currentHero = heroSlider[heroIndex];

  return (
    <div className="min-h-screen bg-[#09090d] font-nunito selection:bg-[#d4a73c] selection:text-black pb-28 text-white relative">
      <Navbar />

      {copyToast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-[#d4a73c] text-[#0b0b10] px-6 py-2.5 rounded-full font-black text-xs z-[999] shadow-2xl">
          Tautan berhasil disalin
        </div>
      )}

      {/* HERO BANNER */}
      <header className="relative w-full aspect-[16/10] md:aspect-[21/9] min-h-[380px] md:max-h-[560px] overflow-hidden bg-[#0a0a0f]">
        {isLoading || !currentHero ? (
          <HeroSkeleton />
        ) : (
          <div className="relative w-full h-full">
            {/* Backdrop image */}
            <img
              src={currentHero.cover}
              referrerPolicy="no-referrer"
              alt={currentHero.title}
              decoding="async"
              className="w-full h-full object-cover opacity-35 scale-105 blur-sm transition-all duration-1000"
            />
            {/* Gradients */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#09090d] via-[#09090d]/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#09090d] via-[#09090d]/40 to-transparent" />

            {/* Hero content */}
            <div className="absolute bottom-6 left-4 md:bottom-12 md:left-12 flex items-end gap-5 md:gap-8 z-10 max-w-7xl w-[calc(100%-32px)] md:w-[calc(100%-96px)] mx-auto">
              {/* Cover */}
              <div className="relative w-28 md:w-44 aspect-[3/4.4] rounded-2xl overflow-hidden shadow-2xl border border-white/10 shrink-0 hidden sm:block">
                <img
                  src={currentHero.cover}
                  referrerPolicy="no-referrer"
                  alt={currentHero.title}
                  decoding="async"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Text & CTAs */}
              <div className="flex flex-col flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {currentHero.badge && (
                    <span className="bg-[#d4a73c] text-[#0b0b10] text-[10px] font-black px-2.5 py-0.5 rounded-md uppercase tracking-wider shadow">
                      {currentHero.badge}
                    </span>
                  )}
                  {currentHero.genre && (
                    <span className="text-white/60 text-xs font-bold uppercase tracking-wider">
                      {currentHero.genre}
                    </span>
                  )}
                </div>

                <h1 className="font-display text-2xl md:text-5xl text-white font-black tracking-wide leading-tight line-clamp-2 mb-2">
                  {currentHero.title}
                </h1>

                {currentHero.summary && (
                  <p className="text-xs md:text-sm text-white/60 line-clamp-2 max-w-2xl leading-relaxed mb-4">
                    {currentHero.summary}
                  </p>
                )}

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => goToDetail(currentHero)}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#d4a73c] to-[#ff4e2d] text-[#0b0b10] font-black text-xs md:text-sm flex items-center gap-2 shadow-lg shadow-[#d4a73c]/30 hover:brightness-110 active:scale-95 transition-all"
                  >
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M4 4h16v2H4V4zm0 5h16v11H4V9zm2 2v7h12v-7H6z" />
                    </svg>
                    <span>Baca Sekarang</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Slide counter pill */}
            <div className="absolute bottom-6 right-6 md:bottom-12 md:right-12 hidden sm:flex items-center gap-2 z-20 bg-black/40 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10">
              <span className="text-xs font-black text-white">
                {heroIndex + 1} / {heroSlider.length}
              </span>
              <button
                onClick={() => setHeroIndex(prev => (prev + 1) % heroSlider.length)}
                className="text-white/60 hover:text-[#d4a73c] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* QUICK ACCESS BUTTONS */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 mt-8">
        <div className="flex gap-2.5 overflow-x-auto custom-scrollbar pb-2">
          <button
            onClick={() => navigate('/komik/all')}
            className="shrink-0 px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/15 border border-white/10 text-white font-bold text-xs uppercase tracking-wider transition-all active:scale-95"
          >
            Semua Komik
          </button>
          <button
            onClick={() => navigate('/komik/populer')}
            className="shrink-0 px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white/70 hover:text-white font-bold text-xs uppercase tracking-wider transition-all active:scale-95"
          >
            Populer
          </button>
          <button
            onClick={() => navigate('/komik/latest')}
            className="shrink-0 px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white/70 hover:text-white font-bold text-xs uppercase tracking-wider transition-all active:scale-95"
          >
            Rilis Terbaru
          </button>
        </div>
      </section>

      {/* POPULAR TODAY */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 mt-12">
        <div className="flex items-center justify-between mb-4">
          <SectionHeading
            title="Populer Hari Ini"
            subtitle="Paling banyak dibaca oleh wibu hari ini"
            onClick={() => navigate('/komik/populer')}
          />
          <div className="flex gap-2">
            <ScrollButton direction="left" onClick={() => scroll(popularScrollRef, 'left')} />
            <ScrollButton direction="right" onClick={() => scroll(popularScrollRef, 'right')} />
          </div>
        </div>
        <div ref={popularScrollRef} className="flex overflow-x-auto gap-3.5 sm:gap-4 md:gap-5 pb-4 custom-scrollbar snap-x">
          {isLoading ? (
            [...Array(8)].map((_, i) => <CardSkeleton key={i} />)
          ) : (
            popularToday.map((m) => (
              <MangaCard key={m.slug} m={m} onClick={() => goToDetail(m)} />
            ))
          )}
        </div>
      </section>

      {/* LATEST RELEASES */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 mt-12">
        <div className="flex items-center justify-between mb-4">
          <SectionHeading
            title="Rilisan Terbaru"
            subtitle="Chapter komik yang baru saja diupdate"
            onClick={() => navigate('/komik/latest')}
          />
          <div className="flex gap-2">
            <ScrollButton direction="left" onClick={() => scroll(latestScrollRef, 'left')} />
            <ScrollButton direction="right" onClick={() => scroll(latestScrollRef, 'right')} />
          </div>
        </div>
        <div ref={latestScrollRef} className="flex overflow-x-auto gap-3.5 sm:gap-4 md:gap-5 pb-4 custom-scrollbar snap-x">
          {isLoading ? (
            [...Array(8)].map((_, i) => <CardSkeleton key={i} />)
          ) : (
            latest.map((m) => (
              <MangaCard key={m.slug} m={m} onClick={() => goToDetail(m)} />
            ))
          )}
        </div>
      </section>

      {/* PROJECT PILIHAN (Top 10 Ranked) */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 mt-12">
        <div className="flex items-center gap-2 mb-6">
          <span className="w-1.5 h-6 rounded-full bg-gradient-to-b from-[#d4a73c] to-[#ff4e2d] shadow-sm shadow-[#d4a73c]/50"></span>
          <div>
            <h2 className="text-xl md:text-2xl font-display font-black text-white uppercase tracking-wide">
              Project Pilihan
            </h2>
            <p className="text-xs text-white/40 font-medium">Komik unggulan rekomendasi tim NdiChan</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading
            ? [...Array(6)].map((_, i) => (
                <div key={i} className="h-24 bg-[#12121a] rounded-2xl border border-white/5 relative overflow-hidden">
                  <Shimmer />
                </div>
              ))
            : latestProject.slice(0, 9).map((m, index) => (
                <div
                  key={m.slug || index}
                  onClick={() => goToDetail(m)}
                  style={{ contentVisibility: 'auto', containIntrinsicSize: '96px' }}
                  className="group cursor-pointer relative h-24 rounded-2xl bg-[#12121a]/90 hover:bg-[#161624] border border-white/[0.08] hover:border-[#d4a73c]/40 p-3.5 flex items-center gap-3.5 overflow-hidden transition-all duration-300 shadow-md hover:shadow-xl hover:shadow-[#d4a73c]/10 active:scale-98 contain-layout transform-gpu"
                >
                  {/* Backdrop artwork */}
                  <div className="absolute right-0 top-0 bottom-0 w-1/2 pointer-events-none">
                    <div className="absolute inset-0 bg-gradient-to-r from-[#12121a] via-[#12121a]/85 to-transparent z-10" />
                    <img
                      src={m.cover}
                      referrerPolicy="no-referrer"
                      alt={m.title}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover opacity-40 group-hover:opacity-75 transition-opacity"
                    />
                  </div>

                  {/* Rank badge */}
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 shadow-md ${
                      index === 0
                        ? 'bg-gradient-to-br from-[#ffd700] to-[#b8860b] text-[#0b0b10] shadow-[#ffd700]/30'
                        : index === 1
                        ? 'bg-gradient-to-br from-[#e0e0e0] to-[#9e9e9e] text-[#0b0b10]'
                        : index === 2
                        ? 'bg-gradient-to-br from-[#cd7f32] to-[#8b4513] text-white'
                        : 'bg-white/5 text-white/40 border border-white/10'
                    }`}
                  >
                    #{index + 1}
                  </div>

                  {/* Info */}
                  <div className="flex flex-col min-w-0 z-20 pr-4">
                    <h3 className="text-white font-bold text-sm truncate group-hover:text-[#d4a73c] transition-colors">
                      {m.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      {m.rating && (
                        <span className="text-xs font-bold text-[#d4a73c] flex items-center gap-1">
                          <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                          <span>{m.rating}</span>
                        </span>
                      )}
                      {m.chapters && m.chapters[0] && (
                        <span className="text-[11px] font-bold text-white/50">
                          Ch. {m.chapters[0].chapterNum}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
        </div>
      </section>

      {/* SHARE BANNER */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 mt-14">
        <div className="relative bg-gradient-to-r from-[#12121a] via-[#181824] to-[#12121a] p-6 md:p-8 rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-2 bg-[#d4a73c]/15 text-[#d4a73c] text-[10px] font-black px-2.5 py-0.5 rounded-full border border-[#d4a73c]/20 uppercase tracking-wider mb-2">
                Bagikan Komik
              </div>
              <h3 className="font-display text-white text-lg md:text-xl font-bold">
                Ajak Teman Wibumu Membaca Bareng
              </h3>
              <p className="text-white/50 text-xs mt-1">
                Share NdiChan ke media sosial agar komunitas kita semakin ramai!
              </p>
            </div>
            <div className="flex gap-2.5 flex-wrap">
              <button
                onClick={() => handleShare('copy')}
                className="px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-[#d4a73c] hover:text-[#0b0b10] border border-white/10 hover:border-[#d4a73c] text-white font-bold text-xs flex items-center gap-2 transition-all shadow-sm"
              >
                Salin Tautan
              </button>
              <button
                onClick={() => handleShare('tg')}
                className="px-4 py-2 rounded-xl bg-[#229ED9]/20 hover:bg-[#229ED9] text-white border border-[#229ED9]/30 font-bold text-xs transition-all shadow-sm"
              >
                Telegram
              </button>
              <button
                onClick={() => handleShare('x')}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white text-white hover:text-black border border-white/20 font-bold text-xs transition-all shadow-sm"
              >
                Twitter / X
              </button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Komik;
