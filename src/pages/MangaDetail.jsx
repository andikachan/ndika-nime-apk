import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Shimmer } from '../components/SectionUI';
import { setSeoMeta, SITE_URL, getMangaSchema, getBreadcrumbSchema } from '../utils/seo';
import CommentSection from '../components/CommentSection';

const IMG_PROXY = (url) => `https://cfelainawanggy.pages.dev/?action=proxy&url=${encodeURIComponent(url)}`;

const slugifyGenre = (label) => (label || '').toLowerCase().trim().replace(/\s+/g, '-');

const timeAgo = (iso) => {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  const month = Math.floor(day / 30);
  if (month > 0) return `${month} bln lalu`;
  if (day > 0) return `${day} hr lalu`;
  if (hr > 0) return `${hr} jam lalu`;
  if (min > 0) return `${min} mnt lalu`;
  return 'baru saja';
};

const statusStyle = (status) => {
  const st = (status || '').toLowerCase();
  if (st === 'ongoing') return 'bg-[#d4a73c]/15 text-[#d4a73c] border-[#d4a73c]/30';
  if (st === 'completed' || st === 'tamat') return 'bg-emerald-400/15 text-emerald-400 border-emerald-400/30';
  return 'bg-white/5 text-white/60 border-white/10';
};

const InfoRow = ({ label, value }) => (
  <div className="flex flex-col">
    <span className="text-[10px] font-black uppercase tracking-wider text-white/40">{label}</span>
    <span className="text-xs font-bold text-white/80 mt-0.5 truncate">{value}</span>
  </div>
);

const DetailSkeleton = () => (
  <div className="max-w-7xl mx-auto px-4 md:px-6 pt-24 md:pt-32">
    <div className="flex flex-col md:flex-row gap-6 md:gap-10">
      <div className="w-44 md:w-60 aspect-[3/4.4] bg-[#14141e] rounded-2xl border border-white/5 relative overflow-hidden shrink-0 mx-auto md:mx-0">
        <Shimmer />
      </div>
      <div className="flex-1 flex flex-col gap-3.5 pt-2">
        <div className="w-2/3 h-10 bg-white/5 rounded-xl relative overflow-hidden"><Shimmer /></div>
        <div className="w-1/3 h-5 bg-white/5 rounded-lg relative overflow-hidden"><Shimmer /></div>
        <div className="w-full h-24 bg-white/5 rounded-xl relative overflow-hidden mt-2"><Shimmer /></div>
        <div className="w-48 h-12 bg-white/5 rounded-xl relative overflow-hidden mt-2"><Shimmer /></div>
      </div>
    </div>
  </div>
);

