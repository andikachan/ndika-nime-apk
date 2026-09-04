import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Shimmer, CardSkeleton, AnimeCard } from '../components/SectionUI';
import { setSeoMeta, SITE_URL, getBreadcrumbSchema, getCollectionSchema } from '../utils/seo';

const Ongoing = () => {
  const navigate = useNavigate();
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setSeoMeta(
      'Anime Ongoing Sub Indo Terbaru Hari Ini | Ndichan',
      'Daftar anime ongoing musim ini subtitle Indonesia dengan jadwal update episode tercepat. Nonton streaming anime yang sedang tayang gratis kualitas HD di Ndichan.',
      '/img/welcomebanner.webp',
      `${SITE_URL}/ongoing`,
      {
        keywords: 'anime ongoing, anime ongoing sub indo, nonton anime ongoing, update anime terbaru, anime musim ini, ndichan',
        schema: {
          '@context': 'https://schema.org',
          '@graph': [
            getCollectionSchema({
              name: 'Anime Ongoing Sub Indo Terbaru | Ndichan',
              description: 'Daftar anime yang sedang tayang musim ini subtitle Indonesia di Ndichan.',
              url: `${SITE_URL}/ongoing`
            }),
            getBreadcrumbSchema([
              { name: 'Home', url: '/' },
              { name: 'Anime Ongoing', url: '/ongoing' }
            ])
          ]
        }
      }
    );
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    let isMounted = true;
    const fetchPage = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/ndikagantengtobrutbanget/v1/ongoing?page=0`).then(r => r.json());
        if (isMounted) setResults(res.data || []);
      } catch (e) {
        if (isMounted) setResults([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchPage();
    return () => { isMounted = false; };
  }, []);

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
                Anime Ongoing
              </h1>
              {!isLoading && (
                <span className="text-xs bg-[#d4a73c]/15 text-[#d4a73c] font-black px-2.5 py-0.5 rounded-full border border-[#d4a73c]/20">
                  {results.length} Judul
                </span>
              )}
            </div>
            <p className="text-xs md:text-sm text-white/50 pl-4 font-medium">
              Daftar anime yang sedang tayang musim ini & update episode setiap minggu
            </p>
          </div>

          {/* Quick Search */}
          <div className="w-full md:w-72 relative">
            <input
              type="text"
              placeholder="Cari ongoing..."
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

        {/* Grid of Anime */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4 md:gap-5 mb-14">
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
                  badgeText="ONGOING"
                />
              </div>
            ))
          ) : (
            <div className="col-span-full py-24 text-center">
              <p className="text-white/40 font-bold text-sm">Tidak ada anime yang cocok dengan "{searchQuery}"</p>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Ongoing;
