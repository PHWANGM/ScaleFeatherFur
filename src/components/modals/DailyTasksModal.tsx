// src/components/modals/DailyTasksModal.tsx
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native"
import TaskCheckboxRow from "../TaskCheckboxRow"
import PrimaryButton from "../buttons/PrimaryButton"
import type { TaskStatus } from "../../lib/db/repos/tasks.repo"

type Palette = {
  card: string
  border: string
  text: string
  subText: string
}

type SyncState =
  | { status: "idle" }
  | { status: "syncing" }
  | { status: "ok"; ok: number; failed: number }
  | { status: "error"; message: string }

type Props = {
  visible: boolean
  onClose: () => void
  palette: Palette

  tasksLoading: boolean
  tasks: TaskStatus[]
  completedCount: number
  onToggleTask: (task: TaskStatus) => void

  // ✅ NEW: sync UI (optional but recommended)
  pendingCount?: number // outbox 未同步筆數
  syncState?: SyncState // 目前同步狀態
  onPressSync?: () => void // 手動同步按鈕（可選）
}

function SyncBar({
  palette,
  pendingCount = 0,
  syncState = { status: "idle" },
  onPressSync,
}: {
  palette: Palette
  pendingCount?: number
  syncState?: SyncState
  onPressSync?: () => void
}) {
  const baseTextColor = palette.subText
  const titleColor = palette.text

  let line1 = ""
  let line2 = ""

  if (syncState.status === "syncing") {
    line1 = "Syncing…"
    line2 = pendingCount > 0 ? `Pending ${pendingCount}` : "Checking outbox…"
  } else if (syncState.status === "ok") {
    line1 = `Synced ✅ (ok ${syncState.ok}, failed ${syncState.failed})`
    line2 = pendingCount > 0
      ? `Still pending ${pendingCount}`
      : "No pending outbox"
  } else if (syncState.status === "error") {
    line1 = "Sync failed ⚠️"
    line2 = syncState.message
  } else {
    line1 = pendingCount > 0
      ? `Pending outbox: ${pendingCount}`
      : "Outbox: 0 pending"
    line2 = "Will sync automatically when online"
  }

  return (
    <View style={[styles.syncBar, { borderColor: palette.border }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.syncTitle, { color: titleColor }]}>{line1}</Text>
        <Text
          style={[styles.syncSub, { color: baseTextColor }]}
          numberOfLines={2}
        >
          {line2}
        </Text>
      </View>

      {!!onPressSync && (
        <Pressable
          onPress={onPressSync}
          style={[styles.syncBtn, { borderColor: palette.border }]}
          hitSlop={8}
        >
          <Text style={[styles.syncBtnText, { color: titleColor }]}>Sync</Text>
        </Pressable>
      )}
    </View>
  )
}

export default function DailyTasksModal({
  visible,
  onClose,
  palette,
  tasksLoading,
  tasks,
  completedCount,
  onToggleTask,
  pendingCount = 0,
  syncState = { status: "idle" },
  onPressSync,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            { backgroundColor: "#ffffff", borderColor: palette.border },
          ]}
          onPress={() => {}}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: palette.text }]}>
              Daily Tasks
            </Text>
          </View>

          <Text style={[styles.sub, { color: palette.subText }]}>
            {completedCount}/{tasks.length} completed today
          </Text>

          {/* ✅ NEW: Sync status bar */}
          <View style={{ marginTop: 10 }}>
            <SyncBar
              palette={palette}
              pendingCount={pendingCount}
              syncState={syncState}
              onPressSync={onPressSync}
            />
          </View>

          <View style={styles.list}>
            {tasksLoading
              ? <ActivityIndicator />
              : tasks.length === 0
              ? <Text style={{ color: palette.subText }}>No tasks found.</Text>
              : (
                tasks.map((task) => (
                  <TaskCheckboxRow
                    key={task.key}
                    title={task.title}
                    description={task.description ?? undefined}
                    checked={task.completed}
                    points={task.points}
                    titleColor={palette.text}
                    onToggle={() => onToggleTask(task)}
                  />
                ))
              )}
          </View>

          <PrimaryButton title="Close" onPress={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "78%",
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontSize: 18, fontWeight: "700" },
  sub: { marginTop: 6, fontSize: 13 },
  list: { marginTop: 10 },

  // Sync bar
  syncBar: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  syncTitle: { fontSize: 13, fontWeight: "700" },
  syncSub: { marginTop: 2, fontSize: 12 },
  syncBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  syncBtnText: { fontSize: 12, fontWeight: "800" },
})
