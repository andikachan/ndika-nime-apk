import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

const UserLevel = ({ user }) => {
  const [level, setLevel] = useState(user?.level || 0);
  const [watchTime, setWatchTime] = useState(user?.watchTime || 0);
  const [title, setTitle] = useState(user?.title || 'Anime Newbie');
  const [nextLevelProgress, setNextLevelProgress] = useState(0);
  const [showLevelUp, setShowLevelUp] = useState(false);

  useEffect(() => {
    if (user) {
      setLevel(user.level || 0);
      setWatchTime(user.watchTime || 0);
      setTitle(user.title || 'Anime Newbie');

      // Calculate progress to next level
      const currentLevel = user.level || 0;
      const currentWatchTime = user.watchTime || 0;
      const progress = ((currentWatchTime - (currentLevel * 600)) / 600) * 100;
      setNextLevelProgress(Math.min(progress, 100));
    }
  }, [user]);

  // Format watch time
  const formatWatchTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}j ${minutes}m`;
    return `${minutes}m`;
  };

  if (!user) {
    return (
      <div className="bg-[#181820] border border-white/5 rounded-xl p-4 text-center">
        <p className="text-white/40 text-sm font-medium">Login untuk melihat level</p>
      </div>
    );
  }

  return (
    <div className="bg-[#181820] border border-white/5 rounded-xl p-4">
      {/* Level Up Notification */}
      {showLevelUp && (
        <div className="mb-3 p-3 bg-[#d4a73c]/10 border border-[#d4a73c]/20 rounded-lg flex items-center justify-center gap-2 animate-[slideDown_0.3s_ease-out]">
          <ArrowUp className="w-4 h-4 text-[#d4a73c]" strokeWidth={2.5} />
          <p className="text-[#d4a73c] font-bold text-sm">Naik level — sekarang Lv.{level}</p>
        </div>
      )}

      {/* Level Display */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-xl bg-[#d4a73c]/10 border-2 border-[#d4a73c]/30 flex items-center justify-center flex-shrink-0">
          <span className="text-2xl font-black text-[#d4a73c] tabular-nums">{level}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-white font-bold text-lg truncate">{title}</h3>
            <span className="text-[#d4a73c] font-bold text-sm shrink-0">Lv.{level}</span>
          </div>
          <p className="text-white/40 text-xs font-medium">
            Total nonton: {formatWatchTime(watchTime)}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-3">
        <div className="flex justify-between text-xs text-white/30 mb-1">
          <span>Progress ke Lv.{level + 1}</span>
          <span className="tabular-nums">{Math.round(nextLevelProgress)}%</span>
        </div>
        <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
          <div
            className="bg-gradient-to-r from-[#d4a73c] to-[#ff4e2d] h-full rounded-full transition-all duration-500"
            style={{ width: `${nextLevelProgress}%` }}
          />
        </div>
        <p className="text-white/20 text-[9px] mt-1 text-center">
          {formatWatchTime((level + 1) * 600 - watchTime)} lagi ke level berikutnya
        </p>
      </div>
    </div>
  );
};

export default UserLevel;
