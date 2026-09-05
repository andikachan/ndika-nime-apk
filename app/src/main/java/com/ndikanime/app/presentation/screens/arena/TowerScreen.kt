package com.ndikanime.app.presentation.screens.arena

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.ndikanime.app.core.SoundManager
import com.ndikanime.app.presentation.theme.*

data class TowerFloor(
    val floorNumber: Int,
    val bossName: String,
    val recommendedCp: Int,
    val rewardCoins: Int,
    val rewardGems: Int,
    val isCleared: Boolean,
    val isUnlocked: Boolean
)

@Composable
fun TowerScreen(
    navController: NavController,
    modifier: Modifier = Modifier
) {
    var highestClearedFloor by remember { mutableIntStateOf(14) }

    val floors = remember(highestClearedFloor) {
        (1..50).map { f ->
            TowerFloor(
                floorNumber = f,
                bossName = when (f % 5) {
                    0 -> "Major Boss: Demon Lord Floor $f"
                    1 -> "Guardian: Shadow Beast"
                    2 -> "Guardian: Flame Drake"
                    3 -> "Guardian: Ice Golem"
                    else -> "Guardian: Storm Titan"
                },
                recommendedCp = f * 850,
                rewardCoins = f * 120,
                rewardGems = if (f % 5 == 0) f * 2 else 0,
                isCleared = f <= highestClearedFloor,
                isUnlocked = f <= highestClearedFloor + 1
            )
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
                    text = "TOWER OF CHAMPIONS (50 LANTAI)",
                    color = GoldPrimary,
                    fontWeight = FontWeight.Black,
                    fontSize = 16.sp,
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
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            items(floors) { floor ->
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = if (floor.isCleared) BgCardDark else if (floor.isUnlocked) BgCardElevated else Color(0xFF111115),
                    border = androidx.compose.foundation.BorderStroke(
                        1.dp,
                        if (floor.isUnlocked && !floor.isCleared) GoldPrimary else BorderGlass
                    ),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = if (floor.isCleared) StatusSuccess else if (floor.isUnlocked) FlameOrange else BgCardDark,
                            modifier = Modifier.size(36.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Text(
                                    text = "F${floor.floorNumber}",
                                    color = Color.White,
                                    fontWeight = FontWeight.Black,
                                    fontSize = 12.sp
                                )
                            }
                        }

                        Spacer(modifier = Modifier.width(12.dp))

                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = floor.bossName,
                                color = if (floor.isUnlocked) TextPrimary else TextMuted,
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp
                            )
                            Text(
                                text = "Req CP: ${floor.recommendedCp} • 🪙 +${floor.rewardCoins} ${if (floor.rewardGems > 0) "💎 +${floor.rewardGems}" else ""}",
                                color = if (floor.isUnlocked) GoldPrimary else TextMuted,
                                fontSize = 11.sp
                            )
                        }

                        if (floor.isCleared) {
                            Icon(Icons.Default.CheckCircle, contentDescription = "Cleared", tint = StatusSuccess)
                        } else if (floor.isUnlocked) {
                            Button(
                                onClick = {
                                    SoundManager.playVictorySfx()
                                    highestClearedFloor = floor.floorNumber
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = GoldPrimary),
                                shape = RoundedCornerShape(8.dp),
                                contentPadding = PaddingValues(horizontal = 10.dp, vertical = 2.dp),
                                modifier = Modifier.height(32.dp)
                            ) {
                                Text("Tantang", color = BgDarkMain, fontWeight = FontWeight.Bold, fontSize = 11.sp)
                            }
                        } else {
                            Icon(Icons.Default.Lock, contentDescription = "Locked", tint = TextMuted)
                        }
                    }
                }
            }
        }
    }
}
