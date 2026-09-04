import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { useAdaptiveInterval } from '../hooks/useAdaptiveInterval';

const Leaderboard = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadLeaderboard();
  }, []);

  useAdaptiveInterval(loadLeaderboard, 60000);

  const loadLeaderboard = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/user/leaderboard', { credentials: 'include' });
      const data = await res.json();

      if (res.ok) {
        setUsers(data.users || []);
        setError('');
      } else {
        setError(data.message || 'Gagal memuat leaderboard');
      }
    } catch (error) {
      console.error('Leaderboard error:', error);
      setError('Gagal memuat leaderboard');
    } finally {
      setLoading(false);
    }
  };

  const formatWatchTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}j ${minutes}m`;
    return `${minutes}m`;
  };

  const handleUserClick = (userId) => {
    navigate(`/user/${userId}`);
  };

  if (loading) {
    return (
      <div className="bg-[#181820] border border-[#2a2a35] card-cut p-6 text-center">
        <div className="w-6 h-6 border-2 border-[#d4a73c]/20 border-t-[#d4a73c] rounded-full animate-spin mx-auto"></div>
        <p className="text-white/40 text-sm mt-3 font-medium">Memuat leaderboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#181820] border border-[#2a2a35] card-cut p-6 text-center">
        <AlertCircle className="w-5 h-5 text-red-400/70 mx-auto mb-2" strokeWidth={2} />
        <p className="text-red-400 text-sm font-medium">{error}</p>
        <button
          onClick={loadLeaderboard}
          className="mt-3 inline-flex items-center gap-1.5 text-[#d4a73c] text-sm font-medium hover:text-[#f5c45c] transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" strokeWidth={2} />
          Coba lagi
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#181820] border border-[#2a2a35] card-cut overflow-hidden">
      <div className="flex items-baseline justify-between p-4 border-b border-white/5">
        <div>
          <h3 className="font-display text-[#f0ead9] text-xl leading-tight tracking-wide">Leaderboard</h3>
          <p className="text-white/30 text-xs font-medium mt-0.5">Top 100 · total waktu nonton</p>
        </div>
        <span className="text-white/20 text-[10px] font-bold uppercase tracking-wider">
          {users.length} pengguna
        </span>
      </div>

      <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
        {users.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-white/30 text-sm font-medium">Belum ada data</p>
          </div>
        ) : (
          users.map((user) => {
            const isTop3 = user.rank <= 3;
            return (
              <div
                key={user.id}
                onClick={() => handleUserClick(user.id)}
                className={`group flex items-center gap-4 p-3 border-b border-white/5 hover:bg-white/[0.04] transition-colors cursor-pointer ${
                  isTop3 ? 'relative' : ''
                }`}
              >
                {isTop3 && (
                  <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#ff4e2d]" />
                )}

                <div
                  className={`w-9 text-center shrink-0 tabular-nums ${
                    isTop3 ? 'font-mono-ui text-[#ff4e2d] text-2xl font-bold' : 'font-mono-ui text-white/25 text-sm font-bold'
                  }`}
                >
                  {user.rank}
                </div>

                <img
                  src={user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=D4A73C&color=0B0B10&size=128`}
                  alt={user.name}
                  className="w-10 h-10 rounded-full object-cover border border-[#2a2a35] shrink-0"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=D4A73C&color=0B0B10&size=128`;
                  }}
                />

                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-sm truncate group-hover:text-[#d4a73c] transition-colors">
                    {user.name}
                  </p>
                  <p className="text-white/30 text-xs truncate">{user.title || 'Anime Lover'}</p>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-white text-sm font-bold tabular-nums">{formatWatchTime(user.watchTime)}</p>
                  <p className="text-white/25 text-[10px] font-bold uppercase tracking-wider mt-0.5">
                    Lv.{user.level}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
