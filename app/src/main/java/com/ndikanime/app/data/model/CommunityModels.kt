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
    @SerializedName("episodeId") val episodeId: String? = null,
    @SerializedName("videoUrl") val videoUrl: String? = null,
    @SerializedName("hostId") val hostId: String? = null,
    @SerializedName("hostName") val hostName: String? = null,
    @SerializedName("hostAvatar") val hostAvatar: String? = null,
    @SerializedName("hasPasscode") val hasPasscode: Boolean = false,
    @SerializedName("passcode") val passcode: String? = null,
    @SerializedName("activeCount") var activeCount: Int = 1,
    @SerializedName("isPlaying") var isPlaying: Boolean = false,
    @SerializedName("currentTime") var currentTime: Double = 0.0,
    @SerializedName("updatedAt") var updatedAt: Long = 0L,
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
    @SerializedName("isPlaying") var isPlaying: Boolean = false,
    @SerializedName("currentTime") var currentTime: Double = 0.0,
    @SerializedName("estimatedTime") var estimatedTime: Double = 0.0,
    @SerializedName("updatedAt") var updatedAt: Long = 0L,
    @SerializedName("hasPasscode") var hasPasscode: Boolean = false,
    @SerializedName("passcode") var passcode: String? = null
)

data class W2GMember(
    @SerializedName("userId") val userId: String? = null,
    @SerializedName("name") val name: String? = null,
    @SerializedName("avatar") val avatar: String? = null,
    @SerializedName("level") val level: Long = 1,
    @SerializedName("title") val title: String? = null,
    @SerializedName("role") val role: String? = null,
    @SerializedName("clanBadge") val clanBadge: String? = null,
    @SerializedName("lastSeen") var lastSeen: Long = 0L
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

// ===== GACHA & CARDS =====
data class CardItem(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("subtitle") val subtitle: String? = null,
    @SerializedName("anime") val anime: String? = null,
    @SerializedName("rarity") val rarity: String = "R",
    @SerializedName("element") val element: String? = null,
    @SerializedName("atk") val atk: Int = 0,
    @SerializedName("def") val def: Int = 0,
    @SerializedName("hp") val hp: Int = 0,
    @SerializedName("image") val image: String? = null,
    @SerializedName("quote") val quote: String? = null,
    @SerializedName("description") val description: String? = null
)

data class UserCardItem(
    @SerializedName("cardId") val cardId: String,
    @SerializedName("count") var count: Int = 1,
    @SerializedName("level") var level: Int = 1,
    @SerializedName("obtainedAt") val obtainedAt: Long = System.currentTimeMillis()
)

data class GachaStats(
    @SerializedName("coins") var coins: Long = 500,
    @SerializedName("tickets") var tickets: Long = 3,
    @SerializedName("totalPulls") var totalPulls: Long = 0,
    @SerializedName("pitySr") var pitySr: Int = 0,
    @SerializedName("pityUr") var pityUr: Int = 0
)

// ===== CLAN =====
data class ClanItem(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("tag") val tag: String? = null,
    @SerializedName("description") val description: String? = null,
    @SerializedName("icon") val icon: String? = null,
    @SerializedName("color") val color: String? = null,
    @SerializedName("level") val level: Int = 1,
    @SerializedName("xp") val xp: Long = 0,
    @SerializedName("leaderId") val leaderId: String? = null,
    @SerializedName("leaderName") val leaderName: String? = null,
    @SerializedName("memberCount") var memberCount: Int = 1,
    @SerializedName("createdAt") val createdAt: Long = System.currentTimeMillis()
)

data class ClanMemberItem(
    @SerializedName("userId") val userId: String,
    @SerializedName("name") val name: String? = null,
    @SerializedName("avatar") val avatar: String? = null,
    @SerializedName("role") val role: String = "MEMBER",
    @SerializedName("joinedAt") val joinedAt: Long = System.currentTimeMillis()
)

// ===== DIRECT MESSAGES =====
data class DMConversation(
    @SerializedName("convId") val convId: String,
    @SerializedName("otherUserId") val otherUserId: String,
    @SerializedName("otherUserName") val otherUserName: String,
    @SerializedName("otherUserAvatar") val otherUserAvatar: String? = null,
    @SerializedName("lastMessage") var lastMessage: String? = null,
    @SerializedName("lastTimestamp") var lastTimestamp: Long = 0L
)

data class DMMessage(
    @SerializedName("id") val id: String = "",
    @SerializedName("senderId") val senderId: String = "",
    @SerializedName("senderName") val senderName: String = "",
    @SerializedName("senderAvatar") val senderAvatar: String? = null,
    @SerializedName("text") val text: String = "",
    @SerializedName("timestamp") val timestamp: Long = System.currentTimeMillis()
)

// ===== COMMENTS =====
data class CommentItem(
    @SerializedName("id") val id: String = "",
    @SerializedName("userId") val userId: String = "",
    @SerializedName("name") val name: String = "",
    @SerializedName("avatar") val avatar: String? = null,
    @SerializedName("level") val level: Long = 1,
    @SerializedName("title") val title: String? = null,
    @SerializedName("text") val text: String = "",
    @SerializedName("likes") var likes: Int = 0,
    @SerializedName("timestamp") val timestamp: Long = System.currentTimeMillis()
)

// ===== QUESTS & STREAK =====
data class StreakData(
    @SerializedName("count") var count: Int = 1,
    @SerializedName("lastActiveDate") var lastActiveDate: String = "",
    @SerializedName("lastClaimedDate") var lastClaimedDate: String = ""
)

data class QuestItem(
    @SerializedName("id") val id: String,
    @SerializedName("title") val title: String,
    @SerializedName("desc") val desc: String,
    @SerializedName("current") var current: Int,
    @SerializedName("target") val target: Int,
    @SerializedName("rewardCoins") val rewardCoins: Long,
    @SerializedName("isClaimed") var isClaimed: Boolean = false
)
