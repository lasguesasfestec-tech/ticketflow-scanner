import * as SQLite from 'expo-sqlite';

// Esta base de datos vive DENTRO del teléfono — sigue ahí aunque se
// cierre la app, se apague el celular, o no haya señal en absoluto.
// Es la pieza que hace posible validar boletos sin internet.
let db = null;

async function getDb() {
  if (!db) {
    db = await SQLite.openDatabaseAsync('ticketflow_scanner.db');
    await db.execAsync(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS boletos_cache (
        id TEXT PRIMARY KEY,
        codigo_qr TEXT UNIQUE NOT NULL,
        evento_id TEXT NOT NULL,
        tipo_boleto_id TEXT,
        tipo_boleto_nombre TEXT,
        usuario_nombre TEXT,
        estado TEXT NOT NULL,
        fecha_uso TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_boletos_codigo ON boletos_cache(codigo_qr);

      CREATE TABLE IF NOT EXISTS cola_sincronizacion (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        boleto_id TEXT NOT NULL,
        fecha_uso TEXT NOT NULL,
        acceso_id TEXT NOT NULL,
        sincronizado INTEGER NOT NULL DEFAULT 0,
        fecha_creado TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS sesion_activa (
        clave TEXT PRIMARY KEY,
        valor TEXT
      );
    `);
  }
  return db;
}

// ---------- Guardar sesión del acceso de puerta (para no pedir el código cada vez que se abre la app) ----------

export async function guardarSesionAcceso(acceso, localidadesPermitidas) {
  const database = await getDb();
  await database.runAsync(
    `INSERT OR REPLACE INTO sesion_activa (clave, valor) VALUES ('acceso', ?)`,
    [JSON.stringify({ acceso, localidadesPermitidas })]
  );
}

export async function leerSesionAcceso() {
  const database = await getDb();
  const fila = await database.getFirstAsync(`SELECT valor FROM sesion_activa WHERE clave = 'acceso'`);
  if (!fila) return null;
  try { return JSON.parse(fila.valor); } catch (e) { return null; }
}

export async function borrarSesionAcceso() {
  const database = await getDb();
  await database.runAsync(`DELETE FROM sesion_activa WHERE clave = 'acceso'`);
  await database.runAsync(`DELETE FROM boletos_cache`);
  await database.runAsync(`DELETE FROM cola_sincronizacion`);
}

// ---------- Descargar boletos del evento para poder validar offline ----------

export async function guardarBoletosEnCache(boletos, eventoId) {
  const database = await getDb();
  await database.runAsync(`DELETE FROM boletos_cache WHERE evento_id = ?`, [eventoId]);
  await database.withTransactionAsync(async () => {
    for (const b of boletos) {
      await database.runAsync(
        `INSERT OR REPLACE INTO boletos_cache
         (id, codigo_qr, evento_id, tipo_boleto_id, tipo_boleto_nombre, usuario_nombre, estado, fecha_uso)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [b.id, b.codigo_qr, eventoId, b.tipo_boleto_id, b.tipo_boleto_nombre, b.usuario_nombre, b.estado, b.fecha_uso || null]
      );
    }
  });
}

export async function contarBoletosCache(eventoId) {
  const database = await getDb();
  const fila = await database.getFirstAsync(`SELECT COUNT(*) as total FROM boletos_cache WHERE evento_id = ?`, [eventoId]);
  return fila?.total || 0;
}

// ---------- Validar un boleto (funciona con o sin internet) ----------

export async function buscarBoletoPorCodigo(codigoQr) {
  const database = await getDb();
  return database.getFirstAsync(`SELECT * FROM boletos_cache WHERE codigo_qr = ?`, [codigoQr]);
}

export async function marcarBoletoUsadoLocal(boletoId, accesoId) {
  const database = await getDb();
  const fechaUso = new Date().toISOString();
  await database.runAsync(
    `UPDATE boletos_cache SET estado = 'usado', fecha_uso = ? WHERE id = ?`,
    [fechaUso, boletoId]
  );
  await database.runAsync(
    `INSERT INTO cola_sincronizacion (boleto_id, fecha_uso, acceso_id, sincronizado) VALUES (?, ?, ?, 0)`,
    [boletoId, fechaUso, accesoId]
  );
}

// ---------- Sincronización con Supabase ----------

export async function obtenerPendientesSincronizar() {
  const database = await getDb();
  return database.getAllAsync(`SELECT * FROM cola_sincronizacion WHERE sincronizado = 0`);
}

export async function marcarSincronizado(id) {
  const database = await getDb();
  await database.runAsync(`UPDATE cola_sincronizacion SET sincronizado = 1 WHERE id = ?`, [id]);
}

export async function contarPendientes() {
  const database = await getDb();
  const fila = await database.getFirstAsync(`SELECT COUNT(*) as total FROM cola_sincronizacion WHERE sincronizado = 0`);
  return fila?.total || 0;
}
