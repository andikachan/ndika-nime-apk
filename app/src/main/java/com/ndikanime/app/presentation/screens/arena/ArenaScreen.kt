package com.ndikanime.app.presentation.screens.arena

import androidx.compose.animation.AnimatedVisibility
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
import androidx.compose.material.icons.filled.MilitaryTech
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.SportsKabaddi
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
import com.ndikanime.app.core.ArenaBattleEngine
import com.ndikanime.app.core.BattleLogEntry
import com.ndikanime.app.core.BattleResult
import com.ndikanime.app.core.CardsCatalog
import com.ndikanime.app.core.SoundManager
import com.ndikanime.app.presentation.components.AvatarFrameView
import com.ndikanime.app.presentation.navigation.Screen
import com.ndikanime.app.presentation.theme.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun ArenaScreen(
    navController: NavController,
    modifier: Modifier = Modifier
) {
    val coroutineScope = rememberCoroutineScope()
    var userRp by remember { mutableIntStateOf(1450) }
    var arenaRank by remember { mutableStateOf("Silver II") }

    var isBattling by remember { mutableStateOf(false) }
    var battleResult by remember { mutableStateOf<BattleResult?>(null) }
    var currentLogIndex by remember { mutableIntStateOf(0) }

    val myDeck = remember { CardsCatalog.ALL_CARDS.take(3).map { it.copy() } }
    val enemyDeck = remember { CardsCatalog.ALL_CARDS.drop(3).take(3).map { it.copy() } }

    fun startBattle() {
        isBattling = true
        currentLogIndex = 0
        val result = ArenaBattleEngine.simulateBattle(myDeck, enemyDeck)
        battleResult = result

        coroutineScope.launch {
            for (i in result.logs.indices) {
                val log = result.logs[i]
                if (log.isUltimate) SoundManager.playUltimateSfx()
                else if (log.isCritical) SoundManager.playCritSfx()
                else SoundManager.playHitSfx()

                currentLogIndex = i
                delay(600)
            }

            delay(800)
            if (result.won) {
                SoundManager.playVictorySfx()
                userRp += result.rpEarned
            } else {
                SoundManager.playDefeatSfx()
                userRp = maxOf(0, userRp + result.rpEarned)
            }
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
                    text = "ARENA DUEL PVP",
                    color = GoldPrimary,
                    fontWeight = FontWeight.Black,
                    fontSize = 17.sp,
                    letterSpacing = 1.sp,
                    modifier = Modifier.weight(1f)
                )
                Button(
                    onClick = { navController.navigate(Screen.Tower.route) },
                    colors = ButtonDefaults.buttonColors(containerColor = FlameOrange),
                    shape = RoundedCornerShape(10.dp),
                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                    modifier = Modifier.height(32.dp)
                ) {
                    Text("Tower PvE 🏰", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    ) { paddingValues ->
        LazyColumn(
            modifier = modifier
                .fillMaxSize()
                .padding(paddingValues),
            contentPadding = PaddingValues(16.dp)
        ) {
            // Rank Badge Card
            item {
                Surface(
                    shape = RoundedCornerShape(20.dp),
                    color = BgCardDark,
                    border = androidx.compose.foundation.BorderStroke(1.dp, Brush.linearGradient(listOf(GoldPrimary, FlameOrange))),
                    modifier = Modifier
                        .fillMaxWidth()
                        .shadow(16.dp, RoundedCornerShape(20.dp), spotColor = GoldPrimary.copy(alpha = 0.2f))
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Surface(
                            shape = CircleShape,
                            color = BgCardElevated,
                            border = androidx.compose.foundation.BorderStroke(2.dp, GoldPrimary),
                            modifier = Modifier.size(60.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Text("⚔️", fontSize = 28.sp)
                            }
                        }

                        Spacer(modifier = Modifier.width(16.dp))

                        Column {
                            Text(
                                text = arenaRank,
                                color = GoldPrimary,
                                fontWeight = FontWeight.Black,
                                fontSize = 18.sp
                            )
                            Text(
                                text = "Rating Points: $userRp RP",
                                color = TextPrimary,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "Menang: +25 RP • Kalah: -12 RP",
                                color = TextMuted,
                                fontSize = 11.sp
                            )
                        }
                    }
                }
                Spacer(modifier = Modifier.height(20.dp))
            }

            // VS Battle Arena Stage
            item {
                Surface(
                    shape = RoundedCornerShape(20.dp),
                    color = BgCardElevated,
                    border = androidx.compose.foundation.BorderStroke(1.dp, BorderGlass),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            // Player Team
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                AvatarFrameView(avatarUrl = null, level = 45, size = 48.dp)
                                Spacer(modifier = Modifier.height(6.dp))
                                Text("Tim Kamu", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                Text("CP: ${myDeck.sumOf { it.combatPower }}", color = GoldPrimary, fontSize = 11.sp)
                            }

                            Surface(
                                shape = CircleShape,
                                color = FlameOrange,
                                modifier = Modifier.size(42.dp)
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Text("VS", color = Color.White, fontWeight = FontWeight.Black, fontSize = 14.sp)
                                }
                            }

                            // Opponent Team
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                AvatarFrameView(avatarUrl = "https://api.dicebear.com/7.x/bottts/png?seed=ShadowRival", level = 48, size = 48.dp)
                                Spacer(modifier = Modifier.height(6.dp))
                                Text("Shadow Sovereign", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                Text("CP: ${enemyDeck.sumOf { it.combatPower }}", color = FlameOrange, fontSize = 11.sp)
                            }
                        }

                        Spacer(modifier = Modifier.height(20.dp))

                        if (!isBattling) {
                            Button(
                                onClick = { startBattle() },
                                colors = ButtonDefaults.buttonColors(containerColor = GoldPrimary),
                                shape = RoundedCornerShape(14.dp),
                                modifier = Modifier.fillMaxWidth().height(46.dp)
                            ) {
                                Text("Mulai Duel Pertempuran", color = BgDarkMain, fontWeight = FontWeight.Black, fontSize = 14.sp)
                            }
                        } else {
                            Text(
                                text = "PERTARUNGAN SEDANG BERLANGSUNG...",
                                color = FlameOrange,
                                fontWeight = FontWeight.Black,
                                fontSize = 13.sp
                            )
                        }
                    }
                }
                Spacer(modifier = Modifier.height(20.dp))
            }

            // Real-Time Combat Log Stream
            if (isBattling && battleResult != null) {
                item {
                    Text(
                        text = "LIVE BATTLE ACTION LOG",
                        color = GoldPrimary,
                        fontWeight = FontWeight.Black,
                        fontSize = 14.sp
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                }

                val activeLogs = battleResult!!.logs.take(currentLogIndex + 1)
                items(activeLogs) { log ->
                    BattleLogCard(log = log)
                }

                if (currentLogIndex >= battleResult!!.logs.size - 1) {
                    item {
                        Spacer(modifier = Modifier.height(16.dp))
                        Surface(
                            shape = RoundedCornerShape(16.dp),
                            color = if (battleResult!!.won) GoldPrimary else StatusError,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(
                                modifier = Modifier.padding(16.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Text(
                                    text = if (battleResult!!.won) "VICTORY! KAMU MENANG!" else "DEFEAT! KAMU KALAH!",
                                    color = BgDarkMain,
                                    fontWeight = FontWeight.Black,
                                    fontSize = 18.sp
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = "+${battleResult!!.expEarned} EXP • +${battleResult!!.coinsEarned} Koin • ${battleResult!!.rpEarned} RP",
                                    color = BgDarkMain,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp
                                )
                                Spacer(modifier = Modifier.height(12.dp))
                                Button(
                                    onClick = { isBattling = false },
                                    colors = ButtonDefaults.buttonColors(containerColor = BgDarkMain),
                                    shape = RoundedCornerShape(10.dp)
                                ) {
                                    Text("Lanjutkan", color = Color.White, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun BattleLogCard(log: BattleLogEntry) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = BgCardDark,
        border = androidx.compose.foundation.BorderStroke(1.dp, if (log.isUltimate) FlameOrange else BorderGlass),
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
    ) {
        Row(
            modifier = Modifier.padding(10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = if (log.isPlayer) "🔵" else "🔴",
                fontSize = 12.sp
            )
            Spacer(modifier = Modifier.width(8.dp))
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = log.actorName,
                        color = if (log.isPlayer) GoldPrimary else FlameOrange,
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "menggunakan",
                        color = TextMuted,
                        fontSize = 11.sp
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = log.actionName,
                        color = if (log.isUltimate) FlameOrange else TextPrimary,
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp
                    )
                }
                Text(
                    text = "Menghantam ${log.targetName} sebesar ${log.damage} DMG ${if (log.isCritical) "🔥 CRITICAL!" else ""}",
                    color = if (log.isCritical) FlameOrange else TextSecondary,
                    fontSize = 11.sp,
                    fontWeight = if (log.isCritical) FontWeight.Bold else FontWeight.Normal
                )
            }
        }
    }
}
