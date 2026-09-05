package com.ndikanime.app.data.model

import android.os.Parcelable
import com.google.gson.annotations.SerializedName
import kotlinx.parcelize.Parcelize

data class AnimeListResponse(
    @SerializedName("status") val status: Boolean = false,
    @SerializedName("total") val total: Int? = null,
    @SerializedName("data") val data: List<AnimeItem>? = null
)

@Parcelize
data class AnimeItem(
    @SerializedName("id") val id: String? = null,
    @SerializedName("title") val title: String? = null,
    @SerializedName("synopsis") val synopsis: String? = null,
    @SerializedName("image_poster") val imagePoster: String? = null,
    @SerializedName("image_cover") val imageCover: String? = null,
    @SerializedName("cover") val cover: String? = null,
    @SerializedName("type") val type: String? = null,
    @SerializedName("status") val status: String? = null,
    @SerializedName("rating") val rating: String? = null,
    @SerializedName("score") val score: String? = null,
    @SerializedName("episode") val episode: String? = null
) : Parcelable {
    fun getDisplayImage(): String {
        val raw = imagePoster ?: imageCover ?: cover ?: ""
        return if (raw.isNotBlank()) {
            "https://cfelainawanggy.pages.dev/?action=proxy&url=" + java.net.URLEncoder.encode(raw, "UTF-8")
        } else ""
    }

    fun getDisplayRating(): String? {
        val r = rating ?: score
        return if (!r.isNullOrBlank() && r != "0") r else null
    }

    fun getDisplayEpisode(): String? {
        return if (!episode.isNullOrBlank()) "EP $episode" else null
    }
}

data class ScheduleResponse(
    @SerializedName("status") val status: Boolean = false,
    @SerializedName("data") val data: Map<String, List<AnimeItem>>? = null
)

data class AnimeDetailResponse(
    @SerializedName("status") val status: Boolean = false,
    @SerializedName("data") val data: AnimeDetail? = null
)

data class AnimeDetail(
    @SerializedName("id") val id: String? = null,
    @SerializedName("title") val title: String? = null,
    @SerializedName("synopsis") val synopsis: String? = null,
    @SerializedName("synonyms") val synonyms: String? = null,
    @SerializedName("image_poster") val imagePoster: String? = null,
    @SerializedName("image_cover") val imageCover: String? = null,
    @SerializedName("type") val type: String? = null,
    @SerializedName("year") val year: String? = null,
    @SerializedName("day") val day: String? = null,
    @SerializedName("status") val status: String? = null,
    @SerializedName("views") val views: String? = null,
    @SerializedName("studio") val studio: String? = null,
    @SerializedName("genre") val genre: Any? = null,
    @SerializedName("episode_list") val episodeList: List<EpisodeItem>? = null
) {
    fun getDisplayPoster(): String {
        val raw = imagePoster ?: imageCover ?: ""
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
data class EpisodeItem(
    @SerializedName("id") val id: String? = null,
    @SerializedName("index") val index: String? = null,
    @SerializedName("title") val title: String? = null,
    @SerializedName("views") val views: String? = null,
    @SerializedName("id_movie") val idMovie: String? = null,
    @SerializedName("key_time") val keyTime: String? = null,
    @SerializedName("image") val image: String? = null
) : Parcelable

data class EpisodeDetailResponse(
    @SerializedName("status") val status: Boolean = false,
    @SerializedName("data") val data: EpisodeDetailData? = null
)

data class EpisodeDetailData(
    @SerializedName("episode") val episode: EpisodeItem? = null,
    @SerializedName("server") val server: List<ServerItem>? = null,
    @SerializedName("next_episode") val nextEpisode: EpisodeItem? = null,
    @SerializedName("prev_episode") val prevEpisode: EpisodeItem? = null
)

data class ServerItem(
    @SerializedName("id") val id: String? = null,
    @SerializedName("link") val link: String? = null,
    @SerializedName("quality") val quality: String? = null,
    @SerializedName("name") val name: String? = null,
    @SerializedName("type") val type: String? = null
) {
    fun getStreamingUrl(): String {
        val l = link ?: return ""
        return "https://cfelainawanggy.pages.dev/?action=stream&url=" + java.net.URLEncoder.encode(l, "UTF-8")
    }
}

data class GenreListResponse(
    @SerializedName("status") val status: Boolean = false,
    @SerializedName("data") val data: List<GenreItem>? = null
)

data class GenreItem(
    @SerializedName("id") val id: String? = null,
    @SerializedName("name") val name: String? = null,
    @SerializedName("title") val title: String? = null,
    @SerializedName("group") val group: String? = null,
    @SerializedName("total") val total: String? = null,
    val isSelected: Boolean = false
) {
    fun getDisplayName(): String = name ?: title ?: ""
}
