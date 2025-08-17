// src/screens/sales/Main.js
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons'; // Importamos los iconos

// Importa las pantallas
import HistorialSaleScreen from './HistorialSaleScreen';
import RegisterSaleScreen from './RegisterSaleScreen';
import EditSaleScreen from './EditSaleScreen';
import ProfileScreen from '../admin/ProfileScreen';

export default function Main() {
  const [currentScreen, setCurrentScreen] = useState('ventas');
  const [editSaleId, setEditSaleId] = useState(null);

  const menuItems = [
    // Ahora usamos el nombre del icono de MaterialIcons
    { id: 'ventas', label: 'Ventas', iconName: 'receipt-long' },
    { id: 'perfil', label: 'Perfil', iconName: 'person-outline' },
  ];

  const renderScreen = () => {
    switch (currentScreen) {
      case 'ventas':
        return (
          <HistorialSaleScreen
            onRegister={() => setCurrentScreen('registrar')}
            onEdit={(id) => {
              setEditSaleId(id);
              setCurrentScreen('editar');
            }}
          />
        );
      case 'registrar':
        return <RegisterSaleScreen setCurrentScreen={setCurrentScreen} />;
      case 'editar':
        return <EditSaleScreen saleId={editSaleId} setCurrentScreen={setCurrentScreen} />;
      case 'perfil':
        return <ProfileScreen />;
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar translucent backgroundColor="#f9fafb" barStyle="dark-content" />

      {/* Contenido dinámico */}
      <View style={styles.content}>
        {renderScreen()}
      </View>

      {/* Barra inferior rediseñada */}
      <View style={styles.navigation}>
        {menuItems.map((item) => {
          const isActive = currentScreen === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => setCurrentScreen(item.id)}
              style={styles.navItem}
            >
              <MaterialIcons 
                name={item.iconName} 
                size={26} 
                color={isActive ? styles.activeColor.color : styles.inactiveColor.color}
              />
              <Text style={[styles.navText, isActive && styles.navTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

// ==================== ESTILOS MEJORADOS ====================
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9fafb' },
  content: { flex: 1 },
  navigation: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    height: 70, // Altura más estándar
    paddingBottom: Platform.OS === 'ios' ? 20 : 0, // Espacio extra para iPhone
    // Sombra para el efecto flotante
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navText: {
    fontSize: 12,
    color: '#6b7280', // Color inactivo (gris)
    marginTop: 4,
  },
  navTextActive: {
    color: '#111827', // Color activo (oscuro)
    fontWeight: '600',
  },
  // Creamos objetos de estilo para los colores para que sean fáciles de cambiar
  activeColor: {
    color: '#111827', // Color primario oscuro
  },
  inactiveColor: {
    color: '#9ca3af', // Color secundario gris
  },
});