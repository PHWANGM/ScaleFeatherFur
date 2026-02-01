// src/navigation/navigationRef.ts
import { createNavigationContainerRef } from "@react-navigation/native"
import type { RootStackParamList } from "./rootNavigator"

export const navigationRef = createNavigationContainerRef<RootStackParamList>()
