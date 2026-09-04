package com.ndikanime.app.ui.community

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import coil.load
import com.ndikanime.app.R
import com.ndikanime.app.data.model.AnimeItem
import com.ndikanime.app.databinding.ItemAnimePickerBinding

class SearchAnimePickerAdapter(
    private var list: List<AnimeItem> = emptyList(),
    private val onSelected: (AnimeItem) -> Unit
) : RecyclerView.Adapter<SearchAnimePickerAdapter.ViewHolder>() {

    fun submitList(newList: List<AnimeItem>) {
        list = newList
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemAnimePickerBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(list[position])
    }

    override fun getItemCount(): Int = list.size

    inner class ViewHolder(private val binding: ItemAnimePickerBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(item: AnimeItem) {
            binding.tvPickerTitle.text = item.title ?: "Anime"
            binding.tvPickerType.text = "${item.type ?: "TV"} • ${item.status ?: "Anime"}"

            val poster = item.imagePoster ?: item.imageCover ?: item.cover ?: ""
            if (poster.isNotBlank()) {
                val url = if (poster.startsWith("http")) {
                    "https://cfelainawanggy.pages.dev/?action=proxy&url=" + java.net.URLEncoder.encode(poster, "UTF-8")
                } else poster
                binding.ivPickerPoster.load(url) { crossfade(true) }
            } else {
                binding.ivPickerPoster.setImageResource(R.drawable.nefora_logo)
            }

            binding.root.setOnClickListener {
                onSelected(item)
            }
        }
    }
}
