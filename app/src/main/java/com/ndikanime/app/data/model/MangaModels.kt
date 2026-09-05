package com.ndikanime.app.data.model

import android.os.Parcelable
import com.google.gson.annotations.SerializedName
import kotlinx.parcelize.Parcelize
import kotlinx.parcelize.RawValue

data class MangaListResponse(
    @SerializedName("status") val status: Boolean? = null,
    @SerializedName("success") val success: Boolean? = null,
    @SerializedName("data") val data: MangaListData? = null
)

data class MangaListData(
    @SerializedName("slider_list") val sliderList: List<MangaHeroItem>? = null,
    @SerializedName("popular_list") val popularList: List<MangaItem>? = null,
    @SerializedName("manga_list") val mangaList: List<MangaItem>? = null,
    @SerializedName("list") val list: List<MangaItem>? = null
)

@Parcelize
data class MangaHeroItem(
    @SerializedName("title") val title: String? = null,
    @SerializedName("slug") val slug: String? = null,
    @SerializedName("poster") val poster: String? = null,
    @SerializedName("cover") val cover: String? = null,
    @SerializedName("latest_chapter") val latestChapter: String? = null
) : Parcelable

@Parcelize
data class MangaItem(
    @SerializedName("title") val title: String? = null,
    @SerializedName("slug") val slug: String? = null,
    @SerializedName("poster") val poster: String? = null,
    @SerializedName("cover") val cover: String? = null,
    @SerializedName("badge") val badge: String? = null,
    @SerializedName("chapters") val chapters: @RawValue Any? = null
) : Parcelable {
    fun getEffectiveSlug(): String = slug ?: ""

    fun getDisplayCover(): String {
        val raw = poster ?: cover ?: ""
        return if (raw.isNotBlank()) {
            "https://cfelainawanggy.pages.dev/?action=proxy&url=" + java.net.URLEncoder.encode(raw, "UTF-8")
        } else ""
    }

    fun getDisplayChapter(): String {
        if (chapters is List<*> && chapters.isNotEmpty()) {
            val first = chapters[0]
            if (first is Map<*, *>) {
                val num = first["chapterNum"]?.toString() ?: first["chapter"]?.toString() ?: first["title"]?.toString()
                if (!num.isNullOrBlank()) {
                    return if (num.startsWith("Ch", ignoreCase = true) || num.startsWith("Chapter", ignoreCase = true)) num else "Ch. $num"
                }
            }
        }
        return badge ?: "Ch. 1"
    }
}

data class MangaDetailResponse(
    @SerializedName("status") val status: Boolean? = null,
    @SerializedName("success") val success: Boolean? = null,
    @SerializedName("data") val data: MangaDetailData? = null
)

data class MangaDetailData(
    @SerializedName("title") val title: String? = null,
    @SerializedName("poster") val poster: String? = null,
    @SerializedName("cover") val cover: String? = null,
    @SerializedName("big_cover") val bigCover: String? = null,
    @SerializedName("sinopsis") val synopsis: String? = null,
    @SerializedName("slug") val slug: String? = null,
    @SerializedName("badge") val badge: String? = null,
    @SerializedName("rating") val rating: String? = null,
    @SerializedName("status") val status: String? = null,
    @SerializedName("published") val published: String? = null,
    @SerializedName("author") val author: String? = null,
    @SerializedName("genre") val genre: Any? = null,
    @SerializedName("chapter_list") val chapterList: List<MangaChapterItem>? = null,
    @SerializedName("chapters") val chapters: List<MangaChapterItem>? = null
) {
    fun getEffectiveChapters(): List<MangaChapterItem> = chapterList ?: chapters ?: emptyList()
}

@Parcelize
data class MangaChapterItem(
    @SerializedName("title") val title: String? = null,
    @SerializedName("chapterNum") val chapterNum: String? = null,
    @SerializedName("chapter") val chapter: String? = null,
    @SerializedName("slug") val slug: String? = null,
    @SerializedName("time") val time: String? = null,
    @SerializedName("date") val date: String? = null,
    @SerializedName("release_date") val releaseDate: String? = null
) : Parcelable {
    fun getDisplayTitle(): String {
        val num = chapterNum ?: chapter
        if (!num.isNullOrBlank()) {
            return if (num.startsWith("Ch", ignoreCase = true) || num.startsWith("Chapter", ignoreCase = true)) num else "Chapter $num"
        }
        val t = title?.trim() ?: ""
        return if (t.isNotBlank()) t else "Chapter"
    }
}

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
    @SerializedName("image_urls") val imageUrls: List<String>? = null,
    @SerializedName("prev_slug") val prevSlug: String? = null,
    @SerializedName("next_slug") val nextSlug: String? = null,
    @SerializedName("other_chapters") val otherChapters: List<MangaChapterItem>? = null
) {
    fun getEffectiveImages(): List<String> = imageUrls ?: pages ?: emptyList()
}
