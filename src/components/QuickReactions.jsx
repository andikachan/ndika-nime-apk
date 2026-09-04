import React, { useEffect, useState, useCallback } from 'react';

// Urutan tetap biar layout nggak "loncat-loncat" tiap kali data reload
const EMOJIS = [
  { emoji: '🔥', label: 'Keren' },
  { emoji: '😂', label: 'Lucu' },
  { emoji: '😭', label: 'Sedih' },
  { emoji: '😍', label: 'Suka' },
  { emoji: '😱', label: 'Plot twist' },
  { emoji: '👍', label: 'Mantap' },
];

/**
 * Reaksi cepat 1-klik untuk episode anime / chapter komik.
 * Dipakai berdampingan dengan CommentSection, pakai type+targetId yang SAMA
 * supaya "mood" nyambung ke konten yang sama:
 * - Episode anime : <QuickReactions type="anime" targetId={`${slug}:${epNum}`} />
 * - Chapter komik : <QuickReactions type="chapter" targetId={chapterSlug} />
 */
const QuickReactions = ({ type, targetId, label = 'Gimana menurutmu?' }) => {
  const [counts, setCounts] = useState({});
  const [userReaction, setUserReaction] = useState(null);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [pending, setPending] = useState(null); // emoji yang lagi diproses

  const fetchReactions = useCallback(async () => {
    if (!type || !targetId) return;
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/v1/social/reaction-get?type=${encodeURIComponent(type)}&id=${encodeURIComponent(targetId)}`,
        { credentials: 'include' }
      );
      const data = await res.json();
      if (data?.success) {
        setCounts(data.counts || {});
        setUserReaction(data.userReaction || null);
        setTotal(data.total || 0);
      }
    } catch (e) {
      console.error('Gagal memuat reaksi:', e);
    } finally {
      setIsLoading(false);
    }
  }, [type, targetId]);

  useEffect(() => {
    fetchReactions();
  }, [fetchReactions]);

  const handleLoginClick = () => {
    window.dispatchEvent(new CustomEvent('ndichan:open-login'));
  };

  const handleClick = async (emoji) => {
    if (pending) return;

    // Optimistic update biar terasa instan
    const prevCounts = counts;
    const prevReaction = userReaction;
    const prevTotal = total;

    const nextCounts = { ...counts };
    let nextTotal = total;

    if (prevReaction === emoji) {
      nextCounts[emoji] = Math.max(0, (nextCounts[emoji] || 0) - 1);
      nextTotal = Math.max(0, nextTotal - 1);
      setUserReaction(null);
    } else {
      if (prevReaction) {
        nextCounts[prevReaction] = Math.max(0, (nextCounts[prevReaction] || 0) - 1);
        nextTotal = Math.max(0, nextTotal - 1);
      }
      nextCounts[emoji] = (nextCounts[emoji] || 0) + 1;
      nextTotal += 1;
      setUserReaction(emoji);
    }
    setCounts(nextCounts);
    setTotal(nextTotal);
    setPending(emoji);

    try {
      const res = await fetch('/api/v1/social/reaction-toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type, id: targetId, emoji }),
      });
      const data = await res.json();

      if (res.status === 401) {
        // Belum login -> batalkan optimistic update, buka popup login
        setCounts(prevCounts);
        setUserReaction(prevReaction);
        setTotal(prevTotal);
        handleLoginClick();
        return;
      }

      if (res.ok && data?.success) {
        setCounts(data.counts || {});
        setUserReaction(data.userReaction || null);
        setTotal(data.total || 0);
      } else {
        // Gagal -> rollback
        setCounts(prevCounts);
        setUserReaction(prevReaction);
        setTotal(prevTotal);
      }
    } catch (e) {
      console.error('Gagal kirim reaksi:', e);
      setCounts(prevCounts);
      setUserReaction(prevReaction);
      setTotal(prevTotal);
    } finally {
      setPending(null);
    }
  };

  // Emoji dengan count tertinggi = "mood komunitas" saat ini
  const topEmoji = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const hasReactions = total > 0;

  return (
    <div className="flex flex-wrap items-center gap-3 py-1">
      <span className="text-[11px] font-bold text-white/40 uppercase tracking-wider shrink-0">
        {label}
      </span>

      <div className="flex flex-wrap items-center gap-1.5">
        {EMOJIS.map(({ emoji, label: emojiLabel }) => {
          const count = counts[emoji] || 0;
          const isActive = userReaction === emoji;
          const isPending = pending === emoji;

          return (
            <button
              key={emoji}
              type="button"
              title={emojiLabel}
              onClick={() => handleClick(emoji)}
              disabled={isLoading || (pending && !isPending)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-bold transition-all border ${
                isActive
                  ? 'bg-[#d4a73c]/15 border-[#d4a73c]/50 text-[#d4a73c] scale-105'
                  : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:border-white/20'
              } ${isPending ? 'opacity-60' : ''} disabled:cursor-not-allowed`}
            >
              <span className="text-sm leading-none">{emoji}</span>
              {count > 0 && <span className="tabular-nums">{count}</span>}
            </button>
          );
        })}
      </div>

      {hasReactions && topEmoji && (
        <span className="text-[10px] text-white/25 font-medium shrink-0">
          Mood komunitas: {topEmoji[0]} · {total} reaksi
        </span>
      )}
    </div>
  );
};

export default QuickReactions;
