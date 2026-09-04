package com.ndikanime.app.ui.community

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import coil.load
import com.ndikanime.app.R
import com.ndikanime.app.data.model.W2GMember
import com.ndikanime.app.databinding.ItemW2gMemberBinding

class W2GMemberAdapter(
    private var members: List<W2GMember> = emptyList()
) : RecyclerView.Adapter<W2GMemberAdapter.ViewHolder>() {

    fun submitList(newMembers: List<W2GMember>) {
        members = newMembers
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemW2gMemberBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(members[position])
    }

    override fun getItemCount(): Int = members.size

    inner class ViewHolder(private val binding: ItemW2gMemberBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(item: W2GMember) {
            binding.tvW2GMemberName.text = item.name ?: "Penonton"
            val isHost = item.role.equals("host", ignoreCase = true)
            binding.tvW2GMemberBadge.visibility = if (isHost) View.VISIBLE else View.GONE
            binding.tvW2GMemberBadge.text = if (isHost) "HOST" else ""

            val titleStr = buildString {
                append("Lv. ${item.level}")
                if (!item.title.isNullOrBlank()) append(" • ${item.title}")
                if (!item.clanBadge.isNullOrBlank()) append(" [${item.clanBadge}]")
            }
            binding.tvW2GMemberTitle.text = titleStr

            val avatar = item.avatar
            if (!avatar.isNullOrBlank()) {
                val url = if (avatar.startsWith("/")) "https://api.dicebear.com/7.x/bottts/png?seed=${avatar.hashCode()}" else avatar
                binding.ivW2GMemberAvatar.load(url) { crossfade(true) }
            } else {
                binding.ivW2GMemberAvatar.setImageResource(R.drawable.kaguya)
            }
        }
    }
}
