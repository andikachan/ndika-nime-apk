import React, { useMemo, useState } from 'react';
import {
  Footprints, MessageCircle, Clock, Flame, Trophy, Crown, Star, Sparkles,
  Medal, Gem, Library, BookOpen, Compass, MessagesSquare, Users, Calendar,
  CalendarCheck, CalendarHeart, Award, Lock, HelpCircle
} from 'lucide-react';
import {
  ACHIEVEMENTS,
  TIERS,
  computeAchievementStats,
  getAchievementProgress,
  formatMetricValue
} from '../utils/achievements';

const ICONS = {
  Footprints, MessageCircle, Clock, Flame, Trophy, Crown, Star, Sparkles,
  Medal, Gem, Library, BookOpen, Compass, MessagesSquare, Users, Calendar,
  CalendarCheck, CalendarHeart, Award, HelpCircle
};

// ===== Badge kecil untuk "showcase" (dipakai di header profil) =====
export const BadgeShowcase = ({ user, history = [], chats = [], streak = null, triviaTotalCorrect = 0, max = 4 }) => {
  const unlocked = useMemo(() => {
    const stats = computeAchievementStats(user, history, chats, streak, triviaTotalCorrect);
    return getAchievementProgress(stats)
      .filter((b) => b.unlocked)
      .sort((a, b) => {
        const order = { platinum: 3, gold: 2, silver: 1, bronze: 0 };
        return order[b.tier] - order[a.tier];
      })
      .slice(0, max);
  }, [user, history, chats, streak, triviaTotalCorrect, max]);

  if (unlocked.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5">
      {unlocked.map((badge) => {
        const Icon = ICONS[badge.icon] || Award;
        const tier = TIERS[badge.tier];
        return (
          <div
            key={badge.id}
            title={`${badge.name} — ${badge.desc}`}
            className={`w-7 h-7 rounded-full ${tier.bg} border ${tier.ring} flex items-center justify-center`}
          >
            <Icon className={`w-3.5 h-3.5 ${tier.text}`} strokeWidth={2.5} />
          </div>
        );
      })}
    </div>
  );
};

// ===== Grid lengkap semua achievement (dipakai di tab Profil) =====
const Achievements = ({ user, history = [], chats = [], streak = null, triviaTotalCorrect = 0 }) => {
  const [filter, setFilter] = useState('all'); // 'all' | 'unlocked' | 'locked'

  const stats = useMemo(
    () => computeAchievementStats(user, history, chats, streak, triviaTotalCorrect),
    [user, history, chats, streak, triviaTotalCorrect]
  );
  const badges = useMemo(() => getAchievementProgress(stats), [stats]);

  const unlockedCount = badges.filter((b) => b.unlocked).length;

  const filtered = badges.filter((b) => {
    if (filter === 'unlocked') return b.unlocked;
    if (filter === 'locked') return !b.unlocked;
    return true;
  });

  // Kelompokkan per kategori, urutan kategori mengikuti urutan pertama muncul di ACHIEVEMENTS
  const categoryOrder = [...new Set(ACHIEVEMENTS.map((b) => b.category))];
  const grouped = categoryOrder
    .map((cat) => ({ cat, items: filtered.filter((b) => b.category === cat) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="bg-[#181820] border border-white/5 rounded-xl p-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div>
          <h3 className="text-white font-bold text-sm">Achievement</h3>
          <p className="text-white/30 text-xs font-medium mt-0.5">
            {unlockedCount} / {badges.length} badge terbuka
          </p>
        </div>
        <div className="flex items-center gap-2">
          {[
            ['all', 'Semua'],
            ['unlocked', 'Terbuka'],
            ['locked', 'Terkunci']
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all ${
                filter === key ? 'bg-[#d4a73c] text-[#0b0b10]' : 'bg-white/5 text-white/40 hover:bg-white/10'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Progress keseluruhan */}
      <div className="mb-6">
        <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
          <div
            className="bg-gradient-to-r from-[#d4a73c] to-[#ff4e2d] h-full rounded-full transition-all duration-500"
            style={{ width: `${badges.length ? Math.round((unlockedCount / badges.length) * 100) : 0}%` }}
          />
        </div>
      </div>

      {grouped.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-white/30 font-medium">Tidak ada badge di kategori ini</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ cat, items }) => (
            <div key={cat}>
              <p className="text-white/25 text-[10px] font-bold uppercase tracking-wider mb-2.5">{cat}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {items.map((badge) => {
                  const Icon = ICONS[badge.icon] || Award;
                  const tier = TIERS[badge.tier];

                  return (
                    <div
                      key={badge.id}
                      className={`relative rounded-xl p-3.5 border transition-all ${
                        badge.unlocked
                          ? `${tier.bg} ${tier.ring} ${tier.glow}`
                          : 'bg-white/[0.02] border-white/5 opacity-60'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                            badge.unlocked ? `bg-gradient-to-br ${tier.grad}` : 'bg-white/5'
                          }`}
                        >
                          {badge.unlocked ? (
                            <Icon className="w-5 h-5 text-[#0b0b10]" strokeWidth={2.5} />
                          ) : (
                            <Lock className="w-4 h-4 text-white/25" strokeWidth={2.5} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`font-bold text-xs truncate ${badge.unlocked ? 'text-white' : 'text-white/50'}`}>
                            {badge.name}
                          </p>
                          <p className="text-white/30 text-[10px] mt-0.5 leading-snug line-clamp-2">{badge.desc}</p>
                        </div>
                      </div>

                      {!badge.unlocked && (
                        <div className="mt-2.5">
                          <div className="w-full bg-white/5 rounded-full h-1 overflow-hidden">
                            <div
                              className="bg-white/25 h-full rounded-full transition-all duration-500"
                              style={{ width: `${badge.progress}%` }}
                            />
                          </div>
                          <p className="text-white/20 text-[9px] mt-1 tabular-nums">
                            {formatMetricValue(badge.current, badge.format)} / {formatMetricValue(badge.target, badge.format)}
                          </p>
                        </div>
                      )}

                      <span
                        className={`absolute top-2 right-2 text-[8px] font-bold uppercase tracking-wide ${tier.text}`}
                      >
                        {tier.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Achievements;
