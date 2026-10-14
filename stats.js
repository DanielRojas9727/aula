// Estadísticas avanzadas (fase 4): evolución, rendimiento por eje y tipo de prueba, proyección y recomendaciones.
// Todo se calcula con los datos reales registrados (respuestas y pruebas); nada se guarda calculado.

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const lunes = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return iso(x); };
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const corto = (s) => { const d = parse(s); return `${d.getDate()} ${MES[d.getMonth()]}`; };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Componente de la prueba CNSC al que apunta cada tipo de pregunta
export const componente = (tipo) => (tipo === 'Comportamental' ? 'comportamentales' : 'funcionales');

export function calcular({ respuestas, preguntas, temas, actividades, opecs, minimo = 65, pesoF = 0.6, pesoC = 0.2 }) {
  const Q = new Map(preguntas.map((q) => [q.id, q]));
  const T = new Map(temas.map((t) => [t.id, t]));
  const delEmpleo = new Set(actividades.filter((a) => opecs.includes(a.opec)).map((a) => a.temaId));
  const rs = respuestas.filter((r) => delEmpleo.has(r.temaId));

  // Evolución semanal: práctica (% aciertos) y pruebas (puntaje)
  const sem = {};
  for (const r of rs) { const k = lunes(new Date(r.ts)); (sem[k] ||= { n: 0, ok: 0, pruebas: [] }); sem[k].n++; if (r.ok) sem[k].ok++; }
  for (const a of actividades) {
    if (!opecs.includes(a.opec) || !a.tipo.startsWith('Prueba') || a.puntaje == null) continue;
    const k = lunes(parse(a.fechaCumplimiento || a.fecha)); (sem[k] ||= { n: 0, ok: 0, pruebas: [] }); sem[k].pruebas.push(a.puntaje);
  }
  const semanas = Object.keys(sem).sort().slice(-12).map((k) => ({
    k, etiqueta: corto(k), n: sem[k].n, practica: sem[k].n ? sem[k].ok / sem[k].n : null,
    prueba: sem[k].pruebas.length ? sem[k].pruebas.reduce((a, b) => a + b, 0) / sem[k].pruebas.length : null,
  }));

  // Por componente (funcionales / comportamentales)
  const comp = { funcionales: { n: 0, ok: 0 }, comportamentales: { n: 0, ok: 0 } };
  for (const r of rs) { const q = Q.get(r.qid); const c = componente(q?.tipo); comp[c].n++; if (r.ok) comp[c].ok++; }
  // Ventana reciente (últimas 40 respuestas de cada componente) para la proyección
  const reciente = (c) => { const xs = rs.filter((r) => componente(Q.get(r.qid)?.tipo) === c).sort((a, b) => a.ts - b.ts).slice(-40); return { n: xs.length, ok: xs.filter((r) => r.ok).length }; };
  const rf = reciente('funcionales'), rc = reciente('comportamentales');
  const F = rf.n ? (rf.ok / rf.n) * 100 : null, C = rc.n ? (rc.ok / rc.n) * 100 : null;
  const proyeccion = {
    funcional: F, nF: rf.n, comportamental: C, nC: rc.n, minimo,
    suficiente: rf.n >= 10,
    aprueba: F != null ? F >= minimo : null,
    ponderadoParcial: F != null ? pesoF * F + (C != null ? pesoC * C : 0) : null,
    maxParcial: (pesoF + (C != null ? pesoC : 0)) * 100,
  };

  // Por eje y por tema
  const porEje = {}, porTema = {};
  for (const r of rs) {
    const t = T.get(r.temaId); const e = t?.eje || 'Sin eje';
    (porEje[e] ||= { n: 0, ok: 0 }); porEje[e].n++; if (r.ok) porEje[e].ok++;
    (porTema[r.temaId] ||= { n: 0, ok: 0 }); porTema[r.temaId].n++; if (r.ok) porTema[r.temaId].ok++;
  }
  const temasOrden = Object.entries(porTema).filter(([, v]) => v.n >= 4).map(([id, v]) => ({ id, nombre: T.get(id)?.nombre || id, ...v, p: v.ok / v.n }));
  const mejores = temasOrden.filter((t) => t.p >= 0.6).sort((a, b) => b.p - a.p || b.n - a.n).slice(0, 3);
  const debiles = temasOrden.filter((t) => t.p < 0.6).sort((a, b) => a.p - b.p).slice(0, 3);

  // Temas ya estudiados sin práctica, con preguntas disponibles
  const conPreguntas = new Set(preguntas.map((q) => q.temaId));
  const estudiados = new Set(actividades.filter((a) => opecs.includes(a.opec) && (a.tipo === 'Estudio') && a.estado === 'Completada').map((a) => a.temaId));
  const sinPractica = [...estudiados].filter((t) => conPreguntas.has(t) && !porTema[t]).map((id) => ({ id, nombre: T.get(id)?.nombre || id }));

  return { total: { n: rs.length, ok: rs.filter((r) => r.ok).length }, semanas, comp, proyeccion, porEje, mejores, debiles, sinPractica };
}

