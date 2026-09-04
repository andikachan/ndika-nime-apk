import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Trash2, Eye, Loader2, Volume2, VolumeX, Send } from 'lucide-react';
import AvatarFrame from './AvatarFrame';

const SLIDE_DURATION_MS = 5000;

const timeAgoId = (ts) => {
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return 'baru saja';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
  return `${Math.floor(diffSec / 3600)}j`;
};

// Viewer story full-screen ala TikTok/Instagram: progress bar per-story milik
// user yang lagi ditampilin, auto-lanjut tiap 5 detik, tap kiri/kanan buat
// navigasi, dan lompat otomatis ke user berikutnya kalau storynya habis.
const StoryViewer = ({ queue, startIndex, currentUserId, onClose, onStoryDeleted }) => {
  const navigate = useNavigate();
  const [index, setIndex] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [viewers, setViewers] = useState(null);
  const [viewersLoading, setViewersLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replySending, setReplySending] = useState(false);
  const [replySent, setReplySent] = useState(false);

  const rafRef = useRef(null);
  const startTimeRef = useRef(null);
  const viewedRef = useRef(new Set());
  const videoRef = useRef(null);

  const current = queue[index];
  const isOwn = current?.entry?.user?.id === currentUserId;

  // Tandai story sebagai sudah dilihat (sekali per story per sesi ini)
  useEffect(() => {
    if (!current || isOwn) return;
    if (viewedRef.current.has(current.story.id)) return;
    viewedRef.current.add(current.story.id);
    fetch('/api/v1/story/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ storyId: current.story.id })
    }).catch((e) => console.error('Mark story viewed error:', e));
  }, [current, isOwn]);

  const goNext = () => {
    if (index + 1 < queue.length) {
      setIndex(index + 1);
    } else {
      onClose();
    }
  };

  const goPrev = () => {
    if (index - 1 >= 0) {
      setIndex(index - 1);
    }
  };

  // Progress bar animation via requestAnimationFrame, di-reset tiap ganti slide.
  // Story video gak pakai timer tetap ini — progressnya ngikutin durasi asli
  // videonya sendiri (lihat effect di bawah).
  useEffect(() => {
    setProgress(0);
    setShowViewers(false);
    setViewers(null);
    setReplyText('');
    setReplySent(false);
    startTimeRef.current = null;

    if (current?.story?.type === 'video') {
      return undefined;
    }

    const tick = (ts) => {
      if (paused) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      if (!startTimeRef.current) startTimeRef.current = ts;
      const elapsed = ts - startTimeRef.current;
      const pct = Math.min(100, (elapsed / SLIDE_DURATION_MS) * 100);
      setProgress(pct);
      if (pct >= 100) {
        goNext();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, paused]);

  // Progress + auto-lanjut khusus story video, ngikutin currentTime/duration
  // videonya sendiri dan lanjut pas videonya selesai (event 'ended'). Videonya
  // dicoba diputer DENGAN suara dulu; kalau browser nolak (kebijakan autoplay),
  // baru fallback ke mute + tombol toggle suara manual.
  useEffect(() => {
    if (current?.story?.type !== 'video') return undefined;
    const video = videoRef.current;
    if (!video) return undefined;

    const onTimeUpdate = () => {
      if (video.duration) setProgress((video.currentTime / video.duration) * 100);
    };
    const onEnded = () => goNext();

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('ended', onEnded);

    video.muted = videoMuted;
    if (paused) {
      video.pause();
    } else {
      video.play().catch(() => {
        if (!videoMuted) {
          setVideoMuted(true); // browser blokir autoplay bersuara, fallback ke mute
        }
      });
    }

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('ended', onEnded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, paused, videoMuted]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const loadViewers = async () => {
    setShowViewers(true);
    setViewersLoading(true);
    try {
      const res = await fetch(`/api/v1/story/viewers?storyId=${current.story.id}`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok && data.success) setViewers(data.viewers || []);
    } catch (e) {
      console.error('Load story viewers error:', e);
    } finally {
      setViewersLoading(false);
    }
  };

  const deleteStory = async () => {
    setDeleting(true);
    try {
      const res = await fetch('/api/v1/story/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ storyId: current.story.id })
      });
      if (res.ok) {
        onStoryDeleted(current.story.id);
        goNext();
      }
    } catch (e) {
      console.error('Delete story error:', e);
    } finally {
      setDeleting(false);
    }
  };

  const submitReply = async () => {
    if (!replyText.trim() || isOwn) return;
    setReplySending(true);
    try {
      const res = await fetch('/api/v1/dm/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          targetUserId: current.entry.user.id,
          text: replyText.trim(),
          share: {
            kind: 'story',
            storyType: current.story.type,
            text: current.story.text || '',
            bgColor: current.story.bgColor || null,
            mediaUrl: current.story.mediaUrl || null,
            ownerId: current.entry.user.id,
            ownerName: current.entry.user.name
          }
        })
      });
      if (res.ok) {
        setReplyText('');
        setReplySent(true);
        setTimeout(() => setReplySent(false), 2000);
      }
    } catch (e) {
      console.error('Reply to story error:', e);
    } finally {
      setReplySending(false);
    }
  };

  if (!current) return null;

  // Segmen progress bar cuma buat story milik user yang lagi ditampilin (bukan seluruh queue)
  const ownerStories = current.entry.stories;
  const ownerStoryIndex = ownerStories.findIndex((s) => s.id === current.story.id);

  return (
    <div className="fixed inset-0 bg-black z-[400] flex items-center justify-center select-none">
      <div className="relative w-full h-full sm:max-w-md sm:h-[90vh] sm:rounded-2xl overflow-hidden bg-[#0b0b10]">
        {/* Progress bars */}
        <div className="absolute top-3 left-3 right-3 z-30 flex gap-1">
          {ownerStories.map((s, i) => (
            <div key={s.id} className="flex-1 h-[3px] rounded-full bg-white/25 overflow-hidden">
              <div
                className="h-full bg-white"
                style={{
                  width: i < ownerStoryIndex ? '100%' : i === ownerStoryIndex ? `${progress}%` : '0%',
                  transition: i === ownerStoryIndex ? 'none' : undefined
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-7 left-3 right-3 z-30 flex items-center gap-2">
          <button onClick={() => navigate(`/user/${current.entry.user.id}`)} className="shrink-0">
            <AvatarFrame frameId={current.entry.user.frame} className="w-8 h-8" rounded="rounded-full">
              <img
                src={current.entry.user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(current.entry.user.name)}&background=F6CF80&color=0a0a0c&size=128`}
                className="w-full h-full object-cover rounded-full"
              />
            </AvatarFrame>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-bold truncate">{isOwn ? 'Kamu' : current.entry.user.name}</p>
            <p className="text-white/50 text-[10px]">{timeAgoId(current.story.createdAt)}</p>
          </div>
          {isOwn && (
            <button onClick={deleteStory} disabled={deleting} className="p-1.5 text-white/70 hover:text-white shrink-0">
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </button>
          )}
          {current.story.type === 'video' && (
            <button
              onClick={() => setVideoMuted((m) => !m)}
              className="p-1.5 text-white/70 hover:text-white shrink-0"
            >
              {videoMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          )}
          <button onClick={onClose} className="p-1.5 text-white/70 hover:text-white shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tap zones buat navigasi */}
        <button
          className="absolute left-0 top-0 w-1/3 h-full z-20"
          onClick={goPrev}
          onMouseDown={() => setPaused(true)}
          onMouseUp={() => setPaused(false)}
          onTouchStart={() => setPaused(true)}
          onTouchEnd={() => setPaused(false)}
        />
        <button
          className="absolute right-0 top-0 w-2/3 h-full z-20"
          onClick={goNext}
          onMouseDown={() => setPaused(true)}
          onMouseUp={() => setPaused(false)}
          onTouchStart={() => setPaused(true)}
          onTouchEnd={() => setPaused(false)}
        />

        {/* Konten story */}
        {current.story.type === 'image' ? (
          <div className="w-full h-full flex items-center justify-center bg-black">
            <img src={current.story.mediaUrl} className="max-w-full max-h-full object-contain" />
            {current.story.text && (
              <div className="absolute bottom-16 left-4 right-4 z-10">
                <p className="text-white text-sm font-semibold bg-black/40 rounded-xl px-3 py-2 inline-block">
                  {current.story.text}
                </p>
              </div>
            )}
          </div>
        ) : current.story.type === 'video' ? (
          <div className="w-full h-full flex items-center justify-center bg-black">
            <video
              key={current.story.id}
              ref={videoRef}
              src={current.story.mediaUrl}
              className="max-w-full max-h-full object-contain"
              playsInline
              autoPlay
            />
            {current.story.text && (
              <div className="absolute bottom-16 left-4 right-4 z-10">
                <p className="text-white text-sm font-semibold bg-black/40 rounded-xl px-3 py-2 inline-block">
                  {current.story.text}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div
            className="w-full h-full flex items-center justify-center p-8 text-center"
            style={{ backgroundColor: current.story.bgColor || '#d4a73c' }}
          >
            <p className="text-white font-black text-2xl md:text-3xl break-words leading-snug">
              {current.story.text}
            </p>
          </div>
        )}

        {/* Lihat penonton (khusus story sendiri) */}
        {isOwn && (
          <button
            onClick={loadViewers}
            className="absolute bottom-4 left-4 z-30 flex items-center gap-1.5 text-white/80 text-xs font-bold bg-black/40 px-3 py-1.5 rounded-full"
          >
            <Eye className="w-3.5 h-3.5" /> Dilihat
          </button>
        )}

        {/* Balas story (khusus punya orang lain) */}
        {!isOwn && (
          <div className="absolute bottom-0 left-0 right-0 z-30 p-3 flex items-center gap-2 bg-gradient-to-t from-black/60 to-transparent">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onFocus={() => setPaused(true)}
              onBlur={() => setPaused(false)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitReply(); }}
              maxLength={500}
              placeholder={`Balas story ${current.entry.user.name.split(' ')[0]}...`}
              className="flex-1 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2.5 text-white text-xs outline-none focus:border-white/40 placeholder:text-white/40"
            />
            <button
              onClick={submitReply}
              disabled={replySending || !replyText.trim()}
              className="shrink-0 w-9 h-9 rounded-full bg-[#d4a73c] flex items-center justify-center disabled:opacity-40"
            >
              {replySending ? <Loader2 className="w-4 h-4 text-[#0b0b10] animate-spin" /> : <Send className="w-4 h-4 text-[#0b0b10]" />}
            </button>
            {replySent && (
              <div className="absolute -top-9 right-3 bg-green-500/90 text-white text-[10px] font-bold px-3 py-1.5 rounded-full">
                Terkirim ✓
              </div>
            )}
          </div>
        )}

        {showViewers && (
          <div className="absolute inset-x-0 bottom-0 z-40 bg-[#141419] rounded-t-2xl max-h-[50%] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <p className="text-white font-bold text-sm">Dilihat oleh</p>
              <button onClick={() => setShowViewers(false)} className="text-white/40 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-2">
              {viewersLoading ? (
                <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 text-white/30 animate-spin" /></div>
              ) : !viewers || viewers.length === 0 ? (
                <p className="text-white/30 text-xs text-center py-6">Belum ada yang lihat.</p>
              ) : (
                viewers.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => navigate(`/user/${v.id}`)}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 text-left"
                  >
                    <img
                      src={v.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(v.name)}&background=F6CF80&color=0a0a0c&size=128`}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                    <p className="text-white text-xs font-bold truncate">{v.name}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StoryViewer;
