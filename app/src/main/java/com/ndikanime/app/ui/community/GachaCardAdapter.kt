package com.ndikanime.app.ui.community

import android.graphics.Color
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import coil.load
import com.ndikanime.app.data.model.CardItem
import com.ndikanime.app.databinding.ItemGachaCardBinding

class GachaCardAdapter(
    private val cards: List<CardItem>,
    private val countMap: Map<String, Int> = emptyMap(),
    private val onCardClick: ((CardItem) -> Unit)? = null
) : RecyclerView.Adapter<GachaCardAdapter.ViewHolder>() {

    inner class ViewHolder(val binding: ItemGachaCardBinding) : RecyclerView.ViewHolder(binding.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemGachaCardBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val card = cards[position]
        holder.binding.tvCardName.text = card.name
        holder.binding.tvCardAnime.text = card.anime ?: "Anime"
        holder.binding.tvCardRarity.text = card.rarity
        holder.binding.tvCardAtk.text = "ATK: ${card.atk}"
        holder.binding.tvCardDef.text = "DEF: ${card.def}"

        val count = countMap[card.id] ?: 1
        holder.binding.tvCardCount.visibility = if (count > 1) android.view.View.VISIBLE else android.view.View.GONE
        holder.binding.tvCardCount.text = "x$count"

        // Rarity color border
        val rarityColor = when (card.rarity) {
            "UR" -> Color.parseColor("#FF2A70")
            "SSR" -> Color.parseColor("#F59E0B")
            "SR" -> Color.parseColor("#A855F7")
            "R" -> Color.parseColor("#06B6D4")
            else -> Color.parseColor("#94A3B8")
        }
        holder.binding.root.strokeColor = rarityColor
        holder.binding.tvCardRarity.backgroundTintList = android.content.res.ColorStateList.valueOf(rarityColor)
        holder.binding.tvCardRarity.setTextColor(if (card.rarity == "SSR") Color.BLACK else Color.WHITE)

        val imgUrl = card.image
        if (!imgUrl.isNullOrBlank()) {
            holder.binding.ivCardImage.load(imgUrl) { crossfade(true) }
        }

        holder.binding.root.setOnClickListener {
            onCardClick?.invoke(card)
        }
    }

    override fun getItemCount(): Int = cards.size
}
