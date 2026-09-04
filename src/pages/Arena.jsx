import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Swords,
  Shield,
  ShieldCheck,
  Award,
  Crown,
  Zap,
  Flame,
  Sparkles,
  Trophy,
  Play,
  FastForward,
  RotateCcw,
  Check,
  X,
  AlertCircle,
  Dices,
  Lock,
  ChevronRight,
  TrendingUp,
  User,
  Star,
  RefreshCw,
  Clock,
  Plus
} from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import AvatarFrame from '../components/AvatarFrame';
import AvatarAura from '../components/AvatarAura';
import { CARDS_DATABASE, getCardById, calculateCardCP, ELEMENTS, RARITY_CONFIG } from '../utils/cardsData';
import {
  PVE_TOWER_FLOORS,
  ARENA_RANKS,
  getArenaRank,
  getElementMultiplier
} from '../utils/arenaData';

// Web Audio API Sound Synthesizer Singleton for Battle FX
let battleAudioCtx = null;
const getBattleAudio = () => {
  if (!battleAudioCtx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) battleAudioCtx = new AudioCtx();
  }
  if (battleAudioCtx && battleAudioCtx.state === 'suspended') {
    battleAudioCtx.resume().catch(() => {});
  }
  return battleAudioCtx;
};

const playSfx = (type = 'hit') => {
  try {
    const ctx = getBattleAudio();
    if (!ctx) return;

    if (type === 'hit') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } else if (type === 'crit') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } else if (type === 'ult') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === 'win') {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        setTimeout(() => {
          if (!ctx) return;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime);
          gain.gain.setValueAtTime(0.25, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.25);
        }, i * 120);
      });
    }
  } catch {}
};

