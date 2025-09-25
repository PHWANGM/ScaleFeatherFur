import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import PetEditorScreen from '../screens/PetEditorScreen';
import PetDetailScreen from '../screens/PetDetailScreen';
import LogsScreen from '../screens/LogsScreen';
import ProductsScreen from '../screens/ProductsScreen';
import ArticlesScreen from '../screens/ArticlesScreen';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="PetEditor" component={PetEditorScreen} />
      <Stack.Screen name="PetDetail" component={PetDetailScreen} />
      <Stack.Screen name="Logs" component={LogsScreen} />
      <Stack.Screen name="Products" component={ProductsScreen} />
      <Stack.Screen name="Articles" component={ArticlesScreen} />
    </Stack.Navigator>
  );
}
