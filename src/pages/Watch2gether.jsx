import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { setSeoMeta, SITE_URL } from '../utils/seo';
import { useAdaptiveInterval } from '../hooks/useAdaptiveInterval';
import {
  Users,
  Tv,
  Plus,
  Search,
  Lock,
  Play,
  Sparkles,
  ArrowRight,
  Shield,
  X,
  Compass,
  Radio,
  Flame
} from 'lucide-react';

const Watch2gether = () => {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [passcodeModal, setPasscodeModal] = useState({ isOpen: false, roomId: '', code: '' });

  // State Form Buat Room
  const [formData, setFormData] = useState({
    title: '',
    animeId: '',
    animeSlug: '',
    animeTitle: '',
    animePoster: '',
    episodeIndex: '1',
    episodeId: '',
    videoUrl: '',
    isPublic: true,
    passcode: '',
    maxMembers: 20
  });

  // State Pencarian Anime di Modal
  const [animeQuery, setAnimeQuery] = useState('');
  const [animeResults, setAnimeResults] = useState([]);
  const [selectedAnimeDetail, setSelectedAnimeDetail] = useState(null);
  const [episodesList, setEpisodesList] = useState([]);
  const [searchingAnime, setSearchingAnime] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);

  useEffect(() => {
    setSeoMeta(
      'Watch2gether - Nonton Anime Bareng Teman Real-Time | Ndichan',
      'Buat room nonton anime bareng teman secara real-time tersinkronisasi, lengkap dengan live chat dan Danmaku komentar melayang di layar video!',
      '/img/welcomebanner.webp',
      `${SITE_URL}/watch2gether`
    );
  }, []);

  // Fetch daftar room publik
  const fetchRooms = async () => {
    try {
      const res = await fetch('/api/v1/w2g/rooms');
      const data = await res.json();
      if (res.ok && data.success) {
        setRooms(data.rooms || []);
      }
    } catch (e) {
      console.error('Fetch W2G rooms error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  useAdaptiveInterval(fetchRooms, 10000);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  // Gabung via Kode Room
  const handleJoinByCode = (e) => {
    e?.preventDefault();
    const code = roomCodeInput.trim().toUpperCase();
    if (!code) {
      showToast('Masukkan kode room 6 karakter!');
      return;
    }
    navigate(`/w2g/${code}`);
  };

  // Search anime di modal
  const handleSearchAnime = async (q) => {
    setAnimeQuery(q);
    if (q.trim().length < 2) {
      setAnimeResults([]);
      return;
    }
    setSearchingAnime(true);
    try {
      const res = await fetch(`/ndikagantengtobrutbanget/v1/search?q=${encodeURIComponent(q)}`).then((r) => r.json());
      if (res.status && res.data) {
        setAnimeResults(res.data.slice(0, 8));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSearchingAnime(false);
    }
  };

  // Pilih Anime untuk Room
  const handleSelectAnime = async (anime) => {
    setSelectedAnimeDetail(anime);
    setAnimeResults([]);
    try {
      const res = await fetch(`/ndikagantengtobrutbanget/v1/detail?id=${anime.id}`).then((r) => r.json());
      if (res.status && res.data) {
        const epList = res.data.episode_list || [];
        setEpisodesList(epList);
        const firstEp = epList[epList.length - 1] || epList[0];

        // Fetch streaming video server episode pertama
        let vidUrl = '';
        if (firstEp) {
          try {
            const epRes = await fetch(`/ndikagantengtobrutbanget/v1/episode?id=${firstEp.id}`).then((r) => r.json());
            if (epRes.status && epRes.data) {
              const mp4Servers = (epRes.data.server || []).filter(
                (s) => s.link && s.type === 'direct' && !s.link.includes('embed=true') && s.link.split('?')[0].endsWith('.mp4')
              );
              if (mp4Servers.length > 0) {
                const best = mp4Servers.find((s) => s.quality === '720p') || mp4Servers[0];
                vidUrl = `https://cfelainawanggy.pages.dev/?action=stream&url=${best.link}`;
              }
            }
          } catch {}
        }

        setFormData((prev) => ({
          ...prev,
          title: prev.title || `Nonton ${anime.title} Bareng!`,
          animeId: anime.id,
          animeSlug: `${anime.id}-${anime.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          animeTitle: anime.title,
          animePoster: anime.image_poster || anime.image_cover || '',
          episodeIndex: firstEp?.index ? String(firstEp.index) : '1',
          episodeId: firstEp?.id || '',
          videoUrl: vidUrl
        }));
      }
    } catch (e) {
      console.error('Fetch anime detail error:', e);
    }
  };

  // Ganti episode saat membuat room
  const handleEpisodeChange = async (epIndex) => {
    const epObj = episodesList.find((e) => String(e.index) === String(epIndex));
    if (!epObj) return;

    let vidUrl = '';
    try {
      const epRes = await fetch(`/ndikagantengtobrutbanget/v1/episode?id=${epObj.id}`).then((r) => r.json());
      if (epRes.status && epRes.data) {
        const mp4Servers = (epRes.data.server || []).filter(
          (s) => s.link && s.type === 'direct' && !s.link.includes('embed=true') && s.link.split('?')[0].endsWith('.mp4')
        );
        if (mp4Servers.length > 0) {
          const best = mp4Servers.find((s) => s.quality === '720p') || mp4Servers[0];
          vidUrl = `https://cfelainawanggy.pages.dev/?action=stream&url=${best.link}`;
        }
      }
    } catch {}

    setFormData((prev) => ({
      ...prev,
      episodeIndex: String(epObj.index),
      episodeId: epObj.id,
      videoUrl: vidUrl
    }));
  };

  // Submit Create Room
  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      showToast('Judul room wajib diisi!');
      return;
    }
    if (!formData.animeTitle) {
      showToast('Pilih anime yang ingin ditonton terlebih dahulu!');
      return;
    }

    setCreatingRoom(true);
    try {
      let gid = 'guest_anon';
      if (typeof window !== 'undefined') {
        gid = localStorage.getItem('ndichan_w2g_guest_id');
        if (!gid) {
          gid = `guest_${Math.random().toString(36).slice(2, 10)}`;
          localStorage.setItem('ndichan_w2g_guest_id', gid);
        }
      }

      const res = await fetch('/api/v1/w2g/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-guest-id': gid },
        credentials: 'include',
        body: JSON.stringify({ ...formData, guestId: gid })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsCreateOpen(false);
        navigate(`/w2g/${data.roomId}`);
      } else {
        showToast(data.error || 'Gagal membuat room');
      }
    } catch (e) {
      showToast('Koneksi terputus saat membuat room');
    } finally {
      setCreatingRoom(false);
    }
  };

  // Filter public rooms by search
  const filteredRooms = rooms.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return r.title.toLowerCase().includes(q) || r.animeTitle.toLowerCase().includes(q) || r.hostName.toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen bg-[#0b0b10] text-white flex flex-col justify-between pt-24 pb-12">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 w-full">
        {/* Toast Notifikasi */}
        {toast && (
          <div className="fixed top-24 right-4 z-50 p-4 bg-[#ff4e2d] text-white font-bold rounded-xl shadow-2xl flex items-center gap-2 animate-[slideDown_0.2s_ease-out]">
            <Sparkles className="w-5 h-5 shrink-0" />
            <p className="text-xs md:text-sm">{toast}</p>
          </div>
        )}

        {/* Hero Banner Watch2gether */}
        <div className="bg-gradient-to-br from-[#161622] via-[#101018] to-[#09090e] border border-white/10 rounded-3xl p-6 md:p-10 mb-8 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#ff4e2d]/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-[#d4a73c]/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col lg:flex-row items-center justify-between gap-8 relative z-10">
            <div className="flex-1 text-center lg:text-left space-y-4">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-gradient-to-r from-[#ff4e2d]/20 to-[#d4a73c]/20 border border-[#ff4e2d]/30 text-amber-300 text-xs font-black uppercase tracking-wider">
                <Radio className="w-3.5 h-3.5 text-[#ff4e2d] animate-pulse" />
                WATCH2GETHER • REAL-TIME SYNC
              </div>

              <h1 className="font-display text-3xl md:text-5xl text-white font-black leading-tight tracking-wide">
                NONTON ANIME BARENG <br />
                <span className="bg-gradient-to-r from-[#d4a73c] via-[#ff4e2d] to-[#ff2a70] bg-clip-text text-transparent">
                  TEMAN SECARA REAL-TIME
                </span>
              </h1>

              <p className="text-white/60 text-xs md:text-sm max-w-xl leading-relaxed">
                Sinkronisasi pemutar video otomatis tanpa lag, lengkap dengan Live Chat Room dan Danmaku (komentar melayang) langsung di atas layar anime!
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 pt-2">
                <button
                  onClick={() => setIsCreateOpen(true)}
                  className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-[#d4a73c] to-[#ff4e2d] text-[#0b0b10] font-black text-sm hover:brightness-110 active:scale-95 transition-all shadow-xl shadow-[#d4a73c]/25 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Buat Room Nobar Baru
                </button>

                {/* Direct Code Form */}
                <form onSubmit={handleJoinByCode} className="flex items-center bg-[#181824] border border-white/15 rounded-2xl p-1 focus-within:border-[#d4a73c] transition-colors">
                  <input
                    type="text"
                    placeholder="Kode Room (Contoh: NEF789)"
                    value={roomCodeInput}
                    onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                    maxLength={10}
                    className="bg-transparent px-3.5 py-2 text-xs font-mono-ui font-bold text-white placeholder:text-white/30 outline-none w-48 uppercase"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors flex items-center gap-1"
                  >
                    Masuk <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            </div>

            {/* Quick Stats / Visual Illustration */}
            <div className="shrink-0 flex items-center gap-4 bg-[#14141e]/80 border border-white/10 p-6 rounded-2xl backdrop-blur-md">
              <div className="text-center px-4">
                <div className="w-10 h-10 rounded-xl bg-[#d4a73c]/10 text-[#d4a73c] flex items-center justify-center mx-auto mb-2">
                  <Tv className="w-5 h-5" />
                </div>
                <span className="text-white font-black text-xl font-mono-ui">{rooms.length}</span>
                <p className="text-white/40 text-[10px] uppercase font-bold mt-0.5">Room Aktif</p>
              </div>

              <div className="w-px h-12 bg-white/10" />

              <div className="text-center px-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-2">
                  <Users className="w-5 h-5" />
                </div>
                <span className="text-emerald-400 font-black text-xl font-mono-ui">
                  {rooms.reduce((acc, r) => acc + (r.activeCount || 1), 0)}
                </span>
                <p className="text-white/40 text-[10px] uppercase font-bold mt-0.5">Penonton Live</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search & Header List Room Publik */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-[#d4a73c]" />
            <h2 className="text-white font-black text-lg md:text-xl">Daftar Room Publik</h2>
            <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/60 text-xs font-bold font-mono-ui">
              {filteredRooms.length}
            </span>
          </div>

          <div className="w-full sm:w-72 relative">
            <Search className="w-4 h-4 text-white/30 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari room, anime, atau host..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#14141d] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-white/30 focus:border-[#d4a73c] outline-none transition-colors"
            />
          </div>
        </div>

        {/* Room Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-44 bg-[#14141d] rounded-2xl animate-pulse border border-white/5" />
            ))}
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="bg-[#14141d] border border-white/5 rounded-2xl p-12 text-center space-y-3">
            <Tv className="w-12 h-12 text-white/20 mx-auto" />
            <h4 className="text-white font-bold text-base">Belum Ada Room Publik yang Aktif</h4>
            <p className="text-white/40 text-xs max-w-md mx-auto">
              Jadilah yang pertama membuat room nonton bareng dan undang teman-temanmu sekarang!
            </p>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="mt-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors"
            >
              + Buat Room Sekarang
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredRooms.map((room) => (
              <div
                key={room.id}
                onClick={() => {
                  if (room.hasPasscode) {
                    setPasscodeModal({ isOpen: true, roomId: room.id, code: '' });
                  } else {
                    navigate(`/w2g/${room.id}`);
                  }
                }}
                className="bg-[#14141e] border border-white/10 rounded-2xl p-4 hover:border-[#d4a73c]/50 transition-all cursor-pointer group flex flex-col justify-between shadow-lg relative overflow-hidden"
              >
                {/* Background poster shadow overlay */}
                <div
                  className="absolute inset-0 bg-cover bg-center opacity-10 pointer-events-none group-hover:scale-105 transition-transform duration-500"
                  style={{ backgroundImage: `url(${room.animePoster})` }}
                />

                <div className="relative z-10 flex gap-3.5">
                  <img
                    src={room.animePoster}
                    alt={room.animeTitle}
                    className="w-16 h-22 object-cover rounded-xl shrink-0 shadow-md border border-white/10"
                    loading="lazy"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="px-2 py-0.5 rounded bg-[#d4a73c]/15 text-[#d4a73c] font-mono-ui font-black text-[10px]">
                        EP {room.episodeIndex}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {room.hasPasscode && <Lock className="w-3 h-3 text-amber-400" />}
                        <span className="flex items-center gap-1 text-[11px] font-mono-ui font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          {room.activeCount}
                        </span>
                      </div>
                    </div>

                    <h3 className="text-white font-black text-sm group-hover:text-[#d4a73c] transition-colors truncate">
                      {room.title}
                    </h3>
                    <p className="text-white/40 text-xs truncate mt-0.5">{room.animeTitle}</p>
                  </div>
                </div>

                {/* Footer Room Card */}
                <div className="relative z-10 mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <img
                      src={room.hostAvatar || '/img/kaguya.webp'}
                      alt={room.hostName}
                      className="w-5 h-5 rounded-full border border-white/10 object-cover shrink-0"
                    />
                    <span className="text-white/60 text-[11px] truncate">
                      Host: <b className="text-white font-bold">{room.hostName}</b>
                    </span>
                  </div>

                  <span className="text-[10px] font-mono-ui text-white/30 uppercase font-bold">
                    Kode: {room.id}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== MODAL BUAT ROOM W2G ===== */}
      {isCreateOpen && (
        <div
          className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-[fadeIn_0.15s_ease-out]"
          onClick={() => setIsCreateOpen(false)}
        >
          <div
            className="w-full max-w-xl bg-[#14141e] border border-white/15 rounded-2xl p-6 relative my-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsCreateOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#d4a73c] to-[#ff4e2d] flex items-center justify-center text-[#0b0b10]">
                <Plus className="w-5 h-5 font-black" />
              </div>
              <div>
                <h3 className="text-white font-black text-lg">Buat Room Nonton Bareng</h3>
                <p className="text-white/40 text-xs">Atur judul dan pilih anime yang ingin ditonton bersama</p>
              </div>
            </div>

            <form onSubmit={handleCreateRoom} className="space-y-4 text-xs">
              {/* Judul Room */}
              <div>
                <label className="text-white/70 font-bold block mb-1">Judul Room</label>
                <input
                  type="text"
                  placeholder="Contoh: Nobar Jujutsu Kaisen Seru!"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  maxLength={50}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-white/30 focus:border-[#d4a73c] outline-none"
                  required
                />
              </div>

              {/* Cari Anime */}
              <div>
                <label className="text-white/70 font-bold block mb-1">Cari & Pilih Anime</label>
                <div className="relative">
                  <Search className="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Ketik judul anime (misal: Naruto, One Piece, Frieren)..."
                    value={animeQuery}
                    onChange={(e) => handleSearchAnime(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-white placeholder:text-white/30 focus:border-[#d4a73c] outline-none"
                  />
                </div>

                {/* Dropdown Hasil Pencarian */}
                {animeResults.length > 0 && (
                  <div className="mt-2 bg-[#1b1b28] border border-white/10 rounded-xl max-h-48 overflow-y-auto custom-scrollbar p-1 shadow-2xl divide-y divide-white/5">
                    {animeResults.map((anime) => (
                      <div
                        key={anime.id}
                        onClick={() => handleSelectAnime(anime)}
                        className="p-2 hover:bg-white/5 rounded-lg cursor-pointer flex items-center gap-3 transition-colors"
                      >
                        <img
                          src={anime.image_poster || anime.image_cover}
                          alt={anime.title}
                          className="w-10 h-14 object-cover rounded shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <h4 className="text-white font-bold text-xs truncate">{anime.title}</h4>
                          <span className="text-white/40 text-[10px]">{anime.year || 'Anime'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Anime Terpilih & Episode Selector */}
              {selectedAnimeDetail && (
                <div className="p-3.5 bg-black/40 border border-[#d4a73c]/30 rounded-xl flex items-center gap-3">
                  <img
                    src={selectedAnimeDetail.image_poster || selectedAnimeDetail.image_cover}
                    alt={selectedAnimeDetail.title}
                    className="w-12 h-16 object-cover rounded-lg shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <h4 className="text-white font-black text-xs truncate">{selectedAnimeDetail.title}</h4>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-white/50 text-[11px]">Pilih Episode:</span>
                      <select
                        value={formData.episodeIndex}
                        onChange={(e) => handleEpisodeChange(e.target.value)}
                        className="bg-[#1b1b26] border border-white/20 rounded-lg px-2.5 py-1 text-white font-bold text-xs outline-none"
                      >
                        {episodesList.map((ep) => (
                          <option key={ep.id} value={ep.index}>
                            Episode {ep.index}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Pengaturan Privasi & Passcode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/5">
                <div>
                  <label className="text-white/70 font-bold block mb-1">Tipe Room</label>
                  <select
                    value={formData.isPublic ? 'public' : 'private'}
                    onChange={(e) => setFormData({ ...formData, isPublic: e.target.value === 'public' })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white text-xs outline-none"
                  >
                    <option value="public">Publik (Terlihat di Daftar)</option>
                    <option value="private">Privat (Hanya dengan Link / Password)</option>
                  </select>
                </div>

                <div>
                  <label className="text-white/70 font-bold block mb-1">Passcode (Opsional)</label>
                  <input
                    type="password"
                    placeholder="Kosongkan jika bebas masuk"
                    value={formData.passcode}
                    onChange={(e) => setFormData({ ...formData, passcode: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder:text-white/30 outline-none"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={creatingRoom || !selectedAnimeDetail}
                className="w-full mt-4 py-3 rounded-xl bg-gradient-to-r from-[#d4a73c] to-[#ff4e2d] text-[#0b0b10] font-black text-sm hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-[#d4a73c]/20 disabled:opacity-40"
              >
                {creatingRoom ? 'Membuat Room...' : 'Buka Room & Mulai Nonton!'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ===== MODAL PASSCODE ROOM ===== */}
      {passcodeModal.isOpen && (
        <div
          className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-[fadeIn_0.15s_ease-out]"
          onClick={() => setPasscodeModal({ isOpen: false, roomId: '', code: '' })}
        >
          <div
            className="w-full max-w-sm bg-[#14141e] border border-white/15 rounded-2xl p-6 relative shadow-2xl text-center space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-white font-black text-base">Room Ini Memerlukan Passcode</h3>
              <p className="text-white/40 text-xs mt-1">Masukkan passcode yang diberikan oleh host untuk bergabung</p>
            </div>

            <input
              type="password"
              placeholder="Masukkan passcode..."
              value={passcodeModal.code}
              onChange={(e) => setPasscodeModal({ ...passcodeModal, code: e.target.value })}
              className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-2.5 text-white text-center text-sm font-mono-ui outline-none focus:border-[#d4a73c]"
            />

            <button
              onClick={() => {
                navigate(`/w2g/${passcodeModal.roomId}?passcode=${encodeURIComponent(passcodeModal.code)}`);
              }}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#d4a73c] to-[#ff4e2d] text-[#0b0b10] font-bold text-xs hover:brightness-110 transition-all"
            >
              Gabung Room
            </button>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default Watch2gether;
