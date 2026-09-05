package com.ndikanime.app.presentation.screens.manga

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import coil.compose.SubcomposeAsyncImage
import com.ndikanime.app.data.api.ApiClient
import com.ndikanime.app.data.model.MangaReadData
import com.ndikanime.app.presentation.navigation.Screen
import com.ndikanime.app.presentation.theme.*
import kotlinx.coroutines.launch

@Composable
fun ReaderScreen(
    navController: NavController,
    slug: String,
    title: String,
    modifier: Modifier = Modifier
) {
    val coroutineScope = rememberCoroutineScope()
    var isLoading by remember { mutableStateOf(true) }
    var readData by remember { mutableStateOf<MangaReadData?>(null) }
    var showBars by remember { mutableStateOf(true) }
    val listState = rememberLazyListState()

    fun loadChapter(chSlug: String) {
        coroutineScope.launch {
            try {
                isLoading = true
                val res = ApiClient.service.getMangaRead(chSlug)
                if (res.status && res.data != null) {
                    readData = res.data
                }
            } catch (e: Exception) {
                // error
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(slug) {
        loadChapter(slug)
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(BgDarkMain)
    ) {
        if (isLoading) {
            CircularProgressIndicator(
                color = GoldPrimary,
                modifier = Modifier.align(Alignment.Center)
            )
        } else {
            val pages = readData?.imageUrls ?: emptyList()

            LazyColumn(
                state = listState,
                modifier = Modifier
                    .fillMaxSize()
                    .pointerInput(Unit) {
                        detectTapGestures(
                            onTap = { showBars = !showBars }
                        )
                    }
            ) {
                itemsIndexed(pages) { index, imgUrl ->
                    val proxyUrl = if (imgUrl.contains("cfelainawanggy.pages.dev")) imgUrl
                    else "https://cfelainawanggy.pages.dev/?action=proxy&url=" + java.net.URLEncoder.encode(imgUrl, "UTF-8")

                    SubcomposeAsyncImage(
                        model = proxyUrl,
                        contentDescription = "Page ${index + 1}",
                        contentScale = ContentScale.FillWidth,
                        modifier = Modifier
                            .fillMaxWidth()
                            .wrapContentHeight(),
                        loading = {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(300.dp)
                                    .background(BgCardDark),
                                contentAlignment = Alignment.Center
                            ) {
                                CircularProgressIndicator(color = GoldPrimary, modifier = Modifier.size(24.dp))
                            }
                        },
                        error = {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(200.dp)
                                    .background(BgCardDark),
                                contentAlignment = Alignment.Center
                            ) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Text("Gagal memuat halaman ${index + 1}", color = TextMuted, fontSize = 12.sp)
                                    Spacer(modifier = Modifier.height(6.dp))
                                    Icon(Icons.Default.Refresh, contentDescription = "Retry", tint = GoldPrimary)
                                }
                            }
                        }
                    )
                }
            }
        }

        // Top Navigation Bar
        AnimatedVisibility(
            visible = showBars,
            enter = fadeIn(),
            exit = fadeOut(),
            modifier = Modifier.align(Alignment.TopCenter)
        ) {
            Surface(
                color = BgDarkMain.copy(alpha = 0.95f),
                border = androidx.compose.foundation.BorderStroke(1.dp, BorderGlass),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = TextPrimary)
                    }
                    Text(
                        text = title,
                        color = TextPrimary,
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp,
                        maxLines = 1,
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }

        // Bottom Controls Bar (Prev / Next Chapter)
        AnimatedVisibility(
            visible = showBars,
            enter = fadeIn(),
            exit = fadeOut(),
            modifier = Modifier.align(Alignment.BottomCenter)
        ) {
            Surface(
                color = BgDarkMain.copy(alpha = 0.95f),
                border = androidx.compose.foundation.BorderStroke(1.dp, BorderGlass),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    val prevSlug = readData?.prevSlug
                    val nextSlug = readData?.nextSlug

                    Button(
                        onClick = { if (!prevSlug.isNullOrBlank()) loadChapter(prevSlug) },
                        enabled = !prevSlug.isNullOrBlank(),
                        colors = ButtonDefaults.buttonColors(containerColor = BgCardElevated),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Icon(Icons.Default.ChevronLeft, contentDescription = null, tint = if (!prevSlug.isNullOrBlank()) GoldPrimary else TextMuted)
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Prev Ch", color = if (!prevSlug.isNullOrBlank()) TextPrimary else TextMuted, fontSize = 12.sp)
                    }

                    Text(
                        text = "Chapter",
                        color = GoldPrimary,
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp
                    )

                    Button(
                        onClick = { if (!nextSlug.isNullOrBlank()) loadChapter(nextSlug) },
                        enabled = !nextSlug.isNullOrBlank(),
                        colors = ButtonDefaults.buttonColors(containerColor = GoldPrimary),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Text("Next Ch", color = BgDarkMain, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                        Spacer(modifier = Modifier.width(4.dp))
                        Icon(Icons.Default.ChevronRight, contentDescription = null, tint = BgDarkMain)
                    }
                }
            }
        }
    }
}
