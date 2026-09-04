# Ndika Nime - Native Android Anime & Manga App (Full Kotlin)

Aplikasi streaming anime dan baca manga berbasis **100% Native Android (Kotlin)**.
> **Bukan WebView** dan **Bukan React Native / Hybrid**. Seluruh UI, video streaming, manga reader, caching gambar, dan penyimpanan riwayat dibuat murni menggunakan komponen native Android & Android Jetpack.

---

## 🚀 Fitur Utama

### 🎬 Streaming Anime (Native Media3 ExoPlayer)
- **Pemutar Video Native**: Menggunakan `androidx.media3:media3-exoplayer` (ExoPlayer).
- **Pilihan Kualitas / Resolusi**: Otomatis atau manual (1080p, 720p, 480p, 360p).
- **Fitur Tahan Layar untuk 2x Speed**: Tekan dan tahan layar video untuk mempercepat putaran video menjadi 2x.
- **Navigasi Episode Cepat**: Tombol episode berikutnya otomatis atau manual.
- **Rewind / Fast-Forward**: Lompat 10 detik maju / mundur.
- **Mode Layar Penuh (Fullscreen)**: Rotasi dinamis portrait dan landscape.
- **Lanjut Nonton (Resume Progress)**: Menyimpan detik terakhir tontonan secara otomatis.

### 📖 Pembaca Komik / Manga (Native Vertical Reader)
- **Continuous Smooth Scroll**: Membaca komik secara vertikal dengan `RecyclerView` berkecepatan 60/120fps.
- **Pemuatan Gambar Cepat & Cache**: Menggunakan Coil ImageLoader dengan disk cache otomatis.
- **Navigasi Chapter**: Tombol Chapter Sebelumnya dan Chapter Berikutnya.
- **Indikator Halaman Realtime**: Menampilkan posisi halaman yang sedang dibaca.

### 🔍 Jelajah & Pencarian Cepat
- Pencarian anime & manga secara realtime dengan debounce.
- Filter berdasarkan genre (Action, Romance, Fantasy, Isekai, Shounen, dll).
- Jadwal rilis harian (Senin - Minggu).

### 📚 Koleksi & Riwayat (Offline Local Storage)
- **Riwayat Tonton**: Daftar anime dan episode yang terakhir ditonton.
- **Riwayat Baca**: Daftar komik dan chapter terakhir dibaca.
- **Favorit / Bookmark**: Simpan anime dan manga favorit kamu.

---

## 🛠️ Arsitektur & Teknologi

- **Bahasa**: Kotlin (100% Native)
- **Minimum SDK**: Android 7.0 (API 24)
- **Target SDK**: Android 14 (API 34)
- **UI Architecture**: Material Design 3, ViewBinding, CoordinatorLayout, NestedScrollView, TabLayout
- **Networking**: Retrofit 2, OkHttp 3, Gson
- **Video Engine**: AndroidX Media3 ExoPlayer 1.2.1
- **Image Loader**: Coil-kt 2.6.0
- **Build System**: Gradle 8.5, Android Gradle Plugin 8.2.2, JDK 17
- **CI/CD**: GitHub Actions (`.github/workflows/build-apk.yml`)

---

## 📦 Cara Build APK Otomatis di GitHub

Proyek ini telah dikonfigurasi dengan **GitHub Actions Workflow** (`.github/workflows/build-apk.yml`). Anda tidak perlu menginstall Android Studio atau Gradle di HP/laptop Anda.

### Langkah-langkah:
1. **Buat Repository Baru di GitHub**:
   - Buka [GitHub](https://github.com/new) dan buat repositori baru (misalnya `ndika-nime-android`).
2. **Push kode ini ke GitHub**:
   ```bash
   git add .
   git commit -m "feat: full native kotlin android app with github actions apk builder"
   git branch -M main
   git remote add origin https://github.com/<username-kamu>/<repo-kamu>.git
   git push -u origin main
   ```
3. **Download APK dari GitHub Actions**:
   - Buka tab **Actions** di repositori GitHub kamu.
   - Klik workflow build yang sedang berjalan (**Build Native Android APK**).
   - Setelah selesai (sekitar 1–3 menit), scroll ke bagian **Artifacts**.
   - Download file **`NdikaNime-debug-apk`** (berisi file APK siap install di HP Android kamu!).

4. **Buat Release Resmi (Opsional)**:
   - Jika membuat tag git baru seperti `v1.0.0`:
     ```bash
     git tag v1.0.0
     git push origin v1.0.0
     ```
   - GitHub Actions akan otomatis membuat **GitHub Release** dengan file `.apk` siap download langsung!

---

## 💻 Cara Build Manual / Lokal (Jika Menggunakan Laptop / Android Studio)

```bash
# Untuk Linux / Mac / Termux:
./gradlew assembleDebug

# Untuk Windows CMD / PowerShell:
gradlew.bat assembleDebug
```
File APK akan otomatis ter-generate di:
`app/build/outputs/apk/debug/app-debug.apk`
