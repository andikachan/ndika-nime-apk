package com.ndikanime.app.presentation.screens.manga

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import coil.compose.AsyncImage
import com.ndikanime.app.data.api.ApiClient
import com.ndikanime.app.data.model.MangaDetailData
import com.ndikanime.app.presentation.navigation.Screen
import com.ndikanime.app.presentation.theme.*
import kotlinx.coroutines.launch

@Composable
fun MangaDetailScreen(
    navController: NavController,
    slug: String,
    modifier: Modifier = Modifier
) {
    val coroutineScope = rememberCoroutineScope()
    var isLoading by remember { mutableStateOf(true) }
    var detailData by remember { mutableStateOf<MangaDetailData?>(null) }

    LaunchedEffect(slug) {
        coroutineScope.launch {
            try {
                isLoading = true
                val res = ApiClient.service.getMangaDetail(slug)
                if (res.status == true && res.data != null) {
                    detailData = res.data
                }
            } catch (e: Exception) {
                // error
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
                    .padding(horizontal = 8.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = { navController.popBackStack() }) {
                    Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = TextPrimary)
                }
                Text(
                    text = detailData?.title ?: "Detail Komik",
                    color = TextPrimary,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    maxLines = 1,
                    modifier = Modifier.weight(1f)
                )
            }
        }
    ) { paddingValues ->
        if (isLoading) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = GoldPrimary)
            }
        } else {
            val manga = detailData
            LazyColumn(
                modifier = modifier
                    .fillMaxSize()
                    .padding(paddingValues),
                contentPadding = PaddingValues(bottom = 40.dp)
            ) {
                // Header Info
                item {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp)
                    ) {
                        AsyncImage(
                            model = manga?.poster,
                            contentDescription = manga?.title,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier
                                .width(115.dp)
                                .height(165.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(BgCardDark)
                        )

                        Spacer(modifier = Modifier.width(16.dp))

                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = manga?.title ?: "Manga Title",
                                color = TextPrimary,
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp
                            )
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = "Author: ${manga?.author ?: "Unknown"}",
                                color = TextSecondary,
                                fontSize = 12.sp
                            )
                            Text(
                                text = "Status: ${manga?.status ?: "Ongoing"}",
                                color = GoldPrimary,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold
                            )

                            Spacer(modifier = Modifier.height(12.dp))

                            val firstChapter = manga?.chapterList?.lastOrNull()
                            Button(
                                onClick = {
                                    if (firstChapter != null) {
                                        navController.navigate(
                                            Screen.Reader.createRoute(
                                                slug = firstChapter.slug ?: "",
                                                title = "${manga?.title} - ${firstChapter.title}"
                                            )
                                        )
                                    }
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = GoldPrimary),
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier.height(36.dp)
                            ) {
                                Icon(Icons.Default.PlayArrow, contentDescription = null, tint = BgDarkMain)
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Mulai Baca", color = BgDarkMain, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                            }
                        }
                    }
                }

                // Synopsis
                item {
                    Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
                        Text(
                            text = "Sinopsis",
                            color = TextPrimary,
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = manga?.synopsis ?: "Tidak ada sinopsis.",
                            color = TextSecondary,
                            fontSize = 12.sp,
                            lineHeight = 18.sp
                        )
                    }
                }

                // Chapter List Header
                item {
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = "Daftar Chapter (${manga?.chapterList?.size ?: 0})",
                        color = TextPrimary,
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                    )
                }

                // Chapters
                items(manga?.chapterList ?: emptyList()) { ch ->
                    Surface(
                        shape = RoundedCornerShape(10.dp),
                        color = BgCardDark,
                        border = androidx.compose.foundation.BorderStroke(1.dp, BorderGlass),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 4.dp)
                            .clickable {
                                navController.navigate(
                                    Screen.Reader.createRoute(
                                        slug = ch.slug ?: "",
                                        title = "${manga?.title} - ${ch.title}"
                                    )
                                )
                            }
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = ch.title ?: "Chapter",
                                color = TextPrimary,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 13.sp
                            )
                            Text(
                                text = ch.releaseDate ?: "",
                                color = TextMuted,
                                fontSize = 11.sp
                            )
                        }
                    }
                }
            }
        }
    }
}
