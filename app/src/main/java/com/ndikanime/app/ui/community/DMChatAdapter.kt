package com.ndikanime.app.ui.community

import android.graphics.Color
import android.view.Gravity
import android.view.LayoutInflater
import android.view.ViewGroup
import android.widget.LinearLayout
import androidx.recyclerview.widget.RecyclerView
import com.ndikanime.app.data.model.DMMessage
import com.ndikanime.app.databinding.ItemDmMessageBinding
import java.text.SimpleDateFormat
import java.util.*

class DMChatAdapter(
    private val myUserId: String
) : RecyclerView.Adapter<DMChatAdapter.ViewHolder>() {

    private val messages = mutableListOf<DMMessage>()

    inner class ViewHolder(val binding: ItemDmMessageBinding) : RecyclerView.ViewHolder(binding.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemDmMessageBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val msg = messages[position]
        val isMe = msg.senderId == myUserId

        holder.binding.tvDMMessageText.text = msg.text
        if (msg.timestamp > 0) {
            holder.binding.tvDMMessageTime.text = SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(msg.timestamp))
        } else {
            holder.binding.tvDMMessageTime.text = ""
        }

        val params = holder.binding.bubbleContainer.layoutParams as LinearLayout.LayoutParams
        if (isMe) {
            params.gravity = Gravity.END
            holder.binding.bubbleContainer.setBackgroundColor(Color.parseColor("#3A3520"))
            holder.binding.tvDMMessageText.setTextColor(Color.parseColor("#F6CF80"))
        } else {
            params.gravity = Gravity.START
            holder.binding.bubbleContainer.setBackgroundColor(Color.parseColor("#1B1B22"))
            holder.binding.tvDMMessageText.setTextColor(Color.WHITE)
        }
        holder.binding.bubbleContainer.layoutParams = params
    }

    override fun getItemCount(): Int = messages.size

    fun submitList(newMessages: List<DMMessage>) {
        messages.clear()
        messages.addAll(newMessages)
        notifyDataSetChanged()
    }
}
