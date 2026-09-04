package com.ndikanime.app.data.storage

import android.content.Context
import android.content.SharedPreferences
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.ndikanime.app.data.model.HistoryItem

class HistoryStorage(context: Context) {

    private val prefs: SharedPreferences =
        context.getSharedPreferences("ndikanime_prefs", Context.MODE_PRIVATE)
    private val gson = Gson()

    fun saveAnimeHistory(
        id: String,
        title: String,
        cover: String,
        episodeTitle: String,
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
    }

    fun getAnimeHistory(): List<HistoryItem> {
        return getList("anime_history")
    }

    fun saveMangaHistory(
        slug: String,
        title: String,
        cover: String,
        chapterTitle: String
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
    }

    fun getMangaHistory(): List<HistoryItem> {
        return getList("manga_history")
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
    }

    fun clearAll(type: String) {
        when (type) {
            "anime" -> prefs.edit().remove("anime_history").apply()
            "manga" -> prefs.edit().remove("manga_history").apply()
            "favorite" -> prefs.edit().remove("favorites").apply()
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
