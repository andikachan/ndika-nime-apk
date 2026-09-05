package com.ndikanime.app.presentation.screens.clan

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.VolunteerActivism
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

data class ClanModel(
    val id: String,
    val name: String,
    val motto: String,
    val leaderName: String,
    val level: Int,
    val membersCount: Int,
    val maxMembers: Int = 30,
    val icon: String = "🛡️"
)

@Composable
fun ClanScreen(
    navController: NavController,
    modifier: Modifier = Modifier
) {
    var myClan by remember { mutableStateOf<ClanModel?>(null) }
    var clanNotice by remember { mutableStateOf<String?>(null) }

    val availableClans = remember {
        mutableStateListOf(
            ClanModel("c1", "Shadow Monarchs", "Kekuatan mutlak dari kegelapan abadi.", "Sung_Jinwoo", 5, 28, 30, "👑"),
            ClanModel("c2", "Jujutsu High", "Mengusir kutukan dan menjaga harmoni.", "Gojo_Sensei", 4, 25, 30, "✨"),
            ClanModel("c3", "Straw Hat Fleet", "Mencari kebebasan dan petualangan sejati.", "Luffy_Captain", 6, 30, 30, "🏴‍☠️"),
            ClanModel("c4", "Demon Slayer Corps", "Bilah matahari pembasmi iblis.", "Tanjiro_Sun", 3, 18, 30, "⚔️")
        )
    }

    fun joinClan(clan: ClanModel) {
        myClan = clan
        SoundManager.playLevelUpSfx()
        clanNotice = "Selamat! Kamu telah resmi bergabung dengan Clan ${clan.name}!"
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
                    text = "GUILD & CLAN SYSTEM 🛡️",
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
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            if (clanNotice != null) {
                item {
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = GoldPrimary,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = clanNotice ?: "",
                            color = BgDarkMain,
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp,
                            modifier = Modifier.padding(12.dp)
                        )
                    }
                }
            }

            if (myClan != null) {
                item {
                    Surface(
                        shape = RoundedCornerShape(16.dp),
                        color = BgCardDark,
                        border = androidx.compose.foundation.BorderStroke(1.dp, GoldPrimary),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(myClan!!.icon, fontSize = 32.sp)
                                Spacer(modifier = Modifier.width(12.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text("Clan Kamu: ${myClan!!.name}", color = GoldPrimary, fontWeight = FontWeight.Black, fontSize = 16.sp)
                                    Text("Level ${myClan!!.level} • Anggota: ${myClan!!.membersCount}/${myClan!!.maxMembers}", color = TextSecondary, fontSize = 12.sp)
                                }
                            }
                            Spacer(modifier = Modifier.height(10.dp))
                            Text(myClan!!.motto, color = TextMuted, fontSize = 12.sp)
                            Spacer(modifier = Modifier.height(12.dp))
                            Button(
                                onClick = {
                                    SoundManager.playCoinSfx()
                                    clanNotice = "Kamu telah mendonasikan 100 Koin ke Guild Vault! +50 Guild EXP"
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = GoldPrimary),
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier.fillMaxWidth().height(38.dp)
                            ) {
                                Icon(Icons.Default.VolunteerActivism, contentDescription = null, tint = BgDarkMain)
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Donasi Harian (🪙 100 Koin)", color = BgDarkMain, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                    Spacer(modifier = Modifier.height(10.dp))
                }
            }

            item {
                Text("DAFTAR GUILD AKTIF", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 14.sp)
            }

            items(availableClans) { clan ->
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
                        Text(text = clan.icon, fontSize = 28.sp)
                        Spacer(modifier = Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(text = clan.name, color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                            Text(text = "Ketua: ${clan.leaderName} • Lv.${clan.level} • ${clan.membersCount}/${clan.maxMembers}", color = TextSecondary, fontSize = 11.sp)
                            Text(text = clan.motto, color = TextMuted, fontSize = 11.sp, maxLines = 1)
                        }
                        Button(
                            onClick = { joinClan(clan) },
                            enabled = myClan?.id != clan.id && clan.membersCount < clan.maxMembers,
                            colors = ButtonDefaults.buttonColors(containerColor = if (myClan?.id == clan.id) StatusSuccess else BgCardElevated),
                            shape = RoundedCornerShape(8.dp),
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 2.dp),
                            modifier = Modifier.height(32.dp)
                        ) {
                            Text(if (myClan?.id == clan.id) "Aktif" else "Gabung", fontSize = 11.sp)
                        }
                    }
                }
            }
        }
    }
}
