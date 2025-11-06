// src/navigation/rootNavigator.tsx
import React from 'react';
import { View, Pressable, Platform } from 'react-native';
import { createBottomTabNavigator, type BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';

// ===== Screens =====
import WelcomeScreen from '../screens/WelcomeScreen';
import HomeScreen from '../screens/HomeScreen';
import LogsScreen from '../screens/LogsScreen';
import CommunityScreen from '../screens/CommunityScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SpeciesEditorScreen from '../screens/SpeciesEditorScreen';
import PetSelectScreen from '../screens/PetSelectScreen';
import SpeciesNeedsScreen from '../screens/SpeciesNeedsScreen';
import PetsAddScreen from '../screens/PetsAddScreen';
import WeighScreen from '../screens/WeighScreen';

// ===== 型別 =====
export type RootStackParamList = {
  Welcome: undefined;
  MainTabs: undefined;
  SpeciesEditor: { key?: string } | undefined;
  PetSelect: undefined;
  SpeciesNeeds: { petId: string };
  PetsAdd: undefined;

  // ✅ 新增：體重記錄畫面（允許不帶或帶 petId）
  WeighScreen: { petId?: string } | undefined;

  // 預留
  UVBLogScreen?: { petId: string };
  HeatControlScreen?: { petId: string };
  FeedGreensScreen?: { petId: string };
  FeedInsectScreen?: { petId: string };
  FeedMeatScreen?: { petId: string };
  FeedFruitScreen?: { petId: string };
  CalciumPlainScreen?: { petId: string };
  CalciumD3Screen?: { petId: string };
  VitaminMultiScreen?: { petId: string };
  CleanScreen?: { petId: string };
  TempMonitorScreen?: { petId: string };
};

export type RootTabParamList = {
  Home: undefined;
  Care: undefined;
  Plus: undefined;
  Community: undefined;
  Profile: undefined;
};

// ===== 顏色 =====
const colors = {
  primary: '#38e07b',
  darkBg: '#122017',
};

// 佔位畫面：給中間＋使用
const NoopScreen: React.FC = () => <View style={{ flex: 1 }} />;

// 中間＋自訂按鈕
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

      {/* 中間＋：從 Tabs 導航到 RootStack 的 PetSelect */}
      <Tab.Screen
        name="Plus"
        component={NoopScreen}
        options={({ navigation }) => ({
          tabBarLabel: '',
          tabBarButton: (p) => (
            <PlusTabButton
              {...p}
              onPressCustom={() => {
                // 確保呼叫到最外層 Root Navigator
                navigation.getParent()?.navigate('PetSelect' as never);
              }}
            />
          ),
        })}
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

// ===== Root Stack =====
const Stack = createNativeStackNavigator<RootStackParamList>();
export default function RootNavigator() {
  return (
    <Stack.Navigator initialRouteName="Welcome" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen
        name="SpeciesEditor"
        component={SpeciesEditorScreen}
        options={{
          presentation: Platform.select({ ios: 'modal', android: 'modal' }),
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="PetSelect"
        component={PetSelectScreen}
        options={{ headerShown: true, title: '選擇寵物' }}
      />
      <Stack.Screen
        name="SpeciesNeeds"
        component={SpeciesNeedsScreen}
        options={{ headerShown: true, title: '需求選單' }}
      />
      <Stack.Screen
        name="PetsAdd"
        component={PetsAddScreen}
        options={{ headerShown: true, title: '新增寵物' }}
      />

      {/* ✅ 新增：體重記錄頁（與 navigate('WeighScreen', ...) 對齊） */}
      <Stack.Screen
        name="WeighScreen"
        component={WeighScreen}
        options={{ headerShown: true, title: '體重記錄' }}
      />
    </Stack.Navigator>
  );
}
