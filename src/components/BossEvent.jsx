import React, { useEffect, useState } from 'react';
import { Skull, Gift, Check, Loader2 } from 'lucide-react';

// onClaimed() dipanggil setelah klaim reward boss sukses, supaya parent bisa
// refresh data user (watchTime/level ikut naik).
const BossEvent = ({ onClaimed }) => {
  const [loading, setLoading] = useState(true);
  const [boss, setBoss] = useState(null);
  const [loggedIn, setLoggedIn] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/quests/boss', { credentials: 'include' });
      const data = await res.json();
      if (res.ok && data.success) {
        setBoss(data.boss);
        setLoggedIn(data.loggedIn);
      }
    } catch (e) {
      console.error('Load boss error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const claim = async () => {
    if (claiming) return;
    setClaiming(true);
    setError('');
    try {
      const res = await fetch('/api/v1/quests/boss-claim', {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBoss(data.boss);
        onClaimed?.(data);
      } else {
        setError(data.error || 'Gagal klaim reward boss');
      }
    } catch (e) {
      console.error('Claim boss error:', e);
      setError('Gagal klaim reward, coba lagi');
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return <div className="h-40 bg-[#181820] border border-white/5 rounded-xl animate-pulse" />;
  }

  if (!boss) return null;

  const pct = Math.min(100, Math.round((boss.progress / boss.target) * 100));

  return (
    <div
      className={`relative overflow-hidden rounded-xl border p-5 ${
        boss.defeated ? 'bg-[#d4a73c]/[0.06] border-[#d4a73c]/25' : 'bg-[#181820] border-white/5'
      }`}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border-2 ${
          boss.defeated ? 'bg-[#d4a73c]/15 border-[#d4a73c]/40' : 'bg-white/5 border-white/10'
        }`}>
          <Skull className={`w-6 h-6 ${boss.defeated ? 'text-[#d4a73c]' : 'text-white/40'}`} strokeWidth={2.25} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-black text-sm">{boss.theme?.name || 'Boss Mingguan'}</h3>
          <p className="text-white/30 text-[11px] font-medium">{boss.theme?.tagline || 'Serang bareng-bareng lewat nonton & baca komik'}</p>
        </div>
        {boss.defeated && (
          <span className="text-[10px] font-bold text-[#d4a73c] bg-[#d4a73c]/10 px-2 py-1 rounded-full shrink-0">KALAH!</span>
        )}
      </div>

      <div className="flex justify-between text-[11px] text-white/40 font-bold mb-1">
        <span>Total Damage Komunitas</span>
        <span className="tabular-nums">{boss.progress}/{boss.target}</span>
      </div>
      <div className="w-full bg-white/5 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            boss.defeated ? 'bg-gradient-to-r from-[#d4a73c]/70 to-[#d4a73c]' : 'bg-gradient-to-r from-red-500/70 to-orange-400'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {error && <p className="text-red-400 text-[11px] font-medium mt-2">{error}</p>}

      {!loggedIn ? (
        <p className="text-white/25 text-[11px] font-medium mt-3">Login buat ikut nyerang boss ini</p>
      ) : boss.defeated ? (
        <button
          onClick={claim}
          disabled={!boss.canClaim || claiming}
          className={`w-full mt-3.5 py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${
            boss.claimed
              ? 'bg-white/5 text-white/30 cursor-default'
              : boss.canClaim
              ? 'bg-[#d4a73c] text-[#0b0b10] hover:bg-[#ff4e2d] active:scale-[0.98]'
              : 'bg-white/5 text-white/25 cursor-default'
          }`}
        >
          {claiming ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : boss.claimed ? (
            <>
              <Check className="w-4 h-4" strokeWidth={3} />
              Reward sudah diklaim
            </>
          ) : boss.canClaim ? (
            <>
              <Gift className="w-4 h-4" strokeWidth={2.5} />
              Klaim Reward (+{Math.round(boss.reward / 60)}m XP)
            </>
          ) : (
            'Kamu belum berkontribusi minggu ini'
          )}
        </button>
      ) : (
        <p className="text-white/25 text-[11px] font-medium mt-3">
          {boss.contributed ? 'Kamu sudah ikut nyerang! Ajak yang lain buat ngalahin boss ini 💪' : 'Nonton episode atau baca chapter buat mulai nyerang!'}
        </p>
      )}
    </div>
  );
};

export default BossEvent;
