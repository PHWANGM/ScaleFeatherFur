// App.tsx
import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StatusBar, useColorScheme } from 'react-native';
import { Provider } from 'react-redux';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { store } from './src/state/store';
import { ensureDBReady } from './src/lib/db/bootstrap';
import RootNavigator from './src/navigation/rootNavigator';

export default function App() {
  const isDark = useColorScheme() === 'dark';

  const navTheme = isDark ? DarkTheme : DefaultTheme;

  const [ready, setReady] = useState(false);
  const [bootErr, setBootErr] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    // 8 秒逾時保險：避免卡死沒畫面
    const timeout = setTimeout(() => {
      if (!ready && !bootErr) {
        setBootErr(new Error('DB init timeout (>8s).'));
      }
    }, 8000);

    (async () => {
      try {
        console.log('[App] ensureDBReady start');
        await ensureDBReady();
        console.log('[App] ensureDBReady done');
        if (!cancelled) setReady(true);
      } catch (e: any) {
        console.error('DB init failed', e);
        if (!cancelled) setBootErr(e);
      } finally {
        clearTimeout(timeout);
      }
    })();

    return () => { cancelled = true; clearTimeout(timeout); };
  }, []);

  // ❗ 先顯示錯誤，其次才是 Loading
  if (bootErr) {
    return (
      <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:24, backgroundColor: isDark ? '#000' : '#fff' }}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <Text style={{ color: isDark ? '#fff' : '#000', fontWeight:'600', fontSize:16, textAlign:'center' }}>
          Database initialization failed
        </Text>
        <Text style={{ color: isDark ? '#ff6b6b' : '#c00', marginTop:8, textAlign:'center' }}>
          {(bootErr as Error)?.message ?? 'Unknown error'}
        </Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={{ flex:1, alignItems:'center', justifyContent:'center', backgroundColor:isDark ? '#000' : '#fff' }}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <ActivityIndicator size="large" />
        <Text style={{ color: isDark ? '#fff' : '#000', marginTop: 12 }}>
          Initializing database…
        </Text>
      </View>
    );
  }

  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <NavigationContainer theme={navTheme}>
          <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </Provider>
  );
}
