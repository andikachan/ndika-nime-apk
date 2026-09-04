import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  Lock,
  Check,
  Loader2,
  Sparkles,
  Zap,
  Flame,
  Crown,
  Shield,
  Compass,
  Music,
  Disc,
  Play,
  Pause,
  Pencil,
  Trash2,
  CheckCircle2
} from 'lucide-react';
import AvatarFrame from './AvatarFrame';
import AvatarAura from './AvatarAura';
import { FRAMES as LOCAL_FRAMES } from '../utils/profileFrames';
import { AURAS } from '../utils/profileAuras';
import { CURATED_THEME_SONGS } from '../utils/animeThemeSongs';

const ICON_MAP = {
  Zap,
  Sparkles,
  Flame,
  Crown,
  Shield,
  Compass
};

const avatarUrl = (user) =>
  user?.picture ||
  `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=F6CF80&color=0a0a0c&size=256`;

const ProfileCustomizer = ({ user, onUpdated }) => {
  const [titles, setTitles] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  // States
  const [selectedTitle, setSelectedTitle] = useState(user?.title || 'Anime Newbie');
  const [customTitle, setCustomTitle] = useState(user?.customTitle || '');
  const [selectedFrame, setSelectedFrame] = useState(user?.frame || 'none');
  const [selectedAura, setSelectedAura] = useState(user?.aura || 'none');
  const [selectedSong, setSelectedSong] = useState(user?.themeSong || null);

  // Custom song input state
  const [customSongTitle, setCustomSongTitle] = useState('');
  const [customSongUrl, setCustomSongUrl] = useState('');
  const [customSongAnime, setCustomSongAnime] = useState('');
  const [showCustomSongForm, setShowCustomSongForm] = useState(false);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const userLevel = user?.level || 0;
  const userTitleLevel = user?.titleLevel || 0;

  useEffect(() => {
    fetch('/api/v1/user/titles')
      .then((r) => r.json())
      .then((data) => {
        if (data?.success) setTitles(data.titles || []);
      })
      .catch((e) => console.error('Load titles error:', e))
      .finally(() => setLoadingCatalog(false));
  }, []);

  useEffect(() => {
    setSelectedTitle(user?.title || 'Anime Newbie');
    setCustomTitle(user?.customTitle || '');
    setSelectedFrame(user?.frame || 'none');
    setSelectedAura(user?.aura || 'none');
    setSelectedSong(user?.themeSong || null);
  }, [user?.title, user?.customTitle, user?.frame, user?.aura, user?.themeSong]);

  const hasChanges =
    selectedTitle !== (user?.title || 'Anime Newbie') ||
    customTitle !== (user?.customTitle || '') ||
    selectedFrame !== (user?.frame || 'none') ||
    selectedAura !== (user?.aura || 'none') ||
    JSON.stringify(selectedSong) !== JSON.stringify(user?.themeSong || null);

  const handleSave = async () => {
    if (!hasChanges || saving) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/v1/user/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: selectedTitle,
          customTitle: customTitle.trim(),
          frame: selectedFrame,
          aura: selectedAura,
          themeSong: selectedSong
        })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setMessage({ type: 'success', text: 'Tampilan profil & Anime BGM berhasil disimpan!' });
        onUpdated?.(data.user);
      } else {
        setMessage({ type: 'error', text: data.error || 'Gagal menyimpan perubahan' });
      }
    } catch (e) {
      console.error('Save customization error:', e);
      setMessage({ type: 'error', text: 'Gagal menyimpan, coba lagi' });
    } finally {
      setSaving(false);
    }
  };

  // Preview Song state
  const [previewingSongId, setPreviewingSongId] = useState(null);
  const previewAudioRef = useRef(null);

  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
    };
  }, []);

  const togglePreviewSong = (e, song) => {
    e.stopPropagation();
    if (previewingSongId === song.id) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current.currentTime = 0;
      }
      setPreviewingSongId(null);
      return;
    }

    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }

    const audio = new Audio(song.url);
    audio.volume = 0.5;
    previewAudioRef.current = audio;
    setPreviewingSongId(song.id);

    audio.play().catch(() => {
      setPreviewingSongId(null);
    });
    audio.onended = () => setPreviewingSongId(null);
  };

  const handleApplyCustomSong = () => {
    if (!customSongUrl.trim()) return;
    setSelectedSong({
      id: 'custom-' + Date.now(),
      title: customSongTitle.trim() || 'Custom Anime BGM',
      artist: user?.name || 'Custom Track',
      anime: customSongAnime.trim() || 'Favorite Anime',
      url: customSongUrl.trim(),
      cover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150'
    });
    setShowCustomSongForm(false);
  };

  const sortedTitles = useMemo(() => [...titles].sort((a, b) => a.level - b.level), [titles]);

  return (
    <div className="bg-[#181820] border border-white/5 rounded-2xl p-5 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#d4a73c]" strokeWidth={2.5} />
            <h3 className="text-white font-bold text-sm md:text-base">Kustomisasi Profil & Anime BGM</h3>
          </div>
          <p className="text-white/40 text-xs font-medium mt-0.5">
            Pilih title, custom gelar, frame, animated aura, dan lagu tema anime favoritmu.
          </p>
        </div>
      </div>

      {/* ===== LIVE PREVIEW SECTION ===== */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-white/[0.03] to-white/[0.01] border border-white/10 rounded-2xl flex flex-col sm:flex-row items-center gap-5">
        {/* Avatar with Aura & Frame */}
        <div className="relative py-2 flex items-center justify-center shrink-0">
          <AvatarAura auraId={selectedAura}>
            <AvatarFrame frameId={selectedFrame} className="w-18 h-18 sm:w-20 sm:h-20">
              <img
                src={avatarUrl(user)}
                alt={user?.name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </AvatarFrame>
          </AvatarAura>
        </div>

        {/* User Info Preview */}
        <div className="flex-1 text-center sm:text-left min-w-0">
          <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap mb-1">
            <span className="text-[#d4a73c] text-[11px] font-black uppercase tracking-wider bg-[#d4a73c]/15 px-2.5 py-0.5 rounded-md border border-[#d4a73c]/30">
              {customTitle || selectedTitle}
            </span>
            {selectedAura !== 'none' && (
              <span className="text-amber-400 text-[10px] font-mono-ui font-black uppercase px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30">
                AURA: {AURAS.find((a) => a.id === selectedAura)?.name}
              </span>
            )}
          </div>
          <h4 className="text-white font-black text-base md:text-lg truncate">{user?.name || 'User'}</h4>
          <p className="text-white/40 text-xs mt-0.5">
            {selectedSong ? `🎵 BGM: ${selectedSong.title} (${selectedSong.anime || selectedSong.artist})` : 'Belum memasang Anime BGM'}
          </p>
        </div>
      </div>

      {/* ===== 1. ANIMATED PROFILE AURA ===== */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <p className="text-white/70 text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-amber-400" />
            Animated Profile Aura
          </p>
          <span className="text-white/40 text-[10px] font-mono-ui">Level Kamu: Lv.{userLevel}</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {AURAS.map((a) => {
            const unlocked = a.minLevel <= userLevel;
            const isSelected = selectedAura === a.id;
            const Icon = ICON_MAP[a.iconName] || Sparkles;

            return (
              <button
                key={a.id}
                type="button"
                disabled={!unlocked}
                onClick={() => unlocked && setSelectedAura(a.id)}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between relative overflow-hidden ${
                  isSelected
                    ? 'bg-[#d4a73c]/15 border-[#d4a73c] shadow-lg shadow-[#d4a73c]/10 scale-[1.02]'
                    : unlocked
                    ? 'bg-white/[0.02] border-white/10 hover:bg-white/[0.06] hover:border-white/20'
                    : 'bg-white/[0.01] border-white/5 opacity-35 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shadow-md"
                    style={{ backgroundColor: `${a.accentColor}20`, color: a.accentColor }}
                  >
                    <Icon className="w-4 h-4 font-black" />
                  </div>
                  {isSelected ? (
                    <Check className="w-4 h-4 text-[#d4a73c]" strokeWidth={3} />
                  ) : !unlocked ? (
                    <span className="flex items-center gap-1 text-[9px] text-white/40 font-bold">
                      <Lock className="w-3 h-3" /> Lv.{a.minLevel}
                    </span>
                  ) : null}
                </div>

                <div>
                  <h5 className={`text-xs font-black truncate ${isSelected ? 'text-white' : 'text-white/80'}`}>
                    {a.name}
                  </h5>
                  <p className="text-white/35 text-[9px] line-clamp-1 mt-0.5">{a.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ===== 2. CUSTOM TITLE & GELAR ===== */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <p className="text-white/70 text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
            <Crown className="w-4 h-4 text-[#d4a73c]" />
            Gelar & Custom Title
          </p>
        </div>

        {/* Input Custom Title Sendiri */}
        <div className="mb-4">
          <div className="relative">
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value.slice(0, 35))}
              placeholder="Tulis Gelar Kustom Kamu Sendiri (Contoh: Hashira Api, Raja Wibu, dll)..."
              className="w-full bg-[#12121a] border border-white/15 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#d4a73c] pr-20"
            />
            {customTitle && (
              <button
                type="button"
                onClick={() => setCustomTitle('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white/40 hover:text-white"
              >
                Reset
              </button>
            )}
          </div>
          <span className="text-[10px] text-white/35 mt-1 block">
            {customTitle ? `${customTitle.length}/35 karakter` : 'Atau pilih dari title bawaan yang telah kamu unlock di bawah ini:'}
          </span>
        </div>

        {/* Level Title Selector */}
        {!loadingCatalog && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {sortedTitles.map((t) => {
              const unlocked = t.level <= userTitleLevel;
              const isSelected = selectedTitle === t.name && !customTitle;
              return (
                <button
                  key={t.name}
                  type="button"
                  disabled={!unlocked}
                  onClick={() => {
                    if (unlocked) {
                      setSelectedTitle(t.name);
                      setCustomTitle('');
                    }
                  }}
                  className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'bg-[#d4a73c]/15 border-[#d4a73c]/60'
                      : unlocked
                      ? 'bg-white/[0.02] border-white/10 hover:bg-white/[0.05]'
                      : 'bg-white/[0.01] border-white/5 opacity-35 cursor-not-allowed'
                  }`}
                >
                  <span className={`text-xs font-bold truncate ${isSelected ? 'text-[#d4a73c]' : 'text-white/70'}`}>
                    {t.name}
                  </span>
                  {isSelected ? (
                    <Check className="w-3.5 h-3.5 text-[#d4a73c] shrink-0" strokeWidth={3} />
                  ) : !unlocked ? (
                    <span className="flex items-center gap-1 text-[9px] text-white/30 font-bold shrink-0">
                      <Lock className="w-3 h-3" /> Lv.{t.level}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== 3. FRAME AVATAR ===== */}
      <div>
        <p className="text-white/70 text-xs font-black uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
          <Shield className="w-4 h-4 text-sky-400" />
          Frame Avatar
        </p>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">
          {LOCAL_FRAMES.map((f) => {
            const unlocked = f.minLevel <= userLevel;
            const isSelected = selectedFrame === f.id;
            return (
              <button
                key={f.id}
                type="button"
                disabled={!unlocked}
                onClick={() => unlocked && setSelectedFrame(f.id)}
                className={`flex flex-col items-center gap-1.5 ${!unlocked ? 'opacity-35 cursor-not-allowed' : ''}`}
              >
                <div className={`relative ${isSelected ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-[#181820] rounded-2xl' : ''}`}>
                  <AvatarFrame frameId={f.id} className="w-11 h-11">
                    <img src={avatarUrl(user)} alt={f.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </AvatarFrame>
                  {!unlocked && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-2xl">
                      <Lock className="w-3.5 h-3.5 text-white/70" />
                    </div>
                  )}
                </div>
                <span className="text-[9px] text-white/40 font-bold text-center leading-tight">
                  {unlocked ? f.name : `Lv.${f.minLevel}`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ===== 4. ANIME BGM / PROFILE THEME SONG ===== */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <p className="text-white/70 text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
            <Music className="w-4 h-4 text-pink-400" />
            Anime BGM / Profile Theme Song
          </p>
          {selectedSong && (
            <button
              type="button"
              onClick={() => setSelectedSong(null)}
              className="text-red-400 hover:text-red-300 text-[11px] font-bold flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" /> Hapus BGM
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 mb-3">
          {CURATED_THEME_SONGS.map((song) => {
            const isSelected = selectedSong?.id === song.id;
            const isPreviewing = previewingSongId === song.id;

            return (
              <div
                key={song.id}
                onClick={() => setSelectedSong(song)}
                className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-[#d4a73c]/15 border-[#d4a73c] shadow-lg shadow-[#d4a73c]/10'
                    : 'bg-white/[0.02] border-white/10 hover:bg-white/[0.05] hover:border-white/20'
                }`}
              >
                <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 group/cover">
                  <img
                    src={song.cover}
                    alt={song.title}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={(e) => togglePreviewSong(e, song)}
                    title={isPreviewing ? 'Stop Preview' : 'Putar Cuplikan'}
                    className={`absolute inset-0 flex items-center justify-center transition-all ${
                      isPreviewing
                        ? 'bg-black/60 text-[#d4a73c]'
                        : 'bg-black/40 text-white opacity-0 group-hover/cover:opacity-100'
                    }`}
                  >
                    {isPreviewing ? (
                      <Pause className="w-4 h-4 fill-current animate-pulse" />
                    ) : (
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    )}
                  </button>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h5 className={`font-black text-xs truncate ${isSelected ? 'text-[#d4a73c]' : 'text-white'}`}>
                      {song.title}
                    </h5>
                  </div>
                  <p className="text-white/40 text-[10px] truncate">{song.artist} • {song.anime}</p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => togglePreviewSong(e, song)}
                    title={isPreviewing ? 'Stop Preview' : 'Putar Cuplikan'}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                      isPreviewing ? 'bg-[#d4a73c]/20 text-[#d4a73c]' : 'bg-white/5 hover:bg-white/10 text-white/50 hover:text-white'
                    }`}
                  >
                    {isPreviewing ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
                  </button>
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-[#d4a73c]" />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Input Custom Audio Stream URL */}
        {!showCustomSongForm ? (
          <button
            type="button"
            onClick={() => setShowCustomSongForm(true)}
            className="text-[11px] font-bold text-[#d4a73c] hover:underline flex items-center gap-1"
          >
            <Pencil className="w-3 h-3" /> Punya URL Audio / MP3 Sendiri? Masukkan Di Sini
          </button>
        ) : (
          <div className="p-3.5 bg-[#12121a] border border-white/10 rounded-xl space-y-2.5">
            <p className="text-white font-bold text-xs">Masukkan URL Audio / Musik Sendiri</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                value={customSongTitle}
                onChange={(e) => setCustomSongTitle(e.target.value)}
                placeholder="Judul Lagu..."
                className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#d4a73c]"
              />
              <input
                type="text"
                value={customSongAnime}
                onChange={(e) => setCustomSongAnime(e.target.value)}
                placeholder="Nama Anime..."
                className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#d4a73c]"
              />
              <input
                type="url"
                value={customSongUrl}
                onChange={(e) => setCustomSongUrl(e.target.value)}
                placeholder="URL Audio MP3 (Direct link)..."
                className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#d4a73c]"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowCustomSongForm(false)}
                className="px-3 py-1.5 rounded-lg text-white/50 hover:text-white text-xs"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleApplyCustomSong}
                className="px-4 py-1.5 rounded-lg bg-[#d4a73c] text-[#0b0b10] font-black text-xs"
              >
                Pasang Lagu Kustom
              </button>
            </div>
          </div>
        )}
      </div>

      {message && (
        <p className={`text-xs font-bold ${message.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
          {message.text}
        </p>
      )}

      <button
        onClick={handleSave}
        disabled={!hasChanges || saving}
        className="w-full py-3 rounded-xl font-black text-xs md:text-sm bg-gradient-to-r from-[#d4a73c] via-[#ff4e2d] to-[#ec4899] text-[#0b0b10] hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-[#d4a73c]/20 uppercase tracking-wider"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simpan Kustomisasi Profil'}
      </button>
    </div>
  );
};

export default ProfileCustomizer;
