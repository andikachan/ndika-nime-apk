package com.ndikanime.app.presentation.screens.story

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import coil.compose.AsyncImage
import com.ndikanime.app.presentation.components.AvatarFrameView
import com.ndikanime.app.presentation.theme.*

data class UserStory(
    val id: String,
    val authorName: String,
    val authorAvatar: String?,
    val authorLevel: Int,
    val imageUrl: String,
    val caption: String
)

@Composable
fun StoryViewerScreen(
    navController: NavController,
    storyId: String,
    modifier: Modifier = Modifier
) {
    val stories = listOf(
        UserStory("1", "Gojō_Domain", null, 99, "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800", "Domain Expansion: Infinite Void 🌌"),
        UserStory("2", "Solo_Shadow", null, 88, "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800", "Arise. Shadow Army siap bertempur!"),
        UserStory("3", "Frieren_Spell", null, 95, "https://images.unsplash.com/photo-1563089145-599997674d42?w=800", "Belajar sihir kuno pembuat ladang bunga 🌸")
    )

    var currentStoryIndex by remember { mutableIntStateOf(0) }
    val progress = remember { Animatable(0f) }

    val currentStory = stories.getOrNull(currentStoryIndex) ?: stories.first()

    LaunchedEffect(currentStoryIndex) {
        progress.snapTo(0f)
        progress.animateTo(
            targetValue = 1f,
            animationSpec = tween(5000, easing = LinearEasing)
        )
        if (currentStoryIndex < stories.size - 1) {
            currentStoryIndex++
        } else {
            navController.popBackStack()
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color.Black)
            .pointerInput(Unit) {
                detectTapGestures(
                    onTap = { offset ->
                        if (offset.x > size.width / 2) {
                            if (currentStoryIndex < stories.size - 1) currentStoryIndex++
                            else navController.popBackStack()
                        } else {
                            if (currentStoryIndex > 0) currentStoryIndex--
                        }
                    }
                )
            }
    ) {
        // Story Media
        AsyncImage(
            model = currentStory.imageUrl,
            contentDescription = currentStory.caption,
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize()
        )

        // Gradient Scrims
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        listOf(Color(0x99000000), Color.Transparent, Color(0xBB000000))
                    )
                )
        )

        // Top Segment Progress Bars
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.TopCenter)
                .padding(top = 16.dp, start = 12.dp, end = 12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                stories.forEachIndexed { idx, _ ->
                    val segProgress = when {
                        idx < currentStoryIndex -> 1f
                        idx == currentStoryIndex -> progress.value
                        else -> 0f
                    }
                    LinearProgressIndicator(
                        progress = { segProgress },
                        modifier = Modifier
                            .weight(1f)
                            .height(3.dp)
                            .clip(RoundedCornerShape(2.dp)),
                        color = GoldPrimary,
                        trackColor = Color(0x55FFFFFF)
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Author Info Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                AvatarFrameView(avatarUrl = currentStory.authorAvatar, level = currentStory.authorLevel, size = 36.dp)
                Spacer(modifier = Modifier.width(8.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(currentStory.authorName, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    Text("Cerita 24 Jam", color = TextSecondary, fontSize = 10.sp)
                }
                IconButton(onClick = { navController.popBackStack() }) {
                    Icon(Icons.Default.Close, contentDescription = "Close", tint = Color.White)
                }
            }
        }

        // Bottom Caption & Quick Reactions
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.BottomCenter)
                .padding(16.dp)
        ) {
            Text(
                text = currentStory.caption,
                color = Color.White,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold
            )

            Spacer(modifier = Modifier.height(14.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                listOf("🔥", "❤️", "😍", "👏", "⚡").forEach { emoji ->
                    Surface(
                        shape = CircleShape,
                        color = Color(0x66000000),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0x33FFFFFF)),
                        modifier = Modifier.clickable { navController.popBackStack() }
                    ) {
                        Text(text = emoji, fontSize = 20.sp, modifier = Modifier.padding(8.dp))
                    }
                }
            }
        }
    }
}
