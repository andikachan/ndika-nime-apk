import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AudioProvider } from './components/Audio';
import { AuthProvider } from './context/AuthContext';
import SiteGate from './components/SiteGate';
import PresenceHeartbeat from './components/PresenceHeartbeat';
const Welcome = lazy(() => import('./pages/Welcome'));
const Home = lazy(() => import('./pages/Home'));
const Komik = lazy(() => import('./pages/Komik'));
const Explore = lazy(() => import('./pages/Explore'));
const Ongoing = lazy(() => import('./pages/Ongoing'));
const Schedule = lazy(() => import('./pages/Schedule'));
const Watch = lazy(() => import('./pages/Watch'));
const KomikPopuler = lazy(() => import('./pages/KomikPopuler'));
const KomikLatest = lazy(() => import('./pages/KomikLatest'));
const MangaDetail = lazy(() => import('./pages/MangaDetail'));
const ReaderPage = lazy(() => import('./pages/ReaderPage'));
const KomikAll = lazy(() => import('./pages/KomikAll'));
const History = lazy(() => import('./pages/History'));
const Chat = lazy(() => import('./pages/Chat'));
const Profile = lazy(() => import('./pages/Profile'));
const Messages = lazy(() => import('./pages/Messages'));
const DirectMessage = lazy(() => import('./pages/DirectMessage'));
const New = lazy(() => import('./pages/New'));
const Admin = lazy(() => import('./pages/Admin'));
const Clan = lazy(() => import('./pages/Clan'));
const Gacha = lazy(() => import('./pages/Gacha'));
const Watch2gether = lazy(() => import('./pages/Watch2gether'));
const W2GRoom = lazy(() => import('./pages/W2GRoom'));
const MoodPicker = lazy(() => import('./pages/MoodPicker'));
const Arena = lazy(() => import('./pages/Arena'));
const Marketplace = lazy(() => import('./pages/Marketplace'));
const WorldBossRaid = lazy(() => import('./pages/WorldBossRaid'));
const IsekaiMap = lazy(() => import('./pages/IsekaiMap'));
const TournamentColosseum = lazy(() => import('./pages/TournamentColosseum'));

import UserProfile from './pages/user/[id]';

// Pencarian komik & user sekarang jadi satu dengan pencarian anime di /explore
// (lihat tab Anime/Komik/User di halaman itu). Komponen ini cuma menjaga
// link/bookmark lama ke /search dan /search/users supaya tetap jalan.
const RedirectToExplore = ({ type }) => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  params.set('type', type);
  return <Navigate to={`/explore?${params.toString()}`} replace />;
};

function App() {
  return (
    <AudioProvider>
      <AuthProvider>
        <Router>
          <SiteGate>
          <PresenceHeartbeat />
          <Suspense fallback={<div className="min-h-screen bg-[#0b0b10]"></div>}>
            <Routes>
              <Route path="/" element={<Welcome />} />
              <Route path="/home" element={<Home />} />
              <Route path="/komik" element={<Komik />} />
              <Route path="/explore" element={<Explore />} />
              <Route path="/history" element={<History />} />
              <Route path="/komik/populer" element={<KomikPopuler />} />
              <Route path="/komik/latest" element={<KomikLatest />} />
              <Route path="/komik/all" element={<KomikAll />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/ongoing" element={<Ongoing />} />
              <Route path="/schedule" element={<Schedule />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/clan" element={<Clan />} />
              <Route path="/gacha" element={<Gacha />} />
              <Route path="/cards" element={<Gacha />} />
              <Route path="/watch2gether" element={<Watch2gether />} />
              <Route path="/w2g" element={<Watch2gether />} />
              <Route path="/w2g/:roomId" element={<W2GRoom />} />
              <Route path="/watch2gether/:roomId" element={<W2GRoom />} />
              <Route path="/mood" element={<MoodPicker />} />
              <Route path="/roulette" element={<MoodPicker />} />
              <Route path="/mood-picker" element={<MoodPicker />} />
              <Route path="/arena" element={<Arena />} />
              <Route path="/battle-arena" element={<Arena />} />
              <Route path="/gacha/arena" element={<Arena />} />
              <Route path="/market" element={<Marketplace />} />
              <Route path="/marketplace" element={<Marketplace />} />
              <Route path="/raid" element={<WorldBossRaid />} />
              <Route path="/world-boss" element={<WorldBossRaid />} />
              <Route path="/isekai" element={<IsekaiMap />} />
              <Route path="/world-map" element={<IsekaiMap />} />
              <Route path="/tournament" element={<TournamentColosseum />} />
              <Route path="/colosseum" element={<TournamentColosseum />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/messages/:userId" element={<DirectMessage />} />
              <Route path="/new" element={<New />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/search/users" element={<RedirectToExplore type="user" />} />
              <Route path="/user/:id" element={<UserProfile />} />
              <Route path="/anime/:slug/:episode?" element={<Watch />} />
              <Route path="/komik/:slug" element={<MangaDetail />} />
              <Route path="/baca/:chapterSlug" element={<ReaderPage />} />
              <Route path="/search" element={<RedirectToExplore type="komik" />} />
              <Route path="*" element={<Navigate to="/home" replace />} />
            </Routes>
          </Suspense>
          </SiteGate>
        </Router>
      </AuthProvider>
    </AudioProvider>
  );
}

export default App;