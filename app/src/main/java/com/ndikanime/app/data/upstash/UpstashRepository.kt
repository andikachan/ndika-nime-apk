package com.ndikanime.app.data.upstash

import android.content.Context
import com.google.gson.reflect.TypeToken
import com.ndikanime.app.NdikaNimeApp
import com.ndikanime.app.data.model.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.mindrot.jbcrypt.BCrypt
import java.text.SimpleDateFormat
import java.util.*
import kotlin.random.Random

object UpstashRepository {

    private val gson = UpstashClient.gson
    private var cachedCards: List<CardItem>? = null

    // ===== CARDS CACHE =====
    fun getCards(context: Context = NdikaNimeApp.instance): List<CardItem> {
        cachedCards?.let { return it }
        return try {
            val json = context.assets.open("cards_database.json").bufferedReader().use { it.readText() }
            val mapType = object : TypeToken<Map<String, Any>>() {}.type
            val rawMap: Map<String, Any> = gson.fromJson(json, mapType)
            val cardsJson = gson.toJson(rawMap["cards"])
            val listType = object : TypeToken<List<CardItem>>() {}.type
            val list: List<CardItem> = gson.fromJson(cardsJson, listType)
            cachedCards = list
            list
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    // ===== AUTHENTICATION & USERS =====

    suspend fun login(email: String, pass: String): UserProfile? = withContext(Dispatchers.IO) {
        val normEmail = email.trim().lowercase()
        val userId = UpstashClient.get("user:email:$normEmail") ?: return@withContext null
        val userRaw = UpstashClient.get("user:$userId") ?: return@withContext null

        val mapType = object : TypeToken<Map<String, Any>>() {}.type
        val userMap: Map<String, Any> = gson.fromJson(userRaw, mapType)

        val storedPass = userMap["password"] as? String ?: return@withContext null
        val isValid = try {
            BCrypt.checkpw(pass, storedPass)
        } catch (e: Exception) {
            pass == storedPass
        }

        if (!isValid) return@withContext null

        parseUserProfile(userMap)
    }

    suspend fun register(name: String, email: String, pass: String): UserProfile? = withContext(Dispatchers.IO) {
        val normEmail = email.trim().lowercase()
        val existing = UpstashClient.get("user:email:$normEmail")
        if (existing != null) return@withContext null

        val userId = "user_${System.currentTimeMillis()}_${(1000..9999).random()}"
        val hashedPass = try {
            BCrypt.hashpw(pass, BCrypt.gensalt(10))
        } catch (e: Exception) {
            pass
        }

        val now = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }.format(Date())

        val userObj = mutableMapOf<String, Any>(
            "id" to userId,
            "name" to name.trim(),
            "email" to normEmail,
            "picture" to "https://api.dicebear.com/7.x/bottts/svg?seed=$userId",
            "level" to 1L,
            "title" to "Anime Newbie",
            "watchTime" to 0L,
            "coins" to 500L,
            "bio" to "Wibu penikmat anime & manga di Ndichan.",
            "password" to hashedPass,
            "createdAt" to now,
            "updatedAt" to now
        )

        UpstashClient.set("user:$userId", gson.toJson(userObj))
        UpstashClient.set("user:email:$normEmail", userId)
        UpstashClient.sadd("users:all", userId)

        parseUserProfile(userObj)
    }

    suspend fun getProfile(userId: String): UserProfile? = withContext(Dispatchers.IO) {
        val raw = UpstashClient.get("user:$userId") ?: return@withContext null
        val mapType = object : TypeToken<Map<String, Any>>() {}.type
        val userMap: Map<String, Any> = gson.fromJson(raw, mapType)
        parseUserProfile(userMap)
    }

    suspend fun updateProfile(
        userId: String,
        name: String? = null,
        bio: String? = null,
        picture: String? = null,
        banner: String? = null,
        title: String? = null,
        frame: String? = null,
        aura: String? = null
    ): UserProfile? = withContext(Dispatchers.IO) {
        val raw = UpstashClient.get("user:$userId") ?: return@withContext null
        val mapType = object : TypeToken<MutableMap<String, Any>>() {}.type
        val userMap: MutableMap<String, Any> = gson.fromJson(raw, mapType)

        name?.let { userMap["name"] = it }
        bio?.let { userMap["bio"] = it }
        picture?.let { userMap["picture"] = it }
        banner?.let { userMap["banner"] = it }
        title?.let { userMap["title"] = it }
        frame?.let { userMap["frame"] = it }
        aura?.let { userMap["aura"] = it }

        UpstashClient.set("user:$userId", gson.toJson(userMap))
        parseUserProfile(userMap)
    }

    suspend fun addCoins(userId: String, amount: Long): Long = withContext(Dispatchers.IO) {
        val raw = UpstashClient.get("user:$userId") ?: return@withContext 0L
        val mapType = object : TypeToken<MutableMap<String, Any>>() {}.type
        val userMap: MutableMap<String, Any> = gson.fromJson(raw, mapType)
        val current = (userMap["coins"] as? Number)?.toLong() ?: 0L
        val newCoins = (current + amount).coerceAtLeast(0L)
        userMap["coins"] = newCoins
        UpstashClient.set("user:$userId", gson.toJson(userMap))
        newCoins
    }

    suspend fun searchUsers(query: String): List<UserProfile> = withContext(Dispatchers.IO) {
        if (query.isBlank()) return@withContext emptyList()
        val q = query.trim().lowercase()
        val userIds = UpstashClient.smembers("users:all")
        val results = mutableListOf<UserProfile>()
        for (uid in userIds.take(50)) {
            val p = getProfile(uid) ?: continue
            if (p.name.lowercase().contains(q) || (p.email?.lowercase()?.contains(q) == true) || p.id.lowercase().contains(q)) {
                results.add(p)
            }
        }
        results
    }

    private fun parseUserProfile(map: Map<String, Any>): UserProfile {
        return UserProfile(
            id = map["id"]?.toString() ?: "",
            name = map["name"]?.toString() ?: "User",
            email = map["email"]?.toString(),
            picture = map["picture"]?.toString(),
            level = (map["level"] as? Number)?.toLong() ?: 1L,
            title = map["title"]?.toString() ?: "Anime Newbie",
            watchTime = (map["watchTime"] as? Number)?.toLong() ?: 0L,
            coins = (map["coins"] as? Number)?.toLong() ?: 0L,
            bio = map["bio"]?.toString(),
            frame = map["frame"]?.toString(),
            aura = map["aura"]?.toString(),
            isAdmin = (map["isAdmin"] as? Boolean) == true
        )
    }

    // ===== HISTORY =====

    suspend fun getRemoteHistory(userId: String): List<RemoteHistoryItem> = withContext(Dispatchers.IO) {
        val rawList = UpstashClient.lrange("history:$userId", 0, 99)
        val list = mutableListOf<RemoteHistoryItem>()
        rawList.forEach { s ->
            try {
                val item = gson.fromJson(s, RemoteHistoryItem::class.java)
                if (item != null) list.add(item)
            } catch (e: Exception) {}
        }
        list
    }

    suspend fun saveRemoteHistory(userId: String, payload: HistoryPostPayload): Boolean = withContext(Dispatchers.IO) {
        val json = gson.toJson(payload)
        UpstashClient.lpush("history:$userId", json)
        UpstashClient.ltrim("history:$userId", 0, 99)
        true
    }

    suspend fun deleteRemoteHistory(userId: String, animeId: String?, type: String?): Boolean = withContext(Dispatchers.IO) {
        val current = getRemoteHistory(userId)
        val filtered = current.filter { item ->
            !(item.animeId == animeId && (type == null || item.type == type))
        }
        UpstashClient.del("history:$userId")
        if (filtered.isNotEmpty()) {
            val jsonArray = filtered.reversed().map { gson.toJson(it) }.toTypedArray()
            UpstashClient.lpush("history:$userId", *jsonArray)
        }
        true
    }

    // ===== GLOBAL CHAT =====

    suspend fun getChatMessages(limit: Int = 50): List<ChatMessage> = withContext(Dispatchers.IO) {
        val rawList = UpstashClient.lrange("chat:messages", -limit.toLong(), -1)
        val list = mutableListOf<ChatMessage>()
        rawList.forEach { s ->
            try {
                val msg = gson.fromJson(s, ChatMessage::class.java)
                if (msg != null) list.add(msg)
            } catch (e: Exception) {}
        }
        list
    }

    suspend fun sendChatMessage(user: UserProfile, text: String): ChatMessage = withContext(Dispatchers.IO) {
        val now = System.currentTimeMillis()
        val iso = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }.format(Date(now))

        val msg = ChatMessage(
            id = "msg_${now}_${(1000..9999).random()}",
            userId = user.id,
            name = user.name,
            picture = user.picture,
            message = text,
            timestamp = iso,
            timestampMs = now
        )

        UpstashClient.rpush("chat:messages", gson.toJson(msg))
        UpstashClient.ltrim("chat:messages", -200, -1)
        msg
    }

