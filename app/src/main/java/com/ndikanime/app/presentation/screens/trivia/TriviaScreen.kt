package com.ndikanime.app.presentation.screens.trivia

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
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

data class TriviaQuestion(
    val id: Int,
    val question: String,
    val options: List<String>,
    val correctIndex: Int
)

@Composable
fun TriviaScreen(
    navController: NavController,
    modifier: Modifier = Modifier
) {
    val questions = listOf(
        TriviaQuestion(1, "Siapa nama mata terkutuk Gojō Satoru?", listOf("Sharingan", "Six Eyes (Rikugan)", "Byakugan", "Rinnegan"), 1),
        TriviaQuestion(2, "Apa nama pedang milik Asta di Black Clover?", listOf("Demon Slayer Sword", "Zangetsu", "Elucidator", "Tensa Zangetsu"), 0),
        TriviaQuestion(3, "Berapa jumlah Dragon Ball yang dibutuhkan untuk memanggil Shenron?", listOf("5", "6", "7", "8"), 2),
        TriviaQuestion(4, "Siapa Pemburu Solo Leveling terkuat peringkat S di Korea Selatan?", listOf("Cha Hae-In", "Choi Jong-In", "Baek Yoon-Ho", "Sung Jin-Woo"), 3),
        TriviaQuestion(5, "Apa makanan favorit Monkey D. Luffy?", listOf("Daging", "Ramen", "Onigiri", "Takoyaki"), 0)
    )

    var currentQuestionIndex by remember { mutableIntStateOf(0) }
    var score by remember { mutableIntStateOf(0) }
    var selectedOption by remember { mutableStateOf<Int?>(null) }
    var isAnswered by remember { mutableStateOf(false) }
    var isCompleted by remember { mutableStateOf(false) }

    val currentQuestion = questions.getOrNull(currentQuestionIndex)

    fun pickAnswer(idx: Int) {
        if (isAnswered) return
        selectedOption = idx
        isAnswered = true
        if (idx == currentQuestion?.correctIndex) {
            score += 100
            SoundManager.playCoinSfx()
        } else {
            SoundManager.playDefeatSfx()
        }
    }

    fun nextQuestion() {
        if (currentQuestionIndex < questions.size - 1) {
            currentQuestionIndex++
            selectedOption = null
            isAnswered = false
        } else {
            isCompleted = true
            SoundManager.playVictorySfx()
        }
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
                    text = "ANIME TRIVIA QUIZ ❓",
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
                        text = "Skor: $score",
                        color = GoldPrimary,
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                    )
                }
            }
        }
    ) { paddingValues ->
        Box(
            modifier = modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp),
            contentAlignment = Alignment.Center
        ) {
            if (isCompleted) {
                Surface(
                    shape = RoundedCornerShape(20.dp),
                    color = BgCardDark,
                    border = androidx.compose.foundation.BorderStroke(1.dp, GoldPrimary),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text("🎉", fontSize = 48.sp)
                        Spacer(modifier = Modifier.height(10.dp))
                        Text("KUIS SELESAI!", color = GoldPrimary, fontWeight = FontWeight.Black, fontSize = 20.sp)
                        Spacer(modifier = Modifier.height(6.dp))
                        Text("Total Skor: $score Poin", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        Text("Hadiah Koin: +${score / 2} Koin! 🪙", color = FlameOrange, fontSize = 13.sp)
                        Spacer(modifier = Modifier.height(20.dp))
                        Button(
                            onClick = { navController.popBackStack() },
                            colors = ButtonDefaults.buttonColors(containerColor = GoldPrimary),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Text("Selesai & Ambil Koin", color = BgDarkMain, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            } else if (currentQuestion != null) {
                Column(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = "Pertanyaan ${currentQuestionIndex + 1} dari ${questions.size}",
                        color = GoldPrimary,
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    Surface(
                        shape = RoundedCornerShape(16.dp),
                        color = BgCardDark,
                        border = androidx.compose.foundation.BorderStroke(1.dp, BorderGlass),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = currentQuestion.question,
                            color = TextPrimary,
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp,
                            lineHeight = 22.sp,
                            modifier = Modifier.padding(18.dp)
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    currentQuestion.options.forEachIndexed { index, optionText ->
                        val isPicked = selectedOption == index
                        val isCorrect = index == currentQuestion.correctIndex

                        val btnColor = when {
                            !isAnswered -> BgCardElevated
                            isCorrect -> StatusSuccess
                            isPicked -> StatusError
                            else -> BgCardElevated
                        }

                        Surface(
                            shape = RoundedCornerShape(14.dp),
                            color = btnColor,
                            border = androidx.compose.foundation.BorderStroke(1.dp, BorderGlass),
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 5.dp)
                                .clickable { pickAnswer(index) }
                        ) {
                            Text(
                                text = optionText,
                                color = if (isAnswered && (isCorrect || isPicked)) Color.White else TextPrimary,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 14.sp,
                                modifier = Modifier.padding(14.dp)
                            )
                        }
                    }

                    if (isAnswered) {
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(
                            onClick = { nextQuestion() },
                            colors = ButtonDefaults.buttonColors(containerColor = GoldPrimary),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth().height(44.dp)
                        ) {
                            Text("Pertanyaan Berikutnya ➡️", color = BgDarkMain, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}
