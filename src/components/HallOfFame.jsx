import React, { useEffect, useState } from 'react';
import { Trophy, Skull } from 'lucide-react';

const HallOfFame = () => {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetch('/api/v1/quests/hall-of-fame', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setHistory(data.history || []);
      })
      .catch((e) => console.error('Load hall of fame error:', e))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="h-40 bg-[#181820] border border-white/5 rounded-xl animate-pulse" />;
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="w-4 h-4 text-[#d4a73c]" strokeWidth={2.5} />
        <h3 className="text-white font-black text-sm">Hall of Fame Boss</h3>
      </div>

      {history.length === 0 ? (
        <div className="bg-[#181820] border border-white/5 rounded-xl p-8 text-center">
          <Skull className="w-8 h-8 text-white/15 mx-auto mb-2" />
          <p className="text-white/30 text-xs font-medium">Belum ada boss yang berhasil dikalahkan. Jadilah yang pertama!</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {history.map((entry, i) => (
            <div key={`${entry.week}-${i}`} className="p-3.5 bg-[#181820] border border-white/5 rounded-xl">
              <div className="flex items-center justify-between">
                <p className="text-white font-bold text-sm">{entry.theme?.name || 'Boss Mingguan'}</p>
                <span className="text-white/25 text-[10px] font-bold">{entry.week}</span>
              </div>
              <p className="text-white/30 text-[11px] font-medium mt-0.5">{entry.theme?.tagline}</p>
              <div className="flex items-center justify-between mt-2.5 text-[11px]">
                <span className="text-white/40">
                  Top: <b className="text-[#d4a73c]">{entry.topContributor?.name || '-'}</b>
                  {entry.topContributor && <span className="text-white/25"> ({entry.topContributor.damage} dmg)</span>}
                </span>
                <span className="text-white/30 font-bold">{entry.contributorCount} kontributor</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HallOfFame;
