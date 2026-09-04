import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { setSeoMeta, SITE_URL } from '../utils/seo';
import { useAuth } from '../context/AuthContext';

const TABS = [
  { id: 'users', label: 'Pengguna' },
  { id: 'clans', label: 'Clan' },
  { id: 'titles', label: 'Level & Title' },
  { id: 'website', label: 'Website' },
  { id: 'notify', label: 'Notifikasi' },
  { id: 'backup', label: 'Backup & Restore' },
];

const Admin = () => {
  const navigate = useNavigate();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('users');
  const [toast, setToast] = useState('');

  // ===== USERS =====
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  // ===== HAPUS SEMUA KECUALI YANG DIPILIH =====
  const [keepMode, setKeepMode] = useState(false);
  const [keepSelected, setKeepSelected] = useState(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkConfirmText, setBulkConfirmText] = useState('');
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    level: 0,
    title: '',
    picture: '',
    password: '',
    isAdmin: false,
    newUserId: ''
  });
  const [addForm, setAddForm] = useState({
    name: '',
    email: '',
    password: '',
    level: 0,
    title: '',
    picture: '',
    isAdmin: false
  });

  // ===== LEVEL & TITLE =====
  const [titles, setTitles] = useState([]);
  const [titlesLoading, setTitlesLoading] = useState(false);
  const [newTitle, setNewTitle] = useState({ name: '', level: 0 });
  const [editingTitleName, setEditingTitleName] = useState(null); // oldName lagi diedit
  const [editTitleForm, setEditTitleForm] = useState({ name: '', level: 0 });

  // ===== CLAN =====
  const [clans, setClans] = useState([]);
  const [clansLoading, setClansLoading] = useState(false);
  const [clanSearch, setClanSearch] = useState('');
  const [expandedClanId, setExpandedClanId] = useState(null);
  const [clanEditForm, setClanEditForm] = useState(null); // { clanId, name, tag, desc, joinType, minLevel, xp, treasury }
  const [clanActing, setClanActing] = useState(false);
  const [grantingClanId, setGrantingClanId] = useState(null);
  const [grantTier, setGrantTier] = useState('normal');
  const [gachaPool, setGachaPool] = useState([]);

  const loadClans = async () => {
    setClansLoading(true);
    try {
      const res = await fetch('/api/v1/admin/clans', { credentials: 'include' });
      const data = await res.json();
      if (data.success) setClans(data.clans);
    } catch (error) {
      console.error('Load clans error:', error);
    } finally {
      setClansLoading(false);
    }
  };

  const clanOp = async (op, payload) => {
    setClanActing(true);
    try {
      const res = await fetch('/api/v1/admin/clans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ op, ...payload }),
      });
      const data = await res.json();
      if (!data.success) showToast(data.error || 'Gagal, coba lagi');
      else { showToast('Berhasil disimpan'); loadClans(); }
      return data;
    } catch (error) {
      console.error('Clan admin op error:', error);
      showToast('Terjadi kesalahan');
      return { success: false };
    } finally {
      setClanActing(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'clans' && clans.length === 0 && !clansLoading) {
      loadClans();
      fetch('/api/v1/admin/clans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ op: 'gacha-pool' }),
      }).then((r) => r.json()).then((data) => { if (data.success) setGachaPool(data.items); }).catch(() => {});
    }
  }, [activeTab]);

  // ===== WEBSITE SETTINGS =====
  const DEFAULT_THEME = {
    accentColor: '#d4a73c',
    backgroundColor: '#0b0b10',
    panelColor: '#181820',
    panelColor2: '#141419',
    highlightColor: '#ff4e2d'
  };
  const [settings, setSettings] = useState({
    maintenanceMode: false,
    maintenanceMessage: '',
    announcement: { enabled: false, message: '', type: 'info' },
    theme: { ...DEFAULT_THEME }
  });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const savedThemeRef = React.useRef(null); // dipakai buat batalin preview kalau keluar tanpa simpan

  // ===== NOTIFIKASI ANIME/KOMIK BARU =====
  // Pengiriman email sekarang otomatis lewat cron job (lihat api/v1/cron/notify.js).
  // Panel ini cuma nampilin status terakhir + kelola email yang dikecualikan.
  const [notifyType, setNotifyType] = useState('ringkasan'); // 'ringkasan' | 'ulang-tahun'
  const [lastSent, setLastSent] = useState({ anime: null, komik: null });
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [excludedEmails, setExcludedEmails] = useState([]);
  const [newExcludedEmail, setNewExcludedEmail] = useState('');
  const [addingExcluded, setAddingExcluded] = useState(false);

  // ===== BACKUP & RESTORE REDIS VIA TELEGRAM =====
  const [telegramSettings, setTelegramSettings] = useState({ hasBotToken: false, chatId: '' });
  const [telegramBotTokenInput, setTelegramBotTokenInput] = useState('');
  const [telegramChatIdInput, setTelegramChatIdInput] = useState('');
  const [savingTelegramSettings, setSavingTelegramSettings] = useState(false);
  const [lastBackup, setLastBackup] = useState(null);
  const [backupLoading, setBackupLoading] = useState(false);
  const [runningBackup, setRunningBackup] = useState(false);
  const [restoreFile, setRestoreFile] = useState(null);
  const [wipeBeforeRestore, setWipeBeforeRestore] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [wipeConfirmText, setWipeConfirmText] = useState('');
  const [wipingAll, setWipingAll] = useState(false);

  // ===== UCAPAN ULANG TAHUN =====
  const [birthdayMessage, setBirthdayMessage] = useState('');
  const [birthdayRecipients, setBirthdayRecipients] = useState(new Set());
  const [birthdaySending, setBirthdaySending] = useState(false);

  // ===== PENGATURAN EMAIL PENGIRIM =====
  const [mailSettings, setMailSettings] = useState({ user: '', from: '', host: 'smtp.gmail.com', port: 587, hasPassword: false });
  const [mailForm, setMailForm] = useState({ user: '', from: '', host: 'smtp.gmail.com', port: 587, pass: '' });
  const [mailSettingsLoading, setMailSettingsLoading] = useState(false);
  const [savingMailSettings, setSavingMailSettings] = useState(false);

  useEffect(() => {
    setSeoMeta(
      'Admin Panel | Ndichan',
      'Panel administrasi Ndichan.',
      null,
      `${SITE_URL}/admin`,
      { noIndex: true }
    );
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isAdmin) {
      navigate('/home');
      return;
    }
    setLoading(false);
    loadData();
  }, [user, isAdmin, authLoading, navigate]);

  const loadData = async () => {
    await Promise.all([loadUsers(), loadStats(), loadTitles(), loadSettings(), loadNotifyStatus(), loadMailSettings(), loadBackupStatus()]);
  };

  const loadNotifyStatus = async () => {
    setNotifyLoading(true);
    try {
      const res = await fetch('/api/v1/admin/notify', { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setLastSent(data.lastSent || { anime: null, komik: null });
        setExcludedEmails(data.excluded || []);
      }
    } catch (error) {
      console.error('Load notify status error:', error);
    } finally {
      setNotifyLoading(false);
    }
  };

  const loadBackupStatus = async () => {
    setBackupLoading(true);
    try {
      const res = await fetch('/api/v1/admin/backup', { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setTelegramSettings(data.settings || { hasBotToken: false, chatId: '' });
        setTelegramChatIdInput(data.settings?.chatId || '');
        setLastBackup(data.lastBackup || null);
      }
    } catch (error) {
      console.error('Load backup status error:', error);
    } finally {
      setBackupLoading(false);
    }
  };

  const loadMailSettings = async () => {
    setMailSettingsLoading(true);
    try {
      const res = await fetch('/api/v1/admin/mail-settings', { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setMailSettings(data.settings);
        setMailForm({
          user: data.settings.user || '',
          from: data.settings.from || '',
          host: data.settings.host || 'smtp.gmail.com',
          port: data.settings.port || 587,
          pass: ''
        });
      }
    } catch (error) {
      console.error('Load mail settings error:', error);
    } finally {
      setMailSettingsLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await fetch('/api/v1/admin/users', {
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Load users error:', error);
    }
  };

  const loadStats = async () => {
    try {
      const res = await fetch('/api/v1/admin/stats', {
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Load stats error:', error);
    }
  };

  const loadTitles = async () => {
    setTitlesLoading(true);
    try {
      const res = await fetch('/api/v1/admin/titles', {
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        setTitles(data.titles || []);
      }
    } catch (error) {
      console.error('Load titles error:', error);
    } finally {
      setTitlesLoading(false);
    }
  };

  const loadSettings = async () => {
    setSettingsLoading(true);
    try {
      const res = await fetch('/api/v1/admin/settings', {
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        setSettings({
          maintenanceMode: !!data.settings.maintenanceMode,
          maintenanceMessage: data.settings.maintenanceMessage || '',
          announcement: {
            enabled: !!data.settings.announcement?.enabled,
            message: data.settings.announcement?.message || '',
            type: data.settings.announcement?.type || 'info'
          },
          theme: { ...DEFAULT_THEME, ...(data.settings.theme || {}) }
        });
        savedThemeRef.current = { ...DEFAULT_THEME, ...(data.settings.theme || {}) };
      }
    } catch (error) {
      console.error('Load settings error:', error);
    } finally {
      setSettingsLoading(false);
    }
  };

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(''), 3000);
  };

  // ===== THEME PREVIEW =====
  // Terapkan langsung ke CSS variable global supaya admin lihat perubahan
  // warna secara live sebelum menekan "Simpan Pengaturan".
  const THEME_CSS_VAR = {
    accentColor: '--gold',
    backgroundColor: '--ink',
    panelColor: '--panel',
    panelColor2: '--ink-2',
    highlightColor: '--ember'
  };
  const previewTheme = (key, value) => {
    document.documentElement.style.setProperty(THEME_CSS_VAR[key], value);
  };
  const handleThemeChange = (key, value) => {
    setSettings((s) => ({ ...s, theme: { ...s.theme, [key]: value } }));
    previewTheme(key, value);
  };
  const resetTheme = () => {
    setSettings((s) => ({ ...s, theme: { ...DEFAULT_THEME } }));
    Object.entries(DEFAULT_THEME).forEach(([key, value]) => previewTheme(key, value));
  };

  // ===== USER HANDLERS =====
  const handleEditUser = (u) => {
    setEditingUser(u);
    setEditForm({
      name: u.name || '',
      email: u.email || '',
      level: u.level || 0,
      title: u.title || 'Anime Newbie',
      picture: u.picture || '',
      password: '',
      isAdmin: u.isAdmin || false,
      newUserId: ''
    });
    setShowEditModal(true);
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    try {
      const updates = {
        name: editForm.name,
        email: editForm.email,
        level: parseInt(editForm.level),
        title: editForm.title,
        picture: editForm.picture,
        isAdmin: editForm.isAdmin
      };

      if (editForm.password) {
        updates.password = editForm.password;
      }

      if (editForm.newUserId && editForm.newUserId.trim() !== '') {
        updates.newUserId = editForm.newUserId.trim();
      }

      const res = await fetch('/api/v1/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          targetUserId: editingUser.id,
          updates: updates
        })
      });

      const data = await res.json();

      if (res.ok) {
        showToast(data.message || 'Perubahan tersimpan');
        setShowEditModal(false);
        loadUsers();
      } else {
        showToast(data.error || 'Gagal menyimpan perubahan');
      }
    } catch (error) {
      console.error('Update user error:', error);
      showToast('Gagal menyimpan perubahan');
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: addForm.name,
          email: addForm.email,
          password: addForm.password,
          level: parseInt(addForm.level),
          title: addForm.title,
          picture: addForm.picture,
          isAdmin: addForm.isAdmin
        })
      });

      if (res.ok) {
        showToast('User baru berhasil ditambahkan');
        setShowAddModal(false);
        setAddForm({ name: '', email: '', password: '', level: 0, title: '', picture: '', isAdmin: false });
        loadUsers();
      } else {
        const data = await res.json();
        showToast(data.error || 'Gagal menambahkan user');
      }
    } catch (error) {
      console.error('Add user error:', error);
      showToast('Gagal menambahkan user');
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!confirm(`Hapus user "${userName}"? Tindakan ini tidak bisa dibatalkan.`)) return;

    try {
      const res = await fetch('/api/v1/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ targetUserId: userId })
      });

      if (res.ok) {
        showToast('User berhasil dihapus');
        loadUsers();
      }
    } catch (error) {
      console.error('Delete user error:', error);
      showToast('Gagal menghapus user');
    }
  };

  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ===== HAPUS SEMUA KECUALI YANG DIPILIH =====
  const toggleKeepUser = (userId) => {
    setKeepSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const exitKeepMode = () => {
    setKeepMode(false);
    setKeepSelected(new Set());
  };

  const handleBulkDelete = async () => {
    if (bulkConfirmText.trim().toUpperCase() !== 'HAPUS SEMUA') return;
    setBulkDeleting(true);
    try {
      const res = await fetch('/api/v1/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ deleteAllExcept: Array.from(keepSelected) })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || `${data.deletedCount} user berhasil dihapus`);
        setShowBulkDeleteModal(false);
        setBulkConfirmText('');
        exitKeepMode();
        loadUsers();
        loadStats();
      } else {
        showToast(data.error || 'Gagal menghapus user');
      }
    } catch (error) {
      console.error('Bulk delete error:', error);
      showToast('Gagal menghapus user');
    } finally {
      setBulkDeleting(false);
    }
  };

  // ===== TITLE HANDLERS =====
  const handleAddTitle = async (e) => {
    e.preventDefault();
    if (!newTitle.name.trim()) return;

    try {
      const res = await fetch('/api/v1/admin/titles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newTitle.name.trim(), level: parseInt(newTitle.level) || 0 })
      });
      const data = await res.json();
      if (res.ok) {
        setTitles(data.titles || []);
        setNewTitle({ name: '', level: 0 });
        showToast('Title berhasil ditambahkan');
      } else {
        showToast(data.error || 'Gagal menambahkan title');
      }
    } catch (error) {
      console.error('Add title error:', error);
      showToast('Gagal menambahkan title');
    }
  };

  const startEditTitle = (t) => {
    setEditingTitleName(t.name);
    setEditTitleForm({ name: t.name, level: t.level });
  };

  const handleUpdateTitle = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/admin/titles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          oldName: editingTitleName,
          name: editTitleForm.name.trim(),
          level: parseInt(editTitleForm.level) || 0
        })
      });
      const data = await res.json();
      if (res.ok) {
        setTitles(data.titles || []);
        setEditingTitleName(null);
        showToast('Title berhasil diperbarui');
      } else {
        showToast(data.error || 'Gagal memperbarui title');
      }
    } catch (error) {
      console.error('Update title error:', error);
      showToast('Gagal memperbarui title');
    }
  };

  const handleDeleteTitle = async (name) => {
    if (!confirm(`Hapus title "${name}"?`)) return;
    try {
      const res = await fetch('/api/v1/admin/titles', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (res.ok) {
        setTitles(data.titles || []);
        showToast('Title berhasil dihapus');
      } else {
        showToast(data.error || 'Gagal menghapus title');
      }
    } catch (error) {
      console.error('Delete title error:', error);
      showToast('Gagal menghapus title');
    }
  };

  // ===== WEBSITE SETTINGS HANDLERS =====
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await fetch('/api/v1/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (res.ok) {
        setSettings(data.settings);
        savedThemeRef.current = data.settings.theme;
        showToast('Pengaturan website tersimpan');
      } else {
        showToast(data.error || 'Gagal menyimpan pengaturan');
      }
    } catch (error) {
      console.error('Save settings error:', error);
      showToast('Gagal menyimpan pengaturan');
    } finally {
      setSavingSettings(false);
    }
  };

  // ===== EMAIL DIKECUALIKAN DARI NOTIFIKASI =====
  const handleAddExcluded = async (e) => {
    e.preventDefault();
    const email = newExcludedEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      showToast('Masukkan email yang valid');
      return;
    }
    setAddingExcluded(true);
    try {
      const res = await fetch('/api/v1/admin/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (res.ok) {
        setExcludedEmails(data.excluded || []);
        setNewExcludedEmail('');
        showToast('Email dikecualikan dari notifikasi');
      } else {
        showToast(data.error || 'Gagal menambahkan email');
      }
    } catch (error) {
      console.error('Add excluded email error:', error);
      showToast('Gagal menambahkan email');
    } finally {
      setAddingExcluded(false);
    }
  };

  const handleRemoveExcluded = async (email) => {
    try {
      const res = await fetch(`/api/v1/admin/notify?email=${encodeURIComponent(email)}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        setExcludedEmails(data.excluded || []);
        showToast('Email dihapus dari daftar kecuali');
      } else {
        showToast(data.error || 'Gagal menghapus email');
      }
    } catch (error) {
      console.error('Remove excluded email error:', error);
      showToast('Gagal menghapus email');
    }
  };

  // ===== BACKUP & RESTORE HANDLERS =====
  const handleSaveTelegramSettings = async (e) => {
    e.preventDefault();
    if (!telegramChatIdInput.trim()) {
      showToast('Chat ID Telegram wajib diisi');
      return;
    }
    setSavingTelegramSettings(true);
    try {
      const res = await fetch('/api/v1/admin/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          op: 'save-settings',
          botToken: telegramBotTokenInput.trim(),
          chatId: telegramChatIdInput.trim(),
        })
      });
      const data = await res.json();
      if (res.ok) {
        setTelegramSettings(data.settings || {});
        setTelegramBotTokenInput('');
        showToast('Pengaturan Telegram tersimpan');
      } else {
        showToast(data.error || 'Gagal menyimpan pengaturan');
      }
    } catch (error) {
      console.error('Save telegram settings error:', error);
      showToast('Gagal menyimpan pengaturan');
    } finally {
      setSavingTelegramSettings(false);
    }
  };

  const handleRunBackupNow = async () => {
    setRunningBackup(true);
    try {
      const res = await fetch('/api/v1/admin/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ op: 'run' })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Backup terkirim ke Telegram (${data.totalKeys} key)`);
        loadBackupStatus();
      } else {
        showToast(data.error || 'Gagal menjalankan backup');
      }
    } catch (error) {
      console.error('Run backup error:', error);
      showToast('Gagal menjalankan backup');
    } finally {
      setRunningBackup(false);
    }
  };

  const handleRestoreFromFile = async () => {
    if (!restoreFile) {
      showToast('Pilih file backup (.json) dulu');
      return;
    }
    const confirmMsg = wipeBeforeRestore
      ? 'Ini akan MENGHAPUS SEMUA data Redis yang ada sekarang lalu menggantinya dengan isi file backup. Yakin lanjut?'
      : 'Ini akan menimpa key yang sama dari file backup ke database saat ini. Yakin lanjut?';
    if (!window.confirm(confirmMsg)) return;

    setRestoring(true);
    try {
      const text = await restoreFile.text();
      const parsed = JSON.parse(text);

      const res = await fetch('/api/v1/admin/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ op: 'restore', data: parsed, wipeBefore: wipeBeforeRestore })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Restore selesai: ${data.restored}/${data.total} key berhasil${data.failed ? `, ${data.failed} gagal` : ''}`);
        setRestoreFile(null);
      } else {
        showToast(data.error || 'Gagal restore backup');
      }
    } catch (error) {
      console.error('Restore backup error:', error);
      showToast('File backup tidak valid atau gagal dibaca');
    } finally {
      setRestoring(false);
    }
  };

  const WIPE_CONFIRM_PHRASE = 'HAPUS SEMUA DATA';

  const handleWipeAll = async () => {
    if (wipeConfirmText.trim() !== WIPE_CONFIRM_PHRASE) {
      showToast(`Ketik persis "${WIPE_CONFIRM_PHRASE}" dulu untuk konfirmasi`);
      return;
    }
    if (!window.confirm('INI TINDAKAN PERMANEN. Seluruh database (user, clan, komentar, watchlist, semuanya) akan dihapus total dan TIDAK BISA dikembalikan kecuali dari backup. Lanjutkan?')) {
      return;
    }
    if (!window.confirm('Beneran yakin? Ketuk OK sekali lagi untuk benar-benar menghapus semua database sekarang.')) {
      return;
    }

    setWipingAll(true);
    try {
      const res = await fetch('/api/v1/admin/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ op: 'wipe-all', confirm: wipeConfirmText.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        const safetyMsg = data.safetyBackup?.sent
          ? `Safety backup terkirim ke Telegram (${data.safetyBackup.totalKeys} key) sebelum dihapus.`
          : 'Safety backup TIDAK terkirim (Telegram belum diatur atau gagal) — data yang dihapus tidak punya cadangan.';
        showToast(`${data.deleted} key dihapus. ${safetyMsg}`);
        setWipeConfirmText('');
        loadData();
      } else {
        showToast(data.error || 'Gagal menghapus database');
      }
    } catch (error) {
      console.error('Wipe all error:', error);
      showToast('Gagal menghapus database');
    } finally {
      setWipingAll(false);
    }
  };

  const toggleBirthdayRecipient = (id) => {
    setBirthdayRecipients((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSendBirthday = async (e) => {
    e.preventDefault();
    if (birthdayRecipients.size === 0) {
      showToast('Pilih minimal 1 user untuk dikirimi ucapan');
      return;
    }
    setBirthdaySending(true);
    try {
      const res = await fetch('/api/v1/admin/birthday', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userIds: Array.from(birthdayRecipients),
          message: birthdayMessage.trim()
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`🎉 Ucapan terkirim ke ${data.sentCount}/${data.totalRecipients} orang${data.failedCount ? `, ${data.failedCount} gagal` : ''}`);
        setBirthdayRecipients(new Set());
        setBirthdayMessage('');
      } else {
        showToast(data.error || 'Gagal mengirim ucapan');
      }
    } catch (error) {
      console.error('Send birthday error:', error);
      showToast('Gagal mengirim ucapan');
    } finally {
      setBirthdaySending(false);
    }
  };

  const handleSaveMailSettings = async (e) => {
    e.preventDefault();
    setSavingMailSettings(true);
    try {
      const res = await fetch('/api/v1/admin/mail-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(mailForm)
      });
      const data = await res.json();
      if (res.ok) {
        setMailSettings(data.settings);
        setMailForm((f) => ({ ...f, pass: '' }));
        showToast('Pengaturan email pengirim tersimpan');
      } else {
        showToast(data.error || 'Gagal menyimpan pengaturan email');
      }
    } catch (error) {
      console.error('Save mail settings error:', error);
      showToast('Gagal menyimpan pengaturan email');
    } finally {
      setSavingMailSettings(false);
    }
  };

  // Kalau admin ganti-ganti warna (preview) lalu pindah halaman tanpa
  // menekan Simpan, kembalikan CSS variable ke warna yang benar-benar
  // tersimpan supaya tampilan situs gak nyangkut di warna preview.
  useEffect(() => {
    return () => {
      if (savedThemeRef.current) {
        Object.entries(THEME_CSS_VAR).forEach(([key, cssVar]) => {
          if (savedThemeRef.current[key]) {
            document.documentElement.style.setProperty(cssVar, savedThemeRef.current[key]);
          }
        });
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0b10]">
        <Navbar />
        <div className="pt-24 flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <div className="w-12 h-12 border-2 border-[#d4a73c]/20 border-t-[#d4a73c] rounded-full animate-spin mx-auto"></div>
            <p className="text-white/40 mt-4">Memuat...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!user?.isAdmin) {
    return (
      <div className="min-h-screen bg-[#0b0b10]">
        <Navbar />
        <div className="pt-24 max-w-7xl mx-auto px-4 text-center">
          <h1 className="text-2xl font-bold text-white">Akses Ditolak</h1>
          <p className="text-white/40 mt-2">Kamu tidak punya izin untuk membuka halaman ini.</p>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08080a]">
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #d4a73c; border-radius: 10px; }
      `}</style>

      <Navbar />

      {toast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-[#d4a73c] text-[#0b0b10] font-bold px-6 py-3 rounded-full shadow-2xl z-[999] animate-[slideUp_0.25s_ease-out] text-sm">
          {toast}
        </div>
      )}

      <div className="pt-24 max-w-7xl mx-auto px-4 pb-16">

        {/* ===== HEADER STRIP ===== */}
        <div className="relative rounded-[24px] overflow-hidden mb-6 border border-[#d4a73c]/15 bg-[#141419]">
          <span className="pointer-events-none select-none absolute -right-6 -top-12 text-[200px] font-black text-white/[0.025] leading-none">
            #
          </span>
          <div className="relative z-10 p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <p className="text-[#d4a73c] text-[11px] font-bold uppercase tracking-[0.2em] mb-1">Control Room</p>
              <h1 className="text-2xl md:text-3xl font-black text-white">Panel Admin</h1>
              <p className="text-white/35 text-sm mt-1">Kelola user, level/title, dan pengaturan website.</p>
            </div>
            {activeTab === 'users' && (
              <div className="flex items-center gap-2 shrink-0">
                {!keepMode ? (
                  <button
                    onClick={() => setKeepMode(true)}
                    className="bg-red-500/10 text-red-400 border border-red-500/20 font-bold px-5 py-2.5 rounded-full hover:bg-red-500/20 transition-all flex items-center gap-2 text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16"/>
                    </svg>
                    Hapus Semua Kecuali...
                  </button>
                ) : (
                  <button
                    onClick={exitKeepMode}
                    className="bg-white/5 text-white/60 border border-white/10 font-bold px-5 py-2.5 rounded-full hover:bg-white/10 transition-all text-sm"
                  >
                    Batal
                  </button>
                )}
                <button
                  onClick={() => setShowAddModal(true)}
                  className="bg-[#d4a73c] text-[#0b0b10] font-bold px-5 py-2.5 rounded-full hover:scale-105 transition-all flex items-center gap-2 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
                  </svg>
                  Tambah User
                </button>
              </div>
            )}
          </div>

          {/* Stat strip — konsisten dengan halaman profil: satu baris + pemisah */}
          {stats && (
            <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 divide-x divide-white/[0.06] border-t border-white/[0.06]">
              {[
                ['Total User', stats.totalUsers],
                ['Total Nonton', `${stats.totalHours}j`],
                ['Rata-rata Level', stats.averageLevel],
                ['Level Tertinggi', stats.maxLevel],
              ].map(([label, value]) => (
                <div key={label} className="px-4 py-4 text-center">
                  <p className="text-white/25 text-[10px] font-bold uppercase tracking-wider">{label}</p>
                  <p className="text-lg font-black text-white mt-1">{value}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ===== TAB SWITCHER ===== */}
        <div className="flex gap-2 mb-6 bg-[#141419] border border-white/5 rounded-full p-1.5 w-fit">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                activeTab === tab.id
                  ? 'bg-[#d4a73c] text-[#0b0b10]'
                  : 'text-white/40 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ===== TAB: PENGGUNA ===== */}
        {activeTab === 'users' && (
          <>
            <div className="flex flex-col md:flex-row gap-3 mb-5">
              <div className="flex-1 relative">
                <svg className="w-4 h-4 text-white/20 absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="7" />
                  <path strokeLinecap="round" d="M21 21l-4.3-4.3" />
                </svg>
                <input
                  type="text"
                  placeholder="Cari nama, email, atau ID user..."
                  className="w-full bg-[#141419] border border-white/10 rounded-full pl-11 pr-4 py-3 text-white text-sm outline-none focus:border-[#d4a73c]/40 transition-all placeholder-white/20"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoFocus
                />
              </div>
              <button
                onClick={loadUsers}
                className="px-6 py-3 bg-white/5 text-white/60 font-bold rounded-full hover:bg-white/10 hover:text-white transition-colors border border-white/10 text-sm"
              >
                Refresh
              </button>
              {searchTerm.trim() !== '' && (
                <span className="flex items-center justify-center px-5 py-3 bg-[#d4a73c]/10 text-[#d4a73c] rounded-full text-xs font-bold border border-[#d4a73c]/20 whitespace-nowrap">
                  {filteredUsers.length} hasil
                </span>
              )}
            </div>

            {keepMode && (
              <div className="mb-5 bg-red-500/10 border border-red-500/20 rounded-2xl px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <p className="text-red-400 font-bold text-sm">Mode Hapus Massal</p>
                  <p className="text-white/40 text-xs mt-0.5">Centang user yang mau <span className="text-white/70 font-bold">dipertahankan</span>. Sisanya akan dihapus permanen. Akun kamu sendiri otomatis ikut dipertahankan.</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-white text-sm font-bold whitespace-nowrap">{keepSelected.size} dipilih</span>
                  <button
                    type="button"
                    disabled={keepSelected.size === 0}
                    onClick={() => setShowBulkDeleteModal(true)}
                    className="bg-red-500 text-white font-bold px-5 py-2.5 rounded-full hover:bg-red-600 transition-all text-sm disabled:opacity-30 disabled:hover:bg-red-500"
                  >
                    Hapus Sisanya
                  </button>
                </div>
              </div>
            )}

            {/* ===== USER LIST (di luar keepMode, hanya tampil saat admin mencari — tidak dump semua user) ===== */}
            <div className="space-y-2">
              {!keepMode && searchTerm.trim() === '' ? (
                <div className="text-center py-16 bg-[#141419] border border-white/5 rounded-2xl">
                  <svg className="w-8 h-8 text-white/15 mx-auto mb-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="7" />
                    <path strokeLinecap="round" d="M21 21l-4.3-4.3" />
                  </svg>
                  <p className="text-white/30 font-medium">Ketik nama, email, atau ID untuk mencari user</p>
                  <p className="text-white/15 text-xs mt-1">{users.length} total user terdaftar</p>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-16 bg-[#141419] border border-white/5 rounded-2xl">
                  <p className="text-white/30 font-medium">Tidak ada user ditemukan</p>
                </div>
              ) : (
                filteredUsers.map((u) => (
                  <div
                    key={u.id}
                    onClick={keepMode ? () => toggleKeepUser(u.id) : undefined}
                    className={`group flex flex-col md:flex-row md:items-center gap-4 bg-[#141419] border rounded-2xl px-5 py-4 transition-colors ${
                      keepMode
                        ? `cursor-pointer ${keepSelected.has(u.id) ? 'border-[#d4a73c]/50 bg-[#d4a73c]/5' : 'border-white/5 hover:border-white/15'}`
                        : 'border-white/5 hover:border-[#d4a73c]/25'
                    }`}
                  >
                    {keepMode && (
                      <input
                        type="checkbox"
                        className="w-5 h-5 accent-[#d4a73c] shrink-0 cursor-pointer"
                        checked={keepSelected.has(u.id)}
                        onChange={() => toggleKeepUser(u.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                    <div className="flex items-center gap-3 min-w-0 md:w-64 shrink-0">
                      <img
                        src={u.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || 'User')}&background=F6CF80&color=0a0a0c&size=128`}
                        alt={u.name}
                        className="w-10 h-10 rounded-full object-cover border border-white/10 shrink-0"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || 'User')}&background=F6CF80&color=0a0a0c&size=128`;
                        }}
                      />
                      <div className="min-w-0">
                        <p className="text-white font-bold text-sm truncate">{u.name || 'Unknown'}</p>
                        <p className="text-white/30 text-[10px] font-mono truncate">{u.id}</p>
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 text-white/50 text-xs truncate">
                      {u.email || '-'}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[#d4a73c] font-black text-sm">Lv.{u.level || 0}</span>
                      <span className="text-white/25 text-[10px]">·</span>
                      <span className="text-white/50 text-[11px] truncate max-w-[120px]">{u.title || 'Anime Newbie'}</span>
                    </div>

                    <div className="shrink-0">
                      {u.isAdmin ? (
                        <span className="bg-[#d4a73c]/15 text-[#d4a73c] text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                          Admin
                        </span>
                      ) : (
                        <span className="text-white/20 text-[9px] font-black uppercase tracking-wider">User</span>
                      )}
                    </div>

                    {!keepMode && (
                      <div className="flex items-center gap-2 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleEditUser(u)}
                          className="text-[#d4a73c] hover:text-[#0b0b10] hover:bg-[#d4a73c] transition-colors text-xs font-bold px-3 py-1.5 rounded-full bg-[#d4a73c]/10 border border-[#d4a73c]/20"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u.id, u.name)}
                          className="text-red-400 hover:text-white hover:bg-red-500 transition-colors text-xs font-bold px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20"
                        >
                          Hapus
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* ===== TAB: CLAN ===== */}
        {activeTab === 'clans' && (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1 relative">
                <input
                  type="text" value={clanSearch} onChange={(e) => setClanSearch(e.target.value)}
                  placeholder="Cari nama/tag clan..."
                  className="w-full bg-[#141419] border border-white/10 rounded-full px-5 py-2.5 text-sm text-white outline-none focus:border-[#d4a73c]/50"
                />
              </div>
              <button
                onClick={loadClans} disabled={clansLoading}
                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white/60 rounded-full text-sm font-bold flex items-center gap-2 shrink-0"
              >
                {clansLoading ? 'Memuat...' : 'Refresh'}
              </button>
            </div>

            {clansLoading && clans.length === 0 ? (
              <p className="text-white/30 text-sm text-center py-10">Memuat daftar clan...</p>
            ) : clans.length === 0 ? (
              <p className="text-white/30 text-sm text-center py-10">Belum ada clan yang dibuat.</p>
            ) : (
              <div className="space-y-3">
                {clans
                  .filter((c) => {
                    const q = clanSearch.trim().toLowerCase();
                    if (!q) return true;
                    return c.name.toLowerCase().includes(q) || c.tag.toLowerCase().includes(q);
                  })
                  .map((c) => {
                    const isExpanded = expandedClanId === c.id;
                    const isEditingThis = clanEditForm?.clanId === c.id;
                    return (
                      <div key={c.id} className="bg-[#141419] border border-white/5 rounded-2xl overflow-hidden">
                        <button
                          onClick={() => setExpandedClanId(isExpanded ? null : c.id)}
                          className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/[0.02] transition-colors"
                        >
                          {c.activeBanner?.url && (
                            <img src={c.activeBanner.url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-white font-bold text-sm truncate">
                              {c.name} <span className="text-white/40 text-xs font-bold">[{c.tag}]</span>
                            </p>
                            <p className="text-white/35 text-xs mt-0.5">
                              Lv.{c.level} &middot; {c.memberCount}/{c.capacity} member &middot; {c.treasury} harta &middot; {c.joinType}
                            </p>
                          </div>
                          <svg className={`w-4 h-4 text-white/30 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {isExpanded && (
                          <div className="border-t border-white/5 p-4 space-y-4">
                            {/* Edit info clan */}
                            {isEditingThis ? (
                              <div className="bg-white/[0.03] rounded-xl p-3.5 space-y-2.5">
                                <div className="grid grid-cols-2 gap-2.5">
                                  <div>
                                    <label className="text-white/40 text-[10px] font-bold uppercase block mb-1">Nama</label>
                                    <input value={clanEditForm.name} onChange={(e) => setClanEditForm({ ...clanEditForm, name: e.target.value })} className="w-full bg-[#0b0b10] border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white outline-none" />
                                  </div>
                                  <div>
                                    <label className="text-white/40 text-[10px] font-bold uppercase block mb-1">Tag</label>
                                    <input value={clanEditForm.tag} onChange={(e) => setClanEditForm({ ...clanEditForm, tag: e.target.value.toUpperCase() })} className="w-full bg-[#0b0b10] border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white outline-none" />
                                  </div>
                                </div>
                                <div>
                                  <label className="text-white/40 text-[10px] font-bold uppercase block mb-1">Deskripsi</label>
                                  <textarea value={clanEditForm.desc} onChange={(e) => setClanEditForm({ ...clanEditForm, desc: e.target.value })} rows={2} maxLength={140} className="w-full bg-[#0b0b10] border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white outline-none resize-none" />
                                </div>
                                <div className="grid grid-cols-3 gap-2.5">
                                  <div>
                                    <label className="text-white/40 text-[10px] font-bold uppercase block mb-1">Cara Masuk</label>
                                    <select value={clanEditForm.joinType} onChange={(e) => setClanEditForm({ ...clanEditForm, joinType: e.target.value })} className="w-full bg-[#0b0b10] border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white outline-none">
                                      <option value="public">Public</option>
                                      <option value="approval">Approval</option>
                                      <option value="invite">Invite Only</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="text-white/40 text-[10px] font-bold uppercase block mb-1">Min Level</label>
                                    <input type="number" min={0} value={clanEditForm.minLevel} onChange={(e) => setClanEditForm({ ...clanEditForm, minLevel: e.target.value })} className="w-full bg-[#0b0b10] border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white outline-none" />
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2.5">
                                  <div>
                                    <label className="text-white/40 text-[10px] font-bold uppercase block mb-1">XP Clan</label>
                                    <input type="number" min={0} value={clanEditForm.xp} onChange={(e) => setClanEditForm({ ...clanEditForm, xp: e.target.value })} className="w-full bg-[#0b0b10] border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white outline-none" />
                                  </div>
                                  <div>
                                    <label className="text-white/40 text-[10px] font-bold uppercase block mb-1">Harta (Treasury)</label>
                                    <input type="number" min={0} value={clanEditForm.treasury} onChange={(e) => setClanEditForm({ ...clanEditForm, treasury: e.target.value })} className="w-full bg-[#0b0b10] border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white outline-none" />
                                  </div>
                                </div>
                                <div className="flex gap-2 pt-1">
                                  <button
                                    disabled={clanActing}
                                    onClick={async () => {
                                      const { clanId, ...patch } = clanEditForm;
                                      patch.minLevel = parseInt(patch.minLevel, 10) || 0;
                                      patch.xp = parseInt(patch.xp, 10) || 0;
                                      patch.treasury = parseInt(patch.treasury, 10) || 0;
                                      await clanOp('edit', { clanId, patch });
                                      setClanEditForm(null);
                                    }}
                                    className="px-4 py-2 bg-[#d4a73c] text-[#0b0b10] rounded-lg text-xs font-bold"
                                  >
                                    Simpan
                                  </button>
                                  <button onClick={() => setClanEditForm(null)} className="px-4 py-2 bg-white/5 text-white/60 rounded-lg text-xs font-bold">Batal</button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                <button
                                  onClick={() => setClanEditForm({ clanId: c.id, name: c.name, tag: c.tag, desc: c.desc || '', joinType: c.joinType, minLevel: c.minLevel || 0, xp: c.xp || 0, treasury: c.treasury || 0 })}
                                  className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-white/70 rounded-lg text-xs font-bold"
                                >
                                  Edit Clan
                                </button>
                                <button
                                  onClick={() => setGrantingClanId(grantingClanId === c.id ? null : c.id)}
                                  className="px-3.5 py-2 bg-[#3ecf8e]/10 hover:bg-[#3ecf8e]/20 text-[#3ecf8e] rounded-lg text-xs font-bold"
                                >
                                  Grant Item Gacha
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm(`Bubarkan clan "${c.name}"? Semua member bakal keluar dan clan-nya kehapus permanen.`)) {
                                      clanOp('disband', { clanId: c.id });
                                    }
                                  }}
                                  className="px-3.5 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-bold ml-auto"
                                >
                                  Bubarkan Clan
                                </button>
                              </div>
                            )}

                            {/* Grant gacha item */}
                            {grantingClanId === c.id && (
                              <div className="bg-white/[0.03] rounded-xl p-3.5">
                                <p className="text-white/50 text-xs font-bold mb-2">Pilih item buat langsung di-unlock + diaktifin ke clan ini:</p>
                                <div className="flex flex-wrap gap-1.5 mb-2.5">
                                  {['normal', 'rare', 'epic', 'legendary', 'mythic'].map((t) => (
                                    <button
                                      key={t} onClick={() => setGrantTier(t)}
                                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${grantTier === t ? 'bg-[#d4a73c] text-[#0b0b10]' : 'bg-white/5 text-white/50'}`}
                                    >
                                      {t}
                                    </button>
                                  ))}
                                </div>
                                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-48 overflow-y-auto">
                                  {gachaPool.filter((item) => item.rarity === grantTier).map((item) => (
                                    <button
                                      key={item.id} disabled={clanActing}
                                      onClick={async () => { await clanOp('grant-item', { clanId: c.id, itemId: item.id }); setGrantingClanId(null); }}
                                      title={`${item.name} (${item.rarity})`}
                                      className="aspect-square rounded-lg overflow-hidden border border-white/10 hover:border-[#d4a73c] transition-colors"
                                    >
                                      <img src={item.url} alt={item.name} loading="lazy" className="w-full h-full object-cover" />
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Member list */}
                            <div>
                              <p className="text-white/40 text-[10px] font-bold uppercase tracking-wide mb-2">Member ({c.members?.length || 0})</p>
                              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                                {(c.members || []).map((m) => (
                                  <div key={m.id} className="flex items-center gap-2.5 bg-white/[0.02] rounded-lg px-2.5 py-1.5">
                                    <img src={m.picture || '/favicon.svg'} className="w-6 h-6 rounded-full object-cover shrink-0" />
                                    <p className="text-white/70 text-xs truncate flex-1">{m.name}</p>
                                    <select
                                      value={m.role} disabled={clanActing}
                                      onChange={(e) => clanOp('set-role', { clanId: c.id, targetUserId: m.id, role: e.target.value })}
                                      className="bg-[#0b0b10] border border-white/10 rounded-md px-2 py-1 text-[10px] font-bold text-white/70 outline-none shrink-0"
                                    >
                                      <option value="LEADER">Leader</option>
                                      <option value="VICE">Vice</option>
                                      <option value="ADMIRAL">Admiral</option>
                                      <option value="OFFICER">Officer</option>
                                      <option value="MEMBER">Member</option>
                                    </select>
                                    {m.role !== 'LEADER' && (
                                      <button
                                        disabled={clanActing}
                                        onClick={() => { if (confirm(`Kick ${m.name} dari clan ini?`)) clanOp('kick', { clanId: c.id, targetUserId: m.id }); }}
                                        className="text-red-400/70 hover:text-red-400 text-[10px] font-bold shrink-0"
                                      >
                                        Kick
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* ===== TAB: LEVEL & TITLE ===== */}
        {activeTab === 'titles' && (
          <div className="space-y-6">
            <div className="bg-[#141419] border border-white/5 rounded-2xl p-5">
              <p className="text-[#d4a73c] text-[10px] font-bold uppercase tracking-wider mb-3">Tambah Title Baru</p>
              <form onSubmit={handleAddTitle} className="flex flex-col md:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Nama title, mis. Anime Otaku"
                  className="flex-1 bg-[#0b0b10] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:border-[#d4a73c]/30"
                  value={newTitle.name}
                  onChange={(e) => setNewTitle({ ...newTitle, name: e.target.value })}
                  required
                />
                <input
                  type="number"
                  min="0"
                  placeholder="Level minimum"
                  className="w-full md:w-40 bg-[#0b0b10] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:border-[#d4a73c]/30"
                  value={newTitle.level}
                  onChange={(e) => setNewTitle({ ...newTitle, level: e.target.value })}
                  required
                />
                <button type="submit" className="bg-[#d4a73c] text-[#0b0b10] font-bold px-6 py-2.5 rounded-full hover:scale-105 transition-all text-sm shrink-0">
                  Tambah
                </button>
              </form>
            </div>

            <div className="space-y-2">
              {titlesLoading ? (
                <div className="text-center py-10 text-white/30 text-sm">Memuat title...</div>
              ) : titles.length === 0 ? (
                <div className="text-center py-16 bg-[#141419] border border-white/5 rounded-2xl">
                  <p className="text-white/30 font-medium">Belum ada title. Tambahkan di atas.</p>
                </div>
              ) : (
                titles.map((t) => (
                  <div
                    key={t.name}
                    className="flex flex-col md:flex-row md:items-center gap-3 bg-[#141419] border border-white/5 hover:border-[#d4a73c]/25 rounded-2xl px-5 py-4 transition-colors"
                  >
                    {editingTitleName === t.name ? (
                      <form onSubmit={handleUpdateTitle} className="flex flex-1 flex-col md:flex-row gap-3">
                        <input
                          type="text"
                          className="flex-1 bg-[#0b0b10] border border-[#d4a73c]/20 rounded-lg px-4 py-2 text-white text-sm outline-none focus:border-[#d4a73c]/50"
                          value={editTitleForm.name}
                          onChange={(e) => setEditTitleForm({ ...editTitleForm, name: e.target.value })}
                          required
                        />
                        <input
                          type="number"
                          min="0"
                          className="w-full md:w-32 bg-[#0b0b10] border border-[#d4a73c]/20 rounded-lg px-4 py-2 text-white text-sm outline-none focus:border-[#d4a73c]/50"
                          value={editTitleForm.level}
                          onChange={(e) => setEditTitleForm({ ...editTitleForm, level: e.target.value })}
                          required
                        />
                        <div className="flex gap-2 shrink-0">
                          <button type="submit" className="bg-[#d4a73c] text-[#0b0b10] font-bold px-4 py-2 rounded-full text-xs">Simpan</button>
                          <button type="button" onClick={() => setEditingTitleName(null)} className="bg-white/5 text-white/60 font-bold px-4 py-2 rounded-full text-xs">Batal</button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0 flex items-center gap-3">
                          <span className="text-[#d4a73c] font-black text-sm shrink-0">Lv.{t.level}</span>
                          <span className="text-white font-bold text-sm truncate">{t.name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => startEditTitle(t)}
                            className="text-[#d4a73c] hover:text-[#0b0b10] hover:bg-[#d4a73c] transition-colors text-xs font-bold px-3 py-1.5 rounded-full bg-[#d4a73c]/10 border border-[#d4a73c]/20"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteTitle(t.name)}
                            className="text-red-400 hover:text-white hover:bg-red-500 transition-colors text-xs font-bold px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20"
                          >
                            Hapus
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ===== TAB: WEBSITE ===== */}
        {activeTab === 'website' && (
          <div className="space-y-6">
            {settingsLoading ? (
              <div className="text-center py-10 text-white/30 text-sm">Memuat pengaturan...</div>
            ) : (
              <form onSubmit={handleSaveSettings} className="space-y-6">
                {/* ===== MAINTENANCE MODE ===== */}
                <div className="bg-[#141419] border border-white/5 rounded-2xl p-5 md:p-6">
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <div>
                      <p className="text-[#d4a73c] text-[10px] font-bold uppercase tracking-wider mb-1">Mode Maintenance</p>
                      <p className="text-white/40 text-xs">Kalau aktif, pengunjung biasa akan melihat halaman maintenance. Admin tetap bisa mengakses situs.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={settings.maintenanceMode}
                        onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })}
                      />
                      <div className="w-11 h-6 bg-white/10 rounded-full peer peer-checked:bg-[#d4a73c] transition-all"></div>
                      <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                    </label>
                  </div>
                  <label className="text-white/30 text-[10px] font-bold uppercase tracking-wider block mb-1">Pesan Maintenance</label>
                  <textarea
                    className="w-full bg-[#0b0b10] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:border-[#d4a73c]/30 resize-none"
                    rows={3}
                    maxLength={500}
                    value={settings.maintenanceMessage}
                    onChange={(e) => setSettings({ ...settings, maintenanceMessage: e.target.value })}
                    placeholder="Ndichan sedang dalam perbaikan. Balik lagi sebentar lagi, ya!"
                  />
                </div>

                {/* ===== ANNOUNCEMENT ===== */}
                <div className="bg-[#141419] border border-white/5 rounded-2xl p-5 md:p-6">
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <div>
                      <p className="text-[#d4a73c] text-[10px] font-bold uppercase tracking-wider mb-1">Pengumuman di Homepage</p>
                      <p className="text-white/40 text-xs">Tampilkan banner pengumuman di bagian atas situs untuk semua pengunjung.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={settings.announcement.enabled}
                        onChange={(e) => setSettings({ ...settings, announcement: { ...settings.announcement, enabled: e.target.checked } })}
                      />
                      <div className="w-11 h-6 bg-white/10 rounded-full peer peer-checked:bg-[#d4a73c] transition-all"></div>
                      <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                    </label>
                  </div>

                  <label className="text-white/30 text-[10px] font-bold uppercase tracking-wider block mb-1">Isi Pengumuman</label>
                  <textarea
                    className="w-full bg-[#0b0b10] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:border-[#d4a73c]/30 resize-none mb-4"
                    rows={2}
                    maxLength={300}
                    value={settings.announcement.message}
                    onChange={(e) => setSettings({ ...settings, announcement: { ...settings.announcement, message: e.target.value } })}
                    placeholder="Server baru sudah aktif! Nonton makin lancar."
                  />

                  <label className="text-white/30 text-[10px] font-bold uppercase tracking-wider block mb-1">Tipe</label>
                  <div className="flex gap-2">
                    {[
                      ['info', 'Info'],
                      ['success', 'Sukses'],
                      ['warning', 'Peringatan'],
                    ].map(([val, label]) => (
                      <button
                        type="button"
                        key={val}
                        onClick={() => setSettings({ ...settings, announcement: { ...settings.announcement, type: val } })}
                        className={`px-4 py-2 rounded-full text-xs font-bold transition-all border ${
                          settings.announcement.type === val
                            ? 'bg-[#d4a73c] text-[#0b0b10] border-[#d4a73c]'
                            : 'bg-transparent text-white/40 border-white/10 hover:text-white'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ===== WARNA WEBSITE ===== */}
                <div className="bg-[#141419] border border-white/5 rounded-2xl p-5 md:p-6">
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <div>
                      <p className="text-[#d4a73c] text-[10px] font-bold uppercase tracking-wider mb-1">Warna Website</p>
                      <p className="text-white/40 text-xs">Atur skema warna situs. Perubahan langsung terlihat sebagai preview di halaman ini sebelum disimpan.</p>
                    </div>
                    <button
                      type="button"
                      onClick={resetTheme}
                      className="shrink-0 text-white/40 hover:text-white text-xs font-bold px-3 py-1.5 rounded-full border border-white/10 hover:border-white/20 transition-all"
                    >
                      Reset Default
                    </button>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    {[
                      ['accentColor', 'Warna Aksen', 'Warna utama untuk tombol, judul, dan highlight.'],
                      ['backgroundColor', 'Warna Latar', 'Warna latar belakang utama situs.'],
                      ['panelColor', 'Warna Panel', 'Warna latar kartu/panel (mis. section, card).'],
                      ['panelColor2', 'Warna Panel Sekunder', 'Warna latar navbar & panel lapis kedua.'],
                      ['highlightColor', 'Warna Aksen Sekunder', 'Warna untuk status live/peringatan/CTA sekunder.'],
                    ].map(([key, label, desc]) => (
                      <div key={key} className="flex items-center gap-3 bg-[#0b0b10] border border-white/10 rounded-lg px-4 py-3">
                        <label className="relative shrink-0 cursor-pointer">
                          <input
                            type="color"
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            value={settings.theme[key]}
                            onChange={(e) => handleThemeChange(key, e.target.value)}
                          />
                          <span
                            className="block w-9 h-9 rounded-full border-2 border-white/15"
                            style={{ backgroundColor: settings.theme[key] }}
                          />
                        </label>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-xs font-bold">{label}</p>
                          <p className="text-white/30 text-[10px] leading-snug mb-1.5">{desc}</p>
                          <input
                            type="text"
                            value={settings.theme[key]}
                            onChange={(e) => handleThemeChange(key, e.target.value)}
                            className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-white/70 text-[11px] font-mono outline-none focus:border-[#d4a73c]/30"
                            maxLength={7}
                            placeholder="#000000"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={savingSettings}
                  className="bg-[#d4a73c] text-[#0b0b10] font-bold px-8 py-3 rounded-full hover:scale-105 transition-all text-sm disabled:opacity-50 disabled:hover:scale-100"
                >
                  {savingSettings ? 'Menyimpan...' : 'Simpan Pengaturan'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* ===== TAB: NOTIFIKASI ===== */}
        {activeTab === 'notify' && (
          <div className="space-y-6">
            {/* ===== PILIH TAMPILAN ===== */}
            <div className="flex gap-2 flex-wrap">
              {[
                ['ringkasan', 'Notifikasi Otomatis'],
                ['ulang-tahun', '🎉 Ucapan Ulang Tahun'],
              ].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setNotifyType(val)}
                  className={`px-5 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all border ${
                    notifyType === val
                      ? 'bg-[#d4a73c] text-[#0b0b10] border-[#d4a73c]'
                      : 'bg-transparent text-white/40 border-white/10 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {notifyType === 'ringkasan' && (
            <>
            {/* ===== INFO CRON ===== */}
            <div className="bg-[#141419] border border-white/5 rounded-2xl p-5 md:p-6">
              <p className="text-[#d4a73c] text-[10px] font-bold uppercase tracking-wider mb-1">Notifikasi Anime & Komik Baru</p>
              <p className="text-white/40 text-xs leading-relaxed">
                Email rilisan baru sekarang dikirim otomatis lewat cron job (cron-job.org) yang memanggil{' '}
                <code className="text-white/60 bg-white/5 px-1.5 py-0.5 rounded">/api/v1/cron/notify</code> secara berkala.
                Tidak ada lagi fitur kirim manual — sistem sendiri yang mendeteksi rilisan baru dan mengirim email ke seluruh pengguna (kecuali yang dikecualikan di bawah).
              </p>
            </div>

            {/* ===== STATUS TERAKHIR ===== */}
            <div className="bg-[#141419] border border-white/5 rounded-2xl p-5 md:p-6 grid sm:grid-cols-2 gap-5">
              {['anime', 'komik'].map((t) => (
                <div key={t}>
                  <p className="text-[#d4a73c] text-[10px] font-bold uppercase tracking-wider mb-1">Terakhir Dinotifikasi ({t === 'komik' ? 'Komik' : 'Anime'})</p>
                  {notifyLoading ? (
                    <p className="text-white/30 text-xs">Memuat status...</p>
                  ) : lastSent[t] ? (
                    <div>
                      <p className="text-white font-bold text-sm">{lastSent[t].title}</p>
                      <p className="text-white/30 text-xs mt-0.5">Dikirim {new Date(lastSent[t].sentAt).toLocaleString('id-ID')}</p>
                    </div>
                  ) : (
                    <p className="text-white/40 text-xs">Belum ada notifikasi {t} yang terkirim otomatis.</p>
                  )}
                </div>
              ))}
            </div>

            {/* ===== EMAIL DIKECUALIKAN ===== */}
            <div className="bg-[#141419] border border-white/5 rounded-2xl p-5 md:p-6">
              <p className="text-[#d4a73c] text-[10px] font-bold uppercase tracking-wider mb-1">Email Dikecualikan dari Notifikasi</p>
              <p className="text-white/40 text-xs mb-4">User dengan email di bawah ini tidak akan menerima email anime/komik baru sama sekali.</p>

              <form onSubmit={handleAddExcluded} className="flex gap-2 mb-4">
                <input
                  type="email"
                  value={newExcludedEmail}
                  onChange={(e) => setNewExcludedEmail(e.target.value)}
                  placeholder="email@contoh.com"
                  className="flex-1 bg-[#0b0b10] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:border-[#d4a73c]/30"
                />
                <button
                  type="submit"
                  disabled={addingExcluded}
                  className="shrink-0 bg-[#d4a73c] text-[#0b0b10] font-bold px-5 py-2.5 rounded-lg hover:scale-105 transition-all text-xs disabled:opacity-50 disabled:hover:scale-100"
                >
                  {addingExcluded ? 'Menambah...' : 'Tambah'}
                </button>
              </form>

              {excludedEmails.length === 0 ? (
                <p className="text-white/30 text-xs">Belum ada email yang dikecualikan.</p>
              ) : (
                <div className="border border-white/10 rounded-lg divide-y divide-white/5 max-h-64 overflow-y-auto">
                  {excludedEmails.map((email) => (
                    <div key={email} className="flex items-center justify-between px-4 py-2.5">
                      <p className="text-white/70 text-xs truncate">{email}</p>
                      <button
                        type="button"
                        onClick={() => handleRemoveExcluded(email)}
                        className="shrink-0 text-white/40 hover:text-red-400 text-xs font-bold px-3 py-1 rounded-full border border-white/10 hover:border-red-400/30 transition-all"
                      >
                        Hapus
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            </>
            )}

            {/* ===== UCAPAN ULANG TAHUN ===== */}
            {notifyType === 'ulang-tahun' && (
              <form onSubmit={handleSendBirthday} className="bg-gradient-to-br from-[#141419] to-[#1a1420] border border-[#d4a73c]/10 rounded-2xl p-5 md:p-6 space-y-4 relative overflow-hidden">
                <p className="text-2xl">🎉🎂🎈🎊</p>
                <p className="text-[#d4a73c] text-[10px] font-bold uppercase tracking-wider">Kirim Ucapan Ulang Tahun</p>
                <p className="text-white/40 text-xs -mt-2">Pilih satu atau beberapa user, tulis ucapan pribadi (opsional), lalu kirim email ulang tahun yang meriah ke mereka.</p>

                <div>
                  <label className="text-white/30 text-[10px] font-bold uppercase tracking-wider block mb-1">Pesan Ucapan (opsional)</label>
                  <textarea
                    rows={3}
                    value={birthdayMessage}
                    onChange={(e) => setBirthdayMessage(e.target.value)}
                    className="w-full bg-[#0b0b10] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:border-[#d4a73c]/30 resize-none"
                    placeholder="Kosongkan untuk pakai ucapan default yang sudah meriah, atau tulis pesan personal di sini..."
                  />
                </div>

                <div>
                  <label className="text-white/30 text-[10px] font-bold uppercase tracking-wider block mb-2">Pilih Penerima ({birthdayRecipients.size} dipilih)</label>
                  <div className="border border-white/10 rounded-lg max-h-64 overflow-y-auto divide-y divide-white/5">
                    {users.length === 0 && (
                      <p className="text-white/30 text-xs px-4 py-3">Belum ada pengguna.</p>
                    )}
                    {users.map((u) => (
                      <label key={u.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-white/[0.03]">
                        <input
                          type="checkbox"
                          className="w-4 h-4 accent-[#d4a73c] shrink-0"
                          checked={birthdayRecipients.has(u.id)}
                          onChange={() => toggleBirthdayRecipient(u.id)}
                        />
                        <div className="min-w-0">
                          <p className="text-white text-xs font-bold truncate">{u.name}</p>
                          <p className="text-white/30 text-[11px] truncate">{u.email}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={birthdaySending || birthdayRecipients.size === 0}
                  className="bg-gradient-to-r from-[#ff6b9d] via-[#c471ed] to-[#f6cf80] text-[#0b0b10] font-bold px-8 py-3 rounded-full hover:scale-105 transition-all text-sm disabled:opacity-50 disabled:hover:scale-100"
                >
                  {birthdaySending ? 'Mengirim...' : `🎉 Kirim Ucapan ke ${birthdayRecipients.size} User`}
                </button>
              </form>
            )}

            {/* ===== PENGATURAN EMAIL PENGIRIM ===== */}
            <div className="bg-[#141419] border border-white/5 rounded-2xl p-5 md:p-6">
              <p className="text-[#d4a73c] text-[10px] font-bold uppercase tracking-wider mb-1">Pengaturan Email Pengirim</p>
              <p className="text-white/40 text-xs mb-4">Email & password (App Password Gmail) yang dipakai sistem untuk mengirim semua email — verifikasi akun maupun notifikasi anime/komik baru.</p>

              {mailSettingsLoading ? (
                <p className="text-white/30 text-xs">Memuat pengaturan...</p>
              ) : (
                <form onSubmit={handleSaveMailSettings} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-white/30 text-[10px] font-bold uppercase tracking-wider block mb-1">Alamat Email (SMTP User)</label>
                      <input
                        type="email"
                        value={mailForm.user}
                        onChange={(e) => setMailForm({ ...mailForm, user: e.target.value })}
                        className="w-full bg-[#0b0b10] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:border-[#d4a73c]/30"
                        placeholder="namamu@gmail.com"
                      />
                    </div>
                    <div>
                      <label className="text-white/30 text-[10px] font-bold uppercase tracking-wider block mb-1">
                        App Password {mailSettings.hasPassword && <span className="text-white/20 normal-case font-normal">(sudah tersimpan, kosongkan kalau tidak ganti)</span>}
                      </label>
                      <input
                        type="password"
                        value={mailForm.pass}
                        onChange={(e) => setMailForm({ ...mailForm, pass: e.target.value })}
                        className="w-full bg-[#0b0b10] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:border-[#d4a73c]/30"
                        placeholder="••••••••••••••••"
                        autoComplete="new-password"
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-1">
                      <label className="text-white/30 text-[10px] font-bold uppercase tracking-wider block mb-1">Nama Pengirim (From)</label>
                      <input
                        type="text"
                        value={mailForm.from}
                        onChange={(e) => setMailForm({ ...mailForm, from: e.target.value })}
                        className="w-full bg-[#0b0b10] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:border-[#d4a73c]/30"
                        placeholder="ndika@ndichan.xyz"
                      />
                    </div>
                    <div>
                      <label className="text-white/30 text-[10px] font-bold uppercase tracking-wider block mb-1">SMTP Host</label>
                      <input
                        type="text"
                        value={mailForm.host}
                        onChange={(e) => setMailForm({ ...mailForm, host: e.target.value })}
                        className="w-full bg-[#0b0b10] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:border-[#d4a73c]/30"
                        placeholder="smtp.gmail.com"
                      />
                    </div>
                    <div>
                      <label className="text-white/30 text-[10px] font-bold uppercase tracking-wider block mb-1">SMTP Port</label>
                      <input
                        type="number"
                        value={mailForm.port}
                        onChange={(e) => setMailForm({ ...mailForm, port: e.target.value })}
                        className="w-full bg-[#0b0b10] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:border-[#d4a73c]/30"
                        placeholder="587"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={savingMailSettings}
                    className="bg-[#d4a73c] text-[#0b0b10] font-bold px-8 py-3 rounded-full hover:scale-105 transition-all text-sm disabled:opacity-50 disabled:hover:scale-100"
                  >
                    {savingMailSettings ? 'Menyimpan...' : 'Simpan Pengaturan Email'}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* ===== TAB: BACKUP & RESTORE ===== */}
        {activeTab === 'backup' && (
          <div className="space-y-6">
            {/* ===== INFO CRON ===== */}
            <div className="bg-[#141419] border border-white/5 rounded-2xl p-5 md:p-6">
              <p className="text-[#d4a73c] text-[10px] font-bold uppercase tracking-wider mb-1">Backup Otomatis Seluruh Redis</p>
              <p className="text-white/40 text-xs leading-relaxed">
                Backup rutin bisa dijalankan otomatis lewat cron job (cron-job.org) yang memanggil{' '}
                <code className="text-white/60 bg-white/5 px-1.5 py-0.5 rounded">/api/v1/cron/backup</code>.
                Setiap dijalankan, seluruh isi Redis dibungkus jadi satu file <code className="text-white/60 bg-white/5 px-1.5 py-0.5 rounded">.json</code> dan dikirim ke chat Telegram di bawah. File ini juga yang dipakai untuk restore.
              </p>
            </div>

            {/* ===== PENGATURAN BOT TELEGRAM ===== */}
            <div className="bg-[#141419] border border-white/5 rounded-2xl p-5 md:p-6">
              <p className="text-[#d4a73c] text-[10px] font-bold uppercase tracking-wider mb-1">Pengaturan Bot Telegram</p>
              <p className="text-white/40 text-xs mb-4">Bot token didapat dari @BotFather, chat ID adalah tujuan (bisa akun pribadi atau grup) yang bakal menerima file backup.</p>

              {backupLoading ? (
                <p className="text-white/30 text-xs">Memuat pengaturan...</p>
              ) : (
                <form onSubmit={handleSaveTelegramSettings} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-white/30 text-[10px] font-bold uppercase tracking-wider block mb-1">
                        Bot Token {telegramSettings.hasBotToken && <span className="text-white/20 normal-case font-normal">(sudah tersimpan, kosongkan kalau tidak ganti)</span>}
                      </label>
                      <input
                        type="password"
                        value={telegramBotTokenInput}
                        onChange={(e) => setTelegramBotTokenInput(e.target.value)}
                        className="w-full bg-[#0b0b10] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:border-[#d4a73c]/30"
                        placeholder="123456789:AAExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        autoComplete="new-password"
                      />
                    </div>
                    <div>
                      <label className="text-white/30 text-[10px] font-bold uppercase tracking-wider block mb-1">Chat ID Tujuan</label>
                      <input
                        type="text"
                        value={telegramChatIdInput}
                        onChange={(e) => setTelegramChatIdInput(e.target.value)}
                        className="w-full bg-[#0b0b10] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:border-[#d4a73c]/30"
                        placeholder="123456789"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={savingTelegramSettings}
                    className="bg-[#d4a73c] text-[#0b0b10] font-bold px-8 py-3 rounded-full hover:scale-105 transition-all text-sm disabled:opacity-50 disabled:hover:scale-100"
                  >
                    {savingTelegramSettings ? 'Menyimpan...' : 'Simpan Pengaturan Telegram'}
                  </button>
                </form>
              )}
            </div>

            {/* ===== BACKUP SEKARANG ===== */}
            <div className="bg-[#141419] border border-white/5 rounded-2xl p-5 md:p-6">
              <p className="text-[#d4a73c] text-[10px] font-bold uppercase tracking-wider mb-1">Backup Sekarang</p>

              {lastBackup ? (
                <p className="text-white/40 text-xs mb-4">
                  Backup terakhir: {lastBackup.success ? (
                    <span className="text-white/60">{lastBackup.totalKeys} key, dikirim {new Date(lastBackup.sentAt).toLocaleString('id-ID')}</span>
                  ) : (
                    <span className="text-red-400">gagal — {lastBackup.error} ({new Date(lastBackup.sentAt).toLocaleString('id-ID')})</span>
                  )}
                </p>
              ) : (
                <p className="text-white/40 text-xs mb-4">Belum pernah ada backup yang dikirim.</p>
              )}

              <button
                type="button"
                onClick={handleRunBackupNow}
                disabled={runningBackup || !telegramSettings.hasBotToken}
                className="bg-[#d4a73c] text-[#0b0b10] font-bold px-8 py-3 rounded-full hover:scale-105 transition-all text-sm disabled:opacity-50 disabled:hover:scale-100"
              >
                {runningBackup ? 'Membackup...' : 'Backup Sekarang & Kirim ke Telegram'}
              </button>
              {!telegramSettings.hasBotToken && (
                <p className="text-white/30 text-[11px] mt-2">Simpan bot token dulu di atas sebelum bisa backup.</p>
              )}
            </div>

            {/* ===== RESTORE DARI FILE ===== */}
            <div className="bg-[#141419] border border-red-500/10 rounded-2xl p-5 md:p-6">
              <p className="text-red-400 text-[10px] font-bold uppercase tracking-wider mb-1">Restore dari File Backup</p>
              <p className="text-white/40 text-xs mb-4">Upload file <code className="text-white/60 bg-white/5 px-1.5 py-0.5 rounded">.json</code> hasil backup (dari Telegram) untuk mengembalikan data. Tindakan ini menimpa key yang sama di database saat ini — pastikan file benar sebelum lanjut.</p>

              <input
                type="file"
                accept="application/json,.json"
                onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
                className="w-full bg-[#0b0b10] border border-white/10 rounded-lg px-4 py-2.5 text-white/70 text-xs outline-none file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:bg-[#d4a73c] file:text-[#0b0b10] file:text-xs file:font-bold mb-3"
              />

              <label className="flex items-center gap-2 mb-4 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={wipeBeforeRestore}
                  onChange={(e) => setWipeBeforeRestore(e.target.checked)}
                  className="w-4 h-4 accent-red-500"
                />
                <span className="text-white/50 text-xs">Hapus semua data yang ada sekarang dulu sebelum restore (bukan cuma menimpa)</span>
              </label>

              <button
                type="button"
                onClick={handleRestoreFromFile}
                disabled={restoring || !restoreFile}
                className="bg-red-500/90 text-white font-bold px-8 py-3 rounded-full hover:scale-105 transition-all text-sm disabled:opacity-50 disabled:hover:scale-100"
              >
                {restoring ? 'Merestore...' : 'Restore dari File'}
              </button>
            </div>

            {/* ===== DANGER ZONE: HAPUS SEMUA DATABASE ===== */}
            <div className="bg-red-500/[0.04] border-2 border-red-500/30 rounded-2xl p-5 md:p-6">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/>
                </svg>
                <p className="text-red-400 text-[10px] font-bold uppercase tracking-wider">Zona Berbahaya — Hapus Semua Database</p>
              </div>
              <p className="text-white/40 text-xs mb-4">
                Ini menghapus <span className="text-white font-bold">SELURUH</span> data Redis: semua akun user, clan, komentar, watchlist, history, level, semuanya — permanen, tidak bisa dibatalkan. Sistem akan coba kirim safety backup ke Telegram dulu (kalau sudah diatur di atas) sebelum benar-benar menghapus.
              </p>

              <label className="text-white/30 text-[10px] font-bold uppercase tracking-wider block mb-1">
                Ketik <span className="text-red-400">{WIPE_CONFIRM_PHRASE}</span> untuk mengaktifkan tombol
              </label>
              <input
                type="text"
                value={wipeConfirmText}
                onChange={(e) => setWipeConfirmText(e.target.value)}
                placeholder={WIPE_CONFIRM_PHRASE}
                className="w-full bg-[#0b0b10] border border-red-500/20 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:border-red-500/50 mb-4"
              />

              <button
                type="button"
                onClick={handleWipeAll}
                disabled={wipingAll || wipeConfirmText.trim() !== WIPE_CONFIRM_PHRASE}
                className="bg-red-600 text-white font-bold px-8 py-3 rounded-full hover:scale-105 transition-all text-sm disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed"
              >
                {wipingAll ? 'Menghapus Semua...' : 'Hapus Semua Database Sekarang'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ===== HAPUS SEMUA KECUALI YANG DIPILIH - MODAL KONFIRMASI ===== */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-[999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-[#141419] border border-red-500/30 rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/>
                </svg>
              </div>
              <div>
                <p className="text-red-400 text-[10px] font-bold uppercase tracking-wider">Tindakan Permanen</p>
                <h2 className="text-white font-black text-lg">Hapus User Massal</h2>
              </div>
            </div>

            <p className="text-white/60 text-sm mb-2">
              <span className="text-white font-bold">{Math.max(users.length - keepSelected.size - (user?.id && !keepSelected.has(user.id) ? 1 : 0), 0)} user</span> akan dihapus permanen.
              <span className="text-white font-bold"> {keepSelected.size + (user?.id && !keepSelected.has(user.id) ? 1 : 0)} user</span> akan tetap ada{user?.id && !keepSelected.has(user.id) ? ' (termasuk akun kamu sendiri, otomatis dipertahankan)' : ''}.
            </p>
            <p className="text-white/30 text-xs mb-5">Semua data user yang dihapus (history, level, komentar terkait) tidak bisa dikembalikan.</p>

            <label className="text-white/30 text-[10px] font-bold uppercase tracking-wider block mb-1.5">
              Ketik <span className="text-red-400">HAPUS SEMUA</span> untuk konfirmasi
            </label>
            <input
              type="text"
              autoFocus
              className="w-full bg-[#0b0b10] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:border-red-500/40 mb-5"
              value={bulkConfirmText}
              onChange={(e) => setBulkConfirmText(e.target.value)}
              placeholder="HAPUS SEMUA"
            />

            <div className="flex gap-3">
              <button
                type="button"
                disabled={bulkConfirmText.trim().toUpperCase() !== 'HAPUS SEMUA' || bulkDeleting}
                onClick={handleBulkDelete}
                className="flex-1 bg-red-500 text-white font-bold py-2.5 rounded-full hover:bg-red-600 transition-all text-sm disabled:opacity-30 disabled:hover:bg-red-500"
              >
                {bulkDeleting ? 'Menghapus...' : 'Hapus Sekarang'}
              </button>
              <button
                type="button"
                onClick={() => { setShowBulkDeleteModal(false); setBulkConfirmText(''); }}
                className="flex-1 bg-white/5 text-white/60 font-bold py-2.5 rounded-full hover:bg-white/10 transition-all text-sm"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== EDIT USER MODAL ===== */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 z-[999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-[#141419] border border-white/10 rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[#d4a73c] text-[10px] font-bold uppercase tracking-wider">Edit User</p>
                <h2 className="text-white font-black text-lg">{editingUser.name}</h2>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-white/30 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <label className="text-white/30 text-[10px] font-bold uppercase tracking-wider block mb-1">User ID Saat Ini</label>
                <input
                  type="text"
                  className="w-full bg-[#0b0b10] border border-white/10 rounded-lg px-4 py-2.5 text-white/30 text-xs font-mono cursor-not-allowed"
                  value={editingUser.id || ''}
                  disabled
                />
              </div>

              <div>
                <label className="text-[#d4a73c] text-[10px] font-bold uppercase tracking-wider block mb-1">
                  Ganti User ID <span className="text-white/25 font-normal normal-case">(opsional)</span>
                </label>
                <input
                  type="text"
                  className="w-full bg-[#0b0b10] border border-[#d4a73c]/20 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:border-[#d4a73c]/50 transition-all placeholder-white/10"
                  value={editForm.newUserId}
                  onChange={(e) => setEditForm({...editForm, newUserId: e.target.value})}
                  placeholder="Kosongkan untuk tetap"
                />
                <p className="text-[#d4a73c]/40 text-[10px] mt-1">
                  Mengubah ID akan memperbarui leaderboard, riwayat, dan status admin.
                </p>
              </div>

              <div>
                <label className="text-white/30 text-[10px] font-bold uppercase tracking-wider block mb-1">Nama</label>
                <input
                  type="text"
                  className="w-full bg-[#0b0b10] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:border-[#d4a73c]/30"
                  value={editForm.name}
                  onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="text-white/30 text-[10px] font-bold uppercase tracking-wider block mb-1">Email</label>
                <input
                  type="email"
                  className="w-full bg-[#0b0b10] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:border-[#d4a73c]/30"
                  value={editForm.email}
                  onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="text-white/30 text-[10px] font-bold uppercase tracking-wider block mb-1">URL Foto Profil</label>
                <input
                  type="url"
                  className="w-full bg-[#0b0b10] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:border-[#d4a73c]/30"
                  value={editForm.picture}
                  onChange={(e) => setEditForm({...editForm, picture: e.target.value})}
                  placeholder="https://example.com/avatar.jpg"
                />
                <p className="text-white/20 text-[10px] mt-1">Kosongkan untuk kembali ke avatar otomatis.</p>
              </div>
              <div>
                <label className="text-white/30 text-[10px] font-bold uppercase tracking-wider block mb-1">Password Baru (opsional)</label>
                <input
                  type="password"
                  className="w-full bg-[#0b0b10] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:border-[#d4a73c]/30"
                  value={editForm.password}
                  onChange={(e) => setEditForm({...editForm, password: e.target.value})}
                  placeholder="Kosongkan untuk tetap"
                  minLength={6}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/30 text-[10px] font-bold uppercase tracking-wider block mb-1">Level</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full bg-[#0b0b10] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:border-[#d4a73c]/30"
                    value={editForm.level}
                    onChange={(e) => setEditForm({...editForm, level: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="text-white/30 text-[10px] font-bold uppercase tracking-wider block mb-1">Title</label>
                  <input
                    type="text"
                    className="w-full bg-[#0b0b10] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:border-[#d4a73c]/30"
                    value={editForm.title}
                    onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                    required
                  />
                </div>
              </div>
              <label className="flex items-center gap-3 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-[#d4a73c]"
                  checked={editForm.isAdmin}
                  onChange={(e) => setEditForm({...editForm, isAdmin: e.target.checked})}
                />
                <span className="text-white/60 text-sm font-medium">Beri akses admin</span>
              </label>

              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 bg-[#d4a73c] text-[#0b0b10] font-bold py-2.5 rounded-full hover:scale-105 transition-all text-sm">
                  Simpan
                </button>
                <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 bg-white/5 text-white/60 font-bold py-2.5 rounded-full hover:bg-white/10 transition-all text-sm">
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== ADD USER MODAL ===== */}
      {showAddModal && (
        <div className="fixed inset-0 z-[999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-[#141419] border border-white/10 rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[#d4a73c] text-[10px] font-bold uppercase tracking-wider">User Baru</p>
                <h2 className="text-white font-black text-lg">Tambah User</h2>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-white/30 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="text-white/30 text-[10px] font-bold uppercase tracking-wider block mb-1">Nama *</label>
                <input
                  type="text"
                  className="w-full bg-[#0b0b10] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:border-[#d4a73c]/30"
                  value={addForm.name}
                  onChange={(e) => setAddForm({...addForm, name: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="text-white/30 text-[10px] font-bold uppercase tracking-wider block mb-1">Email *</label>
                <input
                  type="email"
                  className="w-full bg-[#0b0b10] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:border-[#d4a73c]/30"
                  value={addForm.email}
                  onChange={(e) => setAddForm({...addForm, email: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="text-white/30 text-[10px] font-bold uppercase tracking-wider block mb-1">Password *</label>
                <input
                  type="password"
                  className="w-full bg-[#0b0b10] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:border-[#d4a73c]/30"
                  value={addForm.password}
                  onChange={(e) => setAddForm({...addForm, password: e.target.value})}
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label className="text-white/30 text-[10px] font-bold uppercase tracking-wider block mb-1">URL Foto Profil</label>
                <input
                  type="url"
                  className="w-full bg-[#0b0b10] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:border-[#d4a73c]/30"
                  value={addForm.picture}
                  onChange={(e) => setAddForm({...addForm, picture: e.target.value})}
                  placeholder="https://example.com/avatar.jpg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/30 text-[10px] font-bold uppercase tracking-wider block mb-1">Level</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full bg-[#0b0b10] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:border-[#d4a73c]/30"
                    value={addForm.level}
                    onChange={(e) => setAddForm({...addForm, level: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-white/30 text-[10px] font-bold uppercase tracking-wider block mb-1">Title</label>
                  <input
                    type="text"
                    className="w-full bg-[#0b0b10] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:border-[#d4a73c]/30"
                    value={addForm.title}
                    onChange={(e) => setAddForm({...addForm, title: e.target.value})}
                    placeholder="Anime Newbie"
                  />
                </div>
              </div>
              <label className="flex items-center gap-3 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-[#d4a73c]"
                  checked={addForm.isAdmin}
                  onChange={(e) => setAddForm({...addForm, isAdmin: e.target.checked})}
                />
                <span className="text-white/60 text-sm font-medium">Beri akses admin</span>
              </label>

              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 bg-[#d4a73c] text-[#0b0b10] font-bold py-2.5 rounded-full hover:scale-105 transition-all text-sm">
                  Tambah
                </button>
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 bg-white/5 text-white/60 font-bold py-2.5 rounded-full hover:bg-white/10 transition-all text-sm">
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default Admin;
