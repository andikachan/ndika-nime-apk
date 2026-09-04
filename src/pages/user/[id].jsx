import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ClanBadge, { GiveExpModal } from '../../components/ClanBadge';
import { RefreshCw, UserX, X, Pencil, MessageCircle, Compass, Award, Globe } from 'lucide-react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import Achievements, { BadgeShowcase } from '../../components/Achievements';
import DailyStreak from '../../components/DailyStreak';
import TriviaGame from '../../components/TriviaGame';
import AvatarFrame from '../../components/AvatarFrame';
import AvatarAura from '../../components/AvatarAura';
import ProfileThemeSong from '../../components/ProfileThemeSong';
import StoryViewer from '../../components/StoryViewer';
import FollowButton from '../../components/FollowButton';
import FollowListModal from '../../components/FollowListModal';
import ProfileDeck from '../../components/ProfileDeck';
import { setSeoMeta, SITE_URL } from '../../utils/seo';
import { useAuth } from '../../context/AuthContext';

const UserProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [userData, setUserData] = useState(null);
  const [clanBadge, setClanBadge] = useState(null);
  const [history, setHistory] = useState([]);
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user: currentUser } = useAuth();
  const [streak, setStreak] = useState(null);
  const [triviaTotalCorrect, setTriviaTotalCorrect] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('history');
  const [followCounts, setFollowCounts] = useState({ followerCount: 0, followingCount: 0 });
  const [followModal, setFollowModal] = useState(null); // 'followers' | 'following' | null
  const [showGiveExp, setShowGiveExp] = useState(false);
  const [presence, setPresence] = useState({ isOnline: false, lastSeen: null });
  const [storyData, setStoryData] = useState(null); // { stories, note, hasUnseen }
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [passportData, setPassportData] = useState(null);

  // Chat media preview state
  const [revealedImages, setRevealedImages] = useState({});
  const [selectedImage, setSelectedImage] = useState(null);

  // Hitung genre favorit dari seluruh history
  const favoriteGenre = useMemo(() => {
    const counts = {};
    history.forEach(item => {
      if (!item.genre) return;
      item.genre
        .split(',')
        .map(g => g.trim())
        .filter(Boolean)
        .forEach(g => {
          counts[g] = (counts[g] || 0) + 1;
        });
    });

    const entries = Object.entries(counts);
    if (entries.length === 0) return '-';
    
    const maxCount = Math.max(...entries.map(([, c]) => c));
    const topGenres = entries.filter(([, c]) => c === maxCount).map(([g]) => g);
    return topGenres.length === 1
      ? topGenres[0]
      : topGenres[Math.floor(Math.random() * topGenres.length)];
  }, [history]);

  // Parse "x% y%" jadi objectPosition CSS, fallback ke tengah
  const bannerObjectPosition = useMemo(() => {
    const raw = userData?.bannerPosition;
    if (!raw || typeof raw !== 'string') return '50% 50%';
    const parts = raw.replace(/%/g, '').trim().split(/\s+/).map(Number);
    const x = Number.isFinite(parts[0]) ? parts[0] : 50;
    const y = Number.isFinite(parts[1]) ? parts[1] : 50;
    return `${x}% ${y}%`;
  }, [userData?.bannerPosition]);

  useEffect(() => {
    setSeoMeta(
      userData ? `${userData.name || 'Pengguna'} - Profil | Ndichan` : 'Profil Pengguna | Ndichan',
      'Halaman profil pengguna Ndichan.',
      userData?.picture || null,
      `${SITE_URL}/user/${id}`,
      { noIndex: true }
    );
  }, [userData, id]);

  // Ambil badge clan user yang lagi dilihat (buat identitas di header profil)
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    fetch(`/api/v1/clan/badge?userId=${encodeURIComponent(id)}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setClanBadge(data.success ? data.badge : null); })
      .catch(() => { if (!cancelled) setClanBadge(null); });

    fetch(`/api/v1/isekai/passport?userId=${encodeURIComponent(id)}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => { if (!cancelled && data.success) setPassportData(data); })
      .catch(() => { if (!cancelled) setPassportData(null); });

    return () => { cancelled = true; };
  }, [id]);

  // Record view or load own streak
  useEffect(() => {
    if (!currentUser?.id) return;

    if (currentUser.id !== id) {
      fetch('/api/v1/social/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ targetUserId: id })
      }).catch((e) => console.error('Record profile view error:', e));
    }

    if (currentUser.id === id) {
      fetch('/api/v1/user/streak', { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d?.streak) setStreak(d.streak); })
        .catch((e) => console.error('Load streak error:', e));

      fetch('/api/v1/trivia/today', { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d?.totalCorrect) setTriviaTotalCorrect(d.totalCorrect); })
        .catch((e) => console.error('Load trivia error:', e));
    }
  }, [currentUser, id]);

  // Story & catatan profil ini — sengaja tetap dimuat walaupun belum follow / belum login
  useEffect(() => {
    if (!id) return;
    const loadStory = async () => {
      try {
        const res = await fetch(`/api/v1/story/user-stories?userId=${id}`, { credentials: 'include' });
        const data = await res.json();
        if (res.ok && data.success) {
          setStoryData(data);
        }
      } catch (e) {
        console.error('Load profile story error:', e);
      }
    };
    loadStory();
  }, [id]);

  // Load user data with retry mechanism
  const loadUser = async (retryCount = 0) => {
    if (!id) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/v1/user/${id}/history`, { credentials: 'include' });
      const data = await res.json();

      if (res.ok) {
        setUserData(data.user);
        setHistory(data.history || []);
        setChats(data.chats || []);
      } else if (res.status === 404 && retryCount < 2) {
        setTimeout(() => loadUser(retryCount + 1), 1000);
      } else {
        setError(data.error || 'User not found');
      }
    } catch (error) {
      console.error('Load user error:', error);
      if (retryCount < 2) {
        setTimeout(() => loadUser(retryCount + 1), 1000);
      } else {
        setError('Failed to load user data');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
    if (id) {
      fetch(`/api/v1/social/status?userId=${encodeURIComponent(id)}`, { credentials: 'include' })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setFollowCounts({ followerCount: data.followerCount, followingCount: data.followingCount });
            setPresence({ isOnline: !!data.isOnline, lastSeen: data.lastSeen || null });
          }
        })
        .catch((e) => console.error('Load follow counts error:', e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Refresh data
  const refreshData = async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/v1/user/${id}/history`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setUserData(data.user);
        setHistory(data.history || []);
        setChats(data.chats || []);
      }
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Filtered history
  const filteredHistory = useMemo(() => {
    if (filter === 'all') return history;
    return history.filter((item) => {
      if (filter === 'ongoing') return item.status === 'ONGOING';
      if (filter === 'completed') return item.status === 'COMPLETED';
      return true;
    });
  }, [history, filter]);

  // Formatters
  const formatWatchTime = (seconds) => {
    if (!seconds) return '0m';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}j ${minutes}m`;
    return `${minutes}m`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return '-';
    }
  };

  // Cuma tanggal + bulan (tanpa tahun) buat privasi umur, kecuali lagi lihat profil sendiri
  const formatBirthday = (dateString, includeYear) => {
    if (!dateString) return '-';
    try {
      const [y, m, d] = dateString.split('-').map(Number);
      const date = new Date(Date.UTC(y, m - 1, d));
      return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: includeYear ? 'numeric' : undefined, timeZone: 'UTC' });
    } catch {
      return '-';
    }
  };

  const formatTimeAgo = (dateString) => {
    if (!dateString) return '-';
    try {
      const now = new Date();
      const date = new Date(dateString);
      const diff = Math.floor((now - date) / 1000);
      if (diff < 60) return 'Baru saja';
      if (diff < 3600) return `${Math.floor(diff / 60)}m yang lalu`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}j yang lalu`;
      if (diff < 604800) return `${Math.floor(diff / 86400)}h yang lalu`;
      return formatDate(dateString);
    } catch {
      return '-';
    }
  };

  const getLevelTitle = (level) => {
    if (level >= 1000) return 'Anime Creator';
    if (level >= 500) return 'Anime Legend';
    if (level >= 300) return 'Anime Master';
    if (level >= 200) return 'Anime Expert';
    if (level >= 150) return 'Anime Pro';
    if (level >= 100) return 'Anime Enthusiast';
    if (level >= 50) return 'Anime Lover';
    if (level >= 30) return 'Anime Fan';
    if (level >= 20) return 'Anime Watcher';
    if (level >= 10) return 'Anime Learner';
    return 'Anime Newbie';
  };

  const navigateToAnime = (animeId, title, index) => {
    if (!animeId) return;
    const slug = title
      ? title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      : `anime-${animeId}`;
    navigate(`/anime/${animeId}-${slug}/${index}`);
  };

  // Manga → langsung ke halaman baca chapter terakhir yang dibaca user,
  // fallback ke halaman detail komik kalau slug chapter nggak ada.
  const navigateToMangaChapter = (item) => {
    if (item.currentChapter?.slug) {
      navigate(`/baca/${item.currentChapter.slug}`);
    } else if (item.animeId) {
      navigate(`/komik/${item.animeId}`);
    }
  };

  const navigateToHistoryItem = (item) => {
    if (item.type === 'manga') {
      navigateToMangaChapter(item);
    } else {
      navigateToAnime(item.animeId, item.animeTitle, item.currentEpisode?.index);
    }
  };

  const revealImage = (chatId) => {
    setRevealedImages((prev) => ({ ...prev, [chatId]: true }));
  };

  // ===== RENDER SATU PESAN CHAT =====
  const renderChatMessage = (chat, index) => {
    const chatId = chat.id || index;
    const isNsfw = chat.nsfw === true;
    const isSfw = chat.sfw === true;
    const isRevealed = revealedImages[chatId] || false;
    const hasMedia = chat.hasMedia === true;
    const isCommand = chat.isCommand || (chat.message && chat.message.includes('━━━━━━━━━━━━━━━━━'));

    return (
      <div
        key={chatId}
        className="p-4 bg-[#0d0d10] border border-white/[0.06] rounded-xl hover:border-[#d4a73c]/20 transition-colors"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">
            {isCommand ? 'Command' : hasMedia ? chat.mediaType : 'Pesan'}
          </span>
          <span className="text-white/20 text-[10px]">{formatTimeAgo(chat.timestamp)}</span>
        </div>

        {hasMedia && chat.mediaType === 'image' && (
          <div className="relative mb-2 rounded-lg overflow-hidden bg-black/30">
            <img
              src={chat.mediaUrl}
              alt={chat.message || 'Gambar'}
              className={`w-full max-h-64 object-cover cursor-pointer ${isNsfw && !isRevealed ? 'blur-2xl scale-110' : ''}`}
              referrerPolicy="no-referrer"
              onClick={() => (isNsfw && !isRevealed ? revealImage(chatId) : setSelectedImage(chat.mediaUrl))}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            {isNsfw && !isRevealed && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <button
                  onClick={(e) => { e.stopPropagation(); revealImage(chatId); }}
                  className="px-4 py-2 bg-[#d4a73c] text-[#0b0b10] font-bold rounded-full text-xs"
                >
                  Klik untuk melihat
                </button>
              </div>
            )}
            {isNsfw && isRevealed && (
              <div className="absolute top-2 right-2 bg-red-500/80 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                NSFW
              </div>
            )}
          </div>
        )}

        {hasMedia && chat.mediaType === 'video' && (
          <video src={chat.mediaUrl} controls className="w-full max-h-64 rounded-lg mb-2 bg-black" preload="metadata" />
        )}

        {hasMedia && chat.mediaType === 'audio' && (
          <div className="mb-2">
            <audio src={chat.mediaUrl} controls preload="metadata" className="w-full h-10" />
            {chat.fileName && <p className="text-white/30 text-[10px] mt-1 truncate">{chat.fileName}</p>}
          </div>
        )}

        {isCommand && chat.hasImage && chat.imageUrl && (
          <div className="relative mb-2 rounded-lg overflow-hidden bg-black/30">
            <img
              src={chat.imageUrl}
              alt={chat.title || 'Thumbnail'}
              className={`w-full aspect-video object-cover cursor-pointer ${isNsfw && !isRevealed ? 'blur-2xl' : ''}`}
              referrerPolicy="no-referrer"
              onClick={() => (isNsfw && !isRevealed ? revealImage(chatId) : setSelectedImage(chat.imageUrl))}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            {isSfw && (
              <div className="absolute top-2 right-2 bg-green-500/80 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                SFW
              </div>
            )}
            {isNsfw && !isRevealed && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <button
                  onClick={(e) => { e.stopPropagation(); revealImage(chatId); }}
                  className="px-4 py-2 bg-[#d4a73c] text-[#0b0b10] font-bold rounded-full text-xs"
                >
                  Klik untuk melihat
                </button>
              </div>
            )}
            {isNsfw && isRevealed && (
              <div className="absolute top-2 right-2 bg-red-500/80 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                NSFW
              </div>
            )}
          </div>
        )}

        {!hasMedia && (
          <div className={`text-sm ${isCommand ? 'text-[#d4a73c] font-mono whitespace-pre-line' : 'text-white/80'} break-words`}>
            {chat.message && chat.message.split('\n').map((line, i) => {
              const audioMatch = line.match(/📥 \[Download Audio\]\(([^)]+)\)/);
              if (audioMatch) {
                return (
                  <div key={i} className="mt-2 space-y-2">
                    <a
                      href={audioMatch[1]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block px-3 py-1.5 bg-[#d4a73c] text-[#0b0b10] font-bold rounded-lg text-xs"
                    >
                      Download Audio
                    </a>
                    <audio src={audioMatch[1]} controls preload="metadata" className="w-full h-10 block" />
                  </div>
                );
              }
              const videoMatch = line.match(/📥 \[Download Video\]\(([^)]+)\)/);
              if (videoMatch) {
                return (
                  <div key={i} className="mt-2 space-y-2">
                    <a
                      href={videoMatch[1]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block px-3 py-1.5 bg-[#d4a73c] text-[#0b0b10] font-bold rounded-lg text-xs"
                    >
                      Download Video
                    </a>
                    <video src={videoMatch[1]} controls preload="metadata" className="w-full max-h-56 rounded-lg block" />
                  </div>
                );
              }
              const buttonMatch = line.match(/🎵 \[Putar Audio\]\(([^)]+)\|audio\)\s*🎬 \[Putar Video\]\(([^)]+)\|video\)/);
              if (buttonMatch) {
                const before = line.substring(0, line.indexOf('🎵'));
                return (
                  <div key={i}>
                    {before}
                    <span className="text-white/30 text-xs">(tombol putar tersedia di chat global)</span>
                  </div>
                );
              }
              const linkMatch = line.match(/\[([^\]]+)\]\(([^)]+)\)/);
              if (linkMatch) {
                const before = line.substring(0, line.indexOf('['));
                const after = line.substring(line.indexOf(')') + 1);
                return (
                  <div key={i}>
                    {before}
                    <a
                      href={linkMatch[2]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#d4a73c] hover:underline font-bold"
                    >
                      {linkMatch[1]}
                    </a>
                    {after}
                  </div>
                );
              }
              return <div key={i}>{line}</div>;
            })}
          </div>
        )}

        {hasMedia && chat.message && <p className="text-sm text-white/80 mt-1 break-words">{chat.message}</p>}
      </div>
    );
  };

  // ===== LOADING =====
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0b10]">
        <Navbar />
        <div className="pt-24 max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-center h-[60vh]">
            <div className="text-center">
              <div className="w-12 h-12 border-2 border-[#d4a73c]/20 border-t-[#d4a73c] rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-white/40 font-medium">Memuat profil...</p>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // ===== ERROR =====
  if (error || !userData) {
    return (
      <div className="min-h-screen bg-[#0b0b10]">
        <Navbar />
        <div className="pt-24 max-w-7xl mx-auto px-4 text-center">
          <UserX className="w-14 h-14 text-white/15 mx-auto mb-6" strokeWidth={1.5} />
          <h1 className="font-display text-3xl text-[#f0ead9] tracking-wide">User Not Found</h1>
          <p className="text-white/40 mt-2">{error || 'The user you are looking for does not exist.'}</p>
          <button
            onClick={() => navigate('/home')}
            className="mt-6 bg-[#ff4e2d] text-[#0b0b10] font-bold px-6 py-2 btn-cut hover:scale-105 transition-all"
          >
            Back to Home
          </button>
        </div>
        <Footer />
      </div>
    );
  }

  const isOwnProfile = currentUser?.id === userData.id;

  return (
    <div className="min-h-screen bg-[#0b0b10] font-nunito selection:bg-[#d4a73c] selection:text-black pb-24 text-white">
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #d4a73c; border-radius: 10px; }
      `}</style>
      <Navbar />

      <div className="pt-24 max-w-6xl mx-auto px-4 md:px-6">
        {/* ===== MEMBER CARD ===== */}
        <div className="relative rounded-3xl overflow-hidden mb-8 border border-white/[0.08] bg-[#101016]/90 backdrop-blur-xl shadow-2xl">
          {/* ===== BANNER (read-only) ===== */}
          <div className="relative h-36 md:h-48 w-full overflow-hidden">
            {userData.banner ? (
              <>
                <img
                  src={userData.banner}
                  alt="Banner"
                  className="w-full h-full object-cover"
                  style={{ objectPosition: bannerObjectPosition }}
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-transparent" />
              </>
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#1a1a1f] via-[#131316] to-[#0b0b10] relative overflow-hidden">
                <div
                  className="absolute inset-0 opacity-[0.07]"
                  style={{
                    backgroundImage: 'radial-gradient(#d4a73c 1px, transparent 1px)',
                    backgroundSize: '18px 18px'
                  }}
                />
                <span className="pointer-events-none select-none absolute -right-4 -top-10 text-[220px] font-black text-white/[0.03] leading-none">
                  {userData.level || 0}
                </span>
                <div className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#d4a73c]" />
                  <span className="text-white/50 text-[10px] font-bold uppercase tracking-wider">
                    {userData.title || 'Anime Newbie'}
                  </span>
                </div>
              </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-[#141419] via-[#141419]/40 to-black/20 pointer-events-none" />
          </div>

          <div className="relative z-10 p-6 md:p-9 -mt-14 md:-mt-16 flex flex-col md:flex-row items-center gap-7">
            {/* Avatar */}
            <div className="relative shrink-0">
              {storyData?.note && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 max-w-[140px] bg-white text-[#0b0b10] text-[10px] font-bold px-2.5 py-1.5 rounded-xl rounded-bl-sm shadow-lg truncate">
                  {storyData.note.text}
                </div>
              )}
              <button
                onClick={() => storyData?.stories?.length > 0 && setShowStoryViewer(true)}
                className={`rounded-[inherit] ${storyData?.stories?.length > 0 ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <div
                  className={`w-28 h-28 md:w-36 md:h-36 rounded-[1.25rem] ${
                    storyData?.stories?.length > 0
                      ? storyData.hasUnseen
                        ? 'p-[3px] bg-gradient-to-tr from-[#f6cf80] via-[#ff6b9d] to-[#c471ed]'
                        : 'p-[3px] bg-white/15'
                      : ''
                  }`}
                >
                  <AvatarAura auraId={userData.aura || 'none'}>
                    <AvatarFrame frameId={userData.frame} className="w-full h-full" rounded="rounded-2xl">
                      <div className="w-full h-full rounded-2xl overflow-hidden border-2 border-[#d4a73c]/40 bg-[#0b0b10] shadow-xl">
                        <img
                          src={userData.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name || 'User')}&background=F6CF80&color=0a0a0c&size=256`}
                          alt={userData.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name || 'User')}&background=F6CF80&color=0a0a0c&size=256`;
                          }}
                        />
                      </div>
                    </AvatarFrame>
                  </AvatarAura>
                </div>
              </button>
            </div>

            <div className="flex-1 text-center md:text-left min-w-0">
              <div className="font-mono-ui text-[#d4a73c] text-[11px] font-bold uppercase tracking-[0.2em] mb-1 flex items-center justify-center md:justify-start gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-md bg-[#d4a73c]/15 border border-[#d4a73c]/30 text-[#d4a73c]">
                  {userData.customTitle || userData.title || getLevelTitle(userData.level || 0)}
                </span>
                {(passportData?.passport?.rank || userData?.isekaiRank) && (
                  <span
                    className="text-[10px] px-2.5 py-0.5 rounded-md border font-mono-ui font-black uppercase flex items-center gap-1 shadow-sm"
                    style={{
                      backgroundColor: `${passportData?.passport?.rankColor || '#8b5cf6'}20`,
                      borderColor: `${passportData?.passport?.rankColor || '#8b5cf6'}40`,
                      color: passportData?.passport?.rankColor || '#c084fc'
                    }}
                  >
                    <Award className="w-3 h-3" />
                    {passportData?.passport?.rank || userData?.isekaiRank}
                  </span>
                )}
                {userData.customTitle && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono-ui font-black uppercase">
                    CUSTOM
                  </span>
                )}
              </div>
              <div className="flex items-center justify-center md:justify-start gap-2 flex-wrap">
                <h1 className="font-display text-3xl md:text-5xl text-[#f0ead9] truncate tracking-wide">{userData.name || 'User'}</h1>
                {clanBadge && <ClanBadge badge={clanBadge} size="lg" />}
                {userData.isAdmin && (
                  <span className="bg-[#d4a73c] text-[#0b0b10] text-[10px] font-black px-2 py-0.5 rounded-sm uppercase tracking-wider">
                    Admin
                  </span>
                )}
                {isOwnProfile && (
                  <span className="bg-white/10 text-white/60 text-[10px] font-black px-2 py-0.5 rounded-sm uppercase tracking-wider border border-white/10">
                    You
                  </span>
                )}
                {!isOwnProfile && (
                  <span className={`flex items-center gap-1.5 text-[10px] font-black px-2 py-0.5 rounded-sm uppercase tracking-wider border ${presence.isOnline ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-white/5 text-white/40 border-white/10'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${presence.isOnline ? 'bg-green-400 animate-pulse' : 'bg-white/30'}`} />
                    {presence.isOnline ? 'Online' : 'Offline'}
                  </span>
                )}
              </div>
              <p className="text-white/35 text-sm font-medium mt-0.5">{userData.email}</p>
              {!isOwnProfile && !presence.isOnline && presence.lastSeen && (
                <p className="text-white/25 text-xs font-medium mt-0.5">
                  Terakhir dilihat {formatTimeAgo(new Date(presence.lastSeen).toISOString())}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-6 gap-y-1 mt-4 text-xs">
                <span className="text-white/50">
                  Level <b className="text-white font-black">{userData.level || 0}</b>
                </span>
                <span className="w-1 h-1 rounded-full bg-white/10 hidden md:inline-block" />
                <span className="text-white/50">
                  Nonton <b className="text-white font-black">{formatWatchTime(userData.watchTime || 0)}</b>
                </span>
                <span className="w-1 h-1 rounded-full bg-white/10 hidden md:inline-block" />
                <span className="text-white/50">
                  Bergabung <b className="text-white font-black">{formatDate(userData.createdAt)}</b>
                </span>
                {userData.birthDateConfirmed && userData.birthDate && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-white/10 hidden md:inline-block" />
                    <span className="text-white/50">
                      🎂 <b className="text-white font-black">{formatBirthday(userData.birthDate, isOwnProfile)}</b>
                    </span>
                  </>
                )}
                <span className="w-1 h-1 rounded-full bg-white/10 hidden md:inline-block" />
                <button onClick={() => setFollowModal('followers')} className="text-white/50 hover:text-[#d4a73c] transition-colors">
                  <b className="text-white font-black">{followCounts.followerCount}</b> Pengikut
                </button>
                <span className="w-1 h-1 rounded-full bg-white/10 hidden md:inline-block" />
                <button onClick={() => setFollowModal('following')} className="text-white/50 hover:text-[#d4a73c] transition-colors">
                  <b className="text-white font-black">{followCounts.followingCount}</b> Mengikuti
                </button>
              </div>

              <div className="mt-3 flex justify-center md:justify-start">
                <BadgeShowcase user={userData} history={history} chats={chats} streak={isOwnProfile ? streak : null} triviaTotalCorrect={isOwnProfile ? triviaTotalCorrect : 0} />
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {!isOwnProfile && (
                <FollowButton targetUserId={userData.id} onCountsChanged={(c) => setFollowCounts(c)} />
              )}
              {!isOwnProfile && currentUser && (
                <button
                  onClick={() => navigate(`/messages/${userData.id}`)}
                  className="px-4 py-2.5 bg-[#d4a73c]/10 border border-[#d4a73c]/30 text-[#d4a73c] font-bold text-xs rounded-xl hover:bg-[#d4a73c] hover:text-[#0b0b10] transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                >
                  <MessageCircle className="w-4 h-4" strokeWidth={2.5} />
                  <span className="hidden sm:inline">Pesan</span>
                </button>
              )}
              {!isOwnProfile && currentUser && (
                <button
                  onClick={() => setShowGiveExp(true)}
                  className="px-4 py-2.5 bg-[#3ecf8e]/10 border border-[#3ecf8e]/30 text-[#3ecf8e] font-bold text-xs rounded-xl hover:bg-[#3ecf8e] hover:text-[#0b0b10] transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className="hidden sm:inline">Give EXP</span>
                </button>
              )}
              <button
                onClick={refreshData}
                disabled={refreshing}
                title="Refresh data"
                className="p-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 text-white/40 ${refreshing ? 'animate-spin' : ''}`} strokeWidth={2} />
              </button>
              <button
                onClick={() => navigate(isOwnProfile ? '/profile' : -1)}
                className="px-5 py-2.5 rounded-xl bg-white/[0.05] hover:bg-[#d4a73c] hover:text-[#0b0b10] border border-white/10 hover:border-[#d4a73c] text-white font-bold text-xs transition-all shadow-sm active:scale-95"
              >
                Kembali
              </button>
            </div>
          </div>

          {/* Stat strip - GANTI STATUS MENJADI GENRE FAVORIT */}
          <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 divide-x divide-white/[0.06] border-t border-white/[0.06]">
            {[
              ['Total Nonton', formatWatchTime(userData.watchTime || 0)],
              ['Level', userData.level || 0],
              ['Title', userData.title || getLevelTitle(userData.level || 0)],
              ['Genre Favorit', favoriteGenre], // <-- DIGANTI DARI 'Status' menjadi 'Genre Favorit'
            ].map(([label, value]) => (
              <div key={label} className="px-4 py-4 text-center">
                <p className="text-white/25 text-[10px] font-bold uppercase tracking-wider">{label}</p>
                <p className="font-mono-ui text-lg font-bold text-[#f0ead9] mt-1 truncate">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Profile Anime BGM Widget */}
        <div className="mb-8">
          <ProfileThemeSong
            themeSong={userData.themeSong}
            userName={userData.name}
            isOwner={isOwnProfile}
            onEditClick={isOwnProfile ? () => navigate('/profile') : undefined}
          />
        </div>

        {/* Showcase Kartu 3D User */}
        <div className="mb-8">
          <ProfileDeck userId={id} isOwner={isOwnProfile} />
        </div>

        {/* Pameran Paspor Isekai & Dimensi User */}
        {passportData && passportData.passport && (
          <div className="mb-8 bg-gradient-to-r from-[#181824] via-[#14141d] to-[#181824] border border-[#d4a73c]/30 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-[#d4a73c]/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-[#d4a73c]/20 border border-[#d4a73c]/40 flex items-center justify-center text-[#d4a73c] shadow-lg shrink-0">
                  <Compass className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-[#d4a73c] font-mono-ui">
                      PASPOR PENJELAJAH RESMI
                    </span>
                    <span className="text-[10px] text-white/40 font-mono-ui">
                      {passportData.passport.passportNo}
                    </span>
                  </div>
                  <h3 className="text-white font-black text-lg md:text-xl font-mono-ui">
                    Pameran Paspor Isekai & Stempel Dimensi
                  </h3>
                  <p className="text-white/40 text-xs">
                    {passportData.passport.totalConquered} dari {passportData.passport.totalRealms} Wilayah Dunia Anime Berhasil Ditaklukkan
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div
                  className="px-3.5 py-1.5 rounded-xl border text-xs font-black uppercase tracking-wider font-mono-ui flex items-center gap-1.5 shadow-md"
                  style={{
                    backgroundColor: `${passportData.passport.rankColor}20`,
                    borderColor: `${passportData.passport.rankColor}50`,
                    color: passportData.passport.rankColor
                  }}
                >
                  <Award className="w-4 h-4" />
                  {passportData.passport.rank}
                </div>
                {isOwnProfile && (
                  <button
                    onClick={() => navigate('/isekai')}
                    className="px-3 py-1.5 rounded-xl bg-[#d4a73c] text-[#0b0b10] font-black text-xs uppercase hover:brightness-110"
                  >
                    Buka Peta
                  </button>
                )}
              </div>
            </div>

            {/* Stamped Realms Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 relative z-10">
              {(passportData.realms || []).map((realm) => {
                const hasStamp = (passportData.passport.stamps || []).includes(realm.stampId);
                return (
                  <div
                    key={realm.id}
                    className={`p-3 rounded-2xl border text-center flex flex-col items-center justify-center aspect-square transition-all ${
                      hasStamp
                        ? 'bg-[#d4a73c]/15 border-[#d4a73c]/60 shadow-[0_0_20px_rgba(212,167,60,0.25)]'
                        : 'bg-black/30 border-white/5 opacity-40'
                    }`}
                  >
                    {hasStamp ? (
                      <>
                        <div className="w-8 h-8 rounded-full border border-[#d4a73c] flex items-center justify-center text-[#d4a73c] mb-1 shadow-md shadow-[#d4a73c]/30">
                          <Award className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-black uppercase text-[#d4a73c] font-mono-ui line-clamp-1">
                          {realm.stampTitle.split(' ')[0]}
                        </span>
                        <span className="text-[8px] text-white/50 block font-mono-ui">TERCAP</span>
                      </>
                    ) : (
                      <>
                        <span className="text-white/20 text-xs font-bold font-mono-ui">-</span>
                        <span className="text-[9px] text-white/30 font-bold line-clamp-1">{realm.name.split(' ')[0]}</span>
                        <span className="text-[8px] text-white/20 block">Terkunci</span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2.5 mb-8 border-b border-white/[0.08] pb-3 overflow-x-auto custom-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
          {[
            ['achievements', 'Achievement'],
            ['history', `Riwayat (${history.length})`],
            ['chats', `Riwayat Chat (${chats.length})`],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all select-none shrink-0 whitespace-nowrap ${
                activeTab === key
                  ? 'bg-gradient-to-r from-[#d4a73c] to-[#ff4e2d] text-[#0b0b10] shadow-md shadow-[#d4a73c]/25 scale-105'
                  : 'bg-[#12121a] text-white/50 hover:text-white border border-white/10 hover:border-white/20'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="animate-[fadeIn_0.25s_ease-out]">
          {activeTab === 'achievements' && (
            <div className="space-y-6">
              {isOwnProfile && (
                <DailyStreak
                  onClaimed={() => {
                    refreshData();
                    fetch('/api/v1/user/streak', { credentials: 'include' })
                      .then((r) => r.json())
                      .then((d) => setStreak(d.streak || null))
                      .catch(() => {});
                  }}
                />
              )}
              {isOwnProfile && (
                <TriviaGame
                  onScored={() => {
                    refreshData();
                    fetch('/api/v1/trivia/today', { credentials: 'include' })
                      .then((r) => r.json())
                      .then((d) => setTriviaTotalCorrect(d.totalCorrect || 0))
                      .catch(() => {});
                  }}
                />
              )}
              <Achievements
                user={userData}
                history={history}
                chats={chats}
                streak={isOwnProfile ? streak : null}
                triviaTotalCorrect={isOwnProfile ? triviaTotalCorrect : 0}
              />
            </div>
          )}

          {activeTab === 'history' && (
            <div className="bg-[#181820] border border-[#2a2a35] card-cut p-6">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h3 className="text-white font-bold text-sm">Riwayat Tonton & Baca</h3>
                <div className="flex items-center gap-2">
                  {['all', 'ongoing', 'completed'].map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${
                        filter === f ? 'bg-[#d4a73c] text-[#0b0b10]' : 'bg-white/5 text-white/40 hover:bg-white/10'
                      }`}
                    >
                      {f === 'all' ? 'Semua' : f === 'ongoing' ? 'Ongoing' : 'Completed'}
                    </button>
                  ))}
                  <span className="text-white/20 text-xs ml-1">({filteredHistory.length})</span>
                </div>
              </div>

              {filteredHistory.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-white/30 font-medium">
                    {history.length === 0 ? 'Belum ada riwayat' : 'Tidak ada item dengan filter ini'}
                  </p>
                  {history.length === 0 && <p className="text-white/20 text-sm mt-1">Mulai nonton anime atau baca komik untuk mengisi riwayat</p>}
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar">
                  {filteredHistory.map((item, index) => {
                    const isManga = item.type === 'manga';
                    return (
                      <div
                        key={`${item.type}-${item.animeId || index}-${index}`}
                        onClick={() => navigateToHistoryItem(item)}
                        className="flex items-center gap-4 p-3 bg-[#0b0b10] border border-white/5 rounded-lg hover:border-[#d4a73c]/30 hover:bg-white/5 transition-all cursor-pointer group"
                      >
                        <img
                          src={`https://cfelainawanggy.pages.dev/?action=proxy&url=${encodeURIComponent(item.image_poster)}`}
                          alt={item.animeTitle}
                          className="w-16 aspect-[3/4.2] object-cover card-cut-sm border border-[#2a2a35] shadow-md group-hover:scale-105 transition-transform"
                          referrerPolicy="no-referrer"
                          onError={(e) => { e.target.src = 'https://via.placeholder.com/100x150/16161a/ffffff?text=No+Image'; }}
                          loading="lazy"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-white font-bold text-sm truncate group-hover:text-[#d4a73c] transition-colors">
                            {item.animeTitle || (isManga ? 'Unknown Komik' : 'Unknown Anime')}
                          </h4>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="bg-[#d4a73c]/10 text-[#d4a73c] text-[9px] px-2 py-0.5 rounded-sm font-bold border border-[#d4a73c]/20">
                              {isManga ? `Ch. ${item.currentChapter?.chapter || '-'}` : `Eps ${item.currentEpisode?.index || '-'}`}
                            </span>
                            {!isManga && item.currentEpisode?.title && (
                              <span className="text-white/40 text-[9px] font-medium truncate max-w-[150px]">
                                {item.currentEpisode.title}
                              </span>
                            )}
                            {item.status && (
                              <span
                                className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
                                  item.status === 'ONGOING' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
                                }`}
                              >
                                {item.status}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <p className="text-white/20 text-[8px] font-medium">{formatTimeAgo(item.timestamp)}</p>
                            {item.year && <span className="text-white/15 text-[8px] font-medium">{item.year}</span>}
                            {/* Tambahkan genre di card history */}
                            {item.genre && (
                              <span className="text-[#d4a73c]/40 text-[8px] font-medium truncate max-w-[100px]">
                                {item.genre}
                              </span>
                            )}
                          </div>
                        </div>
                        <svg className="w-5 h-5 text-[#d4a73c]/30 group-hover:text-[#d4a73c] transition-colors shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    );
                  })}
                </div>
              )}

              {history.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center text-xs text-white/20">
                  <span>Total: {history.length} item</span>
                  <span>{filter !== 'all' && `Filtered: ${filteredHistory.length}`}</span>
                </div>
              )}
            </div>
          )}

          {activeTab === 'chats' && (
            <div className="bg-[#181820] border border-[#2a2a35] card-cut p-6">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h3 className="text-white font-bold text-sm">Riwayat Chat Global</h3>
                <span className="text-white/20 text-xs">Total {chats.length} pesan</span>
              </div>

              {chats.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-white/30 font-medium">Belum ada chat di chat global</p>
                  <p className="text-white/20 text-sm mt-1">User ini belum mengirim pesan di chat global</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar">
                  {chats.map((chat, index) => renderChatMessage(chat, index))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen image modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <img
            src={selectedImage}
            alt="Fullscreen"
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            referrerPolicy="no-referrer"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 text-white/70 hover:text-white bg-black/50 rounded-full p-2"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      )}

      {followModal && (
        <FollowListModal userId={userData.id} mode={followModal} onClose={() => setFollowModal(null)} />
      )}

      {showGiveExp && (
        <GiveExpModal
          targetUserId={userData.id}
          targetName={userData.name}
          onClose={() => setShowGiveExp(false)}
          onSuccess={(data) => alert(`Berhasil kirim ${data.amount} EXP ke ${userData.name}!`)}
        />
      )}

      {showStoryViewer && storyData?.stories?.length > 0 && (
        <StoryViewer
          queue={storyData.stories.map((story) => ({
            entry: {
              user: { id: userData.id, name: userData.name, picture: userData.picture, frame: userData.frame },
              stories: storyData.stories
            },
            story
          }))}
          startIndex={0}
          currentUserId={currentUser?.id}
          onClose={() => setShowStoryViewer(false)}
          onStoryDeleted={(storyId) => {
            setStoryData((prev) => prev ? { ...prev, stories: prev.stories.filter((s) => s.id !== storyId) } : prev);
          }}
        />
      )}

      <Footer />
    </div>
  );
};

export default UserProfile;
