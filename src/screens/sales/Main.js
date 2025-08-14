// src/screens/sales/Main.js
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Importa las pantallas
import HistorialSaleScreen from './HistorialSaleScreen';
import RegisterSaleScreen from './RegisterSaleScreen';
import EditSaleScreen from './EditSaleScreen';
import ProfileScreen from '../admin/ProfileScreen';

// Iconos personalizados
const IconVentas  = () => <Text>🧾</Text>;
const IconPerfil  = () => <Text>👤</Text>;

export default function Main() {
  const [currentScreen, setCurrentScreen] = useState('ventas');
  const [editSaleId, setEditSaleId] = useState(null);

  const menuItems = [
    { id: 'ventas', label: 'Ventas', icon: IconVentas },
    { id: 'perfil', label: 'Perfil', icon: IconPerfil },
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
    <SafeAreaView style={styles.safe} edges={['top','bottom']}>
      <StatusBar translucent backgroundColor="#fff" barStyle="dark-content" />

      {/* Contenido dinámico */}
      <View style={styles.content}>
        {renderScreen()}
      </View>

      {/* Barra inferior personalizada */}
      <View style={styles.navigation}>
        {menuItems.map((item) => {
          const isActive = currentScreen === item.id;
          const Icon = item.icon;
          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => setCurrentScreen(item.id)}
              style={styles.navItem}
            >
              <View style={[styles.navButtonContainer, isActive && styles.activeNavButtonContainer]}>
                <View style={styles.iconWrapper}>
                  <Icon />
                </View>
                <Text style={[styles.navText, isActive && styles.navTextActive]}>
                  {item.label}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1 },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 20,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: '#AFAFAF',
    backgroundColor: '#fff',
    height: 90,
    
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    maxWidth: '50%', // Solo 2 iconos ahora
    
    
    
  },
  navButtonContainer: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    width: '100%',
    maxWidth: '100%',
    borderRadius: 20
  },
  activeNavButtonContainer: {
    backgroundColor: '#E6E6E6',
  },
  iconWrapper: { marginBottom: 4 },
  navText: { fontSize: 12, color: '#000' },
  navTextActive: { fontWeight: 'bold' }
});
