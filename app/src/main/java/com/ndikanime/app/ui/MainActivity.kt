package com.ndikanime.app.ui

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.navigation.compose.rememberNavController
import com.ndikanime.app.data.storage.AuthManager
import com.ndikanime.app.presentation.navigation.NeforaNavGraph
import com.ndikanime.app.presentation.theme.NeforaTheme

class MainActivity : ComponentActivity() {

    private val authManager by lazy { AuthManager(this) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            NeforaTheme {
                val navController = rememberNavController()
                NeforaNavGraph(
                    navController = navController,
                    authManager = authManager
                )
            }
        }
    }
}
