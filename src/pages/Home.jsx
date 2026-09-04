import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ForYou from '../components/ForYou';
import BirthdayBanner from '../components/BirthdayBanner';
import { Shimmer, CardSkeleton, ScrollButton, SectionHeading, AnimeCard } from '../components/SectionUI';
import { setSeoMeta, SITE_URL, getBreadcrumbSchema, getCollectionSchema } from '../utils/seo';

const HeroSkeleton = () => (
  <div className="w-full h-full min-h-[380px] md:min-h-[520px] bg-[#12121a] relative overflow-hidden flex items-end p-6 md:p-14 gap-6">
    <Shimmer />
    <div className="w-28 md:w-44 aspect-[3/4.4] bg-white/5 relative overflow-hidden rounded-2xl shrink-0 hidden sm:block">
      <Shimmer />
    </div>
    <div className="flex flex-col gap-3 flex-1 pb-2 min-w-0">
      <div className="w-24 h-4 bg-white/5 rounded-full relative overflow-hidden"><Shimmer /></div>
      <div className="w-3/4 md:w-1/2 h-8 md:h-12 bg-white/5 rounded-lg relative overflow-hidden"><Shimmer /></div>
      <div className="w-full md:w-2/3 h-4 bg-white/5 rounded relative overflow-hidden"><Shimmer /></div>
      <div className="w-36 h-10 bg-white/10 rounded-xl mt-2 relative overflow-hidden"><Shimmer /></div>
    </div>
  </div>
);

