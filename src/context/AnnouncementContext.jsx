import { createContext, useContext } from 'react';

// Dipakai supaya Navbar (yang di-render terpisah di tiap halaman) tahu
// tinggi AnnouncementBar yang lagi tampil (di-set dari SiteGate), jadi
// Navbar bisa geser ke bawah biar gak numpuk/nutupin pengumumannya.
export const AnnouncementContext = createContext({ height: 0 });

export const useAnnouncementHeight = () => useContext(AnnouncementContext).height;
