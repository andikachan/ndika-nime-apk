package com.ndikanime.app.presentation.navigation

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.ndikanime.app.data.storage.AuthManager
import com.ndikanime.app.presentation.screens.admin.AdminPanelScreen
import com.ndikanime.app.presentation.screens.arena.ArenaScreen
import com.ndikanime.app.presentation.screens.arena.TowerScreen
import com.ndikanime.app.presentation.screens.auth.AuthScreen
import com.ndikanime.app.presentation.screens.chat.DirectMessageScreen
import com.ndikanime.app.presentation.screens.chat.GlobalChatScreen
import com.ndikanime.app.presentation.screens.clan.ClanScreen
import com.ndikanime.app.presentation.screens.explore.ExploreScreen
import com.ndikanime.app.presentation.screens.gacha.DeckBuilderScreen
import com.ndikanime.app.presentation.screens.gacha.GachaScreen
import com.ndikanime.app.presentation.screens.home.HomeScreen
import com.ndikanime.app.presentation.screens.isekai.IsekaiMapScreen
import com.ndikanime.app.presentation.screens.manga.KomikScreen
import com.ndikanime.app.presentation.screens.manga.MangaDetailScreen
import com.ndikanime.app.presentation.screens.manga.ReaderScreen
import com.ndikanime.app.presentation.screens.market.MarketplaceScreen
import com.ndikanime.app.presentation.screens.mood.MoodPickerScreen
import com.ndikanime.app.presentation.screens.profile.AchievementsScreen
import com.ndikanime.app.presentation.screens.profile.ProfileCustomizerScreen
import com.ndikanime.app.presentation.screens.profile.ProfileScreen
import com.ndikanime.app.presentation.screens.raid.WorldBossScreen
import com.ndikanime.app.presentation.screens.story.StoryViewerScreen
import com.ndikanime.app.presentation.screens.tournament.ColosseumScreen
import com.ndikanime.app.presentation.screens.trivia.TriviaScreen
import com.ndikanime.app.presentation.screens.w2g.W2GRoomScreen
import com.ndikanime.app.presentation.screens.w2g.Watch2getherScreen
import com.ndikanime.app.presentation.screens.watch.WatchScreen
import com.ndikanime.app.presentation.theme.BgDarkMain

