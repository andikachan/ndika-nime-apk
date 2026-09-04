import React, { useEffect, useState } from 'react';
import { X, Loader2, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AvatarFrame from './AvatarFrame';

// mode: 'followers' | 'following'
const FollowListModal = ({ userId, mode, onClose }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/v1/social/${mode}?userId=${encodeURIComponent(userId)}`, { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (active && data.success) setUsers(data.users || []);
      })
      .catch((e) => console.error('Load follow list error:', e))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [userId, mode]);

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
          <h3 className="text-white font-black text-sm">{mode === 'followers' ? 'Pengikut' : 'Mengikuti'}</h3>
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
              <Users className="w-8 h-8 text-white/15 mx-auto mb-2" />
              <p className="text-white/30 text-xs font-medium">
                {mode === 'followers' ? 'Belum ada pengikut' : 'Belum mengikuti siapa-siapa'}
              </p>
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
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default FollowListModal;
