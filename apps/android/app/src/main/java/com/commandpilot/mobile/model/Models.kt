package com.commandpilot.mobile.model

enum class TaskStatus {
    Completed,
    AwaitingApproval,
    Running
}

data class QuickAction(
    val label: String,
    val command: String,
    val description: String
)

data class RecentTask(
    val title: String,
    val detail: String,
    val status: TaskStatus
)

data class ApprovalItem(
    val title: String,
    val detail: String,
    val target: String
)

data class DeviceState(
    val name: String,
    val status: String,
    val battery: Int
)
