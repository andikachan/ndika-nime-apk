import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Shimmer } from '../components/SectionUI';
import { setSeoMeta, SITE_URL } from '../utils/seo';
import { useAuth } from '../context/AuthContext';

const History = () => {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();
  const [deletingId, setDeletingId] = useState(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    setSeoMeta(
      'Riwayat Tontonan | Ndichan',
      'Lihat riwayat anime dan komik yang pernah kamu tonton atau baca di Ndichan.',
      null,
      `${SITE_URL}/history`,
      { noIndex: true }
    );
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchHistory = async () => {
      try {
        const historyRes = await fetch('/api/v1/history', { credentials: 'include' });
        if (historyRes.ok) {
          const data = await historyRes.json();
          setHistory(data.data || []);
        }
      } catch (error) {
        console.error('Fetch history error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [user, authLoading]);

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return 'Baru saja';
    if (diffHours < 24) {
      if (diffHours === 0) return `${diffMinutes} menit lalu`;
      return `${diffHours} jam lalu`;
    }
    if (diffDays === 1) return 'Kemarin';
    if (diffDays < 7) return `${diffDays} hari lalu`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} minggu lalu`;

    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const handleItemClick = (item) => {
    if (item.type === 'manga') {
      if (item.currentChapter?.slug) {
        navigate(`/baca/${item.currentChapter.slug}`);
      }
      return;
    }
    const slug = (item.animeTitle || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    navigate(`/anime/${item.animeId}-${slug}/${item.currentEpisode?.index || ''}`);
  };

  const handleDeleteItem = async (e, item) => {
    e.stopPropagation();
    const itemId = item.animeId || item.id;
    setDeletingId(itemId);
    try {
      const res = await fetch('/api/v1/history', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          animeId: item.animeId,
          type: item.type || 'anime'
        })
      });

      if (res.ok) {
        setHistory(prev => prev.filter(h => (h.animeId || h.id) !== itemId));
      }
    } catch (err) {
      console.error('Hapus item error:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAll = async () => {
    setClearingAll(true);
    try {
      const res = await fetch('/api/v1/history', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ clearAll: true })
      });

      if (res.ok) {
        setHistory([]);
      }
    } catch (error) {
      console.error('Gagal menghapus riwayat:', error);
    } finally {
      setClearingAll(false);
      setConfirmClearAll(false);
    }
  };

  const filteredHistory = history.filter(item => {
    if (filter === 'all') return true;
    return (item.type || 'anime') === filter;
  });

  return (
    <div className="min-h-screen bg-[#09090d] font-nunito selection:bg-[#d4a73c] selection:text-black pb-28 text-white">
      <Navbar />

      <div className="pt-24 max-w-5xl mx-auto px-4 md:px-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="w-1.5 h-6 rounded-full bg-gradient-to-b from-[#d4a73c] to-[#ff4e2d] shadow-sm shadow-[#d4a73c]/50"></span>
              <h1 className="font-display text-2xl md:text-4xl text-white uppercase tracking-wide">
                Riwayat Aktivitas
              </h1>
              {history.length > 0 && (
                <span className="text-xs bg-[#d4a73c]/15 text-[#d4a73c] font-black px-2.5 py-0.5 rounded-full border border-[#d4a73c]/20">
                  {history.length} Item
                </span>
              )}
            </div>
            <p className="text-xs md:text-sm text-white/50 pl-4 font-medium">
              Lanjutkan tontonan anime atau bacaan komikmu kapan saja
            </p>
          </div>

          {user && history.length > 0 && (
            <button
              onClick={() => setConfirmClearAll(true)}
              className="flex items-center gap-2 text-xs font-bold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl px-4 py-2.5 transition-all self-start md:self-auto"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Hapus Semua</span>
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        {user && history.length > 0 && (
          <div className="flex items-center gap-2 mb-6">
            {[
              { key: 'all', label: 'Semua' },
              { key: 'anime', label: 'Anime' },
              { key: 'manga', label: 'Komik' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`text-xs font-black uppercase tracking-wider px-4 py-2 rounded-xl transition-all select-none ${
                  filter === tab.key
                    ? 'bg-gradient-to-r from-[#d4a73c] to-[#ff4e2d] text-[#0b0b10] shadow-md shadow-[#d4a73c]/25'
                    : 'bg-[#12121a] text-white/50 hover:text-white border border-white/10 hover:border-white/20'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Clear All Confirmation Modal/Card */}
        {confirmClearAll && (
          <div className="mb-6 p-4 md:p-5 rounded-2xl border border-rose-500/30 bg-rose-500/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs md:text-sm text-white/90 font-bold">
              Yakin ingin menghapus seluruh riwayat aktivitasmu?
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setConfirmClearAll(false)}
                disabled={clearingAll}
                className="px-4 py-2 text-xs font-bold text-white/70 hover:text-white bg-white/5 rounded-xl transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleClearAll}
                disabled={clearingAll}
                className="px-4 py-2 text-xs font-black text-white bg-rose-600 hover:bg-rose-500 rounded-xl transition-colors shadow-md"
              >
                {clearingAll ? 'Menghapus...' : 'Ya, Hapus Semua'}
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-[#12121a] rounded-2xl border border-white/5 relative overflow-hidden">
                <Shimmer />
              </div>
            ))}
          </div>
        ) : !user ? (
          <div className="py-24 rounded-2xl bg-[#12121a]/60 border border-white/10 flex flex-col items-center justify-center text-center p-6 shadow-xl">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-[#d4a73c] mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-white font-bold text-base md:text-lg mb-1">Masuk untuk Menyimpan Riwayat</h3>
            <p className="text-white/40 text-xs md:text-sm max-w-sm mb-4">
              Riwayat tontonan dan bacaanmu akan tersinkronisasi otomatis di semua perangkat.
            </p>
            <button
              onClick={() => navigate('/home')}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#d4a73c] to-[#ff4e2d] text-[#0b0b10] font-black text-xs shadow-lg shadow-[#d4a73c]/25 hover:brightness-110 active:scale-95 transition-all"
            >
              Kembali ke Beranda
            </button>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="py-24 rounded-2xl bg-[#12121a]/60 border border-white/10 flex flex-col items-center justify-center text-center p-6 shadow-xl">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-white/30 mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-white font-bold text-base mb-1">
              {filter === 'manga' ? 'Belum ada riwayat komik' : filter === 'anime' ? 'Belum ada riwayat anime' : 'Riwayat masih kosong'}
            </h3>
            <p className="text-white/40 text-xs">Mulai nonton anime atau baca komik favoritmu sekarang!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-14">
            {filteredHistory.map((item, index) => {
              const isManga = item.type === 'manga';
              const progressText = isManga
                ? item.currentChapter?.chapter
                  ? `Ch. ${item.currentChapter.chapter}`
                  : 'Dibaca'
                : item.currentEpisode?.index
                ? `Eps ${item.currentEpisode.index}`
                : 'Ditonton';

              return (
                <div
                  key={`${item.type || 'anime'}-${item.animeId || item.id}-${item.timestamp || index}`}
                  onClick={() => handleItemClick(item)}
                  className={`group cursor-pointer relative rounded-2xl bg-[#12121a]/90 hover:bg-[#161624] border border-white/[0.08] hover:border-[#d4a73c]/40 p-3.5 md:p-4 flex items-center gap-3.5 md:gap-4 transition-all duration-300 shadow-md hover:shadow-xl hover:shadow-[#d4a73c]/10 active:scale-98 ${
                    deletingId === (item.animeId || item.id) ? 'opacity-30 pointer-events-none' : ''
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="relative w-14 md:w-16 aspect-[3/4.2] rounded-xl overflow-hidden bg-black/40 border border-white/10 shrink-0 shadow-md">
                    <img
                      src={`https://cfelainawanggy.pages.dev/?action=proxy&url=${encodeURIComponent(item.image_poster || item.image_cover)}`}
                      referrerPolicy="no-referrer"
                      alt={item.animeTitle}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>

                  {/* Details */}
                  <div className="flex flex-col flex-1 min-w-0 pr-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-[#d4a73c] text-[#0b0b10] text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wide">
                        {isManga ? 'KOMIK' : 'ANIME'}
                      </span>
                      <span className="bg-white/10 text-white/80 text-[9px] font-bold px-1.5 py-0.5 rounded">
                        {progressText}
                      </span>
                    </div>

                    <h3 className="font-bold text-sm md:text-base text-white group-hover:text-[#d4a73c] transition-colors line-clamp-1">
                      {item.animeTitle}
                    </h3>

                    <span className="text-[10px] text-white/40 mt-1 font-medium">
                      {formatDate(item.timestamp)}
                    </span>
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={(e) => handleDeleteItem(e, item)}
                    title="Hapus dari riwayat"
                    className="w-8 h-8 rounded-xl bg-white/[0.03] hover:bg-rose-500/20 text-white/30 hover:text-rose-400 border border-white/5 hover:border-rose-500/30 flex items-center justify-center transition-all shrink-0"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default History;
