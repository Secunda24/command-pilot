package com.commandpilot.mobile.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val commandPilotColors = darkColorScheme(
    primary = EchoBlue,
    secondary = EchoTeal,
    tertiary = EchoTeal,
    background = DeepNavy,
    surface = SurfaceNight,
    onPrimary = DeepNavy,
    onBackground = Mist,
    onSurface = Mist,
    onSurfaceVariant = Slate,
    primaryContainer = SurfaceNight
)

@Composable
fun CommandPilotTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = commandPilotColors,
        typography = CommandPilotTypography,
        content = content
    )
}
