import React, { useState, useEffect, useMemo } from 'react';
import HoloCard from './HoloCard';
import { RARITY_CONFIG } from '../utils/cardsData';
import { Sparkles, X, RotateCcw, Award, CheckCircle2, ChevronRight, Coins, Ticket, Star } from 'lucide-react';

// Gacha Audio Synthesizer
let gachaAudioCtx = null;
const getGachaAudio = () => {
  if (!gachaAudioCtx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) gachaAudioCtx = new AudioCtx();
  }
  if (gachaAudioCtx && gachaAudioCtx.state === 'suspended') {
    gachaAudioCtx.resume().catch(() => {});
  }
  return gachaAudioCtx;
};

const playGachaSfx = (type = 'click', rarity = 'C') => {
  try {
    const ctx = getGachaAudio();
    if (!ctx) return;

    if (type === 'ritual') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = rarity === 'UR' || rarity === 'SSR' ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(120, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(rarity === 'UR' ? 880 : 520, ctx.currentTime + 1.8);
      gain.gain.setValueAtTime(0.01, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 1.2);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 2.2);
    } else if (type === 'reveal') {
      if (rarity === 'UR') {
        [440, 554.37, 659.25, 880, 1108.73, 1318.5].forEach((freq, idx) => {
          setTimeout(() => {
            if (!ctx) return;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            gain.gain.setValueAtTime(0.25, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.5);
          }, idx * 60);
        });
      } else if (rarity === 'SSR') {
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
          setTimeout(() => {
            if (!ctx) return;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.4);
          }, idx * 70);
        });
      } else if (rarity === 'SR') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      } else {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      }
    } else if (type === 'summary') {
      [392, 523.25, 659.25, 783.99].forEach((freq, idx) => {
        setTimeout(() => {
          if (!ctx) return;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime);
          gain.gain.setValueAtTime(0.2, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.45);
        }, idx * 100);
      });
    }
  } catch {}
};

