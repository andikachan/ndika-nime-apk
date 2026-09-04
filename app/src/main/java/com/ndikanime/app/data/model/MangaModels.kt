package com.ndikanime.app.data.model

import android.os.Parcelable
import com.google.gson.annotations.SerializedName
import kotlinx.parcelize.Parcelize

data class MangaListResponse(
    @SerializedName("status") val status: Boolean? = null,
    @SerializedName("success") val success: Boolean? = null,
    @SerializedName("data") val data: List<MangaItem>? = null
)

@Parcelize
data class MangaItem(
    @SerializedName("title") val title: String? = null,
    @SerializedName("slug") val slug: String? = null,
    @SerializedName("cover") val cover: String? = null,
    @SerializedName("badge") val badge: String? = null,
    @SerializedName("chapters") val chapters: Any? = null
) : Parcelable {
    fun getDisplayCover(): String {
        val raw = cover ?: ""
        return if (raw.isNotBlank()) {
            "https://cfelainawanggy.pages.dev/?action=proxy&url=" + java.net.URLEncoder.encode(raw, "UTF-8")
        } else ""
    }

    fun getDisplayChapter(): String? {
        if (chapters is List<*> && chapters.isNotEmpty()) {
            val first = chapters[0]
            if (first is Map<*, *>) {
                return first["title"]?.toString()
            }
        }
        return badge
    }
}

data class MangaDetailResponse(
    @SerializedName("status") val status: Boolean? = null,
    @SerializedName("success") val success: Boolean? = null,
    @SerializedName("data") val data: MangaDetail? = null
)

data class MangaDetail(
    @SerializedName("title") val title: String? = null,
    @SerializedName("cover") val cover: String? = null,
    @SerializedName("big_cover") val bigCover: String? = null,
    @SerializedName("sinopsis") val sinopsis: String? = null,
    @SerializedName("slug") val slug: String? = null,
    @SerializedName("badge") val badge: String? = null,
    @SerializedName("rating") val rating: String? = null,
    @SerializedName("status") val status: String? = null,
    @SerializedName("published") val published: String? = null,
    @SerializedName("author") val author: String? = null,
    @SerializedName("genre") val genre: Any? = null,
    @SerializedName("chapters") val chapters: List<MangaChapterItem>? = null
) {
    fun getDisplayCover(): String {
        val raw = bigCover ?: cover ?: ""
        return if (raw.isNotBlank()) {
            "https://cfelainawanggy.pages.dev/?action=proxy&url=" + java.net.URLEncoder.encode(raw, "UTF-8")
        } else ""
    }

    fun getDisplayGenres(): List<String> {
        return when (genre) {
            is List<*> -> genre.mapNotNull { it?.toString() }
            is String -> genre.split(",").map { it.trim() }.filter { it.isNotEmpty() }
            else -> emptyList()
        }
    }
}

@Parcelize
data class MangaChapterItem(
    @SerializedName("title") val title: String? = null,
    @SerializedName("slug") val slug: String? = null,
    @SerializedName("time") val time: String? = null,
    @SerializedName("date") val date: String? = null
) : Parcelable

data class MangaReadResponse(
    @SerializedName("status") val status: Boolean? = null,
    @SerializedName("success") val success: Boolean? = null,
    @SerializedName("data") val data: MangaReadData? = null
)

data class MangaReadData(
    @SerializedName("title") val title: String? = null,
    @SerializedName("chapter_title") val chapterTitle: String? = null,
    @SerializedName("cover") val cover: String? = null,
    @SerializedName("chapter") val chapter: String? = null,
    @SerializedName("slug_manga") val slugManga: String? = null,
    @SerializedName("pages") val pages: List<String>? = null,
    @SerializedName("other_chapters") val otherChapters: List<MangaChapterItem>? = null
)