const ScrollButton = ({ direction, onClick }) => (
  <button
    onClick={onClick}
    className="w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center bg-white/[0.04] hover:bg-[#d4a73c] text-white/50 hover:text-[#0b0b10] border border-white/10 hover:border-[#d4a73c] transition-all shadow-md active:scale-95"
  >
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d={direction === 'left' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'} />
    </svg>
  </button>
);

const MangaDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [manga, setManga] = useState(null);
  const [related, setRelated] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [chapterQuery, setChapterQuery] = useState('');
  const [sortAsc, setSortAsc] = useState(false);

  const relatedScrollRef = useRef(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    let isMounted = true;
    const fetchDetail = async () => {
      setIsLoading(true);
      setManga(null);
      try {
        const res = await fetch(`/ndikagantengtobrutbanget/v1/manga/detail?slug=${encodeURIComponent(slug)}`).then(r => r.json());
        if (!isMounted) return;
        setManga(res.data || null);
        setRelated(res.related || []);
      } catch (e) {
        if (isMounted) { setManga(null); setRelated([]); }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchDetail();
    return () => { isMounted = false; };
  }, [slug]);

  useEffect(() => {
    if (!manga) return;
    const title = `${manga.title || 'Komik'} Sub Indo - Baca Online Gratis | Ndichan`;
    const desc = manga.sinopsis
      ? manga.sinopsis.substring(0, 160) + '...'
      : `Baca komik ${manga.title} subtitle Indonesia lengkap online gratis di Ndichan.`;
    const image = manga.cover ? IMG_PROXY(manga.cover) : '/img/welcomebanner.webp';
    const pageUrl = `${SITE_URL}/komik/${slug}`;

    setSeoMeta(title, desc, image, pageUrl, {
      keywords: `baca komik ${manga.title}, komik ${manga.title} sub indo, manga ${manga.title}, ${manga.genre ? manga.genre.join(', ') : ''}, ndichan`,
      schema: {
        '@context': 'https://schema.org',
        '@graph': [
          getMangaSchema({
            name: manga.title,
            description: manga.sinopsis,
            image: image,
            url: pageUrl,
            genre: manga.genre,
            status: manga.status,
            author: manga.author,
          }),
          getBreadcrumbSchema([
            { name: 'Home', url: '/' },
            { name: 'Komik', url: '/komik' },
            { name: manga.title, url: pageUrl }
          ])
        ]
      }
    });
  }, [manga, slug]);

  const goToChapter = (chapterSlug) => navigate(`/baca/${chapterSlug}`);
  const goToGenre = (g) => navigate(`/komik/genre/${slugifyGenre(g)}`);

  const scroll = (ref, dir) => {
    if (!ref.current) return;
    ref.current.scrollBy({ left: dir === 'left' ? -350 : 350, behavior: 'smooth' });
  };

  const chapters = manga?.chapters || [];
  const sortedChapters = [...chapters].sort((a, b) => {
    const numA = parseFloat(a.chapterNum) || 0;
    const numB = parseFloat(b.chapterNum) || 0;
    return sortAsc ? numA - numB : numB - numA;
  });

  const filteredChapters = sortedChapters.filter(c =>
    (c.chapterNum || '').toLowerCase().includes(chapterQuery.trim().toLowerCase())
  );

  const firstChapter = chapters[chapters.length - 1];
  const latestChapter = chapters[0];

  return (
    <div className="min-h-screen bg-[#09090d] font-nunito selection:bg-[#d4a73c] selection:text-black pb-28 text-white relative">
      <Navbar />

      {isLoading ? (
        <DetailSkeleton />
      ) : manga ? (
        <>
          {/* HERO BACKDROP & HEADER */}
          <section className="relative w-full overflow-hidden">
            <div className="absolute inset-0">
              <img
                src={IMG_PROXY(manga.big_cover || manga.cover)}
                referrerPolicy="no-referrer"
                alt={`${manga.title} Background`}
                className="w-full h-full object-cover opacity-25 blur-md scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-[#09090d]/60 via-[#09090d]/90 to-[#09090d]" />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 pt-24 md:pt-32 pb-8">
              <div className="flex flex-col md:flex-row gap-6 md:gap-10">
                {/* Poster Card */}
                <div className="relative w-44 md:w-60 aspect-[3/4.4] rounded-2xl overflow-hidden shrink-0 mx-auto md:mx-0 shadow-2xl border border-white/10">
                  {manga.badge && (
                    <span className="absolute top-2.5 left-2.5 z-10 bg-[#d4a73c] text-[#0b0b10] text-[10px] font-black px-2.5 py-0.5 rounded-md uppercase tracking-wider shadow">
                      {manga.badge}
                    </span>
                  )}
                  <img
                    src={IMG_PROXY(manga.cover)}
                    referrerPolicy="no-referrer"
                    alt={`${manga.title} Cover`}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Metadata */}
                <div className="flex-1 flex flex-col gap-3 text-center md:text-left">
                  <div className="flex flex-wrap items-center gap-2 justify-center md:justify-start">
                    {manga.status && (
                      <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full border ${statusStyle(manga.status)}`}>
                        {manga.status}
                      </span>
                    )}
                    {manga.rating && (
                      <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full border border-white/10 bg-white/5 text-[#d4a73c] flex items-center gap-1.5">
                        <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                        <span>{manga.rating}</span>
                      </span>
                    )}
                    {manga.published && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border border-white/10 bg-white/5 text-white/60">
                        {manga.published}
                      </span>
                    )}
                  </div>

                  <h1 className="font-display text-2xl md:text-4xl lg:text-5xl text-white font-black tracking-wide leading-tight">
                    {manga.title}
                  </h1>

                  {/* Genres */}
                  <div className="flex flex-wrap gap-1.5 justify-center md:justify-start">
                    {(manga.genre || []).map((g) => (
                      <button
                        key={g}
                        onClick={() => goToGenre(g)}
                        className="text-xs font-bold text-white/60 hover:text-[#d4a73c] bg-white/[0.04] hover:bg-[#d4a73c]/10 border border-white/10 hover:border-[#d4a73c]/30 px-3 py-1 rounded-xl transition-all"
                      >
                        {g}
                      </button>
                    ))}
                  </div>

                  {/* Synopsis */}
                  <p className="text-white/60 text-xs md:text-sm leading-relaxed max-w-2xl mx-auto md:mx-0">
                    {manga.sinopsis || 'Tidak ada sinopsis yang tersedia.'}
                  </p>

                  {/* Info details */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-md mx-auto md:mx-0 mt-2 text-left bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                    {manga.author && <InfoRow label="Author" value={manga.author} />}
                    {manga.artist && <InfoRow label="Artist" value={manga.artist} />}
                    {manga.serialization && <InfoRow label="Serialisasi" value={manga.serialization} />}
                  </div>

                  {/* Read CTAs */}
                  <div className="flex flex-wrap gap-3 justify-center md:justify-start mt-3">
                    {latestChapter && (
                      <button
                        onClick={() => goToChapter(latestChapter.slug)}
                        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#d4a73c] to-[#ff4e2d] text-[#0b0b10] font-black text-xs md:text-sm flex items-center gap-2 shadow-lg shadow-[#d4a73c]/30 hover:brightness-110 active:scale-95 transition-all"
                      >
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                          <path d="M4 4h16v2H4V4zm0 5h16v11H4V9zm2 2v7h12v-7H6z" />
                        </svg>
                        <span>Baca Ch. {latestChapter.chapterNum}</span>
                      </button>
                    )}
                    {firstChapter && firstChapter.slug !== latestChapter?.slug && (
                      <button
                        onClick={() => goToChapter(firstChapter.slug)}
                        className="px-5 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/10 border border-white/10 text-white font-bold text-xs md:text-sm flex items-center gap-2 transition-all active:scale-95"
                      >
                        <span>Mulai dari Ch. {firstChapter.chapterNum}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* CHAPTER LIST */}
          <section className="max-w-7xl mx-auto px-4 md:px-6 mt-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-5 rounded-full bg-[#d4a73c]"></span>
                <h2 className="font-display text-xl md:text-2xl text-white uppercase tracking-wide">
                  Daftar Chapter
                </h2>
                <span className="text-xs bg-white/10 text-white/70 font-bold px-2 py-0.5 rounded-md">
                  {chapters.length}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  value={chapterQuery}
                  onChange={(e) => setChapterQuery(e.target.value)}
                  placeholder="Cari chapter..."
                  className="h-10 px-4 bg-white/[0.04] border border-white/10 rounded-xl text-xs text-white placeholder-white/30 outline-none focus:border-[#d4a73c]/60 w-36 sm:w-48 transition-colors"
                />
                <button
                  onClick={() => setSortAsc(prev => !prev)}
                  className="h-10 px-4 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-xl text-xs font-bold text-white/70 flex items-center gap-1.5 shrink-0 transition-colors"
                >
                  <span>{sortAsc ? 'Terlama' : 'Terbaru'}</span>
                  <svg className={`w-3.5 h-3.5 transition-transform ${sortAsc ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
              {filteredChapters.length === 0 ? (
                <p className="text-white/40 text-xs col-span-full py-10 text-center font-bold">
                  Tidak ada chapter yang cocok dengan "{chapterQuery}".
                </p>
              ) : (
                filteredChapters.map((c) => (
                  <div
                    key={c.slug}
                    onClick={() => goToChapter(c.slug)}
                    className="group cursor-pointer flex items-center justify-between px-4 py-3 rounded-xl border border-white/[0.06] bg-[#12121a] hover:bg-[#181824] hover:border-[#d4a73c]/40 transition-all shadow-sm active:scale-98"
                  >
                    <span className="text-xs md:text-sm font-bold text-white group-hover:text-[#d4a73c] transition-colors">
                      Chapter {c.chapterNum}
                    </span>
                    <span className="text-[10px] text-white/35 font-medium">
                      {timeAgo(c.time)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* COMMENTS */}
          <section className="max-w-7xl mx-auto px-4 md:px-6 mt-12">
            <div className="bg-[#12121a]/90 rounded-2xl border border-white/10 p-4 md:p-6 shadow-xl">
              <CommentSection type="manga" targetId={slug} title="Komentar & Diskusi Komik" />
            </div>
          </section>

          {/* RELATED MANGA */}
          {related.length > 0 && (
            <section className="max-w-7xl mx-auto px-4 md:px-6 mt-14">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-5 rounded-full bg-gradient-to-b from-[#d4a73c] to-[#ff4e2d]"></span>
                  <h2 className="font-display text-xl text-white uppercase tracking-wide">
                    Rekomendasi Serupa
                  </h2>
                </div>
                <div className="flex gap-2">
                  <ScrollButton direction="left" onClick={() => scroll(relatedScrollRef, 'left')} />
                  <ScrollButton direction="right" onClick={() => scroll(relatedScrollRef, 'right')} />
                </div>
              </div>

              <div ref={relatedScrollRef} className="flex overflow-x-auto gap-3.5 sm:gap-4 md:gap-5 pb-4 custom-scrollbar snap-x">
                {related.map((m) => (
                  <div
                    key={m.slug}
                    onClick={() => navigate(`/komik/${m.slug}`)}
                    className="group min-w-[130px] sm:min-w-[150px] md:min-w-[170px] w-[130px] sm:w-[150px] md:w-[170px] cursor-pointer snap-start transition-all duration-300 active:scale-95 flex flex-col gap-2 shrink-0 select-none"
                  >
                    <div className="relative aspect-[3/4.4] w-full rounded-2xl overflow-hidden bg-[#15151e] border border-white/[0.08] shadow-md group-hover:shadow-2xl group-hover:shadow-[#d4a73c]/15 group-hover:border-[#d4a73c]/40 transition-all duration-300">
                      {m.badge && (
                        <span className="absolute top-2 left-2 z-10 bg-[#d4a73c] text-[#0b0b10] text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wide shadow">
                          {m.badge}
                        </span>
                      )}
                      {m.chapters?.[0] && (
                        <span className="absolute bottom-2 right-2 z-10 bg-[#09090e]/85 backdrop-blur-md text-white text-[9px] font-bold px-2 py-0.5 rounded-md border border-white/10">
                          Ch. {m.chapters[0].chapterNum}
                        </span>
                      )}
                      <img
                        src={IMG_PROXY(m.cover)}
                        referrerPolicy="no-referrer"
                        alt={m.title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                      />
                    </div>
                    <h3 className="text-xs md:text-[13px] font-bold text-white/80 group-hover:text-[#d4a73c] line-clamp-2 leading-snug transition-colors pt-0.5">
                      {m.title}
                    </h3>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <div className="py-32 text-center">
          <p className="text-white/40 text-sm font-bold">Komik tidak ditemukan.</p>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default MangaDetail;
