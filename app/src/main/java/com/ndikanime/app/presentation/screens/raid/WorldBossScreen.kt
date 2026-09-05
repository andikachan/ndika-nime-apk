package com.ndikanime.app.presentation.screens.raid

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.FlashOn
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
import com.ndikanime.app.core.SoundManager
import com.ndikanime.app.presentation.theme.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.random.Random

@Composable
fun WorldBossScreen(
    navController: NavController,
    modifier: Modifier = Modifier
) {
    val coroutineScope = rememberCoroutineScope()
    var bossMaxHp by remember { mutableLongStateOf(5000000000L) }
    var bossCurrentHp by remember { mutableLongStateOf(3421500800L) }
    var myCumulativeDamage by remember { mutableLongStateOf(24500000L) }
    var isAttacking by remember { mutableStateOf(false) }

    val bossHpPercent = (bossCurrentHp.toDouble() / bossMaxHp).toFloat().coerceIn(0f, 1f)

    val topContributors = listOf(
        Pair("Kaiser_Shadow", 480000000L),
        Pair("Gojō_Domain", 395000000L),
        Pair("DragonSlayer99", 280000000L),
        Pair("Rimuru_DemonLord", 210000000L),
        Pair("Kamu (Peringkat #8)", myCumulativeDamage)
    )

    fun performAttack() {
        if (isAttacking) return
        isAttacking = true
        coroutineScope.launch {
            SoundManager.playUltimateSfx()
            delay(500)
            val dealt = Random.nextLong(2500000L, 6500000L)
            bossCurrentHp = maxOf(0L, bossCurrentHp - dealt)
            myCumulativeDamage += dealt
            SoundManager.playCritSfx()
            delay(300)
            isAttacking = false
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
                    text = "WORLD BOSS RAID 🐉",
                    color = FlameOrange,
                    fontWeight = FontWeight.Black,
                    fontSize = 17.sp,
                    letterSpacing = 1.sp,
                    modifier = Modifier.weight(1f)
                )
            }
        }
    ) { paddingValues ->
        LazyColumn(
            modifier = modifier
                .fillMaxSize()
                .padding(paddingValues),
            contentPadding = PaddingValues(16.dp)
        ) {
            // World Boss Banner
            item {
                Surface(
                    shape = RoundedCornerShape(20.dp),
                    color = BgCardDark,
                    border = androidx.compose.foundation.BorderStroke(1.dp, FlameOrange),
                    modifier = Modifier
                        .fillMaxWidth()
                        .shadow(20.dp, RoundedCornerShape(20.dp), spotColor = FlameOrange.copy(alpha = 0.3f))
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text("🐉", fontSize = 48.sp)
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "Bahamut: Primordial Abyss Dragon",
                            color = Color.White,
                            fontWeight = FontWeight.Black,
                            fontSize = 17.sp
                        )
                        Text(
                            text = "Tersisa: 18 Jam 42 Menit • Hadiah Global: 10,000 Koin + Mythic Card",
                            color = TextMuted,
                            fontSize = 11.sp
                        )

                        Spacer(modifier = Modifier.height(14.dp))

                        // Boss HP Bar
                        LinearProgressIndicator(
                            progress = { bossHpPercent },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(14.dp)
                                .clip(RoundedCornerShape(7.dp)),
                            color = FlameOrange,
                            trackColor = BgCardElevated
                        )

                        Spacer(modifier = Modifier.height(6.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "HP: ${bossCurrentHp / 1000000}M / ${bossMaxHp / 1000000}M",
                                color = GoldPrimary,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "${String.format("%.1f", bossHpPercent * 100)}%",
                                color = FlameOrange,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Black
                            )
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        Button(
                            onClick = { performAttack() },
                            enabled = !isAttacking,
                            colors = ButtonDefaults.buttonColors(containerColor = FlameOrange),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth().height(44.dp)
                        ) {
                            Icon(Icons.Default.FlashOn, contentDescription = null, tint = Color.White)
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = if (isAttacking) "MENYERANG..." else "Serang World Boss ⚔️",
                                color = Color.White,
                                fontWeight = FontWeight.Black,
                                fontSize = 14.sp
                            )
                        }
                    }
                }
                Spacer(modifier = Modifier.height(20.dp))
            }

            // Contributor Leaderboard
            item {
                Text(
                    text = "TOP RAID CONTRIBUTORS",
                    color = GoldPrimary,
                    fontWeight = FontWeight.Black,
                    fontSize = 14.sp
                )
                Spacer(modifier = Modifier.height(10.dp))
            }

            itemsIndexed(topContributors) { rank, (name, dmg) ->
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = BgCardDark,
                    border = androidx.compose.foundation.BorderStroke(1.dp, BorderGlass),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Surface(
                            shape = RoundedCornerShape(6.dp),
                            color = if (rank == 0) GoldPrimary else if (rank == 1) Color(0xFFC0C0C0) else BgCardElevated,
                            modifier = Modifier.size(28.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Text("#${rank + 1}", color = if (rank <= 1) BgDarkMain else TextSecondary, fontWeight = FontWeight.Bold, fontSize = 11.sp)
                            }
                        }

                        Spacer(modifier = Modifier.width(12.dp))

                        Column(modifier = Modifier.weight(1f)) {
                            Text(text = name, color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                            Text(text = "Total Damage: ${dmg / 1000000}M DMG", color = TextSecondary, fontSize = 11.sp)
                        }
                    }
                }
            }
        }
    }
}
