import React, { useState, useEffect, useRef } from 'react';
import { X, Search, Loader2, Clapperboard, BookOpen } from 'lucide-react';

const IMG_PROXY = (url) => `https://cfelainawanggy.pages.dev/?action=proxy&url=${encodeURIComponent(url)}`;

const slugifyTitle = (title) => (title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');

// Modal buat milih anime/komik yang mau di-share ke chat. onSelect dipanggil
// dengan { kind, slug, title, cover, episode } lalu modal langsung ditutup
// dari parent (DirectMessage.jsx) setelah attach ke composer.
const ShareToChatModal = ({ onClose, onSelect }) => {
  const [tab, setTab] = useState('anime'); // 'anime' | 'komik'
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    clearTimeout(timeoutRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    timeoutRef.current = setTimeout(async () => {
      try {
        const url = tab === 'anime'
          ? `/ndikagantengtobrutbanget/v1/search?q=${encodeURIComponent(query.trim())}`
          : `/ndikagantengtobrutbanget/v1/manga/search?q=${encodeURIComponent(query.trim())}`;
        const res = await fetch(url).then((r) => r.json());
        setResults(res.data || []);
      } catch (error) {
        console.error('Share search error:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(timeoutRef.current);
  }, [query, tab]);

  const handlePick = (item) => {
    if (tab === 'anime') {
      onSelect({
        kind: 'anime',
        slug: `${item.id}-${slugifyTitle(item.title)}`,
        title: item.title,
        cover: item.image_poster || null
      });
    } else {
      onSelect({
        kind: 'komik',
        slug: item.slug,
        title: item.title,
        cover: item.cover || null
      });
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full md:w-[440px] max-h-[75vh] bg-[#181820] border border-white/10 rounded-t-2xl md:rounded-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <h3 className="text-white font-black text-sm">Share ke Chat</h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10">
            <X className="w-4 h-4 text-white/50" />
          </button>
        </div>

        <div className="flex gap-2 p-3 border-b border-white/5">
          <button
            onClick={() => { setTab('anime'); setResults([]); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-colors ${tab === 'anime' ? 'bg-[#d4a73c] text-[#0b0b10]' : 'bg-white/5 text-white/50'}`}
          >
            <Clapperboard className="w-3.5 h-3.5" /> Anime
          </button>
          <button
            onClick={() => { setTab('komik'); setResults([]); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-colors ${tab === 'komik' ? 'bg-[#d4a73c] text-[#0b0b10]' : 'bg-white/5 text-white/50'}`}
          >
            <BookOpen className="w-3.5 h-3.5" /> Komik
          </button>
        </div>

        <div className="p-3">
          <div className="relative">
            <Search className="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tab === 'anime' ? 'Cari judul anime...' : 'Cari judul komik...'}
              className="w-full bg-[#0b0b10] border border-white/10 rounded-full pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#d4a73c]/50"
            />
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-2 pb-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 text-white/30 animate-spin" />
            </div>
          ) : query.trim().length < 2 ? (
            <p className="text-center text-white/25 text-xs py-8">Ketik minimal 2 huruf buat cari</p>
          ) : results.length === 0 ? (
            <p className="text-center text-white/25 text-xs py-8">Gak ada hasil ditemukan</p>
          ) : (
            results.map((item) => (
              <button
                key={tab === 'anime' ? item.id : item.slug}
                onClick={() => handlePick(item)}
                className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors text-left"
              >
                <img
                  src={IMG_PROXY(tab === 'anime' ? item.image_poster : item.cover)}
                  referrerPolicy="no-referrer"
                  className="w-10 aspect-[3/4.5] object-cover rounded-md shrink-0"
                  alt={item.title}
                />
                <div className="min-w-0">
                  <p className="text-white font-bold text-xs line-clamp-1">{item.title}</p>
                  <p className="text-white/40 text-[10px] font-bold mt-0.5">
                    {tab === 'anime' ? `${item.type || ''} · ${item.status || ''}` : (item.rating && item.rating !== '0' ? `⭐ ${item.rating}` : '')}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ShareToChatModal;
