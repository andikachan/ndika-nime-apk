package com.ndikanime.app.presentation.screens.tournament

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.EmojiEvents
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
import com.ndikanime.app.presentation.theme.*

data class TournamentMatch(
    val id: String,
    val fighterA: String,
    val fighterB: String,
    val oddsA: Float,
    val oddsB: Float,
    var betPlacedOn: String? = null
)

@Composable
fun ColosseumScreen(
    navController: NavController,
    modifier: Modifier = Modifier
) {
    var userCoins by remember { mutableIntStateOf(2000) }
    var betNotice by remember { mutableStateOf<String?>(null) }

    val matches = remember {
        mutableStateListOf(
            TournamentMatch("m1", "Gojō Satoru (UR)", "Rimuru Tempest (UR)", 1.85f, 2.10f),
            TournamentMatch("m2", "Sung Jin-Woo (UR)", "Gilgamesh (UR)", 1.95f, 1.95f),
            TournamentMatch("m3", "Monkey D. Luffy (SSR)", "Naruto Uzumaki (SSR)", 1.70f, 2.30f),
            TournamentMatch("m4", "Ichigo Kurosaki (SSR)", "Frieren (SSR)", 1.80f, 2.15f)
        )
    }

    fun placeBet(match: TournamentMatch, fighter: String) {
        if (userCoins < 200 || match.betPlacedOn != null) return
        userCoins -= 200
        match.betPlacedOn = fighter
        SoundManager.playCoinSfx()
        betNotice = "Taruhan 200 Koin dipasang pada $fighter! Semoga menang!"
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
                    text = "TOURNAMENT COLOSSEUM 🏆",
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
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            item {
                Text(
                    text = "BRACKET BABAK PEREMPAT FINAL",
                    color = GoldPrimary,
                    fontWeight = FontWeight.Black,
                    fontSize = 14.sp
                )
            }

            if (betNotice != null) {
                item {
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = GoldPrimary,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = betNotice ?: "",
                            color = BgDarkMain,
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp,
                            modifier = Modifier.padding(12.dp)
                        )
                    }
                }
            }

            items(matches) { match ->
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = BgCardDark,
                    border = androidx.compose.foundation.BorderStroke(1.dp, BorderGlass),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(text = match.fighterA, color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 13.sp, modifier = Modifier.weight(1f))
                            Text(text = "VS", color = FlameOrange, fontWeight = FontWeight.Black, fontSize = 12.sp)
                            Text(text = match.fighterB, color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 13.sp, modifier = Modifier.weight(1f), textAlign = androidx.compose.ui.text.style.TextAlign.End)
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Button(
                                onClick = { placeBet(match, match.fighterA) },
                                enabled = match.betPlacedOn == null,
                                colors = ButtonDefaults.buttonColors(containerColor = if (match.betPlacedOn == match.fighterA) StatusSuccess else BgCardElevated),
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier.weight(1f)
                            ) {
                                Text("Pilih (${match.oddsA}x)", fontSize = 11.sp)
                            }

                            Button(
                                onClick = { placeBet(match, match.fighterB) },
                                enabled = match.betPlacedOn == null,
                                colors = ButtonDefaults.buttonColors(containerColor = if (match.betPlacedOn == match.fighterB) StatusSuccess else BgCardElevated),
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier.weight(1f)
                            ) {
                                Text("Pilih (${match.oddsB}x)", fontSize = 11.sp)
                            }
                        }
                    }
                }
            }
        }
    }
}
