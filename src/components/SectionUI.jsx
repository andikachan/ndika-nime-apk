import React from 'react';

export const Shimmer = () => (
  <div
    className="absolute top-0 bottom-0 left-0 w-[150%] animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent z-10 pointer-events-none"
    style={{ transform: 'translate3d(-100%, 0, 0) skewX(-20deg)' }}
  />
);

export const CardSkeleton = () => (
  <div className="min-w-[130px] sm:min-w-[150px] md:min-w-[170px] w-[130px] sm:w-[150px] md:w-[170px] flex flex-col gap-2.5 relative shrink-0">
    <div className="aspect-[3/4.4] bg-[#161620] rounded-xl border border-white/5 relative overflow-hidden shadow-md">
      <Shimmer />
    </div>
    <div className="w-4/5 h-3 bg-[#181824] rounded-md relative overflow-hidden"><Shimmer /></div>
    <div className="w-2/5 h-2.5 bg-[#181824] rounded-md relative overflow-hidden"><Shimmer /></div>
  </div>
);

export const ScrollButton = ({ direction, onClick }) => (
  <button
    onClick={onClick}
    aria-label={direction === 'left' ? 'Geser ke kiri' : 'Geser ke kanan'}
    className="scroll-btn shadow-lg hover:shadow-[#d4a73c]/20"
  >
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d={direction === 'left' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'} />
    </svg>
  </button>
);

export const SectionHeading = ({ title, subtitle, onClick }) => (
  <div className="flex flex-col cursor-pointer group select-none" onClick={onClick}>
    <div className="flex items-center gap-2.5">
      <span className="w-1.5 h-6 rounded-full bg-gradient-to-b from-[#d4a73c] to-[#ff4e2d] shadow-sm shadow-[#d4a73c]/50"></span>
      <h2 className="font-display text-xl sm:text-2xl md:text-3xl text-white tracking-wide leading-none group-hover:text-[#d4a73c] transition-colors">
        {title}
      </h2>
      <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-[#d4a73c]">
        <span className="text-[11px] font-bold hidden sm:inline">Lihat Semua</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
    {subtitle && (
      <span className="text-[11px] md:text-xs text-white/40 mt-1 pl-4 font-medium tracking-normal">
        {subtitle}
      </span>
    )}
  </div>
);

export const AnimeCard = ({
  anime,
  onClick,
  refProp,
  badgeText,
  rating,
  episodeText
}) => {
  if (!anime) return null;
  const poster = anime.image_poster || anime.image_cover || anime.cover || '';
  const title = anime.title || 'Anime';
  const displayRating = rating || anime.rating || anime.score;
  const ep = episodeText || (anime.episode ? `EP ${anime.episode}` : null);
  const badge = badgeText || (anime.type ? anime.type.toUpperCase() : 'SUB INDO');

  return (
    <div
      ref={refProp}
      onClick={onClick}
      className="group min-w-[130px] sm:min-w-[150px] md:min-w-[170px] w-[130px] sm:w-[150px] md:w-[170px] cursor-pointer snap-start transition-all duration-300 active:scale-95 flex flex-col gap-2 shrink-0 select-none"
    >
      <div className="relative aspect-[3/4.4] rounded-xl md:rounded-2xl overflow-hidden bg-[#15151e] border border-white/[0.08] shadow-md group-hover:shadow-2xl group-hover:shadow-[#d4a73c]/15 group-hover:border-[#d4a73c]/40 transition-all duration-300">
        <img
          src={`https://cfelainawanggy.pages.dev/?action=proxy&url=${encodeURIComponent(poster)}`}
          referrerPolicy="no-referrer"
          alt={title}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
        />

        {/* Top Badges */}
        <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-1 z-10 pointer-events-none">
          {displayRating && displayRating !== '0' ? (
            <div className="flex items-center gap-1 bg-black/75 backdrop-blur-md px-1.5 py-0.5 rounded-md border border-white/10 text-[#d4a73c] text-[10px] font-black shadow">
              <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                <path d="M12 .587l3.668 7.431 8.2 1.192-5.934 5.782 1.4 8.163L12 19.771l-7.334 3.384 1.4-8.163L.132 9.21l8.2-1.192z" />
              </svg>
              <span>{displayRating}</span>
            </div>
          ) : <div />}

          {ep && (
            <span className="bg-[#d4a73c] text-[#0b0b10] text-[9px] font-black px-1.5 py-0.5 rounded-md shadow-md uppercase tracking-tight">
              {ep}
            </span>
          )}
        </div>

        {/* Bottom Tag */}
        <div className="absolute bottom-2 left-2 z-10 pointer-events-none">
          <span className="bg-black/80 backdrop-blur-md text-white/90 text-[8px] font-black px-1.5 py-0.5 rounded border border-white/10 tracking-wider">
            {badge}
          </span>
        </div>

        {/* Hover Overlay with Glowing Play Icon */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b10]/90 via-[#0b0b10]/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-[#d4a73c] text-[#0b0b10] flex items-center justify-center shadow-xl shadow-[#d4a73c]/50 transform scale-75 group-hover:scale-100 transition-transform duration-300">
            <svg className="w-5 h-5 fill-current translate-x-0.5" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Title */}
      <h3 className="text-xs md:text-[13px] font-bold text-white/80 group-hover:text-[#d4a73c] line-clamp-2 leading-snug transition-colors pt-0.5">
        {title}
      </h3>
    </div>
  );
};
