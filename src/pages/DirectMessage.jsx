import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Plus, Flame, HeartCrack, RotateCcw, X, Clapperboard, BookOpen, Loader2, MessageSquare } from 'lucide-react';
import AvatarFrame from '../components/AvatarFrame';
import ShareToChatModal from '../components/ShareToChatModal';
import { setSeoMeta } from '../utils/seo';
import { useAuth } from '../context/AuthContext';
import { useAdaptiveInterval } from '../hooks/useAdaptiveInterval';

const IMG_PROXY = (url) => `https://cfelainawanggy.pages.dev/?action=proxy&url=${encodeURIComponent(url)}`;

const formatClock = (ts) => new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

const formatLastSeen = (ts) => {
  if (!ts) return '';
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return 'baru saja';
  if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  return `${Math.floor(diff / 86400)} hari lalu`;
};

const ShareCard = ({ share, isMine }) => {
  const navigate = useNavigate();
  if (!share) return null;

  if (share.kind === 'story' || share.kind === 'note') {
    const isNote = share.kind === 'note';
    return (
      <button
        onClick={() => share.ownerId && navigate(`/user/${share.ownerId}`)}
        className={`flex items-center gap-3 p-2 rounded-xl border w-full text-left transition-colors ${isMine ? 'bg-black/15 border-black/10 hover:bg-black/25' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
      >
        {isNote ? (
          <div className="w-11 h-11 rounded-md shrink-0 bg-white flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-[#0b0b10]" />
          </div>
        ) : share.storyType === 'image' || share.storyType === 'video' ? (
          <div className="relative w-11 aspect-[3/4.5] rounded-md shrink-0 overflow-hidden bg-black">
            {share.storyType === 'video' ? (
              <video src={share.mediaUrl} className="w-full h-full object-cover" muted />
            ) : (
              <img src={IMG_PROXY(share.mediaUrl)} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
            )}
          </div>
        ) : (
          <div
            className="w-11 aspect-[3/4.5] rounded-md shrink-0 flex items-center justify-center p-1"
            style={{ backgroundColor: share.bgColor || '#d4a73c' }}
          >
            <p className="text-white text-[8px] font-black text-center leading-tight line-clamp-4">{share.text}</p>
          </div>
        )}
        <div className="min-w-0">
          <div className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-wide ${isMine ? 'text-black/50' : 'text-white/40'}`}>
            <MessageSquare className="w-3 h-3" />
            {isNote ? 'Membalas Catatan' : 'Membalas Story'}
          </div>
          <p className={`text-xs font-bold line-clamp-2 ${isMine ? 'text-[#0b0b10]' : 'text-white'}`}>
            {share.text || (isNote ? '' : share.storyType === 'video' ? 'Video' : 'Foto')}
          </p>
        </div>
      </button>
    );
  }

  const isAnime = share.kind === 'anime';
  return (
    <button
      onClick={() => navigate(isAnime ? `/anime/${share.slug}` : `/komik/${share.slug}`)}
      className={`flex items-center gap-3 p-2 rounded-xl border w-full text-left transition-colors ${isMine ? 'bg-black/15 border-black/10 hover:bg-black/25' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
    >
      {share.cover && (
        <img src={IMG_PROXY(share.cover)} referrerPolicy="no-referrer" className="w-11 aspect-[3/4.5] object-cover rounded-md shrink-0" alt={share.title} />
      )}
      <div className="min-w-0">
        <div className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-wide ${isMine ? 'text-black/50' : 'text-white/40'}`}>
          {isAnime ? <Clapperboard className="w-3 h-3" /> : <BookOpen className="w-3 h-3" />}
          {isAnime ? 'Anime' : 'Komik'}
        </div>
        <p className={`text-xs font-bold line-clamp-2 ${isMine ? 'text-[#0b0b10]' : 'text-white'}`}>{share.title}</p>
      </div>
    </button>
  );
};

