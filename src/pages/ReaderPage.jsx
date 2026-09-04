import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { setSeoMeta, SITE_URL, getChapterSchema, getBreadcrumbSchema } from '../utils/seo';
import CommentSection from '../components/CommentSection';
import QuickReactions from '../components/QuickReactions';

const IMG_PROXY = (url) => `https://cfelainawanggy.pages.dev/?action=proxy&url=${encodeURIComponent(url)}`;

// ======================
// HISTORY PUSH (manga)
// ======================
const stripChapterSuffix = (slug = '') =>
  slug.replace(/-chapter-[\w.]+$/i, '');

const pushToHistory = async (chapterData, slug) => {
  try {
    const mangaSlug = stripChapterSuffix(chapterData.slug_manga || '');

    let detail = null;
    try {
      const detailRes = await fetch(
        `/ndikagantengtobrutbanget/v1/manga/detail?slug=${encodeURIComponent(mangaSlug)}`
      ).then((r) => r.json());
      if (detailRes?.success && detailRes?.data) {
        detail = detailRes.data;
      }
    } catch (e) {
      console.warn('Gagal ambil detail manga:', e);
    }

    await fetch('/api/v1/history', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'manga',
        animeId: chapterData.slug_manga,
        title:
          detail?.title ||
          (chapterData.title?.replace(/chapter.*$/i, '').trim() || '') ||
          mangaSlug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        image_cover: detail?.cover || chapterData.cover || null,
        image_poster: detail?.cover || chapterData.cover || null,
        status: detail?.status || null,
        genre: Array.isArray(detail?.genre) ? detail.genre.join(', ') : (detail?.genre || null),
        currentChapter: {
          chapter: chapterData.chapter,
          slug, 
        },
      }),
    });
  } catch (e) {
    console.warn('Gagal simpan history:', e);
  }
};

const Shimmer = () => (
  <div
    className="absolute top-0 bottom-0 left-0 w-[150%] animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent z-0"
    style={{ transform: 'translate3d(-100%, 0, 0) skewX(-20deg)' }}
  />
);

const PageImage = ({ src, index }) => {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const handleRetry = (e) => {
    e.stopPropagation();
    setFailed(false);
    setLoaded(false);
    setRetryKey(prev => prev + 1);
  };

  return (
    <div className="relative w-full bg-[#141419] min-h-[350px] flex items-center justify-center overflow-hidden">
      {!loaded && !failed && <Shimmer />}
      
      {failed ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-white/50 z-20">
          <svg className="w-8 h-8 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <span className="text-xs font-bold uppercase tracking-widest">Halaman {index + 1} gagal dimuat</span>
          <button
            onClick={handleRetry}
            className="mt-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
          >
            Coba Lagi
          </button>
        </div>
      ) : (
        <img
          key={retryKey}
          src={IMG_PROXY(src)}
          referrerPolicy="no-referrer"
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          onContextMenu={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
          /* FIX FATAL: Semua class transition, opacity, filter dibuang total. 
             Murni gambar polosan agar GPU di Android WebView gak crash / blank hitam pas ngerender manhwa yg super panjang */
          className="relative z-10 w-full h-auto block select-none"
          style={{ 
            WebkitUserDrag: 'none',
            WebkitTouchCallout: 'none'
          }}
          alt={`Halaman ${index + 1}`}
        />
      )}
    </div>
  );
};

