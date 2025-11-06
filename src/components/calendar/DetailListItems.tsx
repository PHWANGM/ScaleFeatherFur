// src/components/DetailListItems.tsx
import React, { useMemo, useCallback } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TouchableHighlight,
  View,
} from 'react-native';
import {
  deleteCareLog,
  type CareLogRow,
  type CareLogType,
} from '../../lib/db/repos/care.logs'; // ← 若你的結構是 src/components → src/lib，請改成 ../lib/...

// 顏色對應 care_logs.type
const typeColor = (t: CareLogType): string => {
  switch (t) {
    case 'feed':
      return '#FC3090';
    case 'calcium':
      return '#8D8DAA';
    case 'vitamin':
      return '#FFB703';
    case 'uvb_on':
      return '#2871C8';
    case 'uvb_off':
      return '#1DA8B1';
    case 'heat_on':
      return '#E76F51';
    case 'heat_off':
      return '#2A9D8F';
    case 'clean':
      return '#9B51E0';
    case 'weigh':
      return '#FFA500';
    default:
      return '#FFFFFF';
  }
};

// 時間格式（24h：HH:mm），無效 ISO 顯示 --:--
function formatHM(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function truncate(s: string | null | undefined, n = 30): string {
  if (!s) return '';
  return s.length > n ? `${s.slice(0, n)}...` : s;
}

export type DetailListItemProps = {
  item: CareLogRow;
  /** 刪除成功後的回呼（讓父層移除項目或重刷） */
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
    // 依 type 顯示重點資訊（注意：weight 的 value 已以 kg 存入）
    const time = `時間：${formatHM(item.at)}`;
    const typeLine = `\n類型：${item.type}`;
    const valueLine =
      item.type === 'feed'
        ? `\n\n餵食量 (g)：${item.value ?? 0}`
        : item.type === 'weigh'
        ? `\n\n體重 (kg)：${item.value ?? 0}`
        : '';
    const note = item.note ? `\n\n備註：${item.note}` : '';

    Alert.alert('紀錄細節', `${time}${typeLine}${valueLine}${note}`, [
      { text: 'OK', style: 'cancel' },
    ]);
  }, [item]);

  const onLongPress = useCallback(() => {
    Alert.alert('刪除紀錄', '確定要刪除此筆紀錄嗎？', [
      { text: '取消', style: 'cancel' },
      {
        text: '刪除',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCareLog(item.id);
            onDeleted?.(item.id);
          } catch (e) {
            console.warn('[DetailListItem] deleteCareLog failed:', e);
          }
        },
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

        {/* 類型色塊徽章 */}
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
    textTransform: 'capitalize', // feed → Feed
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
