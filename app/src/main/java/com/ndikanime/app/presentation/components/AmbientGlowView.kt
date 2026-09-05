package com.ndikanime.app.presentation.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

@Composable
fun AmbientGlowView(
    dominantColor: Color = Color(0xFFD4A73C),
    modifier: Modifier = Modifier
) {
    val animatedColor by animateColorAsState(
        targetValue = dominantColor.copy(alpha = 0.45f),
        animationSpec = tween(durationMillis = 1000),
        label = "ambient_color"
    )

    Box(
        modifier = modifier
            .fillMaxSize()
            .blur(36.dp)
            .background(
                Brush.radialGradient(
                    colors = listOf(
                        animatedColor,
                        animatedColor.copy(alpha = 0.20f),
                        Color.Transparent
                    )
                )
            )
    )
}
