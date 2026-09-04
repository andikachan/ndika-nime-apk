import React, { useState, useRef, useCallback } from 'react';
import { RARITY_CONFIG, ELEMENTS, calculateCardCP } from '../utils/cardsData';
import {
  Sparkles,
  Shield,
  Swords,
  Star,
  Lock,
  Orbit,
  Sun,
  Moon,
  Zap,
  Globe,
  ShieldCheck,
  Flame,
  Wind,
  EyeOff,
  Droplets,
  Wand2,
  Brain,
  Music,
  KeyRound,
  Skull,
  FlaskConical,
  Crown,
  Waves,
  Sword
} from 'lucide-react';

const ICON_MAP = {
  Orbit,
  Sun,
  Moon,
  Zap,
  Globe,
  ShieldCheck,
  Flame,
  Wind,
  EyeOff,
  Droplets,
  Wand2,
  Brain,
  Music,
  KeyRound,
  Skull,
  FlaskConical,
  Crown,
  Waves,
  Sword
};

const HoloCard = ({
  card,
  stars = 1,
  isUnlocked = true,
  isFlipped = false,
  showBack = false,
  interactive = true,
  size = 'md', // 'sm' | 'md' | 'lg' | 'xl'
  onClick,
  className = '',
  badge = null
}) => {
  const cardRef = useRef(null);
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0, x: 50, y: 50, isHovered: false });

  const rarity = card?.rarity || 'C';
  const config = RARITY_CONFIG[rarity] || RARITY_CONFIG.C;
  const element = ELEMENTS[card?.element] || ELEMENTS.Void;
  const ElementIcon = ICON_MAP[element?.iconName] || Sparkles;
  const cp = calculateCardCP(card, stars);

  const handleMouseMove = useCallback((e) => {
    if (!interactive || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const width = rect.width;
    const height = rect.height;

    // Hitung persentase posisi kursor (0 - 100%)
    const px = Math.min(Math.max((x / width) * 100, 0), 100);
    const py = Math.min(Math.max((y / height) * 100, 0), 100);

    // Hitung derajat rotasi 3D (-15 sampai 15 derajat)
    const rotateY = ((x - width / 2) / (width / 2)) * 14;
    const rotateX = -((y - height / 2) / (height / 2)) * 14;

    setTilt({ rotateX, rotateY, x: px, y: py, isHovered: true });
  }, [interactive]);

  const handleTouchMove = useCallback((e) => {
    if (!interactive || !cardRef.current || !e.touches[0]) return;
    const rect = cardRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    const width = rect.width;
    const height = rect.height;

    const px = Math.min(Math.max((x / width) * 100, 0), 100);
    const py = Math.min(Math.max((y / height) * 100, 0), 100);

    const rotateY = ((x - width / 2) / (width / 2)) * 12;
    const rotateX = -((y - height / 2) / (height / 2)) * 12;

    setTilt({ rotateX, rotateY, x: px, y: py, isHovered: true });
  }, [interactive]);

  const handleLeave = useCallback(() => {
    if (!interactive) return;
    setTilt({ rotateX: 0, rotateY: 0, x: 50, y: 50, isHovered: false });
  }, [interactive]);

  // Size styles mapping
  const SIZES = {
    sm: 'w-36 h-52 text-[10px]',
    md: 'w-52 h-76 text-xs',
    lg: 'w-64 h-92 text-sm',
    xl: 'w-72 md:w-80 h-[430px] md:h-[470px] text-sm'
  };

  const cardDimensions = SIZES[size] || SIZES.md;

  // Custom holographic shader gradients based on rarity
  const getFoilStyle = () => {
    if (!tilt.isHovered && !interactive) return {};

    if (rarity === 'UR') {
      return {
        background: `
          radial-gradient(circle at ${tilt.x}% ${tilt.y}%, rgba(255, 255, 255, 0.45) 0%, transparent 45%),
          linear-gradient(${115 + (tilt.x - 50) * 0.8}deg, 
            transparent 0%, 
            rgba(255, 0, 128, 0.35) 20%, 
            rgba(255, 215, 0, 0.4) 35%, 
            rgba(0, 255, 200, 0.35) 50%, 
            rgba(138, 43, 226, 0.4) 65%, 
            rgba(255, 0, 128, 0.35) 80%, 
            transparent 100%)
        `,
        mixBlendMode: 'color-dodge',
        opacity: tilt.isHovered ? 0.95 : 0.4
      };
    }

    if (rarity === 'SSR') {
      return {
        background: `
          radial-gradient(circle at ${tilt.x}% ${tilt.y}%, rgba(255, 245, 180, 0.55) 0%, transparent 50%),
          linear-gradient(${125 + (tilt.x - 50) * 0.5}deg, 
            transparent 0%, 
            rgba(251, 191, 36, 0.4) 25%, 
            rgba(245, 158, 11, 0.5) 50%, 
            rgba(254, 240, 138, 0.45) 75%, 
            transparent 100%)
        `,
        mixBlendMode: 'color-dodge',
        opacity: tilt.isHovered ? 0.9 : 0.35
      };
    }

    if (rarity === 'SR') {
      return {
        background: `
          radial-gradient(circle at ${tilt.x}% ${tilt.y}%, rgba(243, 232, 255, 0.5) 0%, transparent 50%),
          linear-gradient(${135 + (tilt.x - 50) * 0.4}deg, 
            transparent 0%, 
            rgba(168, 85, 247, 0.35) 30%, 
            rgba(192, 132, 252, 0.45) 50%, 
            rgba(99, 102, 241, 0.35) 70%, 
            transparent 100%)
        `,
        mixBlendMode: 'screen',
        opacity: tilt.isHovered ? 0.85 : 0.3
      };
    }

    if (rarity === 'R') {
      return {
        background: `
          radial-gradient(circle at ${tilt.x}% ${tilt.y}%, rgba(207, 250, 254, 0.45) 0%, transparent 50%),
          linear-gradient(120deg, transparent 0%, rgba(6, 182, 212, 0.3) 45%, rgba(14, 165, 233, 0.4) 55%, transparent 100%)
        `,
        mixBlendMode: 'screen',
        opacity: tilt.isHovered ? 0.75 : 0.25
      };
    }

    return {
      background: `radial-gradient(circle at ${tilt.x}% ${tilt.y}%, rgba(255, 255, 255, 0.2) 0%, transparent 60%)`,
      opacity: tilt.isHovered ? 0.5 : 0.1
    };
  };

  // Card Back Rendering (Tampilan Belakang Kartu / Belum Dibuka)
  if (showBack || isFlipped) {
    return (
      <div
        ref={cardRef}
        onClick={onClick}
        onMouseMove={handleMouseMove}
        onTouchMove={handleTouchMove}
        onMouseLeave={handleLeave}
        onTouchEnd={handleLeave}
        className={`relative ${cardDimensions} rounded-2xl cursor-pointer select-none transition-transform duration-200 ease-out overflow-hidden shadow-2xl ${className}`}
        style={{
          transform: interactive
            ? `perspective(1000px) rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg) scale3d(${tilt.isHovered ? 1.04 : 1}, ${tilt.isHovered ? 1.04 : 1}, 1)`
            : 'none',
          boxShadow: tilt.isHovered ? `0 20px 40px -10px rgba(0,0,0,0.8), 0 0 25px ${config.glow}` : '0 10px 30px -10px rgba(0,0,0,0.7)'
        }}
      >
        <div className="w-full h-full bg-[#121218] border-2 border-[#d4a73c]/50 rounded-2xl p-3 flex flex-col items-center justify-between relative overflow-hidden">
          {/* Background magical pattern */}
          <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#d4a73c_1px,transparent_1px)] [background-size:12px_12px]" />
          <div className="absolute inset-2 border border-[#d4a73c]/30 rounded-xl pointer-events-none" />
          
          {/* Inner circle seal */}
          <div className="w-full flex-1 flex flex-col items-center justify-center relative z-10">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full border-2 border-dashed border-[#d4a73c]/60 flex items-center justify-center animate-[spin_20s_linear_infinite]">
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-full border border-[#d4a73c] flex items-center justify-center bg-[#181822]">
                <Sparkles className="w-6 h-6 md:w-8 md:h-8 text-[#d4a73c] animate-pulse" />
              </div>
            </div>
            <p className="font-display tracking-[0.25em] text-[#d4a73c] text-xs font-black mt-4 uppercase">
              NEFORA CARD
            </p>
            <p className="text-white/40 text-[9px] font-mono-ui mt-0.5 tracking-wider uppercase">
              Mythic Collection
            </p>
          </div>

          {/* Shimmer on hover */}
          <div
            className="absolute inset-0 pointer-events-none transition-opacity duration-300"
            style={{
              background: `radial-gradient(circle at ${tilt.x}% ${tilt.y}%, rgba(212, 167, 60, 0.35) 0%, transparent 60%)`,
              opacity: tilt.isHovered ? 0.8 : 0.2
            }}
          />
        </div>
      </div>
    );
  }

  // Locked Silhouette Rendering (Untuk kartu di album yang belum dikoleksi)
  if (!isUnlocked) {
    return (
      <div
        ref={cardRef}
        onClick={onClick}
        className={`relative ${cardDimensions} rounded-2xl cursor-pointer select-none overflow-hidden bg-[#101016] border border-white/10 p-3 flex flex-col items-center justify-between group hover:border-white/20 transition-all ${className}`}
      >
        <div className="w-full flex items-center justify-between">
          <span className="text-[10px] font-black px-2 py-0.5 rounded bg-white/5 text-white/40">???</span>
          <span className="text-[10px] text-white/30 font-bold">{config.short}</span>
        </div>

        <div className="w-full flex-1 flex flex-col items-center justify-center text-center p-2">
          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
            <Lock className="w-5 h-5 text-white/30 group-hover:text-white/60 transition-colors" />
          </div>
          <p className="text-white/30 font-bold text-xs">Terkunci</p>
          <p className="text-white/20 text-[10px] truncate max-w-[120px]">{card?.anime}</p>
        </div>

        <div className="w-full text-center border-t border-white/5 pt-2">
          <span className="text-[9px] text-white/30 font-medium">Buka lewat Gacha</span>
        </div>
      </div>
    );
  }

  // Unlocked Holographic Front Card Rendering
  return (
    <div
      ref={cardRef}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onTouchMove={handleTouchMove}
      onMouseLeave={handleLeave}
      onTouchEnd={handleLeave}
      className={`relative ${cardDimensions} rounded-2xl select-none transition-transform duration-200 ease-out overflow-hidden shadow-2xl cursor-pointer group ${className}`}
      style={{
        transform: interactive
          ? `perspective(1000px) rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg) scale3d(${tilt.isHovered ? 1.04 : 1}, ${tilt.isHovered ? 1.04 : 1}, 1)`
          : 'none',
        boxShadow: tilt.isHovered
          ? `0 24px 48px -12px rgba(0,0,0,0.9), 0 0 35px ${config.glow}`
          : `0 12px 28px -10px rgba(0,0,0,0.8), 0 0 15px ${config.glow}`
      }}
    >
      {/* Outer Card Shell with Rarity Glow & Border */}
      <div
        className={`w-full h-full bg-[#0d0d12] border-2 ${config.border} rounded-2xl flex flex-col justify-between relative overflow-hidden`}
      >
        {/* Top Header Bar: Rarity Badge, Element, Stars */}
        <div className="relative z-20 p-2.5 flex items-center justify-between bg-gradient-to-b from-[#0d0d12]/95 via-[#0d0d12]/80 to-transparent">
          <div className="flex items-center gap-1.5">
            <span className={`px-2 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wider ${config.badgeBg}`}>
              {config.short}
            </span>
            <div
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-black/60 backdrop-blur-sm border border-white/10"
              style={{ color: element.color }}
            >
              <ElementIcon className="w-3 h-3 shrink-0" />
              <span className="hidden sm:inline">{element.name}</span>
            </div>
          </div>

          {/* Star Level */}
          <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm border border-white/10">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`w-3 h-3 ${i < stars ? 'text-[#f59e0b] fill-[#f59e0b]' : 'text-white/20'}`}
              />
            ))}
          </div>
        </div>

        {/* Character Illustration / Artwork */}
        <div className="absolute inset-0 z-0">
          <img
            src={card?.image}
            alt={card?.name}
            className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(e) => {
              // Fallback jika gambar error
              e.target.src = `https://api.dicebear.com/7.x/identicon/svg?seed=${card?.id || 'card'}`;
            }}
          />
          {/* Subtle vignette gradient overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d12] via-[#0d0d12]/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0d0d12]/60 via-transparent to-transparent" />
        </div>

        {/* Optional Custom Overlay Badge */}
        {badge && (
          <div className="absolute top-10 right-2.5 z-30">
            {badge}
          </div>
        )}

        {/* Dynamic Holographic Foil Shader Overlay Layer */}
        <div
          className="absolute inset-0 pointer-events-none z-10 transition-opacity duration-200"
          style={getFoilStyle()}
        />

        {/* Card Sparks & Foil Glitters for UR & SSR */}
        {(rarity === 'UR' || rarity === 'SSR') && (
          <div className="absolute inset-0 pointer-events-none z-10 opacity-30 bg-[radial-gradient(white_1px,transparent_1px)] [background-size:16px_16px] animate-[pulse_3s_infinite]" />
        )}

        {/* Bottom Metadata & Combat Power (CP) */}
        <div className="relative z-20 p-3 pt-6 bg-gradient-to-t from-[#0d0d12] via-[#0d0d12]/95 to-transparent flex flex-col gap-1.5">
          <div className="min-w-0">
            <p className="text-white/50 text-[10px] font-bold uppercase tracking-wider truncate">
              {card?.anime}
            </p>
            <h4 className="text-white font-black text-sm sm:text-base leading-tight truncate drop-shadow-md">
              {card?.name}
            </h4>
            {card?.subtitle && (size === 'lg' || size === 'xl') && (
              <p className="text-white/40 text-[11px] font-medium truncate mt-0.5">
                {card?.subtitle}
              </p>
            )}
          </div>

          {/* Combat Power (CP) Banner + ATK / DEF */}
          <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-white/10">
            <div className="flex items-center gap-1 text-[11px] font-mono-ui font-bold text-[#d4a73c]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>CP {cp.toLocaleString()}</span>
            </div>

            <div className="flex items-center gap-2 text-[10px] font-mono-ui">
              <span className="flex items-center gap-0.5 text-red-400 font-bold">
                <Swords className="w-3 h-3" />
                {card?.atk}
              </span>
              <span className="flex items-center gap-0.5 text-blue-400 font-bold">
                <Shield className="w-3 h-3" />
                {card?.def}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HoloCard;
