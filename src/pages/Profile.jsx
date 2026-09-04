import React, { useState, useEffect, useRef } from 'react';
import ClanBadge from '../components/ClanBadge';
import { useNavigate } from 'react-router-dom';
import { Camera, Move, Check, X, Compass, ChevronRight, Award } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import UserLevel from '../components/UserLevel';
import Achievements, { BadgeShowcase } from '../components/Achievements';
import DailyStreak from '../components/DailyStreak';
import BirthdateSettings from '../components/BirthdateSettings';
import TriviaGame from '../components/TriviaGame';
import QuestLog from '../components/QuestLog';
import ClassSelect from '../components/ClassSelect';
import Inventory from '../components/Inventory';
import BossEvent from '../components/BossEvent';
import SkillTree from '../components/SkillTree';
import StoryArc from '../components/StoryArc';
import FollowListModal from '../components/FollowListModal';
import ProfileViewersModal from '../components/ProfileViewersModal';
import GuildSelect from '../components/GuildSelect';
import { useAuth } from '../context/AuthContext';
import HallOfFame from '../components/HallOfFame';
import AvatarFrame from '../components/AvatarFrame';
import AvatarAura from '../components/AvatarAura';
import ProfileThemeSong from '../components/ProfileThemeSong';
import ProfileCustomizer from '../components/ProfileCustomizer';
import ProfileDeck from '../components/ProfileDeck';
import CardAlbum from '../components/CardAlbum';
import { setSeoMeta, SITE_URL } from '../utils/seo';

const AVATAR_UPLOAD_URL = 'https://c.termai.cc/api/upload?key=AIzaBj7z2z3xBjsk';

