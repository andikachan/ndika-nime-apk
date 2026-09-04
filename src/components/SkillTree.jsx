import React, { useEffect, useState } from 'react';
import { Zap, Clover, Swords, Brain, Trophy, Lock, Check, Loader2, Star } from 'lucide-react';

const ICONS = { Zap, Clover, Swords, Brain, Trophy };

const TIER_LABEL = { 1: 'Tier 1', 2: 'Tier 2', 3: 'Tier 3' };

// onUnlocked() dipanggil setelah skill berhasil dibuka, buat refresh data
// lain (mis. reward quest yang sekarang lebih besar).
const SkillTree = ({ onUnlocked }) => {
  const [loading, setLoading] = useState(true);
  const [skills, setSkills] = useState([]);
  const [unlocked, setUnlocked] = useState([]);
  const [points, setPoints] = useState(0);
  const [level, setLevel] = useState(0);
  const [loggedIn, setLoggedIn] = useState(true);
  const [unlocking, setUnlocking] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/quests/skills', { credentials: 'include' });
      const data = await res.json();
      if (res.ok && data.success) {
        setSkills(data.skills || []);
        setUnlocked(data.unlocked || []);
        setPoints(data.availablePoints || 0);
        setLevel(data.level || 0);
        setLoggedIn(data.loggedIn);
      }
    } catch (e) {
      console.error('Load skills error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const unlock = async (skillId) => {
    if (unlocking) return;
    setUnlocking(skillId);
    setError('');
    try {
      const res = await fetch('/api/v1/quests/skill-unlock', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await load();
        onUnlocked?.(skillId);
      } else {
        setError(data.error || 'Gagal membuka skill');
      }
    } catch (e) {
      console.error('Unlock skill error:', e);
      setError('Gagal membuka skill, coba lagi');
    } finally {
      setUnlocking(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2.5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-[#181820] border border-white/5 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!loggedIn) {
    return (
      <div className="bg-[#181820] border border-white/5 rounded-xl p-8 text-center">
        <Star className="w-8 h-8 text-white/15 mx-auto mb-2" />
        <p className="text-white/40 text-sm font-medium">Login untuk membuka Skill Tree</p>
      </div>
    );
  }

  let lastTier = null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-[#d4a73c]" strokeWidth={2.5} />
          <h3 className="text-white font-black text-sm">Skill Tree</h3>
        </div>
        <span className="text-[11px] font-bold text-[#d4a73c] bg-[#d4a73c]/10 px-2 py-1 rounded-full tabular-nums">
          {points} poin tersedia
        </span>
      </div>
      <p className="text-white/25 text-[11px] font-medium mb-3">Setiap naik level dapat 1 skill point (Level kamu: {level})</p>
      {error && <p className="text-red-400 text-[11px] font-medium mb-2">{error}</p>}

      <div className="space-y-2.5">
        {skills.map((skill) => {
          const Icon = ICONS[skill.icon] || Star;
          const isUnlocked = unlocked.includes(skill.id);
          const levelOk = level >= skill.requiredLevel;
          const canAfford = points >= skill.cost;
          const canUnlock = !isUnlocked && levelOk && canAfford;
          const showTierHeader = skill.tier !== lastTier;
          lastTier = skill.tier;

          return (
            <React.Fragment key={skill.id}>
              {showTierHeader && (
                <p className="text-white/20 text-[10px] font-bold uppercase tracking-wider pt-1">{TIER_LABEL[skill.tier]}</p>
              )}
              <div
                className={`p-3.5 rounded-xl border flex items-center gap-3 ${
                  isUnlocked ? 'bg-[#d4a73c]/[0.06] border-[#d4a73c]/25' : 'bg-[#181820] border-white/5'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isUnlocked ? 'bg-[#d4a73c]/15' : 'bg-white/5'}`}>
                  {!levelOk && !isUnlocked ? (
                    <Lock className="w-4 h-4 text-white/25" strokeWidth={2.25} />
                  ) : (
                    <Icon className={`w-5 h-5 ${isUnlocked ? 'text-[#d4a73c]' : 'text-white/50'}`} strokeWidth={2.25} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-bold text-sm ${isUnlocked ? 'text-[#d4a73c]' : 'text-white'}`}>{skill.name}</p>
                  <p className="text-white/30 text-[11px] font-medium">{skill.desc}</p>
                  {!levelOk && !isUnlocked && (
                    <p className="text-white/20 text-[10px] font-bold mt-0.5">Butuh Level {skill.requiredLevel}</p>
                  )}
                </div>
                <div className="shrink-0">
                  {isUnlocked ? (
                    <div className="w-8 h-8 rounded-lg bg-[#d4a73c]/15 flex items-center justify-center">
                      <Check className="w-4 h-4 text-[#d4a73c]" strokeWidth={3} />
                    </div>
                  ) : (
                    <button
                      onClick={() => unlock(skill.id)}
                      disabled={!canUnlock || unlocking === skill.id}
                      className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                        canUnlock
                          ? 'bg-[#d4a73c] text-[#0b0b10] hover:bg-[#ff4e2d] active:scale-[0.98]'
                          : 'bg-white/5 text-white/25 cursor-default'
                      }`}
                    >
                      {unlocking === skill.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : `${skill.cost}pt`}
                    </button>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default SkillTree;
