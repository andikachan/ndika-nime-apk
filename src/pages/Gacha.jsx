import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import HoloCard from '../components/HoloCard';
import GachaSummonModal from '../components/GachaSummonModal';
import CardAlbum from '../components/CardAlbum';
import { CARDS_DATABASE, RARITY_CONFIG } from '../utils/cardsData';
import { setSeoMeta, SITE_URL } from '../utils/seo';
import {
  Sparkles,
  Gift,
  Coins,
  Ticket,
  Flame,
  Info,
  Layers,
  RotateCcw,
  Zap,
  CheckCircle2,
  ChevronRight,
  ShieldAlert,
  ArrowRight,
  Film,
  Brain,
  Swords,
  Star,
  Tag
} from 'lucide-react';

const Gacha = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('banner'); // 'banner' | 'album' | 'info'
  const [stats, setStats] = useState({
    coins: 0,
    tickets: 0,
    totalPulls: 0,
    pitySr: 0,
    pityUr: 0,
    canFreePull: true,
    canClaimDaily: true,
    uniqueCardsCount: 0,
    totalCardsCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [isPulling, setIsPulling] = useState(false);
  const [claimingDaily, setClaimingDaily] = useState(false);
  const [summonResults, setSummonResults] = useState([]);
  const [isSummonModalOpen, setIsSummonModalOpen] = useState(false);
  const [lastPullType, setLastPullType] = useState('multi_coin');
  const [toast, setToast] = useState('');
  const [errorToast, setErrorToast] = useState('');
  const [showRatesModal, setShowRatesModal] = useState(false);
  const [featuredIndex, setFeaturedIndex] = useState(0);

  const featuredCards = CARDS_DATABASE.filter((c) => c.featured);

  // Auto rotate featured card every 5s
  useEffect(() => {
    if (featuredCards.length === 0) return;
    const itv = setInterval(() => {
      setFeaturedIndex((prev) => (prev + 1) % featuredCards.length);
    }, 5000);
    return () => clearInterval(itv);
  }, [featuredCards.length]);

  useEffect(() => {
    setSeoMeta(
      'Gacha Kartu Karakter Anime 3D Holographic | Ndichan',
      'Koleksi kartu karakter anime legendaris dengan efek 3D Holographic Foil. Dapatkan Gojo, Luffy Gear 5, Jin-Woo, Frieren, dan pamerkan di profilmu!',
      '/img/welcomebanner.webp',
      `${SITE_URL}/gacha`
    );
  }, []);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/gacha/status', { credentials: 'include' });
      const data = await res.json();
      if (res.ok && data.success) {
        setStats(data.stats);
      }
    } catch (e) {
      console.error('Load gacha status error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const showNotification = (msg, isError = false) => {
    if (isError) {
      setErrorToast(msg);
      setTimeout(() => setErrorToast(''), 4000);
    } else {
      setToast(msg);
      setTimeout(() => setToast(''), 4000);
    }
  };

  // Claim Daily Coins (+150 Gacha Coins)
  const handleClaimDaily = async () => {
    if (claimingDaily || !stats.canClaimDaily) return;
    setClaimingDaily(true);
    try {
      const res = await fetch('/api/v1/gacha/claim-daily', {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStats((prev) => ({
          ...prev,
          coins: data.stats.coins,
          canClaimDaily: false
        }));
        showNotification(data.message || 'Hadiah harian +150 Coins berhasil diklaim!');
      } else {
        showNotification(data.error || 'Gagal klaim hadiah harian', true);
      }
    } catch (e) {
      showNotification('Koneksi bermasalah, coba lagi', true);
    } finally {
      setClaimingDaily(false);
    }
  };

  // Execute Pull (free | single_coin | multi_coin | single_ticket | multi_ticket)
  const handlePull = async (pullType) => {
    if (isPulling) return;
    setIsPulling(true);
    setLastPullType(pullType);

    try {
      const res = await fetch('/api/v1/gacha/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pullType })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setStats((prev) => ({
          ...prev,
          ...data.stats
        }));
        setSummonResults(data.cards || []);
        setIsSummonModalOpen(true);
      } else {
        showNotification(data.error || 'Gagal melakukan summon kartu', true);
      }
    } catch (e) {
      console.error('Pull gacha error:', e);
      showNotification('Koneksi terputus saat summon, coba lagi', true);
    } finally {
      setIsPulling(false);
    }
  };

  const currentFeatured = featuredCards[featuredIndex] || featuredCards[0];

  return (
    <div className="min-h-screen bg-[#0b0b10] text-white flex flex-col justify-between pt-24 pb-12">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 w-full">
        {/* Toast Notifikasi */}
        {toast && (
          <div className="fixed top-24 right-4 z-50 p-4 bg-[#d4a73c] text-[#0b0b10] font-bold rounded-xl shadow-2xl flex items-center gap-2 animate-[slideDown_0.2s_ease-out]">
            <Sparkles className="w-5 h-5 shrink-0" />
            <p className="text-xs md:text-sm">{toast}</p>
          </div>
        )}
        {errorToast && (
          <div className="fixed top-24 right-4 z-50 p-4 bg-red-600 text-white font-bold rounded-xl shadow-2xl flex items-center gap-2 animate-[slideDown_0.2s_ease-out]">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <p className="text-xs md:text-sm">{errorToast}</p>
          </div>
        )}

        {/* Top Header & Currencies */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#14141d] border border-white/10 rounded-2xl p-4 md:p-6 mb-6 relative overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#d4a73c] to-[#ff4e2d] flex items-center justify-center shadow-lg shadow-[#d4a73c]/30 shrink-0">
              <Sparkles className="w-6 h-6 text-[#0b0b10]" />
            </div>
            <div>
              <h1 className="font-display text-xl md:text-3xl text-white font-black tracking-wide flex items-center gap-2">
                GACHA KARTU ANIME
              </h1>
              <p className="text-white/40 text-xs md:text-sm">
                Koleksi 3D Holographic Character Cards & Pamerkan di Profil
              </p>
            </div>
          </div>

          {/* Currency Strip & Daily Claim */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Coins */}
            <div className="flex items-center gap-2 bg-black/50 border border-white/10 px-3.5 py-2 rounded-xl">
              <Coins className="w-4 h-4 text-amber-400" />
              <div>
                <span className="text-white/30 text-[9px] block uppercase font-mono-ui">Gacha Coins</span>
                <span className="text-white font-mono-ui font-black text-sm">
                  {stats.coins?.toLocaleString() || 0}
                </span>
              </div>
            </div>

            {/* Tickets */}
            <div className="flex items-center gap-2 bg-black/50 border border-white/10 px-3.5 py-2 rounded-xl">
              <Ticket className="w-4 h-4 text-purple-400" />
              <div>
                <span className="text-white/30 text-[9px] block uppercase font-mono-ui">Tiket Summon</span>
                <span className="text-white font-mono-ui font-black text-sm">
                  {stats.tickets?.toLocaleString() || 0}
                </span>
              </div>
            </div>

            {/* Daily Gift Claim */}
            <button
              onClick={handleClaimDaily}
              disabled={!stats.canClaimDaily || claimingDaily}
              className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all ${
                stats.canClaimDaily
                  ? 'bg-gradient-to-r from-[#d4a73c] to-[#ff4e2d] text-[#0b0b10] hover:brightness-110 shadow-md shadow-[#d4a73c]/20 active:scale-95'
                  : 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'
              }`}
            >
              <Gift className="w-4 h-4" />
              {stats.canClaimDaily ? 'Klaim Harian (+150 Coins)' : 'Klaim Besok'}
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center justify-between gap-4 mb-6 border-b border-white/10 pb-3 flex-wrap">
          <div className="flex items-center gap-2">
            {[
              ['banner', 'Summon Banner', Sparkles],
              ['album', 'Koleksi Binder', Layers],
              ['info', 'Info Peluang & Aturan', Info]
            ].map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === id
                    ? 'bg-[#d4a73c] text-[#0b0b10] shadow-lg shadow-[#d4a73c]/20'
                    : 'bg-[#14141d] border border-white/5 text-white/50 hover:text-white hover:border-white/20'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/arena')}
              className="px-4 py-2 rounded-xl text-xs md:text-sm font-black bg-gradient-to-r from-rose-500 via-purple-500 to-amber-500 text-white shadow-lg shadow-rose-500/20 hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5 uppercase tracking-wider"
            >
              <Swords className="w-4 h-4" />
              Battle Arena
            </button>

            <button
              onClick={() => navigate('/market')}
              className="px-4 py-2 rounded-xl text-xs md:text-sm font-black bg-gradient-to-r from-[#d4a73c] to-[#ff4e2d] text-[#0b0b10] shadow-lg shadow-[#d4a73c]/20 hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5 uppercase tracking-wider"
            >
              <Tag className="w-4 h-4" />
              Bursa Pasar & Barter
            </button>
          </div>

          <button
            onClick={() => setShowRatesModal(true)}
            className="text-white/40 hover:text-[#d4a73c] text-xs font-bold flex items-center gap-1 transition-colors"
          >
            <Info className="w-3.5 h-3.5" /> Lihat Tingkat Drop & Rarity
          </button>
        </div>

        {/* ===== TAB 1: GACHA BANNER ===== */}
        {activeTab === 'banner' && (
          <div className="space-y-6">
            {/* Featured Banner Hero */}
            <div className="bg-gradient-to-br from-[#181826] via-[#12121a] to-[#0a0a0f] border border-white/10 rounded-3xl p-6 md:p-10 relative overflow-hidden shadow-2xl">
              {/* Background ambient lighting */}
              <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#ff2a70]/15 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-[#d4a73c]/15 rounded-full blur-3xl pointer-events-none" />

              <div className="flex flex-col lg:flex-row items-center justify-between gap-10 relative z-10">
                {/* Left: Banner Info & Pull Actions */}
                <div className="flex-1 space-y-5 text-center lg:text-left">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-pink-500/30 text-pink-300 text-xs font-black uppercase tracking-wider">
                    <Flame className="w-3.5 h-3.5 text-pink-400 animate-pulse" />
                    BANNER SPESIAL: LEGENDARY AWAKENING
                  </div>

                  <h2 className="font-display text-3xl md:text-5xl text-white font-black leading-tight tracking-wide">
                    TEMUKAN KARAKTER <br />
                    <span className="bg-gradient-to-r from-[#d4a73c] via-[#ff4e2d] to-[#ff2a70] bg-clip-text text-transparent">
                      MYTHIC & UR
                    </span>
                  </h2>

                  <p className="text-white/60 text-xs md:text-sm max-w-lg leading-relaxed">
                    Setiap tarikan memberi kesempatan mendapatkan karakter UR & SSR dengan efek 3D Holographic Foil dan stat Combat Power tertinggi!
                  </p>

                  {/* Pity Counters */}
                  <div className="grid grid-cols-2 gap-3 max-w-md mx-auto lg:mx-0">
                    <div className="p-3 bg-black/40 border border-white/10 rounded-xl">
                      <span className="text-white/40 text-[10px] uppercase font-mono-ui font-bold">
                        Pity Jaminan SR+
                      </span>
                      <p className="text-purple-300 font-mono-ui font-black text-sm mt-0.5">
                        {Math.max(0, 10 - (stats.pitySr || 0))} <span className="text-white/30 text-[11px]">tarikan lagi</span>
                      </p>
                    </div>

                    <div className="p-3 bg-black/40 border border-pink-500/20 rounded-xl">
                      <span className="text-white/40 text-[10px] uppercase font-mono-ui font-bold">
                        Pity Jaminan UR Mythic
                      </span>
                      <p className="text-[#ff2a70] font-mono-ui font-black text-sm mt-0.5">
                        {Math.max(0, 50 - (stats.pityUr || 0))} <span className="text-white/30 text-[11px]">tarikan lagi</span>
                      </p>
                    </div>
                  </div>

                  {/* Summon Buttons */}
                  <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 pt-2">
                    {/* Free Daily Pull */}
                    {stats.canFreePull && (
                      <button
                        onClick={() => handlePull('free')}
                        disabled={isPulling}
                        className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-[#0b0b10] font-black text-sm hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-emerald-500/25 flex items-center gap-2 animate-bounce"
                      >
                        <Gift className="w-4 h-4" />
                        FREE DAILY PULL (1x)
                      </button>
                    )}

                    {/* Single Pull */}
                    <button
                      onClick={() => handlePull(stats.tickets >= 1 ? 'single_ticket' : 'single_coin')}
                      disabled={isPulling || (stats.coins < 100 && stats.tickets < 1)}
                      className="px-6 py-3.5 rounded-2xl bg-[#1f1f2e] border border-white/15 hover:border-white/30 text-white font-black text-sm hover:bg-white/10 active:scale-95 transition-all flex flex-col items-center disabled:opacity-40"
                    >
                      <span>TARIK 1x</span>
                      <span className="text-[11px] text-amber-400 font-mono-ui font-normal flex items-center gap-1">
                        {stats.tickets >= 1 ? (
                          <><Ticket className="w-3 h-3 text-purple-400" /> 1 Tiket</>
                        ) : (
                          <><Coins className="w-3 h-3 text-amber-400" /> 100 Coins</>
                        )}
                      </span>
                    </button>

                    {/* Multi Pull (10x) */}
                    <button
                      onClick={() => handlePull(stats.tickets >= 10 ? 'multi_ticket' : 'multi_coin')}
                      disabled={isPulling || (stats.coins < 900 && stats.tickets < 10)}
                      className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-[#d4a73c] via-[#ff4e2d] to-[#ff2a70] text-[#0b0b10] font-black text-sm md:text-base hover:brightness-110 active:scale-95 transition-all flex flex-col items-center shadow-xl shadow-[#d4a73c]/30 disabled:opacity-40"
                    >
                      <span className="flex items-center gap-1.5">
                        <Zap className="w-4 h-4 fill-current" /> TARIK 10x (DISKON 10%)
                      </span>
                      <span className="text-[11px] font-mono-ui font-semibold opacity-90 flex items-center gap-1">
                        {stats.tickets >= 10 ? (
                          <><Ticket className="w-3 h-3 text-purple-300" /> 10 Tiket</>
                        ) : (
                          <><Coins className="w-3 h-3 text-amber-300" /> 900 Coins (Jaminan SR+)</>
                        )}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Right: Interactive 3D Card Spotlight of Featured Character */}
                <div className="shrink-0 flex flex-col items-center">
                  <span className="text-white/40 text-[10px] uppercase font-mono-ui font-bold mb-2 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-[#d4a73c]" /> FEATURED RATE-UP
                  </span>
                  <HoloCard card={currentFeatured} stars={5} size="xl" />
                  <p className="text-white/30 text-[11px] mt-2 font-mono-ui">
                    Gerakkan kursor/jari di atas kartu untuk efek Holographic Foil
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Links Banner */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                onClick={() => setActiveTab('album')}
                className="bg-[#14141d] border border-white/10 rounded-2xl p-5 hover:border-[#d4a73c]/40 transition-all cursor-pointer group flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#d4a73c]/10 border border-[#d4a73c]/20 flex items-center justify-center">
                    <Layers className="w-6 h-6 text-[#d4a73c]" />
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-sm group-hover:text-[#d4a73c] transition-colors">
                      Buka Album & Koleksi Kartu
                    </h4>
                    <p className="text-white/40 text-xs">
                      {stats.uniqueCardsCount || 0} dari {CARDS_DATABASE.length} Karakter Terkumpul
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-white/30 group-hover:text-[#d4a73c] group-hover:translate-x-1 transition-all" />
              </div>

              <div
                onClick={() => navigate('/profile')}
                className="bg-[#14141d] border border-white/10 rounded-2xl p-5 hover:border-[#d4a73c]/40 transition-all cursor-pointer group flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-purple-400" />
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-sm group-hover:text-[#d4a73c] transition-colors">
                      Pasang Kartu di Profil Saya
                    </h4>
                    <p className="text-white/40 text-xs">
                      Pamerkan hingga 3 kartu terbaik di showcase profil publikmu
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-white/30 group-hover:text-[#d4a73c] group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          </div>
        )}

        {/* ===== TAB 2: KOLEKSI BINDER ===== */}
        {activeTab === 'album' && (
          <CardAlbum onShowcaseUpdated={() => loadStatus()} />
        )}

        {/* ===== TAB 3: INFO CARA DAPAT KOIN & ATURAN ===== */}
        {activeTab === 'info' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#14141d] border border-white/10 rounded-2xl p-6 space-y-4">
              <h3 className="text-white font-bold text-base flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-400" />
                Cara Mendapatkan Gacha Coins & Tiket
              </h3>
              <div className="space-y-3 text-xs text-white/70">
                <div className="p-3 bg-black/40 rounded-xl border border-white/5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><Gift className="w-3.5 h-3.5 text-emerald-400" /> Login Harian & Daily Streak</span>
                  <b className="text-amber-400">+150 Coins / Hari</b>
                </div>
                <div className="p-3 bg-black/40 rounded-xl border border-white/5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><Film className="w-3.5 h-3.5 text-blue-400" /> Nonton Anime & Baca Komik (Quest)</span>
                  <b className="text-amber-400">+50 - 200 Coins</b>
                </div>
                <div className="p-3 bg-black/40 rounded-xl border border-white/5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><Brain className="w-3.5 h-3.5 text-purple-400" /> Menjawab Kuis Trivia Harian</span>
                  <b className="text-amber-400">+100 Coins</b>
                </div>
                <div className="p-3 bg-black/40 rounded-xl border border-white/5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><Swords className="w-3.5 h-3.5 text-red-400" /> Mengalahkan Boss Event Mingguan</span>
                  <b className="text-purple-400">+5 Tiket Summon</b>
                </div>
                <div className="p-3 bg-black/40 rounded-xl border border-white/5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><Star className="w-3.5 h-3.5 text-amber-400" /> Naik Level RPG Pengguna</span>
                  <b className="text-purple-400">+1 Tiket per Level</b>
                </div>
              </div>
            </div>

            <div className="bg-[#14141d] border border-white/10 rounded-2xl p-6 space-y-4">
              <h3 className="text-white font-bold text-base flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-[#d4a73c]" />
                Sistem Pity & Duplikat Bintang
              </h3>
              <div className="space-y-3 text-xs text-white/70 leading-relaxed">
                <p>
                  • <b>Sistem Pity:</b> Setiap 10 tarikan dijamin mendapat minimal 1 kartu <b>Super Rare (SR)</b> atau lebih tinggi. Pada tarikan ke-50 dijamin pasti mendapatkan kartu <b>Ultra Rare (UR) Mythic</b>!
                </p>
                <p>
                  • <b>Multi Pull Diskon:</b> Menarik 10x sekaligus hanya membutuhkan 900 Coins (Hemat 100 Coins) dan langsung menjamin minimal 1 SR+.
                </p>
                <p>
                  • <b>Sistem Duplikat:</b> Jika Anda mendapatkan kartu yang sudah dimiliki, kartu tersebut tidak hangus melainkan otomatis menaikkan <b>Star Level (1 sampai 5 Bintang)</b>, meningkatkan Combat Power (CP) sebesar +25% per bintang!
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===== RATES MODAL ===== */}
      {showRatesModal && (
        <div
          className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setShowRatesModal(false)}
        >
          <div
            className="w-full max-w-md bg-[#181824] border border-white/10 rounded-2xl p-6 relative animate-[fadeScale_0.15s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-white font-black text-lg mb-4">Tingkat Kelangkaan & Drop Rate</h3>
            <div className="space-y-2.5">
              {Object.entries(RARITY_CONFIG).map(([rarity, conf]) => (
                <div key={rarity} className="flex items-center justify-between p-3 bg-black/40 rounded-xl border border-white/5">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${conf.badgeBg}`}>
                      {rarity}
                    </span>
                    <span className="text-white text-xs font-bold">{conf.label}</span>
                  </div>
                  <span className="font-mono-ui font-black text-xs" style={{ color: conf.color }}>
                    {conf.rate}%
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowRatesModal(false)}
              className="mt-6 w-full py-2.5 rounded-xl bg-white/10 text-white text-xs font-bold hover:bg-white/20 transition-all"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* ===== SUMMON MODAL ===== */}
      <GachaSummonModal
        isOpen={isSummonModalOpen}
        onClose={() => {
          setIsSummonModalOpen(false);
          loadStatus();
        }}
        cards={summonResults}
        onPullAgain={(type) => {
          setIsSummonModalOpen(false);
          handlePull(type);
        }}
        pullType={lastPullType}
        userStats={stats}
        isPulling={isPulling}
      />

      <Footer />
    </div>
  );
};

export default Gacha;
