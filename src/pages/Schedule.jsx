import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Shimmer } from '../components/SectionUI';
import { setSeoMeta, SITE_URL, getBreadcrumbSchema } from '../utils/seo';

const ScheduleSkeleton = () => (
  <div className="flex flex-col gap-4">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="h-28 bg-[#12121a] rounded-2xl border border-white/5 relative overflow-hidden p-4 flex gap-4">
        <Shimmer />
        <div className="w-16 h-full bg-white/5 rounded-xl shrink-0" />
        <div className="flex-1 flex flex-col gap-2.5 pt-1">
          <div className="w-24 h-3 bg-white/5 rounded" />
          <div className="w-3/4 h-5 bg-white/5 rounded" />
          <div className="w-1/2 h-3 bg-white/5 rounded" />
        </div>
      </div>
    ))}
  </div>
);

const ScheduleCard = ({ a, onClick }) => {
  const timeText = a.key_time ? a.key_time.split(' ')[1]?.substring(0, 5) : a.time || '--:--';

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer relative bg-[#12121a]/90 hover:bg-[#161624] border border-white/[0.08] hover:border-[#d4a73c]/40 rounded-2xl p-4 md:p-5 flex items-center gap-4 md:gap-5 transition-all duration-300 shadow-md hover:shadow-2xl hover:shadow-[#d4a73c]/10 active:scale-[0.99] select-none"
    >
      {/* Poster */}
      <div className="relative w-16 md:w-20 aspect-[3/4.2] rounded-xl overflow-hidden bg-black/40 border border-white/10 shrink-0 shadow-md">
        <img
          src={`https://cfelainawanggy.pages.dev/?action=proxy&url=${encodeURIComponent(a.image_poster)}`}
          referrerPolicy="no-referrer"
          alt={a.title || 'Anime Poster'}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      </div>

      {/* Info */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Release Time & Type */}
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span className="bg-[#d4a73c]/15 text-[#d4a73c] text-[10px] font-black px-2.5 py-0.5 rounded-md border border-[#d4a73c]/20 uppercase">
            {timeText} WIB
          </span>
          <span className="bg-white/10 text-white/70 text-[9px] font-bold px-2 py-0.5 rounded uppercase">
            {a.type || 'TV'}
          </span>
          {a.status && (
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
              &bull; {a.status}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="font-bold text-sm md:text-base text-white group-hover:text-[#d4a73c] transition-colors line-clamp-1">
          {a.title}
        </h3>

        {/* Genres */}
        {a.genre && (
          <p className="text-xs text-white/40 line-clamp-1 mt-1 font-medium">
            {a.genre.replace(/,/g, ', ')}
          </p>
        )}
      </div>

      {/* Play button indicator */}
      <div className="w-10 h-10 rounded-full bg-white/[0.04] group-hover:bg-[#d4a73c] text-white/60 group-hover:text-[#0b0b10] border border-white/10 group-hover:border-[#d4a73c] flex items-center justify-center shrink-0 transition-all shadow-sm">
        <svg className="w-4 h-4 fill-current translate-x-0.5" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
      </div>
    </div>
  );
};

const Schedule = () => {
  const navigate = useNavigate();
  const [schedule, setSchedule] = useState(window.__NDICHAN_CACHE__?.schedule || {});
  const [isLoading, setIsLoading] = useState(!window.__NDICHAN_CACHE__);

  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const dayKeys = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];

  const [weekDates, setWeekDates] = useState([]);
  const [selectedDay, setSelectedDay] = useState('');

  useEffect(() => {
    setSeoMeta(
      'Jadwal Rilis Anime Lengkap Mingguan (Senin-Minggu) | Ndichan',
      'Jadwal tayang anime musim ini dari Senin sampai Minggu terlengkap dengan jam rilis WIB. Cek jadwal update episode anime favoritmu di Ndichan.',
      '/img/welcomebanner.webp',
      `${SITE_URL}/schedule`,
      {
        keywords: 'jadwal anime, jadwal rilis anime, jadwal tayang anime, jadwal anime mingguan, update anime hari ini, ndichan',
        schema: {
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'WebPage',
              name: 'Jadwal Rilis Anime Mingguan | Ndichan',
              description: 'Jadwal tayang anime mingguan subtitle Indonesia terlengkap di Ndichan.',
              url: `${SITE_URL}/schedule`
            },
            getBreadcrumbSchema([
              { name: 'Home', url: '/' },
              { name: 'Jadwal Anime', url: '/schedule' }
            ])
          ]
        }
      }
    );
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    const today = new Date();
    const currentDayIndex = today.getDay();
    const dates = dayNames.map((name, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - currentDayIndex + i);
      return {
        name,
        date: d.getDate(),
        key: dayKeys[i],
        isToday: i === currentDayIndex
      };
    });
    setWeekDates(dates);
    setSelectedDay(dayKeys[currentDayIndex]);

    if (window.__NDICHAN_CACHE__) return;

    let isMounted = true;
    const fetchSchedule = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/ndikagantengtobrutbanget/v1/schedule').then(r => r.json());
        if (isMounted) setSchedule(res.data || {});
      } catch (e) {
        // silent
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchSchedule();
    return () => { isMounted = false; };
  }, []);

  const currentList = schedule[selectedDay] || [];

  return (
    <div className="min-h-screen bg-[#09090d] font-nunito selection:bg-[#d4a73c] selection:text-black pb-28 text-white">
      <Navbar />

      <div className="pt-24 max-w-4xl mx-auto px-4 md:px-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-[#d4a73c]/15 text-[#d4a73c] text-xs font-black px-3.5 py-1 rounded-full border border-[#d4a73c]/20 uppercase tracking-widest mb-2 shadow-sm">
            Update Setiap Hari
          </div>
          <h1 className="font-display text-3xl md:text-5xl text-white uppercase tracking-wide">
            Jadwal Rilis Anime
          </h1>
          <p className="text-xs md:text-sm text-white/50 mt-1.5 font-medium">
            Waktu tayang penayangan episode anime ongoing subtitle Indonesia
          </p>
        </div>

        {/* Day Selector Tabs */}
        <div className="flex overflow-x-auto gap-2.5 pb-4 mb-8 custom-scrollbar justify-start sm:justify-center">
          {weekDates.map(w => {
            const isSelected = selectedDay === w.key;
            return (
              <button
                key={w.key}
                onClick={() => setSelectedDay(w.key)}
                className={`flex flex-col items-center py-2.5 px-4 rounded-2xl transition-all duration-200 shrink-0 border select-none ${
                  isSelected
                    ? 'bg-gradient-to-b from-[#d4a73c] to-[#ff4e2d] text-[#0b0b10] border-transparent shadow-xl shadow-[#d4a73c]/25 scale-105 font-black'
                    : 'bg-[#12121a]/90 hover:bg-[#181824] text-white/60 hover:text-white border-white/10 font-bold'
                }`}
              >
                <span className="text-[11px] uppercase tracking-wider">{w.name}</span>
                <span className="text-base md:text-lg font-black mt-0.5">{w.date}</span>
                {w.isToday && (
                  <span className={`text-[8px] uppercase tracking-widest mt-0.5 ${isSelected ? 'text-[#0b0b10]/75 font-black' : 'text-[#d4a73c]'}`}>
                    HARI INI
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Schedule List */}
        <div className="flex flex-col gap-3.5 mb-14">
          {isLoading ? (
            <ScheduleSkeleton />
          ) : currentList.length > 0 ? (
            currentList.map((a, index) => (
              <ScheduleCard
                key={`${a.id}-${index}`}
                a={a}
                onClick={() =>
                  navigate(`/anime/${a.id}-${(a.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, {
                    state: { latestEp: true }
                  })
                }
              />
            ))
          ) : (
            <div className="py-24 rounded-2xl bg-[#12121a]/50 border border-white/5 flex flex-col items-center justify-center text-center">
              <svg className="w-12 h-12 text-white/10 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-white/40 text-sm font-bold">Tidak ada anime yang dijadwalkan tayang hari ini</p>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Schedule;
