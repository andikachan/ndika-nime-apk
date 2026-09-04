import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import HoloCard from '../components/HoloCard';
import {
  Coins, Search, Plus, Sparkles, Swords, Shield, Clock, Check, X,
  Loader2, ArrowRight, ArrowLeftRight, User, Filter, AlertCircle,
  Tag, RefreshCw, ChevronRight, Zap, Trophy, History, Package
} from 'lucide-react';
import { CARDS_DATABASE, RARITY_CONFIG, ELEMENTS, calculateCardCP } from '../utils/cardsData';
import { setSeoMeta, SITE_URL } from '../utils/seo';

const RARITY_KEYS = ['ALL', 'UR', 'SSR', 'SR', 'R'];
const ELEMENT_KEYS = ['ALL', 'Void', 'Light', 'Dark', 'Flame', 'Water', 'Wind', 'Earth'];

const formatCountdown = (expiresAt) => {
  const diff = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  if (diff <= 0) return 'Berakhir';
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  if (h > 24) return `${Math.floor(h / 24)}h ${h % 24}j`;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const Marketplace = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('auctions'); // 'auctions' | 'trades' | 'my_activity'
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState([]);
  const [myActivity, setMyActivity] = useState({ myListings: [], myBids: [], myCards: [], coins: 0 });
  const [myTrades, setMyTrades] = useState({ sent: [], received: [] });

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRarity, setSelectedRarity] = useState('ALL');
  const [selectedElement, setSelectedElement] = useState('ALL');
  const [sortBy, setSortBy] = useState('ending_soon');

  // Modals
  const [bidModalListing, setBidModalListing] = useState(null);
  const [bidAmount, setBidAmount] = useState('');
  const [buyoutModalListing, setBuyoutModalListing] = useState(null);
  const [createListingModal, setCreateListingModal] = useState(false);
  const [selectedCardToSell, setSelectedCardToSell] = useState(null);
  const [sellStartingBid, setSellStartingBid] = useState('500');
  const [sellBuyoutPrice, setSellBuyoutPrice] = useState('1500');
  const [sellDurationHours, setSellDurationHours] = useState('48');

  // Trade Modal
  const [createTradeModal, setCreateTradeModal] = useState(false);
  const [tradeTargetUserId, setTradeTargetUserId] = useState('');
  const [tradeSenderCardId, setTradeSenderCardId] = useState('');
  const [tradeRequestedCardId, setTradeRequestedCardId] = useState('');

  // Processing & Toast
  const [actionBusy, setActionBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    setSeoMeta({
      title: 'Bursa & Pasar Lelang Kartu Anime - Ndika-Nime',
      description: 'Jual beli dan lelang kartu karakter anime UR/SSR dengan Koin Kuno, pasang tawaran, atau barter langsung antar pemain di Ndika-Nime.',
      url: `${SITE_URL}/market`
    });
  }, []);

  const showToast = (msg, isError = false) => {
    if (isError) {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(''), 4000);
    } else {
      setToast(msg);
      setTimeout(() => setToast(''), 4000);
    }
  };

  // Load Market Data
  const loadListings = async () => {
    setLoading(true);
    try {
      const qParams = new URLSearchParams();
      if (selectedRarity !== 'ALL') qParams.set('rarity', selectedRarity);
      if (selectedElement !== 'ALL') qParams.set('element', selectedElement);
      if (searchQuery.trim()) qParams.set('search', searchQuery.trim());
      if (sortBy) qParams.set('sort', sortBy);

      const res = await fetch(`/api/v1/market/listings?${qParams.toString()}`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setListings(data.listings || []);
      }
    } catch (e) {
      console.error('Load listings error:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadMyActivity = async () => {
    try {
      const res = await fetch('/api/v1/market/my-activity', { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setMyActivity(data);
      }
    } catch (e) {
      console.error('Load my activity error:', e);
    }
  };

  const loadMyTrades = async () => {
    try {
      const res = await fetch('/api/v1/market/my-trades', { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setMyTrades(data);
      }
    } catch (e) {
      console.error('Load my trades error:', e);
    }
  };

  useEffect(() => {
    loadListings();
  }, [selectedRarity, selectedElement, sortBy]);

  useEffect(() => {
    loadMyActivity();
    loadMyTrades();
  }, []);

  // Handle Search Submit
  const handleSearch = (e) => {
    e.preventDefault();
    loadListings();
  };

  // Action: Buat Lelang Baru
  const handleCreateListing = async () => {
    if (!selectedCardToSell) return;
    setActionBusy(true);
    try {
      const res = await fetch('/api/v1/market/create-listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          cardId: selectedCardToSell.id,
          startingBid: parseInt(sellStartingBid, 10) || 100,
          buyoutPrice: sellBuyoutPrice ? parseInt(sellBuyoutPrice, 10) : null,
          durationHours: parseInt(sellDurationHours, 10) || 48
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Lelang kartu ${selectedCardToSell.name} berhasil dibuat!`);
        setCreateListingModal(false);
        setSelectedCardToSell(null);
        loadListings();
        loadMyActivity();
      } else {
        showToast(data.error || 'Gagal membuat lelang', true);
      }
    } catch (e) {
      showToast('Terjadi kesalahan jaringan', true);
    } finally {
      setActionBusy(false);
    }
  };

  // Action: Pasang Bid
  const handlePlaceBid = async () => {
    if (!bidModalListing || !bidAmount) return;
    setActionBusy(true);
    try {
      const res = await fetch('/api/v1/market/place-bid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          listingId: bidModalListing.id,
          bidAmount: parseInt(bidAmount, 10)
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Tawaran sebesar ${parseInt(bidAmount, 10).toLocaleString()} Koin berhasil dipasang!`);
        setBidModalListing(null);
        setBidAmount('');
        loadListings();
        loadMyActivity();
      } else {
        showToast(data.error || 'Gagal memasang tawaran', true);
      }
    } catch (e) {
      showToast('Gagal terhubung ke server', true);
    } finally {
      setActionBusy(false);
    }
  };

  // Action: Beli Langsung (Buyout)
  const handleBuyout = async () => {
    if (!buyoutModalListing) return;
    setActionBusy(true);
    try {
      const res = await fetch('/api/v1/market/buyout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          listingId: buyoutModalListing.id
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Sukses membeli kartu ${data.card.name}! Kartu telah masuk ke inventory.`);
        setBuyoutModalListing(null);
        loadListings();
        loadMyActivity();
      } else {
        showToast(data.error || 'Gagal membeli kartu', true);
      }
    } catch (e) {
      showToast('Gagal terhubung ke server', true);
    } finally {
      setActionBusy(false);
    }
  };

  // Action: Batalkan Listing
  const handleCancelListing = async (listingId) => {
    setActionBusy(true);
    try {
      const res = await fetch('/api/v1/market/cancel-listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ listingId })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Listing lelang dibatalkan. Kartu dikembalikan ke inventory.');
        loadListings();
        loadMyActivity();
      } else {
        showToast(data.error || 'Gagal membatalkan lelang', true);
      }
    } catch (e) {
      showToast('Gagal membatalkan lelang', true);
    } finally {
      setActionBusy(false);
    }
  };

  // Action: Respon Trade Offer (Terima / Tolak)
  const handleRespondTrade = async (tradeId, accept) => {
    setActionBusy(true);
    try {
      const res = await fetch('/api/v1/market/respond-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tradeId, accept })
      });
      const data = await res.json();
      if (data.success) {
        showToast(accept ? 'Barter berhasil! Kartu telah ditukar.' : 'Tawaran barter ditolak.');
        loadMyTrades();
        loadMyActivity();
      } else {
        showToast(data.error || 'Gagal memproses barter', true);
      }
    } catch (e) {
      showToast('Terjadi kesalahan barter', true);
    } finally {
      setActionBusy(false);
    }
  };

  // Action: Kirim Penawaran Barter Baru
  const handleSendTrade = async () => {
    if (!tradeTargetUserId.trim() || !tradeSenderCardId || !tradeRequestedCardId) {
      showToast('Lengkapi User ID target, kartu yang ditawarkan, dan kartu yang diminta', true);
      return;
    }
    setActionBusy(true);
    try {
      const res = await fetch('/api/v1/market/send-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          targetUserId: tradeTargetUserId.trim(),
          senderCardId: tradeSenderCardId,
          requestedCardId: tradeRequestedCardId
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Tawaran barter berhasil dikirim ke temanmu!');
        setCreateTradeModal(false);
        setTradeTargetUserId('');
        setTradeSenderCardId('');
        setTradeRequestedCardId('');
        loadMyTrades();
      } else {
        showToast(data.error || 'Gagal mengirim penawaran barter', true);
      }
    } catch (e) {
      showToast('Terjadi kesalahan pengiriman barter', true);
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0b10] text-white flex flex-col justify-between selection:bg-[#d4a73c]/30 selection:text-[#d4a73c]">
      <Navbar />

      {/* Fixed Floating Toasts Above Modals */}
      <div className="fixed top-6 right-6 z-[300] max-w-md w-full px-4 space-y-2 pointer-events-none">
        {toast && (
          <div className="p-4 bg-[#181824] border border-[#d4a73c]/50 rounded-2xl flex items-center gap-3 shadow-[0_0_30px_rgba(212,167,60,0.35)] pointer-events-auto animate-[slideDown_0.25s_ease-out]">
            <div className="w-8 h-8 rounded-xl bg-[#d4a73c]/20 flex items-center justify-center text-[#d4a73c] shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <p className="text-white font-black text-xs leading-relaxed">{toast}</p>
          </div>
        )}
        {errorMsg && (
          <div className="p-4 bg-[#181824] border border-red-500/60 rounded-2xl flex items-center gap-3 shadow-[0_0_30px_rgba(239,68,68,0.35)] pointer-events-auto animate-[slideDown_0.25s_ease-out]">
            <div className="w-8 h-8 rounded-xl bg-red-500/20 flex items-center justify-center text-red-400 shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
            <p className="text-red-300 font-black text-xs leading-relaxed">{errorMsg}</p>
          </div>
        )}
      </div>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 space-y-6">

        {/* ─── 1. HEADER BANNER ─── */}
        <div className="bg-[#14141d] border border-white/10 rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-80 h-80 bg-[#d4a73c]/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#ff4e2d]/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-start justify-between flex-wrap gap-4 relative z-10">
            <div className="max-w-xl">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-[#d4a73c]/20 border border-[#d4a73c]/35 text-[#d4a73c]">
                  PASAR RESMI NDIKA-NIME
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white font-mono-ui">
                Bursa & Pasar Lelang Kartu
              </h1>
              <p className="text-white/40 text-xs md:text-sm font-medium mt-1 leading-relaxed">
                Jual beli kartu karakter anime UR/SSR dengan Koin Kuno, tawar lelang kartu incaran, atau lakukan barter langsung dengan teman!
              </p>
            </div>

            {/* User Coins & Sell Button */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="bg-black/50 border border-[#d4a73c]/30 rounded-2xl px-4 py-2.5 flex items-center gap-3 shadow-inner">
                <div className="w-9 h-9 rounded-xl bg-[#d4a73c]/15 flex items-center justify-center text-[#d4a73c]">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] text-white/40 block font-bold">Saldo Koin Kamu:</span>
                  <span className="text-[#d4a73c] font-black text-sm md:text-base font-mono-ui">
                    {(myActivity.coins || 0).toLocaleString()} Koin
                  </span>
                </div>
              </div>

              <button
                onClick={() => setCreateListingModal(true)}
                className="px-5 py-3 rounded-2xl bg-gradient-to-r from-[#d4a73c] to-[#ff4e2d] text-[#0b0b10] font-black text-xs uppercase tracking-wider flex items-center gap-2 hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(212,167,60,0.3)]"
              >
                <Plus className="w-4 h-4" strokeWidth={3} />
                Jual Kartu (+Buat Lelang)
              </button>
            </div>
          </div>
        </div>

        {/* ─── 2. TAB NAVIGASI UTAMA ─── */}
        <div className="flex items-center justify-between flex-wrap gap-3 border-b border-white/5 pb-3">
          <div className="flex items-center gap-1.5 p-1 bg-[#14141d] border border-white/5 rounded-2xl">
            <button
              onClick={() => setActiveTab('auctions')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                activeTab === 'auctions'
                  ? 'bg-[#d4a73c] text-[#0b0b10] shadow-[0_0_15px_rgba(212,167,60,0.35)]'
                  : 'text-white/40 hover:text-white'
              }`}
            >
              <Tag className="w-4 h-4" />
              Pasar Lelang ({listings.length})
            </button>

            <button
              onClick={() => setActiveTab('trades')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                activeTab === 'trades'
                  ? 'bg-[#d4a73c] text-[#0b0b10] shadow-[0_0_15px_rgba(212,167,60,0.35)]'
                  : 'text-white/40 hover:text-white'
              }`}
            >
              <ArrowLeftRight className="w-4 h-4" />
              Barter Langsung
              {myTrades.received.filter((t) => t.status === 'pending').length > 0 && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('my_activity')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                activeTab === 'my_activity'
                  ? 'bg-[#d4a73c] text-[#0b0b10] shadow-[0_0_15px_rgba(212,167,60,0.35)]'
                  : 'text-white/40 hover:text-white'
              }`}
            >
              <History className="w-4 h-4" />
              Aktivitas Saya
            </button>
          </div>
        </div>

        {/* ─── TAB 1: PASAR LELANG (AUCTION HOUSE) ─── */}
        {activeTab === 'auctions' && (
          <div className="space-y-6">
            {/* Filter & Search Bar */}
            <div className="bg-[#14141d] border border-white/10 rounded-2xl p-4 md:p-5 space-y-4">
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-white/30 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari nama karakter, judul anime, atau nama penjual..."
                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#d4a73c]"
                  />
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs shrink-0 transition-colors"
                >
                  Cari
                </button>
              </form>

              {/* Rarity & Element Pills */}
              <div className="flex items-center justify-between flex-wrap gap-3 pt-2 border-t border-white/5">
                {/* Rarity */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-white/40 font-bold uppercase mr-1">Rarity:</span>
                  {RARITY_KEYS.map((r) => (
                    <button
                      key={r}
                      onClick={() => setSelectedRarity(r)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider font-mono-ui transition-all ${
                        selectedRarity === r
                          ? 'bg-[#d4a73c] text-[#0b0b10]'
                          : 'bg-white/5 text-white/40 hover:text-white'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>

                {/* Sort Dropdown */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/40 font-bold uppercase">Urutkan:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="bg-black/50 border border-white/10 rounded-lg px-3 py-1 text-xs text-white focus:outline-none focus:border-[#d4a73c]"
                  >
                    <option value="ending_soon">Waktu Segera Berakhir</option>
                    <option value="price_low">Harga Terendah</option>
                    <option value="price_high">Harga Tertinggi</option>
                    <option value="bids_high">Paling Banyak Ditawar</option>
                    <option value="newest">Lelang Terbaru</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Listings Grid */}
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-96 bg-[#14141d] border border-white/5 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : listings.length === 0 ? (
              <div className="bg-[#14141d] border border-dashed border-white/10 rounded-3xl p-12 text-center">
                <Tag className="w-12 h-12 text-white/20 mx-auto mb-3" />
                <h3 className="text-white font-black text-base uppercase">Belum Ada Kartu Yang Dilelang</h3>
                <p className="text-white/40 text-xs font-medium max-w-sm mx-auto mt-1 mb-5">
                  Jadilah yang pertama melelang kartu karakter langkamu dan dapatkan Koin Kuno melimpah!
                </p>
                <button
                  onClick={() => setCreateListingModal(true)}
                  className="px-5 py-2.5 rounded-xl bg-[#d4a73c] text-[#0b0b10] font-black text-xs uppercase tracking-wider inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Mulai Lelang Kartu
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {listings.map((item) => {
                  const card = item.card;
                  const isEndingSoon = (item.expiresAt - Date.now()) < 3600000 * 2; // < 2 jam

                  return (
                    <div
                      key={item.id}
                      className="bg-[#14141d] border border-white/10 rounded-2xl p-4 flex flex-col justify-between hover:border-[#d4a73c]/50 transition-all duration-300 relative group overflow-hidden shadow-xl"
                    >
                      {/* Top Bar: Seller & Timer */}
                      <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-white/5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className="w-5 h-5 rounded-full bg-white/10 overflow-hidden shrink-0">
                            {item.sellerAvatar ? (
                              <img src={item.sellerAvatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-3.5 h-3.5 text-white/40 m-auto" />
                            )}
                          </div>
                          <span className="text-[11px] text-white/50 font-bold truncate">{item.sellerName}</span>
                        </div>

                        <div className={`flex items-center gap-1 text-[10px] font-mono-ui font-black px-2 py-0.5 rounded-md ${
                          isEndingSoon ? 'bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse' : 'bg-white/5 text-white/40'
                        }`}>
                          <Clock className="w-3 h-3" />
                          {formatCountdown(item.expiresAt)}
                        </div>
                      </div>

                      {/* 3D HoloCard Preview */}
                      <div className="flex justify-center py-2">
                        <HoloCard card={card} stars={card.stars || 1} size="sm" />
                      </div>

                      {/* Card Info & Pricing */}
                      <div className="mt-3 space-y-2">
                        <div className="text-center">
                          <h4 className="text-white font-black text-sm truncate">{card.name}</h4>
                          <p className="text-white/40 text-[10px] truncate">{card.anime}</p>
                        </div>

                        {/* Bid vs Buyout Price Box */}
                        <div className="grid grid-cols-2 gap-2 p-2.5 bg-black/40 border border-white/5 rounded-xl text-left">
                          <div>
                            <span className="text-[9px] text-white/40 uppercase font-bold block">Tawaran Tertinggi</span>
                            <span className="text-[#d4a73c] font-black text-xs font-mono-ui flex items-center gap-0.5 mt-0.5">
                              <Coins className="w-3 h-3" /> {item.currentBid.toLocaleString()}
                            </span>
                            <span className="text-[9px] text-white/30 block mt-0.5">({item.bidsCount || 0} Bid)</span>
                          </div>

                          <div className="text-right">
                            <span className="text-[9px] text-white/40 uppercase font-bold block">Beli Langsung</span>
                            {item.buyoutPrice ? (
                              <span className="text-emerald-400 font-black text-xs font-mono-ui flex items-center justify-end gap-0.5 mt-0.5">
                                <Coins className="w-3 h-3" /> {item.buyoutPrice.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-white/30 text-[10px] block mt-0.5">Hanya Lelang</span>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        {(() => {
                          const isMyListing = (myActivity.myListings || []).some((l) => l.id === item.id);

                          if (isMyListing) {
                            return (
                              <div className="pt-1">
                                <button
                                  onClick={() => setActiveTab('my_activity')}
                                  className="w-full py-2 rounded-xl bg-[#d4a73c]/15 border border-[#d4a73c]/30 text-[#d4a73c] font-black text-[11px] uppercase tracking-wider hover:bg-[#d4a73c]/25 transition-all flex items-center justify-center gap-1.5"
                                >
                                  <Tag className="w-3.5 h-3.5" />
                                  Lelang Milikmu (Kelola)
                                </button>
                              </div>
                            );
                          }

                          return (
                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <button
                                onClick={() => {
                                  setBidModalListing(item);
                                  setBidAmount((item.bidsCount === 0 ? item.startingBid : item.currentBid + 50).toString());
                                }}
                                className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-black text-[11px] uppercase tracking-wider transition-all"
                              >
                                Tawar (Bid)
                              </button>

                              {item.buyoutPrice ? (
                                <button
                                  onClick={() => setBuyoutModalListing(item)}
                                  className="w-full py-2 rounded-xl bg-gradient-to-r from-[#d4a73c] to-[#ff4e2d] text-[#0b0b10] font-black text-[11px] uppercase tracking-wider hover:brightness-110 active:scale-[0.98] transition-all shadow-md shadow-[#d4a73c]/20"
                                >
                                  Beli Instan
                                </button>
                              ) : (
                                <button
                                  disabled
                                  className="w-full py-2 rounded-xl bg-white/5 text-white/20 font-black text-[11px] uppercase cursor-not-allowed"
                                >
                                  No Buyout
                                </button>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 2: BARTER & DIRECT TRADE ─── */}
        {activeTab === 'trades' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-white font-black text-base uppercase font-mono-ui">Sistem Barter Antar Pemain</h3>
                <p className="text-white/40 text-xs font-medium mt-0.5">
                  Tukar kartu duplikatmu dengan kartu incaran milik temanmu secara langsung tanpa perantara!
                </p>
              </div>
              <button
                onClick={() => setCreateTradeModal(true)}
                className="px-4 py-2.5 rounded-xl bg-[#d4a73c] text-[#0b0b10] font-black text-xs uppercase tracking-wider flex items-center gap-1.5 hover:brightness-110 active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" /> Kirim Tawaran Barter Baru
              </button>
            </div>

            {/* Received Offers */}
            <div className="space-y-3">
              <h4 className="text-white font-black text-xs uppercase tracking-wider text-white/60">
                Tawaran Barter Masuk ({myTrades.received.length})
              </h4>
              {myTrades.received.length === 0 ? (
                <div className="p-6 bg-[#14141d] border border-white/5 rounded-2xl text-center text-white/30 text-xs">
                  Belum ada tawaran barter masuk dari petualang lain.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {myTrades.received.map((trade) => (
                    <div
                      key={trade.id}
                      className="bg-[#14141d] border border-white/10 rounded-2xl p-5 space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-white/60">
                          Dari: <strong className="text-white">{trade.senderName}</strong>
                        </span>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded font-mono-ui ${
                          trade.status === 'pending'
                            ? 'bg-amber-500/20 text-amber-300'
                            : trade.status === 'accepted'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-red-500/20 text-red-300'
                        }`}>
                          {trade.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 p-3 bg-black/40 border border-white/5 rounded-xl items-center">
                        <div className="text-center">
                          <span className="text-[9px] text-white/40 uppercase block mb-1">Kartu Ditawarkan:</span>
                          <p className="text-[#d4a73c] font-black text-xs truncate">{trade.senderCard.name}</p>
                          <span className="text-[9px] text-white/40 block font-mono-ui">{trade.senderCard.rarity}</span>
                        </div>

                        <div className="text-center border-l border-white/10">
                          <span className="text-[9px] text-white/40 uppercase block mb-1">Kartu Diminta:</span>
                          <p className="text-sky-300 font-black text-xs truncate">{trade.requestedCard.name}</p>
                          <span className="text-[9px] text-white/40 block font-mono-ui">{trade.requestedCard.rarity}</span>
                        </div>
                      </div>

                      {trade.status === 'pending' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRespondTrade(trade.id, true)}
                            disabled={actionBusy}
                            className="flex-1 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" /> Terima Barter
                          </button>
                          <button
                            onClick={() => handleRespondTrade(trade.id, false)}
                            disabled={actionBusy}
                            className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/60 font-black text-xs uppercase tracking-wider"
                          >
                            Tolak
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sent Offers */}
            <div className="space-y-3 pt-4">
              <h4 className="text-white font-black text-xs uppercase tracking-wider text-white/60">
                Tawaran Barter Terkirim ({myTrades.sent.length})
              </h4>
              {myTrades.sent.length === 0 ? (
                <div className="p-6 bg-[#14141d] border border-white/5 rounded-2xl text-center text-white/30 text-xs">
                  Kamu belum mengirimkan tawaran barter ke siapa pun.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {myTrades.sent.map((trade) => (
                    <div
                      key={trade.id}
                      className="bg-[#14141d] border border-white/10 rounded-2xl p-5 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-white/60">
                          Kepada: <strong className="text-white">{trade.targetUserName || trade.targetUserId}</strong>
                        </span>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded font-mono-ui ${
                          trade.status === 'pending'
                            ? 'bg-amber-500/20 text-amber-300'
                            : trade.status === 'accepted'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-red-500/20 text-red-300'
                        }`}>
                          {trade.status}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs p-2.5 bg-black/40 border border-white/5 rounded-xl">
                        <span>Kamu tawarkan: <strong className="text-[#d4a73c]">{trade.senderCard.name}</strong></span>
                        <span>Minta: <strong className="text-sky-300">{trade.requestedCard.name}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 3: AKTIVITAS SAYA (MY ACTIVITY) ─── */}
        {activeTab === 'my_activity' && (
          <div className="space-y-6">
            {/* My Active Listings */}
            <div className="space-y-3">
              <h3 className="text-white font-black text-sm uppercase font-mono-ui">
                Kartu Yang Sedang Kamu Lelang ({myActivity.myListings.length})
              </h3>

              {myActivity.myListings.length === 0 ? (
                <div className="p-8 bg-[#14141d] border border-white/5 rounded-2xl text-center text-white/30 text-xs">
                  Kamu belum melelang kartu apa pun. Tekan tombol "Jual Kartu" di atas untuk mulai melelang!
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {myActivity.myListings.map((item) => (
                    <div
                      key={item.id}
                      className="bg-[#14141d] border border-white/10 rounded-2xl p-4 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] text-white/40 font-mono-ui">
                            Status: <strong className="text-white uppercase">{item.status}</strong>
                          </span>
                          <span className="text-[10px] text-amber-400 font-mono-ui">
                            {formatCountdown(item.expiresAt)}
                          </span>
                        </div>
                        <h4 className="text-white font-black text-sm">{item.card.name}</h4>
                        <p className="text-white/40 text-xs">{item.card.anime}</p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-white/5 space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-white/40">Tawaran Tertinggi:</span>
                          <span className="text-[#d4a73c] font-black font-mono-ui">
                            {item.currentBid.toLocaleString()} Koin ({item.bidsCount} Bid)
                          </span>
                        </div>

                        {item.status === 'active' && item.bidsCount === 0 && (
                          <button
                            onClick={() => handleCancelListing(item.id)}
                            disabled={actionBusy}
                            className="w-full py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold text-xs transition-colors"
                          >
                            Batalkan Lelang
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* My Active Bids */}
            <div className="space-y-3 pt-4">
              <h3 className="text-white font-black text-sm uppercase font-mono-ui">
                Lelang Yang Kamu Ikuti ({myActivity.myBids.length})
              </h3>

              {myActivity.myBids.length === 0 ? (
                <div className="p-8 bg-[#14141d] border border-white/5 rounded-2xl text-center text-white/30 text-xs">
                  Kamu belum menawar di lelang mana pun.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {myActivity.myBids.map((item) => (
                    <div
                      key={item.id}
                      className="bg-[#14141d] border border-white/10 rounded-2xl p-4 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] text-white/40">Penjual: {item.sellerName}</span>
                          <span className="text-[10px] text-amber-400 font-mono-ui">{formatCountdown(item.expiresAt)}</span>
                        </div>
                        <h4 className="text-white font-black text-sm">{item.card.name}</h4>
                      </div>

                      <div className="mt-4 pt-3 border-t border-white/5 flex justify-between items-center text-xs">
                        <span className="text-white/40">Tawaran Saat Ini:</span>
                        <span className="text-[#d4a73c] font-black font-mono-ui">{item.currentBid.toLocaleString()} Koin</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ─── MODAL: BUAT LELANG BARU ─── */}
      {createListingModal && (
        <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-[#181824] border border-[#d4a73c]/30 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative">
            <button
              onClick={() => setCreateListingModal(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <h3 className="text-white font-black text-lg uppercase font-mono-ui">Pasang Kartu di Pasar Lelang</h3>
              <p className="text-white/40 text-xs mt-0.5">Pilih kartu dari inventory milikmu untuk dilelang.</p>
            </div>

            {/* Inventory Card Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/70 block">Pilih Kartu dari Inventory:</label>
              {myActivity.myCards.length === 0 ? (
                <div className="p-4 bg-black/40 border border-white/10 rounded-xl text-center text-white/40 text-xs">
                  Kamu belum memiliki kartu karakter. Buka Gacha terlebih dahulu!
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2.5 max-h-48 overflow-y-auto p-1 scrollbar-none">
                  {myActivity.myCards.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCardToSell(c)}
                      className={`p-2 rounded-xl border text-left transition-all ${
                        selectedCardToSell?.id === c.id
                          ? 'bg-[#d4a73c]/20 border-[#d4a73c] shadow-md shadow-[#d4a73c]/20'
                          : 'bg-white/5 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <p className="text-white font-bold text-xs truncate">{c.name}</p>
                      <div className="flex justify-between text-[10px] text-white/40 mt-1 font-mono-ui">
                        <span className="text-[#d4a73c] font-black">{c.rarity}</span>
                        <span>x{c.count}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedCardToSell && (
              <div className="p-3 bg-black/50 border border-white/10 rounded-xl flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#d4a73c]/20 flex items-center justify-center text-[#d4a73c] font-black shrink-0">
                  {selectedCardToSell.rarity}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-white font-bold text-xs truncate">{selectedCardToSell.name}</h4>
                  <p className="text-white/40 text-[10px]">{selectedCardToSell.anime}</p>
                </div>
              </div>
            )}

            {/* Pricing Inputs */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-white/60 block mb-1">Harga Awal Bid (Koin):</label>
                <input
                  type="number"
                  value={sellStartingBid}
                  onChange={(e) => setSellStartingBid(e.target.value)}
                  min="100"
                  step="50"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#d4a73c] font-mono-ui"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-white/60 block mb-1">Beli Langsung / Buyout (Opsional):</label>
                <input
                  type="number"
                  value={sellBuyoutPrice}
                  onChange={(e) => setSellBuyoutPrice(e.target.value)}
                  placeholder="Kosongkan jika hanya lelang"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#d4a73c] font-mono-ui"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-white/60 block mb-1">Durasi Lelang:</label>
              <select
                value={sellDurationHours}
                onChange={(e) => setSellDurationHours(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#d4a73c]"
              >
                <option value="24">24 Jam (1 Hari)</option>
                <option value="48">48 Jam (2 Hari)</option>
                <option value="72">72 Jam (3 Hari)</option>
              </select>
            </div>

            <button
              onClick={handleCreateListing}
              disabled={!selectedCardToSell || actionBusy}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#d4a73c] to-[#ff4e2d] text-[#0b0b10] font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] disabled:opacity-40 shadow-lg shadow-[#d4a73c]/30"
            >
              {actionBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tag className="w-4 h-4" />}
              Pasang Kartu di Lelang
            </button>
          </div>
        </div>
      )}

      {/* ─── MODAL: PLACE BID ─── */}
      {bidModalListing && (
        <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-[#181824] border border-[#d4a73c]/30 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative text-center">
            <button
              onClick={() => setBidModalListing(null)}
              className="absolute top-4 right-4 w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/60"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-white font-black text-base uppercase font-mono-ui">Pasang Tawaran Lelang</h3>
            <p className="text-white/40 text-xs">Kartu: <strong className="text-white">{bidModalListing.card.name}</strong></p>

            <div className="p-3 bg-black/40 border border-white/10 rounded-xl flex justify-between text-xs font-mono-ui">
              <span className="text-white/40">Tawaran Saat Ini:</span>
              <span className="text-[#d4a73c] font-bold">{bidModalListing.currentBid.toLocaleString()} Koin</span>
            </div>

            <div className="text-left">
              <label className="text-[11px] font-bold text-white/60 block mb-1">Jumlah Tawaran Baru (Koin):</label>
              <input
                type="number"
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                min={bidModalListing.currentBid + 50}
                step="50"
                className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#d4a73c] font-mono-ui font-bold"
              />
            </div>

            <button
              onClick={handlePlaceBid}
              disabled={actionBusy || !bidAmount}
              className="w-full py-3 rounded-xl bg-[#d4a73c] text-[#0b0b10] font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 hover:brightness-110 active:scale-[0.98] shadow-md shadow-[#d4a73c]/30"
            >
              {actionBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Coins className="w-4 h-4" />}
              Konfirmasi Pasang Tawaran
            </button>
          </div>
        </div>
      )}

      {/* ─── MODAL: BUYOUT INSTANT PURCHASE ─── */}
      {buyoutModalListing && (
        <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-[#181824] border border-emerald-500/40 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative text-center">
            <button
              onClick={() => setBuyoutModalListing(null)}
              className="absolute top-4 right-4 w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/60"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400">
              <Coins className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-white font-black text-base uppercase">Beli Langsung (Buyout)</h3>
              <p className="text-white/40 text-xs mt-0.5">Beli kartu ini secara instan tanpa perlu menunggu waktu lelang selesai.</p>
            </div>

            <div className="p-3.5 bg-black/40 border border-white/10 rounded-xl space-y-1.5 text-left">
              <div className="flex justify-between text-xs">
                <span className="text-white/40">Karakter:</span>
                <span className="text-white font-bold">{buyoutModalListing.card.name}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/40">Harga Beli Langsung:</span>
                <span className="text-emerald-400 font-black font-mono-ui">
                  {buyoutModalListing.buyoutPrice?.toLocaleString()} Koin
                </span>
              </div>
            </div>

            <button
              onClick={handleBuyout}
              disabled={actionBusy}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 hover:brightness-110 active:scale-[0.98] shadow-lg shadow-emerald-600/30"
            >
              {actionBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Bayar & Ambil Kartu Sekarang
            </button>
          </div>
        </div>
      )}

      {/* ─── MODAL: CREATE DIRECT TRADE ─── */}
      {createTradeModal && (
        <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-[#181824] border border-[#d4a73c]/30 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setCreateTradeModal(false)}
              className="absolute top-4 right-4 w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/60"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <h3 className="text-white font-black text-base uppercase font-mono-ui">Kirim Tawaran Barter Kartu</h3>
              <p className="text-white/40 text-xs mt-0.5">Tukar kartu dengan temanmu secara langsung.</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-white/60 block mb-1">User ID Teman Target:</label>
                <input
                  type="text"
                  value={tradeTargetUserId}
                  onChange={(e) => setTradeTargetUserId(e.target.value)}
                  placeholder="Masukkan User ID teman..."
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#d4a73c]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-white/60 block mb-1">Kartu Milikmu Yang Ditawarkan:</label>
                <select
                  value={tradeSenderCardId}
                  onChange={(e) => setTradeSenderCardId(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#d4a73c]"
                >
                  <option value="">-- Pilih Kartumu --</option>
                  {myActivity.myCards.map((c) => (
                    <option key={c.id} value={c.id}>
                      [{c.rarity}] {c.name} (x{c.count})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-white/60 block mb-1">Kartu Milik Teman Yang Diminta:</label>
                <select
                  value={tradeRequestedCardId}
                  onChange={(e) => setTradeRequestedCardId(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#d4a73c]"
                >
                  <option value="">-- Pilih Kartu Yang Diinginkan --</option>
                  {CARDS_DATABASE.map((c) => (
                    <option key={c.id} value={c.id}>
                      [{c.rarity}] {c.name} - {c.anime}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleSendTrade}
              disabled={actionBusy || !tradeTargetUserId || !tradeSenderCardId || !tradeRequestedCardId}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#d4a73c] to-[#ff4e2d] text-[#0b0b10] font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 disabled:opacity-40"
            >
              {actionBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowLeftRight className="w-4 h-4" />}
              Kirim Penawaran Barter
            </button>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default Marketplace;
