package com.ndikanime.app.ui.community

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import coil.load
import com.ndikanime.app.R
import com.ndikanime.app.data.model.CommentItem
import com.ndikanime.app.databinding.ItemCommentBinding
import java.text.SimpleDateFormat
import java.util.*

class CommentAdapter(
    private val comments: List<CommentItem>
) : RecyclerView.Adapter<CommentAdapter.ViewHolder>() {

    inner class ViewHolder(val binding: ItemCommentBinding) : RecyclerView.ViewHolder(binding.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemCommentBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val c = comments[position]
        holder.binding.tvCommentName.text = c.name
        holder.binding.tvCommentLevel.text = "Lvl ${c.level}"
        holder.binding.tvCommentText.text = c.text

        if (c.timestamp > 0) {
            holder.binding.tvCommentTime.text = SimpleDateFormat("dd/MM HH:mm", Locale.getDefault()).format(Date(c.timestamp))
        } else {
            holder.binding.tvCommentTime.text = ""
        }

        val avatar = c.avatar
        if (!avatar.isNullOrBlank()) {
            holder.binding.ivCommentAvatar.load(avatar) { crossfade(true) }
        } else {
            holder.binding.ivCommentAvatar.setImageResource(R.drawable.kaguya)
        }
    }

    override fun getItemCount(): Int = comments.size
}
