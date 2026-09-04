package com.ndikanime.app.ui.manga

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.ndikanime.app.data.model.MangaChapterItem
import com.ndikanime.app.databinding.ItemChapterBinding

class ChapterAdapter(
    private var chapters: List<MangaChapterItem> = emptyList(),
    private val onChapterClick: (MangaChapterItem) -> Unit
) : RecyclerView.Adapter<ChapterAdapter.ViewHolder>() {

    fun submitList(newChapters: List<MangaChapterItem>) {
        chapters = newChapters
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemChapterBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(chapters[position])
    }

    override fun getItemCount(): Int = chapters.size

    inner class ViewHolder(private val binding: ItemChapterBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(item: MangaChapterItem) {
            binding.tvChapterTitle.text = item.getDisplayTitle()
            binding.tvChapterDate.text = item.getDisplayDate()

            binding.root.setOnClickListener {
                onChapterClick(item)
            }
        }
    }
}
