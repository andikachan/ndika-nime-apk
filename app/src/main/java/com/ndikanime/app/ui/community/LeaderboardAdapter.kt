package com.ndikanime.app.ui.community

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import coil.load
import com.ndikanime.app.R
import com.ndikanime.app.data.model.LeaderboardUser
import com.ndikanime.app.databinding.ItemLeaderboardUserBinding

class LeaderboardAdapter(
    private var users: List<LeaderboardUser> = emptyList(),
    private val onUserClick: (LeaderboardUser) -> Unit
) : RecyclerView.Adapter<LeaderboardAdapter.ViewHolder>() {

    fun submitList(newUsers: List<LeaderboardUser>) {
        users = newUsers
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemLeaderboardUserBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(users[position], position + 1)
    }

    override fun getItemCount(): Int = users.size

    inner class ViewHolder(private val binding: ItemLeaderboardUserBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(item: LeaderboardUser, rank: Int) {
            binding.tvRank.text = "#$rank"
            binding.tvLeaderName.text = item.name ?: "User"
            binding.tvLeaderTitle.text = item.title ?: "Wibu Sejati"
            binding.tvLevel.text = "Lv. ${item.level}"
            binding.tvWatchTime.text = item.getFormattedWatchTime()

            when (rank) {
                1 -> binding.tvRank.setTextColor(ContextCompat.getColor(binding.root.context, R.color.accent_gold))
                2 -> binding.tvRank.setTextColor(ContextCompat.getColor(binding.root.context, R.color.white))
                3 -> binding.tvRank.setTextColor(ContextCompat.getColor(binding.root.context, R.color.accent_orange))
                else -> binding.tvRank.setTextColor(ContextCompat.getColor(binding.root.context, R.color.text_muted))
            }

            binding.ivLeaderAvatar.load(item.getDisplayAvatar()) {
                crossfade(true)
                placeholder(R.drawable.nefora_logo)
                error(R.drawable.nefora_logo)
            }

            binding.root.setOnClickListener {
                onUserClick(item)
            }
        }
    }
}
