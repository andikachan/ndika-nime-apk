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
import com.ndikanime.app.data.upstash.UpstashClient
import com.ndikanime.app.data.upstash.UpstashRepository
import com.ndikanime.app.databinding.FragmentCommunityBinding
import com.ndikanime.app.ui.profile.ProfileActivity
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

class CommunityFragment : Fragment() {

    private var _binding: FragmentCommunityBinding? = null
    private val binding get() = _binding!!

    private val authManager by lazy { AuthManager(requireContext()) }

    private val chatAdapter by lazy {
        ChatAdapter { msg ->
            onChatUserClicked(msg)
        }
    }
    private val leaderboardAdapter by lazy {
        LeaderboardAdapter { user ->
            onLeaderboardUserClicked(user)
        }
    }
    private val w2gAdapter by lazy {
        W2GAdapter { room ->
            joinW2GRoom(room)
        }
    }
    private val questList = mutableListOf<QuestItem>()
    private val questAdapter by lazy {
        QuestAdapter(questList) { quest ->
            claimQuest(quest)
        }
    }
    private val dmList = mutableListOf<DMConversation>()
    private val dmAdapter by lazy {
        DMConversationAdapter(dmList) { conv ->
            openDMChat(conv.otherUserId, conv.otherUserName, conv.otherUserAvatar)
        }
    }

