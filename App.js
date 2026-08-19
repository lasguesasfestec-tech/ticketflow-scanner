import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet } from 'react-native';
import LoginScreen from './src/screens/LoginScreen';
import ScannerScreen from './src/screens/ScannerScreen';

export default function App() {
  const [sesion, setSesion] = useState(null); // { acceso, localidadesPermitidas }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      {sesion ? (
        <ScannerScreen
          acceso={sesion.acceso}
          localidadesPermitidas={sesion.localidadesPermitidas}
          onSalir={() => setSesion(null)}
        />
      ) : (
        <LoginScreen
          onAccesoValidado={(acceso, localidadesPermitidas) => setSesion({ acceso, localidadesPermitidas })}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0B24' },
});
