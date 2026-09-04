package com.ndikanime.app.data.model

import com.google.gson.annotations.SerializedName

// ===== LEADERBOARD =====
data class LeaderboardResponse(
    @SerializedName("success") val success: Boolean = false,
    @SerializedName("users") val users: List<LeaderboardUser>? = null
)

data class LeaderboardUser(
    @SerializedName("id") val id: String? = null,
    @SerializedName("name") val name: String? = null,
    @SerializedName("picture") val picture: String? = null,
    @SerializedName("level") val level: Long = 1,
    @SerializedName("watchTime") val watchTime: Long = 0,
    @SerializedName("title") val title: String? = null,
    @SerializedName("rank") val rank: Int = 0
) {
    fun getFormattedWatchTime(): String {
        val minutes = watchTime / 60
        val hours = minutes / 60
        return if (hours > 0) "${hours}j ${minutes % 60}m" else "${minutes}m"
    }

    fun getDisplayAvatar(): String {
        return picture ?: "https://ui-avatars.com/api/?name=${java.net.URLEncoder.encode(name ?: "User", "UTF-8")}&background=D4A73C&color=0B0B10"
    }
}

// ===== CHAT =====
data class ChatResponse(
    @SerializedName("success") val success: Boolean = false,
    @SerializedName("messages") val messages: List<ChatMessage>? = null,
    @SerializedName("count") val count: Int = 0
)

data class ChatMessage(
    @SerializedName("id") val id: String? = null,
    @SerializedName("userId") val userId: String? = null,
    @SerializedName("name") val name: String? = null,
    @SerializedName("picture") val picture: String? = null,
    @SerializedName("message") val message: String? = null,
    @SerializedName("timestamp") val timestamp: String? = null,
    @SerializedName("timestamp_ms") val timestampMs: Long? = null,
    @SerializedName("hasMedia") val hasMedia: Boolean = false,
    @SerializedName("mediaUrl") val mediaUrl: String? = null,
    @SerializedName("mediaType") val mediaType: String? = null
) {
    fun getDisplayAvatar(): String {
        return picture ?: "https://ui-avatars.com/api/?name=${java.net.URLEncoder.encode(name ?: "User", "UTF-8")}&background=D4A73C&color=0B0B10"
    }
}

data class SendChatRequest(
    @SerializedName("message") val message: String
)

// ===== W2G (WATCH TOGETHER) =====
// ===== W2G (WATCH TOGETHER) =====
data class W2GResponse(
    @SerializedName("success") val success: Boolean = false,
    @SerializedName("rooms") val rooms: List<W2GRoom>? = null,
    @SerializedName("room") val room: W2GRoom? = null,
    @SerializedName("roomId") val roomId: String? = null,
    @SerializedName("error") val error: String? = null
)

data class W2GRoom(
    @SerializedName("id") val id: String? = null,
    @SerializedName("roomId") val roomId: String? = null,
    @SerializedName("title") val title: String? = null,
    @SerializedName("animeTitle") val animeTitle: String? = null,
    @SerializedName("animePoster") val animePoster: String? = null,
    @SerializedName("episodeIndex") val episodeIndex: String? = null,
    @SerializedName("hostName") val hostName: String? = null,
    @SerializedName("hostAvatar") val hostAvatar: String? = null,
    @SerializedName("hasPasscode") val hasPasscode: Boolean = false,
    @SerializedName("activeCount") val activeCount: Int = 1,
    @SerializedName("isPlaying") val isPlaying: Boolean = false,
    @SerializedName("createdAt") val createdAt: Long = 0L
) {
    fun getEffectiveId(): String = id ?: roomId ?: ""
    fun getDisplayPoster(): String {
        val raw = animePoster ?: ""
        return if (raw.isNotBlank()) {
            if (raw.startsWith("http")) {
                "https://cfelainawanggy.pages.dev/?action=proxy&url=" + java.net.URLEncoder.encode(raw, "UTF-8")
            } else raw
        } else ""
    }
}

data class CreateW2GRoomRequest(
    @SerializedName("title") val title: String,
    @SerializedName("animeId") val animeId: String? = null,
    @SerializedName("animeSlug") val animeSlug: String? = null,
    @SerializedName("animeTitle") val animeTitle: String? = null,
    @SerializedName("animePoster") val animePoster: String? = null,
    @SerializedName("episodeIndex") val episodeIndex: String? = null,
    @SerializedName("episodeId") val episodeId: String? = null,
    @SerializedName("videoUrl") val videoUrl: String? = null,
    @SerializedName("videoQuality") val videoQuality: String = "720p",
    @SerializedName("isPublic") val isPublic: Boolean = true,
    @SerializedName("passcode") val passcode: String = "",
    @SerializedName("maxMembers") val maxMembers: Int = 25
)

