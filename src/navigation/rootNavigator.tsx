// src/navigation/rootNavigator.tsx
import React from 'react';
import { View, Pressable, Platform } from 'react-native';
import {
  createBottomTabNavigator,
  type BottomTabBarButtonProps,
} from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import type { NavigatorScreenParams } from '@react-navigation/native';

// ===== Screens =====
import WelcomeScreen from '../screens/WelcomeScreen';
import HomeScreen from '../screens/HomeScreen';
import LogsScreen from '../screens/LogsScreen';
import PetForumScreen from '../screens/PetForumScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SpeciesEditorScreen from '../screens/SpeciesEditorScreen';
import PetSelectScreen from '../screens/PetSelectScreen';
import SpeciesNeedsScreen from '../screens/SpeciesNeedsScreen';
import PetsAddScreen from '../screens/PetsAddScreen';
import SettingsScreen from '../screens/SettingsScreen';

// carelog
import WeighScreen from '../screens/carelog/WeighScreen';
import FeedInputScreen from '../screens/carelog/FeedInputScreen';
import UVBLogScreen from '../screens/carelog/UVBLogScreen';
import CleanScreen from '../screens/carelog/CleanScreen';

// auth
import LoginScreen from '../screens/user/LoginScreen';
import SignUpScreen from '../screens/user/SignUpScreen';
import ForgotPasswordScreen from '../screens/user/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/user/ResetPasswordScreen';
import AuthCallbackScreen from '../screens/user/AuthCallbackScreen';

// ===== Types =====
export type RootTabParamList = {
  Home: undefined;
  Care: undefined;
  Plus: undefined;
  PetForum: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Welcome: undefined;

  // ✅ nested tabs params
  MainTabs: NavigatorScreenParams<RootTabParamList> | undefined;

  // ✅ Auth
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
  ResetPassword: undefined;
  AuthCallback: undefined;

  // ✅ Other screens
  SpeciesEditor: { key?: string } | undefined;
  PetSelect: undefined;
  SpeciesNeeds: { petId: string };
  PetsAdd: undefined;

  WeighScreen: { petId?: string } | undefined;
  FeedInputScreen: { petId: string } | undefined;

  Settings: undefined;
  UVBLogScreen: { petId: string } | undefined;
  CleanScreen: { petId: string } | undefined;

  // keep placeholder if you want
  TempMonitorScreen: { petId: string } | undefined;
};

// ===== Colors =====
const colors = {
  primary: '#38e07b',
  darkBg: '#122017',
};

// Placeholder screen for "+" tab
const NoopScreen: React.FC = () => <View style={{ flex: 1 }} />;

// Plus button
type PlusTabButtonProps = BottomTabBarButtonProps & {
  onPressCustom?: () => void;
};
function PlusTabButton({ style, accessibilityState, onPressCustom }: PlusTabButtonProps) {
  const selected = accessibilityState?.selected;
  return (
    <View style={[style, { alignItems: 'center' }]}>
      <Pressable
        onPress={onPressCustom}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        hitSlop={10}
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primary,
          marginTop: -18,
          shadowColor: '#000',
          shadowOpacity: 0.15,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 4,
        }}
      >
        <Feather name="plus" size={28} color={colors.darkBg} />
      </Pressable>
    </View>
  );
}

// ===== MainTabs =====
const Tab = createBottomTabNavigator<RootTabParamList>();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: 'rgba(0,0,0,0.5)',
        tabBarStyle: {
          height: Platform.select({ ios: 88, android: 64 }),
          paddingBottom: Platform.select({ ios: 24, android: 10 }),
          paddingTop: 10,
          borderTopWidth: 0.5,
          borderTopColor: 'rgba(0,0,0,0.08)',
          backgroundColor: '#fff',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => <Feather name="home" color={color} size={size} />,
        }}
      />

      <Tab.Screen
        name="Care"
        component={LogsScreen}
        options={{
          tabBarLabel: 'Care',
          tabBarIcon: ({ color, size }) => <Feather name="activity" color={color} size={size} />,
        }}
      />

      {/* Center + */}
      <Tab.Screen
        name="Plus"
        component={NoopScreen}
        options={({ navigation }) => ({
          tabBarLabel: '',
          tabBarButton: (p) => (
            <PlusTabButton
              {...p}
              onPressCustom={() => {
                const parent = navigation.getParent(); // RootStack
                parent?.navigate('PetSelect' as never);
              }}
            />
          ),
        })}
      />

      <Tab.Screen
        name="PetForum"
        component={PetForumScreen}
        options={{
          tabBarLabel: 'PetForum',
          tabBarIcon: ({ color, size }) => <Feather name="users" color={color} size={size} />,
        }}
      />

      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => <Feather name="user" color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  );
}

// ===== Root Stack =====
const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <Stack.Navigator initialRouteName="Welcome" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="MainTabs" component={MainTabs} />

      {/* ✅ Auth */}
      <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: true, title: '登入' }} />
      <Stack.Screen name="Signup" component={SignUpScreen} options={{ headerShown: true, title: '註冊' }} />
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{ headerShown: true, title: '忘記密碼' }}
      />
      <Stack.Screen
        name="ResetPassword"
        component={ResetPasswordScreen}
        options={{ headerShown: true, title: '重設密碼' }}
      />
      <Stack.Screen
        name="AuthCallback"
        component={AuthCallbackScreen}
        options={{ headerShown: true, title: 'Email 驗證' }}
      />

      {/* ✅ Other screens */}
      <Stack.Screen
        name="SpeciesEditor"
        component={SpeciesEditorScreen}
        options={{
          presentation: Platform.select({ ios: 'modal', android: 'modal' }),
          headerShown: false,
        }}
      />

      <Stack.Screen name="PetSelect" component={PetSelectScreen} options={{ headerShown: true, title: '選擇寵物' }} />
      <Stack.Screen name="SpeciesNeeds" component={SpeciesNeedsScreen} options={{ headerShown: true, title: '需求選單' }} />
      <Stack.Screen name="PetsAdd" component={PetsAddScreen} options={{ headerShown: true, title: '新增寵物' }} />

      <Stack.Screen name="WeighScreen" component={WeighScreen} options={{ headerShown: true, title: '體重記錄' }} />
      <Stack.Screen name="FeedInputScreen" component={FeedInputScreen} options={{ headerShown: true, title: '餵食記錄' }} />
      <Stack.Screen name="UVBLogScreen" component={UVBLogScreen} options={{ headerShown: true, title: 'UVB Log' }} />
      <Stack.Screen name="CleanScreen" component={CleanScreen} options={{ headerShown: true, title: '清潔記錄' }} />

      <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: true, title: '設定' }} />
    </Stack.Navigator>
  );
}
