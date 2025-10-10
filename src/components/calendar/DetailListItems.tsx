// src/components/DetailListItem.tsx
import React, { useMemo } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TouchableHighlight,
  View,
} from 'react-native';
import { useCallback } from 'react';
import {
  deleteCareLog,
  type CareLogRow,
  type CareLogType,
} from '../../lib/db/repos/care.logs'; // ← 依你的實際路徑調整

// ——— 顏色對應 care_logs 的 type ———
const typeColor = (t: CareLogType): string => {
  switch (t) {
    case 'feed':
      return '#FC3090';
    case 'calcium':
      return '#8D8DAA';
    case 'uvb_on':
      return '#2871C8';
    case 'uvb_off':
      return '#1DA8B1';
    case 'clean':
      return '#9B51E0';
    case 'weigh':
      return '#FFA500';
    default:
      return '#FFFFFF';
  }
};

// ——— 時間格式工具 ———
function formatHM(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  // 24h 格式 HH:mm
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function truncate(s: string | null | undefined, n = 30): string {
  if (!s) return '';
  return s.length > n ? `${s.slice(0, n)}...` : s;
}

export type DetailListItemProps = {
  item: CareLogRow;
  /** 刪除成功後的回呼（讓父層刷新列表等） */
  onDeleted?: (id: string) => void;
};

const DetailListItem: React.FC<DetailListItemProps> = ({ item, onDeleted }) => {
  const color = useMemo(() => typeColor(item.type), [item.type]);
  const isPastTime = useMemo(() => {
    const at = new Date(item.at).getTime();
    const now = Date.now();
    return !Number.isNaN(at) && at < now;
  }, [item.at]);

  const onPress = useCallback(() => {
    // 依 type 顯示重點資訊
    const time = `Time: ${formatHM(item.at)}`;
    const type = `\nActivity: ${item.type}`;
    const valueLine =
      item.type === 'feed'
        ? `\n\nFeed (g): ${item.value ?? 0}`
        : item.type === 'weigh'
        ? `\n\nWeight (kg): ${item.value ?? 0}`
        : ''; // 其他型別暫不顯示數值
    const note = item.note ? `\n\nNote: ${item.note}` : '';

    Alert.alert('Activity Detail', `${time}${type}${valueLine}${note}`, [
      { text: 'OK', style: 'cancel' },
    ]);
  }, [item]);

  const onLongPress = useCallback(() => {
    Alert.alert('Delete Activity', 'Are you sure you want to delete this activity?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'OK',
        onPress: async () => {
          try {
            await deleteCareLog(item.id);
            onDeleted?.(item.id);
          } catch (e) {
            console.warn('[DetailListItem] deleteCareLog failed:', e);
          }
        },
        style: 'destructive',
      },
    ]);
  }, [item.id, onDeleted]);

  return (
    <TouchableHighlight onPress={onPress} onLongPress={onLongPress} underlayColor="#FAFAFA">
      <View
        style={[
          styles.itemContainer,
          {
            borderLeftColor: color,
            borderRightColor: color,
            borderTopWidth: 2,
            borderRightWidth: 3,
            borderBottomWidth: 2,
            borderLeftWidth: 3,
            backgroundColor: isPastTime ? '#F2F2F2' : '#FFFFFF',
          },
        ]}
      >
        {isPastTime && (
          <View style={styles.itemPastDate}>
            <Text style={styles.itemPastDateText}>Time Passed</Text>
          </View>
        )}

        {/* 圖片區塊改為純色方塊徽章（依 type 上色） */}
        <View style={styles.iconBoxWrap}>
          <View style={[styles.iconBox, { backgroundColor: color }]} />
        </View>

        <View style={styles.itemTextContainer}>
          <View style={styles.itemTextUpper}>
            <Text style={styles.activityName}>{item.type}</Text>
            <Text style={styles.activityTime}>{formatHM(item.at)}</Text>
          </View>
          <View style={styles.itemTextLower}>
            <Text style={styles.activityNote}>{truncate(item.note)}</Text>
          </View>
        </View>
      </View>
    </TouchableHighlight>
  );
};

export default DetailListItem;

const styles = StyleSheet.create({
  itemContainer: {
    flexDirection: 'row',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 15,
    borderRadius: 10,
    borderWidth: 2,
    borderBottomColor: '#F8F8F8',
    borderTopColor: '#F8F8F8',
    borderRightColor: '#F8F8F8',
    marginBottom: 6,
    position: 'relative',
  },
  iconBoxWrap: {
    width: '17%',
  },
  iconBox: {
    borderRadius: 8,
    height: 35,
    width: 35,
  },
  itemTextContainer: {
    width: '83%',
    flexDirection: 'column',
    justifyContent: 'space-around',
  },
  itemTextUpper: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activityName: {
    fontSize: 16,
    fontWeight: 'bold',
    textTransform: 'capitalize', // feed → Feed（美觀）
  },
  activityTime: {
    fontSize: 12,
    color: '#4F4F4F',
  },
  itemTextLower: {
    width: '100%',
    flexDirection: 'row',
    marginTop: 2,
  },
  activityNote: {
    fontSize: 13,
    color: '#828282',
  },
  itemPastDate: {
    position: 'absolute',
    top: 0,
    right: '35%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6363',
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    zIndex: 1,
  },
  itemPastDateText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
});
