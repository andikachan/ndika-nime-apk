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
data class W2GResponse(
    @SerializedName("success") val success: Boolean = false,
    @SerializedName("rooms") val rooms: List<W2GRoom>? = null
)

data class W2GRoom(
    @SerializedName("roomId") val roomId: String? = null,
    @SerializedName("id") val id: String? = null,
    @SerializedName("animeTitle") val animeTitle: String? = null,
    @SerializedName("episodeTitle") val episodeTitle: String? = null,
    @SerializedName("hostName") val hostName: String? = null,
    @SerializedName("membersCount") val membersCount: Int = 1
)

data class CreateW2GRoomRequest(
    @SerializedName("animeId") val animeId: String,
    @SerializedName("episodeId") val episodeId: String,
    @SerializedName("animeTitle") val animeTitle: String,
    @SerializedName("episodeTitle") val episodeTitle: String,
    @SerializedName("videoUrl") val videoUrl: String
)

// ===== AUTH =====
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
    @SerializedName("title") val title: String? = null
)

data class LoginRequest(
    @SerializedName("email") val email: String,
    @SerializedName("password") val password: String
)

data class RegisterRequest(
    @SerializedName("name") val name: String,
    @SerializedName("email") val email: String,
    @SerializedName("password") val password: String
)
