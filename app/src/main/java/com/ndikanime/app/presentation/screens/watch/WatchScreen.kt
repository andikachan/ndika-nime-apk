package com.ndikanime.app.presentation.screens.watch

import android.app.Activity
import android.content.Context
import android.content.pm.ActivityInfo
import android.media.AudioManager
import android.net.Uri
import android.provider.Settings
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.activity.compose.BackHandler
import androidx.annotation.OptIn
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackParameters
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import androidx.navigation.NavController
import com.ndikanime.app.core.SoundManager
import com.ndikanime.app.data.api.ApiClient
import com.ndikanime.app.data.model.EpisodeDetailData
import com.ndikanime.app.data.model.ServerItem
import com.ndikanime.app.data.storage.AuthManager
import com.ndikanime.app.data.upstash.UpstashRepository
import com.ndikanime.app.presentation.components.*
import com.ndikanime.app.presentation.theme.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlin.math.abs
import kotlin.random.Random

@OptIn(UnstableApi::class)
@Composable
fun WatchScreen(
    navController: NavController,
    animeId: String,
    episodeId: String,
    animeTitle: String,
    poster: String,
    authManager: AuthManager,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    var currentEpId by remember { mutableStateOf(episodeId) }
    var currentEpTitle by remember { mutableStateOf(animeTitle) }
    var episodeData by remember { mutableStateOf<EpisodeDetailData?>(null) }
    var currentServers by remember { mutableStateOf<List<ServerItem>>(emptyList()) }
    var selectedServer by remember { mutableStateOf<ServerItem?>(null) }

    var isPlayerLoading by remember { mutableStateOf(true) }
    var isPlaying by remember { mutableStateOf(false) }
    var isHolding2x by remember { mutableStateOf(false) }
    var isFullscreen by remember { mutableStateOf(false) }
    var showControls by remember { mutableStateOf(true) }

    // Gestures HUD
    var brightnessHud by remember { mutableFloatStateOf(-1f) }
    var volumeHud by remember { mutableFloatStateOf(-1f) }
    var seekNotice by remember { mutableStateOf<String?>(null) }

    // Danmaku & Reactions
    val danmakuItems = remember { mutableStateListOf<DanmakuItem>() }
    val floatingParticles = remember { mutableStateListOf<FloatingParticle>() }
    var danmakuInput by remember { mutableStateOf("") }

    // ExoPlayer Setup
    val exoPlayer = remember {
        val loadControl = DefaultLoadControl.Builder()
            .setBufferDurationsMs(15000, 50000, 1500, 3000)
            .build()
        ExoPlayer.Builder(context)
            .setLoadControl(loadControl)
            .setSeekForwardIncrementMs(10000)
            .setSeekBackIncrementMs(10000)
            .build().apply {
                playWhenReady = true
            }
    }

    DisposableEffect(exoPlayer) {
        val listener = object : Player.Listener {
            override fun onIsPlayingChanged(playing: Boolean) {
                isPlaying = playing
            }
            override fun onPlaybackStateChanged(state: Int) {
                isPlayerLoading = state == Player.STATE_BUFFERING
            }
        }
        exoPlayer.addListener(listener)
        onDispose {
            exoPlayer.removeListener(listener)
            exoPlayer.release()
            val activity = context as? Activity
            activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
        }
    }

    // Load Episode Data
    fun loadEpisode(epId: String) {
        if (epId.isBlank()) return
        isPlayerLoading = true
        coroutineScope.launch {
            try {
                val res = ApiClient.service.getEpisode(epId)
                if (res.status && res.data != null) {
                    episodeData = res.data
                    val servers = (res.data.server ?: emptyList()).filter { s ->
                        !s.link.isNullOrBlank() && s.type == "direct"
                    }
                    currentServers = if (servers.isNotEmpty()) servers else (res.data.server ?: emptyList())
                    selectedServer = currentServers.find { it.quality == "720p" }
                        ?: currentServers.find { it.quality == "480p" }
                        ?: currentServers.firstOrNull()

                    val streamUrl = selectedServer?.getStreamingUrl() ?: ""
                    if (streamUrl.isNotBlank()) {
                        exoPlayer.setMediaItem(MediaItem.fromUri(Uri.parse(streamUrl)))
                        exoPlayer.prepare()
                        exoPlayer.play()
                    }
                }
            } catch (e: Exception) {
                // error
            } finally {
                isPlayerLoading = false
            }
        }
    }

    LaunchedEffect(currentEpId) {
        if (currentEpId.isNotBlank()) {
            loadEpisode(currentEpId)
        } else if (animeId.isNotBlank()) {
            // Load anime details first to get first episode ID
            coroutineScope.launch {
                try {
                    val detail = ApiClient.service.getDetail(animeId)
                    val firstEp = detail.data?.episodeList?.firstOrNull()
                    if (firstEp != null) {
                        currentEpId = firstEp.id ?: ""
                        currentEpTitle = firstEp.title ?: animeTitle
                    }
                } catch (e: Exception) {}
            }
        }
    }

    // Watch Time Tracker Loop
    LaunchedEffect(isPlaying) {
        val uid = authManager.userId ?: "guest"
        while (isActive && isPlaying) {
            delay(15000)
            try {
                val result = UpstashRepository.addWatchTime(uid, 15)
                if (result.levelUp) {
                    SoundManager.playLevelUpSfx()
                }
            } catch (e: Exception) {}
        }
    }

    BackHandler {
        if (isFullscreen) {
            val activity = context as? Activity
            activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
            isFullscreen = false
        } else {
            navController.popBackStack()
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color.Black)
    ) {
        // 1. Ambient Glow View behind video
        AmbientGlowView(dominantColor = GoldDark)

        // 2. ExoPlayer View with Gestures
        Box(
            modifier = Modifier
                .fillMaxSize()
                .pointerInput(Unit) {
                    detectTapGestures(
                        onTap = { showControls = !showControls },
                        onDoubleTap = { offset ->
                            val isRightSide = offset.x > size.width / 2
                            if (isRightSide) {
                                exoPlayer.seekForward()
                                seekNotice = "+10 Detik ⏩"
                            } else {
                                exoPlayer.seekBack()
                                seekNotice = "⏪ -10 Detik"
                            }
                            coroutineScope.launch {
                                delay(1200)
                                seekNotice = null
                            }
                        },
                        onLongPress = {
                            isHolding2x = true
                            exoPlayer.playbackParameters = PlaybackParameters(2.0f)
                        }
                    )
                }
        ) {
            AndroidView(
                factory = { ctx ->
                    PlayerView(ctx).apply {
                        player = exoPlayer
                        useController = false
                        layoutParams = FrameLayout.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT
                        )
                    }
                },
                modifier = Modifier.fillMaxSize()
            )

            // 3. Danmaku Overlay
            DanmakuOverlay(danmakuList = danmakuItems)

            // 4. Floating Reactions Burst
            ParticleBurst(particles = floatingParticles)

            // 5. HUD: 2X Fast Forward Badge
            if (isHolding2x) {
                Surface(
                    shape = RoundedCornerShape(20.dp),
                    color = Color(0xCC000000),
                    border = BorderStroke(1.dp, GoldPrimary),
                    modifier = Modifier
                        .align(Alignment.TopCenter)
                        .padding(top = 20.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp)
                    ) {
                        Text("⏩ 2.0X Kecepatan", color = GoldPrimary, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    }
                }
            }

            // 6. HUD: Seek Notice
            if (seekNotice != null) {
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = Color(0xDD000000),
                    modifier = Modifier.align(Alignment.Center)
                ) {
                    Text(
                        text = seekNotice ?: "",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp,
                        modifier = Modifier.padding(horizontal = 20.dp, vertical = 10.dp)
                    )
                }
            }

            // 7. Loading Buffering Indicator
            if (isPlayerLoading) {
                CircularProgressIndicator(
                    color = GoldPrimary,
                    modifier = Modifier.align(Alignment.Center)
                )
            }

            // 8. Custom Cyberpunk Video Controls Overlay
            AnimatedVisibility(
                visible = showControls,
                enter = fadeIn(),
                exit = fadeOut(),
                modifier = Modifier.fillMaxSize()
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color(0x77000000))
                ) {
                    // Top Bar
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .align(Alignment.TopCenter)
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(onClick = { navController.popBackStack() }) {
                            Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = Color.White)
                        }
                        Text(
                            text = currentEpTitle,
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp,
                            maxLines = 1,
                            modifier = Modifier.weight(1f)
                        )
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = BgCardDark,
                            border = BorderStroke(1.dp, GoldPrimary.copy(alpha = 0.5f))
                        ) {
                            Text(
                                text = selectedServer?.quality ?: "720p",
                                color = GoldPrimary,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }
                    }

                    // Center Play/Pause & Seek Controls
                    Row(
                        modifier = Modifier.align(Alignment.Center),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(36.dp)
                    ) {
                        IconButton(
                            onClick = { exoPlayer.seekBack() },
                            modifier = Modifier.size(48.dp)
                        ) {
                            Icon(Icons.Default.Replay10, contentDescription = "-10s", tint = Color.White, modifier = Modifier.size(36.dp))
                        }

                        // Single Unified Gold Play/Pause Button
                        Box(
                            modifier = Modifier
                                .size(64.dp)
                                .clip(CircleShape)
                                .background(Brush.linearGradient(listOf(GoldPrimary, GoldDark)))
                                .clickable {
                                    if (exoPlayer.isPlaying) exoPlayer.pause() else exoPlayer.play()
                                },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                                contentDescription = "Play/Pause",
                                tint = BgDarkMain,
                                modifier = Modifier.size(36.dp)
                            )
                        }

                        IconButton(
                            onClick = { exoPlayer.seekForward() },
                            modifier = Modifier.size(48.dp)
                        ) {
                            Icon(Icons.Default.Forward10, contentDescription = "+10s", tint = Color.White, modifier = Modifier.size(36.dp))
                        }
                    }

                    // Bottom Bar
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .align(Alignment.BottomCenter)
                            .padding(16.dp)
                    ) {
                        // Quick Reactions Floating Bar
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 8.dp),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            listOf("🔥", "❤️", "💀", "😭", "⚡").forEach { emoji ->
                                Surface(
                                    shape = CircleShape,
                                    color = Color(0x99111115),
                                    modifier = Modifier.clickable {
                                        SoundManager.playCoinSfx()
                                        val now = System.currentTimeMillis()
                                        floatingParticles.add(
                                            FloatingParticle(
                                                id = now,
                                                emoji = emoji,
                                                startX = Random.nextFloat() * 200f - 100f,
                                                targetX = Random.nextFloat() * 300f - 150f,
                                                targetY = -300f
                                            )
                                        )
                                    }
                                ) {
                                    Text(text = emoji, fontSize = 20.sp, modifier = Modifier.padding(6.dp))
                                }
                            }

                            Spacer(modifier = Modifier.weight(1f))

                            IconButton(
                                onClick = {
                                    val activity = context as? Activity
                                    isFullscreen = !isFullscreen
                                    activity?.requestedOrientation = if (isFullscreen) {
                                        ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
                                    } else {
                                        ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                                    }
                                }
                            ) {
                                Icon(
                                    imageVector = if (isFullscreen) Icons.Default.FullscreenExit else Icons.Default.Fullscreen,
                                    contentDescription = "Fullscreen",
                                    tint = Color.White
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
