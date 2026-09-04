package com.ndikanime.app.ui.community

import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import coil.load
import com.ndikanime.app.R
import com.ndikanime.app.data.model.UserProfile
import com.ndikanime.app.data.storage.AuthManager
import com.ndikanime.app.data.upstash.UpstashRepository
import com.ndikanime.app.databinding.ActivityDmChatBinding
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

class DMChatActivity : AppCompatActivity() {

    private lateinit var binding: ActivityDmChatBinding
    private val authManager by lazy { AuthManager(this) }

    private var otherUserId: String = ""
    private var otherUserName: String = ""
    private var otherUserAvatar: String? = null
    private var convId: String = ""

    private val chatAdapter by lazy { DMChatAdapter(authManager.userId ?: "") }
    private var pollingJob: Job? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityDmChatBinding.inflate(layoutInflater)
        setContentView(binding.root)

        otherUserId = intent.getStringExtra("user_id") ?: ""
        otherUserName = intent.getStringExtra("user_name") ?: "Pengguna"
        otherUserAvatar = intent.getStringExtra("user_avatar")

        val myId = authManager.userId ?: ""
        if (otherUserId.isBlank() || myId.isBlank()) {
            Toast.makeText(this, "Data percakapan tidak valid", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        convId = listOf(myId, otherUserId).sorted().joinToString("_")

        setupViews()
        loadMessages()
        startPolling()
    }

    private fun setupViews() {
        binding.btnBackDM.setOnClickListener { finish() }
        binding.tvPartnerName.text = otherUserName

        if (!otherUserAvatar.isNullOrBlank()) {
            binding.ivPartnerAvatar.load(otherUserAvatar) { crossfade(true) }
        } else {
            binding.ivPartnerAvatar.setImageResource(R.drawable.kaguya)
        }

        binding.rvDMMessages.layoutManager = LinearLayoutManager(this).apply {
            stackFromEnd = true
        }
        binding.rvDMMessages.adapter = chatAdapter

        binding.btnSendDM.setOnClickListener {
            sendDM()
        }
    }

    private fun loadMessages() {
        binding.pbDMLoading.visibility = View.VISIBLE
        lifecycleScope.launch {
            try {
                val list = UpstashRepository.getDMMessages(convId)
                chatAdapter.submitList(list)
                if (list.isNotEmpty()) {
                    binding.rvDMMessages.scrollToPosition(list.size - 1)
                }
            } catch (e: Exception) {
                // error
            } finally {
                binding.pbDMLoading.visibility = View.GONE
            }
        }
    }

    private fun startPolling() {
        pollingJob = lifecycleScope.launch {
            while (isActive) {
                delay(3000)
                try {
                    val list = UpstashRepository.getDMMessages(convId)
                    chatAdapter.submitList(list)
                } catch (e: Exception) {}
            }
        }
    }

    private fun sendDM() {
        val text = binding.etDMInput.text.toString().trim()
        if (text.isBlank()) return

        val sender = authManager.getUserProfile() ?: UserProfile(
            id = authManager.userId ?: "",
            name = authManager.userName ?: "User",
            picture = authManager.userAvatar
        )

        binding.etDMInput.setText("")

        lifecycleScope.launch {
            try {
                UpstashRepository.sendDM(sender, otherUserId, text)
                val list = UpstashRepository.getDMMessages(convId)
                chatAdapter.submitList(list)
                if (list.isNotEmpty()) {
                    binding.rvDMMessages.scrollToPosition(list.size - 1)
                }
            } catch (e: Exception) {
                Toast.makeText(this@DMChatActivity, "Gagal mengirim pesan", Toast.LENGTH_SHORT).show()
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        pollingJob?.cancel()
    }
}
