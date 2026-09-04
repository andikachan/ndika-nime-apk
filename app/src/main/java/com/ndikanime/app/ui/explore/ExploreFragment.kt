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
import com.ndikanime.app.databinding.FragmentExploreBinding
import com.ndikanime.app.ui.anime.AnimeCardAdapter
import com.ndikanime.app.ui.anime.AnimeDetailActivity
import com.ndikanime.app.ui.manga.MangaCardAdapter
import com.ndikanime.app.ui.manga.MangaDetailActivity
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class ExploreFragment : Fragment() {

    private var _binding: FragmentExploreBinding? = null
    private val binding get() = _binding!!

    private var isMangaMode = false
    private var searchJob: Job? = null
    private var selectedGenreId: String? = null

    private val animeAdapter by lazy {
        AnimeCardAdapter(isGrid = true) { openAnimeDetail(it) }
    }

    private val mangaAdapter by lazy {
        MangaCardAdapter(isGrid = true) { openMangaDetail(it) }
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
                isMangaMode = (tab?.position == 1)
                binding.rvSearchResults.adapter = if (isMangaMode) mangaAdapter else animeAdapter
                binding.rvGenres.visibility = if (isMangaMode) View.GONE else View.VISIBLE
                val query = binding.etSearch.text.toString().trim()
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
                    delay(500)
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

    private fun loadGenres() {
        lifecycleScope.launch {
            try {
                val res = ApiClient.service.getGenres()
                val list = res.data ?: emptyList()
                genreAdapter.submitList(list, selectedGenreId)
            } catch (e: Exception) {
                // ignore
            }
        }
    }

    private fun onGenreSelected(genre: GenreItem) {
        selectedGenreId = if (selectedGenreId == genre.id) null else genre.id
        genreAdapter.submitList(genreAdapter.itemCount.let { emptyList() }) // refresh
        loadGenres()

        if (selectedGenreId != null) {
            filterByGenre(selectedGenreId!!)
        } else {
            clearResults()
        }
    }

    private fun filterByGenre(genreId: String) {
        binding.progressBarSearch.visibility = View.VISIBLE
        binding.tvEmptySearch.visibility = View.GONE
        lifecycleScope.launch {
            try {
                val res = ApiClient.service.getAnimeByGenre(genreId, 0)
                val list = res.data ?: emptyList()
                animeAdapter.submitList(list)
                binding.tvEmptySearch.visibility = if (list.isEmpty()) View.VISIBLE else View.GONE
                if (list.isEmpty()) binding.tvEmptySearch.text = "Tidak ada anime dalam genre ini"
            } catch (e: Exception) {
                Toast.makeText(context, "Error: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
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
                if (isMangaMode) {
                    val res = ApiClient.service.searchManga(query)
                    val list = res.data ?: emptyList()
                    mangaAdapter.submitList(list)
                    binding.tvEmptySearch.visibility = if (list.isEmpty()) View.VISIBLE else View.GONE
                    if (list.isEmpty()) binding.tvEmptySearch.text = "Komik \"$query\" tidak ditemukan"
                } else {
                    val res = ApiClient.service.searchAnime(query, 0)
                    val list = res.data ?: emptyList()
                    animeAdapter.submitList(list)
                    binding.tvEmptySearch.visibility = if (list.isEmpty()) View.VISIBLE else View.GONE
                    if (list.isEmpty()) binding.tvEmptySearch.text = "Anime \"$query\" tidak ditemukan"
                }
            } catch (e: Exception) {
                if (isAdded) {
                    Toast.makeText(context, "Pencarian gagal: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
                }
            } finally {
                binding.progressBarSearch.visibility = View.GONE
            }
        }
    }

    private fun clearResults() {
        animeAdapter.submitList(emptyList())
        mangaAdapter.submitList(emptyList())
        binding.tvEmptySearch.visibility = View.VISIBLE
        binding.tvEmptySearch.text = "Ketik judul anime atau komik untuk mencari"
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
            putExtra("manga_slug", manga.slug)
            putExtra("manga_title", manga.title)
            putExtra("manga_cover", manga.cover)
        }
        startActivity(intent)
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