    // ===== WATCH TOGETHER (W2G) =====

    suspend fun getW2GRooms(): List<W2GRoom> = withContext(Dispatchers.IO) {
        val roomIds = UpstashClient.smembers("w2g:rooms:public")
        val rooms = mutableListOf<W2GRoom>()
        roomIds.forEach { rid ->
            val raw = UpstashClient.get("w2g:room:$rid") ?: return@forEach
            try {
                val r = gson.fromJson(raw, W2GRoom::class.java)
                val members = UpstashClient.hgetall("w2g:members:$rid")
                r.activeCount = members.size.coerceAtLeast(1)
                rooms.add(r)
            } catch (e: Exception) {}
        }
        rooms
    }

    suspend fun createW2GRoom(
        user: UserProfile,
        title: String,
        animeId: String?,
        animeTitle: String?,
        animePoster: String?,
        episodeIndex: String?,
        episodeId: String?,
        videoUrl: String?,
        passcode: String?
    ): W2GRoom = withContext(Dispatchers.IO) {
        val chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        val code = (1..6).map { chars.random() }.joinToString("")
        val now = System.currentTimeMillis()

        val room = W2GRoom(
            id = code,
            title = title,
            animeTitle = animeTitle,
            animePoster = animePoster,
            episodeIndex = episodeIndex ?: "1",
            episodeId = episodeId,
            videoUrl = videoUrl,
            hostId = user.id,
            hostName = user.name,
            hostAvatar = user.picture,
            hasPasscode = !passcode.isNullOrBlank(),
            passcode = passcode,
            createdAt = now,
            updatedAt = now,
            isPlaying = true,
            currentTime = 0.0,
            activeCount = 1
        )

        UpstashClient.set("w2g:room:$code", gson.toJson(room), 86400)
        UpstashClient.sadd("w2g:rooms:public", code)

        val hostMember = W2GMember(
            userId = user.id,
            name = user.name,
            avatar = user.picture,
            level = user.level,
            title = user.title,
            role = "host",
            lastSeen = now
        )
        UpstashClient.hset("w2g:members:$code", user.id, gson.toJson(hostMember))

        room
    }

