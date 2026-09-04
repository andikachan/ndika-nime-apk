package com.ndikanime.app.ui.manga

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import coil.load
import com.ndikanime.app.R
import com.ndikanime.app.data.model.MangaItem
import com.ndikanime.app.databinding.ItemMangaCardBinding

class MangaCardAdapter(
    private var items: List<MangaItem> = emptyList(),
    private val isGrid: Boolean = false,
    private val onItemClick: (MangaItem) -> Unit
) : RecyclerView.Adapter<MangaCardAdapter.ViewHolder>() {

    fun submitList(newItems: List<MangaItem>) {
        items = newItems
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemMangaCardBinding.inflate(
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

    inner class ViewHolder(private val binding: ItemMangaCardBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(item: MangaItem) {
            binding.tvTitle.text = item.title ?: "Komik"

            val badge = item.badge
            if (!badge.isNullOrBlank()) {
                binding.tvBadge.visibility = View.VISIBLE
                binding.tvBadge.text = badge
            } else {
                binding.tvBadge.visibility = View.GONE
            }

            val ch = item.getDisplayChapter()
            binding.tvChapter.text = ch ?: ""
            binding.tvChapter.visibility = if (ch.isNullOrBlank()) View.GONE else View.VISIBLE

            binding.ivCover.load(item.getDisplayCover()) {
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
