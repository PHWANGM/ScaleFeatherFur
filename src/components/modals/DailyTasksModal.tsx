// src/components/modals/DailyTasksModal.tsx
import React from 'react';
import { Modal, View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import TaskCheckboxRow from '../TaskCheckboxRow';
import PrimaryButton from '../buttons/PrimaryButton';
import type { TaskStatus } from '../../lib/db/repos/tasks.repo';

type Palette = {
  card: string;
  border: string;
  text: string;
  subText: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  palette: Palette;
  tasksLoading: boolean;
  tasks: TaskStatus[];
  completedCount: number;
  onToggleTask: (task: TaskStatus) => void;
};

export default function DailyTasksModal({
  visible,
  onClose,
  palette,
  tasksLoading,
  tasks,
  completedCount,
  onToggleTask,
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
          style={[styles.sheet, { backgroundColor: '#ffffff', borderColor: palette.border }]}
          onPress={() => {}}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: palette.text }]}>Daily Tasks</Text>
          </View>
          <Text style={[styles.sub, { color: palette.subText }]}>
            {completedCount}/{tasks.length} completed today
          </Text>
          <View style={styles.list}>
            {tasksLoading ? (
              <ActivityIndicator />
            ) : tasks.length === 0 ? (
              <Text style={{ color: palette.subText }}>No tasks found.</Text>
            ) : (
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
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '75%',
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 18, fontWeight: '700' },
  sub: { marginTop: 6, fontSize: 13 },
  list: { marginTop: 8 },
});
