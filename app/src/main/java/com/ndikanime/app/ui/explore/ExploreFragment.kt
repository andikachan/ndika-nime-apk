package com.ndikanime.app.ui.explore

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import android.widget.Toast
import androidx.core.widget.doAfterTextChanged
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.android.material.tabs.TabLayout
import com.ndikanime.app.data.api.ApiClient
import com.ndikanime.app.data.model.AnimeItem
import com.ndikanime.app.data.model.GenreItem
import com.ndikanime.app.data.model.MangaItem
import com.ndikanime.app.data.model.UserProfile
import com.ndikanime.app.data.upstash.UpstashRepository
import com.ndikanime.app.databinding.FragmentExploreBinding
import com.ndikanime.app.ui.anime.AnimeCardAdapter
import com.ndikanime.app.ui.anime.AnimeDetailActivity
import com.ndikanime.app.ui.manga.MangaCardAdapter
import com.ndikanime.app.ui.manga.MangaDetailActivity
import com.ndikanime.app.ui.profile.ProfileActivity
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class ExploreFragment : Fragment() {

    private var _binding: FragmentExploreBinding? = null
    private val binding get() = _binding!!

    private var currentMode = 0 // 0: Anime, 1: Manga, 2: User
    private var searchJob: Job? = null
    private var selectedGenreId: String? = null

    private val animeAdapter by lazy {
        AnimeCardAdapter(isGrid = true) { openAnimeDetail(it) }
    }

    private val mangaAdapter by lazy {
        MangaCardAdapter(isGrid = true) { openMangaDetail(it) }
    }

    private val userAdapter by lazy {
        UserResultAdapter { openUserProfile(it) }
    }

    private val genreAdapter by lazy {
        GenreAdapter { onGenreSelected(it) }
    }

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View {
        _binding = FragmentExploreBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupViews()
        loadGenres()
    }

    private fun setupViews() {
        binding.rvSearchResults.layoutManager = GridLayoutManager(requireContext(), 3)
        binding.rvSearchResults.adapter = animeAdapter

        binding.rvGenres.layoutManager =
            LinearLayoutManager(requireContext(), LinearLayoutManager.HORIZONTAL, false)
        binding.rvGenres.adapter = genreAdapter

        binding.tabType.addOnTabSelectedListener(object : TabLayout.OnTabSelectedListener {
            override fun onTabSelected(tab: TabLayout.Tab?) {
                currentMode = tab?.position ?: 0
                when (currentMode) {
                    0 -> {
                        binding.rvSearchResults.layoutManager = GridLayoutManager(requireContext(), 3)
                        binding.rvSearchResults.adapter = animeAdapter
                        binding.rvGenres.visibility = View.VISIBLE
                        binding.etSearch.hint = "Cari judul anime..."
                    }
                    1 -> {
                        binding.rvSearchResults.layoutManager = GridLayoutManager(requireContext(), 3)
                        binding.rvSearchResults.adapter = mangaAdapter
                        binding.rvGenres.visibility = View.GONE
                        binding.etSearch.hint = "Cari judul komik / manga..."
                    }
                    2 -> {
                        binding.rvSearchResults.layoutManager = LinearLayoutManager(requireContext())
                        binding.rvSearchResults.adapter = userAdapter
                        binding.rvGenres.visibility = View.GONE
                        binding.etSearch.hint = "Cari nama atau username user..."
                    }
                }
                val query = binding.etSearch.text?.toString()?.trim() ?: ""
                if (query.isNotBlank()) {
                    performSearch(query)
                }
            }
            override fun onTabUnselected(tab: TabLayout.Tab?) {}
            override fun onTabReselected(tab: TabLayout.Tab?) {}
        })

        binding.etSearch.doAfterTextChanged { text ->
            val query = text?.toString()?.trim() ?: ""
            binding.btnClearSearch.visibility = if (query.isNotEmpty()) View.VISIBLE else View.GONE
            searchJob?.cancel()
            if (query.isNotEmpty()) {
                searchJob = lifecycleScope.launch {
                    delay(400)
                    performSearch(query)
                }
            } else {
                clearResults()
            }
        }

        binding.etSearch.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_SEARCH) {
                val query = binding.etSearch.text.toString().trim()
                if (query.isNotEmpty()) performSearch(query)
                true
            } else false
        }

        binding.btnClearSearch.setOnClickListener {
            binding.etSearch.text = null
            clearResults()
        }
    }

    fun setType(isManga: Boolean) {
        binding.tabType.getTabAt(if (isManga) 1 else 0)?.select()
    }

    private var currentGenres: List<GenreItem> = emptyList()

    private fun loadGenres() {
        lifecycleScope.launch {
            try {
                val res = ApiClient.service.getGenres()
                if (res.status && res.data != null) {
                    currentGenres = res.data
                    val displayGenres = listOf(GenreItem(title = "Semua", id = "")) + currentGenres
                    genreAdapter.submitList(displayGenres)
                }
            } catch (e: Exception) {}
        }
    }

    private fun onGenreSelected(genre: GenreItem) {
        val gId = genre.id
        selectedGenreId = if (gId.isNullOrBlank()) null else gId
        val updated = listOf(GenreItem(title = "Semua", id = "")) + currentGenres
        val mapped = updated.map { it.copy(isSelected = it.id == selectedGenreId || (selectedGenreId == null && it.id.isNullOrBlank())) }
        genreAdapter.submitList(mapped)

        if (selectedGenreId != null) {
            loadByGenre(selectedGenreId!!)
        } else {
            val q = binding.etSearch.text?.toString()?.trim() ?: ""
            if (q.isNotEmpty()) performSearch(q) else clearResults()
        }
    }

    private fun loadByGenre(genreId: String) {
        binding.progressBarSearch.visibility = View.VISIBLE
        binding.tvEmptySearch.visibility = View.GONE
        lifecycleScope.launch {
            try {
                val res = ApiClient.service.getAnimeByGenre(genreId)
                val list = res.data ?: emptyList()
                animeAdapter.submitList(list)
                binding.tvEmptySearch.visibility = if (list.isEmpty()) View.VISIBLE else View.GONE
                binding.tvEmptySearch.text = "Tidak ada anime dalam genre ini"
            } catch (e: Exception) {
                if (isAdded) Toast.makeText(context, "Gagal memuat genre: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
            } finally {
                binding.progressBarSearch.visibility = View.GONE
            }
        }
    }

    private fun performSearch(query: String) {
        binding.progressBarSearch.visibility = View.VISIBLE
        binding.tvEmptySearch.visibility = View.GONE
        lifecycleScope.launch {
            try {
                when (currentMode) {
                    0 -> {
                        val res = ApiClient.service.searchAnime(query)
                        val list = res.data ?: emptyList()
                        animeAdapter.submitList(list)
                        binding.tvEmptySearch.visibility = if (list.isEmpty()) View.VISIBLE else View.GONE
                        binding.tvEmptySearch.text = "Anime tidak ditemukan"
                    }
                    1 -> {
                        val res = ApiClient.service.searchManga(query)
                        val list = res.data ?: emptyList()
                        mangaAdapter.submitList(list)
                        binding.tvEmptySearch.visibility = if (list.isEmpty()) View.VISIBLE else View.GONE
                        binding.tvEmptySearch.text = "Komik tidak ditemukan"
                    }
                    2 -> {
                        val users = UpstashRepository.searchUsers(query)
                        userAdapter.submitList(users)
                        binding.tvEmptySearch.visibility = if (users.isEmpty()) View.VISIBLE else View.GONE
                        binding.tvEmptySearch.text = "User tidak ditemukan"
                    }
                }
            } catch (e: Exception) {
                if (isAdded) Toast.makeText(context, "Pencarian gagal: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
            } finally {
                binding.progressBarSearch.visibility = View.GONE
            }
        }
    }

    private fun clearResults() {
        animeAdapter.submitList(emptyList())
        mangaAdapter.submitList(emptyList())
        userAdapter.submitList(emptyList())
        binding.tvEmptySearch.visibility = View.VISIBLE
        binding.tvEmptySearch.text = when (currentMode) {
            0 -> "Ketik judul anime untuk mencari"
            1 -> "Ketik judul komik untuk mencari"
            else -> "Ketik nama atau email user untuk mencari"
        }
    }

    private fun openAnimeDetail(anime: AnimeItem) {
        val intent = Intent(requireContext(), AnimeDetailActivity::class.java).apply {
            putExtra("anime_id", anime.id)
            putExtra("anime_title", anime.title)
            putExtra("anime_poster", anime.imagePoster ?: anime.imageCover ?: anime.cover)
        }
        startActivity(intent)
    }

    private fun openMangaDetail(manga: MangaItem) {
        val intent = Intent(requireContext(), MangaDetailActivity::class.java).apply {
            putExtra("manga_slug", manga.getEffectiveSlug())
            putExtra("manga_title", manga.title)
            putExtra("manga_cover", manga.getDisplayCover())
        }
        startActivity(intent)
    }

    private fun openUserProfile(user: UserProfile) {
        val intent = Intent(requireContext(), ProfileActivity::class.java).apply {
            putExtra("view_user_id", user.id)
        }
        startActivity(intent)
    }

    override fun onDestroyView() {
        super.onDestroyView()
        searchJob?.cancel()
        _binding = null
    }
}
