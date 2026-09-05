package com.ndikanime.app.presentation.screens.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.ndikanime.app.data.storage.AuthManager
import com.ndikanime.app.presentation.components.AvatarFrameView
import com.ndikanime.app.presentation.theme.*
import kotlinx.coroutines.launch

data class ChatMessage(
    val id: String,
    val senderName: String,
    val senderAvatar: String?,
    val senderLevel: Int,
    val text: String,
    val timestamp: Long = System.currentTimeMillis()
)

@Composable
fun GlobalChatScreen(
    navController: NavController,
    authManager: AuthManager,
    modifier: Modifier = Modifier
) {
    val coroutineScope = rememberCoroutineScope()
    val listState = rememberLazyListState()
    var inputText by remember { mutableStateOf("") }

    val messages = remember {
        mutableStateListOf(
            ChatMessage("1", "Gojō_Satoru", null, 99, "Ada yang sudah nonton episode terbaru Solo Leveling?"),
            ChatMessage("2", "Rimuru_Tempest", null, 85, "Sudah! Animasinya gila banget pas adegan Igris."),
            ChatMessage("3", "Tanjiro_Sun", null, 42, "Btw ada yang mau party raid World Boss jam 8 malam?"),
            ChatMessage("4", "Megumin_Boom", null, 50, "Aku ikut! Explosion siap dilepaskan 🔥")
        )
    }

    val userProfile = authManager.getUserProfile()

    fun sendMessage() {
        if (inputText.isBlank()) return
        val newMsg = ChatMessage(
            id = System.currentTimeMillis().toString(),
            senderName = userProfile?.name ?: "Kamu",
            senderAvatar = userProfile?.picture,
            senderLevel = userProfile?.level ?: 1,
            text = inputText.trim()
        )
        messages.add(newMsg)
        inputText = ""
        coroutineScope.launch {
            listState.animateScrollToItem(messages.size - 1)
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
                    text = "CHAT GLOBAL DIMENSI 💬",
                    color = GoldPrimary,
                    fontWeight = FontWeight.Black,
                    fontSize = 16.sp,
                    modifier = Modifier.weight(1f)
                )
            }
        },
        bottomBar = {
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
                        value = inputText,
                        onValueChange = { inputText = it },
                        placeholder = { Text("Kirim pesan ke seluruh realm...", color = TextMuted, fontSize = 12.sp) },
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
                        onClick = { sendMessage() },
                        modifier = Modifier.clip(CircleShape).background(GoldPrimary)
                    ) {
                        Icon(Icons.Default.Send, contentDescription = "Send", tint = BgDarkMain, modifier = Modifier.size(18.dp))
                    }
                }
            }
        }
    ) { paddingValues ->
        LazyColumn(
            state = listState,
            modifier = modifier
                .fillMaxSize()
                .padding(paddingValues),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(messages) { msg ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.Top
                ) {
                    AvatarFrameView(avatarUrl = msg.senderAvatar, level = msg.senderLevel, size = 36.dp)
                    Spacer(modifier = Modifier.width(10.dp))
                    Column(
                        modifier = Modifier
                            .clip(RoundedCornerShape(12.dp))
                            .background(BgCardDark)
                            .padding(10.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(msg.senderName, color = GoldPrimary, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Lv.${msg.senderLevel}", color = TextMuted, fontSize = 10.sp)
                        }
                        Spacer(modifier = Modifier.height(3.dp))
                        Text(msg.text, color = TextPrimary, fontSize = 13.sp)
                    }
                }
            }
        }
    }
}