const DirectMessage = () => {
  const { userId: targetUserId } = useParams();
  const navigate = useNavigate();
  const { user: me, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [otherUser, setOtherUser] = useState(null);
  const [presence, setPresence] = useState({ isOnline: false, lastSeen: null });
  const [messages, setMessages] = useState([]);
  const [streak, setStreak] = useState(null);
  const [text, setText] = useState('');
  const [pendingShare, setPendingShare] = useState(null);
  const [showSharePicker, setShowSharePicker] = useState(false);
  const [sending, setSending] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const bottomRef = useRef(null);
  const scrollBoxRef = useRef(null);
  const firstLoadRef = useRef(true);

  useEffect(() => {
    setSeoMeta('Pesan | Ndichan', 'Chat pribadi sesama pengguna Ndichan.', null, null, { noIndex: true });
  }, []);

  const loadMessages = useCallback(async (silent = false) => {
    try {
      const res = await fetch(`/api/v1/dm/messages?userId=${encodeURIComponent(targetUserId)}`, { credentials: 'include' });
      if (res.status === 404) { setNotFound(true); return; }
      const data = await res.json();
      if (data.success) {
        setOtherUser(data.otherUser);
        setPresence({ isOnline: data.isOnline, lastSeen: data.lastSeen });
        setMessages(data.messages || []);
        setStreak(data.streak || null);
      }
    } catch (error) {
      console.error('Load DM messages error:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [targetUserId]);

  useEffect(() => {
    if (authLoading) return;
    if (!me) {
      navigate('/home');
      return;
    }
    if (me.id === targetUserId) {
      navigate('/profile');
      return;
    }
    loadMessages();
  }, [me, authLoading, targetUserId, navigate, loadMessages]);

  useAdaptiveInterval(() => loadMessages(true), me ? 5000 : null);

  useEffect(() => {
    if (!scrollBoxRef.current) return;
    bottomRef.current?.scrollIntoView({ behavior: firstLoadRef.current ? 'auto' : 'smooth' });
    firstLoadRef.current = false;
  }, [messages.length]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed && !pendingShare) return;
    setSending(true);
    try {
      const res = await fetch('/api/v1/dm/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ targetUserId, text: trimmed, share: pendingShare || undefined })
      });
      const data = await res.json();
      if (data.success) {
        setMessages((prev) => [...prev, data.message]);
        setStreak(data.streak);
        setText('');
        setPendingShare(null);
      }
    } catch (error) {
      console.error('Send DM error:', error);
    } finally {
      setSending(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const res = await fetch('/api/v1/dm/restore-streak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ targetUserId })
      });
      const data = await res.json();
      if (data.success) {
        setStreak(data.streak);
      } else {
        alert(data.error || 'Gagal restore streak');
      }
    } catch (error) {
      console.error('Restore streak error:', error);
    } finally {
      setRestoring(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#0b0b10]" />;
  if (notFound) {
    return (
      <div className="min-h-screen bg-[#0b0b10] text-white flex flex-col items-center justify-center gap-3 font-nunito">
        <p className="text-white/40 text-sm font-medium">User gak ditemukan</p>
        <button onClick={() => navigate('/messages')} className="text-[#d4a73c] text-sm font-bold">Kembali ke Pesan</button>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#0b0b10] font-nunito text-white flex flex-col overflow-hidden">
      {/* Header percakapan */}
      <div className="shrink-0 pt-4 pb-3 px-4 md:px-6 border-b border-white/[0.06] bg-[#0b0b10]">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/messages')} className="p-2 rounded-full hover:bg-white/5 shrink-0">
            <ArrowLeft className="w-5 h-5 text-white/60" />
          </button>
          {otherUser && (
            <button onClick={() => navigate(`/user/${otherUser.id}`)} className="flex items-center gap-3 min-w-0 flex-1 text-left">
              <div className="relative shrink-0">
                <AvatarFrame frameId={otherUser.frame} className="w-10 h-10" rounded="rounded-full">
                  <img
                    src={otherUser.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(otherUser.name)}&background=F6CF80&color=0a0a0c&size=128`}
                    alt={otherUser.name}
                    className="w-full h-full object-cover rounded-full"
                  />
                </AvatarFrame>
                <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#0b0b10] ${presence.isOnline ? 'bg-green-400' : 'bg-white/20'}`} />
              </div>
              <div className="min-w-0">
                <p className="text-white font-black text-sm truncate">{otherUser.name}</p>
                <p className="text-white/30 text-[11px] font-medium truncate">
                  {presence.isOnline ? 'Online' : presence.lastSeen ? `Terakhir dilihat ${formatLastSeen(presence.lastSeen)}` : 'Offline'}
                </p>
              </div>
            </button>
          )}

          {streak && streak.status !== 'none' && (
            <div className="flex items-center gap-1.5 shrink-0">
              {streak.status === 'active' ? (
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/20">
                  <Flame className="w-3.5 h-3.5 text-orange-400" fill="currentColor" />
                  <span className="text-orange-300 text-xs font-black">{streak.count}</span>
                </div>
              ) : (
                <button
                  onClick={handleRestore}
                  disabled={restoring || streak.restoresLeft <= 0}
                  title={streak.restoresLeft > 0 ? `${streak.restoresLeft}x kesempatan restore bulan ini` : 'Kesempatan restore bulan ini habis'}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 hover:border-[#d4a73c]/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <HeartCrack className="w-3.5 h-3.5 text-white/40" />
                  {restoring ? (
                    <Loader2 className="w-3 h-3 text-white/50 animate-spin" />
                  ) : (
                    <RotateCcw className="w-3 h-3 text-white/50" />
                  )}
                  <span className="text-white/50 text-[10px] font-black">{streak.restoresLeft}x</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Daftar pesan */}
      <div ref={scrollBoxRef} className="flex-1 overflow-y-auto px-4 md:px-6 py-4">
        <div className="max-w-2xl mx-auto space-y-2.5">
          {messages.length === 0 && (
            <p className="text-center text-white/25 text-xs font-medium py-10">Mulai ngobrol sama {otherUser?.name || 'user ini'}!</p>
          )}
          {messages.map((msg) => {
            const isMine = msg.senderId === me?.id;
            return (
              <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 ${isMine ? 'bg-[#d4a73c] text-[#0b0b10]' : 'bg-[#181820] border border-white/10 text-white'}`}>
                  {msg.type === 'share' && msg.share && (
                    <div className={msg.text ? 'mb-2' : ''}>
                      <ShareCard share={msg.share} isMine={isMine} />
                    </div>
                  )}
                  {msg.text && <p className="text-sm font-medium whitespace-pre-wrap break-words">{msg.text}</p>}
                  <p className={`text-[10px] font-bold mt-1 text-right ${isMine ? 'text-black/40' : 'text-white/25'}`}>{formatClock(msg.createdAt)}</p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-white/[0.06] bg-[#0b0b10] px-4 md:px-6 py-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <div className="max-w-2xl mx-auto">
          {pendingShare && (
            <div className="mb-2 flex items-center gap-2 bg-[#141419] border border-white/10 rounded-xl p-2">
              <div className="flex-1 min-w-0">
                <ShareCard share={pendingShare} isMine={false} />
              </div>
              <button onClick={() => setPendingShare(null)} className="p-1.5 rounded-full hover:bg-white/10 shrink-0">
                <X className="w-4 h-4 text-white/50" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSharePicker(true)}
              className="p-2.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 shrink-0"
              title="Share anime/komik"
            >
              <Plus className="w-4 h-4 text-white/60" />
            </button>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Tulis pesan..."
              className="flex-1 bg-[#141419] border border-[#2a2a35] rounded-full px-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#d4a73c]/50"
            />
            <button
              onClick={handleSend}
              disabled={sending || (!text.trim() && !pendingShare)}
              className="p-2.5 rounded-full bg-[#d4a73c] hover:bg-[#e0b654] disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              <Send className="w-4 h-4 text-[#0b0b10]" />
            </button>
          </div>
        </div>
      </div>

      {showSharePicker && (
        <ShareToChatModal
          onClose={() => setShowSharePicker(false)}
          onSelect={(share) => { setPendingShare(share); setShowSharePicker(false); }}
        />
      )}
    </div>
  );
};

export default DirectMessage;
