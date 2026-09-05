package com.ndikanime.app.presentation.screens.home

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import coil.compose.AsyncImage
import com.ndikanime.app.data.api.ApiClient
import com.ndikanime.app.data.model.AnimeItem
import com.ndikanime.app.data.model.OngoingItem
import com.ndikanime.app.data.model.ScheduleDay
import com.ndikanime.app.data.storage.AuthManager
import com.ndikanime.app.presentation.components.AvatarFrameView
import com.ndikanime.app.presentation.components.ShimmerRow
import com.ndikanime.app.presentation.navigation.Screen
import com.ndikanime.app.presentation.theme.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)
@Composable
fun HomeScreen(
    navController: NavController,
    authManager: AuthManager,
    modifier: Modifier = Modifier
) {
    val coroutineScope = rememberCoroutineScope()
    var isLoading by remember { mutableStateOf(true) }
    var ongoingList by remember { mutableStateOf<List<OngoingItem>>(emptyList()) }
    var popularList by remember { mutableStateOf<List<AnimeItem>>(emptyList()) }
    var scheduleList by remember { mutableStateOf<List<ScheduleDay>>(emptyList()) }
    var selectedDayIndex by remember { mutableIntStateOf(0) }

    val userProfile = authManager.getUserProfile()

    LaunchedEffect(Unit) {
        coroutineScope.launch {
            try {
                isLoading = true
                val ongoingRes = ApiClient.service.getOngoing(1)
                if (ongoingRes.status && ongoingRes.data != null) {
                    ongoingList = ongoingRes.data.ongoingList ?: emptyList()
                }

                val popularRes = ApiClient.service.getPopular(1)
                if (popularRes.status && popularRes.data != null) {
                    popularList = popularRes.data.popularList ?: emptyList()
                }

                val scheduleRes = ApiClient.service.getSchedule()
                if (scheduleRes.status && scheduleRes.data != null) {
                    scheduleList = scheduleRes.data.scheduleList ?: emptyList()
                }
            } catch (e: Exception) {
                // Keep local / mock state
            } finally {
                isLoading = false
            }
        }
    }

    Scaffold(
        containerColor = BgDarkMain,
        topBar = {
            HomeTopBar(
                coins = userProfile?.coins ?: 1500L,
                gems = 50,
                avatarUrl = userProfile?.picture,
                level = (userProfile?.level ?: 1L).toInt(),
                onProfileClick = { navController.navigate(Screen.Profile.createRoute("me")) },
                onSearchClick = { navController.navigate(Screen.Explore.route) }
            )
        }
    ) { paddingValues ->
        LazyColumn(
            modifier = modifier
                .fillMaxSize()
                .padding(paddingValues),
            contentPadding = PaddingValues(bottom = 90.dp)
        ) {
            // 1. Stories Tray
            item {
                StoriesTray(
                    onStoryClick = {},
                    onCreateStory = {}
                )
            }

            // 2. Hero Carousel Slider
            item {
                if (popularList.isNotEmpty()) {
                    HeroSlider(
                        animeList = popularList.take(8),
                        onAnimeClick = { anime ->
                            navController.navigate(
                                Screen.Watch.createRoute(
                                    animeId = anime.id ?: "",
                                    episodeId = "",
                                    title = anime.title ?: "Anime",
                                    poster = anime.poster ?: ""
                                )
                            )
                        }
                    )
                } else if (isLoading) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(260.dp)
                            .padding(16.dp)
                            .clip(RoundedCornerShape(20.dp))
                            .background(BgCardDark)
                    )
                }
            }

            // 3. Quick Action Hub (RPG, Gacha, Arena, Raid, W2G, Trivia)
            item {
                QuickActionGrid(
                    onGachaClick = { navController.navigate(Screen.Gacha.route) },
                    onArenaClick = { navController.navigate(Screen.Arena.route) },
                    onIsekaiClick = { navController.navigate(Screen.Isekai.route) },
                    onRaidClick = { navController.navigate(Screen.Raid.route) },
                    onW2GClick = { navController.navigate(Screen.W2G.route) },
                    onTriviaClick = { navController.navigate(Screen.Trivia.route) }
                )
            }

            // 4. Anime Sedang Tayang (Ongoing)
            item {
                SectionHeader(title = "Anime Sedang Tayang", actionText = "Lihat Semua") {
                    navController.navigate(Screen.Explore.route)
                }

                if (isLoading) {
                    ShimmerRow(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp))
                } else {
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(ongoingList) { item ->
                            AnimeOngoingCard(item = item) {
                                navController.navigate(
                                    Screen.Watch.createRoute(
                                        animeId = item.id ?: "",
                                        episodeId = "",
                                        title = item.title ?: "Anime",
                                        poster = item.poster ?: ""
                                    )
                                )
                            }
                        }
                    }
                }
            }

            // 5. Jadwal Rilis Harian (Schedule)
            item {
                Spacer(modifier = Modifier.height(20.dp))
                SectionHeader(title = "Jadwal Rilis Harian")

                if (scheduleList.isNotEmpty()) {
                    val days = scheduleList.map { it.day ?: "Hari" }
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        itemsIndexed(days) { idx, dayName ->
                            val isSelected = selectedDayIndex == idx
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = if (isSelected) GoldPrimary else BgCardDark,
                                border = if (!isSelected) BorderStroke(1.dp, BorderGlass) else null,
                                modifier = Modifier.clickable { selectedDayIndex = idx }
                            ) {
                                Text(
                                    text = dayName,
                                    color = if (isSelected) BgDarkMain else TextSecondary,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                    fontSize = 12.sp,
                                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp)
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    val selectedDayAnime = scheduleList.getOrNull(selectedDayIndex)?.animeList ?: emptyList()
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(selectedDayAnime) { anime ->
                            AnimeScheduleCard(anime = anime) {
                                navController.navigate(
                                    Screen.Watch.createRoute(
                                        animeId = anime.id ?: "",
                                        episodeId = "",
                                        title = anime.title ?: "Anime",
                                        poster = anime.poster ?: ""
                                    )
                                )
                            }
                        }
                    }
                }
            }

            // 6. Top 10 Terpopuler (Leaderboard)
            item {
                Spacer(modifier = Modifier.height(20.dp))
                SectionHeader(title = "Top 10 Terpopuler Minggu Ini")

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    popularList.take(10).forEachIndexed { index, anime ->
                        Top10RankItem(rank = index + 1, anime = anime) {
                            navController.navigate(
                                Screen.Watch.createRoute(
                                    animeId = anime.id ?: "",
                                    episodeId = "",
                                    title = anime.title ?: "Anime",
                                    poster = anime.poster ?: ""
                                )
                            )
                        }
                    }
                }
            }

            // 7. Rich Footer
            item {
                Spacer(modifier = Modifier.height(30.dp))
                CyberpunkFooter()
            }
        }
    }
}

