import React from 'react';
import { getAuraById } from '../utils/profileAuras';

/**
 * AvatarAura (Animated Profile Aura Effect)
 * Menampilkan efek aura beranimasi tingkat tinggi di sekeliling avatar profil.
 * Mendukung: Super Saiyan Gold, Shadow Neon, Cursed Flame, Glacier Frost, Phoenix, Celestial.
 */
const AvatarAura = ({ auraId = 'none', className = '', children }) => {
  const aura = getAuraById(auraId);

  if (!aura || aura.id === 'none') {
    return <div className={`relative inline-block ${className}`}>{children}</div>;
  }

  return (
    <div className={`relative inline-block overflow-visible select-none ${className}`}>
      {/* CSS Keyframe Animation Injected */}
      <style>{`
        @keyframes auraSaiyanPulse {
          0%, 100% { transform: scale(1.06); opacity: 0.85; filter: drop-shadow(0 0 14px rgba(234,179,8,0.8)); }
          50% { transform: scale(1.18); opacity: 1; filter: drop-shadow(0 0 24px rgba(234,179,8,1)) drop-shadow(0 0 35px rgba(250,204,21,0.6)); }
        }
        @keyframes auraShadowPulse {
          0%, 100% { transform: scale(1.05) rotate(0deg); opacity: 0.8; filter: drop-shadow(0 0 14px rgba(168,85,247,0.8)); }
          50% { transform: scale(1.16) rotate(180deg); opacity: 1; filter: drop-shadow(0 0 26px rgba(168,85,247,1)) drop-shadow(0 0 35px rgba(6,182,212,0.6)); }
        }
        @keyframes auraCursedFlame {
          0%, 100% { transform: scale(1.08) translateY(0); opacity: 0.85; filter: drop-shadow(0 0 16px rgba(239,68,68,0.85)); }
          50% { transform: scale(1.22) translateY(-3px); opacity: 1; filter: drop-shadow(0 0 28px rgba(239,68,68,1)) drop-shadow(0 0 40px rgba(185,28,28,0.8)); }
        }
        @keyframes auraGlacierFrost {
          0%, 100% { transform: scale(1.05); opacity: 0.75; filter: drop-shadow(0 0 12px rgba(6,182,212,0.8)); }
          50% { transform: scale(1.15); opacity: 1; filter: drop-shadow(0 0 22px rgba(6,182,212,1)) drop-shadow(0 0 32px rgba(56,189,248,0.7)); }
        }
        @keyframes auraPhoenixSolar {
          0%, 100% { transform: scale(1.08) rotate(0deg); opacity: 0.85; filter: drop-shadow(0 0 18px rgba(249,115,22,0.9)); }
          50% { transform: scale(1.24) rotate(180deg); opacity: 1; filter: drop-shadow(0 0 30px rgba(249,115,22,1)) drop-shadow(0 0 45px rgba(239,68,68,0.8)); }
        }
        @keyframes auraRaijinLightning {
          0%, 100% { transform: scale(1.06) rotate(0deg); opacity: 0.85; filter: drop-shadow(0 0 16px rgba(56,189,248,0.9)) drop-shadow(0 0 26px rgba(14,165,233,0.7)); }
          25% { transform: scale(1.18) rotate(90deg); opacity: 1; filter: drop-shadow(0 0 28px rgba(56,189,248,1)) drop-shadow(0 0 40px rgba(6,182,212,0.9)); }
          50% { transform: scale(1.08) rotate(180deg); opacity: 0.85; filter: drop-shadow(0 0 18px rgba(56,189,248,0.9)); }
          75% { transform: scale(1.22) rotate(270deg); opacity: 1; filter: drop-shadow(0 0 30px rgba(56,189,248,1)) drop-shadow(0 0 45px rgba(14,165,233,0.9)); }
        }
        @keyframes auraBloodmoonDark {
          0%, 100% { transform: scale(1.07); opacity: 0.85; filter: drop-shadow(0 0 18px rgba(190,18,60,0.9)) drop-shadow(0 0 30px rgba(136,19,55,0.8)); }
          50% { transform: scale(1.24); opacity: 1; filter: drop-shadow(0 0 32px rgba(225,29,72,1)) drop-shadow(0 0 48px rgba(76,5,25,0.95)); }
        }
        @keyframes auraCelestialRainbow {
          0% { filter: drop-shadow(0 0 20px rgba(236,72,153,0.9)) hue-rotate(0deg); transform: scale(1.06); }
          50% { filter: drop-shadow(0 0 30px rgba(168,85,247,1)) hue-rotate(180deg); transform: scale(1.2); }
          100% { filter: drop-shadow(0 0 20px rgba(236,72,153,0.9)) hue-rotate(360deg); transform: scale(1.06); }
        }
      `}</style>

      {/* ===== AURA 1: SUPER SAIYAN GOLD ===== */}
      {aura.id === 'supersaiyan' && (
        <>
          <div
            className="absolute -inset-2.5 rounded-full pointer-events-none -z-10 bg-gradient-to-t from-amber-500/40 via-yellow-400/50 to-yellow-200/60"
            style={{ animation: 'auraSaiyanPulse 2s ease-in-out infinite' }}
          />
          <div
            className="absolute -inset-4 rounded-full pointer-events-none -z-10 bg-amber-400/20 blur-md"
            style={{ animation: 'auraSaiyanPulse 1.4s ease-in-out infinite alternate' }}
          />
        </>
      )}

      {/* ===== AURA 2: SHADOW NEON VIOLET ===== */}
      {aura.id === 'shadowneon' && (
        <>
          <div
            className="absolute -inset-2.5 rounded-full pointer-events-none -z-10 bg-gradient-to-tr from-purple-600/50 via-fuchsia-500/40 to-cyan-400/50"
            style={{ animation: 'auraShadowPulse 3s linear infinite' }}
          />
          <div
            className="absolute -inset-4 rounded-full pointer-events-none -z-10 bg-purple-600/25 blur-md"
            style={{ animation: 'auraShadowPulse 2s ease-in-out infinite alternate' }}
          />
        </>
      )}

      {/* ===== AURA 3: CURSED CRIMSON FLAME ===== */}
      {aura.id === 'cursedflame' && (
        <>
          <div
            className="absolute -inset-3 rounded-full pointer-events-none -z-10 bg-gradient-to-t from-red-700/60 via-red-500/50 to-orange-400/40"
            style={{ animation: 'auraCursedFlame 1.6s ease-in-out infinite' }}
          />
          <div
            className="absolute -inset-5 rounded-full pointer-events-none -z-10 bg-red-600/30 blur-lg"
            style={{ animation: 'auraCursedFlame 1.1s ease-in-out infinite alternate' }}
          />
        </>
      )}

      {/* ===== AURA 4: GLACIER FROST CYAN ===== */}
      {aura.id === 'glacier' && (
        <>
          <div
            className="absolute -inset-2.5 rounded-full pointer-events-none -z-10 bg-gradient-to-b from-cyan-300/50 via-sky-500/40 to-blue-600/50"
            style={{ animation: 'auraGlacierFrost 2.4s ease-in-out infinite' }}
          />
          <div
            className="absolute -inset-4 rounded-full pointer-events-none -z-10 bg-cyan-400/25 blur-md"
            style={{ animation: 'auraGlacierFrost 1.8s ease-in-out infinite alternate' }}
          />
        </>
      )}

      {/* ===== AURA 5: PHOENIX SOLAR FLARE ===== */}
      {aura.id === 'phoenix' && (
        <>
          <div
            className="absolute -inset-3.5 rounded-full pointer-events-none -z-10 bg-gradient-to-tr from-orange-600/60 via-amber-500/50 to-red-500/50"
            style={{ animation: 'auraPhoenixSolar 2.2s linear infinite' }}
          />
          <div
            className="absolute -inset-5 rounded-full pointer-events-none -z-10 bg-orange-500/30 blur-lg"
            style={{ animation: 'auraPhoenixSolar 1.5s ease-in-out infinite alternate' }}
          />
        </>
      )}

      {/* ===== AURA 6: RAIJIN BLUE LIGHTNING ===== */}
      {aura.id === 'raijin' && (
        <>
          <div
            className="absolute -inset-3.5 rounded-full pointer-events-none -z-10 bg-gradient-to-tr from-sky-500/60 via-cyan-400/60 to-blue-600/60"
            style={{ animation: 'auraRaijinLightning 1.8s linear infinite' }}
          />
          <div
            className="absolute -inset-5 rounded-full pointer-events-none -z-10 bg-sky-400/30 blur-lg"
            style={{ animation: 'auraRaijinLightning 1.2s ease-in-out infinite alternate' }}
          />
        </>
      )}

      {/* ===== AURA 7: BLOODMOON ECLIPSE ===== */}
      {aura.id === 'bloodmoon' && (
        <>
          <div
            className="absolute -inset-3.5 rounded-full pointer-events-none -z-10 bg-gradient-to-b from-rose-700/60 via-red-950/70 to-rose-900/60"
            style={{ animation: 'auraBloodmoonDark 2s ease-in-out infinite' }}
          />
          <div
            className="absolute -inset-5 rounded-full pointer-events-none -z-10 bg-rose-600/30 blur-xl"
            style={{ animation: 'auraBloodmoonDark 1.4s ease-in-out infinite alternate' }}
          />
        </>
      )}

      {/* ===== AURA 8: CELESTIAL GODLY PRISMATIC ===== */}
      {aura.id === 'celestial' && (
        <>
          <div
            className="absolute -inset-3.5 rounded-full pointer-events-none -z-10 bg-gradient-to-r from-pink-500/50 via-purple-500/50 to-indigo-500/50"
            style={{ animation: 'auraCelestialRainbow 4s linear infinite' }}
          />
          <div
            className="absolute -inset-5 rounded-full pointer-events-none -z-10 bg-pink-500/25 blur-lg"
            style={{ animation: 'auraCelestialRainbow 2.5s ease-in-out infinite alternate' }}
          />
        </>
      )}

      {/* Avatar Container Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
};

export default AvatarAura;
