// src/navigation/rootNavigator.tsx
import { useMemo } from "react"
import { Platform, Pressable, View } from "react-native"
import {
  type BottomTabBarButtonProps,
  createBottomTabNavigator,
} from "@react-navigation/bottom-tabs"
import {
  createNativeStackNavigator,
  type NativeStackNavigationOptions,
} from "@react-navigation/native-stack"
import { Feather } from "@expo/vector-icons"
import type { NavigatorScreenParams } from "@react-navigation/native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"

// ===== Screens =====
import WelcomeScreen from "../screens/WelcomeScreen"
import HomeScreen from "../screens/HomeScreen"
import LogsScreen from "../screens/LogsScreen"
import PetForumScreen from "../screens/PetForumScreen"
import ProfileScreen from "../screens/ProfileScreen"
import SpeciesEditorScreen from "../screens/SpeciesEditorScreen"
import PetSelectScreen from "../screens/PetSelectScreen"
import SpeciesNeedsScreen from "../screens/SpeciesNeedsScreen"
import PetsAddScreen from "../screens/PetsAddScreen"
import SettingsScreen from "../screens/SettingsScreen"

// ✅ NEW: Profile friends system screens
import ProfileFriendsScreen from "../screens/profile/ProfileFriendsScreen"
import ProfileMessagesScreen from "../screens/profile/ProfileMessagesScreen"
import ProfileMatchScreen from "../screens/profile/ProfileMatchScreen"
import ChatThreadScreen from "../screens/profile/ChatThreadScreen"

// ✅ NEW: My Posts screen
import ProfileMyPostsScreen from "../screens/profile/ProfileMyPostsScreen"

// carelog
import WeighScreen from "../screens/carelog/WeighScreen"
import FeedInputScreen from "../screens/carelog/FeedInputScreen"
import UVBLogScreen from "../screens/carelog/UVBLogScreen"
import CleanScreen from "../screens/carelog/CleanScreen"

// auth
import LoginScreen from "../screens/user/LoginScreen"
import SignUpScreen from "../screens/user/SignUpScreen"
import ForgotPasswordScreen from "../screens/user/ForgotPasswordScreen"
import ResetPasswordScreen from "../screens/user/ResetPasswordScreen"
import AuthCallbackScreen from "../screens/user/AuthCallbackScreen"

// ===== Types =====
export type RootTabParamList = {
  Home: undefined
  Care: undefined
  Plus: undefined
  PetForum: undefined
  Profile: undefined
}

export type RootStackParamList = {
  Welcome: undefined

  // ✅ nested tabs params
  MainTabs: NavigatorScreenParams<RootTabParamList> | undefined

  // ✅ Auth
  Login: undefined
  Signup: undefined
  ForgotPassword: undefined
  ResetPassword: undefined
  AuthCallback: undefined

  // ✅ Other screens
  SpeciesEditor: { key?: string } | undefined
  PetSelect: undefined
  SpeciesNeeds: { petId: string }
  PetsAdd: undefined

  WeighScreen: { petId?: string } | undefined
  FeedInputScreen: { petId: string } | undefined

  Settings: undefined
  UVBLogScreen: { petId: string } | undefined
  CleanScreen: { petId: string } | undefined

  // ✅ Friends system
  ProfileFriends: undefined
  ProfileMessages: undefined
  ProfileMatch: undefined

  // ✅ My posts
  ProfileMyPosts: undefined

  // ✅ Chat thread
  ChatThread: { conversationId: string; title?: string } | undefined

  // keep placeholder if you want
  TempMonitorScreen: { petId: string } | undefined
}

// ===== Colors =====
const colors = {
  primary: "#38e07b",
  darkBg: "#122017",
}

// Placeholder screen for "+" tab
const NoopScreen: React.FC = () => <View style={{ flex: 1 }} />

// ✅ helper: allow using i18n title for stack headers safely
function withHeaderTitle(titleKey: string): NativeStackNavigationOptions {
  // 這個 function 不能直接用 hook
  // 我們回傳 "function options" 給 Stack.Screen，再在裡面用 hook
  // → 所以下面 RootNavigator 會用 `options={() => ...}` 來套用
  return {
    headerShown: true,
    title: titleKey, // 先塞 key，真正 title 會在 options callback 內 t()
  }
}

// ===== MainTabs =====
const Tab = createBottomTabNavigator<RootTabParamList>()

