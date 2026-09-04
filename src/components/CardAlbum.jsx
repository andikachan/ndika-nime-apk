import React, { useState, useEffect, useMemo } from 'react';
import HoloCard from './HoloCard';
import { CARDS_DATABASE, RARITY_CONFIG, ELEMENTS, calculateCardCP } from '../utils/cardsData';
import {
  Sparkles,
  Search,
  Filter,
  CheckCircle2,
  Lock,
  Swords,
  Shield,
  Star,
  Layers,
  Award,
  ChevronRight,
  X
} from 'lucide-react';

const CardAlbum = ({ onShowcaseUpdated }) => {
  const [collection, setCollection] = useState([]);
  const [deckIds, setDeckIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [rarityFilter, setRarityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'OWNED' | 'LOCKED'
  const [selectedCard, setSelectedCard] = useState(null);
  const [savingDeck, setSavingDeck] = useState(false);
  const [toast, setToast] = useState('');

  const fetchCollection = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/gacha/collection', { credentials: 'include' });
      const data = await res.json();
      if (res.ok && data.success) {
        setCollection(data.collection || []);
        setDeckIds(data.deckIds || []);
      }
    } catch (e) {
      console.error('Fetch collection error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCollection();
  }, []);

  // Hitung statistik koleksi
  const stats = useMemo(() => {
    const totalCards = CARDS_DATABASE.length;
    const ownedCards = collection.filter((c) => c.isUnlocked);
    const ownedCount = ownedCards.length;
    const progressPct = Math.round((ownedCount / totalCards) * 100);

    const totalCP = ownedCards.reduce((acc, c) => acc + calculateCardCP(c, c.stars || 1), 0);

    const rarityCounts = {
      UR: { owned: ownedCards.filter((c) => c.rarity === 'UR').length, total: CARDS_DATABASE.filter((c) => c.rarity === 'UR').length },
      SSR: { owned: ownedCards.filter((c) => c.rarity === 'SSR').length, total: CARDS_DATABASE.filter((c) => c.rarity === 'SSR').length },
      SR: { owned: ownedCards.filter((c) => c.rarity === 'SR').length, total: CARDS_DATABASE.filter((c) => c.rarity === 'SR').length },
      R: { owned: ownedCards.filter((c) => c.rarity === 'R').length, total: CARDS_DATABASE.filter((c) => c.rarity === 'R').length },
      C: { owned: ownedCards.filter((c) => c.rarity === 'C').length, total: CARDS_DATABASE.filter((c) => c.rarity === 'C').length }
    };

    return { totalCards, ownedCount, progressPct, totalCP, rarityCounts };
  }, [collection]);

  // Filter kartu
  const filteredCards = useMemo(() => {
    const source = collection.length > 0 ? collection : CARDS_DATABASE.map((c) => ({ ...c, isUnlocked: false }));

    return source.filter((card) => {
      // Filter Rarity
      if (rarityFilter !== 'ALL' && card.rarity !== rarityFilter) return false;

      // Filter Status
      if (statusFilter === 'OWNED' && !card.isUnlocked) return false;
      if (statusFilter === 'LOCKED' && card.isUnlocked) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = card.name.toLowerCase().includes(q);
        const matchAnime = card.anime.toLowerCase().includes(q);
        const matchElement = card.element.toLowerCase().includes(q);
        if (!matchName && !matchAnime && !matchElement) return false;
      }

      return true;
    });
  }, [collection, rarityFilter, statusFilter, searchQuery]);

  // Toggle kartu masuk/keluar dari showcase deck
  const handleToggleDeck = async (cardId) => {
    if (savingDeck) return;
    setSavingDeck(true);

    let nextDeck = [...deckIds];
    if (nextDeck.includes(cardId)) {
      nextDeck = nextDeck.filter((id) => id !== cardId);
    } else {
      if (nextDeck.length >= 3) {
        setToast('Maksimal 3 kartu dalam showcase profile deck!');
        setTimeout(() => setToast(''), 3000);
        setSavingDeck(false);
        return;
      }
      nextDeck.push(cardId);
    }

    try {
      const res = await fetch('/api/v1/gacha/deck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ cardIds: nextDeck })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDeckIds(nextDeck);
        setToast(data.message || 'Showcase deck berhasil diperbarui!');
        setTimeout(() => setToast(''), 3000);
        onShowcaseUpdated?.(nextDeck);
      } else {
        setToast(data.error || 'Gagal mengubah showcase deck');
        setTimeout(() => setToast(''), 3000);
      }
    } catch (e) {
      console.error('Update deck error:', e);
    } finally {
      setSavingDeck(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className="p-3 bg-[#d4a73c]/15 border border-[#d4a73c]/30 rounded-xl flex items-center gap-2 animate-[fadeIn_0.15s_ease-out]">
          <Sparkles className="w-4 h-4 text-[#d4a73c] shrink-0" />
          <p className="text-[#d4a73c] font-bold text-xs">{toast}</p>
        </div>
      )}

      {/* Header Stat Banner */}
      <div className="bg-[#14141d] border border-white/10 rounded-2xl p-5 md:p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#d4a73c]/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Layers className="w-5 h-5 text-[#d4a73c]" />
              <h3 className="text-white font-black text-lg md:text-xl">
                Album & Koleksi Kartu Anime
              </h3>
            </div>
            <p className="text-white/40 text-xs md:text-sm">
              Koleksi seluruh karakter anime legendaris dan pamerkan di Profil Anda.
            </p>
          </div>

          {/* Combat Power & Completion Badges */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="bg-[#1b1b26] border border-white/10 rounded-xl px-4 py-2.5 text-center">
              <span className="text-white/40 text-[10px] uppercase font-mono-ui font-bold">
                Total Koleksi
              </span>
              <p className="text-white font-black text-base">
                {stats.ownedCount} <span className="text-white/30 text-xs">/ {stats.totalCards}</span>
              </p>
            </div>

            <div className="bg-[#1b1b26] border border-[#d4a73c]/30 rounded-xl px-4 py-2.5 text-center">
              <span className="text-[#d4a73c] text-[10px] uppercase font-mono-ui font-bold flex items-center gap-1 justify-center">
                <Sparkles className="w-3 h-3" /> Total CP
              </span>
              <p className="text-[#d4a73c] font-black text-base">
                {stats.totalCP.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-5 space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-white/50 font-bold">Progress Kelengkapan Binder</span>
            <span className="text-[#d4a73c] font-black">{stats.progressPct}%</span>
          </div>
          <div className="w-full h-2.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
            <div
              className="h-full bg-gradient-to-r from-[#d4a73c] via-[#ff4e2d] to-[#ff2a70] rounded-full transition-all duration-500"
              style={{ width: `${stats.progressPct}%` }}
            />
          </div>
        </div>

        {/* Rarity breakdown pills */}
        <div className="grid grid-cols-5 gap-2 mt-5 pt-4 border-t border-white/5">
          {Object.entries(stats.rarityCounts).map(([rarity, count]) => {
            const config = RARITY_CONFIG[rarity];
            return (
              <div key={rarity} className="text-center p-2 rounded-lg bg-black/30 border border-white/5">
                <span className="text-[10px] font-black" style={{ color: config.color }}>
                  {rarity}
                </span>
                <p className="text-white font-bold text-xs mt-0.5">
                  {count.owned}/{count.total}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="w-full md:w-72 relative">
          <Search className="w-4 h-4 text-white/30 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari karakter, anime, elemen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#14141d] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-white/30 focus:border-[#d4a73c] outline-none transition-colors"
          />
        </div>

        {/* Rarity Tabs */}
        <div className="w-full md:w-auto flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1">
          {['ALL', 'UR', 'SSR', 'SR', 'R', 'C'].map((r) => (
            <button
              key={r}
              onClick={() => setRarityFilter(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all shrink-0 ${
                rarityFilter === r
                  ? 'bg-[#d4a73c] text-[#0b0b10] shadow-md shadow-[#d4a73c]/20'
                  : 'bg-[#14141d] border border-white/5 text-white/50 hover:text-white hover:border-white/20'
              }`}
            >
              {r === 'ALL' ? 'Semua' : r}
            </button>
          ))}
        </div>

        {/* Status Filter */}
        <div className="w-full md:w-auto flex items-center gap-1">
          {[
            ['ALL', 'Semua'],
            ['OWNED', 'Dimiliki'],
            ['LOCKED', 'Terkunci']
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                statusFilter === key
                  ? 'bg-white/15 text-white border border-white/20'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Card Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="w-full aspect-[3/4.4] bg-[#14141d] rounded-2xl animate-pulse border border-white/5" />
          ))}
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="bg-[#14141d] border border-white/5 rounded-2xl p-12 text-center">
          <p className="text-white/40 text-sm font-medium">Tidak ada kartu yang cocok dengan pencarian.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 justify-items-center">
          {filteredCards.map((card) => {
            const isDeck = deckIds.includes(card.id);
            return (
              <div key={card.id} className="relative flex flex-col items-center">
                <HoloCard
                  card={card}
                  stars={card.stars || 1}
                  isUnlocked={card.isUnlocked}
                  size="md"
                  onClick={() => setSelectedCard(card)}
                  badge={
                    isDeck ? (
                      <span className="px-2 py-0.5 rounded-full bg-[#d4a73c] text-[#0b0b10] text-[9px] font-black tracking-wider uppercase shadow-md shadow-[#d4a73c]/30">
                        SHOWCASE
                      </span>
                    ) : card.count > 1 ? (
                      <span className="px-1.5 py-0.5 rounded-full bg-black/70 border border-white/20 text-white/80 text-[9px] font-bold">
                        x{card.count}
                      </span>
                    ) : null
                  }
                />
              </div>
            );
          })}
        </div>
      )}

      {/* ===== CARD DETAIL MODAL ===== */}
      {selectedCard && (
        <div
          className="fixed inset-0 z-[110] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-[fadeIn_0.15s_ease-out]"
          onClick={() => setSelectedCard(null)}
        >
          <div
            className="w-full max-w-2xl bg-[#14141e] border border-white/10 rounded-2xl p-6 relative flex flex-col md:flex-row gap-6 items-center my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedCard(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors z-20"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Left: 3D Holographic Card View */}
            <div className="shrink-0">
              <HoloCard
                card={selectedCard}
                stars={selectedCard.stars || 1}
                isUnlocked={selectedCard.isUnlocked}
                size="lg"
              />
            </div>

            {/* Right: Card Info, Lore, Stats & Deck Button */}
            <div className="flex-1 min-w-0 space-y-4 w-full">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-md text-xs font-black uppercase ${
                      RARITY_CONFIG[selectedCard.rarity]?.badgeBg
                    }`}
                  >
                    {selectedCard.rarity}
                  </span>
                  <span className="text-white/40 text-xs font-bold uppercase tracking-wider">
                    {selectedCard.anime}
                  </span>
                </div>

                <h3 className="text-white font-black text-xl md:text-2xl mt-1.5">
                  {selectedCard.name}
                </h3>
                {selectedCard.subtitle && (
                  <p className="text-[#d4a73c] text-xs font-semibold mt-0.5">
                    {selectedCard.subtitle}
                  </p>
                )}
              </div>

              {/* Quote */}
              <div className="p-3 bg-black/40 border-l-2 border-[#d4a73c] rounded-r-lg">
                <p className="text-white/70 text-xs italic">
                  "{selectedCard.quote}"
                </p>
              </div>

              {/* Description / Lore */}
              <p className="text-white/50 text-xs leading-relaxed">
                {selectedCard.description}
              </p>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5">
                <div className="p-2 bg-white/5 rounded-lg text-center">
                  <span className="text-red-400 text-[10px] font-bold flex items-center justify-center gap-1">
                    <Swords className="w-3 h-3" /> ATK
                  </span>
                  <p className="text-white font-black text-sm mt-0.5">{selectedCard.atk}</p>
                </div>
                <div className="p-2 bg-white/5 rounded-lg text-center">
                  <span className="text-blue-400 text-[10px] font-bold flex items-center justify-center gap-1">
                    <Shield className="w-3 h-3" /> DEF
                  </span>
                  <p className="text-white font-black text-sm mt-0.5">{selectedCard.def}</p>
                </div>
                <div className="p-2 bg-[#d4a73c]/10 border border-[#d4a73c]/20 rounded-lg text-center">
                  <span className="text-[#d4a73c] text-[10px] font-bold flex items-center justify-center gap-1">
                    <Sparkles className="w-3 h-3" /> TOTAL CP
                  </span>
                  <p className="text-[#d4a73c] font-black text-sm mt-0.5">
                    {calculateCardCP(selectedCard, selectedCard.stars || 1).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Duplicate & Star Level Status */}
              {selectedCard.isUnlocked && (
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-white/40">Total Duplikat: <b className="text-white">{selectedCard.count || 1}x</b></span>
                  <div className="flex items-center gap-0.5">
                    <span className="text-white/40 mr-1">Star:</span>
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3.5 h-3.5 ${
                          i < (selectedCard.stars || 1)
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-white/20'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Showcase Profile Action */}
              {selectedCard.isUnlocked ? (
                <button
                  onClick={() => handleToggleDeck(selectedCard.id)}
                  disabled={savingDeck}
                  className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${
                    deckIds.includes(selectedCard.id)
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                      : 'bg-[#d4a73c] text-[#0b0b10] hover:bg-[#ff4e2d] shadow-lg shadow-[#d4a73c]/20'
                  }`}
                >
                  <Award className="w-4 h-4" />
                  {deckIds.includes(selectedCard.id)
                    ? 'Hapus dari Showcase Profil'
                    : 'Pasang di Showcase Profil (Maks 3)'}
                </button>
              ) : (
                <div className="p-3 bg-white/5 rounded-xl text-center">
                  <p className="text-white/40 text-xs font-medium">
                    Kartu ini belum dimiliki. Tarik gacha untuk membukanya!
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CardAlbum;
