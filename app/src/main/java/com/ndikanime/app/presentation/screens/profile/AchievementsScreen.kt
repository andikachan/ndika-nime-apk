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
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.EmojiEvents
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
import com.ndikanime.app.core.AchievementCategory
import com.ndikanime.app.core.AchievementItem
import com.ndikanime.app.core.AchievementsCatalog
import com.ndikanime.app.core.SoundManager
import com.ndikanime.app.presentation.theme.*

@Composable
fun AchievementsScreen(
    navController: NavController,
    modifier: Modifier = Modifier
) {
    var selectedCategory by remember { mutableStateOf<AchievementCategory?>(null) }
    val achievements = remember {
        mutableStateListOf<AchievementItem>().apply {
            addAll(AchievementsCatalog.getUserAchievements().mapIndexed { idx, it ->
                if (idx < 5) it.copy(currentProgress = it.requiredProgress, isUnlocked = true)
                else it.copy(currentProgress = (it.requiredProgress * 0.4f).toInt())
            })
        }
    }

    val filtered = if (selectedCategory != null) achievements.filter { it.category == selectedCategory } else achievements

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
                    text = "ACHIEVEMENT BADGES 🏅",
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
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            // Category Filter Chips
            item {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    item {
                        FilterChip(
                            selected = selectedCategory == null,
                            onClick = { selectedCategory = null },
                            label = { Text("Semua") }
                        )
                    }
                    items(AchievementCategory.values()) { cat ->
                        FilterChip(
                            selected = selectedCategory == cat,
                            onClick = { selectedCategory = cat },
                            label = { Text(cat.label) }
                        )
                    }
                }
                Spacer(modifier = Modifier.height(10.dp))
            }

            items(filtered) { item ->
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = BgCardDark,
                    border = androidx.compose.foundation.BorderStroke(1.dp, if (item.isUnlocked) Color(item.tier.colorHex) else BorderGlass),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = Color(item.tier.colorHex),
                            modifier = Modifier.size(36.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Text("🏅", fontSize = 18.sp)
                            }
                        }

                        Spacer(modifier = Modifier.width(12.dp))

                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = item.title,
                                color = if (item.isUnlocked) GoldPrimary else TextPrimary,
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp
                            )
                            Text(
                                text = item.description,
                                color = TextSecondary,
                                fontSize = 11.sp
                            )
                            Spacer(modifier = Modifier.height(6.dp))
                            LinearProgressIndicator(
                                progress = { item.progressPercent },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(4.dp)
                                    .clip(RoundedCornerShape(2.dp)),
                                color = Color(item.tier.colorHex),
                                trackColor = BgCardElevated
                            )
                        }

                        Spacer(modifier = Modifier.width(12.dp))

                        if (item.isUnlocked) {
                            Icon(Icons.Default.CheckCircle, contentDescription = "Claimed", tint = StatusSuccess)
                        } else {
                            Text(
                                text = "🪙 +${item.rewardCoins}",
                                color = GoldPrimary,
                                fontWeight = FontWeight.Bold,
                                fontSize = 11.sp
                            )
                        }
                    }
                }
            }
        }
    }
}
