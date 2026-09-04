import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import {
  Trophy, Swords, Crown, Play, Sparkles, Shield, User,
  Check, Clock, Award, AlertCircle, Loader2, RefreshCw,
  Zap, Flame, ChevronRight, Gift, History, Eye
} from 'lucide-react';
import { setSeoMeta, SITE_URL } from '../utils/seo';

const TournamentColosseum = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tournamentData, setTournamentData] = useState(null);
  const [registering, setRegistering] = useState(false);
  const [simulating, setSimulating] = useState(false);

  // Replay Modal State
  const [activeReplay, setActiveReplay] = useState(null);
  const [loadingReplay, setLoadingReplay] = useState(false);

  // Toast
  const [toast, setToast] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    setSeoMeta({
      title: 'Colosseum Grand Tournament 16 Besar - Ndika-Nime',
      description: 'Turnamen sistem gugur 16 pemain mingguan di Ndika-Nime. Daftarkan deck kartu terbaikmu, rebut Piala Bergilir Emas, dan tonton tayangan ulang duel!',
      url: `${SITE_URL}/tournament`
    });
  }, []);

  const showToast = (msg, isError = false) => {
    if (isError) {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(''), 4000);
    } else {
      setToast(msg);
      setTimeout(() => setToast(''), 4000);
    }
  };

  const loadTournament = async () => {
    try {
      const res = await fetch('/api/v1/tournament/status', { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setTournamentData(data);
      }
    } catch (e) {
      console.error('Load tournament error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTournament();
  }, []);

  // Action: Daftar Turnamen
  const handleRegister = async () => {
    if (registering) return;
    setRegistering(true);
    try {
      const res = await fetch('/api/v1/tournament/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Berhasil mendaftar turnamen!');
        loadTournament();
      } else {
        showToast(data.error || 'Gagal mendaftar turnamen', true);
      }
    } catch (e) {
      showToast('Gagal terhubung ke server', true);
    } finally {
      setRegistering(false);
    }
  };

  // Action: Mulai Simulasi Pertandingan Turnamen (Admin / Auto-start)
  const handleStartSimulation = async () => {
    if (simulating) return;
    setSimulating(true);
    try {
      const res = await fetch('/api/v1/tournament/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      const data = await res.json();
      if (data.success) {
        showToast('Turnamen Berhasil Disimulasikan! Seluruh pertandingan telah selesai!');
        loadTournament();
      } else {
        showToast(data.error || 'Gagal memulai simulasi turnamen', true);
      }
    } catch (e) {
      showToast('Gagal memproses simulasi', true);
    } finally {
      setSimulating(false);
    }
  };

  // Action: Tonton Replay Match
  const handleWatchReplay = async (matchId) => {
    if (!matchId) return;
    setLoadingReplay(true);
    try {
      const res = await fetch(`/api/v1/tournament/replay?matchId=${matchId}&seasonWeek=${tournamentData?.tournament?.seasonWeek}`, {
        credentials: 'include'
      });
      const data = await res.json();
      if (data.success) {
        setActiveReplay(data.replay);
      } else {
        showToast(data.error || 'Gagal memuat rekaman pertandingan', true);
      }
    } catch (e) {
      showToast('Gagal memuat replay', true);
    } finally {
      setLoadingReplay(false);
    }
  };

  if (loading || !tournamentData) {
    return (
      <div className="min-h-screen bg-[#0b0b10] text-white flex flex-col justify-between">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#d4a73c] animate-spin" />
        </div>
        <Footer />
      </div>
    );
  }

  const { tournament, isUserRegistered, championHistory } = tournamentData;
  const bracket = tournament.bracket || {};
  const isFinished = tournament.status === 'FINISHED';

  return (
    <div className="min-h-screen bg-[#0b0b10] text-white flex flex-col justify-between selection:bg-[#d4a73c]/30 selection:text-[#d4a73c]">
      <Navbar />

      {/* Floating Toast Notification */}
      <div className="fixed top-6 right-6 z-[300] max-w-md w-full px-4 space-y-2 pointer-events-none">
        {toast && (
          <div className="p-4 bg-[#181824] border border-[#d4a73c]/50 rounded-2xl flex items-center gap-3 shadow-[0_0_30px_rgba(212,167,60,0.35)] pointer-events-auto animate-[slideDown_0.25s_ease-out]">
            <div className="w-8 h-8 rounded-xl bg-[#d4a73c]/20 flex items-center justify-center text-[#d4a73c] shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <p className="text-white font-black text-xs leading-relaxed">{toast}</p>
          </div>
        )}
        {errorMsg && (
          <div className="p-4 bg-[#181824] border border-red-500/60 rounded-2xl flex items-center gap-3 shadow-[0_0_30px_rgba(239,68,68,0.35)] pointer-events-auto animate-[slideDown_0.25s_ease-out]">
            <div className="w-8 h-8 rounded-xl bg-red-500/20 flex items-center justify-center text-red-400 shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
            <p className="text-red-300 font-black text-xs leading-relaxed">{errorMsg}</p>
          </div>
        )}
      </div>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 space-y-8">
        {/* ─── 1. HEADER BANNER & REGISTRATION ─── */}
        <div className="bg-[#14141d] border border-white/10 rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#d4a73c]/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-[#d4a73c]/20 border border-[#d4a73c]/35 text-[#d4a73c] font-mono-ui">
                  TURNAMEN SISTEM GUGUR 16 BESAR
                </span>
                <span className="text-xs text-white/40 font-mono-ui">
                  Musim: {tournament.seasonWeek}
                </span>
                <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full font-mono-ui ${
                  isFinished
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                }`}>
                  {isFinished ? 'SELESAI • JUARA TELAH DITETAPKAN' : 'PENDAFTARAN DIBUKA'}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-tight text-white font-mono-ui">
                Colosseum Grand Tournament
              </h1>
              <p className="text-white/40 text-xs md:text-sm font-medium mt-1 leading-relaxed">
                Ajang adu taktik deck kartu tertinggi antarpemain! Saksikan pertarungan babak 16 besar, perempat final, semifinal, hingga Grand Final dengan tayangan ulang duel sinematik.
              </p>
            </div>

            {/* Registration Action Buttons */}
            <div className="flex items-center gap-3 flex-wrap">
              {isFinished ? (
                <div className="p-3 bg-black/50 border border-[#d4a73c]/30 rounded-2xl text-center">
                  <span className="text-[10px] text-white/40 block font-bold">Status Turnamen:</span>
                  <span className="text-emerald-400 font-mono-ui font-black text-xs uppercase flex items-center gap-1 justify-center">
                    <Trophy className="w-3.5 h-3.5" /> Turnamen Minggu Ini Selesai
                  </span>
                </div>
              ) : isUserRegistered ? (
                <div className="px-5 py-3 bg-emerald-500/15 border border-emerald-500/40 rounded-2xl flex items-center gap-2 text-emerald-400 font-black text-xs uppercase font-mono-ui">
                  <Check className="w-4 h-4 stroke-[3]" />
                  Deck Kartu Terdaftar ({tournament.participantsCount}/16 Peserta)
                </div>
              ) : (
                <button
                  onClick={handleRegister}
                  disabled={registering || tournament.participantsCount >= 16}
                  className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-red-600 via-[#ff4e2d] to-[#d4a73c] text-[#0b0b10] font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] shadow-lg shadow-[#ff4e2d]/30 transition-all disabled:opacity-50"
                >
                  {registering ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Swords className="w-4 h-4" />
                      Daftar Turnamen ({tournament.participantsCount}/16)
                    </>
                  )}
                </button>
              )}

              {/* Tombol Simulasikan Turnamen (jika belum selesai) */}
              {!isFinished && (
                <button
                  onClick={handleStartSimulation}
                  disabled={simulating}
                  className="px-4 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all"
                  title="Mulai Pertandingan Turnamen & Simulasi Bracket"
                >
                  {simulating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 text-[#d4a73c]" />}
                  Mulai Pertandingan
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ─── 2. CHAMPION PODIUM SHOWCASE (JIKA SELESAI) ─── */}
        {isFinished && tournament.champion && (
          <div className="bg-gradient-to-r from-[#181824] via-[#1b192e] to-[#181824] border-2 border-[#d4a73c] rounded-3xl p-6 md:p-8 shadow-[0_0_50px_rgba(212,167,60,0.25)] relative overflow-hidden text-center">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-amber-400 to-[#ff4e2d] flex items-center justify-center mx-auto text-[#0b0b10] shadow-2xl shadow-amber-400/50 mb-3 animate-bounce">
              <Trophy className="w-10 h-10" />
            </div>

            <span className="text-xs font-mono-ui font-black uppercase text-[#d4a73c] tracking-widest block">
              GRAND CHAMPION OF COLOSSEUM • MUSIM {tournament.seasonWeek}
            </span>
            <h2 className="text-3xl sm:text-4xl font-black uppercase font-mono-ui text-white mt-1">
              {tournament.champion.name}
            </h2>
            <p className="text-amber-300 text-xs md:text-sm font-bold uppercase tracking-wider">
              Gelar Resmi: Colosseum Grand Champion
            </p>

            <div className="flex items-center justify-center gap-4 mt-4 flex-wrap text-xs">
              <span className="px-3.5 py-1.5 rounded-xl bg-black/60 border border-[#d4a73c]/40 text-[#d4a73c] font-mono-ui font-black">
                Hadiah: +10,000 Koin Kuno & +10x Tiket Gacha
              </span>
              {tournament.runnerUp && (
                <span className="px-3.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white/60 font-mono-ui">
                  Runner-Up: <strong>{tournament.runnerUp.name}</strong> (+5,000 Koin)
                </span>
              )}
            </div>
          </div>
        )}

        {/* ─── 3. INTERACTIVE 16-PLAYER TOURNAMENT BRACKET ─── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-black text-sm uppercase tracking-wider font-mono-ui flex items-center gap-2">
              <Swords className="w-4 h-4 text-[#d4a73c]" /> Bagan Sistem Gugur 16 Pemain
            </h3>
            <span className="text-xs text-white/40">
              Klik ikon play untuk menonton tayangan ulang duel
            </span>
          </div>

          <div className="overflow-x-auto pb-4 custom-scrollbar">
            <div className="min-w-[950px] grid grid-cols-4 gap-6 relative">
              {/* ===== KOLOM 1: 16 BESAR (8 MATCHES) ===== */}
              <div className="space-y-4">
                <div className="p-2.5 bg-[#14141d] border border-white/10 rounded-xl text-center">
                  <span className="text-[11px] font-mono-ui font-black text-[#d4a73c] uppercase">
                    Babak 16 Besar (8 Match)
                  </span>
                </div>

                {(bracket.r16 || []).length === 0 ? (
                  <div className="p-6 text-center text-xs text-white/30 border border-dashed border-white/10 rounded-2xl">
                    Menunggu pendaftaran 16 pemain...
                  </div>
                ) : (
                  bracket.r16.map((m) => (
                    <div
                      key={m.matchId}
                      className="bg-[#14141d] border border-white/10 hover:border-[#d4a73c]/50 rounded-2xl p-3 space-y-2 shadow-md transition-all relative group"
                    >
                      {/* Player 1 */}
                      <div className={`flex items-center justify-between p-2 rounded-xl text-xs font-mono-ui ${
                        m.winnerId === m.p1.id ? 'bg-[#d4a73c]/20 text-[#d4a73c] font-black' : 'bg-black/30 text-white/60'
                      }`}>
                        <span className="truncate max-w-[120px]">{m.p1.name}</span>
                        <span>{m.p1.score?.toLocaleString()} DMG</span>
                      </div>

                      {/* Player 2 */}
                      <div className={`flex items-center justify-between p-2 rounded-xl text-xs font-mono-ui ${
                        m.winnerId === m.p2.id ? 'bg-[#d4a73c]/20 text-[#d4a73c] font-black' : 'bg-black/30 text-white/60'
                      }`}>
                        <span className="truncate max-w-[120px]">{m.p2.name}</span>
                        <span>{m.p2.score?.toLocaleString()} DMG</span>
                      </div>

                      <button
                        onClick={() => handleWatchReplay(m.matchId)}
                        className="w-full py-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-[10px] font-bold uppercase tracking-wider text-white/70 flex items-center justify-center gap-1 transition-all"
                      >
                        <Play className="w-3 h-3 text-[#d4a73c]" /> Tonton Replay
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* ===== KOLOM 2: PEREMPAT FINAL (4 MATCHES) ===== */}
              <div className="space-y-6">
                <div className="p-2.5 bg-[#14141d] border border-white/10 rounded-xl text-center">
                  <span className="text-[11px] font-mono-ui font-black text-sky-400 uppercase">
                    Perempat Final (4 Match)
                  </span>
                </div>

                {(bracket.qf || []).length === 0 ? (
                  <div className="p-6 text-center text-xs text-white/30 border border-dashed border-white/10 rounded-2xl mt-12">
                    Menunggu pemenang babak 16 besar...
                  </div>
                ) : (
                  bracket.qf.map((m) => (
                    <div
                      key={m.matchId}
                      className="bg-[#14141d] border border-white/10 hover:border-sky-400/50 rounded-2xl p-3 space-y-2 shadow-md transition-all relative mt-6"
                    >
                      <div className={`flex items-center justify-between p-2 rounded-xl text-xs font-mono-ui ${
                        m.winnerId === m.p1.id ? 'bg-sky-500/20 text-sky-300 font-black' : 'bg-black/30 text-white/60'
                      }`}>
                        <span className="truncate max-w-[120px]">{m.p1.name}</span>
                        <span>{m.p1.score?.toLocaleString()}</span>
                      </div>
                      <div className={`flex items-center justify-between p-2 rounded-xl text-xs font-mono-ui ${
                        m.winnerId === m.p2.id ? 'bg-sky-500/20 text-sky-300 font-black' : 'bg-black/30 text-white/60'
                      }`}>
                        <span className="truncate max-w-[120px]">{m.p2.name}</span>
                        <span>{m.p2.score?.toLocaleString()}</span>
                      </div>
                      <button
                        onClick={() => handleWatchReplay(m.matchId)}
                        className="w-full py-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-[10px] font-bold uppercase tracking-wider text-white/70 flex items-center justify-center gap-1 transition-all"
                      >
                        <Play className="w-3 h-3 text-sky-400" /> Tonton Replay
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* ===== KOLOM 3: SEMIFINAL (2 MATCHES) ===== */}
              <div className="space-y-12">
                <div className="p-2.5 bg-[#14141d] border border-white/10 rounded-xl text-center">
                  <span className="text-[11px] font-mono-ui font-black text-purple-400 uppercase">
                    Semifinal (2 Match)
                  </span>
                </div>

                {(bracket.sf || []).length === 0 ? (
                  <div className="p-6 text-center text-xs text-white/30 border border-dashed border-white/10 rounded-2xl mt-24">
                    Menunggu semifinalis...
                  </div>
                ) : (
                  bracket.sf.map((m) => (
                    <div
                      key={m.matchId}
                      className="bg-[#14141d] border border-white/10 hover:border-purple-400/50 rounded-2xl p-3 space-y-2 shadow-md transition-all relative mt-16"
                    >
                      <div className={`flex items-center justify-between p-2 rounded-xl text-xs font-mono-ui ${
                        m.winnerId === m.p1.id ? 'bg-purple-500/20 text-purple-300 font-black' : 'bg-black/30 text-white/60'
                      }`}>
                        <span className="truncate max-w-[120px]">{m.p1.name}</span>
                        <span>{m.p1.score?.toLocaleString()}</span>
                      </div>
                      <div className={`flex items-center justify-between p-2 rounded-xl text-xs font-mono-ui ${
                        m.winnerId === m.p2.id ? 'bg-purple-500/20 text-purple-300 font-black' : 'bg-black/30 text-white/60'
                      }`}>
                        <span className="truncate max-w-[120px]">{m.p2.name}</span>
                        <span>{m.p2.score?.toLocaleString()}</span>
                      </div>
                      <button
                        onClick={() => handleWatchReplay(m.matchId)}
                        className="w-full py-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-[10px] font-bold uppercase tracking-wider text-white/70 flex items-center justify-center gap-1 transition-all"
                      >
                        <Play className="w-3 h-3 text-purple-400" /> Tonton Replay
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* ===== KOLOM 4: GRAND FINAL (1 MATCH) ===== */}
              <div className="space-y-24">
                <div className="p-2.5 bg-gradient-to-r from-amber-500/20 to-red-500/20 border border-amber-400/40 rounded-xl text-center">
                  <span className="text-[11px] font-mono-ui font-black text-amber-300 uppercase flex items-center justify-center gap-1">
                    <Trophy className="w-3.5 h-3.5 text-amber-400" /> Grand Final (Penentuan Juara)
                  </span>
                </div>

                {!bracket.final ? (
                  <div className="p-6 text-center text-xs text-white/30 border border-dashed border-white/10 rounded-2xl mt-36">
                    Menunggu finalis...
                  </div>
                ) : (
                  <div className="bg-gradient-to-b from-[#181824] to-[#14141d] border-2 border-amber-400/60 rounded-2xl p-4 space-y-3 shadow-2xl relative mt-28">
                    <div className={`flex items-center justify-between p-2.5 rounded-xl text-xs font-mono-ui ${
                      bracket.final.winnerId === bracket.final.p1.id ? 'bg-amber-400/20 text-amber-300 font-black' : 'bg-black/40 text-white/60'
                    }`}>
                      <div className="flex items-center gap-1.5">
                        {bracket.final.winnerId === bracket.final.p1.id && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                        <span className="truncate max-w-[120px]">{bracket.final.p1.name}</span>
                      </div>
                      <span>{bracket.final.p1.score?.toLocaleString()}</span>
                    </div>

                    <div className={`flex items-center justify-between p-2.5 rounded-xl text-xs font-mono-ui ${
                      bracket.final.winnerId === bracket.final.p2.id ? 'bg-amber-400/20 text-amber-300 font-black' : 'bg-black/40 text-white/60'
                    }`}>
                      <div className="flex items-center gap-1.5">
                        {bracket.final.winnerId === bracket.final.p2.id && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                        <span className="truncate max-w-[120px]">{bracket.final.p2.name}</span>
                      </div>
                      <span>{bracket.final.p2.score?.toLocaleString()}</span>
                    </div>

                    <button
                      onClick={() => handleWatchReplay(bracket.final.matchId)}
                      className="w-full py-2 rounded-xl bg-gradient-to-r from-amber-400 to-[#ff4e2d] text-[#0b0b10] font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-amber-400/20 hover:brightness-110"
                    >
                      <Play className="w-4 h-4 fill-current" /> Tonton Grand Final!
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ─── 4. RIWAYAT JUARA & HADIAH ─── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Riwayat Juara Bergilir */}
          <div className="bg-[#14141d] border border-white/10 rounded-2xl p-5 space-y-4">
            <h4 className="text-white font-black text-sm uppercase font-mono-ui flex items-center gap-2">
              <History className="w-4 h-4 text-[#d4a73c]" /> Hall of Champions (Riwayat Juara)
            </h4>
            {championHistory.length === 0 ? (
              <p className="text-white/30 text-xs">Belum ada turnamen musim sebelumnya.</p>
            ) : (
              <div className="space-y-2">
                {championHistory.map((h, i) => (
                  <div key={i} className="p-3 bg-black/40 border border-white/5 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-white/40 font-mono-ui block">Musim {h.seasonWeek}</span>
                      <strong className="text-white font-bold">{h.championName}</strong>
                    </div>
                    <span className="text-[#d4a73c] font-black font-mono-ui flex items-center gap-1">
                      <Trophy className="w-3.5 h-3.5" /> Juara 1
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Rincian Hadiah Turnamen */}
          <div className="bg-[#14141d] border border-white/10 rounded-2xl p-5 space-y-3">
            <h4 className="text-white font-black text-sm uppercase font-mono-ui flex items-center gap-2">
              <Gift className="w-4 h-4 text-emerald-400" /> Hadiah Turnamen Mingguan
            </h4>
            <div className="space-y-2 text-xs">
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex justify-between items-center">
                <span>🥇 <strong>Juara 1 (Grand Champion):</strong></span>
                <span className="text-[#d4a73c] font-black font-mono-ui">+10,000 Koin + 10x Tiket + Bingkai Emas</span>
              </div>
              <div className="p-3 bg-white/5 border border-white/10 rounded-xl flex justify-between items-center">
                <span>🥈 <strong>Juara 2 (Runner-Up):</strong></span>
                <span className="text-white/70 font-bold font-mono-ui">+5,000 Koin + 5x Tiket</span>
              </div>
              <div className="p-3 bg-white/5 border border-white/10 rounded-xl flex justify-between items-center">
                <span>🥉 <strong>Semifinalis:</strong></span>
                <span className="text-white/50 font-bold font-mono-ui">+2,500 Koin + 2x Tiket</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ─── MODAL TAYANGAN ULANG (MATCH REPLAY VIEWER) ─── */}
      {activeReplay && (
        <div className="fixed inset-0 z-[250] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-[#181824] border-2 border-[#d4a73c] rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative text-center">
            <button
              onClick={() => setActiveReplay(null)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-white"
            >
              ✕
            </button>

            <div>
              <span className="text-xs font-mono-ui font-black uppercase text-[#d4a73c] tracking-wider block">
                REKAMAN PERTANDINGAN • {activeReplay.roundLabel}
              </span>
              <h3 className="text-white font-black text-xl uppercase font-mono-ui mt-0.5">
                {activeReplay.p1.name} VS {activeReplay.p2.name}
              </h3>
            </div>

            {/* Combat Rounds Replay Breakdown */}
            <div className="space-y-2.5 max-h-60 overflow-y-auto p-1 scrollbar-none">
              {(activeReplay.combatRounds || []).map((r, i) => (
                <div key={i} className="p-3 bg-black/50 border border-white/5 rounded-2xl space-y-1.5 text-xs font-mono-ui">
                  <div className="flex justify-between text-[10px] text-white/40 uppercase">
                    <span>Ronde {r.round}</span>
                    <span>Adu Serangan Kartu</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-left">
                      <strong className="text-white block">{activeReplay.p1.name}</strong>
                      <span className="text-[#d4a73c] font-black text-sm">+{r.p1Damage?.toLocaleString()} DMG</span>
                      {r.p1Crit && <span className="text-red-400 text-[9px] block">CRIT!</span>}
                    </div>

                    <span className="text-white/20 font-black text-xs">VS</span>

                    <div className="text-right">
                      <strong className="text-white block">{activeReplay.p2.name}</strong>
                      <span className="text-sky-400 font-black text-sm">+{r.p2Damage?.toLocaleString()} DMG</span>
                      {r.p2Crit && <span className="text-red-400 text-[9px] block">CRIT!</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Winner Announcement */}
            <div className="p-4 bg-black/60 border border-[#d4a73c]/40 rounded-2xl text-center space-y-1">
              <span className="text-[10px] text-white/40 uppercase font-bold block">Pemenang Pertandingan:</span>
              <h4 className="text-[#d4a73c] font-black text-lg uppercase font-mono-ui flex items-center justify-center gap-1.5">
                <Crown className="w-5 h-5" />
                {activeReplay.winnerName}
              </h4>
            </div>

            <button
              onClick={() => setActiveReplay(null)}
              className="w-full py-3 rounded-2xl bg-[#d4a73c] text-[#0b0b10] font-black text-xs uppercase tracking-wider hover:brightness-110 shadow-lg shadow-[#d4a73c]/30"
            >
              Tutup Tayangan Ulang
            </button>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default TournamentColosseum;
