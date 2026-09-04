package com.ndikanime.app.ui.community

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.RecyclerView
import coil.load
import com.google.android.material.button.MaterialButton
import com.ndikanime.app.R
import com.ndikanime.app.data.model.CardItem
import com.ndikanime.app.data.model.UserCardItem
import com.ndikanime.app.data.storage.AuthManager
import com.ndikanime.app.data.upstash.UpstashRepository
import com.ndikanime.app.databinding.ActivityGachaBinding
import kotlinx.coroutines.launch

class GachaActivity : AppCompatActivity() {

    private lateinit var binding: ActivityGachaBinding
    private val authManager by lazy { AuthManager(this) }

    private var allCards: List<CardItem> = emptyList()
    private var myCards: List<UserCardItem> = emptyList()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityGachaBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.btnBackGacha.setOnClickListener { finish() }

        allCards = UpstashRepository.getCards(this)

        setupButtons()
        refreshData()
    }

    private fun setupButtons() {
        binding.btnSinglePull.setOnClickListener {
            doPull(isMulti = false)
        }

        binding.btnMultiPull.setOnClickListener {
            doPull(isMulti = true)
        }
    }

    private fun refreshData() {
        val user = authManager.getUserProfile()
        if (user != null) {
            binding.tvGachaUserCoins.text = "${user.coins} 🪙"
        }

        val uid = authManager.userId ?: return
        binding.pbGachaLoading.visibility = View.VISIBLE

        lifecycleScope.launch {
            try {
                // Refresh profile to get updated coins
                val remoteProfile = UpstashRepository.getProfile(uid)
                if (remoteProfile != null) {
                    authManager.saveUserProfile(remoteProfile)
                    binding.tvGachaUserCoins.text = "${remoteProfile.coins} 🪙"
                }

                myCards = UpstashRepository.getUserCards(uid)
                bindMyCards()
            } catch (e: Exception) {
                // error
            } finally {
                binding.pbGachaLoading.visibility = View.GONE
            }
        }
    }

    private fun bindMyCards() {
        val countMap = myCards.associate { it.cardId to it.count }
        val unlockedCardIds = countMap.keys
        val displayCards = allCards.filter { it.id in unlockedCardIds }

        binding.tvMyCardsTitle.text = "Koleksi Kartu Saya (${displayCards.size}/${allCards.size})"

        binding.rvMyCards.layoutManager = GridLayoutManager(this, 3)
        binding.rvMyCards.adapter = GachaCardAdapter(displayCards, countMap) { card ->
            showCardDetailDialog(card)
        }
    }

    private fun doPull(isMulti: Boolean) {
        val uid = authManager.userId
        if (uid.isNullOrBlank()) {
            Toast.makeText(this, "Silakan login terlebih dahulu untuk gacha", Toast.LENGTH_SHORT).show()
            return
        }

        val cost = if (isMulti) 900L else 100L
        val user = authManager.getUserProfile()
        if ((user?.coins ?: 0L) < cost) {
            Toast.makeText(this, "Koin kamu tidak cukup (butuh $cost 🪙). Tonton anime untuk menambah koin!", Toast.LENGTH_LONG).show()
            return
        }

        binding.btnSinglePull.isEnabled = false
        binding.btnMultiPull.isEnabled = false
        binding.pbGachaLoading.visibility = View.VISIBLE

        lifecycleScope.launch {
            try {
                val (success, pulled) = UpstashRepository.pullGacha(uid, isMulti)
                if (success && pulled.isNotEmpty()) {
                    showSummonResultDialog(pulled)
                    refreshData()
                } else {
                    Toast.makeText(this@GachaActivity, "Koin tidak cukup atau terjadi kesalahan", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(this@GachaActivity, "Gagal melakukan summon: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
            } finally {
                binding.btnSinglePull.isEnabled = true
                binding.btnMultiPull.isEnabled = true
                binding.pbGachaLoading.visibility = View.GONE
            }
        }
    }

    private fun showSummonResultDialog(pulled: List<CardItem>) {
        val view = LayoutInflater.from(this).inflate(R.layout.dialog_summon_result, null)
        val rv = view.findViewById<RecyclerView>(R.id.rvSummonResult)
        val btnClose = view.findViewById<MaterialButton>(R.id.btnCloseSummonResult)

        rv.layoutManager = GridLayoutManager(this, if (pulled.size > 1) 2 else 1)
        rv.adapter = GachaCardAdapter(pulled) { card ->
            showCardDetailDialog(card)
        }

        val dialog = AlertDialog.Builder(this)
            .setView(view)
            .create()

        btnClose.setOnClickListener { dialog.dismiss() }
        dialog.show()
    }

    private fun showCardDetailDialog(card: CardItem) {
        val rarityName = when (card.rarity) {
            "UR" -> "Ultra Rare (Mythic)"
            "SSR" -> "Special Super Rare"
            "SR" -> "Super Rare"
            "R" -> "Rare"
            else -> "Common"
        }

        val desc = """
            Karakter: ${card.name}
            Anime: ${card.anime ?: "-"}
            Kelangkaan: $rarityName
            Elemen: ${card.element ?: "-"}
            
            ⚔️ ATK: ${card.atk}
            🛡️ DEF: ${card.def}
            ❤️ HP: ${card.hp}
            
            "${card.quote ?: ""}"
            
            ${card.description ?: ""}
        """.trimIndent()

        AlertDialog.Builder(this)
            .setTitle(card.name)
            .setMessage(desc)
            .setPositiveButton("Tutup", null)
            .show()
    }
}