// Gráfica de líneas en SVG: práctica (% aciertos) y pruebas (puntaje), con referencia del mínimo aprobatorio
export function graficaEvolucion(semanas, minimo = 65) {
  if (!semanas.length) return '';
  const W = 340, H = 180, L = 30, R = 46, T = 12, B = 26;
  const iw = W - L - R, ih = H - T - B;
  const x = (i) => L + (semanas.length === 1 ? iw / 2 : (i * iw) / (semanas.length - 1));
  const y = (v) => T + ih - (v / 100) * ih;
  const serie = (key, cls, nombre) => {
    const pts = semanas.map((s, i) => (s[key] == null ? null : [x(i), y(s[key] * (key === 'practica' || key === 'prueba' ? 100 : 1)), s]));
    const segs = []; let cur = [];
    pts.forEach((p) => { if (p) cur.push(p); else if (cur.length) { segs.push(cur); cur = []; } });
    if (cur.length) segs.push(cur);
    const lines = segs.filter((sg) => sg.length > 1).map((sg) => `<polyline class="ln ${cls}" points="${sg.map((p) => p.slice(0, 2).join(',')).join(' ')}"/>`).join('');
    const dots = pts.filter(Boolean).map(([px, py, s]) => `<circle class="dot ${cls}" cx="${px}" cy="${py}" r="4.5"><title>${esc(nombre)} · semana del ${esc(s.etiqueta)}: ${Math.round(s[key] * 100)}%${key === 'practica' ? ` (${s.n} respuestas)` : ''}</title></circle>`).join('');
    const last = pts.filter(Boolean).pop();
    const lab = last ? `<text class="dl ${cls}" x="${last[0] + 8}" y="${last[1] + 4}">${Math.round(last[2][key] * 100)}%</text>` : '';
    return lines + dots + lab;
  };
  const grid = [0, 50, 100].map((v) => `<line class="gr" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join('');
  const ref = `<line class="ref" x1="${L}" x2="${W - R}" y1="${y(minimo)}" y2="${y(minimo)}"/><text class="ax" x="${W - R + 4}" y="${y(minimo) + 4}">mín. ${minimo}</text>`;
  const step = Math.ceil(semanas.length / 6);
  const xl = semanas.map((s, i) => (i % step === 0 || i === semanas.length - 1 ? `<text class="ax" x="${x(i)}" y="${H - 6}" text-anchor="middle">${esc(s.etiqueta)}</text>` : '')).join('');
  const hayPrueba = semanas.some((s) => s.prueba != null);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolución semanal del porcentaje de aciertos${hayPrueba ? ' y del puntaje de pruebas' : ''}">
    ${grid}${ref}${serie('practica', 's1', 'Práctica')}${hayPrueba ? serie('prueba', 's2', 'Pruebas') : ''}${xl}</svg>
    <div class="legend"><span><i class="sw s1"></i>Práctica (% aciertos)</span>${hayPrueba ? '<span><i class="sw s2"></i>Pruebas (puntaje)</span>' : ''}<span><i class="sw ref"></i>Mínimo aprobatorio</span></div>
    <details class="small"><summary class="muted" style="cursor:pointer">Ver como tabla</summary><table class="tbl"><thead><tr><th>Semana</th><th>Respuestas</th><th>Práctica</th><th>Pruebas</th></tr></thead><tbody>
    ${semanas.map((s) => `<tr><td>${esc(s.etiqueta)}</td><td class="num">${s.n}</td><td class="num">${s.practica == null ? '—' : Math.round(s.practica * 100) + '%'}</td><td class="num">${s.prueba == null ? '—' : Math.round(s.prueba * 100) + '%'}</td></tr>`).join('')}</tbody></table></details>`;
}
