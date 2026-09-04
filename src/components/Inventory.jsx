import React, { useEffect, useState } from 'react';
import { Sparkles, Shield, Backpack, Loader2 } from 'lucide-react';

const ICONS = { Sparkles, Shield };

const RARITY_STYLE = {
  common: 'text-white/40',
  rare: 'text-[#d4a73c]'
};

// onUsed(effectResult) dipanggil setelah item berhasil dipakai, supaya parent
// (mis. Profile.jsx) bisa refresh data user / quest / boss yang relevan.
const Inventory = ({ onUsed }) => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [using, setUsing] = useState(null);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/quests/inventory', { credentials: 'include' });
      const data = await res.json();
      if (res.ok && data.success) {
        setItems(data.items || []);
      }
    } catch (e) {
      console.error('Load inventory error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const use = async (itemId) => {
    if (using) return;
    setUsing(itemId);
    setError('');
    try {
      const res = await fetch('/api/v1/quests/use-item', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setToast(data.message || 'Item digunakan!');
        setTimeout(() => setToast(''), 3000);
        await load();
        onUsed?.(data);
      } else {
        setError(data.error || 'Gagal menggunakan item');
      }
    } catch (e) {
      console.error('Use item error:', e);
      setError('Gagal menggunakan item, coba lagi');
    } finally {
      setUsing(null);
    }
  };

  if (loading) {
    return <div className="h-24 bg-[#181820] border border-white/5 rounded-xl animate-pulse" />;
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Backpack className="w-4 h-4 text-[#d4a73c]" strokeWidth={2.5} />
        <h3 className="text-white font-black text-sm">Inventory</h3>
      </div>

      {toast && (
        <div className="mb-3 p-3 bg-[#d4a73c]/10 border border-[#d4a73c]/20 rounded-lg">
          <p className="text-[#d4a73c] font-bold text-xs">{toast}</p>
        </div>
      )}
      {error && <p className="text-red-400 text-[11px] font-medium mb-2">{error}</p>}

      {items.length === 0 ? (
        <div className="bg-[#181820] border border-white/5 rounded-xl p-6 text-center">
          <p className="text-white/30 text-xs font-medium">Belum punya item. Klaim quest buat dapat drop item acak!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {items.map((item) => {
            const Icon = ICONS[item.icon] || Sparkles;
            return (
              <div key={item.id} className="bg-[#181820] border border-white/5 rounded-xl p-3.5 flex items-center gap-3">
                <div className="w-11 h-11 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                  <Icon className={`w-5 h-5 ${RARITY_STYLE[item.rarity] || 'text-white/40'}`} strokeWidth={2.25} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-xs truncate">{item.name} <span className="text-white/30">x{item.count}</span></p>
                  <p className="text-white/30 text-[10px] font-medium truncate">{item.desc}</p>
                </div>
                <button
                  onClick={() => use(item.id)}
                  disabled={using === item.id}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-[#d4a73c] text-[#0b0b10] text-[11px] font-bold hover:bg-[#ff4e2d] active:scale-[0.98] transition-all flex items-center gap-1"
                >
                  {using === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Pakai'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Inventory;
