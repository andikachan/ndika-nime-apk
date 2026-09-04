import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Shimmer } from '../components/SectionUI';
import { setSeoMeta, SITE_URL, getBreadcrumbSchema, getCollectionSchema } from '../utils/seo';

const GENRES = [
  { slug: 'action', label: 'Action' },
  { slug: 'adventure', label: 'Adventure' },
  { slug: 'comedy', label: 'Comedy' },
  { slug: 'drama', label: 'Drama' },
  { slug: 'ecchi', label: 'Ecchi' },
  { slug: 'fantasy', label: 'Fantasy' },
  { slug: 'historical', label: 'Historical' },
  { slug: 'horror', label: 'Horror' },
  { slug: 'isekai', label: 'Isekai' },
  { slug: 'mystery', label: 'Mystery' },
  { slug: 'psychological', label: 'Psychological' },
  { slug: 'romance', label: 'Romance' },
  { slug: 'sci-fi', label: 'Sci-Fi' },
  { slug: 'slice-of-life', label: 'Slice of Life' },
  { slug: 'sports', label: 'Sports' },
  { slug: 'supernatural', label: 'Supernatural' },
  { slug: 'thriller', label: 'Thriller' },
  { slug: 'tragedy', label: 'Tragedy' },
];

const STATUS_OPTIONS = ['Ongoing', 'Completed', 'Dropped', 'Hiatus'];
const TYPE_OPTIONS = ['Manga', 'Manhwa', 'Manhua', 'Webtoon'];
const ORDER_OPTIONS = [
  { value: 'az', label: 'A-Z' },
  { value: 'za', label: 'Z-A' },
  { value: 'added', label: 'Baru Ditambahkan' },
  { value: 'update', label: 'Baru Update' },
  { value: 'popular', label: 'Populer' },
];

const LIMIT = 30;

const CardSkeleton = () => (
  <div className="flex flex-col gap-2.5">
    <div className="aspect-[3/4.4] bg-[#14141e] rounded-2xl border border-white/5 relative overflow-hidden">
      <Shimmer />
    </div>
    <div className="w-4/5 h-3 bg-white/5 rounded-md relative overflow-hidden"><Shimmer /></div>
  </div>
);

const KomikCard = ({ item, onClick }) => {
  const [loaded, setLoaded] = useState(false);
  const latestChapter = item.chapters?.[0]?.chapterNum;
  const genreLine = item.genres?.slice(0, 2).join(', ');

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
        {item.type && (
          <span className="absolute bottom-2 right-2 z-10 bg-black/70 backdrop-blur-md text-white/80 text-[8px] font-black px-1.5 py-0.5 rounded uppercase">
            {item.type}
          </span>
        )}
        <img
          src={`https://cfelainawanggy.pages.dev/?action=proxy&url=${encodeURIComponent(item.cover)}`}
          referrerPolicy="no-referrer"
          alt={item.title || 'Komik'}
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
      {genreLine && <p className="text-[10px] text-white/30 truncate -mt-1">{genreLine}</p>}
    </div>
  );
};