const ChapterSheet = ({ open, onClose, chapters, currentSlug, onSelect }) => {
  const [query, setQuery] = useState('');
  const filtered = chapters.filter(c => c.chapter.toString().toLowerCase().includes(query.trim().toLowerCase()));

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center md:justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full md:w-[420px] md:rounded-2xl bg-[#181820] border-t md:border border-[#2a2a35] rounded-t-2xl max-h-[75vh] flex flex-col pb-[env(safe-area-inset-bottom)]"
      >
        <div className="px-4 pt-4 pb-3 border-b border-white/5 flex items-center justify-between gap-3">
          <h3 className="text-sm font-black text-white uppercase tracking-tight">Pilih Chapter</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-4 py-3">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nomor chapter..."
            className="w-full h-10 px-4 bg-white/5 border border-[#2a2a35] chip-cut text-sm text-white placeholder-white/30 outline-none focus:border-[#ff4e2d]/60 transition-colors"
          />
        </div>
        <div className="overflow-y-auto custom-scrollbar px-4 pb-4 flex-1">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
            {filtered.map((c) => (
              <button
                key={c.slug}
                onClick={() => onSelect(c.slug)}
                className={`h-11 rounded-lg text-sm font-bold border transition-colors ${
                  c.slug === currentSlug
                    ? 'bg-[#d4a73c] text-[#141419] border-[#d4a73c]'
                    : 'bg-white/5 text-white/70 border-white/10 hover:border-[#d4a73c]/40 hover:text-[#d4a73c] active:bg-white/10'
                }`}
              >
                {c.chapter}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="col-span-full text-center text-white/30 text-xs py-8">Tidak ada chapter yang cocok.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ReaderPage = () => {
  const { chapterSlug } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  
  const [showBars, setShowBars] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [musicOn, setMusicOn] = useState(false);
  
  const lastScrollY = useRef(0);
  const audioRef = useRef(null);

  const [fullChapterList, setFullChapterList] = useState([]);
  const [fullChapterListSlug, setFullChapterListSlug] = useState(null);

  // FIX INJEKSI PAKSA: Pastikan WebView tidak bisa mengecil (shrink)
  useEffect(() => {
    let metaViewport = document.querySelector('meta[name="viewport"]');
    const content = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, shrink-to-fit=no";
    if (metaViewport) {
      metaViewport.setAttribute('content', content);
    } else {
      metaViewport = document.createElement('meta');
      metaViewport.name = "viewport";
      metaViewport.content = content;
      document.head.appendChild(metaViewport);
    }
  }, []);

  useEffect(() => {
    if (!data?.slug_manga) return;
    const mangaSlug = stripChapterSuffix(data.slug_manga);
    if (mangaSlug === fullChapterListSlug) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/ndikagantengtobrutbanget/v1/manga/detail?slug=${encodeURIComponent(mangaSlug)}`
        ).then((r) => r.json());
        if (cancelled) return;
        const list = Array.isArray(res?.data?.chapters) ? res.data.chapters : [];
        setFullChapterList(list.map((c) => ({ slug: c.slug, chapter: c.chapterNum })));
        setFullChapterListSlug(mangaSlug);
      } catch (e) {
        console.warn('Gagal ambil daftar chapter lengkap:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [data?.slug_manga, fullChapterListSlug]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    let isMounted = true;
    const fetchChapter = async () => {
      setIsLoading(true);
      setError(false);
      setData(null);
      try {
        const res = await fetch(`/ndikagantengtobrutbanget/v1/manga/read?slug=${encodeURIComponent(chapterSlug)}`).then(r => r.json());
        if (!isMounted) return;
        if (!res.success || !res.data) { setError(true); return; }
        setData(res.data);
        pushToHistory(res.data, chapterSlug);
      } catch (e) {
        if (isMounted) setError(true);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchChapter();
    return () => { isMounted = false; };
  }, [chapterSlug]);

  useEffect(() => {
    if (!data) return;
    const cleanTitle = (data.title || '').trim();
    const mangaSlug = stripChapterSuffix(data.slug_manga || '');
    const mangaName = cleanTitle.replace(/chapter.*$/i, '').trim() || mangaSlug.replace(/-/g, ' ');
    const pageTitle = `Baca ${mangaName} Chapter ${data.chapter || ''} Sub Indo | Ndichan`;
    const pageDesc = `Baca komik online ${mangaName} Chapter ${data.chapter || ''} subtitle Indonesia gratis kualitas jernih HD tanpa iklan di Ndichan.`;
    const shareImg = data.cover ? IMG_PROXY(data.cover) : null;
    const canonicalUrl = `${SITE_URL}/baca/${chapterSlug}`;

    setSeoMeta(
      pageTitle,
      pageDesc,
      shareImg,
      canonicalUrl,
      {
        keywords: `baca ${mangaName} chapter ${data.chapter}, komik ${mangaName} chapter ${data.chapter}, ${mangaName} ch ${data.chapter} sub indo, baca komik, ndichan`,
        type: 'article',
        schema: {
          '@context': 'https://schema.org',
          '@graph': [
            getChapterSchema({
              title: cleanTitle || `${mangaName} Chapter ${data.chapter}`,
              mangaTitle: mangaName,
              chapterNum: data.chapter,
              url: canonicalUrl,
              image: shareImg,
              seriesUrl: `${SITE_URL}/komik/${mangaSlug}`
            }),
            getBreadcrumbSchema([
              { name: 'Home', url: '/' },
              { name: 'Komik', url: '/komik' },
              { name: mangaName, url: `/komik/${mangaSlug}` },
              { name: `Chapter ${data.chapter}`, url: `/baca/${chapterSlug}` }
            ])
          ]
        }
      }
    );
  }, [data, chapterSlug]);

  useEffect(() => {
    if (data?.background_music_url && audioRef.current) {
      audioRef.current.play().then(() => {
        setMusicOn(true);
      }).catch((err) => {
        console.warn('Browser memblokir autoplay audio:', err);
        setMusicOn(false); 
      });
    }
  }, [data?.background_music_url]);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (y <= 0) { 
        setShowBars(true); 
        lastScrollY.current = y; 
        return; 
      }
      if (y < 80) { 
        setShowBars(true); 
        lastScrollY.current = y; 
        return; 
      }
      
      if (y > lastScrollY.current + 15) {
        setShowBars(false);
        lastScrollY.current = y;
      } else if (y < lastScrollY.current - 15) {
        setShowBars(true);
        lastScrollY.current = y;
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const currentMangaSlug = data?.slug_manga ? stripChapterSuffix(data.slug_manga) : null;
  const chapters = (fullChapterListSlug === currentMangaSlug && fullChapterList.length > 0)
    ? fullChapterList
    : (data?.other_chapters || []);
    
  const currentIndex = chapters.findIndex(c => c.slug === chapterSlug);
  const nextChapter = currentIndex > 0 ? chapters[currentIndex - 1] : null;
  const prevChapter = currentIndex >= 0 && currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null;

  const goToChapter = useCallback((slug) => {
    setSheetOpen(false);
    setShowBars(true);
    navigate(`/baca/${slug}`);
  }, [navigate]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight' && nextChapter) {
        goToChapter(nextChapter.slug);
      } else if (e.key === 'ArrowLeft' && prevChapter) {
        goToChapter(prevChapter.slug);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextChapter, prevChapter, goToChapter]);

  const toggleMusic = () => {
    if (!audioRef.current) return;
    if (musicOn) { 
      audioRef.current.pause(); 
    } else { 
      audioRef.current.play().catch(() => {}); 
    }
    setMusicOn(m => !m);
  };

  const handleToggleBars = () => setShowBars(prev => !prev);

  if (error) {
    return (
      <div className="min-h-screen bg-[#0b0b10] text-white flex flex-col items-center justify-center gap-3 px-6 text-center font-nunito">
        <h2 className="font-display text-2xl uppercase tracking-wide text-[#ff4e2d]">Chapter tidak ditemukan</h2>
        <p className="text-white/40 text-sm">Slug "{chapterSlug}" tidak valid atau sudah dihapus.</p>
        <button onClick={() => navigate(-1)} className="mt-4 h-11 px-8 bg-white/10 hover:bg-white/20 rounded-md font-bold text-xs uppercase transition-colors">
          Kembali
        </button>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen bg-[#0b0b10] font-nunito text-white relative w-screen min-w-[100vw] max-w-[100vw] overflow-x-hidden"
      style={{ touchAction: 'pan-y', overscrollBehaviorX: 'none' }}
    >
      <style>{`
        @keyframes shimmer { 0% { transform: translate3d(-100%, 0, 0) skewX(-20deg); } 100% { transform: translate3d(200%, 0, 0) skewX(-20deg); } }
        
        /* FIX EXTRA AMAN UNTUK UKURAN LAYAR */
        html, body { 
          background-color: #0b0b10 !important; 
          color: white; 
          margin: 0; 
          padding: 0;
          width: 100vw !important;
          max-width: 100vw !important;
          overflow-x: hidden !important;
        }
        
        body { font-family: 'Nunito', sans-serif; }
        
        * { 
          -webkit-tap-highlight-color: transparent; 
        }

        .custom-scrollbar::-webkit-scrollbar { height: 4px; width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 10px; }
        .reader-bar { transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
      `}</style>

      {data?.background_music_url && (
        <audio ref={audioRef} src={data.background_music_url} loop />
      )}

      {/* TOP BAR */}
      <div className={`reader-bar fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/95 via-black/80 to-transparent px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-8 flex items-center gap-3 ${showBars ? 'translate-y-0' : '-translate-y-full'}`}>
        <button
          onClick={() => navigate(data ? `/komik/${data.slug_manga}` : -1)}
          className="w-10 h-10 shrink-0 chip-cut bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:text-[#ff4e2d] active:bg-white/10 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="min-w-0 flex-1 px-1">
          {isLoading ? (
            <div className="h-4 w-48 bg-white/10 rounded relative overflow-hidden"><Shimmer /></div>
          ) : (
            <>
              <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest truncate">{data?.title?.replace(/chapter.*$/i, '').trim()}</p>
              <h1 className="font-mono-ui text-base font-bold text-white truncate leading-tight mt-0.5">Chapter {data?.chapter}</h1>
            </>
          )}
        </div>
        {data?.background_music_url && (
          <button onClick={toggleMusic} className="w-10 h-10 shrink-0 chip-cut bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:text-[#ff4e2d] active:bg-white/10 transition-colors">
            {musicOn ? (
              <svg className="w-5 h-5 text-[#ff4e2d]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.5A.75.75 0 013.75 15v-6a.75.75 0 01.75-.75h2.25z" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.5A.75.75 0 013.75 15v-6a.75.75 0 01.75-.75h2.25z" /></svg>
            )}
          </button>
        )}
      </div>

      {/* PAGES WRAPPER */}
      <div className="pt-0 pb-32 max-w-3xl mx-auto flex flex-col w-full overflow-hidden">
        {isLoading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="w-full aspect-[2/3] bg-[#141419] relative overflow-hidden"><Shimmer /></div>
          ))
        ) : (
          <>
            <div 
              className="flex flex-col w-full cursor-pointer" 
              onClick={handleToggleBars}
            >
              {(data?.pages || []).map((src, i) => <PageImage key={i} src={src} index={i} />)}
            </div>

            <div className="px-6 py-12 flex flex-col items-center gap-4 text-center mt-4">
              <div className="w-12 h-1 bg-white/10 rounded-full mb-2" />
              <p className="text-white/40 text-xs font-bold uppercase tracking-widest">Akhir dari Chapter {data?.chapter}</p>

              <div className="mt-2 w-full max-w-sm">
                <QuickReactions type="chapter" targetId={chapterSlug} label="Gimana chapter ini?" />
              </div>

              {nextChapter ? (
                <button
                  onClick={() => goToChapter(nextChapter.slug)}
                  className="mt-4 h-14 px-8 w-full max-w-xs bg-[#ff4e2d] active:bg-[#e6432a] active:scale-[0.98] transition-transform text-[#0b0b10] btn-cut font-black tracking-wider text-sm flex items-center justify-center gap-2"
                >
                  Lanjut Chapter {nextChapter.chapter}
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </button>
              ) : (
                <div className="mt-4 px-6 py-4 bg-white/5 border border-white/10 rounded-lg text-white/50 text-xs font-bold w-full max-w-xs">
                  Kamu sudah mentok. Ini chapter paling baru.
                </div>
              )}
            </div>

            <div className="px-4 md:px-6 pb-8">
              <CommentSection type="chapter" targetId={chapterSlug} title="Komentar Chapter" />
            </div>
          </>
        )}
      </div>

      {/* BOTTOM BAR */}
      <div className={`reader-bar fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-black/95 via-black/80 to-transparent px-4 pt-8 pb-[calc(1.25rem+env(safe-area-inset-bottom))] flex items-center justify-center gap-3 ${showBars ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="max-w-md w-full flex items-center gap-2">
          <button
            disabled={!prevChapter}
            onClick={() => prevChapter && goToChapter(prevChapter.slug)}
            className="h-12 px-4 chip-cut bg-black/60 backdrop-blur-md border border-white/10 text-white/80 disabled:opacity-30 disabled:cursor-not-allowed hover:text-[#ff4e2d] active:bg-white/10 flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wide shrink-0 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            Prev
          </button>

          <button
            onClick={() => setSheetOpen(true)}
            className="flex-1 h-12 chip-cut bg-[#d4a73c]/10 backdrop-blur-md border border-[#d4a73c]/40 text-[#d4a73c] text-sm font-black flex items-center justify-center gap-2 active:bg-[#d4a73c]/20 transition-colors"
          >
            Ch. {data?.chapter || '...'}
            <svg className="w-4 h-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16m-7 6h7" /></svg>
          </button>

          <button
            disabled={!nextChapter}
            onClick={() => nextChapter && goToChapter(nextChapter.slug)}
            className="h-12 px-4 chip-cut bg-black/60 backdrop-blur-md border border-white/10 text-white/80 disabled:opacity-30 disabled:cursor-not-allowed hover:text-[#ff4e2d] active:bg-white/10 flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wide shrink-0 transition-colors"
          >
            Next
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>

      <ChapterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        chapters={chapters}
        currentSlug={chapterSlug}
        onSelect={goToChapter}
      />
    </div>
  );
};

export default ReaderPage;
