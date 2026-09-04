package com.ndikanime.app.ui.anime

import android.content.Intent
import android.os.Bundle
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
import com.ndikanime.app.ui.profile.ProfileActivity
import kotlinx.coroutines.async
import kotlinx.coroutines.launch
import java.util.Calendar

class AnimeFragment : Fragment() {

    private var _binding: FragmentAnimeBinding? = null
    private val binding get() = _binding!!

    private val authManager by lazy { AuthManager(requireContext()) }
    private val ongoingAdapter by lazy { AnimeCardAdapter { openDetail(it) } }
    private val popularAdapter by lazy { AnimeCardAdapter { openDetail(it) } }
    private val newAdapter by lazy { AnimeCardAdapter { openDetail(it) } }
    private val scheduleAdapter by lazy { AnimeCardAdapter { openDetail(it) } }

    private var scheduleMap: Map<String, List<AnimeItem>> = emptyMap()
    private val days = listOf("MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU")

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View {
        _binding = FragmentAnimeBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupViews()
        loadData()
    }

    private fun setupViews() {
        binding.rvOngoing.layoutManager =
            LinearLayoutManager(requireContext(), LinearLayoutManager.HORIZONTAL, false)
        binding.rvOngoing.adapter = ongoingAdapter

        binding.rvPopular.layoutManager =
            LinearLayoutManager(requireContext(), LinearLayoutManager.HORIZONTAL, false)
        binding.rvPopular.adapter = popularAdapter

        binding.rvNew.layoutManager =
            LinearLayoutManager(requireContext(), LinearLayoutManager.HORIZONTAL, false)
        binding.rvNew.adapter = newAdapter

        binding.rvSchedule.layoutManager =
            LinearLayoutManager(requireContext(), LinearLayoutManager.HORIZONTAL, false)
        binding.rvSchedule.adapter = scheduleAdapter

        days.forEach { day ->
            binding.tabLayoutSchedule.addTab(binding.tabLayoutSchedule.newTab().setText(day))
        }

        // Set current day tab
        val dayIndex = Calendar.getInstance().get(Calendar.DAY_OF_WEEK) - 1
        binding.tabLayoutSchedule.getTabAt(dayIndex)?.select()

        binding.tabLayoutSchedule.addOnTabSelectedListener(object : TabLayout.OnTabSelectedListener {
            override fun onTabSelected(tab: TabLayout.Tab?) {
                val dayName = tab?.text?.toString() ?: return
                updateScheduleForDay(dayName)
            }
            override fun onTabUnselected(tab: TabLayout.Tab?) {}
            override fun onTabReselected(tab: TabLayout.Tab?) {}
        })

        binding.swipeRefresh.setColorSchemeResources(R.color.accent_gold)
        binding.swipeRefresh.setOnRefreshListener {
            loadData()
        }

        binding.btnSearchTop.setOnClickListener {
            (activity as? MainActivity)?.navigateToExplore(false)
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
    }

    override fun onResume() {
        super.onResume()
        updateProfileAvatar()
    }

    private fun updateProfileAvatar() {
        val avatar = authManager.userAvatar
        if (!avatar.isNullOrBlank()) {
            val url = if (avatar.startsWith("/")) "https://ndichan.xyz$avatar" else avatar
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
                popularAdapter.submitList(popularList)
                newAdapter.submitList(newList)

                val selectedDay = binding.tabLayoutSchedule.getTabAt(
                    binding.tabLayoutSchedule.selectedTabPosition
                )?.text?.toString() ?: "SENIN"
                updateScheduleForDay(selectedDay)

                // Setup Hero
                if (ongoingList.isNotEmpty()) {
                    val hero = ongoingList.first()
                    binding.cardHero.visibility = View.VISIBLE
                    binding.tvHeroTitle.text = hero.title
                    binding.tvHeroSubtitle.text = hero.synopsis ?: hero.type ?: ""
                    binding.ivHeroCover.load(hero.getDisplayImage()) {
                        crossfade(true)
                        placeholder(R.drawable.kaguya)
                    }
                    binding.cardHero.setOnClickListener {
                        openDetail(hero)
                    }
                }
            } catch (e: Exception) {
                if (isAdded) {
                    Toast.makeText(context, "Gagal memuat anime: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
                }
            } finally {
                binding.progressBar.visibility = View.GONE
                binding.swipeRefresh.isRefreshing = false
            }
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
        _binding = null
    }
}
