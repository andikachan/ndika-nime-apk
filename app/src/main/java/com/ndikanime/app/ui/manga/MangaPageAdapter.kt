package com.ndikanime.app.ui.manga

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import coil.load
import com.ndikanime.app.databinding.ItemMangaPageBinding
import java.net.URLEncoder

class MangaPageAdapter(
    private var pages: List<String> = emptyList(),
    private val onPageClick: () -> Unit
) : RecyclerView.Adapter<MangaPageAdapter.ViewHolder>() {

    fun submitList(newPages: List<String>) {
        pages = newPages
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemMangaPageBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(pages[position])
    }

    override fun getItemCount(): Int = pages.size

    inner class ViewHolder(private val binding: ItemMangaPageBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(url: String) {
            binding.progressBar.visibility = View.VISIBLE

            val finalUrl = if (url.startsWith("http")) {
                "https://cfelainawanggy.pages.dev/?action=proxy&url=" + URLEncoder.encode(url, "UTF-8")
            } else url

            binding.ivMangaPage.load(finalUrl) {
                crossfade(true)
                listener(
                    onSuccess = { _, _ ->
                        binding.progressBar.visibility = View.GONE
                    },
                    onError = { _, _ ->
                        binding.progressBar.visibility = View.GONE
                    }
                )
            }

            binding.root.setOnClickListener {
                onPageClick()
            }
        }
    }
}
