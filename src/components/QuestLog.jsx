import React, { useEffect, useState, useMemo } from 'react';
import {
  PlayCircle, BookOpen, MessageSquare, MessageCircle, Brain,
  Flame, Library, Users, Check, Gift, Loader2, Swords, CalendarClock,
  Crown, Package, Sparkles, Coins, Lock, Award, Zap, CheckCircle2,
  Clock, ArrowRight, Trophy
} from 'lucide-react';

const ICONS = {
  PlayCircle,
  BookOpen,
  MessageSquare,
  MessageCircle,
  Brain,
  Flame,
  Library,
  Users,
  Swords,
  Sparkles
};

const formatReward = (seconds) => {
  const minutes = Math.round(seconds / 60);
  return `${minutes}m XP`;
};

const RANK_BADGE_STYLE = {
  'Rank S': 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-purple-500/40 text-pink-300 shadow-[0_0_12px_rgba(236,72,153,0.25)]',
  'Rank A': 'bg-cyan-500/15 border-cyan-500/35 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.2)]',
  'Rank B': 'bg-[#d4a73c]/15 border-[#d4a73c]/35 text-[#d4a73c] shadow-[0_0_10px_rgba(212,167,60,0.2)]',
  'Rank C': 'bg-slate-300/15 border-slate-300/30 text-slate-200',
  'Rank D': 'bg-amber-700/20 border-amber-600/30 text-amber-300'
};

// Satu baris Quest Adventurer Guild
const QuestRow = ({ quest, onClaim, claiming }) => {
  const Icon = ICONS[quest.icon] || Swords;
  const pct = Math.min(100, Math.round((quest.progress / quest.target) * 100));
  const rankStyle = RANK_BADGE_STYLE[quest.rank] || RANK_BADGE_STYLE['Rank D'];

  return (
    <div
      className={`p-3.5 md:p-4 rounded-xl border transition-all duration-300 relative overflow-hidden ${
        quest.claimed
          ? 'bg-white/[0.02] border-white/5 opacity-60'
          : quest.completed
          ? 'bg-gradient-to-r from-[#d4a73c]/10 via-[#181820] to-[#181820] border-[#d4a73c]/40 shadow-[0_0_20px_rgba(212,167,60,0.1)]'
          : 'bg-[#181820] border-white/5 hover:border-white/10'
      }`}
    >
      {/* Glow Indicator saat completed */}
      {quest.completed && !quest.claimed && (
        <div className="absolute top-0 right-0 w-24 h-24 bg-[#d4a73c]/10 rounded-full blur-2xl pointer-events-none" />
      )}

      <div className="flex items-center gap-3 md:gap-4 relative z-10">
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
            quest.claimed
              ? 'bg-white/5 border-white/5 text-white/25'
              : quest.completed
              ? 'bg-[#d4a73c]/20 border-[#d4a73c]/40 text-[#d4a73c] shadow-[0_0_15px_rgba(212,167,60,0.3)]'
              : 'bg-white/5 border-white/10 text-white/60'
          }`}
        >
          <Icon className="w-5 h-5" strokeWidth={2.25} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border font-mono-ui ${rankStyle}`}>
              {quest.rank || 'Rank D'}
            </span>
            <p className={`font-black text-sm tracking-tight truncate ${quest.claimed ? 'text-white/40' : 'text-white'}`}>
              {quest.title}
            </p>
          </div>
          <p className="text-white/40 text-xs font-medium line-clamp-1">{quest.desc}</p>
        </div>

        <div className="text-right shrink-0">
          <div className="flex items-center justify-end gap-1.5 mb-1">
            <span className={`text-xs font-black tabular-nums ${quest.completed && !quest.claimed ? 'text-[#d4a73c]' : 'text-white/50'}`}>
              {quest.progress}/{quest.target}
            </span>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <span className="text-white/30 text-[10px] font-bold">+{formatReward(quest.reward)}</span>
            {quest.coins > 0 && (
              <span className="text-[#d4a73c] text-[10px] font-black flex items-center gap-0.5">
                <Coins className="w-2.5 h-2.5" />
                +{quest.coins}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-black/40 rounded-full h-2 overflow-hidden mt-3 p-0.5 border border-white/5 relative z-10">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${
            quest.claimed
              ? 'bg-white/20'
              : quest.completed
              ? 'bg-gradient-to-r from-[#d4a73c] to-[#ff4e2d] shadow-[0_0_10px_rgba(212,167,60,0.6)]'
              : 'bg-gradient-to-r from-white/20 to-white/40'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Tombol Klaim */}
      {quest.completed && (
        <button
          onClick={() => onClaim(quest.id)}
          disabled={quest.claimed || claiming === quest.id}
          className={`w-full mt-3 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all relative z-10 ${
            quest.claimed
              ? 'bg-white/5 text-white/25 cursor-default'
              : 'bg-gradient-to-r from-[#d4a73c] to-[#ff4e2d] text-[#0b0b10] hover:brightness-110 active:scale-[0.98] shadow-[0_0_15px_rgba(212,167,60,0.35)]'
          }`}
        >
          {claiming === quest.id ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : quest.claimed ? (
            <>
              <Check className="w-4 h-4" strokeWidth={3} />
              Hadiah Sudah Diklaim
            </>
          ) : (
            <>
              <Gift className="w-4 h-4" strokeWidth={2.5} />
              Klaim Hadiah (+{formatReward(quest.reward)} & +{quest.coins} Koin)
            </>
          )}
        </button>
      )}
    </div>
  );
};

