// components/Chat.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAudio } from './Audio';
import ClanBadge, { clanAvatarRingStyle } from './ClanBadge';
import { useAdaptiveInterval } from '../hooks/useAdaptiveInterval';

/* ------------------------------------------------------------------ */
/* Icon set (inline SVG, stroke-based, consistent 1.75px weight)       */
/* ------------------------------------------------------------------ */
const Icon = {
  Chat: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M21 11.5a8.38 8.38 0 0 1-4.4 7.5A8.5 8.5 0 0 1 12 20a8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3h.5A8.48 8.48 0 0 1 21 11.5Z" />
    </svg>
  ),
  Pin: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <line x1="12" y1="17" x2="12" y2="22" />
      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
    </svg>
  ),
  Image: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  ),
  Film: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="2.5" y="4" width="19" height="16" rx="2" />
      <path d="M7 4v16M17 4v16M2.5 9h4.5M17 9H21.5M2.5 15h4.5M17 15H21.5" />
    </svg>
  ),
  Music: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  ),
  Alert: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12.5" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  Paperclip: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  ),
  Upload: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M16 16l-4-4-4 4" />
      <path d="M12 12v9" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  ),
  Eye: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  Headphones: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3ZM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3Z" />
    </svg>
  ),
  Download: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  Reply: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="9 14 4 9 9 4" />
      <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
    </svg>
  ),
  Smile: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  ),
  Edit: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  ),
  Trash: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  ),
  Close: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  Refresh: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 0 0 4.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 0 1-15.357-2m15.357 2H15" />
    </svg>
  ),
  Send: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
  ),
};

