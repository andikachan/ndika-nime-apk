import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Shimmer, AnimeCard } from '../components/SectionUI';
import { setSeoMeta, SITE_URL, getBreadcrumbSchema, getCollectionSchema } from '../utils/seo';

const New = () => {
  const navigate = useNavigate();
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const limit = 60;
  const sentinelRef = useRef(null);
  const isFetchingRef = useRef(false);

  useEffect(() => {
    setSeoMeta(
      'Anime Rilis Terbaru Sub Indo - Update Episode Baru | Ndichan',
      'Daftar anime terbaru dan episode baru yang rilis di Ndichan. Nonton anime sub indo gratis kualitas HD tanpa iklan tercepat.',
      '/img/welcomebanner.webp',
      `${SITE_URL}/new`,
      {
        keywords: 'anime terbaru, anime rilis baru, episode baru anime, streaming anime terbaru, ndichan',
        schema: {
          '@context': 'https://schema.org',
          '@graph': [
            getCollectionSchema({
              name: 'Anime Rilis Terbaru Sub Indo | Ndichan',
              description: 'Daftar anime terbaru yang baru dirilis subtitle Indonesia di Ndichan.',
              url: `${SITE_URL}/new`
            }),
            getBreadcrumbSchema([
              { name: 'Home', url: '/' },
              { name: 'Anime Terbaru', url: '/new' }
            ])
          ]
        }
      }
    );
  }, []);

  const fetchPage = useCallback(async (pageToLoad, isFirstPage) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (isFirstPage) setIsLoading(true);
    else setIsLoadingMore(true);

    try {
      const res = await fetch(
        `/ndikagantengtobrutbanget/v1/new?page=${pageToLoad}&limit=${limit}`
      ).then(r => r.json());

      const data = res.data || [];
      const totalCount = typeof res.total === 'number' ? res.total : null;

      setResults(prev => (isFirstPage ? data : [...prev, ...data]));

      if (totalCount !== null) {
        setTotal(totalCount);
      }

      if (typeof res.hasMore === 'boolean') {
        setHasMore(res.hasMore);
      } else {
        const loadedCount = (isFirstPage ? 0 : (pageToLoad - 1) * limit) + data.length;
        const noMoreLeft = data.length < limit || (totalCount !== null && loadedCount >= totalCount);
        setHasMore(!noMoreLeft);
      }

      setPage(pageToLoad);
    } catch (e) {
      if (isFirstPage) setResults([]);
      setHasMore(false);
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [limit]);

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchPage(1, true);
  }, [fetchPage]);

  useEffect(() => {
    if (!hasMore || isLoading) return;
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting && !isFetchingRef.current && hasMore) {
          fetchPage(page + 1, false);
        }
      },
      { rootMargin: '400px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, isLoading, page, fetchPage]);

  const filteredResults = useMemo(() => {
    if (!searchQuery.trim()) return results;
    const q = searchQuery.toLowerCase();
    return results.filter(a => (a.title || '').toLowerCase().includes(q));
  }, [results, searchQuery]);

  return (
    <div className="min-h-screen bg-[#09090d] font-nunito selection:bg-[#d4a73c] selection:text-black pb-28 text-white">
      <Navbar />

      <div className="pt-24 max-w-7xl mx-auto px-4 md:px-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="w-1.5 h-6 rounded-full bg-gradient-to-b from-[#d4a73c] to-[#ff4e2d] shadow-sm shadow-[#d4a73c]/50"></span>
              <h1 className="font-display text-2xl md:text-4xl text-white uppercase tracking-wide">
                Anime Terbaru
              </h1>
              {total > 0 && (
                <span className="text-xs bg-[#d4a73c]/15 text-[#d4a73c] font-black px-2.5 py-0.5 rounded-full border border-[#d4a73c]/20">
                  {total} Judul
                </span>
              )}
            </div>
            <p className="text-xs md:text-sm text-white/50 pl-4 font-medium">
              Judul anime yang baru ditambahkan ke dalam database NdiChan
            </p>
          </div>

          {/* Search */}
          <div className="w-full md:w-72 relative">
            <input
              type="text"
              placeholder="Cari anime terbaru..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/30 outline-none focus:border-[#d4a73c]/60 transition-colors shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
              >
                <svg className="w-3.5 h-3.5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4 md:gap-5 mb-10">
          {isLoading ? (
            [...Array(18)].map((_, i) => (
              <div key={i} className="w-full flex flex-col gap-2.5">
                <div className="aspect-[3/4.4] bg-[#14141e] rounded-2xl border border-white/5 relative overflow-hidden">
                  <Shimmer />
                </div>
                <div className="w-4/5 h-3 bg-white/5 rounded-md relative overflow-hidden"><Shimmer /></div>
              </div>
            ))
          ) : filteredResults.length > 0 ? (
            filteredResults.map((a) => (
              <div key={a.id} className="w-full">
                <AnimeCard
                  anime={a}
                  onClick={() => navigate(`/anime/${a.id}-${(a.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`)}
                  badgeText="BARU"
                />
              </div>
            ))
          ) : (
            <div className="col-span-full py-24 text-center">
              <p className="text-white/40 font-bold text-sm">Tidak ditemukan</p>
            </div>
          )}

          {isLoadingMore &&
            [...Array(12)].map((_, i) => (
              <div key={`more-${i}`} className="w-full flex flex-col gap-2.5">
                <div className="aspect-[3/4.4] bg-[#14141e] rounded-2xl border border-white/5 relative overflow-hidden">
                  <Shimmer />
                </div>
                <div className="w-4/5 h-3 bg-white/5 rounded-md relative overflow-hidden"><Shimmer /></div>
              </div>
            ))}
        </div>

        {/* Infinite Scroll Sentinel */}
        <div ref={sentinelRef} className="h-10 flex items-center justify-center">
          {isLoadingMore && (
            <div className="w-6 h-6 border-2 border-[#d4a73c]/30 border-t-[#d4a73c] rounded-full animate-spin" />
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default New;
