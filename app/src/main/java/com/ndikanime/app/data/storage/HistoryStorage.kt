package com.ndikanime.app.data.storage

import android.content.Context
import android.content.SharedPreferences
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.ndikanime.app.data.api.ApiClient
import com.ndikanime.app.data.model.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class HistoryStorage(context: Context) {

    private val prefs: SharedPreferences =
        context.getSharedPreferences("ndikanime_prefs", Context.MODE_PRIVATE)
    private val gson = Gson()
    private val authManager = AuthManager(context)

    fun saveAnimeHistory(
        id: String,
        title: String,
        cover: String,
        episodeTitle: String,
        episodeIndex: String? = null,
        progressMs: Long = 0L
    ) {
        val list = getAnimeHistory().toMutableList()
        list.removeAll { it.id == id }
        list.add(
            0,
            HistoryItem(
                id = id,
                type = "anime",
                title = title,
                cover = cover,
                subInfo = episodeTitle,
                timestamp = System.currentTimeMillis(),
                progressMs = progressMs
            )
        )
        if (list.size > 50) list.removeAt(list.lastIndex)
        saveList("anime_history", list)

        // Sync to remote Upstash Redis if logged in
        val uid = authManager.userId
        if (authManager.isLoggedIn && !uid.isNullOrBlank()) {
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    val epIdx = episodeIndex ?: episodeTitle.replace(Regex("[^0-9]"), "").ifBlank { "1" }
                    com.ndikanime.app.data.upstash.UpstashRepository.saveRemoteHistory(
                        uid,
                        HistoryPostPayload(
                            type = "anime",
                            animeId = id,
                            title = title,
                            imageCover = cover,
                            imagePoster = cover,
                            currentEpisode = RemoteHistoryEpisode(index = epIdx, title = episodeTitle)
                        )
                    )
                } catch (e: Exception) {
                    // silent fail on network error
                }
            }
        }
    }

    fun getAnimeHistory(): List<HistoryItem> {
        return getList("anime_history")
    }

    fun saveMangaHistory(
        slug: String,
        title: String,
        cover: String,
        chapterTitle: String,
        chapterSlug: String? = null
    ) {
        val list = getMangaHistory().toMutableList()
        list.removeAll { it.id == slug }
        list.add(
            0,
            HistoryItem(
                id = slug,
                type = "manga",
                title = title,
                cover = cover,
                subInfo = chapterTitle,
                timestamp = System.currentTimeMillis()
            )
        )
        if (list.size > 50) list.removeAt(list.lastIndex)
        saveList("manga_history", list)

        // Sync to remote Upstash Redis if logged in
        val uid = authManager.userId
        if (authManager.isLoggedIn && !uid.isNullOrBlank()) {
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    val chNum = chapterTitle.replace(Regex("[^0-9.]"), "").ifBlank { "1" }
                    com.ndikanime.app.data.upstash.UpstashRepository.saveRemoteHistory(
                        uid,
                        HistoryPostPayload(
                            type = "manga",
                            animeId = slug,
                            title = title,
                            imageCover = cover,
                            imagePoster = cover,
                            currentChapter = RemoteHistoryChapter(chapter = chNum, slug = chapterSlug ?: slug)
                        )
                    )
                } catch (e: Exception) {
                    // silent fail on network error
                }
            }
        }
    }

    fun getMangaHistory(): List<HistoryItem> {
        return getList("manga_history")
    }

    suspend fun syncRemoteHistory(): Boolean {
        val uid = authManager.userId
        if (!authManager.isLoggedIn || uid.isNullOrBlank()) return false
        return try {
            val remoteList = com.ndikanime.app.data.upstash.UpstashRepository.getRemoteHistory(uid)
            if (remoteList.isNotEmpty()) {
                val animeList = getAnimeHistory().toMutableList()
                val mangaList = getMangaHistory().toMutableList()

                for (item in remoteList) {
                    val aId = item.animeId ?: continue
                    val title = item.getEffectiveTitle()
                    val cover = item.getEffectiveCover()

                    if (item.type == "manga") {
                        val chTitle = item.currentChapter?.chapter?.let { "Chapter $it" } ?: "Chapter"
                        if (mangaList.none { it.id == aId }) {
                            mangaList.add(
                                HistoryItem(
                                    id = aId,
                                    type = "manga",
                                    title = title,
                                    cover = cover,
                                    subInfo = chTitle,
                                    timestamp = System.currentTimeMillis()
                                )
                            )
                        }
                    } else {
                        val epTitle = item.currentEpisode?.title
                            ?: item.currentEpisode?.index?.let { "Episode $it" }
                            ?: "Ditonton"
                        if (animeList.none { it.id == aId }) {
                            animeList.add(
                                HistoryItem(
                                    id = aId,
                                    type = "anime",
                                    title = title,
                                    cover = cover,
                                    subInfo = epTitle,
                                    timestamp = System.currentTimeMillis()
                                )
                            )
                        }
                    }
                }

                saveList("anime_history", animeList)
                saveList("manga_history", mangaList)
            }
            true
        } catch (e: Exception) {
            false
        }
    }

    fun toggleFavorite(item: HistoryItem): Boolean {
        val list = getFavorites().toMutableList()
        val existing = list.find { it.id == item.id }
        val isNowFav = if (existing != null) {
            list.remove(existing)
            false
        } else {
            item.isFavorite = true
            list.add(0, item)
            true
        }
        saveList("favorites", list)
        return isNowFav
    }

    fun isFavorite(id: String): Boolean {
        return getFavorites().any { it.id == id }
    }

    fun getFavorites(): List<HistoryItem> {
        return getList("favorites")
    }

    fun deleteItem(id: String, type: String) {
        when (type) {
            "anime" -> {
                val list = getAnimeHistory().toMutableList()
                list.removeAll { it.id == id }
                saveList("anime_history", list)
            }
            "manga" -> {
                val list = getMangaHistory().toMutableList()
                list.removeAll { it.id == id }
                saveList("manga_history", list)
            }
            "favorite" -> {
                val list = getFavorites().toMutableList()
                list.removeAll { it.id == id }
                saveList("favorites", list)
            }
        }

        val uid = authManager.userId
        if (authManager.isLoggedIn && !uid.isNullOrBlank() && (type == "anime" || type == "manga")) {
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    com.ndikanime.app.data.upstash.UpstashRepository.deleteRemoteHistory(uid, id, type)
                } catch (e: Exception) {}
            }
        }
    }

    fun clearAll(type: String) {
        when (type) {
            "anime" -> prefs.edit().remove("anime_history").apply()
            "manga" -> prefs.edit().remove("manga_history").apply()
            "favorite" -> prefs.edit().remove("favorites").apply()
        }

        val uid = authManager.userId
        if (authManager.isLoggedIn && !uid.isNullOrBlank() && (type == "anime" || type == "manga")) {
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    com.ndikanime.app.data.upstash.UpstashRepository.deleteRemoteHistory(uid, null, type)
                } catch (e: Exception) {}
            }
        }
    }

    private fun saveList(key: String, list: List<HistoryItem>) {
        val json = gson.toJson(list)
        prefs.edit().putString(key, json).apply()
    }

    private fun getList(key: String): List<HistoryItem> {
        val json = prefs.getString(key, null) ?: return emptyList()
        return try {
            val type = object : TypeToken<List<HistoryItem>>() {}.type
            gson.fromJson(json, type) ?: emptyList()
        } catch (e: Exception) {
            emptyList()
        }
    }
}
