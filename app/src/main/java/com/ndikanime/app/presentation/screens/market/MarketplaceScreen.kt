package com.ndikanime.app.presentation.screens.market

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.ndikanime.app.core.CardModel
import com.ndikanime.app.core.CardRarity
import com.ndikanime.app.core.CardsCatalog
import com.ndikanime.app.core.SoundManager
import com.ndikanime.app.presentation.theme.*

data class MarketListing(
    val id: String,
    val sellerName: String,
    val card: CardModel,
    val priceCoins: Int
)

@Composable
fun MarketplaceScreen(
    navController: NavController,
    modifier: Modifier = Modifier
) {
    var userCoins by remember { mutableIntStateOf(3500) }
    var buyNotice by remember { mutableStateOf<String?>(null) }

    val listings = remember {
        mutableStateListOf(
            MarketListing("l1", "Kaiser99", CardsCatalog.ALL_CARDS[0].copy(), 2500),
            MarketListing("l2", "ShadowLord", CardsCatalog.ALL_CARDS[1].copy(), 2800),
            MarketListing("l3", "OtakuKing", CardsCatalog.ALL_CARDS[4].copy(), 1200),
            MarketListing("l4", "AnimeGirl77", CardsCatalog.ALL_CARDS[8].copy(), 600)
        )
    }

    fun buyListing(listing: MarketListing) {
        if (userCoins < listing.priceCoins) return
        userCoins -= listing.priceCoins
        listings.remove(listing)
        SoundManager.playCoinSfx()
        buyNotice = "Berhasil membeli ${listing.card.name}! Kartu ditambahkan ke Inventory."
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
                    text = "PASAR KARTU P2P 🛒",
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
                        text = "🪙 $userCoins",
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
            if (buyNotice != null) {
                item {
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = StatusSuccess,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = buyNotice ?: "",
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp,
                            modifier = Modifier.padding(12.dp)
                        )
                    }
                }
            }

            items(listings) { item ->
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = BgCardDark,
                    border = androidx.compose.foundation.BorderStroke(1.dp, BorderGlass),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Surface(
                            shape = RoundedCornerShape(6.dp),
                            color = Color(item.card.rarity.colorHex)
                        ) {
                            Text(
                                text = item.card.rarity.label,
                                color = Color.White,
                                fontWeight = FontWeight.Black,
                                fontSize = 11.sp,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }

                        Spacer(modifier = Modifier.width(12.dp))

                        Column(modifier = Modifier.weight(1f)) {
                            Text(text = item.card.name, color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                            Text(text = "Penjual: ${item.sellerName} • CP ${item.card.combatPower}", color = TextSecondary, fontSize = 11.sp)
                        }

                        Button(
                            onClick = { buyListing(item) },
                            enabled = userCoins >= item.priceCoins,
                            colors = ButtonDefaults.buttonColors(containerColor = GoldPrimary),
                            shape = RoundedCornerShape(10.dp),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 2.dp),
                            modifier = Modifier.height(34.dp)
                        ) {
                            Text("Beli 🪙 ${item.priceCoins}", color = BgDarkMain, fontWeight = FontWeight.Bold, fontSize = 11.sp)
                        }
                    }
                }
            }
        }
    }
}
