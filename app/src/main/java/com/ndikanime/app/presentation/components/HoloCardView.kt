package com.ndikanime.app.presentation.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.ndikanime.app.core.CardModel
import com.ndikanime.app.presentation.theme.*

@Composable
fun HoloCardView(
    card: CardModel,
    modifier: Modifier = Modifier,
    isInteractive: Boolean = true,
    showDetails: Boolean = true,
    onClick: (() -> Unit)? = null
) {
    var rotationX by remember { mutableFloatStateOf(0f) }
    var rotationY by remember { mutableFloatStateOf(0f) }

    val infiniteTransition = rememberInfiniteTransition(label = "holo_shimmer")
    val shimmerOffset by infiniteTransition.animateFloat(
        initialValue = -300f,
        targetValue = 600f,
        animationSpec = infiniteRepeatable(
            animation = tween(2500, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "shimmer_offset"
    )

    val rarityColor = Color(card.rarity.colorHex)
    val elementColor = Color(card.element.colorHex)

    Box(
        modifier = modifier
            .graphicsLayer {
                this.rotationX = rotationX
                this.rotationY = rotationY
                cameraDistance = 14f * density
            }
            .then(
                if (isInteractive) {
                    Modifier.pointerInput(Unit) {
                        detectDragGestures(
                            onDragEnd = {
                                rotationX = 0f
                                rotationY = 0f
                            },
                            onDragCancel = {
                                rotationX = 0f
                                rotationY = 0f
                            },
                            onDrag = { change, dragAmount ->
                                change.consume()
                                rotationY = (rotationY + dragAmount.x * 0.15f).coerceIn(-25f, 25f)
                                rotationX = (rotationX - dragAmount.y * 0.15f).coerceIn(-25f, 25f)
                            }
                        )
                    }
                } else Modifier
            )
            .shadow(16.dp, RoundedCornerShape(16.dp), spotColor = rarityColor)
            .clip(RoundedCornerShape(16.dp))
            .background(BgCardElevated)
            .border(2.dp, Brush.linearGradient(listOf(rarityColor, elementColor, rarityColor.copy(alpha = 0.5f))), RoundedCornerShape(16.dp))
    ) {
        Column(
            modifier = Modifier.fillMaxSize()
        ) {
            // Image with Rarity & Element Badges
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
            ) {
                AsyncImage(
                    model = card.imageUrl,
                    contentDescription = card.name,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize()
                )

                // Holographic Specular Foil Layer
                Canvas(modifier = Modifier.fillMaxSize()) {
                    val rainbowBrush = Brush.linearGradient(
                        colors = listOf(
                            Color.Transparent,
                            Color(0x33FF007F),
                            Color(0x4400F5FF),
                            Color(0x44FFE600),
                            Color(0x3300FF66),
                            Color.Transparent
                        ),
                        start = Offset(shimmerOffset, shimmerOffset),
                        end = Offset(shimmerOffset + 180f, shimmerOffset + 180f)
                    )
                    drawRect(rainbowBrush)
                }

                // Top Rarity & CP Badges
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Surface(
                        shape = RoundedCornerShape(6.dp),
                        color = rarityColor,
                        shadowElevation = 4.dp
                    ) {
                        Text(
                            text = card.rarity.label,
                            color = Color.White,
                            fontWeight = FontWeight.Black,
                            fontSize = 12.sp,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                        )
                    }

                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = Color(0xCC000000),
                        border = androidx.compose.foundation.BorderStroke(1.dp, GoldPrimary.copy(alpha = 0.5f))
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                        ) {
                            Text(
                                text = "CP ${card.combatPower}",
                                color = GoldPrimary,
                                fontWeight = FontWeight.Bold,
                                fontSize = 11.sp
                            )
                        }
                    }
                }

                // Element badge at bottom left of image
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = Color(0xDD111115),
                    modifier = Modifier
                        .align(Alignment.BottomStart)
                        .padding(8.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 3.dp)
                    ) {
                        Text(text = card.element.iconRes, fontSize = 12.sp)
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = card.element.label,
                            color = elementColor,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            // Card Bottom Details
            if (showDetails) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(BgCardDark)
                        .padding(10.dp)
                ) {
                    Text(
                        text = card.name,
                        color = TextPrimary,
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        text = card.animeOrigin,
                        color = TextMuted,
                        fontSize = 11.sp,
                        maxLines = 1
                    )

                    Spacer(modifier = Modifier.height(6.dp))

                    // Stars
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        for (i in 1..5) {
                            Icon(
                                imageVector = Icons.Default.Star,
                                contentDescription = null,
                                tint = if (i <= card.stars) GoldPrimary else Color(0x33FFFFFF),
                                modifier = Modifier.size(13.dp)
                            )
                        }
                        Spacer(modifier = Modifier.weight(1f))
                        Text(
                            text = "Lv.${card.level}",
                            color = GoldDark,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    Spacer(modifier = Modifier.height(6.dp))

                    // Mini Stats Bar
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("HP: ${card.effectiveHp}", color = TextSecondary, fontSize = 10.sp)
                        Text("ATK: ${card.effectiveAtk}", color = TextSecondary, fontSize = 10.sp)
                        Text("DEF: ${card.effectiveDef}", color = TextSecondary, fontSize = 10.sp)
                    }
                }
            }
        }
    }
}
