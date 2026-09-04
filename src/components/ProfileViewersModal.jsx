import React, { useEffect, useState } from 'react';
import { X, Loader2, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AvatarFrame from './AvatarFrame';

const timeAgo = (ts) => {
  if (!ts) return '';
  try {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return 'Baru saja';
    if (diff < 3600) return `${Math.floor(diff / 60)}m lalu`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}j lalu`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}h lalu`;
    return new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
};

// Modal buat nampilin daftar orang yang terakhir liat profil kita.
// Cuma dipanggil dari halaman profil sendiri (Profile.jsx), karena
// endpoint /api/v1/social/viewers cuma ngasih data ke pemilik profil.
const ProfileViewersModal = ({ userId, onClose }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/v1/social/viewers?userId=${encodeURIComponent(userId)}`, { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (active && data.success) {
          setUsers(data.users || []);
          setTotal(data.total || 0);
        }
      })
      .catch((e) => console.error('Load profile viewers error:', e))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [userId]);

  const goToUser = (id) => {
    onClose();
    navigate(`/user/${id}`);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full md:w-[420px] max-h-[75vh] bg-[#181820] border border-white/10 rounded-t-2xl md:rounded-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <h3 className="text-white font-black text-sm">
            Dilihat Oleh {total > 0 && <span className="text-white/30 font-medium">({total})</span>}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10">
            <X className="w-4 h-4 text-white/50" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-2">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 text-white/30 animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-10">
              <Eye className="w-8 h-8 text-white/15 mx-auto mb-2" />
              <p className="text-white/30 text-xs font-medium">Belum ada yang liat profil kamu</p>
            </div>
          ) : (
            users.map((u) => (
              <button
                key={u.id}
                onClick={() => goToUser(u.id)}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors text-left"
              >
                <AvatarFrame frameId={u.frame} className="w-10 h-10 shrink-0" rounded="rounded-full">
                  <img
                    src={u.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=F6CF80&color=0a0a0c&size=128`}
                    alt={u.name}
                    className="w-full h-full object-cover rounded-full"
                  />
                </AvatarFrame>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-sm truncate">{u.name}</p>
                  <p className="text-white/30 text-[11px] font-medium truncate">{u.title || `Level ${u.level}`}</p>
                </div>
                <span className="text-white/25 text-[10px] font-bold shrink-0">{timeAgo(u.viewedAt)}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileViewersModal;