function MainTabs() {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()

  const baseHeight = Platform.select({ ios: 88, android: 64 }) ?? 64
  const basePaddingBottom = Platform.select({ ios: 24, android: 10 }) ?? 10

  const tabBarStyle = useMemo(
    () => ({
      height: baseHeight + insets.bottom,
      paddingBottom: Math.max(insets.bottom, basePaddingBottom),
      paddingTop: 10,
      borderTopWidth: 0.5,
      borderTopColor: "rgba(0,0,0,0.08)",
      backgroundColor: "#fff",
    }),
    [baseHeight, basePaddingBottom, insets.bottom],
  )

  const liftMore = Math.min(Math.max(insets.bottom - 6, 0), 12) // 0~12
  const plusLift = -18 - liftMore

  type PlusTabButtonProps = BottomTabBarButtonProps & {
    onPressCustom?: () => void
  }

  function PlusTabButton(
    { style, accessibilityState, onPressCustom }: PlusTabButtonProps,
  ) {
    const selected = accessibilityState?.selected

    return (
      <View
        style={[
          style,
          {
            alignItems: "center",
            paddingBottom: Math.max(insets.bottom, 0),
          },
        ]}
      >
        <Pressable
          onPress={onPressCustom}
          accessibilityRole="button"
          accessibilityState={{ selected }}
          hitSlop={12}
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.primary,
            marginTop: plusLift,

            shadowColor: "#000",
            shadowOpacity: 0.15,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 2 },
            elevation: 4,
          }}
        >
          <Feather name="plus" size={28} color={colors.darkBg} />
        </Pressable>
      </View>
    )
  }

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: "rgba(0,0,0,0.5)",
        tabBarStyle,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: t("nav.tabs.home"),
          tabBarIcon: ({ color, size }) => (
            <Feather name="home" color={color} size={size} />
          ),
        }}
      />

      <Tab.Screen
        name="Care"
        component={LogsScreen}
        options={{
          tabBarLabel: t("nav.tabs.care"),
          tabBarIcon: ({ color, size }) => (
            <Feather name="activity" color={color} size={size} />
          ),
        }}
      />

      {/* Center + */}
      <Tab.Screen
        name="Plus"
        component={NoopScreen}
        options={({ navigation }) => ({
          tabBarLabel: "",
          tabBarButton: (p) => (
            <PlusTabButton
              {...p}
              onPressCustom={() => {
                const parent = navigation.getParent() // RootStack
                parent?.navigate("PetSelect" as never)
              }}
            />
          ),
        })}
      />

      <Tab.Screen
        name="PetForum"
        component={PetForumScreen}
        options={{
          tabBarLabel: t("nav.tabs.petForum"),
          tabBarIcon: ({ color, size }) => (
            <Feather name="users" color={color} size={size} />
          ),
        }}
      />

      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: t("nav.tabs.profile"),
          tabBarIcon: ({ color, size }) => (
            <Feather name="user" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  )
}

// ===== Root Stack =====
const Stack = createNativeStackNavigator<RootStackParamList>()

export default function RootNavigator() {
  const { t } = useTranslation()

  // ✅ helper: translate the "titleKey" we placed in withHeaderTitle()
  const translateTitle = (opt: NativeStackNavigationOptions) => ({
    ...opt,
    title: opt.title ? t(opt.title) : undefined,
  })

  return (
    <Stack.Navigator
      initialRouteName="Welcome"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="MainTabs" component={MainTabs} />

      {/* ✅ Auth */}
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={() => translateTitle(withHeaderTitle("nav.stack.login"))}
      />
      <Stack.Screen
        name="Signup"
        component={SignUpScreen}
        options={() => translateTitle(withHeaderTitle("nav.stack.signup"))}
      />
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={() =>
          translateTitle(withHeaderTitle("nav.stack.forgotPassword"))}
      />
      <Stack.Screen
        name="ResetPassword"
        component={ResetPasswordScreen}
        options={() =>
          translateTitle(withHeaderTitle("nav.stack.resetPassword"))}
      />
      <Stack.Screen
        name="AuthCallback"
        component={AuthCallbackScreen}
        options={() =>
          translateTitle(withHeaderTitle("nav.stack.authCallback"))}
      />

      {/* ✅ Friends system */}
      <Stack.Screen
        name="ProfileFriends"
        component={ProfileFriendsScreen}
        options={() =>
          translateTitle(withHeaderTitle("nav.stack.profileFriends"))}
      />
      <Stack.Screen
        name="ProfileMessages"
        component={ProfileMessagesScreen}
        options={() =>
          translateTitle(withHeaderTitle("nav.stack.profileMessages"))}
      />
      <Stack.Screen
        name="ProfileMatch"
        component={ProfileMatchScreen}
        options={() =>
          translateTitle(withHeaderTitle("nav.stack.profileMatch"))}
      />

      {/* ✅ My Posts */}
      <Stack.Screen
        name="ProfileMyPosts"
        component={ProfileMyPostsScreen}
        options={() =>
          translateTitle(withHeaderTitle("nav.stack.profileMyPosts"))}
      />

      {/* ✅ Chat thread */}
      <Stack.Screen
        name="ChatThread"
        component={ChatThreadScreen}
        options={({ route }) => {
          // 如果你想用對話標題（route.params.title），就優先顯示；否則用 i18n
          const dynamicTitle = route.params?.title?.trim()
          return {
            headerShown: true,
            title: dynamicTitle || t("nav.stack.chatThread"),
          }
        }}
      />

      {/* ✅ Other screens */}
      <Stack.Screen
        name="SpeciesEditor"
        component={SpeciesEditorScreen}
        options={{
          presentation: Platform.select({ ios: "modal", android: "modal" }),
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="PetSelect"
        component={PetSelectScreen}
        options={() => translateTitle(withHeaderTitle("nav.stack.petSelect"))}
      />
      <Stack.Screen
        name="SpeciesNeeds"
        component={SpeciesNeedsScreen}
        options={() =>
          translateTitle(withHeaderTitle("nav.stack.speciesNeeds"))}
      />
      <Stack.Screen
        name="PetsAdd"
        component={PetsAddScreen}
        options={() => translateTitle(withHeaderTitle("nav.stack.petsAdd"))}
      />

      <Stack.Screen
        name="WeighScreen"
        component={WeighScreen}
        options={() => translateTitle(withHeaderTitle("nav.stack.weigh"))}
      />
      <Stack.Screen
        name="FeedInputScreen"
        component={FeedInputScreen}
        options={() => translateTitle(withHeaderTitle("nav.stack.feed"))}
      />
      <Stack.Screen
        name="UVBLogScreen"
        component={UVBLogScreen}
        options={() => translateTitle(withHeaderTitle("nav.stack.uvb"))}
      />
      <Stack.Screen
        name="CleanScreen"
        component={CleanScreen}
        options={() => translateTitle(withHeaderTitle("nav.stack.clean"))}
      />

      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={() => translateTitle(withHeaderTitle("nav.stack.settings"))}
      />
    </Stack.Navigator>
  )
}
