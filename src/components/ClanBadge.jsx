import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Shield, Swords, Flame, Waves, Leaf, Sparkle, Crown, Skull, Star, Moon, X, Loader2, Users, Coins } from 'lucide-react';

const ICONS = { Shield, Swords, Flame, Waves, Leaf, Sparkle, Crown, Skull, Star, Moon };
const ROLE_LABEL = { LEADER: 'Leader', VICE: 'Vice Leader', ADMIRAL: 'Admiral', OFFICER: 'Officer', MEMBER: 'Member' };

const ClanIcon = ({ icon, className, style }) => {
  if (typeof icon === 'string' && /^https?:\/\//.test(icon)) {
    return <img src={icon} alt="" className={`${className} object-cover rounded-md`} style={style} />;
  }
  const IconEl = ICONS[icon] || Shield;
  return <IconEl className={className} style={style} strokeWidth={2.25} />;
};

// Bingkai emblem clan (bagian dari sistem "clan emblem builder" -- lihat
// halaman Clan). Disamain persis sama helper di Clan.jsx biar konsisten.
const emblemFrameStyle = (frame, color) => {
  switch (frame) {
    case 'double':
      return { border: `2px solid ${color}`, boxShadow: `0 0 0 3px #0a0a0c, 0 0 0 4.5px ${color}66` };
    case 'notch':
      return { border: `1.5px solid ${color}99`, clipPath: 'polygon(16% 0%, 100% 0%, 100% 84%, 84% 100%, 0% 100%, 0% 16%)' };
    case 'dashed':
      return { border: `2px dashed ${color}bb` };
    case 'glow':
      return { border: `1px solid ${color}`, boxShadow: `0 0 14px ${color}99` };
    default:
      return { border: '1px solid rgba(255,255,255,0.2)' };
  }
};

// Ring warna clan buat avatar -- dipake di Chat/Komentar/Profil biar identitas
// clan langsung keliatan dari foto profilnya, bukan cuma dari badge kecil.
// Cukup di-spread ke `style` prop <img> avatar yang udah ada.
export const clanAvatarRingStyle = (badge) => (
  badge ? { boxShadow: `0 0 0 2px ${badge.color}, 0 0 0 4px rgba(0,0,0,0.3)` } : {}
);

// Badge kecil (tag + icon + level) yang bisa diklik buat buka detail clan.
const ClanBadge = ({ badge, size = 'sm' }) => {
  const [open, setOpen] = useState(false);
  if (!badge) return null;

  const isSm = size === 'sm';
  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        title={badge.name}
        className={`inline-flex items-center gap-1 rounded-full border shrink-0 transition-transform hover:scale-105 ${isSm ? 'px-1.5 py-0.5' : 'px-2 py-1'}`}
        style={{ backgroundColor: `${badge.color}1a`, borderColor: `${badge.color}40` }}
      >
        <ClanIcon icon={badge.icon} className={isSm ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'} style={{ color: badge.color }} />
        <span className={`font-black ${isSm ? 'text-[9px]' : 'text-[11px]'}`} style={{ color: badge.color }}>
          {badge.tag}
        </span>
        <span className={`font-bold text-white/40 ${isSm ? 'text-[8px]' : 'text-[10px]'}`}>Lv.{badge.level}</span>
      </button>
      {open && <ClanDetailModal clanId={badge.clanId} onClose={() => setOpen(false)} />}
    </>
  );
};

