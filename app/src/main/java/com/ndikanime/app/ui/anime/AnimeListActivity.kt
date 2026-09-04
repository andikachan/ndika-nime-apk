package com.ndikanime.app.ui.anime

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.ndikanime.app.R
import com.ndikanime.app.data.api.ApiClient
import com.ndikanime.app.data.model.AnimeItem
import com.ndikanime.app.databinding.ActivityAnimeListBinding
import kotlinx.coroutines.launch

class AnimeListActivity : AppCompatActivity() {

    private lateinit var binding: ActivityAnimeListBinding
    private val adapter by lazy {
        AnimeCardAdapter(isGrid = true) { openDetail(it) }
    }

    private var listType: String = "ongoing"
    private var listTitle: String = "Anime"
    private var genreId: String? = null

    private var currentPage = 1
    private var isLoading = false
    private var hasMore = true
    private val items = mutableListOf<AnimeItem>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityAnimeListBinding.inflate(layoutInflater)
        setContentView(binding.root)

        listType = intent.getStringExtra("list_type") ?: "ongoing"
        listTitle = intent.getStringExtra("list_title") ?: "Anime"
        genreId = intent.getStringExtra("genre_id")

        setupViews()
        loadData(reset = true)
    }

    private fun setupViews() {
        binding.toolbarList.title = listTitle
        binding.toolbarList.setNavigationOnClickListener { finish() }

        val gridLayout = GridLayoutManager(this, 3)
        binding.rvList.layoutManager = gridLayout
        binding.rvList.adapter = adapter

        binding.swipeRefreshList.setColorSchemeResources(R.color.accent_gold)
        binding.swipeRefreshList.setOnRefreshListener {
            loadData(reset = true)
        }

        binding.rvList.addOnScrollListener(object : RecyclerView.OnScrollListener() {
            override fun onScrolled(recyclerView: RecyclerView, dx: Int, dy: Int) {
                if (dy > 0 && !isLoading && hasMore) {
                    val visibleItemCount = gridLayout.childCount
                    val totalItemCount = gridLayout.itemCount
                    val pastVisibleItems = gridLayout.findFirstVisibleItemPosition()

                    if ((visibleItemCount + pastVisibleItems) >= totalItemCount - 3) {
                        currentPage++
                        loadData(reset = false)
                    }
                }
            }
        })
    }

    private fun loadData(reset: Boolean) {
        if (reset) {
            currentPage = 1
            hasMore = true
            items.clear()
        }

        isLoading = true
        if (reset) binding.progressBarList.visibility = View.VISIBLE

        lifecycleScope.launch {
            try {
                val res = when (listType) {
                    "ongoing" -> ApiClient.service.getOngoing(currentPage)
                    "popular" -> ApiClient.service.getPopular(currentPage)
                    "new" -> ApiClient.service.getNew(currentPage, 30)
                    "genre" -> ApiClient.service.getAnimeByGenre(genreId ?: "", currentPage)
                    else -> ApiClient.service.getOngoing(currentPage)
                }

                val newItems = res.data ?: emptyList()
                if (newItems.isEmpty()) {
                    hasMore = false
                } else {
                    items.addAll(newItems)
                    adapter.submitList(items.toList())
                }
            } catch (e: Exception) {
                Toast.makeText(this@AnimeListActivity, "Gagal memuat: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
            } finally {
                isLoading = false
                binding.progressBarList.visibility = View.GONE
                binding.swipeRefreshList.isRefreshing = false
            }
        }
    }

    private fun openDetail(anime: AnimeItem) {
        val intent = Intent(this, AnimeDetailActivity::class.java).apply {
            putExtra("anime_id", anime.id)
            putExtra("anime_title", anime.title)
            putExtra("anime_poster", anime.imagePoster ?: anime.imageCover ?: anime.cover)
        }
        startActivity(intent)
    }
}
