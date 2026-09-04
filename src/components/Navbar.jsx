import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Chat from '../components/Chat';
import Leaderboard from '../components/Leaderboard';
import AuthModals from './AuthModals';
import { useAnnouncementHeight } from '../context/AnnouncementContext';
import { useAuth } from '../context/AuthContext';
import { useAdaptiveInterval } from '../hooks/useAdaptiveInterval';

const IMG_PROXY = (url) => `https://cfelainawanggy.pages.dev/?action=proxy&url=${encodeURIComponent(url)}`;

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const announcementHeight = useAnnouncementHeight();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [liveResults, setLiveResults] = useState([]);
  const [komikResults, setKomikResults] = useState([]);
  const [isLiveLoading, setIsLiveLoading] = useState(false);
  const {
    user,
    userLevel,
    userTitle,
    userWatchTime,
    showLoginModal,
    setShowLoginModal,
    setShowRegisterModal,
    refreshUser,
    logout
  } = useAuth();

  const setShowLoginPopup = setShowLoginModal;
  const setShowRegisterPopup = setShowRegisterModal;
  const showLoginPopup = showLoginModal;

  const searchInputRef = useRef(null);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [dmUnreadCount, setDmUnreadCount] = useState(0);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [searchType, setSearchType] = useState('anime'); // 'anime' | 'komik' | 'user'
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const searchUsers = async (query) => {
    if (query.length < 1) {
      setUserSearchResults([]);
      return;
    }

    try {
      const res = await fetch(`/api/v1/user/users?q=${encodeURIComponent(query)}`, {
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        setUserSearchResults(data.users || []);
      }
    } catch (error) {
      console.error('Search users error:', error);
      setUserSearchResults([]);
    }
  };

  // Polling jumlah chat pribadi yang belum dibaca dengan adaptive interval (pause di background)
  const loadUnread = useCallback(async () => {
    if (!user?.id) {
      setDmUnreadCount(0);
      return;
    }
    try {
      const res = await fetch('/api/v1/dm/unread-count', { credentials: 'include' });
      const data = await res.json();
      if (data.success) setDmUnreadCount(data.unreadCount || 0);
    } catch {
      // diamkan, badge dekoratif
    }
  }, [user?.id]);

  useAdaptiveInterval(loadUnread, user?.id ? 25000 : null, true);

  // Dengarkan event global 'ndichan:open-login' supaya komponen lain
  // (mis. CommentSection di halaman anime/komik) bisa buka popup login ini
  // tanpa perlu prop-drilling lewat banyak level komponen.
  useEffect(() => {
    const openLogin = () => setShowLoginPopup(true);
    window.addEventListener('ndichan:open-login', openLogin);
    return () => window.removeEventListener('ndichan:open-login', openLogin);
  }, []);

  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 300);
    } else {
      setSearchQuery('');
      setLiveResults([]);
      setKomikResults([]);
    }
  }, [isSearchOpen]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.length > 2) {
        setIsLiveLoading(true);
        try {
          if (searchType === 'anime') {
            const res = await fetch(`/ndikagantengtobrutbanget/v1/search?q=${encodeURIComponent(searchQuery)}`).then(r => r.json());
            setLiveResults(res.data || []);
            setKomikResults([]);
            setUserSearchResults([]);
          } else if (searchType === 'komik') {
            const res = await fetch(`/ndikagantengtobrutbanget/v1/manga/search?q=${encodeURIComponent(searchQuery)}`).then(r => r.json());
            setKomikResults(res.data || []);
            setLiveResults([]);
            setUserSearchResults([]);
          } else {
            await searchUsers(searchQuery);
            setLiveResults([]);
            setKomikResults([]);
          }
        } catch (e) {
          setLiveResults([]);
          setKomikResults([]);
          setUserSearchResults([]);
        }
        setIsLiveLoading(false);
      } else {
        setLiveResults([]);
        setKomikResults([]);
        setUserSearchResults([]);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, searchType]);

  const loadChatCount = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/social/chat', { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setChatMessages(data.messages || []);
      }
    } catch {}
  }, []);

  useAdaptiveInterval(loadChatCount, 45000, true);

  

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/explore?type=${searchType}&q=${encodeURIComponent(searchQuery)}`);
      setIsSearchOpen(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setIsProfileMenuOpen(false);
  };

  const saveHistory = async (animeId, animeTitle) => {
    if (!user) {
      setShowLoginPopup(true);
      return;
    }

    try {
      await fetch('/api/v1/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          animeId,
          title: animeTitle,
          timestamp: new Date().toISOString()
        })
      });
    } catch (error) {
      console.error('Failed to save history:', error);
    }
  };

  const handleAnimeClick = (animeId, animeTitle) => {
    if (user) {
      saveHistory(animeId, animeTitle);
    }
    navigate(`/anime/${animeId}-${(animeTitle || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);
    setIsSearchOpen(false);
  };

  const handleKomikClick = (slug) => {
    navigate(`/komik/${slug}`);
    setIsSearchOpen(false);
  };

  const navLinks = [
  { path: '/home', label: 'Home', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /> },
  { path: '/komik', label: 'Komik', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /> },
  { path: '/explore', label: 'Explore', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /> },
  { path: '/history', label: 'History', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /> },
  { path: '/ongoing', label: 'Ongoing', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> },
  { path: '/schedule', label: 'Schedule', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /> }
];

  // Small inline icon used for the level/title indicator instead of an emoji
  const LevelMark = () => (
    <svg className="w-3.5 h-3.5 text-[#d4a73c]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l2.6 5.75 6.2.6-4.7 4.2 1.4 6.15L12 15.6l-5.5 3.1 1.4-6.15-4.7-4.2 6.2-.6L12 2z" />
    </svg>
  );

  return (
    <>
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fadeScale {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }
        .google-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          background: #f2f2f0;
          color: #1a1a1a;
          padding: 11px 20px;
          border-radius: 10px;
          font-weight: 600;
          font-size: 13px;
          border: 1px solid transparent;
          cursor: pointer;
          transition: border-color 0.15s ease, background 0.15s ease;
          width: 100%;
        }
        .google-btn:hover {
          background: #ffffff;
          border-color: rgba(0,0,0,0.08);
        }
        .google-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .user-avatar {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          object-fit: cover;
          border: 1.5px solid rgba(246,207,128,0.5);
          cursor: pointer;
          transition: border-color 0.15s ease;
        }
        .user-avatar:hover {
          border-color: #d4a73c;
        }
        .auth-input {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          color: white;
          padding: 11px 14px;
          border-radius: 10px;
          width: 100%;
          font-size: 13.5px;
          transition: border-color 0.15s ease;
          outline: none;
        }
        .auth-input:focus {
          border-color: rgba(246,207,128,0.6);
        }
        .auth-input::placeholder {
          color: rgba(255,255,255,0.28);
        }
        .auth-error {
          color: #e5484d;
          font-size: 12px;
          margin-top: 2px;
        }
        .auth-btn {
          background: #d4a73c;
          color: #141419;
          padding: 11px;
          border-radius: 10px;
          font-weight: 700;
          font-size: 13.5px;
          border: none;
          cursor: pointer;
          transition: background 0.15s ease;
          width: 100%;
        }
        .auth-btn:hover:not(:disabled) {
          background: #f0c266;
        }
        .auth-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .divider {
          display: flex;
          align-items: center;
          gap: 14px;
          color: rgba(255,255,255,0.25);
          font-size: 11px;
          letter-spacing: 0.04em;
          margin: 14px 0;
        }
        .divider::before,
        .divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: rgba(255,255,255,0.08);
        }
        .switch-auth {
          color: #d4a73c;
          cursor: pointer;
          font-weight: 600;
        }
        .switch-auth:hover {
          text-decoration: underline;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(212,167,60,0.5);
          border-radius: 10px;
        }
        .icon-btn {
          width: 38px;
          height: 38px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255, 255, 255, 0.8);
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          flex-shrink: 0;
        }
        .icon-btn:hover {
          border-color: rgba(212, 167, 60, 0.4);
          color: #d4a73c;
          background: rgba(255, 255, 255, 0.08);
          transform: translateY(-1px);
        }
        .icon-btn:active {
          transform: scale(0.95);
        }
        .user-avatar {
          width: 38px;
          height: 38px;
          border-radius: 12px;
          object-fit: cover;
          border: 1.5px solid rgba(212, 167, 60, 0.4);
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        .user-avatar:hover {
          border-color: #d4a73c;
          transform: scale(1.05);
        }
        .menu-row {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          text-align: left;
          padding: 9px 16px;
          font-size: 13px;
          color: rgba(255,255,255,0.75);
          border-left: 2px solid transparent;
          transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
        }
        .menu-row:hover {
          background: rgba(255,78,45,0.06);
          border-left-color: #ff4e2d;
          color: #fff;
        }
        .menu-row.danger {
          color: #e5919a;
        }
        .menu-row.danger:hover {
          border-left-color: #e5484d;
          color: #f2a7ad;
        }
        .menu-row.accent {
          color: #d4a73c;
        }
      `}</style>

      <nav className="fixed inset-x-3 md:inset-x-6 z-[100] max-w-7xl mx-auto" style={{ top: `${10 + announcementHeight}px` }}>
        <div className="bg-[#09090e]/85 backdrop-blur-xl h-16 px-4 md:px-6 flex items-center justify-between border border-white/[0.08] shadow-2xl relative rounded-2xl">
          <div className="flex items-center gap-3 shrink-0 z-10">
            <img
              src="https://raw.githubusercontent.com/NdikzOne/NeFora/refs/heads/main/p_images2_064_987_022_original.jpeg"
              className="w-9 md:w-10 aspect-square object-contain cursor-pointer rounded-xl border border-white/10 hover:border-[#d4a73c]/50 transition-all shadow-md hover:scale-105"
              alt="Ndichan Logo"
              onClick={() => navigate('/home')}
            />
            <span
              onClick={() => navigate('/home')}
              className="font-display text-lg md:text-xl text-white tracking-wider cursor-pointer hover:text-[#d4a73c] transition-colors hidden sm:inline select-none"
            >
              NDICHAN
            </span>
          </div>

          {/* Desktop Search Bar Trigger */}
          <div
            onClick={() => setIsSearchOpen(true)}
            className="hidden md:flex items-center gap-2.5 px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-[#d4a73c]/40 text-white/40 hover:text-white transition-all text-xs font-medium cursor-pointer w-64 max-w-xs shadow-inner"
          >
            <svg className="w-3.5 h-3.5 text-white/40" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="flex-1 text-left">Cari anime, komik...</span>
            <kbd className="px-1.5 py-0.5 text-[9px] font-mono bg-white/10 rounded border border-white/10 text-white/50">⌘K</kbd>
          </div>

          <div className="flex items-center justify-end gap-2 md:gap-2.5 z-10">
            <div className="icon-btn md:hidden" onClick={() => setIsSearchOpen(true)}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <div className="relative">
              <button onClick={() => navigate('/messages')} className="icon-btn relative" title="Pesan">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {dmUnreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-[#d4a73c] text-[#141419] text-[9px] font-bold rounded-full flex items-center justify-center">
                    {dmUnreadCount > 9 ? '9+' : dmUnreadCount}
                  </span>
                )}
              </button>
            </div>

            <div className="relative">
              <button onClick={() => setShowChat(!showChat)} className="icon-btn relative">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                {chatMessages.length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-[#d4a73c] text-[#141419] text-[9px] font-bold rounded-full flex items-center justify-center">
                    {chatMessages.length > 9 ? '9+' : chatMessages.length}
                  </span>
                )}
              </button>

              {showChat && (
                <>
                  <div className="fixed inset-0 z-[40] bg-black/20" onClick={() => setShowChat(false)} />
                  <div className="fixed top-20 right-4 w-96 h-[600px] z-[50]" style={{ animation: 'fadeScale 0.15s ease-out' }}>
                    <div className="relative h-full">
                      <button
                        onClick={() => setShowChat(false)}
                        className="absolute -top-3 -right-3 z-10 w-7 h-7 bg-[#181820] border border-white/10 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:border-[#d4a73c] transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      <Chat user={user} showLoginPopup={() => setShowLoginPopup(true)} />
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="relative">
              <button onClick={() => setShowLeaderboard(!showLeaderboard)} className="icon-btn">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </button>

              {showLeaderboard && (
                <div className="fixed inset-0 z-[40] bg-black/20" onClick={() => setShowLeaderboard(false)} />
              )}
              {showLeaderboard && (
                <div className="fixed top-20 right-4 w-96 max-h-[80vh] z-[50]" style={{ animation: 'fadeScale 0.15s ease-out' }}>
                  <div className="relative">
                    <button
                      onClick={() => setShowLeaderboard(false)}
                      className="absolute -top-3 -right-3 z-10 w-7 h-7 bg-[#181820] border border-white/10 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:border-[#d4a73c] transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <Leaderboard />
                  </div>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => navigate('/watch2gether')}
                className="icon-btn relative text-[#ff4e2d] hover:text-white group"
                title="Watch2gether (Nonton Bareng Real-Time)"
              >
                <svg className="w-4 h-4 text-[#ff4e2d] group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </button>
            </div>

            <div className="relative">
              <button
                onClick={() => navigate('/gacha')}
                className="icon-btn relative text-[#d4a73c] hover:text-white group"
                title="Gacha & Koleksi Kartu Anime 3D"
              >
                <svg className="w-4 h-4 text-[#d4a73c] group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#ff2a70] animate-ping" />
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#ff2a70]" />
              </button>
            </div>

            {user ? (
              <div
                className="relative"
                onMouseEnter={() => setIsProfileMenuOpen(true)}
                onMouseLeave={() => setIsProfileMenuOpen(false)}
              >
                <img
                  src={user.picture}
                  alt={user.name}
                  className="user-avatar"
                  onClick={() => setShowLoginPopup(true)}
                />
                {isProfileMenuOpen && (
                  <div
                    className="absolute right-0 mt-3 w-56 bg-[#131316] border border-white/10 rounded-xl shadow-2xl overflow-hidden"
                    style={{ animation: 'fadeScale 0.12s ease-out' }}
                  >
                    <div className="px-4 py-3 border-b border-white/10">
                      <p className="text-white text-sm font-semibold truncate">{user.name}</p>
                      <p className="text-white/40 text-xs truncate mt-0.5">{user.email}</p>
                      <div className="flex items-center gap-1.5 mt-2">
                        <LevelMark />
                        <span className="text-[#d4a73c] text-xs font-semibold">Level {userLevel}</span>
                        <span className="text-white/20 text-xs">&middot;</span>
                        <span className="text-white/45 text-xs truncate">{userTitle}</span>
                      </div>
                    </div>

                    <div className="py-1">
                      <button onClick={() => navigate('/profile')} className="menu-row">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Profil Saya
                      </button>

                      <button onClick={() => navigate('/watch2gether')} className="menu-row text-[#ff4e2d]">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Nonton Bareng (W2G)
                      </button>

                      <button onClick={() => navigate('/gacha')} className="menu-row text-[#d4a73c]">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                        </svg>
                        Gacha & Kartu 3D
                      </button>

                      <button onClick={() => navigate('/arena')} className="menu-row text-rose-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                        </svg>
                        Card Battle Arena
                      </button>

                      <button onClick={() => navigate('/clan')} className="menu-row">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" />
                        </svg>
                        Clan
                      </button>

                      {user.isAdmin && (
                        <button onClick={() => navigate('/admin')} className="menu-row accent">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          Admin Panel
                        </button>
                      )}
                    </div>

                    <div className="border-t border-white/10 py-1">
                      <button onClick={handleLogout} className="menu-row danger">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div onClick={() => setShowLoginPopup(true)} className="icon-btn">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            )}
          </div>

          <div className={`absolute inset-0 bg-[#181820] z-20 flex items-center px-4 transition-all duration-200 ease-out ${isSearchOpen ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-6 pointer-events-none'}`}>
            <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center gap-3">
              <div className="flex items-center gap-1 bg-[#0b0b10] rounded-lg p-0.5 border border-white/[0.06] shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setSearchType('anime');
                    setSearchQuery('');
                    setLiveResults([]);
                    setKomikResults([]);
                    setUserSearchResults([]);
                  }}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-colors ${searchType === 'anime' ? 'bg-[#d4a73c] text-[#141419]' : 'text-white/40 hover:text-white'
                    }`}
                >
                  Anime
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSearchType('komik');
                    setSearchQuery('');
                    setLiveResults([]);
                    setKomikResults([]);
                    setUserSearchResults([]);
                  }}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-colors ${searchType === 'komik' ? 'bg-[#d4a73c] text-[#141419]' : 'text-white/40 hover:text-white'
                    }`}
                >
                  Komik
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSearchType('user');
                    setSearchQuery('');
                    setLiveResults([]);
                    setKomikResults([]);
                    setUserSearchResults([]);
                  }}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-colors ${searchType === 'user' ? 'bg-[#d4a73c] text-[#141419]' : 'text-white/40 hover:text-white'
                    }`}
                >
                  User
                </button>
              </div>

              <button type="submit" className="text-[#d4a73c] shrink-0 p-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>

              <input
                ref={searchInputRef}
                type="text"
                className="flex-1 bg-transparent text-white text-sm outline-none font-medium placeholder-white/30"
                placeholder={searchType === 'anime' ? 'Cari anime...' : searchType === 'komik' ? 'Cari komik...' : 'Cari user...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />

              <button
                type="button"
                onClick={() => {
                  setIsSearchOpen(false);
                  setSearchQuery('');
                  setLiveResults([]);
                  setKomikResults([]);
                  setUserSearchResults([]);
                }}
                className="text-white/40 hover:text-white p-2 shrink-0 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </form>
          </div>
        </div>

        {isSearchOpen && searchQuery.length > 2 && (
          <div
            className="absolute top-20 left-4 right-4 md:left-auto md:right-0 md:w-96 bg-[#181820] border border-white/10 rounded-2xl shadow-2xl z-[110] max-h-[60vh] overflow-y-auto custom-scrollbar origin-top"
            style={{ animation: 'slideDown 0.15s ease-out' }}
          >
            {isLiveLoading ? (
              <div className="p-6 text-center text-[#d4a73c] text-xs font-bold">mencari...</div>
            ) : searchType === 'anime' ? (
              liveResults.length > 0 ? (
                liveResults.map(r => (
                  <div
                    key={r.id}
                    onClick={() => handleAnimeClick(r.id, r.title)}
                    className="flex items-center gap-4 p-3 hover:bg-white/5 cursor-pointer border-b border-white/5 transition-colors"
                  >
                    <img src={`https://cfelainawanggy.pages.dev/?action=proxy&url=${r.image_poster}`} referrerPolicy="no-referrer" className="w-10 aspect-[3/4.5] object-cover rounded-md" />
                    <div className="flex flex-col">
                      <span className="text-white font-bold text-xs line-clamp-1">{r.title}</span>
                      <span className="text-white/40 font-bold text-[9px] mt-1">{r.type} &middot; {r.status}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-white/40 text-xs font-bold">anime tidak ditemukan</div>
              )
            ) : searchType === 'komik' ? (
              komikResults.length > 0 ? (
                komikResults.map((m) => (
                  <div
                    key={m.slug}
                    onClick={() => handleKomikClick(m.slug)}
                    className="flex items-center gap-4 p-3 hover:bg-white/5 cursor-pointer border-b border-white/5 transition-colors"
                  >
                    <div className="relative w-10 aspect-[3/4.5] rounded-md overflow-hidden shrink-0">
                      {m.badge && (
                        <span className="absolute top-0.5 left-0.5 z-10 bg-[#d4a73c] text-[#141419] text-[6px] font-black px-1 py-px rounded uppercase">{m.badge}</span>
                      )}
                      <img src={IMG_PROXY(m.cover)} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-white font-bold text-xs line-clamp-1">{m.title}</span>
                      <span className="text-white/40 font-bold text-[9px] mt-1 flex items-center gap-1">
                        {m.rating && m.rating !== '0' && (
                          <>
                            <svg className="w-2.5 h-2.5 fill-[#d4a73c]" viewBox="0 0 24 24"><path d="M12 .587l3.668 7.431 8.2 1.192-5.934 5.782 1.4 8.163L12 19.771l-7.334 3.384 1.4-8.163L.132 9.21l8.2-1.192z" /></svg>
                            {m.rating} &middot;
                          </>
                        )}
                        {m.chapters?.[0] && <span>Ch. {m.chapters[0].chapterNum}</span>}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-white/40 text-xs font-bold">komik tidak ditemukan</div>
              )
            ) : userSearchResults.length > 0 ? (
              userSearchResults.map((u) => (
                <div
                  key={u.id}
                  onClick={() => {
                    setIsSearchOpen(false);
                    setSearchQuery('');
                    setUserSearchResults([]);
                    navigate(`/user/${u.id}`);
                  }}
                  className="flex items-center gap-3 p-3 hover:bg-white/5 cursor-pointer border-b border-white/5 transition-colors"
                >
                  <img
                    src={u.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=F6CF80&color=14140f&size=128`}
                    alt={u.name}
                    className="w-10 h-10 rounded-full object-cover border border-white/10"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=F6CF80&color=14140f&size=128`;
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold text-sm truncate">{u.name}</span>
                      {u.isAdmin && (
                        <span className="bg-[#d4a73c] text-[#141419] text-[8px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-wider">
                          Admin
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-[#d4a73c] font-bold">Lv.{u.level || 0}</span>
                      <span className="text-white/30">&middot;</span>
                      <span className="text-white/40 truncate">{u.title || 'Anime Newbie'}</span>
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-white/20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              ))
            ) : (
              <div className="p-6 text-center">
                <p className="text-white/40 text-xs font-bold">user tidak ditemukan</p>
              </div>
            )}
          </div>
        )}
      </nav>

      <div className="fixed bottom-4 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-md bg-[#09090e]/85 backdrop-blur-xl border border-white/[0.09] shadow-2xl rounded-2xl flex justify-between items-center px-4 py-2 z-[90]">
        {navLinks.map((link) => {
          const isActive = location.pathname.includes(link.path);
          return (
            <div
              key={link.path}
              onClick={() => {
                if (link.path === '/history') {
                  if (!user) {
                    setShowLoginPopup(true);
                  } else {
                    navigate(link.path);
                  }
                } else {
                  navigate(link.path);
                }
              }}
              className={`flex flex-col items-center gap-1 transition-all cursor-pointer py-1 px-2.5 rounded-xl select-none ${
                isActive
                  ? 'text-[#d4a73c] bg-white/[0.06] shadow-sm'
                  : 'text-white/40 hover:text-white/80'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                {link.icon}
              </svg>
              <span className={`text-[10px] font-bold transition-all ${isActive ? 'opacity-100 scale-100' : 'hidden'}`}>
                {link.label}
              </span>
            </div>
          );
        })}
      </div>

      <AuthModals />
    </>
  );
};

export default Navbar;
