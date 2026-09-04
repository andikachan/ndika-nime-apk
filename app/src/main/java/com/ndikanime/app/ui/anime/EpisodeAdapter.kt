package com.ndikanime.app.ui.anime

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.ndikanime.app.R
import com.ndikanime.app.data.model.EpisodeItem
import com.ndikanime.app.databinding.ItemEpisodeChipBinding

class EpisodeAdapter(
    private var episodes: List<EpisodeItem> = emptyList(),
    private var currentEpId: String? = null,
    private val onEpisodeClick: (EpisodeItem) -> Unit
) : RecyclerView.Adapter<EpisodeAdapter.ViewHolder>() {

    fun submitList(newEpisodes: List<EpisodeItem>, currentId: String? = null) {
        episodes = newEpisodes
        currentEpId = currentId
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemEpisodeChipBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(episodes[position])
    }

    override fun getItemCount(): Int = episodes.size

    inner class ViewHolder(private val binding: ItemEpisodeChipBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(item: EpisodeItem) {
            binding.tvEpTitle.text = item.title ?: "Episode ${item.index ?: (adapterPosition + 1)}"

            val viewsText = if (!item.views.isNullOrBlank()) "${item.views} views" else ""
            val timeText = item.keyTime ?: ""
            val meta = listOf(viewsText, timeText).filter { it.isNotBlank() }.joinToString(" • ")
            binding.tvEpMeta.text = meta

            val isSelected = (item.id == currentEpId)
            if (isSelected) {
                binding.cardEpisode.setCardBackgroundColor(
                    ContextCompat.getColor(binding.root.context, R.color.bg_card_secondary)
                )
                binding.cardEpisode.strokeColor =
                    ContextCompat.getColor(binding.root.context, R.color.accent_gold)
                binding.tvEpTitle.setTextColor(
                    ContextCompat.getColor(binding.root.context, R.color.accent_gold)
                )
            } else {
                binding.cardEpisode.setCardBackgroundColor(
                    ContextCompat.getColor(binding.root.context, R.color.bg_card)
                )
                binding.cardEpisode.strokeColor =
                    ContextCompat.getColor(binding.root.context, R.color.border_subtle)
                binding.tvEpTitle.setTextColor(
                    ContextCompat.getColor(binding.root.context, R.color.text_primary)
                )
            }

            binding.root.setOnClickListener {
                onEpisodeClick(item)
            }
        }
    }
}
