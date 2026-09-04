import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);

  // In-flight refresh promise to prevent duplicate simultaneous calls
  const pendingRefreshPromise = useRef(null);

  const refreshUser = useCallback(async () => {
    if (pendingRefreshPromise.current) {
      return pendingRefreshPromise.current;
    }

    pendingRefreshPromise.current = (async () => {
      try {
        const res = await fetch('/api/v1/auth/me', {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.user) {
            setUser(data.user);
            return data.user;
          }
        }
        setUser(null);
        return null;
      } catch (err) {
        console.error('[AuthContext] refreshUser error:', err);
        setUser(null);
        return null;
      } finally {
        setLoading(false);
        pendingRefreshPromise.current = null;
      }
    })();

    return pendingRefreshPromise.current;
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (email, password) => {
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Login gagal');
    }

    await refreshUser();
    setShowLoginModal(false);
    return data.user;
  }, [refreshUser]);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (err) {
      console.error('[AuthContext] logout error:', err);
    }
    setUser(null);
  }, []);

  const updateUser = useCallback((partial) => {
    setUser((prev) => (prev ? { ...prev, ...partial } : null));
  }, []);

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    isAdmin: !!(user && (user.isAdmin || user.role === 'admin')),
    userLevel: user?.level || 0,
    userTitle: user?.title || 'Anime Newbie',
    userWatchTime: user?.watchTime || 0,
    userCoins: user?.coins || 0,
    showLoginModal,
    setShowLoginModal,
    showRegisterModal,
    setShowRegisterModal,
    showForgotModal,
    setShowForgotModal,
    refreshUser,
    login,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
