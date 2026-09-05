package com.ndikanime.app.presentation.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.scale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlin.random.Random

data class FloatingParticle(
    val id: Long,
    val emoji: String,
    val startX: Float,
    val targetX: Float,
    val targetY: Float
)

@Composable
fun ParticleBurst(
    particles: List<FloatingParticle>,
    modifier: Modifier = Modifier
) {
    Box(modifier = modifier.fillMaxSize()) {
        particles.forEach { p ->
            key(p.id) {
                SingleFloatingParticle(p)
            }
        }
    }
}

@Composable
private fun SingleFloatingParticle(particle: FloatingParticle) {
    val animProgress = remember { Animatable(0f) }

    LaunchedEffect(particle.id) {
        animProgress.animateTo(
            targetValue = 1f,
            animationSpec = tween(1200, easing = FastOutSlowInEasing)
        )
    }

    val currentX = particle.startX + (particle.targetX - particle.startX) * animProgress.value
    val currentY = 0f - (250f * animProgress.value)
    val alpha = (1f - animProgress.value).coerceIn(0f, 1f)
    val scale = (0.6f + animProgress.value * 0.8f).coerceIn(0.6f, 1.4f)

    Text(
        text = particle.emoji,
        fontSize = 28.sp,
        modifier = Modifier
            .offset(x = currentX.dp, y = currentY.dp)
            .scale(scale)
            .alpha(alpha)
    )
}
