import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import HoloCard from '../components/HoloCard';
import {
  Swords, Shield, Zap, Flame, Crown, Trophy, Sparkles, Gift,
  Clock, Check, AlertCircle, Loader2, User, ChevronRight,
  TrendingUp, Activity, Star, Info, Award
} from 'lucide-react';
import { setSeoMeta, SITE_URL } from '../utils/seo';
import { useAdaptiveInterval } from '../hooks/useAdaptiveInterval';

const formatCountdownToEndOfWeek = () => {
  const now = new Date();
  const d = new Date(now);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() + (7 - day));
  d.setHours(23, 59, 59, 999);
  const diff = Math.max(0, Math.floor((d.getTime() - now.getTime()) / 1000));
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  return `${days}h ${hours}j ${minutes}m`;
};

const WorldBossRaid = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('leaderboard'); // 'leaderboard' | 'rewards' | 'guide'
  const [loading, setLoading] = useState(true);
  const [raidData, setRaidData] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);

  // Modals & Battle Simulation
  const [attacking, setAttacking] = useState(false);
  const [battleResult, setBattleResult] = useState(null);
  const [claimingMilestone, setClaimingMilestone] = useState(null);

  // Toast
  const [toast, setToast] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    setSeoMeta({
      title: 'Serbuan Bos Dunia Global - Ndika-Nime',
      description: 'Pertarungan akbar bersama seluruh pemain Ndika-Nime untuk mengalahkan Bos Dunia raksasa mingguan dan raih piala dewa!',
      url: `${SITE_URL}/raid`
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

  const loadRaidData = async () => {
    try {
      const res = await fetch('/api/v1/raid/status', { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setRaidData(data);
      }
    } catch (e) {
      console.error('Load raid data error:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadLeaderboard = async () => {
    try {
      const res = await fetch('/api/v1/raid/leaderboard', { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setLeaderboard(data.leaderboard || []);
      }
    } catch (e) {
      console.error('Load leaderboard error:', e);
    }
  };

  useEffect(() => {
    loadRaidData();
    loadLeaderboard();
  }, []);

  useAdaptiveInterval(loadRaidData, 15000);

  // Action: Serang Bos Dunia
  const handleAttack = async () => {
    if (attacking || !raidData) return;
    if (raidData.user.remainingAttempts <= 0) {
      showToast('Tiket serangan harianmu sudah habis! Reset setiap 00:00 WIB.', true);
      return;
    }
    setAttacking(true);
    try {
      const res = await fetch('/api/v1/raid/attack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      const data = await res.json();
      if (data.success) {
        setBattleResult(data);
        loadRaidData();
        loadLeaderboard();
      } else {
        showToast(data.error || 'Gagal menyerang bos', true);
      }
    } catch (e) {
      showToast('Terjadi kesalahan jaringan', true);
    } finally {
      setAttacking(false);
    }
  };

  // Action: Klaim Milestone Hadiah
  const handleClaimMilestone = async (milestoneId) => {
    if (claimingMilestone) return;
    setClaimingMilestone(milestoneId);
    try {
      const res = await fetch('/api/v1/raid/claim-milestone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ milestoneId })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Hadiah Milestone Berhasil Diklaim! +${data.reward.coins} Koin & +${data.reward.tickets} Tiket Gacha!`);
        loadRaidData();
      } else {
        showToast(data.error || 'Gagal klaim hadiah milestone', true);
      }
    } catch (e) {
      showToast('Gagal memproses klaim', true);
    } finally {
      setClaimingMilestone(null);
    }
  };

  if (loading || !raidData) {
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

  const boss = raidData.boss;
  const hpPercent = boss.hpPercent;
  const isDefeated = boss.status === 'defeated' || hpPercent <= 0;

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
        {/* ─── 1. LIVE DAMAGE TICKER FEED ─── */}
        {(raidData.recentLogs || []).length > 0 && (
          <div className="bg-black/60 border border-white/5 rounded-2xl px-4 py-2.5 flex items-center gap-3 overflow-hidden shadow-inner">
            <div className="flex items-center gap-1.5 text-xs font-black text-[#d4a73c] uppercase shrink-0 font-mono-ui">
              <Activity className="w-4 h-4 animate-pulse" />
              LIVE RAID FEED:
            </div>
            <div className="flex-1 overflow-x-auto whitespace-nowrap scrollbar-none text-xs text-white/70 font-medium">
              <div className="inline-flex items-center gap-6 animate-[marquee_25s_linear_infinite]">
                {raidData.recentLogs.map((log, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5">
                    <strong className="text-white">{log.userName}</strong>
                    <span>menghantam sebesar</span>
                    <span className="text-[#d4a73c] font-black font-mono-ui">{log.damage.toLocaleString()} DMG</span>
                    {log.crit && <span className="text-[10px] text-red-400 font-bold uppercase">(CRITICAL!)</span>}
                    <span className="text-white/20">•</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── 2. GIANT WORLD BOSS ARENA STAGE ─── */}
        <div className="bg-[#14141d] border border-white/10 rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-2xl">
          {/* Element Background Glow */}
          <div
            className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl opacity-20 pointer-events-none"
            style={{ backgroundColor: boss.color }}
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
            {/* Left: Boss Visual Avatar */}
            <div className="lg:col-span-5 flex flex-col items-center text-center">
              <div className="relative group">
                <div
                  className="w-48 h-48 sm:w-64 sm:h-64 rounded-3xl overflow-hidden border-2 p-1.5 shadow-2xl relative transition-transform duration-500 group-hover:scale-105"
                  style={{ borderColor: boss.color, boxShadow: `0 0 40px ${boss.color}30` }}
                >
                  <img
                    src={boss.avatar}
                    alt={boss.name}
                    className="w-full h-full object-cover rounded-2xl filter brightness-95"
                  />
                  {isDefeated && (
                    <div className="absolute inset-0 bg-black/75 flex items-center justify-center">
                      <span className="text-xl font-black text-red-500 uppercase tracking-widest border-2 border-red-500 px-4 py-2 rounded-xl rotate-[-12deg]">
                        TERTUMBANGKAN
                      </span>
                    </div>
                  )}
                </div>

                <div
                  className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider text-[#0b0b10] shadow-md font-mono-ui"
                  style={{ backgroundColor: boss.color }}
                >
                  Elemen: {boss.element}
                </div>
              </div>
            </div>

            {/* Right: Boss Stats, HP Bar & Attack Trigger */}
            <div className="lg:col-span-7 space-y-5">
              <div>
                <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                  <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/50 font-mono-ui">
                    Season: {boss.seasonWeek} • Reset dalam {formatCountdownToEndOfWeek()}
                  </span>

                  <span className="text-xs font-bold text-white/40">
                    Total Raiders: <strong className="text-white">{raidData.totalRaiders.toLocaleString()}</strong>
                  </span>
                </div>

                <h1 className="text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-tight text-white font-mono-ui">
                  {boss.name}
                </h1>
                <p className="text-[#d4a73c] text-xs md:text-sm font-bold uppercase tracking-wider">
                  {boss.title}
                </p>
                <p className="text-white/40 text-xs mt-1.5 leading-relaxed">
                  {boss.desc}
                </p>
              </div>

              {/* Elemental Weakness Hint */}
              <div className="p-3 bg-black/40 border border-white/5 rounded-2xl flex items-center justify-between text-xs">
                <span className="text-white/50 font-medium">Kelemahan Elemen (+50% DMG):</span>
                <div className="flex items-center gap-1.5">
                  {(boss.weakness || []).map((w) => (
                    <span
                      key={w}
                      className="px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-[#d4a73c]/20 text-[#d4a73c] border border-[#d4a73c]/35 font-mono-ui"
                    >
                      {w}
                    </span>
                  ))}
                </div>
              </div>

              {/* Giant Global HP Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono-ui font-black">
                  <span className="text-white/50">HP GLOBAL BOS:</span>
                  <span className="text-white">
                    {boss.currentHp.toLocaleString()} / {boss.totalHp.toLocaleString()} ({hpPercent}%)
                  </span>
                </div>

                <div className="w-full bg-black/60 rounded-full h-4 overflow-hidden p-1 border border-white/10 relative">
                  <div
                    className="h-full rounded-full transition-all duration-1000 relative overflow-hidden"
                    style={{
                      width: `${hpPercent}%`,
                      backgroundColor: hpPercent > 50 ? '#3ecf8e' : hpPercent > 20 ? '#d4a73c' : '#ff4757'
                    }}
                  >
                    <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]" />
                  </div>
                </div>
              </div>

              {/* User Attempts & Attack Button */}
              <div className="flex items-center justify-between gap-4 pt-2 flex-wrap">
                <div className="bg-black/50 border border-white/10 px-4 py-2.5 rounded-2xl">
                  <span className="text-[10px] text-white/40 block font-bold">Tiket Serangan Harian:</span>
                  <span className="text-[#d4a73c] font-black text-sm font-mono-ui flex items-center gap-1">
                    <Swords className="w-4 h-4" /> {raidData.user.remainingAttempts} / {raidData.user.maxAttempts} Tiket
                  </span>
                </div>

                <button
                  onClick={handleAttack}
                  disabled={attacking || isDefeated || raidData.user.remainingAttempts <= 0}
                  className="flex-1 sm:flex-initial px-8 py-3.5 rounded-2xl bg-gradient-to-r from-red-600 via-[#ff4e2d] to-[#d4a73c] text-[#0b0b10] font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_25px_rgba(255,78,45,0.4)] transition-all"
                >
                  {attacking ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : isDefeated ? (
                    'Bos Telah Tumbang'
                  ) : raidData.user.remainingAttempts <= 0 ? (
                    'Tiket Habis Hari Ini'
                  ) : (
                    <>
                      <Swords className="w-5 h-5" strokeWidth={2.5} />
                      Luncurkan Serangan Raid!
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ─── 3. MILESTONES CHESTS BAR ─── */}
        <div className="bg-[#14141d] border border-white/10 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-black text-sm uppercase tracking-wider font-mono-ui flex items-center gap-2">
              <Gift className="w-4 h-4 text-[#d4a73c]" /> Hadiah Milestone HP Bersama
            </h3>
            <span className="text-xs text-white/40">Klaim hadiah saat HP Bos mencapai batas</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {raidData.milestones.map((m) => (
              <div
                key={m.id}
                className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                  m.claimed
                    ? 'bg-white/[0.02] border-white/5 opacity-60'
                    : m.canClaim
                    ? 'bg-[#d4a73c]/10 border-[#d4a73c]/50 shadow-[0_0_20px_rgba(212,167,60,0.15)]'
                    : 'bg-black/40 border-white/5'
                }`}
              >
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-black uppercase text-[#d4a73c] font-mono-ui">
                      HP ≤ {m.hpPercent}%
                    </span>
                    {m.claimed ? (
                      <span className="text-[10px] font-bold text-white/30 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Diklaim
                      </span>
                    ) : m.unlocked ? (
                      <span className="text-[10px] font-black text-emerald-400 animate-pulse">TERBUKA</span>
                    ) : (
                      <span className="text-[10px] font-bold text-white/30">Terkunci</span>
                    )}
                  </div>
                  <p className="text-white font-bold text-xs">{m.label}</p>
                  <p className="text-white/40 text-[11px] mt-1 font-mono-ui">
                    +{m.coins} Koin • +{m.tickets} Tiket
                    {m.title && <span className="text-purple-300 block font-bold">Gelar: {m.title}</span>}
                  </p>
                </div>

                <div className="mt-3">
                  {m.canClaim ? (
                    <button
                      onClick={() => handleClaimMilestone(m.id)}
                      disabled={claimingMilestone === m.id}
                      className="w-full py-1.5 rounded-lg bg-[#d4a73c] text-[#0b0b10] font-black text-[11px] uppercase tracking-wider flex items-center justify-center gap-1 shadow-md shadow-[#d4a73c]/20 hover:brightness-110 active:scale-95"
                    >
                      {claimingMilestone === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Gift className="w-3.5 h-3.5" />}
                      Klaim Hadiah
                    </button>
                  ) : (
                    <button
                      disabled
                      className="w-full py-1.5 rounded-lg bg-white/5 text-white/20 font-bold text-[11px] uppercase cursor-not-allowed"
                    >
                      {m.claimed ? 'Sudah Diklaim' : 'Belum Terbuka'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── 4. TABS NAVIGATION ─── */}
        <div className="flex items-center gap-2 border-b border-white/5 pb-3">
          {[
            ['leaderboard', 'Papan Peringkat Damage', Trophy],
            ['rewards', 'Rincian Hadiah', Award],
            ['guide', 'Panduan Elemen & Strategi', Info]
          ].map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                activeTab === id
                  ? 'bg-[#d4a73c] text-[#0b0b10] shadow-[0_0_15px_rgba(212,167,60,0.35)]'
                  : 'text-white/40 hover:text-white bg-[#14141d] border border-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* ─── TAB 1: LEADERBOARD ─── */}
        {activeTab === 'leaderboard' && (
          <div className="bg-[#14141d] border border-white/10 rounded-2xl p-5 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-white font-black text-sm uppercase font-mono-ui">
                Top 50 Petualang Pembasmi Titan
              </h3>
              {raidData.user.rank && (
                <span className="text-xs text-[#d4a73c] font-black font-mono-ui">
                  Peringkat Kamu: #{raidData.user.rank} ({raidData.user.totalDamage.toLocaleString()} DMG)
                </span>
              )}
            </div>

            {leaderboard.length === 0 ? (
              <div className="p-8 text-center text-white/30 text-xs">
                Belum ada petualang yang menyerang. Jadilah yang pertama!
              </div>
            ) : (
              <div className="overflow-x-auto scrollbar-none">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/5 text-white/40 uppercase font-mono-ui text-[10px]">
                      <th className="py-2.5 px-3">Rank</th>
                      <th className="py-2.5 px-3">Petualang</th>
                      <th className="py-2.5 px-3 text-right">Total Serangan</th>
                      <th className="py-2.5 px-3 text-right">Total Damage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-medium">
                    {leaderboard.map((u) => (
                      <tr key={u.userId} className="hover:bg-white/[0.02]">
                        <td className="py-3 px-3">
                          <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-black font-mono-ui text-xs ${
                            u.rank === 1
                              ? 'bg-amber-400 text-black shadow-md shadow-amber-400/30'
                              : u.rank === 2
                              ? 'bg-slate-300 text-black shadow-md shadow-slate-300/30'
                              : u.rank === 3
                              ? 'bg-amber-700 text-white shadow-md shadow-amber-700/30'
                              : 'text-white/40'
                          }`}>
                            {u.rank}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-white/10 overflow-hidden shrink-0">
                              {u.userAvatar ? (
                                <img src={u.userAvatar} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <User className="w-4 h-4 text-white/40 m-auto" />
                              )}
                            </div>
                            <div>
                              <strong className="text-white block font-bold">{u.userName}</strong>
                              <span className="text-[10px] text-white/40 font-mono-ui">Lv. {u.userLevel}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right text-white/50 font-mono-ui">
                          {u.attacksCount}x
                        </td>
                        <td className="py-3 px-3 text-right font-black font-mono-ui text-[#d4a73c]">
                          {u.totalDamage.toLocaleString()} DMG
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 2: REWARDS DETAIL ─── */}
        {activeTab === 'rewards' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#14141d] border border-white/10 rounded-2xl p-5 space-y-3">
              <h4 className="text-white font-black text-sm uppercase font-mono-ui text-[#d4a73c]">
                Hadiah Papan Peringkat Akhir Minggu
              </h4>
              <div className="space-y-2.5 text-xs text-white/70">
                <div className="p-3 bg-black/40 rounded-xl border border-amber-400/20 flex justify-between items-center">
                  <span><strong>Rank #1 (Grand Champion):</strong></span>
                  <span className="text-[#d4a73c] font-black font-mono-ui">10,000 Koin + 10x Tiket + Gelar "God of Destruction"</span>
                </div>
                <div className="p-3 bg-black/40 rounded-xl border border-white/5 flex justify-between items-center">
                  <span><strong>Rank #2 - #5:</strong></span>
                  <span className="text-white font-bold font-mono-ui">5,000 Koin + 5x Tiket</span>
                </div>
                <div className="p-3 bg-black/40 rounded-xl border border-white/5 flex justify-between items-center">
                  <span><strong>Rank #6 - #20:</strong></span>
                  <span className="text-white/60 font-bold font-mono-ui">2,500 Koin + 3x Tiket</span>
                </div>
              </div>
            </div>

            <div className="bg-[#14141d] border border-white/10 rounded-2xl p-5 space-y-3">
              <h4 className="text-white font-black text-sm uppercase font-mono-ui text-emerald-400">
                Hadiah Partisipasi Harian
              </h4>
              <p className="text-xs text-white/50 leading-relaxed">
                Setiap kali kamu melancarkan serangan raid menggunakan tiket harian, kamu langsung mendapatkan:
              </p>
              <div className="p-3 bg-black/40 rounded-xl border border-white/5 flex justify-between items-center text-xs">
                <span>Hadiah per Serangan:</span>
                <span className="text-emerald-400 font-black font-mono-ui">+150 Koin Kuno & EXP RPG</span>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 3: STRATEGY & GUIDE ─── */}
        {activeTab === 'guide' && (
          <div className="bg-[#14141d] border border-white/10 rounded-2xl p-5 space-y-4">
            <h4 className="text-white font-black text-sm uppercase font-mono-ui text-[#d4a73c]">
              Strategi Memaksimalkan Kerusakan (Damage)
            </h4>
            <div className="space-y-3 text-xs text-white/70 leading-relaxed">
              <p>
                1. <strong>Manfaatkan Kelemahan Elemen:</strong> Kartu dengan elemen kelemahan bos minggu ini ({boss.weakness?.join(', ')}) akan memberikan <strong>+50% Bonus Damage</strong> di setiap ronde serangan.
              </p>
              <p>
                2. <strong>Bintang Kartu & CP:</strong> Kartu yang telah dinaikkan bintangnya (Bintang 1-5) memiliki Attack dasar jauh lebih kuat dan peluang Critical Strike yang lebih mematikan.
              </p>
              <p>
                3. <strong>Tiket Reset Setiap Hari:</strong> Pastikan menggunakan seluruh 3 tiket seranganmu setiap hari sebelum reset pukul 00:00 WIB untuk mengumpulkan akumulasi skor tertinggi!
              </p>
            </div>
          </div>
        )}
      </main>

      {/* ─── CINEMATIC BATTLE SIMULATION MODAL ─── */}
      {battleResult && (
        <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-[#181824] border border-[#d4a73c]/40 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-red-600 to-[#d4a73c] flex items-center justify-center mx-auto text-[#0b0b10] shadow-lg shadow-red-600/30">
              <Swords className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-white font-black text-xl uppercase font-mono-ui">Serangan Raid Berhasil!</h3>
              <p className="text-white/40 text-xs mt-1">Laporan 5 Ronde Pertarungan Deck Kartu</p>
            </div>

            {/* Battle Rounds List */}
            <div className="space-y-2 max-h-56 overflow-y-auto p-1 scrollbar-none">
              {(battleResult.battleRounds || []).map((r, i) => (
                <div
                  key={i}
                  className="p-2.5 bg-black/40 border border-white/5 rounded-xl flex items-center justify-between text-xs font-mono-ui"
                >
                  <div className="text-left">
                    <span className="text-white/40 block text-[10px]">Ronde {r.round}:</span>
                    <strong className="text-white font-bold">{r.cardName || r.attackerName}</strong>
                    {r.isElementAdvantage && <span className="text-[#d4a73c] text-[10px] block font-bold">Elemen Unggul (+50%)</span>}
                  </div>

                  <div className="text-right">
                    <span className="text-[#d4a73c] font-black text-sm">+{r.damage.toLocaleString()} DMG</span>
                    {r.crit && <span className="text-red-400 text-[9px] block font-bold uppercase">CRITICAL!</span>}
                  </div>
                </div>
              ))}
            </div>

            {/* Total Damage & Reward */}
            <div className="p-4 bg-black/60 border border-[#d4a73c]/30 rounded-2xl flex justify-between items-center">
              <div className="text-left">
                <span className="text-[10px] text-white/40 uppercase block font-bold">Total Damage Dihasilkan:</span>
                <span className="text-2xl font-black text-[#d4a73c] font-mono-ui">
                  {battleResult.damageDealt.toLocaleString()} DMG
                </span>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-white/40 uppercase block font-bold">Hadiah Serangan:</span>
                <span className="text-emerald-400 font-black text-sm font-mono-ui">
                  +{battleResult.rewardCoins} Koin
                </span>
              </div>
            </div>

            <button
              onClick={() => setBattleResult(null)}
              className="w-full py-3 rounded-2xl bg-[#d4a73c] text-[#0b0b10] font-black text-xs uppercase tracking-wider hover:brightness-110 active:scale-[0.98] shadow-lg shadow-[#d4a73c]/30"
            >
              Kembali ke Arena Raid
            </button>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default WorldBossRaid;
