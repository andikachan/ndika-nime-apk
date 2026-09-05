package com.ndikanime.app.presentation.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

data class DanmakuItem(
    val id: Long,
    val text: String,
    val color: Color = Color.White,
    val lane: Int = 0,
    val speedMs: Int = 6000
)

@Composable
fun DanmakuOverlay(
    danmakuList: List<DanmakuItem>,
    modifier: Modifier = Modifier,
    opacity: Float = 0.9f
) {
    val configuration = LocalConfiguration.current
    val screenWidthPx = with(LocalDensity.current) { configuration.screenWidthDp.dp.toPx() }

    Box(modifier = modifier.fillMaxSize()) {
        danmakuList.forEach { item ->
            key(item.id) {
                DanmakuItemView(
                    item = item,
                    screenWidthPx = screenWidthPx,
                    opacity = opacity
                )
            }
        }
    }
}

@Composable
private fun DanmakuItemView(
    item: DanmakuItem,
    screenWidthPx: Float,
    opacity: Float
) {
    val offsetX = remember { Animatable(screenWidthPx) }

    LaunchedEffect(item.id) {
        offsetX.animateTo(
            targetValue = -500f,
            animationSpec = tween(
                durationMillis = item.speedMs,
                easing = LinearEasing
            )
        )
    }

    val laneOffsetY = (item.lane % 5) * 28 + 12

    Text(
        text = item.text,
        color = item.color.copy(alpha = opacity),
        fontSize = 13.sp,
        fontWeight = FontWeight.Bold,
        style = TextStyle(
            shadow = Shadow(
                color = Color(0xCC000000),
                blurRadius = 4f
            )
        ),
        modifier = Modifier
            .offset(
                x = with(LocalDensity.current) { offsetX.value.toDp() },
                y = laneOffsetY.dp
            )
    )
}
