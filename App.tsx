// App.tsx
import 'react-native-gesture-handler'; // ← 使用 react-navigation 建議在入口檔最上方
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, StatusBar } from 'react-native';
import { Provider } from 'react-redux';
import { NavigationContainer, DefaultTheme, Theme } from '@react-navigation/native';

import { runMigrations } from './src/lib/db/migrate';
import RootNavigator from './src/navigation/rootNavigator';
import { store } from './src/state/store';
import { theme } from './src/styles/theme';
import 'react-native-gesture-handler';


export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await runMigrations(); // 跑 V1__init.sql 等
      } catch (e) {
        console.error('Migration failed', e);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  if (!ready) {
    return (
      <View style={{
        flex: 1, alignItems: 'center', justifyContent: 'center',
        backgroundColor: theme.colors.bg,
      }}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // 自訂 Navigation 顏色，貼合我們的 theme
  const navTheme: Theme = {
    ...DefaultTheme,
    dark: true,
    colors: {
      ...DefaultTheme.colors,
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
        <StatusBar barStyle="light-content" />
        <RootNavigator />
      </NavigationContainer>
    </Provider>
  );
}
