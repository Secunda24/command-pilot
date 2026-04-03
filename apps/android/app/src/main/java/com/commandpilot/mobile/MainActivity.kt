package com.commandpilot.mobile

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.commandpilot.mobile.ui.theme.CommandPilotTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            CommandPilotTheme {
                CommandPilotMobileApp()
            }
        }
    }
}