const Home = () => {
  const navigate = useNavigate();
  const [schedule, setSchedule] = useState(window.__NDICHAN_CACHE__?.schedule || {});
  const [ongoing, setOngoing] = useState(window.__NDICHAN_CACHE__?.ongoing || []);
  const [popular, setPopular] = useState(window.__NDICHAN_CACHE__?.popular || []);
  const [newAnime, setNewAnime] = useState(window.__NDICHAN_CACHE__?.newAnime || []);
  const [heroIndex, setHeroIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(true);
  const [isLoading, setIsLoading] = useState(!window.__NDICHAN_CACHE__);
  const [copyToast, setCopyToast] = useState(false);

  const ongoingScrollRef = useRef(null);
  const todayScrollRef = useRef(null);
  const newScrollRef = useRef(null);

  const shuffleArray = (array) => {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
  };

  useEffect(() => {
    setSeoMeta(
      'Nonton Anime Sub Indo Terlengkap & Update Harian | Ndichan',
      'Nonton anime subtitle Indonesia terlengkap dan update setiap hari gratis tanpa iklan. Streaming anime ongoing, populer, dan terbaru kualitas HD di Ndichan.',
      '/img/welcomebanner.webp',
      `${SITE_URL}/home`,
      {
        keywords: 'nonton anime, anime sub indo, streaming anime, anime ongoing, anime terbaru, anime populer, nonton anime online, ndichan',
        schema: {
          '@context': 'https://schema.org',
          '@graph': [
            getCollectionSchema({
              name: 'Nonton Anime Sub Indo Terlengkap | Ndichan',
              description: 'Daftar anime ongoing, populer, dan terbaru subtitle Indonesia gratis di Ndichan.',
              url: `${SITE_URL}/home`
            }),
            getBreadcrumbSchema([
              { name: 'Home', url: '/' },
              { name: 'Anime', url: '/home' }
            ])
          ]
        }
      }
    );
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (window.__NDICHAN_CACHE__) return;

    let isMounted = true;
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [schRes, ongRes, popRes, newRes] = await Promise.all([
          fetch('/ndikagantengtobrutbanget/v1/schedule').then(r => r.json()),
          fetch('/ndikagantengtobrutbanget/v1/ongoing').then(r => r.json()),
          fetch('/ndikagantengtobrutbanget/v1/popular').then(r => r.json()),
          fetch('/ndikagantengtobrutbanget/v1/new').then(r => r.json())
        ]);
        if (!isMounted) return;

        const schData = schRes.data || {};
        const ongData = ongRes.data || [];
        const popData = popRes.data || [];
        const newData = newRes.data || [];

        const shuffledOngoing = shuffleArray(ongData);

        setSchedule(schData);
        setOngoing(shuffledOngoing);
        setPopular(popData);
        setNewAnime(newData);
        window.__NDICHAN_CACHE__ = { schedule: schData, ongoing: shuffledOngoing, popular: popData, newAnime: newData };
      } catch (e) {
        // silent fail
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchData();
    return () => { isMounted = false; };
  }, []);

  const days = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
  const todayAnime = (schedule[days[new Date().getDay()]] || []).filter(a => a.status === 'ONGOING');
  const carouselItems = todayAnime.length > 0 ? [...todayAnime, todayAnime[0]] : [];

  useEffect(() => {
    if (todayAnime.length > 0) {
      const itv = setInterval(() => setHeroIndex(p => p + 1), 6000);
      return () => clearInterval(itv);
    }
  }, [todayAnime]);

  useEffect(() => {
    if (todayAnime.length > 0 && heroIndex === todayAnime.length) {
      const tm = setTimeout(() => {
        setIsTransitioning(false);
        setHeroIndex(0);
      }, 750);
      return () => clearTimeout(tm);
    }
  }, [heroIndex, todayAnime.length]);

  useEffect(() => {
    if (!isTransitioning && heroIndex === 0) {
      const tm = setTimeout(() => {
        setIsTransitioning(true);
      }, 50);
      return () => clearTimeout(tm);
    }
  }, [isTransitioning, heroIndex]);

  const scroll = (ref, direction) => {
    if (ref.current) {
      const scrollAmount = Math.min(window.innerWidth * 0.75, 420);
      ref.current.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    }
  };

  const handleShare = async (platform) => {
    const url = window.location.href;
    const text = 'Ajak temanmu nonton anime favorit bareng di NdiChan, gratis dan tanpa iklan.';
    const encodedText = encodeURIComponent(text);

    if (platform === 'api') {
      if (navigator.share) {
        try { await navigator.share({ title: 'NdiChan', text, url }); } catch (e) {}
      }
      return;
    }

    if (platform === 'copy') {
      try {
        await navigator.clipboard.writeText(`${text}\n\n${url}`);
        setCopyToast(true);
        setTimeout(() => setCopyToast(false), 2000);
      } catch (e) {}
      return;
    }
    const encodedUrl = encodeURIComponent(url);
    if (platform === 'fb') window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, '_blank');
    if (platform === 'x') window.open(`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`, '_blank');
    if (platform === 'tg') window.open(`https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`, '_blank');
  };

  const getSlugUrl = (anime) => {
    return `/anime/${anime.id}-${(anime.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  };

  return (
    <div className="min-h-screen bg-[#09090d] selection:bg-[#d4a73c] selection:text-black pb-28 text-white relative">
      {copyToast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-[#d4a73c] text-[#0b0b10] px-6 py-3 rounded-xl font-black text-sm z-[999] shadow-2xl animate-[slideDown_0.2s_ease-out]">
          Tautan berhasil disalin ke clipboard!
        </div>
      )}

      <Navbar />
      <BirthdayBanner />

      {/* ===== HERO CAROUSEL SECTION ===== */}
      <header className="relative w-full h-[460px] sm:h-[520px] md:h-[600px] lg:h-[660px] overflow-hidden bg-[#0a0a0f]">
        {isLoading ? <HeroSkeleton /> : (
          <div
            className={`flex h-full ${isTransitioning ? 'transition-transform duration-700 cubic-bezier(0.16, 1, 0.3, 1)' : ''}`}
            style={{ transform: `translate3d(-${heroIndex * 100}%, 0, 0)` }}
          >
            {carouselItems.map((a, i) => (
              <div key={i} className="min-w-full h-full relative flex items-end">
                {/* Background Artwork */}
                <div className="absolute inset-0 z-0">
                  <img
                    src={`https://cfelainawanggy.pages.dev/?action=proxy&url=${encodeURIComponent(a.image_cover || a.image_poster)}`}
                    referrerPolicy="no-referrer"
                    alt={a.title}
                    className="w-full h-full object-cover object-center filter brightness-90 md:brightness-95"
                  />
                  {/* Subtle ambient tint */}
                  <div className="absolute inset-0 bg-gradient-to-r from-[#09090d] via-[#09090d]/80 md:via-[#09090d]/50 to-transparent z-10" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#09090d] via-[#09090d]/60 to-transparent z-10" />
                  <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#09090d] to-transparent z-10" />
                </div>

                {/* Content Overlay */}
                <div className="relative z-20 w-full max-w-7xl mx-auto px-6 md:px-12 pb-10 md:pb-16 flex items-end gap-6 md:gap-8">
                  {/* Poster Thumbnail (Tablet & Desktop) */}
                  <div className="w-32 md:w-44 aspect-[3/4.4] rounded-2xl overflow-hidden shadow-2xl border border-white/15 shrink-0 hidden sm:block relative group">
                    <img
                      src={`https://cfelainawanggy.pages.dev/?action=proxy&url=${encodeURIComponent(a.image_poster || a.image_cover)}`}
                      referrerPolicy="no-referrer"
                      alt={a.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                  </div>

                  {/* Text Details */}
                  <div className="flex flex-col text-left max-w-2xl min-w-0">
                    {/* Badge Chips */}
                    <div className="flex items-center flex-wrap gap-2 mb-2.5">
                      <span className="bg-[#d4a73c] text-[#0b0b10] text-[10px] md:text-xs font-black px-2 py-0.5 rounded-md uppercase tracking-wider shadow-sm">
                        ONGOING
                      </span>
                      <span className="bg-white/10 backdrop-blur-md text-white/90 text-[10px] md:text-xs font-bold px-2 py-0.5 rounded-md border border-white/10">
                        HD 1080p
                      </span>
                      <span className="bg-white/10 backdrop-blur-md text-white/80 text-[10px] md:text-xs font-bold px-2 py-0.5 rounded-md border border-white/10">
                        Sub Indo
                      </span>
                    </div>

                    {/* Anime Title */}
                    <h1 className="font-display text-2xl sm:text-4xl md:text-5xl text-white tracking-wide leading-tight line-clamp-2 drop-shadow-md">
                      {a.title}
                    </h1>

                    {/* Synopsis */}
                    <p className="text-xs md:text-sm text-white/60 line-clamp-2 md:line-clamp-3 mt-2 leading-relaxed max-w-xl">
                      {a.synopsis || 'Nonton streaming anime subtitle Indonesia gratis kualitas terbaik update setiap hari hanya di NdiChan.'}
                    </p>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-3 mt-4 md:mt-6">
                      <button
                        onClick={() => navigate(getSlugUrl(a))}
                        className="h-10 md:h-12 px-6 md:px-8 rounded-xl bg-gradient-to-r from-[#d4a73c] to-[#ff4e2d] text-[#0b0b10] font-black text-xs md:text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#d4a73c]/25 hover:brightness-110 active:scale-95 transition-all"
                      >
                        <svg className="w-4 h-4 md:w-5 md:h-5 fill-current" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                        <span>Tonton Sekarang</span>
                      </button>

                      <button
                        onClick={() => navigate(getSlugUrl(a))}
                        className="h-10 md:h-12 px-5 md:px-6 rounded-xl bg-white/10 hover:bg-white/15 backdrop-blur-md text-white font-bold text-xs md:text-sm border border-white/15 flex items-center justify-center gap-2 transition-colors"
                      >
                        <svg className="w-4 h-4 text-white/70" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Detail</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Carousel Slide Indicators */}
        {!isLoading && todayAnime.length > 0 && (
          <div className="absolute bottom-6 right-6 md:bottom-12 md:right-12 flex items-center gap-3 z-30 bg-black/50 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10 shadow-lg">
            <span className="text-[11px] font-mono font-bold text-[#d4a73c]">
              {String((heroIndex % todayAnime.length) + 1).padStart(2, '0')}
            </span>
            <span className="text-white/30 text-xs">/</span>
            <span className="text-[11px] font-mono font-bold text-white/60">
              {String(todayAnime.length).padStart(2, '0')}
            </span>
            <div className="w-px h-3 bg-white/20" />
            <button
              onClick={() => { if (isTransitioning && heroIndex < todayAnime.length) setHeroIndex(p => p + 1); }}
              aria-label="Slide berikutnya"
              className="text-white/80 hover:text-[#d4a73c] transition-colors p-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </header>

      {/* ===== SHARE BANNER ===== */}
      <section className="max-w-7xl mx-auto px-6 mt-8 md:mt-10">
        <div className="relative glass-panel rounded-2xl p-6 md:p-8 overflow-hidden shadow-xl">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div>
              <div className="mb-1">
                <h3 className="font-display text-white text-lg md:text-xl tracking-wide uppercase">
                  Ajak Teman Nonton Bareng
                </h3>
              </div>
              <p className="text-white/50 text-xs md:text-sm font-medium">
                Nikmati ribuan judul anime gratis tanpa iklan bersama komunitas pecinta anime Ndichan.
              </p>
            </div>
            <div className="flex gap-2.5 flex-wrap">
              <button
                onClick={() => handleShare('copy')}
                className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white font-bold text-xs flex items-center gap-2 transition-all hover:border-[#d4a73c]/50 hover:text-[#d4a73c]"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>Salin Link</span>
              </button>
              <button
                onClick={() => handleShare('tg')}
                className="px-4 py-2.5 rounded-xl bg-[#229ED9]/15 hover:bg-[#229ED9]/25 border border-[#229ED9]/30 text-[#229ED9] font-bold text-xs flex items-center gap-2 transition-colors"
              >
                Telegram
              </button>
              <button
                onClick={() => handleShare('x')}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-white font-bold text-xs flex items-center gap-2 transition-colors"
              >
                X (Twitter)
              </button>
              <button
                onClick={() => handleShare('api')}
                className="px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 font-bold text-xs flex items-center gap-1.5 transition-colors"
              >
                Lainnya
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FOR YOU / LANJUTKAN NONTON ===== */}
      <ForYou ongoingPool={ongoing} popularPool={popular} isLoading={isLoading} />

      {/* ===== INTERACTIVE MOOD PICKER & ROULETTE BANNER ===== */}
      <section className="max-w-7xl mx-auto px-6 mt-8 md:mt-12">
        <div className="bg-gradient-to-r from-[#181826] via-[#14141f] to-[#12121c] border border-white/10 rounded-2xl p-5 md:p-6 flex flex-col md:flex-row items-center justify-between gap-5 shadow-2xl relative overflow-hidden">
          <div className="flex items-center gap-4 z-10 text-center md:text-left">
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-tr from-[#38bdf8] via-[#d4a73c] to-[#ff4e2d] flex items-center justify-center text-[#0b0b10] shrink-0 font-black shadow-lg shadow-[#d4a73c]/20">
              <svg className="w-6 h-6 md:w-7 md:h-7" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2 justify-center md:justify-start">
                <h3 className="text-white font-black text-sm md:text-lg">Bingung Mau Nonton Apa Hari Ini?</h3>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[9px] font-black uppercase tracking-wider">FITUR</span>
              </div>
              <p className="text-white/50 text-xs md:text-sm mt-0.5">Pilih anime sesuai suasana hati atau coba keberuntunganmu lewat Lucky Roulette!</p>
            </div>
          </div>

          <div className="flex items-center gap-3 z-10 w-full md:w-auto">
            <button
              onClick={() => navigate('/mood?tab=mood')}
              className="flex-1 md:flex-none px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs md:text-sm border border-white/10 transition-colors"
            >
              Mood Picker
            </button>
            <button
              onClick={() => navigate('/mood?tab=roulette')}
              className="flex-1 md:flex-none px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#d4a73c] to-[#ff4e2d] text-[#0b0b10] font-black text-xs md:text-sm hover:brightness-110 active:scale-95 transition-all shadow-md shadow-[#d4a73c]/25"
            >
              Putar Roulette
            </button>
          </div>
        </div>
      </section>

      {/* ===== ONGOING ROW ===== */}
      <section className="max-w-7xl mx-auto px-6 mt-12 md:mt-14">
        <div className="flex items-center justify-between mb-4 px-1">
          <SectionHeading title="Anime Ongoing" subtitle="Sedang tayang pekan ini" onClick={() => navigate('/ongoing')} />
          <div className="flex gap-2">
            <ScrollButton direction="left" onClick={() => scroll(ongoingScrollRef, 'left')} />
            <ScrollButton direction="right" onClick={() => scroll(ongoingScrollRef, 'right')} />
          </div>
        </div>
        <div ref={ongoingScrollRef} className="flex overflow-x-auto gap-3.5 md:gap-4 pb-4 custom-scrollbar snap-x px-1">
          {isLoading ? [...Array(8)].map((_, i) => <CardSkeleton key={i} />) :
            ongoing.map((a, i) => (
              <AnimeCard
                key={a.id || i}
                anime={a}
                onClick={() => navigate(getSlugUrl(a))}
                badgeText={a.type || 'ONGOING'}
              />
            ))
          }
        </div>
      </section>

      {/* ===== TODAY ROW ===== */}
      <section className="max-w-7xl mx-auto px-6 mt-10 md:mt-14">
        <div className="flex items-center justify-between mb-4 px-1">
          <SectionHeading title="Jadwal Hari Ini" subtitle={`Update episode hari ${days[new Date().getDay()]}`} onClick={() => navigate('/schedule')} />
          <div className="flex gap-2">
            <ScrollButton direction="left" onClick={() => scroll(todayScrollRef, 'left')} />
            <ScrollButton direction="right" onClick={() => scroll(todayScrollRef, 'right')} />
          </div>
        </div>
        <div ref={todayScrollRef} className="flex overflow-x-auto gap-3.5 md:gap-4 pb-4 custom-scrollbar snap-x px-1">
          {isLoading ? [...Array(8)].map((_, i) => <CardSkeleton key={i} />) :
            todayAnime.map((a, i) => (
              <AnimeCard
                key={a.id || i}
                anime={a}
                onClick={() => navigate(getSlugUrl(a))}
                badgeText="HARI INI"
              />
            ))
          }
        </div>
      </section>

      {/* ===== NEW RELEASES ROW ===== */}
      <section className="max-w-7xl mx-auto px-6 mt-10 md:mt-14">
        <div className="flex items-center justify-between mb-4 px-1">
          <SectionHeading title="Anime Terbaru" subtitle="Judul baru ditambahkan ke katalog" onClick={() => navigate('/new')} />
          <div className="flex gap-2">
            <ScrollButton direction="left" onClick={() => scroll(newScrollRef, 'left')} />
            <ScrollButton direction="right" onClick={() => scroll(newScrollRef, 'right')} />
          </div>
        </div>
        <div ref={newScrollRef} className="flex overflow-x-auto gap-3.5 md:gap-4 pb-4 custom-scrollbar snap-x px-1">
          {isLoading ? [...Array(8)].map((_, i) => <CardSkeleton key={i} />) :
            newAnime.map((a, i) => (
              <AnimeCard
                key={a.id || i}
                anime={a}
                onClick={() => navigate(getSlugUrl(a))}
                badgeText="BARU"
              />
            ))
          }
        </div>
      </section>

      {/* ===== TOP 10 LEADERBOARD ===== */}
      <section className="max-w-7xl mx-auto px-6 mt-12 md:mt-16">
        <div className="flex flex-col mb-6 px-1">
          <div className="flex items-center gap-2.5">
            <span className="w-1.5 h-6 rounded-full bg-gradient-to-b from-[#d4a73c] to-[#ff4e2d] shadow-sm shadow-[#d4a73c]/50"></span>
            <h2 className="font-display text-2xl md:text-3xl text-white uppercase tracking-wide">Top 10 Anime Terpopuler</h2>
          </div>
          <span className="text-xs text-white/40 mt-1 pl-4 font-medium">Anime paling banyak ditonton sepanjang waktu</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-1">
          {isLoading ? [...Array(10)].map((_, i) => (
            <div key={i} className="h-24 bg-[#14141c] rounded-2xl border border-white/5 relative overflow-hidden"><Shimmer /></div>
          )) :
            popular.slice(0, 10).map((anime, index) => {
              const isTop3 = index < 3;
              const rankColor = index === 0
                ? 'from-[#f59e0b] to-[#d97706] text-[#0b0b10]'
                : index === 1
                ? 'from-[#cbd5e1] to-[#94a3b8] text-[#0b0b10]'
                : index === 2
                ? 'from-[#ea580c] to-[#c2410c] text-[#0b0b10]'
                : 'bg-white/10 text-white/60 border border-white/10';

              return (
                <div
                  key={anime.id || index}
                  onClick={() => navigate(getSlugUrl(anime))}
                  className="group cursor-pointer relative h-24 md:h-28 rounded-2xl bg-[#14141e] border border-white/[0.07] hover:border-[#d4a73c]/40 p-4 flex items-center gap-4 overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-[#d4a73c]/10 active:scale-98"
                >
                  {/* Backdrop Artwork */}
                  <div className="absolute right-0 top-0 bottom-0 w-2/5 pointer-events-none overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-[#14141e] via-[#14141e]/80 to-transparent z-10" />
                    <img
                      src={`https://cfelainawanggy.pages.dev/?action=proxy&url=${encodeURIComponent(anime.image_cover || anime.image_poster)}`}
                      referrerPolicy="no-referrer"
                      alt={anime.title}
                      className="w-full h-full object-cover opacity-35 group-hover:opacity-60 group-hover:scale-105 transition-all duration-500"
                    />
                  </div>

                  {/* Rank Badge */}
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center font-black text-sm md:text-base shrink-0 shadow-md ${isTop3 ? `bg-gradient-to-br ${rankColor}` : rankColor}`}>
                    #{index + 1}
                  </div>

                  {/* Poster Thumbnail */}
                  <div className="w-12 md:w-14 aspect-[3/4.2] rounded-lg overflow-hidden shrink-0 border border-white/10 shadow relative z-20">
                    <img
                      src={`https://cfelainawanggy.pages.dev/?action=proxy&url=${encodeURIComponent(anime.image_poster || anime.image_cover)}`}
                      referrerPolicy="no-referrer"
                      alt={anime.title}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Info */}
                  <div className="flex flex-col min-w-0 z-20 flex-1">
                    <h3 className="text-white font-bold text-sm md:text-base line-clamp-1 group-hover:text-[#d4a73c] transition-colors">
                      {anime.title}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-white/40 mt-1 font-medium">
                      <span>{anime.type || 'TV Series'}</span>
                      <span>&middot;</span>
                      <span className="text-[#d4a73c] font-bold">Sub Indo</span>
                    </div>
                  </div>
                </div>
              );
            })
          }
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Home;
