// App.tsx
import { useEffect, useMemo, useState } from 'react';
import { View, Text, ActivityIndicator, StatusBar, useColorScheme } from 'react-native';
import { Provider } from 'react-redux';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import "./src/i18n";


import { store } from './src/state/store';
import { ensureDBReady } from './src/lib/db/bootstrap';
import RootNavigator from './src/navigation/rootNavigator';
import { navigationRef } from './src/navigation/navigationRef';

export default function App() {
  const isDark = useColorScheme() === 'dark';
  const navTheme = isDark ? DarkTheme : DefaultTheme;

  const [ready, setReady] = useState(false);
  const [bootErr, setBootErr] = useState<Error | null>(null);

  // ✅ React Navigation linking（正常情況會靠它自動導頁）
  const linking = useMemo(
    () => ({
      prefixes: [Linking.createURL('/'), 'scaleff://'],
      config: {
        screens: {
          ResetPassword: 'auth/reset',
          AuthCallback: 'auth/callback',
          ForgotPassword: 'auth/forgot',
          Login: 'auth/login',
          Signup: 'auth/signup',
        },
      },
    }),
    []
  );

  // ✅ 保底：不管 linking 成不成功，只要收到 auth/reset 就強制導到 ResetPassword
  useEffect(() => {
    const routeByUrl = (url: string) => {
      const parsed = Linking.parse(url);
      const path = parsed.path ?? '';
      console.log('[DeepLink] url=', url);
      console.log('[DeepLink] parsed path=', path, 'query=', parsed.queryParams);

      if (!navigationRef.isReady()) {
        console.log('[DeepLink] navigation not ready yet');
        return;
      }

      if (path === 'auth/reset') {
        navigationRef.navigate('ResetPassword');
      } else if (path === 'auth/callback') {
        navigationRef.navigate('AuthCallback');
      }
    };

    // App 冷啟動
    Linking.getInitialURL().then((url) => {
      console.log('[DeepLink] initialUrl=', url);
      if (url) routeByUrl(url);
    });

    // App 前景/背景切換時的事件
    const sub = Linking.addEventListener('url', ({ url }) => routeByUrl(url));

    return () => sub.remove();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!ready && !bootErr) setBootErr(new Error('DB init timeout (>8s).'));
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

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [ready, bootErr]);

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
        <NavigationContainer
          ref={navigationRef}
          theme={navTheme}
          linking={linking}
          onReady={() => console.log('[Nav] ready')}
          onStateChange={() => console.log('[Nav] state change')}
        >
          <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </Provider>
  );
}
