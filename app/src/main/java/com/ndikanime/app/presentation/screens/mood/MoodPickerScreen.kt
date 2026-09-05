package com.ndikanime.app.presentation.screens.mood

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
import com.ndikanime.app.core.SoundManager
import com.ndikanime.app.presentation.navigation.Screen
import com.ndikanime.app.presentation.theme.*

data class MoodOption(
    val id: String,
    val title: String,
    val emoji: String,
    val description: String,
    val recommendedAnime: List<String>
)

@Composable
fun MoodPickerScreen(
    navController: NavController,
    modifier: Modifier = Modifier
) {
    val moods = listOf(
        MoodOption("hype", "HYPE & ACTION", "🔥", "Aksi pertarungan epik pemacu adrenalin", listOf("Jujutsu Kaisen", "Solo Leveling", "Demon Slayer", "Bleach: TYBW")),
        MoodOption("relax", "RELAX & HEALING", "☕", "Suasana santai menenangkan jiwa", listOf("Sousou no Frieren", "Yuru Camp", "Bocchi the Rock!", "Mushishi")),
        MoodOption("tear", "TEARJERKER / SEDIH", "😭", "Cerita penuh emosi dan haru", listOf("Your Lie in April", "Anohana", "Violet Evergarden", "Clannad: After Story")),
        MoodOption("romance", "ROMANCE & SWEET", "💖", "Kisah cinta manis bikin baper", listOf("Kaguya-sama", "Horimiya", "The Dangers in My Heart", "Toradora!")),
        MoodOption("dark", "DARK & PSYCHOLOGICAL", "🌑", "Misteri kelam dan ketegangan mendalam", listOf("Death Note", "Monster", "Attack on Titan", "Re:Zero"))
    )

    var selectedMood by remember { mutableStateOf(moods.first()) }

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
                    text = "ANIME MOOD ROULETTE 🎭",
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
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            item {
                Text(
                    text = "BAGAIMANA SUASANA HATIMU HARI INI?",
                    color = TextPrimary,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp
                )
                Spacer(modifier = Modifier.height(10.dp))

                LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    items(moods) { m ->
                        val isSelected = selectedMood.id == m.id
                        Surface(
                            shape = RoundedCornerShape(14.dp),
                            color = if (isSelected) GoldPrimary else BgCardDark,
                            border = androidx.compose.foundation.BorderStroke(1.dp, BorderGlass),
                            modifier = Modifier.clickable {
                                SoundManager.playCoinSfx()
                                selectedMood = m
                            }
                        ) {
                            Column(
                                modifier = Modifier.padding(14.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Text(m.emoji, fontSize = 28.sp)
                                Spacer(modifier = Modifier.height(6.dp))
                                Text(
                                    text = m.title,
                                    color = if (isSelected) BgDarkMain else TextPrimary,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 12.sp
                                )
                            }
                        }
                    }
                }
            }

            item {
                Spacer(modifier = Modifier.height(10.dp))
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = BgCardDark,
                    border = androidx.compose.foundation.BorderStroke(1.dp, GoldPrimary),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(selectedMood.emoji, fontSize = 28.sp)
                            Spacer(modifier = Modifier.width(10.dp))
                            Text(
                                text = "Rekomendasi Anime ${selectedMood.title}",
                                color = GoldPrimary,
                                fontWeight = FontWeight.Bold,
                                fontSize = 15.sp
                            )
                        }

                        Spacer(modifier = Modifier.height(8.dp))
                        Text(selectedMood.description, color = TextSecondary, fontSize = 12.sp)

                        Spacer(modifier = Modifier.height(14.dp))

                        selectedMood.recommendedAnime.forEach { animeName ->
                            Surface(
                                shape = RoundedCornerShape(10.dp),
                                color = BgCardElevated,
                                border = androidx.compose.foundation.BorderStroke(1.dp, BorderGlass),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 4.dp)
                                    .clickable {
                                        navController.navigate(Screen.Explore.route)
                                    }
                            ) {
                                Row(
                                    modifier = Modifier.padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text("🎬", fontSize = 16.sp)
                                    Spacer(modifier = Modifier.width(10.dp))
                                    Text(
                                        text = animeName,
                                        color = TextPrimary,
                                        fontWeight = FontWeight.SemiBold,
                                        fontSize = 13.sp
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
