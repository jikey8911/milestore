import React from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SettingsProvider } from './src/context/SettingsContext';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#020617" />
      <SettingsProvider>
        <NavigationContainer>
          <Stack.Navigator 
            initialRouteName="Dashboard"
            screenOptions={{
              headerStyle: { backgroundColor: '#0B1120' },
              headerTintColor: '#F8FAFC',
              headerTitleStyle: { fontWeight: 'bold' },
              contentStyle: { backgroundColor: '#020617' }
            }}
          >
            <Stack.Screen 
              name="Dashboard" 
              component={DashboardScreen} 
              options={{ headerShown: false }} 
            />
            <Stack.Screen 
              name="Settings" 
              component={SettingsScreen} 
              options={{ title: 'Configuración' }} 
            />
          </Stack.Navigator>
        </NavigationContainer>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