    suspend fun getW2GRoomDetail(roomId: String, passcode: String = ""): W2GRoomDetailResponse = withContext(Dispatchers.IO) {
        val raw = UpstashClient.get("w2g:room:$roomId")
            ?: return@withContext W2GRoomDetailResponse(success = false, error = "Room tidak ditemukan")
        val room = gson.fromJson(raw, W2GRoomDetail::class.java)

        if (!room.passcode.isNullOrBlank() && room.passcode != passcode) {
            return@withContext W2GRoomDetailResponse(success = false, error = "Passcode salah")
        }

        val membersMap = UpstashClient.hgetall("w2g:members:$roomId")
        val members = membersMap.values.mapNotNull {
            try { gson.fromJson(it, W2GMember::class.java) } catch (e: Exception) { null }
        }

        val chatRaw = UpstashClient.lrange("w2g:chat:$roomId", -30, -1)
        val chat = chatRaw.mapNotNull {
            try { gson.fromJson(it, W2GChatItem::class.java) } catch (e: Exception) { null }
        }

        W2GRoomDetailResponse(
            success = true,
            room = room,
            members = members,
            chat = chat,
            isHost = false
        )
    }

    suspend fun sendW2GHeartbeat(
        roomId: String,
        user: UserProfile,
        userCurrentTime: Double,
        lastSeq: Long
    ): W2GHeartbeatResponse = withContext(Dispatchers.IO) {
        val raw = UpstashClient.get("w2g:room:$roomId")
            ?: return@withContext W2GHeartbeatResponse(success = false, error = "Room telah ditutup")
        val room = gson.fromJson(raw, W2GRoomDetail::class.java)
        val now = System.currentTimeMillis()

        val isHost = room.hostId == user.id

        val member = W2GMember(
            userId = user.id,
            name = user.name,
            avatar = user.picture,
            level = user.level,
            title = user.title,
            role = if (isHost) "host" else "member",
            lastSeen = now
        )
        UpstashClient.hset("w2g:members:$roomId", user.id, gson.toJson(member))

        if (isHost && room.isPlaying && userCurrentTime > 0) {
            room.currentTime = userCurrentTime
            room.updatedAt = now
            UpstashClient.set("w2g:room:$roomId", gson.toJson(room), 86400)
        }

        val membersMap = UpstashClient.hgetall("w2g:members:$roomId")
        val members = membersMap.values.mapNotNull {
            try {
                val m = gson.fromJson(it, W2GMember::class.java)
                if (now - m.lastSeen < 30000) m else null
            } catch (e: Exception) { null }
        }

        val chatRaw = UpstashClient.lrange("w2g:chat:$roomId", -30, -1)
        val newChat = chatRaw.mapNotNull {
            try {
                val c = gson.fromJson(it, W2GChatItem::class.java)
                if ((c.seq ?: 0L) > lastSeq) c else null
            } catch (e: Exception) { null }
        }

        var estimatedSec = room.currentTime
        if (room.isPlaying && room.updatedAt > 0) {
            estimatedSec += (now - room.updatedAt) / 1000.0
        }

        W2GHeartbeatResponse(
            success = true,
            isHost = isHost,
            playback = W2GPlaybackState(
                isPlaying = room.isPlaying,
                currentTime = estimatedSec,
                videoUrl = room.videoUrl,
                episodeIndex = room.episodeIndex,
                animeTitle = room.animeTitle,
                animePoster = room.animePoster
            ),
            members = members,
            newChat = newChat
        )
    }

