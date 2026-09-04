import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PartyPopper, Gift, Cake, Loader2, Check, MessageCircle, Send, ChevronDown, ChevronUp } from 'lucide-react';

const timeAgoId = (iso) => {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return 'baru saja';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m lalu`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}j lalu`;
  return `${Math.floor(diffSec / 86400)}h lalu`;
};

// Banner ulang tahun di Home. Nunjukin siapa aja yang lagi ulang tahun hari
// ini: kalau itu diri sendiri -> tombol klaim hadiah + lihat ucapan yang
// masuk; kalau orang lain -> bisa tulis ucapan pribadi (opsional) lalu kirim,
// dapat XP juga. Nggak nongol sama sekali kalau nggak ada yang ulang tahun.
const BirthdayBanner = () => {
  const navigate = useNavigate();
  const [birthdays, setBirthdays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [messageDrafts, setMessageDrafts] = useState({});
  const [receivedMessages, setReceivedMessages] = useState(null);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const load = async () => {
    try {
      const res = await fetch('/api/v1/user/birthday-today', { credentials: 'include' });
      const data = await res.json();
      if (res.ok && data.success) {
        setBirthdays(data.birthdays || []);
      }
    } catch (e) {
      console.error('Load birthday-today error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const flashToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const toggleExpand = (id) => {
    const next = expandedId === id ? null : id;
    setExpandedId(next);
    if (next && birthdays.find((b) => b.id === next)?.isSelf) {
      loadReceivedMessages();
    }
  };

  const loadReceivedMessages = async () => {
    setMessagesLoading(true);
    try {
      const res = await fetch('/api/v1/user/birthday-messages', { credentials: 'include' });
      const data = await res.json();
      if (res.ok && data.success) {
        setReceivedMessages(data.messages || []);
      }
    } catch (e) {
      console.error('Load birthday-messages error:', e);
    } finally {
      setMessagesLoading(false);
    }
  };

  const wish = async (targetId) => {
    setBusyId(targetId);
    try {
      const res = await fetch('/api/v1/user/birthday-wish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId: targetId, message: (messageDrafts[targetId] || '').trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBirthdays((prev) => prev.map((b) => (b.id === targetId ? { ...b, alreadyWished: true } : b)));
        setExpandedId(null);
        flashToast(`Ucapan terkirim! +${Math.round(data.reward / 60)} menit XP 🎉`);
      } else {
        flashToast(data.error || 'Gagal mengirim ucapan');
      }
    } catch (e) {
      console.error('Wish error:', e);
      flashToast('Gagal mengirim ucapan');
    } finally {
      setBusyId(null);
    }
  };

  const claimGift = async (selfId) => {
    setBusyId(selfId);
    try {
      const res = await fetch('/api/v1/user/birthday-claim', {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBirthdays((prev) => prev.map((b) => (b.id === selfId ? { ...b, giftClaimed: true } : b)));
        flashToast(`Hadiah ulang tahun diklaim! +${Math.round(data.reward / 60)} menit XP & 1 item 🎁`);
      } else {
        flashToast(data.error || 'Gagal klaim hadiah');
      }
    } catch (e) {
      console.error('Claim gift error:', e);
      flashToast('Gagal klaim hadiah');
    } finally {
      setBusyId(null);
    }
  };

  if (loading || birthdays.length === 0) return null;

  return (
    // pt-24 biar nggak ketutupan navbar mengambang yang posisinya fixed
    <div className="relative pt-24 overflow-visible bg-gradient-to-r from-[#2a1a2e] via-[#241a2e] to-[#1a2430] border-b border-[#d4a73c]/10">
      <div className="max-w-7xl mx-auto px-4 py-4 relative z-10">
        <div className="flex items-center gap-2 mb-3">
          <PartyPopper className="w-4 h-4 text-[#f6cf80]" strokeWidth={2.5} />
          <p className="text-[#f6cf80] text-[11px] font-black uppercase tracking-wider">
            {birthdays.length === 1 ? 'Ada yang ulang tahun hari ini!' : `${birthdays.length} orang ulang tahun hari ini!`}
          </p>
        </div>

        <div className="flex flex-wrap gap-3 items-start">
          {birthdays.map((b) => {
            const isOpen = expandedId === b.id;
            return (
              <div key={b.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden w-full sm:w-80">
                <div className="w-full flex items-center gap-2 pl-1.5 pr-2 py-1.5">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      onClick={() => navigate(`/user/${b.id}`)}
                      className="w-8 h-8 rounded-full overflow-hidden bg-[#0b0b10] shrink-0 border-2 border-[#f6cf80]/40 cursor-pointer"
                    >
                      {b.picture ? (
                        <img
                          src={b.picture}
                          referrerPolicy="no-referrer"
                          onClick={() => navigate(`/user/${b.id}`)}
                          className="w-full h-full object-cover cursor-pointer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/30 text-xs font-bold">
                          {(b.name || '?')[0]}
                        </div>
                      )}
                    </div>
                    <span className="text-white text-xs font-bold truncate flex-1">
                      {b.isSelf ? 'Kamu' : b.name} 🎂
                    </span>
                  </div>
                  <button
                    onClick={() => toggleExpand(b.id)}
                    className="shrink-0 flex items-center gap-1 text-white/40 hover:text-white p-1"
                  >
                    {b.isSelf && b.wishCount > 0 && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-[#f6cf80] bg-[#f6cf80]/10 px-2 py-0.5 rounded-full">
                        <MessageCircle className="w-3 h-3" /> {b.wishCount}
                      </span>
                    )}
                    {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {isOpen && (
                  <div className="px-3 pb-3 pt-1 border-t border-white/5">
                    {b.isSelf ? (
                      <>
                        <button
                          onClick={() => claimGift(b.id)}
                          disabled={busyId === b.id || b.giftClaimed}
                          className={`w-full mb-2 flex items-center justify-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-lg transition-all ${
                            b.giftClaimed
                              ? 'bg-white/5 text-white/30 cursor-default'
                              : 'bg-gradient-to-r from-[#f6cf80] to-[#f0b84d] text-[#0b0b10] hover:scale-[1.02]'
                          }`}
                        >
                          {busyId === b.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : b.giftClaimed ? (
                            <><Check className="w-3 h-3" strokeWidth={3} /> Hadiah Sudah Diklaim</>
                          ) : (
                            <><Gift className="w-3 h-3" /> Klaim Hadiah Ulang Tahun</>
                          )}
                        </button>

                        <p className="text-white/30 text-[10px] font-bold uppercase tracking-wider mb-1.5">Ucapan Masuk</p>
                        {messagesLoading ? (
                          <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 text-white/20 animate-spin" /></div>
                        ) : !receivedMessages || receivedMessages.length === 0 ? (
                          <p className="text-white/25 text-[11px] py-2">Belum ada ucapan masuk.</p>
                        ) : (
                          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {receivedMessages.map((m, i) => (
                              <div key={i} className="bg-black/20 rounded-lg p-2">
                                <div className="flex items-center justify-between gap-2">
                                  <button
                                    onClick={() => navigate(`/user/${m.fromId}`)}
                                    className="text-[#f6cf80] text-[11px] font-bold truncate hover:underline text-left"
                                  >
                                    {m.fromName}
                                  </button>
                                  <span className="text-white/20 text-[10px] shrink-0">{timeAgoId(m.at)}</span>
                                </div>
                                {m.message && (
                                  <p className="text-white/70 text-[11px] mt-1 leading-relaxed">{m.message}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    ) : b.alreadyWished ? (
                      <p className="text-white/40 text-[11px] flex items-center gap-1.5 py-1">
                        <Check className="w-3.5 h-3.5 text-green-400" strokeWidth={3} /> Ucapan sudah terkirim tahun ini
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <textarea
                          rows={2}
                          maxLength={200}
                          value={messageDrafts[b.id] || ''}
                          onChange={(e) => setMessageDrafts((prev) => ({ ...prev, [b.id]: e.target.value }))}
                          placeholder="Tulis ucapan (opsional)..."
                          className="w-full bg-black/20 border border-white/10 rounded-lg px-2.5 py-2 text-white text-xs outline-none focus:border-[#f6cf80]/30 resize-none"
                        />
                        <button
                          onClick={() => wish(b.id)}
                          disabled={busyId === b.id}
                          className="w-full flex items-center justify-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-lg bg-gradient-to-r from-[#ff6b9d] to-[#c471ed] text-white hover:scale-[1.02] transition-all disabled:opacity-50"
                        >
                          {busyId === b.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Send className="w-3 h-3" /> Kirim Ucapan</>}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {toast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#ff6b9d] to-[#f6cf80] text-[#0b0b10] px-6 py-3 rounded-full font-bold text-sm z-[999] shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
};

export default BirthdayBanner;
