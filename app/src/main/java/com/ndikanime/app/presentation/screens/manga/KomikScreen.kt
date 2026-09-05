package com.ndikanime.app.presentation.screens.manga

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.MenuBook
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
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
import com.ndikanime.app.data.model.MangaHeroItem
import com.ndikanime.app.data.model.MangaItem
import com.ndikanime.app.presentation.components.ShimmerRow
import com.ndikanime.app.presentation.navigation.Screen
import com.ndikanime.app.presentation.theme.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun KomikScreen(
    navController: NavController,
    modifier: Modifier = Modifier
) {
    val coroutineScope = rememberCoroutineScope()
    var isLoading by remember { mutableStateOf(true) }
    var heroSliders by remember { mutableStateOf<List<MangaHeroItem>>(emptyList()) }
    var popularToday by remember { mutableStateOf<List<MangaItem>>(emptyList()) }
    var latestUpdates by remember { mutableStateOf<List<MangaItem>>(emptyList()) }

    LaunchedEffect(Unit) {
        coroutineScope.launch {
            try {
                isLoading = true
                val heroRes = ApiClient.service.getMangaHeroSlider(15)
                if (heroRes.status && heroRes.data != null) {
                    heroSliders = heroRes.data.sliderList ?: emptyList()
                }

                val popularRes = ApiClient.service.getMangaPopularToday(15)
                if (popularRes.status && popularRes.data != null) {
                    popularToday = popularRes.data.popularList ?: emptyList()
                }

                val latestRes = ApiClient.service.getMangaLatest(1)
                if (latestRes.status && latestRes.data != null) {
                    latestUpdates = latestRes.data.mangaList ?: emptyList()
                }
            } catch (e: Exception) {
                // error fallback
            } finally {
                isLoading = false
            }
        }
    }

    Scaffold(
        containerColor = BgDarkMain,
        topBar = {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(BgDarkMain)
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.MenuBook,
                        contentDescription = null,
                        tint = GoldPrimary,
                        modifier = Modifier.size(24.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "NEFORA KOMIK",
                        color = GoldPrimary,
                        fontWeight = FontWeight.Black,
                        fontSize = 18.sp,
                        letterSpacing = 1.sp
                    )
                }

                IconButton(onClick = { navController.navigate(Screen.Explore.route) }) {
                    Icon(Icons.Default.Search, contentDescription = "Search", tint = TextPrimary)
                }
            }
        }
    ) { paddingValues ->
        LazyColumn(
            modifier = modifier
                .fillMaxSize()
                .padding(paddingValues),
            contentPadding = PaddingValues(bottom = 90.dp)
        ) {
            // 1. Manga Hero Slider (01 / 15)
            item {
                if (heroSliders.isNotEmpty()) {
                    MangaHeroCarousel(
                        items = heroSliders,
                        onMangaClick = { manga ->
                            navController.navigate(Screen.MangaDetail.createRoute(manga.slug ?: ""))
                        }
                    )
                }
            }

            // 2. Komik Populer Hari Ini
            item {
                Spacer(modifier = Modifier.height(16.dp))
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
                            text = "Populer Hari Ini",
                            color = TextPrimary,
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp
                        )
                    }
                }

                if (isLoading) {
                    ShimmerRow(modifier = Modifier.padding(horizontal = 16.dp))
                } else {
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(popularToday) { manga ->
                            MangaGridCard(manga = manga) {
                                navController.navigate(Screen.MangaDetail.createRoute(manga.getEffectiveSlug()))
                            }
                        }
                    }
                }
            }

            // 3. Update Manga Terbaru
            item {
                Spacer(modifier = Modifier.height(20.dp))
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .width(4.dp)
                            .height(16.dp)
                            .clip(RoundedCornerShape(2.dp))
                            .background(FlameOrange)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Rilis Komik Terbaru",
                        color = TextPrimary,
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp
                    )
                }

                Column(
                    modifier = Modifier.padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    latestUpdates.chunked(2).forEach { rowItems ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            rowItems.forEach { manga ->
                                MangaGridCard(
                                    manga = manga,
                                    modifier = Modifier.weight(1f)
                                ) {
                                    navController.navigate(Screen.MangaDetail.createRoute(manga.getEffectiveSlug()))
                                }
                            }
                            if (rowItems.size == 1) {
                                Spacer(modifier = Modifier.weight(1f))
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun MangaHeroCarousel(
    items: List<MangaHeroItem>,
    onMangaClick: (MangaHeroItem) -> Unit
) {
    val pagerState = rememberPagerState(pageCount = { items.size })

    LaunchedEffect(Unit) {
        while (true) {
            delay(5000)
            if (items.isNotEmpty()) {
                pagerState.animateScrollToPage((pagerState.currentPage + 1) % items.size)
            }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(240.dp)
            .padding(16.dp)
            .clip(RoundedCornerShape(20.dp))
    ) {
        HorizontalPager(state = pagerState, modifier = Modifier.fillMaxSize()) { page ->
            val manga = items[page]
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .clickable { onMangaClick(manga) }
            ) {
                AsyncImage(
                    model = manga.poster,
                    contentDescription = manga.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize()
                )

                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(
                            Brush.verticalGradient(
                                listOf(Color.Transparent, Color(0x99000000), BgDarkMain)
                            )
                        )
                )

                Column(
                    modifier = Modifier
                        .align(Alignment.BottomStart)
                        .padding(14.dp)
                ) {
                    Text(
                        text = manga.title ?: "Manga",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Chapter ${manga.latestChapter ?: "Latest"}",
                        color = GoldPrimary,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }
    }
}

@Composable
private fun MangaGridCard(
    manga: MangaItem,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Column(
        modifier = modifier
            .width(135.dp)
            .clickable { onClick() }
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(185.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(BgCardDark)
        ) {
            AsyncImage(
                model = manga.poster,
                contentDescription = manga.title,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize()
            )

            Surface(
                shape = RoundedCornerShape(bottomEnd = 8.dp),
                color = FlameOrange,
                modifier = Modifier.align(Alignment.TopStart)
            ) {
                Text(
                    text = manga.getDisplayChapter(),
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 10.sp,
                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                )
            }
        }

        Spacer(modifier = Modifier.height(4.dp))

        Text(
            text = manga.title ?: "Manga",
            color = TextPrimary,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis
        )
    }
}
