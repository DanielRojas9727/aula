// Reorganización de sesiones pendientes (fase 3).
// Mueve las sesiones de estudio no completadas a los días de estudio libres desde hoy,
// conservando su orden. Las pruebas (semanales y mensuales) no se mueven.
// Si no caben antes del fin del plan, primero usa las sesiones de refuerzo como colchón
// (se omiten, empezando por las más lejanas) y, si aun así no caben, extiende el plan.

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };

export const esSesion = (a) => a.tipo === 'Estudio' || a.tipo === 'Refuerzo';

export function diaLibre(s, festivos, receso) {
  if (festivos.has(s)) return true;
  return !!(receso && s >= receso[0] && s <= receso[1]);
}

/**
 * @param acts      actividades del contenido (fecha = fecha del plan), con opec
 * @param progreso  { id: { estado, fecha, omitida } }
 * @param opecs     empleos a reorganizar
 * @param hoy       'YYYY-MM-DD'
 * @param festivos  ['YYYY-MM-DD', ...]
 * @param receso    ['YYYY-MM-DD', 'YYYY-MM-DD'] o null
 * @param opciones  { usarRefuerzos: true, viernes: false }
 */
export function planificar({ acts, progreso, opecs, hoy, festivos = [], receso = null, opciones = {} }) {
  const usarRefuerzos = opciones.usarRefuerzos !== false;
  const dias = opciones.viernes ? [1, 2, 3, 4, 5] : [1, 2, 3, 4];
  const fest = new Set(festivos);
  const P = (a) => progreso[a.id] || {};
  const est = (a) => P(a).estado || a.estado || 'Pendiente';
  const fx = (a) => P(a).fecha || a.fecha;
  const cambios = [], omitidas = [], resumen = {};

  for (const opec of opecs) {
    const todas = acts.filter((a) => a.opec === opec);
    if (!todas.length) continue;
    const fin = todas.reduce((m, a) => (a.fecha > m ? a.fecha : m), todas[0].fecha);
    const vivas = todas.filter((a) => esSesion(a) && !P(a).omitida);
    const hechasPorDia = new Set(vivas.filter((a) => est(a) === 'Completada').map(fx));
    let pend = vivas.filter((a) => est(a) !== 'Completada')
      .sort((a, b) => (fx(a) < fx(b) ? -1 : fx(a) > fx(b) ? 1 : a.id < b.id ? -1 : 1));
    const atrasadas = pend.filter((a) => fx(a) < hoy).length;

    const esDiaEstudio = (s) => dias.includes(parse(s).getDay()) && !diaLibre(s, fest, receso) && !hechasPorDia.has(s);
    const slots = [];
    for (let s = hoy; s <= fin; s = addDays(s, 1)) if (esDiaEstudio(s)) slots.push(s);

    // Colchón: omitir refuerzos (los más lejanos primero) si no cabe todo
    const omit = [];
    if (usarRefuerzos && pend.length > slots.length) {
      const ref = pend.filter((a) => a.tipo === 'Refuerzo').reverse();
      for (const r of ref) { if (pend.length - omit.length <= slots.length) break; omit.push(r); }
      const ids = new Set(omit.map((a) => a.id));
      pend = pend.filter((a) => !ids.has(a.id));
    }
    // Si aún no cabe, extender después del fin del plan
    let extra = 0;
    for (let s = addDays(fin, 1); slots.length < pend.length; s = addDays(s, 1)) if (esDiaEstudio(s)) { slots.push(s); extra++; }

    pend.forEach((a, i) => { if (slots[i] !== fx(a)) cambios.push({ id: a.id, opec, de: fx(a), a: slots[i] }); });
    omit.forEach((a) => omitidas.push({ id: a.id, opec, de: fx(a) }));
    resumen[opec] = {
      atrasadas, pendientes: pend.length, movidas: cambios.filter((c) => c.opec === opec).length,
      refuerzosUsados: omit.length, finPlan: fin, finContenido: pend.length ? slots[pend.length - 1] : null, diasExtra: extra,
    };
  }
  return { cambios, omitidas, resumen };
}

// Estado previo de cada actividad afectada, para poder deshacer
export function previo({ cambios, omitidas }, progreso) {
  const out = {};
  for (const c of [...cambios, ...omitidas]) out[c.id] = { fecha: progreso[c.id]?.fecha || null, omitida: !!progreso[c.id]?.omitida };
  return out;
}
