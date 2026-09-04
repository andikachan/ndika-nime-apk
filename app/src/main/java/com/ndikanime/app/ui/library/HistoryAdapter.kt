package com.ndikanime.app.ui.library

import android.text.format.DateUtils
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import coil.load
import com.ndikanime.app.R
import com.ndikanime.app.data.model.HistoryItem
import com.ndikanime.app.databinding.ItemHistoryCardBinding

class HistoryAdapter(
    private var items: List<HistoryItem> = emptyList(),
    private val onItemClick: (HistoryItem) -> Unit,
    private val onDeleteClick: (HistoryItem) -> Unit
) : RecyclerView.Adapter<HistoryAdapter.ViewHolder>() {

    fun submitList(newItems: List<HistoryItem>) {
        items = newItems
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemHistoryCardBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(items[position])
    }

    override fun getItemCount(): Int = items.size

    inner class ViewHolder(private val binding: ItemHistoryCardBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(item: HistoryItem) {
            binding.tvTitle.text = item.title
            binding.tvSubInfo.text = item.subInfo

            val timeAgo = DateUtils.getRelativeTimeSpanString(
                item.timestamp,
                System.currentTimeMillis(),
                DateUtils.MINUTE_IN_MILLIS
            )
            binding.tvTimestamp.text = timeAgo

            binding.ivCover.load(item.getDisplayCover()) {
                crossfade(true)
                placeholder(R.drawable.kaguya)
                error(R.drawable.kaguya)
            }

            binding.root.setOnClickListener {
                onItemClick(item)
            }

            binding.btnDelete.setOnClickListener {
                onDeleteClick(item)
            }
        }
    }
}
