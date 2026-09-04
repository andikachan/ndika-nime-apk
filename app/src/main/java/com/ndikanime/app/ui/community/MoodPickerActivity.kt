package com.ndikanime.app.ui.community

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.GridLayoutManager
import com.ndikanime.app.R
import com.ndikanime.app.data.api.ApiClient
import com.ndikanime.app.data.model.AnimeItem
import com.ndikanime.app.databinding.ActivityMoodPickerBinding
import com.ndikanime.app.ui.anime.AnimeCardAdapter
import com.ndikanime.app.ui.anime.AnimeDetailActivity
import kotlinx.coroutines.launch

class MoodPickerActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMoodPickerBinding
    private val animeList = mutableListOf<AnimeItem>()
    private val adapter by lazy {
        AnimeCardAdapter(isGrid = true) { anime ->
            val intent = Intent(this, AnimeDetailActivity::class.java).apply {
                putExtra("anime_id", anime.id)
            }
            startActivity(intent)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMoodPickerBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.btnBackMood.setOnClickListener { finish() }

        binding.rvMoodResults.layoutManager = GridLayoutManager(this, 3)
        binding.rvMoodResults.adapter = adapter

        setupChips()

        binding.btnRouletteRandom.setOnClickListener {
            spinRoulette()
        }

        // Default pick Action
        binding.chipAction.isChecked = true
        loadByGenre("14") // 14 is action
    }

    private fun setupChips() {
        binding.chipAction.setOnClickListener { loadByGenre("14") }
        binding.chipRomance.setOnClickListener { loadByGenre("26") } // romance
        binding.chipComedy.setOnClickListener { loadByGenre("20") }  // comedy
        binding.chipDrama.setOnClickListener { loadByGenre("15") }   // drama
        binding.chipFantasy.setOnClickListener { loadByGenre("16") } // fantasy
    }

    private fun loadByGenre(genreId: String) {
        binding.pbMoodLoading.visibility = View.VISIBLE
        lifecycleScope.launch {
            try {
                val res = ApiClient.service.getAnimeByGenre(genreId, 0)
                val list = res.data ?: emptyList()
                animeList.clear()
                animeList.addAll(list)
                adapter.submitList(animeList.toList())
            } catch (e: Exception) {
                Toast.makeText(this@MoodPickerActivity, "Gagal memuat anime", Toast.LENGTH_SHORT).show()
            } finally {
                binding.pbMoodLoading.visibility = View.GONE
            }
        }
    }

    private fun spinRoulette() {
        binding.pbMoodLoading.visibility = View.VISIBLE
        lifecycleScope.launch {
            try {
                val res = ApiClient.service.getPopular(1)
                val list = res.data ?: emptyList()
                if (list.isNotEmpty()) {
                    val randomAnime = list.random()
                    Toast.makeText(this@MoodPickerActivity, "🎲 Terpilih: ${randomAnime.title}!", Toast.LENGTH_LONG).show()
                    val intent = Intent(this@MoodPickerActivity, AnimeDetailActivity::class.java).apply {
                        putExtra("anime_id", randomAnime.id)
                    }
                    startActivity(intent)
                }
            } catch (e: Exception) {
                Toast.makeText(this@MoodPickerActivity, "Gagal memutar roulette", Toast.LENGTH_SHORT).show()
            } finally {
                binding.pbMoodLoading.visibility = View.GONE
            }
        }
    }
}
