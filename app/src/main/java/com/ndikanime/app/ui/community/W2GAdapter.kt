package com.ndikanime.app.ui.community

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.ndikanime.app.data.model.W2GRoom
import com.ndikanime.app.databinding.ItemW2gRoomBinding

class W2GAdapter(
    private var rooms: List<W2GRoom> = emptyList(),
    private val onJoinClick: (W2GRoom) -> Unit
) : RecyclerView.Adapter<W2GAdapter.ViewHolder>() {

    fun submitList(newRooms: List<W2GRoom>) {
        rooms = newRooms
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemW2gRoomBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(rooms[position])
    }

    override fun getItemCount(): Int = rooms.size

    inner class ViewHolder(private val binding: ItemW2gRoomBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(item: W2GRoom) {
            binding.tvRoomAnime.text = item.animeTitle ?: "Nonton Bareng"
            binding.tvRoomEpisode.text = item.episodeTitle ?: "Episode Live"
            binding.tvRoomHost.text = "Host: ${item.hostName ?: "Admin"} • ${item.membersCount ?: 1} Penonton"

            binding.btnJoinRoom.setOnClickListener {
                onJoinClick(item)
            }
        }
    }
}
