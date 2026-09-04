package com.ndikanime.app.ui.community

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import coil.load
import com.ndikanime.app.R
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
            binding.tvRoomTitle.text = item.title ?: "Room Nonton Bareng"
            binding.tvRoomAnime.text = item.animeTitle ?: "Video Bersama"
            binding.tvRoomEpisode.text = "Episode ${item.episodeIndex ?: "1"}"
            binding.tvRoomHost.text = "Host: ${item.hostName ?: "User"} • ${item.activeCount} Penonton"
            binding.ivRoomLock.visibility = if (item.hasPasscode) View.VISIBLE else View.GONE

            val posterUrl = item.getDisplayPoster()
            if (posterUrl.isNotBlank()) {
                binding.ivRoomPoster.load(posterUrl) {
                    crossfade(true)
                }
            } else {
                binding.ivRoomPoster.setImageResource(R.drawable.nefora_logo)
            }

            binding.btnJoinRoom.setOnClickListener {
                onJoinClick(item)
            }
            binding.root.setOnClickListener {
                onJoinClick(item)
            }
        }
    }
}