    private var currentTab = 0 // 0 = Chat, 1 = W2G, 2 = Leaderboard, 3 = Misi, 4 = DM
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
        if (currentTab == 1) {
            loadW2GRooms()
        } else if (currentTab == 3) {
            loadQuestsAndStreak()
        } else if (currentTab == 4) {
            loadDMConversations()
        }
    }

    private fun setupViews() {
        binding.rvCommunity.layoutManager = LinearLayoutManager(requireContext())

        // Top Feature Buttons
        binding.btnMoodTop.setOnClickListener {
            startActivity(Intent(requireContext(), MoodPickerActivity::class.java))
        }

        binding.btnClanTop.setOnClickListener {
            startActivity(Intent(requireContext(), ClanActivity::class.java))
        }

        binding.btnGachaTop.setOnClickListener {
            startActivity(Intent(requireContext(), GachaActivity::class.java))
        }

        binding.btnAccount.setOnClickListener {
            if (authManager.isLoggedIn) {
                startActivity(Intent(requireContext(), ProfileActivity::class.java))
            } else {
                showAuthDialog()
            }
        }

        // Tabs
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

        binding.btnSendChat.setOnClickListener {
            sendChat()
        }

        binding.btnCreateW2G.setOnClickListener {
            if (!authManager.isLoggedIn) {
                Toast.makeText(requireContext(), "Silakan login untuk membuat room W2G", Toast.LENGTH_SHORT).show()
                showAuthDialog()
                return@setOnClickListener
            }
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
        binding.btnCreateW2G.visibility = if (tabIndex == 1) View.VISIBLE else View.GONE
        binding.layoutChatInput.visibility = if (tabIndex == 0) View.VISIBLE else View.GONE

        when (tabIndex) {
            0 -> {
                binding.rvCommunity.adapter = chatAdapter
                startChatPolling()
            }
            1 -> {
                binding.rvCommunity.adapter = w2gAdapter
                loadW2GRooms()
            }
            2 -> {
                binding.rvCommunity.adapter = leaderboardAdapter
                loadLeaderboard()
            }
            3 -> {
                binding.rvCommunity.adapter = questAdapter
                loadQuestsAndStreak()
            }
            4 -> {
                binding.rvCommunity.adapter = dmAdapter
                loadDMConversations()
            }
        }
    }

    // ===== TAB 0: GLOBAL CHAT =====

    private fun startChatPolling() {
        chatPollingJob = viewLifecycleOwner.lifecycleScope.launch {
            while (isActive) {
                fetchChatMessages(silent = chatAdapter.itemCount > 0)
                delay(5000)
            }
        }
    }

    private suspend fun fetchChatMessages(silent: Boolean) {
        if (!silent) binding.pbCommunity.visibility = View.VISIBLE
        try {
            val list = UpstashRepository.getChatMessages(50)
            chatAdapter.submitList(list)
            if (list.isNotEmpty() && !silent) {
                binding.rvCommunity.scrollToPosition(list.size - 1)
            }
            binding.tvEmptyCommunity.visibility = if (list.isEmpty()) View.VISIBLE else View.GONE
            if (list.isEmpty()) binding.tvEmptyCommunity.text = "Belum ada pesan chat. Jadilah yang pertama!"
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

        val user = authManager.getUserProfile() ?: return
        binding.etChatMessage.setText("")

        viewLifecycleOwner.lifecycleScope.launch {
            try {
                UpstashRepository.sendChatMessage(user, text)
                // Record quest progress
                val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
                UpstashClient.incr("quest:progress:${user.id}:d:$today:chat_message")
                fetchChatMessages(silent = true)
            } catch (e: Exception) {
                Toast.makeText(context, "Gagal mengirim pesan: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun onChatUserClicked(msg: ChatMessage) {
        val targetUserId = msg.userId ?: return
        if (targetUserId == authManager.userId) return

        AlertDialog.Builder(requireContext())
            .setTitle(msg.name ?: "Pengguna")
            .setItems(arrayOf("💬 Kirim Pesan Pribadi (DM)")) { _, which ->
                when (which) {
                    0 -> openDMChat(targetUserId, msg.name ?: "Pengguna", msg.picture)
                }
            }
            .setNegativeButton("Tutup", null)
            .show()
    }

    // ===== TAB 1: WATCH2GETHER =====

    private fun loadW2GRooms() {
        binding.pbCommunity.visibility = View.VISIBLE
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val rooms = UpstashRepository.getW2GRooms()
                w2gAdapter.submitList(rooms)
                if (rooms.isEmpty()) {
                    binding.tvEmptyCommunity.visibility = View.VISIBLE
                    binding.tvEmptyCommunity.text = "Tidak ada room Watch Together yang aktif.\nBuat room baru sekarang!"
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
        val user = authManager.getUserProfile()
        if (user == null) {
            showAuthDialog()
            return
        }

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
                    val res = ApiClient.service.getDetail(anime.id ?: "")
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
                        val epDetail = ApiClient.service.getEpisode(selectedEpisode.id ?: "")
                        val servers = epDetail.data?.server ?: emptyList()
                        val directServers = servers.filter { it.type == "direct" && !it.link.isNullOrBlank() }
                        val chosenServer = directServers.find { it.quality == "720p" } ?: directServers.firstOrNull() ?: servers.firstOrNull()
                        if (chosenServer != null) {
                            videoUrl = chosenServer.getStreamingUrl()
                        }
                    } catch (e: Exception) {}

                    val passcode = etPasscode.text.toString().trim()
                    val room = UpstashRepository.createW2GRoom(
                        user = user,
                        title = title,
                        animeId = selectedAnime?.id,
                        animeTitle = selectedAnime?.title,
                        animePoster = selectedAnime?.imagePoster ?: selectedAnime?.imageCover ?: selectedAnime?.cover,
                        episodeIndex = selectedEpisode.index ?: "1",
                        episodeId = selectedEpisode.id,
                        videoUrl = videoUrl,
                        passcode = passcode.ifBlank { null }
                    )

                    dialog.dismiss()
                    Toast.makeText(context, "Room berhasil dibuat!", Toast.LENGTH_SHORT).show()
                    loadW2GRooms()
                    launchW2GRoom(room.getEffectiveId(), passcode)
                } catch (e: Exception) {
                    Toast.makeText(context, "Gagal membuat room: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
                } finally {
                    pbCreate.visibility = View.GONE
                    btnSubmit.isEnabled = true
                }
            }
        }

        dialog.show()
    }

    // ===== TAB 2: LEADERBOARD =====

    private fun loadLeaderboard() {
        binding.pbCommunity.visibility = View.VISIBLE
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val users = UpstashRepository.getLeaderboard()
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

    private fun onLeaderboardUserClicked(user: LeaderboardUser) {
        val targetId = user.id ?: return
        if (targetId == authManager.userId) return

        AlertDialog.Builder(requireContext())
            .setTitle(user.name ?: "Pengguna")
            .setItems(arrayOf("💬 Kirim Pesan Pribadi (DM)")) { _, which ->
                when (which) {
                    0 -> openDMChat(targetId, user.name ?: "Pengguna", user.picture)
                }
            }
            .setNegativeButton("Tutup", null)
            .show()
    }

    // ===== TAB 3: MISI & DAILY STREAK =====

    private fun loadQuestsAndStreak() {
        val userId = authManager.userId
        if (userId.isNullOrBlank()) {
            binding.tvEmptyCommunity.visibility = View.VISIBLE
            binding.tvEmptyCommunity.text = "Silakan login untuk melihat Misi Harian & Daily Streak!"
            questList.clear()
            questAdapter.notifyDataSetChanged()
            binding.swipeRefreshCommunity.isRefreshing = false
            return
        }

        binding.pbCommunity.visibility = View.VISIBLE
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val quests = UpstashRepository.getQuests(userId)
                val streak = UpstashRepository.getDailyStreak(userId)

                questList.clear()

                // Header / Streak item
                val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
                val isClaimedToday = streak.lastClaimedDate == today
                val streakQuest = QuestItem(
                    id = "streak_daily",
                    title = "🔥 Daily Streak (${streak.count} Hari)",
                    desc = if (isClaimedToday) "Sudah diklaim hari ini. Kembali lagi besok!" else "Klaim bonus login harian Anda sekarang!",
                    current = if (isClaimedToday) 1 else 0,
                    target = 1,
                    rewardCoins = if (streak.count >= 30) 600L else if (streak.count >= 7) 300L else 150L,
                    isClaimed = isClaimedToday
                )
                questList.add(streakQuest)
                questList.addAll(quests)
                questAdapter.notifyDataSetChanged()

                binding.tvEmptyCommunity.visibility = View.GONE
            } catch (e: Exception) {
                if (isAdded) {
                    Toast.makeText(context, "Gagal memuat misi: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
                }
            } finally {
                binding.pbCommunity.visibility = View.GONE
                binding.swipeRefreshCommunity.isRefreshing = false
            }
        }
    }

    private fun claimQuest(quest: QuestItem) {
        val userId = authManager.userId ?: return

        viewLifecycleOwner.lifecycleScope.launch {
            try {
                if (quest.id == "streak_daily") {
                    val (success, coins) = UpstashRepository.claimDailyStreak(userId)
                    if (success) {
                        Toast.makeText(requireContext(), "🎉 Berhasil klaim streak bonus +$coins Koin!", Toast.LENGTH_LONG).show()
                        loadQuestsAndStreak()
                    } else {
                        Toast.makeText(requireContext(), "Streak sudah diklaim hari ini", Toast.LENGTH_SHORT).show()
                    }
                } else {
                    UpstashRepository.addCoins(userId, quest.rewardCoins)
                    quest.isClaimed = true
                    questAdapter.notifyDataSetChanged()
                    Toast.makeText(requireContext(), "🎉 Hadiah +${quest.rewardCoins} Koin berhasil diklaim!", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(requireContext(), "Gagal klaim: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    // ===== TAB 4: DIRECT MESSAGES (DM) =====

    private fun loadDMConversations() {
        val userId = authManager.userId
        if (userId.isNullOrBlank()) {
            binding.tvEmptyCommunity.visibility = View.VISIBLE
            binding.tvEmptyCommunity.text = "Silakan login untuk melihat pesan pribadi Anda!"
            dmList.clear()
            dmAdapter.notifyDataSetChanged()
            binding.swipeRefreshCommunity.isRefreshing = false
            return
        }

        binding.pbCommunity.visibility = View.VISIBLE
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val convs = UpstashRepository.getDMConversations(userId)
                dmList.clear()
                dmList.addAll(convs)
                dmAdapter.notifyDataSetChanged()

                if (convs.isEmpty()) {
                    binding.tvEmptyCommunity.visibility = View.VISIBLE
                    binding.tvEmptyCommunity.text = "Belum ada pesan pribadi.\nKetuk profil teman di Chat Global untuk mulai mengobrol!"
                } else {
                    binding.tvEmptyCommunity.visibility = View.GONE
                }
            } catch (e: Exception) {
                if (isAdded) {
                    Toast.makeText(context, "Gagal memuat percakapan: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
                }
            } finally {
                binding.pbCommunity.visibility = View.GONE
                binding.swipeRefreshCommunity.isRefreshing = false
            }
        }
    }

    private fun openDMChat(otherUserId: String, otherUserName: String, otherUserAvatar: String?) {
        if (!authManager.isLoggedIn) {
            Toast.makeText(requireContext(), "Silakan login terlebih dahulu", Toast.LENGTH_SHORT).show()
            showAuthDialog()
            return
        }

        val intent = Intent(requireContext(), DMChatActivity::class.java).apply {
            putExtra("user_id", otherUserId)
            putExtra("user_name", otherUserName)
            putExtra("user_avatar", otherUserAvatar)
        }
        startActivity(intent)
    }

    // ===== AUTHENTICATION DIALOG =====

    private fun showAuthDialog() {
        val dialogView = LayoutInflater.from(requireContext()).inflate(R.layout.dialog_auth, null)
        val tabAuth = dialogView.findViewById<TabLayout>(R.id.tabAuth)
        val etName = dialogView.findViewById<EditText>(R.id.etName)
        val etEmail = dialogView.findViewById<EditText>(R.id.etEmail)
        val etPassword = dialogView.findViewById<EditText>(R.id.etPassword)
        val btnSubmit = dialogView.findViewById<MaterialButton>(R.id.btnSubmitAuth)
        val pbAuth = dialogView.findViewById<ProgressBar>(R.id.pbAuth)

        var authMode = 0 // 0 = login, 1 = register, 2 = reset password

        val dialog = AlertDialog.Builder(requireContext())
            .setView(dialogView)
            .create()

        tabAuth.addOnTabSelectedListener(object : TabLayout.OnTabSelectedListener {
            override fun onTabSelected(tab: TabLayout.Tab?) {
                authMode = tab?.position ?: 0
                when (authMode) {
                    0 -> {
                        etName.visibility = View.GONE
                        etPassword.hint = "Kata Sandi"
                        btnSubmit.text = "Masuk Sekarang"
                    }
                    1 -> {
                        etName.visibility = View.VISIBLE
                        etPassword.hint = "Kata Sandi"
                        btnSubmit.text = "Daftar Sekarang"
                    }
                    2 -> {
                        etName.visibility = View.GONE
                        etPassword.hint = "Kata Sandi Baru"
                        btnSubmit.text = "Setel Ulang Kata Sandi"
                    }
                }
            }
            override fun onTabUnselected(tab: TabLayout.Tab?) {}
            override fun onTabReselected(tab: TabLayout.Tab?) {}
        })

        btnSubmit.setOnClickListener {
            val email = etEmail.text.toString().trim()
            val pass = etPassword.text.toString().trim()
            val name = etName.text.toString().trim()

            if (email.isEmpty() || pass.isEmpty() || (authMode == 1 && name.isEmpty())) {
                Toast.makeText(context, "Mohon lengkapi semua data", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            if (pass.length < 6) {
                Toast.makeText(context, "Kata sandi minimal 6 karakter", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            pbAuth.visibility = View.VISIBLE
            btnSubmit.isEnabled = false

            viewLifecycleOwner.lifecycleScope.launch {
                try {
                    if (authMode == 2) {
                        val (success, msg) = UpstashRepository.resetPassword(email, pass)
                        Toast.makeText(context, msg, Toast.LENGTH_LONG).show()
                        if (success) {
                            tabAuth.getTabAt(0)?.select()
                            etPassword.setText("")
                        }
                    } else {
                        val user = if (authMode == 1) {
                            UpstashRepository.register(name, email, pass)
                        } else {
                            UpstashRepository.login(email, pass)
                        }

                        if (user != null) {
                            val sessionToken = "upstash_token_${user.id}"
                            authManager.saveUserSession(sessionToken, user)
                            updateAuthButton()
                            dialog.dismiss()
                            Toast.makeText(context, "Selamat datang, ${user.name}!", Toast.LENGTH_SHORT).show()
                            loadTab(currentTab)
                        } else {
                            val errMsg = if (authMode == 1) "Pendaftaran gagal. Email mungkin sudah digunakan." else "Email atau kata sandi salah."
                            Toast.makeText(context, errMsg, Toast.LENGTH_SHORT).show()
                        }
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
