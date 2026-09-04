import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import HoloCard from './HoloCard';
import {
  Sparkles, Award, Plus, ChevronRight, X, Swords, Shield,
  Zap, Volume2, Flame, Orbit, Sun, Moon, Wand2, ArrowRight
} from 'lucide-react';
import { calculateCardCP, RARITY_CONFIG, ELEMENTS } from '../utils/cardsData';

const ELEMENT_SYNERGY_INFO = {
  Void: { name: 'Void Resonance', desc: '+12% Critical Mastery', color: '#a855f7' },
  Light: { name: 'Solar Surge', desc: '+10% Speed & Accuracy', color: '#eab308' },
  Dark: { name: 'Abyssal Grip', desc: '+15% Armor Penetration', color: '#6366f1' },
  Fire: { name: 'Inferno Burst', desc: '+15% Attack Power', color: '#ef4444' },
  Water: { name: 'Tidal Flow', desc: '+12% HP Regeneration', color: '#06b6d4' },
  Wind: { name: 'Gale Velocity', desc: '+14% Evasion Rate', color: '#10b981' },
  Earth: { name: 'Iron Bastion', desc: '+18% Defense Resistance', color: '#d97706' }
};

const ProfileDeck = ({ userId, isOwner = false }) => {
  const navigate = useNavigate();
  const [deck, setDeck] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState(null);
  const [playingVoice, setPlayingVoice] = useState(false);

  const loadDeck = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/gacha/deck?userId=${encodeURIComponent(userId)}`, {
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDeck(data.deck || []);
      }
    } catch (e) {
      console.error('Load deck error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeck();
  }, [userId]);

  const totalDeckCP = useMemo(
    () => deck.reduce((acc, c) => acc + calculateCardCP(c, c.stars || 1), 0),
    [deck]
  );

  // Hitung Sinergi Elemen Deck
  const dominantElement = useMemo(() => {
    if (deck.length === 0) return null;
    const counts = {};
    deck.forEach((c) => {
      if (c.element) counts[c.element] = (counts[c.element] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0] ? sorted[0][0] : null;
  }, [deck]);

  const synergy = dominantElement ? ELEMENT_SYNERGY_INFO[dominantElement] : null;

  // Simple Synthesizer Voice Quote Melodic Tone
  const playCardVoiceTone = (quoteText) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      setPlayingVoice(true);

      const tones = [330, 392, 440, 523, 659];
      tones.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
        gain.gain.setValueAtTime(0.08, ctx.currentTime + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.12);
        osc.stop(ctx.currentTime + i * 0.12 + 0.25);
      });

      setTimeout(() => {
        setPlayingVoice(false);
        try { ctx.close(); } catch {}
      }, 900);
    } catch {
      setPlayingVoice(false);
    }
  };

  if (loading) {
    return <div className="h-48 bg-[#181820] border border-white/5 rounded-2xl animate-pulse" />;
  }

  if (deck.length === 0 && !isOwner) {
    return null;
  }

  return (
    <div className="bg-[#14141d] border border-white/10 rounded-2xl p-5 md:p-6 relative overflow-hidden shadow-2xl">
      <div className="absolute top-0 right-0 w-48 h-48 bg-[#d4a73c]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Showcase */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5 pb-4 border-b border-white/5 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#d4a73c]/20 to-[#ff4e2d]/20 border border-[#d4a73c]/30 flex items-center justify-center shadow-[0_0_15px_rgba(212,167,60,0.2)]">
            <Swords className="w-5 h-5 text-[#d4a73c]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-white font-black text-sm md:text-base uppercase tracking-tight font-mono-ui">
                Showcase Karakter 3D
              </h3>
              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-[#d4a73c]/20 text-[#d4a73c] border border-[#d4a73c]/30">
                Deck Arena
              </span>
            </div>
            <p className="text-white/40 text-xs font-medium mt-0.5">
              3 Kartu pertempuran terbaik yang dipamerkan di profil publik.
            </p>
          </div>
        </div>

        {totalDeckCP > 0 && (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-[#d4a73c] text-xs font-mono-ui font-black bg-gradient-to-r from-[#d4a73c]/20 to-[#ff4e2d]/20 border border-[#d4a73c]/40 px-3 py-1.5 rounded-xl shadow-[0_0_15px_rgba(212,167,60,0.25)]">
              <Sparkles className="w-3.5 h-3.5 text-[#d4a73c]" />
              TOTAL CP: {totalDeckCP.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* Sinergi Elemen Bar */}
      {synergy && (
        <div className="mb-5 p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between flex-wrap gap-2 relative z-10">
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full animate-ping"
              style={{ backgroundColor: synergy.color }}
            />
            <span className="text-white font-bold text-xs">
              Sinergi Deck: <strong style={{ color: synergy.color }}>{synergy.name}</strong>
            </span>
          </div>
          <span className="text-white/40 text-xs font-medium font-mono-ui">{synergy.desc}</span>
        </div>
      )}

      {/* Empty State */}
      {deck.length === 0 && isOwner ? (
        <div className="bg-[#101016] border border-dashed border-white/10 rounded-2xl p-8 text-center relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3 text-white/30">
            <Swords className="w-6 h-6" />
          </div>
          <h4 className="text-white font-black text-sm uppercase">Belum Ada Kartu di Showcase</h4>
          <p className="text-white/40 text-xs font-medium max-w-sm mx-auto mt-1 mb-4">
            Buka Gacha Card Arena untuk mengoleksi kartu karakter anime UR/SSR dan pasang di Deck kamu!
          </p>
          <button
            onClick={() => navigate('/arena')}
            className="px-5 py-2.5 bg-gradient-to-r from-[#d4a73c] to-[#ff4e2d] text-[#0b0b10] text-xs font-black uppercase tracking-wider rounded-xl hover:brightness-110 active:scale-[0.98] transition-all inline-flex items-center gap-1.5 shadow-lg shadow-[#d4a73c]/20"
          >
            <Plus className="w-4 h-4" /> Buka Arena & Pasang Deck
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 justify-items-center relative z-10 py-2">
          {deck.map((card, idx) => (
            <div key={card.id || idx} className="relative flex flex-col items-center group/card cursor-pointer">
              <HoloCard
                card={card}
                stars={card.stars || 1}
                size="md"
                onClick={() => setSelectedCard(card)}
                className="transform transition-all duration-300 group-hover/card:scale-105 group-hover/card:-translate-y-2 shadow-2xl"
              />
              <div className="mt-3 text-center">
                <p className="text-white font-black text-xs truncate max-w-[140px]">{card.name}</p>
                <p className="text-[#d4a73c] text-[10px] font-bold font-mono-ui">
                  CP {calculateCardCP(card, card.stars || 1).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Card Detail Inspection Modal */}
      {selectedCard && (
        <div
          className="fixed inset-0 z-[110] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]"
          onClick={() => setSelectedCard(null)}
        >
          <div
            className="w-full max-w-md bg-[#181824] border border-[#d4a73c]/30 rounded-2xl p-6 flex flex-col items-center text-center relative shadow-[0_0_50px_rgba(212,167,60,0.25)] animate-[scaleUp_0.2s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedCard(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* 3D Holo Card Display */}
            <div className="py-2">
              <HoloCard card={selectedCard} stars={selectedCard.stars || 1} size="lg" />
            </div>

            {/* Character Quote Box */}
            {selectedCard.quote && (
              <div className="mt-4 w-full p-3.5 bg-black/50 border border-white/10 rounded-xl relative group/quote text-left">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] font-black uppercase text-[#d4a73c] font-mono-ui">
                    Quote Karakter
                  </span>
                  <button
                    onClick={() => playCardVoiceTone(selectedCard.quote)}
                    className="text-white/50 hover:text-[#d4a73c] text-xs flex items-center gap-1 transition-colors"
                    title="Dengarkan Suara Karakter"
                  >
                    <Volume2 className={`w-3.5 h-3.5 ${playingVoice ? 'animate-bounce text-[#d4a73c]' : ''}`} />
                    <span className="text-[10px] font-bold">Voice Line</span>
                  </button>
                </div>
                <p className="text-white text-xs italic font-medium">"{selectedCard.quote}"</p>
              </div>
            )}

            {/* Stats Breakdown */}
            <div className="w-full grid grid-cols-3 gap-2 mt-3 text-left">
              <div className="p-2.5 bg-white/5 border border-white/5 rounded-xl">
                <span className="text-[10px] text-white/40 block">Elemen</span>
                <span className="text-white font-black text-xs flex items-center gap-1 mt-0.5">
                  <Sparkles className="w-3 h-3 text-[#d4a73c]" />
                  {selectedCard.element || 'Void'}
                </span>
              </div>
              <div className="p-2.5 bg-white/5 border border-white/5 rounded-xl">
                <span className="text-[10px] text-white/40 block">Kelangkaan</span>
                <span className="text-[#d4a73c] font-black text-xs mt-0.5 block font-mono-ui">
                  {selectedCard.rarity}
                </span>
              </div>
              <div className="p-2.5 bg-white/5 border border-white/5 rounded-xl">
                <span className="text-[10px] text-white/40 block">Combat Power</span>
                <span className="text-[#ff4e2d] font-black text-xs mt-0.5 block font-mono-ui">
                  {calculateCardCP(selectedCard, selectedCard.stars || 1).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            {isOwner && (
              <button
                onClick={() => {
                  setSelectedCard(null);
                  navigate('/arena');
                }}
                className="w-full mt-4 py-2.5 rounded-xl bg-gradient-to-r from-[#d4a73c] to-[#ff4e2d] text-[#0b0b10] font-black text-xs uppercase tracking-wider hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
              >
                Ganti & Upgrade Deck di Arena <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileDeck;
