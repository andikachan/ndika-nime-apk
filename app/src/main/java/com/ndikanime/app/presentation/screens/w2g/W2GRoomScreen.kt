package com.ndikanime.app.presentation.screens.w2g

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.net.Uri
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.annotation.OptIn
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import androidx.navigation.NavController
import com.ndikanime.app.data.model.W2GChatItem
import com.ndikanime.app.data.model.W2GMember
import com.ndikanime.app.data.model.W2GRoomDetail
import com.ndikanime.app.data.storage.AuthManager
import com.ndikanime.app.data.upstash.UpstashRepository
import com.ndikanime.app.presentation.components.AvatarFrameView
import com.ndikanime.app.presentation.theme.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

@OptIn(UnstableApi::class)
@Composable
fun W2GRoomScreen(
    navController: NavController,
    roomId: String,
    passcode: String,
    authManager: AuthManager,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    var selectedTab by remember { mutableIntStateOf(0) } // 0: Live Chat, 1: Penonton
    var isHost by remember { mutableStateOf(false) }
    var roomDetail by remember { mutableStateOf<W2GRoomDetail?>(null) }
    val members = remember { mutableStateListOf<W2GMember>() }
    val chatMessages = remember { mutableStateListOf<W2GChatItem>() }
    var chatInput by remember { mutableStateOf("") }

    val exoPlayer = remember {
        ExoPlayer.Builder(context).build().apply {
            playWhenReady = true
        }
    }

    DisposableEffect(exoPlayer) {
        onDispose {
            exoPlayer.release()
        }
    }

    // Polling Loop
    LaunchedEffect(roomId) {
        val user = authManager.getUserProfile() ?: com.ndikanime.app.data.model.UserProfile(
            id = authManager.userId ?: "guest",
            name = authManager.userName ?: "Tamu",
            picture = authManager.userAvatar
        )

        while (isActive) {
            try {
                val currentSec = exoPlayer.currentPosition / 1000.0
                val lastSeq = chatMessages.mapNotNull { it.seq }.maxOrNull() ?: 0L
                val res = UpstashRepository.sendW2GHeartbeat(roomId, user, currentSec, lastSeq)
                if (res.success) {
                    isHost = res.isHost
                    res.members?.let {
                        members.clear()
                        members.addAll(it)
                    }
                    res.newChat?.let { newItems ->
                        val existingIds = chatMessages.mapNotNull { it.id }.toSet()
                        val filtered = newItems.filter { it.id !in existingIds }
                        chatMessages.addAll(filtered)
                    }
                }
            } catch (e: Exception) {}
            delay(3000)
        }
    }

    Scaffold(
        containerColor = BgDarkMain,
        topBar = {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(BgCardDark)
                    .padding(horizontal = 8.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = { navController.popBackStack() }) {
                    Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = TextPrimary)
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Room Nobar [$roomId]",
                        color = TextPrimary,
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp
                    )
                    Text(
                        text = if (isHost) "● Anda adalah Host" else "● Sinkronisasi Host",
                        color = GoldPrimary,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
                Button(
                    onClick = {
                        val clip = ClipData.newPlainText("W2G Room Code", roomId)
                        val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                        cm.setPrimaryClip(clip)
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = BgCardElevated),
                    shape = RoundedCornerShape(10.dp),
                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                    modifier = Modifier.height(32.dp)
                ) {
                    Icon(Icons.Default.ContentCopy, contentDescription = null, tint = GoldPrimary, modifier = Modifier.size(14.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Salin Kode", color = GoldPrimary, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    ) { paddingValues ->
        Column(
            modifier = modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Video Area
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(210.dp)
                    .background(Color.Black)
            ) {
                AndroidView(
                    factory = { ctx ->
                        PlayerView(ctx).apply {
                            player = exoPlayer
                            layoutParams = FrameLayout.LayoutParams(
                                ViewGroup.LayoutParams.MATCH_PARENT,
                                ViewGroup.LayoutParams.MATCH_PARENT
                            )
                        }
                    },
                    modifier = Modifier.fillMaxSize()
                )
            }

            // Tabs (Live Chat / Penonton)
            TabRow(
                selectedTabIndex = selectedTab,
                containerColor = BgCardDark,
                contentColor = GoldPrimary
            ) {
                Tab(
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    text = { Text("Live Chat (${chatMessages.size})", fontWeight = FontWeight.Bold) }
                )
                Tab(
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    text = { Text("Penonton (${members.size})", fontWeight = FontWeight.Bold) }
                )
            }

            // Content Area
            if (selectedTab == 0) {
                Column(modifier = Modifier.weight(1f)) {
                    LazyColumn(
                        modifier = Modifier
                            .weight(1f)
                            .padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(chatMessages) { msg ->
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(msg.userName ?: "Tamu", color = GoldPrimary, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(msg.text ?: "", color = TextPrimary, fontSize = 13.sp)
                            }
                        }
                    }

                    // Chat Input Bar
                    Surface(
                        color = BgCardDark,
                        border = androidx.compose.foundation.BorderStroke(1.dp, BorderGlass),
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            TextField(
                                value = chatInput,
                                onValueChange = { chatInput = it },
                                placeholder = { Text("Komentar live...", color = TextMuted, fontSize = 12.sp) },
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
                            IconButton(
                                onClick = {
                                    if (chatInput.isNotBlank()) {
                                        val u = authManager.getUserProfile() ?: com.ndikanime.app.data.model.UserProfile(
                                            id = authManager.userId ?: "guest",
                                            name = authManager.userName ?: "Tamu",
                                            picture = authManager.userAvatar
                                        )
                                        val text = chatInput.trim()
                                        chatInput = ""
                                        coroutineScope.launch {
                                            try {
                                                UpstashRepository.sendW2GChat(roomId, u, text, exoPlayer.currentPosition / 1000.0)
                                            } catch (e: Exception) {}
                                        }
                                    }
                                },
                                modifier = Modifier.clip(CircleShape).background(GoldPrimary)
                            ) {
                                Icon(Icons.Default.Send, contentDescription = "Send", tint = BgDarkMain, modifier = Modifier.size(18.dp))
                            }
                        }
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier
                        .weight(1f)
                        .padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(members) { m ->
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = BgCardDark,
                            border = androidx.compose.foundation.BorderStroke(1.dp, BorderGlass),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                modifier = Modifier.padding(10.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                AvatarFrameView(avatarUrl = m.avatar, level = 1, size = 36.dp)
                                Spacer(modifier = Modifier.width(10.dp))
                                Column {
                                    Text(m.name ?: "Tamu", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                    if (m.isHost) {
                                        Text("● Room Host", color = GoldPrimary, fontSize = 10.sp, fontWeight = FontWeight.Bold)
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
