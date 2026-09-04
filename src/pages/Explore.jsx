import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Shimmer } from '../components/SectionUI';
import { setSeoMeta, SITE_URL, getBreadcrumbSchema, getCollectionSchema } from '../utils/seo';

const CardSkeleton = () => (
  <div className="w-full flex flex-col gap-2.5">
    <div className="aspect-[3/4.4] bg-[#14141e] rounded-2xl border border-white/5 relative overflow-hidden">
      <Shimmer />
    </div>
    <div className="w-4/5 h-3 bg-white/5 rounded-md relative overflow-hidden"><Shimmer /></div>
  </div>
);

const PosterCard = ({ title, cover, badge, onClick, isProxy = true }) => {
  return (
    <div
      onClick={onClick}
      className="group w-full cursor-pointer active:scale-95 transition-all duration-300 flex flex-col gap-2 shrink-0 select-none"
    >
      <div className="relative aspect-[3/4.4] w-full rounded-xl md:rounded-2xl overflow-hidden bg-[#15151e] border border-white/[0.08] shadow-md group-hover:shadow-2xl group-hover:shadow-[#d4a73c]/15 group-hover:border-[#d4a73c]/40 transition-all duration-300">
        {badge && (
          <span className="absolute top-2 right-2 z-10 bg-[#d4a73c] text-[#0b0b10] text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wide shadow">
            {badge}
          </span>
        )}
        <img
          src={isProxy ? `https://cfelainawanggy.pages.dev/?action=proxy&url=${encodeURIComponent(cover)}` : cover}
          referrerPolicy="no-referrer"
          alt={title || 'Poster'}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
        />
        {/* Play Icon Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b10]/90 via-[#0b0b10]/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center pointer-events-none">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-[#d4a73c] text-[#0b0b10] flex items-center justify-center shadow-xl shadow-[#d4a73c]/50 transform scale-75 group-hover:scale-100 transition-transform duration-300">
            <svg className="w-5 h-5 fill-current translate-x-0.5" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </div>
      <h3 className="text-xs md:text-[13px] font-bold text-white/80 group-hover:text-[#d4a73c] line-clamp-2 leading-snug transition-colors pt-0.5">
        {title}
      </h3>
    </div>
  );
};

const UserResultCard = ({ user, onClick }) => (
  <div
    onClick={onClick}
    className="bg-[#12121a]/90 hover:bg-[#161622] border border-white/[0.08] hover:border-[#d4a73c]/40 rounded-2xl p-4 cursor-pointer transition-all duration-300 group shadow-md hover:shadow-xl hover:shadow-[#d4a73c]/10 active:scale-98"
  >
    <div className="flex items-center gap-4">
      <img
        src={user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=D4A73C&color=0B0B10&size=128`}
        alt={user.name}
        className="w-13 h-13 md:w-14 md:h-14 rounded-2xl object-cover border border-white/10 group-hover:scale-105 transition-transform shrink-0 shadow"
        referrerPolicy="no-referrer"
        onError={(e) => {
          e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=D4A73C&color=0B0B10&size=128`;
        }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-white font-bold text-sm md:text-base truncate group-hover:text-[#d4a73c] transition-colors">
            {user.name || 'Unknown'}
          </span>
          {user.isAdmin && (
            <span className="bg-[#ff4e2d] text-[#0b0b10] text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">
              Admin
            </span>
          )}
        </div>
        <span className="text-white/40 text-xs truncate block mt-0.5">{user.email || '-'}</span>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[#d4a73c] text-xs font-bold">Lv.{user.level || 0}</span>
          <span className="text-white/30 text-xs">•</span>
          <span className="text-white/50 text-xs truncate">{user.title || 'Anime Newbie'}</span>
        </div>
      </div>
    </div>
  </div>
);

const Pagination = ({ page, setPage, hasData }) => {
  if (page === 0 && !hasData) return null;
  const generatePages = () => {
    const pages = [];
    if (page > 1) {
      pages.push(0);
      if (page > 2) pages.push('...');
    }
    pages.push(Math.max(0, page - 1));
    if (page > 0) pages.push(page);
    pages.push(page + 1);
    pages.push('...');
    return [...new Set(pages)].sort((a, b) => {
      if (a === '...') return 1;
      if (b === '...') return -1;
      return a - b;
    });
  };

  const pages = generatePages();
  const handlePageChange = (newPage) => {
    if (newPage !== '...') {
      setPage(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="flex justify-center items-center gap-2 mt-12 mb-6 flex-wrap">
      <button
        onClick={() => handlePageChange(page - 1)}
        disabled={page === 0}
        className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.04] border border-white/10 text-white disabled:opacity-20 disabled:cursor-not-allowed hover:bg-[#d4a73c] hover:text-[#0b0b10] hover:border-[#d4a73c] transition-colors font-bold shadow-md"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      {pages.map((p, i) => (
        <button
          key={`${p}-${i}`}
          onClick={() => handlePageChange(p)}
          disabled={p === '...'}
          className={`min-w-[40px] h-10 px-2 rounded-xl flex items-center justify-center font-bold text-xs transition-all shadow-md ${
            p === page
              ? 'bg-[#d4a73c] border border-[#d4a73c] text-[#0b0b10] shadow-lg shadow-[#d4a73c]/30 font-black'
              : p === '...'
              ? 'bg-transparent text-white/30 cursor-default border-none'
              : 'bg-white/[0.04] border border-white/10 text-white/70 hover:bg-white/[0.09] hover:text-white'
          }`}
        >
          {p === '...' ? '...' : p + 1}
        </button>
      ))}
      <button
        onClick={() => handlePageChange(page + 1)}
        disabled={!hasData}
        className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.04] border border-white/10 text-white disabled:opacity-20 disabled:cursor-not-allowed hover:bg-[#d4a73c] hover:text-[#0b0b10] hover:border-[#d4a73c] transition-colors font-bold shadow-md"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
};

const TYPES = [
  { key: 'anime', label: 'Anime' },
  { key: 'komik', label: 'Komik' },
  { key: 'user', label: 'Pengguna' }
];

const Explore = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const type = searchParams.get('type') || 'anime';
  const query = searchParams.get('q') || '';

  const [inputValue, setInputValue] = useState(query);
  const [genres, setGenres] = useState([]);
  const [selectedGenres, setSelectedGenres] = useState([]);

  const [animeResults, setAnimeResults] = useState([]);
  const [animePage, setAnimePage] = useState(0);
  const [animeLoading, setAnimeLoading] = useState(false);

  const [komikResults, setKomikResults] = useState([]);
  const [komikLoading, setKomikLoading] = useState(false);

  const [userResults, setUserResults] = useState([]);
  const [userLoading, setUserLoading] = useState(false);
  const [userError, setUserError] = useState('');

  const debounceTimer = useRef(null);

  useEffect(() => {
    const metaTitle = query ? `Cari "${query}" | Ndichan` : 'Jelajahi Anime, Komik & Komunitas | Ndichan';
    setSeoMeta(
      metaTitle,
      'Cari anime subtitle Indonesia, baca komik terlengkap, atau temukan teman di komunitas Ndichan.',
      '/img/welcomebanner.webp',
      `${SITE_URL}/explore`,
      {
        keywords: 'cari anime, streaming anime, baca komik, komik sub indo, explore anime, ndichan'
      }
    );
  }, [query]);

  const setType = (newType) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('type', newType);
      return next;
    });
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputValue(val);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        if (val.trim()) next.set('q', val.trim());
        else next.delete('q');
        return next;
      });
    }, 450);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (inputValue.trim()) next.set('q', inputValue.trim());
      else next.delete('q');
      return next;
    });
  };

  useEffect(() => {
    fetch('/ndikagantengtobrutbanget/v1/genre')
      .then(r => r.json())
      .then(d => setGenres(d.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (type !== 'anime') return;
    let isMounted = true;
    const fetchAnime = async () => {
      setAnimeLoading(true);
      try {
        let url;
        if (query) {
          url = `/ndikagantengtobrutbanget/v1/search?q=${encodeURIComponent(query)}`;
        } else if (selectedGenres.length > 0) {
          const genreQuery = selectedGenres.map(id => `id=${encodeURIComponent(id)}`).join('&');
          url = `/ndikagantengtobrutbanget/v1/genre?${genreQuery}&page=${animePage}`;
        } else {
          url = `/ndikagantengtobrutbanget/v1/popular`;
        }
        const res = await fetch(url).then(r => r.json());
        if (isMounted) setAnimeResults(res.data || []);
      } catch (e) {
        if (isMounted) setAnimeResults([]);
      } finally {
        if (isMounted) setAnimeLoading(false);
      }
    };
    fetchAnime();
    return () => { isMounted = false; };
  }, [type, query, selectedGenres, animePage]);

  useEffect(() => {
    if (type !== 'komik') return;
    let isMounted = true;
    const fetchKomik = async () => {
      setKomikLoading(true);
      try {
        let url = query
          ? `/ndikagantengtobrutbanget/v1/manga/search?q=${encodeURIComponent(query)}`
          : `/ndikagantengtobrutbanget/v1/manga/allcomics?limit=30`;
        const res = await fetch(url).then(r => r.json());
        if (isMounted) setKomikResults(res.data || []);
      } catch (e) {
        if (isMounted) setKomikResults([]);
      } finally {
        if (isMounted) setKomikLoading(false);
      }
    };
    fetchKomik();
    return () => { isMounted = false; };
  }, [type, query]);

  useEffect(() => {
    if (type !== 'user') return;
    if (!query.trim()) {
      setUserResults([]);
      setUserError('');
      return;
    }
    let isMounted = true;
    (async () => {
      setUserLoading(true);
      setUserError('');
      try {
        const res = await fetch(`/api/v1/user/users?q=${encodeURIComponent(query)}`, { credentials: 'include' });
        const data = await res.json();
        if (!isMounted) return;
        if (res.ok) {
          setUserResults(data.users || []);
          if ((data.users || []).length === 0) setUserError('User tidak ditemukan');
        } else {
          setUserError(data.error || 'Gagal mencari user');
        }
      } catch (e) {
        if (isMounted) setUserError('Terjadi kesalahan saat mencari');
      } finally {
        if (isMounted) setUserLoading(false);
      }
    })();
    return () => { isMounted = false; };
  }, [type, query]);

  const toggleGenre = (id) => {
    setSelectedGenres(prev => (prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]));
  };

  const goToAnime = (a) => navigate(`/anime/${a.id}-${(a.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);
  const goToKomik = (k) => navigate(`/komik/${k.slug}`);
  const goToUser = (u) => navigate(`/user/${u.id}`);

  return (
    <div className="min-h-screen bg-[#09090d] font-nunito selection:bg-[#d4a73c] selection:text-black pb-28 text-white">
      <Navbar />

      <div className="pt-24 max-w-7xl mx-auto px-4 md:px-6">
        {/* Header */}
        <div className="flex flex-col mb-6">
          <div className="flex items-center gap-2.5 mb-1">
            <span className="w-1.5 h-6 rounded-full bg-gradient-to-b from-[#d4a73c] to-[#ff4e2d] shadow-sm shadow-[#d4a73c]/50"></span>
            <h1 className="font-display text-2xl md:text-4xl text-white uppercase tracking-wide">
              Jelajahi
            </h1>
          </div>
          <p className="text-xs md:text-sm text-white/50 pl-4 font-medium">
            Temukan anime, komik, atau profil user dalam satu pencarian praktis
          </p>
        </div>

        {/* TYPE TABS */}
        <div className="flex gap-2.5 mb-5">
          {TYPES.map(t => (
            <button
              key={t.key}
              onClick={() => setType(t.key)}
              className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all select-none ${
                type === t.key
                  ? 'bg-gradient-to-r from-[#d4a73c] to-[#ff4e2d] text-[#0b0b10] shadow-lg shadow-[#d4a73c]/25 scale-105'
                  : 'bg-[#12121a] text-white/50 hover:text-white border border-white/10 hover:border-white/20'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* SEARCH INPUT */}
        <form onSubmit={handleSubmit} className="mb-8">
          <div className="relative">
            <svg className="w-4 h-4 text-white/40 absolute left-4.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              placeholder={
                type === 'anime'
                  ? 'Cari judul anime (mis. Attack on Titan, Solo Leveling)...'
                  : type === 'komik'
                  ? 'Cari judul komik / manga...'
                  : 'Cari nama atau username pengguna...'
              }
              className="w-full bg-[#12121a]/90 border border-white/10 focus:border-[#d4a73c]/60 rounded-2xl h-13 md:h-14 pl-12 pr-10 text-xs md:text-sm font-bold text-white outline-none transition-colors placeholder-white/25 shadow-inner"
            />
            {inputValue && (
              <button
                type="button"
                onClick={() => {
                  setInputValue('');
                  setSearchParams(prev => {
                    const next = new URLSearchParams(prev);
                    next.delete('q');
                    return next;
                  });
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
              >
                <svg className="w-3.5 h-3.5 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </form>

        {/* ANIME TAB */}
        {type === 'anime' && (
          <>
            {!query && genres.length > 0 && (
              <div className="mb-8">
                <h2 className="text-white font-bold text-xs md:text-sm uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-4 rounded-full bg-[#d4a73c]"></span>
                  Filter Genre
                </h2>
                <div className="flex overflow-x-auto gap-2 pb-2 custom-scrollbar">
                  {genres.map(g => (
                    <button
                      key={g.id}
                      onClick={() => toggleGenre(g.id)}
                      className={`px-3.5 py-1.5 text-xs whitespace-nowrap font-bold rounded-xl transition-all ${
                        selectedGenres.includes(g.id)
                          ? 'bg-[#d4a73c] text-[#0b0b10] shadow-md shadow-[#d4a73c]/30 font-black'
                          : 'bg-white/[0.04] border border-white/10 text-white/60 hover:bg-white/[0.08] hover:text-white'
                      }`}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4 md:gap-5 mb-10">
              {animeLoading
                ? [...Array(18)].map((_, i) => <CardSkeleton key={`shimmer-${i}`} />)
                : animeResults.map((a) => (
                    <PosterCard
                      key={a.id}
                      title={a.title}
                      cover={a.image_poster}
                      badge={a.type}
                      onClick={() => goToAnime(a)}
                    />
                  ))}
            </div>

            {!animeLoading && animeResults.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <svg className="w-14 h-14 text-white/10 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.172 9.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-white/40 font-bold text-sm">Tidak ada anime yang ditemukan</p>
              </div>
            )}

            {(!query || animeResults.length > 0) && (
              <Pagination page={animePage} setPage={setAnimePage} hasData={animeResults.length > 0} />
            )}
          </>
        )}

        {/* KOMIK TAB */}
        {type === 'komik' && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4 md:gap-5 mb-10">
              {komikLoading
                ? [...Array(18)].map((_, i) => <CardSkeleton key={`shimmer-${i}`} />)
                : komikResults.map((k) => (
                    <PosterCard
                      key={k.slug}
                      title={k.title}
                      cover={k.cover}
                      badge={k.chapters?.[0]?.chapterNum ? `Ch. ${k.chapters[0].chapterNum}` : null}
                      onClick={() => goToKomik(k)}
                    />
                  ))}
            </div>

            {!komikLoading && komikResults.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <svg className="w-14 h-14 text-white/10 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.172 9.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-white/40 font-bold text-sm">Tidak ada komik yang ditemukan</p>
              </div>
            )}
          </>
        )}

        {/* USER TAB */}
        {type === 'user' && (
          <div className="mb-14">
            {userLoading ? (
              <div className="flex justify-center py-16">
                <div className="w-8 h-8 border-2 border-[#d4a73c]/20 border-t-[#d4a73c] rounded-full animate-spin"></div>
              </div>
            ) : userError ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <p className="text-white/40 font-bold text-sm">{userError}</p>
              </div>
            ) : userResults.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {userResults.map(u => (
                  <UserResultCard key={u.id} user={u} onClick={() => goToUser(u)} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <p className="text-white/40 font-bold text-sm">Ketik nama user untuk mulai mencari</p>
              </div>
            )}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default Explore;