// Modal Pop-up Hadiah Peti Terbuka
const ChestRewardModal = ({ chestData, onClose }) => {
  if (!chestData) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-[#181820] border border-[#d4a73c]/40 rounded-2xl max-w-sm w-full p-6 text-center shadow-[0_0_50px_rgba(212,167,60,0.25)] relative overflow-hidden animate-[scaleUp_0.3s_ease-out]">
        <div className="absolute top-0 right-0 w-36 h-36 bg-[#d4a73c]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-36 h-36 bg-[#ff4e2d]/15 rounded-full blur-3xl pointer-events-none" />

        <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-tr from-[#d4a73c]/20 to-[#ff4e2d]/20 border border-[#d4a73c]/40 flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(212,167,60,0.4)] animate-bounce">
          <Crown className="w-10 h-10 text-[#d4a73c]" />
        </div>

        <span className="text-[10px] font-black uppercase tracking-widest text-[#d4a73c] bg-[#d4a73c]/15 px-3 py-1 rounded-full border border-[#d4a73c]/30">
          Peti Terbuka
        </span>
        <h3 className="text-white font-black text-xl mt-2 mb-1">{chestData.chest?.name || 'Peti Petualang'}</h3>
        <p className="text-white/40 text-xs font-medium mb-5">Selamat! Kamu telah menyelesaikan target quest harian.</p>

        <div className="grid grid-cols-2 gap-2.5 mb-6 text-left">
          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-xs text-white/40 mb-1">
              <Coins className="w-3.5 h-3.5 text-[#d4a73c]" />
              Koin Kuno
            </div>
            <p className="text-white font-black text-base tabular-nums">+{chestData.coins} Koin</p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-xs text-white/40 mb-1">
              <Zap className="w-3.5 h-3.5 text-[#ff4e2d]" />
              Bonus XP
            </div>
            <p className="text-white font-black text-base tabular-nums">+{formatReward(chestData.xp)}</p>
          </div>

          {chestData.tickets > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 col-span-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span className="text-xs text-white font-bold">Summon Ticket Gacha</span>
              </div>
              <span className="text-purple-300 font-black text-sm">+{chestData.tickets} Tiket</span>
            </div>
          )}

          {chestData.droppedItem && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 col-span-2 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                <Package className="w-4 h-4 text-[#d4a73c]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-white font-bold text-xs truncate">{chestData.droppedItem.name}</p>
                <p className="text-white/40 text-[10px] truncate">{chestData.droppedItem.desc}</p>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-[#d4a73c] to-[#ff4e2d] text-[#0b0b10] font-black text-xs uppercase tracking-wider hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(212,167,60,0.3)]"
        >
          Ambil Hadiah
        </button>
      </div>
    </div>
  );
};

const QuestLog = ({ onClaimed }) => {
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(true);
  const [daily, setDaily] = useState([]);
  const [weekly, setWeekly] = useState([]);
  const [chests, setChests] = useState([]);
  const [completedDailyCount, setCompletedDailyCount] = useState(0);
  const [unclaimedCount, setUnclaimedCount] = useState(0);

  const [activeTab, setActiveTab] = useState('daily'); // 'daily' | 'weekly'
  const [claiming, setClaiming] = useState(null);
  const [claimingAll, setClaimingAll] = useState(false);
  const [claimingChest, setClaimingChest] = useState(null);
  const [chestRewardModal, setChestRewardModal] = useState(null);

  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [timeUntilReset, setTimeUntilReset] = useState('');

  // Countdown ke 00:00 WIB
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      const wib = new Date(utc + 3600000 * 7);

      const endOfDay = new Date(wib);
      endOfDay.setHours(23, 59, 59, 999);

      const diffSec = Math.max(0, Math.floor((endOfDay - wib) / 1000));
      const h = Math.floor(diffSec / 3600).toString().padStart(2, '0');
      const m = Math.floor((diffSec % 3600) / 60).toString().padStart(2, '0');
      const s = (diffSec % 60).toString().padStart(2, '0');
      setTimeUntilReset(`${h}:${m}:${s}`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/quests/today', { credentials: 'include' });
      const data = await res.json();
      if (res.ok && data.success) {
        setLoggedIn(data.loggedIn);
        setDaily(data.daily || []);
        setWeekly(data.weekly || []);
        setChests(data.chests || []);
        setCompletedDailyCount(data.completedDailyCount || 0);
        setUnclaimedCount(data.unclaimedCount || 0);
      } else {
        setError(data.error || 'Gagal memuat quest');
      }
    } catch (e) {
      console.error('Load quests error:', e);
      setError('Gagal memuat papan quest');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Klaim Single Quest
  const claim = async (questId) => {
    if (claiming) return;
    setClaiming(questId);
    setError('');
    try {
      const res = await fetch('/api/v1/quests/claim', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setToast(`Quest Selesai! +${formatReward(data.reward)} & +${data.coins || 30} Koin`);
        setTimeout(() => setToast(''), 3500);
        await load();
        onClaimed?.(data);
      } else {
        setError(data.error || 'Gagal klaim quest');
      }
    } catch (e) {
      console.error('Claim quest error:', e);
      setError('Gagal klaim quest');
    } finally {
      setClaiming(null);
    }
  };

  // Klaim Semua Quest Selesai Sekaligus
  const handleClaimAll = async () => {
    if (claimingAll || unclaimedCount === 0) return;
    setClaimingAll(true);
    setError('');
    try {
      const res = await fetch('/api/v1/quests/claim-all', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setToast(`Sukses klaim ${data.claimedCount} quest! +${formatReward(data.totalXp)} & +${data.totalCoins} Koin`);
        setTimeout(() => setToast(''), 4000);
        await load();
        onClaimed?.(data);
      } else {
        setError(data.error || 'Tidak ada quest yang bisa diklaim');
      }
    } catch (e) {
      console.error('Claim all error:', e);
      setError('Gagal klaim semua quest');
    } finally {
      setClaimingAll(false);
    }
  };

  // Klaim Peti Milestone Harian
  const handleClaimChest = async (chestId) => {
    if (claimingChest) return;
    setClaimingChest(chestId);
    setError('');
    try {
      const res = await fetch('/api/v1/quests/claim-chest', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chestId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setChestRewardModal(data);
        await load();
        onClaimed?.(data);
      } else {
        setError(data.error || 'Gagal membuka peti');
      }
    } catch (e) {
      console.error('Claim chest error:', e);
      setError('Gagal membuka peti');
    } finally {
      setClaimingChest(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-28 bg-[#181820] border border-white/5 rounded-2xl animate-pulse" />
        <div className="h-64 bg-[#181820] border border-white/5 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (!loggedIn) {
    return (
      <div className="bg-[#181820] border border-white/5 rounded-2xl p-10 text-center relative overflow-hidden">
        <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3 shadow-inner">
          <Swords className="w-8 h-8 text-[#d4a73c]" />
        </div>
        <h3 className="text-white font-black text-base uppercase tracking-tight">Papan Misi Guild Petualang</h3>
        <p className="text-white/40 text-xs font-medium max-w-sm mx-auto mt-1 mb-4">
          Login akun kamu untuk mengambil misi harian, membuka peti harta karun legendaris, dan mengumpulkan koin gacha!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Modal Reward Peti */}
      {chestRewardModal && (
        <ChestRewardModal chestData={chestRewardModal} onClose={() => setChestRewardModal(null)} />
      )}

      {/* Toast Notifikasi */}
      {toast && (
        <div className="p-3.5 bg-gradient-to-r from-[#d4a73c]/20 to-[#ff4e2d]/20 border border-[#d4a73c]/40 rounded-xl flex items-center gap-2.5 animate-[slideDown_0.3s_ease-out] shadow-[0_0_20px_rgba(212,167,60,0.2)]">
          <Sparkles className="w-4 h-4 text-[#d4a73c] shrink-0 animate-spin" />
          <p className="text-[#d4a73c] font-black text-xs">{toast}</p>
        </div>
      )}
      {error && <p className="text-red-400 text-xs font-bold px-1">{error}</p>}

      {/* ─── 1. GUILD BOARD HEADER & MILESTONE CHESTS ─── */}
      <div className="bg-[#181820] border border-white/10 rounded-2xl p-4 md:p-6 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-48 h-48 bg-[#d4a73c]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Guild Header Title */}
        <div className="flex items-center justify-between flex-wrap gap-3 pb-4 border-b border-white/5 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-[#d4a73c]/20 to-[#ff4e2d]/20 border border-[#d4a73c]/40 flex items-center justify-center shadow-[0_0_15px_rgba(212,167,60,0.3)]">
              <Trophy className="w-5 h-5 text-[#d4a73c]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-white font-black text-base uppercase tracking-tight font-mono-ui">
                  Papan Misi Guild
                </h3>
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-[#d4a73c]/20 border border-[#d4a73c]/30 text-[#d4a73c]">
                  Rank S Guild
                </span>
              </div>
              <div className="flex items-center gap-2 text-white/40 text-xs font-medium mt-0.5">
                <Clock className="w-3.5 h-3.5 text-white/30" />
                <span>Reset Harian: <strong className="text-white font-mono-ui">{timeUntilReset}</strong> WIB</span>
              </div>
            </div>
          </div>

          {/* Quick Claim All Button */}
          {unclaimedCount > 0 && (
            <button
              onClick={handleClaimAll}
              disabled={claimingAll}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#d4a73c] to-[#ff4e2d] text-[#0b0b10] font-black text-xs uppercase tracking-wider flex items-center gap-1.5 hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_0_15px_rgba(212,167,60,0.3)]"
            >
              {claimingAll ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Gift className="w-3.5 h-3.5" strokeWidth={2.5} />
              )}
              Klaim Semua ({unclaimedCount})
            </button>
          )}
        </div>

        {/* ─── 2. DAILY MILESTONE CHESTS BAR ─── */}
        <div className="pt-5 relative z-10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-white/60">Target Misi Harian:</span>
            <span className="text-xs font-black text-[#d4a73c] font-mono-ui">
              {completedDailyCount} / 7 Selesai
            </span>
          </div>

          {/* Milestone Chests Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {chests.map((chest) => {
              const isClaimed = chest.claimed;
              const isReady = chest.completed && !isClaimed;
              const isLocked = !chest.completed;

              return (
                <div
                  key={chest.id}
                  className={`p-3.5 rounded-xl border transition-all duration-300 relative overflow-hidden flex flex-col justify-between ${
                    isClaimed
                      ? 'bg-white/[0.02] border-white/5 opacity-60'
                      : isReady
                      ? 'bg-gradient-to-b from-[#d4a73c]/20 via-[#181820] to-[#181820] border-[#d4a73c]/50 shadow-[0_0_25px_rgba(212,167,60,0.2)] animate-[pulse_2s_infinite]'
                      : 'bg-black/20 border-white/5'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                        isClaimed
                          ? 'bg-white/5 border-white/5 text-white/30'
                          : isReady
                          ? 'bg-[#d4a73c]/25 border-[#d4a73c] text-[#d4a73c] shadow-[0_0_15px_rgba(212,167,60,0.4)]'
                          : 'bg-white/5 border-white/10 text-white/40'
                      }`}
                    >
                      {chest.id === 'chest_gold' ? (
                        <Crown className="w-5 h-5" />
                      ) : chest.id === 'chest_silver' ? (
                        <Gift className="w-5 h-5" />
                      ) : (
                        <Package className="w-5 h-5" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className={`font-black text-xs truncate ${isReady ? 'text-[#d4a73c]' : 'text-white'}`}>
                          {chest.name}
                        </h4>
                      </div>
                      <p className="text-white/40 text-[10px] font-medium leading-tight mt-0.5">
                        {chest.desc}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-white/50">
                      <Coins className="w-3 h-3 text-[#d4a73c]" />
                      +{chest.coins}
                      {chest.tickets > 0 && <span className="text-purple-300">+{chest.tickets} Tiket</span>}
                    </div>

                    <button
                      onClick={() => handleClaimChest(chest.id)}
                      disabled={!isReady || claimingChest === chest.id}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 ${
                        isClaimed
                          ? 'bg-white/5 text-white/30 cursor-default'
                          : isReady
                          ? 'bg-gradient-to-r from-[#d4a73c] to-[#ff4e2d] text-[#0b0b10] hover:brightness-110 active:scale-95 shadow-[0_0_10px_rgba(212,167,60,0.4)]'
                          : 'bg-white/5 text-white/30 cursor-not-allowed'
                      }`}
                    >
                      {claimingChest === chest.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : isClaimed ? (
                        <>
                          <Check className="w-3 h-3" strokeWidth={3} />
                          Klaim
                        </>
                      ) : isReady ? (
                        <>
                          <Gift className="w-3 h-3" />
                          Buka Peti
                        </>
                      ) : (
                        <>
                          <Lock className="w-3 h-3 text-white/30" />
                          {chest.progress}/{chest.target}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── 3. TAB NAVIGASI: HARIAN VS MINGGUAN ─── */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-1.5 p-1 bg-[#181820] border border-white/5 rounded-xl">
            <button
              onClick={() => setActiveTab('daily')}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                activeTab === 'daily'
                  ? 'bg-[#d4a73c] text-[#0b0b10] shadow-[0_0_15px_rgba(212,167,60,0.35)]'
                  : 'text-white/40 hover:text-white hover:bg-white/5'
              }`}
            >
              <Swords className="w-3.5 h-3.5" />
              Misi Harian ({daily.length})
            </button>

            <button
              onClick={() => setActiveTab('weekly')}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                activeTab === 'weekly'
                  ? 'bg-[#d4a73c] text-[#0b0b10] shadow-[0_0_15px_rgba(212,167,60,0.35)]'
                  : 'text-white/40 hover:text-white hover:bg-white/5'
              }`}
            >
              <CalendarClock className="w-3.5 h-3.5" />
              Misi Mingguan ({weekly.length})
            </button>
          </div>
        </div>

        {/* ─── 4. QUEST LIST CARDS ─── */}
        <div className="space-y-3">
          {activeTab === 'daily' ? (
            daily.map((q) => (
              <QuestRow key={q.id} quest={q} onClaim={claim} claiming={claiming} />
            ))
          ) : (
            weekly.map((q) => (
              <QuestRow key={q.id} quest={q} onClaim={claim} claiming={claiming} />
            ))
          )}
        </div>

        <p className="text-white/20 text-xs font-medium mt-4 text-center">
          {activeTab === 'daily'
            ? 'Papan Misi Harian berganti otomatis tiap jam 00:00 WIB'
            : 'Papan Misi Mingguan di-reset setiap hari Minggu pukul 23:59 WIB'}
        </p>
      </div>
    </div>
  );
};

export default QuestLog;