@Composable
fun NeforaNavGraph(
    navController: NavHostController,
    authManager: AuthManager,
    modifier: Modifier = Modifier
) {
    val isLoggedIn = authManager.isLoggedIn || authManager.userId != null
    val startDestination = if (isLoggedIn) Screen.Home.route else Screen.Auth.route

    Scaffold(
        containerColor = BgDarkMain,
        bottomBar = {
            NeforaBottomBar(navController = navController)
        }
    ) { paddingValues ->
        NavHost(
            navController = navController,
            startDestination = startDestination,
            modifier = modifier.fillMaxSize().padding(bottom = paddingValues.calculateBottomPadding())
        ) {
            composable(Screen.Home.route) {
                HomeScreen(navController = navController, authManager = authManager)
            }
            composable(Screen.Explore.route) {
                ExploreScreen(navController = navController)
            }
            composable(Screen.Komik.route) {
                KomikScreen(navController = navController)
            }
            composable(Screen.Gacha.route) {
                GachaScreen(navController = navController, authManager = authManager)
            }
            composable(Screen.DeckBuilder.route) {
                DeckBuilderScreen(navController = navController)
            }
            composable(Screen.Arena.route) {
                ArenaScreen(navController = navController)
            }
            composable(Screen.Tower.route) {
                TowerScreen(navController = navController)
            }
            composable(Screen.Raid.route) {
                WorldBossScreen(navController = navController)
            }
            composable(Screen.Isekai.route) {
                IsekaiMapScreen(navController = navController)
            }
            composable(Screen.Colosseum.route) {
                ColosseumScreen(navController = navController)
            }
            composable(Screen.Market.route) {
                MarketplaceScreen(navController = navController)
            }
            composable(Screen.Clan.route) {
                ClanScreen(navController = navController)
            }
            composable(Screen.Chat.route) {
                GlobalChatScreen(navController = navController, authManager = authManager)
            }
            composable(Screen.W2G.route) {
                Watch2getherScreen(navController = navController)
            }
            composable(Screen.Trivia.route) {
                TriviaScreen(navController = navController)
            }
            composable(Screen.Mood.route) {
                MoodPickerScreen(navController = navController)
            }
            composable(Screen.Achievements.route) {
                AchievementsScreen(navController = navController)
            }
            composable(Screen.ProfileCustomizer.route) {
                ProfileCustomizerScreen(navController = navController)
            }
            composable(Screen.Auth.route) {
                AuthScreen(navController = navController, authManager = authManager)
            }
            composable(Screen.Admin.route) {
                AdminPanelScreen(navController = navController, authManager = authManager)
            }

            composable(
                route = Screen.Watch.route,
                arguments = listOf(
                    navArgument("animeId") { type = NavType.StringType },
                    navArgument("episodeId") { type = NavType.StringType },
                    navArgument("title") { type = NavType.StringType },
                    navArgument("poster") { type = NavType.StringType }
                )
            ) { backStackEntry ->
                val aId = backStackEntry.arguments?.getString("animeId") ?: ""
                val epId = backStackEntry.arguments?.getString("episodeId") ?: ""
                val title = java.net.URLDecoder.decode(backStackEntry.arguments?.getString("title") ?: "", "UTF-8")
                val poster = java.net.URLDecoder.decode(backStackEntry.arguments?.getString("poster") ?: "", "UTF-8")

                WatchScreen(
                    navController = navController,
                    animeId = aId,
                    episodeId = epId,
                    animeTitle = title,
                    poster = poster,
                    authManager = authManager
                )
            }

            composable(
                route = Screen.MangaDetail.route,
                arguments = listOf(navArgument("slug") { type = NavType.StringType })
            ) { backStackEntry ->
                val slug = backStackEntry.arguments?.getString("slug") ?: ""
                MangaDetailScreen(navController = navController, slug = slug)
            }

            composable(
                route = Screen.Reader.route,
                arguments = listOf(
                    navArgument("slug") { type = NavType.StringType },
                    navArgument("title") { type = NavType.StringType }
                )
            ) { backStackEntry ->
                val slug = backStackEntry.arguments?.getString("slug") ?: ""
                val title = java.net.URLDecoder.decode(backStackEntry.arguments?.getString("title") ?: "", "UTF-8")
                ReaderScreen(navController = navController, slug = slug, title = title)
            }

            composable(
                route = Screen.Profile.route,
                arguments = listOf(navArgument("userId") { type = NavType.StringType })
            ) { backStackEntry ->
                val uId = backStackEntry.arguments?.getString("userId") ?: "me"
                ProfileScreen(navController = navController, userId = uId, authManager = authManager)
            }

            composable(
                route = Screen.DirectMessage.route,
                arguments = listOf(
                    navArgument("userId") { type = NavType.StringType },
                    navArgument("userName") { type = NavType.StringType }
                )
            ) { backStackEntry ->
                val uId = backStackEntry.arguments?.getString("userId") ?: ""
                val uName = java.net.URLDecoder.decode(backStackEntry.arguments?.getString("userName") ?: "", "UTF-8")
                DirectMessageScreen(navController = navController, userId = uId, userName = uName)
            }

            composable(
                route = Screen.W2GRoom.route,
                arguments = listOf(
                    navArgument("roomId") { type = NavType.StringType },
                    navArgument("passcode") { type = NavType.StringType }
                )
            ) { backStackEntry ->
                val rId = backStackEntry.arguments?.getString("roomId") ?: ""
                val pass = backStackEntry.arguments?.getString("passcode") ?: ""
                W2GRoomScreen(navController = navController, roomId = rId, passcode = pass, authManager = authManager)
            }
        }
    }
}
