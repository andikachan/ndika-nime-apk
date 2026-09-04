package com.ndikanime.app.ui.profile

import android.graphics.Color
import android.os.Bundle
import android.view.View
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import coil.load
import com.ndikanime.app.R
import com.ndikanime.app.data.model.UserProfile
import com.ndikanime.app.data.storage.AuthManager
import com.ndikanime.app.data.storage.HistoryStorage
import com.ndikanime.app.data.upstash.UpstashRepository
import com.ndikanime.app.databinding.ActivityProfileBinding
import kotlinx.coroutines.launch

class ProfileActivity : AppCompatActivity() {

    private lateinit var binding: ActivityProfileBinding
    private val authManager by lazy { AuthManager(this) }
    private val historyStorage by lazy { HistoryStorage(this) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityProfileBinding.inflate(layoutInflater)
        setContentView(binding.root)

        if (!authManager.isLoggedIn) {
            Toast.makeText(this, "Silakan login terlebih dahulu", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        setupViews()
        loadLocalProfile()
        fetchRemoteProfile()
    }

    private fun setupViews() {
        binding.btnBackProfile.setOnClickListener { finish() }

        binding.btnEditBio.setOnClickListener {
            showEditBioDialog()
        }

        binding.ivProfileAvatar.setOnClickListener {
            showEditAvatarDialog()
        }

        binding.tvProfileName.setOnClickListener {
            showEditNameDialog()
        }

        binding.ivProfileBanner.setOnClickListener {
            showEditBannerDialog()
        }

        binding.tvProfileLevel.setOnClickListener {
            showFramePicker()
        }

        binding.tvProfileTitle.setOnClickListener {
            showAuraPicker()
        }

        binding.btnProfileLogout.setOnClickListener {
            AlertDialog.Builder(this)
                .setTitle("Keluar dari Akun?")
                .setMessage("Apakah kamu yakin ingin logout?")
                .setPositiveButton("Logout") { _, _ ->
                    authManager.logout()
                    Toast.makeText(this, "Berhasil keluar", Toast.LENGTH_SHORT).show()
                    finish()
                }
                .setNegativeButton("Batal", null)
                .show()
        }
    }

    private fun loadLocalProfile() {
        val user = authManager.getUserProfile() ?: return
        bindUserData(user)
    }

    private fun fetchRemoteProfile() {
        val uid = authManager.userId ?: return
        lifecycleScope.launch {
            try {
                val user = UpstashRepository.getProfile(uid)
                if (user != null) {
                    authManager.saveUserProfile(user)
                    bindUserData(user)
                }
            } catch (e: Exception) {
                // Keep local cache on network issue
            }
        }
    }

    private fun bindUserData(user: UserProfile) {
        binding.tvProfileName.text = user.name
        binding.tvProfileEmail.text = user.email ?: ""
        binding.tvProfileLevel.text = "Level ${user.level} (Ganti Frame)"
        binding.tvProfileTitle.text = "${user.title ?: "Anime Newbie"} (Ganti Aura)"
        binding.tvProfileBio.text = if (!user.bio.isNullOrBlank()) user.bio else "Wibu penikmat anime & manga di Ndichan."
        binding.tvProfileAdminBadge.visibility = if (user.isAdmin) View.VISIBLE else View.GONE

        binding.tvStatWatchTime.text = user.getFormattedWatchTime()
        binding.tvStatCoins.text = "${user.coins} Koin"
        binding.tvStatAnimeHistory.text = "${historyStorage.getAnimeHistory().size} Judul"
        binding.tvStatMangaHistory.text = "${historyStorage.getMangaHistory().size} Judul"

        val avatar = user.picture
        if (!avatar.isNullOrBlank()) {
            binding.ivProfileAvatar.load(avatar) { crossfade(true) }
        } else {
            binding.ivProfileAvatar.setImageResource(R.drawable.kaguya)
        }

        // Apply Frame stroke color
        when (user.frame) {
            "bronze" -> binding.ivProfileAvatar.strokeColor = android.content.res.ColorStateList.valueOf(Color.parseColor("#CD7F32"))
            "silver" -> binding.ivProfileAvatar.strokeColor = android.content.res.ColorStateList.valueOf(Color.parseColor("#C0C0C0"))
            "gold" -> binding.ivProfileAvatar.strokeColor = android.content.res.ColorStateList.valueOf(Color.parseColor("#FFD700"))
            "fire" -> binding.ivProfileAvatar.strokeColor = android.content.res.ColorStateList.valueOf(Color.parseColor("#FF4500"))
            "platinum" -> binding.ivProfileAvatar.strokeColor = android.content.res.ColorStateList.valueOf(Color.parseColor("#E5E4E2"))
            "rainbow" -> binding.ivProfileAvatar.strokeColor = android.content.res.ColorStateList.valueOf(Color.parseColor("#FF1493"))
            else -> binding.ivProfileAvatar.strokeColor = android.content.res.ColorStateList.valueOf(Color.parseColor("#D4A73C"))
        }
    }

    private fun showEditBioDialog() {
        val input = EditText(this).apply {
            setText(authManager.userBio ?: "")
            hint = "Tulis bio singkat..."
            setPadding(40, 30, 40, 30)
        }

        AlertDialog.Builder(this)
            .setTitle("Ubah Bio")
            .setView(input)
            .setPositiveButton("Simpan") { _, _ ->
                val newBio = input.text.toString().trim()
                authManager.userBio = newBio
                binding.tvProfileBio.text = if (newBio.isNotBlank()) newBio else "Wibu penikmat anime & manga di Ndichan."
                val uid = authManager.userId ?: return@setPositiveButton
                lifecycleScope.launch {
                    try {
                        val updated = UpstashRepository.updateProfile(uid, bio = newBio)
                        if (updated != null) {
                            authManager.saveUserProfile(updated)
                            bindUserData(updated)
                        }
                    } catch (e: Exception) {}
                }
                Toast.makeText(this, "Bio diperbarui!", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("Batal", null)
            .show()
    }

    private fun showEditNameDialog() {
        val input = EditText(this).apply {
            setText(authManager.userName ?: "")
            hint = "Nama tampilan baru..."
            setPadding(40, 30, 40, 30)
        }

        AlertDialog.Builder(this)
            .setTitle("Ubah Nama")
            .setView(input)
            .setPositiveButton("Simpan") { _, _ ->
                val newName = input.text.toString().trim()
                if (newName.isBlank()) return@setPositiveButton
                authManager.userName = newName
                binding.tvProfileName.text = newName
                val uid = authManager.userId ?: return@setPositiveButton
                lifecycleScope.launch {
                    try {
                        val updated = UpstashRepository.updateProfile(uid, name = newName)
                        if (updated != null) {
                            authManager.saveUserProfile(updated)
                            bindUserData(updated)
                        }
                    } catch (e: Exception) {}
                }
                Toast.makeText(this, "Nama diperbarui!", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("Batal", null)
            .show()
    }

    private fun showEditAvatarDialog() {
        val input = EditText(this).apply {
            setText(authManager.userAvatar ?: "")
            hint = "URL gambar avatar (https://...)"
            setPadding(40, 30, 40, 30)
        }

        AlertDialog.Builder(this)
            .setTitle("Ubah Foto Profil")
            .setView(input)
            .setPositiveButton("Simpan") { _, _ ->
                val newAvatar = input.text.toString().trim()
                if (newAvatar.isBlank() || !newAvatar.startsWith("http")) {
                    Toast.makeText(this, "URL gambar tidak valid (harus https://...)", Toast.LENGTH_SHORT).show()
                    return@setPositiveButton
                }
                authManager.userAvatar = newAvatar
                binding.ivProfileAvatar.load(newAvatar) { crossfade(true) }
                val uid = authManager.userId ?: return@setPositiveButton
                lifecycleScope.launch {
                    try {
                        val updated = UpstashRepository.updateProfile(uid, picture = newAvatar)
                        if (updated != null) {
                            authManager.saveUserProfile(updated)
                            bindUserData(updated)
                        }
                    } catch (e: Exception) {}
                }
                Toast.makeText(this, "Avatar diperbarui!", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("Batal", null)
            .show()
    }

    private fun showEditBannerDialog() {
        val input = EditText(this).apply {
            hint = "URL banner profil (https://...)"
            setPadding(40, 30, 40, 30)
        }

        AlertDialog.Builder(this)
            .setTitle("Ubah Banner Profil")
            .setView(input)
            .setPositiveButton("Simpan") { _, _ ->
                val newBanner = input.text.toString().trim()
                if (newBanner.isNotBlank() && newBanner.startsWith("http")) {
                    binding.ivProfileBanner.load(newBanner) { crossfade(true) }
                    val uid = authManager.userId ?: return@setPositiveButton
                    lifecycleScope.launch {
                        try {
                            UpstashRepository.updateProfile(uid, banner = newBanner)
                        } catch (e: Exception) {}
                    }
                    Toast.makeText(this, "Banner diperbarui!", Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton("Batal", null)
            .show()
    }

    private fun showFramePicker() {
        val user = authManager.getUserProfile() ?: return
        val frames = listOf(
            "none" to "Standard (Level 0)",
            "bronze" to "Perunggu (Level 5+)",
            "silver" to "Perak (Level 15+)",
            "gold" to "Emas (Level 30+)",
            "fire" to "Api Membara (Level 50+)",
            "platinum" to "Platinum (Level 75+)",
            "rainbow" to "Pelangi (Level 150+)"
        )
        val frameReqs = mapOf("none" to 0, "bronze" to 5, "silver" to 15, "gold" to 30, "fire" to 50, "platinum" to 75, "rainbow" to 150)
        val names = frames.map { it.second }.toTypedArray()

        AlertDialog.Builder(this)
            .setTitle("Pilih Bingkai Avatar")
            .setItems(names) { _, which ->
                val chosenId = frames[which].first
                val req = frameReqs[chosenId] ?: 0
                if (user.level < req) {
                    Toast.makeText(this, "Level kamu belum cukup (butuh Level $req)", Toast.LENGTH_SHORT).show()
                    return@setItems
                }
                lifecycleScope.launch {
                    try {
                        val updated = UpstashRepository.updateProfile(user.id, frame = chosenId)
                        if (updated != null) {
                            authManager.saveUserProfile(updated)
                            bindUserData(updated)
                            Toast.makeText(this@ProfileActivity, "Bingkai berhasil dipasang!", Toast.LENGTH_SHORT).show()
                        }
                    } catch (e: Exception) {}
                }
            }
            .show()
    }

    private fun showAuraPicker() {
        val user = authManager.getUserProfile() ?: return
        val auras = listOf(
            "none" to "Tanpa Aura (Level 0)",
            "supersaiyan" to "Super Saiyan (Level 10+)",
            "shadowneon" to "Shadow Neon (Level 25+)",
            "cursedflame" to "Cursed Flame (Level 45+)"
        )
        val auraReqs = mapOf("none" to 0, "supersaiyan" to 10, "shadowneon" to 25, "cursedflame" to 45)
        val names = auras.map { it.second }.toTypedArray()

        AlertDialog.Builder(this)
            .setTitle("Pilih Efek Aura")
            .setItems(names) { _, which ->
                val chosenId = auras[which].first
                val req = auraReqs[chosenId] ?: 0
                if (user.level < req) {
                    Toast.makeText(this, "Level kamu belum cukup (butuh Level $req)", Toast.LENGTH_SHORT).show()
                    return@setItems
                }
                lifecycleScope.launch {
                    try {
                        val updated = UpstashRepository.updateProfile(user.id, aura = chosenId)
                        if (updated != null) {
                            authManager.saveUserProfile(updated)
                            bindUserData(updated)
                            Toast.makeText(this@ProfileActivity, "Aura berhasil dipasang!", Toast.LENGTH_SHORT).show()
                        }
                    } catch (e: Exception) {}
                }
            }
            .show()
    }
}
