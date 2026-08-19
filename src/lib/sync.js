import { supabase } from './supabase';
import {
  guardarBoletosEnCache,
  obtenerPendientesSincronizar,
  marcarSincronizado,
} from './db';

// Descarga TODOS los boletos del evento (respetando la restricción de
// localidades del acceso, si la tiene) y los guarda en el teléfono.
// Se llama mientras SÍ hay internet, antes de que arranque el evento.
export async function descargarBoletosEvento(eventoId, localidadesPermitidas) {
  // El "!inner" es necesario acá — sin él, filtrar por
  // "tipos_boleto.evento_id" no excluye boletos de otros eventos, solo
  // dejaría ese campo vacío en los que no coinciden (es una sutileza
  // de Supabase/PostgREST, el mismo patrón que ya usamos en
  // index.html para filtrar eventos por organizador aprobado).
  let query = supabase
    .from('boletos')
    .select('id, codigo_qr, tipo_boleto_id, estado, fecha_uso, tipos_boleto!inner(nombre, evento_id), usuarios!boletos_usuario_id_fkey(nombre)')
    .eq('tipos_boleto.evento_id', eventoId);

  if (localidadesPermitidas && localidadesPermitidas.length) {
    query = query.in('tipo_boleto_id', localidadesPermitidas);
  }

  const { data, error } = await query;
  if (error) throw error;

  const boletos = (data || []).map((b) => ({
    id: b.id,
    codigo_qr: b.codigo_qr,
    tipo_boleto_id: b.tipo_boleto_id,
    tipo_boleto_nombre: b.tipos_boleto?.nombre || '',
    usuario_nombre: b.usuarios?.nombre || '',
    estado: b.estado,
    fecha_uso: b.fecha_uso,
  }));

  await guardarBoletosEnCache(boletos, eventoId);
  return boletos.length;
}

// Manda al servidor todas las validaciones que se hicieron offline —
// se llama sola cuando vuelve la señal, o a mano con el botón
// "Sincronizar ahora". Si dos personas alcanzaron a escanear el mismo
// boleto en la misma puerta (algo que ya de por sí es poco probable,
// ya que cada puerta tiene sus propias localidades asignadas), el
// servidor solo acepta la primera — la segunda simplemente no cambia
// nada, no revienta el proceso completo.
export async function sincronizarPendientes() {
  const pendientes = await obtenerPendientesSincronizar();
  let exitosos = 0;
  let fallidos = 0;

  for (const item of pendientes) {
    try {
      const { error } = await supabase
        .from('boletos')
        .update({ estado: 'usado', fecha_uso: item.fecha_uso, acceso_puerta_id: item.acceso_id })
        .eq('id', item.boleto_id)
        .eq('estado', 'valido'); // si ya estaba "usado" en el servidor, no se pisa

      if (error) throw error;
      await marcarSincronizado(item.id);
      exitosos++;
    } catch (e) {
      fallidos++;
    }
  }

  return { exitosos, fallidos, total: pendientes.length };
}

// Valida el código de acceso de puerta contra Supabase (necesita
// internet la primera vez) y devuelve tanto el acceso como las
// localidades que puede validar.
export async function validarAccesoPuerta(codigo) {
  const { data: acceso, error } = await supabase
    .from('accesos_puerta')
    .select('*, eventos(id, titulo)')
    .eq('codigo', codigo.trim().toUpperCase())
    .eq('activo', true)
    .maybeSingle();

  if (error || !acceso) return null;

  const { data: restriccion } = await supabase
    .from('accesos_puerta_localidades')
    .select('tipo_boleto_id')
    .eq('acceso_id', acceso.id);

  const localidadesPermitidas = restriccion && restriccion.length ? restriccion.map((r) => r.tipo_boleto_id) : null;

  return { acceso, localidadesPermitidas };
}
