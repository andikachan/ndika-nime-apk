import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CardSkeleton, ScrollButton, SectionHeading } from './SectionUI';
import { useAuth } from '../context/AuthContext';

const IMG = (url) => `https://cfelainawanggy.pages.dev/?action=proxy&url=${url}`;

const slugify = (str = '') => str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Shuffle deterministik berdasarkan seed (dipakai buat "Hidden Gem Harian" —
// hasil sama sepanjang hari yang sama, ganti otomatis besoknya).
const seededShuffle = (array, seedStr) => {
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// Genre favorit dari history: hitung kemunculan tiap genre, ambil yang paling sering.
// Kalau seri, pilih random di antara yang teratas biar rekomendasi nggak monoton itu-itu terus.
const getFavoriteGenre = (history) => {
  const counts = {};
  history.forEach((item) => {
    if (!item.genre) return;
    item.genre.split(',').map((g) => g.trim()).filter(Boolean).forEach((g) => {
      const key = g.toLowerCase();
      counts[key] = (counts[key] || 0) + 1;
    });
  });
  const entries = Object.entries(counts);
  if (entries.length === 0) return null;
  const max = Math.max(...entries.map(([, c]) => c));
  const top = entries.filter(([, c]) => c === max).map(([name]) => name);
  return top[Math.floor(Math.random() * top.length)];
};

const PosterCard = ({ title, image, badge, subLabel, onClick, cardRef }) => (
  <div
    ref={cardRef}
    onClick={onClick}
    className="group min-w-[130px] sm:min-w-[150px] md:min-w-[170px] w-[130px] sm:w-[150px] md:w-[170px] cursor-pointer snap-start transition-all duration-300 active:scale-95 flex flex-col gap-2 shrink-0 select-none"
  >
    <div className="relative aspect-[3/4.4] rounded-xl md:rounded-2xl overflow-hidden bg-[#15151e] border border-white/[0.08] shadow-md group-hover:shadow-2xl group-hover:shadow-[#d4a73c]/15 group-hover:border-[#d4a73c]/40 transition-all duration-300">
      <img
        src={IMG(image)}
        referrerPolicy="no-referrer"
        alt={title}
        loading="lazy"
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
      />
      {badge && (
        <span className="absolute top-2 left-2 z-10 px-2 py-0.5 bg-[#d4a73c] text-[#0b0b10] text-[9px] font-black uppercase rounded-md tracking-wide shadow">
          {badge}
        </span>
      )}
      {subLabel && (
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-2.5 pt-4 pb-2 z-10">
          <span className="text-[10px] font-black text-white/95">{subLabel}</span>
        </div>
      )}
      {/* Play hover overlay */}
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

const ForYou = ({ ongoingPool = [], popularPool = [], isLoading = false }) => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const authChecked = !authLoading;
  const [history, setHistory] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [recGenreName, setRecGenreName] = useState(null);
  const [loadingRecs, setLoadingRecs] = useState(false);

  const continueRefs = useRef([]);
  const continueScrollRef = useRef(null);
  const recRefs = useRef([]);
  const recScrollRef = useRef(null);
  const gemRefs = useRef([]);
  const gemScrollRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    let isMounted = true;
    fetch('/api/v1/history', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((data) => { if (isMounted) setHistory(data.data || []); })
      .catch(() => {});
    return () => { isMounted = false; };
  }, [user]);

  // 2) "Lanjutkan Nonton" — history anime yang punya episode terakhir
  const continueWatching = useMemo(
    () => history.filter((h) => h.type === 'anime' && h.currentEpisode?.index).slice(0, 12),
    [history]
  );

  // 3) "Karena kamu suka {genre}" — genre favorit dari history -> cocokkan ke daftar genre -> fetch anime genre itu
  useEffect(() => {
    if (!user || history.length === 0) return;
    const favorite = getFavoriteGenre(history);
    if (!favorite) return;

    let isMounted = true;
    setLoadingRecs(true);

    const watchedIds = new Set(history.map((h) => String(h.animeId)));

    fetch('/ndikagantengtobrutbanget/v1/genre')
      .then((r) => r.json())
      .then(async (genreRes) => {
        const genres = genreRes.data || [];
        const match = genres.find((g) => (g.name || '').toLowerCase() === favorite);
        if (!match) return null;

        const animeRes = await fetch(`/ndikagantengtobrutbanget/v1/genre?id=${match.id}&page=0`).then((r) => r.json());
        return { genreName: match.name, items: animeRes.data || [] };
      })
      .then((result) => {
        if (!isMounted || !result) return;
        const filtered = result.items.filter((a) => !watchedIds.has(String(a.id))).slice(0, 12);
        setRecommended(filtered);
        setRecGenreName(result.genreName);
      })
      .catch(() => {})
      .finally(() => { if (isMounted) setLoadingRecs(false); });

    return () => { isMounted = false; };
  }, [user, history]);

  // 4) "Hidden Gem Hari Ini" — pick acak tapi stabil sepanjang hari dari gabungan pool ongoing+popular
  const hiddenGems = useMemo(() => {
    const pool = [...ongoingPool, ...popularPool];
    const seen = new Set();
    const unique = pool.filter((a) => {
      if (!a?.id || seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });
    if (unique.length === 0) return [];
    const todaySeed = new Date().toISOString().slice(0, 10);
    return seededShuffle(unique, todaySeed).slice(0, 10);
  }, [ongoingPool, popularPool]);

  // Animasi fade-in pas kartu masuk viewport, sama seperti section lain di Home
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.remove('opacity-0', 'blur-xl', 'translate-y-4');
            entry.target.classList.add('opacity-100', 'blur-none', 'translate-y-0');
          }
        });
      },
      { threshold: 0.1 }
    );
    [...continueRefs.current, ...recRefs.current, ...gemRefs.current].forEach((ref) => {
      if (ref) observer.observe(ref);
    });
    return () => observer.disconnect();
  }, [continueWatching, recommended, hiddenGems]);

  const scroll = (ref, direction) => {
    if (ref.current) {
      ref.current.scrollBy({ left: direction === 'left' ? -300 : 300, behavior: 'smooth' });
    }
  };

  const goToAnime = (id, title) => navigate(`/anime/${id}-${slugify(title)}`);

  const goToHistoryItem = (item) => {
    const isManga = item.type === 'manga';
    const slug = slugify(item.animeTitle);
    const path = isManga
      ? (item.currentChapter?.slug ? `/baca/${item.currentChapter.slug}` : `/komik/${item.animeId}`)
      : `/anime/${item.animeId}-${slug}/${item.currentEpisode?.index}`;
    navigate(path);
  };

  // Belum login, belum ada history relevan, dan belum ada hidden gem -> jangan render apa-apa
  if (authChecked && !user && hiddenGems.length === 0 && !isLoading) return null;

  return (
    <>
      {/* ===== LANJUTKAN NONTON ===== */}
      {user && continueWatching.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 mt-12 relative">
          <div className="flex items-center justify-between mb-4 px-2">
            <SectionHeading title="Lanjutkan Nonton" subtitle="Lanjut dari episode terakhirmu" onClick={() => navigate('/profile')} />
            <div className="flex gap-2">
              <ScrollButton direction="left" onClick={() => scroll(continueScrollRef, 'left')} />
              <ScrollButton direction="right" onClick={() => scroll(continueScrollRef, 'right')} />
            </div>
          </div>
          <div ref={continueScrollRef} className="flex overflow-x-auto gap-3 pb-4 custom-scrollbar snap-x px-2">
            {continueWatching.map((item, i) => (
              <PosterCard
                key={`${item.type}-${item.animeId}`}
                cardRef={(el) => (continueRefs.current[i] = el)}
                title={item.animeTitle}
                image={item.image_poster || item.image_cover}
                subLabel={`Eps ${item.currentEpisode?.index || '-'}`}
                onClick={() => goToHistoryItem(item)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ===== KARENA KAMU SUKA {GENRE} ===== */}
      {user && (loadingRecs || recommended.length > 0) && (
        <section className="max-w-7xl mx-auto px-6 mt-10 relative">
          <div className="flex items-center justify-between mb-4 px-2">
            <SectionHeading
              title={recGenreName ? `Karena Kamu Suka ${recGenreName}` : 'Rekomendasi Untukmu'}
              subtitle="Dipilih berdasarkan tontonanmu"
              onClick={() => navigate('/explore')}
            />
            <div className="flex gap-2">
              <ScrollButton direction="left" onClick={() => scroll(recScrollRef, 'left')} />
              <ScrollButton direction="right" onClick={() => scroll(recScrollRef, 'right')} />
            </div>
          </div>
          <div ref={recScrollRef} className="flex overflow-x-auto gap-3 pb-4 custom-scrollbar snap-x px-2">
            {loadingRecs
              ? [...Array(8)].map((_, i) => <CardSkeleton key={i} />)
              : recommended.map((a, i) => (
                  <PosterCard
                    key={a.id}
                    cardRef={(el) => (recRefs.current[i] = el)}
                    title={a.title}
                    image={a.image_poster}
                    onClick={() => goToAnime(a.id, a.title)}
                  />
                ))}
          </div>
        </section>
      )}

      {/* ===== HIDDEN GEM HARI INI ===== */}
      {(isLoading || hiddenGems.length > 0) && (
        <section className="max-w-7xl mx-auto px-6 mt-10 relative">
          <div className="flex items-center justify-between mb-4 px-2">
            <SectionHeading title="Hidden Gem Hari Ini" subtitle="Pilihan acak, ganti tiap hari — jangan sampai kelewat" onClick={() => navigate('/explore')} />
            <div className="flex gap-2">
              <ScrollButton direction="left" onClick={() => scroll(gemScrollRef, 'left')} />
              <ScrollButton direction="right" onClick={() => scroll(gemScrollRef, 'right')} />
            </div>
          </div>
          <div ref={gemScrollRef} className="flex overflow-x-auto gap-3 pb-4 custom-scrollbar snap-x px-2">
            {isLoading
              ? [...Array(8)].map((_, i) => <CardSkeleton key={i} />)
              : hiddenGems.map((a, i) => (
                  <PosterCard
                    key={a.id}
                    cardRef={(el) => (gemRefs.current[i] = el)}
                    title={a.title}
                    image={a.image_poster}
                    badge="PILIHAN"
                    onClick={() => goToAnime(a.id, a.title)}
                  />
                ))}
          </div>
        </section>
      )}
    </>
  );
};

export default ForYou;