const Arena = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('pve'); // 'pve' | 'pvp' | 'deck' | 'leaderboard'
  const [loading, setLoading] = useState(true);
  const [statusData, setStatusData] = useState(null);
  const [opponents, setOpponents] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [allOwnedCards, setAllOwnedCards] = useState([]);
  const [editingDeck, setEditingDeck] = useState([]);
  const [savingDeck, setSavingDeck] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Selected PVE Floor for preview
  const [selectedFloor, setSelectedFloor] = useState(1);

  // Battle Simulator Modal States
  const [activeBattle, setActiveBattle] = useState(null); // { mode: 'pve'|'pvp', opponentName, opponentCards, combatLog, victory, rewards, rpChange }
  const [battleRoundIdx, setBattleRoundIdx] = useState(0);
  const [battleSpeed, setBattleSpeed] = useState(1); // 1 | 2
  const [isBattleFinished, setIsBattleFinished] = useState(false);
  const [energyTimer, setEnergyTimer] = useState(0);
  const battleTimerRef = useRef(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/v1/arena/status', { credentials: 'include' });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatusData(data);
        setSelectedFloor(data.arena.pveFloor || 1);
        setEditingDeck(data.arena.deckIds || []);
        if (data.arena.nextEnergyInSeconds) {
          setEnergyTimer(data.arena.nextEnergyInSeconds);
        }
      } else if (res.status === 401) {
        navigate('/login?redirect=/arena');
      }
    } catch (e) {
      console.error('Fetch arena status error:', e);
    } finally {
      setLoading(false);
    }
  };

  // Live Timer Countdown (+1 Energi per 20 menit)
  useEffect(() => {
    if (energyTimer <= 0) return;
    const interval = setInterval(() => {
      setEnergyTimer((prev) => {
        if (prev <= 1) {
          fetchStatus();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [energyTimer]);

  const formatCountdown = (totalSec) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const fetchCollection = async () => {
    try {
      const res = await fetch('/api/v1/gacha/collection', { credentials: 'include' });
      const data = await res.json();
      if (res.ok && data.success) {
        setAllOwnedCards(data.collection.filter((c) => c.isUnlocked));
      }
    } catch (e) {
      console.error('Fetch collection error:', e);
    }
  };

  const fetchOpponents = async () => {
    try {
      const res = await fetch('/api/v1/arena/pvp-opponents', { credentials: 'include' });
      const data = await res.json();
      if (res.ok && data.success) {
        setOpponents(data.opponents || []);
      }
    } catch (e) {
      console.error('Fetch opponents error:', e);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch('/api/v1/arena/leaderboard');
      const data = await res.json();
      if (res.ok && data.success) {
        setLeaderboard(data.leaderboard || []);
      }
    } catch (e) {
      console.error('Fetch leaderboard error:', e);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchCollection();
  }, []);

  useEffect(() => {
    if (activeTab === 'pvp') fetchOpponents();
    if (activeTab === 'leaderboard') fetchLeaderboard();
  }, [activeTab]);

  const showToast = (text, type = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Simpan Deck Baru
  const handleSaveDeck = async () => {
    if (editingDeck.length !== 3) {
      showToast('Pilih tepat 3 kartu untuk deck pertempuran', 'error');
      return;
    }
    setSavingDeck(true);
    try {
      const res = await fetch('/api/v1/arena/deck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ cardIds: editingDeck })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Deck pertempuran berhasil disimpan!');
        fetchStatus();
      } else {
        showToast(data.error || 'Gagal menyimpan deck', 'error');
      }
    } catch (e) {
      showToast('Gagal terhubung ke server', 'error');
    } finally {
      setSavingDeck(false);
    }
  };

  // Toggle Kartu di Deck Builder
  const handleToggleDeckCard = (cardId) => {
    if (editingDeck.includes(cardId)) {
      setEditingDeck(editingDeck.filter((id) => id !== cardId));
    } else {
      if (editingDeck.length >= 3) {
        showToast('Deck maksimal 3 kartu. Hapus kartu lain terlebih dahulu', 'error');
        return;
      }
      setEditingDeck([...editingDeck, cardId]);
    }
  };

  // Memulai Battle PVE
  const handleStartPveBattle = async () => {
    if ((statusData?.arena?.energy || 0) < 1) {
      showToast('Energi habis! Tunggu regenerasi energi.', 'error');
      return;
    }

    try {
      const res = await fetch('/api/v1/arena/pve-battle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ floor: selectedFloor })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const floorBoss = PVE_TOWER_FLOORS[selectedFloor - 1];
        startBattleSimulation({
          mode: 'pve',
          title: `Tower of Eternity • Lantai ${selectedFloor}`,
          opponentName: floorBoss.name,
          opponentSubtitle: floorBoss.title,
          opponentElement: floorBoss.element,
          opponentCover: floorBoss.cover,
          combatLog: data.battleResult.combatLog,
          victory: data.victory,
          rewards: data.rewards,
          initialT1Hp: data.battleResult.team1.initialHp,
          initialT2Hp: data.battleResult.team2.initialHp
        });
        fetchStatus();
      } else {
        showToast(data.error || 'Gagal memulai pertempuran', 'error');
      }
    } catch (e) {
      showToast('Gagal memulai pertempuran', 'error');
    }
  };

  // Memulai Battle PVP
  const handleStartPvpBattle = async (opponent) => {
    if ((statusData?.arena?.energy || 0) < 1) {
      showToast('Energi habis! Tunggu regenerasi energi.', 'error');
      return;
    }

    try {
      const res = await fetch('/api/v1/arena/pvp-battle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          targetUserId: opponent.userId,
          isBot: opponent.isBot,
          botDeck: opponent.deck
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        startBattleSimulation({
          mode: 'pvp',
          title: `Ranked Colosseum • vs ${opponent.name}`,
          opponentName: opponent.name,
          opponentSubtitle: opponent.title,
          opponentAvatar: opponent.picture,
          opponentDeck: opponent.deck,
          combatLog: data.battleResult.combatLog,
          victory: data.victory,
          rewards: data.rewards,
          rpChange: data.rpChange,
          newRp: data.newRp,
          initialT1Hp: data.battleResult.team1.initialHp,
          initialT2Hp: data.battleResult.team2.initialHp
        });
        fetchStatus();
      } else {
        showToast(data.error || 'Gagal memulai duel PVP', 'error');
      }
    } catch (e) {
      showToast('Gagal memulai duel PVP', 'error');
    }
  };

  // Inisialisasi Simulator Pertarungan
  const startBattleSimulation = (battlePayload) => {
    getBattleAudio();
    setActiveBattle(battlePayload);
    setBattleRoundIdx(0);
    setIsBattleFinished(false);
  };

  // Loop Step Simulator
  useEffect(() => {
    if (!activeBattle || isBattleFinished) return;

    const log = activeBattle.combatLog;
    if (battleRoundIdx >= log.length) {
      setIsBattleFinished(true);
      if (activeBattle.victory) playSfx('win');
      return;
    }

    const currentStep = log[battleRoundIdx];
    if (currentStep.isUlt) {
      playSfx('ult');
    } else if (currentStep.isCrit) {
      playSfx('crit');
    } else {
      playSfx('hit');
    }

    const intervalMs = (currentStep.isUlt ? 1400 : 750) / battleSpeed;

    battleTimerRef.current = setTimeout(() => {
      setBattleRoundIdx((prev) => prev + 1);
    }, intervalMs);

    return () => clearTimeout(battleTimerRef.current);
  }, [activeBattle, battleRoundIdx, battleSpeed, isBattleFinished]);

  const handleSkipBattle = () => {
    if (!activeBattle) return;
    clearTimeout(battleTimerRef.current);
    setBattleRoundIdx(activeBattle.combatLog.length);
    setIsBattleFinished(true);
    if (activeBattle.victory) playSfx('win');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0b10] text-white flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-3 border-[#d4a73c] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="font-bold text-sm text-white/50">Memasuki Gacha Card Auto-Battle Arena...</p>
        </div>
      </div>
    );
  }

  const arenaUser = statusData?.arena || {};
  const currentRank = arenaUser.rankTier || ARENA_RANKS[0];
  const currentDeckCards = arenaUser.deckCards || [];
  const totalDeckCp = currentDeckCards.reduce((acc, c) => acc + calculateCardCP(c, c.stars), 0);
  const curFloorBoss = PVE_TOWER_FLOORS[selectedFloor - 1] || PVE_TOWER_FLOORS[0];

  return (
    <div className="min-h-screen bg-[#0b0b10] text-white flex flex-col justify-between pt-24 pb-16 font-nunito">
      <Navbar />

      {toastMessage && (
        <div className="fixed top-24 right-4 z-50 animate-[fadeIn_0.2s_ease-out]">
          <div
            className={`px-4 py-3 rounded-xl border flex items-center gap-2.5 shadow-2xl ${
              toastMessage.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/90 border-rose-500/40 text-rose-300'
            }`}
          >
            {toastMessage.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span className="text-xs font-bold">{toastMessage.text}</span>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 w-full flex-1 space-y-8">
        {/* ===== HERO STATUS BANNER ===== */}
        <div className="bg-gradient-to-br from-[#181826] via-[#12121c] to-[#0a0a10] border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#ff4e2d]/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-[#d4a73c]/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              {/* Rank Badge Emblem */}
              <div
                className={`w-20 h-20 md:w-24 md:h-24 rounded-3xl ${currentRank.bgColor} border-2 ${currentRank.borderColor} flex flex-col items-center justify-center shadow-xl shrink-0 relative`}
              >
                <Crown className={`w-8 h-8 md:w-10 md:h-10 ${currentRank.badgeColor}`} />
                <span className={`text-[10px] md:text-xs font-black font-mono-ui uppercase mt-1 ${currentRank.badgeColor}`}>
                  {currentRank.tier}
                </span>
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl md:text-3xl font-black font-display text-white tracking-wide">
                    GACHA CARD BATTLE ARENA
                  </h1>
                </div>
                <p className="text-white/50 text-xs md:text-sm mt-0.5">
                  Adu taktik sinergi elemen deck 3 kartu terbaikmu di PVE Tower of Eternity & Ranked Colosseum!
                </p>

                {/* Stat Badges */}
                <div className="flex items-center gap-3 mt-3 flex-wrap text-xs">
                  <span className="px-3 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono-ui font-black flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-amber-400" />
                    {arenaUser.rp || 1000} RP
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-3 py-1 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-300 font-mono-ui font-black flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-sky-400" />
                      Energi: {arenaUser.energy}/10
                    </span>
                    {arenaUser.energy < 10 && energyTimer > 0 && (
                      <span className="px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-white/60 text-[11px] font-mono-ui flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-amber-400" />
                        +1 dalam {formatCountdown(energyTimer)}
                      </span>
                    )}
                  </div>
                  <span className="px-3 py-1 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 font-mono-ui font-black flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
                    Tower: Lantai {arenaUser.pveFloor || 1}/50
                  </span>
                  <span className="px-3 py-1 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 font-mono-ui font-black">
                    Menang: {arenaUser.wins || 0} • Kalah: {arenaUser.losses || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Deck Info */}
            <div className="bg-black/50 border border-white/10 rounded-2xl p-4 flex items-center gap-4 shrink-0">
              <div className="text-right">
                <span className="text-[10px] text-white/40 font-mono-ui uppercase block">TOTAL POWER (CP)</span>
                <span className="text-xl font-mono-ui font-black text-amber-400">
                  {totalDeckCp.toLocaleString()} CP
                </span>
              </div>
              <div className="flex -space-x-3">
                {currentDeckCards.map((c) => (
                  <img
                    key={c.id}
                    src={c.image}
                    alt={c.name}
                    className="w-12 h-16 object-cover rounded-lg border-2 border-white/20 shadow-md"
                    onError={(e) => { e.target.src = '/img/welcomebanner.webp'; }}
                  />
                ))}
              </div>
              <button
                onClick={() => setActiveTab('deck')}
                className="px-3 py-2 rounded-xl bg-[#d4a73c] text-[#0b0b10] font-black text-xs hover:brightness-110"
              >
                Ganti Deck
              </button>
            </div>
          </div>
        </div>

        {/* ===== TAB NAVIGATION ===== */}
        <div className="flex items-center gap-2 border-b border-white/10 pb-3 overflow-x-auto">
          {[
            { id: 'pve', label: 'PVE Tower of Eternity (50 Lantai)', icon: Zap },
            { id: 'pvp', label: 'PVP Ranked Colosseum', icon: Swords },
            { id: 'deck', label: 'Deck Builder (Atur 3 Kartu)', icon: Shield },
            { id: 'leaderboard', label: 'Global Leaderboard (Top 50)', icon: Trophy }
          ].map((tab) => {
            const Icon = tab.icon;
            const isSel = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm flex items-center gap-2 transition-all shrink-0 ${
                  isSel
                    ? 'bg-[#d4a73c] text-[#0b0b10] shadow-lg shadow-[#d4a73c]/20'
                    : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}

          <button
            onClick={() => navigate('/raid')}
            className="px-4 py-2.5 rounded-xl font-black text-xs md:text-sm flex items-center gap-2 bg-gradient-to-r from-red-600 via-[#ff4e2d] to-[#d4a73c] text-[#0b0b10] hover:brightness-110 shadow-lg shadow-red-500/25 shrink-0 uppercase tracking-wider transition-all"
          >
            <Flame className="w-4 h-4" />
            <span>World Boss Raid</span>
          </button>

          <button
            onClick={() => navigate('/tournament')}
            className="px-4 py-2.5 rounded-xl font-black text-xs md:text-sm flex items-center gap-2 bg-gradient-to-r from-amber-400 via-[#d4a73c] to-[#ff4e2d] text-[#0b0b10] hover:brightness-110 shadow-lg shadow-amber-500/25 shrink-0 uppercase tracking-wider transition-all"
          >
            <Trophy className="w-4 h-4" />
            <span>Turnamen 16 Besar</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: PVE TOWER OF ETERNITY                                              */}
        {/* ========================================================================= */}
        {activeTab === 'pve' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-[fadeIn_0.2s_ease-out]">
            {/* Left: Floor Selector List */}
            <div className="bg-[#141420] border border-white/10 rounded-2xl p-5 space-y-3 lg:max-h-[600px] overflow-y-auto">
              <h3 className="text-white font-black text-sm uppercase tracking-wider flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                PILIH LANTAI DUNGEON
              </h3>
              <p className="text-white/40 text-xs">
                Kalahkan setiap Guardian Lantai untuk klaim koin gacha, tiket, dan EXP!
              </p>

              <div className="space-y-2 pt-2">
                {PVE_TOWER_FLOORS.map((f) => {
                  const unlocked = f.floor <= (arenaUser.pveFloor || 1);
                  const isSelected = selectedFloor === f.floor;
                  const isCleared = f.floor < (arenaUser.pveFloor || 1);

                  return (
                    <button
                      key={f.floor}
                      type="button"
                      onClick={() => unlocked && setSelectedFloor(f.floor)}
                      disabled={!unlocked}
                      className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                        isSelected
                          ? 'bg-[#d4a73c]/15 border-[#d4a73c] shadow-lg shadow-[#d4a73c]/10'
                          : unlocked
                          ? 'bg-white/[0.02] border-white/10 hover:bg-white/[0.06]'
                          : 'bg-white/[0.01] border-white/5 opacity-30 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center font-black font-mono-ui text-xs shrink-0 ${
                            isSelected
                              ? 'bg-[#d4a73c] text-black'
                              : isCleared
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-white/10 text-white/60'
                          }`}
                        >
                          {f.floor}
                        </div>
                        <div className="min-w-0">
                          <h5 className="text-white font-bold text-xs truncate">{f.name}</h5>
                          <span className="text-white/40 text-[10px] block truncate">{f.title}</span>
                        </div>
                      </div>

                      {isCleared ? (
                        <span className="text-[10px] font-mono-ui font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          CLEARED
                        </span>
                      ) : !unlocked ? (
                        <Lock className="w-3.5 h-3.5 text-white/40 shrink-0" />
                      ) : (
                        <span className="text-[10px] font-mono-ui font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          CHALLENGE
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: Boss Preview & Challenge Button */}
            <div className="lg:col-span-2 bg-[#141420] border border-white/10 rounded-2xl p-6 md:p-8 flex flex-col justify-between space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-[#d4a73c]/10 via-transparent to-transparent pointer-events-none" />

              <div>
                <div className="flex items-center justify-between gap-4 flex-wrap pb-4 border-b border-white/10">
                  <div>
                    <span className="text-amber-400 text-xs font-mono-ui font-black uppercase">
                      FLOOR {curFloorBoss.floor} OF 50 • {curFloorBoss.anime}
                    </span>
                    <h2 className="text-2xl md:text-3xl font-black text-white mt-0.5">{curFloorBoss.name}</h2>
                    <p className="text-white/50 text-xs font-medium">{curFloorBoss.title}</p>
                  </div>
                  <div className="px-3.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold flex items-center gap-2">
                    <span className="text-white/40">Elemen Boss:</span>
                    <span className="text-amber-300 font-black uppercase font-mono-ui">{curFloorBoss.element}</span>
                  </div>
                </div>

                {/* Boss Attributes Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-6">
                  <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 text-center">
                    <span className="text-white/40 text-[10px] font-mono-ui uppercase block">HEALTH POINTS (HP)</span>
                    <span className="text-lg font-black font-mono-ui text-emerald-400">
                      {curFloorBoss.hp.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 text-center">
                    <span className="text-white/40 text-[10px] font-mono-ui uppercase block">ATTACK POWER (ATK)</span>
                    <span className="text-lg font-black font-mono-ui text-rose-400">
                      {curFloorBoss.atk.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 text-center">
                    <span className="text-white/40 text-[10px] font-mono-ui uppercase block">DEFENSE (DEF)</span>
                    <span className="text-lg font-black font-mono-ui text-sky-400">
                      {curFloorBoss.def.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Boss Ultimate Skill */}
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1 mb-6">
                  <div className="flex items-center gap-2 text-amber-300 text-xs font-black uppercase">
                    <Sparkles className="w-3.5 h-3.5" />
                    Jurus Andalan: {curFloorBoss.skill}
                  </div>
                  <p className="text-white/70 text-xs italic">"{curFloorBoss.quote}"</p>
                </div>

                {/* First Clear Rewards */}
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                  <span className="text-white/50 text-[11px] font-bold uppercase tracking-wider block">
                    HADIAH MENANG LANTAI {curFloorBoss.floor}:
                  </span>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="px-3 py-1 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 font-mono-ui font-black text-xs">
                      +{curFloorBoss.rewards.coins} Koin Gacha
                    </span>
                    <span className="px-3 py-1 rounded-lg bg-sky-500/20 border border-sky-500/30 text-sky-300 font-mono-ui font-black text-xs">
                      +{curFloorBoss.rewards.exp} User EXP
                    </span>
                    {curFloorBoss.rewards.tickets > 0 && (
                      <span className="px-3 py-1 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-300 font-mono-ui font-black text-xs">
                        +{curFloorBoss.rewards.tickets} Tiket Gacha
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={handleStartPveBattle}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#d4a73c] via-[#ff4e2d] to-[#ec4899] text-[#0b0b10] font-black text-sm md:text-base hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 uppercase tracking-wider shadow-lg shadow-[#d4a73c]/20"
              >
                <Swords className="w-5 h-5" />
                TANTANG BOSS LANTAI {curFloorBoss.floor} (1 ENERGI)
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: PVP RANKED COLOSSEUM                                               */}
        {/* ========================================================================= */}
        {activeTab === 'pvp' && (
          <div className="space-y-6 animate-[fadeIn_0.2s_ease-out]">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-white font-black text-base md:text-lg">TANTANG DUEL RIVAL COLOSSEUM</h3>
                <p className="text-white/40 text-xs">
                  Kalahkan deck pemain lain untuk menaikkan Ranking Point (RP) dan memperebutkan Tier Champion!
                </p>
              </div>
              <button
                onClick={fetchOpponents}
                className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Cari Rival Baru
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {opponents.map((op) => {
                const opRank = op.rankTier || ARENA_RANKS[0];
                const opCp = (op.deck || []).reduce((acc, c) => acc + calculateCardCP(c, c.stars), 0);

                return (
                  <div
                    key={op.userId}
                    className="bg-[#141420] border border-white/10 hover:border-amber-500/40 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-xl relative overflow-hidden transition-all hover:scale-[1.01]"
                  >
                    <div className="flex items-center gap-3.5">
                      <AvatarAura auraId={op.aura || 'none'}>
                        <AvatarFrame frameId={op.frame || 'none'} className="w-13 h-13">
                          <img
                            src={
                              op.picture ||
                              `https://ui-avatars.com/api/?name=${encodeURIComponent(op.name)}&background=d4a73c&color=0b0b10`
                            }
                            alt={op.name}
                            className="w-full h-full object-cover"
                            onError={(e) => { e.target.src = '/img/welcomebanner.webp'; }}
                          />
                        </AvatarFrame>
                      </AvatarAura>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[9px] font-mono-ui font-black px-1.5 py-0.5 rounded ${opRank.bgColor} ${opRank.badgeColor} uppercase`}>
                            {opRank.tier}
                          </span>
                          <span className="text-amber-400 text-[10px] font-mono-ui font-black">
                            {op.rp} RP
                          </span>
                        </div>
                        <h4 className="text-white font-black text-sm truncate mt-0.5">{op.name}</h4>
                        <span className="text-white/40 text-[10px] truncate block">{op.title}</span>
                      </div>
                    </div>

                    {/* Defense Deck Preview */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-white/40 font-mono-ui uppercase">DEFENSE DECK</span>
                        <span className="text-amber-400 font-mono-ui font-bold">{opCp.toLocaleString()} CP</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {(op.deck || []).map((c, i) => (
                          <div key={i} className="relative rounded-lg overflow-hidden border border-white/10 aspect-[3/4.2]">
                            <img
                              src={c.image}
                              alt={c.name}
                              className="w-full h-full object-cover"
                              onError={(e) => { e.target.src = '/img/welcomebanner.webp'; }}
                            />
                            <div className="absolute bottom-0 inset-x-0 bg-black/70 px-1 py-0.5 text-[8px] font-bold text-center truncate">
                              {c.name}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Battle Button */}
                    <button
                      onClick={() => handleStartPvpBattle(op)}
                      className="w-full py-3 rounded-xl bg-[#d4a73c] text-[#0b0b10] font-black text-xs hover:bg-[#ff4e2d] active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 uppercase tracking-wider"
                    >
                      <Swords className="w-4 h-4" />
                      TANTANG DUEL (+28 RP)
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: DECK BUILDER                                                       */}
        {/* ========================================================================= */}
        {activeTab === 'deck' && (
          <div className="space-y-6 animate-[fadeIn_0.2s_ease-out]">
            {/* Active Deck Preview Bar */}
            <div className="bg-[#141420] border border-white/10 rounded-2xl p-5 md:p-6 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="text-white font-black text-base">DECK PERTEMPURAN AKTIF (3 KARTU)</h3>
                  <p className="text-white/40 text-xs">Pilih 3 kartu terkuat dari koleksi gacha milikmu di bawah ini.</p>
                </div>
                <button
                  onClick={handleSaveDeck}
                  disabled={savingDeck || editingDeck.length !== 3}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#d4a73c] to-[#ff4e2d] text-[#0b0b10] font-black text-xs uppercase tracking-wider hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {savingDeck ? 'Menyimpan...' : 'Simpan Deck Pertempuran'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[0, 1, 2].map((slotIdx) => {
                  const cardId = editingDeck[slotIdx];
                  const card = cardId ? getCardById(cardId) : null;

                  if (!card) {
                    return (
                      <div
                        key={slotIdx}
                        className="border-2 border-dashed border-white/15 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[160px] text-center bg-white/[0.01]"
                      >
                        <Plus className="w-6 h-6 text-white/30 mb-1" />
                        <span className="text-xs text-white/40 font-bold">Slot Kartu {slotIdx + 1} Kosong</span>
                        <span className="text-[10px] text-white/25 mt-0.5">Klik kartu di bawah untuk memasukkan</span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={slotIdx}
                      className="bg-[#1a1a28] border border-amber-500/40 rounded-2xl p-3.5 flex gap-3 shadow-lg relative overflow-hidden"
                    >
                      <img
                        src={card.image}
                        alt={card.name}
                        className="w-16 h-22 object-cover rounded-xl border border-white/20 shrink-0"
                        onError={(e) => { e.target.src = '/img/welcomebanner.webp'; }}
                      />
                      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                        <div>
                          <span className="text-[9px] font-mono-ui font-black text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                            {card.rarity} • {card.element}
                          </span>
                          <h4 className="text-white font-black text-xs truncate mt-1">{card.name}</h4>
                          <span className="text-white/40 text-[10px] truncate block">{card.anime}</span>
                        </div>
                        <button
                          onClick={() => handleToggleDeckCard(card.id)}
                          className="text-rose-400 hover:text-rose-300 text-[10px] font-bold text-left"
                        >
                          Lepas dari Deck
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Owned Collection Selector Grid */}
            <div className="space-y-3">
              <h4 className="text-white font-black text-sm uppercase tracking-wider">
                KOLEKSI KARTU TERBUKA ({allOwnedCards.length})
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {allOwnedCards.map((c) => {
                  const isSelected = editingDeck.includes(c.id);
                  return (
                    <div
                      key={c.id}
                      onClick={() => handleToggleDeckCard(c.id)}
                      className={`p-2.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                        isSelected
                          ? 'bg-[#d4a73c]/15 border-[#d4a73c] shadow-lg shadow-[#d4a73c]/20 scale-[1.02]'
                          : 'bg-[#141420] border-white/10 hover:border-white/25 hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="relative aspect-[3/4.2] rounded-xl overflow-hidden mb-2">
                        <img
                          src={c.image}
                          alt={c.name}
                          className="w-full h-full object-cover"
                          onError={(e) => { e.target.src = '/img/welcomebanner.webp'; }}
                        />
                        <span className="absolute top-1 right-1 text-[8px] font-mono-ui font-black px-1.5 py-0.5 rounded bg-black/80 text-amber-300">
                          {c.rarity}
                        </span>
                        {isSelected && (
                          <div className="absolute inset-0 bg-[#d4a73c]/40 flex items-center justify-center">
                            <Check className="w-6 h-6 text-black font-black" strokeWidth={3} />
                          </div>
                        )}
                      </div>

                      <div>
                        <h5 className="text-white font-black text-[11px] truncate">{c.name}</h5>
                        <div className="flex items-center justify-between text-[9px] text-white/40 mt-0.5">
                          <span>{c.element}</span>
                          <span className="text-amber-400 font-bold">{calculateCardCP(c, c.stars)} CP</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: GLOBAL LEADERBOARD                                                 */}
        {/* ========================================================================= */}
        {activeTab === 'leaderboard' && (
          <div className="bg-[#141420] border border-white/10 rounded-2xl p-5 md:p-6 space-y-4 animate-[fadeIn_0.2s_ease-out]">
            <div>
              <h3 className="text-white font-black text-base md:text-lg flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                GLOBAL ARENA LEADERBOARD
              </h3>
              <p className="text-white/40 text-xs">Peringkat 50 duelists terkuat di seluruh jagat Ndika-Nime.</p>
            </div>

            <div className="space-y-2">
              {leaderboard.map((player) => {
                const rankTier = player.rankTier || ARENA_RANKS[0];
                const isTop3 = player.rank <= 3;

                return (
                  <div
                    key={player.userId}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
                      isTop3
                        ? 'bg-gradient-to-r from-[#d4a73c]/15 via-white/[0.02] to-transparent border-[#d4a73c]/40'
                        : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05]'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center font-mono-ui font-black text-xs shrink-0 ${
                          player.rank === 1
                            ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/30'
                            : player.rank === 2
                            ? 'bg-slate-300 text-black'
                            : player.rank === 3
                            ? 'bg-amber-600 text-white'
                            : 'bg-white/10 text-white/50'
                        }`}
                      >
                        {player.rank}
                      </div>

                      <AvatarAura auraId={player.aura || 'none'}>
                        <AvatarFrame frameId={player.frame || 'none'} className="w-10 h-10">
                          <img
                            src={
                              player.picture ||
                              `https://ui-avatars.com/api/?name=${encodeURIComponent(player.name)}&background=d4a73c&color=0b0b10`
                            }
                            alt={player.name}
                            className="w-full h-full object-cover"
                            onError={(e) => { e.target.src = '/img/welcomebanner.webp'; }}
                          />
                        </AvatarFrame>
                      </AvatarAura>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-white font-black text-xs md:text-sm truncate">{player.name}</h4>
                          <span className={`text-[8px] font-mono-ui font-black px-1.5 py-0.2 rounded ${rankTier.bgColor} ${rankTier.badgeColor} uppercase`}>
                            {rankTier.tier}
                          </span>
                        </div>
                        <span className="text-white/40 text-[10px] truncate block">{player.title}</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-amber-400 font-mono-ui font-black text-sm block">
                        {player.rp} RP
                      </span>
                      <span className="text-white/40 text-[10px] font-mono-ui">
                        Lantai {player.pveFloor || 1} • {player.wins || 0}W/{player.losses || 0}L
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* LIVE BATTLE SIMULATOR MODAL                                               */}
      {/* ========================================================================= */}
      {activeBattle && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#12121c] border-2 border-amber-500/40 rounded-3xl w-full max-w-4xl p-6 md:p-8 space-y-6 shadow-[0_0_60px_rgba(212,167,60,0.25)] relative overflow-hidden text-center">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <span className="text-amber-400 text-xs font-mono-ui font-black uppercase tracking-wider block">
                  {activeBattle.title}
                </span>
                <h3 className="text-white font-black text-lg md:text-xl">
                  {currentDeckCards.map((c) => c.name).join(' & ')} VS {activeBattle.opponentName}
                </h3>
              </div>

              {/* Battle Speed & Skip Controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setBattleSpeed((s) => (s === 1 ? 2 : 1))}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono-ui font-bold text-xs flex items-center gap-1"
                >
                  <FastForward className="w-3.5 h-3.5" /> {battleSpeed}x Speed
                </button>
                <button
                  onClick={handleSkipBattle}
                  className="px-3.5 py-1.5 rounded-xl bg-[#d4a73c] text-black font-black text-xs hover:brightness-110"
                >
                  Skip Langsung
                </button>
              </div>
            </div>

            {/* Health Bars & Combatants */}
            {(() => {
              const currentStep = activeBattle.combatLog[Math.min(activeBattle.combatLog.length - 1, battleRoundIdx)] || activeBattle.combatLog[0];
              const t1Percent = currentStep ? currentStep.t1HpPercent : 100;
              const t2Percent = currentStep ? currentStep.t2HpPercent : 100;

              return (
                <div className="grid grid-cols-2 gap-6 bg-black/50 p-4 rounded-2xl border border-white/10">
                  {/* Left: Player Team */}
                  <div className="space-y-2 text-left">
                    <div className="flex items-center justify-between text-xs font-black">
                      <span className="text-emerald-400">TIM KAMU</span>
                      <span className="font-mono-ui text-white">{currentStep.t1Hp.toLocaleString()} HP</span>
                    </div>
                    <div className="w-full h-3 bg-neutral-800 rounded-full overflow-hidden border border-white/10">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                        style={{ width: `${Math.max(0, t1Percent)}%` }}
                      />
                    </div>
                  </div>

                  {/* Right: Opponent / Boss */}
                  <div className="space-y-2 text-right">
                    <div className="flex items-center justify-between text-xs font-black">
                      <span className="font-mono-ui text-white">{currentStep.t2Hp.toLocaleString()} HP</span>
                      <span className="text-rose-400 uppercase">{activeBattle.opponentName}</span>
                    </div>
                    <div className="w-full h-3 bg-neutral-800 rounded-full overflow-hidden border border-white/10">
                      <div
                        className="h-full bg-gradient-to-l from-rose-500 to-orange-400 transition-all duration-300"
                        style={{ width: `${Math.max(0, t2Percent)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Battle Stage Action Banner */}
            {(() => {
              const currentStep = activeBattle.combatLog[Math.min(activeBattle.combatLog.length - 1, battleRoundIdx)];
              if (!currentStep) return null;

              return (
                <div className="min-h-[140px] flex flex-col items-center justify-center p-4 bg-gradient-to-b from-white/[0.04] to-transparent border border-white/10 rounded-2xl space-y-2">
                  <span className="text-[10px] font-mono-ui font-black uppercase text-amber-400">
                    ROUND {currentStep.round} • TURN: {currentStep.turn === 'player' ? 'TIM KAMU MENYERANG' : 'LAWANG MENYERANG'}
                  </span>

                  {currentStep.isUlt && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-black uppercase animate-pulse">
                      <Flame className="w-3.5 h-3.5" /> ULTIMATE BURST: {currentStep.ultSkill}
                    </div>
                  )}

                  <h4 className="text-white font-black text-base md:text-lg">
                    {currentStep.attackerName} menyerang {currentStep.defenderName}!
                  </h4>

                  <div className="flex items-center gap-2">
                    <span className="text-2xl md:text-3xl font-mono-ui font-black text-amber-400">
                      -{currentStep.damage.toLocaleString()} DMG
                    </span>
                    {currentStep.isCrit && (
                      <span className="text-xs font-black font-mono-ui text-rose-400 bg-rose-500/15 px-2 py-0.5 rounded border border-rose-500/30">
                        CRITICAL!
                      </span>
                    )}
                    {currentStep.elemMult > 1.0 && (
                      <span className="text-xs font-black font-mono-ui text-sky-400 bg-sky-500/15 px-2 py-0.5 rounded border border-sky-500/30">
                        SUPER EFFECTIVE!
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Outcome Modal Footer */}
            {isBattleFinished && (
              <div className="p-6 bg-[#181826] border border-amber-500/40 rounded-2xl space-y-4 animate-[fadeIn_0.3s_ease-out]">
                <h3
                  className={`text-2xl md:text-3xl font-black font-display tracking-wider ${
                    activeBattle.victory ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {activeBattle.victory ? 'VICTORY • KEMENANGAN TELAK!' : 'DEFEAT • PERTAHANAN RUNTUH!'}
                </h3>

                {activeBattle.victory && activeBattle.rewards && (
                  <div className="flex items-center justify-center gap-3 flex-wrap text-xs">
                    <span className="px-3 py-1 rounded-lg bg-amber-500/20 text-amber-300 font-mono-ui font-black border border-amber-500/30">
                      +{activeBattle.rewards.coins} Koin Gacha
                    </span>
                    <span className="px-3 py-1 rounded-lg bg-sky-500/20 text-sky-300 font-mono-ui font-black border border-sky-500/30">
                      +{activeBattle.rewards.exp} User EXP
                    </span>
                    {activeBattle.rewards.tickets > 0 && (
                      <span className="px-3 py-1 rounded-lg bg-purple-500/20 text-purple-300 font-mono-ui font-black border border-purple-500/30">
                        +{activeBattle.rewards.tickets} Tiket Gacha
                      </span>
                    )}
                    {activeBattle.rpChange && (
                      <span className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-mono-ui font-black border border-emerald-500/30">
                        +{activeBattle.rpChange} RP Point!
                      </span>
                    )}
                  </div>
                )}

                <button
                  onClick={() => setActiveBattle(null)}
                  className="px-8 py-3 rounded-xl bg-[#d4a73c] text-black font-black text-sm uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all shadow-lg"
                >
                  Selesai & Kembali ke Arena
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default Arena;
