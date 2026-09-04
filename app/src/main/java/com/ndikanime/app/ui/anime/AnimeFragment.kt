package com.ndikanime.app.ui.anime

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import coil.load
import com.google.android.material.tabs.TabLayout
import com.ndikanime.app.R
import com.ndikanime.app.data.api.ApiClient
import com.ndikanime.app.data.model.AnimeItem
import com.ndikanime.app.data.storage.AuthManager
import com.ndikanime.app.databinding.FragmentAnimeBinding
import com.ndikanime.app.ui.MainActivity
import com.ndikanime.app.ui.community.MoodPickerActivity
import com.ndikanime.app.ui.profile.ProfileActivity
import kotlinx.coroutines.async
import kotlinx.coroutines.launch
import java.util.Calendar

class AnimeFragment : Fragment() {

    private var _binding: FragmentAnimeBinding? = null
    private val binding get() = _binding!!

    private val authManager by lazy { AuthManager(requireContext()) }
    private val ongoingAdapter by lazy { AnimeCardAdapter { openDetail(it) } }
    private val newAdapter by lazy { AnimeCardAdapter { openDetail(it) } }
    private val scheduleAdapter by lazy { AnimeCardAdapter { openDetail(it) } }
    private val top10PopularAdapter by lazy { Top10PopularAdapter { openDetail(it) } }

    private var scheduleMap: Map<String, List<AnimeItem>> = emptyMap()
    private val days = listOf("MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU")

