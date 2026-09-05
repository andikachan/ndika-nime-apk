package com.ndikanime.app.presentation.screens.explore

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.GridView
import androidx.compose.material.icons.filled.List
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
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
import com.ndikanime.app.data.model.MangaItem
import com.ndikanime.app.data.model.UserProfile
import com.ndikanime.app.data.upstash.UpstashRepository
import com.ndikanime.app.presentation.components.AvatarFrameView
import com.ndikanime.app.presentation.navigation.Screen
import com.ndikanime.app.presentation.theme.*
import kotlinx.coroutines.launch

@Composable
fun ExploreScreen(
    navController: NavController,
    modifier: Modifier = Modifier
) {
    val coroutineScope = rememberCoroutineScope()
    var selectedTab by remember { mutableIntStateOf(0) } // 0: Anime, 1: Komik, 2: Akun
    var searchQuery by remember { mutableStateOf("") }
    var isSearching by remember { mutableStateOf(false) }
    var isGridView by remember { mutableStateOf(true) }

    var animeResults by remember { mutableStateOf<List<AnimeItem>>(emptyList()) }
    var mangaResults by remember { mutableStateOf<List<MangaItem>>(emptyList()) }
    var userResults by remember { mutableStateOf<List<UserProfile>>(emptyList()) }

    val genreList = listOf("Action", "Adventure", "Comedy", "Drama", "Fantasy", "Isekai", "Romance", "Sci-Fi", "Shounen", "Supernatural")
    var selectedGenre by remember { mutableStateOf<String?>(null) }

    fun performSearch(q: String) {
        if (q.isBlank() && selectedGenre == null) return
        coroutineScope.launch {
            try {
                isSearching = true
                when (selectedTab) {
                    0 -> {
                        val res = ApiClient.service.searchAnime(q, 1)
                        if (res.status && res.data != null) {
                            animeResults = res.data.animeList ?: emptyList()
                        }
                    }
                    1 -> {
                        val res = ApiClient.service.searchManga(q)
                        if (res.status == true && res.data != null) {
                            mangaResults = res.data.mangaList ?: emptyList()
                        }
                    }
                    2 -> {
                        userResults = UpstashRepository.searchUsers(q)
                    }
                }
            } catch (e: Exception) {
                // error
            } finally {
                isSearching = false
            }
        }
    }

    LaunchedEffect(selectedTab, selectedGenre) {
        if (searchQuery.isNotBlank() || selectedGenre != null) {
            performSearch(searchQuery)
        }
    }

    Scaffold(
        containerColor = BgDarkMain,
        topBar = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(BgDarkMain)
                    .padding(horizontal = 16.dp, vertical = 8.dp)
            ) {
                // Search Box
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = BgCardDark,
                    border = androidx.compose.foundation.BorderStroke(1.dp, BorderGlass),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Default.Search, contentDescription = null, tint = GoldPrimary)
                        Spacer(modifier = Modifier.width(8.dp))
                        TextField(
                            value = searchQuery,
                            onValueChange = {
                                searchQuery = it
                                performSearch(it)
                            },
                            placeholder = { Text("Cari Anime, Komik, atau User...", color = TextMuted, fontSize = 13.sp) },
                            colors = TextFieldDefaults.colors(
                                focusedContainerColor = Color.Transparent,
                                unfocusedContainerColor = Color.Transparent,
                                focusedIndicatorColor = Color.Transparent,
                                unfocusedIndicatorColor = Color.Transparent,
                                focusedTextColor = TextPrimary,
                                unfocusedTextColor = TextPrimary
                            ),
                            modifier = Modifier.weight(1f)
                        )
                        if (searchQuery.isNotBlank()) {
                            IconButton(onClick = { searchQuery = "" }) {
                                Icon(Icons.Default.Clear, contentDescription = "Clear", tint = TextMuted)
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                // 3 Tabs: Anime, Komik, User
                TabRow(
                    selectedTabIndex = selectedTab,
                    containerColor = BgCardDark,
                    contentColor = GoldPrimary,
                    modifier = Modifier.clip(RoundedCornerShape(12.dp))
                ) {
                    Tab(
                        selected = selectedTab == 0,
                        onClick = { selectedTab = 0 },
                        text = { Text("Anime", fontWeight = FontWeight.Bold) }
                    )
                    Tab(
                        selected = selectedTab == 1,
                        onClick = { selectedTab = 1 },
                        text = { Text("Komik", fontWeight = FontWeight.Bold) }
                    )
                    Tab(
                        selected = selectedTab == 2,
                        onClick = { selectedTab = 2 },
                        text = { Text("Akun / User", fontWeight = FontWeight.Bold) }
                    )
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Genre Filter Chips (for Anime & Komik)
                if (selectedTab != 2) {
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(genreList) { g ->
                            val isSelected = selectedGenre == g
                            Surface(
                                shape = RoundedCornerShape(10.dp),
                                color = if (isSelected) GoldPrimary else BgCardDark,
                                border = if (!isSelected) androidx.compose.foundation.BorderStroke(1.dp, BorderGlass) else null,
                                modifier = Modifier.clickable {
                                    selectedGenre = if (isSelected) null else g
                                }
                            ) {
                                Text(
                                    text = g,
                                    color = if (isSelected) BgDarkMain else TextSecondary,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)
                                )
                            }
                        }
                    }
                }
            }
        }
    ) { paddingValues ->
        Box(
            modifier = modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            if (isSearching) {
                CircularProgressIndicator(
                    color = GoldPrimary,
                    modifier = Modifier.align(Alignment.Center)
                )
            } else {
                when (selectedTab) {
                    0 -> { // Anime Grid
                        LazyVerticalGrid(
                            columns = GridCells.Fixed(3),
                            contentPadding = PaddingValues(16.dp),
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            items(animeResults) { anime ->
                                Column(
                                    modifier = Modifier.clickable {
                                        navController.navigate(
                                            Screen.Watch.createRoute(
                                                animeId = anime.id ?: "",
                                                episodeId = "",
                                                title = anime.title ?: "Anime",
                                                poster = anime.poster ?: ""
                                            )
                                        )
                                    }
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .height(150.dp)
                                            .clip(RoundedCornerShape(10.dp))
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
                                        maxLines = 2,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                }
                            }
                        }
                    }
                    1 -> { // Manga Grid
                        LazyVerticalGrid(
                            columns = GridCells.Fixed(3),
                            contentPadding = PaddingValues(16.dp),
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            items(mangaResults) { manga ->
                                Column(
                                    modifier = Modifier.clickable {
                                        navController.navigate(Screen.MangaDetail.createRoute(manga.getEffectiveSlug()))
                                    }
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .height(150.dp)
                                            .clip(RoundedCornerShape(10.dp))
                                            .background(BgCardDark)
                                    ) {
                                        AsyncImage(
                                            model = manga.poster,
                                            contentDescription = manga.title,
                                            contentScale = ContentScale.Crop,
                                            modifier = Modifier.fillMaxSize()
                                        )
                                    }
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        text = manga.title ?: "Manga",
                                        color = TextPrimary,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Medium,
                                        maxLines = 2,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                }
                            }
                        }
                    }
                    2 -> { // Users List
                        LazyColumn(
                            contentPadding = PaddingValues(16.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            items(userResults) { user ->
                                Surface(
                                    shape = RoundedCornerShape(12.dp),
                                    color = BgCardDark,
                                    border = androidx.compose.foundation.BorderStroke(1.dp, BorderGlass),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable {
                                            navController.navigate(Screen.Profile.createRoute(user.id))
                                        }
                                ) {
                                    Row(
                                        modifier = Modifier.padding(12.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        AvatarFrameView(
                                            avatarUrl = user.picture,
                                            level = user.level.toInt(),
                                            size = 44.dp
                                        )
                                        Spacer(modifier = Modifier.width(12.dp))
                                        Column {
                                            Text(
                                                text = user.name ?: "User",
                                                color = TextPrimary,
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 14.sp
                                            )
                                            Text(
                                                text = "Level ${user.level} • ${user.title ?: "Adventurer"}",
                                                color = GoldPrimary,
                                                fontSize = 11.sp
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
