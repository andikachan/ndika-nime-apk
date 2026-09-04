package com.ndikanime.app.ui.community

import android.text.format.DateFormat
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import coil.load
import com.ndikanime.app.R
import com.ndikanime.app.data.model.ChatMessage
import com.ndikanime.app.databinding.ItemChatMessageBinding
import java.util.Date

class ChatAdapter(
    private var messages: List<ChatMessage> = emptyList(),
    private val onUserClick: ((ChatMessage) -> Unit)? = null
) : RecyclerView.Adapter<ChatAdapter.ViewHolder>() {

    fun submitList(newMessages: List<ChatMessage>) {
        messages = newMessages
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemChatMessageBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(messages[position])
    }

    override fun getItemCount(): Int = messages.size

    inner class ViewHolder(private val binding: ItemChatMessageBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(item: ChatMessage) {
            binding.tvSenderName.text = item.name ?: "User"
            binding.tvChatMessage.text = item.message ?: ""

            val timeMs = item.timestampMs ?: System.currentTimeMillis()
            binding.tvChatTime.text = DateFormat.format("HH:mm", Date(timeMs))

            binding.ivUserAvatar.setOnClickListener {
                onUserClick?.invoke(item)
            }
            binding.tvSenderName.setOnClickListener {
                onUserClick?.invoke(item)
            }

            binding.ivUserAvatar.load(item.getDisplayAvatar()) {
                crossfade(true)
                placeholder(R.drawable.nefora_logo)
                error(R.drawable.nefora_logo)
            }
        }
    }
}