@Composable
private fun HomeTopBar(
    coins: Long,
    gems: Int,
    avatarUrl: String?,
    level: Int,
    onProfileClick: () -> Unit,
    onSearchClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(BgDarkMain)
            .padding(horizontal = 16.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.clickable { onProfileClick() }
        ) {
            AvatarFrameView(
                avatarUrl = avatarUrl,
                level = level,
                size = 40.dp
            )
            Spacer(modifier = Modifier.width(8.dp))
            Column {
                Text(
                    text = "NEFORA",
                    color = GoldPrimary,
                    fontWeight = FontWeight.Black,
                    fontSize = 18.sp,
                    letterSpacing = 1.sp
                )
                Text(
                    text = "Anime & Holographic Realm",
                    color = TextMuted,
                    fontSize = 10.sp
                )
            }
        }

        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Coins Badge
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = BgCardDark,
                border = BorderStroke(1.dp, BorderGlass)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Text(text = "🪙", fontSize = 12.sp)
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "$coins",
                        color = GoldPrimary,
                        fontWeight = FontWeight.Bold,
                        fontSize = 11.sp
                    )
                }
            }

            IconButton(
                onClick = onSearchClick,
                modifier = Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(BgCardDark)
            ) {
                Icon(
                    imageVector = Icons.Default.Search,
                    contentDescription = "Search",
                    tint = TextPrimary,
                    modifier = Modifier.size(18.dp)
                )
            }
        }
    }
}