    suspend fun syncW2GPlayback(roomId: String, isPlaying: Boolean, currentTime: Double): Boolean = withContext(Dispatchers.IO) {
        val raw = UpstashClient.get("w2g:room:$roomId") ?: return@withContext false
        val room = gson.fromJson(raw, W2GRoomDetail::class.java)
        room.isPlaying = isPlaying
        room.currentTime = currentTime
        room.updatedAt = System.currentTimeMillis()
        UpstashClient.set("w2g:room:$roomId", gson.toJson(room), 86400)
    }

    suspend fun sendW2GChat(roomId: String, user: UserProfile, text: String, videoTime: Double): Boolean = withContext(Dispatchers.IO) {
        val len = UpstashClient.llen("w2g:chat:$roomId")
        val item = W2GChatItem(
            id = "c_${System.currentTimeMillis()}",
            seq = len + 1,
            userId = user.id,
            userName = user.name,
            userAvatar = user.picture,
            text = text,
            videoTime = videoTime,
            timestamp = System.currentTimeMillis()
        )
        UpstashClient.rpush("w2g:chat:$roomId", gson.toJson(item))
        true
    }

    suspend fun leaveW2G(roomId: String, userId: String): Boolean = withContext(Dispatchers.IO) {
        UpstashClient.hdel("w2g:members:$roomId", userId)
        val remaining = UpstashClient.hgetall("w2g:members:$roomId")
        if (remaining.isEmpty()) {
            UpstashClient.srem("w2g:rooms:public", roomId)
        }
        true
    }

    // ===== LEADERBOARD =====

