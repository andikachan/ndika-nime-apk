import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import DanmakuLayer from '../components/DanmakuLayer';
import AmbientGlow from '../components/AmbientGlow';
import { setSeoMeta, SITE_URL } from '../utils/seo';
import {
  Users,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Send,
  Sparkles,
  Copy,
  Check,
  LogOut,
  Crown,
  RotateCcw,
  MessageSquare,
  ListVideo,
  Settings2,
  Shield,
  Radio,
  Tv,
  CheckCircle2,
  Lock,
  ArrowRight,
  RotateCw
} from 'lucide-react';

const DANMAKU_COLORS = ['#ffffff', '#f59e0b', '#06b6d4', '#ec4899', '#ef4444', '#10b981', '#a855f7'];

const W2GRoom = () => {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const passcode = searchParams.get('passcode') || '';
  const navigate = useNavigate();

  const videoRef = useRef(null);
  const playerContainerRef = useRef(null);
  const chatScrollRef = useRef(null);
  const lastSyncTimeRef = useRef(0);
  const isSeekingRef = useRef(false);
  const controlsTimeoutRef = useRef(null);

  const [room, setRoom] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [members, setMembers] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [selectedColor, setSelectedColor] = useState('#ffffff');
  const [danmakuEnabled, setDanmakuEnabled] = useState(true);
  const [danmakuOpacity, setDanmakuOpacity] = useState(0.95);
  const [ambientGlow, setAmbientGlow] = useState(() => localStorage.getItem('ndichan_ambient') !== 'false');

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [seekPopup, setSeekPopup] = useState(null);
  const [driftOffset, setDriftOffset] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'members' | 'episodes'
  const [episodesList, setEpisodesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [lastSeq, setLastSeq] = useState(0);
  const [servers, setServers] = useState([]);
  const [selectedQuality, setSelectedQuality] = useState('720p');
  const [showResolutions, setShowResolutions] = useState(false);

  // Persistent Guest ID helper untuk penonton tanpa login
  const getOrCreateGuestId = () => {
    if (typeof window === 'undefined') return 'guest_anon';
    let gid = localStorage.getItem('ndichan_w2g_guest_id');
    if (!gid) {
      gid = `guest_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem('ndichan_w2g_guest_id', gid);
    }
    return gid;
  };

  // Helper untuk mendapatkan proxy stream URL yang mendukung HTTP 206 Partial Streaming
  const getProxyUrl = (url) => {
    if (!url) return '';
    if (url.includes('cfelainawanggy.pages.dev')) {
      return url.replace('action=proxy', 'action=stream');
    }
    return `https://cfelainawanggy.pages.dev/?action=stream&url=${url}`;
  };

  // Format Waktu mm:ss
  const formatTime = (secs) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Reset timeout sembunyikan kontrol video (otomatis hilang setelah 4 detik idle)
  const resetControlsTimeout = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
      setShowResolutions(false);
    }, 4000);
  };

  // Toggle tap pada video container (menampilkan kontrol jika tersembunyi, atau menyembunyikan jika terbuka)
  const handleVideoAreaClick = (e) => {
    if (e) e.stopPropagation();
    if (!showControls) {
      resetControlsTimeout();
    } else {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      setShowControls(false);
      setShowResolutions(false);
    }
  };

  // Fetch daftar server / kualitas resolusi
  const fetchEpisodeServers = async (epId) => {
    if (!epId) return;
    try {
      const epRes = await fetch(`/ndikagantengtobrutbanget/v1/episode?id=${epId}`).then((r) => r.json());
      if (epRes.status && epRes.data) {
        const mp4Servers = (epRes.data.server || []).filter(
          (s) => s.link && s.type === 'direct' && !s.link.includes('embed=true') && s.link.split('?')[0].endsWith('.mp4')
        );
        const unique = Array.from(new Map(mp4Servers.map((s) => [s.quality, s])).values());
        setServers(unique);
        if (unique.length > 0) {
          const match = unique.find((s) => s.quality === selectedQuality) || unique[0];
          setSelectedQuality(match.quality);
        }
      }
    } catch (e) {
      console.error('Error fetching servers:', e);
    }
  };

  // Ganti Resolusi Video
  const handleResolutionChange = (server) => {
    if (!server || !server.link) return;
    setSelectedQuality(server.quality);
    setShowResolutions(false);
    if (videoRef.current) {
      const curTime = videoRef.current.currentTime;
      const wasPlaying = !videoRef.current.paused;
      const newStreamUrl = getProxyUrl(server.link);
      setRoom((prev) => ({ ...prev, videoUrl: newStreamUrl }));
      videoRef.current.src = newStreamUrl;
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.currentTime = curTime;
          if (wasPlaying) videoRef.current.play().catch(() => {});
        }
      }, 150);
    }
    resetControlsTimeout();
  };

  // 1. Initial Load Room
  const loadRoom = async () => {
    try {
      const gid = getOrCreateGuestId();
      const res = await fetch(`/api/v1/w2g/room?id=${encodeURIComponent(roomId)}&passcode=${encodeURIComponent(passcode)}&guestId=${encodeURIComponent(gid)}`, {
        headers: { 'x-guest-id': gid },
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Room tidak ditemukan');
        setLoading(false);
        return;
      }

      setRoom(data.room);
      setIsHost(data.isHost);
      setCurrentUser(data.currentUser);
      setMembers(data.members || []);
      setChatMessages(data.chat || []);
      if (data.chat?.length > 0) {
        setLastSeq(data.chat[data.chat.length - 1].seq || 0);
      }

      // Restore dan lanjutkan posisi video agar host/member yang reconnect tidak reset ke 0
      const initialTime = data.room.estimatedTime || data.room.currentTime || 0;
      if (initialTime > 0) {
        setCurrentTime(initialTime);
        if (videoRef.current) {
          videoRef.current.currentTime = initialTime;
        }
      }
      if (data.room.isPlaying) {
        setIsPlaying(true);
        if (videoRef.current) {
          videoRef.current.play().catch(() => {});
        }
      }

      // Fetch daftar episode anime jika ada animeId
      if (data.room.animeId) {
        fetch(`/ndikagantengtobrutbanget/v1/detail?id=${data.room.animeId}`)
          .then((r) => r.json())
          .then((d) => {
            if (d.status && d.data) {
              setEpisodesList(d.data.episode_list || []);
            }
          })
          .catch(() => {});
      }

      // Fetch daftar resolusi / server untuk episode aktif
      if (data.room.episodeId) {
        fetchEpisodeServers(data.room.episodeId);
      }

      // Auto-fetch video streaming jika room.videoUrl kosong
      if (!data.room.videoUrl && data.room.episodeId) {
        fetch(`/ndikagantengtobrutbanget/v1/episode?id=${data.room.episodeId}`)
          .then((r) => r.json())
          .then((epD) => {
            if (epD.status && epD.data) {
              const mp4Servers = (epD.data.server || []).filter(
                (s) => s.link && s.type === 'direct' && !s.link.includes('embed=true') && s.link.split('?')[0].endsWith('.mp4')
              );
              if (mp4Servers.length > 0) {
                const best = mp4Servers.find((s) => s.quality === '720p') || mp4Servers.find((s) => s.quality === '480p') || mp4Servers[0];
                const streamUrl = `https://cfelainawanggy.pages.dev/?action=stream&url=${best.link}`;
                setRoom((prev) => ({ ...prev, videoUrl: streamUrl }));
              }
            }
          })
          .catch(() => {});
      }

      setSeoMeta(
        `${data.room.title} - Watch2gether | Ndichan`,
        `Nonton ${data.room.animeTitle} bareng di room ${data.room.title}`,
        data.room.animePoster || '/img/welcomebanner.webp',
        `${SITE_URL}/w2g/${roomId}`
      );
    } catch (e) {
      console.error('Init W2G room error:', e);
      setErrorMsg('Gagal terhubung ke room');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoom();
  }, [roomId, passcode]);

  // 2. Heartbeat & Sync Polling Loop (Tiap 1.5 detik)
  useEffect(() => {
    if (!room || errorMsg) return;

    const interval = setInterval(async () => {
      try {
        const gid = getOrCreateGuestId();
        const userTime = videoRef.current ? videoRef.current.currentTime : 0;
        const res = await fetch('/api/v1/w2g/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-guest-id': gid },
          credentials: 'include',
          body: JSON.stringify({
            roomId,
            lastSeq,
            userCurrentTime: userTime,
            guestId: gid
          })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          if (res.status === 404 || data.error?.includes('ditutup') || data.error?.includes('tidak ditemukan')) {
            setErrorMsg(data.error || 'Room telah ditutup atau sudah tidak aktif.');
          }
          return;
        }

        if (data.success) {
          setMembers(data.members || []);
          setIsHost(data.isHost);

          // Append chat baru dengan DEDUPLIKASI KETAT (cegah duplikat komentar)
          if (data.newChat && data.newChat.length > 0) {
            setChatMessages((prev) => {
              const existingIds = new Set(prev.map((c) => c.id));
              const uniqueNew = data.newChat.filter((c) => !existingIds.has(c.id));
              if (uniqueNew.length === 0) return prev;
              return [...prev, ...uniqueNew];
            });
            const maxSeq = Math.max(...data.newChat.map((c) => c.seq || 0), lastSeq);
            setLastSeq(maxSeq);
          }

          // Sinkronisasi Video untuk Non-Host (Tanpa glitch looping saat video dijeda)
          if (!data.isHost && videoRef.current && data.playback) {
            const hostTime = data.playback.currentTime;
            const myTime = videoRef.current.currentTime;
            const diff = Math.abs(hostTime - myTime);
            setDriftOffset(diff);

            // Jika video URL berubah (ganti episode)
            if (data.playback.videoUrl && data.playback.videoUrl !== room.videoUrl) {
              setRoom((prev) => ({
                ...prev,
                videoUrl: data.playback.videoUrl,
                episodeIndex: data.playback.episodeIndex,
                animeTitle: data.playback.animeTitle
              }));
              videoRef.current.src = getProxyUrl(data.playback.videoUrl);
              videoRef.current.currentTime = hostTime || 0;
            }

            // Sync Play / Pause
            if (data.playback.isPlaying) {
              if (videoRef.current.paused) {
                videoRef.current.currentTime = hostTime;
                videoRef.current.play().catch(() => {});
                setIsPlaying(true);
              } else if (diff > 3.5 && !isSeekingRef.current) {
                videoRef.current.currentTime = hostTime;
              }
            } else {
              // HOST SEDANG PAUSE
              if (!videoRef.current.paused) {
                videoRef.current.pause();
                setIsPlaying(false);
              }
              // Saat video sedang di-pause, jangan seek berulang-ulang kecuali selisih waktu sangat jauh (> 5 detik)
              if (diff > 5 && !isSeekingRef.current) {
                videoRef.current.currentTime = hostTime;
              }
            }
          }
        }
      } catch (e) {
        console.error('W2G poll error:', e);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [room, lastSeq, roomId, errorMsg]);

  // Scroll chat ke paling bawah saat ada pesan baru
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // 3. Host Mengirim Sinkronisasi (Play / Pause / Seek)
  const broadcastSync = useCallback(
    async (playing, time, vidUrl = null, epIndex = null) => {
      if (!isHost) return;
      const now = Date.now();
      if (now - lastSyncTimeRef.current < 300) return; // debounce 300ms
      lastSyncTimeRef.current = now;

      let sendTime = typeof time === 'number' ? time : videoRef.current ? videoRef.current.currentTime : 0;
      if (sendTime < 1 && (room?.estimatedTime || room?.currentTime || 0) > 3) {
        sendTime = room.estimatedTime || room.currentTime;
      }

      try {
        const gid = getOrCreateGuestId();
        await fetch('/api/v1/w2g/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-guest-id': gid },
          credentials: 'include',
          body: JSON.stringify({
            roomId,
            isPlaying: playing,
            currentTime: sendTime,
            videoUrl: vidUrl || room?.videoUrl,
            episodeIndex: epIndex || room?.episodeIndex,
            guestId: gid
          })
        });
      } catch (e) {
        console.error('Broadcast sync error:', e);
      }
    },
    [isHost, roomId, room]
  );

  // Play/Pause Video Handler (Hanya bisa dijalankan Host)
  const togglePlay = () => {
    if (!videoRef.current || !isHost) return;
    const nextPlaying = videoRef.current.paused;
    let targetTime = videoRef.current.currentTime;

    // Jika video baru di-load dan currentTime masih 0 sementara room sudah berjalan jauh
    if (targetTime < 1 && (room?.estimatedTime || room?.currentTime || 0) > 3) {
      targetTime = room.estimatedTime || room.currentTime;
      videoRef.current.currentTime = targetTime;
    }

    if (nextPlaying) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
      broadcastSync(true, targetTime);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      broadcastSync(false, targetTime);
    }
    resetControlsTimeout();
  };

  // Skip -10s / +10s Handler (Hanya Host)
  const handleSkip = (seconds) => {
    if (!videoRef.current || !isHost) return;
    const newTime = Math.min(Math.max(videoRef.current.currentTime + seconds, 0), duration || 10000);
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    setSeekPopup({ amount: seconds, key: Date.now() });
    setTimeout(() => setSeekPopup(null), 800);
    broadcastSync(isPlaying, newTime);
    resetControlsTimeout();
  };

  // Seekbar Change Handler (Hanya Host)
  const handleSeek = (e) => {
    if (!videoRef.current || !isHost) return;
    const target = parseFloat(e.target.value);
    videoRef.current.currentTime = target;
    setCurrentTime(target);
    broadcastSync(isPlaying, target);
    resetControlsTimeout();
  };

  // Sinkronkan manual ke host (untuk member)
  const handleManualSyncNow = () => {
    if (!room || !videoRef.current) return;
    videoRef.current.currentTime = room.currentTime || 0;
    if (room.isPlaying) {
      videoRef.current.play().catch(() => {});
    }
  };

  // 4. Kirim Pesan Chat & Danmaku
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!inputText.trim()) return;

    const textToSend = inputText.trim();
    setInputText('');

    try {
      const gid = getOrCreateGuestId();
      const vidTime = videoRef.current ? videoRef.current.currentTime : 0;
      const res = await fetch('/api/v1/w2g/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-guest-id': gid },
        credentials: 'include',
        body: JSON.stringify({
          roomId,
          text: textToSend,
          color: selectedColor,
          isDanmaku: true,
          videoTime: vidTime,
          guestId: gid
        })
      });
      const data = await res.json();
      if (res.ok && data.success && data.message) {
        // Tambahkan ke chat sender secara instan dengan deduplikasi
        setChatMessages((prev) => {
          if (prev.some((c) => c.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
        setLastSeq((prev) => Math.max(prev, data.message.seq || 0));
      }
    } catch (e) {
      console.error('Send chat error:', e);
    }
  };

  // 5. Host Mengganti Episode
  const handleHostChangeEpisode = async (epObj) => {
    if (!isHost) return;
    try {
      let vidUrl = '';
      const epRes = await fetch(`/ndikagantengtobrutbanget/v1/episode?id=${epObj.id}`).then((r) => r.json());
      if (epRes.status && epRes.data) {
        const mp4Servers = (epRes.data.server || []).filter(
          (s) => s.link && s.type === 'direct' && !s.link.includes('embed=true') && s.link.split('?')[0].endsWith('.mp4')
        );
        if (mp4Servers.length > 0) {
          const best = mp4Servers.find((s) => s.quality === '720p') || mp4Servers.find((s) => s.quality === '480p') || mp4Servers[0];
          vidUrl = `https://cfelainawanggy.pages.dev/?action=stream&url=${best.link}`;
        }
      }

      const gid = getOrCreateGuestId();
      await fetch('/api/v1/w2g/change-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-guest-id': gid },
        credentials: 'include',
        body: JSON.stringify({
          roomId,
          episodeIndex: String(epObj.index),
          episodeId: epObj.id,
          videoUrl: vidUrl,
          guestId: gid
        })
      });

      fetchEpisodeServers(epObj.id);

      setRoom((prev) => ({
        ...prev,
        episodeIndex: String(epObj.index),
        episodeId: epObj.id,
        videoUrl: vidUrl
      }));

      if (videoRef.current && vidUrl) {
        videoRef.current.src = getProxyUrl(vidUrl);
        videoRef.current.play().catch(() => {});
      }
    } catch (e) {
      console.error('Host change ep error:', e);
    }
  };

  // 6. Tutup & Hapus Room Permanen (Host/Creator)
  const handleCloseRoom = async () => {
    if (!window.confirm('Yakin ingin menutup dan menghapus room W2G ini? Room akan dihapus secara permanen.')) return;
    try {
      await fetch('/api/v1/w2g/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ roomId })
      });
    } catch {}
    navigate('/watch2gether');
  };

  // 7. Keluar Room
  const handleLeaveRoom = async () => {
    try {
      await fetch('/api/v1/w2g/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ roomId })
      });
    } catch {}
    navigate('/watch2gether');
  };

  // Salin Link Room
  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/w2g/${roomId}`);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0b10] text-white flex flex-col justify-between pt-24 pb-12">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 w-full text-center my-auto space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-[#d4a73c]/10 text-[#d4a73c] flex items-center justify-center mx-auto animate-pulse">
            <Radio className="w-8 h-8" />
          </div>
          <h3 className="font-display text-xl font-bold">Menghubungkan ke Room W2G...</h3>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-[#0b0b10] text-white flex flex-col justify-between pt-24 pb-12">
        <Navbar />
        <div className="max-w-md mx-auto px-4 w-full text-center my-auto space-y-4 bg-[#14141e] border border-white/10 p-8 rounded-3xl">
          <div className="w-14 h-14 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
            <LogOut className="w-7 h-7" />
          </div>
          <h3 className="font-black text-xl">{errorMsg}</h3>
          <p className="text-white/40 text-xs">Room mungkin telah ditutup atau passcode salah.</p>
          <button
            onClick={() => navigate('/watch2gether')}
            className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors"
          >
            Kembali ke Daftar Room
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0b10] text-white flex flex-col justify-between pt-20 pb-8">
      <Navbar />

      <div className="max-w-[1600px] mx-auto px-2 sm:px-4 w-full flex-1 flex flex-col">
        {/* Room Header Top Bar */}
        <div className="bg-[#13131c] border border-white/10 rounded-2xl p-3 md:p-4 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xl">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#d4a73c] to-[#ff4e2d] flex items-center justify-center text-[#0b0b10] shrink-0 font-black">
              <Tv className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-white font-black text-sm md:text-base truncate">{room?.title}</h1>
                <span className="px-2 py-0.5 rounded bg-[#d4a73c]/20 text-[#d4a73c] font-mono-ui font-black text-[10px]">
                  EP {room?.episodeIndex}
                </span>
              </div>
              <p className="text-white/40 text-xs truncate">
                {room?.animeTitle} • Host: <b className="text-white">{room?.hostName}</b>
              </p>
            </div>
          </div>

          {/* Action Tools & Status */}
          <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
            {/* Live Viewers Count */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono-ui font-bold text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{members.length} Penonton</span>
            </div>

            {/* Copy Room Link Button */}
            <button
              onClick={handleCopyLink}
              className="px-3 py-1.5 rounded-xl bg-[#1c1c28] hover:bg-white/15 border border-white/10 text-white font-bold text-xs flex items-center gap-1.5 transition-colors"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Tersalin!' : `Kode: ${roomId}`}</span>
            </button>

            {/* Host / Creator Close Room Button */}
            {(isHost || currentUser?.id === room?.creatorId) && (
              <button
                onClick={handleCloseRoom}
                className="px-3 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-300 font-bold text-xs flex items-center gap-1.5 transition-colors"
                title="Tutup dan hapus room W2G ini secara permanen"
              >
                <LogOut className="w-3.5 h-3.5 text-red-400" />
                <span>Tutup Room</span>
              </button>
            )}

            {/* Leave Room Button */}
            <button
              onClick={handleLeaveRoom}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-white/70 hover:text-white font-bold text-xs flex items-center gap-1.5 transition-colors"
              title="Keluar dari Room"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </div>

        {/* Main Grid: Video Player (70%) + Sidebar (30%) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
          {/* ===== LEFT: VIDEO PLAYER AREA (8 Columns) ===== */}
          <div className="lg:col-span-8 flex flex-col gap-3">
            {/* Video Box Container with Ambient Glow */}
            <div className="relative overflow-visible">
              <AmbientGlow videoRef={videoRef} isPlaying={isPlaying} enabled={ambientGlow} />
              <div
                ref={playerContainerRef}
                className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden border border-white/10 shadow-2xl flex items-center justify-center group select-none z-10"
                onMouseMove={resetControlsTimeout}
              >
                {/* Floating Danmaku Bullet Comments Overlay */}
                <DanmakuLayer
                  messages={chatMessages}
                  currentTime={currentTime}
                  isPlaying={isPlaying}
                  enabled={danmakuEnabled}
                  opacity={danmakuOpacity}
                />

                {/* Seek Feedback Popup (+10s / -10s) */}
                {seekPopup && (
                  <div
                    key={seekPopup.key}
                    className="absolute z-40 bg-black/70 border border-white/20 text-white px-5 py-2.5 rounded-full font-black text-sm md:text-base flex items-center gap-2 backdrop-blur-md animate-[popSeek_0.4s_ease-out] pointer-events-none"
                  >
                    {seekPopup.amount > 0 ? <RotateCw className="w-5 h-5 text-[#d4a73c]" /> : <RotateCcw className="w-5 h-5 text-[#d4a73c]" />}
                    <span>{seekPopup.amount > 0 ? `+${seekPopup.amount}s` : `${seekPopup.amount}s`}</span>
                  </div>
                )}

                {/* Buffering Loading Indicator */}
                {isBuffering && (
                  <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-none animate-[fadeIn_0.2s_ease-out]">
                    <div className="w-12 h-12 border-4 border-[#d4a73c] border-t-transparent rounded-full animate-spin mb-3 shadow-[0_0_20px_rgba(212,167,60,0.4)]" />
                    <span className="text-white text-xs font-black font-mono-ui uppercase tracking-wider">Menghubungkan Stream...</span>
                  </div>
                )}

                {/* Video Element */}
                <video
                  ref={videoRef}
                  crossOrigin="anonymous"
                  src={getProxyUrl(room?.videoUrl)}
                  playsInline
                  className="w-full h-full object-contain pointer-events-none"
                  onTimeUpdate={() => {
                    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
                  }}
                  onLoadedMetadata={() => {
                    if (videoRef.current) {
                      setDuration(videoRef.current.duration);
                      const target = room?.estimatedTime || room?.currentTime || 0;
                      if (target > 0 && Math.abs(videoRef.current.currentTime - target) > 1.5) {
                        videoRef.current.currentTime = target;
                        setCurrentTime(target);
                      }
                    }
                  }}
                  onPlay={() => {
                    setIsPlaying(true);
                    setIsBuffering(false);
                  }}
                  onPause={() => setIsPlaying(false)}
                  onWaiting={() => setIsBuffering(true)}
                  onPlaying={() => setIsBuffering(false)}
                  onCanPlay={() => setIsBuffering(false)}
                  onError={() => {
                    setIsBuffering(false);
                    // Recovery: coba ambil server cadangan jika video terputus
                    if (room?.episodeId) {
                      fetch(`/ndikagantengtobrutbanget/v1/episode?id=${room.episodeId}`)
                        .then((r) => r.json())
                        .then((d) => {
                          if (d.status && d.data) {
                            const mp4Servers = (d.data.server || []).filter(
                              (s) => s.link && s.type === 'direct' && !s.link.includes('embed=true') && s.link.split('?')[0].endsWith('.mp4')
                            );
                            if (mp4Servers.length > 0) {
                              const best = mp4Servers.find((s) => s.quality === '720p') || mp4Servers.find((s) => s.quality === '480p') || mp4Servers[0];
                              const fallbackUrl = `https://cfelainawanggy.pages.dev/?action=stream&url=${best.link}`;
                              setRoom((prev) => ({ ...prev, videoUrl: fallbackUrl }));
                            }
                          }
                        })
                        .catch(() => {});
                    }
                  }}
                />

                {/* Transparent Tap & Double Tap Interaction Overlay */}
                <div
                  className="absolute inset-0 z-20 flex cursor-pointer touch-manipulation"
                  onClick={handleVideoAreaClick}
                >
                  {/* Left 30% Double Tap / Click for -10s */}
                  <div
                    className="w-[30%] h-full"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      if (isHost) handleSkip(-10);
                    }}
                  />
                  {/* Center 40% Tap Area */}
                  <div className="w-[40%] h-full" />
                  {/* Right 30% Double Tap / Click for +10s */}
                  <div
                    className="w-[30%] h-full"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      if (isHost) handleSkip(10);
                    }}
                  />
                </div>

                {/* Center Play & Skip Controls (HANYA TAMPIL SAAT KONTROL DIBUKA & UNTUK HOST) */}
                <div
                  className={`absolute inset-0 flex items-center justify-center gap-8 md:gap-14 z-30 transition-opacity duration-200 pointer-events-none ${
                    showControls ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  {isHost && showControls && (
                    <div
                      className="pointer-events-auto flex items-center justify-center gap-8 md:gap-14"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSkip(-10);
                          resetControlsTimeout();
                        }}
                        className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-black/60 hover:bg-black/90 border border-white/20 text-white hover:text-[#d4a73c] flex flex-col items-center justify-center backdrop-blur-md active:scale-95 transition-all shadow-xl"
                        title="Mundur 10 detik"
                      >
                        <RotateCcw className="w-5 h-5 md:w-6 md:h-6" />
                        <span className="text-[9px] font-black font-mono-ui">-10s</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePlay();
                          resetControlsTimeout();
                        }}
                        className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-[#d4a73c] hover:bg-[#ff4e2d] text-[#0b0b10] flex items-center justify-center shadow-2xl active:scale-95 transition-all"
                        title={isPlaying ? 'Jeda' : 'Putar'}
                      >
                        {isPlaying ? (
                          <Pause className="w-8 h-8 md:w-10 md:h-10 fill-current" />
                        ) : (
                          <Play className="w-8 h-8 md:w-10 md:h-10 fill-current ml-1" />
                        )}
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSkip(10);
                          resetControlsTimeout();
                        }}
                        className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-black/60 hover:bg-black/90 border border-white/20 text-white hover:text-[#d4a73c] flex flex-col items-center justify-center backdrop-blur-md active:scale-95 transition-all shadow-xl"
                        title="Maju 10 detik"
                      >
                        <RotateCw className="w-5 h-5 md:w-6 md:h-6" />
                        <span className="text-[9px] font-black font-mono-ui">+10s</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Custom Video Controls Bottom Overlay */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    resetControlsTimeout();
                  }}
                  className={`absolute inset-x-0 bottom-0 z-40 p-3 bg-gradient-to-t from-black/95 via-black/70 to-transparent flex flex-col gap-2 transition-opacity duration-200 ${
                    showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                  }`}
                >
                {/* Timeline Progress Bar (Host: Input Range, Member: Read-Only Bar) */}
                {isHost ? (
                  <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    step={0.1}
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#d4a73c]"
                  />
                ) : (
                  <div className="w-full h-1.5 bg-white/20 rounded-lg overflow-hidden relative" title="Progress Pemutaran Video (Disinkronkan oleh Host)">
                    <div
                      style={{ width: `${Math.min(100, Math.max(0, (currentTime / (duration || 1)) * 100))}%` }}
                      className="h-full bg-[#d4a73c] rounded-lg transition-all duration-150"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between text-xs">
                  {/* Left Controls */}
                  <div className="flex items-center gap-3">
                    {isHost ? (
                      <button onClick={togglePlay} className="text-white hover:text-[#d4a73c] transition-colors" title={isPlaying ? 'Jeda' : 'Putar'}>
                        {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-[10px] font-mono-ui text-white/80 select-none">
                        <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                        <span className="font-bold">{isPlaying ? 'Memutar' : 'Dijeda'}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          if (videoRef.current) {
                            videoRef.current.muted = !isMuted;
                            setIsMuted(!isMuted);
                          }
                        }}
                        className="text-white/70 hover:text-white"
                      >
                        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      </button>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={isMuted ? 0 : volume}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          setVolume(v);
                          if (videoRef.current) {
                            videoRef.current.volume = v;
                            videoRef.current.muted = false;
                            setIsMuted(false);
                          }
                        }}
                        className="w-16 h-1 bg-white/20 rounded accent-white"
                      />
                    </div>

                    <span className="text-white/60 font-mono-ui text-[11px]">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                  </div>

                  {/* Right Controls */}
                  <div className="flex items-center gap-2 md:gap-3">
                    {/* Danmaku Toggle Button */}
                    <button
                      onClick={() => setDanmakuEnabled(!danmakuEnabled)}
                      className={`px-2 py-0.5 rounded text-[10px] font-black border transition-colors ${
                        danmakuEnabled
                          ? 'bg-[#d4a73c]/20 border-[#d4a73c] text-[#d4a73c]'
                          : 'bg-white/5 border-white/20 text-white/40'
                      }`}
                    >
                      DANMAKU {danmakuEnabled ? 'ON' : 'OFF'}
                    </button>

                    {/* Ambient Glow Toggle Button */}
                    <button
                      onClick={() => {
                        setAmbientGlow((prev) => {
                          const nextVal = !prev;
                          localStorage.setItem('ndichan_ambient', nextVal);
                          return nextVal;
                        });
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] font-black border transition-colors flex items-center gap-1 ${
                        ambientGlow
                          ? 'bg-[#d4a73c]/20 border-[#d4a73c] text-[#d4a73c]'
                          : 'bg-white/5 border-white/20 text-white/40 hover:text-white'
                      }`}
                      title="Ambient Glow Effect (Dynamic Backlight)"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span className="hidden sm:inline">GLOW</span>
                    </button>

                    {/* Resolution / Quality Switcher Dropdown */}
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowResolutions(!showResolutions);
                        }}
                        className="text-[10px] md:text-[11px] font-mono-ui font-black px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/10 flex items-center gap-1 uppercase"
                        title="Pilih Kualitas / Resolusi Video"
                      >
                        <span>{selectedQuality || '720p'}</span>
                      </button>

                      {showResolutions && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute bottom-full right-0 mb-3 bg-[#181824] border border-white/15 shadow-2xl p-1.5 flex flex-col min-w-[95px] z-50 rounded-xl backdrop-blur-xl animate-[fadeIn_0.15s_ease-out]"
                        >
                          <span className="text-[9px] font-bold text-white/40 px-2 py-1 uppercase tracking-wider border-b border-white/5 mb-1 font-mono-ui">
                            Resolusi
                          </span>
                          {servers.length > 0 ? (
                            servers.map((s) => (
                              <button
                                key={s.id || s.quality}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleResolutionChange(s);
                                }}
                                className={`text-xs font-bold px-2.5 py-1.5 text-left rounded-lg transition-all flex items-center justify-between ${
                                  selectedQuality === s.quality
                                    ? 'text-[#d4a73c] bg-white/10 font-black shadow-sm'
                                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                                }`}
                              >
                                <span>{s.quality}</span>
                                {selectedQuality === s.quality && <span className="w-1.5 h-1.5 rounded-full bg-[#d4a73c]" />}
                              </button>
                            ))
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowResolutions(false);
                              }}
                              className="text-xs font-bold px-2.5 py-1.5 text-left text-[#d4a73c] bg-white/10 rounded-lg"
                            >
                              720p HD
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        const container = playerContainerRef.current;
                        if (!document.fullscreenElement) {
                          container?.requestFullscreen?.();
                          setIsFullscreen(true);
                        } else {
                          document.exitFullscreen?.();
                          setIsFullscreen(false);
                        }
                      }}
                      className="text-white/70 hover:text-white"
                    >
                      {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            </div>

            {/* Sync Status Banner & Danmaku Controls Strip */}
            <div className="bg-[#14141e] border border-white/10 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span className="text-white/60">
                  Status Sync:{' '}
                  <b className="text-white">
                    {isHost ? 'Anda adalah Host (Memimpin Pemutaran)' : `Tersinkron ke ${room?.hostName}`}
                  </b>
                </span>
                {!isHost && driftOffset > 2 && (
                  <button
                    onClick={handleManualSyncNow}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 font-bold text-[11px] hover:bg-amber-500/30 flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" /> Sinkronkan Sekarang
                  </button>
                )}
              </div>

              {/* Danmaku Color Quick Selector */}
              <div className="flex items-center gap-1.5">
                <span className="text-white/40 text-[11px]">Warna Danmaku:</span>
                {DANMAKU_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setSelectedColor(c)}
                    className={`w-4 h-4 rounded-full border transition-transform ${
                      selectedColor === c ? 'scale-125 border-white' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* ===== RIGHT: INTERACTIVE ROOM SIDEBAR (4 Columns) ===== */}
          <div className="lg:col-span-4 bg-[#14141e] border border-white/10 rounded-2xl flex flex-col h-[520px] lg:h-auto overflow-hidden shadow-2xl">
            {/* Sidebar Tabs */}
            <div className="flex items-center border-b border-white/10 p-1.5 bg-[#101018]">
              {[
                ['chat', 'Live Chat', MessageSquare],
                ['members', `Penonton (${members.length})`, Users],
                ['episodes', 'Daftar Episode', ListVideo]
              ].map(([key, label, Icon]) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === key
                      ? 'bg-[#1e1e2c] text-[#d4a73c] shadow-md'
                      : 'text-white/40 hover:text-white/70'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="truncate">{label}</span>
                </button>
              ))}
            </div>

            {/* TAB 1: LIVE CHAT STREAM */}
            {activeTab === 'chat' && (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Message List */}
                <div ref={chatScrollRef} className="flex-1 p-3 overflow-y-auto custom-scrollbar space-y-3">
                  {chatMessages.length === 0 ? (
                    <div className="text-center text-white/30 text-xs py-10">
                      Belum ada pesan. Mulai obrolan atau kirim Danmaku!
                    </div>
                  ) : (
                    chatMessages.map((msg) => (
                      <div key={msg.id} className="flex items-start gap-2 text-xs">
                        <img
                          src={msg.userAvatar || '/img/kaguya.webp'}
                          alt={msg.userName}
                          className="w-6 h-6 rounded-full object-cover shrink-0 mt-0.5 border border-white/10"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-white/80 text-[11px]">{msg.userName}</span>
                            {msg.clanBadge && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold">
                                {msg.clanBadge}
                              </span>
                            )}
                            {msg.isDanmaku && (
                              <span className="text-[9px] px-1 rounded bg-white/5 text-white/40 font-mono-ui">
                                Danmaku
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs leading-relaxed" style={{ color: msg.color || '#ffffff' }}>
                            {msg.text}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Input Chat Footer (Tanpa duplikasi tombol Danmaku) */}
                <form onSubmit={handleSendMessage} className="p-3 bg-[#101018] border-t border-white/10 flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Ketik pesan chat / Danmaku..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    maxLength={150}
                    className="flex-1 bg-[#1a1a26] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-white/30 focus:border-[#d4a73c] outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!inputText.trim()}
                    className="p-2.5 rounded-xl bg-gradient-to-r from-[#d4a73c] to-[#ff4e2d] text-[#0b0b10] hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 shrink-0"
                    title="Kirim Pesan"
                  >
                    <Send className="w-4 h-4 font-black" />
                  </button>
                </form>
              </div>
            )}

            {/* TAB 2: ONLINE MEMBERS LIST */}
            {activeTab === 'members' && (
              <div className="flex-1 p-3 overflow-y-auto custom-scrollbar space-y-2 divide-y divide-white/5">
                {members.map((m) => (
                  <div key={m.userId} className="pt-2 first:pt-0 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative">
                        <img
                          src={m.avatar || '/img/kaguya.webp'}
                          alt={m.name}
                          className="w-8 h-8 rounded-full object-cover border border-white/10"
                        />
                        {m.role === 'host' && (
                          <Crown className="w-3.5 h-3.5 text-amber-400 absolute -top-1.5 -right-1.5 fill-current" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-bold text-white text-xs truncate">{m.name}</h4>
                          {m.role === 'host' && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 text-[9px] font-black uppercase">
                              HOST
                            </span>
                          )}
                        </div>
                        <span className="text-white/40 text-[10px] block">
                          Level {m.level || 1} • {m.title || 'Anime Newbie'}
                        </span>
                      </div>
                    </div>

                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                  </div>
                ))}
              </div>
            )}

            {/* TAB 3: EPISODES LIST (Host can change episode) */}
            {activeTab === 'episodes' && (
              <div className="flex-1 p-3 overflow-y-auto custom-scrollbar space-y-2">
                <p className="text-white/40 text-[11px] mb-2">
                  {isHost
                    ? 'Pilih episode di bawah untuk mengganti pemutaran bagi seluruh penonton:'
                    : 'Daftar episode anime ini:'}
                </p>

                {episodesList.map((ep) => {
                  const isCurrent = String(ep.index) === String(room?.episodeIndex);
                  return (
                    <div
                      key={ep.id}
                      onClick={() => isHost && handleHostChangeEpisode(ep)}
                      className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
                        isCurrent
                          ? 'bg-[#d4a73c]/15 border-[#d4a73c] text-[#d4a73c] font-black'
                          : isHost
                          ? 'bg-[#1b1b28] border-white/5 text-white/80 hover:bg-white/10 hover:border-white/20 cursor-pointer'
                          : 'bg-[#1b1b28] border-white/5 text-white/50 cursor-default'
                      }`}
                    >
                      <span>Episode {ep.index}</span>
                      {isCurrent ? (
                        <span className="text-[10px] uppercase font-mono-ui font-black">Sedang Diputar</span>
                      ) : isHost ? (
                        <span className="text-[10px] text-white/40">Putar Ep Ini</span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default W2GRoom;
