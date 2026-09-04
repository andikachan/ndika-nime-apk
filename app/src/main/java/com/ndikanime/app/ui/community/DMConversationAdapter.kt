package com.ndikanime.app.ui.community

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import coil.load
import com.ndikanime.app.R
import com.ndikanime.app.data.model.DMConversation
import com.ndikanime.app.databinding.ItemDmConversationBinding
import java.text.SimpleDateFormat
import java.util.*

class DMConversationAdapter(
    private val conversations: List<DMConversation>,
    private val onItemClick: (DMConversation) -> Unit
) : RecyclerView.Adapter<DMConversationAdapter.ViewHolder>() {

    inner class ViewHolder(val binding: ItemDmConversationBinding) : RecyclerView.ViewHolder(binding.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemDmConversationBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val conv = conversations[position]
        holder.binding.tvDMUserName.text = conv.otherUserName
        holder.binding.tvDMLastMessage.text = conv.lastMessage ?: "Mulai percakapan..."

        if (conv.lastTimestamp > 0) {
            holder.binding.tvDMTime.text = SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(conv.lastTimestamp))
        } else {
            holder.binding.tvDMTime.text = ""
        }

        val avatar = conv.otherUserAvatar
        if (!avatar.isNullOrBlank()) {
            holder.binding.ivDMAvatar.load(avatar) { crossfade(true) }
        } else {
            holder.binding.ivDMAvatar.setImageResource(R.drawable.kaguya)
        }

        holder.binding.root.setOnClickListener {
            onItemClick(conv)
        }
    }

    override fun getItemCount(): Int = conversations.size
}