    suspend fun getLeaderboard(): List<LeaderboardUser> = withContext(Dispatchers.IO) {
        val userIds = UpstashClient.smembers("users:all")
        val list = mutableListOf<LeaderboardUser>()
        userIds.take(100).forEach { uid ->
            val raw = UpstashClient.get("user:$uid") ?: return@forEach
            try {
                val mapType = object : TypeToken<Map<String, Any>>() {}.type
                val map: Map<String, Any> = gson.fromJson(raw, mapType)
                list.add(
                    LeaderboardUser(
                        id = uid,
                        name = map["name"]?.toString() ?: "User",
                        picture = map["picture"]?.toString(),
                        level = (map["level"] as? Number)?.toLong() ?: 1L,
                        watchTime = (map["watchTime"] as? Number)?.toLong() ?: 0L,
                        title = map["title"]?.toString() ?: "Anime Newbie"
                    )
                )
            } catch (e: Exception) {}
        }
        list.sortByDescending { it.watchTime }
        list.forEachIndexed { i, u -> u.javaClass.getDeclaredField("rank")?.apply { isAccessible = true; set(u, i + 1) } }
        list
    }

    // ===== GACHA & CARDS =====

    suspend fun getUserCards(userId: String): List<UserCardItem> = withContext(Dispatchers.IO) {
        val raw = UpstashClient.get("user:cards:$userId") ?: return@withContext emptyList()
        val listType = object : TypeToken<List<UserCardItem>>() {}.type
        try { gson.fromJson(raw, listType) } catch (e: Exception) { emptyList() }
    }

    suspend fun getUserDeck(userId: String): List<String> = withContext(Dispatchers.IO) {
        val raw = UpstashClient.get("user:deck:$userId") ?: return@withContext emptyList()
        val listType = object : TypeToken<List<String>>() {}.type
        try { gson.fromJson(raw, listType) } catch (e: Exception) { emptyList() }
    }

    suspend fun saveUserDeck(userId: String, cardIds: List<String>): Boolean = withContext(Dispatchers.IO) {
        UpstashClient.set("user:deck:$userId", gson.toJson(cardIds.take(3)))
    }

    suspend fun pullGacha(userId: String, isMulti: Boolean): Pair<Boolean, List<CardItem>> = withContext(Dispatchers.IO) {
        val cost = if (isMulti) 900L else 100L
        val pullCount = if (isMulti) 10 else 1

        val profile = getProfile(userId) ?: return@withContext false to emptyList()
        if (profile.coins < cost) return@withContext false to emptyList()

        addCoins(userId, -cost)

        val allCards = getCards()
        if (allCards.isEmpty()) return@withContext false to emptyList()

        val byRarity = allCards.groupBy { it.rarity }
        val pulled = mutableListOf<CardItem>()

        for (i in 0 until pullCount) {
            val roll = Random.nextDouble(0.0, 100.0)
            val rarity = when {
                roll < 1.5 -> "UR"
                roll < 8.0 -> "SSR"
                roll < 30.0 -> "SR"
                roll < 70.0 -> "R"
                else -> "C"
            }
            val pool = byRarity[rarity] ?: byRarity["R"] ?: allCards
            pulled.add(pool.random())
        }

        val currentCards = getUserCards(userId).toMutableList()
        pulled.forEach { card ->
            val existing = currentCards.find { it.cardId == card.id }
            if (existing != null) {
                existing.count += 1
            } else {
                currentCards.add(UserCardItem(cardId = card.id, count = 1, level = 1))
            }
        }
        UpstashClient.set("user:cards:$userId", gson.toJson(currentCards))

        true to pulled
    }

    // ===== STREAK & QUESTS =====

    suspend fun getDailyStreak(userId: String): StreakData = withContext(Dispatchers.IO) {
        val raw = UpstashClient.get("streak:$userId")
        if (raw != null) {
            try { return@withContext gson.fromJson(raw, StreakData::class.java) } catch (e: Exception) {}
        }
        StreakData(count = 1, lastActiveDate = "", lastClaimedDate = "")
    }

