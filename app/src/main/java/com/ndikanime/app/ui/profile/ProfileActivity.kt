package com.ndikanime.app.ui.profile

import android.os.Bundle
import android.view.View
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import coil.load
import com.ndikanime.app.R
import com.ndikanime.app.data.api.ApiClient
import com.ndikanime.app.data.model.UserProfile
import com.ndikanime.app.data.storage.AuthManager
import com.ndikanime.app.data.storage.HistoryStorage
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
        lifecycleScope.launch {
            try {
                val res = ApiClient.community.getMe()
                val user = res.user
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
        binding.tvProfileLevel.text = "Level ${user.level}"
        binding.tvProfileTitle.text = user.title ?: "Anime Newbie"
        binding.tvProfileBio.text = if (!user.bio.isNullOrBlank()) user.bio else "Wibu penikmat anime & manga di Ndichan."
        binding.tvProfileAdminBadge.visibility = if (user.isAdmin) View.VISIBLE else View.GONE

        binding.tvStatWatchTime.text = user.getFormattedWatchTime()
        binding.tvStatCoins.text = "${user.coins} Koin"
        binding.tvStatAnimeHistory.text = "${historyStorage.getAnimeHistory().size} Judul"
        binding.tvStatMangaHistory.text = "${historyStorage.getMangaHistory().size} Judul"

        val avatar = user.picture
        if (!avatar.isNullOrBlank()) {
            val url = if (avatar.startsWith("/")) "https://ndichan.xyz$avatar" else avatar
            binding.ivProfileAvatar.load(url) { crossfade(true) }
        } else {
            binding.ivProfileAvatar.setImageResource(R.drawable.kaguya)
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
                lifecycleScope.launch {
                    try {
                        val res = ApiClient.community.updateProfile(mapOf("bio" to newBio))
                        if (res.success && res.user != null) {
                            authManager.saveUserProfile(res.user)
                            bindUserData(res.user)
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
                lifecycleScope.launch {
                    try {
                        val res = ApiClient.community.updateProfile(mapOf("name" to newName))
                        if (res.success && res.user != null) {
                            authManager.saveUserProfile(res.user)
                            bindUserData(res.user)
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
                lifecycleScope.launch {
                    try {
                        val res = ApiClient.community.updateProfile(mapOf("picture" to newAvatar))
                        if (res.success && res.user != null) {
                            authManager.saveUserProfile(res.user)
                            bindUserData(res.user)
                        }
                    } catch (e: Exception) {}
                }
                Toast.makeText(this, "Avatar diperbarui!", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("Batal", null)
            .show()
    }
}
