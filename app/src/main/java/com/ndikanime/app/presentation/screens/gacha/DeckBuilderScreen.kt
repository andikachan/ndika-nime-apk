package com.ndikanime.app.presentation.screens.gacha

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
import androidx.compose.material.icons.filled.Close
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
import com.ndikanime.app.core.CardModel
import com.ndikanime.app.core.CardsCatalog
import com.ndikanime.app.presentation.components.HoloCardView
import com.ndikanime.app.presentation.theme.*

@Composable
fun DeckBuilderScreen(
    navController: NavController,
    modifier: Modifier = Modifier
) {
    val allCards = remember { CardsCatalog.ALL_CARDS.map { it.copy() } }
    val currentDeck = remember { mutableStateListOf<CardModel>().apply { addAll(allCards.take(5)) } }

    val totalTeamCp = currentDeck.sumOf { it.combatPower }

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
                    text = "Susunan Deck Tim (5 Kartu)",
                    color = TextPrimary,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    modifier = Modifier.weight(1f)
                )
                Surface(
                    shape = RoundedCornerShape(10.dp),
                    color = BgCardDark,
                    border = androidx.compose.foundation.BorderStroke(1.dp, GoldPrimary)
                ) {
                    Text(
                        text = "Total CP: $totalTeamCp",
                        color = GoldPrimary,
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                    )
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
            // Active 5-Card Deck Slot Carousel
            item {
                Text(
                    text = "DECK UTAMA AKTIF (${currentDeck.size}/5)",
                    color = GoldPrimary,
                    fontWeight = FontWeight.Black,
                    fontSize = 14.sp
                )
                Spacer(modifier = Modifier.height(10.dp))

                LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    items(currentDeck) { card ->
                        Box(modifier = Modifier.width(130.dp).height(210.dp)) {
                            HoloCardView(
                                card = card,
                                isInteractive = false,
                                showDetails = false,
                                modifier = Modifier.fillMaxSize()
                            )
                            IconButton(
                                onClick = { currentDeck.remove(card) },
                                modifier = Modifier
                                    .align(Alignment.TopEnd)
                                    .size(28.dp)
                                    .background(Color(0xCC000000), RoundedCornerShape(8.dp))
                            ) {
                                Icon(Icons.Default.Close, contentDescription = "Remove", tint = StatusError, modifier = Modifier.size(16.dp))
                            }
                        }
                    }
                }
                Spacer(modifier = Modifier.height(24.dp))
            }

            // Available Cards to Swap
            item {
                Text(
                    text = "PILIH KARTU DARI INVENTORY",
                    color = TextPrimary,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp
                )
                Spacer(modifier = Modifier.height(12.dp))
            }

            items(allCards) { card ->
                val isInDeck = currentDeck.any { it.id == card.id }
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = BgCardDark,
                    border = androidx.compose.foundation.BorderStroke(1.dp, if (isInDeck) GoldPrimary else BorderGlass),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp)
                        .clickable {
                            if (isInDeck) {
                                currentDeck.removeAll { it.id == card.id }
                            } else if (currentDeck.size < 5) {
                                currentDeck.add(card)
                            }
                        }
                ) {
                    Row(
                        modifier = Modifier.padding(10.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Surface(
                            shape = RoundedCornerShape(6.dp),
                            color = Color(card.rarity.colorHex)
                        ) {
                            Text(
                                text = card.rarity.label,
                                color = Color.White,
                                fontWeight = FontWeight.Black,
                                fontSize = 11.sp,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }

                        Spacer(modifier = Modifier.width(12.dp))

                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = card.name,
                                color = TextPrimary,
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp
                            )
                            Text(
                                text = "Element: ${card.element.label} • CP ${card.combatPower}",
                                color = TextSecondary,
                                fontSize = 11.sp
                            )
                        }

                        if (isInDeck) {
                            Surface(
                                shape = RoundedCornerShape(8.dp),
                                color = GoldPrimary
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Check,
                                    contentDescription = null,
                                    tint = BgDarkMain,
                                    modifier = Modifier.size(24.dp).padding(4.dp)
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
