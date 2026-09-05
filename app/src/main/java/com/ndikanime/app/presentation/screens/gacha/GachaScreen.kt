package com.ndikanime.app.presentation.screens.gacha

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.navigation.NavController
import com.ndikanime.app.core.CardModel
import com.ndikanime.app.core.CardRarity
import com.ndikanime.app.core.CardsCatalog
import com.ndikanime.app.core.SoundManager
import com.ndikanime.app.data.storage.AuthManager
import com.ndikanime.app.presentation.components.HoloCardView
import com.ndikanime.app.presentation.navigation.Screen
import com.ndikanime.app.presentation.theme.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun GachaScreen(
    navController: NavController,
    authManager: AuthManager,
    modifier: Modifier = Modifier
) {
    val coroutineScope = rememberCoroutineScope()
    var userCoins by remember { mutableLongStateOf(authManager.getUserProfile()?.coins ?: 2500L) }
    var pitySR by remember { mutableIntStateOf(0) }
    var pityUR by remember { mutableIntStateOf(0) }

    // User Cards Collection
    val inventory = remember {
        mutableStateListOf<CardModel>().apply {
            addAll(CardsCatalog.ALL_CARDS.take(6).map { it.copy() })
        }
    }

    // Summon Modal State
    var isSummoning by remember { mutableStateOf(false) }
    var summonedCards by remember { mutableStateOf<List<CardModel>>(emptyList()) }
    var summonPhase by remember { mutableIntStateOf(0) } // 0: Vortex, 1: Reveal

    // Rarity Filter for inventory
    var selectedFilter by remember { mutableStateOf<CardRarity?>(null) }

    fun executePull(count: Int) {
        val cost = if (count == 1) 100L else 900L
        if (userCoins < cost) return

        userCoins -= cost
        isSummoning = true
        summonPhase = 0
        val results = mutableListOf<CardModel>()

        coroutineScope.launch {
            SoundManager.playSummonFanfare()
            repeat(count) {
                pitySR++
                pityUR++
                val (card, _) = CardsCatalog.rollSingleCard(pitySR, pityUR)
                if (card.rarity == CardRarity.UR) pityUR = 0
                if (card.rarity >= CardRarity.SR) pitySR = 0

                // Duplicate fusion check
                val existing = inventory.find { it.id == card.id }
                if (existing != null) {
                    existing.duplicates++
                    if (existing.duplicates >= 2 && existing.stars < 5) {
                        existing.stars++
                        existing.duplicates = 0
                    }
                } else {
                    inventory.add(card.copy())
                }
                results.add(card)
            }

            delay(1500)
            summonedCards = results
            summonPhase = 1
        }
    }

    Scaffold(
        containerColor = BgDarkMain,
        topBar = {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(BgDarkMain)
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.AutoAwesome, contentDescription = null, tint = GoldPrimary)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "PORTAL GACHA HOLO",
                        color = GoldPrimary,
                        fontWeight = FontWeight.Black,
                        fontSize = 17.sp,
                        letterSpacing = 1.sp
                    )
                }

                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = BgCardDark,
                    border = androidx.compose.foundation.BorderStroke(1.dp, BorderGlass)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp)
                    ) {
                        Text("🪙", fontSize = 12.sp)
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "$userCoins",
                            color = GoldPrimary,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp
                        )
                    }
                }
            }
        }
    ) { paddingValues ->
        LazyColumn(
            modifier = modifier
                .fillMaxSize()
                .padding(paddingValues),
            contentPadding = PaddingValues(bottom = 90.dp)
        ) {
            // 1. Featured Gacha Banner Card
            item {
                GachaBannerCard(
                    pitySR = pitySR,
                    pityUR = pityUR,
                    onSinglePull = { executePull(1) },
                    onMultiPull = { executePull(10) },
                    onDeckBuilderClick = { navController.navigate(Screen.DeckBuilder.route) }
                )
            }

            // 2. Collection Header & Filters
            item {
                Spacer(modifier = Modifier.height(16.dp))
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Koleksi Kartu (${inventory.size})",
                        color = TextPrimary,
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp
                    )

                    Button(
                        onClick = { navController.navigate(Screen.DeckBuilder.route) },
                        colors = ButtonDefaults.buttonColors(containerColor = BgCardElevated),
                        shape = RoundedCornerShape(10.dp),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                        modifier = Modifier.height(32.dp)
                    ) {
                        Icon(Icons.Default.Shield, contentDescription = null, tint = GoldPrimary, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Atur Deck", color = GoldPrimary, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                }

                // Rarity Filters
                LazyRow(
                    contentPadding = PaddingValues(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    item {
                        FilterChip(
                            selected = selectedFilter == null,
                            onClick = { selectedFilter = null },
                            label = { Text("Semua") }
                        )
                    }
                    items(CardRarity.values()) { r ->
                        FilterChip(
                            selected = selectedFilter == r,
                            onClick = { selectedFilter = r },
                            label = { Text(r.label, color = Color(r.colorHex), fontWeight = FontWeight.Bold) }
                        )
                    }
                }
                Spacer(modifier = Modifier.height(12.dp))
            }

            // 3. User Cards Grid
            item {
                val filtered = if (selectedFilter != null) inventory.filter { it.rarity == selectedFilter } else inventory

                Column(
                    modifier = Modifier.padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    filtered.chunked(2).forEach { rowCards ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(14.dp)
                        ) {
                            rowCards.forEach { card ->
                                HoloCardView(
                                    card = card,
                                    modifier = Modifier
                                        .weight(1f)
                                        .height(270.dp)
                                )
                            }
                            if (rowCards.size == 1) {
                                Spacer(modifier = Modifier.weight(1f))
                            }
                        }
                    }
                }
            }
        }
    }

    // Summoning Modal Overlay
    if (isSummoning) {
        Dialog(
            onDismissRequest = { if (summonPhase == 1) isSummoning = false },
            properties = DialogProperties(usePlatformDefaultWidth = false)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color(0xEE050508)),
                contentAlignment = Alignment.Center
            ) {
                if (summonPhase == 0) {
                    // Vortex Animation
                    val infiniteTransition = rememberInfiniteTransition(label = "portal")
                    val rotation by infiniteTransition.animateFloat(
                        initialValue = 0f,
                        targetValue = 360f,
                        animationSpec = infiniteRepeatable(tween(2000, easing = LinearEasing)),
                        label = "portal_rot"
                    )
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Box(
                            modifier = Modifier
                                .size(180.dp)
                                .rotate(rotation)
                                .clip(CircleShape)
                                .background(Brush.sweepGradient(listOf(GoldPrimary, FlameOrange, RarityUR, GoldPrimary)))
                        )
                        Spacer(modifier = Modifier.height(20.dp))
                        Text(
                            text = "MENARIK KEKUATAN DIMENSI...",
                            color = GoldPrimary,
                            fontWeight = FontWeight.Black,
                            fontSize = 15.sp
                        )
                    }
                } else {
                    // Cards Reveal
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "HASIL SUMMON (${summonedCards.size})",
                                color = GoldPrimary,
                                fontWeight = FontWeight.Black,
                                fontSize = 16.sp
                            )
                            IconButton(onClick = { isSummoning = false }) {
                                Icon(Icons.Default.Close, contentDescription = "Close", tint = Color.White)
                            }
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        LazyVerticalGrid(
                            columns = GridCells.Fixed(2),
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            items(summonedCards) { card ->
                                HoloCardView(
                                    card = card,
                                    modifier = Modifier.height(260.dp)
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        Button(
                            onClick = { isSummoning = false },
                            colors = ButtonDefaults.buttonColors(containerColor = GoldPrimary),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth().height(44.dp)
                        ) {
                            Text("Selesai", color = BgDarkMain, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun GachaBannerCard(
    pitySR: Int,
    pityUR: Int,
    onSinglePull: () -> Unit,
    onMultiPull: () -> Unit,
    onDeckBuilderClick: () -> Unit
) {
    Surface(
        shape = RoundedCornerShape(20.dp),
        color = BgCardDark,
        border = androidx.compose.foundation.BorderStroke(1.dp, Brush.linearGradient(listOf(GoldPrimary, FlameOrange))),
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp)
            .shadow(16.dp, RoundedCornerShape(20.dp), spotColor = GoldPrimary.copy(alpha = 0.3f))
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = FlameOrange
                ) {
                    Text(
                        text = "BANNER SPESIAL",
                        color = Color.White,
                        fontWeight = FontWeight.Black,
                        fontSize = 10.sp,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                    )
                }

                Text(
                    text = "UR Pity: ${90 - pityUR} | SR Pity: ${10 - pitySR}",
                    color = GoldPrimary,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = "Holographic Mythic Portal",
                color = Color.White,
                fontWeight = FontWeight.Black,
                fontSize = 20.sp
            )
            Text(
                text = "Karakter Rate-Up: Gojō Satoru (UR) & Sung Jin-Woo (UR)",
                color = TextSecondary,
                fontSize = 12.sp
            )

            Spacer(modifier = Modifier.height(16.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Button(
                    onClick = onSinglePull,
                    colors = ButtonDefaults.buttonColors(containerColor = BgCardElevated),
                    shape = RoundedCornerShape(12.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, BorderGlass),
                    modifier = Modifier.weight(1f).height(44.dp)
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("1x Tarik", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                        Text("🪙 100 Koin", color = GoldPrimary, fontSize = 10.sp)
                    }
                }

                Button(
                    onClick = onMultiPull,
                    colors = ButtonDefaults.buttonColors(containerColor = GoldPrimary),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.weight(1f).height(44.dp)
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("10x Tarik", color = BgDarkMain, fontWeight = FontWeight.Black, fontSize = 12.sp)
                        Text("🪙 900 Koin (Diskon!)", color = BgDarkMain, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}
