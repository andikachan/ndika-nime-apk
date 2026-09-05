package com.ndikanime.app.ui.explore

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import coil.load
import com.ndikanime.app.R
import com.ndikanime.app.data.model.UserProfile
import com.ndikanime.app.databinding.ItemUserResultBinding

class UserResultAdapter(
    private var items: List<UserProfile> = emptyList(),
    private val onItemClick: (UserProfile) -> Unit
) : RecyclerView.Adapter<UserResultAdapter.ViewHolder>() {

    fun submitList(newItems: List<UserProfile>) {
        items = newItems
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemUserResultBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(items[position])
    }

    override fun getItemCount(): Int = items.size

    inner class ViewHolder(private val binding: ItemUserResultBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(item: UserProfile) {
            binding.tvUserName.text = item.name
            binding.tvUserEmail.text = item.email ?: item.id
            binding.tvUserLevel.text = "Lv.${item.level}"
            binding.tvUserTitle.text = item.title

            val avatar = item.picture
            if (!avatar.isNullOrBlank()) {
                val url = if (avatar.startsWith("/")) "https://api.dicebear.com/7.x/bottts/png?seed=${avatar.hashCode()}" else avatar
                binding.ivUserAvatar.load(url) {
                    crossfade(true)
                    placeholder(R.drawable.kaguya)
                    error(R.drawable.kaguya)
                }
            } else {
                binding.ivUserAvatar.setImageResource(R.drawable.kaguya)
            }

            binding.root.setOnClickListener {
                onItemClick(item)
            }
        }
    }
}
