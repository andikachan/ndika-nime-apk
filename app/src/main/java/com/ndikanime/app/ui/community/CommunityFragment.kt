package com.ndikanime.app.ui.community

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.android.material.button.MaterialButton
import com.google.android.material.tabs.TabLayout
import com.ndikanime.app.R
import com.ndikanime.app.data.api.ApiClient
import com.ndikanime.app.data.model.LoginRequest
import com.ndikanime.app.data.model.RegisterRequest
import com.ndikanime.app.data.model.SendChatRequest
import com.ndikanime.app.data.storage.AuthManager
import com.ndikanime.app.databinding.FragmentCommunityBinding
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

class CommunityFragment : Fragment() {

    private var _binding: FragmentCommunityBinding? = null
    private val binding get() = _binding!!

    private val authManager by lazy { AuthManager(requireContext()) }

    private val chatAdapter by lazy { ChatAdapter() }
    private val leaderboardAdapter by lazy { LeaderboardAdapter { /* user profile */ } }
    private val w2gAdapter by lazy { W2GAdapter { Toast.makeText(context, "Bergabung ke room ${it.animeTitle}", Toast.LENGTH_SHORT).show() } }

    private var currentTab = 0 // 0 = Chat, 1 = Leaderboard, 2 = W2G
    private var chatPollingJob: Job? = null

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View {
        _binding = FragmentCommunityBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupViews()
        updateAuthButton()
        loadTab(currentTab)
    }

    private fun setupViews() {
        binding.rvCommunity.layoutManager = LinearLayoutManager(requireContext())

        binding.tabCommunity.addOnTabSelectedListener(object : TabLayout.OnTabSelectedListener {
            override fun onTabSelected(tab: TabLayout.Tab?) {
                currentTab = tab?.position ?: 0
                loadTab(currentTab)
            }
            override fun onTabUnselected(tab: TabLayout.Tab?) {}
            override fun onTabReselected(tab: TabLayout.Tab?) {}
        })

        binding.swipeRefreshCommunity.setColorSchemeResources(R.color.accent_gold)
        binding.swipeRefreshCommunity.setOnRefreshListener {
            loadTab(currentTab)
        }

        binding.btnAccount.setOnClickListener {
            if (authManager.isLoggedIn) {
                showAccountMenu()
            } else {
                showAuthDialog()
            }
        }

        binding.btnSendChat.setOnClickListener {
            sendChat()
        }
    }

    private fun updateAuthButton() {
        if (authManager.isLoggedIn) {
            binding.btnAccount.text = authManager.userName
        } else {
            binding.btnAccount.text = "Masuk"
        }
    }

    private fun loadTab(tabIndex: Int) {
        chatPollingJob?.cancel()
        binding.tvEmptyCommunity.visibility = View.GONE

        when (tabIndex) {
            0 -> {
                binding.layoutChatInput.visibility = View.VISIBLE
                binding.rvCommunity.adapter = chatAdapter
                startChatPolling()
            }
            1 -> {
                binding.layoutChatInput.visibility = View.GONE
                binding.rvCommunity.adapter = leaderboardAdapter
                loadLeaderboard()
            }
            2 -> {
                binding.layoutChatInput.visibility = View.GONE
                binding.rvCommunity.adapter = w2gAdapter
                loadW2GRooms()
            }
        }
    }

    private fun startChatPolling() {
        chatPollingJob = viewLifecycleOwner.lifecycleScope.launch {
            while (isActive) {
                fetchChatMessages(silent = chatAdapter.itemCount > 0)
                delay(5000) // Poll chat every 5s
            }
        }
    }

    private suspend fun fetchChatMessages(silent: Boolean) {
        if (!silent) binding.pbCommunity.visibility = View.VISIBLE
        try {
            val res = ApiClient.community.getChatMessages(50)
            val list = res.messages ?: emptyList()
            chatAdapter.submitList(list)
            if (list.isNotEmpty() && !silent) {
                binding.rvCommunity.scrollToPosition(list.size - 1)
            }
        } catch (e: Exception) {
            // silent fail
        } finally {
            if (!silent) binding.pbCommunity.visibility = View.GONE
            binding.swipeRefreshCommunity.isRefreshing = false
        }
    }