    private var heroAnimeList: List<AnimeItem> = emptyList()
    private var heroCurrentIndex: Int = 0
    private val heroHandler = Handler(Looper.getMainLooper())
    private val heroRunnable = object : Runnable {
        override fun run() {
            if (heroAnimeList.isNotEmpty()) {
                heroCurrentIndex = (heroCurrentIndex + 1) % heroAnimeList.size
                displayHero(heroCurrentIndex)
                heroHandler.postDelayed(this, 6000)
            }
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View {
        _binding = FragmentAnimeBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupViews()
        setupShareButtons()
        setupMoodAndRoulette()
        loadData()
    }

    private fun setupViews() {
        binding.rvOngoing.layoutManager =
            LinearLayoutManager(requireContext(), LinearLayoutManager.HORIZONTAL, false)
        binding.rvOngoing.adapter = ongoingAdapter

        binding.rvNew.layoutManager =
            LinearLayoutManager(requireContext(), LinearLayoutManager.HORIZONTAL, false)
        binding.rvNew.adapter = newAdapter

        binding.rvSchedule.layoutManager =
            LinearLayoutManager(requireContext(), LinearLayoutManager.HORIZONTAL, false)
        binding.rvSchedule.adapter = scheduleAdapter

        binding.rvTop10Popular.layoutManager =
            LinearLayoutManager(requireContext(), LinearLayoutManager.VERTICAL, false)
        binding.rvTop10Popular.adapter = top10PopularAdapter

        days.forEach { day ->
            binding.tabLayoutSchedule.addTab(binding.tabLayoutSchedule.newTab().setText(day))
        }

        // Set current day tab
        val dayIndex = Calendar.getInstance().get(Calendar.DAY_OF_WEEK) - 1
        binding.tabLayoutSchedule.getTabAt(dayIndex)?.select()
        val currentDayName = days.getOrNull(dayIndex) ?: "SENIN"
        binding.tvScheduleSubtitle.text = "Update episode hari $currentDayName"

        binding.tabLayoutSchedule.addOnTabSelectedListener(object : TabLayout.OnTabSelectedListener {
            override fun onTabSelected(tab: TabLayout.Tab?) {
                val dayName = tab?.text?.toString() ?: return
                binding.tvScheduleSubtitle.text = "Update episode hari $dayName"
                updateScheduleForDay(dayName)
            }
            override fun onTabUnselected(tab: TabLayout.Tab?) {}
            override fun onTabReselected(tab: TabLayout.Tab?) {}
        })

        binding.swipeRefresh.setColorSchemeResources(R.color.accent_gold)
        binding.swipeRefresh.setOnRefreshListener {
            loadData()
        }

        // Top bar actions
        binding.btnSearchTop.setOnClickListener {
            (activity as? MainActivity)?.navigateToExplore(false)
        }

        binding.btnDmTop.setOnClickListener {
            (activity as? MainActivity)?.navigateToCommunity()
        }

        binding.btnProfileTop.setOnClickListener {
            if (authManager.isLoggedIn) {
                startActivity(Intent(requireContext(), ProfileActivity::class.java))
            } else {
                (activity as? MainActivity)?.navigateToCommunity()
            }
        }

        binding.btnSeeAllOngoing.setOnClickListener {
            openAnimeList("ongoing", "Anime Ongoing")
        }
        binding.btnSeeAllPopular.setOnClickListener {
            openAnimeList("popular", "Anime Populer")
        }
        binding.btnSeeAllNew.setOnClickListener {
            openAnimeList("new", "Anime Rilis Terbaru")
        }

        // Hero next click
        binding.btnHeroNext.setOnClickListener {
            if (heroAnimeList.isNotEmpty()) {
                heroHandler.removeCallbacks(heroRunnable)
                heroCurrentIndex = (heroCurrentIndex + 1) % heroAnimeList.size
                displayHero(heroCurrentIndex)
                heroHandler.postDelayed(heroRunnable, 6000)
            }
        }
    }

    private fun setupShareButtons() {
        val shareText = "Ajak temanmu nonton anime & baca manga favorit di Ndichan, gratis dan tanpa iklan!\nhttps://ndichan.xyz"

        binding.btnShareCopy.setOnClickListener {
            val clipboard = requireContext().getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            val clip = ClipData.newPlainText("Ndichan URL", "https://ndichan.xyz")
            clipboard.setPrimaryClip(clip)
            Toast.makeText(requireContext(), "Tautan berhasil disalin ke clipboard!", Toast.LENGTH_SHORT).show()
        }

        binding.btnShareTelegram.setOnClickListener {
            try {
                val url = "https://t.me/share/url?url=https://ndichan.xyz&text=${Uri.encode("Nonton anime sub Indo gratis di Ndichan")}"
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                startActivity(intent)
            } catch (e: Exception) {
                openGenericShare(shareText)
            }
        }

        binding.btnShareTwitter.setOnClickListener {
            try {
                val url = "https://twitter.com/intent/tweet?url=https://ndichan.xyz&text=${Uri.encode("Nonton anime sub Indo gratis di Ndichan")}"
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                startActivity(intent)
            } catch (e: Exception) {
                openGenericShare(shareText)
            }
        }

        binding.btnShareOther.setOnClickListener {
            openGenericShare(shareText)
        }
    }

    private fun openGenericShare(text: String) {
        val sendIntent = Intent().apply {
            action = Intent.ACTION_SEND
            putExtra(Intent.EXTRA_TEXT, text)
            type = "text/plain"
        }
        startActivity(Intent.createChooser(sendIntent, "Bagikan Ndichan"))
    }

    private fun setupMoodAndRoulette() {
        binding.btnMoodPicker.setOnClickListener {
            startActivity(Intent(requireContext(), MoodPickerActivity::class.java))
        }

        binding.btnRoulette.setOnClickListener {
            val intent = Intent(requireContext(), MoodPickerActivity::class.java).apply {
                putExtra("start_roulette", true)
            }
            startActivity(intent)
        }
    }

    override fun onResume() {
        super.onResume()
        updateProfileAvatar()
        if (heroAnimeList.isNotEmpty()) {
            heroHandler.removeCallbacks(heroRunnable)
            heroHandler.postDelayed(heroRunnable, 6000)
        }
    }

    override fun onPause() {
        super.onPause()
        heroHandler.removeCallbacks(heroRunnable)
    }

    private fun updateProfileAvatar() {
        val avatar = authManager.userAvatar
        if (!avatar.isNullOrBlank()) {
            val url = if (avatar.startsWith("/")) "https://api.dicebear.com/7.x/bottts/png?seed=${avatar.hashCode()}" else avatar
            binding.btnProfileTop.load(url) { crossfade(true) }
        } else {
            binding.btnProfileTop.setImageResource(R.drawable.kaguya)
        }
    }

    private fun loadData() {
        binding.progressBar.visibility = View.VISIBLE
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val scheduleDeferred = async { ApiClient.service.getSchedule() }
                val ongoingDeferred = async { ApiClient.service.getOngoing(1) }
                val popularDeferred = async { ApiClient.service.getPopular(1) }
                val newDeferred = async { ApiClient.service.getNew(1, 20) }

                val schRes = scheduleDeferred.await()
                val ongRes = ongoingDeferred.await()
                val popRes = popularDeferred.await()
                val newRes = newDeferred.await()

                scheduleMap = schRes.data ?: emptyMap()
                val ongoingList = ongRes.data ?: emptyList()
                val popularList = popRes.data ?: emptyList()
                val newList = newRes.data ?: emptyList()

                ongoingAdapter.submitList(ongoingList)
                newAdapter.submitList(newList)
                top10PopularAdapter.submitList(popularList)

                val selectedDay = binding.tabLayoutSchedule.getTabAt(
                    binding.tabLayoutSchedule.selectedTabPosition
                )?.text?.toString() ?: "SENIN"
                updateScheduleForDay(selectedDay)

                // Setup Hero Carousel with ongoing / popular items
                val heroCandidates = if (ongoingList.isNotEmpty()) ongoingList else popularList
                if (heroCandidates.isNotEmpty()) {
                    heroAnimeList = heroCandidates.take(8)
                    heroCurrentIndex = 0
                    binding.cardHero.visibility = View.VISIBLE
                    displayHero(0)
                    heroHandler.removeCallbacks(heroRunnable)
                    heroHandler.postDelayed(heroRunnable, 6000)
                }
            } catch (e: Exception) {
                if (isAdded) {
                    Toast.makeText(context, "Gagal memuat data: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
                }
            } finally {
                binding.progressBar.visibility = View.GONE
                binding.swipeRefresh.isRefreshing = false
            }
        }
    }

    private fun displayHero(index: Int) {
        if (heroAnimeList.isEmpty()) return
        val anime = heroAnimeList[index % heroAnimeList.size]

        binding.tvHeroIndex.text = String.format("%02d", index + 1)
        binding.tvHeroTotal.text = String.format("%02d", heroAnimeList.size)

        binding.tvHeroBadgeStatus.text = anime.status ?: anime.type?.uppercase() ?: "ONGOING"
        binding.tvHeroTitle.text = anime.title ?: "Anime"
        binding.tvHeroSubtitle.text = anime.synopsis
            ?: "Nonton streaming anime subtitle Indonesia gratis kualitas terbaik update setiap hari hanya di NdiChan."

        binding.ivHeroCover.load(anime.getDisplayImage()) {
            crossfade(true)
            placeholder(R.drawable.kaguya)
            error(R.drawable.kaguya)
        }

        binding.btnHeroWatch.setOnClickListener {
            openDetail(anime)
        }

        binding.btnHeroDetail.setOnClickListener {
            openDetail(anime)
        }

        binding.cardHero.setOnClickListener {
            openDetail(anime)
        }
    }

    private fun updateScheduleForDay(dayName: String) {
        val list = scheduleMap[dayName] ?: emptyList()
        scheduleAdapter.submitList(list)
    }

    private fun openDetail(anime: AnimeItem) {
        val intent = Intent(requireContext(), AnimeDetailActivity::class.java).apply {
            putExtra("anime_id", anime.id)
            putExtra("anime_title", anime.title)
            putExtra("anime_poster", anime.imagePoster ?: anime.imageCover ?: anime.cover)
        }
        startActivity(intent)
    }

    private fun openAnimeList(type: String, title: String) {
        val intent = Intent(requireContext(), AnimeListActivity::class.java).apply {
            putExtra("list_type", type)
            putExtra("list_title", title)
        }
        startActivity(intent)
    }

    override fun onDestroyView() {
        super.onDestroyView()
        heroHandler.removeCallbacks(heroRunnable)
        _binding = null
    }
}
