import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Shimmer } from '../components/SectionUI';
import { setSeoMeta, SITE_URL, getBreadcrumbSchema, getCollectionSchema } from '../utils/seo';

const CardSkeleton = () => (
  <div className="flex flex-col gap-2.5">
    <div className="aspect-[3/4.4] bg-[#14141e] rounded-2xl border border-white/5 relative overflow-hidden">
      <Shimmer />
    </div>
    <div className="w-4/5 h-3 bg-white/5 rounded-md relative overflow-hidden"><Shimmer /></div>
  </div>
);

const RecentChapters = ({ chapters, onOpenChapter }) => {
  if (!chapters || chapters.length === 0) return null;
  return (
    <div className="flex flex-col gap-1 mt-1">
      {chapters.slice(0, 2).map((ch) => (
        <button
          key={ch.slug}
          onClick={(e) => {
            e.stopPropagation();
            onOpenChapter(ch);
          }}
          className="text-left text-[10px] text-white/50 hover:text-[#d4a73c] font-bold truncate transition-colors bg-white/[0.03] hover:bg-white/[0.08] px-2 py-0.5 rounded-md"
        >
          Ch. {ch.chapterNum}
        </button>
      ))}
    </div>
  );
};

const KomikCard = ({ item, onClick, onOpenChapter }) => {
  const [loaded, setLoaded] = useState(false);
  const latestChapter = item.chapters?.[0]?.chapterNum;

  return (
    <div
      onClick={onClick}
      style={{ contentVisibility: 'auto', containIntrinsicSize: '260px' }}
      className="group w-full cursor-pointer active:scale-95 transition-all duration-300 flex flex-col gap-2 shrink-0 select-none contain-layout"
    >
      <div className="relative aspect-[3/4.4] w-full rounded-2xl overflow-hidden bg-[#15151e] border border-white/[0.08] shadow-md group-hover:shadow-2xl group-hover:shadow-[#d4a73c]/15 group-hover:border-[#d4a73c]/40 transition-all duration-300 transform-gpu">
        {item.badge === 'Hot' && (
          <span className="absolute top-2 left-2 z-10 bg-[#ff4e2d] text-[#0b0b10] text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider shadow">
            HOT
          </span>
        )}
        {latestChapter && (
          <span className="absolute bottom-2 left-2 z-10 bg-[#09090e]/85 backdrop-blur-md text-white text-[9px] font-bold px-2 py-0.5 rounded-md border border-white/10 shadow">
            Ch. {latestChapter}
          </span>
        )}
        {item.rating && item.rating !== '0' && (
          <span className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-black/60 backdrop-blur-md text-[#d4a73c] text-[9px] font-black px-2 py-0.5 rounded-md border border-white/10 shadow">
            <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            <span>{item.rating}</span>
          </span>
        )}
        <img
          src={`https://cfelainawanggy.pages.dev/?action=proxy&url=${encodeURIComponent(item.cover)}`}
          referrerPolicy="no-referrer"
          alt={item.title || 'Komik Terbaru'}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          className={`w-full h-full object-cover group-hover:scale-105 transition-all duration-500 ease-out ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b10]/90 via-[#0b0b10]/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center pointer-events-none">
          <div className="w-10 h-10 md:w-11 md:h-11 rounded-full bg-[#d4a73c] text-[#0b0b10] flex items-center justify-center shadow-xl shadow-[#d4a73c]/50 transform scale-75 group-hover:scale-100 transition-transform duration-300">
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M4 4h16v2H4V4zm0 5h16v11H4V9zm2 2v7h12v-7H6z" />
            </svg>
          </div>
        </div>
      </div>
      <h3 className="text-xs md:text-[13px] font-bold text-white/80 group-hover:text-[#d4a73c] line-clamp-2 leading-snug transition-colors pt-0.5">
        {item.title}
      </h3>
      <RecentChapters chapters={item.chapters} onOpenChapter={onOpenChapter} />
    </div>
  );
};

const LIMIT = 50;

const KomikLatest = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [cursor, setCursor] = useState({ hasNext: false, hasPrev: false, nextCursor: null, prevCursor: null });

  useEffect(() => {
    setSeoMeta(
      'Komik Rilis Terbaru Sub Indo Hari Ini - Update Tiap Hari | Ndichan',
      'Baca update chapter komik Manga, Manhwa, dan Manhua terbaru yang rilis hari ini subtitle Indonesia kualitas HD gratis tanpa iklan di Ndichan.',
      '/img/welcomebanner.webp',
      `${SITE_URL}/komik/latest`,
      {
        keywords: 'komik terbaru, manga rilis terbaru, chapter baru manhwa, update komik hari ini, baca komik sub indo, ndichan',
        schema: {
          '@context': 'https://schema.org',
          '@graph': [
            getCollectionSchema({
              name: 'Komik Rilis Terbaru | Ndichan',
              description: 'Daftar komik yang baru saja rilis dan update chapter di Ndichan.',
              url: `${SITE_URL}/komik/latest`
            }),
            getBreadcrumbSchema([
              { name: 'Home', url: '/' },
              { name: 'Komik', url: '/komik' },
              { name: 'Rilis Terbaru', url: '/komik/latest' }
            ])
          ]
        }
      }
    );
  }, []);

  const fetchItems = useCallback(async (isInitial = false, cursorValue = null) => {
    if (isInitial) {
      setIsLoading(true);
      setError(false);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const url = cursorValue
        ? `/ndikagantengtobrutbanget/v1/manga/latest?limit=${LIMIT}&cursor=${encodeURIComponent(cursorValue)}`
        : `/ndikagantengtobrutbanget/v1/manga/latest?limit=${LIMIT}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      const newItems = json.data || [];
      const newCursor = json.cursor || { hasNext: false, hasPrev: false, nextCursor: null, prevCursor: null };

      setItems(prev => (isInitial ? newItems : [...prev, ...newItems]));
      setCursor(newCursor);
    } catch (e) {
      if (isInitial) setError(true);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchItems(true);
  }, [fetchItems]);

  const loadMore = () => {
    if (cursor.hasNext && cursor.nextCursor && !isLoadingMore) {
      fetchItems(false, cursor.nextCursor);
    }
  };

  const goToDetail = (item) => navigate(`/komik/${item.slug}`);
  const openChapter = (ch) => navigate(`/baca/${ch.slug}`);

  return (
    <div className="min-h-screen bg-[#09090d] font-nunito selection:bg-[#d4a73c] selection:text-black pb-28 text-white relative">
      <Navbar />

      <section className="max-w-7xl mx-auto px-4 md:px-6 pt-24">
        {/* Header */}
        <div className="flex flex-col mb-8">
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="w-1.5 h-6 rounded-full bg-gradient-to-b from-[#d4a73c] to-[#ff4e2d] shadow-sm shadow-[#d4a73c]/50"></span>
            <h1 className="font-display text-2xl md:text-4xl text-white uppercase tracking-wide">
              Rilis Terbaru
            </h1>
          </div>
          <p className="text-xs md:text-sm text-white/50 pl-4 font-medium">
            Chapter komik yang baru saja diupdate subtitle Indonesia
          </p>
        </div>

        {/* Grid */}
        {isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4 md:gap-5 mb-12">
            {[...Array(LIMIT)].map((_, i) => <CardSkeleton key={i} />)}
          </div>
        )}

        {!isLoading && error && (
          <div className="flex flex-col items-center justify-center py-24 text-center px-6">
            <p className="text-white/60 font-bold text-sm">Gagal memuat rilisan terbaru.</p>
            <p className="text-white/30 text-xs mt-1">Coba lagi beberapa saat lagi.</p>
          </div>
        )}

        {!isLoading && !error && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center px-6">
            <p className="text-white/40 font-bold text-sm">Belum ada data untuk ditampilkan.</p>
          </div>
        )}

        {!isLoading && !error && items.length > 0 && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4 md:gap-5 mb-12">
              {items.map((item, i) => (
                <KomikCard
                  key={item.slug || i}
                  item={item}
                  onClick={() => goToDetail(item)}
                  onOpenChapter={openChapter}
                />
              ))}
            </div>

            {cursor.hasNext && (
              <div className="flex justify-center mt-10 mb-14">
                <button
                  onClick={loadMore}
                  disabled={isLoadingMore}
                  className="px-8 py-3 bg-[#12121a] hover:bg-[#181824] border border-white/10 hover:border-[#d4a73c]/60 text-white hover:text-[#d4a73c] font-black text-xs uppercase tracking-wider rounded-xl transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg active:scale-95"
                >
                  {isLoadingMore && (
                    <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-[#d4a73c] rounded-full animate-spin" />
                  )}
                  {isLoadingMore ? 'Memuat...' : 'Muat Lebih Banyak'}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <Footer />
    </div>
  );
};

export default KomikLatest;