    suspend fun claimDailyStreak(userId: String): Pair<Boolean, Long> = withContext(Dispatchers.IO) {
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
        val streak = getDailyStreak(userId)
        if (streak.lastClaimedDate == today) {
            return@withContext false to 0L
        }

        streak.count = (streak.count + 1).coerceAtMost(365)
        streak.lastClaimedDate = today
        streak.lastActiveDate = today

        val bonusCoins = when {
            streak.count >= 30 -> 600L
            streak.count >= 7 -> 300L
            else -> 150L
        }

        UpstashClient.set("streak:$userId", gson.toJson(streak))
        addCoins(userId, bonusCoins)
        true to bonusCoins
    }

    suspend fun getQuests(userId: String): List<QuestItem> = withContext(Dispatchers.IO) {
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
        val watchProg = (UpstashClient.get("quest:progress:$userId:d:$today:watch_episode")?.toIntOrNull() ?: 0)
        val readProg = (UpstashClient.get("quest:progress:$userId:d:$today:read_chapter")?.toIntOrNull() ?: 0)
        val chatProg = (UpstashClient.get("quest:progress:$userId:d:$today:chat_message")?.toIntOrNull() ?: 0)

        listOf(
            QuestItem("q_watch", "Wibu Aktif", "Tonton minimal 1 episode anime hari ini", watchProg, 1, 150L),
            QuestItem("q_read", "Pustakawan Komik", "Baca minimal 1 chapter komik", readProg, 1, 150L),
            QuestItem("q_chat", "Sosialita Komunitas", "Kirim 2 pesan di Chat Global", chatProg, 2, 100L)
        )
    }

    // ===== DIRECT MESSAGES =====

    suspend fun getDMConversations(userId: String): List<DMConversation> = withContext(Dispatchers.IO) {
        val convUserIds = UpstashClient.zrevrange("dm:conv:$userId", 0, 30)
        val list = mutableListOf<DMConversation>()
        convUserIds.forEach { otherId ->
            val otherProfile = getProfile(otherId) ?: return@forEach
            val convId = listOf(userId, otherId).sorted().joinToString("_")
            val lastMsgRaw = UpstashClient.lrange("dm:messages:$convId", 0, 0).firstOrNull()
            var lastText = "Percakapan baru"
            var lastTs = 0L
            if (lastMsgRaw != null) {
                try {
                    val m = gson.fromJson(lastMsgRaw, DMMessage::class.java)
                    lastText = m.text
                    lastTs = m.timestamp
                } catch (e: Exception) {}
            }
            list.add(
                DMConversation(
                    convId = convId,
                    otherUserId = otherId,
                    otherUserName = otherProfile.name,
                    otherUserAvatar = otherProfile.picture,
                    lastMessage = lastText,
                    lastTimestamp = lastTs
                )
            )
        }
        list
    }

    suspend fun getDMMessages(convId: String): List<DMMessage> = withContext(Dispatchers.IO) {
        val raw = UpstashClient.lrange("dm:messages:$convId", 0, 50)
        val list = mutableListOf<DMMessage>()
        raw.forEach { s ->
            try {
                val m = gson.fromJson(s, DMMessage::class.java)
                if (m != null) list.add(m)
            } catch (e: Exception) {}
        }
        list.reversed()
    }

    suspend fun sendDM(sender: UserProfile, recipientId: String, text: String): DMMessage = withContext(Dispatchers.IO) {
        val convId = listOf(sender.id, recipientId).sorted().joinToString("_")
        val now = System.currentTimeMillis()
        val msg = DMMessage(
            id = "dm_${now}",
            senderId = sender.id,
            senderName = sender.name,
            senderAvatar = sender.picture,
            text = text,
            timestamp = now
        )
        UpstashClient.lpush("dm:messages:$convId", gson.toJson(msg))
        UpstashClient.ltrim("dm:messages:$convId", 0, 300)

        UpstashClient.zadd("dm:conv:${sender.id}", now.toDouble(), recipientId)
        UpstashClient.zadd("dm:conv:$recipientId", now.toDouble(), sender.id)
        msg
    }

