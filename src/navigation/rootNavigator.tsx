// src/navigation/rootNavigator.tsx
import React from 'react';
import { Text, View, Pressable, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';

// Screens
import WelcomeScreen from '../screens/WelcomeScreen';
import HomeScreen from '../screens/HomeScreen';
import LogsScreen from '../screens/LogsScreen';
import PetEditorScreen from '../screens/PetEditorScreen';
import CommunityScreen from '../screens/CommunityScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SpeciesEditorScreen from '../screens/SpeciesEditorScreen'; // 新增的物種編輯器

// ===== 型別 =====
export type RootStackParamList = {
  Welcome: undefined;           // 全螢幕覆蓋
  MainTabs: undefined;          // 底部五頁
  SpeciesEditor: { key?: string } | undefined; // ★ 新增：可帶 key 進編輯模式
};

export type RootTabParamList = {
  Home: undefined;
  Care: undefined;      // Logs
  Plus: undefined;      // PetEditor（目前放在中間 tab）
  Community: undefined;
  Profile: undefined;
};

// ===== 顏色 =====
const colors = {
  primary: '#38e07b',
  darkBg: '#122017',
  lightBg: '#f6f8f7',
  text: '#0a0a0a',
};

// ===== MainTabs（底部五頁）=====
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

      {/* 中間 +，客製化大按鈕 */}
      <Tab.Screen
        name="Plus"
        component={PetEditorScreen}
        options={{
          tabBarLabel: '',
          tabBarButton: (p) => <PlusTabButton {...p} />,
        }}
      />

      <Tab.Screen
        name="Community"
        component={CommunityScreen}
        options={{
          tabBarLabel: 'Community',
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

// ===== RootStack（外層）=====
const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <Stack.Navigator initialRouteName="Welcome" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="MainTabs" component={MainTabs} />

      {/* ★ 新增：SpeciesEditor 註冊到 RootStack（可被子層畫面 navigate 到） */}
      <Stack.Screen
        name="SpeciesEditor"
        component={SpeciesEditorScreen}
        options={{
          presentation: Platform.select({ ios: 'modal', android: 'modal' }), // 或 'fullScreenModal'
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
}

// 在 MainTabs 外定義一個客製化按鈕
function PlusTabButton({ onPress, style, accessibilityState }: BottomTabBarButtonProps) {
  const selected = accessibilityState?.selected;
  return (
    <View style={[style, { alignItems: 'center' }]}>
      <Pressable
        onPress={onPress}
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
        <Text style={{ fontSize: 28, lineHeight: 28, color: colors.darkBg }}>＋</Text>
        {/* 或使用圖示：<Feather name="plus" size={28} color={colors.darkBg} /> */}
      </Pressable>
    </View>
  );
}
