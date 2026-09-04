package com.ndikanime.app.data.storage

import android.content.Context
import android.content.SharedPreferences
import com.ndikanime.app.data.model.UserProfile

class AuthManager(context: Context) {

    private val prefs: SharedPreferences =
        context.getSharedPreferences("ndikanime_auth", Context.MODE_PRIVATE)

    var token: String?
        get() = prefs.getString("jwt_token", null)
        set(value) = prefs.edit().putString("jwt_token", value).apply()

    var userId: String?
        get() = prefs.getString("user_id", null)
        set(value) = prefs.edit().putString("user_id", value).apply()

    var userName: String?
        get() = prefs.getString("user_name", "Wibu Anonim")
        set(value) = prefs.edit().putString("user_name", value).apply()

    var userAvatar: String?
        get() = prefs.getString("user_avatar", null)
        set(value) = prefs.edit().putString("user_avatar", value).apply()

    var userEmail: String?
        get() = prefs.getString("user_email", null)
        set(value) = prefs.edit().putString("user_email", value).apply()

    var userLevel: Long
        get() = prefs.getLong("user_level", 1L)
        set(value) = prefs.edit().putLong("user_level", value).apply()

    var userTitle: String?
        get() = prefs.getString("user_title", "Anime Newbie")
        set(value) = prefs.edit().putString("user_title", value).apply()

    var userWatchTime: Long
        get() = prefs.getLong("user_watch_time", 0L)
        set(value) = prefs.edit().putLong("user_watch_time", value).apply()

    var userCoins: Long
        get() = prefs.getLong("user_coins", 0L)
        set(value) = prefs.edit().putLong("user_coins", value).apply()

    var userBio: String?
        get() = prefs.getString("user_bio", null)
        set(value) = prefs.edit().putString("user_bio", value).apply()

    var userFrame: String?
        get() = prefs.getString("user_frame", null)
        set(value) = prefs.edit().putString("user_frame", value).apply()

    var userAura: String?
        get() = prefs.getString("user_aura", null)
        set(value) = prefs.edit().putString("user_aura", value).apply()

    var isAdmin: Boolean
        get() = prefs.getBoolean("user_is_admin", false)
        set(value) = prefs.edit().putBoolean("user_is_admin", value).apply()

    val isLoggedIn: Boolean
        get() = !token.isNullOrBlank()

    fun saveUserSession(token: String, user: UserProfile?) {
        this.token = token
        saveUserProfile(user)
    }

    fun saveUserProfile(user: UserProfile?) {
        if (user == null) return
        this.userId = user.id
        this.userName = user.name
        this.userAvatar = user.picture
        this.userEmail = user.email
        this.userLevel = user.level
        this.userTitle = user.title
        this.userWatchTime = user.watchTime
        this.userCoins = user.coins
        this.userBio = user.bio
        this.userFrame = user.frame
        this.userAura = user.aura
        this.isAdmin = user.isAdmin
    }

    fun getUserProfile(): UserProfile? {
        val uid = userId ?: return null
        val uname = userName ?: "User"
        return UserProfile(
            id = uid,
            name = uname,
            email = userEmail,
            picture = userAvatar,
            level = userLevel,
            title = userTitle,
            watchTime = userWatchTime,
            coins = userCoins,
            bio = userBio,
            frame = userFrame,
            aura = userAura,
            isAdmin = isAdmin
        )
    }

    fun logout() {
        prefs.edit().clear().apply()
    }
}
