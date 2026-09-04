package com.ndikanime.app.ui.manga

import android.content.Intent
import android.os.Bundle
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
    }

    override fun onResume() {
        super.onResume()
        updateProfileAvatar()
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
                val popDeferred = async { ApiClient.service.getMangaPopularToday(30) }
                val latestDeferred = async { ApiClient.service.getMangaLatest() }

                val popRes = popDeferred.await()
                val latestRes = latestDeferred.await()

                val popList = popRes.data ?: emptyList()
                val latestList = latestRes.data ?: emptyList()

                popularAdapter.submitList(popList)
                latestAdapter.submitList(latestList)
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

    private fun openDetail(manga: MangaItem) {
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
