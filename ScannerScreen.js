import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import NetInfo from '@react-native-community/netinfo';
import {
  buscarBoletoPorCodigo,
  marcarBoletoUsadoLocal,
  contarBoletosCache,
  contarPendientes,
  borrarSesionAcceso,
} from '../lib/db';
import { descargarBoletosEvento, sincronizarPendientes } from '../lib/sync';

export default function ScannerScreen({ acceso, localidadesPermitidas, onSalir }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [procesando, setProcesando] = useState(false);
  const [resultado, setResultado] = useState(null); // { tipo: 'ok'|'usado'|'error', titulo, detalle }
  const [enLinea, setEnLinea] = useState(true);
  const [totalCache, setTotalCache] = useState(0);
  const [pendientesSync, setPendientesSync] = useState(0);
  const [descargando, setDescargando] = useState(false);
  const ultimoEscaneado = useRef(null);
  const bloqueoTimeout = useRef(null);

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, []);

  const refrescarContadores = useCallback(async () => {
    setTotalCache(await contarBoletosCache(acceso.evento_id));
    setPendientesSync(await contarPendientes());
  }, [acceso]);

  useEffect(() => {
    refrescarContadores();
    const unsubscribe = NetInfo.addEventListener((estado) => {
      const conectado = !!estado.isConnected;
      setEnLinea(conectado);
      if (conectado) intentarSincronizar();
    });
    return unsubscribe;
  }, []);

  async function intentarSincronizar() {
    const { total } = await sincronizarPendientes();
    if (total > 0) await refrescarContadores();
  }

  async function descargarParaOffline() {
    setDescargando(true);
    try {
      const cantidad = await descargarBoletosEvento(acceso.evento_id, localidadesPermitidas);
      await refrescarContadores();
      Alert.alert('Listo', `Se descargaron ${cantidad} boletos — ya puedes validar sin internet.`);
    } catch (e) {
      Alert.alert('Error', 'No se pudo descargar: ' + e.message);
    }
    setDescargando(false);
  }

  async function manejarEscaneo({ data }) {
    if (procesando || data === ultimoEscaneado.current) return;
    ultimoEscaneado.current = data;
    setProcesando(true);

    const boleto = await buscarBoletoPorCodigo(data);

    if (!boleto) {
      setResultado({
        tipo: 'error',
        titulo: 'Boleto no encontrado',
        detalle: totalCache === 0
          ? 'Todavía no has descargado los boletos de este evento — usa el botón de abajo mientras tengas internet.'
          : 'No pertenece a este evento, o a una localidad que esta puerta no valida.',
      });
    } else if (boleto.estado === 'usado') {
      setResultado({
        tipo: 'usado',
        titulo: 'Ya fue escaneado',
        detalle: `${boleto.tipo_boleto_nombre}${boleto.fecha_uso ? `\n${new Date(boleto.fecha_uso).toLocaleString('es-EC')}` : ''}`,
      });
    } else {
      await marcarBoletoUsadoLocal(boleto.id, acceso.id);
      setResultado({
        tipo: 'ok',
        titulo: '✓ Entrada válida',
        detalle: `${boleto.tipo_boleto_nombre}${boleto.usuario_nombre ? `\n${boleto.usuario_nombre}` : ''}`,
      });
      refrescarContadores();
      if (enLinea) intentarSincronizar();
    }

    if (bloqueoTimeout.current) clearTimeout(bloqueoTimeout.current);
    bloqueoTimeout.current = setTimeout(() => {
      setResultado(null);
      setProcesando(false);
      ultimoEscaneado.current = null;
    }, 2200);
  }

  async function cerrarSesionApp() {
    Alert.alert('Cerrar sesión', '¿Salir de este evento? Se borran los boletos guardados en este teléfono.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: async () => { await borrarSesionAcceso(); onSalir(); } },
    ]);
  }

  if (!permission) return <View style={styles.container} />;
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.permText}>Se necesita permiso de cámara para escanear los boletos.</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Dar permiso</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerName}>{acceso.nombre_persona} — {acceso.area}</Text>
          <Text style={styles.headerEvento}>{acceso.eventos?.titulo || 'Evento'}</Text>
        </View>
        <TouchableOpacity onPress={cerrarSesionApp}><Text style={styles.salirBtn}>Salir</Text></TouchableOpacity>
      </View>

      <View style={styles.statusRow}>
        <Text style={[styles.statusChip, { color: enLinea ? '#5AA96B' : '#F0C040' }]}>
          {enLinea ? '● En línea' : '○ Sin conexión'}
        </Text>
        <Text style={styles.statusChip}>{totalCache} boletos guardados</Text>
        {pendientesSync > 0 && <Text style={[styles.statusChip, { color: '#F0C040' }]}>{pendientesSync} por sincronizar</Text>}
      </View>

      {localidadesPermitidas && (
        <Text style={styles.avisoRestriccion}>🔒 Esta puerta solo valida ciertas localidades</Text>
      )}

      <View style={styles.cameraWrap}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={procesando ? undefined : manejarEscaneo}
        />
        {resultado && (
          <View style={[styles.resultOverlay, styles[`resultado_${resultado.tipo}`]]}>
            <Text style={styles.resultTitulo}>{resultado.titulo}</Text>
            {!!resultado.detalle && <Text style={styles.resultDetalle}>{resultado.detalle}</Text>}
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.descargarBtn} onPress={descargarParaOffline} disabled={descargando}>
        {descargando ? <ActivityIndicator color="#0A0B24" /> : <Text style={styles.btnText}>⬇ Descargar boletos para offline</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0B24', padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  headerName: { color: '#F5F6FA', fontWeight: '700' },
  headerEvento: { color: '#8D91BD', fontSize: 12 },
  salirBtn: { color: '#E74C3C', fontSize: 13 },
  statusRow: { flexDirection: 'row', gap: 10, marginBottom: 6, flexWrap: 'wrap' },
  statusChip: { color: '#8D91BD', fontSize: 12 },
  avisoRestriccion: { color: '#F0C040', fontSize: 12, marginBottom: 8 },
  cameraWrap: { flex: 1, borderRadius: 16, overflow: 'hidden', marginVertical: 12 },
  resultOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', padding: 20 },
  resultado_ok: { backgroundColor: 'rgba(90,169,107,0.92)' },
  resultado_usado: { backgroundColor: 'rgba(240,192,64,0.92)' },
  resultado_error: { backgroundColor: 'rgba(231,76,60,0.92)' },
  resultTitulo: { fontSize: 22, fontWeight: '900', color: '#0A0B24', textAlign: 'center' },
  resultDetalle: { fontSize: 14, color: '#0A0B24', textAlign: 'center', marginTop: 8 },
  descargarBtn: { backgroundColor: '#2E9EF5', borderRadius: 12, padding: 14, alignItems: 'center' },
  btn: { backgroundColor: '#2E9EF5', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 16 },
  btnText: { color: '#0A0B24', fontWeight: '800' },
  permText: { color: '#F5F6FA', textAlign: 'center', marginTop: 40, marginBottom: 16 },
});
