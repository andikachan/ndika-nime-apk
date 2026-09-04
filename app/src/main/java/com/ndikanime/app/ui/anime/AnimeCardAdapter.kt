package com.ndikanime.app.ui.anime

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import coil.load
import com.ndikanime.app.R
import com.ndikanime.app.data.model.AnimeItem
import com.ndikanime.app.databinding.ItemAnimeCardBinding

class AnimeCardAdapter(
    private var items: List<AnimeItem> = emptyList(),
    private val isGrid: Boolean = false,
    private val onItemClick: (AnimeItem) -> Unit
) : RecyclerView.Adapter<AnimeCardAdapter.ViewHolder>() {

    fun submitList(newItems: List<AnimeItem>) {
        items = newItems
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemAnimeCardBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        if (isGrid) {
            val params = binding.root.layoutParams
            params.width = ViewGroup.LayoutParams.MATCH_PARENT
            binding.root.layoutParams = params
        }
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(items[position])
    }

    override fun getItemCount(): Int = items.size

    inner class ViewHolder(private val binding: ItemAnimeCardBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(item: AnimeItem) {
            binding.tvTitle.text = item.title ?: "Anime"

            val rating = item.getDisplayRating()
            if (rating != null) {
                binding.layoutRating.visibility = View.VISIBLE
                binding.tvRating.text = rating
            } else {
                binding.layoutRating.visibility = View.GONE
            }

            val badge = item.getDisplayEpisode() ?: item.type?.uppercase() ?: "SUB INDO"
            binding.tvBadge.text = badge

            binding.tvSubtitle.text = item.status ?: item.type ?: ""
            binding.tvSubtitle.visibility = if (binding.tvSubtitle.text.isNullOrBlank()) View.GONE else View.VISIBLE

            binding.ivPoster.load(item.getDisplayImage()) {
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