const FilterChip = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all select-none border ${
      active
        ? 'bg-[#d4a73c] text-[#0b0b10] border-[#d4a73c] shadow-md shadow-[#d4a73c]/30 font-black'
        : 'bg-white/[0.04] text-white/60 border-white/10 hover:border-white/20 hover:text-white'
    }`}
  >
    {children}
  </button>
);

const FilterSelect = ({ value, onChange, options, placeholder }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className="bg-[#12121a] border border-white/10 focus:border-[#d4a73c]/60 rounded-xl h-10 px-3.5 text-xs font-bold text-white outline-none transition-colors appearance-none cursor-pointer"
  >
    <option value="">{placeholder}</option>
    {options.map((opt) =>
      typeof opt === 'string' ? (
        <option key={opt} value={opt} className="bg-[#12121a] text-white">
          {opt}
        </option>
      ) : (
        <option key={opt.value} value={opt.value} className="bg-[#12121a] text-white">
          {opt.label}
        </option>
      )
    )}
  </select>
);

const KomikAll = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [genres, setGenres] = useState(() => searchParams.getAll('genre'));
  const [status, setStatus] = useState(() => searchParams.get('status') || '');
  const [type, setType] = useState(() => searchParams.get('type') || '');
  const [orderBy, setOrderBy] = useState(() => searchParams.get('order') || '');

  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [cursor, setCursor] = useState({ hasNext: false, hasPrev: false, nextCursor: null, prevCursor: null });

  useEffect(() => {
    setSeoMeta(
      'Katalog Komik Manga, Manhwa, Manhua Lengkap Sub Indo | Ndichan',
      'Cari dan baca semua komik Manga, Manhwa, dan Manhua subtitle Indonesia terlengkap. Filter berdasarkan genre, status ongoing/tamat, tipe, dan abjad.',
      '/img/welcomebanner.webp',
      `${SITE_URL}/komik/all`,
      {
        keywords: 'katalog komik, daftar komik, komik manga lengkap, komik manhwa sub indo, filter komik, ndichan',
        schema: {
          '@context': 'https://schema.org',
          '@graph': [
            getCollectionSchema({
              name: 'Katalog Komik Lengkap | Ndichan',
              description: 'Koleksi lengkap komik Manga, Manhwa, dan Manhua subtitle Indonesia di Ndichan.',
              url: `${SITE_URL}/komik/all`
            }),
            getBreadcrumbSchema([
              { name: 'Home', url: '/' },
              { name: 'Komik', url: '/komik' },
              { name: 'Katalog', url: '/komik/all' }
            ])
          ]
        }
      }
    );
  }, []);

  useEffect(() => {
    const next = new URLSearchParams();
    genres.forEach((g) => next.append('genre', g));
    if (status) next.set('status', status);
    if (type) next.set('type', type);
    if (orderBy) next.set('order', orderBy);
    setSearchParams(next, { replace: true });
  }, [genres, status, type, orderBy, setSearchParams]);

  const hasActiveFilter = genres.length > 0 || !!status || !!type || !!orderBy;

  const buildUrl = useCallback((after) => {
    const params = new URLSearchParams({ limit: String(LIMIT) });
    if (after) params.append('after', after);

    if (hasActiveFilter) {
      genres.forEach((g) => params.append('genres_slug', g));
      if (status) params.append('release_status', status);
      if (type) params.append('type_manga', type);
      if (orderBy) params.append('order_by', orderBy);
      return `/ndikagantengtobrutbanget/v1/manga/filter?${params.toString()}`;
    }
    return `/ndikagantengtobrutbanget/v1/manga/allcomics?${params.toString()}`;
  }, [genres, status, type, orderBy, hasActiveFilter]);

  const fetchPage = useCallback(async (after) => {
    const res = await fetch(buildUrl(after));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }, [buildUrl]);

  useEffect(() => {
    window.scrollTo(0, 0);
    let isMounted = true;
    setIsLoading(true);
    setError(false);

    fetchPage()
      .then((body) => {
        if (!isMounted) return;
        setItems(body?.data || []);
        setCursor(body?.cursor || { hasNext: false, hasPrev: false, nextCursor: null, prevCursor: null });
      })
      .catch(() => {
        if (!isMounted) return;
        setError(true);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => { isMounted = false; };
  }, [fetchPage]);

  const loadMore = async () => {
    if (!cursor.hasNext || !cursor.nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const body = await fetchPage(cursor.nextCursor);
      setItems((prev) => [...prev, ...(body?.data || [])]);
      setCursor(body?.cursor || { hasNext: false, hasPrev: false, nextCursor: null, prevCursor: null });
    } catch (e) {
      // silent
    } finally {
      setIsLoadingMore(false);
    }
  };

  const toggleGenre = (slug) => {
    setGenres((prev) => (prev.includes(slug) ? prev.filter((g) => g !== slug) : [...prev, slug]));
  };

  const resetFilters = () => {
    setGenres([]);
    setStatus('');
    setType('');
    setOrderBy('');
  };

  const goToDetail = (item) => navigate(`/komik/${item.slug}`);

  return (
    <div className="min-h-screen bg-[#09090d] font-nunito selection:bg-[#d4a73c] selection:text-black pb-28 text-white relative">
      <Navbar />

      <section className="max-w-7xl mx-auto px-4 md:px-6 pt-24">
        {/* Header */}
        <div className="flex flex-col mb-6">
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="w-1.5 h-6 rounded-full bg-gradient-to-b from-[#d4a73c] to-[#ff4e2d] shadow-sm shadow-[#d4a73c]/50"></span>
            <h1 className="font-display text-2xl md:text-4xl text-white uppercase tracking-wide">
              Semua Komik
            </h1>
          </div>
          <p className="text-xs md:text-sm text-white/50 pl-4 font-medium">
            Jelajahi dan filter seluruh koleksi manga, manhwa & manhua terlengkap
          </p>
        </div>

        {/* GENRE FILTER CHIPS */}
        <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2 mb-4">
          {GENRES.map((g) => (
            <FilterChip key={g.slug} active={genres.includes(g.slug)} onClick={() => toggleGenre(g.slug)}>
              {g.label}
            </FilterChip>
          ))}
        </div>

        {/* STATUS / TYPE / ORDER DROPDOWNS */}
        <div className="flex flex-wrap items-center gap-2.5 mb-8">
          <FilterSelect value={status} onChange={setStatus} options={STATUS_OPTIONS} placeholder="Semua Status" />
          <FilterSelect value={type} onChange={setType} options={TYPE_OPTIONS} placeholder="Semua Tipe" />
          <FilterSelect value={orderBy} onChange={setOrderBy} options={ORDER_OPTIONS} placeholder="Urutkan" />
          {hasActiveFilter && (
            <button
              onClick={resetFilters}
              className="px-3.5 py-2 text-xs font-bold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl transition-all flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>Reset Filter</span>
            </button>
          )}
        </div>

        {/* GRID */}
        {isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4 md:gap-5 mb-12">
            {[...Array(LIMIT > 24 ? 24 : LIMIT)].map((_, i) => <CardSkeleton key={i} />)}
          </div>
        )}

        {!isLoading && error && (
          <div className="flex flex-col items-center justify-center py-24 text-center px-6">
            <p className="text-white/60 font-bold text-sm">Gagal memuat daftar komik.</p>
            <p className="text-white/30 text-xs mt-1">Coba lagi beberapa saat lagi.</p>
          </div>
        )}

        {!isLoading && !error && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center px-6">
            <p className="text-white/40 font-bold text-sm">Tidak ada komik yang cocok dengan filter ini.</p>
            {hasActiveFilter && (
              <button onClick={resetFilters} className="mt-3 text-[#d4a73c] text-xs font-bold hover:underline">
                Reset filter
              </button>
            )}
          </div>
        )}

        {!isLoading && !error && items.length > 0 && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4 md:gap-5 mb-12">
              {items.map((item, i) => (
                <KomikCard key={item.slug || i} item={item} onClick={() => goToDetail(item)} />
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

export default KomikAll;
