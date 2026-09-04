package com.ndikanime.app.data.model

import android.os.Parcelable
import com.google.gson.annotations.SerializedName
import kotlinx.parcelize.Parcelize

@Parcelize
data class HistoryItem(
    @SerializedName("id") val id: String,
    @SerializedName("type") val type: String, // "anime" or "manga"
    @SerializedName("title") val title: String,
    @SerializedName("cover") val cover: String,
    @SerializedName("subInfo") val subInfo: String,
    @SerializedName("timestamp") val timestamp: Long = System.currentTimeMillis(),
    @SerializedName("progressMs") val progressMs: Long = 0L,
    @SerializedName("isFavorite") var isFavorite: Boolean = false
) : Parcelable {
    fun getDisplayCover(): String {
        val raw = cover.trim()
        return if (raw.isNotBlank()) {
            if (raw.startsWith("http")) {
                "https://cfelainawanggy.pages.dev/?action=proxy&url=" + java.net.URLEncoder.encode(raw, "UTF-8")
            } else raw
        } else ""
    }
}

