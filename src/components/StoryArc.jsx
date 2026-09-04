import React, { useEffect, useState, useMemo } from 'react';
import {
  Sparkles, Flame, Zap, Crown, Compass, Lock, Check, Gift, Loader2,
  Award, Swords, Shield, Coins, Package, Play, Volume2, ArrowRight,
  Skull, ChevronRight, CheckCircle2, MapPin, Trophy, Star
} from 'lucide-react';

const ARC_ICONS = {
  Sparkles,
  Flame,
  Zap,
  Crown,
  Compass
};

const formatReward = (seconds) => {
  const minutes = Math.round(seconds / 60);
  return `${minutes}m XP`;
};

// Modal Simulasi Pertarungan Bos Cerita
const StoryBossBattleModal = ({ boss, userDeck, onVictory, onClose }) => {
  const [battleState, setBattleState] = useState('intro'); // 'intro' | 'battling' | 'victory' | 'defeat'
  const [bossHp, setBossHp] = useState(boss.hp || 3500);
  const [playerHp, setPlayerHp] = useState(4000);
  const [maxPlayerHp] = useState(4000);
  const [battleLogs, setBattleLogs] = useState([]);
  const [turn, setTurn] = useState(0);

  const startBattle = () => {
    setBattleState('battling');
    setBattleLogs([`Pertarungan dimulai! ${boss.name} melepaskan aura ${boss.element} yang mengintimidasi!`]);

    let curBossHp = boss.hp;
    let curPlayerHp = 4000;
    let round = 1;

    const interval = setInterval(() => {
      if (round > 6 || curBossHp <= 0 || curPlayerHp <= 0) {
        clearInterval(interval);
        if (curBossHp <= 0 || curPlayerHp > 0) {
          setBossHp(0);
          setBattleState('victory');
        } else {
          setBattleState('defeat');
        }
        return;
      }

      // Player Turn
      const pDmg = Math.floor(600 + Math.random() * 500);
      curBossHp = Math.max(0, curBossHp - pDmg);
      setBossHp(curBossHp);

      // Boss Turn
      const bDmg = Math.floor(300 + Math.random() * 300);
      curPlayerHp = Math.max(0, curPlayerHp - bDmg);
      setPlayerHp(curPlayerHp);

      setBattleLogs((prev) => [
        `Turn ${round}: Deck kamu menyerang dan menghasilkan ${pDmg} DMG! ${boss.name} membalas dengan ${boss.skillName} (${bDmg} DMG)!`,
        ...prev.slice(0, 3)
      ]);

      round++;
      setTurn(round);
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-[#181824] border border-[#d4a73c]/40 rounded-2xl max-w-lg w-full p-6 text-center shadow-[0_0_60px_rgba(212,167,60,0.3)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-[#d4a73c]/15 rounded-full blur-3xl pointer-events-none" />

        {/* Boss Header Info */}
        <div className="flex items-center gap-3 mb-4 text-left border-b border-white/10 pb-4">
          <div className="w-14 h-14 rounded-xl overflow-hidden border-2 border-red-500/50 shrink-0 shadow-lg">
            <img src={boss.avatar} alt={boss.name} className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-black uppercase text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
              {boss.title}
            </span>
            <h3 className="text-white font-black text-base truncate mt-0.5">{boss.name}</h3>
            <p className="text-white/40 text-xs font-mono-ui">Elemen: <strong className="text-[#d4a73c]">{boss.element}</strong></p>
          </div>
        </div>

        {/* Boss HP Bar */}
        <div className="mb-4 text-left">
          <div className="flex justify-between text-xs font-mono-ui font-black mb-1">
            <span className="text-red-400 flex items-center gap-1">
              <Skull className="w-3.5 h-3.5" /> HP BOS
            </span>
            <span className="text-white">{bossHp} / {boss.maxHp}</span>
          </div>
          <div className="w-full bg-black/60 rounded-full h-3 overflow-hidden p-0.5 border border-red-500/30">
            <div
              className="h-full rounded-full bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 transition-all duration-500 shadow-[0_0_12px_rgba(239,68,68,0.7)]"
              style={{ width: `${Math.max(0, Math.min(100, (bossHp / boss.maxHp) * 100))}%` }}
            />
          </div>
        </div>

        {/* Intro State */}
        {battleState === 'intro' && (
          <div className="py-4 space-y-4">
            <div className="p-3.5 bg-black/40 border border-white/10 rounded-xl text-left">
              <p className="text-[#d4a73c] text-xs italic font-mono-ui">"{boss.introQuote}"</p>
              <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-xs text-white/50">
                <span>Skill Khusus: <strong className="text-white">{boss.skillName}</strong></span>
                <span className="text-[#d4a73c] font-black">ATK {boss.atk} / DEF {boss.def}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 font-bold text-xs"
              >
                Mundur
              </button>
              <button
                onClick={startBattle}
                className="flex-2 py-3 rounded-xl bg-gradient-to-r from-[#d4a73c] to-[#ff4e2d] text-[#0b0b10] font-black text-xs uppercase tracking-wider hover:brightness-110 active:scale-[0.98] shadow-lg shadow-[#d4a73c]/30 flex items-center justify-center gap-2"
              >
                <Swords className="w-4 h-4" /> Serang Bos Cerita
              </button>
            </div>
          </div>
        )}

        {/* Battling State */}
        {battleState === 'battling' && (
          <div className="py-4 space-y-4">
            <div className="flex items-center justify-center gap-3 py-2 animate-pulse">
              <Swords className="w-8 h-8 text-[#d4a73c]" />
              <span className="text-white font-black text-sm uppercase font-mono-ui">Pertarungan Sengit Berlangsung...</span>
            </div>

            <div className="p-3 bg-black/50 border border-white/10 rounded-xl space-y-1 text-left min-h-[90px]">
              {battleLogs.map((log, i) => (
                <p key={i} className={`text-xs ${i === 0 ? 'text-[#d4a73c] font-bold' : 'text-white/40'}`}>
                  {log}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Victory State */}
        {battleState === 'victory' && (
          <div className="py-4 space-y-4 animate-[scaleUp_0.3s_ease-out]">
            <div className="w-16 h-16 rounded-2xl bg-[#d4a73c]/20 border border-[#d4a73c] flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(212,167,60,0.5)]">
              <Trophy className="w-8 h-8 text-[#d4a73c]" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase text-[#d4a73c] tracking-widest bg-[#d4a73c]/15 px-3 py-1 rounded-full border border-[#d4a73c]/30">
                VICTORY!
              </span>
              <h3 className="text-white font-black text-lg mt-2">Bos Berhasil Ditaklukkan!</h3>
              <p className="text-[#d4a73c] text-xs italic font-mono-ui mt-1">"{boss.defeatQuote}"</p>
            </div>
            <button
              onClick={onVictory}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#d4a73c] to-[#ff4e2d] text-[#0b0b10] font-black text-xs uppercase tracking-wider hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(212,167,60,0.4)]"
            >
              Klaim Hadiah Kemenangan
            </button>
          </div>
        )}

        {/* Defeat State */}
        {battleState === 'defeat' && (
          <div className="py-4 space-y-4">
            <h3 className="text-red-400 font-black text-lg">Kamu Kalah Dalam Pertarungan!</h3>
            <p className="text-white/40 text-xs">Tingkatkan level kartu karakter dan racik deck sinergi terbaikmu di Arena.</p>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-white/10 text-white font-black text-xs"
            >
              Tutup & Coba Lagi Nanti
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const StoryArc = ({ onClaimed }) => {
  const [loading, setLoading] = useState(true);
  const [arcs, setArcs] = useState([]);
  const [selectedArcIndex, setSelectedArcIndex] = useState(0);
  const [loggedIn, setLoggedIn] = useState(true);
  const [claiming, setClaiming] = useState(null);
  const [activeBossBattle, setActiveBossBattle] = useState(null);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/quests/story', { credentials: 'include' });
      const data = await res.json();
      if (res.ok && data.success) {
        setArcs(data.arcs || []);
        setLoggedIn(data.loggedIn);
      }
    } catch (e) {
      console.error('Load story arcs error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const claim = async (arcId, stageId) => {
    if (claiming) return;
    setClaiming(stageId);
    setError('');
    try {
      const res = await fetch('/api/v1/quests/story-claim', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arcId, stageId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const parts = [`Stage Selesai! +${formatReward(data.reward)} & +${data.coins || 100} Koin`];
        if (data.tickets > 0) parts.push(`+${data.tickets} Tiket Gacha`);
        if (data.badge) parts.push(`Badge: "${data.badge}"`);
        setToast(parts.join(' | '));
        setTimeout(() => setToast(''), 4500);
        setActiveBossBattle(null);
        await load();
        onClaimed?.(data);
      } else {
        setError(data.error || 'Gagal klaim stage');
      }
    } catch (e) {
      console.error('Claim story stage error:', e);
      setError('Gagal klaim stage');
    } finally {
      setClaiming(null);
    }
  };

  const currentArc = arcs[selectedArcIndex] || arcs[0];

  if (loading) {
    return <div className="h-64 bg-[#181820] border border-white/5 rounded-2xl animate-pulse" />;
  }

  if (!loggedIn) {
    return (
      <div className="bg-[#181820] border border-white/5 rounded-2xl p-8 text-center">
        <Compass className="w-8 h-8 text-[#d4a73c] mx-auto mb-2" />
        <h3 className="text-white font-black text-sm uppercase">Peta Petualangan Story Arc</h3>
        <p className="text-white/40 text-xs font-medium mt-1">Login akun kamu untuk mulai menapaki babak petualangan dunia Nefora.</p>
      </div>
    );
  }

  if (!currentArc) return null;

  return (
    <div className="space-y-5 select-none">
      {/* Modal Boss Battle */}
      {activeBossBattle && (
        <StoryBossBattleModal
          boss={activeBossBattle.boss}
          onVictory={() => claim(currentArc.id, activeBossBattle.stageId)}
          onClose={() => setActiveBossBattle(null)}
        />
      )}

      {/* Toast Alert */}
      {toast && (
        <div className="p-3.5 bg-[#d4a73c]/15 border border-[#d4a73c]/40 rounded-xl flex items-center gap-2.5 shadow-[0_0_20px_rgba(212,167,60,0.2)]">
          <Sparkles className="w-4 h-4 text-[#d4a73c] shrink-0" />
          <p className="text-[#d4a73c] font-black text-xs">{toast}</p>
        </div>
      )}
      {error && <p className="text-red-400 text-xs font-bold px-1">{error}</p>}

      {/* ─── 1. ARC TABS SELECTOR ─── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {arcs.map((arc, index) => {
          const isSelected = selectedArcIndex === index;
          const completedCount = arc.stages.filter((s) => s.claimed).length;

          return (
            <button
              key={arc.id}
              onClick={() => setSelectedArcIndex(index)}
              className={`px-4 py-2.5 rounded-xl border text-left shrink-0 transition-all flex items-center gap-2.5 ${
                isSelected
                  ? 'bg-gradient-to-r from-[#d4a73c]/20 to-[#ff4e2d]/20 border-[#d4a73c]/60 shadow-[0_0_15px_rgba(212,167,60,0.25)]'
                  : 'bg-[#181820] border-white/5 hover:border-white/15'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black font-mono-ui ${
                  isSelected ? 'bg-[#d4a73c] text-[#0b0b10]' : 'bg-white/5 text-white/40'
                }`}
              >
                {index + 1}
              </div>
              <div className="min-w-0">
                <p className={`text-xs font-black truncate max-w-[130px] ${isSelected ? 'text-[#d4a73c]' : 'text-white/70'}`}>
                  {arc.name}
                </p>
                <p className="text-[10px] text-white/30 font-mono-ui">
                  {completedCount}/{arc.stages.length} Selesai {arc.finished ? '🏅' : ''}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* ─── 2. VISUAL ADVENTURE MAP BANNER ─── */}
      <div className="bg-[#181820] border border-white/10 rounded-2xl p-5 md:p-6 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#d4a73c]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-start justify-between gap-4 flex-wrap mb-4 pb-4 border-b border-white/5 relative z-10">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-[9px] font-mono-ui font-black uppercase px-2 py-0.5 rounded bg-[#d4a73c]/20 text-[#d4a73c] border border-[#d4a73c]/30 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {currentArc.region || 'Wilayah Petualangan'}
              </span>
              {currentArc.finished && (
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  TAMAT & DITAKLUKKAN
                </span>
              )}
            </div>
            <h3 className="text-white font-black text-base md:text-lg">{currentArc.name}</h3>
            <p className="text-white/40 text-xs font-medium mt-1 leading-relaxed">{currentArc.desc}</p>
          </div>
        </div>

        {/* ─── 3. INTERACTIVE NODE PATH MAP ─── */}
        <div className="relative z-10 py-2 space-y-4">
          {currentArc.stages.map((stage, idx) => {
            const isBoss = stage.isBoss;
            const pct = Math.min(100, Math.round((stage.progress / stage.target) * 100));

            return (
              <div key={stage.id} className="relative flex items-start gap-4">
                {/* Node Milestone Circle */}
                <div className="flex flex-col items-center shrink-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all duration-300 ${
                      stage.claimed
                        ? 'bg-[#d4a73c]/20 border-[#d4a73c] text-[#d4a73c] shadow-[0_0_15px_rgba(212,167,60,0.4)]'
                        : stage.locked
                        ? 'bg-black/40 border-white/10 text-white/20'
                        : isBoss
                        ? 'bg-red-500/20 border-red-500 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.5)] animate-pulse'
                        : 'bg-white/10 border-white/20 text-white'
                    }`}
                  >
                    {stage.claimed ? (
                      <Check className="w-5 h-5" strokeWidth={3} />
                    ) : stage.locked ? (
                      <Lock className="w-4 h-4" />
                    ) : isBoss ? (
                      <Skull className="w-5 h-5" />
                    ) : (
                      <span className="font-black text-sm font-mono-ui">{idx + 1}</span>
                    )}
                  </div>

                  {/* Vertical Connection Line */}
                  {idx < currentArc.stages.length - 1 && (
                    <div
                      className={`w-1 min-h-[36px] my-1 rounded-full transition-colors ${
                        stage.claimed
                          ? 'bg-gradient-to-b from-[#d4a73c] to-[#d4a73c]/40'
                          : 'bg-white/5'
                      }`}
                    />
                  )}
                </div>

                {/* Stage Info Card */}
                <div
                  className={`flex-1 min-w-0 p-4 rounded-xl border transition-all duration-300 ${
                    stage.locked
                      ? 'bg-white/[0.01] border-white/5 opacity-50'
                      : stage.claimed
                      ? 'bg-white/[0.02] border-white/5 opacity-70'
                      : isBoss
                      ? 'bg-gradient-to-r from-red-950/30 via-[#181824] to-[#181824] border-red-500/40 shadow-[0_0_25px_rgba(239,68,68,0.15)]'
                      : stage.completed
                      ? 'bg-gradient-to-r from-[#d4a73c]/10 via-[#181820] to-[#181820] border-[#d4a73c]/40 shadow-[0_0_20px_rgba(212,167,60,0.15)]'
                      : 'bg-[#181820] border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isBoss && (
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/40">
                          BOS CERITA
                        </span>
                      )}
                      <h4 className={`font-black text-xs md:text-sm ${stage.claimed ? 'text-white/40' : 'text-white'}`}>
                        {stage.title}
                      </h4>
                    </div>
                    <span className="text-white/40 text-xs font-bold font-mono-ui tabular-nums shrink-0">
                      {stage.progress}/{stage.target}
                    </span>
                  </div>

                  <p className="text-white/40 text-xs font-medium mt-0.5 leading-relaxed">{stage.desc}</p>

                  {/* Reward Chips */}
                  <div className="flex items-center gap-2.5 flex-wrap mt-3 pt-2.5 border-t border-white/5 text-[11px] font-bold">
                    <span className="text-white/40">Hadiah:</span>
                    <span className="text-white/60">+{formatReward(stage.reward)}</span>
                    {stage.coins > 0 && (
                      <span className="text-[#d4a73c] flex items-center gap-1">
                        <Coins className="w-3 h-3" /> +{stage.coins} Koin
                      </span>
                    )}
                    {stage.tickets > 0 && (
                      <span className="text-purple-300 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> +{stage.tickets} Tiket
                      </span>
                    )}
                    {stage.badge && (
                      <span className="text-pink-300 flex items-center gap-1">
                        <Award className="w-3 h-3" /> Badge: "{stage.badge}"
                      </span>
                    )}
                  </div>

                  {/* Action Button */}
                  {!stage.locked && (
                    <div className="mt-3">
                      {isBoss && !stage.claimed ? (
                        <button
                          onClick={() => setActiveBossBattle({ boss: stage.boss, stageId: stage.id })}
                          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] shadow-lg shadow-red-600/30"
                        >
                          <Swords className="w-4 h-4" /> Tantang Bos Cerita ({stage.boss?.name})
                        </button>
                      ) : stage.completed ? (
                        <button
                          onClick={() => claim(currentArc.id, stage.id)}
                          disabled={stage.claimed || claiming === stage.id}
                          className={`w-full py-2 rounded-lg font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                            stage.claimed
                              ? 'bg-white/5 text-white/30 cursor-default'
                              : 'bg-gradient-to-r from-[#d4a73c] to-[#ff4e2d] text-[#0b0b10] hover:brightness-110 active:scale-[0.98] shadow-md shadow-[#d4a73c]/20'
                          }`}
                        >
                          {claiming === stage.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : stage.claimed ? (
                            <>
                              <Check className="w-3.5 h-3.5" strokeWidth={3} /> Sudah Diklaim
                            </>
                          ) : (
                            <>
                              <Gift className="w-3.5 h-3.5" /> Klaim Hadiah Stage
                            </>
                          )}
                        </button>
                      ) : (
                        <div className="w-full bg-black/40 rounded-full h-1.5 overflow-hidden p-0.5 border border-white/5">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#d4a73c] to-[#ff4e2d]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default StoryArc;
