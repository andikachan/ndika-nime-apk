import React, { useEffect, useState } from 'react';
import { HelpCircle, Check, X, Loader2, Trophy, Sparkles } from 'lucide-react';

// Mini-game trivia harian: 5 soal, sekali main per hari, poin masuk ke leaderboard
// lewat bonus XP (watchTime) yang sudah ada — dipasang sistemnya di backend.
const TriviaGame = ({ onScored }) => {
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(true);
  const [questions, setQuestions] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [totalCorrect, setTotalCorrect] = useState(0);

  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState({}); // { [questionId]: choiceIndex }
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadToday = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/trivia/today', { credentials: 'include' });
      const data = await res.json();
      if (res.ok && data.success) {
        setLoggedIn(data.loggedIn);
        setTotalCorrect(data.totalCorrect || 0);
        if (data.alreadyAnswered) {
          setSubmission(data.submission);
          setQuestions(null);
        } else {
          setQuestions(data.questions || []);
          setSubmission(null);
        }
      }
    } catch (e) {
      console.error('Load trivia error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadToday();
  }, []);

  const handleLoginClick = () => {
    window.dispatchEvent(new CustomEvent('ndichan:open-login'));
  };

  const selectAnswer = (questionId, choiceIndex) => {
    setPicked((prev) => ({ ...prev, [questionId]: choiceIndex }));
  };

  const isLastStep = questions && step === questions.length - 1;
  const currentQuestion = questions ? questions[step] : null;
  const currentPicked = currentQuestion ? picked[currentQuestion.id] : undefined;

  const goNext = () => {
    if (currentPicked === undefined) return;
    if (isLastStep) {
      submitAnswers();
    } else {
      setStep((s) => s + 1);
    }
  };

  const submitAnswers = async () => {
    setSubmitting(true);
    setError('');
    try {
      const answers = questions.map((q) => ({ id: q.id, choiceIndex: picked[q.id] ?? -1 }));
      const res = await fetch('/api/v1/trivia/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ answers }),
      });
      const data = await res.json();

      if (res.status === 401) {
        handleLoginClick();
        return;
      }

      if (res.ok && data.success) {
        setSubmission(data.submission);
        setTotalCorrect(data.totalCorrect || 0);
        setQuestions(null);
        onScored?.(data.submission);
      } else if (res.status === 409 && data.submission) {
        setSubmission(data.submission);
        setQuestions(null);
      } else {
        setError(data.error || 'Gagal mengirim jawaban');
      }
    } catch (e) {
      console.error('Submit trivia error:', e);
      setError('Gagal mengirim jawaban, coba lagi');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-[#181820] border border-white/5 rounded-xl p-6 flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-white/30 animate-spin" />
      </div>
    );
  }

  // ===== Belum login =====
  if (!loggedIn) {
    return (
      <div className="bg-[#181820] border border-white/5 rounded-xl p-5 flex items-center gap-4">
        <div className="w-11 h-11 rounded-xl bg-[#d4a73c]/10 border border-[#d4a73c]/20 flex items-center justify-center shrink-0">
          <HelpCircle className="w-5 h-5 text-[#d4a73c]" strokeWidth={2.5} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm">Trivia Anime Harian</p>
          <p className="text-white/30 text-xs mt-0.5">Login dulu buat main & kumpulin poin XP</p>
        </div>
        <button onClick={handleLoginClick} className="px-3.5 py-2 bg-[#d4a73c] text-[#0b0b10] rounded-lg text-xs font-bold shrink-0">
          Login
        </button>
      </div>
    );
  }

  // ===== Sudah main hari ini -> tampilkan review hasil =====
  if (submission) {
    const percent = Math.round((submission.score / submission.total) * 100);
    return (
      <div className="bg-[#181820] border border-white/5 rounded-xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-[#d4a73c]/10 border border-[#d4a73c]/20 flex items-center justify-center shrink-0">
            <Trophy className="w-5 h-5 text-[#d4a73c]" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <p className="text-white font-bold text-sm">Trivia hari ini sudah selesai</p>
            <p className="text-white/30 text-xs mt-0.5">
              Skor <b className="text-[#d4a73c] tabular-nums">{submission.score}/{submission.total}</b> ({percent}%) · Total benar sepanjang waktu: {totalCorrect}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {submission.answers.map((a, i) => (
            <div key={a.id} className={`p-3 rounded-lg border ${a.correct ? 'bg-green-500/5 border-green-500/15' : 'bg-red-500/5 border-red-500/15'}`}>
              <div className="flex items-start gap-2">
                {a.correct ? (
                  <Check className="w-3.5 h-3.5 text-green-400 mt-0.5 shrink-0" strokeWidth={3} />
                ) : (
                  <X className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" strokeWidth={3} />
                )}
                <div className="min-w-0">
                  <p className="text-white/70 text-xs font-medium">{i + 1}. {a.q}</p>
                  {!a.correct && (
                    <p className="text-white/30 text-[11px] mt-1">
                      Jawaban benar: <span className="text-green-400 font-bold">{a.choices[a.correctIndex]}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="text-white/20 text-[11px] font-medium mt-4 text-center">Balik lagi besok buat 5 soal baru 🎮</p>
      </div>
    );
  }

  // ===== Belum ada soal (jaga-jaga) =====
  if (!questions || questions.length === 0) {
    return (
      <div className="bg-[#181820] border border-white/5 rounded-xl p-6 text-center">
        <p className="text-white/30 text-sm font-medium">Soal trivia belum tersedia, coba lagi nanti.</p>
      </div>
    );
  }

  // ===== Lagi main =====
  return (
    <div className="bg-[#181820] border border-white/5 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#d4a73c]" strokeWidth={2.5} />
          <p className="text-white font-bold text-sm">Trivia Anime Harian</p>
        </div>
        <span className="text-white/30 text-xs font-bold tabular-nums">{step + 1} / {questions.length}</span>
      </div>

      <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden mb-5">
        <div
          className="bg-gradient-to-r from-[#d4a73c] to-[#ff4e2d] h-full rounded-full transition-all duration-300"
          style={{ width: `${((step + 1) / questions.length) * 100}%` }}
        />
      </div>

      <p className="text-white font-bold text-[15px] leading-snug mb-4">{currentQuestion.q}</p>

      <div className="space-y-2 mb-5">
        {currentQuestion.choices.map((choice, idx) => {
          const isSelected = currentPicked === idx;
          return (
            <button
              key={idx}
              onClick={() => selectAnswer(currentQuestion.id, idx)}
              className={`w-full text-left px-4 py-3 rounded-lg text-sm font-semibold border transition-all ${
                isSelected
                  ? 'bg-[#d4a73c]/15 border-[#d4a73c]/50 text-[#d4a73c]'
                  : 'bg-white/[0.03] border-white/10 text-white/70 hover:bg-white/[0.06] hover:border-white/20'
              }`}
            >
              {choice}
            </button>
          );
        })}
      </div>

      {error && <p className="text-red-400 text-xs font-medium mb-3">{error}</p>}

      <button
        onClick={goNext}
        disabled={currentPicked === undefined || submitting}
        className="w-full py-2.5 rounded-lg font-bold text-sm bg-[#d4a73c] text-[#0b0b10] hover:bg-[#ff4e2d] active:scale-[0.98] transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {submitting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isLastStep ? (
          'Selesai & Kirim Jawaban'
        ) : (
          'Berikutnya'
        )}
      </button>
    </div>
  );
};

export default TriviaGame;
