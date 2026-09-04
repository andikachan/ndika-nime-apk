import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Swords, Flame, Waves, Leaf, Sparkle, Crown, Skull, Star, Moon,
  Users, Search, Plus, Check, X, Loader2, Gift, Coins, Send, Sparkles, Zap,
  ChevronRight, LogOut, UserMinus, ArrowUpCircle, ArrowDownCircle, Settings,
  Lock, Globe, MailQuestion, Dices, Crown as CrownIcon, Clock, Mail, Image as ImageIcon, Tag
} from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { setSeoMeta, SITE_URL } from '../utils/seo';
import { useAuth } from '../context/AuthContext';
import { useAdaptiveInterval } from '../hooks/useAdaptiveInterval';

const GOLD = '#d4a73c';
const GACHA_COST_PER_PULL = 1200;
const IMAGE_UPLOAD_URL = 'https://c.termai.cc/api/upload?key=AIzaBj7z2z3xBjsk';

const uploadImageFile = (file) => {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', IMAGE_UPLOAD_URL, true);
    xhr.onload = () => {
      if (xhr.status === 200) {
        try { resolve(JSON.parse(xhr.responseText)); } catch { reject(new Error('Respons upload tidak valid')); }
      } else reject(new Error(`Upload gagal: ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(formData);
  });
};
const ICONS = { Shield, Swords, Flame, Waves, Leaf, Sparkle, Crown, Skull, Star, Moon };
const ROLE_LABEL = { LEADER: 'Leader', VICE: 'Vice Leader', ADMIRAL: 'Admiral', OFFICER: 'Officer', MEMBER: 'Member' };
const ROLE_ORDER = ['LEADER', 'VICE', 'ADMIRAL', 'OFFICER', 'MEMBER'];
const JOIN_TYPE_LABEL = { public: 'Public', approval: 'Approval', invite: 'Invite Only' };
const JOIN_TYPE_ICON = { public: Globe, approval: MailQuestion, invite: Lock };
const RARITY_COLOR = { normal: 'rgba(255,255,255,0.5)', rare: '#4f9df5', epic: '#b57bf5', legendary: GOLD, mythic: '#ec4899' };

const fetchJson = async (url, opts) => {
  const res = await fetch(url, { credentials: 'include', ...opts });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
};

const post = (action, body) => fetchJson(`/api/v1/clan/${action}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body || {})
});

// ===== SMALL UI HELPERS =====
const ClanIcon = ({ icon, className, style }) => {
  if (typeof icon === 'string' && /^https?:\/\//.test(icon)) {
    return <img src={icon} alt="" className={`${className} object-cover rounded-md`} style={style} />;
  }
  const Icon = ICONS[icon] || Shield;
  return <Icon className={className} style={style} strokeWidth={2.25} />;
};

// ===== EMBLEM FRAME (bagian dari "clan emblem builder": icon + warna + bingkai) =====
const FRAME_LABEL = { ring: 'Ring', double: 'Double', notch: 'Notch', dashed: 'Dashed', glow: 'Glow' };
const CLAN_FRAMES_FALLBACK = ['ring', 'double', 'notch', 'dashed', 'glow'];
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
      return { border: '1px solid rgba(255,255,255,0.12)', boxShadow: `0 0 0 2px ${color}33` };
  }
};

// Badge icon clan dengan bingkai custom -- dipakai di header clan, kartu war,
// dan mana pun icon clan perlu ditampilkan konsisten dengan emblem-nya.
const ClanEmblem = ({ clan, size = 'w-16 h-16', iconSize = 'w-8 h-8', rounded = 'rounded-2xl' }) => (
  <div
    className={`${size} ${rounded} flex items-center justify-center shrink-0 bg-black/30`}
    style={emblemFrameStyle(clan.frame, clan.color)}
  >
    <ClanIcon icon={clan.icon} className={iconSize} style={{ color: clan.color }} />
  </div>
);

const Bar = ({ pct, color = GOLD }) => (
  <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color }} />
  </div>
);

const CountdownText = ({ seconds }) => {
  const [left, setLeft] = useState(seconds);
  useEffect(() => { setLeft(seconds); }, [seconds]);
  useEffect(() => {
    if (left <= 0) return;
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [left > 0]);

  const h = Math.floor(left / 3600);
  const m = Math.floor((left % 3600) / 60);
  const s = left % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return <span className="text-white/60 font-black">{h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`}</span>;
};

const Toast = ({ message, type }) =>
  message ? (
    <div
      className={`fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-[200] px-4 py-2.5 rounded-xl text-sm font-bold shadow-2xl ${
        type === 'error' ? 'bg-red-500/90 text-white' : 'bg-[#d4a73c] text-[#141419]'
      }`}
      style={{ animation: 'fadeScale 0.15s ease-out' }}
    >
      {message}
    </div>
  ) : null;

// ================= BROWSE / CREATE (belum punya clan) =================
const CreateClanForm = ({ meta, onCreated, notify }) => {
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [desc, setDesc] = useState('');
  const [icon, setIcon] = useState('Shield');
  const [color, setColor] = useState(GOLD);
  const [frame, setFrame] = useState('ring');
  const [joinType, setJoinType] = useState('public');
  const [minLevel, setMinLevel] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const iconFileRef = useRef(null);

  const handleIconFile = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { notify('Cuma bisa upload gambar', 'error'); return; }
    if (file.size > 8 * 1024 * 1024) { notify('Ukuran gambar maksimal 8MB', 'error'); return; }

    setUploadingIcon(true);
    try {
      const result = await uploadImageFile(file);
      if (!result?.status || !result?.path) throw new Error('Upload gagal');
      setIcon(result.path);
    } catch (err) {
      notify(err.message || 'Gagal upload foto icon', 'error');
    } finally {
      setUploadingIcon(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    const { data } = await post('create', { name, tag, desc, icon, color, frame, joinType, minLevel: parseInt(minLevel, 10) || 0 });
    setSaving(false);
    if (data.success) {
      notify('Clan berhasil dibuat!');
      onCreated(data.clan);
    } else {
      notify(data.error || 'Gagal membuat clan', 'error');
    }
  };

  return (
    <form onSubmit={submit} className="bg-[#181820] border border-white/5 rounded-2xl p-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-white/50 text-xs font-bold uppercase tracking-wide">Nama Clan</label>
          <input
            value={name} onChange={(e) => setName(e.target.value)} maxLength={24} required
            placeholder="Contoh: Klan Otaku Sejati"
            className="mt-1.5 w-full bg-[#0b0b10] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-[#d4a73c]/50"
          />
        </div>
        <div>
          <label className="text-white/50 text-xs font-bold uppercase tracking-wide">Tag (2-5 karakter)</label>
          <input
            value={tag} onChange={(e) => setTag(e.target.value.toUpperCase())} maxLength={5} required
            placeholder="OTKU"
            className="mt-1.5 w-full bg-[#0b0b10] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-[#d4a73c]/50 uppercase"
          />
        </div>
      </div>

      <div>
        <label className="text-white/50 text-xs font-bold uppercase tracking-wide">Deskripsi</label>
        <textarea
          value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={140} rows={2}
          placeholder="Ceritain clan kamu selera anime apa..."
          className="mt-1.5 w-full bg-[#0b0b10] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-[#d4a73c]/50 resize-none"
        />
      </div>

      <div>
        <label className="text-white/50 text-xs font-bold uppercase tracking-wide mb-1.5 block">Icon</label>
        <div className="flex flex-wrap gap-2 items-center">
          {(meta.icons || Object.keys(ICONS)).map((id) => (
            <button
              type="button" key={id} onClick={() => setIcon(id)}
              className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-colors ${icon === id ? 'border-[#d4a73c] bg-[#d4a73c]/10' : 'border-white/10 bg-white/[0.03]'}`}
            >
              <ClanIcon icon={id} className="w-4 h-4" style={{ color: icon === id ? GOLD : 'rgba(255,255,255,0.5)' }} />
            </button>
          ))}
          <input ref={iconFileRef} type="file" accept="image/*" onChange={handleIconFile} className="hidden" />
          <button
            type="button" onClick={() => iconFileRef.current?.click()} disabled={uploadingIcon}
            className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-colors overflow-hidden ${
              /^https?:\/\//.test(icon) ? 'border-[#d4a73c]' : 'border-dashed border-white/20 hover:border-white/40'
            }`}
            title="Upload foto sendiri"
          >
            {uploadingIcon ? (
              <Loader2 className="w-4 h-4 text-white/40 animate-spin" />
            ) : /^https?:\/\//.test(icon) ? (
              <img src={icon} alt="" className="w-full h-full object-cover" />
            ) : (
              <Plus className="w-4 h-4 text-white/40" />
            )}
          </button>
        </div>
        <p className="text-white/25 text-[10px] mt-1.5">Pilih salah satu icon di atas, atau upload foto sendiri (JPG/PNG, maks 8MB).</p>
      </div>

      <div>
        <label className="text-white/50 text-xs font-bold uppercase tracking-wide mb-1.5 block">Warna</label>
        <div className="flex flex-wrap gap-2">
          {(meta.colors || [GOLD]).map((c) => (
            <button
              type="button" key={c} onClick={() => setColor(c)}
              className="w-8 h-8 rounded-full border-2 transition-transform"
              style={{ backgroundColor: c, borderColor: color === c ? '#fff' : 'transparent', transform: color === c ? 'scale(1.1)' : 'scale(1)' }}
            />
          ))}
        </div>
      </div>

      <div>
        <label className="text-white/50 text-xs font-bold uppercase tracking-wide mb-1.5 block">Bingkai Emblem</label>
        <div className="flex flex-wrap gap-2">
          {(meta.frames || CLAN_FRAMES_FALLBACK).map((f) => (
            <button
              type="button" key={f} onClick={() => setFrame(f)}
              className={`w-11 h-11 rounded-xl flex items-center justify-center bg-black/30 ${frame === f ? 'ring-2 ring-[#d4a73c]' : ''}`}
              style={emblemFrameStyle(f, color)}
              title={FRAME_LABEL[f] || f}
            >
              <ClanIcon icon={icon} className="w-4 h-4" style={{ color }} />
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-white/50 text-xs font-bold uppercase tracking-wide mb-1.5 block">Cara Masuk</label>
          <div className="flex gap-1.5 bg-[#0b0b10] p-1 rounded-lg border border-white/10">
            {['public', 'approval', 'invite'].map((jt) => (
              <button
                type="button" key={jt} onClick={() => setJoinType(jt)}
                className={`flex-1 py-1.5 rounded-md text-[11px] font-bold transition-colors ${joinType === jt ? 'bg-[#d4a73c] text-[#141419]' : 'text-white/40 hover:text-white'}`}
              >
                {JOIN_TYPE_LABEL[jt]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-white/50 text-xs font-bold uppercase tracking-wide">Min. Level Akun</label>
          <input
            type="number" min={0} value={minLevel} onChange={(e) => setMinLevel(e.target.value)}
            className="mt-1.5 w-full bg-[#0b0b10] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-[#d4a73c]/50"
          />
        </div>
      </div>

      <button
        type="submit" disabled={saving}
        className="w-full bg-[#d4a73c] hover:bg-[#e0b34f] text-[#141419] font-black py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-60"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" strokeWidth={3} />}
        Buat Clan
      </button>
    </form>
  );
};

const ClanBrowseCard = ({ clan, onAction, actingId, myInvite }) => {
  const JoinIcon = JOIN_TYPE_ICON[clan.joinType] || Globe;
  const full = clan.memberCount >= clan.capacity;
  const bannerUrl = clan.activeBanner?.url || null;
  return (
    <div className="bg-[#181820] border border-white/5 rounded-xl overflow-hidden flex flex-col">
      <div className="relative h-28">
        {bannerUrl ? (
          <img
            src={bannerUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ objectPosition: clan.bannerPosition || '50% 50%' }}
          />
        ) : (
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${clan.color}33, ${clan.color}0a)` }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#181820] via-[#181820]/30 to-transparent" />
        {clan.rank && (
          <div
            className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shadow ${
              clan.rank === 1 ? 'bg-[#ffd54f] text-[#141419]' :
              clan.rank === 2 ? 'bg-[#cfd8dc] text-[#141419]' :
              clan.rank === 3 ? 'bg-[#d7a06e] text-[#141419]' :
              'bg-black/50 text-white/70'
            }`}
          >
            {clan.rank <= 3 ? <CrownIcon className="w-3.5 h-3.5" /> : `#${clan.rank}`}
          </div>
        )}
        {clan.milestone && (
          <div
            className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm"
            title={`Milestone: ${clan.milestone.label}`}
          >
            <ClanIcon icon={clan.milestone.icon} className="w-3 h-3" style={{ color: GOLD }} />
            <span className="text-[9px] font-black text-white/80">{clan.milestone.label}</span>
          </div>
        )}
        <div
          className="absolute -bottom-6 left-3 w-16 h-16 rounded-xl flex items-center justify-center shrink-0 border-2 border-[#181820] shadow-md"
          style={{ backgroundColor: bannerUrl ? '#0b0b10' : `${clan.color}22` }}
        >
          <ClanIcon icon={clan.icon} className="w-7 h-7" style={{ color: clan.color }} />
        </div>
      </div>
      <div className="p-4 pt-8 flex flex-col gap-3 flex-1">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-white font-bold text-sm truncate">{clan.name}</p>
            <span className="text-white/30 text-[10px] font-bold shrink-0">[{clan.tag}]</span>
          </div>
          <p className="text-white/35 text-[11px] font-semibold flex items-center gap-1 mt-0.5">
            <JoinIcon className="w-3 h-3" /> {JOIN_TYPE_LABEL[clan.joinType]} &middot; Lv.{clan.level} &middot; {clan.memberCount}/{clan.capacity}
          </p>
        </div>
        {clan.desc && <p className="text-white/40 text-xs line-clamp-2">{clan.desc}</p>}
        <button
          onClick={() => onAction(clan)}
          disabled={actingId === clan.id || (clan.joinType === 'public' && full)}
          className="w-full py-2 rounded-lg text-xs font-bold transition-colors bg-white/[0.05] hover:bg-white/[0.1] text-white border border-white/10 disabled:opacity-40 flex items-center justify-center gap-1.5 mt-auto"
        >
          {actingId === clan.id ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : clan.joinType === 'public' ? (
            full ? 'Slot Penuh' : 'Gabung'
          ) : clan.joinType === 'approval' ? (
            'Kirim Request'
          ) : (
            'Invite Only'
          )}
        </button>
      </div>
    </div>
  );
};

