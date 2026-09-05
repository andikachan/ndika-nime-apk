package com.ndikanime.app.presentation.navigation

sealed class Screen(val route: String) {
    object Home : Screen("home")
    object Explore : Screen("explore")
    object Komik : Screen("komik")
    object Gacha : Screen("gacha")
    object DeckBuilder : Screen("deck_builder")
    object Arena : Screen("arena")
    object Tower : Screen("tower")
    object Raid : Screen("raid")
    object Isekai : Screen("isekai")
    object Colosseum : Screen("colosseum")
    object Market : Screen("market")
    object Clan : Screen("clan")
    object Chat : Screen("chat")
    object W2G : Screen("w2g")
    object Trivia : Screen("trivia")
    object Mood : Screen("mood")
    object Achievements : Screen("achievements")
    object ProfileCustomizer : Screen("profile_customizer")
    object Auth : Screen("auth")
    object Admin : Screen("admin")

    object Watch : Screen("watch/{animeId}/{episodeId}/{title}/{poster}") {
        fun createRoute(animeId: String, episodeId: String, title: String, poster: String): String {
            val encodedTitle = java.net.URLEncoder.encode(title, "UTF-8")
            val encodedPoster = java.net.URLEncoder.encode(poster, "UTF-8")
            return "watch/$animeId/$episodeId/$encodedTitle/$encodedPoster"
        }
    }

    object MangaDetail : Screen("manga_detail/{slug}") {
        fun createRoute(slug: String): String = "manga_detail/$slug"
    }

    object Reader : Screen("reader/{slug}/{title}") {
        fun createRoute(slug: String, title: String): String {
            val encodedTitle = java.net.URLEncoder.encode(title, "UTF-8")
            return "reader/$slug/$encodedTitle"
        }
    }

    object Profile : Screen("profile/{userId}") {
        fun createRoute(userId: String): String = "profile/$userId"
    }

    object DirectMessage : Screen("dm/{userId}/{userName}") {
        fun createRoute(userId: String, userName: String): String {
            val encodedName = java.net.URLEncoder.encode(userName, "UTF-8")
            return "dm/$userId/$encodedName"
        }
    }

    object W2GRoom : Screen("w2g_room/{roomId}/{passcode}") {
        fun createRoute(roomId: String, passcode: String): String {
            return "w2g_room/$roomId/${passcode.ifBlank { "none" }}"
        }
    }
}