data class W2GRoomDetailResponse(
    @SerializedName("success") val success: Boolean = false,
    @SerializedName("room") val room: W2GRoomDetail? = null,
    @SerializedName("isHost") val isHost: Boolean = false,
    @SerializedName("currentUser") val currentUser: W2GMember? = null,
    @SerializedName("members") val members: List<W2GMember>? = null,
    @SerializedName("chat") val chat: List<W2GChatItem>? = null,
    @SerializedName("error") val error: String? = null,
    @SerializedName("requiresPasscode") val requiresPasscode: Boolean = false
)

data class W2GRoomDetail(
    @SerializedName("id") val id: String? = null,
    @SerializedName("title") val title: String? = null,
    @SerializedName("animeId") val animeId: String? = null,
    @SerializedName("animeSlug") val animeSlug: String? = null,
    @SerializedName("animeTitle") val animeTitle: String? = null,
    @SerializedName("animePoster") val animePoster: String? = null,
    @SerializedName("episodeIndex") val episodeIndex: String? = null,
    @SerializedName("episodeId") val episodeId: String? = null,
    @SerializedName("videoUrl") val videoUrl: String? = null,
    @SerializedName("videoQuality") val videoQuality: String? = null,
    @SerializedName("creatorId") val creatorId: String? = null,
    @SerializedName("hostId") val hostId: String? = null,
    @SerializedName("hostName") val hostName: String? = null,
    @SerializedName("isPlaying") val isPlaying: Boolean = false,
    @SerializedName("currentTime") val currentTime: Double = 0.0,
    @SerializedName("estimatedTime") val estimatedTime: Double = 0.0,
    @SerializedName("updatedAt") val updatedAt: Long = 0L,
    @SerializedName("hasPasscode") val hasPasscode: Boolean = false
)

data class W2GMember(
    @SerializedName("userId") val userId: String? = null,
    @SerializedName("name") val name: String? = null,
    @SerializedName("avatar") val avatar: String? = null,
    @SerializedName("level") val level: Long = 1,
    @SerializedName("title") val title: String? = null,
    @SerializedName("role") val role: String? = null,
    @SerializedName("clanBadge") val clanBadge: String? = null
)

data class W2GChatItem(
    @SerializedName("id") val id: String? = null,
    @SerializedName("seq") val seq: Long? = null,
    @SerializedName("userId") val userId: String? = null,
    @SerializedName("userName") val userName: String? = null,
    @SerializedName("userAvatar") val userAvatar: String? = null,
    @SerializedName("text") val text: String? = null,
    @SerializedName("color") val color: String? = null,
    @SerializedName("isDanmaku") val isDanmaku: Boolean = false,
    @SerializedName("videoTime") val videoTime: Double? = null,
    @SerializedName("timestamp") val timestamp: Long = 0L
)

data class W2GSyncRequest(
    @SerializedName("roomId") val roomId: String,
    @SerializedName("isPlaying") val isPlaying: Boolean,
    @SerializedName("currentTime") val currentTime: Double,
    @SerializedName("videoUrl") val videoUrl: String? = null,
    @SerializedName("episodeIndex") val episodeIndex: String? = null,
    @SerializedName("episodeId") val episodeId: String? = null
)

data class W2GSyncStateResponse(
    @SerializedName("success") val success: Boolean = false,
    @SerializedName("isPlaying") val isPlaying: Boolean = false,
    @SerializedName("currentTime") val currentTime: Double = 0.0,
    @SerializedName("updatedAt") val updatedAt: Long = 0L,
    @SerializedName("hostId") val hostId: String? = null,
    @SerializedName("members") val members: List<W2GMember>? = null,
    @SerializedName("newChat") val newChat: List<W2GChatItem>? = null,
    @SerializedName("error") val error: String? = null
)

data class W2GChatRequest(
    @SerializedName("roomId") val roomId: String,
    @SerializedName("text") val text: String,
    @SerializedName("color") val color: String = "#ffffff",
    @SerializedName("isDanmaku") val isDanmaku: Boolean = false,
    @SerializedName("videoTime") val videoTime: Double = 0.0
)

data class W2GHeartbeatRequest(
    @SerializedName("roomId") val roomId: String,
    @SerializedName("lastSeq") val lastSeq: Long = 0L,
    @SerializedName("userCurrentTime") val userCurrentTime: Double = 0.0
)

data class W2GHeartbeatResponse(
    @SerializedName("success") val success: Boolean = false,
    @SerializedName("playback") val playback: W2GPlaybackState? = null,
    @SerializedName("members") val members: List<W2GMember>? = null,
    @SerializedName("newChat") val newChat: List<W2GChatItem>? = null,
    @SerializedName("isHost") val isHost: Boolean = false,
    @SerializedName("error") val error: String? = null
)

