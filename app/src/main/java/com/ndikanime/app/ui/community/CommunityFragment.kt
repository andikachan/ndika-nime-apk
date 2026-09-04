package com.ndikanime.app.ui.community

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import android.widget.EditText
import android.widget.ImageView
import android.widget.ProgressBar
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import coil.load
import com.google.android.material.button.MaterialButton
import com.google.android.material.tabs.TabLayout
import com.ndikanime.app.R
import com.ndikanime.app.data.api.ApiClient
import com.ndikanime.app.data.model.*
import com.ndikanime.app.data.storage.AuthManager
import com.ndikanime.app.databinding.FragmentCommunityBinding
import com.ndikanime.app.ui.profile.ProfileActivity
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
    private val w2gAdapter by lazy {
        W2GAdapter { room ->
            joinW2GRoom(room)
        }
    }

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

    override fun onResume() {
        super.onResume()
        updateAuthButton()
        if (currentTab == 2) {
            loadW2GRooms()
        }
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
                val intent = Intent(requireContext(), ProfileActivity::class.java)
                startActivity(intent)
            } else {
                showAuthDialog()
            }
        }

        binding.btnSendChat.setOnClickListener {
            sendChat()
        }

        binding.btnCreateW2G.setOnClickListener {
            showCreateW2GRoomDialog()
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
        binding.btnCreateW2G.visibility = if (tabIndex == 2) View.VISIBLE else View.GONE

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

    private fun joinW2GRoom(room: W2GRoom) {
        val roomId = room.getEffectiveId()
        if (roomId.isBlank()) return

        if (room.hasPasscode) {
            val input = EditText(requireContext()).apply {
                hint = "Masukkan passcode..."
                inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD
                setPadding(40, 30, 40, 30)
            }
            AlertDialog.Builder(requireContext())
                .setTitle("Passcode Room")
                .setMessage("Room ini dilindungi dengan passcode:")
                .setView(input)
                .setPositiveButton("Masuk") { _, _ ->
                    val code = input.text.toString().trim()
                    launchW2GRoom(roomId, code)
                }
                .setNegativeButton("Batal", null)
                .show()
        } else {
            launchW2GRoom(roomId, "")
        }
    }

    private fun launchW2GRoom(roomId: String, passcode: String) {
        val intent = Intent(requireContext(), W2GRoomActivity::class.java).apply {
            putExtra("room_id", roomId)
            putExtra("passcode", passcode)
        }
        startActivity(intent)
    }

    private fun showCreateW2GRoomDialog() {
        val dialogView = LayoutInflater.from(requireContext()).inflate(R.layout.dialog_create_w2g, null)
        val etTitle = dialogView.findViewById<EditText>(R.id.etCreateRoomTitle)
        val etSearch = dialogView.findViewById<EditText>(R.id.etSearchAnimeW2G)
        val btnSearch = dialogView.findViewById<MaterialButton>(R.id.btnSearchAnimeW2G)
        val rvResults = dialogView.findViewById<RecyclerView>(R.id.rvAnimeSearchResults)
        val layoutSelected = dialogView.findViewById<View>(R.id.layoutSelectedAnime)
        val ivPoster = dialogView.findViewById<ImageView>(R.id.ivSelectedAnimePoster)
        val tvSelectedTitle = dialogView.findViewById<TextView>(R.id.tvSelectedAnimeTitle)
        val tvEpCount = dialogView.findViewById<TextView>(R.id.tvSelectedAnimeEpisodesCount)
        val spEpisode = dialogView.findViewById<Spinner>(R.id.spEpisodeW2G)
        val etPasscode = dialogView.findViewById<EditText>(R.id.etCreateRoomPasscode)
        val btnCancel = dialogView.findViewById<MaterialButton>(R.id.btnCancelCreateRoom)
        val btnSubmit = dialogView.findViewById<MaterialButton>(R.id.btnSubmitCreateRoom)
        val pbCreate = dialogView.findViewById<ProgressBar>(R.id.pbCreateRoom)

        var selectedAnime: AnimeItem? = null
        var episodeList: List<EpisodeItem> = emptyList()

        val dialog = AlertDialog.Builder(requireContext())
            .setView(dialogView)
            .create()

        val pickerAdapter = SearchAnimePickerAdapter { anime ->
            selectedAnime = anime
            tvSelectedTitle.text = anime.title ?: "Anime"
            val poster = anime.imagePoster ?: anime.imageCover ?: anime.cover ?: ""
            if (poster.isNotBlank()) {
                val url = if (poster.startsWith("http")) {
                    "https://cfelainawanggy.pages.dev/?action=proxy&url=" + java.net.URLEncoder.encode(poster, "UTF-8")
                } else poster
                ivPoster.load(url) { crossfade(true) }
            }
            layoutSelected.visibility = View.VISIBLE
            rvResults.visibility = View.GONE

            viewLifecycleOwner.lifecycleScope.launch {
                try {
                    val res = ApiClient.service.getAnimeDetail(anime.id ?: "")
                    episodeList = res.data?.episodeList ?: emptyList()
                    tvEpCount.text = "${episodeList.size} Episode Tersedia"

                    val episodeTitles = episodeList.map { it.title ?: "Episode ${it.index ?: ""}" }
                    val spinnerAdapter = ArrayAdapter(
                        requireContext(),
                        android.R.layout.simple_spinner_dropdown_item,
                        episodeTitles
                    )
                    spEpisode.adapter = spinnerAdapter
                } catch (e: Exception) {
                    Toast.makeText(context, "Gagal memuat episode anime", Toast.LENGTH_SHORT).show()
                }
            }
        }

        rvResults.layoutManager = LinearLayoutManager(requireContext())
        rvResults.adapter = pickerAdapter

        btnSearch.setOnClickListener {
            val q = etSearch.text.toString().trim()
            if (q.length < 2) return@setOnClickListener
            viewLifecycleOwner.lifecycleScope.launch {
                try {
                    val res = ApiClient.service.searchAnime(q, 0)
                    val list = res.data ?: emptyList()
                    pickerAdapter.submitList(list)
                    rvResults.visibility = if (list.isNotEmpty()) View.VISIBLE else View.GONE
                } catch (e: Exception) {
                    Toast.makeText(context, "Gagal mencari anime", Toast.LENGTH_SHORT).show()
                }
            }
        }

        btnCancel.setOnClickListener { dialog.dismiss() }

        btnSubmit.setOnClickListener {
            val title = etTitle.text.toString().trim()
            if (title.isBlank()) {
                Toast.makeText(context, "Nama room tidak boleh kosong", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            if (selectedAnime == null || episodeList.isEmpty()) {
                Toast.makeText(context, "Pilih anime dan episode terlebih dahulu", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            val selectedEpIndex = spEpisode.selectedItemPosition.coerceAtLeast(0)
            val selectedEpisode = episodeList.getOrNull(selectedEpIndex) ?: episodeList.first()

            pbCreate.visibility = View.VISIBLE
            btnSubmit.isEnabled = false

            viewLifecycleOwner.lifecycleScope.launch {
                try {
                    var videoUrl = ""
                    try {
                        val epDetail = ApiClient.service.getEpisodeDetail(selectedEpisode.id ?: "")
                        val servers = (epDetail.data?.server ?: emptyList()).filter { s ->
                            !s.link.isNullOrBlank() && s.type == "direct"
                        }
                        val best = servers.find { it.quality == "720p" } ?: servers.firstOrNull()
                        if (best?.link != null) {
                            videoUrl = "https://cfelainawanggy.pages.dev/?action=stream&url=${best.link}"
                        }
                    } catch (e: Exception) {}

                    val passcode = etPasscode.text.toString().trim()
                    val req = CreateW2GRoomRequest(
                        title = title,
                        animeId = selectedAnime?.id,
                        animeTitle = selectedAnime?.title,
                        animePoster = selectedAnime?.imagePoster ?: selectedAnime?.imageCover ?: selectedAnime?.cover,
                        episodeIndex = selectedEpisode.index ?: "1",
                        episodeId = selectedEpisode.id,
                        videoUrl = videoUrl,
                        passcode = passcode,
                        isPublic = passcode.isEmpty()
                    )

                    val createRes = ApiClient.community.createW2GRoom(req)
                    if (createRes.success && (!createRes.roomId.isNullOrBlank() || createRes.room != null)) {
                        val newRoomId = createRes.roomId ?: createRes.room?.id ?: ""
                        dialog.dismiss()
                        Toast.makeText(context, "Room berhasil dibuat!", Toast.LENGTH_SHORT).show()
                        loadW2GRooms()
                        launchW2GRoom(newRoomId, passcode)
                    } else {
                        Toast.makeText(context, createRes.error ?: "Gagal membuat room", Toast.LENGTH_SHORT).show()
                    }
                } catch (e: Exception) {
                    Toast.makeText(context, "Error: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
                } finally {
                    pbCreate.visibility = View.GONE
                    btnSubmit.isEnabled = true
                }
            }
        }

        dialog.show()
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
