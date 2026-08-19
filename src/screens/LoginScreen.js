import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { validarAccesoPuerta } from '../lib/sync';
import { guardarSesionAcceso, leerSesionAcceso } from '../lib/db';

export default function LoginScreen({ onAccesoValidado }) {
  const [codigo, setCodigo] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Si ya se guardó una sesión antes (aunque no haya internet ahora),
    // se entra directo — no tiene sentido pedir el código de nuevo cada
    // vez que se abre la app en medio de un evento sin señal.
    (async () => {
      const sesion = await leerSesionAcceso();
      if (sesion) {
        onAccesoValidado(sesion.acceso, sesion.localidadesPermitidas);
        return;
      }
      setCargando(false);
    })();
  }, []);

  async function entrar() {
    if (!codigo.trim()) return;
    setError('');

    const estado = await NetInfo.fetch();
    if (!estado.isConnected) {
      setError('Necesitas internet la primera vez que entras en cada evento — después ya funciona sin señal.');
      return;
    }

    setCargando(true);
    try {
      const resultado = await validarAccesoPuerta(codigo);
      if (!resultado) {
        setError('Código inválido o revocado.');
        setCargando(false);
        return;
      }
      await guardarSesionAcceso(resultado.acceso, resultado.localidadesPermitidas);
      onAccesoValidado(resultado.acceso, resultado.localidadesPermitidas);
    } catch (e) {
      setError('Error de conexión: ' + e.message);
      setCargando(false);
    }
  }

  if (cargando) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2E9EF5" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>TICKET <Text style={{ color: '#2E9EF5' }}>FLOW</Text></Text>
      <Text style={styles.sub}>Escáner de entrada</Text>

      <TextInput
        style={styles.input}
        placeholder="Código de acceso"
        placeholderTextColor="#8D91BD"
        autoCapitalize="characters"
        value={codigo}
        onChangeText={setCodigo}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity style={styles.btn} onPress={entrar}>
        <Text style={styles.btnText}>Entrar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0B24', alignItems: 'center', justifyContent: 'center', padding: 24 },
  logo: { fontSize: 28, fontWeight: '900', color: '#F5F6FA', marginBottom: 4 },
  sub: { color: '#8D91BD', marginBottom: 32 },
  input: {
    width: '100%', backgroundColor: '#12143A', borderWidth: 1, borderColor: '#2A2D5C',
    borderRadius: 12, padding: 16, color: '#F5F6FA', fontSize: 16, marginBottom: 12, textAlign: 'center',
  },
  error: { color: '#E74C3C', marginBottom: 12, textAlign: 'center' },
  btn: { width: '100%', backgroundColor: '#2E9EF5', borderRadius: 12, padding: 16, alignItems: 'center' },
  btnText: { color: '#0A0B24', fontWeight: '800', fontSize: 16 },
});
