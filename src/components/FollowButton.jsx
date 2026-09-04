import React, { useEffect, useState } from 'react';
import { UserPlus, UserCheck, Loader2 } from 'lucide-react';

// Ditaruh di halaman profil user lain (bukan profil sendiri).
// onCountsChanged({followerCount, followingCount}) opsional, buat parent yang
// mau nampilin ulang angka follower di tempat lain di halaman yang sama.
const FollowButton = ({ targetUserId, onCountsChanged }) => {
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [counts, setCounts] = useState({ followerCount: 0, followingCount: 0 });

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/social/status?userId=${encodeURIComponent(targetUserId)}`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsFollowing(data.isFollowing);
        setCounts({ followerCount: data.followerCount, followingCount: data.followingCount });
        onCountsChanged?.({ followerCount: data.followerCount, followingCount: data.followingCount });
      }
    } catch (e) {
      console.error('Load follow status error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (targetUserId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUserId]);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    const nextAction = isFollowing ? 'unfollow' : 'follow';
    try {
      const res = await fetch(`/api/v1/social/${nextAction}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsFollowing(data.isFollowing);
        const newCounts = { followerCount: data.followerCount, followingCount: data.followingCount };
        setCounts(newCounts);
        onCountsChanged?.(newCounts);
      }
    } catch (e) {
      console.error('Toggle follow error:', e);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="w-28 h-[42px] bg-white/5 border border-white/10 rounded-full animate-pulse" />;
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`px-5 py-2.5 rounded-full font-bold text-sm flex items-center gap-2 transition-all ${
        isFollowing
          ? 'bg-white/5 border border-white/10 text-white/70 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400'
          : 'bg-[#d4a73c] text-[#0b0b10] hover:bg-[#ff4e2d]'
      }`}
    >
      {busy ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : isFollowing ? (
        <>
          <UserCheck className="w-4 h-4" strokeWidth={2.5} />
          Following
        </>
      ) : (
        <>
          <UserPlus className="w-4 h-4" strokeWidth={2.5} />
          Follow
        </>
      )}
    </button>
  );
};

export default FollowButton;
