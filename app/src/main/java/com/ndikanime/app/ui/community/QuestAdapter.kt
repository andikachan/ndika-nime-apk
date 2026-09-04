package com.ndikanime.app.ui.community

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.ndikanime.app.data.model.QuestItem
import com.ndikanime.app.databinding.ItemQuestBinding

class QuestAdapter(
    private val quests: List<QuestItem>,
    private val onClaimClick: (QuestItem) -> Unit
) : RecyclerView.Adapter<QuestAdapter.ViewHolder>() {

    inner class ViewHolder(val binding: ItemQuestBinding) : RecyclerView.ViewHolder(binding.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemQuestBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val q = quests[position]
        holder.binding.tvQuestTitle.text = q.title
        holder.binding.tvQuestDesc.text = q.desc

        val prog = q.current.coerceAtMost(q.target)
        holder.binding.tvQuestProgress.text = "$prog/${q.target}"

        val pct = if (q.target > 0) ((prog.toFloat() / q.target) * 100).toInt() else 0
        holder.binding.pbQuest.progress = pct

        val isComplete = prog >= q.target
        if (q.isClaimed) {
            holder.binding.btnClaimQuest.text = "Selesai"
            holder.binding.btnClaimQuest.isEnabled = false
        } else if (isComplete) {
            holder.binding.btnClaimQuest.text = "Klaim +${q.rewardCoins} 🪙"
            holder.binding.btnClaimQuest.isEnabled = true
        } else {
            holder.binding.btnClaimQuest.text = "+${q.rewardCoins} 🪙"
            holder.binding.btnClaimQuest.isEnabled = false
        }

        holder.binding.btnClaimQuest.setOnClickListener {
            onClaimClick(q)
        }
    }

    override fun getItemCount(): Int = quests.size
}
