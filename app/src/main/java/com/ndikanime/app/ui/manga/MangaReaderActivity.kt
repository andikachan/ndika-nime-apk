package com.ndikanime.app.ui.manga

import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.ndikanime.app.data.api.ApiClient
import com.ndikanime.app.data.model.MangaChapterItem
import com.ndikanime.app.data.model.MangaReadData
import com.ndikanime.app.data.storage.HistoryStorage
import com.ndikanime.app.databinding.ActivityMangaReaderBinding
import kotlinx.coroutines.launch

class MangaReaderActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMangaReaderBinding
    private val historyStorage by lazy { HistoryStorage(this) }
    private val pageAdapter by lazy {
        MangaPageAdapter { toggleControls() }
    }

    private var chapterSlug: String = ""
    private var chapterTitle: String = ""
    private var mangaSlug: String = ""
    private var mangaTitle: String = ""
    private var mangaCover: String = ""

    private var currentData: MangaReadData? = null
    private var areControlsVisible = true

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMangaReaderBinding.inflate(layoutInflater)
        setContentView(binding.root)

        chapterSlug = intent.getStringExtra("chapter_slug") ?: ""
        chapterTitle = intent.getStringExtra("chapter_title") ?: ""
        mangaSlug = intent.getStringExtra("manga_slug") ?: ""
        mangaTitle = intent.getStringExtra("manga_title") ?: ""
        mangaCover = intent.getStringExtra("manga_cover") ?: ""

        setupViews()
        loadChapter(chapterSlug)
    }

    private fun setupViews() {
        binding.tvReaderTitle.text = if (mangaTitle.isNotBlank()) "$mangaTitle - $chapterTitle" else chapterTitle
        binding.btnBackReader.setOnClickListener { finish() }

        val layoutManager = LinearLayoutManager(this)
        binding.rvMangaPages.layoutManager = layoutManager
        binding.rvMangaPages.adapter = pageAdapter

        binding.rvMangaPages.addOnScrollListener(object : RecyclerView.OnScrollListener() {
            override fun onScrolled(recyclerView: RecyclerView, dx: Int, dy: Int) {
                val total = pageAdapter.itemCount
                val current = layoutManager.findFirstVisibleItemPosition() + 1
                if (total > 0 && current > 0) {
                    binding.tvPageIndicator.text = "$current / $total"
                }
            }
        })

        binding.btnPrevChapter.setOnClickListener {
            navigateChapter(isNext = false)
        }

        binding.btnNextChapter.setOnClickListener {
            navigateChapter(isNext = true)
        }
    }

    private fun toggleControls() {
        areControlsVisible = !areControlsVisible
        val vis = if (areControlsVisible) View.VISIBLE else View.GONE
        binding.topBarReader.visibility = vis
        binding.bottomBarReader.visibility = vis
    }

    private fun loadChapter(slug: String) {
        binding.pbReaderLoading.visibility = View.VISIBLE
        lifecycleScope.launch {
            try {
                val res = ApiClient.service.getMangaRead(slug)
                val data = res.data
                if (data != null && !data.pages.isNullOrEmpty()) {
                    currentData = data
                    chapterTitle = data.chapterTitle ?: chapterTitle
                    binding.tvReaderTitle.text = if (mangaTitle.isNotBlank()) "$mangaTitle - $chapterTitle" else chapterTitle

                    pageAdapter.submitList(data.pages)
                    binding.tvPageIndicator.text = "1 / ${data.pages.size}"

                    // Save history
                    historyStorage.saveMangaHistory(
                        slug = mangaSlug.ifBlank { data.slugManga ?: slug },
                        title = mangaTitle.ifBlank { data.title ?: "Manga" },
                        cover = mangaCover.ifBlank { data.cover ?: "" },
                        chapterTitle = chapterTitle,
                        chapterSlug = chapterSlug
                    )
                } else {
                    Toast.makeText(this@MangaReaderActivity, "Gambar komik tidak ditemukan", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(this@MangaReaderActivity, "Gagal memuat chapter: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
            } finally {
                binding.pbReaderLoading.visibility = View.GONE
            }
        }
    }

    private fun navigateChapter(isNext: Boolean) {
        val otherChapters = currentData?.otherChapters ?: return
        val currentIndex = otherChapters.indexOfFirst { it.slug == chapterSlug }
        if (currentIndex == -1) return

        val targetIndex = if (isNext) currentIndex - 1 else currentIndex + 1
        if (targetIndex in otherChapters.indices) {
            val target = otherChapters[targetIndex]
            chapterSlug = target.slug ?: return
            chapterTitle = target.getDisplayTitle()
            loadChapter(chapterSlug)
        } else {
            val msg = if (isNext) "Ini adalah chapter terakhir" else "Ini adalah chapter pertama"
            Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
        }
    }
}
