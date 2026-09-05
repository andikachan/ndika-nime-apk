package com.ndikanime.app.ui.manga

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.LinearLayoutManager
import coil.load
import com.ndikanime.app.R
import com.ndikanime.app.data.api.ApiClient
import com.ndikanime.app.data.model.MangaItem
import com.ndikanime.app.data.storage.AuthManager
import com.ndikanime.app.databinding.FragmentMangaBinding
import com.ndikanime.app.ui.MainActivity
import com.ndikanime.app.ui.profile.ProfileActivity
import kotlinx.coroutines.async
import kotlinx.coroutines.launch

class MangaFragment : Fragment() {

    private var _binding: FragmentMangaBinding? = null
    private val binding get() = _binding!!

    private val authManager by lazy { AuthManager(requireContext()) }

    private val popularAdapter by lazy {
        MangaCardAdapter { openDetail(it) }
    }

    private val latestAdapter by lazy {
        MangaCardAdapter(isGrid = true) { openDetail(it) }
    }

    private var heroMangaList: List<MangaItem> = emptyList()
    private var heroCurrentIndex: Int = 0
    private val heroHandler = Handler(Looper.getMainLooper())
    private val heroRunnable = object : Runnable {
        override fun run() {
            if (heroMangaList.isNotEmpty()) {
                heroCurrentIndex = (heroCurrentIndex + 1) % heroMangaList.size
                displayHeroManga(heroCurrentIndex)
                heroHandler.postDelayed(this, 6000)
            }
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View {
        _binding = FragmentMangaBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupViews()
        loadManga()
    }

    private fun setupViews() {
        binding.rvPopularManga.layoutManager =
            LinearLayoutManager(requireContext(), LinearLayoutManager.HORIZONTAL, false)
        binding.rvPopularManga.adapter = popularAdapter

        binding.rvLatestManga.layoutManager =
            GridLayoutManager(requireContext(), 3)
        binding.rvLatestManga.adapter = latestAdapter

        binding.swipeRefreshManga.setColorSchemeResources(R.color.accent_gold)
        binding.swipeRefreshManga.setOnRefreshListener {
            loadManga()
        }

        binding.btnSearchManga.setOnClickListener {
            (activity as? MainActivity)?.navigateToExplore(true)
        }

        binding.btnProfileTopManga.setOnClickListener {
            if (authManager.isLoggedIn) {
                startActivity(Intent(requireContext(), ProfileActivity::class.java))
            } else {
                (activity as? MainActivity)?.navigateToCommunity()
            }
        }

        binding.btnHeroMangaNext.setOnClickListener {
            if (heroMangaList.isNotEmpty()) {
                heroHandler.removeCallbacks(heroRunnable)
                heroCurrentIndex = (heroCurrentIndex + 1) % heroMangaList.size
                displayHeroManga(heroCurrentIndex)
                heroHandler.postDelayed(heroRunnable, 6000)
            }
        }
    }

    override fun onResume() {
        super.onResume()
        updateProfileAvatar()
        if (heroMangaList.isNotEmpty()) {
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
            binding.btnProfileTopManga.load(url) { crossfade(true) }
        } else {
            binding.btnProfileTopManga.setImageResource(R.drawable.kaguya)
        }
    }

    private fun loadManga() {
        binding.progressBarManga.visibility = View.VISIBLE
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val heroDeferred = async { ApiClient.service.getMangaHeroSlider(15) }
                val popDeferred = async { ApiClient.service.getMangaPopularToday(30) }
                val latestDeferred = async { ApiClient.service.getMangaLatest() }

                val heroRes = try { heroDeferred.await() } catch (e: Exception) { null }
                val popRes = try { popDeferred.await() } catch (e: Exception) { null }
                val latestRes = try { latestDeferred.await() } catch (e: Exception) { null }

                val heroList = heroRes?.data ?: emptyList()
                val popList = popRes?.data ?: emptyList()
                val latestList = latestRes?.data ?: emptyList()

                popularAdapter.submitList(popList)
                latestAdapter.submitList(latestList)

                val heroCandidates = if (heroList.isNotEmpty()) heroList else popList
                if (heroCandidates.isNotEmpty()) {
                    heroMangaList = heroCandidates
                    heroCurrentIndex = 0
                    binding.cardHeroManga.visibility = View.VISIBLE
                    displayHeroManga(0)
                    heroHandler.removeCallbacks(heroRunnable)
                    heroHandler.postDelayed(heroRunnable, 6000)
                }
            } catch (e: Exception) {
                if (isAdded) {
                    Toast.makeText(context, "Gagal memuat komik: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
                }
            } finally {
                binding.progressBarManga.visibility = View.GONE
                binding.swipeRefreshManga.isRefreshing = false
            }
        }
    }

    private fun displayHeroManga(index: Int) {
        if (heroMangaList.isEmpty()) return
        val manga = heroMangaList[index % heroMangaList.size]

        binding.tvHeroMangaIndex.text = String.format("%02d", index + 1)
        binding.tvHeroMangaTotal.text = String.format("%02d", heroMangaList.size)

        val chapterText = manga.getDisplayChapter() ?: "Chapter Terbaru"

        binding.tvHeroMangaTitle.text = manga.title ?: "Komik"
        binding.tvHeroMangaSubtitle.text = "$chapterText • Baca komik online subtitle Indonesia terlengkap dan terupdate di Ndichan."

        binding.ivHeroMangaCover.load(manga.getDisplayCover()) {
            crossfade(true)
            placeholder(R.drawable.kaguya)
            error(R.drawable.kaguya)
        }

        binding.btnHeroMangaRead.setOnClickListener {
            openDetail(manga)
        }

        binding.btnHeroMangaDetail.setOnClickListener {
            openDetail(manga)
        }

        binding.cardHeroManga.setOnClickListener {
            openDetail(manga)
        }
    }

    private fun openDetail(manga: MangaItem) {
        val intent = Intent(requireContext(), MangaDetailActivity::class.java).apply {
            putExtra("manga_slug", manga.getEffectiveSlug())
            putExtra("manga_title", manga.title)
            putExtra("manga_cover", manga.getDisplayCover())
        }
        startActivity(intent)
    }

    override fun onDestroyView() {
        super.onDestroyView()
        heroHandler.removeCallbacks(heroRunnable)
        _binding = null
    }
}
