package com.commandpilot.mobile

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.commandpilot.mobile.data.DemoData
import com.commandpilot.mobile.model.TaskStatus

private data class NavItem(val title: String, val icon: ImageVector)

@Composable
fun CommandPilotMobileApp() {
    val items = listOf(
        NavItem("Home", Icons.Default.Home),
        NavItem("Command", Icons.AutoMirrored.Filled.Chat),
        NavItem("Alerts", Icons.Default.Notifications),
        NavItem("Approvals", Icons.Default.Security),
        NavItem("Settings", Icons.Default.Settings)
    )
    var selected by remember { mutableStateOf(0) }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        bottomBar = {
            NavigationBar {
                items.forEachIndexed { index, item ->
                    NavigationBarItem(
                        selected = index == selected,
                        onClick = { selected = index },
                        icon = { Icon(item.icon, contentDescription = item.title) },
                        label = { Text(item.title) }
                    )
                }
            }
        }
    ) { padding ->
        Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            when (selected) {
                0 -> HomeScreen(padding)
                1 -> CommandScreen(padding)
                2 -> NotificationsScreen(padding)
                3 -> ApprovalsScreen(padding)
                else -> SettingsScreen(padding)
            }
        }
    }
}

@Composable
private fun HomeScreen(padding: PaddingValues) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(padding)
            .padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item { HeroCard() }
        item { SectionTitle("Quick Actions", "One-tap commands for Echo") }
        items(DemoData.quickActions) { action ->
            GlowCard {
                Text(action.label, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(6.dp))
                Text(action.description, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(10.dp))
                Text(action.command, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary)
            }
        }
        item { SectionTitle("Recent Tasks", "Desktop and phone execution history") }
        items(DemoData.recentTasks) { task ->
            GlowCard {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(task.title, style = MaterialTheme.typography.titleMedium)
                    Text(task.status.name, color = statusColor(task.status))
                }
                Spacer(Modifier.height(6.dp))
                Text(task.detail, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
private fun CommandScreen(padding: PaddingValues) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(padding)
            .padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            GlowCard {
                Text("Echo is listening", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(8.dp))
                Text("Say or type a command, then Echo will route it to Windows or Android.")
                Spacer(Modifier.height(16.dp))
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(18.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant)
                        .padding(16.dp)
                ) {
                    Text("Voice input placeholder for v1 local/system speech support")
                }
            }
        }
        item { SectionTitle("Conversation", "Short, calm updates from Echo") }
        items(listOf(
            "You: Echo, open my work setup",
            "Echo: Done. I've opened your work setup.",
            "You: Echo, run invoice summary",
            "Echo: That action needs approval before I continue."
        )) { line ->
            GlowCard { Text(line) }
        }
    }
}

@Composable
private fun NotificationsScreen(padding: PaddingValues) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(padding)
            .padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item { SectionTitle("Notifications", "Everything Echo has sent to mobile") }
        items(DemoData.notifications) { notification ->
            GlowCard { Text(notification) }
        }
    }
}

@Composable
private fun ApprovalsScreen(padding: PaddingValues) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(padding)
            .padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item { SectionTitle("Approvals", "Sensitive actions always pause visibly") }
        items(DemoData.approvals) { approval ->
            GlowCard {
                Text(approval.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(6.dp))
                Text(approval.detail, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(10.dp))
                Text("Target: ${approval.target}", style = MaterialTheme.typography.bodySmall)
                Spacer(Modifier.height(12.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedButton(onClick = { }) { Text("Deny") }
                    OutlinedButton(onClick = { }) { Text("Approve") }
                }
            }
        }
    }
}

@Composable
private fun SettingsScreen(padding: PaddingValues) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(padding)
            .padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item { SectionTitle("Settings", "Voice, pairing, and trusted-device state") }
        item {
            GlowCard {
                Text("Assistant", style = MaterialTheme.typography.titleMedium)
                Spacer(Modifier.height(8.dp))
                Text("Name: Echo\nVoice: Local/system enabled\nTone: Calm futuristic")
            }
        }
        item {
            GlowCard {
                Text("Paired Device", style = MaterialTheme.typography.titleMedium)
                Spacer(Modifier.height(8.dp))
                Text("${DemoData.deviceState.name} · ${DemoData.deviceState.status} · ${DemoData.deviceState.battery}% battery")
            }
        }
    }
}

@Composable
private fun HeroCard() {
    GlowCard {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text("Echo", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
                Spacer(Modifier.height(8.dp))
                Text("CommandPilot is synced with your desktop.", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(8.dp))
                Text("Calm, private control over your PC workflows and approval prompts.")
            }
            Box(
                modifier = Modifier
                    .clip(CircleShape)
                    .background(
                        Brush.radialGradient(
                            listOf(
                                MaterialTheme.colorScheme.primary,
                                MaterialTheme.colorScheme.primaryContainer
                            )
                        )
                    )
                    .padding(22.dp)
            ) {
                Icon(Icons.AutoMirrored.Filled.Chat, contentDescription = null, tint = MaterialTheme.colorScheme.onPrimary)
            }
        }
    }
}

@Composable
private fun GlowCard(content: @Composable Column.() -> Unit) {
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        shape = RoundedCornerShape(24.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 10.dp)
    ) {
        Column(modifier = Modifier.padding(18.dp), content = content)
    }
}

@Composable
private fun SectionTitle(title: String, subtitle: String) {
    Column {
        Text(title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(4.dp))
        Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun statusColor(status: TaskStatus) = when (status) {
    TaskStatus.Completed -> MaterialTheme.colorScheme.primary
    TaskStatus.AwaitingApproval -> MaterialTheme.colorScheme.tertiary
    TaskStatus.Running -> MaterialTheme.colorScheme.secondary
}