const GachaSummonModal = ({
  isOpen,
  onClose,
  cards = [],
  onPullAgain,
  pullType = 'multi_coin',
  userStats = {},
  isPulling = false
}) => {
  const [phase, setPhase] = useState('ritual'); // 'ritual' | 'reveal' | 'summary'
  const [revealedIndices, setRevealedIndices] = useState(new Set());
  const [spotlightCard, setSpotlightCard] = useState(null);

  // Cari rarity tertinggi yang didapat di pull ini
  const highestRarity = useMemo(() => {
    if (!cards || cards.length === 0) return 'C';
    const rarities = cards.map((c) => c.rarity);
    if (rarities.includes('UR')) return 'UR';
    if (rarities.includes('SSR')) return 'SSR';
    if (rarities.includes('SR')) return 'SR';
    if (rarities.includes('R')) return 'R';
    return 'C';
  }, [cards]);

  const rarityConfig = RARITY_CONFIG[highestRarity] || RARITY_CONFIG.C;

  // Reset state saat modal dibuka dengan kartu baru
  useEffect(() => {
    if (isOpen && cards.length > 0) {
      setPhase('ritual');
      setRevealedIndices(new Set());
      setSpotlightCard(null);
      playGachaSfx('ritual', highestRarity);

      // Transisi dari ritual summoning ke reveal setelah 2.4 detik
      const timer = setTimeout(() => {
        setPhase('reveal');
      }, 2400);

      return () => clearTimeout(timer);
    }
  }, [isOpen, cards, highestRarity]);

  if (!isOpen || cards.length === 0) return null;

  const handleRevealCard = (index) => {
    const next = new Set(revealedIndices);
    next.add(index);
    setRevealedIndices(next);

    const card = cards[index];
    playGachaSfx('reveal', card.rarity);

    // Jika UR atau SSR pertama kali dibuka, berikan efek spotlight
    if ((card.rarity === 'UR' || card.rarity === 'SSR') && card.isNew) {
      setSpotlightCard(card);
    }

    // Jika semua kartu sudah dibuka, pindah ke summary
    if (next.size === cards.length) {
      setTimeout(() => {
        setPhase('summary');
        playGachaSfx('summary', highestRarity);
      }, 800);
    }
  };

  const handleRevealAll = () => {
    const all = new Set(cards.map((_, i) => i));
    setRevealedIndices(all);
    setPhase('summary');
    playGachaSfx('summary', highestRarity);
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto animate-[fadeIn_0.2s_ease-out]">
      {/* Tombol Tutup */}
      <button
        onClick={onClose}
        className="absolute top-5 right-5 z-50 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      {/* ===== 1. FASE RITUAL SUMMONING (ANIMASI LINGKARAN SIHIR) ===== */}
      {phase === 'ritual' && (
        <div className="flex flex-col items-center justify-center text-center relative z-10">
          {/* Energy Beams & Aura */}
          <div
            className="w-72 h-72 md:w-96 md:h-96 rounded-full flex items-center justify-center relative animate-[pulse_1.5s_infinite]"
            style={{ boxShadow: `0 0 100px ${rarityConfig.glow}` }}
          >
            {/* Outer Spinning Arcane Ring */}
            <div
              className="absolute inset-0 rounded-full border-4 border-dashed animate-[spin_12s_linear_infinite]"
              style={{ borderColor: rarityConfig.color }}
            />
            {/* Inner Counter-Spinning Ring */}
            <div
              className="absolute inset-6 rounded-full border-2 border-dashed animate-[spin_8s_linear_infinite_reverse] opacity-70"
              style={{ borderColor: rarityConfig.color }}
            />
            {/* Inner Core Seal */}
            <div className="w-32 h-32 md:w-44 md:h-44 rounded-full bg-[#12121c] border-2 border-white/20 flex flex-col items-center justify-center shadow-2xl relative">
              <Sparkles
                className="w-12 h-12 md:w-16 md:h-16 animate-bounce"
                style={{ color: rarityConfig.color }}
              />
            </div>
          </div>

          <h3 className="font-display tracking-[0.3em] text-xl md:text-3xl text-white font-black mt-8 uppercase animate-pulse">
            MEMANGGIL JIWA ANIME...
          </h3>
          <p className="text-white/40 text-xs md:text-sm font-mono-ui mt-2 flex items-center gap-1.5 justify-center">
            <Sparkles className="w-3.5 h-3.5 text-[#d4a73c]" />
            <span>Resonansi Aura:</span>
            <span style={{ color: rarityConfig.color }} className="font-bold">{rarityConfig.label}</span>
          </p>

          <button
            onClick={() => setPhase('reveal')}
            className="mt-6 px-6 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white/70 text-xs font-bold transition-all"
          >
            Lewati Animasi (Skip)
          </button>
        </div>
      )}

      {/* ===== 2. FASE REVEAL & SUMMARY KARTU ===== */}
      {(phase === 'reveal' || phase === 'summary') && (
        <div className="w-full max-w-5xl flex flex-col items-center my-auto py-6">
          {/* Header Status */}
          <div className="text-center mb-6">
            <h3 className="font-display text-2xl md:text-3xl text-white font-black tracking-wide">
              HASIL PEMANGGILAN GACHA
            </h3>
            <p className="text-white/40 text-xs md:text-sm mt-1">
              {phase === 'reveal'
                ? 'Sentuh kartu untuk membuka satu per satu atau gunakan Buka Semua'
                : `Total ${cards.length} Karakter Berhasil Ditambahkan ke Binder!`}
            </p>
          </div>

          {/* Cards Display Grid */}
          <div
            className={`w-full grid gap-4 justify-items-center items-center ${
              cards.length === 1
                ? 'grid-cols-1 max-w-xs'
                : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-5 max-w-5xl'
            }`}
          >
            {cards.map((card, idx) => {
              const isRevealed = revealedIndices.has(idx) || phase === 'summary';
              return (
                <div key={`${card.id}-${idx}`} className="relative flex flex-col items-center">
                  <HoloCard
                    card={card}
                    stars={card.stars || 1}
                    size={cards.length === 1 ? 'xl' : 'sm'}
                    showBack={!isRevealed}
                    isUnlocked={true}
                    onClick={() => !isRevealed && handleRevealCard(idx)}
                    className="transform transition-all duration-300 hover:scale-105"
                    badge={
                      isRevealed ? (
                        card.isNew ? (
                          <span className="px-2 py-0.5 rounded-full bg-[#ff2a70] text-white text-[9px] font-black uppercase tracking-wider animate-bounce shadow-lg shadow-pink-500/50">
                            NEW!
                          </span>
                        ) : card.stars > 1 ? (
                          <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-black text-[9px] font-black tracking-tight shadow-md flex items-center gap-0.5">
                            <Star className="w-2.5 h-2.5 fill-current" /> STAR UP!
                          </span>
                        ) : null
                      ) : null
                    }
                  />

                  {!isRevealed && (
                    <span className="text-[10px] text-white/50 font-bold mt-2 animate-pulse">
                      Tap untuk Buka
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Action Bar Footer */}
          <div className="flex flex-wrap items-center justify-center gap-3 mt-8 z-20">
            {phase === 'reveal' && (
              <button
                onClick={handleRevealAll}
                className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs md:text-sm transition-all"
              >
                Buka Semua
              </button>
            )}

            {onPullAgain && (
              <button
                onClick={() => onPullAgain(pullType)}
                disabled={isPulling}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#d4a73c] to-[#ff4e2d] text-[#0b0b10] font-black text-xs md:text-sm hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 shadow-lg shadow-[#d4a73c]/20 disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="flex items-center gap-1">
                  {pullType === 'multi_coin' ? (
                    <>Tarik 10x Lagi (<Coins className="w-3.5 h-3.5 inline" /> 900 Coins)</>
                  ) : (
                    <>Tarik 1x Lagi (<Coins className="w-3.5 h-3.5 inline" /> 100 Coins)</>
                  )}
                </span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-[#181822] border border-white/10 hover:border-white/25 text-white font-bold text-xs md:text-sm transition-all flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Selesai & Ke Koleksi
            </button>
          </div>
        </div>
      )}

      {/* ===== 3. SPOTLIGHT POPUP UNTUK UR / SSR BARU ===== */}
      {spotlightCard && (
        <div
          className="fixed inset-0 z-[130] bg-black/90 flex flex-col items-center justify-center p-6 animate-[fadeScale_0.2s_ease-out]"
          onClick={() => setSpotlightCard(null)}
        >
          <div className="relative z-10 flex flex-col items-center text-center max-w-md">
            <span className="px-3.5 py-1 rounded-full bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-400 text-white font-black text-xs uppercase tracking-widest mb-3 shadow-lg animate-bounce flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              MYTHIC CHARACTER UNLOCKED!
              <Sparkles className="w-3.5 h-3.5" />
            </span>

            <HoloCard card={spotlightCard} size="xl" stars={spotlightCard.stars || 1} />

            <div className="mt-4 p-4 rounded-xl bg-black/60 border border-white/10 backdrop-blur-md">
              <p className="text-[#d4a73c] text-xs font-mono-ui italic">
                "{spotlightCard.quote}"
              </p>
            </div>

            <button
              onClick={() => setSpotlightCard(null)}
              className="mt-5 px-6 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all"
            >
              Lanjutkan
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GachaSummonModal;