// Modal klik badge: nampilin banner waifu aktif di header, posisi bisa di-set.
export const ClanDetailModal = ({ clanId, onClose }) => {
  const [clan, setClan] = useState(null);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/clan/detail?id=${encodeURIComponent(clanId)}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => { if (!cancelled) { setClan(data.success ? data.clan : null); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [clanId]);

  const bannerUrl = clan?.activeBanner?.url || null;
  const bannerPos = clan?.bannerPosition || '50% 50%';
  const color = clan?.color || '#d4a73c';

  // Portal ke document.body -- badge ini sering dipasang di dalam kartu yang
  // punya clip-path (mis. card-cut di halaman Profile), dan clip-path bikin
  // containing block baru buat elemen position:fixed. Tanpa portal, modal ini
  // bakal ke-jebak/ke-clip di dalam kartu itu alih-alih nutupin seluruh layar.
  return createPortal(
    <div
      className="fixed inset-0 z-[999] bg-[#0b0b10]/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      style={{ animation: 'fadeIn 0.15s ease-out' }}
    >
      <div
        className="bg-[#181820] border border-white/10 rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute right-4 top-4 z-20 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center text-white/60 hover:text-white">
          <X className="w-4 h-4" />
        </button>

        {loading ? (
          <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 text-white/30 animate-spin" /></div>
        ) : !clan ? (
          <p className="text-white/40 text-sm text-center py-10">Clan tidak ditemukan.</p>
        ) : (
          <>
            {/* ===== HEADER: banner waifu + overlay + icon/nama ===== */}
            <div className="relative h-36 overflow-hidden">
              {bannerUrl ? (
                <img
                  src={bannerUrl}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ objectPosition: bannerPos }}
                />
              ) : (
                <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${color}33, ${color}11)` }} />
              )}
              {/* gradient overlay biar teks kebaca */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#181820] via-[#181820]/30 to-transparent" />

              {/* icon + nama di atas banner */}
              <div className="absolute bottom-4 left-4 flex items-end gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg bg-black/40 backdrop-blur-sm shrink-0"
                  style={emblemFrameStyle(clan.frame, color)}
                >
                  <ClanIcon icon={clan.icon} className="w-7 h-7" style={{ color }} />
                </div>
                <div>
                  <p className="text-white font-black text-base drop-shadow flex items-center gap-1.5 flex-wrap">
                    {clan.name} <span className="text-white/50 font-bold text-xs">[{clan.tag}]</span>
                    {clan.milestone && (
                      <span className="text-[9px] font-black text-white bg-black/40 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                        <ClanIcon icon={clan.milestone.icon} className="w-2.5 h-2.5" style={{ color: '#d4a73c' }} /> {clan.milestone.label}
                      </span>
                    )}
                  </p>
                  <p className="text-white/50 text-xs drop-shadow">Level {clan.level}{clan.rank ? ` · Rank #${clan.rank}` : ''}</p>
                </div>
              </div>
            </div>

            {clan.desc && (
              <div className="px-4 pt-3">
                <p className="text-white/50 text-xs leading-relaxed">{clan.desc}</p>
              </div>
            )}

            <div className="p-4 grid grid-cols-2 gap-3">
              <div className="bg-white/[0.04] rounded-xl p-3 text-center">
                <Users className="w-4 h-4 text-white/40 mx-auto mb-1" />
                <p className="text-white font-bold text-sm">{clan.memberCount}/{clan.capacity}</p>
                <p className="text-white/30 text-[10px] font-bold uppercase">Member</p>
              </div>
              <div className="bg-white/[0.04] rounded-xl p-3 text-center">
                <Coins className="w-4 h-4 text-[#d4a73c] mx-auto mb-1" />
                <p className="text-white font-bold text-sm">{clan.treasury}</p>
                <p className="text-white/30 text-[10px] font-bold uppercase">Harta</p>
              </div>
            </div>

            {clan.members?.length > 0 && (
              <div className="px-4 pb-4">
                <p className="text-white/30 text-[10px] font-bold uppercase tracking-wide mb-2">Top Member</p>
                <div className="space-y-1.5">
                  {clan.members.slice(0, 5).map((m) => (
                    <div key={m.id} className="flex items-center gap-2">
                      <img src={m.picture || '/favicon.svg'} className="w-6 h-6 rounded-full object-cover shrink-0" />
                      <p className="text-white/70 text-xs truncate flex-1">{m.name}</p>
                      <span className="text-white/30 text-[10px] font-bold shrink-0">{ROLE_LABEL[m.role]}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>,
    document.body
  );
};

export default ClanBadge;

// Modal "Give EXP" langsung ke satu user (dipasang di halaman profil orang
// lain). Bisa ke siapa aja -- termasuk member clan sendiri -- beda dari drop
// EXP di komentar yang emang khusus buat orang di luar clan.
export const GiveExpModal = ({ targetUserId, targetName, onClose, onSuccess }) => {
  const [amount, setAmount] = useState(20);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const send = async () => {
    const amt = parseInt(amount, 10);
    if (!amt || amt <= 0) return;
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/v1/clan/give-exp-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ targetUserId, amount: amt }),
      });
      const data = await res.json();
      if (data.success) {
        onSuccess?.(data);
        onClose();
      } else {
        setError(data.error || 'Gagal give EXP');
      }
    } catch {
      setError('Terjadi kesalahan, coba lagi');
    } finally {
      setSending(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[999] bg-[#0b0b10]/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      style={{ animation: 'fadeIn 0.15s ease-out' }}
    >
      <div
        className="bg-[#181820] border border-white/10 rounded-2xl max-w-xs w-full shadow-2xl p-5 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute right-4 top-4 text-white/30 hover:text-white">
          <X className="w-4 h-4" />
        </button>

        <p className="text-white font-black text-sm flex items-center gap-1.5">
          <svg className="w-4 h-4 text-[#3ecf8e]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Give EXP ke {targetName || 'user ini'}
        </p>
        <p className="text-white/40 text-xs mt-1.5 mb-3">EXP dipotong dari akunmu sendiri dan langsung masuk ke akun mereka. Clan kamu tetap kebagian harta &amp; XP.</p>

        <label className="text-white/50 text-[11px] font-bold block mb-1">Jumlah EXP</label>
        <input
          type="number" min={5} value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full bg-[#0b0b10] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none mb-3"
        />

        {error && <p className="text-red-400 text-[11px] font-semibold mb-3">{error}</p>}

        <button
          onClick={send} disabled={sending}
          className="w-full py-2.5 rounded-lg text-xs font-bold bg-[#3ecf8e] text-[#0b0b10] disabled:opacity-40 flex items-center justify-center gap-1.5"
        >
          {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Kirim EXP'}
        </button>
      </div>
    </div>,
    document.body
  );
};
