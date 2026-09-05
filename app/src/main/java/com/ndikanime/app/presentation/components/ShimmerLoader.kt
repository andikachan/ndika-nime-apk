package com.ndikanime.app.presentation.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.ndikanime.app.presentation.theme.BgCardDark
import com.ndikanime.app.presentation.theme.BgCardElevated

@Composable
fun ShimmerCard(
    width: Dp = 140.dp,
    height: Dp = 200.dp,
    modifier: Modifier = Modifier
) {
    val transition = rememberInfiniteTransition(label = "shimmer_card")
    val translateAnim by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1000f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1200, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "shimmer_translate"
    )

    val shimmerBrush = Brush.linearGradient(
        colors = listOf(
            BgCardDark,
            BgCardElevated,
            Color(0x22FFFFFF),
            BgCardElevated,
            BgCardDark
        ),
        start = Offset(translateAnim - 200f, translateAnim - 200f),
        end = Offset(translateAnim, translateAnim)
    )

    Box(
        modifier = modifier
            .width(width)
            .height(height)
            .clip(RoundedCornerShape(12.dp))
            .background(shimmerBrush)
    )
}

@Composable
fun ShimmerRow(
    count: Int = 4,
    cardWidth: Dp = 140.dp,
    cardHeight: Dp = 200.dp,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        repeat(count) {
            ShimmerCard(width = cardWidth, height = cardHeight)
        }
    }
}
