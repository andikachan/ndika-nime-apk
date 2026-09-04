import React, { useEffect, useState } from 'react';
import { Swords, BookOpenCheck, Heart, Check, Loader2 } from 'lucide-react';

const ICONS = { Swords, BookOpenCheck, Heart };

// onChanged() dipanggil setelah class berhasil diganti, supaya parent bisa
// refresh data lain yang bergantung ke class (mis. bonus reward di QuestLog).
const ClassSelect = ({ onChanged }) => {
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]);
  const [current, setCurrent] = useState(null);
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/user/class', { credentials: 'include' });
      const data = await res.json();
      if (res.ok && data.success) {
        setClasses(data.classes || []);
        setCurrent(data.currentClass || null);
      }
    } catch (e) {
      console.error('Load class error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const pick = async (classId) => {
    if (saving || classId === current) return;
    setSaving(classId);
    setError('');
    try {
      const res = await fetch('/api/v1/user/class', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCurrent(classId);
        onChanged?.(classId);
      } else {
        setError(data.error || 'Gagal memilih class');
      }
    } catch (e) {
      console.error('Pick class error:', e);
      setError('Gagal memilih class, coba lagi');
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-[#181820] border border-white/5 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-black text-sm">Pilih Class</h3>
        {current && <span className="text-white/30 text-[11px] font-medium">Bisa ganti kapan saja</span>}
      </div>
      {error && <p className="text-red-400 text-[11px] font-medium mb-2">{error}</p>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {classes.map((c) => {
          const Icon = ICONS[c.icon] || Swords;
          const active = current === c.id;
          return (
            <button
              key={c.id}
              onClick={() => pick(c.id)}
              disabled={saving === c.id}
              className={`text-left p-4 rounded-xl border transition-all ${
                active
                  ? 'bg-[#d4a73c]/[0.08] border-[#d4a73c]/30'
                  : 'bg-[#181820] border-white/5 hover:border-white/15'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${active ? 'bg-[#d4a73c]/15' : 'bg-white/5'}`}>
                  <Icon className={`w-5 h-5 ${active ? 'text-[#d4a73c]' : 'text-white/50'}`} strokeWidth={2.25} />
                </div>
                {saving === c.id ? (
                  <Loader2 className="w-4 h-4 text-white/40 animate-spin" />
                ) : active ? (
                  <Check className="w-4 h-4 text-[#d4a73c]" strokeWidth={3} />
                ) : null}
              </div>
              <p className={`font-bold text-sm ${active ? 'text-[#d4a73c]' : 'text-white'}`}>{c.name}</p>
              <p className="text-white/30 text-[10px] font-bold uppercase tracking-wide mt-0.5">{c.tagline}</p>
              <p className="text-white/40 text-[11px] font-medium mt-2">{c.desc}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ClassSelect;
