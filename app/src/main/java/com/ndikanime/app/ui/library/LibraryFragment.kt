package com.ndikanime.app.ui.library

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.lifecycle.lifecycleScope
import com.google.android.material.tabs.TabLayout
import com.ndikanime.app.data.model.HistoryItem
import com.ndikanime.app.data.storage.HistoryStorage
import kotlinx.coroutines.launch
import com.ndikanime.app.databinding.FragmentLibraryBinding
import com.ndikanime.app.ui.anime.AnimeDetailActivity
import com.ndikanime.app.ui.manga.MangaDetailActivity

class LibraryFragment : Fragment() {

    private var _binding: FragmentLibraryBinding? = null
    private val binding get() = _binding!!

    private val historyStorage by lazy { HistoryStorage(requireContext()) }
    private var currentTab = 0 // 0 = anime history, 1 = manga history, 2 = favorites

    private val historyAdapter by lazy {
        HistoryAdapter(
            onItemClick = { openItem(it) },
            onDeleteClick = { deleteItem(it) }
        )
    }

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View {
        _binding = FragmentLibraryBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupViews()
    }

    override fun onResume() {
        super.onResume()
        loadCurrentTab()
        viewLifecycleOwner.lifecycleScope.launch {
            if (historyStorage.syncRemoteHistory()) {
                loadCurrentTab()
            }
        }
    }

    private fun setupViews() {
        binding.rvLibrary.layoutManager = LinearLayoutManager(requireContext())
        binding.rvLibrary.adapter = historyAdapter

        binding.tabLibrary.addOnTabSelectedListener(object : TabLayout.OnTabSelectedListener {
            override fun onTabSelected(tab: TabLayout.Tab?) {
                currentTab = tab?.position ?: 0
                loadCurrentTab()
            }
            override fun onTabUnselected(tab: TabLayout.Tab?) {}
            override fun onTabReselected(tab: TabLayout.Tab?) {}
        })

        binding.btnClearHistory.setOnClickListener {
            showClearConfirmation()
        }
    }

    private fun loadCurrentTab() {
        val list = when (currentTab) {
            0 -> historyStorage.getAnimeHistory()
            1 -> historyStorage.getMangaHistory()
            2 -> historyStorage.getFavorites()
            else -> emptyList()
        }

        historyAdapter.submitList(list)
        val isEmpty = list.isEmpty()
        binding.tvEmptyLibrary.visibility = if (isEmpty) View.VISIBLE else View.GONE
        binding.rvLibrary.visibility = if (isEmpty) View.GONE else View.VISIBLE

        binding.tvEmptyLibrary.text = when (currentTab) {
            0 -> "Belum ada riwayat tonton anime"
            1 -> "Belum ada riwayat baca komik"
            2 -> "Belum ada anime atau komik favorit"
            else -> "Kosong"
        }
    }

    private fun openItem(item: HistoryItem) {
        if (item.type == "anime") {
            val intent = Intent(requireContext(), AnimeDetailActivity::class.java).apply {
                putExtra("anime_id", item.id)
                putExtra("anime_title", item.title)
                putExtra("anime_poster", item.cover)
            }
            startActivity(intent)
        } else {
            val intent = Intent(requireContext(), MangaDetailActivity::class.java).apply {
                putExtra("manga_slug", item.id)
                putExtra("manga_title", item.title)
                putExtra("manga_cover", item.cover)
            }
            startActivity(intent)
        }
    }

    private fun deleteItem(item: HistoryItem) {
        val typeKey = when (currentTab) {
            0 -> "anime"
            1 -> "manga"
            2 -> "favorite"
            else -> "anime"
        }
        historyStorage.deleteItem(item.id, typeKey)
        loadCurrentTab()
    }

    private fun showClearConfirmation() {
        val title = when (currentTab) {
            0 -> "Hapus semua riwayat nonton?"
            1 -> "Hapus semua riwayat baca?"
            2 -> "Hapus semua favorit?"
            else -> "Hapus?"
        }

        AlertDialog.Builder(requireContext())
            .setTitle(title)
            .setMessage("Data yang dihapus tidak dapat dikembalikan.")
            .setPositiveButton("Hapus") { _, _ ->
                val typeKey = when (currentTab) {
                    0 -> "anime"
                    1 -> "manga"
                    2 -> "favorite"
                    else -> "anime"
                }
                historyStorage.clearAll(typeKey)
                loadCurrentTab()
            }
            .setNegativeButton("Batal", null)
            .show()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
