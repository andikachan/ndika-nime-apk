import React, { useEffect, useRef, useState } from 'react';

/**
 * AmbientGlow (Dynamic Backlight / Ambilight ala YouTube Theater Mode)
 * Memancarkan bias cahaya dinamis di sekeliling pemutar video.
 * Menggunakan real-time canvas frame sampling dengan fallback gradient aura
 * sehingga 100% selalu terlihat jelas, terang, dan tidak tertutupi layer lain.
 */
const AmbientGlow = ({
  videoRef,
  isPlaying = false,
  enabled = true,
  intensity = 0.85,
  blur = 50
}) => {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const lastDrawTimeRef = useRef(0);
  const [hasCanvasColor, setHasCanvasColor] = useState(false);

  useEffect(() => {
    if (!enabled || !videoRef?.current || !canvasRef.current) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: false, alpha: false });

    let isRunning = true;

    const renderGlow = () => {
      if (!isRunning) return;

      const now = performance.now();
      if (now - lastDrawTimeRef.current >= 45) {
        lastDrawTimeRef.current = now;

        if (
          video &&
          video.readyState >= 2 &&
          !video.paused &&
          !video.ended &&
          video.videoWidth > 0
        ) {
          try {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            if (!hasCanvasColor) setHasCanvasColor(true);
          } catch (e) {
            // Jika cross-origin membatasi drawImage, fallback gradient aktif
          }
        }
      }

      if (isPlaying && enabled) {
        animFrameRef.current = requestAnimationFrame(renderGlow);
      }
    };

    if (isPlaying) {
      animFrameRef.current = requestAnimationFrame(renderGlow);
    } else {
      if (video && video.readyState >= 2 && video.videoWidth > 0) {
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          setHasCanvasColor(true);
        } catch (e) {}
      }
    }

    return () => {
      isRunning = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [videoRef, isPlaying, enabled, hasCanvasColor]);

  if (!enabled) return null;

  return (
    <div className="absolute -inset-4 sm:-inset-8 md:-inset-12 z-0 pointer-events-none overflow-visible flex items-center justify-center transition-all duration-700 ease-out">
      {/* Canvas sampling real-time frame video */}
      <canvas
        ref={canvasRef}
        width={32}
        height={18}
        className={`absolute inset-0 w-full h-full object-cover rounded-3xl transition-opacity duration-500 ${
          hasCanvasColor ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          filter: `blur(${blur}px) saturate(220%) brightness(1.25)`,
          transform: 'scale(1.08)',
          willChange: 'filter, transform'
        }}
      />

      {/* Fallback Ambient Glow Gradient (jika canvas CORS atau saat awal play) */}
      <div
        className={`absolute inset-0 w-full h-full rounded-3xl bg-gradient-to-tr from-[#d4a73c]/35 via-[#ff4e2d]/30 to-[#9333ea]/25 transition-opacity duration-700 ${
          hasCanvasColor ? 'opacity-30' : 'opacity-85'
        } ${isPlaying ? 'animate-pulse' : ''}`}
        style={{
          filter: `blur(${blur + 15}px)`,
          transform: 'scale(1.05)',
          animationDuration: '4s'
        }}
      />
    </div>
  );
};

export default AmbientGlow;
