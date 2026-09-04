import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Flame, HeartCrack, Loader2, MessageCircle, Image as ImageIcon, BookOpen, Clapperboard } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import AvatarFrame from '../components/AvatarFrame';
import StoryTray from '../components/StoryTray';
import { setSeoMeta, SITE_URL } from '../utils/seo';
import { useAuth } from '../context/AuthContext';
import { useAdaptiveInterval } from '../hooks/useAdaptiveInterval';

const timeAgo = (ts) => {
  if (!ts) return '';
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return 'Baru saja';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}j`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}h`;
  return new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
};

const lastMessagePreview = (msg, isMe) => {
  if (!msg) return 'Belum ada pesan';
  const prefix = isMe ? 'Kamu: ' : '';
  if (msg.type === 'share' && msg.share) {
    if (msg.share.kind === 'story') {
      return `${prefix}↩️ Membalas story`;
    }
    if (msg.share.kind === 'note') {
      return `${prefix}↩️ Membalas catatan`;
    }
    const label = msg.share.kind === 'anime' ? 'Anime' : 'Komik';
    return `${prefix}📤 Membagikan ${label}: ${msg.share.title}`;
  }
  return `${prefix}${msg.text || ''}`;
};

const Messages = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState([]);
  const [convLoading, setConvLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const searchTimeoutRef = useRef(null);

  useEffect(() => {
    setSeoMeta('Pesan | Ndichan', 'Chat pribadi sesama pengguna Ndichan.', null, `${SITE_URL}/messages`, { noIndex: true });
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/dm/conversations', { credentials: 'include' });
      const data = await res.json();
      if (data.success) setConversations(data.conversations || []);
    } catch (error) {
      console.error('Load conversations error:', error);
    } finally {
      setConvLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/home');
      return;
    }
    setLoading(false);
    loadConversations();
  }, [user, authLoading, navigate, loadConversations]);

  useAdaptiveInterval(loadConversations, user ? 20000 : null);

  useEffect(() => {
    clearTimeout(searchTimeoutRef.current);
    if (query.trim().length < 1) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/user/users?q=${encodeURIComponent(query.trim())}`, { credentials: 'include' });
        const data = await res.json();
        if (res.ok) setSearchResults((data.users || []).filter((u) => u.id !== user?.id));
      } catch (error) {
        console.error('Search users error:', error);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(searchTimeoutRef.current);
  }, [query, user?.id]);

  if (loading) {
    return <div className="min-h-screen bg-[#0b0b10]" />;
  }

  const isSearching = query.trim().length > 0;

  return (
    <div className="min-h-screen bg-[#0b0b10] font-nunito selection:bg-[#d4a73c] selection:text-black pb-24 text-white">
      <style>{`.no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
      <Navbar />

      <div className="pt-24 max-w-2xl mx-auto px-4 md:px-6">
        <div className="flex items-center gap-2 mb-6">
          <MessageCircle className="w-6 h-6 text-[#d4a73c]" strokeWidth={2.5} />
          <h1 className="font-display text-2xl md:text-3xl text-[#f0ead9] tracking-wide">Pesan</h1>
        </div>

        <div className="mb-6">
          <StoryTray currentUser={user} />
        </div>

        <div className="relative mb-6">
          <Search className="w-4 h-4 text-white/30 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari user buat mulai chat baru..."
            className="w-full bg-[#141419] border border-[#2a2a35] rounded-full pl-11 pr-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#d4a73c]/50 transition-colors"
          />
        </div>

        {isSearching ? (
          <div className="space-y-1">
            {searching ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-5 h-5 text-white/30 animate-spin" />
              </div>
            ) : searchResults.length === 0 ? (
              <p className="text-center text-white/25 text-sm py-10">Gak ada user ditemukan</p>
            ) : (
              searchResults.map((u) => (
                <button
                  key={u.id}
                  onClick={() => navigate(`/messages/${u.id}`)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors text-left"
                >
                  <AvatarFrame frameId={u.frame} className="w-11 h-11 shrink-0" rounded="rounded-full">
                    <img
                      src={u.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=F6CF80&color=0a0a0c&size=128`}
                      alt={u.name}
                      className="w-full h-full object-cover rounded-full"
                    />
                  </AvatarFrame>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-sm truncate">{u.name}</p>
                    <p className="text-white/30 text-xs font-medium truncate">Level {u.level || 0}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        ) : convLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 text-white/30 animate-spin" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-16">
            <MessageCircle className="w-10 h-10 text-white/15 mx-auto mb-3" />
            <p className="text-white/30 text-sm font-medium">Belum ada chat. Cari user di atas buat mulai ngobrol!</p>
          </div>
        ) : (
          <div className="space-y-1">
            {conversations.map((c) => (
              <button
                key={c.user.id}
                onClick={() => navigate(`/messages/${c.user.id}`)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors text-left"
              >
                <div className="relative shrink-0">
                  <AvatarFrame frameId={c.user.frame} className="w-12 h-12" rounded="rounded-full">
                    <img
                      src={c.user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.user.name)}&background=F6CF80&color=0a0a0c&size=128`}
                      alt={c.user.name}
                      className="w-full h-full object-cover rounded-full"
                    />
                  </AvatarFrame>
                  <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#0b0b10] ${c.isOnline ? 'bg-green-400' : 'bg-white/20'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={`text-sm truncate ${c.unread ? 'text-white font-black' : 'text-white/80 font-bold'}`}>{c.user.name}</p>
                    {c.streak?.status === 'active' && c.streak.count >= 3 && (
                      <span className="flex items-center gap-0.5 text-[10px] font-black text-orange-400 shrink-0">
                        <Flame className="w-3 h-3" fill="currentColor" /> {c.streak.count}
                      </span>
                    )}
                    {c.streak?.status === 'broken' && (
                      <HeartCrack className="w-3.5 h-3.5 text-white/25 shrink-0" />
                    )}
                  </div>
                  <p className={`text-xs truncate ${c.unread ? 'text-white/70 font-semibold' : 'text-white/35 font-medium'}`}>
                    {lastMessagePreview(c.lastMessage, c.lastMessage?.senderId === user?.id)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className="text-white/25 text-[10px] font-bold">{timeAgo(c.lastMessageAt)}</span>
                  {c.unread && <span className="w-2 h-2 rounded-full bg-[#d4a73c]" />}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default Messages;
