import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Main from '../../screens/sales/Main'; // Importa correctamente el archivo Main.js

const Stack = createNativeStackNavigator();

export default function VendedorNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Main"
        component={Main} // Aquí también debe ser el mismo nombre
        options={{ headerShown: false }}
      />
      {/* Agrega más screens si lo necesitas */}
    </Stack.Navigator>
  );
}
