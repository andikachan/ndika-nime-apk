package com.ndikanime.app.presentation.screens.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
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
import com.ndikanime.app.presentation.components.AvatarFrameView
import com.ndikanime.app.presentation.theme.*

@Composable
fun ProfileCustomizerScreen(
    navController: NavController,
    modifier: Modifier = Modifier
) {
    var selectedFrame by remember { mutableStateOf("gold") }
    var selectedAura by remember { mutableStateOf("saiyan") }
    var selectedClass by remember { mutableStateOf("Swordsman") }
    var saveNotice by remember { mutableStateOf<String?>(null) }

    val frames = listOf("bronze" to "Perunggu", "silver" to "Perak", "gold" to "Emas Murni", "fire" to "Api Membara", "rainbow" to "Pelangi Legenda")
    val auras = listOf("none" to "Tanpa Aura", "saiyan" to "Super Saiyan (Kuning)", "shadow" to "Shadow Neon (Ungu)", "cursed" to "Cursed Flame (Merah)")
    val classes = listOf("Swordsman" to "⚔️ Swordsman", "Mage" to "🔮 Mage", "Assassin" to "🗡️ Assassin", "Archer" to "🏹 Archer", "Healer" to "🌿 Healer")

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
                    text = "KUSTOMISASI PROFIL 🎨",
                    color = GoldPrimary,
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
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Live Preview Card
            item {
                Surface(
                    shape = RoundedCornerShape(20.dp),
                    color = BgCardDark,
                    border = androidx.compose.foundation.BorderStroke(1.dp, GoldPrimary),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        AvatarFrameView(
                            avatarUrl = null,
                            level = 50,
                            frameType = selectedFrame,
                            auraType = selectedAura,
                            size = 80.dp
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Text("Live Preview Avatar", color = GoldPrimary, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        Text("Class: $selectedClass", color = TextSecondary, fontSize = 12.sp)
                    }
                }
            }

            // 1. Pilih Avatar Frame
            item {
                Text("PILIH FRAME AVATAR", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                Spacer(modifier = Modifier.height(8.dp))
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(frames) { (id, label) ->
                        val isPicked = selectedFrame == id
                        Surface(
                            shape = RoundedCornerShape(10.dp),
                            color = if (isPicked) GoldPrimary else BgCardDark,
                            border = androidx.compose.foundation.BorderStroke(1.dp, BorderGlass),
                            modifier = Modifier.clickable { selectedFrame = id }
                        ) {
                            Text(
                                text = label,
                                color = if (isPicked) BgDarkMain else TextPrimary,
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp,
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
                            )
                        }
                    }
                }
            }

            // 2. Pilih Animated Aura
            item {
                Text("PILIH ANIMATED AURA", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                Spacer(modifier = Modifier.height(8.dp))
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(auras) { (id, label) ->
                        val isPicked = selectedAura == id
                        Surface(
                            shape = RoundedCornerShape(10.dp),
                            color = if (isPicked) FlameOrange else BgCardDark,
                            border = androidx.compose.foundation.BorderStroke(1.dp, BorderGlass),
                            modifier = Modifier.clickable { selectedAura = id }
                        ) {
                            Text(
                                text = label,
                                color = if (isPicked) Color.White else TextPrimary,
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp,
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
                            )
                        }
                    }
                }
            }

            // 3. Pilih RPG Class
            item {
                Text("PILIH RPG CLASS", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                Spacer(modifier = Modifier.height(8.dp))
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(classes) { (id, label) ->
                        val isPicked = selectedClass == id
                        Surface(
                            shape = RoundedCornerShape(10.dp),
                            color = if (isPicked) GoldPrimary else BgCardDark,
                            border = androidx.compose.foundation.BorderStroke(1.dp, BorderGlass),
                            modifier = Modifier.clickable { selectedClass = id }
                        ) {
                            Text(
                                text = label,
                                color = if (isPicked) BgDarkMain else TextPrimary,
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp,
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
                            )
                        }
                    }
                }
            }

            // Save Button
            item {
                Spacer(modifier = Modifier.height(10.dp))
                Button(
                    onClick = {
                        SoundManager.playLevelUpSfx()
                        saveNotice = "Kustomisasi berhasil disimpan!"
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = GoldPrimary),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth().height(46.dp)
                ) {
                    Text("Simpan Perubahan", color = BgDarkMain, fontWeight = FontWeight.Black, fontSize = 14.sp)
                }

                if (saveNotice != null) {
                    Spacer(modifier = Modifier.height(10.dp))
                    Text(saveNotice ?: "", color = StatusSuccess, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                }
            }
        }
    }
}