    // ===== COMMENTS =====

    suspend fun getComments(type: String, targetId: String): List<CommentItem> = withContext(Dispatchers.IO) {
        val raw = UpstashClient.lrange("comments:$type:$targetId", 0, 49)
        val list = mutableListOf<CommentItem>()
        raw.forEach { s ->
            try {
                val c = gson.fromJson(s, CommentItem::class.java)
                if (c != null) list.add(c)
            } catch (e: Exception) {}
        }
        list
    }

    suspend fun postComment(type: String, targetId: String, user: UserProfile, text: String): CommentItem = withContext(Dispatchers.IO) {
        val now = System.currentTimeMillis()
        val comment = CommentItem(
            id = "c_${now}",
            userId = user.id,
            name = user.name,
            avatar = user.picture,
            level = user.level,
            title = user.title,
            text = text,
            timestamp = now
        )
        UpstashClient.rpush("comments:$type:$targetId", gson.toJson(comment))
        comment
    }

    // ===== CLANS =====

    fun xpForClanLevel(level: Int): Long = Math.round(2200.0 * level + 260.0 * level * level)

    fun clanLevelFromXp(xp: Long): Int {
        if (xp <= 0) return 1
        var level = Math.max(1, Math.floor((-2200.0 + Math.sqrt(2200.0 * 2200.0 + 4.0 * 260.0 * xp)) / (2.0 * 260.0)).toInt())
        while (xp >= xpForClanLevel(level)) level++
        while (level > 1 && xp < xpForClanLevel(level - 1)) level--
        return level
    }

