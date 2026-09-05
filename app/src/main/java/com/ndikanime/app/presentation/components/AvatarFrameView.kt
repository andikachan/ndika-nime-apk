package com.ndikanime.app.presentation.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.ndikanime.app.presentation.theme.*

@Composable
fun AvatarFrameView(
    avatarUrl: String?,
    level: Int = 1,
    frameType: String? = null,
    auraType: String? = null,
    size: Dp = 56.dp,
    showLevelBadge: Boolean = true,
    modifier: Modifier = Modifier
) {
    val infiniteTransition = rememberInfiniteTransition(label = "aura_pulse")
    val auraScale by infiniteTransition.animateFloat(
        initialValue = 1.0f,
        targetValue = 1.15f,
        animationSpec = infiniteRepeatable(
            animation = tween(1400, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "aura_scale"
    )

    val frameGradient = when {
        frameType == "rainbow" || level >= 100 -> Brush.sweepGradient(listOf(Color.Red, Color.Yellow, Color.Green, Color.Cyan, Color.Magenta, Color.Red))
        frameType == "fire" || level >= 75 -> Brush.linearGradient(listOf(FlameOrange, FlameAccent, Color.Yellow))
        frameType == "gold" || level >= 50 -> Brush.linearGradient(listOf(GoldPrimary, GoldDark, GoldAccent))
        frameType == "silver" || level >= 25 -> Brush.linearGradient(listOf(Color(0xFFE2E8F0), Color(0xFF94A3B8), Color(0xFFCBD5E1)))
        else -> Brush.linearGradient(listOf(Color(0xFFCD7F32), Color(0xFF8B4513)))
    }

    val auraColors = when (auraType) {
        "saiyan" -> listOf(Color(0x66FFD700), Color(0x22FFA500), Color.Transparent)
        "shadow" -> listOf(Color(0x66A855F7), Color(0x226B21A8), Color.Transparent)
        "cursed" -> listOf(Color(0x66EF4444), Color(0x22991B1B), Color.Transparent)
        else -> null
    }

    Box(
        contentAlignment = Alignment.Center,
        modifier = modifier.size(size + 14.dp)
    ) {
        // Animated Aura Halo
        if (auraColors != null) {
            Box(
                modifier = Modifier
                    .size(size + 12.dp)
                    .scale(auraScale)
                    .clip(CircleShape)
                    .background(Brush.radialGradient(auraColors))
            )
        }

        // Outer Frame Border
        Box(
            modifier = Modifier
                .size(size + 6.dp)
                .shadow(8.dp, CircleShape)
                .clip(CircleShape)
                .background(frameGradient)
                .padding(3.dp),
            contentAlignment = Alignment.Center
        ) {
            // Avatar Image
            AsyncImage(
                model = if (!avatarUrl.isNullOrBlank()) avatarUrl else "https://api.dicebear.com/7.x/bottts/png?seed=$level",
                contentDescription = "Avatar",
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .fillMaxSize()
                    .clip(CircleShape)
                    .background(BgCardDark)
            )
        }

        // Level Badge at bottom
        if (showLevelBadge) {
            Surface(
                shape = CircleShape,
                color = BgDarkMain,
                border = androidx.compose.foundation.BorderStroke(1.dp, GoldPrimary),
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .offset(x = (-2).dp, y = (-2).dp)
            ) {
                Text(
                    text = "$level",
                    color = GoldPrimary,
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Black,
                    modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp)
                )
            }
        }
    }
}
