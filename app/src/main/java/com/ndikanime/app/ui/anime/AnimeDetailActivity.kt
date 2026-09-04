package com.ndikanime.app.ui.anime

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import coil.load
import com.ndikanime.app.R
import com.ndikanime.app.data.api.ApiClient
import com.ndikanime.app.data.model.AnimeDetail
import com.ndikanime.app.data.model.EpisodeItem
import com.ndikanime.app.data.model.HistoryItem
import com.ndikanime.app.data.storage.HistoryStorage
import com.ndikanime.app.databinding.ActivityAnimeDetailBinding
import com.ndikanime.app.ui.explore.GenreAdapter
import kotlinx.coroutines.launch

class AnimeDetailActivity : AppCompatActivity() {

    private lateinit var binding: ActivityAnimeDetailBinding
    private val historyStorage by lazy { HistoryStorage(this) }
    private val episodeAdapter by lazy { EpisodeAdapter { openPlayer(it) } }

    private var animeId: String = ""
    private var animeTitle: String = ""
    private var animePoster: String = ""
    private var currentDetail: AnimeDetail? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityAnimeDetailBinding.inflate(layoutInflater)
        setContentView(binding.root)

        animeId = intent.getStringExtra("anime_id") ?: ""
        animeTitle = intent.getStringExtra("anime_title") ?: ""
        animePoster = intent.getStringExtra("anime_poster") ?: ""

        setupViews()
        loadDetail()
    }

    private fun setupViews() {
        binding.toolbar.setNavigationOnClickListener { finish() }

        binding.tvAnimeTitle.text = animeTitle
        if (animePoster.isNotBlank()) {
            val proxyUrl = "https://cfelainawanggy.pages.dev/?action=proxy&url=" +
                    java.net.URLEncoder.encode(animePoster, "UTF-8")
            binding.ivBackdrop.load(proxyUrl) { crossfade(true) }
            binding.ivPosterDetail.load(proxyUrl) { crossfade(true) }
        }

        binding.rvEpisodes.layoutManager = LinearLayoutManager(this)
        binding.rvEpisodes.adapter = episodeAdapter

        updateBookmarkIcon()

        binding.btnBookmark.setOnClickListener {
            val isFav = historyStorage.toggleFavorite(
                HistoryItem(
                    id = animeId,
                    type = "anime",
                    title = animeTitle,
                    cover = animePoster,
                    subInfo = currentDetail?.status ?: "Anime"
                )
            )
            updateBookmarkIcon()
            val msg = if (isFav) "Ditambahkan ke Favorit" else "Dihapus dari Favorit"
            Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
        }

        binding.btnShare.setOnClickListener {
            val sendIntent = Intent().apply {
                action = Intent.ACTION_SEND
                putExtra(Intent.EXTRA_TEXT, "Nonton anime $animeTitle di Ndika Nime!")
                type = "text/plain"
            }
            startActivity(Intent.createChooser(sendIntent, "Bagikan Anime"))
        }

        binding.btnWatchFirstEp.setOnClickListener {
            val firstEp = currentDetail?.episodeList?.lastOrNull()
                ?: currentDetail?.episodeList?.firstOrNull()
            if (firstEp != null) {
                openPlayer(firstEp)
            } else {
                Toast.makeText(this, "Episode belum tersedia", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun updateBookmarkIcon() {
        val isFav = historyStorage.isFavorite(animeId)
        binding.btnBookmark.setImageResource(
            if (isFav) R.drawable.ic_bookmark_filled else R.drawable.ic_bookmark
        )
    }

    private fun loadDetail() {
        binding.progressBarDetail.visibility = View.VISIBLE
        lifecycleScope.launch {
            try {
                val res = ApiClient.service.getDetail(animeId)
                if (res.status && res.data != null) {
                    val detail = res.data
                    currentDetail = detail
                    bindDetailData(detail)
                } else {
                    Toast.makeText(this@AnimeDetailActivity, "Gagal memuat detail anime", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(this@AnimeDetailActivity, "Error: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
            } finally {
                binding.progressBarDetail.visibility = View.GONE
            }
        }
    }

    private fun bindDetailData(detail: AnimeDetail) {
        binding.tvAnimeTitle.text = detail.title ?: animeTitle
        binding.tvAnimeStatus.text = detail.status ?: "UNKNOWN"
        binding.tvAnimeScore.text = detail.views?.let { "$it views" } ?: "8.5"
        binding.tvAnimeType.text = detail.type ?: "TV"

        val posterUrl = detail.getDisplayPoster()
        if (posterUrl.isNotBlank()) {
            binding.ivBackdrop.load(posterUrl) { crossfade(true) }
            binding.ivPosterDetail.load(posterUrl) { crossfade(true) }
        }

        binding.tvSynopsis.text = detail.synopsis ?: "Tidak ada sinopsis tersedia."

        val genres = detail.getDisplayGenres().map { com.ndikanime.app.data.model.GenreItem(id = it, title = it) }
        if (genres.isNotEmpty()) {
            binding.rvAnimeGenres.visibility = View.VISIBLE
            binding.rvAnimeGenres.layoutManager = LinearLayoutManager(this, LinearLayoutManager.HORIZONTAL, false)
            val gAdapter = GenreAdapter { genre ->
                val intent = Intent(this, AnimeListActivity::class.java).apply {
                    putExtra("list_type", "genre")
                    putExtra("list_title", "Genre: ${genre.title}")
                    putExtra("genre_id", genre.id)
                }
                startActivity(intent)
            }
            binding.rvAnimeGenres.adapter = gAdapter
            gAdapter.submitList(genres)
        } else {
            binding.rvAnimeGenres.visibility = View.GONE
        }

        val episodes = detail.episodeList ?: emptyList()
        binding.tvEpCount.text = "${episodes.size} Episode"
        episodeAdapter.submitList(episodes)
    }

    private fun openPlayer(episode: EpisodeItem) {
        val epId = episode.id ?: return
        val intent = Intent(this, WatchActivity::class.java).apply {
            putExtra("episode_id", epId)
            putExtra("episode_title", episode.title ?: "Episode")
            putExtra("anime_id", animeId)
            putExtra("anime_title", animeTitle)
            putExtra("anime_poster", animePoster)
        }
        startActivity(intent)
    }
}
