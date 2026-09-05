package com.ndikanime.app.presentation.screens.admin

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Security
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.ndikanime.app.core.SoundManager
import com.ndikanime.app.data.storage.AuthManager
import com.ndikanime.app.presentation.theme.*

@Composable
fun AdminPanelScreen(
    navController: NavController,
    authManager: AuthManager,
    modifier: Modifier = Modifier
) {
    var adminNotice by remember { mutableStateOf<String?>(null) }
    val userProfile = authManager.getUserProfile()

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
                    text = "ADMIN DIMENSION PANEL 👑",
                    color = FlameOrange,
                    fontWeight = FontWeight.Black,
                    fontSize = 16.sp,
                    modifier = Modifier.weight(1f)
                )
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
            if (adminNotice != null) {
                item {
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = StatusSuccess,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = adminNotice ?: "",
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp,
                            modifier = Modifier.padding(12.dp)
                        )
                    }
                }
            }

            item {
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = BgCardDark,
                    border = androidx.compose.foundation.BorderStroke(1.dp, FlameOrange),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("KONTROL ADMIN CEPAT", color = FlameOrange, fontWeight = FontWeight.Black, fontSize = 14.sp)
                        Spacer(modifier = Modifier.height(12.dp))

                        Button(
                            onClick = {
                                if (userProfile != null) {
                                    authManager.saveUser(userProfile.copy(coins = userProfile.coins + 10000))
                                    SoundManager.playCoinSfx()
                                    adminNotice = "Sukses menambahkan +10,000 Koin ke akun!"
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = GoldPrimary),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.fillMaxWidth().height(42.dp)
                        ) {
                            Text("Tambah +10,000 Koin Dimensi 🪙", color = BgDarkMain, fontWeight = FontWeight.Bold)
                        }

                        Spacer(modifier = Modifier.height(10.dp))

                        Button(
                            onClick = {
                                if (userProfile != null) {
                                    authManager.saveUser(userProfile.copy(level = 100, title = "Anime Creator"))
                                    SoundManager.playLevelUpSfx()
                                    adminNotice = "Level dinaikkan ke Level 100 (Anime Creator)!"
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = FlameOrange),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.fillMaxWidth().height(42.dp)
                        ) {
                            Text("Buka Level 100 & Title Anime Creator 👑", color = Color.White, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}
