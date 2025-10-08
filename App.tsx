// App.tsx
import 'react-native-gesture-handler'; // 建議置頂且僅匯入一次
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, StatusBar, useColorScheme } from 'react-native';
import { Provider } from 'react-redux';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
  Theme,
} from '@react-navigation/native';

import { runMigrations } from './src/lib/db/migrate';
import RootNavigator from './src/navigation/rootNavigator'; // 下面第2節會示範如何加入 Welcome
import { store } from './src/state/store';
import { theme } from './src/styles/theme'; // 你自己的顏色系統（沿用即可）

export default function App() {
  const [ready, setReady] = useState(false);
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  useEffect(() => {
    (async () => {
      try {
        await runMigrations(); // ex: 跑 V1__init.sql 等
      } catch (e) {
        console.error('Migration failed', e);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.bg,
        }}
      >
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // 以系統深淺色為基底，再覆蓋成你自家 theme 色票
  const base = isDark ? DarkTheme : DefaultTheme;
  const navTheme: Theme = {
    ...base,
    colors: {
      ...base.colors,
      primary: theme.colors.primary,
      background: theme.colors.bg,
      card: theme.colors.card,
      text: theme.colors.text,
      border: theme.colors.border,
      notification: theme.colors.accent,
    },
  };

  return (
    <Provider store={store}>
      <NavigationContainer theme={navTheme}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <RootNavigator />
      </NavigationContainer>
    </Provider>
  );
}
