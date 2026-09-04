import React, { useState, useEffect, useRef } from 'react';

/**
 * DanmakuLayer - Komentar Melayang (Bullet Comments) 1 per 1 Berurutan
 * Menampilkan komentar satu per satu secara teratur di bagian atas layar
 * dengan sistem antrean (queue) agar tidak bertumpuk atau ramai berantakan.
 */
const DanmakuLayer = ({
  messages = [],
  isPlaying = true,
  enabled = true,
  opacity = 0.95
}) => {
  const [activeBullets, setActiveBullets] = useState([]);
  const displayedMsgIds = useRef(new Set());
  const pendingQueue = useRef([]);
  const laneToggle = useRef(0);

  // Jalur atas yang bersih (hanya 2 jalur di atas: 6% dan 14%)
  const LANES_PCT = [6, 14];

  // Bersihkan semua bullet dan antrean jika Danmaku dinonaktifkan
  useEffect(() => {
    if (!enabled) {
      setActiveBullets([]);
      pendingQueue.current = [];
    }
  }, [enabled]);

  // Masukkan pesan baru yang masuk ke dalam antrean (Queue)
  useEffect(() => {
    if (!enabled || !messages || messages.length === 0) return;

    for (const msg of messages) {
      if (!msg || !msg.isDanmaku || displayedMsgIds.current.has(msg.id)) continue;
      displayedMsgIds.current.add(msg.id);
      pendingQueue.current.push(msg);
    }
  }, [messages, enabled]);

  // Eksekusi antrean Danmaku 1 per 1 setiap ~1.4 detik
  useEffect(() => {
    if (!enabled) return;

    const queueTimer = setInterval(() => {
      if (!isPlaying || pendingQueue.current.length === 0) return;

      const nextMsg = pendingQueue.current.shift();
      if (!nextMsg) return;

      const chosenLane = LANES_PCT[laneToggle.current % LANES_PCT.length];
      laneToggle.current = (laneToggle.current + 1) % LANES_PCT.length;

      const newBullet = {
        id: `${nextMsg.id || Date.now()}_${Math.random()}`,
        text: nextMsg.text,
        color: nextMsg.color || '#ffffff',
        topPct: chosenLane,
        duration: 7, // 7 detik melayang dari kanan ke kiri
        startTime: Date.now()
      };

      setActiveBullets((prev) => [...prev, newBullet]);
    }, 1400);

    return () => clearInterval(queueTimer);
  }, [enabled, isPlaying]);

  // Bersihkan bullet yang sudah lewat dari layar
  useEffect(() => {
    const cleanupTimer = setInterval(() => {
      const now = Date.now();
      setActiveBullets((prev) =>
        prev.filter((b) => now - b.startTime < b.duration * 1000 + 500)
      );
    }, 1000);

    return () => clearInterval(cleanupTimer);
  }, []);

  if (!enabled) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-20 select-none">
      {activeBullets.map((bullet) => (
        <div
          key={bullet.id}
          className="absolute whitespace-nowrap px-3 py-1 rounded-full text-xs sm:text-sm font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]"
          style={{
            top: `${bullet.topPct}%`,
            right: 0,
            transform: 'translateX(100%)',
            animation: `danmakuFlyOne ${bullet.duration}s linear forwards`,
            animationPlayState: isPlaying ? 'running' : 'paused',
            color: bullet.color || '#ffffff',
            opacity,
            textShadow: '0 0 4px rgba(0,0,0,0.95), 0 2px 6px rgba(0,0,0,0.9)'
          }}
        >
          {bullet.text}
        </div>
      ))}

      <style>{`
        @keyframes danmakuFlyOne {
          0% {
            transform: translateX(100%);
          }
          100% {
            transform: translateX(-150vw);
          }
        }
      `}</style>
    </div>
  );
};

export default DanmakuLayer;
