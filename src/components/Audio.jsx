// components/Audio.js
import React, { createContext, useContext, useRef, useState, useEffect } from 'react';

const AudioContext = createContext();

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within AudioProvider');
  }
  return context;
};

export const AudioProvider = ({ children }) => {
  const [currentAudio, setCurrentAudio] = useState(null);
  const [audioPlayer, setAudioPlayer] = useState({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    progress: 0,
    volume: 1,
    currentTrack: null
  });
  const audioRef = useRef(null);
  const isMounted = useRef(true);

  // Play audio function
  const playAudio = (audioUrl, messageId) => {
    // Jika audio yang sama sedang diputar, pause/toggle
    if (currentAudio === messageId && audioRef.current) {
      if (audioPlayer.isPlaying) {
        audioRef.current.pause();
        setAudioPlayer(prev => ({ ...prev, isPlaying: false }));
      } else {
        audioRef.current.play();
        setAudioPlayer(prev => ({ ...prev, isPlaying: true }));
      }
      return;
    }

    // Jika ada audio lain yang diputar, hentikan
    if (audioRef.current) {
      audioRef.current.pause();
      // FIX: pakai handler yang disimpan di elemen (audioRef.current._handlers),
      // BUKAN variabel lokal handleLoadedMetadata/handleTimeUpdate/handleEnded.
      // Variabel-variabel itu dideklarasikan dengan `const` di BAWAH kode ini,
      // jadi mengaksesnya di sini akan throw ReferenceError (temporal dead zone)
      // dan membatalkan seluruh fungsi playAudio() secara diam-diam setiap kali
      // dipanggil untuk kedua kalinya (termasuk setelah lagu pertama selesai).
      // Inilah penyebab audio berikutnya tidak bisa diputar sampai refresh.
      if (audioRef.current._handlers) {
        audioRef.current.removeEventListener('loadedmetadata', audioRef.current._handlers.handleLoadedMetadata);
        audioRef.current.removeEventListener('timeupdate', audioRef.current._handlers.handleTimeUpdate);
        audioRef.current.removeEventListener('ended', audioRef.current._handlers.handleEnded);
      }
      audioRef.current.src = '';
    }

    // Setup audio baru
    const audio = new Audio(audioUrl);
    audio.crossOrigin = 'anonymous';
    audio.volume = audioPlayer.volume;

    // Simpan event handler sebagai fungsi terpisah agar bisa di-remove
    const handleLoadedMetadata = () => {
      if (isMounted.current) {
        setAudioPlayer(prev => ({
          ...prev,
          duration: audio.duration,
          currentTrack: messageId
        }));
      }
    };

    const handleTimeUpdate = () => {
      if (isMounted.current) {
        setAudioPlayer(prev => ({
          ...prev,
          currentTime: audio.currentTime,
          progress: (audio.currentTime / audio.duration) * 100
        }));
      }
    };

    const handleEnded = () => {
      if (isMounted.current) {
        setAudioPlayer(prev => ({
          ...prev,
          isPlaying: false,
          currentTime: 0,
          progress: 0
        }));
        setCurrentAudio(null);
      }
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    // Simpan handler untuk cleanup
    audio._handlers = { handleLoadedMetadata, handleTimeUpdate, handleEnded };

    audioRef.current = audio;
    setCurrentAudio(messageId);

    audio.play().then(() => {
      if (isMounted.current) {
        setAudioPlayer(prev => ({ ...prev, isPlaying: true }));
      }
    }).catch(error => {
      console.error('Error playing audio:', error);
    });
  };

  // Pause audio
  const pauseAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setAudioPlayer(prev => ({ ...prev, isPlaying: false }));
    }
  };

  // Seek audio
  const seekAudio = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const seekTime = percentage * audioPlayer.duration;

    if (audioRef.current && audioPlayer.duration) {
      audioRef.current.currentTime = seekTime;
      setAudioPlayer(prev => ({
        ...prev,
        currentTime: seekTime,
        progress: percentage * 100
      }));
    }
  };

  // Change volume
  const changeVolume = (e) => {
    const volume = parseFloat(e.target.value);
    setAudioPlayer(prev => ({ ...prev, volume }));
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  };

  // Cleanup on unmount - JANGAN matikan audio, hanya bersihkan jika audio sudah selesai
  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;
      // Hanya pause jika audio sedang diputar dan komponen unmount
      // Tapi jangan hapus audio dari memory
      if (audioRef.current && audioPlayer.isPlaying) {
        audioRef.current.pause();
        // Hapus event listeners
        if (audioRef.current._handlers) {
          audioRef.current.removeEventListener('loadedmetadata', audioRef.current._handlers.handleLoadedMetadata);
          audioRef.current.removeEventListener('timeupdate', audioRef.current._handlers.handleTimeUpdate);
          audioRef.current.removeEventListener('ended', audioRef.current._handlers.handleEnded);
        }
      }
    };
  }, []);

  // Format duration
  const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <AudioContext.Provider value={{
      currentAudio,
      audioPlayer,
      playAudio,
      pauseAudio,
      seekAudio,
      changeVolume,
      formatDuration
    }}>
      {children}
    </AudioContext.Provider>
  );
};