    suspend fun listClans(): List<ClanItem> = withContext(Dispatchers.IO) {
        val clanIds = UpstashClient.zrevrange("clan:all", 0, 30)
        val list = mutableListOf<ClanItem>()
        clanIds.forEach { cid ->
            val raw = UpstashClient.get("clan:$cid") ?: return@forEach
            try {
                val c = gson.fromJson(raw, ClanItem::class.java)
                val members = UpstashClient.hgetall("clan:members:$cid")
                c.memberCount = members.size.coerceAtLeast(1)
                c.level = clanLevelFromXp(c.xp)
                list.add(c)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
        list
    }

    suspend fun getMyClan(userId: String): ClanItem? = withContext(Dispatchers.IO) {
        val clanId = UpstashClient.get("clan:userClan:$userId") ?: return@withContext null
        val raw = UpstashClient.get("clan:$clanId") ?: return@withContext null
        try {
            val c = gson.fromJson(raw, ClanItem::class.java)
            val members = UpstashClient.hgetall("clan:members:$clanId")
            c.memberCount = members.size.coerceAtLeast(1)
            c.level = clanLevelFromXp(c.xp)
            c
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    suspend fun createClan(user: UserProfile, name: String, tag: String, desc: String, icon: String, color: String): ClanItem = withContext(Dispatchers.IO) {
        val cid = "clan_${System.currentTimeMillis()}"
        val clan = ClanItem(
            id = cid,
            name = name,
            tag = tag.uppercase(),
            description = desc,
            desc = desc,
            icon = icon,
            color = color,
            leaderId = user.id,
            leaderName = user.name,
            memberCount = 1
        )
        UpstashClient.set("clan:$cid", gson.toJson(clan))
        UpstashClient.zadd("clan:all", 0.0, cid)
        UpstashClient.set("clan:userClan:${user.id}", cid)

        val leader = ClanMemberItem(userId = user.id, name = user.name, avatar = user.picture, role = "LEADER")
        UpstashClient.hset("clan:members:$cid", user.id, gson.toJson(leader))
        clan
    }

    suspend fun joinClan(user: UserProfile, clanId: String): Boolean = withContext(Dispatchers.IO) {
        val member = ClanMemberItem(userId = user.id, name = user.name, avatar = user.picture, role = "MEMBER")
        UpstashClient.hset("clan:members:$clanId", user.id, gson.toJson(member))
        UpstashClient.set("clan:userClan:${user.id}", clanId)
        true
    }

    suspend fun leaveClan(userId: String, clanId: String): Boolean = withContext(Dispatchers.IO) {
        UpstashClient.hdel("clan:members:$clanId", userId)
        UpstashClient.del("clan:userClan:$userId")
        true
    }

    // ===== PASSWORD RESET =====

    suspend fun resetPassword(email: String, newPass: String): Pair<Boolean, String> = withContext(Dispatchers.IO) {
        val normEmail = email.trim().lowercase()
        val userId = UpstashClient.get("user:email:$normEmail")
            ?: return@withContext false to "Email tidak terdaftar di sistem."
        val userRaw = UpstashClient.get("user:$userId")
            ?: return@withContext false to "Data akun tidak ditemukan."

        val mapType = object : TypeToken<MutableMap<String, Any>>() {}.type
        val userMap: MutableMap<String, Any> = gson.fromJson(userRaw, mapType)

        val hashedPass = try {
            BCrypt.hashpw(newPass, BCrypt.gensalt(10))
        } catch (e: Exception) {
            newPass
        }

        userMap["password"] = hashedPass
        val now = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }.format(Date())
        userMap["updatedAt"] = now

        UpstashClient.set("user:$userId", gson.toJson(userMap))
        true to "Kata sandi berhasil diperbarui! Silakan masuk."
    }

    // ===== WATCH TIME & LEVELING SYSTEM =====

    private val TITLE_THRESHOLDS = listOf(
        1000L to "Anime Creator",
        500L to "Anime Universe",
        300L to "Anime Immortal",
        200L to "Anime Emperor",
        150L to "Anime Overlord",
        100L to "Anime Supreme",
        75L to "Anime God",
        50L to "Anime Legend",
        30L to "Anime Master",
        20L to "Anime Enthusiast",
        10L to "Anime Lover",
        5L to "Anime Watcher",
        0L to "Anime Newbie"
    )

    fun getTitleForLevel(level: Long): String {
        for ((threshold, title) in TITLE_THRESHOLDS) {
            if (level >= threshold) return title
        }
        return "Anime Newbie"
    }

    suspend fun addWatchTime(userId: String, seconds: Long): LevelUpResult = withContext(Dispatchers.IO) {
        if (seconds <= 0) return@withContext LevelUpResult(false)
        val userRaw = UpstashClient.get("user:$userId") ?: return@withContext LevelUpResult(false)
        val mapType = object : TypeToken<MutableMap<String, Any>>() {}.type
        val userMap: MutableMap<String, Any> = gson.fromJson(userRaw, mapType)

        val currentWatchTime = (userMap["watchTime"] as? Number)?.toLong() ?: 0L
        val newWatchTime = currentWatchTime + seconds

        val oldLevel = (userMap["level"] as? Number)?.toLong() ?: (currentWatchTime / 600L).coerceAtLeast(1L)
        val newLevel = (newWatchTime / 600L).coerceAtLeast(1L)
        val levelUp = newLevel > oldLevel

        userMap["watchTime"] = newWatchTime
        userMap["level"] = newLevel

        val newTitle = getTitleForLevel(newLevel)
        userMap["title"] = newTitle

        val now = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }.format(Date())
        userMap["lastWatchUpdate"] = now

        var coinsEarned = 0L
        if (levelUp) {
            val levelsGained = (newLevel - oldLevel).coerceAtLeast(1L)
            coinsEarned = levelsGained * 50L
            val currentCoins = (userMap["coins"] as? Number)?.toLong() ?: 0L
            userMap["coins"] = currentCoins + coinsEarned
        }

        UpstashClient.set("user:$userId", gson.toJson(userMap))
        UpstashClient.zadd("leaderboard", newWatchTime.toDouble(), userId)

        // Update quest progress for today
        val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
        if (seconds >= 20) {
            UpstashClient.set("quest:progress:$userId:d:$today:watch_episode", "1")
        }

        LevelUpResult(
            success = true,
            oldLevel = oldLevel,
            newLevel = newLevel,
            levelUp = levelUp,
            watchTime = newWatchTime,
            newTitle = newTitle,
            coinsEarned = coinsEarned
        )
    }
}
