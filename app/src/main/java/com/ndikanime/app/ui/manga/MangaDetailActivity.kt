package com.ndikanime.app.ui.manga

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
import com.ndikanime.app.data.model.HistoryItem
import com.ndikanime.app.data.model.MangaChapterItem
import com.ndikanime.app.data.model.MangaDetail
import com.ndikanime.app.data.storage.HistoryStorage
import com.ndikanime.app.databinding.ActivityMangaDetailBinding
import com.ndikanime.app.ui.community.CommentsBottomSheet
import kotlinx.coroutines.launch

class MangaDetailActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMangaDetailBinding
    private val historyStorage by lazy { HistoryStorage(this) }
    private val chapterAdapter by lazy { ChapterAdapter { openReader(it) } }

    private var mangaSlug: String = ""
    private var mangaTitle: String = ""
    private var mangaCover: String = ""
    private var currentDetail: MangaDetail? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMangaDetailBinding.inflate(layoutInflater)
        setContentView(binding.root)

        mangaSlug = intent.getStringExtra("manga_slug") ?: ""
        mangaTitle = intent.getStringExtra("manga_title") ?: ""
        mangaCover = intent.getStringExtra("manga_cover") ?: ""

        setupViews()
        loadMangaDetail()
    }

    private fun setupViews() {
        binding.toolbarManga.setNavigationOnClickListener { finish() }

        binding.tvMangaTitle.text = mangaTitle
        if (mangaCover.isNotBlank()) {
            val proxyUrl = "https://cfelainawanggy.pages.dev/?action=proxy&url=" +
                    java.net.URLEncoder.encode(mangaCover, "UTF-8")
            binding.ivMangaBackdrop.load(proxyUrl) { crossfade(true) }
            binding.ivMangaCover.load(proxyUrl) { crossfade(true) }
        }

        binding.rvMangaChapters.layoutManager = LinearLayoutManager(this)
        binding.rvMangaChapters.adapter = chapterAdapter

        updateBookmarkIcon()

        binding.btnBookmarkManga.setOnClickListener {
            val isFav = historyStorage.toggleFavorite(
                HistoryItem(
                    id = mangaSlug,
                    type = "manga",
                    title = mangaTitle,
                    cover = mangaCover,
                    subInfo = currentDetail?.status ?: "Manga"
                )
            )
            updateBookmarkIcon()
            val msg = if (isFav) "Ditambahkan ke Favorit" else "Dihapus dari Favorit"
            Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
        }

        binding.btnCommentManga.setOnClickListener {
            if (mangaSlug.isNotBlank()) {
                CommentsBottomSheet(this, "manga", mangaSlug).show()
            }
        }

        binding.btnReadFirstChapter.setOnClickListener {
            val firstChapter = currentDetail?.chapters?.lastOrNull()
                ?: currentDetail?.chapters?.firstOrNull()
            if (firstChapter != null) {
                openReader(firstChapter)
            } else {
                Toast.makeText(this, "Chapter belum tersedia", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun updateBookmarkIcon() {
        val isFav = historyStorage.isFavorite(mangaSlug)
        binding.btnBookmarkManga.setImageResource(
            if (isFav) R.drawable.ic_bookmark_filled else R.drawable.ic_bookmark
        )
    }

    private fun loadMangaDetail() {
        binding.progressBarMangaDetail.visibility = View.VISIBLE
        lifecycleScope.launch {
            try {
                val res = ApiClient.service.getMangaDetail(mangaSlug)
                val detail = res.data
                if (detail != null) {
                    currentDetail = detail
                    bindDetail(detail)
                } else {
                    Toast.makeText(this@MangaDetailActivity, "Gagal memuat detail komik", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(this@MangaDetailActivity, "Error: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
            } finally {
                binding.progressBarMangaDetail.visibility = View.GONE
            }
        }
    }

    private fun bindDetail(detail: MangaDetail) {
        binding.tvMangaTitle.text = detail.title ?: mangaTitle
        binding.tvMangaAuthor.text = detail.author ?: ""
        binding.tvMangaStatus.text = detail.status ?: "Ongoing"
        binding.tvMangaRating.text = detail.rating?.let { "★ $it" } ?: ""

        val coverUrl = detail.getDisplayCover()
        if (coverUrl.isNotBlank()) {
            binding.ivMangaBackdrop.load(coverUrl) { crossfade(true) }
            binding.ivMangaCover.load(coverUrl) { crossfade(true) }
        }

        binding.tvMangaSynopsis.text = detail.sinopsis ?: "Tidak ada sinopsis."

        val chapters = detail.chapters ?: emptyList()
        binding.tvChapterCount.text = "${chapters.size} Chapter"
        chapterAdapter.submitList(chapters)
    }

    private fun openReader(chapter: MangaChapterItem) {
        val chSlug = chapter.slug ?: return
        val intent = Intent(this, MangaReaderActivity::class.java).apply {
            putExtra("chapter_slug", chSlug)
            putExtra("chapter_title", chapter.getDisplayTitle())
            putExtra("manga_slug", mangaSlug)
            putExtra("manga_title", mangaTitle)
            putExtra("manga_cover", mangaCover)
        }
        startActivity(intent)
    }
}