const Chat = ({ user, showLoginPopup }) => {
  const navigate = useNavigate();

  // Audio context
  const {
    currentAudio,
    audioPlayer,
    playAudio,
    pauseAudio,
    seekAudio,
    changeVolume,
    formatDuration
  } = useAudio();

  // State
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [lastMessageId, setLastMessageId] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [revealedImages, setRevealedImages] = useState({});
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadCaption, setUploadCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editText, setEditText] = useState('');
  const [showReactionPicker, setShowReactionPicker] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [swipeAction, setSwipeAction] = useState(null);
  const [deletingIds, setDeletingIds] = useState(() => new Set());

  const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];
  const [uploadProgress, setUploadProgress] = useState(0);

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const isInitialLoad = useRef(true);
  const audioRef = useRef(null);
  const longPressTimer = useRef(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isSwiping = useRef(false);
  const deleteTimers = useRef({});

  // Scroll to bottom - di-memoize dengan useCallback
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    }, 50);
  }, []);

  // Load messages - di-memoize dengan useCallback
  const loadMessages = useCallback(async (silent = false) => {
    try {
      if (!silent && isInitialLoad.current) {
        setIsLoading(true);
      }
      const res = await fetch('/api/v1/social/chat', {
        credentials: 'include'
      });
      const data = await res.json();

      if (res.ok) {
        const newMessages = data.messages || [];
        setMessages(newMessages);
        if (newMessages.length > 0) {
          setLastMessageId(newMessages[0].id);
        }
      }
    } catch (error) {
      console.error('Load messages error:', error);
    } finally {
      setIsLoading(false);
      isInitialLoad.current = false;
    }
  }, []);

  // Format bold text
  const formatBoldText = useCallback((text) => {
    if (!text) return text;
    const parts = text.split(/(\*[^*]+\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
        return <strong key={i} className="font-bold">{part.slice(1, -1)}</strong>;
      }
      return part;
    });
  }, []);

  // Send command
  const sendCommand = useCallback(async (command) => {
    if (!user) {
      showLoginPopup();
      return;
    }

    setIsSending(true);
    setError('');

    const tempMessage = {
      id: `temp-${Date.now()}`,
      message: command,
      name: user.name || user.email?.split('@')[0] || 'User',
      userId: user.id,
      picture: user.picture,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [tempMessage, ...prev]);
    scrollToBottom();

    try {
      const res = await fetch('/api/v1/social/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: command })
      });

      const data = await res.json();

      if (res.ok) {
        await loadMessages(true);
        setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
        if (data.message) {
          setLastMessageId(data.message.id);
        }
      } else {
        setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
        setError(data.error || 'Gagal mengirim perintah');
      }
    } catch (error) {
      setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
      setError('Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setIsSending(false);
    }
  }, [user, showLoginPopup, loadMessages, scrollToBottom]);

  // Handle file select
  const handleFileSelect = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp',
                          'video/mp4', 'video/webm', 'video/quicktime',
                          'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm'];

    if (!allowedTypes.includes(file.type)) {
      setError('Hanya gambar, video, dan audio yang diizinkan.');
      e.target.value = '';
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      setError('Ukuran file maksimal 100MB.');
      e.target.value = '';
      return;
    }

    setUploadedFile(file);
    setUploadCaption('');
    setError('');
    setUploadProgress(0);
  }, []);

  // Handle upload
  const handleUpload = useCallback(async (e) => {
    e.preventDefault();

    if (!user) {
      showLoginPopup();
      return;
    }

    if (!uploadedFile) {
      setError('Pilih file terlebih dahulu.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setError('');

    const tempMessage = {
      id: `temp-${Date.now()}`,
      message: uploadCaption.trim() || 'Mengirim file…',
      name: user.name || user.email?.split('@')[0] || 'User',
      userId: user.id,
      picture: user.picture,
      timestamp: new Date().toISOString(),
      isUploading: true
    };

    setMessages(prev => [tempMessage, ...prev]);
    scrollToBottom();

    try {
      const formData = new FormData();
      formData.append('file', uploadedFile);

      const uploadResult = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://c.termai.cc/api/upload?key=AIzaBj7z2z3xBjsk', true);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(progress);
            setMessages(prev => prev.map(msg =>
              msg.id === tempMessage.id
                ? { ...msg, message: `Mengunggah… ${progress}%` }
                : msg
            ));
          }
        };

        xhr.onload = () => {
          if (xhr.status === 200) {
            try {
              const response = JSON.parse(xhr.responseText);
              resolve(response);
            } catch (e) {
              reject(new Error('Invalid response'));
            }
          } else {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error('Network error'));
        xhr.send(formData);
      });

      if (!uploadResult?.status) {
        throw new Error('Upload ke server gagal');
      }

      const mediaUrl = uploadResult.path;
      const mediaType = uploadedFile.type.startsWith('image/') ? 'image' :
                        uploadedFile.type.startsWith('video/') ? 'video' : 'audio';

      const chatResponse = await fetch('/api/v1/social/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          message: uploadCaption.trim() || '',
          mediaUrl: mediaUrl,
          mediaType: mediaType,
          fileName: uploadedFile.name
        })
      });

      const chatData = await chatResponse.json();

      if (chatResponse.ok) {
        setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
        await loadMessages(true);
        setUploadedFile(null);
        setUploadCaption('');
        setUploadProgress(0);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        if (chatData.message) {
          setLastMessageId(chatData.message.id);
        }
      } else {
        throw new Error(chatData.error || 'Gagal mengirim pesan');
      }

    } catch (error) {
      console.error('Upload error:', error);
      setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
      setError(error.message || 'Gagal upload file. Coba lagi.');
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  }, [user, uploadedFile, uploadCaption, showLoginPopup, loadMessages, scrollToBottom]);

  // Send message
  const sendMessage = useCallback(async (e) => {
    e.preventDefault();

    if (uploadedFile) {
      handleUpload(e);
      return;
    }

    if (!user) {
      showLoginPopup();
      return;
    }

    if (!newMessage.trim()) return;

    setIsSending(true);
    setError('');

    const userMessage = newMessage.trim();

    const tempMessage = {
      id: `temp-${Date.now()}`,
      message: userMessage,
      name: user.name || user.email?.split('@')[0] || 'User',
      userId: user.id,
      picture: user.picture,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [tempMessage, ...prev]);
    setNewMessage('');
    scrollToBottom();

    try {
      const res = await fetch('/api/v1/social/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: userMessage, replyTo: replyingTo })
      });

      const data = await res.json();

      if (res.ok) {
        await loadMessages(true);
        setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
        setReplyingTo(null);
        if (data.message) {
          setLastMessageId(data.message.id);
        }
      } else {
        setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
        setError(data.error || 'Failed to send message');
      }
    } catch (error) {
      setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
      setError('Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setIsSending(false);
    }
  }, [user, newMessage, uploadedFile, replyingTo, showLoginPopup, handleUpload, loadMessages, scrollToBottom]);

  // Delete message (actual API call + removal from state)
  const deleteMessage = useCallback(async (messageId) => {
    if (!user) return;

    try {
      const res = await fetch('/api/v1/social/chat', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ messageId })
      });

      if (res.ok) {
        setMessages(prev => prev.filter(msg => msg.id !== messageId));
      }
    } catch (error) {
      console.error('Delete message error:', error);
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
      delete deleteTimers.current[messageId];
    }
  }, [user]);

  // Trigger the slide-out animation, then perform the real delete once it finishes
  const requestDeleteMessage = useCallback((messageId) => {
    setDeletingIds(prev => new Set(prev).add(messageId));
    deleteTimers.current[messageId] = setTimeout(() => {
      deleteMessage(messageId);
    }, 220);
  }, [deleteMessage]);

  useEffect(() => {
    const timers = deleteTimers.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  // Reaction functions
  const toggleReaction = useCallback(async (messageId, emoji) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id !== messageId) return msg;
      const reactions = { ...(msg.reactions || {}) };
      const list = reactions[emoji] ? [...reactions[emoji]] : [];
      const idx = list.indexOf(user.id);
      if (idx === -1) list.push(user.id); else list.splice(idx, 1);
      if (list.length === 0) delete reactions[emoji]; else reactions[emoji] = list;
      return { ...msg, reactions };
    }));
    setShowReactionPicker(null);
    setContextMenu(null);

    try {
      await fetch('/api/v1/social/chat', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'react', messageId, emoji })
      });
    } catch (e) {
      console.error('React error:', e);
    }
  }, [user]);

  const togglePin = useCallback(async (messageId) => {
    try {
      const res = await fetch('/api/v1/social/chat', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'pin', messageId })
      });
      if (res.ok) {
        await loadMessages(true);
      } else {
        const data = await res.json();
        setError(data.error || 'Gagal pin pesan');
      }
    } catch (e) {
      console.error('Pin error:', e);
    }
    setContextMenu(null);
  }, [loadMessages]);

  const startReply = useCallback((msg) => {
    setReplyingTo({ id: msg.id, name: msg.name, message: msg.message });
    setContextMenu(null);
  }, []);

  const startEdit = useCallback((msg) => {
    setEditingMessageId(msg.id);
    setEditText(msg.message);
    setContextMenu(null);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingMessageId(null);
    setEditText('');
  }, []);

  const saveEdit = useCallback(async (messageId) => {
    if (!editText.trim()) return;
    try {
      const res = await fetch('/api/v1/social/chat', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'edit', messageId, newMessage: editText.trim() })
      });
      if (res.ok) await loadMessages(true);
    } catch (e) {
      console.error('Edit error:', e);
    }
    setEditingMessageId(null);
    setEditText('');
  }, [editText, loadMessages]);

  // Reveal NSFW image
  const revealImage = useCallback((messageId) => {
    setRevealedImages(prev => ({
      ...prev,
      [messageId]: true
    }));
  }, []);

  // Handle user click
  const handleUserClick = useCallback((userId) => {
    navigate(`/user/${userId}`);
  }, [navigate]);

  // Format time
  const formatTime = useCallback((timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Baru saja';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}j`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}h`;
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  }, []);

  // Long press handlers
  const handleTouchStart = useCallback((e, msg) => {
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    isSwiping.current = false;

    longPressTimer.current = setTimeout(() => {
      // Long press detected
      if (!isSwiping.current) {
        setContextMenu({
          message: msg,
          x: touch.clientX,
          y: touch.clientY
        });
        // Haptic feedback if available
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
      }
    }, 500);
  }, []);

  const handleTouchMove = useCallback((e) => {
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartX.current);
    const dy = Math.abs(touch.clientY - touchStartY.current);

    // If moved more than 20px, cancel long press
    if (dx > 20 || dy > 20) {
      clearTimeout(longPressTimer.current);
      isSwiping.current = true;

      // Check if swipe left (for reply)
      if (dx > 50 && touch.clientX < touchStartX.current - 30) {
        // Swipe left detected - reply action
        const msg = e.currentTarget.dataset.msg ? JSON.parse(e.currentTarget.dataset.msg) : null;
        if (msg && !msg.isCommand) {
          startReply(msg);
        }
      }
    }
  }, [startReply]);

  const handleTouchEnd = useCallback(() => {
    clearTimeout(longPressTimer.current);
  }, []);

  // Close context menu
  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Load messages on mount
  useEffect(() => {
    loadMessages(false).then(() => {
      scrollToBottom();
    });
  }, [loadMessages, scrollToBottom]);

  useAdaptiveInterval(() => {
    loadMessages(true);
  }, 15000);

  // Close context menu on scroll
  useEffect(() => {
    const handleScroll = () => {
      if (contextMenu) setContextMenu(null);
    };

    const container = chatContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [contextMenu]);

  // Loading state
  if (isLoading && isInitialLoad.current) {
    const skeletonRows = [
      { avatar: true, lineW: 'w-16', bubbleW: 'w-2/3', bubbleH: 'h-11', align: 'left' },
      { avatar: true, lineW: 'w-20', bubbleW: 'w-1/2', bubbleH: 'h-9', align: 'right' },
      { avatar: true, lineW: 'w-14', bubbleW: 'w-3/4', bubbleH: 'h-16', align: 'left' },
    ];
    return (
      <div className="flex flex-col h-full bg-[#0b0b10] rounded-2xl border border-[#2a2a35] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#2a2a35] bg-[#181820] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
            <div className="skeleton-shimmer h-3.5 w-24 rounded-full" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[400px] max-h-[500px]">
          {skeletonRows.map((row, i) => (
            <div
              key={i}
              className={`flex gap-3 ${row.align === 'right' ? 'flex-row-reverse' : ''}`}
              style={{ animationDelay: `${i * 90}ms` }}
            >
              <div className="skeleton-shimmer w-8 h-8 rounded-full shrink-0" />
              <div className={`flex flex-col max-w-[70%] ${row.align === 'right' ? 'items-end' : 'items-start'}`}>
                <div className={`skeleton-shimmer h-2.5 ${row.lineW} rounded-full mb-2`} />
                <div className={`skeleton-shimmer ${row.bubbleW} ${row.bubbleH} rounded-2xl ${row.align === 'right' ? 'rounded-tr-md' : 'rounded-tl-md'}`} />
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-[#2a2a35] bg-[#181820] shrink-0">
          <div className="skeleton-shimmer h-10 w-full rounded-full" />
        </div>
        <style>{`
          .skeleton-shimmer {
            background: linear-gradient(100deg, rgba(255,255,255,0.03) 30%, rgba(255,255,255,0.07) 45%, rgba(255,255,255,0.03) 60%);
            background-size: 250% 100%;
            animation: shimmerSweep 1.6s ease-in-out infinite;
          }
          @keyframes shimmerSweep {
            0% { background-position: 150% 0; }
            100% { background-position: -150% 0; }
          }
        `}</style>
      </div>
    );
  }

  // Find pinned message
  const pinnedMessage = messages.find(m => m.pinned);

  return (
    <>
      <div className="flex flex-col h-full bg-[#0b0b10] rounded-2xl border border-[#2a2a35] overflow-hidden">
        {/* Chat Header */}
        <div className="px-6 py-4 border-b border-[#2a2a35] bg-[#181820] shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${messages.length > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-white/20'} transition-colors`}></div>
              <Icon.Chat className="w-4 h-4 text-white/70" />
              <h2 className="font-display text-[#f0ead9] text-base tracking-wide">Chat Global</h2>
              <span className="text-white/20 text-xs font-bold">
                {messages.length} pesan
              </span>
            </div>
            <button
              onClick={() => loadMessages(true)}
              className="text-white/30 hover:text-[#d4a73c] transition-colors text-xs font-bold p-2"
              disabled={isLoading}
            >
              <Icon.Refresh className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Pinned Message */}
        {pinnedMessage && (
          <div className="px-4 py-2 bg-[#d4a73c]/10 border-b border-[#d4a73c]/20 flex items-center gap-2 shrink-0">
            <Icon.Pin className="w-3.5 h-3.5 text-[#d4a73c] shrink-0" />
            <p className="text-white/80 text-xs truncate flex-1">{pinnedMessage.message}</p>
          </div>
        )}

        {/* Messages Container */}
        <div
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar min-h-0 max-h-[500px]"
        >
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Icon.Chat className="w-14 h-14 mb-6 text-white/10" />
              <h3 className="text-white font-bold text-lg mb-2">Belum ada pesan</h3>
              <p className="text-white/30 text-sm font-medium">Jadilah orang pertama yang mengirim pesan!</p>
              <p className="text-white/20 text-xs mt-2">Kirim pesan untuk memulai obrolan</p>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isOwnMessage = user && msg.userId === user.id;
              const isBotMessage = msg.userId === 'system' || msg.isCommand;
              const isNewMessage = index === 0 && msg.id !== lastMessageId;
              const isCommand = msg.isCommand || (msg.message && msg.message.includes('━━━━━━━━━━━━━━━━━'));
              const isNsfw = msg.nsfw === true;
              const isRevealed = revealedImages[msg.id] || false;
              const isSfw = msg.sfw === true;
              const hasMedia = msg.hasMedia === true;
              const isDeleting = deletingIds.has(msg.id);

              // Determine max width class
              const maxWidthClass = isCommand ? 'max-w-[85%]' : 'max-w-[70%]';

              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${isOwnMessage && !isBotMessage ? 'flex-row-reverse' : ''} ${isNewMessage ? 'animate-[slideDown_0.2s_ease-out]' : ''} ${isDeleting ? 'msg-deleting' : ''}`}
                  style={{ '--slide-dir': isOwnMessage ? '28px' : '-28px' }}
                >
                  <img
                    src={msg.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.name)}&background=D4A73C&color=0B0B10&size=128`}
                    alt={msg.name}
                    className="w-8 h-8 rounded-full object-cover border border-white/10 shrink-0 cursor-pointer hover:scale-110 transition-transform"
                    style={clanAvatarRingStyle(msg.clanBadge)}
                    referrerPolicy="no-referrer"
                    onClick={() => handleUserClick(msg.userId)}
                    onError={(e) => {
                      e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.name)}&background=D4A73C&color=0B0B10&size=128`;
                    }}
                  />

                  <div
                    className={`flex flex-col ${maxWidthClass} ${isOwnMessage && !isBotMessage ? 'items-end' : 'items-start'}`}
                    data-msg={JSON.stringify(msg)}
                    onTouchStart={(e) => handleTouchStart(e, msg)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (!msg.isCommand) {
                        setContextMenu({
                          message: msg,
                          x: e.clientX,
                          y: e.clientY
                        });
                      }
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-bold text-xs ${isBotMessage ? 'text-[#d4a73c]' : 'text-white'}`}>
                        {msg.name}
                      </span>
                      {msg.clanBadge && <ClanBadge badge={msg.clanBadge} />}
                      <span className="text-white/20 text-[9px] font-medium">
                        {formatTime(msg.timestamp)}
                      </span>
                      {hasMedia && (
                        <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#d4a73c]/20 text-[#d4a73c] font-bold">
                          {msg.mediaType === 'image' ? <Icon.Image className="w-2.5 h-2.5" /> : msg.mediaType === 'video' ? <Icon.Film className="w-2.5 h-2.5" /> : <Icon.Music className="w-2.5 h-2.5" />}
                        </span>
                      )}
                    </div>

                    {isCommand ? (
                      <div className={`px-4 py-3 rounded-2xl whitespace-pre-line font-mono text-sm w-full ${
                        isBotMessage
                          ? 'bg-[#d4a73c]/10 border border-[#d4a73c]/20 text-[#d4a73c]'
                          : 'bg-[#181820] border border-white/5 text-white'
                      }`}>
                        {msg.hasImage && msg.imageUrl && (
                          <div className="mb-3 relative w-full">
                            {isSfw ? (
                              <div className="relative w-full">
                                <img
                                  src={msg.imageUrl}
                                  alt={msg.title || 'Thumbnail SFW'}
                                  className="w-full aspect-video object-cover rounded-lg cursor-pointer"
                                  referrerPolicy="no-referrer"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setSelectedImage(msg.imageUrl);
                                  }}
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                  }}
                                />
                                <div className="absolute top-2 right-2 bg-emerald-500/80 text-white text-xs font-bold px-2 py-1 rounded-full backdrop-blur-sm">
                                  SFW
                                </div>
                              </div>
                            ) : isNsfw && !isRevealed ? (
                              <div className="relative w-full">
                                <img
                                  src={msg.imageUrl}
                                  alt="NSFW Content"
                                  className="w-full aspect-video object-cover rounded-lg cursor-pointer"
                                  referrerPolicy="no-referrer"
                                  style={{
                                    filter: 'blur(20px)',
                                    opacity: 0.7
                                  }}
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                  }}
                                />
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 rounded-lg backdrop-blur-sm">
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      revealImage(msg.id);
                                    }}
                                    className="flex items-center gap-2 px-6 py-3 bg-[#d4a73c] text-[#0b0b10] font-bold rounded-lg hover:scale-105 transition-all shadow-lg shadow-[#d4a73c]/20 text-sm"
                                  >
                                    <Icon.Eye className="w-4 h-4" />
                                    Klik untuk melihat
                                  </button>
                                  <p className="text-white/60 text-xs mt-3">
                                    Konten ini memerlukan verifikasi
                                  </p>
                                </div>
                                <div className="absolute top-2 right-2 bg-red-500/80 text-white text-xs font-bold px-2 py-1 rounded-full backdrop-blur-sm">
                                  NSFW
                                </div>
                              </div>
                            ) : (
                              <div className="relative w-full">
                                <img
                                  src={msg.imageUrl}
                                  alt={msg.title || 'Thumbnail'}
                                  className="w-full aspect-video object-cover rounded-lg cursor-pointer"
                                  referrerPolicy="no-referrer"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setSelectedImage(msg.imageUrl);
                                  }}
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                  }}
                                />
                                {isNsfw && isRevealed && (
                                  <div className="absolute top-2 right-2 bg-red-500/80 text-white text-xs font-bold px-2 py-1 rounded-full backdrop-blur-sm">
                                    NSFW
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {msg.message.split('\n').map((line, i) => {
                          const buttonMatch = line.match(/🎵 \[Putar Audio\]\(([^)]+)\|audio\)  🎬 \[Putar Video\]\(([^)]+)\|video\)/);
                          if (buttonMatch) {
                            const audioLink = buttonMatch[1];
                            const videoLink = buttonMatch[2];
                            const before = line.substring(0, line.indexOf('🎵'));
                            return (
                              <div key={i} className="flex items-center gap-3 mt-3 flex-wrap">
                                {before}
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    sendCommand(`/ytmp3 ${audioLink}`);
                                  }}
                                  className="flex items-center gap-2 px-4 py-2 bg-[#d4a73c] text-[#0b0b10] font-bold rounded-lg hover:scale-105 transition-all shadow-lg shadow-[#d4a73c]/20 text-sm"
                                  type="button"
                                >
                                  <Icon.Headphones className="w-4 h-4" />
                                  Audio MP3
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    sendCommand(`/ytmp4 ${videoLink}`);
                                  }}
                                  className="flex items-center gap-2 px-4 py-2 bg-[#d4a73c] text-[#0b0b10] font-bold rounded-lg hover:scale-105 transition-all shadow-lg shadow-[#d4a73c]/20 text-sm"
                                  type="button"
                                >
                                  <Icon.Film className="w-4 h-4" />
                                  Video MP4
                                </button>
                              </div>
                            );
                          }

                          const audioDownloadMatch = line.match(/📥 \[Download Audio\]\(([^)]+)\)/);
                          if (audioDownloadMatch) {
                            const url = audioDownloadMatch[1];
                            const isCurrentTrack = currentAudio === url;
                            const isPlaying = isCurrentTrack && audioPlayer.isPlaying;

                            return (
                              <div key={i} className="mt-2">
                                <div className="bg-[#0b0b10] rounded-xl p-3 border border-white/10">
                                  <div className="flex items-center gap-3">
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        playAudio(url, url);
                                      }}
                                      className="w-10 h-10 rounded-full bg-[#d4a73c] text-[#0b0b10] flex items-center justify-center hover:scale-110 transition-all shadow-lg shadow-[#d4a73c]/20 shrink-0"
                                    >
                                      {isPlaying ? (
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                          <rect x="6" y="4" width="4" height="16" />
                                          <rect x="14" y="4" width="4" height="16" />
                                        </svg>
                                      ) : (
                                        <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                                          <polygon points="5,3 19,12 5,21" />
                                        </svg>
                                      )}
                                    </button>

                                    <div className="flex-1">
                                      <div className="flex justify-between text-xs text-white/60 mb-1">
                                        <span>{isCurrentTrack ? formatDuration(audioPlayer.currentTime) : '0:00'}</span>
                                        <span>{isCurrentTrack ? formatDuration(audioPlayer.duration) : '0:00'}</span>
                                      </div>
                                      <div
                                        className="relative h-1.5 bg-white/10 rounded-full cursor-pointer group"
                                        onClick={(e) => isCurrentTrack && seekAudio(e, audioRef)}
                                      >
                                        <div
                                          className="h-full bg-[#d4a73c] rounded-full transition-all"
                                          style={{ width: `${isCurrentTrack ? audioPlayer.progress : 0}%` }}
                                        >
                                          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-[#d4a73c] rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg shadow-[#d4a73c]/50" />
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                      <svg className="w-4 h-4 text-white/40" fill="currentColor" viewBox="0 0 24 24">
                                        <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" />
                                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                                      </svg>
                                      <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.01"
                                        value={audioPlayer.volume}
                                        onChange={changeVolume}
                                        className="w-16 h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#d4a73c] [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-[#d4a73c]/50"
                                      />
                                    </div>
                                  </div>
                                </div>

                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 bg-white/5 text-white/40 hover:text-[#d4a73c] rounded-lg text-xs font-medium transition-all border border-white/5 hover:border-[#d4a73c]/20"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    window.open(url, '_blank');
                                  }}
                                >
                                  <Icon.Download className="w-3.5 h-3.5" />
                                  Download
                                </a>
                              </div>
                            );
                          }

                          const videoDownloadMatch = line.match(/📥 \[Download Video\]\(([^)]+)\)/);
                          if (videoDownloadMatch) {
                            const url = videoDownloadMatch[1];
                            return (
                              <div key={i} className="mt-2">
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#d4a73c] text-[#0b0b10] font-bold rounded-lg hover:scale-105 transition-all shadow-lg shadow-[#d4a73c]/20 text-sm"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    window.open(url, '_blank');
                                  }}
                                >
                                  <Icon.Download className="w-4 h-4" />
                                  Download Video
                                </a>
                              </div>
                            );
                          }

                          const linkMatch = line.match(/\[([^\]]+)\]\(([^)]+)\)/);
                          if (linkMatch) {
                            const before = line.substring(0, line.indexOf('['));
                            const after = line.substring(line.indexOf(']') + 1);
                            const link = linkMatch[2];
                            return (
                              <div key={i}>
                                {before}
                                <a
                                  href={link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[#d4a73c] hover:underline font-bold"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {linkMatch[1]}
                                </a>
                                {after.replace(/\)/g, '')}
                              </div>
                            );
                          }
                          return <div key={i}>{formatBoldText(line)}</div>;
                        })}
                      </div>
                    ) : hasMedia ? (
                      // Media Message
                      <div className={`relative group w-full rounded-2xl overflow-hidden ${
                        isOwnMessage
                          ? 'rounded-tr-md bg-gradient-to-b from-[#1c1c20] to-[#181820] border border-[#d4a73c]/25 shadow-[0_0_0_1px_rgba(246,207,128,0.05)]'
                          : 'rounded-tl-md bg-[#181820] border border-white/5'
                      }`}>
                        {/* Image */}
                        {msg.mediaType === 'image' && (
                          <div className="relative">
                            <div
                              className="relative cursor-pointer overflow-hidden bg-[#0b0b10]"
                              onClick={() => {
                                if (isNsfw && !isRevealed) {
                                  revealImage(msg.id);
                                } else {
                                  setSelectedImage(msg.mediaUrl);
                                }
                              }}
                            >
                              <img
                                src={msg.mediaUrl}
                                alt={msg.message || 'Image'}
                                className={`w-full max-h-[340px] object-cover transition-transform duration-300 group-hover:scale-[1.03] ${isNsfw && !isRevealed ? 'blur-2xl scale-110' : ''}`}
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />

                              {!(isNsfw && !isRevealed) && (
                                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-end p-2 pointer-events-none">
                                  <div className="bg-black/60 backdrop-blur-sm rounded-full p-1.5">
                                    <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16zM11 8v6M8 11h6" />
                                    </svg>
                                  </div>
                                </div>
                              )}

                              {isNsfw && !isRevealed && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      revealImage(msg.id);
                                    }}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-[#d4a73c] text-[#0b0b10] font-bold rounded-full text-xs hover:scale-105 transition-all shadow-lg shadow-[#d4a73c]/20"
                                  >
                                    <Icon.Eye className="w-3.5 h-3.5" />
                                    Klik untuk melihat
                                  </button>
                                </div>
                              )}
                              {isNsfw && (
                                <div className="absolute top-2 right-2 bg-red-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wide">
                                  NSFW
                                </div>
                              )}
                            </div>

                            {msg.message && (
                              <p className={`text-sm font-medium leading-relaxed px-3.5 py-2.5 ${isOwnMessage ? 'text-white/90' : 'text-white/90'}`}>
                                {formatBoldText(msg.message)}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Video */}
                        {msg.mediaType === 'video' && (
                          <div className="relative">
                            <div className="relative bg-black">
                              <video
                                src={msg.mediaUrl}
                                controls
                                className="w-full max-h-[340px] block"
                                controlsList="nodownload"
                                preload="metadata"
                              />
                              <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-full pointer-events-none">
                                <Icon.Film className="w-3 h-3" />
                                VIDEO
                              </div>
                            </div>
                            {msg.message && (
                              <p className="text-sm font-medium leading-relaxed px-3.5 py-2.5 text-white/90">
                                {formatBoldText(msg.message)}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Audio */}
                        {msg.mediaType === 'audio' && (() => {
                          const isCurrentTrack = currentAudio === msg.mediaUrl;
                          const isPlaying = isCurrentTrack && audioPlayer.isPlaying;
                          return (
                            <div className="p-3.5">
                              <div className="flex items-center gap-3.5">
                                <button
                                  onClick={() => playAudio(msg.mediaUrl, msg.mediaUrl)}
                                  className="w-11 h-11 shrink-0 rounded-full bg-gradient-to-br from-[#d4a73c] to-[#e0b563] text-[#0b0b10] flex items-center justify-center hover:scale-110 transition-all shadow-lg shadow-[#d4a73c]/20"
                                >
                                  {isPlaying ? (
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                      <rect x="6" y="4" width="4" height="16" />
                                      <rect x="14" y="4" width="4" height="16" />
                                    </svg>
                                  ) : (
                                    <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                                      <polygon points="5,3 19,12 5,21" />
                                    </svg>
                                  )}
                                </button>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 mb-1.5">
                                    <div className="flex items-end gap-[2px] h-3.5">
                                      {[3, 6, 4, 8, 5, 7, 3].map((h, bi) => (
                                        <span
                                          key={bi}
                                          className={`w-[2.5px] rounded-full ${isPlaying ? 'bg-[#d4a73c]' : 'bg-white/20'}`}
                                          style={{
                                            height: `${h}px`,
                                            animation: isPlaying ? `wave 0.9s ease-in-out ${bi * 0.09}s infinite` : 'none'
                                          }}
                                        />
                                      ))}
                                    </div>
                                    <span className="text-white/40 text-[10px] font-bold truncate">
                                      {msg.fileName || 'Audio'}
                                    </span>
                                  </div>

                                  <div
                                    className="relative h-1.5 bg-white/10 rounded-full cursor-pointer group/bar"
                                    onClick={(e) => isCurrentTrack && seekAudio(e, audioRef)}
                                  >
                                    <div
                                      className="h-full bg-[#d4a73c] rounded-full transition-all"
                                      style={{ width: `${isCurrentTrack ? audioPlayer.progress : 0}%` }}
                                    >
                                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-[#d4a73c] rounded-full opacity-0 group-hover/bar:opacity-100 transition-opacity shadow-lg shadow-[#d4a73c]/50" />
                                    </div>
                                  </div>
                                  <div className="flex justify-between text-[9px] text-white/30 font-medium mt-1">
                                    <span>{isCurrentTrack ? formatDuration(audioPlayer.currentTime) : '0:00'}</span>
                                    <span>{isCurrentTrack ? formatDuration(audioPlayer.duration) : ''}</span>
                                  </div>
                                </div>
                              </div>

                              {msg.message && (
                                <p className="text-sm font-medium leading-relaxed text-white/90 mt-3 pt-3 border-t border-white/5">
                                  {formatBoldText(msg.message)}
                                </p>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      // Text Message
                      <div className="relative w-full">
                        <div
                          className={`px-4 py-2.5 rounded-2xl break-words relative group ${
                            isOwnMessage
                              ? 'bg-[#d4a73c] text-[#0b0b10] rounded-tr-none'
                              : 'bg-[#181820] text-white border border-white/5 rounded-tl-none'
                          }`}
                        >
                          {msg.replyTo && (
                            <div className={`mb-1.5 pl-2 border-l-2 ${isOwnMessage ? 'border-[#0b0b10]/30' : 'border-[#d4a73c]/40'}`}>
                              <p className="text-[10px] font-bold opacity-70">{msg.replyTo.name}</p>
                              <p className="text-[10px] opacity-60 truncate">{msg.replyTo.message}</p>
                            </div>
                          )}

                          {editingMessageId === msg.id ? (
                            <div className="flex flex-col gap-2 min-w-[200px]">
                              <input
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                className="bg-black/10 rounded-lg px-2 py-1 text-sm outline-none"
                                maxLength={500}
                                autoFocus
                              />
                              <div className="flex gap-2 justify-end">
                                <button onClick={cancelEdit} className="text-xs opacity-60">Batal</button>
                                <button onClick={() => saveEdit(msg.id)} className="text-xs font-bold">Simpan</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className="text-sm font-medium leading-relaxed">
                                {formatBoldText(msg.message)}
                                {msg.edited && <span className="text-[9px] opacity-50 ml-1">(diedit)</span>}
                              </p>
                            </>
                          )}

                          {isOwnMessage && msg.id.toString().startsWith('temp-') && (
                            <div className="absolute -top-1 -right-1">
                              <div className="w-3 h-3 border-2 border-[#0b0b10]/20 border-t-[#0b0b10] rounded-full animate-spin"></div>
                            </div>
                          )}
                        </div>

                        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {Object.entries(msg.reactions).map(([emoji, uids]) => (
                              <button
                                key={emoji}
                                onClick={() => toggleReaction(msg.id, emoji)}
                                className={`text-xs px-2 py-0.5 rounded-full border transition-all ${
                                  uids.includes(user?.id) ? 'bg-[#d4a73c]/20 border-[#d4a73c]/40' : 'bg-white/5 border-white/10'
                                }`}
                              >
                                {emoji} {uids.length}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Context Menu */}
        {contextMenu && (
          <div
            className="fixed z-50 bg-[#181820] border border-white/10 rounded-xl shadow-2xl min-w-[200px] overflow-hidden"
            style={{
              top: Math.min(contextMenu.y, window.innerHeight - 250),
              left: Math.min(contextMenu.x, window.innerWidth - 220),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-2 border-b border-white/5">
              <p className="text-white/50 text-xs truncate px-2">{contextMenu.message.name}</p>
            </div>
            <div className="p-1">
              <button
                onClick={() => startReply(contextMenu.message)}
                className="w-full flex items-center gap-3 px-3 py-2 text-white/80 hover:text-[#d4a73c] hover:bg-white/5 rounded-lg transition-all text-sm"
              >
                <Icon.Reply className="w-4 h-4" />
                Balas
              </button>
              <button
                onClick={() => {
                  setShowReactionPicker(showReactionPicker === contextMenu.message.id ? null : contextMenu.message.id);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-white/80 hover:text-[#d4a73c] hover:bg-white/5 rounded-lg transition-all text-sm"
              >
                <Icon.Smile className="w-4 h-4" />
                Reaksi
              </button>
              {contextMenu.message.userId === user?.id && !contextMenu.message.isCommand && (
                <>
                  <button
                    onClick={() => startEdit(contextMenu.message)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-white/80 hover:text-[#d4a73c] hover:bg-white/5 rounded-lg transition-all text-sm"
                  >
                    <Icon.Edit className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('Hapus pesan ini?')) {
                        setContextMenu(null);
                        requestDeleteMessage(contextMenu.message.id);
                      }
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all text-sm"
                  >
                    <Icon.Trash className="w-4 h-4" />
                    Hapus
                  </button>
                </>
              )}
              <button
                onClick={() => togglePin(contextMenu.message.id)}
                className="w-full flex items-center gap-3 px-3 py-2 text-white/80 hover:text-[#d4a73c] hover:bg-white/5 rounded-lg transition-all text-sm"
              >
                <Icon.Pin className="w-4 h-4" />
                {contextMenu.message.pinned ? 'Unpin' : 'Pin'}
              </button>
            </div>
          </div>
        )}

        {/* Reaction Picker (still appears above message) */}
        {showReactionPicker && (
          <div
            className="fixed z-50 bg-[#181820] border border-white/10 rounded-full px-3 py-2 shadow-2xl flex gap-2"
            style={{
              top: Math.min(contextMenu?.y || window.innerHeight/2, window.innerHeight - 100),
              left: Math.min(contextMenu?.x || window.innerWidth/2, window.innerWidth - 250),
            }}
          >
            {QUICK_REACTIONS.map(e => (
              <button
                key={e}
                onClick={() => toggleReaction(showReactionPicker, e)}
                className="hover:scale-150 transition-transform text-xl px-1"
              >
                {e}
              </button>
            ))}
            <button
              onClick={() => setShowReactionPicker(null)}
              className="text-white/30 hover:text-white/60 text-sm px-1"
            >
              <Icon.Close className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Input Area */}
        <div className="p-4 border-t border-[#2a2a35] bg-[#181820] shrink-0">
          {/* Upload Progress Bar */}
          {isUploading && (
            <div className="mb-3">
              <div className="flex items-center justify-between text-xs text-white/60 mb-1">
                <span className="flex items-center gap-1.5"><Icon.Upload className="w-3.5 h-3.5" /> Mengunggah…</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#d4a73c] rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* File Upload Preview */}
          {uploadedFile && !isUploading && (
            <div className="flex items-center gap-3 mb-3 p-3 bg-[#0b0b10] rounded-xl border border-white/10">
              <Icon.Paperclip className="w-4 h-4 text-white/30 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{uploadedFile.name}</p>
                <p className="text-white/30 text-xs">{(uploadedFile.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setUploadedFile(null);
                  setUploadCaption('');
                  setUploadProgress(0);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
                className="text-white/40 hover:text-red-400 transition-colors p-1 shrink-0"
              >
                <Icon.Close className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Upload Caption Input */}
          {uploadedFile && !isUploading && (
            <input
              type="text"
              placeholder="Tambahkan caption (opsional)..."
              value={uploadCaption}
              onChange={(e) => setUploadCaption(e.target.value)}
              className="w-full bg-[#0b0b10] border border-white/10 rounded-full px-5 py-2 text-white text-sm outline-none focus:border-[#d4a73c]/30 transition-all placeholder-white/20 font-medium mb-3"
              maxLength={500}
            />
          )}

          {/* Reply To */}
          {replyingTo && (
            <div className="flex items-center justify-between gap-2 mb-3 px-3 py-2 bg-[#0b0b10] border-l-2 border-[#d4a73c] rounded-lg">
              <div className="min-w-0">
                <p className="text-[#d4a73c] text-xs font-bold">Membalas {replyingTo.name}</p>
                <p className="text-white/50 text-xs truncate">{replyingTo.message}</p>
              </div>
              <button onClick={() => setReplyingTo(null)} className="text-white/40 hover:text-red-400 shrink-0">
                <Icon.Close className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Main Input Form */}
          <form onSubmit={sendMessage} className="flex gap-3 items-center">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2.5 chip-cut bg-[#0b0b10] border border-[#2a2a35] text-white/40 hover:text-[#ff4e2d] hover:border-[#ff4e2d]/40 transition-all shrink-0"
              disabled={!user || isSending || isUploading}
              title="Upload gambar, video, atau audio"
            >
              <Icon.Paperclip className="w-5 h-5" />
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*,audio/*"
              onChange={handleFileSelect}
              className="hidden"
            />

            <input
              type="text"
              placeholder={user ? (uploadedFile ? "Tambahkan caption..." : "Ketik pesan...") : "Login untuk chat..."}
              className={`flex-1 bg-[#0b0b10] border border-[#2a2a35] chip-cut px-5 py-2.5 text-white text-sm outline-none focus:border-[#ff4e2d]/50 transition-all placeholder-white/20 font-medium ${
                uploadedFile ? 'text-white/70' : ''
              }`}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              disabled={!user || isSending || isUploading}
              maxLength={500}
            />

            <button
              type="submit"
              disabled={!user || (isSending || isUploading) || (!newMessage.trim() && !uploadedFile)}
              className={`px-5 py-2.5 chip-cut font-bold text-sm transition-all shrink-0 ${
                user && ((newMessage.trim()) || uploadedFile) && !isSending && !isUploading
                  ? 'bg-[#ff4e2d] text-[#0b0b10] hover:scale-105 hover:shadow-lg hover:shadow-[#ff4e2d]/25'
                  : 'bg-white/5 text-white/20 cursor-not-allowed'
              }`}
            >
              {(isSending || isUploading) ? (
                <div className="w-5 h-5 border-2 border-[#0b0b10]/20 border-t-[#0b0b10] rounded-full animate-spin"></div>
              ) : uploadedFile ? (
                <Icon.Upload className="w-5 h-5" />
              ) : (
                <Icon.Send className="w-5 h-5" />
              )}
            </button>
          </form>

          {error && (
            <p className="flex items-center justify-center gap-1.5 text-red-400 text-xs font-medium mt-2 text-center animate-[shake_0.5s_ease-in-out]">
              <Icon.Alert className="w-3.5 h-3.5 shrink-0" />
              {error}
            </p>
          )}

          <p className="text-white/10 text-[9px] text-center mt-2 font-medium">
            {user ? 'Upload gambar (max 100MB) atau video/audio (max 100MB)' : 'Login untuk berpartisipasi dalam chat global'}
          </p>
        </div>
      </div>

      {/* Modal Fullscreen Image */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-[fadeIn_0.3s_ease-out]"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] w-full h-full flex items-center justify-center">
            <img
              src={selectedImage}
              alt="Fullscreen"
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              referrerPolicy="no-referrer"
              onClick={(e) => e.stopPropagation()}
              onError={(e) => {
                e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="%23F6CF80" stroke-width="2"%3E%3Crect x="3" y="3" width="18" height="18" rx="2"/%3E%3Ccircle cx="8.5" cy="8.5" r="1.5"/%3E%3Cpath d="M21 15l-5-5L5 21"/%3E%3C/svg%3E';
                e.target.className = 'max-w-full max-h-full object-contain opacity-50';
              }}
            />

            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 text-white/70 hover:text-white bg-black/50 hover:bg-black/70 rounded-full p-2 transition-all hover:scale-110"
            >
              <Icon.Close className="w-6 h-6" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                const link = document.createElement('a');
                link.href = selectedImage;
                link.download = `image_${Date.now()}.jpg`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="absolute bottom-4 right-4 text-white/70 hover:text-white bg-black/50 hover:bg-black/70 rounded-full p-2 transition-all hover:scale-110"
            >
              <Icon.Download className="w-6 h-6" />
            </button>

            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-white/40 text-xs font-medium bg-black/50 px-4 py-2 rounded-full">
              Klik di luar gambar untuk menutup
            </div>
          </div>
        </div>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }

        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }

        @keyframes wave {
          0%, 100% { transform: scaleY(0.4); }
          50% { transform: scaleY(1); }
        }

        /* Delete animation: slide toward the sender's side while fading and collapsing */
        .msg-deleting {
          animation: messageSlideOut 220ms ease-in forwards;
          pointer-events: none;
        }
        @keyframes messageSlideOut {
          from {
            opacity: 1;
            transform: translateX(0) scale(1);
            max-height: 200px;
            margin-bottom: 0;
          }
          70% {
            opacity: 0;
            transform: translateX(var(--slide-dir, -28px)) scale(0.94);
          }
          to {
            opacity: 0;
            transform: translateX(var(--slide-dir, -28px)) scale(0.94);
            max-height: 0;
            margin-bottom: -12px;
          }
        }

        /* Modern custom scrollbar */
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(246, 207, 128, 0.18) transparent;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(246, 207, 128, 0.18);
          border-radius: 999px;
          transition: background 0.2s ease;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(246, 207, 128, 0.4);
        }
      `}</style>
    </>
  );
};

export default Chat;
