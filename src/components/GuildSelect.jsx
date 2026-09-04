import React, { useEffect, useState } from 'react';
import { Flame, Waves, Leaf, Sparkle, Check, Loader2, Shield } from 'lucide-react';

const ICONS = { Flame, Waves, Leaf, Sparkle };

// onChanged() dipanggil setelah guild berhasil diganti.
const GuildSelect = ({ onChanged }) => {
  const [loading, setLoading] = useState(true);
  const [guilds, setGuilds] = useState([]);
  const [current, setCurrent] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [guildRes, lbRes] = await Promise.all([
        fetch('/api/v1/user/guild', { credentials: 'include' }),
        fetch('/api/v1/quests/guild-leaderboard', { credentials: 'include' })
      ]);
      const guildData = await guildRes.json();
      const lbData = await lbRes.json();
      if (guildRes.ok && guildData.success) {
        setGuilds(guildData.guilds || []);
        setCurrent(guildData.currentGuild || null);
      }
      if (lbRes.ok && lbData.success) {
        setLeaderboard(lbData.leaderboard || []);
      }
    } catch (e) {
      console.error('Load guild error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const join = async (guildId) => {
    if (saving || guildId === current) return;
    setSaving(guildId);
    setError('');
    try {
      const res = await fetch('/api/v1/user/guild', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guildId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCurrent(guildId);
        onChanged?.(guildId);
      } else {
        setError(data.error || 'Gagal gabung guild');
      }
    } catch (e) {
      console.error('Join guild error:', e);
      setError('Gagal gabung guild, coba lagi');
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return <div className="h-56 bg-[#181820] border border-white/5 rounded-xl animate-pulse" />;
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Shield className="w-4 h-4 text-[#d4a73c]" strokeWidth={2.5} />
        <h3 className="text-white font-black text-sm">Guild</h3>
      </div>
      {error && <p className="text-red-400 text-[11px] font-medium mb-2">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
        {guilds.map((g) => {
          const Icon = ICONS[g.icon] || Shield;
          const active = current === g.id;
          const rank = leaderboard.findIndex((l) => l.id === g.id);
          return (
            <button
              key={g.id}
              onClick={() => join(g.id)}
              disabled={saving === g.id}
              className={`text-left p-4 rounded-xl border transition-all ${
                active ? 'border-white/25 bg-white/[0.04]' : 'bg-[#181820] border-white/5 hover:border-white/15'
              }`}
              style={active ? { borderColor: `${g.color}55`, backgroundColor: `${g.color}0f` } : undefined}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${g.color}22` }}>
                  <Icon className="w-5 h-5" style={{ color: g.color }} strokeWidth={2.25} />
                </div>
                {saving === g.id ? (
                  <Loader2 className="w-4 h-4 text-white/40 animate-spin" />
                ) : active ? (
                  <Check className="w-4 h-4" style={{ color: g.color }} strokeWidth={3} />
                ) : rank !== -1 ? (
                  <span className="text-white/25 text-[10px] font-bold">#{rank + 1}</span>
                ) : null}
              </div>
              <p className="font-bold text-sm text-white">{g.name}</p>
              <p className="text-white/30 text-[10px] font-bold uppercase tracking-wide mt-0.5">{g.tagline}</p>
            </button>
          );
        })}
      </div>

      <p className="text-white/25 text-[11px] font-bold uppercase tracking-wider mb-2">Leaderboard Guild Minggu Ini</p>
      <div className="space-y-1.5">
        {leaderboard.map((g, i) => {
          const Icon = ICONS[g.icon] || Shield;
          return (
            <div key={g.id} className="flex items-center gap-3 p-2.5 bg-[#181820] border border-white/5 rounded-lg">
              <span className="text-white/30 text-xs font-black w-4 text-center">{i + 1}</span>
              <Icon className="w-4 h-4 shrink-0" style={{ color: g.color }} strokeWidth={2.25} />
              <span className="text-white text-xs font-bold flex-1 truncate">{g.name}</span>
              <span className="text-white/40 text-xs font-bold tabular-nums">{g.damage} dmg</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GuildSelect;