data class W2GPlaybackState(
    @SerializedName("isPlaying") val isPlaying: Boolean = false,
    @SerializedName("currentTime") val currentTime: Double = 0.0,
    @SerializedName("hostUpdatedAt") val hostUpdatedAt: Long = 0L,
    @SerializedName("videoUrl") val videoUrl: String? = null,
    @SerializedName("episodeIndex") val episodeIndex: String? = null,
    @SerializedName("episodeId") val episodeId: String? = null,
    @SerializedName("animeTitle") val animeTitle: String? = null,
    @SerializedName("animePoster") val animePoster: String? = null
)

data class W2GGenericResponse(
    @SerializedName("success") val success: Boolean = false,
    @SerializedName("error") val error: String? = null,
    @SerializedName("message") val message: String? = null
)

// ===== REMOTE HISTORY =====
data class RemoteHistoryResponse(
    @SerializedName("success") val success: Boolean = true,
    @SerializedName("data") val data: List<RemoteHistoryItem>? = null
)

data class RemoteHistoryItem(
    @SerializedName("type") val type: String? = "anime",
    @SerializedName("animeId") val animeId: String? = null,
    @SerializedName("animeTitle") val animeTitle: String? = null,
    @SerializedName("title") val title: String? = null,
    @SerializedName("image_cover") val imageCover: String? = null,
    @SerializedName("image_poster") val imagePoster: String? = null,
    @SerializedName("status") val status: String? = null,
    @SerializedName("genre") val genre: Any? = null,
    @SerializedName("year") val year: String? = null,
    @SerializedName("timestamp") val timestamp: String? = null,
    @SerializedName("currentEpisode") val currentEpisode: RemoteHistoryEpisode? = null,
    @SerializedName("currentChapter") val currentChapter: RemoteHistoryChapter? = null
) {
    fun getEffectiveTitle(): String = animeTitle ?: title ?: "Tanpa Judul"
    fun getEffectiveCover(): String = imagePoster ?: imageCover ?: ""
}

data class RemoteHistoryEpisode(
    @SerializedName("index") val index: String? = null,
    @SerializedName("title") val title: String? = null
)

data class RemoteHistoryChapter(
    @SerializedName("chapter") val chapter: String? = null,
    @SerializedName("slug") val slug: String? = null
)

data class HistoryPostPayload(
    @SerializedName("type") val type: String,
    @SerializedName("animeId") val animeId: String,
    @SerializedName("title") val title: String,
    @SerializedName("image_cover") val imageCover: String? = null,
    @SerializedName("image_poster") val imagePoster: String? = null,
    @SerializedName("currentEpisode") val currentEpisode: RemoteHistoryEpisode? = null,
    @SerializedName("currentChapter") val currentChapter: RemoteHistoryChapter? = null
)

data class HistoryDeletePayload(
    @SerializedName("animeId") val animeId: String? = null,
    @SerializedName("type") val type: String? = null
)

// ===== AUTH & USER PROFILE =====
data class AuthResponse(
    @SerializedName("success") val success: Boolean = false,
    @SerializedName("token") val token: String? = null,
    @SerializedName("user") val user: UserProfile? = null,
    @SerializedName("error") val error: String? = null,
    @SerializedName("message") val message: String? = null
)

data class UserProfile(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("email") val email: String? = null,
    @SerializedName("picture") val picture: String? = null,
    @SerializedName("level") val level: Long = 1,
    @SerializedName("title") val title: String? = null,
    @SerializedName("watchTime") val watchTime: Long = 0,
    @SerializedName("coins") val coins: Long = 0,
    @SerializedName("bio") val bio: String? = null,
    @SerializedName("frame") val frame: String? = null,
    @SerializedName("aura") val aura: String? = null,
    @SerializedName("isAdmin") val isAdmin: Boolean = false
) {
    fun getFormattedWatchTime(): String {
        val minutes = watchTime / 60
        val hours = minutes / 60
        return if (hours > 0) "${hours}j ${minutes % 60}m" else "${minutes}m"
    }

    fun getDisplayAvatar(): String {
        return picture ?: "https://ui-avatars.com/api/?name=${java.net.URLEncoder.encode(name, "UTF-8")}&background=D4A73C&color=0B0B10"
    }
}

data class LoginRequest(
    @SerializedName("email") val email: String,
    @SerializedName("password") val password: String
)

data class RegisterRequest(
    @SerializedName("name") val name: String,
    @SerializedName("email") val email: String,
    @SerializedName("password") val password: String
)
