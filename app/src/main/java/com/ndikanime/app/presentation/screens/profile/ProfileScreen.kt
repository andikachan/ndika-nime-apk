package com.ndikanime.app.presentation.screens.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.Palette
import androidx.compose.material.icons.filled.Security
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.ndikanime.app.data.storage.AuthManager
import com.ndikanime.app.presentation.components.AvatarFrameView
import com.ndikanime.app.presentation.navigation.Screen
import com.ndikanime.app.presentation.theme.*

@Composable
fun ProfileScreen(
    navController: NavController,
    userId: String,
    authManager: AuthManager,
    modifier: Modifier = Modifier
) {
    val userProfile = authManager.getUserProfile()
    val isMe = userId == "me" || userId == authManager.userId

    val level = userProfile?.level ?: 1
    val title = userProfile?.title ?: "Anime Newbie"
    val coins = userProfile?.coins ?: 1500
    val watchTimeMinutes = (userProfile?.watchTime ?: 0) / 60

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
                if (!isMe) {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = TextPrimary)
                    }
                }
                Text(
                    text = if (isMe) "PROFIL SAYA 👑" else "PROFIL PENGGUNA",
                    color = GoldPrimary,
                    fontWeight = FontWeight.Black,
                    fontSize = 17.sp,
                    letterSpacing = 1.sp,
                    modifier = Modifier.weight(1f).padding(start = if (isMe) 8.dp else 0.dp)
                )

                if (isMe) {
                    IconButton(onClick = { navController.navigate(Screen.Admin.route) }) {
                        Icon(Icons.Default.Security, contentDescription = "Admin", tint = GoldPrimary)
                    }
                }
            }
        }
    ) { paddingValues ->
        LazyColumn(
            modifier = modifier
                .fillMaxSize()
                .padding(paddingValues),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // Profile Card Header
            item {
                Surface(
                    shape = RoundedCornerShape(20.dp),
                    color = BgCardDark,
                    border = androidx.compose.foundation.BorderStroke(1.dp, Brush.linearGradient(listOf(GoldPrimary, FlameOrange))),
                    modifier = Modifier
                        .fillMaxWidth()
                        .shadow(16.dp, RoundedCornerShape(20.dp), spotColor = GoldPrimary.copy(alpha = 0.2f))
                ) {
                    Column(
                        modifier = Modifier.padding(18.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        AvatarFrameView(
                            avatarUrl = userProfile?.picture,
                            level = level,
                            frameType = "gold",
                            auraType = "saiyan",
                            size = 72.dp
                        )

                        Spacer(modifier = Modifier.height(10.dp))

                        Text(
                            text = userProfile?.name ?: "Prajurit NeFora",
                            color = Color.White,
                            fontWeight = FontWeight.Black,
                            fontSize = 18.sp
                        )

                        Text(
                            text = "Level $level • $title",
                            color = GoldPrimary,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold
                        )

                        Spacer(modifier = Modifier.height(14.dp))

                        // Stats Summary Row
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceAround
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("🪙 $coins", color = GoldPrimary, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                Text("Koin Dimensi", color = TextMuted, fontSize = 11.sp)
                            }
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("⏱️ ${watchTimeMinutes}m", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                Text("Waktu Nonton", color = TextMuted, fontSize = 11.sp)
                            }
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("⚔️ 1450 RP", color = FlameOrange, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                Text("Arena Rating", color = TextMuted, fontSize = 11.sp)
                            }
                        }
                    }
                }
            }

            // Quick Menu Actions
            if (isMe) {
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Button(
                            onClick = { navController.navigate(Screen.ProfileCustomizer.route) },
                            colors = ButtonDefaults.buttonColors(containerColor = BgCardDark),
                            border = androidx.compose.foundation.BorderStroke(1.dp, BorderGlass),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.weight(1f).height(44.dp)
                        ) {
                            Icon(Icons.Default.Palette, contentDescription = null, tint = GoldPrimary, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Kustomisasi", color = TextPrimary, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }

                        Button(
                            onClick = { navController.navigate(Screen.Achievements.route) },
                            colors = ButtonDefaults.buttonColors(containerColor = BgCardDark),
                            border = androidx.compose.foundation.BorderStroke(1.dp, BorderGlass),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.weight(1f).height(44.dp)
                        ) {
                            Icon(Icons.Default.EmojiEvents, contentDescription = null, tint = GoldPrimary, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Achievement", color = TextPrimary, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            // RPG Skill Tree Summary
            item {
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = BgCardDark,
                    border = androidx.compose.foundation.BorderStroke(1.dp, BorderGlass),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "RPG CLASS & STATUS",
                            color = GoldPrimary,
                            fontWeight = FontWeight.Black,
                            fontSize = 14.sp
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("Class: Shadow Swordsman (Dual Blade)", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        Text("Skill Pasif: +15% Critical Strike & +20% EXP Gain saat menonton anime shounen.", color = TextSecondary, fontSize = 11.sp)
                    }
                }
            }

            // Auth / Logout Button
            if (isMe) {
                item {
                    Button(
                        onClick = {
                            authManager.logout()
                            navController.navigate(Screen.Auth.route) {
                                popUpTo(Screen.Home.route) { inclusive = true }
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = BgCardDark),
                        border = androidx.compose.foundation.BorderStroke(1.dp, StatusError.copy(alpha = 0.5f)),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth().height(44.dp)
                    ) {
                        Icon(Icons.Default.Logout, contentDescription = null, tint = StatusError, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Keluar / Ganti Akun", color = StatusError, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    }
                }
            }
        }
    }
}
