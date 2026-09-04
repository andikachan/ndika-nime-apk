import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Disc, Music, Sparkles } from 'lucide-react';

/**
 * Melodi Synthesizer Web Audio API bawaan (Fallback saat URL audio eksternal diblokir/offline)
 */
const MELODIES = {
  synth_piano: [261.63, 329.63, 392.0, 523.25, 392.0, 329.63, 440.0, 349.23],
  synth_peaceful: [329.63, 392.0, 440.0, 493.88, 587.33, 493.88, 440.0, 392.0],
  synth_rock: [220.0, 261.63, 293.66, 329.63, 440.0, 392.0, 329.63, 261.63],
  synth_dance: [440.0, 554.37, 659.25, 880.0, 659.25, 554.37, 440.0, 329.63],
  default: [329.63, 392.0, 440.0, 523.25, 659.25, 523.25, 440.0, 392.0]
};

const ProfileThemeSong = ({ themeSong, userName = 'User', isOwner = false, onEditClick }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [usingFallbackSynth, setUsingFallbackSynth] = useState(false);

  const audioRef = useRef(null);
  const synthCtxRef = useRef(null);
  const synthTimerRef = useRef(null);
  const synthStepRef = useRef(0);

  // Stop everything on unmount or song change
  useEffect(() => {
    stopPlayback();
    setProgress(0);
    setUsingFallbackSynth(false);
    return () => stopPlayback();
  }, [themeSong?.url]);

  const stopPlayback = () => {
    setIsPlaying(false);
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch {}
    }
    if (synthTimerRef.current) {
      clearInterval(synthTimerRef.current);
      synthTimerRef.current = null;
    }
    if (synthCtxRef.current && synthCtxRef.current.state !== 'closed') {
      try {
        synthCtxRef.current.close().catch(() => {});
      } catch {}
      synthCtxRef.current = null;
    }
  };

  // Web Audio Synthesizer Fallback Player
  const startSynthMelody = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      synthCtxRef.current = ctx;

      const melody = MELODIES[themeSong?.fallbackTone] || MELODIES.default;
      synthStepRef.current = 0;

      const playNote = () => {
        if (!ctx || ctx.state === 'closed' || isMuted) return;
        try {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const freq = melody[synthStepRef.current % melody.length];
          synthStepRef.current++;

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, ctx.currentTime);

          gain.gain.setValueAtTime(0.08, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.35);
        } catch {}
      };

      playNote();
      synthTimerRef.current = setInterval(playNote, 420);
      setUsingFallbackSynth(true);
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  };

  if (!themeSong || !themeSong.url) {
    if (!isOwner) return null;
    return (
      <div className="bg-[#14141e] border border-dashed border-white/15 rounded-2xl p-4 flex items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/40">
            <Music className="w-5 h-5" />
          </div>
          <div>
            <p className="text-white font-bold">Belum Ada Anime BGM</p>
            <p className="text-white/40 text-[11px]">Sematkan lagu tema anime favoritmu agar pengunjung bisa mendengarkannya!</p>
          </div>
        </div>
        <button
          onClick={onEditClick}
          className="px-3.5 py-1.5 rounded-xl bg-[#d4a73c]/20 hover:bg-[#d4a73c]/30 text-[#d4a73c] border border-[#d4a73c]/30 font-bold text-xs shrink-0 transition-colors"
        >
          Pasang BGM
        </button>
      </div>
    );
  }

  const togglePlay = () => {
    if (isPlaying) {
      stopPlayback();
      return;
    }

    // Coba putar lewat audio element jika URL valid dan bukan file placeholder
    if (audioRef.current && themeSong?.url && !themeSong.url.startsWith('https://cdn.jsdelivr.net')) {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            setUsingFallbackSynth(false);
          })
          .catch(() => {
            // Jika audio source diblokir / not supported, fallback ke Web Audio synth
            startSynthMelody();
          });
      } else {
        setIsPlaying(true);
      }
    } else {
      // Langsung mainkan synthesizer audio bawaan yang 100% selalu berhasil
      startSynthMelody();
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
    }
    setIsMuted(!isMuted);
  };

  return (
    <div className="bg-gradient-to-r from-[#171724] via-[#12121a] to-[#181826] border border-white/10 rounded-2xl p-3.5 sm:p-4 shadow-xl relative overflow-hidden group select-none">
      {/* Background Ambient Glow */}
      <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-[#d4a73c]/15 rounded-full blur-2xl pointer-events-none" />

      {/* Hidden Native Audio Element with Error Handling */}
      <audio
        ref={audioRef}
        src={themeSong.url}
        preload="none"
        onTimeUpdate={() => {
          if (audioRef.current) setProgress(audioRef.current.currentTime);
        }}
        onLoadedMetadata={() => {
          if (audioRef.current) setDuration(audioRef.current.duration);
        }}
        onEnded={() => {
          setIsPlaying(false);
          setProgress(0);
        }}
        onError={() => {
          // Silent fallback tanpa error uncaught
        }}
      />

      <div className="relative z-10 flex items-center justify-between gap-3 sm:gap-4">
        {/* Left: Vinyl Disc & Cover */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            onClick={togglePlay}
            className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-black border-2 border-white/20 shadow-lg cursor-pointer shrink-0 flex items-center justify-center group/disc"
          >
            {/* Spinning Vinyl Texture */}
            <div
              className={`absolute inset-0 rounded-full bg-gradient-to-tr from-neutral-900 via-neutral-800 to-neutral-950 border border-white/10 ${
                isPlaying ? 'animate-[spin_4s_linear_infinite]' : ''
              }`}
            />

            {/* Song Cover in Center */}
            {themeSong.cover ? (
              <img
                src={themeSong.cover}
                alt={themeSong.title}
                onError={(e) => {
                  e.target.src = '/img/welcomebanner.webp';
                }}
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover relative z-10 border border-white/30 ${
                  isPlaying ? 'animate-[spin_4s_linear_infinite]' : ''
                }`}
              />
            ) : (
              <Disc className={`w-6 h-6 text-[#d4a73c] relative z-10 ${isPlaying ? 'animate-spin' : ''}`} />
            )}

            {/* Play/Pause Overlay on Hover */}
            <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover/disc:opacity-100 transition-opacity flex items-center justify-center z-20">
              {isPlaying ? (
                <Pause className="w-4 h-4 text-white fill-current" />
              ) : (
                <Play className="w-4 h-4 text-white fill-current ml-0.5" />
              )}
            </div>
          </div>

          {/* Song Meta Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[9px] font-mono-ui font-black px-1.5 py-0.5 rounded bg-[#d4a73c]/20 text-[#d4a73c] uppercase">
                PROFILE BGM
              </span>
              {themeSong.anime && (
                <span className="text-[10px] text-white/40 font-medium truncate">• {themeSong.anime}</span>
              )}
              {usingFallbackSynth && isPlaying && (
                <span className="text-[8px] font-mono-ui font-bold px-1 rounded bg-pink-500/20 text-pink-300">
                  CHILL MELODY
                </span>
              )}
            </div>

            <h4 className="text-white font-black text-xs sm:text-sm truncate mt-0.5">{themeSong.title}</h4>
            <p className="text-white/50 text-[11px] truncate">{themeSong.artist || userName}</p>
          </div>
        </div>

        {/* Right: Interactive Equalizer & Controls */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Animated Equalizer Bars */}
          <div className="hidden sm:flex items-end gap-1 h-5 px-2">
            <span
              className={`w-1 bg-[#d4a73c] rounded-full transition-all duration-200 ${
                isPlaying ? 'h-5 animate-pulse' : 'h-1.5 opacity-40'
              }`}
            />
            <span
              className={`w-1 bg-[#ff4e2d] rounded-full transition-all duration-300 ${
                isPlaying ? 'h-3 animate-pulse' : 'h-2 opacity-40'
              }`}
            />
            <span
              className={`w-1 bg-[#ec4899] rounded-full transition-all duration-150 ${
                isPlaying ? 'h-4.5 animate-pulse' : 'h-1.5 opacity-40'
              }`}
            />
            <span
              className={`w-1 bg-[#38bdf8] rounded-full transition-all duration-250 ${
                isPlaying ? 'h-2.5 animate-pulse' : 'h-1 opacity-40'
              }`}
            />
          </div>

          {/* Play/Pause Button */}
          <button
            onClick={togglePlay}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-r from-[#d4a73c] to-[#ff4e2d] text-[#0b0b10] flex items-center justify-center hover:brightness-110 active:scale-95 transition-all shadow-md"
            title={isPlaying ? 'Jeda Lagu' : 'Putar Lagu'}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            )}
          </button>

          {/* Mute Button */}
          <button
            onClick={toggleMute}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center transition-colors"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          {/* Edit Button for Profile Owner */}
          {isOwner && onEditClick && (
            <button
              onClick={onEditClick}
              className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-[11px] font-bold transition-colors"
              title="Ganti BGM Profil"
            >
              Ganti
            </button>
          )}
        </div>
      </div>

      {/* Mini Progress Track */}
      {duration > 0 && (
        <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden mt-3">
          <div
            className="h-full bg-gradient-to-r from-[#d4a73c] via-[#ff4e2d] to-[#ec4899] transition-all duration-200"
            style={{ width: `${(progress / duration) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
};

export default ProfileThemeSong;
