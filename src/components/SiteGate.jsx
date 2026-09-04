import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import AnnouncementBar from './AnnouncementBar';
import MaintenancePage from './MaintenancePage';
import { AnnouncementContext } from '../context/AnnouncementContext';
import { useAuth } from '../context/AuthContext';

// Membungkus seluruh routing: baca /api/v1/user/site-config sekali (publik, tanpa
// auth) untuk tahu status maintenance mode & pengumuman. Kalau maintenance
// aktif, cek status admin lewat AuthContext supaya admin tetap bisa
// masuk situs & buka /admin buat matikan maintenance-nya lagi.
const SiteGate = ({ children }) => {
  const location = useLocation();
  const { isAdmin, loading: authLoading } = useAuth();
  const [config, setConfig] = useState(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [announcementHeight, setAnnouncementHeight] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/v1/user/site-config');
        const data = await res.json();
        if (mounted && res.ok) setConfig(data.config);
      } catch (error) {
        console.error('Site config error:', error);
      } finally {
        if (mounted) setConfigLoaded(true);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Terapkan warna tema dari pengaturan admin ke CSS variable global
  // (--gold/--ink/--panel/--ink-2/--ember di style.css). Aturan override
  // di style.css memetakan semua class Tailwind arbitrary-color yang
  // dipakai di komponen ke variabel ini, jadi cukup set di sini saja.
  useEffect(() => {
    const theme = config?.theme;
    if (!theme) return;
    const root = document.documentElement.style;
    const MAP = {
      accentColor: '--gold',
      backgroundColor: '--ink',
      panelColor: '--panel',
      panelColor2: '--ink-2',
      highlightColor: '--ember'
    };
    Object.entries(MAP).forEach(([key, cssVar]) => {
      if (theme[key]) root.setProperty(cssVar, theme[key]);
    });
    if (theme.backgroundColor) {
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', theme.backgroundColor);
    }
  }, [config?.theme]);

  // Belum tahu status maintenance sama sekali -> render kosong sebentar,
  // daripada flash konten normal lalu ganti ke maintenance page.
  if (!configLoaded) {
    return <div className="min-h-screen bg-[#0b0b10]"></div>;
  }

  const isAdminRoute = location.pathname === '/admin';
  const maintenanceActive = !!config?.maintenanceMode && !isAdminRoute;

  if (maintenanceActive) {
    // Masih ngecek apakah user ini admin (biar admin bisa bypass) -> tunggu dulu.
    if (authLoading) {
      return <div className="min-h-screen bg-[#0b0b10]"></div>;
    }
    if (!isAdmin) {
      return <MaintenancePage message={config.maintenanceMessage} />;
    }
  }

  const showAnnouncement = !!(config?.announcement?.enabled && config.announcement.message);

  return (
    <AnnouncementContext.Provider value={{ height: showAnnouncement ? announcementHeight : 0 }}>
      {showAnnouncement && (
        <AnnouncementBar
          message={config.announcement.message}
          type={config.announcement.type}
          onHeightChange={setAnnouncementHeight}
        />
      )}
      {/* Spacer biar konten halaman (yang paddingnya dihitung buat Navbar
          saja) ikut turun sebesar tinggi banner, gak ketiban Navbar+banner
          yang sama-sama fixed di atas. */}
      {showAnnouncement && announcementHeight > 0 && (
        <div style={{ height: announcementHeight }} aria-hidden="true" />
      )}
      {children}
    </AnnouncementContext.Provider>
  );
};

export default SiteGate;
