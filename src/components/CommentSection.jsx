import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ClanBadge, { clanAvatarRingStyle } from './ClanBadge';
import { useAuth } from '../context/AuthContext';

// Uploader gambar yang sama seperti dipakai di halaman Profile (avatar/banner)
const IMAGE_UPLOAD_URL = 'https://c.termai.cc/api/upload?key=AIzaBj7z2z3xBjsk';
const MAX_IMAGE_SIZE = 8 * 1024 * 1024; // 8MB

const timeAgo = (dateString) => {
  try {
    const now = new Date();
    const date = new Date(dateString);
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return 'Baru saja';
    if (diff < 3600) return `${Math.floor(diff / 60)}m yang lalu`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}j yang lalu`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}h yang lalu`;
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '-';
  }
};

const uploadImageFile = (file) => {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', IMAGE_UPLOAD_URL, true);
    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error('Respons upload tidak valid'));
        }
      } else {
        reject(new Error(`Upload gagal: ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(formData);
  });
};

const CommentItem = ({ comment, canDelete, onDelete, deletingId, currentUser, onClaimExp, claimingId }) => {
  const [imgError, setImgError] = useState(false);
  const isDeleting = deletingId === comment.id;
  const isClaiming = claimingId === comment.id;
  const navigate = useNavigate();

  const goToProfile = () => {
    if (comment.userId) navigate(`/user/${comment.userId}`);
  };

  const drop = comment.expDrop;
  const remaining = drop ? Math.max(0, drop.maxClaims - drop.claimedCount) : 0;
  const alreadyClaimed = !!(drop && currentUser && (drop.claimedBy || []).includes(currentUser.id));
  const isOwnDrop = !!(drop && currentUser && currentUser.id === drop.giverId);
  const canClaim = drop && currentUser && !alreadyClaimed && !isOwnDrop && remaining > 0;

  return (
    <div className="flex gap-2.5 py-3 border-b border-white/5 last:border-b-0">
      <img
        src={comment.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.name || 'U')}&background=F6CF80&color=0a0a0c&size=64`}
        alt={comment.name}
        referrerPolicy="no-referrer"
        onClick={goToProfile}
        style={clanAvatarRingStyle(comment.clanBadge)}
        className={`w-8 h-8 rounded-full object-cover flex-shrink-0 bg-[#181820] ${comment.userId ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            onClick={goToProfile}
            className={`text-xs font-bold text-white/85 truncate ${comment.userId ? 'cursor-pointer hover:text-[#d4a73c] transition-colors' : ''}`}
          >
            {comment.name}
          </span>
          {comment.clanBadge && <ClanBadge badge={comment.clanBadge} />}
          <span className="text-[10px] text-white/30 flex-shrink-0">{timeAgo(comment.createdAt)}</span>
        </div>

        {comment.message && (
          <p className="text-[13px] text-white/70 mt-1 whitespace-pre-wrap break-words leading-relaxed">
            {comment.message}
          </p>
        )}

        {comment.image && !imgError && (
          <a
            href={comment.image}
            target="_blank"
            rel="noopener noreferrer"
            className="block mt-2 max-w-[220px]"
          >
            <img
              src={comment.image}
              alt="lampiran komentar"
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="rounded-lg max-h-64 w-auto object-contain bg-[#0b0b10] border border-white/10"
            />
          </a>
        )}

        {drop && (
          <div className="mt-2 bg-[#3ecf8e]/[0.06] border border-[#3ecf8e]/20 rounded-lg px-2.5 py-2 flex items-center justify-between gap-2 flex-wrap">
            <p className="text-[11px] font-bold text-[#3ecf8e] flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              +{drop.amount} EXP &middot; {remaining}/{drop.maxClaims} slot tersisa
            </p>
            {remaining <= 0 ? (
              <span className="text-[10px] font-bold text-white/25">Habis diklaim</span>
            ) : isOwnDrop ? (
              <span className="text-[10px] font-bold text-white/25">Komentarmu</span>
            ) : alreadyClaimed ? (
              <span className="text-[10px] font-bold text-white/25">Sudah kamu klaim</span>
            ) : currentUser ? (
              <button
                onClick={() => onClaimExp(comment)}
                disabled={!canClaim || isClaiming}
                className="text-[11px] font-black bg-[#3ecf8e]/15 hover:bg-[#3ecf8e]/25 text-[#3ecf8e] px-3 py-1 rounded-md disabled:opacity-40 transition-colors"
              >
                {isClaiming ? '...' : 'Klaim'}
              </button>
            ) : (
              <span className="text-[10px] font-bold text-white/25">Login buat klaim</span>
            )}
          </div>
        )}

        {canDelete && (
          <button
            onClick={() => onDelete(comment.id)}
            disabled={isDeleting}
            className="text-[10px] font-bold text-white/25 hover:text-red-400 transition-colors mt-1.5 disabled:opacity-40"
          >
            {isDeleting ? 'Menghapus...' : 'Hapus'}
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Kolom komentar yang bisa dipakai ulang di 3 tempat:
 * - Episode anime  : <CommentSection type="anime" targetId={`${slug}:${epNum}`} />
 * - Daftar chapter komik (halaman detail manga) : <CommentSection type="manga" targetId={slug} />
 * - Halaman baca per-chapter komik : <CommentSection type="chapter" targetId={chapterSlug} />
 */
const CommentSection = ({ type, targetId, title = 'Komentar' }) => {
  const { user: currentUser } = useAuth();
  const [comments, setComments] = useState([]);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [message, setMessage] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageError, setImageError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [claimingId, setClaimingId] = useState(null);

  const [giveExpOn, setGiveExpOn] = useState(false);
  const [giveExpAmount, setGiveExpAmount] = useState(20);
  const [giveExpMaxClaims, setGiveExpMaxClaims] = useState(5);

  const fileInputRef = useRef(null);

  const fetchComments = useCallback(async (nextCursor = 0, append = false) => {
    if (!type || !targetId) return;

    if (append) setIsLoadingMore(true);
    else setIsLoading(true);

    try {
      const res = await fetch(
        `/api/v1/social/comment-list?type=${encodeURIComponent(type)}&id=${encodeURIComponent(targetId)}&cursor=${nextCursor}`
      );
      const data = await res.json();

      if (data?.success) {
        setComments(prev => (append ? [...prev, ...data.comments] : data.comments));
        setTotal(data.total || 0);
        setHasMore(!!data.hasMore);
        setCursor(data.nextCursor ?? nextCursor);
      }
    } catch (e) {
      console.error('Gagal memuat komentar:', e);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [type, targetId]);

  useEffect(() => {
    setComments([]);
    setCursor(0);
    setHasMore(false);
    fetchComments(0, false);
  }, [fetchComments]);

  const handlePickImage = () => {
    if (isSubmitting) return;
    fileInputRef.current?.click();
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    e.target.value = ''; // biar bisa pilih file yang sama lagi
    if (!file) return;

    setImageError('');

    // Hanya gambar (termasuk GIF) yang diizinkan
    if (!file.type.startsWith('image/')) {
      setImageError('Cuma bisa upload gambar atau GIF');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setImageError('Ukuran gambar maksimal 8MB');
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageError('');
  };

  const handleLoginClick = () => {
    window.dispatchEvent(new CustomEvent('ndichan:open-login'));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmed = message.trim();
    if (!trimmed && !imageFile) {
      setSubmitError('Komentar tidak boleh kosong');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      let imageUrl = null;

      if (imageFile) {
        const uploadResult = await uploadImageFile(imageFile);
        if (!uploadResult?.status || !uploadResult?.path) {
          throw new Error('Upload gambar gagal');
        }
        imageUrl = uploadResult.path;
      }

      const res = await fetch('/api/v1/social/comment-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type,
          id: targetId,
          message: trimmed,
          image: imageUrl,
          giveExp: giveExpOn ? { amount: Number(giveExpAmount), maxClaims: Number(giveExpMaxClaims) } : null
        }),
      });
      const data = await res.json();

      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Gagal mengirim komentar');
      }

      setComments(prev => [data.comment, ...prev]);
      setTotal(prev => prev + 1);
      setMessage('');
      setGiveExpOn(false);
      removeImage();
    } catch (err) {
      setSubmitError(err.message || 'Gagal mengirim komentar');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (commentId) => {
    if (deletingId) return;
    setDeletingId(commentId);

    try {
      const res = await fetch('/api/v1/social/comment-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type, id: targetId, commentId }),
      });
      const data = await res.json();

      if (res.ok && data?.success) {
        setComments(prev => prev.filter(c => c.id !== commentId));
        setTotal(prev => Math.max(0, prev - 1));
      }
    } catch (e) {
      console.error('Gagal menghapus komentar:', e);
    } finally {
      setDeletingId(null);
    }
  };

  const handleClaimExp = async (comment) => {
    if (claimingId) return;
    setClaimingId(comment.id);

    try {
      const res = await fetch('/api/v1/social/comment-claim-exp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type, id: targetId, commentId: comment.id }),
      });
      const data = await res.json();

      if (res.ok && data?.success) {
        setComments(prev => prev.map(c => (c.id === comment.id ? { ...c, expDrop: data.comment.expDrop } : c)));
      } else {
        alert(data?.error || 'Gagal klaim EXP');
      }
    } catch (e) {
      console.error('Gagal klaim EXP:', e);
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <div className="mt-6">
      <h3 className="text-sm font-black text-white uppercase tracking-tight mb-3">
        {title} {total > 0 && <span className="text-white/30 font-bold">({total})</span>}
      </h3>

      {currentUser ? (
        <form onSubmit={handleSubmit} className="mb-4">
          <div className="flex gap-2.5 items-start">
            <img
              src={currentUser.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name || 'U')}&background=F6CF80&color=0a0a0c&size=64`}
              alt={currentUser.name}
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-full object-cover flex-shrink-0 bg-[#181820] mt-0.5"
            />
            <div className="flex-1 min-w-0">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tulis komentar..."
                rows={2}
                maxLength={500}
                className="w-full bg-[#181820] border border-white/10 focus:border-[#d4a73c]/50 rounded-lg px-3 py-2 text-[13px] text-white outline-none transition-colors resize-none"
              />

              {imagePreview && (
                <div className="relative inline-block mt-2">
                  <img src={imagePreview} alt="preview" className="max-h-28 rounded-lg border border-white/10" />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-black/80 text-white flex items-center justify-center text-xs"
                  >
                    ✕
                  </button>
                </div>
              )}

              {imageError && <p className="text-[11px] text-red-400 mt-1">{imageError}</p>}
              {submitError && <p className="text-[11px] text-red-400 mt-1">{submitError}</p>}

              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setGiveExpOn((v) => !v)}
                  className={`flex items-center gap-1.5 text-[11px] font-bold transition-colors ${giveExpOn ? 'text-[#3ecf8e]' : 'text-white/40 hover:text-[#3ecf8e]'}`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Sisipin EXP
                </button>

                {giveExpOn && (
                  <div className="mt-2 bg-[#3ecf8e]/[0.06] border border-[#3ecf8e]/20 rounded-lg p-2.5 flex flex-wrap items-center gap-2.5">
                    <label className="flex items-center gap-1.5 text-[11px] text-white/50">
                      EXP/klaim
                      <input
                        type="number" min={5} value={giveExpAmount}
                        onChange={(e) => setGiveExpAmount(e.target.value)}
                        className="w-16 bg-[#0b0b10] border border-white/10 rounded-md px-2 py-1 text-white text-xs outline-none"
                      />
                    </label>
                    <label className="flex items-center gap-1.5 text-[11px] text-white/50">
                      Jumlah slot
                      <input
                        type="number" min={1} value={giveExpMaxClaims}
                        onChange={(e) => setGiveExpMaxClaims(e.target.value)}
                        className="w-16 bg-[#0b0b10] border border-white/10 rounded-md px-2 py-1 text-white text-xs outline-none"
                      />
                    </label>
                    <span className="text-[10px] text-white/30">
                      Total {Number(giveExpAmount || 0) * Number(giveExpMaxClaims || 0)} EXP dipotong dari akunmu. Butuh clan &amp; gak ada batas waktu klaim.
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between mt-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={handlePickImage}
                  disabled={isSubmitting}
                  className="flex items-center gap-1 text-[11px] font-bold text-white/40 hover:text-[#d4a73c] transition-colors disabled:opacity-40"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Gambar / GIF
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || (!message.trim() && !imageFile)}
                  className="bg-[#d4a73c] text-[#141419] text-[11px] font-black px-4 py-1.5 rounded-lg disabled:opacity-40 transition-opacity"
                >
                  {isSubmitting ? 'Mengirim...' : 'Kirim'}
                </button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        <div className="mb-4 bg-[#181820] border border-white/10 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-[12px] text-white/50">Login dulu untuk ikut berkomentar.</p>
          <button
            onClick={handleLoginClick}
            className="flex-shrink-0 bg-[#d4a73c] text-[#141419] text-[11px] font-black px-3 py-1.5 rounded-lg"
          >
            Login
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-2.5 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-[#181820] flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="w-1/3 h-2.5 bg-[#181820] rounded-sm" />
                <div className="w-2/3 h-2.5 bg-[#181820] rounded-sm" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-[12px] text-white/30 text-center py-6">Belum ada komentar. Jadilah yang pertama!</p>
      ) : (
        <div>
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              canDelete={!!currentUser && (currentUser.id === comment.userId || currentUser.isAdmin)}
              onDelete={handleDelete}
              deletingId={deletingId}
              currentUser={currentUser}
              onClaimExp={handleClaimExp}
              claimingId={claimingId}
            />
          ))}

          {hasMore && (
            <button
              onClick={() => fetchComments(cursor, true)}
              disabled={isLoadingMore}
              className="w-full text-center text-[11px] font-bold text-white/40 hover:text-[#d4a73c] transition-colors py-3 disabled:opacity-40"
            >
              {isLoadingMore ? 'Memuat...' : 'Muat komentar lainnya'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default CommentSection;
