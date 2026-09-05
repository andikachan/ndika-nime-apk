package com.ndikanime.app.presentation.screens.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.ndikanime.app.core.SoundManager
import com.ndikanime.app.data.model.UserProfile
import com.ndikanime.app.data.storage.AuthManager
import com.ndikanime.app.data.upstash.UpstashRepository
import com.ndikanime.app.presentation.navigation.Screen
import com.ndikanime.app.presentation.theme.*
import kotlinx.coroutines.launch
import java.util.UUID

@Composable
fun AuthScreen(
    navController: NavController,
    authManager: AuthManager,
    modifier: Modifier = Modifier
) {
    val coroutineScope = rememberCoroutineScope()
    var isRegisterMode by remember { mutableStateOf(false) }

    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var name by remember { mutableStateOf("") }
    var otpCode by remember { mutableStateOf("") }
    var showOtpField by remember { mutableStateOf(false) }

    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    fun handleInstantGuest() {
        val guestId = "guest_" + UUID.randomUUID().toString().take(8)
        val guestProfile = UserProfile(
            id = guestId,
            name = "Tamu_$guestId",
            email = "$guestId@nefora.app",
            level = 1,
            title = "Anime Newbie",
            coins = 1500
        )
        authManager.saveUser(guestProfile)
        SoundManager.playLevelUpSfx()
        navController.navigate(Screen.Home.route) {
            popUpTo(Screen.Auth.route) { inclusive = true }
        }
    }

    fun handleLogin() {
        if (email.isBlank() || password.isBlank()) {
            errorMessage = "Mohon isi email dan password."
            return
        }
        isLoading = true
        errorMessage = null
        coroutineScope.launch {
            try {
                val user = UpstashRepository.login(email.trim(), password)
                if (user != null) {
                    authManager.saveUser(user)
                    SoundManager.playLevelUpSfx()
                    navController.navigate(Screen.Home.route) {
                        popUpTo(Screen.Auth.route) { inclusive = true }
                    }
                } else {
                    errorMessage = "Email atau password salah."
                }
            } catch (e: Exception) {
                errorMessage = "Gagal login: ${e.localizedMessage}"
            } finally {
                isLoading = false
            }
        }
    }

    fun handleRegister() {
        if (email.isBlank() || password.isBlank() || name.isBlank()) {
            errorMessage = "Mohon lengkapi semua kolom pendaftaran."
            return
        }
        isLoading = true
        errorMessage = null
        coroutineScope.launch {
            try {
                val user = UpstashRepository.register(name.trim(), email.trim(), password)
                if (user != null) {
                    authManager.saveUser(user)
                    SoundManager.playLevelUpSfx()
                    navController.navigate(Screen.Home.route) {
                        popUpTo(Screen.Auth.route) { inclusive = true }
                    }
                } else {
                    errorMessage = "Email sudah terdaftar atau pendaftaran gagal."
                }
            } catch (e: Exception) {
                errorMessage = "Gagal mendaftar: ${e.localizedMessage}"
            } finally {
                isLoading = false
            }
        }
    }

    Scaffold(
        containerColor = BgDarkMain
    ) { paddingValues ->
        Box(
            modifier = modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(24.dp),
            contentAlignment = Alignment.Center
        ) {
            Surface(
                shape = RoundedCornerShape(24.dp),
                color = BgCardDark,
                border = androidx.compose.foundation.BorderStroke(1.dp, Brush.linearGradient(listOf(GoldPrimary, FlameOrange))),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "NEFORA REALM",
                        color = GoldPrimary,
                        fontWeight = FontWeight.Black,
                        fontSize = 22.sp,
                        letterSpacing = 2.sp
                    )
                    Text(
                        text = if (isRegisterMode) "Daftar Akun Petualang Baru" else "Masuk ke Dimensi Anime",
                        color = TextSecondary,
                        fontSize = 12.sp
                    )

                    Spacer(modifier = Modifier.height(20.dp))

                    if (isRegisterMode) {
                        OutlinedTextField(
                            value = name,
                            onValueChange = { name = it },
                            label = { Text("Nama Petualang") },
                            leadingIcon = { Icon(Icons.Default.Person, contentDescription = null, tint = GoldPrimary) },
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = GoldPrimary,
                                unfocusedBorderColor = BorderGlass,
                                focusedTextColor = TextPrimary,
                                unfocusedTextColor = TextPrimary
                            ),
                            modifier = Modifier.fillMaxWidth()
                        )
                        Spacer(modifier = Modifier.height(10.dp))
                    }

                    OutlinedTextField(
                        value = email,
                        onValueChange = { email = it },
                        label = { Text("Email") },
                        leadingIcon = { Icon(Icons.Default.Email, contentDescription = null, tint = GoldPrimary) },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = GoldPrimary,
                            unfocusedBorderColor = BorderGlass,
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )

                    Spacer(modifier = Modifier.height(10.dp))

                    OutlinedTextField(
                        value = password,
                        onValueChange = { password = it },
                        label = { Text("Password") },
                        visualTransformation = PasswordVisualTransformation(),
                        leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null, tint = GoldPrimary) },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = GoldPrimary,
                            unfocusedBorderColor = BorderGlass,
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )

                    if (errorMessage != null) {
                        Spacer(modifier = Modifier.height(10.dp))
                        Text(errorMessage ?: "", color = StatusError, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                    }

                    Spacer(modifier = Modifier.height(20.dp))

                    Button(
                        onClick = { if (isRegisterMode) handleRegister() else handleLogin() },
                        enabled = !isLoading,
                        colors = ButtonDefaults.buttonColors(containerColor = GoldPrimary),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth().height(46.dp)
                    ) {
                        Text(
                            text = if (isLoading) "MEMPROSES..." else if (isRegisterMode) "Daftar Sekarang" else "Masuk Akun",
                            color = BgDarkMain,
                            fontWeight = FontWeight.Black,
                            fontSize = 14.sp
                        )
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    // Instant Guest Mode (Zero barrier entry)
                    Button(
                        onClick = { handleInstantGuest() },
                        colors = ButtonDefaults.buttonColors(containerColor = BgCardElevated),
                        border = androidx.compose.foundation.BorderStroke(1.dp, BorderGlass),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth().height(44.dp)
                    ) {
                        Text("🚀 Masuk Instan Mode Tamu (Guest UUID)", color = GoldPrimary, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    Text(
                        text = if (isRegisterMode) "Sudah punya akun? Masuk di sini" else "Belum punya akun? Daftar gratis",
                        color = GoldPrimary,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.clickable { isRegisterMode = !isRegisterMode }
                    )
                }
            }
        }
    }
}
