import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import {
  Compass, MapPin, Globe, Sparkles, Shield, Flame, Zap, Swords,
  Anchor, Heart, Crown, Award, Gift, Check, Lock, ChevronRight,
  User, BookOpen, Clock, Loader2, AlertCircle, Share2, Star, HelpCircle,
  Copy, ExternalLink
} from 'lucide-react';
import { setSeoMeta, SITE_URL } from '../utils/seo';

const REALM_ICONS = {
  Flame,
  Sparkles,
  Shield,
  Zap,
  Swords,
  Anchor,
  Heart,
  Crown
};

const IsekaiMap = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('map'); // 'map' | 'passport'
  const [loading, setLoading] = useState(true);
  const [passportData, setPassportData] = useState(null);
  const [selectedRealm, setSelectedRealm] = useState(null);
  const [challenging, setChallenging] = useState(false);
  const [battleResult, setBattleResult] = useState(null);

  // Toast
  const [toast, setToast] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    setSeoMeta({
      title: 'Isekai Passport & Peta Penaklukan Dunia Anime - Ndika-Nime',
      description: 'Jelajahi 8 dimensi dunia anime legendaris, kalahkan Guardian Penjaga, kumpulkan stempel paspor emas, dan dapatkan Buff Permanen!',
      url: `${SITE_URL}/isekai`
    });
  }, []);

  const showToast = (msg, isError = false) => {
    if (isError) {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(''), 4000);
    } else {
      setToast(msg);
      setTimeout(() => setToast(''), 4000);
    }
  };

  const loadPassport = async () => {
    try {
      const res = await fetch('/api/v1/isekai/passport', { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setPassportData(data);
      }
    } catch (e) {
      console.error('Load passport error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPassport();
  }, []);

  // Action: Tantang Guardian & Taklukkan Wilayah
  const handleChallengeRealm = async (realmId) => {
    if (challenging) return;
    setChallenging(true);
    try {
      const res = await fetch('/api/v1/isekai/claim-realm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ realmId })
      });
      const data = await res.json();
      if (data.success) {
        setBattleResult(data);
        showToast(`Kemenangan Telak! Wilayah ${data.realm.name} Berhasil Ditaklukkan!`);
        setSelectedRealm(null);
        loadPassport();
      } else {
        showToast(data.error || 'Gagal menaklukkan wilayah', true);
      }
    } catch (e) {
      showToast('Gagal terhubung ke server', true);
    } finally {
      setChallenging(false);
    }
  };

  // Action: Pamerkan / Salin Link Paspor
  const handleSharePassport = () => {
    if (!passportData || !passportData.user) return;
    const shareUrl = `${window.location.origin}/user/${passportData.user.id}`;
    const shareText = `📜 Lihat Paspor Isekai milik ${passportData.user.name}! Peringkat: ${passportData.passport.rank} (${passportData.passport.totalConquered}/8 Wilayah Tertaklukkan). Cek disini: ${shareUrl}`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareText);
      showToast('Link Pamer Paspor berhasil disalin ke clipboard! Pamerkan ke teman atau klan!');
    } else {
      showToast(shareUrl);
    }
  };

  if (loading || !passportData) {
    return (
      <div className="min-h-screen bg-[#0b0b10] text-white flex flex-col justify-between">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#d4a73c] animate-spin" />
        </div>
        <Footer />
      </div>
    );
  }

  const { user, passport, realms } = passportData;

  return (
    <div className="min-h-screen bg-[#0b0b10] text-white flex flex-col justify-between selection:bg-[#d4a73c]/30 selection:text-[#d4a73c]">
      <Navbar />

      {/* Floating Toast Notification */}
      <div className="fixed top-6 right-6 z-[300] max-w-md w-full px-4 space-y-2 pointer-events-none">
        {toast && (
          <div className="p-4 bg-[#181824] border border-[#d4a73c]/50 rounded-2xl flex items-center gap-3 shadow-[0_0_30px_rgba(212,167,60,0.35)] pointer-events-auto animate-[slideDown_0.25s_ease-out]">
            <div className="w-8 h-8 rounded-xl bg-[#d4a73c]/20 flex items-center justify-center text-[#d4a73c] shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <p className="text-white font-black text-xs leading-relaxed">{toast}</p>
          </div>
        )}
        {errorMsg && (
          <div className="p-4 bg-[#181824] border border-red-500/60 rounded-2xl flex items-center gap-3 shadow-[0_0_30px_rgba(239,68,68,0.35)] pointer-events-auto animate-[slideDown_0.25s_ease-out]">
            <div className="w-8 h-8 rounded-xl bg-red-500/20 flex items-center justify-center text-red-400 shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
            <p className="text-red-300 font-black text-xs leading-relaxed">{errorMsg}</p>
          </div>
        )}
      </div>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 space-y-6">
        {/* ─── 1. HEADER BANNER & PASSPORT STATS ─── */}
        <div className="bg-[#14141d] border border-white/10 rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-80 h-80 bg-[#d4a73c]/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#38bdf8]/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-start justify-between flex-wrap gap-5 relative z-10">
            <div className="max-w-xl">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-[#d4a73c]/20 border border-[#d4a73c]/35 text-[#d4a73c] font-mono-ui">
                  PASPOR PENJELAJAH RESMI
                </span>
                <span className="text-xs text-white/40 font-mono-ui">
                  {passport.passportNo}
                </span>
                {user?.title && (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/35 font-mono-ui">
                    Gelar: {user.title}
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white font-mono-ui">
                Peta Penaklukan Dunia Anime
              </h1>
              <p className="text-white/40 text-xs md:text-sm font-medium mt-1 leading-relaxed">
                Tantang Guardian Penjaga di setiap wilayah untuk menaklukkannya. Raih stempel emas paspor, buff akun permanen, dan pamerkan paspormu ke seluruh komunitas!
              </p>
            </div>

            {/* Passport Rank Pill & Action Buttons */}
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={handleSharePassport}
                className="p-3 bg-[#d4a73c]/15 hover:bg-[#d4a73c]/25 border border-[#d4a73c]/40 text-[#d4a73c] rounded-2xl flex items-center gap-2 font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95"
                title="Pamerkan Paspor ke Komunitas"
              >
                <Share2 className="w-4 h-4" />
                Pamerkan Paspor
              </button>

              <div className="p-3 bg-black/50 border border-white/10 rounded-2xl flex items-center gap-3 shadow-inner">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shadow-md shrink-0"
                  style={{ backgroundColor: `${passport.rankColor}25`, color: passport.rankColor, border: `1px solid ${passport.rankColor}50` }}
                >
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] text-white/40 block font-bold">Peringkat Paspor:</span>
                  <strong className="text-white font-black text-xs md:text-sm font-mono-ui block" style={{ color: passport.rankColor }}>
                    {passport.rank}
                  </strong>
                  <span className="text-[10px] text-white/40 font-mono-ui">
                    {passport.totalConquered} dari {passport.totalRealms} Wilayah Tertaklukkan
                  </span>
                </div>
              </div>

              {/* View Switcher Button */}
              <div className="flex bg-[#181824] p-1 rounded-2xl border border-white/10">
                <button
                  onClick={() => setViewMode('map')}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                    viewMode === 'map'
                      ? 'bg-[#d4a73c] text-[#0b0b10] shadow-[0_0_15px_rgba(212,167,60,0.3)]'
                      : 'text-white/50 hover:text-white'
                  }`}
                >
                  <Globe className="w-4 h-4" /> Peta Fantasi
                </button>
                <button
                  onClick={() => setViewMode('passport')}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                    viewMode === 'passport'
                      ? 'bg-[#d4a73c] text-[#0b0b10] shadow-[0_0_15px_rgba(212,167,60,0.3)]'
                      : 'text-white/50 hover:text-white'
                  }`}
                >
                  <BookOpen className="w-4 h-4" /> Buku Paspor ({passport.stamps.length})
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ─── ACTIVE BUFFS STRIP ─── */}
        {(passport.activeBuffs || []).length > 0 && (
          <div className="bg-[#14141d] border border-[#d4a73c]/30 rounded-2xl p-4 shadow-lg">
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-xs font-black uppercase text-[#d4a73c] font-mono-ui flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> Buff Akun Permanen Paspor Aktif ({passport.activeBuffs.length} Buff):
              </span>
              <span className="text-[10px] text-white/40">Otomatis aktif di seluruh mode permainan</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              {passport.activeBuffs.map((b) => (
                <div key={b.id} className="p-2.5 bg-black/40 border border-white/5 rounded-xl flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
                  <div>
                    <strong className="text-white text-xs block font-bold">{b.name}</strong>
                    <span className="text-white/40 text-[10px] block leading-tight">{b.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── VIEW 1: AUTHENTIC FANTASY WORLD MAP ─── */}
        {viewMode === 'map' && (
          <div className="space-y-6">
            {/* Visual Interactive Map Canvas Container */}
            <div className="relative border-2 border-[#d4a73c]/30 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] min-h-[560px] md:min-h-[660px] flex flex-col justify-between">
              {/* Actual Authentic Fantasy Anime Map Illustration Background */}
              <div
                className="absolute inset-0 bg-cover bg-center filter brightness-[0.45] contrast-125 saturate-150 transform transition-transform duration-1000 scale-105"
                style={{
                  backgroundImage: "url('https://images.unsplash.com/photo-1524654458049-e36be0721fa2?w=1600&auto=format&fit=crop&q=80')"
                }}
              />

              {/* Dark Vignette & Atmospheric Fog Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b10] via-black/40 to-[#0b0b10]/90 pointer-events-none" />
              <div className="absolute inset-0 bg-[radial-gradient(#d4a73c15_1px,transparent_1px)] [background-size:32px_32px] pointer-events-none" />

              {/* Fantasy Map Compass Rose */}
              <div className="absolute top-6 right-6 opacity-40 pointer-events-none z-10 hidden sm:block">
                <Compass className="w-20 h-20 text-[#d4a73c] animate-[spin_120s_linear_infinite]" />
              </div>

              {/* Connecting Illuminated Expedition Route Lines (SVG) */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                <defs>
                  <linearGradient id="routeGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.7" />
                    <stop offset="35%" stopColor="#38bdf8" stopOpacity="0.8" />
                    <stop offset="70%" stopColor="#d4a73c" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.7" />
                  </linearGradient>
                </defs>
                <path
                  d="M 18% 32% Q 30% 22% 42% 20% T 75% 28% T 82% 65% T 50% 85% T 25% 72% T 52% 55% Z"
                  fill="none"
                  stroke="url(#routeGlow)"
                  strokeWidth="2.5"
                  strokeDasharray="6 6"
                />
                <line x1="18%" y1="32%" x2="50%" y2="40%" stroke="rgba(139,92,246,0.3)" strokeWidth="1.5" strokeDasharray="4 4" />
                <line x1="42%" y1="20%" x2="50%" y2="40%" stroke="rgba(139,92,246,0.3)" strokeWidth="1.5" strokeDasharray="4 4" />
                <line x1="75%" y1="28%" x2="50%" y2="40%" stroke="rgba(139,92,246,0.3)" strokeWidth="1.5" strokeDasharray="4 4" />
                <line x1="82%" y1="65%" x2="50%" y2="40%" stroke="rgba(139,92,246,0.3)" strokeWidth="1.5" strokeDasharray="4 4" />
                <line x1="52%" y1="55%" x2="50%" y2="40%" stroke="rgba(139,92,246,0.3)" strokeWidth="1.5" strokeDasharray="4 4" />
                <line x1="25%" y1="72%" x2="50%" y2="40%" stroke="rgba(139,92,246,0.3)" strokeWidth="1.5" strokeDasharray="4 4" />
                <line x1="50%" y1="85%" x2="50%" y2="40%" stroke="rgba(139,92,246,0.3)" strokeWidth="1.5" strokeDasharray="4 4" />
              </svg>

              {/* Interactive Nodes across the Continent */}
              <div className="relative w-full h-[460px] md:h-[540px] z-20">
                {realms.map((realm) => {
                  const Icon = REALM_ICONS[realm.icon] || MapPin;
                  const isConquered = realm.isClaimed;
                  const isReady = realm.isReadyToClaim;
                  const isLocked = realm.isLocked;

                  return (
                    <div
                      key={realm.id}
                      style={{
                        left: `${realm.coordinates.x}%`,
                        top: `${realm.coordinates.y}%`
                      }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-20"
                      onClick={() => setSelectedRealm(realm)}
                    >
                      {isReady && (
                        <span className="absolute -inset-2.5 rounded-full bg-[#d4a73c]/50 animate-ping pointer-events-none" />
                      )}

                      {/* Node Pin Marker */}
                      <div
                        className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center border-2 transition-all duration-300 shadow-2xl relative ${
                          isConquered
                            ? 'bg-[#d4a73c] text-[#0b0b10] border-[#d4a73c] shadow-[0_0_30px_rgba(212,167,60,0.6)] scale-110'
                            : isReady
                            ? 'bg-[#181824] text-[#d4a73c] border-[#d4a73c] animate-bounce shadow-[0_0_25px_rgba(212,167,60,0.5)]'
                            : isLocked
                            ? 'bg-black/90 text-white/30 border-white/10 opacity-70'
                            : 'bg-[#181824] text-white/80 border-white/20 hover:border-white/60 hover:scale-110'
                        }`}
                        style={{
                          borderColor: isConquered || isReady ? '#d4a73c' : realm.color
                        }}
                      >
                        {isLocked ? (
                          <Lock className="w-5 h-5 text-white/40" />
                        ) : (
                          <Icon className="w-5 h-5 md:w-6 md:h-6" />
                        )}

                        {isConquered && (
                          <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-black shadow-md">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        )}
                      </div>

                      {/* Floating Label */}
                      <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap text-center pointer-events-none">
                        <span className={`text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-lg shadow-xl block font-mono-ui border ${
                          isConquered
                            ? 'bg-[#d4a73c] text-[#0b0b10] border-[#d4a73c]'
                            : isReady
                            ? 'bg-emerald-500 text-black border-emerald-400 animate-pulse'
                            : isLocked
                            ? 'bg-black/80 text-white/40 border-white/10'
                            : 'bg-black/90 text-white/90 border-white/20'
                        }`}>
                          {realm.name}
                        </span>
                        <span className="text-[9px] text-white/60 block mt-0.5 font-bold">
                          {isConquered ? 'Tertaklukkan' : isReady ? 'Siap Ditantang!' : 'Terkunci (Cek Syarat)'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Map Legend */}
              <div className="bg-black/75 backdrop-blur-md border-t border-white/10 p-4 flex items-center justify-between flex-wrap gap-3 relative z-20 text-xs text-white/60">
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-3 h-3 rounded-full bg-[#d4a73c] shadow-[0_0_8px_rgba(212,167,60,0.6)]" />
                    Tertaklukkan
                  </span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                    Siap Ditantang (Trial Ready)
                  </span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-3 h-3 rounded-full bg-black border border-white/20" />
                    Syarat Belum Terpenuhi
                  </span>
                </div>

                <span className="text-[11px] text-[#d4a73c] font-black">
                  Klik titik wilayah untuk duel melawan Guardian & aktifkan buff akun!
                </span>
              </div>
            </div>

            {/* Realms Grid Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {realms.map((r) => {
                const Icon = REALM_ICONS[r.icon] || MapPin;
                return (
                  <div
                    key={r.id}
                    onClick={() => setSelectedRealm(r)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                      r.isClaimed
                        ? 'bg-gradient-to-b from-[#d4a73c]/15 via-[#181820] to-[#181820] border-[#d4a73c]/40 shadow-[0_0_20px_rgba(212,167,60,0.15)]'
                        : r.isReadyToClaim
                        ? 'bg-emerald-950/20 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.2)] animate-pulse'
                        : 'bg-[#14141d] border-white/5 opacity-70 hover:opacity-100 hover:border-white/20'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center font-bold"
                          style={{ backgroundColor: `${r.color}25`, color: r.color }}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-mono-ui font-black uppercase text-white/40">
                          {r.isClaimed ? 'Tertaklukkan' : r.isReadyToClaim ? 'Siap Ditantang' : 'Terkunci'}
                        </span>
                      </div>

                      <h4 className="text-white font-black text-xs uppercase truncate">{r.name}</h4>
                      <p className="text-white/40 text-[10px] truncate">{r.indonesianTitle}</p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-white/5 space-y-1 text-[10px]">
                      <div className="flex justify-between items-center">
                        <span className="text-white/40">Guardian:</span>
                        <span className="text-white font-bold truncate max-w-[120px]">{r.guardian?.name?.split(' ')[0]}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-white/40">Buff:</span>
                        <span className="text-emerald-400 font-bold truncate max-w-[120px]">{r.buff?.name}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── VIEW 2: DIGITAL PASSPORT BOOK & STAMPS ─── */}
        {viewMode === 'passport' && (
          <div className="space-y-6">
            <div className="bg-[#14141d] border-2 border-[#d4a73c]/30 rounded-3xl p-6 md:p-10 relative overflow-hidden shadow-2xl">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
                {/* Left Page: Explorer Identity Card */}
                <div className="md:col-span-5 bg-[#181824] border border-[#d4a73c]/30 rounded-2xl p-6 space-y-5 shadow-xl relative">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <span className="text-[10px] font-mono-ui font-black text-[#d4a73c] uppercase tracking-wider">
                      REPUBLIK ISEKAI NDIKA-NIME
                    </span>
                    <Globe className="w-4 h-4 text-[#d4a73c]" />
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 overflow-hidden shadow-md shrink-0">
                      {user.picture ? (
                        <img src={user.picture} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-8 h-8 text-white/40 m-auto" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-white font-black text-base">{user.name}</h3>
                      <p className="text-white/40 text-xs font-mono-ui">Petualang Tingkat {user.level || 1}</p>
                      <span
                        className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full inline-block mt-1 font-mono-ui"
                        style={{ backgroundColor: `${passport.rankColor}20`, color: passport.rankColor }}
                      >
                        {passport.rank}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-white/10 text-xs font-mono-ui">
                    <div className="flex justify-between">
                      <span className="text-white/40">Nomor Paspor:</span>
                      <strong className="text-white">{passport.passportNo}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/40">Gelar Terpasang:</span>
                      <strong className="text-[#d4a73c]">{user?.title || 'Anime Newbie'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/40">Wilayah Ditaklukkan:</span>
                      <strong className="text-[#d4a73c]">{passport.totalConquered} / {passport.totalRealms} Dimensi</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/40">Total Stempel:</span>
                      <strong className="text-sky-300">{passport.stamps.length} Cap Dimensi</strong>
                    </div>
                  </div>

                  <button
                    onClick={handleSharePassport}
                    className="w-full py-2.5 bg-[#d4a73c] text-[#0b0b10] rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 hover:brightness-110 shadow-md shadow-[#d4a73c]/20 transition-all"
                  >
                    <Share2 className="w-4 h-4" />
                    Pamerkan Paspor ke Teman
                  </button>
                </div>

                {/* Right Page: Visa Stamps Grid */}
                <div className="md:col-span-7 space-y-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <h3 className="text-white font-black text-sm uppercase font-mono-ui flex items-center gap-2">
                      <Award className="w-4 h-4 text-[#d4a73c]" /> Lembar Stempel Penaklukan Dimensi
                    </h3>
                    <span className="text-[11px] text-white/40">
                      {passport.stamps.length} dari 8 Wilayah Dicap
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {realms.map((r) => {
                      const hasStamp = passport.stamps.includes(r.stampId);

                      return (
                        <div
                          key={r.stampId}
                          className={`p-4 rounded-2xl border flex flex-col items-center justify-center text-center aspect-square transition-all relative overflow-hidden ${
                            hasStamp
                              ? 'bg-gradient-to-b from-[#d4a73c]/20 to-black/60 border-[#d4a73c]/50 shadow-[0_0_20px_rgba(212,167,60,0.2)]'
                              : 'bg-black/30 border-dashed border-white/10 opacity-40'
                          }`}
                        >
                          {hasStamp ? (
                            <>
                              <div className="w-10 h-10 rounded-full border-2 border-[#d4a73c] flex items-center justify-center text-[#d4a73c] mb-1.5 shadow-md shadow-[#d4a73c]/30">
                                <Award className="w-5 h-5" />
                              </div>
                              <span className="text-[10px] font-black uppercase text-[#d4a73c] font-mono-ui line-clamp-2">
                                {r.stampTitle}
                              </span>
                              <span className="text-[8px] text-white/40 block mt-1 font-mono-ui">
                                TERVERIFIKASI
                              </span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-6 h-6 text-white/20 mb-1" />
                              <span className="text-[9px] text-white/30 font-bold uppercase line-clamp-2">
                                {r.name}
                              </span>
                              <span className="text-[8px] text-white/20 block mt-0.5">Belum Dicap</span>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ─── REALM INSPECTION & CHALLENGE MODAL ─── */}
      {selectedRealm && (
        <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-[#181824] border border-[#d4a73c]/40 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative">
            <button
              onClick={() => setSelectedRealm(null)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-white"
            >
              <Check className="w-4 h-4" />
            </button>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md font-mono-ui"
                  style={{ backgroundColor: `${selectedRealm.color}25`, color: selectedRealm.color }}
                >
                  Landmark: {selectedRealm.landmark}
                </span>
                {selectedRealm.isClaimed && (
                  <span className="text-[10px] font-black text-emerald-400 uppercase flex items-center gap-1 font-mono-ui">
                    <Check className="w-3 h-3" /> Tertaklukkan
                  </span>
                )}
              </div>
              <h3 className="text-white font-black text-xl uppercase font-mono-ui">
                {selectedRealm.name}
              </h3>
              <p className="text-[#d4a73c] text-xs font-bold">{selectedRealm.indonesianTitle}</p>
            </div>

            {/* Guardian Profile Card */}
            {selectedRealm.guardian && (
              <div className="p-3.5 bg-black/60 border border-white/10 rounded-2xl flex items-center gap-3">
                <img
                  src={selectedRealm.guardian.avatar}
                  alt={selectedRealm.guardian.name}
                  className="w-12 h-12 rounded-xl object-cover border border-white/20 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <span className="text-[9px] text-[#d4a73c] uppercase font-mono-ui font-black block">
                    GUARDIAN PENJAGA WILAYAH:
                  </span>
                  <strong className="text-white font-black text-xs block truncate">
                    {selectedRealm.guardian.name}
                  </strong>
                  <span className="text-white/40 text-[10px] block">
                    HP: {selectedRealm.guardian.hp.toLocaleString()} • Jurus: {selectedRealm.guardian.skill}
                  </span>
                </div>
              </div>
            )}

            {/* Permanent Account Buff Provided */}
            {selectedRealm.buff && (
              <div className="p-3 bg-emerald-950/30 border border-emerald-500/40 rounded-2xl flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <span className="text-[9px] text-emerald-400 font-mono-ui font-black uppercase block">
                    BUFF AKUN PERMANEN DIBERIKAN:
                  </span>
                  <strong className="text-white text-xs block font-bold">{selectedRealm.buff.name}</strong>
                  <span className="text-white/50 text-[10px] block">{selectedRealm.buff.desc}</span>
                </div>
              </div>
            )}

            {/* Syarat Penaklukan Wilayah */}
            <div className="p-3.5 bg-black/50 border border-white/10 rounded-2xl space-y-1.5">
              <span className="text-[10px] text-white/40 uppercase font-bold flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-[#d4a73c]" /> Syarat Mengikuti Trial Duel:
              </span>
              <p className={`text-xs font-mono-ui font-bold ${selectedRealm.isReadyToClaim || selectedRealm.isClaimed ? 'text-emerald-400' : 'text-amber-300'}`}>
                {selectedRealm.reqDesc}
              </p>
              {selectedRealm.lockReason && !selectedRealm.isClaimed && (
                <p className="text-[11px] text-red-400 font-medium">
                  {selectedRealm.lockReason}
                </p>
              )}
            </div>

            {/* Action Challenge Button */}
            {selectedRealm.isClaimed ? (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center text-xs text-emerald-400 font-bold font-mono-ui">
                Wilayah ini telah ditaklukkan dan stempel resmi telah tercap di paspor!
              </div>
            ) : selectedRealm.isReadyToClaim ? (
              <button
                onClick={() => handleChallengeRealm(selectedRealm.id)}
                disabled={challenging}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-red-600 via-[#ff4e2d] to-[#d4a73c] text-[#0b0b10] font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] shadow-lg shadow-[#ff4e2d]/30"
              >
                {challenging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Swords className="w-4 h-4" />}
                Tantang Guardian & Rebut Gelar Paspor!
              </button>
            ) : (
              <button
                disabled
                className="w-full py-3 rounded-2xl bg-white/5 border border-white/10 text-white/30 font-bold text-xs uppercase cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                Syarat Trial Belum Terpenuhi
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── GUARDIAN BATTLE SIMULATION MODAL ─── */}
      {battleResult && (
        <div className="fixed inset-0 z-[250] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-[#181824] border-2 border-[#d4a73c] rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-400 to-[#ff4e2d] flex items-center justify-center mx-auto text-[#0b0b10] shadow-lg shadow-amber-400/40">
              <Award className="w-8 h-8" />
            </div>

            <div>
              <span className="text-emerald-400 text-xs font-mono-ui font-black uppercase tracking-widest block">
                VICTORY • UJIAN PENAKLUKAN BERHASIL!
              </span>
              <h3 className="text-white font-black text-2xl uppercase font-mono-ui mt-1">
                {battleResult.guardian.name} Tumbang!
              </h3>
              <p className="text-[#d4a73c] text-xs font-bold mt-0.5">
                Wilayah {battleResult.realm.name} Resmi Ditaklukkan!
              </p>
            </div>

            {/* Combat Rounds Recap */}
            <div className="space-y-2 max-h-48 overflow-y-auto p-1 scrollbar-none">
              {(battleResult.combatRounds || []).map((r, i) => (
                <div key={i} className="p-2.5 bg-black/50 border border-white/5 rounded-xl flex items-center justify-between text-xs font-mono-ui">
                  <div className="text-left">
                    <span className="text-white/40 block text-[10px]">Ronde {r.round}:</span>
                    <strong className="text-white">{r.cardName}</strong>
                    {r.guardianSkill && <span className="text-red-400 text-[9px] block">Boss Skill: {r.guardianSkill}</span>}
                  </div>
                  <div className="text-right">
                    <span className="text-[#d4a73c] font-black text-sm">+{r.damage.toLocaleString()} DMG</span>
                    {r.crit && <span className="text-red-400 text-[9px] block font-bold">CRITICAL!</span>}
                  </div>
                </div>
              ))}
            </div>

            {/* Rewards & Permanent Buff Activated */}
            <div className="p-4 bg-black/60 border border-[#d4a73c]/40 rounded-2xl text-left space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-white/50">Hadiah Penaklukan:</span>
                <span className="text-emerald-400 font-black font-mono-ui">
                  +{battleResult.rewards.coins} Koin • +{battleResult.rewards.tickets} Tiket
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-white/50">Gelar Profil Baru:</span>
                <strong className="text-[#d4a73c] font-mono-ui font-black">{battleResult.newTitle}</strong>
              </div>
              {battleResult.buff && (
                <div className="pt-2 border-t border-white/10 flex items-center gap-2 text-xs text-emerald-300">
                  <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Buff Aktif: <strong>{battleResult.buff.name}</strong> ({battleResult.buff.desc})</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={handleSharePassport}
                className="py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all"
              >
                <Share2 className="w-4 h-4" />
                Pamerkan
              </button>
              <button
                onClick={() => setBattleResult(null)}
                className="py-3 rounded-2xl bg-[#d4a73c] text-[#0b0b10] font-black text-xs uppercase tracking-wider hover:brightness-110 shadow-lg shadow-[#d4a73c]/30 transition-all"
              >
                Tutup & Lihat Peta
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default IsekaiMap;
