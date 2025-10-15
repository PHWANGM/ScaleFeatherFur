import React from 'react';
import { View, Text, StatusBar, useColorScheme } from 'react-native';
import { Provider } from 'react-redux';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// ⬇️ 依你的實際路徑調整 store 與 RootNavigator 的 import
import { store } from './src/state/store';
import RootNavigator from './src/navigation/rootNavigator';

// ✅ 開關：true = 顯示 "It boots! ✅"，false = 正常進入 RootNavigator
const BOOT_TEST = false;

/** 簡單 Error Boundary：若有 JS 錯誤直接顯示在螢幕上，避免黑屏 */
class ErrorBoundary extends React.Component<React.PropsWithChildren, { error?: any }> {
  state = { error: undefined as any };
  componentDidCatch(error: any) { this.setState({ error }); }
  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, backgroundColor: '#fff', padding: 16, justifyContent: 'center' }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#C53030', marginBottom: 8 }}>
            JS Error
          </Text>
          <Text style={{ color: '#2D3748' }}>{String(this.state.error)}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

/** 最小測試畫面 */
function BootProbe() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
      <Text style={{ fontSize: 20 }}>It boots! ✅</Text>
    </View>
  );
}

export default function App() {
  const isDark = useColorScheme?.() === 'dark';

  // 簡單 theme（提供 StatusBar 背景色用）
  const theme = React.useMemo(
    () => ({ colors: { bg: isDark ? '#000' : '#fff' } }),
    [isDark]
  );

  const navTheme = isDark ? DarkTheme : DefaultTheme;

  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <NavigationContainer theme={navTheme}>
          <StatusBar
            barStyle={isDark ? 'light-content' : 'dark-content'}
            backgroundColor={theme.colors.bg}
          />
          <ErrorBoundary>
            {BOOT_TEST ? <BootProbe /> : <RootNavigator />}
          </ErrorBoundary>
        </NavigationContainer>
      </SafeAreaProvider>
    </Provider>
  );
}
