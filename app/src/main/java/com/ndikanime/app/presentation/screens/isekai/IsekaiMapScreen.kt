package com.ndikanime.app.presentation.screens.isekai

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
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Explore
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.ndikanime.app.core.SoundManager
import com.ndikanime.app.presentation.theme.*

data class IsekaiNode(
    val id: String,
    val name: String,
    val region: String,
    val icon: String,
    val staminaCost: Int,
    val rewardCoins: Int,
    val isCleared: Boolean,
    val isUnlocked: Boolean
)

@Composable
fun IsekaiMapScreen(
    navController: NavController,
    modifier: Modifier = Modifier
) {
    var stamina by remember { mutableIntStateOf(100) }
    var clearedNodes by remember { mutableStateOf(setOf("node_1", "node_2")) }
    var rewardNotice by remember { mutableStateOf<String?>(null) }

    val nodes = listOf(
        IsekaiNode("node_1", "Gerbang Dimensi Awal", "Wilayah Pemula", "🌲", 10, 150, clearedNodes.contains("node_1"), true),
        IsekaiNode("node_2", "Lembah Goblin Hitam", "Wilayah Pemula", "🏕️", 15, 250, clearedNodes.contains("node_2"), true),
        IsekaiNode("node_3", "Reruntuhan Kuil Naga", "Wilayah Mystic", "🏛️", 20, 450, clearedNodes.contains("node_3"), clearedNodes.contains("node_2")),
        IsekaiNode("node_4", "Kawah Gunung Api Berpijar", "Wilayah Vulkanik", "🌋", 25, 600, clearedNodes.contains("node_4"), clearedNodes.contains("node_3")),
        IsekaiNode("node_5", "Istana Es Abadi", "Wilayah Frost", "❄️", 30, 900, clearedNodes.contains("node_5"), clearedNodes.contains("node_4")),
        IsekaiNode("node_6", "Gerbang Raja Iblis Void", "Wilayah Abyss", "🌌", 40, 2000, clearedNodes.contains("node_6"), clearedNodes.contains("node_5"))
    )

    fun exploreNode(node: IsekaiNode) {
        if (stamina < node.staminaCost) return
        stamina -= node.staminaCost
        clearedNodes = clearedNodes + node.id
        SoundManager.playCoinSfx()
        rewardNotice = "Eksplorasi ${node.name} Sukses! +${node.rewardCoins} Koin! 🪙"
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
                    text = "ISEKAI WORLD MAP 🗺️",
                    color = GoldPrimary,
                    fontWeight = FontWeight.Black,
                    fontSize = 16.sp,
                    modifier = Modifier.weight(1f)
                )
                Surface(
                    shape = RoundedCornerShape(10.dp),
                    color = BgCardDark,
                    border = androidx.compose.foundation.BorderStroke(1.dp, GoldPrimary)
                ) {
                    Text(
                        text = "⚡ Stamina: $stamina/100",
                        color = GoldPrimary,
                        fontWeight = FontWeight.Bold,
                        fontSize = 11.sp,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
            }
        }
    ) { paddingValues ->
        LazyColumn(
            modifier = modifier
                .fillMaxSize()
                .padding(paddingValues),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            if (rewardNotice != null) {
                item {
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = GoldPrimary,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = rewardNotice ?: "",
                            color = BgDarkMain,
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp,
                            modifier = Modifier.padding(12.dp)
                        )
                    }
                }
            }

            items(nodes) { node ->
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = if (node.isCleared) BgCardDark else if (node.isUnlocked) BgCardElevated else Color(0xFF101014),
                    border = androidx.compose.foundation.BorderStroke(
                        1.dp,
                        if (node.isUnlocked && !node.isCleared) GoldPrimary else BorderGlass
                    ),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(text = node.icon, fontSize = 32.sp)

                        Spacer(modifier = Modifier.width(14.dp))

                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = node.name,
                                color = if (node.isUnlocked) TextPrimary else TextMuted,
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp
                            )
                            Text(
                                text = "${node.region} • Biaya: ⚡ ${node.staminaCost} • Hadiah: 🪙 +${node.rewardCoins}",
                                color = if (node.isUnlocked) GoldPrimary else TextMuted,
                                fontSize = 11.sp
                            )
                        }

                        if (node.isCleared) {
                            Icon(Icons.Default.CheckCircle, contentDescription = "Cleared", tint = StatusSuccess)
                        } else if (node.isUnlocked) {
                            Button(
                                onClick = { exploreNode(node) },
                                colors = ButtonDefaults.buttonColors(containerColor = GoldPrimary),
                                shape = RoundedCornerShape(10.dp),
                                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 2.dp),
                                modifier = Modifier.height(34.dp)
                            ) {
                                Text("Jelajahi", color = BgDarkMain, fontWeight = FontWeight.Bold, fontSize = 11.sp)
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
