import React, { useEffect, useState } from 'react';
import { Flame, Check, Gift, Loader2 } from 'lucide-react';

const MILESTONES = [3, 7, 30, 100];

const nextMilestone = (count) => MILESTONES.find((m) => m > count) || null;

const formatBonus = (seconds) => {
  if (!seconds) return '0m';
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m XP`;
};

// onClaimed(data) dipanggil setelah klaim sukses, supaya parent (Profile.jsx)
// bisa refresh data user (watchTime/level ikut berubah karena bonus XP).
const DailyStreak = ({ onClaimed }) => {
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [streak, setStreak] = useState({ count: 0, longest: 0, totalCheckIns: 0 });
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);
  const [nextBonusSeconds, setNextBonusSeconds] = useState(120);
  const [error, setError] = useState('');
  const [celebrate, setCelebrate] = useState(null); // { bonusSeconds, milestoneReached, newCount }

  const loadStatus = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/user/streak', { credentials: 'include' });
      const data = await res.json();
      if (res.ok && data.success) {
        setStreak(data.streak);
        setAlreadyCheckedIn(data.alreadyCheckedIn);
        setNextBonusSeconds(data.nextBonusSeconds || 120);
      }
    } catch (e) {
      console.error('Load streak error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const claim = async () => {
    if (claiming || alreadyCheckedIn) return;
    setClaiming(true);
    setError('');
    try {
      const res = await fetch('/api/v1/user/streak', {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setStreak(data.streak);
        setAlreadyCheckedIn(true);
        setCelebrate({ bonusSeconds: data.bonusSeconds, milestoneReached: data.milestoneReached, newCount: data.streak.count });
        setTimeout(() => setCelebrate(null), 4000);
        onClaimed?.(data);
      } else if (res.status === 409) {
        // Race condition / sudah klaim di tab lain
        setAlreadyCheckedIn(true);
        setStreak(data.streak || streak);
      } else {
        setError(data.error || 'Gagal klaim hadiah');
      }
    } catch (e) {
      console.error('Claim streak error:', e);
      setError('Gagal klaim hadiah, coba lagi');
    } finally {
      setClaiming(false);
    }
  };

  const upcoming = nextMilestone(streak.count);

  return (
    <div className="bg-[#181820] border border-white/5 rounded-xl p-4 relative overflow-hidden">
      {/* Celebration banner saat baru klaim */}
      {celebrate && (
        <div className="mb-3 p-3 bg-[#d4a73c]/10 border border-[#d4a73c]/20 rounded-lg flex items-center gap-2 animate-[slideDown_0.3s_ease-out]">
          <Gift className="w-4 h-4 text-[#d4a73c] shrink-0" strokeWidth={2.5} />
          <p className="text-[#d4a73c] font-bold text-xs">
            {celebrate.milestoneReached
              ? `Milestone ${celebrate.newCount} hari tercapai! +${formatBonus(celebrate.bonusSeconds)}`
              : `Hadiah diklaim: +${formatBonus(celebrate.bonusSeconds)}`}
          </p>
        </div>
      )}

      <div className="flex items-center gap-4">
        <div
          className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 border-2 ${
            streak.count > 0
              ? 'bg-gradient-to-br from-orange-500/20 to-[#d4a73c]/20 border-orange-400/40'
              : 'bg-white/5 border-white/10'
          }`}
        >
          <Flame
            className={`w-7 h-7 ${streak.count > 0 ? 'text-orange-400' : 'text-white/25'}`}
            strokeWidth={2.5}
            fill={streak.count > 0 ? 'currentColor' : 'none'}
            fillOpacity={streak.count > 0 ? 0.25 : 0}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            <h3 className="text-white font-black text-xl tabular-nums">{loading ? '—' : streak.count}</h3>
            <span className="text-white/40 text-xs font-bold">hari beruntun</span>
          </div>
          <p className="text-white/30 text-[11px] font-medium">
            Terpanjang: {streak.longest || 0} hari · Total klaim: {streak.totalCheckIns || 0}
          </p>
        </div>
      </div>

      {/* Progress ke milestone berikutnya */}
      {upcoming && (
        <div className="mt-3">
          <div className="flex justify-between text-[10px] text-white/30 mb-1">
            <span>Menuju milestone {upcoming} hari</span>
            <span className="tabular-nums">{streak.count}/{upcoming}</span>
          </div>
          <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-orange-400 to-[#d4a73c] h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.round((streak.count / upcoming) * 100))}%` }}
            />
          </div>
        </div>
      )}

      {error && <p className="text-red-400 text-[11px] font-medium mt-2">{error}</p>}

      <button
        onClick={claim}
        disabled={loading || claiming || alreadyCheckedIn}
        className={`w-full mt-3.5 py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${
          alreadyCheckedIn
            ? 'bg-white/5 text-white/30 cursor-default'
            : 'bg-[#d4a73c] text-[#0b0b10] hover:bg-[#ff4e2d] active:scale-[0.98]'
        }`}
      >
        {claiming ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : alreadyCheckedIn ? (
          <>
            <Check className="w-4 h-4" strokeWidth={3} />
            Sudah diklaim hari ini
          </>
        ) : (
          <>
            <Gift className="w-4 h-4" strokeWidth={2.5} />
            Klaim Hadiah Harian (+{formatBonus(nextBonusSeconds)})
          </>
        )}
      </button>
    </div>
  );
};

export default DailyStreak;
