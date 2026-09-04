import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const LevelMark = () => (
  <svg className="w-3.5 h-3.5 text-[#d4a73c]" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

const AuthModals = () => {
  const navigate = useNavigate();
  const {
    user,
    userLevel,
    userTitle,
    showLoginModal,
    setShowLoginModal,
    showRegisterModal,
    setShowRegisterModal,
    showForgotModal,
    setShowForgotModal,
    login,
    logout,
    refreshUser
  } = useAuth();

  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    verificationCode: ''
  });
  const [resetForm, setResetForm] = useState({ email: '', newPassword: '', confirmPassword: '' });
  const [verificationCode, setVerificationCode] = useState('');
  const [resetStep, setResetStep] = useState('request'); // 'request' | 'verify' | 'reset'
  const [verificationSent, setVerificationSent] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const handleGoogleLogin = () => {
    window.location.href = '/api/v1/auth/google';
  };

  const requestVerificationCode = async (email, type = 'register') => {
    if (!email) {
      setAuthError('Email harus diisi!');
      return;
    }
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await fetch('/api/v1/auth/request-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, type })
      });
      const data = await res.json();
      if (res.ok) {
        setVerificationSent(true);
        setAuthError('');
        if (type === 'reset') setResetStep('verify');
      } else {
        setAuthError(data.error || 'Gagal mengirim kode verifikasi');
      }
    } catch {
      setAuthError('Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      await login(loginForm.email, loginForm.password);
      setLoginForm({ email: '', password: '' });
    } catch (err) {
      setAuthError(err.message || 'Login gagal. Periksa email dan password.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    if (registerForm.password !== registerForm.confirmPassword) {
      setAuthError('Password tidak cocok!');
      setAuthLoading(false);
      return;
    }
    if (registerForm.password.length < 6) {
      setAuthError('Password minimal 6 karakter!');
      setAuthLoading(false);
      return;
    }
    if (!registerForm.verificationCode) {
      setAuthError('Masukkan kode verifikasi!');
      setAuthLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: registerForm.name,
          email: registerForm.email,
          password: registerForm.password,
          verificationCode: registerForm.verificationCode
        })
      });

      const data = await res.json();
      if (res.ok) {
        setShowRegisterModal(false);
        setRegisterForm({ name: '', email: '', password: '', confirmPassword: '', verificationCode: '' });
        setVerificationSent(false);
        await refreshUser();
      } else {
        setAuthError(data.error || 'Registrasi gagal');
      }
    } catch {
      setAuthError('Terjadi kesalahan jaringan.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    await requestVerificationCode(resetForm.email, 'reset');
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const res = await fetch('/api/v1/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetForm.email, code: verificationCode })
      });
      const data = await res.json();
      if (res.ok) {
        setResetStep('reset');
      } else {
        setAuthError(data.error || 'Kode verifikasi salah');
      }
    } catch {
      setAuthError('Gagal memverifikasi kode.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (resetForm.newPassword !== resetForm.confirmPassword) {
      setAuthError('Password baru tidak cocok!');
      return;
    }
    setAuthError('');
    setAuthLoading(true);
    try {
      const res = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: resetForm.email,
          code: verificationCode,
          newPassword: resetForm.newPassword
        })
      });
      const data = await res.json();
      if (res.ok) {
        setShowForgotModal(false);
        setShowLoginModal(true);
        setResetForm({ email: '', newPassword: '', confirmPassword: '' });
        setVerificationCode('');
        setResetStep('request');
      } else {
        setAuthError(data.error || 'Gagal mereset password');
      }
    } catch {
      setAuthError('Terjadi kesalahan jaringan.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setShowLoginModal(false);
  };

  return (
    <>
      {/* Login Popup */}
      {showLoginModal && !showRegisterModal && (
        <div className="fixed inset-0 z-[999] bg-[#0b0b10]/90 flex items-center justify-center p-4" style={{ animation: 'fadeIn 0.15s ease-out' }}>
          <div className="bg-[#181820] border border-white/10 rounded-2xl p-8 max-w-sm w-full flex flex-col items-center relative shadow-2xl max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowLoginModal(false)} className="absolute top-5 right-5 text-white/30 hover:text-[#d4a73c] transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            {user ? (
              <>
                <img src={user.picture} alt={user.name} className="w-28 h-28 object-cover rounded-full mb-5 border-2 border-[#d4a73c]/30" />
                <h3 className="text-white font-bold text-xl mb-1 text-center">Halo, {user.name}</h3>
                <p className="text-white/40 text-sm text-center mb-5">{user.email}</p>
                <div className="flex items-center gap-2 px-4 py-2 bg-white/[0.03] border border-white/10 rounded-lg mb-6 w-full justify-center">
                  <LevelMark />
                  <span className="text-[#d4a73c] font-bold text-sm">Level {userLevel}</span>
                  <span className="text-white/20 text-xs">&middot;</span>
                  <span className="text-white/60 text-xs truncate max-w-[140px]">{userTitle}</span>
                </div>

                <button
                  onClick={() => {
                    navigate('/profile');
                    setShowLoginModal(false);
                  }}
                  className="w-full bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 text-white font-semibold py-3 rounded-xl transition-colors mb-2.5 flex items-center justify-center gap-2 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Profil Saya
                </button>

                <button
                  onClick={() => {
                    navigate('/clan');
                    setShowLoginModal(false);
                  }}
                  className="w-full bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 text-white font-semibold py-3 rounded-xl transition-colors mb-2.5 flex items-center justify-center gap-2 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" />
                  </svg>
                  Clan
                </button>

                {user.isAdmin && (
                  <button
                    onClick={() => {
                      navigate('/admin');
                      setShowLoginModal(false);
                    }}
                    className="w-full bg-[#d4a73c]/10 hover:bg-[#d4a73c]/15 border border-[#d4a73c]/20 text-[#d4a73c] font-semibold py-3 rounded-xl transition-colors mb-2.5 flex items-center justify-center gap-2 text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Admin Panel
                  </button>
                )}

                <button
                  onClick={handleLogout}
                  className="w-full bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 text-red-400 font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Logout
                </button>
              </>
            ) : (
              <>
                <h3 className="text-white font-bold text-xl mb-1 text-center">Masuk ke akun Anda</h3>
                <p className="text-white/40 text-sm text-center mb-6">Login untuk melanjutkan</p>

                <form onSubmit={handleEmailLogin} className="w-full">
                  <div className="space-y-3">
                    <input
                      type="email"
                      placeholder="Email"
                      className="auth-input"
                      value={loginForm.email}
                      onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                      required
                    />
                    <input
                      type="password"
                      placeholder="Password"
                      className="auth-input"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      required
                    />
                    {authError && <p className="auth-error">{authError}</p>}
                    <button type="submit" className="auth-btn" disabled={authLoading}>
                      {authLoading ? 'Memproses...' : 'Login'}
                    </button>
                  </div>
                </form>

                <p className="text-white/40 text-sm mt-4 text-center">
                  <span
                    className="switch-auth"
                    onClick={() => {
                      setShowLoginModal(false);
                      setShowForgotModal(true);
                      setAuthError('');
                      setResetStep('request');
                      setVerificationSent(false);
                      setResetForm({ email: '', newPassword: '', confirmPassword: '' });
                      setVerificationCode('');
                    }}
                  >
                    Lupa password?
                  </span>
                </p>

                <div className="divider">
                  <span>ATAU</span>
                </div>

                <button onClick={handleGoogleLogin} className="google-btn">
                  <svg width="18" height="18" viewBox="0 0 48 48">
                    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
                    <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
                    <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
                    <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
                  </svg>
                  Login dengan Google
                </button>

                <p className="text-white/40 text-sm mt-6">
                  Belum punya akun?{' '}
                  <span
                    className="switch-auth"
                    onClick={() => {
                      setShowRegisterModal(true);
                      setAuthError('');
                      setVerificationSent(false);
                      setRegisterForm({ ...registerForm, verificationCode: '' });
                    }}
                  >
                    Daftar
                  </span>
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Register Popup */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-[999] bg-[#0b0b10]/90 flex items-center justify-center p-4" style={{ animation: 'fadeIn 0.15s ease-out' }}>
          <div className="bg-[#181820] border border-white/10 rounded-2xl p-8 max-w-sm w-full flex flex-col items-center relative shadow-2xl max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => {
                setShowRegisterModal(false);
                setVerificationSent(false);
                setRegisterForm({ ...registerForm, verificationCode: '' });
                setAuthError('');
              }}
              className="absolute top-5 right-5 text-white/30 hover:text-[#d4a73c] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            <h3 className="text-white font-bold text-xl mb-1 text-center">Buat akun baru</h3>
            <p className="text-white/40 text-sm text-center mb-6">Daftar untuk menikmati fitur lengkap</p>

            <form onSubmit={handleRegister} className="w-full">
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Nama lengkap"
                  className="auth-input"
                  value={registerForm.name}
                  onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                  required
                  minLength={2}
                />
                <input
                  type="email"
                  placeholder="Email"
                  className="auth-input"
                  value={registerForm.email}
                  onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                  required
                />
                <input
                  type="password"
                  placeholder="Password (min. 6 karakter)"
                  className="auth-input"
                  value={registerForm.password}
                  onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                  required
                  minLength={6}
                />
                <input
                  type="password"
                  placeholder="Konfirmasi password"
                  className="auth-input"
                  value={registerForm.confirmPassword}
                  onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                  required
                  minLength={6}
                />

                {!verificationSent ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (!registerForm.email) {
                        setAuthError('Masukkan email terlebih dahulu!');
                        return;
                      }
                      requestVerificationCode(registerForm.email, 'register');
                    }}
                    className="auth-btn bg-transparent border border-[#d4a73c]/40 text-[#d4a73c] hover:bg-[#d4a73c]/10"
                    disabled={authLoading || !registerForm.email}
                  >
                    {authLoading ? 'Mengirim...' : 'Kirim kode verifikasi'}
                  </button>
                ) : (
                  <div>
                    <input
                      type="text"
                      placeholder="Kode verifikasi (6 digit)"
                      className="auth-input"
                      value={registerForm.verificationCode}
                      onChange={(e) => setRegisterForm({ ...registerForm, verificationCode: e.target.value })}
                      maxLength={6}
                      required
                    />
                    <p className="text-white/40 text-xs mt-2">
                      Kode verifikasi telah dikirim ke email Anda. Cek folder spam jika tidak muncul.
                    </p>
                  </div>
                )}

                {authError && <p className="auth-error">{authError}</p>}

                <button type="submit" className="auth-btn" disabled={authLoading || !verificationSent}>
                  {authLoading ? 'Memproses...' : 'Daftar'}
                </button>
              </div>
            </form>

            <div className="divider">
              <span>ATAU</span>
            </div>

            <button onClick={handleGoogleLogin} className="google-btn">
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
                <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
                <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
                <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
              </svg>
              Daftar dengan Google
            </button>

            <p className="text-white/40 text-sm mt-6">
              Sudah punya akun?{' '}
              <span
                className="switch-auth"
                onClick={() => {
                  setShowRegisterModal(false);
                  setShowLoginModal(true);
                  setAuthError('');
                  setVerificationSent(false);
                  setRegisterForm({ ...registerForm, verificationCode: '' });
                }}
              >
                Login
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Forgot Password Popup */}
      {showForgotModal && (
        <div className="fixed inset-0 z-[999] bg-[#0b0b10]/90 flex items-center justify-center p-4" style={{ animation: 'fadeIn 0.15s ease-out' }}>
          <div className="bg-[#181820] border border-white/10 rounded-2xl p-8 max-w-sm w-full flex flex-col items-center relative shadow-2xl max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => {
                setShowForgotModal(false);
                setResetStep('request');
                setVerificationSent(false);
                setAuthError('');
                setResetForm({ email: '', newPassword: '', confirmPassword: '' });
                setVerificationCode('');
              }}
              className="absolute top-5 right-5 text-white/30 hover:text-[#d4a73c] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {resetStep === 'request' && (
              <>
                <h3 className="text-white font-bold text-xl mb-1 text-center">Reset password</h3>
                <p className="text-white/40 text-sm text-center mb-6">
                  Masukkan email untuk menerima kode verifikasi
                </p>

                <form onSubmit={handleForgotPassword} className="w-full">
                  <div className="space-y-3">
                    <input
                      type="email"
                      placeholder="Email"
                      className="auth-input"
                      value={resetForm.email}
                      onChange={(e) => setResetForm({ ...resetForm, email: e.target.value })}
                      required
                    />
                    {authError && <p className="auth-error">{authError}</p>}
                    <button type="submit" className="auth-btn" disabled={authLoading}>
                      {authLoading ? 'Mengirim...' : 'Kirim kode verifikasi'}
                    </button>
                  </div>
                </form>

                <p className="text-white/40 text-sm mt-6">
                  Ingat password?{' '}
                  <span
                    className="switch-auth"
                    onClick={() => {
                      setShowForgotModal(false);
                      setShowLoginModal(true);
                      setAuthError('');
                      setResetForm({ email: '', newPassword: '', confirmPassword: '' });
                      setVerificationCode('');
                    }}
                  >
                    Login
                  </span>
                </p>
              </>
            )}

            {resetStep === 'verify' && (
              <>
                <h3 className="text-white font-bold text-xl mb-1 text-center">Verifikasi</h3>
                <p className="text-white/40 text-sm text-center mb-6">
                  Masukkan kode yang dikirim ke {resetForm.email}
                </p>

                <form onSubmit={handleVerifyCode} className="w-full">
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Kode verifikasi (6 digit)"
                      className="auth-input"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      maxLength={6}
                      required
                    />
                    {authError && <p className="auth-error">{authError}</p>}
                    <button type="submit" className="auth-btn" disabled={authLoading}>
                      {authLoading ? 'Memverifikasi...' : 'Verifikasi'}
                    </button>
                  </div>
                </form>

                <p className="text-white/40 text-sm mt-6">
                  Tidak menerima kode?{' '}
                  <span className="switch-auth" onClick={() => requestVerificationCode(resetForm.email, 'reset')}>
                    Kirim ulang
                  </span>
                </p>

                <p className="text-white/40 text-sm mt-3">
                  Kembali ke{' '}
                  <span
                    className="switch-auth"
                    onClick={() => {
                      setResetStep('request');
                      setAuthError('');
                    }}
                  >
                    reset password
                  </span>
                </p>
              </>
            )}

            {resetStep === 'reset' && (
              <>
                <h3 className="text-white font-bold text-xl mb-1 text-center">Password baru</h3>
                <p className="text-white/40 text-sm text-center mb-6">
                  Buat password baru untuk akun Anda
                </p>

                <form onSubmit={handleResetPassword} className="w-full">
                  <div className="space-y-3">
                    <input
                      type="password"
                      placeholder="Password baru (min. 6 karakter)"
                      className="auth-input"
                      value={resetForm.newPassword}
                      onChange={(e) => setResetForm({ ...resetForm, newPassword: e.target.value })}
                      minLength={6}
                      required
                    />
                    <input
                      type="password"
                      placeholder="Konfirmasi password baru"
                      className="auth-input"
                      value={resetForm.confirmPassword}
                      onChange={(e) => setResetForm({ ...resetForm, confirmPassword: e.target.value })}
                      minLength={6}
                      required
                    />
                    {authError && <p className="auth-error">{authError}</p>}
                    <button type="submit" className="auth-btn" disabled={authLoading}>
                      {authLoading ? 'Menyimpan...' : 'Reset password'}
                    </button>
                  </div>
                </form>

                <p className="text-white/40 text-sm mt-6">
                  Kembali ke{' '}
                  <span
                    className="switch-auth"
                    onClick={() => {
                      setResetStep('verify');
                      setAuthError('');
                    }}
                  >
                    verifikasi
                  </span>
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default AuthModals;
