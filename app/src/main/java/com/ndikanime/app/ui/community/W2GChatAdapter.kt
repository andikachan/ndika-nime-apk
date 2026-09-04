package com.ndikanime.app.ui.community

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import coil.load
import com.ndikanime.app.R
import com.ndikanime.app.data.model.W2GChatItem
import com.ndikanime.app.databinding.ItemW2gChatBinding
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class W2GChatAdapter(
    private var messages: List<W2GChatItem> = emptyList()
) : RecyclerView.Adapter<W2GChatAdapter.ViewHolder>() {

    private val timeFormat = SimpleDateFormat("HH:mm", Locale.getDefault())

    fun submitList(newMessages: List<W2GChatItem>) {
        messages = newMessages
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemW2gChatBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(messages[position])
    }

    override fun getItemCount(): Int = messages.size

    inner class ViewHolder(private val binding: ItemW2gChatBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(item: W2GChatItem) {
            binding.tvW2GChatUser.text = item.userName ?: "User"
            binding.tvW2GChatText.text = item.text ?: ""
            if (item.timestamp > 0) {
                binding.tvW2GChatTime.text = timeFormat.format(Date(item.timestamp))
            } else {
                binding.tvW2GChatTime.text = ""
            }

            val avatar = item.userAvatar
            if (!avatar.isNullOrBlank()) {
                val url = if (avatar.startsWith("/")) "https://api.dicebear.com/7.x/bottts/png?seed=${avatar.hashCode()}" else avatar
                binding.ivW2GChatAvatar.load(url) { crossfade(true) }
            } else {
                binding.ivW2GChatAvatar.setImageResource(R.drawable.kaguya)
            }
        }
    }
}
