import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { MOOD_CATEGORIES, ROULETTE_POOL } from '../utils/moodData';
import { setSeoMeta, SITE_URL } from '../utils/seo';
import {
  HeartCrack,
  Coffee,
  Zap,
  Smile,
  Brain,
  Heart,
  Dices,
  Sparkles,
  Play,
  Star,
  RotateCcw,
  ArrowRight,
  Compass,
  Flame,
  Search,
  CheckCircle2,
  Tv,
  Film
} from 'lucide-react';

const ICON_COMPONENTS = {
  HeartCrack,
  Coffee,
  Zap,
  Smile,
  Brain,
  Heart
};

const MoodPicker = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'roulette' ? 'roulette' : 'mood';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [selectedMoodId, setSelectedMoodId] = useState(MOOD_CATEGORIES[0].id);

  // Roulette States
  const [isSpinning, setIsSpinning] = useState(false);
  const [rouletteFilter, setRouletteFilter] = useState('all');
  const [reel1Item, setReel1Item] = useState(ROULETTE_POOL[0]);
  const [reel2Text, setReel2Text] = useState(ROULETTE_POOL[0].moodTitle);
  const [reel3Score, setReel3Score] = useState(ROULETTE_POOL[0].score);
  const [winnerAnime, setWinnerAnime] = useState(null);
  const spinIntervalRef = useRef(null);
  const audioCtxRef = useRef(null);

  // Helper untuk mendapatkan / mengaktifkan AudioContext singleton
  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtxRef.current = new AudioContextClass();
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
    return audioCtxRef.current;
  };

  useEffect(() => {
    return () => {
      if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    setSeoMeta(
      'Anime Mood Picker & Roulette - Pilih Tontonan Sesuai Suasana Hatimu | Ndichan',
      'Bingung mau nonton apa? Pilih anime berdasarkan perasaanmu (Nangis, Santai, Hype, Komedi, Plot Twist, Romansa) atau putar Anime Roulette Slot Machine!',
      '/img/welcomebanner.webp',
      `${SITE_URL}/mood`
    );
  }, []);

  const currentMood = MOOD_CATEGORIES.find((m) => m.id === selectedMoodId) || MOOD_CATEGORIES[0];
  const CurrentMoodIcon = ICON_COMPONENTS[currentMood.iconName] || Sparkles;

  // Handler Ganti Tab
  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey);
    setSearchParams({ tab: tabKey });
  };

  const [navigatingAnimeId, setNavigatingAnimeId] = useState(null);

  // Navigasi sinkron ke Halaman Nonton menggunakan API Streaming Ndika-Nime
  const handleWatchAnime = async (anime) => {
    if (!anime) return;
    const animeKey = anime.id || anime.title;
    setNavigatingAnimeId(animeKey);

    try {
      // 1. Ambil kata kunci pencarian yang paling bersih & akurat
      const cleanQuery = anime.searchQuery || anime.title.split('(')[0].replace(/season \d+/i, '').trim() || anime.title;
      
      // 2. Cari di database video streaming Ndika-Nime
      const res = await fetch(`/ndikagantengtobrutbanget/v1/search?q=${encodeURIComponent(cleanQuery)}`).then((r) => r.json());

      if (res && res.status && Array.isArray(res.data) && res.data.length > 0) {
        const match = res.data[0];
        const matchSlug = `${match.id}-${(match.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        navigate(`/anime/${matchSlug}/1`);
      } else {
        // Jika tidak langsung ada di endpoint search, arahkan ke Explore
        navigate(`/explore?type=anime&q=${encodeURIComponent(cleanQuery)}`);
      }
    } catch (e) {
      console.error('Error finding anime streaming match:', e);
      const fallbackQuery = anime.searchQuery || anime.title.split('(')[0].trim() || anime.title;
      navigate(`/explore?type=anime&q=${encodeURIComponent(fallbackQuery)}`);
    } finally {
      setNavigatingAnimeId(null);
    }
  };

  // Play Sound Synthesizer Effect (Reusable Singleton AudioContext)
  const playBeep = (freq = 440, type = 'sine', duration = 0.08) => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch {}
  };

  // Putar Roulette / Slot Machine
  const handleSpinRoulette = () => {
    if (isSpinning) return;

    // Pastikan audio context aktif saat tombol ditekan
    getAudioContext();

    setIsSpinning(true);
    setWinnerAnime(null);

    // Filter pool jika user memilih mood tertentu
    const pool =
      rouletteFilter === 'all'
        ? ROULETTE_POOL
        : ROULETTE_POOL.filter((a) => a.moodId === rouletteFilter);

    const activePool = pool.length > 0 ? pool : ROULETTE_POOL;

    let counter = 0;
    const totalSpins = 28; // Total tik putaran

    if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);

    spinIntervalRef.current = setInterval(() => {
      counter++;
      const randomIdx = Math.floor(Math.random() * activePool.length);
      const tempItem = activePool[randomIdx];

      setReel1Item(tempItem);
      setReel2Text(tempItem.moodTitle);
      setReel3Score(tempItem.score);

      playBeep(350 + counter * 15, 'triangle', 0.05);

      if (counter >= totalSpins) {
        clearInterval(spinIntervalRef.current);
        const finalWinner = activePool[Math.floor(Math.random() * activePool.length)];
        setReel1Item(finalWinner);
        setReel2Text(finalWinner.moodTitle);
        setReel3Score(finalWinner.score);
        setWinnerAnime(finalWinner);
        setIsSpinning(false);

        // Sound Win Fanfare
        setTimeout(() => playBeep(523.25, 'sine', 0.15), 50);
        setTimeout(() => playBeep(659.25, 'sine', 0.15), 180);
        setTimeout(() => playBeep(783.99, 'sine', 0.3), 320);
      }
    }, 85);
  };

  return (
    <div className="min-h-screen bg-[#0b0b10] text-white flex flex-col justify-between pt-24 pb-12">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 w-full flex-1">
        {/* Header Hero Banner */}
        <div className="bg-gradient-to-br from-[#161622] via-[#101018] to-[#09090e] border border-white/10 rounded-3xl p-6 md:p-10 mb-8 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#d4a73c]/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-[#ff4e2d]/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6">
            <div className="flex-1 text-center lg:text-left space-y-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-gradient-to-r from-[#d4a73c]/20 to-[#ff4e2d]/20 border border-[#d4a73c]/30 text-amber-300 text-xs font-black uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-[#d4a73c]" />
                REKOMENDASI ANIME PINTAR • MOOD & ROULETTE
              </div>

              <h1 className="font-display text-3xl md:text-5xl text-white font-black leading-tight tracking-wide">
                LAGI PENGEN NONTON APA? <br />
                <span className="bg-gradient-to-r from-[#d4a73c] via-[#ff4e2d] to-[#ec4899] bg-clip-text text-transparent">
                  TEMUKAN SESUAI SUASANA HATIMU
                </span>
              </h1>

              <p className="text-white/60 text-xs md:text-sm max-w-2xl leading-relaxed">
                Filter anime bukan cuma berdasarkan genre kaku, tapi berdasarkan perasaanmu hari ini atau biarkan Anime Roulette Slot Machine memilihkan tontonan terbaik secara acak!
              </p>
            </div>

            {/* Tab Selector Buttons */}
            <div className="shrink-0 flex bg-[#13131c] border border-white/10 p-1.5 rounded-2xl gap-1.5 shadow-xl">
              <button
                onClick={() => handleTabChange('mood')}
                className={`px-5 py-3 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'mood'
                    ? 'bg-gradient-to-r from-[#d4a73c] to-[#ff4e2d] text-[#0b0b10] shadow-lg shadow-[#d4a73c]/20 font-black'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
              >
                <Compass className="w-4 h-4" />
                Mood Picker
              </button>

              <button
                onClick={() => handleTabChange('roulette')}
                className={`px-5 py-3 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'roulette'
                    ? 'bg-gradient-to-r from-[#d4a73c] to-[#ff4e2d] text-[#0b0b10] shadow-lg shadow-[#d4a73c]/20 font-black'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
              >
                <Dices className="w-4 h-4" />
                Anime Roulette
              </button>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* TAB 1: MOOD PICKER EXPERIENCE                                 */}
        {/* ============================================================ */}
        {activeTab === 'mood' && (
          <div className="space-y-8 animate-[fadeIn_0.2s_ease-out]">
            {/* 6 Mood Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
              {MOOD_CATEGORIES.map((m) => {
                const Icon = ICON_COMPONENTS[m.iconName] || Sparkles;
                const isSelected = m.id === selectedMoodId;

                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMoodId(m.id)}
                    className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden group flex flex-col justify-between min-h-[140px] ${
                      isSelected
                        ? `bg-gradient-to-b ${m.bgGradient} ${m.borderGlow} shadow-xl scale-[1.03]`
                        : 'bg-[#14141d] border-white/5 hover:border-white/20 hover:bg-[#181824]'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-md"
                        style={{
                          backgroundColor: `${m.accentColor}20`,
                          color: m.accentColor
                        }}
                      >
                        <Icon className="w-5 h-5 font-black" />
                      </div>

                      {isSelected && (
                        <span className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: m.accentColor }} />
                      )}
                    </div>

                    <div>
                      <h3
                        className={`font-black text-xs sm:text-sm transition-colors ${
                          isSelected ? 'text-white' : 'text-white/80 group-hover:text-white'
                        }`}
                      >
                        {m.title}
                      </h3>
                      <p className="text-white/40 text-[10px] truncate mt-0.5">{m.subtitle}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Active Mood Details & Curated Anime Grid */}
            <div
              className={`bg-[#14141e] border ${currentMood.borderGlow} rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden`}
            >
              {/* Background Ambient Glow */}
              <div
                className="absolute top-0 right-0 w-80 h-80 rounded-full blur-3xl opacity-20 pointer-events-none"
                style={{ backgroundColor: currentMood.accentColor }}
              />

              {/* Mood Header */}
              <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-[#0b0b10] shadow-xl shrink-0"
                    style={{ backgroundColor: currentMood.accentColor }}
                  >
                    <CurrentMoodIcon className="w-6 h-6 font-black" />
                  </div>
                  <div>
                    <h2 className="text-white font-black text-xl md:text-2xl">{currentMood.title}</h2>
                    <p className="text-white/60 text-xs max-w-xl mt-0.5">{currentMood.description}</p>
                  </div>
                </div>

                <button
                  onClick={() => navigate(`/explore?q=${encodeURIComponent(currentMood.title)}`)}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
                >
                  <Search className="w-3.5 h-3.5" />
                  Jelajahi Anime Lain
                </button>
              </div>

              {/* Curated Anime Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 relative z-10">
                {currentMood.curatedAnime.map((anime) => (
                  <div
                    key={anime.id}
                    onClick={() => handleWatchAnime(anime)}
                    className="bg-[#1a1a26] border border-white/10 hover:border-[#d4a73c]/50 rounded-2xl p-3.5 flex gap-3.5 group cursor-pointer transition-all hover:scale-[1.01] shadow-lg relative overflow-hidden"
                  >
                    <img
                      src={anime.cover}
                      alt={anime.title}
                      onError={(e) => {
                        e.target.src = '/img/welcomebanner.webp';
                      }}
                      className="w-20 h-28 object-cover rounded-xl shrink-0 border border-white/10 shadow-md group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />

                    <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-[10px] font-mono-ui font-bold text-white/50">{anime.type}</span>
                          <span className="flex items-center gap-1 text-[11px] font-mono-ui font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                            <Star className="w-3 h-3 fill-current" />
                            {anime.score}
                          </span>
                        </div>

                        <h4 className="text-white font-black text-sm group-hover:text-[#d4a73c] transition-colors truncate">
                          {anime.title}
                        </h4>
                        <span className="text-white/40 text-[10px] block truncate mt-0.5">{anime.genres}</span>
                      </div>

                      <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                        <p className="text-white/60 text-[11px] italic truncate mr-2">"{anime.quote}"</p>
                        <button
                          disabled={navigatingAnimeId === (anime.id || anime.title)}
                          className="px-3 py-1 rounded-lg bg-gradient-to-r from-[#d4a73c] to-[#ff4e2d] text-[#0b0b10] font-black text-[11px] flex items-center gap-1 shrink-0 group-hover:brightness-110 disabled:opacity-60"
                        >
                          {navigatingAnimeId === (anime.id || anime.title) ? (
                            <span className="animate-pulse text-[10px]">Membuka...</span>
                          ) : (
                            <>
                              <Play className="w-3 h-3 fill-current" /> Putar
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: ANIME ROULETTE / SLOT MACHINE                         */}
        {/* ============================================================ */}
        {activeTab === 'roulette' && (
          <div className="space-y-8 animate-[fadeIn_0.2s_ease-out]">
            {/* Filter Selector untuk Roulette */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="text-white/50 text-xs font-bold mr-2">Filter Putaran:</span>
              <button
                onClick={() => setRouletteFilter('all')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  rouletteFilter === 'all'
                    ? 'bg-[#d4a73c] text-[#0b0b10] font-black'
                    : 'bg-[#181824] text-white/60 hover:text-white border border-white/10'
                }`}
              >
                Semua Mood Acak
              </button>
              {MOOD_CATEGORIES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setRouletteFilter(m.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                    rouletteFilter === m.id
                      ? 'bg-[#d4a73c] text-[#0b0b10] font-black'
                      : 'bg-[#181824] text-white/60 hover:text-white border border-white/10'
                  }`}
                >
                  {m.title}
                </button>
              ))}
            </div>

            {/* Arcade Slot Machine Box */}
            <div className="max-w-3xl mx-auto bg-gradient-to-b from-[#1c1c28] via-[#14141e] to-[#0d0d14] border-2 border-amber-500/40 rounded-3xl p-6 md:p-10 shadow-[0_0_50px_rgba(212,167,60,0.2)] relative overflow-hidden text-center">
              {/* Neon Glow Header Bar */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-black uppercase tracking-widest mb-6">
                <Flame className="w-4 h-4 text-[#ff4e2d]" />
                LUCKY ANIME SLOT MACHINE
              </div>

              {/* 3 Slot Reels Display */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 bg-black/60 p-4 rounded-2xl border border-white/10 shadow-inner">
                {/* Reel 1: Anime Cover & Title */}
                <div className="bg-[#161622] border border-white/10 rounded-xl p-3 flex flex-col items-center justify-center min-h-[190px] shadow-lg relative overflow-hidden">
                  <span className="text-[10px] uppercase font-mono-ui font-bold text-white/40 mb-2">REEL 1 • ANIME</span>
                  <img
                    src={reel1Item.cover}
                    alt={reel1Item.title}
                    onError={(e) => {
                      e.target.src = '/img/welcomebanner.webp';
                    }}
                    className={`w-20 h-28 object-cover rounded-lg shadow-md border border-white/15 transition-transform ${
                      isSpinning ? 'scale-95 blur-[1px]' : 'scale-100'
                    }`}
                  />
                  <h4 className="text-white font-black text-xs truncate max-w-[180px] mt-2">{reel1Item.title}</h4>
                </div>

                {/* Reel 2: Mood Attribute */}
                <div className="bg-[#161622] border border-white/10 rounded-xl p-3 flex flex-col items-center justify-center min-h-[190px] shadow-lg">
                  <span className="text-[10px] uppercase font-mono-ui font-bold text-white/40 mb-3">REEL 2 • VIBE</span>
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg mb-2"
                    style={{ backgroundColor: `${reel1Item.moodColor || '#d4a73c'}25`, color: reel1Item.moodColor || '#d4a73c' }}
                  >
                    <Sparkles className="w-7 h-7 font-black" />
                  </div>
                  <h4 className="text-white font-black text-xs">{reel2Text}</h4>
                  <span className="text-white/40 text-[10px]">{reel1Item.genres}</span>
                </div>

                {/* Reel 3: Score & Tier */}
                <div className="bg-[#161622] border border-white/10 rounded-xl p-3 flex flex-col items-center justify-center min-h-[190px] shadow-lg">
                  <span className="text-[10px] uppercase font-mono-ui font-bold text-white/40 mb-3">REEL 3 • RATING</span>
                  <div className="flex items-center gap-1.5 text-2xl font-mono-ui font-black text-amber-400 bg-amber-500/10 px-4 py-2 rounded-xl border border-amber-500/30 shadow-md">
                    <Star className="w-6 h-6 fill-current" />
                    <span>{reel3Score}</span>
                  </div>
                  <span className="text-emerald-400 font-bold text-[10px] mt-2 uppercase font-mono-ui">
                    MASTERPIECE TIER
                  </span>
                </div>
              </div>

              {/* Big Spin Action Button */}
              <button
                onClick={handleSpinRoulette}
                disabled={isSpinning}
                className="px-10 py-5 rounded-2xl bg-gradient-to-r from-[#d4a73c] via-[#ff4e2d] to-[#ec4899] text-[#0b0b10] font-black text-base md:text-lg hover:brightness-110 active:scale-95 transition-all shadow-[0_0_35px_rgba(212,167,60,0.4)] disabled:opacity-50 flex items-center justify-center gap-3 mx-auto uppercase tracking-wider"
              >
                <Dices className={`w-6 h-6 ${isSpinning ? 'animate-spin' : ''}`} />
                <span>{isSpinning ? 'MEMUTAR ROULETTE...' : 'PUTAR ROULETTE SEKARANG!'}</span>
              </button>

              {/* Winner Revealed Card */}
              {winnerAnime && !isSpinning && (
                <div className="mt-8 p-6 bg-[#1a1a28] border-2 border-[#d4a73c] rounded-2xl text-left flex flex-col sm:flex-row gap-5 shadow-2xl animate-[fadeIn_0.3s_ease-out]">
                  <img
                    src={winnerAnime.cover}
                    alt={winnerAnime.title}
                    onError={(e) => {
                      e.target.src = '/img/welcomebanner.webp';
                    }}
                    className="w-28 h-38 object-cover rounded-xl border border-white/20 shadow-xl shrink-0 mx-auto sm:mx-0"
                  />
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono-ui font-black text-[10px] mb-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" /> HASIL ROULETTE KAMU!
                      </div>
                      <h3 className="text-white font-black text-lg md:text-xl">{winnerAnime.title}</h3>
                      <p className="text-white/40 text-xs mt-0.5">{winnerAnime.genres} • {winnerAnime.type}</p>
                      <p className="text-white/70 text-xs italic mt-2">"{winnerAnime.quote}"</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-white/10 mt-3">
                      <button
                        onClick={() => handleWatchAnime(winnerAnime)}
                        disabled={navigatingAnimeId === (winnerAnime.id || winnerAnime.title)}
                        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#d4a73c] to-[#ff4e2d] text-[#0b0b10] font-black text-xs hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 shadow-lg shadow-[#d4a73c]/20 disabled:opacity-60"
                      >
                        {navigatingAnimeId === (winnerAnime.id || winnerAnime.title) ? (
                          <span className="animate-pulse">Menghubungkan ke Pemutar...</span>
                        ) : (
                          <>
                            <Play className="w-4 h-4 fill-current" /> Tonton Episode 1 Sekarang
                          </>
                        )}
                      </button>
                      <button
                        onClick={handleSpinRoulette}
                        className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Putar Ulang
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default MoodPicker;
