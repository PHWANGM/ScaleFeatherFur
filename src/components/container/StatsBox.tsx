import React from 'react';
import { StyleSheet, Text, View, Dimensions } from 'react-native';

// ====== 型別定義 ======
type StatsBoxProps = {
  backgroundC: string;   // 背景顏色
  textC: string;         // 文字顏色
  activity: string;      // 顯示的活動名稱 (Feed, Calcium, UVB, Weight ...)
  data: string | number; // 數值資料
  small: string;         // 單位文字 (g, x, h, kg ...)
};

const StatsBox: React.FC<StatsBoxProps> = ({
  backgroundC,
  textC,
  activity,
  data,
  small,
}) => {
  return (
    <View
      style={[
        styles.boxContainer,
        { backgroundColor: backgroundC.trim() },
      ]}
    >
      <Text
        style={[
          styles.boxTextName,
          { color: textC.trim() },
        ]}
      >
        {activity}
      </Text>

      <View style={styles.textContainer}>
        <Text
          style={[
            styles.boxText,
            { color: textC.trim() },
          ]}
        >
          {data}
        </Text>
        <Text
          style={[
            styles.textSmall,
            { color: textC.trim() },
          ]}
        >
          {small}
        </Text>
      </View>
    </View>
  );
};

export default StatsBox;

// ====== 樣式定義 ======
const styles = StyleSheet.create({
  boxContainer: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    width: Dimensions.get('window').width /2.5,
    height: 75,
    margin: '1%',
    padding: 10,
  },
  textContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  boxText: {
    fontSize: 40,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  textSmall: {
    height: '100%',
    fontSize: 13,
    marginLeft: 2,
    top: 26,
  },
  boxTextName: {
    left: '-20%',
    fontSize: 15,
  },
});
