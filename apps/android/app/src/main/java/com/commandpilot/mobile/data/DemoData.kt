package com.commandpilot.mobile.data

import com.commandpilot.mobile.model.ApprovalItem
import com.commandpilot.mobile.model.DeviceState
import com.commandpilot.mobile.model.QuickAction
import com.commandpilot.mobile.model.RecentTask
import com.commandpilot.mobile.model.TaskStatus

object DemoData {
    val quickActions = listOf(
        QuickAction("Work Setup", "Echo, open my work setup", "Launch the work stack"),
        QuickAction("Priorities", "Echo, show me today's priorities", "Summarize the day"),
        QuickAction("PromptPilot", "Echo, open PromptPilot Studio", "Open the local workspace"),
        QuickAction("Content Mode", "Echo, start content mode", "Start the creative bundle")
    )

    val recentTasks = listOf(
        RecentTask("Open my work setup", "PromptPilot Studio, Gmail, and Client Files are open.", TaskStatus.Completed),
        RecentTask("Run invoice summary", "Awaiting approval before the script can continue.", TaskStatus.AwaitingApproval),
        RecentTask("Show me today's priorities", "Summary pushed to Android and desktop.", TaskStatus.Completed),
        RecentTask("Run bank export workflow", "Finance workflow staged and waiting.", TaskStatus.Running)
    )

    val approvals = listOf(
        ApprovalItem("Run invoice summary", "Sensitive script launch requires confirmation.", "Windows + Android"),
        ApprovalItem("Run bank export workflow", "Finance export flow needs approval.", "Windows + Android")
    )

    val notifications = listOf(
        "Echo: Morning work setup is ready.",
        "Echo: Invoice summary is waiting for approval.",
        "Echo: Android pairing is healthy."
    )

    val deviceState = DeviceState(
        name = "Echo Companion Pixel",
        status = "Paired",
        battery = 86
    )
}
