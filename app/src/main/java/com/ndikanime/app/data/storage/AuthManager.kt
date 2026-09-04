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

    val isLoggedIn: Boolean
        get() = !token.isNullOrBlank()

    fun saveUserSession(token: String, user: UserProfile?) {
        this.token = token
        this.userId = user?.id
        this.userName = user?.name
        this.userAvatar = user?.picture
    }

    fun logout() {
        prefs.edit().clear().apply()
    }
}