    private fun sendChat() {
        val text = binding.etChatMessage.text.toString().trim()
        if (text.isEmpty()) return

        if (!authManager.isLoggedIn) {
            Toast.makeText(context, "Silakan login terlebih dahulu untuk mengirim pesan", Toast.LENGTH_SHORT).show()
            showAuthDialog()
            return
        }

        binding.etChatMessage.setText("")
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                ApiClient.community.sendChatMessage(SendChatRequest(message = text))
                fetchChatMessages(silent = true)
            } catch (e: Exception) {
                Toast.makeText(context, "Gagal mengirim pesan: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun loadLeaderboard() {
        binding.pbCommunity.visibility = View.VISIBLE
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val res = ApiClient.community.getLeaderboard()
                val users = res.users ?: emptyList()
                leaderboardAdapter.submitList(users)
                if (users.isEmpty()) {
                    binding.tvEmptyCommunity.visibility = View.VISIBLE
                    binding.tvEmptyCommunity.text = "Belum ada data leaderboard"
                }
            } catch (e: Exception) {
                if (isAdded) {
                    Toast.makeText(context, "Gagal memuat leaderboard: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
                }
            } finally {
                binding.pbCommunity.visibility = View.GONE
                binding.swipeRefreshCommunity.isRefreshing = false
            }
        }
    }

    private fun loadW2GRooms() {
        binding.pbCommunity.visibility = View.VISIBLE
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val res = ApiClient.community.getW2GRooms()
                val rooms = res.rooms ?: emptyList()
                w2gAdapter.submitList(rooms)
                if (rooms.isEmpty()) {
                    binding.tvEmptyCommunity.visibility = View.VISIBLE
                    binding.tvEmptyCommunity.text = "Tidak ada room Watch Together yang aktif"
                }
            } catch (e: Exception) {
                if (isAdded) {
                    Toast.makeText(context, "Gagal memuat room: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
                }
            } finally {
                binding.pbCommunity.visibility = View.GONE
                binding.swipeRefreshCommunity.isRefreshing = false
            }
        }
    }

    private fun showAccountMenu() {
        AlertDialog.Builder(requireContext())
            .setTitle("Akun Saya")
            .setMessage("Login sebagai: ${authManager.userName}")
            .setPositiveButton("Logout") { _, _ ->
                authManager.logout()
                updateAuthButton()
                Toast.makeText(context, "Berhasil keluar", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("Tutup", null)
            .show()
    }

    private fun showAuthDialog() {
        val dialogView = LayoutInflater.from(requireContext()).inflate(R.layout.dialog_auth, null)
        val tabAuth = dialogView.findViewById<TabLayout>(R.id.tabAuth)
        val etName = dialogView.findViewById<EditText>(R.id.etName)
        val etEmail = dialogView.findViewById<EditText>(R.id.etEmail)
        val etPassword = dialogView.findViewById<EditText>(R.id.etPassword)
        val btnSubmit = dialogView.findViewById<MaterialButton>(R.id.btnSubmitAuth)
        val pbAuth = dialogView.findViewById<ProgressBar>(R.id.pbAuth)

        var isRegister = false

        val dialog = AlertDialog.Builder(requireContext())
            .setView(dialogView)
            .create()

        tabAuth.addOnTabSelectedListener(object : TabLayout.OnTabSelectedListener {
            override fun onTabSelected(tab: TabLayout.Tab?) {
                isRegister = (tab?.position == 1)
                etName.visibility = if (isRegister) View.VISIBLE else View.GONE
                btnSubmit.text = if (isRegister) "Daftar Sekarang" else "Masuk Sekarang"
            }
            override fun onTabUnselected(tab: TabLayout.Tab?) {}
            override fun onTabReselected(tab: TabLayout.Tab?) {}
        })

        btnSubmit.setOnClickListener {
            val email = etEmail.text.toString().trim()
            val pass = etPassword.text.toString().trim()
            val name = etName.text.toString().trim()

            if (email.isEmpty() || pass.isEmpty() || (isRegister && name.isEmpty())) {
                Toast.makeText(context, "Mohon lengkapi semua data", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            pbAuth.visibility = View.VISIBLE
            btnSubmit.isEnabled = false

            viewLifecycleOwner.lifecycleScope.launch {
                try {
                    val res = if (isRegister) {
                        ApiClient.community.register(RegisterRequest(name, email, pass))
                    } else {
                        ApiClient.community.login(LoginRequest(email, pass))
                    }

                    if (res.success && !res.token.isNullOrBlank()) {
                        authManager.saveUserSession(res.token, res.user)
                        updateAuthButton()
                        dialog.dismiss()
                        Toast.makeText(context, "Selamat datang, ${authManager.userName}!", Toast.LENGTH_SHORT).show()
                    } else {
                        Toast.makeText(context, res.error ?: res.message ?: "Autentikasi gagal", Toast.LENGTH_SHORT).show()
                    }
                } catch (e: Exception) {
                    Toast.makeText(context, "Gagal terhubung: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
                } finally {
                    pbAuth.visibility = View.GONE
                    btnSubmit.isEnabled = true
                }
            }
        }

        dialog.show()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        chatPollingJob?.cancel()
        _binding = null
    }
}
