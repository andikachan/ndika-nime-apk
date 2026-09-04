import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, Loader2, Type, Image as ImageIcon, Video, MessageSquare, Send } from 'lucide-react';
import AvatarFrame from './AvatarFrame';
import StoryViewer from './StoryViewer';

const IMAGE_UPLOAD_URL = 'https://c.termai.cc/api/upload?key=AIzaBj7z2z3xBjsk';
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const MAX_VIDEO_SIZE = 40 * 1024 * 1024;
const BG_COLORS = ['#d4a73c', '#ff6b9d', '#c471ed', '#4ecdc4', '#3d5afe', '#2e2e38'];

const uploadImageFile = (file) => {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', IMAGE_UPLOAD_URL, true);
    xhr.onload = () => {
      if (xhr.status === 200) {
        try { resolve(JSON.parse(xhr.responseText)); } catch { reject(new Error('Respons upload tidak valid')); }
      } else {
        reject(new Error(`Upload gagal: ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(formData);
  });
};

// Tray Story + Catatan di atas halaman Pesan, mirip row story TikTok/Instagram.
// Avatar dapat ring gradasi kalau ada story yang belum dilihat, dan bubble
// kecil di atas avatar kalau user itu lagi punya "catatan" aktif.
const StoryTray = ({ currentUser }) => {
  const navigate = useNavigate();
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewerQueue, setViewerQueue] = useState(null); // { list, startIndex }
  const [showCreate, setShowCreate] = useState(false);
  const [createTab, setCreateTab] = useState('story'); // 'story' | 'note'
  const [replyTarget, setReplyTarget] = useState(null); // entry lagi dibales catatannya

  const load = async () => {
    try {
      const res = await fetch('/api/v1/story/feed', { credentials: 'include' });
      const data = await res.json();
      if (res.ok && data.success) setFeed(data.feed || []);
    } catch (e) {
      console.error('Load story feed error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const flatQueue = () => feed.flatMap((entry) => entry.stories.map((story) => ({ entry, story })));

  const openViewerFor = (uid) => {
    const queue = flatQueue();
    const startIndex = queue.findIndex((q) => q.entry.user.id === uid);
    if (startIndex === -1) return;
    setViewerQueue({ list: queue, startIndex });
  };

  const handleAvatarClick = (entry) => {
    if (entry.isSelf) {
      if (entry.stories.length > 0) {
        openViewerFor(entry.user.id);
      } else {
        setCreateTab('story');
        setShowCreate(true);
      }
      return;
    }
    if (entry.stories.length > 0) {
      openViewerFor(entry.user.id);
    } else {
      navigate(`/user/${entry.user.id}`);
    }
  };

  if (loading) {
    return (
      <div className="flex gap-4 px-1 py-2 overflow-x-hidden">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="w-14 h-14 rounded-full bg-white/5 animate-pulse shrink-0" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-1 pt-1 px-0.5 no-scrollbar">
        {feed.map((entry) => (
          <div key={entry.user.id} className="flex flex-col items-center gap-1 shrink-0 w-16 relative">
            {entry.note && (
              <button
                onClick={() => !entry.isSelf && setReplyTarget(entry)}
                className={`absolute -top-2 left-1/2 -translate-x-1/2 z-10 max-w-[90px] bg-white text-[#0b0b10] text-[9px] font-bold px-2 py-1 rounded-xl rounded-bl-sm shadow-lg truncate ${!entry.isSelf ? 'cursor-pointer hover:scale-105 transition-transform' : ''}`}
              >
                {entry.note.text}
              </button>
            )}
            <button
              onClick={() => handleAvatarClick(entry)}
              className={`relative w-14 h-14 rounded-full p-[2px] ${
                entry.stories.length > 0
                  ? entry.hasUnseen
                    ? 'bg-gradient-to-tr from-[#f6cf80] via-[#ff6b9d] to-[#c471ed]'
                    : 'bg-white/10'
                  : 'bg-transparent'
              }`}
            >
              <AvatarFrame frameId={entry.user.frame} className="w-full h-full" rounded="rounded-full">
                <img
                  src={entry.user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(entry.user.name)}&background=F6CF80&color=0a0a0c&size=128`}
                  alt={entry.user.name}
                  className="w-full h-full object-cover rounded-full"
                />
              </AvatarFrame>
              {entry.isSelf && (
                <span
                  onClick={(e) => { e.stopPropagation(); setCreateTab('story'); setShowCreate(true); }}
                  className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-[#d4a73c] border-2 border-[#0b0b10] flex items-center justify-center"
                >
                  <Plus className="w-3 h-3 text-[#0b0b10]" strokeWidth={3} />
                </span>
              )}
            </button>
            <p className="text-white/50 text-[10px] font-semibold truncate w-full text-center">
              {entry.isSelf ? 'Kamu' : entry.user.name.split(' ')[0]}
            </p>
          </div>
        ))}
      </div>

      {viewerQueue && (
        <StoryViewer
          queue={viewerQueue.list}
          startIndex={viewerQueue.startIndex}
          currentUserId={currentUser?.id}
          onClose={() => setViewerQueue(null)}
          onStoryDeleted={(storyId) => {
            setFeed((prev) => prev.map((e) => ({ ...e, stories: e.stories.filter((s) => s.id !== storyId) })));
          }}
        />
      )}

      {showCreate && (
        <StoryCreateModal
          initialTab={createTab}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}

      {replyTarget && (
        <NoteReplyModal entry={replyTarget} onClose={() => setReplyTarget(null)} />
      )}
    </>
  );
};

// ===== MODAL BALAS CATATAN SESEORANG =====
const NoteReplyModal = ({ entry, onClose }) => {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!text.trim()) return;
    setError('');
    setSending(true);
    try {
      const res = await fetch('/api/v1/dm/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          targetUserId: entry.user.id,
          text: text.trim(),
          share: {
            kind: 'note',
            text: entry.note.text,
            ownerId: entry.user.id,
            ownerName: entry.user.name
          }
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSent(true);
        setTimeout(onClose, 1200);
      } else {
        setError(data.error || 'Gagal mengirim balasan');
      }
    } catch (e) {
      console.error('Reply to note error:', e);
      setError('Gagal mengirim balasan');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[300] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-[#141419] w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <p className="text-white font-bold text-sm">Balas Catatan {entry.user.name.split(' ')[0]}</p>
          <button onClick={onClose} className="text-white/40 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div className="bg-white text-[#0b0b10] text-xs font-bold px-3 py-2 rounded-xl rounded-bl-sm inline-block max-w-full truncate">
            {entry.note.text}
          </div>
          {error && <p className="text-red-400 text-xs font-medium">{error}</p>}
          {sent ? (
            <p className="text-green-400 text-sm font-bold text-center py-3">Terkirim ✓</p>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
                maxLength={500}
                placeholder="Tulis balasan..."
                className="flex-1 bg-[#0b0b10] border border-white/10 rounded-full px-4 py-2.5 text-white text-sm outline-none focus:border-[#d4a73c]/30"
                autoFocus
              />
              <button
                onClick={submit}
                disabled={sending || !text.trim()}
                className="shrink-0 w-10 h-10 rounded-full bg-[#d4a73c] flex items-center justify-center disabled:opacity-40"
              >
                {sending ? <Loader2 className="w-4 h-4 text-[#0b0b10] animate-spin" /> : <Send className="w-4 h-4 text-[#0b0b10]" />}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ===== MODAL BUAT STORY BARU / TULIS CATATAN =====
const StoryCreateModal = ({ initialTab, onClose, onCreated }) => {
  const [tab, setTab] = useState(initialTab || 'story');
  const [storyType, setStoryType] = useState('text'); // 'text' | 'image' | 'video'
  const [text, setText] = useState('');
  const [bgColor, setBgColor] = useState(BG_COLORS[0]);
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const pickMedia = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxSize = storyType === 'video' ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    if (file.size > maxSize) {
      setError(storyType === 'video' ? 'Ukuran video maksimal 40MB' : 'Ukuran gambar maksimal 8MB');
      return;
    }
    setError('');
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
  };

  const submitStory = async () => {
    setError('');
    if (storyType === 'text' && !text.trim()) {
      setError('Tulis sesuatu dulu buat story kamu');
      return;
    }
    if ((storyType === 'image' || storyType === 'video') && !mediaFile) {
      setError(storyType === 'video' ? 'Pilih video dulu' : 'Pilih gambar dulu');
      return;
    }

    setSubmitting(true);
    try {
      let mediaUrl = null;
      if (storyType === 'image' || storyType === 'video') {
        const uploadResult = await uploadImageFile(mediaFile);
        if (!uploadResult?.status || !uploadResult?.path) {
          throw new Error(storyType === 'video' ? 'Upload video gagal' : 'Upload gambar gagal');
        }
        mediaUrl = uploadResult.path;
      }

      const res = await fetch('/api/v1/story/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type: storyType, text: text.trim(), bgColor, mediaUrl })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onCreated();
      } else {
        setError(data.error || 'Gagal membuat story');
      }
    } catch (e) {
      console.error('Create story error:', e);
      setError(e.message || 'Gagal membuat story');
    } finally {
      setSubmitting(false);
    }
  };

  const submitNote = async () => {
    setError('');
    if (!noteText.trim()) {
      setError('Catatan tidak boleh kosong');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/story/set-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ text: noteText.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onCreated();
      } else {
        setError(data.error || 'Gagal menyimpan catatan');
      }
    } catch (e) {
      console.error('Set note error:', e);
      setError('Gagal menyimpan catatan');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[300] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-[#141419] w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <div className="flex gap-2">
            <button
              onClick={() => setTab('story')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${tab === 'story' ? 'bg-[#d4a73c] text-[#0b0b10]' : 'text-white/40 hover:text-white'}`}
            >
              Story
            </button>
            <button
              onClick={() => setTab('note')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${tab === 'note' ? 'bg-[#d4a73c] text-[#0b0b10]' : 'text-white/40 hover:text-white'}`}
            >
              Catatan
            </button>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {error && <p className="text-red-400 text-xs font-medium">{error}</p>}

          {tab === 'story' ? (
            <>
              <div className="flex gap-2">
                <button
                  onClick={() => setStoryType('text')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${storyType === 'text' ? 'bg-[#d4a73c] text-[#0b0b10]' : 'bg-white/5 text-white/40'}`}
                >
                  <Type className="w-3.5 h-3.5" /> Teks
                </button>
                <button
                  onClick={() => { setStoryType('image'); setMediaFile(null); setMediaPreview(null); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${storyType === 'image' ? 'bg-[#d4a73c] text-[#0b0b10]' : 'bg-white/5 text-white/40'}`}
                >
                  <ImageIcon className="w-3.5 h-3.5" /> Foto
                </button>
                <button
                  onClick={() => { setStoryType('video'); setMediaFile(null); setMediaPreview(null); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${storyType === 'video' ? 'bg-[#d4a73c] text-[#0b0b10]' : 'bg-white/5 text-white/40'}`}
                >
                  <Video className="w-3.5 h-3.5" /> Video
                </button>
              </div>

              {storyType === 'text' ? (
                <>
                  <div
                    className="w-full aspect-[9/13] rounded-xl flex items-center justify-center p-6 text-center"
                    style={{ backgroundColor: bgColor }}
                  >
                    <p className="text-white font-black text-xl break-words leading-snug">
                      {text || 'Tulis sesuatu...'}
                    </p>
                  </div>
                  <textarea
                    rows={2}
                    maxLength={200}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Tulis story kamu..."
                    className="w-full bg-[#0b0b10] border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#d4a73c]/30 resize-none"
                  />
                  <div className="flex gap-2">
                    {BG_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setBgColor(c)}
                        style={{ backgroundColor: c }}
                        className={`w-7 h-7 rounded-full transition-all ${bgColor === c ? 'ring-2 ring-white ring-offset-2 ring-offset-[#141419]' : ''}`}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <>
                  {mediaPreview ? (
                    <div className="relative">
                      {storyType === 'video' ? (
                        <video src={mediaPreview} className="w-full aspect-[9/13] object-cover rounded-xl" controls muted />
                      ) : (
                        <img src={mediaPreview} className="w-full aspect-[9/13] object-cover rounded-xl" />
                      )}
                      <button
                        onClick={() => { setMediaFile(null); setMediaPreview(null); }}
                        className="absolute top-2 right-2 bg-black/60 rounded-full p-1.5"
                      >
                        <X className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full aspect-[9/13] rounded-xl border-2 border-dashed border-white/15 flex flex-col items-center justify-center gap-2 text-white/30 hover:border-white/30 hover:text-white/50 transition-colors"
                    >
                      {storyType === 'video' ? <Video className="w-8 h-8" /> : <ImageIcon className="w-8 h-8" />}
                      <span className="text-xs font-bold">{storyType === 'video' ? 'Pilih Video (maks 40MB)' : 'Pilih Foto'}</span>
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={storyType === 'video' ? 'video/*' : 'image/*'}
                    onChange={pickMedia}
                    className="hidden"
                  />
                  <input
                    type="text"
                    maxLength={100}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Tambah keterangan (opsional)..."
                    className="w-full bg-[#0b0b10] border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#d4a73c]/30"
                  />
                </>
              )}

              <button
                onClick={submitStory}
                disabled={submitting}
                className="w-full bg-[#d4a73c] text-[#0b0b10] font-bold py-3 rounded-full text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Bagikan Story'}
              </button>
            </>
          ) : (
            <>
              <div className="flex items-start gap-2 bg-white/5 rounded-xl p-3">
                <MessageSquare className="w-4 h-4 text-[#d4a73c] shrink-0 mt-0.5" />
                <p className="text-white/40 text-xs leading-relaxed">
                  Catatan muncul sebagai gelembung kecil di atas avatar kamu selama 24 jam, kelihatan sama orang yang kamu follow / yang follow kamu.
                </p>
              </div>
              <textarea
                rows={2}
                maxLength={60}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Lagi mikirin apa?"
                className="w-full bg-[#0b0b10] border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#d4a73c]/30 resize-none"
              />
              <p className="text-white/20 text-[10px] text-right">{noteText.length}/60</p>
              <button
                onClick={submitNote}
                disabled={submitting}
                className="w-full bg-[#d4a73c] text-[#0b0b10] font-bold py-3 rounded-full text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simpan Catatan'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default StoryTray;