const Profile = () => {
  const navigate = useNavigate();
  const { user: authUser, refreshUser, loading: authLoading } = useAuth();
  const [user, setUser] = useState(authUser);
  const [clanBadge, setClanBadge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('profile'); // 'profile', 'history', 'chats'
  const [followCounts, setFollowCounts] = useState({ followerCount: 0, followingCount: 0 });
  const [followModal, setFollowModal] = useState(null); // 'followers' | 'following' | null
  const [showViewers, setShowViewers] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/v1/social/status?userId=${encodeURIComponent(user.id)}`, { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setFollowCounts({ followerCount: data.followerCount, followingCount: data.followingCount });
      })
      .catch((e) => console.error('Load follow counts error:', e));
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    fetch(`/api/v1/clan/badge?userId=${encodeURIComponent(user.id)}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setClanBadge(data.success ? data.badge : null); })
      .catch(() => { if (!cancelled) setClanBadge(null); });
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    setSeoMeta(
      'Profil Saya | Ndichan',
      'Kelola profil, riwayat tontonan, dan chat kamu di Ndichan.',
      null,
      `${SITE_URL}/profile`,
      { noIndex: true }
    );
  }, []);

  const [history, setHistory] = useState([]);
  const [chats, setChats] = useState([]);
  const [chatsLoading, setChatsLoading] = useState(true);
  const [streak, setStreak] = useState(null);
  const [triviaTotalCorrect, setTriviaTotalCorrect] = useState(0);

  // Load status streak (dipakai buat badge Achievement, DailyStreak fetch statusnya sendiri)
  const loadStreak = async () => {
    try {
      const res = await fetch('/api/v1/user/streak', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setStreak(data.streak || null);
      }
    } catch (error) {
      console.error('Load streak error:', error);
    }
  };

  // Load total jawaban trivia yang benar sepanjang waktu (dipakai buat badge Achievement)
  const loadTrivia = async () => {
    try {
      const res = await fetch('/api/v1/trivia/today', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setTriviaTotalCorrect(data.totalCorrect || 0);
      }
    } catch (error) {
      console.error('Load trivia error:', error);
    }
  };

  const [stats, setStats] = useState({
    totalWatched: 0,
    totalEpisodes: 0,
    totalHours: 0,
    favoriteGenre: '-',
    favoriteManga: '-',
    joinDate: '-'
  });

  // Avatar upload state
  const avatarInputRef = useRef(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState('');

  // Banner upload state
  const bannerInputRef = useRef(null);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [bannerError, setBannerError] = useState('');

  // Banner position (drag-to-reposition) state
  const [isAdjustingBanner, setIsAdjustingBanner] = useState(false);
  const [isSavingBannerPosition, setIsSavingBannerPosition] = useState(false);
  const bannerContainerRef = useRef(null);
  const dragStateRef = useRef({ dragging: false, startX: 0, startY: 0, startPosX: 50, startPosY: 50 });

  const parseBannerPosition = (str) => {
    if (!str) return { x: 50, y: 50 };
    const parts = str.replace(/%/g, '').trim().split(/\s+/).map(Number);
    return {
      x: Number.isFinite(parts[0]) ? parts[0] : 50,
      y: Number.isFinite(parts[1]) ? parts[1] : 50
    };
  };

  const [bannerPosition, setBannerPosition] = useState({ x: 50, y: 50 });

  // Edit name state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameError, setNameError] = useState('');
  const nameInputRef = useRef(null);

  // Chat media preview state
  const [revealedImages, setRevealedImages] = useState({});
  const [selectedImage, setSelectedImage] = useState(null);

  // Check auth
  useEffect(() => {
    if (authLoading) return;
    if (!authUser) {
      navigate('/home');
      return;
    }
    setUser(authUser);
    setBannerPosition(parseBannerPosition(authUser.bannerPosition));
    loadHistory();
    loadChats(authUser.id);
    loadStreak();
    loadTrivia();
    setLoading(false);
  }, [authUser, authLoading, navigate]);

  // Refresh data user saja (tanpa redirect), dipakai setelah klaim streak
  // supaya watchTime/level yang ikut naik langsung ke-update di UI.
  const refreshUserData = async () => {
    try {
      const updated = await refreshUser();
      if (updated) setUser(updated);
    } catch (error) {
      console.error('Refresh user error:', error);
    }
  };

  // Sinkronkan posisi banner dari server setiap kali user berubah,
  // kecuali sedang dalam mode drag manual (biar nggak "lompat" saat digeser).
  useEffect(() => {
    if (!isAdjustingBanner) {
      setBannerPosition(parseBannerPosition(user?.bannerPosition));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.bannerPosition]);

  // Load history — endpoint mengembalikan { data: [...] }, bukan { history: [...] }
  const loadHistory = async () => {
    try {
      const res = await fetch('/api/v1/history', {
        credentials: 'include'
      });
      if (res.ok) {
        const payload = await res.json();
        setHistory(payload.data || []);
      }
    } catch (error) {
      console.error('Load history error:', error);
    }
  };

  // Load chat history (menggantikan tab Peringkat)
  const loadChats = async (userId) => {
    if (!userId) {
      setChatsLoading(false);
      return;
    }
    setChatsLoading(true);
    try {
      const res = await fetch(`/api/v1/user/${userId}/history`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setChats(data.chats || []);
      }
    } catch (error) {
      console.error('Load chats error:', error);
    } finally {
      setChatsLoading(false);
    }
  };

  // Hitung genre favorit dari seluruh history.
  // Genre disimpan sebagai string gabungan "Action,Adventure,Comedy,...".
  // Ambil genre dengan kemunculan terbanyak; kalau semua genre punya
  // jumlah kemunculan yang sama (termasuk sama-sama cuma 1x), pilih acak.
  useEffect(() => {
    const watchTime = user?.watchTime || 0;
    const base = {
      totalWatched: watchTime,
      totalHours: Math.floor(watchTime / 3600),
      totalEpisodes: Math.floor(watchTime / 1200),
      joinDate: user?.createdAt
        ? new Date(user.createdAt).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          })
        : '-'
    };

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
    let favoriteGenre = '-';
    if (entries.length > 0) {
      const maxCount = Math.max(...entries.map(([, c]) => c));
      const topGenres = entries.filter(([, c]) => c === maxCount).map(([g]) => g);
      favoriteGenre = topGenres.length === 1
        ? topGenres[0]
        : topGenres[Math.floor(Math.random() * topGenres.length)];
    }

    // Komik favorit: judul manga dengan chapter terjauh yang sudah dibaca
    // (dianggap paling "diinvestasikan" waktu dibanding komik lain di history).
    let favoriteManga = '-';
    const mangaHistory = history.filter((item) => item.type === 'manga' && item.currentChapter);
    if (mangaHistory.length > 0) {
      const mostRead = mangaHistory.reduce((best, item) => {
        const chNum = parseFloat(item.currentChapter?.chapter) || 0;
        const bestNum = parseFloat(best?.currentChapter?.chapter) || 0;
        return chNum > bestNum ? item : best;
      }, mangaHistory[0]);
      favoriteManga = mostRead.animeTitle || '-';
    }

    setStats({ ...base, favoriteGenre, favoriteManga });
  }, [user, history]);

  // Format watch time
  const formatWatchTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}j ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
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

  const revealImage = (chatId) => {
    setRevealedImages(prev => ({ ...prev, [chatId]: true }));
  };

  // ===== HELPER: UPLOAD KE PENYIMPANAN GAMBAR (dipakai avatar & banner) =====
  const uploadImageFile = (file) => {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', AVATAR_UPLOAD_URL, true);
      xhr.onload = () => {
        if (xhr.status === 200) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            reject(new Error('Respons upload tidak valid'));
          }
        } else {
          reject(new Error(`Upload gagal: ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(formData);
    });
  };

  const validateImageFile = (file) => {
    if (!file.type.startsWith('image/')) {
      return 'Hanya file gambar yang diizinkan';
    }
    if (file.size > 20 * 1024 * 1024) {
      return 'Ukuran gambar maksimal 20MB';
    }
    return null;
  };

  // ===== AVATAR UPLOAD =====
  const handleAvatarPick = () => {
    if (isUploadingAvatar) return;
    avatarInputRef.current?.click();
  };

  const handleAvatarSelect = (e) => {
    const file = e.target.files[0];
    e.target.value = ''; // supaya bisa pilih file yang sama lagi nanti
    if (!file) return;

    const err = validateImageFile(file);
    if (err) {
      setAvatarError(err);
      return;
    }

    uploadAvatar(file);
  };

  const uploadAvatar = async (file) => {
    setIsUploadingAvatar(true);
    setAvatarError('');

    try {
      const uploadResult = await uploadImageFile(file);

      if (!uploadResult?.status || !uploadResult?.path) {
        throw new Error('Upload ke server gagal');
      }

      const res = await fetch('/api/v1/user/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ picture: uploadResult.path })
      });
      const data = await res.json();

      if (res.ok && data.user) {
        setUser(data.user);
      } else {
        throw new Error(data.error || 'Gagal menyimpan foto profil');
      }
    } catch (error) {
      console.error('Avatar upload error:', error);
      setAvatarError(error.message || 'Gagal upload foto profil');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // ===== BANNER UPLOAD =====
  const handleBannerPick = () => {
    if (isUploadingBanner) return;
    bannerInputRef.current?.click();
  };

  const handleBannerSelect = (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;

    const err = validateImageFile(file);
    if (err) {
      setBannerError(err);
      return;
    }

    uploadBanner(file);
  };

  const uploadBanner = async (file) => {
    setIsUploadingBanner(true);
    setBannerError('');

    try {
      const uploadResult = await uploadImageFile(file);

      if (!uploadResult?.status || !uploadResult?.path) {
        throw new Error('Upload ke server gagal');
      }

      // Banner baru → reset posisi ke tengah biar nggak kebawa posisi lama
      const res = await fetch('/api/v1/user/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ banner: uploadResult.path, bannerPosition: '50.0% 50.0%' })
      });
      const data = await res.json();

      if (res.ok && data.user) {
        setUser(data.user);
        setBannerPosition({ x: 50, y: 50 });
      } else {
        throw new Error(data.error || 'Gagal menyimpan banner');
      }
    } catch (error) {
      console.error('Banner upload error:', error);
      setBannerError(error.message || 'Gagal upload banner');
    } finally {
      setIsUploadingBanner(false);
    }
  };

  // ===== ATUR POSISI BANNER (drag) =====
  const clamp = (val, min, max) => Math.min(max, Math.max(min, val));
  const getPoint = (e) => (e.touches ? e.touches[0] : e);

  const startAdjustingBanner = () => {
    setBannerError('');
    setIsAdjustingBanner(true);
  };

  const handleBannerDragStart = (e) => {
    if (!isAdjustingBanner) return;
    const point = getPoint(e);
    dragStateRef.current = {
      dragging: true,
      startX: point.clientX,
      startY: point.clientY,
      startPosX: bannerPosition.x,
      startPosY: bannerPosition.y
    };
  };

  const handleBannerDragMove = (e) => {
    if (!dragStateRef.current.dragging) return;
    if (e.cancelable) e.preventDefault();
    const point = getPoint(e);
    const rect = bannerContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const deltaX = point.clientX - dragStateRef.current.startX;
    const deltaY = point.clientY - dragStateRef.current.startY;
    const newX = clamp(dragStateRef.current.startPosX - (deltaX / rect.width) * 100, 0, 100);
    const newY = clamp(dragStateRef.current.startPosY - (deltaY / rect.height) * 100, 0, 100);
    setBannerPosition({ x: newX, y: newY });
  };

  const handleBannerDragEnd = () => {
    dragStateRef.current.dragging = false;
  };

  const saveBannerPosition = async () => {
    setIsSavingBannerPosition(true);
    setBannerError('');
    try {
      const res = await fetch('/api/v1/user/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ bannerPosition: `${bannerPosition.x.toFixed(1)}% ${bannerPosition.y.toFixed(1)}%` })
      });
      const data = await res.json();

      if (res.ok && data.user) {
        setUser(data.user);
        setIsAdjustingBanner(false);
      } else {
        throw new Error(data.error || 'Gagal menyimpan posisi banner');
      }
    } catch (error) {
      console.error('Save banner position error:', error);
      setBannerError(error.message || 'Gagal menyimpan posisi banner');
    } finally {
      setIsSavingBannerPosition(false);
    }
  };

  const cancelBannerPosition = () => {
    setBannerPosition(parseBannerPosition(user?.bannerPosition));
    setIsAdjustingBanner(false);
  };

  // ===== EDIT NAMA =====
  const startEditName = () => {
    setEditedName(user?.name || '');
    setNameError('');
    setIsEditingName(true);
    // fokus ke input setelah render
    setTimeout(() => nameInputRef.current?.focus(), 0);
  };

  const cancelEditName = () => {
    setIsEditingName(false);
    setNameError('');
  };

  const saveName = async () => {
    const trimmed = editedName.trim();

    if (!trimmed) {
      setNameError('Nama tidak boleh kosong');
      return;
    }
    if (trimmed.length > 30) {
      setNameError('Nama maksimal 30 karakter');
      return;
    }
    if (trimmed === user?.name) {
      setIsEditingName(false);
      return;
    }

    setIsSavingName(true);
    setNameError('');

    try {
      const res = await fetch('/api/v1/user/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: trimmed })
      });
      const data = await res.json();

      if (res.ok && data.user) {
        setUser(data.user);
        setIsEditingName(false);
      } else {
        throw new Error(data.error || 'Gagal menyimpan nama');
      }
    } catch (error) {
      console.error('Save name error:', error);
      setNameError(error.message || 'Gagal menyimpan nama');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleNameKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveName();
    } else if (e.key === 'Escape') {
      cancelEditName();
    }
  };

  // ===== RENDER SATU PESAN CHAT (gambar / video / audio / command / teks) =====
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
          </div>
        )}

        {hasMedia && chat.mediaType === 'video' && (
          <video src={chat.mediaUrl} controls className="w-full max-h-64 rounded-lg mb-2 bg-black" preload="metadata" />
        )}

        {hasMedia && chat.mediaType === 'audio' && (
          <audio src={chat.mediaUrl} controls preload="metadata" className="w-full h-10 mb-2" />
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
            {isSfw && <div className="absolute top-2 right-2 bg-green-500/80 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">SFW</div>}
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
          </div>
        )}

        {!hasMedia && (
          <div className={`text-sm ${isCommand ? 'text-[#d4a73c] font-mono whitespace-pre-line' : 'text-white/80'} break-words`}>
            {chat.message && chat.message.split('\n').map((line, i) => {
              const audioMatch = line.match(/📥 \[Download Audio\]\(([^)]+)\)/);
              if (audioMatch) {
                return (
                  <div key={i} className="mt-2 space-y-2">
                    <a href={audioMatch[1]} target="_blank" rel="noopener noreferrer" className="inline-block px-3 py-1.5 bg-[#d4a73c] text-[#0b0b10] font-bold rounded-lg text-xs">
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
                    <a href={videoMatch[1]} target="_blank" rel="noopener noreferrer" className="inline-block px-3 py-1.5 bg-[#d4a73c] text-[#0b0b10] font-bold rounded-lg text-xs">
                      Download Video
                    </a>
                    <video src={videoMatch[1]} controls preload="metadata" className="w-full max-h-56 rounded-lg block" />
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
                    <a href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="text-[#d4a73c] hover:underline font-bold">
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

        {hasMedia && chat.message && (
          <p className="text-sm text-white/80 mt-1 break-words">{chat.message}</p>
        )}
      </div>
    );
  };

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
      </div>
    );
  }

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
          {/* ===== BANNER ===== */}
          <div
            ref={bannerContainerRef}
            className={`relative h-36 md:h-48 w-full group/banner overflow-hidden select-none ${
              isAdjustingBanner ? 'cursor-grab active:cursor-grabbing' : ''
            }`}
            style={{ touchAction: isAdjustingBanner ? 'none' : 'auto' }}
            onMouseDown={handleBannerDragStart}
            onMouseMove={handleBannerDragMove}
            onMouseUp={handleBannerDragEnd}
            onMouseLeave={handleBannerDragEnd}
            onTouchStart={handleBannerDragStart}
            onTouchMove={handleBannerDragMove}
            onTouchEnd={handleBannerDragEnd}
          >
            {user?.banner ? (
              <>
                <img
                  src={user.banner}
                  alt="Banner"
                  draggable={false}
                  className="w-full h-full object-cover pointer-events-none"
                  style={{ objectPosition: `${bannerPosition.x}% ${bannerPosition.y}%` }}
                  referrerPolicy="no-referrer"
                />
                {/* lapisan tipis di atas biar foto nggak polos ditempel */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-transparent pointer-events-none" />
              </>
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#1a1a1f] via-[#131316] to-[#0b0b10] relative overflow-hidden">
                {/* pola titik halus biar nggak kosong */}
                <div
                  className="absolute inset-0 opacity-[0.07]"
                  style={{
                    backgroundImage: 'radial-gradient(#d4a73c 1px, transparent 1px)',
                    backgroundSize: '18px 18px'
                  }}
                />
                <span className="pointer-events-none select-none absolute -right-4 -top-10 text-[220px] font-black text-white/[0.03] leading-none">
                  {user?.level || 0}
                </span>
                {/* badge kecil biar ada "isi" di banner kosong */}
                <div className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#d4a73c]" />
                  <span className="text-white/50 text-[10px] font-bold uppercase tracking-wider">
                    {user?.title || 'Anime Newbie'}
                  </span>
                </div>
              </div>
            )}

            {/* gradient bawah biar transisi ke card tetap mulus (dipertahankan) */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#141419] via-[#141419]/40 to-black/20 pointer-events-none" />

            {isUploadingBanner && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
              </div>
            )}

            {/* Grid guide muncul cuma saat mode atur posisi aktif */}
            {isAdjustingBanner && (
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="border border-white/20" />
                ))}
              </div>
            )}

            {/* Tombol aksi banner */}
            {isAdjustingBanner ? (
              <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
                <button
                  onClick={cancelBannerPosition}
                  disabled={isSavingBannerPosition}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 text-white text-[11px] font-bold hover:bg-white/20 transition-all disabled:opacity-50"
                >
                  <X className="w-3.5 h-3.5" />
                  Batal
                </button>
                <button
                  onClick={saveBannerPosition}
                  disabled={isSavingBannerPosition}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#d4a73c] text-[#0b0b10] text-[11px] font-bold hover:brightness-95 transition-all disabled:opacity-50"
                >
                  {isSavingBannerPosition ? (
                    <div className="w-3.5 h-3.5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  Simpan
                </button>
              </div>
            ) : (
              <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
                {user?.banner && (
                  <button
                    onClick={startAdjustingBanner}
                    title="Atur posisi banner"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 text-white text-[11px] font-bold hover:bg-[#d4a73c] hover:text-[#0b0b10] hover:border-[#d4a73c] transition-all"
                  >
                    <Move className="w-3.5 h-3.5" />
                    Atur Posisi
                  </button>
                )}
                <button
                  onClick={handleBannerPick}
                  disabled={isUploadingBanner}
                  title="Ganti banner"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 text-white text-[11px] font-bold hover:bg-[#d4a73c] hover:text-[#0b0b10] hover:border-[#d4a73c] transition-all disabled:opacity-50"
                >
                  <Camera className="w-3.5 h-3.5" />
                  Ganti Banner
                </button>
              </div>
            )}

            <input ref={bannerInputRef} type="file" accept="image/*" onChange={handleBannerSelect} className="hidden" />
          </div>

          {isAdjustingBanner && (
            <p className="text-white/30 text-[11px] font-medium text-center pt-2">
              Geser gambar untuk mengatur bagian yang ditampilkan, lalu klik Simpan
            </p>
          )}
          {bannerError && (
            <p className="text-red-400 text-xs font-medium text-center pt-2">{bannerError}</p>
          )}

          <div className="relative z-10 p-6 md:p-9 -mt-14 md:-mt-16 flex flex-col md:flex-row items-center gap-7">
            {/* Avatar + upload */}
            <div className="relative shrink-0 group">
              <AvatarAura auraId={user?.aura || 'none'}>
                <AvatarFrame frameId={user?.frame} className="w-28 h-28 md:w-36 md:h-36" rounded="rounded-2xl">
                  <div className="w-full h-full rounded-2xl overflow-hidden border-2 border-[#d4a73c]/40 bg-[#0b0b10] shadow-xl">
                    <img
                      src={user?.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=D4A73C&color=0B0B10&size=256`}
                      alt={user?.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    {isUploadingAvatar && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                      </div>
                    )}
                  </div>
                </AvatarFrame>
              </AvatarAura>
              <button
                onClick={handleAvatarPick}
                disabled={isUploadingAvatar}
                title="Ganti foto profil"
                className="absolute -bottom-2 -right-2 w-9 h-9 rounded-full bg-[#d4a73c] text-[#0b0b10] flex items-center justify-center border-4 border-[#141419] hover:scale-110 transition-transform disabled:opacity-50 z-20"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarSelect} className="hidden" />
            </div>

            {/* Identity */}
            <div className="flex-1 text-center md:text-left min-w-0">
              <div className="font-mono-ui text-[#d4a73c] text-[11px] font-bold uppercase tracking-[0.2em] mb-1 flex items-center justify-center md:justify-start gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-md bg-[#d4a73c]/15 border border-[#d4a73c]/30 text-[#d4a73c]">
                  {user?.customTitle || user?.title || 'Anime Newbie'}
                </span>
                {user?.isekaiRank && (
                  <span className="text-[10px] px-2.5 py-0.5 rounded-md bg-purple-500/20 border border-purple-500/40 text-purple-300 font-mono-ui font-black uppercase flex items-center gap-1 shadow-sm">
                    <Award className="w-3 h-3 text-purple-400" />
                    {user.isekaiRank}
                  </span>
                )}
                {user?.customTitle && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono-ui font-black uppercase">
                    CUSTOM
                  </span>
                )}
              </div>

              {/* Nama + edit nama */}
              {isEditingName ? (
                <div className="flex items-center justify-center md:justify-start gap-2">
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    onKeyDown={handleNameKeyDown}
                    disabled={isSavingName}
                    maxLength={30}
                    className="font-display text-3xl md:text-5xl text-[#f0ead9] bg-transparent border-b-2 border-[#ff4e2d] outline-none max-w-full disabled:opacity-50 tracking-wide"
                  />
                  <button
                    onClick={saveName}
                    disabled={isSavingName}
                    title="Simpan"
                    className="w-8 h-8 rounded-full bg-[#d4a73c] text-[#0b0b10] flex items-center justify-center shrink-0 hover:scale-110 transition-transform disabled:opacity-50"
                  >
                    {isSavingName ? (
                      <div className="w-3.5 h-3.5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={cancelEditName}
                    disabled={isSavingName}
                    title="Batal"
                    className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center shrink-0 hover:bg-white/20 transition-colors disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <h1
                  onClick={startEditName}
                  title="Klik untuk edit nama"
                  className="font-display text-3xl md:text-5xl text-[#f0ead9] truncate cursor-pointer hover:text-[#ff4e2d] transition-colors inline-block tracking-wide"
                >
                  {user?.name || 'User'}
                </h1>
              )}
              {clanBadge && <ClanBadge badge={clanBadge} size="lg" />}
              {nameError && (
                <p className="text-red-400 text-xs font-medium mt-1">{nameError}</p>
              )}

              <p className="text-white/35 text-sm font-medium mt-0.5">{user?.email}</p>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-6 gap-y-1 mt-4 text-xs">
                <span className="text-white/50">
                  Level <b className="text-white font-black">{user?.level || 0}</b>
                </span>
                <span className="w-1 h-1 rounded-full bg-white/10 hidden md:inline-block" />
                <span className="text-white/50">
                  Nonton <b className="text-white font-black">{formatWatchTime(user?.watchTime || 0)}</b>
                </span>
                <span className="w-1 h-1 rounded-full bg-white/10 hidden md:inline-block" />
                <span className="text-white/50">
                  Bergabung <b className="text-white font-black">{stats.joinDate}</b>
                </span>
                <span className="w-1 h-1 rounded-full bg-white/10 hidden md:inline-block" />
                <button onClick={() => setFollowModal('followers')} className="text-white/50 hover:text-[#d4a73c] transition-colors">
                  <b className="text-white font-black">{followCounts.followerCount}</b> Pengikut
                </button>
                <span className="w-1 h-1 rounded-full bg-white/10 hidden md:inline-block" />
                <button onClick={() => setFollowModal('following')} className="text-white/50 hover:text-[#d4a73c] transition-colors">
                  <b className="text-white font-black">{followCounts.followingCount}</b> Mengikuti
                </button>
                <span className="w-1 h-1 rounded-full bg-white/10 hidden md:inline-block" />
                <button onClick={() => setShowViewers(true)} className="text-white/50 hover:text-[#d4a73c] transition-colors">
                  Dilihat Oleh
                </button>
              </div>

              <div className="mt-3 flex justify-center md:justify-start">
                <BadgeShowcase user={user} history={history} chats={chats} streak={streak} triviaTotalCorrect={triviaTotalCorrect} />
              </div>
              {avatarError && (
                <p className="text-red-400 text-xs font-medium mt-2">{avatarError}</p>
              )}
            </div>

            <button
              onClick={() => navigate('/home')}
              className="shrink-0 px-5 py-2.5 rounded-xl bg-white/[0.05] hover:bg-[#d4a73c] hover:text-[#0b0b10] border border-white/10 hover:border-[#d4a73c] text-white font-bold text-xs transition-all shadow-sm active:scale-95"
            >
              Kembali
            </button>
          </div>

          {/* Stat strip — satu baris dengan pemisah, bukan 4 kotak identik */}
          <div className="relative z-10 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 divide-x divide-white/[0.06] border-t border-white/[0.06]">
            {[
              ['Total Nonton', formatWatchTime(stats.totalWatched)],
              ['Episode', stats.totalEpisodes],
              ['Jam Nonton', `${stats.totalHours}j`],
              ['Genre Favorit', stats.favoriteGenre],
              ['Komik Favorit', stats.favoriteManga],
            ].map(([label, value]) => (
              <div key={label} className="px-4 py-4 text-center">
                <p className="text-white/25 text-[10px] font-bold uppercase tracking-wider">{label}</p>
                <p className="font-mono-ui text-lg font-bold text-[#f0ead9] mt-1 truncate">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Profile Anime BGM Widget */}
        <div className="mb-6">
          <ProfileThemeSong
            themeSong={user?.themeSong}
            userName={user?.name}
            isOwner={true}
            onEditClick={() => setActiveTab('customize')}
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-2.5 mb-8 border-b border-white/[0.08] pb-3 overflow-x-auto custom-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
          {[
            ['profile', 'Profil'],
            ['cards', 'Kartu & Gacha'],
            ['quests', 'Quest'],
            ['story', 'Story Arc'],
            ['rpg', 'RPG'],
            ['achievements', 'Achievement'],
            ['trivia', 'Trivia'],
            ['customize', 'Kustomisasi'],
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
          {activeTab === 'profile' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <UserLevel user={user} />
              <DailyStreak
                onClaimed={() => {
                  refreshUserData();
                  loadStreak();
                }}
              />
              <div className="md:col-span-2">
                <div
                  onClick={() => navigate('/isekai')}
                  className="bg-gradient-to-r from-[#d4a73c]/20 via-[#181824] to-[#181824] border border-[#d4a73c]/40 rounded-2xl p-5 cursor-pointer hover:border-[#d4a73c] transition-all flex items-center justify-between group shadow-xl"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-[#d4a73c]/20 flex items-center justify-center text-[#d4a73c] shrink-0 group-hover:scale-110 transition-transform">
                      <Compass className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase text-[#d4a73c] font-mono-ui block">ISEKAI TRAVEL PASSPORT</span>
                      <h4 className="text-white font-black text-sm md:text-base">Peta Penaklukan Dunia Anime</h4>
                      <p className="text-white/40 text-xs mt-0.5">Taklukkan 8 dimensi anime dan pamerkan stempel paspor emasmu!</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-[#d4a73c] group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              <div className="md:col-span-2">
                <ProfileDeck userId={user?.id} isOwner={true} />
              </div>
              <BirthdateSettings />

              <div className="bg-[#181820] border border-[#2a2a35] card-cut p-6 md:col-span-2">
                <h3 className="text-white font-bold text-sm mb-4">Statistik Lengkap</h3>
                <div className="space-y-3">
                  {[
                    ['Total Nonton', formatWatchTime(stats.totalWatched)],
                    ['Total Episode', stats.totalEpisodes],
                    ['Total Jam', `${stats.totalHours} jam`],
                    ['Level', `Lv.${user?.level || 0}`, true],
                    ['Title', user?.title || 'Anime Newbie', true],
                  ].map(([label, value, gold], i, arr) => (
                    <div key={label} className={`flex justify-between items-center ${i < arr.length - 1 ? 'border-b border-white/5 pb-3' : ''}`}>
                      <span className="text-white/40 text-xs font-medium">{label}</span>
                      <span className={`font-bold text-sm ${gold ? 'text-[#d4a73c]' : 'text-white'}`}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'cards' && (
            <div className="space-y-6">
              <ProfileDeck userId={user?.id} isOwner={true} />
              <CardAlbum onShowcaseUpdated={() => refreshUserData()} />
            </div>
          )}

          {activeTab === 'quests' && (
            <QuestLog onClaimed={() => refreshUserData()} />
          )}

          {activeTab === 'story' && (
            <StoryArc onClaimed={() => refreshUserData()} />
          )}

          {activeTab === 'rpg' && (
            <div className="space-y-6">
              <SkillTree onUnlocked={() => refreshUserData()} />
              <ClassSelect onChanged={() => refreshUserData()} />
              <GuildSelect onChanged={() => refreshUserData()} />
              <BossEvent onClaimed={() => refreshUserData()} />
              <HallOfFame />
              <Inventory onUsed={() => refreshUserData()} />
            </div>
          )}

          {activeTab === 'achievements' && (
            <Achievements user={user} history={history} chats={chats} streak={streak} triviaTotalCorrect={triviaTotalCorrect} />
          )}

          {activeTab === 'trivia' && (
            <TriviaGame
              onScored={() => {
                refreshUserData();
                loadTrivia();
              }}
            />
          )}

          {activeTab === 'customize' && (
            <ProfileCustomizer user={user} onUpdated={(updatedUser) => setUser(updatedUser)} />
          )}

          {activeTab === 'history' && (
            <div className="bg-[#181820] border border-[#2a2a35] card-cut p-6">
              <h3 className="text-white font-bold text-sm mb-4">Riwayat Tonton & Baca</h3>
              {history.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-white/30 font-medium">Belum ada riwayat</p>
                  <p className="text-white/20 text-sm mt-1">Mulai tonton anime atau baca komik sekarang!</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar">
                  {history.map((item, index) => {
                    const isManga = item.type === 'manga';
                    const slug = (item.animeTitle || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
                    const targetPath = isManga
                      ? (item.currentChapter?.slug ? `/baca/${item.currentChapter.slug}` : `/komik/${item.animeId}`)
                      : `/anime/${item.animeId}-${slug}/${item.currentEpisode?.index}`;

                    return (
                      <div
                        key={`${item.type}-${item.animeId}` || index}
                        onClick={() => navigate(targetPath)}
                        className="flex items-center gap-4 p-3 bg-[#0b0b10] border border-white/5 rounded-lg hover:border-[#d4a73c]/30 hover:bg-white/5 transition-all cursor-pointer group"
                      >
                        <img
                          src={`https://cfelainawanggy.pages.dev/?action=proxy&url=${encodeURIComponent(item.image_cover || item.image_poster || '')}`}
                          alt={item.animeTitle}
                          className="w-16 aspect-[3/4.2] object-cover rounded-md shadow-md group-hover:scale-105 transition-transform"
                          referrerPolicy="no-referrer"
                          onError={(e) => { e.target.src = 'https://via.placeholder.com/100x150/16161a/ffffff?text=No+Image'; }}
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-white font-bold text-sm truncate group-hover:text-[#d4a73c] transition-colors">
                            {item.animeTitle || (isManga ? 'Unknown Komik' : 'Unknown Anime')}
                          </h4>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className={`text-[9px] px-2 py-0.5 rounded-sm font-bold uppercase ${isManga ? 'bg-[#d4a73c]/15 text-[#d4a73c]' : 'bg-white/5 text-white/60'}`}>
                              {isManga ? `Ch. ${item.currentChapter?.chapter || '-'}` : `Eps ${item.currentEpisode?.index || '-'}`}
                            </span>
                            {item.genre && (
                              <span className="text-white/20 text-[9px] font-medium truncate max-w-[200px]">
                                {item.genre}
                              </span>
                            )}
                          </div>
                          <p className="text-white/20 text-[8px] font-medium mt-1">
                            {formatDate(item.timestamp)}
                          </p>
                        </div>
                        <svg className="w-5 h-5 text-[#d4a73c]/30 group-hover:text-[#d4a73c] transition-colors shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                        </svg>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'chats' && (
            <div className="bg-[#181820] border border-[#2a2a35] card-cut p-6">
              <h3 className="text-white font-bold text-sm mb-4">Riwayat Chat Global</h3>
              {chatsLoading ? (
                <div className="text-center py-12 text-white/30 text-sm">Memuat...</div>
              ) : chats.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-white/30 font-medium">Belum ada chat di chat global</p>
                  <p className="text-white/20 text-sm mt-1">Kirim pesan di chat global untuk mengisi riwayat</p>
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

      {/* Fullscreen image modal untuk chat */}
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

      {followModal && user?.id && (
        <FollowListModal userId={user.id} mode={followModal} onClose={() => setFollowModal(null)} />
      )}
      {showViewers && user?.id && (
        <ProfileViewersModal userId={user.id} onClose={() => setShowViewers(false)} />
      )}

      <Footer />
    </div>
  );
};

export default Profile;
