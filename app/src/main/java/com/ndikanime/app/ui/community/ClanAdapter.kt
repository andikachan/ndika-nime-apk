package com.ndikanime.app.ui.community

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.ndikanime.app.data.model.ClanItem
import com.ndikanime.app.databinding.ItemClanBinding

class ClanAdapter(
    private val clans: List<ClanItem>,
    private val onJoinClick: (ClanItem) -> Unit
) : RecyclerView.Adapter<ClanAdapter.ViewHolder>() {

    inner class ViewHolder(val binding: ItemClanBinding) : RecyclerView.ViewHolder(binding.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemClanBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val clan = clans[position]
        holder.binding.tvClanName.text = clan.name
        holder.binding.tvClanTag.text = "[${clan.tag ?: "CLAN"}]"
        holder.binding.tvClanDesc.text = clan.description ?: "Komunitas pencinta anime"
        holder.binding.tvClanStats.text = "Level ${clan.level} • ${clan.memberCount} Anggota • Ketua: ${clan.leaderName ?: "-"}"
        holder.binding.tvClanIcon.text = clan.icon ?: "⚔️"

        holder.binding.btnJoinClan.setOnClickListener {
            onJoinClick(clan)
        }
    }

    override fun getItemCount(): Int = clans.size
}