@Composable
private fun StoriesTray(
    onStoryClick: () -> Unit,
    onCreateStory: () -> Unit
) {
    LazyRow(
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.clickable { onCreateStory() }
            ) {
                Box(
                    modifier = Modifier
                        .size(62.dp)
                        .clip(CircleShape)
                        .background(BgCardDark)
                        .border(1.dp, GoldPrimary, CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Add,
                        contentDescription = "Create Story",
                        tint = GoldPrimary,
                        modifier = Modifier.size(28.dp)
                    )
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text("Cerita Anda", color = TextSecondary, fontSize = 10.sp)
            }
        }

        val dummyStories = listOf("Gojō_Domain", "Luffy_G5", "Frieren_Spell", "Solo_Shadow", "Megumin_Boom")
        items(dummyStories) { name ->
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.clickable { onStoryClick() }
            ) {
                Box(
                    modifier = Modifier
                        .size(62.dp)
                        .clip(CircleShape)
                        .background(Brush.sweepGradient(listOf(FlameOrange, GoldPrimary, FlameOrange)))
                        .padding(2.5.dp),
                    contentAlignment = Alignment.Center
                ) {
                    AsyncImage(
                        model = "https://api.dicebear.com/7.x/bottts/png?seed=$name",
                        contentDescription = name,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier
                            .fillMaxSize()
                            .clip(CircleShape)
                            .background(BgDarkMain)
                    )
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(name, color = TextPrimary, fontSize = 10.sp, maxLines = 1)
            }
        }
    }
}

@OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)
@Composable
private fun HeroSlider(
    animeList: List<AnimeItem>,
    onAnimeClick: (AnimeItem) -> Unit
) {
    val pagerState = rememberPagerState(pageCount = { animeList.size })

    LaunchedEffect(Unit) {
        while (true) {
            delay(5000)
            if (animeList.isNotEmpty()) {
                val next = (pagerState.currentPage + 1) % animeList.size
                pagerState.animateScrollToPage(next)
            }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(260.dp)
            .padding(16.dp)
            .clip(RoundedCornerShape(20.dp))
    ) {
        HorizontalPager(
            state = pagerState,
            modifier = Modifier.fillMaxSize()
        ) { page ->
            val anime = animeList[page]
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .clickable { onAnimeClick(anime) }
            ) {
                AsyncImage(
                    model = anime.poster,
                    contentDescription = anime.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize()
                )

                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(
                            Brush.verticalGradient(
                                listOf(
                                    Color.Transparent,
                                    Color(0x88000000),
                                    BgDarkMain
                                )
                            )
                        )
                )

                Column(
                    modifier = Modifier
                        .align(Alignment.BottomStart)
                        .padding(16.dp)
                ) {
                    Surface(
                        shape = RoundedCornerShape(6.dp),
                        color = FlameOrange
                    ) {
                        Text(
                            text = "TRENDING #1",
                            color = Color.White,
                            fontWeight = FontWeight.Black,
                            fontSize = 9.sp,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                    }

                    Spacer(modifier = Modifier.height(6.dp))

                    Text(
                        text = anime.title ?: "Anime Title",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )

                    Spacer(modifier = Modifier.height(6.dp))

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Button(
                            onClick = { onAnimeClick(anime) },
                            colors = ButtonDefaults.buttonColors(containerColor = GoldPrimary),
                            shape = RoundedCornerShape(12.dp),
                            contentPadding = PaddingValues(horizontal = 14.dp, vertical = 4.dp),
                            modifier = Modifier.height(32.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.PlayArrow,
                                contentDescription = null,
                                tint = BgDarkMain,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = "Tonton",
                                color = BgDarkMain,
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp
                            )
                        }

                        Spacer(modifier = Modifier.weight(1f))

                        Text(
                            text = String.format("%02d / %02d", page + 1, animeList.size),
                            color = GoldPrimary,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun QuickActionGrid(
    onGachaClick: () -> Unit,
    onArenaClick: () -> Unit,
    onIsekaiClick: () -> Unit,
    onRaidClick: () -> Unit,
    onW2GClick: () -> Unit,
    onTriviaClick: () -> Unit
) {
    val actions = listOf(
        Triple("Gacha Holo", "🎰", onGachaClick),
        Triple("Arena PvP", "⚔️", onArenaClick),
        Triple("Isekai Map", "🗺️", onIsekaiClick),
        Triple("World Boss", "🐉", onRaidClick),
        Triple("Watch2gether", "👥", onW2GClick),
        Triple("Trivia Quiz", "❓", onTriviaClick)
    )

    Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            actions.take(3).forEach { (title, emoji, onClick) ->
                QuickActionButton(title = title, emoji = emoji, onClick = onClick, modifier = Modifier.weight(1f))
            }
        }
        Spacer(modifier = Modifier.height(10.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            actions.drop(3).forEach { (title, emoji, onClick) ->
                QuickActionButton(title = title, emoji = emoji, onClick = onClick, modifier = Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun QuickActionButton(
    title: String,
    emoji: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        shape = RoundedCornerShape(14.dp),
        color = BgCardDark,
        border = BorderStroke(1.dp, BorderGlass),
        modifier = modifier
            .height(68.dp)
            .clickable { onClick() }
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier.padding(6.dp)
        ) {
            Text(text = emoji, fontSize = 20.sp)
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = title,
                color = TextPrimary,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 1
            )
        }
    }
}

@Composable
private fun SectionHeader(
    title: String,
    actionText: String? = null,
    onActionClick: (() -> Unit)? = null
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .width(4.dp)
                    .height(16.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(GoldPrimary)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = title,
                color = TextPrimary,
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp
            )
        }

        if (actionText != null && onActionClick != null) {
            Text(
                text = actionText,
                color = GoldPrimary,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.clickable { onActionClick() }
            )
        }
    }
}

@Composable
private fun AnimeOngoingCard(
    item: OngoingItem,
    onClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .width(135.dp)
            .clickable { onClick() }
    ) {
        Box(
            modifier = Modifier
                .width(135.dp)
                .height(190.dp)
                .clip(RoundedCornerShape(14.dp))
                .background(BgCardDark)
        ) {
            AsyncImage(
                model = item.poster,
                contentDescription = item.title,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize()
            )

            Surface(
                shape = RoundedCornerShape(bottomEnd = 10.dp),
                color = FlameOrange,
                modifier = Modifier.align(Alignment.TopStart)
            ) {
                Text(
                    text = item.currentEpisode ?: "EP",
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 10.sp,
                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                )
            }
        }

        Spacer(modifier = Modifier.height(6.dp))

        Text(
            text = item.title ?: "Anime",
            color = TextPrimary,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis
        )
    }
}

@Composable
private fun AnimeScheduleCard(
    anime: AnimeItem,
    onClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .width(125.dp)
            .clickable { onClick() }
    ) {
        Box(
            modifier = Modifier
                .width(125.dp)
                .height(175.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(BgCardDark)
        ) {
            AsyncImage(
                model = anime.poster,
                contentDescription = anime.title,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize()
            )
        }

        Spacer(modifier = Modifier.height(4.dp))

        Text(
            text = anime.title ?: "Anime",
            color = TextPrimary,
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

@Composable
private fun Top10RankItem(
    rank: Int,
    anime: AnimeItem,
    onClick: () -> Unit
) {
    val rankBadgeColor = when (rank) {
        1 -> GoldPrimary
        2 -> Color(0xFFC0C0C0)
        3 -> Color(0xFFCD7F32)
        else -> BgCardElevated
    }

    Surface(
        shape = RoundedCornerShape(14.dp),
        color = BgCardDark,
        border = BorderStroke(1.dp, BorderGlass),
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
    ) {
        Row(
            modifier = Modifier.padding(10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Surface(
                shape = RoundedCornerShape(8.dp),
                color = rankBadgeColor,
                modifier = Modifier.size(32.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text(
                        text = "#$rank",
                        color = if (rank <= 3) BgDarkMain else TextSecondary,
                        fontWeight = FontWeight.Black,
                        fontSize = 13.sp
                    )
                }
            }

            Spacer(modifier = Modifier.width(12.dp))

            AsyncImage(
                model = anime.poster,
                contentDescription = anime.title,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .size(44.dp)
                    .clip(RoundedCornerShape(8.dp))
            )

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = anime.title ?: "Anime Title",
                    color = TextPrimary,
                    fontWeight = FontWeight.Bold,
                    fontSize = 13.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = "${anime.type ?: "TV"} • Score: ${anime.score ?: "8.5"}",
                    color = TextMuted,
                    fontSize = 11.sp
                )
            }

            Icon(
                imageVector = Icons.Default.ChevronRight,
                contentDescription = null,
                tint = TextMuted
            )
        }
    }
}

@Composable
private fun CyberpunkFooter() {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(BgCardDark)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = "NEFORA APPS",
            color = GoldPrimary,
            fontWeight = FontWeight.Black,
            fontSize = 16.sp
        )
        Spacer(modifier = Modifier.height(6.dp))
        Text(
            text = "Streaming Anime, Komik & Holographic RPG Experience",
            color = TextMuted,
            fontSize = 11.sp
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "© 2026 NeFora / NdiChan. All rights reserved.",
            color = Color(0x66FFFFFF),
            fontSize = 10.sp
        )
    }
}