const NoClanView = ({ meta, user, onJoined, notify }) => {
  const [tab, setTab] = useState('browse'); // 'browse' | 'create'
  const [clans, setClans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('level');
  const [actingId, setActingId] = useState(null);
  const [invites, setInvites] = useState([]);
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [joiningByCode, setJoiningByCode] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('invite');
    if (code) setInviteCodeInput(code.toUpperCase());
  }, []);

  const joinByCode = async () => {
    if (!inviteCodeInput.trim()) return;
    setJoiningByCode(true);
    const { data } = await post('join-by-code', { code: inviteCodeInput.trim() });
    setJoiningByCode(false);
    if (data.success) { notify(`Berhasil gabung ${data.clanName}!`); onJoined(); }
    else notify(data.error || 'Gagal gabung', 'error');
  };

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: listData }, { data: invData }] = await Promise.all([
      fetchJson(`/api/v1/clan/list?q=${encodeURIComponent(q)}&sort=${sort}`),
      fetchJson('/api/v1/clan/invites')
    ]);
    if (listData.success) setClans(listData.clans || []);
    if (invData.success) setInvites(invData.invites || []);
    setLoading(false);
  }, [q, sort]);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (clan) => {
    setActingId(clan.id);
    let res;
    if (clan.joinType === 'public') res = await post('join', { clanId: clan.id });
    else if (clan.joinType === 'approval') res = await post('request', { clanId: clan.id });
    else { setActingId(null); return; }

    if (res.data.success) {
      notify(clan.joinType === 'public' ? `Berhasil gabung ${clan.name}!` : 'Request terkirim, tunggu approval ya');
      if (clan.joinType === 'public') onJoined();
      else load();
    } else {
      notify(res.data.error || 'Gagal', 'error');
    }
    setActingId(null);
  };

  const respondInvite = async (clanId, accept) => {
    const { data } = await post(accept ? 'accept-invite' : 'decline-invite', { clanId });
    if (data.success) {
      notify(accept ? 'Berhasil gabung clan!' : 'Undangan ditolak');
      if (accept) onJoined();
      else load();
    } else notify(data.error || 'Gagal', 'error');
  };

  return (
    <div className="space-y-5">
      {invites.length > 0 && (
        <div className="bg-[#181820] border border-[#d4a73c]/25 rounded-xl p-4">
          <p className="text-[#d4a73c] text-xs font-black uppercase tracking-wide mb-2.5 flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5" /> Undangan Clan
          </p>
          <div className="space-y-2">
            {invites.map((inv) => (
              <div key={inv.clanId} className="flex items-center gap-3 bg-white/[0.03] rounded-lg p-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${inv.color}22` }}>
                  <ClanIcon icon={inv.icon} className="w-4 h-4" style={{ color: inv.color }} />
                </div>
                <p className="flex-1 text-white text-xs font-bold truncate">{inv.name} <span className="text-white/30">[{inv.tag}]</span></p>
                <button onClick={() => respondInvite(inv.clanId, true)} className="p-1.5 bg-[#d4a73c]/15 hover:bg-[#d4a73c]/25 rounded-md"><Check className="w-3.5 h-3.5 text-[#d4a73c]" /></button>
                <button onClick={() => respondInvite(inv.clanId, false)} className="p-1.5 bg-white/5 hover:bg-white/10 rounded-md"><X className="w-3.5 h-3.5 text-white/50" /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-[#181820] border border-white/5 rounded-xl p-3.5 flex flex-wrap items-center gap-2.5">
        <p className="text-white/50 text-xs font-bold shrink-0">Punya kode/link invite?</p>
        <input
          value={inviteCodeInput} onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
          placeholder="Contoh: A1B2C3" maxLength={6}
          className="flex-1 min-w-[120px] bg-[#0b0b10] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none font-mono tracking-widest"
        />
        <button
          onClick={joinByCode} disabled={joiningByCode || !inviteCodeInput.trim()}
          className="px-4 py-1.5 bg-[#4f9df5]/15 hover:bg-[#4f9df5]/25 text-[#4f9df5] rounded-lg text-xs font-bold disabled:opacity-30 flex items-center gap-1.5 shrink-0"
        >
          {joiningByCode ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Gabung'}
        </button>
      </div>

      <div className="flex gap-1.5 bg-[#181820] p-1 rounded-xl border border-white/5 w-fit">
        <button onClick={() => setTab('browse')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${tab === 'browse' ? 'bg-[#d4a73c] text-[#141419]' : 'text-white/40 hover:text-white'}`}>Cari Clan</button>
        <button onClick={() => setTab('create')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${tab === 'create' ? 'bg-[#d4a73c] text-[#141419]' : 'text-white/40 hover:text-white'}`}>Buat Clan</button>
      </div>

      {tab === 'create' ? (
        <CreateClanForm meta={meta} notify={notify} onCreated={onJoined} />
      ) : (
        <div>
          <div className="flex flex-col sm:flex-row gap-2.5 mb-4">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama atau tag clan..."
                className="w-full bg-[#181820] border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white outline-none focus:border-[#d4a73c]/50"
              />
            </div>
            <div className="flex gap-1.5 bg-[#181820] p-1 rounded-lg border border-white/10 shrink-0">
              <button onClick={() => setSort('level')} className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition-colors ${sort === 'level' ? 'bg-white/10 text-white' : 'text-white/40'}`}>Terkuat</button>
              <button onClick={() => setSort('newest')} className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition-colors ${sort === 'newest' ? 'bg-white/10 text-white' : 'text-white/40'}`}>Terbaru</button>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-[#181820] border border-white/5 rounded-xl animate-pulse" />)}
            </div>
          ) : clans.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-10">Belum ada clan yang cocok. Coba buat sendiri!</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {clans.map((c) => <ClanBrowseCard key={c.id} clan={c} onAction={handleAction} actingId={actingId} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ================= CLAN HALL (sudah punya clan) =================

const RoleBadge = ({ role }) => (
  <span
    className="text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded"
    style={{
      color: role === 'LEADER' ? GOLD : role === 'VICE' ? '#4f9df5' : role === 'ADMIRAL' ? '#3ecf8e' : role === 'OFFICER' ? '#b57bf5' : 'rgba(255,255,255,0.4)',
      backgroundColor: role === 'LEADER' ? `${GOLD}1a` : 'rgba(255,255,255,0.06)'
    }}
  >
    {ROLE_LABEL[role]}
  </span>
);

const GradeBadge = ({ grade }) => {
  const colors = { Diamond: '#7dd3fc', Gold: GOLD, Silver: '#cbd5e1', Bronze: '#d97757' };
  return <span className="text-[9px] font-bold" style={{ color: colors[grade] }}>{grade}</span>;
};

const TitleBadge = ({ title }) => {
  const style = title === 'Founder'
    ? { backgroundColor: `${GOLD}1a`, color: GOLD, borderColor: `${GOLD}40` }
    : { backgroundColor: 'rgba(79,157,245,0.1)', color: '#4f9df5', borderColor: 'rgba(79,157,245,0.25)' };
  return (
    <span className="text-[8px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-full border" style={style}>
      {title}
    </span>
  );
};

const OverviewTab = ({ clan, isManager, onEdited, notify, reload }) => {
  const [editing, setEditing] = useState(false);
  const [desc, setDesc] = useState(clan.desc);
  const [joinType, setJoinType] = useState(clan.joinType);
  const [minLevel, setMinLevel] = useState(clan.minLevel);
  const [icon, setIcon] = useState(clan.icon);
  const [frame, setFrame] = useState(clan.frame || 'ring');
  const [saving, setSaving] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [motdDraft, setMotdDraft] = useState(clan.motd?.text || '');
  const [editingMotd, setEditingMotd] = useState(false);
  const [savingMotd, setSavingMotd] = useState(false);
  const iconFileRef = useRef(null);

  const parseBannerPos = (str) => {
    const parts = (str || '50% 50%').split(' ').map((s) => parseFloat(s));
    return { x: Number.isFinite(parts[0]) ? parts[0] : 50, y: Number.isFinite(parts[1]) ? parts[1] : 50 };
  };
  const [isAdjustingBanner, setIsAdjustingBanner] = useState(false);
  const [bannerPos, setBannerPos] = useState(parseBannerPos(clan.bannerPosition));
  const [savingBannerPos, setSavingBannerPos] = useState(false);
  const bannerContainerRef = useRef(null);
  const dragStateRef = useRef({ dragging: false, startX: 0, startY: 0, startPosX: 50, startPosY: 50 });

  const clamp = (val, min, max) => Math.min(max, Math.max(min, val));
  const getPoint = (e) => (e.touches ? e.touches[0] : e);

  const startAdjustBanner = () => {
    setBannerPos(parseBannerPos(clan.bannerPosition));
    setIsAdjustingBanner(true);
  };
  const cancelAdjustBanner = () => {
    setBannerPos(parseBannerPos(clan.bannerPosition));
    setIsAdjustingBanner(false);
  };
  const handleBannerDragStart = (e) => {
    if (!isAdjustingBanner) return;
    const point = getPoint(e);
    dragStateRef.current = { dragging: true, startX: point.clientX, startY: point.clientY, startPosX: bannerPos.x, startPosY: bannerPos.y };
  };
  const handleBannerDragMove = (e) => {
    if (!dragStateRef.current.dragging) return;
    if (e.cancelable) e.preventDefault();
    const point = getPoint(e);
    const rect = bannerContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const deltaX = point.clientX - dragStateRef.current.startX;
    const deltaY = point.clientY - dragStateRef.current.startY;
    const newX = clamp(dragStateRef.current.startPosX - (deltaX / rect.width) * 100, 0, 100);
    const newY = clamp(dragStateRef.current.startPosY - (deltaY / rect.height) * 100, 0, 100);
    setBannerPos({ x: newX, y: newY });
  };
  const handleBannerDragEnd = () => { dragStateRef.current.dragging = false; };
  const saveBannerPos = async () => {
    setSavingBannerPos(true);
    const { data } = await post('edit', { clanId: clan.id, bannerPosition: `${bannerPos.x.toFixed(1)}% ${bannerPos.y.toFixed(1)}%` });
    setSavingBannerPos(false);
    if (data.success) { notify('Posisi banner disimpan'); setIsAdjustingBanner(false); reload(); }
    else notify(data.error || 'Gagal simpan posisi', 'error');
  };

  const pct = Math.min(100, Math.round((clan.xpCurrent / clan.xpNeeded) * 100));

  const handleIconFile = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { notify('Cuma bisa upload gambar', 'error'); return; }
    if (file.size > 8 * 1024 * 1024) { notify('Ukuran gambar maksimal 8MB', 'error'); return; }

    setUploadingIcon(true);
    try {
      const result = await uploadImageFile(file);
      if (!result?.status || !result?.path) throw new Error('Upload gagal');
      setIcon(result.path);
    } catch (err) {
      notify(err.message || 'Gagal upload foto icon', 'error');
    } finally {
      setUploadingIcon(false);
    }
  };

  const saveEdit = async () => {
    setSaving(true);
    const { data } = await post('edit', { clanId: clan.id, desc, joinType, minLevel: parseInt(minLevel, 10) || 0, icon, frame });
    setSaving(false);
    if (data.success) { notify('Pengaturan clan disimpan'); setEditing(false); reload(); }
    else notify(data.error || 'Gagal simpan', 'error');
  };

  const saveMotd = async () => {
    setSavingMotd(true);
    const { data } = await post('edit', { clanId: clan.id, motd: motdDraft });
    setSavingMotd(false);
    if (data.success) { notify(motdDraft.trim() ? 'Pengumuman disimpan' : 'Pengumuman dihapus'); setEditingMotd(false); reload(); }
    else notify(data.error || 'Gagal simpan', 'error');
  };

  const claimDaily = async () => {
    setClaiming(true);
    const { data } = await post('claim-daily', { clanId: clan.id });
    setClaiming(false);
    if (data.success) { notify(`+${data.reward} EXP!`); reload(); }
    else notify(data.error || 'Gagal klaim', 'error');
  };

  return (
    <div className="space-y-4">
      <div
        ref={bannerContainerRef}
        className={`rounded-2xl border border-white/5 relative overflow-hidden select-none ${isAdjustingBanner ? 'cursor-grab active:cursor-grabbing' : ''}`}
        style={!clan.activeBanner ? { background: `linear-gradient(135deg, ${clan.color}22, transparent)`, padding: '1.25rem' } : undefined}
        onMouseDown={handleBannerDragStart}
        onMouseMove={handleBannerDragMove}
        onMouseUp={handleBannerDragEnd}
        onMouseLeave={handleBannerDragEnd}
        onTouchStart={handleBannerDragStart}
        onTouchMove={handleBannerDragMove}
        onTouchEnd={handleBannerDragEnd}
      >
        {clan.activeBanner && (
          <>
            <img
              src={clan.activeBanner.url}
              alt=""
              draggable={false}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              style={{ objectPosition: `${bannerPos.x}% ${bannerPos.y}%` }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/35 to-black/85 pointer-events-none" />
          </>
        )}
        <div className={clan.activeBanner ? 'relative p-5 pointer-events-none' : 'relative pointer-events-none'}>
          <div className="flex items-center gap-4">
            <ClanEmblem clan={clan} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-white font-black text-lg truncate">{clan.name}</h1>
                <span className="text-white/50 text-xs font-bold">[{clan.tag}]</span>
                {clan.rank && <span className="text-[10px] font-bold text-[#d4a73c] bg-black/30 px-2 py-0.5 rounded-full">Rank #{clan.rank}</span>}
                {clan.milestone && (
                  <span className="text-[10px] font-bold text-white bg-black/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <ClanIcon icon={clan.milestone.icon} className="w-3 h-3" style={{ color: GOLD }} /> {clan.milestone.label}
                  </span>
                )}
              </div>
              <p className="text-white/60 text-xs mt-1 max-w-md">{clan.desc || 'Belum ada deskripsi.'}</p>
              {clan.myTitle && (
                <div className="mt-1.5"><TitleBadge title={clan.myTitle} /></div>
              )}
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-white text-xs font-black">Lv.{clan.level}</span>
            <Bar pct={pct} color={clan.color} />
            <span className="text-white/50 text-[10px] font-bold shrink-0">{clan.xpCurrent}/{clan.xpNeeded}</span>
          </div>
        </div>

        {isManager && clan.activeBanner && (
          isAdjustingBanner ? (
            <div className="absolute bottom-3 right-3 flex gap-1.5 z-10" onMouseDown={(e) => e.stopPropagation()}>
              <button
                onClick={saveBannerPos} disabled={savingBannerPos}
                className="px-3 py-1.5 bg-[#d4a73c] text-[#141419] rounded-lg text-[11px] font-bold flex items-center gap-1"
              >
                {savingBannerPos ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Simpan'}
              </button>
              <button onClick={cancelAdjustBanner} className="px-3 py-1.5 bg-black/50 text-white/70 rounded-lg text-[11px] font-bold">Batal</button>
            </div>
          ) : (
            <button
              onClick={startAdjustBanner} onMouseDown={(e) => e.stopPropagation()}
              className="absolute bottom-3 right-3 z-10 px-3 py-1.5 bg-black/50 hover:bg-black/70 text-white/80 rounded-lg text-[11px] font-bold flex items-center gap-1.5"
            >
              <ImageIcon className="w-3.5 h-3.5" /> Atur Posisi
            </button>
          )
        )}
        {isAdjustingBanner && (
          <div className="absolute top-3 left-3 right-3 z-10 bg-black/60 rounded-lg px-3 py-1.5 text-center">
            <p className="text-white/70 text-[10px] font-bold">Geser gambar buat atur posisi banner</p>
          </div>
        )}
      </div>

      {(clan.motd || isManager) && (
      <div className="bg-[#181820] border border-white/5 rounded-xl p-4">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-white font-bold text-sm flex items-center gap-1.5"><Mail className="w-4 h-4 text-[#d4a73c]" /> Pengumuman</p>
          {isManager && !editingMotd && (
            <button onClick={() => { setMotdDraft(clan.motd?.text || ''); setEditingMotd(true); }} className="text-[#d4a73c] text-xs font-bold">
              {clan.motd ? 'Edit' : 'Tulis'}
            </button>
          )}
        </div>
        {editingMotd ? (
          <div className="space-y-2">
            <textarea
              value={motdDraft} onChange={(e) => setMotdDraft(e.target.value)} maxLength={200} rows={2}
              placeholder="Pesan pin buat semua member clan..."
              className="w-full bg-[#0b0b10] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none resize-none"
            />
            <div className="flex gap-2">
              <button onClick={saveMotd} disabled={savingMotd} className="px-3 py-1.5 bg-[#d4a73c] text-[#141419] rounded-lg text-[11px] font-bold flex items-center gap-1">{savingMotd && <Loader2 className="w-3 h-3 animate-spin" />}Simpan</button>
              <button onClick={() => setEditingMotd(false)} className="px-3 py-1.5 bg-white/5 text-white/60 rounded-lg text-[11px] font-bold">Batal</button>
              {clan.motd && <button onClick={async () => { setMotdDraft(''); setSavingMotd(true); const { data } = await post('edit', { clanId: clan.id, motd: '' }); setSavingMotd(false); if (data.success) { notify('Pengumuman dihapus'); setEditingMotd(false); reload(); } }} className="text-white/30 hover:text-red-400 text-[11px] font-bold ml-auto">Hapus</button>}
            </div>
          </div>
        ) : (
          <p className="text-white/60 text-xs">{clan.motd?.text || 'Belum ada pengumuman dari pengurus clan.'}</p>
        )}
      </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#181820] border border-white/5 rounded-xl p-3.5 text-center">
          <Users className="w-4 h-4 text-white/40 mx-auto mb-1.5" />
          <p className="text-white font-black text-sm">{clan.memberCount}/{clan.capacity}</p>
          <p className="text-white/30 text-[10px] font-bold uppercase">Member</p>
        </div>
        <div className="bg-[#181820] border border-white/5 rounded-xl p-3.5 text-center">
          <Coins className="w-4 h-4 text-[#d4a73c] mx-auto mb-1.5" />
          <p className="text-white font-black text-sm">{clan.treasury}</p>
          <p className="text-white/30 text-[10px] font-bold uppercase">Harta Clan</p>
        </div>
        <div className="bg-[#181820] border border-white/5 rounded-xl p-3.5 text-center">
          <Zap className="w-4 h-4 text-[#3ecf8e] mx-auto mb-1.5" />
          <p className="text-white font-black text-sm">{clan.myXpDonated}</p>
          <p className="text-white/30 text-[10px] font-bold uppercase">EXP Didonasi</p>
        </div>
      </div>

      {clan.weeklyQuest && (
        <div className="bg-[#181820] border border-white/5 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-white font-bold text-sm flex items-center gap-1.5">
              <Swords className="w-4 h-4 text-[#4f9df5]" /> Clan Quest Mingguan
            </p>
            {clan.weeklyQuest.claimed ? (
              <span className="text-[10px] font-black text-[#3ecf8e] bg-[#3ecf8e]/10 px-2 py-0.5 rounded-full">TERCAPAI</span>
            ) : (
              <span className="text-[10px] font-black text-white/40">+{clan.weeklyQuest.reward} Harta</span>
            )}
          </div>
          <p className="text-white/40 text-xs mb-2.5">
            Kumpulin EXP bareng-bareng sekelan sebelum minggu berakhir. Semua sumber EXP clan (naik level member, Donate EXP, Give EXP) ikut kehitung.
          </p>
          <Bar pct={Math.min(100, Math.round((clan.weeklyQuest.progress / clan.weeklyQuest.target) * 100))} color={clan.weeklyQuest.claimed ? '#3ecf8e' : '#4f9df5'} />
          <p className="text-white/30 text-[10px] font-bold mt-1.5">{clan.weeklyQuest.progress}/{clan.weeklyQuest.target} EXP</p>
        </div>
      )}

      <div className="bg-[#181820] border border-white/5 rounded-xl p-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-white font-bold text-sm flex items-center gap-1.5"><Gift className="w-4 h-4 text-[#d4a73c]" /> Reward Harian</p>
          <p className="text-white/40 text-xs mt-0.5">+{clan.dailyReward} EXP &middot; ikut level clan</p>
          {!clan.canClaimDaily && clan.dailySecondsLeft > 0 && (
            <p className="text-white/30 text-[10px] font-bold mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {clan.dailyWaitReason === 'new_member' ? 'Member baru, klaim pertama dalam ' : 'Bisa klaim lagi dalam '}
              <CountdownText seconds={clan.dailySecondsLeft} />
            </p>
          )}
        </div>
        <button
          onClick={claimDaily} disabled={!clan.canClaimDaily || claiming}
          className="px-4 py-2 rounded-lg text-xs font-bold bg-[#d4a73c] text-[#141419] disabled:opacity-30 disabled:bg-white/10 disabled:text-white/40 flex items-center gap-1.5 shrink-0"
        >
          {claiming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
          {clan.canClaimDaily ? 'Klaim' : 'Sudah Klaim'}
        </button>
      </div>

      {isManager && (
        <div className="bg-[#181820] border border-white/5 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-white font-bold text-sm flex items-center gap-1.5"><Settings className="w-4 h-4" /> Pengaturan Clan</p>
            {!editing && <button onClick={() => setEditing(true)} className="text-[#d4a73c] text-xs font-bold">Edit</button>}
          </div>
          {editing ? (
            <div className="space-y-3">
              <div>
                <span className="text-white/50 text-xs font-bold block mb-1.5">Icon Clan:</span>
                <div className="flex items-center gap-2">
                  <div className="w-11 h-11 rounded-lg overflow-hidden border border-white/10 flex items-center justify-center bg-white/[0.03] shrink-0">
                    <ClanIcon icon={icon} className="w-full h-full" style={{ color: clan.color }} />
                  </div>
                  <input ref={iconFileRef} type="file" accept="image/*" onChange={handleIconFile} className="hidden" />
                  <button
                    type="button" onClick={() => iconFileRef.current?.click()} disabled={uploadingIcon}
                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/60 rounded-lg text-[11px] font-bold flex items-center gap-1.5"
                  >
                    {uploadingIcon ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Upload Foto'}
                  </button>
                  {icon !== clan.icon && (
                    <button type="button" onClick={() => setIcon(clan.icon)} className="text-white/30 hover:text-white/60 text-[11px] font-bold">Batal</button>
                  )}
                </div>
              </div>
              <div>
                <span className="text-white/50 text-xs font-bold block mb-1.5">Bingkai Emblem:</span>
                <div className="flex flex-wrap gap-2">
                  {CLAN_FRAMES_FALLBACK.map((f) => (
                    <button
                      type="button" key={f} onClick={() => setFrame(f)}
                      className={`w-10 h-10 rounded-lg flex items-center justify-center bg-black/30 ${frame === f ? 'ring-2 ring-[#d4a73c]' : ''}`}
                      style={emblemFrameStyle(f, clan.color)}
                      title={FRAME_LABEL[f] || f}
                    >
                      <ClanIcon icon={icon} className="w-4 h-4" style={{ color: clan.color }} />
                    </button>
                  ))}
                </div>
              </div>
              <textarea value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={140} rows={2} className="w-full bg-[#0b0b10] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none resize-none" />
              <div className="flex gap-1.5 bg-[#0b0b10] p-1 rounded-lg border border-white/10 w-fit">
                {['public', 'approval', 'invite'].map((jt) => (
                  <button key={jt} onClick={() => setJoinType(jt)} className={`px-3 py-1.5 rounded-md text-[11px] font-bold ${joinType === jt ? 'bg-[#d4a73c] text-[#141419]' : 'text-white/40'}`}>{JOIN_TYPE_LABEL[jt]}</button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white/50 text-xs font-bold">Min. Level:</span>
                <input type="number" min={0} value={minLevel} onChange={(e) => setMinLevel(e.target.value)} className="w-20 bg-[#0b0b10] border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white outline-none" />
              </div>
              <div className="flex gap-2">
                <button onClick={saveEdit} disabled={saving} className="px-4 py-2 bg-[#d4a73c] text-[#141419] rounded-lg text-xs font-bold flex items-center gap-1.5">{saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Simpan</button>
                <button onClick={() => setEditing(false)} className="px-4 py-2 bg-white/5 text-white/60 rounded-lg text-xs font-bold">Batal</button>
              </div>
            </div>
          ) : (
            <p className="text-white/40 text-xs">Cara masuk: <span className="text-white/70 font-bold">{JOIN_TYPE_LABEL[clan.joinType]}</span> &middot; Min. Level: <span className="text-white/70 font-bold">{clan.minLevel}</span></p>
          )}
        </div>
      )}
    </div>
  );
};

const DonateCard = ({ clan, me, notify, reload }) => {
  const [amount, setAmount] = useState(100);
  const [donating, setDonating] = useState(false);
  const balance = me?.watchTime || 0;

  const donate = async () => {
    const amt = parseInt(amount, 10);
    if (!amt || amt <= 0) return;
    if (amt > balance) { notify('EXP kamu tidak cukup', 'error'); return; }
    setDonating(true);
    const { data } = await post('donate', { clanId: clan.id, amount: amt });
    setDonating(false);
    if (data.success) { notify(`Berhasil donasi ${amt} EXP!`); reload(); }
    else notify(data.error || 'Gagal donasi', 'error');
  };

  return (
    <div className="bg-[#181820] border border-white/5 rounded-xl p-4">
      <p className="text-white font-bold text-sm flex items-center gap-1.5"><Zap className="w-4 h-4 text-[#3ecf8e]" /> Donasi EXP</p>
      <p className="text-white/40 text-xs mt-1 mb-3">Sumbang sebagian EXP akun kamu langsung ke clan. Level akunmu ikut turun, tapi clan naik level & harta bersama nambah. EXP kamu saat ini: <span className="text-white/70 font-bold">{balance}</span></p>
      <div className="flex gap-2">
        <input type="number" min={1} max={balance} value={amount} onChange={(e) => setAmount(e.target.value)} className="flex-1 bg-[#0b0b10] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none" />
        <button onClick={donate} disabled={donating || balance <= 0} className="px-4 py-2 bg-[#3ecf8e]/15 hover:bg-[#3ecf8e]/25 text-[#3ecf8e] rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 disabled:opacity-30">
          {donating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Donasi'}
        </button>
      </div>
    </div>
  );
};

const MembersTab = ({ clan, me, notify, reload }) => {
  const [busyId, setBusyId] = useState(null);
  const [inviteId, setInviteId] = useState('');
  const [inviting, setInviting] = useState(false);
  const [titleEditId, setTitleEditId] = useState(null);
  const [titleDraft, setTitleDraft] = useState('');
  const myRank = ROLE_ORDER.indexOf(clan.myRole);

  const act = async (action, targetId, extra) => {
    setBusyId(targetId);
    const { data } = await post(action, { clanId: clan.id, userId: targetId, ...extra });
    setBusyId(null);
    if (data.success) reload();
    else notify(data.error || 'Gagal', 'error');
  };

  const saveTitle = async (targetId) => {
    setBusyId(targetId);
    const { data } = await post('set-title', { clanId: clan.id, userId: targetId, title: titleDraft });
    setBusyId(null);
    if (data.success) { notify('Gelar disimpan'); setTitleEditId(null); reload(); }
    else notify(data.error || 'Gagal', 'error');
  };

  const sendInvite = async () => {
    if (!inviteId.trim()) return;
    setInviting(true);
    const { data } = await post('invite', { clanId: clan.id, userId: inviteId.trim() });
    setInviting(false);
    if (data.success) { notify('Undangan terkirim'); setInviteId(''); }
    else notify(data.error || 'Gagal invite', 'error');
  };

  const canModerate = ROLE_ORDER.indexOf(clan.myRole) <= ROLE_ORDER.indexOf('OFFICER');

  return (
    <div className="space-y-4">
      {canModerate && (
        <div className="bg-[#181820] border border-white/5 rounded-xl p-4">
          <p className="text-white font-bold text-sm mb-1">Undang User (ID)</p>
          <p className="text-white/40 text-[11px] mb-2.5">Undangan langsung ke user tertentu, tembus syarat min. level & tipe join clan (public/approval/invite).</p>
          <div className="flex gap-2">
            <input value={inviteId} onChange={(e) => setInviteId(e.target.value)} placeholder="User ID..." className="flex-1 bg-[#0b0b10] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none" />
            <button onClick={sendInvite} disabled={inviting} className="px-4 py-2 bg-[#d4a73c]/15 text-[#d4a73c] rounded-lg text-xs font-bold shrink-0">{inviting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Undang'}</button>
          </div>
        </div>
      )}

      {canModerate && clan.requests?.length > 0 && (
        <div className="bg-[#181820] border border-[#d4a73c]/25 rounded-xl p-4">
          <p className="text-[#d4a73c] text-xs font-black uppercase tracking-wide mb-2.5">Request Bergabung ({clan.requests.length})</p>
          <div className="space-y-2">
            {clan.requests.map((r) => (
              <div key={r.id} className="flex items-center gap-3 bg-white/[0.03] rounded-lg p-2.5">
                <img src={r.picture || '/favicon.svg'} className="w-8 h-8 rounded-full object-cover shrink-0" />
                <p className="flex-1 text-white text-xs font-bold truncate">{r.name} <span className="text-white/30">Lv.{r.level}</span></p>
                <button onClick={() => act('approve', r.id)} disabled={busyId === r.id} className="p-1.5 bg-[#3ecf8e]/15 hover:bg-[#3ecf8e]/25 rounded-md"><Check className="w-3.5 h-3.5 text-[#3ecf8e]" /></button>
                <button onClick={() => act('reject', r.id)} disabled={busyId === r.id} className="p-1.5 bg-white/5 hover:bg-white/10 rounded-md"><X className="w-3.5 h-3.5 text-white/50" /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-[#181820] border border-white/5 rounded-xl overflow-hidden">
        <p className="text-white/30 text-[10px] font-bold uppercase tracking-wider px-4 pt-3.5 pb-2">{clan.members?.length || 0} Member</p>
        <div className="divide-y divide-white/5">
          {clan.members?.map((m) => {
            const targetRank = ROLE_ORDER.indexOf(m.role);
            const canKick = myRank <= 2 && myRank < targetRank && m.id !== me.id;
            const canPromote = myRank <= 1 && myRank < targetRank && m.id !== me.id;
            const canSetTitle = myRank <= 1 && myRank < targetRank;
            return (
              <React.Fragment key={m.id}>
              <div className="flex items-center gap-3 px-4 py-3">
                <img
                  src={m.picture || '/favicon.svg'}
                  className="w-9 h-9 rounded-full object-cover shrink-0 ring-2 ring-offset-2 ring-offset-[#181820]"
                  style={{ '--tw-ring-color': clan.color }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-white text-xs font-bold truncate">{m.name}</p>
                    <RoleBadge role={m.role} />
                    <GradeBadge grade={m.grade} />
                    {m.title && <TitleBadge title={m.title} />}
                  </div>
                  <p className="text-white/30 text-[10px] font-semibold mt-0.5">Lv.{m.level} &middot; {m.totalContribution ?? m.xpContributed} XP kontribusi</p>
                </div>
                {(canKick || canPromote || canSetTitle) && (
                  <div className="flex items-center gap-1 shrink-0">
                    {canPromote && targetRank > 0 && (
                      <button title="Promote" onClick={() => act('role', m.id, { role: ROLE_ORDER[Math.max(0, targetRank - 1)] })} disabled={busyId === m.id} className="p-1.5 bg-white/5 hover:bg-white/10 rounded-md">
                        <ArrowUpCircle className="w-3.5 h-3.5 text-[#3ecf8e]" />
                      </button>
                    )}
                    {canPromote && targetRank < 4 && (
                      <button title="Demote" onClick={() => act('role', m.id, { role: ROLE_ORDER[Math.min(4, targetRank + 1)] })} disabled={busyId === m.id} className="p-1.5 bg-white/5 hover:bg-white/10 rounded-md">
                        <ArrowDownCircle className="w-3.5 h-3.5 text-white/40" />
                      </button>
                    )}
                    {canSetTitle && (
                      <button
                        title="Atur Gelar"
                        onClick={() => { setTitleEditId(titleEditId === m.id ? null : m.id); setTitleDraft(m.title || ''); }}
                        className="p-1.5 bg-white/5 hover:bg-white/10 rounded-md"
                      >
                        <Tag className="w-3.5 h-3.5 text-[#d4a73c]" />
                      </button>
                    )}
                    {canKick && (
                      <button title="Kick" onClick={() => act('kick', m.id)} disabled={busyId === m.id} className="p-1.5 bg-red-500/10 hover:bg-red-500/20 rounded-md">
                        <UserMinus className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    )}
                  </div>
                )}
              </div>
              {titleEditId === m.id && (
                <div className="px-4 pb-3 -mt-1 flex gap-2">
                  <input
                    value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} maxLength={20}
                    placeholder="Gelar custom, mis. The Grinder"
                    className="flex-1 bg-[#0b0b10] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                  />
                  <button onClick={() => saveTitle(m.id)} disabled={busyId === m.id} className="px-3 py-1.5 bg-[#d4a73c] text-[#141419] rounded-lg text-[11px] font-bold shrink-0">Simpan</button>
                  <button onClick={() => setTitleEditId(null)} className="px-3 py-1.5 bg-white/5 text-white/60 rounded-lg text-[11px] font-bold shrink-0">Batal</button>
                </div>
              )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const GachaTab = ({ clan, notify, reload }) => {
  const [pulling, setPulling] = useState(false);
  const [results, setResults] = useState(null); // array of {item, resultType, bonusItem}
  const [pullCount, setPullCount] = useState(1);
  const [customCount, setCustomCount] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const canGacha = ROLE_ORDER.indexOf(clan.myRole) <= 1;
  const totalCost = GACHA_COST_PER_PULL * pullCount;

  const pull = async (count) => {
    const n = Math.max(1, Math.min(100, Math.floor(Number(count) || 1)));
    setPulling(true);
    setResults(null);
    const { data } = await post('gacha', { clanId: clan.id, count: n });
    setPulling(false);
    if (data.success) { setResults(data.results); reload(); }
    else notify(data.error || 'Gagal gacha', 'error');
  };

  const activate = async (type, itemId) => {
    const { data } = await post('activate', { clanId: clan.id, type, itemId });
    if (data.success) { notify('Tampilan clan diperbarui'); reload(); }
    else notify(data.error || 'Gagal', 'error');
  };

  const presets = [1, 10, 20, 50, 100];

  return (
    <div className="space-y-4">
      <div className="bg-[#181820] border border-white/5 rounded-xl p-5 text-center">
        <Dices className="w-8 h-8 text-[#d4a73c] mx-auto mb-2" />
        <p className="text-white font-black text-sm">Gacha Clan</p>
        <p className="text-white/40 text-xs mt-1 mb-4">Pakai harta clan ({clan.treasury} tersedia) buat buka banner baru. Biaya: {GACHA_COST_PER_PULL}/pull. Pull 10x+ dijamin minimal 1 rare ke atas.</p>

        {canGacha && (
          <div className="flex flex-wrap items-center justify-center gap-1.5 mb-3">
            {presets.map((n) => (
              <button
                key={n}
                onClick={() => { setPullCount(n); setShowCustom(false); }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${pullCount === n && !showCustom ? 'bg-[#d4a73c] text-[#141419]' : 'bg-white/5 text-white/50 hover:text-white'}`}
              >
                {n}x
              </button>
            ))}
            <button
              onClick={() => setShowCustom((v) => !v)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${showCustom ? 'bg-[#d4a73c] text-[#141419]' : 'bg-white/5 text-white/50 hover:text-white'}`}
            >
              Custom
            </button>
            {showCustom && (
              <input
                type="number" min={1} max={100} value={customCount}
                onChange={(e) => { setCustomCount(e.target.value); setPullCount(Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 1))); }}
                placeholder="1-100"
                className="w-20 bg-[#0b0b10] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
              />
            )}
          </div>
        )}

        {canGacha ? (
          <button
            onClick={() => pull(pullCount)} disabled={pulling || clan.treasury < totalCost}
            className="px-6 py-2.5 bg-[#d4a73c] text-[#141419] rounded-xl text-sm font-black disabled:opacity-30 flex items-center gap-2 mx-auto"
          >
            {pulling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Pull {pullCount}x &middot; {totalCost} Harta
          </button>
        ) : (
          <p className="text-white/30 text-xs">Hanya Leader/Vice Leader yang bisa pull gacha</p>
        )}
        {clan.shards > 0 && <p className="text-white/30 text-[10px] font-bold mt-3">Shard: {clan.shards}/5</p>}

        {results && <GachaResultReveal results={results} />}
      </div>

      <div className="bg-[#181820] border border-white/5 rounded-xl p-4">
        <p className="text-white font-bold text-sm mb-3">Koleksi Clan ({clan.unlockedItems?.length || 0})</p>
        {(!clan.unlockedItems || clan.unlockedItems.length === 0) ? (
          <p className="text-white/30 text-xs text-center py-6">Belum ada item, coba gacha dulu!</p>
        ) : (
          <TieredCollection items={clan.unlockedItems} activeBannerId={clan.activeBanner?.id} canGacha={canGacha} onActivate={(id) => activate('banner', id)} />
        )}
      </div>
    </div>
  );
};

// Grid reveal buat hasil pull (1x atau bulk 10x/20x/custom). Item rarity
// tinggi (epic ke atas) dikasih glow biar berasa lebih "meledak".
const GachaResultReveal = ({ results }) => {
  const highRarities = ['epic', 'legendary', 'mythic'];
  return (
    <div className="mt-4 text-left" style={{ animation: 'fadeScale 0.2s ease-out' }}>
      <div className={`grid gap-2 ${results.length > 1 ? 'grid-cols-4 sm:grid-cols-5' : 'grid-cols-1'}`}>
        {results.map((r, i) => {
          const rarityColor = RARITY_COLOR[r.item.rarity];
          const isHigh = highRarities.includes(r.item.rarity);
          return (
            <div
              key={i}
              className="relative rounded-lg overflow-hidden border-2"
              style={{
                borderColor: rarityColor,
                boxShadow: isHigh ? `0 0 14px ${rarityColor}90` : 'none',
                animation: `popIn 0.3s ease-out ${i * 0.04}s both`
              }}
            >
              {r.item.type === 'banner' && <img src={r.item.url} alt="" className="w-full aspect-square object-cover" />}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-1.5 py-1">
                <p className="text-white text-[9px] font-bold truncate">{r.item.name}</p>
                <p className="text-[7px] font-black uppercase" style={{ color: rarityColor }}>{r.item.rarity}</p>
              </div>
              {r.resultType !== 'new' && (
                <span className="absolute top-1 right-1 text-[7px] font-black text-white bg-black/60 px-1 py-0.5 rounded">DUP</span>
              )}
            </div>
          );
        })}
      </div>
      {results.some((r) => r.bonusItem) && (
        <p className="text-[#3ecf8e] text-xs font-bold mt-2.5 text-center">
          + Bonus item terbuka dari shard: {results.filter((r) => r.bonusItem).map((r) => r.bonusItem.name).join(', ')}!
        </p>
      )}
    </div>
  );
};

// Koleksi dipisah per tier (normal/rare/epic/legendary/mythic) dan cuma
// nge-render 1 tier aja dalam satu waktu -- kalau digabung semua sekaligus
// (bisa puluhan gambar), bikin lag pas scroll/render, apalagi di HP.
const RARITY_TIERS = ['normal', 'rare', 'epic', 'legendary', 'mythic'];
const PAGE_SIZE = 40;

const TieredCollection = ({ items, activeBannerId, canGacha, onActivate }) => {
  const grouped = RARITY_TIERS.reduce((acc, t) => { acc[t] = items.filter((i) => i.rarity === t); return acc; }, {});
  const [tier, setTier] = useState(RARITY_TIERS.find((t) => grouped[t].length > 0) || 'normal');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef(null);

  const list = grouped[tier] || [];
  const visibleList = list.slice(0, visibleCount);

  // reset pagination tiap pindah tier
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [tier]);

  // auto load more saat sentinel kelihatan
  useEffect(() => {
    if (!sentinelRef.current) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setVisibleCount((c) => Math.min(list.length, c + PAGE_SIZE));
      }
    }, { rootMargin: '300px' });
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [list.length, tier]);

  return (
    <div>
      {/* tombol tier sama kayak sebelumnya */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {RARITY_TIERS.map((t) => (
          <button key={t} onClick={() => setTier(t)} disabled={grouped[t].length === 0}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-colors disabled:opacity-25 ${tier === t ? 'text-[#0b0b10]' : 'text-white/50 bg-white/5'}`}
            style={tier === t ? { backgroundColor: RARITY_COLOR[t] } : undefined}>
            {t} ({grouped[t].length})
          </button>
        ))}
      </div>

      {visibleList.length === 0 ? (
        <p className="text-white/25 text-xs text-center py-6">Belum ada item tier ini.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {visibleList.map((item) => {
              const active = activeBannerId === item.id;
              const rarityColor = RARITY_COLOR[item.rarity];
              return (
                <button key={item.id} onClick={() => canGacha && onActivate(item.id)}
                  className="rounded-xl border-2 text-left transition-colors overflow-hidden relative"
                  style={{ borderColor: active ? GOLD : `${rarityColor}55` }}>
                  <div className="relative aspect-square">
                    <img src={item.url} alt={item.name} loading="lazy" className="w-full h-full object-cover" />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-2">
                      <p className="text-white text-[10px] font-bold truncate">{item.name}</p>
                    </div>
                  </div>
                  {active && <p className="absolute top-1.5 right-1.5 text-[8px] font-black text-white bg-[#d4a73c] px-1.5 py-0.5 rounded-full">AKTIF</p>}
                </button>
              );
            })}
          </div>
          {visibleCount < list.length && (
            <div ref={sentinelRef} className="py-4 text-center text-white/20 text-[10px] font-bold">Memuat lebih banyak...</div>
          )}
        </>
      )}
    </div>
  );
};

const ChatTab = ({ clan, me }) => {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const load = useCallback(async () => {
    const { data } = await fetchJson(`/api/v1/clan/chat?id=${clan.id}`);
    if (data.success) setMessages(data.messages || []);
    setLoading(false);
  }, [clan.id]);

  useEffect(() => {
    load();
  }, [load]);

  useAdaptiveInterval(load, 5000);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    const { data } = await post('chat-send', { clanId: clan.id, text });
    setSending(false);
    if (data.success) { setText(''); load(); }
  };

  return (
    <div className="bg-[#181820] border border-white/5 rounded-xl flex flex-col h-[480px]">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <p className="text-white/30 text-xs text-center py-10">Memuat chat...</p>
        ) : messages.length === 0 ? (
          <p className="text-white/30 text-xs text-center py-10">Belum ada obrolan. Mulai duluan!</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex gap-2.5 ${m.userId === me.id ? 'flex-row-reverse' : ''}`}>
              <img src={m.picture || '/favicon.svg'} className="w-7 h-7 rounded-full object-cover shrink-0" />
              <div className={`max-w-[75%] ${m.userId === me.id ? 'items-end' : 'items-start'} flex flex-col`}>
                <div className="flex items-center gap-1.5">
                  <span className="text-white/40 text-[10px] font-bold">{m.name}</span>
                  <RoleBadge role={m.role} />
                </div>
                <div className={`mt-1 px-3 py-2 rounded-xl text-xs ${m.userId === me.id ? 'bg-[#d4a73c]/15 text-white' : 'bg-white/[0.05] text-white/85'}`}>
                  {m.text}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={send} className="flex items-center gap-2 p-3 border-t border-white/5">
        <input
          value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="Ketik pesan ke clan..."
          className="flex-1 bg-[#0b0b10] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#d4a73c]/50"
        />
        <button type="submit" disabled={sending || !text.trim()} className="p-2.5 bg-[#d4a73c] text-[#141419] rounded-lg disabled:opacity-40 shrink-0">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>
    </div>
  );
};

const ACTIVITY_ICON = {
  gacha: Dices,
  donate: Zap,
  giveexp: Send,
  join: Users,
  war_challenge_sent: Swords,
  war_challenge_received: Swords,
  war_start: Swords,
  war_declined: X,
  war_end: Crown
};
const ACTIVITY_COLOR = {
  gacha: '#d4a73c',
  donate: '#3ecf8e',
  giveexp: '#3ecf8e',
  join: '#4f9df5',
  war_challenge_sent: '#ff4757',
  war_challenge_received: '#ff4757',
  war_start: '#ff4757',
  war_declined: 'rgba(255,255,255,0.4)',
  war_end: '#d4a73c'
};
const activityText = (a) => {
  if (a.type === 'gacha') return `${a.userName} pull gacha ${a.count}x, dapet ${a.bestItemName || 'item'} (${a.bestRarity})!`;
  if (a.type === 'donate') return `${a.userName} donate ${a.amount} EXP ke clan`;
  if (a.type === 'giveexp') return `${a.userName} kasih ${a.amount} EXP x${a.maxClaims} slot buat komunitas`;
  if (a.type === 'join') return `${a.userName} bergabung ke clan`;
  if (a.type === 'war_challenge_sent') return `${a.userName} nantang clan ${a.opponentName} buat war`;
  if (a.type === 'war_challenge_received') return `Ditantang war sama clan ${a.opponentName}`;
  if (a.type === 'war_start') return `War lawan ${a.opponentName} dimulai!`;
  if (a.type === 'war_declined') return `Tantangan war lawan ${a.opponentName} ditolak/dibatalkan`;
  if (a.type === 'war_end') {
    if (a.result === 'win') return `Menang war lawan ${a.opponentName}! (${a.myScore} vs ${a.opponentScore})`;
    if (a.result === 'draw') return `War lawan ${a.opponentName} seri (${a.myScore} vs ${a.opponentScore})`;
    return `Kalah war lawan ${a.opponentName} (${a.myScore} vs ${a.opponentScore})`;
  }
  return `${a.userName || 'Seseorang'} melakukan sesuatu`;
};

const InviteCodeCard = ({ clan, isManager, notify, reload }) => {
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!clan.inviteCode) return null;

  const inviteUrl = `${window.location.origin}/clan?invite=${clan.inviteCode}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notify('Gagal nyalin, coba manual', 'error');
    }
  };

  const regenerate = async () => {
    if (!confirm('Bikin kode invite baru? Link/kode lama bakal langsung gak berlaku lagi.')) return;
    setRegenerating(true);
    const { data } = await post('regenerate-invite', { clanId: clan.id });
    setRegenerating(false);
    if (data.success) { notify('Kode invite baru dibuat'); reload(); }
    else notify(data.error || 'Gagal', 'error');
  };

  return (
    <div className="bg-[#181820] border border-white/5 rounded-xl p-4">
      <p className="text-white font-bold text-sm flex items-center gap-1.5"><Mail className="w-4 h-4 text-[#4f9df5]" /> Link Invite</p>
      <p className="text-white/40 text-xs mt-1 mb-3">Share link ini ke temen, mereka bisa langsung gabung tanpa approval — cocok buat clan invite-only juga.</p>
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-[#0b0b10] border border-white/10 rounded-lg px-3 py-2 text-xs text-white/70 font-mono truncate">{inviteUrl}</div>
        <button onClick={copyLink} className="px-3 py-2 bg-[#4f9df5]/15 hover:bg-[#4f9df5]/25 text-[#4f9df5] rounded-lg text-xs font-bold shrink-0">
          {copied ? 'Tersalin!' : 'Salin'}
        </button>
      </div>
      {isManager && (
        <button onClick={regenerate} disabled={regenerating} className="text-white/30 hover:text-white/60 text-[10px] font-bold mt-2 flex items-center gap-1">
          {regenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Buat kode baru
        </button>
      )}
    </div>
  );
};

const ActivityFeed = ({ clanId }) => {
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchJson(`/api/v1/clan/activity?id=${clanId}`).then(({ data }) => {
      if (!cancelled) { if (data.success) setActivity(data.activity || []); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [clanId]);

  if (loading) return null;
  if (activity.length === 0) return null;

  return (
    <div className="bg-[#181820] border border-white/5 rounded-xl p-4">
      <p className="text-white font-bold text-sm mb-3">Aktivitas Terbaru</p>
      <div className="space-y-2 max-h-56 overflow-y-auto">
        {activity.map((a) => {
          const Icon = ACTIVITY_ICON[a.type] || Users;
          const color = ACTIVITY_COLOR[a.type] || 'rgba(255,255,255,0.4)';
          return (
            <div key={a.id} className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}1a` }}>
                <Icon className="w-3 h-3" style={{ color }} />
              </div>
              <p className="text-white/60 text-xs flex-1 truncate">{activityText(a)}</p>
              <span className="text-white/25 text-[10px] font-bold shrink-0">{timeAgoShort(a.createdAt)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const timeAgoShort = (iso) => {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'baru saja';
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}j`;
  return `${Math.floor(hr / 24)}h`;
};

const LeaveOrDisbandRow = ({ clan, notify, onLeft }) => {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const isLeader = clan.myRole === 'LEADER';

  const doAction = async () => {
    setBusy(true);
    const { data } = await post(isLeader ? 'disband' : 'leave', { clanId: clan.id });
    setBusy(false);
    if (data.success) { notify(isLeader ? 'Clan dibubarkan' : 'Kamu keluar dari clan'); onLeft(); }
    else notify(data.error || 'Gagal', 'error');
    setConfirm(false);
  };

  return (
    <div className="pt-2">
      {!confirm ? (
        <button onClick={() => setConfirm(true)} className="text-red-400/70 hover:text-red-400 text-xs font-bold flex items-center gap-1.5">
          <LogOut className="w-3.5 h-3.5" /> {isLeader ? 'Bubarkan Clan' : 'Keluar dari Clan'}
        </button>
      ) : (
        <div className="bg-red-500/[0.06] border border-red-500/20 rounded-xl p-3.5 flex items-center justify-between gap-3">
          <p className="text-red-300 text-xs font-semibold">{isLeader ? 'Yakin bubarkan clan ini? Semua data akan hilang permanen.' : 'Yakin mau keluar dari clan?'}</p>
          <div className="flex gap-2 shrink-0">
            <button onClick={doAction} disabled={busy} className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-[11px] font-bold">{busy ? '...' : 'Ya'}</button>
            <button onClick={() => setConfirm(false)} className="px-3 py-1.5 bg-white/10 text-white/60 rounded-lg text-[11px] font-bold">Batal</button>
          </div>
        </div>
      )}
    </div>
  );
};

const WAR_RESULT_LABEL = { win: 'Menang', lose: 'Kalah', draw: 'Seri' };
const WAR_RESULT_COLOR = { win: '#3ecf8e', lose: '#ff4757', draw: 'rgba(255,255,255,0.5)' };

const formatCountdown = (iso) => {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'segera berakhir';
  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / 1440);
  const hrs = Math.floor((totalMin % 1440) / 60);
  const min = totalMin % 60;
  if (days > 0) return `${days}h ${hrs}j lagi`;
  if (hrs > 0) return `${hrs}j ${min}m lagi`;
  return `${min}m lagi`;
};

const ClanWarBadge = ({ icon, color, frame, name, tag }) => {
  const isCustomPhoto = typeof icon === 'string' && /^https?:\/\//.test(icon);
  return (
    <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
      <div
        className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden flex items-center justify-center shrink-0 bg-black/30"
        style={emblemFrameStyle(frame, color)}
      >
        {isCustomPhoto ? (
          <img src={icon} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <ClanIcon icon={icon} className="w-10 h-10 sm:w-12 sm:h-12" style={{ color }} />
        )}
      </div>
      <p className="text-white text-xs font-bold truncate max-w-full">{name}</p>
      <p className="text-white/40 text-[10px] font-bold">[{tag}]</p>
    </div>
  );
};

const WarTab = ({ clan, isManager, notify, reload }) => {
  const [tag, setTag] = useState('');
  const [busy, setBusy] = useState(false);
  const [oppScore, setOppScore] = useState(null);
  const [oppLive, setOppLive] = useState(null); // data clan lawan yg fresh (icon profile bisa berubah kapan aja, jangan andelin snapshot war)

  const war = clan.war;

  useEffect(() => {
    if (war?.status !== 'active') { setOppScore(null); setOppLive(null); return; }
    let cancelled = false;
    const fetchOpp = () => {
      fetchJson(`/api/v1/clan/detail?id=${war.opponentId}`).then(({ data }) => {
        if (!cancelled && data.success) {
          setOppScore(data.clan.war?.score ?? 0);
          setOppLive(data.clan);
        }
      });
    };
    fetchOpp();
    const iv = setInterval(fetchOpp, 15000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [war?.status, war?.opponentId]);

  const doChallenge = async () => {
    const t = tag.trim().toUpperCase();
    if (t.length < 2) return notify('Tag clan minimal 2 karakter', 'error');
    setBusy(true);
    const { data } = await post('war-challenge', { clanId: clan.id, targetTag: t });
    setBusy(false);
    if (data.success) { notify('Tantangan war terkirim!'); setTag(''); reload(); }
    else notify(data.error || 'Gagal nantang', 'error');
  };

  const respond = async (accept) => {
    setBusy(true);
    const { data } = await post('war-respond', { clanId: clan.id, accept });
    setBusy(false);
    if (data.success) { notify(accept ? 'War dimulai!' : 'Tantangan ditolak'); reload(); }
    else notify(data.error || 'Gagal', 'error');
  };

  const cancel = async () => {
    setBusy(true);
    const { data } = await post('war-cancel', { clanId: clan.id });
    setBusy(false);
    if (data.success) { notify('Tantangan dibatalkan'); reload(); }
    else notify(data.error || 'Gagal', 'error');
  };

  const doAutoMatchmake = async () => {
    setBusy(true);
    const { data } = await post('war-matchmake', { clanId: clan.id });
    setBusy(false);
    if (data.success) {
      notify('Menemukan klan lawan seimbang! Tantangan war berhasil dikirim.');
      reload();
    } else {
      notify(data.error || 'Gagal matchmaking', 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-[#ff4757]/10 to-[#181820] border border-[#ff4757]/20 rounded-xl p-4">
        <p className="text-white font-bold text-sm flex items-center gap-1.5"><Swords className="w-4 h-4 text-[#ff4757]" /> Clan War</p>
        <p className="text-white/40 text-xs mt-1">Nantang clan lain atau gunakan Auto Matchmaking. XP dari kontribusi member (nonton, baca, arena battle, donasi) selama war otomatis menjadi skor perang klan.</p>
        <p className="text-white/30 text-[10px] mt-2 font-bold uppercase tracking-wide">Total kemenangan: {clan.warWins || 0}x</p>
      </div>

      {!war && (
        <div className="bg-[#181820] border border-white/5 rounded-xl p-4 space-y-3">
          {isManager ? (
            <>
              <p className="text-white/70 text-xs font-semibold">Clan kamu sedang santai, belum ada war aktif. Siap bertempur?</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={doAutoMatchmake}
                  disabled={busy}
                  className="w-full py-2.5 bg-gradient-to-r from-[#d4a73c] to-[#ff4e2d] text-[#0b0b10] rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] shadow-md shadow-[#d4a73c]/20"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  Auto Matchmaking War
                </button>

                <div className="flex gap-2">
                  <input
                    type="text" value={tag} onChange={(e) => setTag(e.target.value.toUpperCase())} maxLength={5}
                    placeholder="Tag Clan Lawan..."
                    className="flex-1 bg-[#0b0b10] border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none tracking-widest font-bold font-mono-ui"
                  />
                  <button onClick={doChallenge} disabled={busy || tag.trim().length < 2} className="px-4 py-2 bg-[#ff4757] text-white rounded-xl text-xs font-bold disabled:opacity-40 flex items-center gap-1.5 shrink-0">
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Swords className="w-3.5 h-3.5" />} Tantang
                  </button>
                </div>
              </div>
            </>
          ) : (
            <p className="text-white/40 text-xs">Clan kamu lagi santai, gak ada war. Cuma Leader/Vice yang bisa memulai tantangan war.</p>
          )}
        </div>
      )}

      {war?.status === 'pending_outgoing' && (
        <div className="bg-[#181820] border border-white/5 rounded-xl p-4 space-y-3">
          <p className="text-white/70 text-xs font-semibold">Nunggu respon dari <span className="text-white">{war.opponentName}</span> [{war.opponentTag}]...</p>
          {isManager && (
            <button onClick={cancel} disabled={busy} className="px-3 py-1.5 bg-white/10 text-white/60 rounded-lg text-[11px] font-bold">Batalkan Tantangan</button>
          )}
        </div>
      )}

      {war?.status === 'pending_incoming' && (
        <div className="bg-[#ff4757]/[0.08] border border-[#ff4757]/25 rounded-xl p-4 space-y-3">
          <p className="text-white text-xs font-semibold">Clan <span className="font-bold">{war.opponentName}</span> [{war.opponentTag}] nantang war!</p>
          {isManager ? (
            <div className="flex gap-2">
              <button onClick={() => respond(true)} disabled={busy} className="flex-1 py-2 bg-[#ff4757] text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5">
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Terima
              </button>
              <button onClick={() => respond(false)} disabled={busy} className="flex-1 py-2 bg-white/10 text-white/60 rounded-lg text-xs font-bold">Tolak</button>
            </div>
          ) : (
            <p className="text-white/40 text-[11px]">Cuma Leader/Vice yang bisa respon tantangan ini.</p>
          )}
        </div>
      )}

      {war?.status === 'active' && (
        <div className="bg-[#181820] border border-white/5 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <ClanWarBadge icon={clan.icon} color={clan.color} frame={clan.frame} name={clan.name} tag={clan.tag} />
            <div className="px-3 shrink-0 text-center">
              <p className="text-white/30 text-[10px] font-bold uppercase">VS</p>
              <p className="text-white/40 text-[10px] font-bold mt-3 whitespace-nowrap">{formatCountdown(war.endsAt)}</p>
            </div>
            <ClanWarBadge
              icon={oppLive?.icon ?? war.opponentIcon}
              color={oppLive?.color ?? war.opponentColor}
              frame={oppLive?.frame ?? war.opponentFrame}
              name={war.opponentName}
              tag={war.opponentTag}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#3ecf8e] text-sm font-black tabular-nums w-16 text-left">{war.score || 0}</span>
            <div className="flex-1 h-2.5 bg-[#0b0b10] rounded-full overflow-hidden flex">
              {(() => {
                const my = war.score || 0;
                const opp = oppScore ?? 0;
                const total = my + opp;
                const myPct = total > 0 ? (my / total) * 100 : 50;
                return (
                  <>
                    <div className="h-full bg-[#3ecf8e]" style={{ width: `${myPct}%` }} />
                    <div className="h-full bg-[#ff4757]" style={{ width: `${100 - myPct}%` }} />
                  </>
                );
              })()}
            </div>
            <span className="text-[#ff4757] text-sm font-black tabular-nums w-16 text-right">{oppScore ?? '...'}</span>
          </div>
          <p className="text-white/30 text-[10px] text-center">Skor otomatis kebentuk dari kontribusi XP member selama war</p>
        </div>
      )}

      {(clan.warHistory || []).length > 0 && (
        <div className="bg-[#181820] border border-white/5 rounded-xl p-4">
          <p className="text-white font-bold text-sm mb-3">Riwayat War</p>
          <div className="space-y-2">
            {clan.warHistory.map((h, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <p className="text-white/60 text-xs truncate flex-1">lawan {h.opponentName} [{h.opponentTag}]</p>
                <span className="text-white/30 text-[10px] tabular-nums shrink-0">{h.myScore}-{h.opponentScore}</span>
                <span className="text-[11px] font-bold shrink-0" style={{ color: WAR_RESULT_COLOR[h.result] }}>{WAR_RESULT_LABEL[h.result]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ===== TAB 4: EKSPEDISI DUNGEON KLAN =====
const ExpeditionsTab = ({ clan, isManager, notify, reload }) => {
  const [loading, setLoading] = useState(true);
  const [dungeons, setDungeons] = useState([]);
  const [canDeploy, setCanDeploy] = useState(true);
  const [busyDungeon, setBusyDungeon] = useState(null);

  const loadExpeditions = async () => {
    setLoading(true);
    const { data } = await fetchJson(`/api/v1/clan/expeditions?clanId=${clan.id}`);
    if (data.success) {
      setDungeons(data.dungeons || []);
      setCanDeploy(data.canDeploy);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadExpeditions();
  }, [clan.id]);

  const deploy = async (dungeonId) => {
    if (busyDungeon) return;
    setBusyDungeon(dungeonId);
    const { data } = await post('expedition-deploy', { clanId: clan.id, dungeonId });
    setBusyDungeon(null);
    if (data.success) {
      notify(`Pasukan Terkirim! +${data.powerContributed.toLocaleString()} Power disumbangkan!`);
      loadExpeditions();
      reload();
    } else {
      notify(data.error || 'Gagal mengirim ekspedisi', 'error');
    }
  };

  const claim = async (dungeonId) => {
    if (busyDungeon) return;
    setBusyDungeon(dungeonId);
    const { data } = await post('expedition-claim', { clanId: clan.id, dungeonId });
    setBusyDungeon(null);
    if (data.success) {
      notify(`Dungeon Selesai! +${data.rewards.treasury} Kas & +${data.rewards.clanXp} Clan XP didapatkan!`);
      loadExpeditions();
      reload();
    } else {
      notify(data.error || 'Gagal klaim hadiah', 'error');
    }
  };

  if (loading) {
    return <div className="h-48 bg-[#181820] border border-white/5 rounded-2xl animate-pulse" />;
  }

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-emerald-950/30 via-[#181820] to-[#181820] border border-emerald-500/30 rounded-2xl p-5 relative overflow-hidden shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-white font-black text-sm md:text-base uppercase tracking-tight">Ekspedisi Dungeon Bersama</h3>
            <p className="text-white/40 text-xs font-medium mt-0.5">
              Kirim squad kartumu setiap hari untuk mengumpulkan Power Dungeon mingguan dan merebut hadiah Kas Klan & Tiket Gacha!
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {dungeons.map((d) => {
          const pct = Math.min(100, Math.round((d.currentPower / d.requiredPower) * 100));

          return (
            <div
              key={d.id}
              className={`p-5 rounded-2xl border flex flex-col justify-between transition-all duration-300 relative overflow-hidden ${
                d.claimed
                  ? 'bg-white/[0.02] border-white/5 opacity-60'
                  : d.completed
                  ? 'bg-gradient-to-b from-amber-500/10 via-[#181820] to-[#181820] border-[#d4a73c]/50 shadow-[0_0_20px_rgba(212,167,60,0.15)]'
                  : 'bg-[#181820] border-white/5'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span
                    className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md font-mono-ui"
                    style={{ backgroundColor: `${d.color}20`, color: d.color, border: `1px solid ${d.color}40` }}
                  >
                    Dungeon
                  </span>
                  {d.claimed ? (
                    <span className="text-[10px] font-bold text-white/30 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Diklaim
                    </span>
                  ) : d.completed ? (
                    <span className="text-[10px] font-black text-[#d4a73c] animate-pulse">SIAP KLAIM</span>
                  ) : null}
                </div>

                <h4 className="text-white font-black text-sm mb-1">{d.name}</h4>
                <p className="text-white/40 text-xs font-medium line-clamp-2 mb-4">{d.desc}</p>
              </div>

              <div>
                <div className="flex justify-between text-xs font-mono-ui font-black mb-1.5">
                  <span className="text-white/40">Expedition Power:</span>
                  <span className="text-white">{d.currentPower.toLocaleString()} / {d.requiredPower.toLocaleString()}</span>
                </div>

                <div className="w-full bg-black/40 rounded-full h-2 overflow-hidden p-0.5 border border-white/5 mb-4">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, backgroundColor: d.color }}
                  />
                </div>

                <div className="flex items-center gap-2 text-[11px] font-bold text-white/50 mb-4 pb-3 border-b border-white/5 flex-wrap">
                  <span className="text-[#d4a73c] flex items-center gap-1">
                    <Coins className="w-3 h-3" /> +{d.rewards.treasury} Kas
                  </span>
                  <span className="text-sky-300">+{d.rewards.clanXp} XP</span>
                  <span className="text-purple-300">+{d.rewards.tickets} Tiket</span>
                </div>

                {d.canClaim && isManager ? (
                  <button
                    onClick={() => claim(d.id)}
                    disabled={busyDungeon === d.id}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#d4a73c] to-[#ff4e2d] text-[#0b0b10] font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-[#d4a73c]/30"
                  >
                    {busyDungeon === d.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
                    Klaim Hadiah Dungeon
                  </button>
                ) : (
                  <button
                    onClick={() => deploy(d.id)}
                    disabled={!canDeploy || d.completed || busyDungeon === d.id}
                    className={`w-full py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                      d.completed
                        ? 'bg-white/5 text-white/30 cursor-default'
                        : canDeploy
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:brightness-110 active:scale-[0.98] shadow-md shadow-emerald-600/30'
                        : 'bg-white/5 text-white/30 cursor-not-allowed'
                    }`}
                  >
                    {busyDungeon === d.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : d.completed ? (
                      'Lantai Telah Selesai'
                    ) : canDeploy ? (
                      <>
                        <Send className="w-3.5 h-3.5" /> Kirim Squad Hari Ini
                      </>
                    ) : (
                      'Sudah Mengirim Hari Ini'
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ===== TAB 5: BUFF SHOP KLAN =====
const BUFF_CATALOG = [
  {
    id: 'xp_haste',
    name: 'Expedition Haste',
    desc: 'Bonus +25% XP dari nonton anime, baca komik, & quest untuk SEMUA member klan.',
    cost: 2500,
    icon: Zap,
    color: '#38bdf8'
  },
  {
    id: 'coin_prosperity',
    name: 'Prosperity Blessing',
    desc: 'Bonus +30% Koin Kuno dari misi harian & event untuk SEMUA member klan.',
    cost: 3000,
    icon: Coins,
    color: '#eab308'
  },
  {
    id: 'arena_vigor',
    name: 'Colosseum Vigor',
    desc: 'Bonus +15% Damage & Defense di Card Arena untuk SEMUA member klan.',
    cost: 2800,
    icon: Swords,
    color: '#ef4444'
  },
  {
    id: 'astral_fortune',
    name: 'Astral Fortune',
    desc: 'Peluang drop item langka & tiket gacha bertambah +20% untuk SEMUA member klan.',
    cost: 3500,
    icon: Sparkles,
    color: '#a855f7'
  }
];

const BuffShopTab = ({ clan, isManager, notify, reload }) => {
  const [buying, setBuying] = useState(null);

  const buyBuff = async (buffId) => {
    if (buying) return;
    setBuying(buffId);
    const { data } = await post('buy-buff', { clanId: clan.id, buffId });
    setBuying(null);
    if (data.success) {
      notify(`Buff "${data.buff.name}" Berhasil Diaktifkan selama 24 Jam!`);
      reload();
    } else {
      notify(data.error || 'Gagal mengaktifkan buff', 'error');
    }
  };

  const activeBuffs = clan.activeBuffs || [];

  return (
    <div className="space-y-4">
      {/* Header Treasury */}
      <div className="bg-gradient-to-r from-[#d4a73c]/15 via-[#181820] to-[#181820] border border-[#d4a73c]/30 rounded-2xl p-5 flex items-center justify-between flex-wrap gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#d4a73c]/20 border border-[#d4a73c]/40 flex items-center justify-center text-[#d4a73c] shrink-0">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-white font-black text-sm md:text-base uppercase tracking-tight">Toko Buff & Kas Klan</h3>
            <p className="text-white/40 text-xs font-medium mt-0.5">
              Leader & Vice dapat mengaktifkan Buff Global berdurasi 24 jam untuk seluruh anggota klan menggunakan Kas Klan.
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <span className="text-white/40 text-xs block font-bold">Saldo Kas Klan:</span>
          <span className="text-[#d4a73c] font-black text-lg md:text-xl font-mono-ui flex items-center gap-1 justify-end">
            <Coins className="w-4 h-4" /> {(clan.treasury || 0).toLocaleString()} Koin
          </span>
        </div>
      </div>

      {/* Buff Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {BUFF_CATALOG.map((b) => {
          const Icon = b.icon;
          const activeInfo = activeBuffs.find((ab) => ab.id === b.id);
          const isActive = !!activeInfo;

          return (
            <div
              key={b.id}
              className={`p-5 rounded-2xl border flex flex-col justify-between transition-all duration-300 relative overflow-hidden ${
                isActive
                  ? 'bg-gradient-to-b from-sky-500/15 via-[#181824] to-[#181824] border-sky-500/50 shadow-[0_0_25px_rgba(56,189,248,0.2)]'
                  : 'bg-[#181820] border-white/5'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center border"
                    style={{ backgroundColor: `${b.color}20`, borderColor: `${b.color}40`, color: b.color }}
                  >
                    <Icon className="w-5 h-5" />
                  </div>

                  {isActive ? (
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 animate-pulse">
                      <Zap className="w-3 h-3" /> Aktif
                    </span>
                  ) : (
                    <span className="text-xs font-mono-ui font-black text-[#d4a73c] flex items-center gap-1">
                      <Coins className="w-3 h-3" /> {b.cost.toLocaleString()} Kas
                    </span>
                  )}
                </div>

                <h4 className="text-white font-black text-sm mb-1">{b.name}</h4>
                <p className="text-white/40 text-xs font-medium leading-relaxed mb-4">{b.desc}</p>
              </div>

              <div>
                {isActive ? (
                  <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 text-center text-xs font-mono-ui text-sky-300">
                    Sisa Durasi: <strong>{Math.floor(activeInfo.remainingSeconds / 3600)}j {Math.floor((activeInfo.remainingSeconds % 3600) / 60)}m</strong>
                  </div>
                ) : isManager ? (
                  <button
                    onClick={() => buyBuff(b.id)}
                    disabled={buying === b.id || (clan.treasury || 0) < b.cost}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#d4a73c] to-[#ff4e2d] text-[#0b0b10] font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-[#d4a73c]/20"
                  >
                    {buying === b.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    Beli & Aktifkan Buff (24 Jam)
                  </button>
                ) : (
                  <p className="text-white/30 text-[11px] text-center font-medium">Hanya Leader/Vice yang dapat membeli buff klan</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ClanHall = ({ clan, me, notify, reload }) => {
  const [tab, setTab] = useState('overview');
  const isManager = ROLE_ORDER.indexOf(clan.myRole) <= 1;

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'members', label: `Member${clan.pendingRequestCount ? ` (${clan.pendingRequestCount})` : ''}` },
    { id: 'war', label: `War${clan.war?.status === 'pending_incoming' ? ' •' : ''}` },
    { id: 'expeditions', label: 'Ekspedisi' },
    { id: 'buffs', label: 'Buff Shop' },
    { id: 'chat', label: 'Chat' },
    { id: 'gacha', label: 'Gacha' }
  ];

  return (
    <div className="space-y-5">
      <div className="flex gap-1.5 bg-[#181820] p-1 rounded-xl border border-white/5 overflow-x-auto scrollbar-none">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${tab === t.id ? 'bg-[#d4a73c] text-[#141419]' : 'text-white/40 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <OverviewTab clan={clan} isManager={isManager} notify={notify} reload={reload} />
          <InviteCodeCard clan={clan} isManager={isManager} notify={notify} reload={reload} />
          <ActivityFeed clanId={clan.id} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-[#181820] border border-white/5 rounded-xl p-4">
              <p className="text-white font-bold text-sm flex items-center gap-1.5"><Send className="w-4 h-4 text-[#3ecf8e]" /> Give EXP</p>
              <p className="text-white/40 text-xs mt-1">Sisipin EXP ke komentar anime/chapter yang kamu tonton atau baca — user lain di luar clan kamu bisa klaim langsung dari komentar itu. Slotnya gak ada batas waktu, tetap kebuka sampai habis diklaim.</p>
            </div>
            <DonateCard clan={clan} me={me} notify={notify} reload={reload} />
          </div>
          <LeaveOrDisbandRow clan={clan} notify={notify} onLeft={reload} />
        </>
      )}
      {tab === 'members' && <MembersTab clan={clan} me={me} notify={notify} reload={reload} />}
      {tab === 'war' && <WarTab clan={clan} isManager={isManager} notify={notify} reload={reload} />}
      {tab === 'expeditions' && <ExpeditionsTab clan={clan} isManager={isManager} notify={notify} reload={reload} />}
      {tab === 'buffs' && <BuffShopTab clan={clan} isManager={isManager} notify={notify} reload={reload} />}
      {tab === 'chat' && <ChatTab clan={clan} me={me} />}
      {tab === 'gacha' && <GachaTab clan={clan} notify={notify} reload={reload} />}
    </div>
  );
};

// ================= PAGE =================
const Clan = () => {
  const navigate = useNavigate();
  const { user: authUser, loading: authLoading } = useAuth();
  const [user, setUser] = useState(null);
  const [clan, setClan] = useState(undefined); // undefined = belum diketahui, null = gak punya clan
  const [meta, setMeta] = useState({ icons: [], colors: [] });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const toastTimer = useRef(null);

  const notify = useCallback((message, type = 'success') => {
    setToast({ message, type });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast({ message: '', type: 'success' }), 2600);
  }, []);

  const loadAll = useCallback(async () => {
    const { data: metaData } = await fetchJson('/api/v1/clan/meta');
    if (metaData?.success) setMeta(metaData);
    if (!authUser) {
      setUser(null);
      setClan(null);
      setLoading(false);
      return;
    }
    setUser(authUser);
    const { data: clanData } = await fetchJson('/api/v1/clan/mine');
    setClan(clanData?.success ? clanData.clan : null);
    setLoading(false);
  }, [authUser]);

  useEffect(() => {
    setSeoMeta('Clan | Ndichan', 'Buat atau gabung clan sesama penggemar anime, naik level bareng, dan chat khusus clan.', null, `${SITE_URL}/clan`, { noIndex: true });
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  return (
    <div className="min-h-screen bg-[#0b0b10]">
      <Navbar />
      <style>{`@keyframes fadeScale{from{opacity:0;transform:scale(0.96)}to{opacity:1;transform:scale(1)}}
@keyframes popIn{from{opacity:0;transform:scale(0.5)}to{opacity:1;transform:scale(1)}}`}</style>

      <main className="max-w-4xl mx-auto px-4 pt-28 pb-28">
        <div className="flex items-center gap-2.5 mb-6">
          <Shield className="w-5 h-5 text-[#d4a73c]" strokeWidth={2.5} />
          <h1 className="text-white font-black text-xl">Clan</h1>
        </div>

        {loading ? (
          <div className="space-y-3">
            <div className="h-40 bg-[#181820] border border-white/5 rounded-2xl animate-pulse" />
            <div className="h-24 bg-[#181820] border border-white/5 rounded-2xl animate-pulse" />
          </div>
        ) : !user ? (
          <div className="bg-[#181820] border border-white/5 rounded-2xl p-10 text-center">
            <Shield className="w-10 h-10 text-white/20 mx-auto mb-3" />
            <p className="text-white font-bold mb-1">Login dulu buat gabung Clan</p>
            <p className="text-white/40 text-sm mb-5">Bikin atau join clan sesama penggemar anime, naik level bareng, dan chat khusus clan.</p>
            <button onClick={() => navigate('/home')} className="px-5 py-2.5 bg-[#d4a73c] text-[#141419] rounded-xl text-sm font-black">Ke Halaman Utama</button>
          </div>
        ) : clan ? (
          <ClanHall clan={clan} me={user} notify={notify} reload={loadAll} />
        ) : (
          <NoClanView meta={meta} user={user} onJoined={loadAll} notify={notify} />
        )}
      </main>

      <Toast message={toast.message} type={toast.type} />
      <Footer />
    </div>
  );
};

export default Clan;
