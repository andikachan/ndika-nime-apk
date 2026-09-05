package com.ndikanime.app.presentation.navigation

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import androidx.navigation.compose.currentBackStackEntryAsState
import com.ndikanime.app.presentation.theme.*

data class BottomNavItem(
    val title: String,
    val route: String,
    val selectedIcon: ImageVector,
    val unselectedIcon: ImageVector
)

val BOTTOM_NAV_ITEMS = listOf(
    BottomNavItem("Beranda", Screen.Home.route, Icons.Filled.Home, Icons.Outlined.Home),
    BottomNavItem("Jelajah", Screen.Explore.route, Icons.Filled.Explore, Icons.Outlined.Explore),
    BottomNavItem("Gacha", Screen.Gacha.route, Icons.Filled.AutoAwesome, Icons.Outlined.AutoAwesome),
    BottomNavItem("Komik", Screen.Komik.route, Icons.Filled.MenuBook, Icons.Outlined.MenuBook),
    BottomNavItem("Profil", Screen.Profile.createRoute("me"), Icons.Filled.Person, Icons.Outlined.Person)
)

@Composable
fun NeforaBottomBar(
    navController: NavController,
    modifier: Modifier = Modifier
) {
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    // Hide bottom bar on full-screen modes like Watch & Reader
    val isFullscreen = currentRoute?.startsWith("watch/") == true || currentRoute?.startsWith("reader/") == true
    if (isFullscreen) return

    Surface(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 10.dp)
            .shadow(20.dp, RoundedCornerShape(24.dp), spotColor = GoldPrimary.copy(alpha = 0.25f)),
        shape = RoundedCornerShape(24.dp),
        color = BgCardDark.copy(alpha = 0.95f),
        border = androidx.compose.foundation.BorderStroke(1.dp, BorderGlass)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 6.dp, horizontal = 4.dp),
            horizontalArrangement = Arrangement.SpaceAround,
            verticalAlignment = Alignment.CenterVertically
        ) {
            BOTTOM_NAV_ITEMS.forEach { item ->
                val isSelected = currentRoute == item.route ||
                        (item.route.startsWith("profile/") && currentRoute?.startsWith("profile/") == true)

                val tintColor by animateColorAsState(
                    targetValue = if (isSelected) GoldPrimary else TextMuted,
                    label = "nav_tint"
                )

                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                    modifier = Modifier
                        .clip(RoundedCornerShape(16.dp))
                        .clickable {
                            if (!isSelected) {
                                navController.navigate(item.route) {
                                    popUpTo(Screen.Home.route) { saveState = true }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            }
                        }
                        .padding(horizontal = 12.dp, vertical = 6.dp)
                ) {
                    Icon(
                        imageVector = if (isSelected) item.selectedIcon else item.unselectedIcon,
                        contentDescription = item.title,
                        tint = tintColor,
                        modifier = Modifier.size(24.dp)
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = item.title,
                        color = tintColor,
                        fontSize = 10.sp,
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                    )
                }
            }
        }
    }
}
