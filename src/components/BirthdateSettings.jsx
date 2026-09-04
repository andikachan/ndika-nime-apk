import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cake, Lock, Check, Loader2, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react';

const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const formatDateId = (dateStr) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${d} ${MONTHS_ID[m - 1]} ${y}`;
};

const timeAgoId = (iso) => {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return 'baru saja';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m lalu`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}j lalu`;
  return `${Math.floor(diffSec / 86400)}h lalu`;
};

// Kartu pengaturan tanggal lahir. Sekali dikonfirmasi, tanggal terkunci
// selamanya (backend menolak perubahan lebih lanjut) — supaya deteksi
// ulang tahun di halaman Home tidak bisa diakal-akalin. Juga nampilin
// ucapan ulang tahun yang sudah masuk tahun ini (bisa dilihat kapan saja,
// nggak cuma pas hari-H lewat banner di Home).
const BirthdateSettings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [birthDate, setBirthDate] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [draft, setDraft] = useState('');
  const [showConfirmStep, setShowConfirmStep] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [showMessages, setShowMessages] = useState(false);
  const [messages, setMessages] = useState(null);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/user/birthdate', { credentials: 'include' });
      const data = await res.json();
      if (res.ok && data.success) {
        setBirthDate(data.birthDate || '');
        setConfirmed(!!data.confirmed);
        setDraft(data.birthDate || '');
      }
    } catch (e) {
      console.error('Load birthdate error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const saveDraft = async (e) => {
    e.preventDefault();
    if (!draft) return;
    setError('');
    setSaving(true);
    try {
      const res = await fetch('/api/v1/user/birthdate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ birthDate: draft })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBirthDate(data.birthDate);
        setShowConfirmStep(true);
      } else {
        setError(data.error || 'Gagal menyimpan tanggal lahir');
      }
    } catch (e) {
      console.error('Save birthdate error:', e);
      setError('Gagal menyimpan tanggal lahir');
    } finally {
      setSaving(false);
    }
  };

  const confirmLock = async () => {
    setError('');
    setSaving(true);
    try {
      const res = await fetch('/api/v1/user/birthdate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ birthDate, confirm: true })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setConfirmed(true);
        setShowConfirmStep(false);
      } else {
        setError(data.error || 'Gagal mengonfirmasi tanggal lahir');
      }
    } catch (e) {
      console.error('Confirm birthdate error:', e);
      setError('Gagal mengonfirmasi tanggal lahir');
    } finally {
      setSaving(false);
    }
  };

  const loadMessages = async () => {
    setMessagesLoading(true);
    try {
      const res = await fetch('/api/v1/user/birthday-messages', { credentials: 'include' });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessages(data.messages || []);
      }
    } catch (e) {
      console.error('Load birthday messages error:', e);
    } finally {
      setMessagesLoading(false);
    }
  };

  const toggleMessages = () => {
    const next = !showMessages;
    setShowMessages(next);
    if (next && messages === null) {
      loadMessages();
    }
  };

  if (loading) {
    return (
      <div className="bg-[#181820] border border-white/5 rounded-xl p-4 flex items-center justify-center h-24">
        <Loader2 className="w-5 h-5 text-white/20 animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-[#181820] border border-white/5 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <Cake className="w-4 h-4 text-[#d4a73c]" strokeWidth={2.5} />
        <h3 className="text-white font-bold text-sm">Tanggal Lahir</h3>
      </div>

      {confirmed ? (
        <>
          <div className="flex items-center justify-between mt-2">
            <div>
              <p className="text-white font-bold text-sm">{formatDateId(birthDate)}</p>
              <p className="text-white/30 text-[11px] mt-0.5">Sudah dikonfirmasi & terkunci</p>
            </div>
            <Lock className="w-4 h-4 text-white/20 shrink-0" />
          </div>

          <button
            onClick={toggleMessages}
            className="w-full flex items-center justify-between mt-3 pt-3 border-t border-white/5 text-white/50 hover:text-white text-xs font-bold transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <MessageCircle className="w-3.5 h-3.5" /> Ucapan Ulang Tahun{messages ? ` (${messages.length})` : ''}
            </span>
            {showMessages ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showMessages && (
            messagesLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 text-white/20 animate-spin" /></div>
            ) : !messages || messages.length === 0 ? (
              <p className="text-white/25 text-[11px] py-3 text-center">Belum ada ucapan tahun ini.</p>
            ) : (
              <div className="space-y-2 mt-2 max-h-64 overflow-y-auto pr-1">
                {messages.map((m, i) => (
                  <div key={i} className="bg-[#0b0b10] border border-white/5 rounded-lg p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => navigate(`/user/${m.fromId}`)}
                        className="text-[#d4a73c] text-xs font-bold truncate hover:underline text-left"
                      >
                        {m.fromName}
                      </button>
                      <span className="text-white/20 text-[10px] shrink-0">{timeAgoId(m.at)}</span>
                    </div>
                    {m.message && (
                      <p className="text-white/60 text-xs mt-1 leading-relaxed">{m.message}</p>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
        </>
      ) : showConfirmStep ? (
        <div className="mt-2 space-y-3">
          <p className="text-white/50 text-xs">
            Pastikan tanggalnya benar: <span className="text-[#d4a73c] font-bold">{formatDateId(birthDate)}</span>.
            Setelah dikonfirmasi, tanggal ini <b className="text-white">tidak bisa diubah lagi</b>.
          </p>
          {error && <p className="text-red-400 text-[11px] font-medium">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={confirmLock}
              disabled={saving}
              className="flex-1 bg-[#d4a73c] text-[#0b0b10] font-bold text-xs py-2.5 rounded-lg hover:bg-[#ff4e2d] transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" strokeWidth={3} />}
              Konfirmasi & Kunci
            </button>
            <button
              onClick={() => setShowConfirmStep(false)}
              disabled={saving}
              className="px-4 bg-white/5 text-white/50 font-bold text-xs py-2.5 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              Ubah Lagi
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={saveDraft} className="mt-2 space-y-3">
          <p className="text-white/40 text-[11px]">
            Isi sekali dan konfirmasi untuk dapat ucapan &amp; hadiah ulang tahun spesial dari Ndichan tiap tahun 🎂
          </p>
          {error && <p className="text-red-400 text-[11px] font-medium">{error}</p>}
          <div className="flex gap-2">
            <input
              type="date"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              required
              className="flex-1 bg-[#0b0b10] border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#d4a73c]/30 [color-scheme:dark]"
            />
            <button
              type="submit"
              disabled={saving || !draft}
              className="bg-[#d4a73c] text-[#0b0b10] font-bold text-xs px-4 rounded-lg hover:bg-[#ff4e2d] transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Simpan'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default BirthdateSettings;
