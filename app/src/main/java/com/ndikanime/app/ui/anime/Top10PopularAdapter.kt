package com.ndikanime.app.ui.anime

import android.graphics.Color
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import coil.load
import com.ndikanime.app.R
import com.ndikanime.app.data.model.AnimeItem
import com.ndikanime.app.databinding.ItemTopPopularCardBinding

class Top10PopularAdapter(
    private var items: List<AnimeItem> = emptyList(),
    private val onItemClick: (AnimeItem) -> Unit
) : RecyclerView.Adapter<Top10PopularAdapter.ViewHolder>() {

    fun submitList(newItems: List<AnimeItem>) {
        items = if (newItems.size > 10) newItems.take(10) else newItems
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemTopPopularCardBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(items[position], position)
    }

    override fun getItemCount(): Int = items.size

    inner class ViewHolder(private val binding: ItemTopPopularCardBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(item: AnimeItem, position: Int) {
            val rank = position + 1
            binding.tvRankBadge.text = "#$rank"

            when (position) {
                0 -> {
                    binding.tvRankBadge.setBackgroundResource(R.drawable.bg_rank_gold)
                    binding.tvRankBadge.setTextColor(Color.parseColor("#0B0B10"))
                }
                1 -> {
                    binding.tvRankBadge.setBackgroundResource(R.drawable.bg_rank_silver)
                    binding.tvRankBadge.setTextColor(Color.parseColor("#0B0B10"))
                }
                2 -> {
                    binding.tvRankBadge.setBackgroundResource(R.drawable.bg_rank_bronze)
                    binding.tvRankBadge.setTextColor(Color.parseColor("#0B0B10"))
                }
                else -> {
                    binding.tvRankBadge.setBackgroundResource(R.drawable.bg_rank_dark)
                    binding.tvRankBadge.setTextColor(ContextCompat.getColor(binding.root.context, R.color.text_secondary))
                }
            }

            binding.tvPopularTitle.text = item.title ?: "Anime"
            binding.tvPopularType.text = item.type ?: "TV Series"

            binding.ivPopularPoster.load(item.getDisplayImage()) {
                crossfade(true)
                placeholder(R.drawable.kaguya)
                error(R.drawable.kaguya)
            }

            binding.root.setOnClickListener {
                onItemClick(item)
            }
        }
    }
}
