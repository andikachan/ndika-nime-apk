package com.ndikanime.app.ui.explore

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.ndikanime.app.R
import com.ndikanime.app.data.model.GenreItem
import com.ndikanime.app.databinding.ItemGenreChipBinding

class GenreAdapter(
    private var genres: List<GenreItem> = emptyList(),
    private var selectedId: String? = null,
    private val onGenreClick: (GenreItem) -> Unit
) : RecyclerView.Adapter<GenreAdapter.ViewHolder>() {

    fun submitList(newGenres: List<GenreItem>, selected: String? = null) {
        genres = newGenres
        selectedId = selected
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemGenreChipBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(genres[position])
    }

    override fun getItemCount(): Int = genres.size

    inner class ViewHolder(private val binding: ItemGenreChipBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(item: GenreItem) {
            binding.tvGenreName.text = item.getDisplayName()

            val isSelected = (item.id == selectedId)
            if (isSelected) {
                binding.tvGenreName.setBackgroundResource(R.drawable.bg_badge_gold)
                binding.tvGenreName.setTextColor(
                    ContextCompat.getColor(binding.root.context, R.color.bg_dark)
                )
            } else {
                binding.tvGenreName.setBackgroundResource(R.drawable.bg_search_input)
                binding.tvGenreName.setTextColor(
                    ContextCompat.getColor(binding.root.context, R.color.text_secondary)
                )
            }

            binding.root.setOnClickListener {
                onGenreClick(item)
            }
        }
    }
}
