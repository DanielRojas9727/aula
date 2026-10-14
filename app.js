
// Aula · interfaz. Los datos vienen de data.js (Firestore o modo demo).
import { init, subscribe, state, db, validarContenido } from './data.js';
import { planificar, previo } from './reorg.js';
// ---------- utilidades ----------
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fLarga = (s) => { const d = parse(s); return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`; };
const fCorta = (s) => { const d = parse(s); return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)}`; };
const pct = (x) => `${Math.round((x || 0) * 100)}%`;
const HOY = iso(new Date());
const lunesDe = (s) => { const d = parse(s); const k = (d.getDay() + 6) % 7; return iso(addDays(d, -k)); };

const IC = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/><path d="M10 20v-6h4v6"/>',
  quiz: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>',
  play: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3z" fill="currentColor"/>',
  doc: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
  more: '<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  plan: '<path d="M8 6h12M8 12h12M8 18h12"/><path d="m3 6 1 1 2-2M3 12l1 1 2-2M3 18l1 1 2-2"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  chev: '<path d="m9 5 7 7-7 7"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
};
const icon = (k, s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[k]}</svg>`;
const LOGO = '<svg class="logo" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="11" fill="#EE7B1F"/><path d="M9 13.5c4-1.6 7.6-1.2 11 1.3 3.4-2.5 7-2.9 11-1.3v14c-4-1.6-7.6-1.2-11 1.3-3.4-2.5-7-2.9-11-1.3z" fill="#fff"/><path d="M20 14.8v14" stroke="#EE7B1F" stroke-width="1.6"/></svg>';

// ---------- almacenamiento local del prototipo ----------
// Preferencia local (solo este dispositivo): empleo seleccionado
const P = { empleo: 'todos' };
try { P.empleo = localStorage.getItem('aula-empleo') || 'todos'; } catch (e) {}
const save = () => { try { localStorage.setItem('aula-empleo', P.empleo); } catch (e) {} };
const RESP = () => state.respuestas;
const toast = (t) => { let el = document.getElementById('toast'); if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); } el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 2600); };
const guardar = (p) => Promise.resolve(p).catch((e) => toast('No se pudo guardar: ' + e.message));

// ---------- datos ----------
let D = null, ACTS = [], TEMAS = {}, QS = [], VIDS = {};
const EMP = { '241258': { corto: 'Caldas', cls: 'cal' }, '247478': { corto: 'Ibagué', cls: 'iba' } };

let firmaContenido = null, BASE = [];
// Vista efectiva del plan: aplica las fechas reprogramadas y quita los refuerzos omitidos (guardados en el avance)
function vista() {
  ACTS = BASE.filter((a) => !state.progreso[a.id]?.omitida)
    .map((a) => ({ ...a, fechaPlan: a.fecha, fecha: state.progreso[a.id]?.fecha || a.fecha }))
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.opec < b.opec ? -1 : a.id < b.id ? -1 : 1));
}
function preparar(d) {
  D = d; TEMAS = {};
  d.temas.forEach((t) => (TEMAS[t.id] = t));
  BASE = [];
  for (const [opec, lista] of Object.entries(d.actividades)) for (const a of lista) BASE.push({ ...a, opec });
  vista();
  QS = d.preguntas;
  VIDS = d.videos || {};
}
const estado = (a) => state.progreso[a.id]?.estado || a.estado || 'Pendiente';
const puntaje = (a) => state.progreso[a.id]?.puntaje ?? a.puntaje ?? null;
const enEmpleo = (a) => P.empleo === 'todos' || a.opec === P.empleo;
const esSesion = (a) => a.tipo === 'Estudio' || a.tipo === 'Refuerzo';
const esPrueba = (a) => a.tipo.startsWith('Prueba');
const temaNom = (id) => TEMAS[id]?.nombre || '—';
const preguntasDe = (tid) => QS.filter((q) => q.temaId === tid);

function setEstado(a, e, extra = {}) {
  state.progreso[a.id] = { ...(state.progreso[a.id] || {}), estado: e, fechaCumplimiento: e === 'Completada' ? HOY : null, ...extra };
  guardar(db.setProgreso(a.id, { estado: e, fechaCumplimiento: e === 'Completada' ? HOY : null, ...extra }));
}

// Métricas reales a partir del registro
function metricas(filtro = enEmpleo) {
  const xs = ACTS.filter(filtro);
  const ses = xs.filter(esSesion), pru = xs.filter(esPrueba);
  const done = ses.filter((a) => estado(a) === 'Completada');
  const antes = ses.filter((a) => a.fecha < HOY);
  const atras = antes.filter((a) => estado(a) !== 'Completada');
  const horas = xs.filter((a) => estado(a) === 'Completada').reduce((s, a) => s + (a.duracionMin || 0), 0) / 60;
  const pruHechas = pru.filter((a) => estado(a) === 'Completada');
  const pts = pruHechas.map(puntaje).filter((v) => v != null);
  return { ses: ses.length, done: done.length, avance: ses.length ? done.length / ses.length : 0, atras: atras.length,
           horas, pru: pru.length, pruHechas: pruHechas.length, prom: pts.length ? pts.reduce((a, b) => a + b, 0) / pts.length : null };
}
function respTema(tid) {
  const r = RESP().filter((x) => x.temaId === tid);
  return { n: r.length, ok: r.filter((x) => x.ok).length };
}
function estadoTema(tid, filtro = enEmpleo) {
  const xs = ACTS.filter((a) => a.temaId === tid && esSesion(a) && filtro(a));
  const done = xs.filter((a) => estado(a) === 'Completada').length;
  const ref = xs.some((a) => estado(a) === 'Requiere refuerzo');
  const r = respTema(tid);
  const debil = r.n >= 4 && r.ok / r.n < 0.6;
  const atras = xs.some((a) => a.fecha < HOY && estado(a) !== 'Completada');
  let e = 'Pendiente', cls = 'neutral';
  if (ref || debil) { e = 'Requiere refuerzo'; cls = 'bad'; }
  else if (xs.length && done === xs.length) { e = 'Completado'; cls = 'ok'; }
  else if (atras) { e = 'Atrasado'; cls = 'warn'; }
  else if (done > 0 || xs.some((a) => estado(a) === 'En curso')) { e = 'En proceso'; cls = 'info'; }
  return { total: xs.length, done, e, cls, r, primera: xs[0]?.fecha, ultima: xs[xs.length - 1]?.fecha };
}
function recomendacion() {
  // 1) tema con bajo rendimiento real  2) sesión atrasada más antigua  3) siguiente sesión
  const temas = [...new Set(ACTS.filter(enEmpleo).map((a) => a.temaId))].filter((t) => t && t !== 'T-EVAL' && t !== 'T-REF');
  const debiles = temas.map((t) => [t, respTema(t)]).filter(([, r]) => r.n >= 4 && r.ok / r.n < 0.6).sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n);
  if (debiles.length) { const [t, r] = debiles[0]; return { tipo: 'refuerzo', titulo: `Refuerza ${temaNom(t)}`, texto: `Llevas ${r.ok} de ${r.n} aciertos en este tema. Repasa el video y vuelve a practicar.`, tema: t }; }
  const atras = ACTS.filter((a) => enEmpleo(a) && esSesion(a) && a.fecha < HOY && estado(a) !== 'Completada');
  if (atras.length) { const a = atras[0]; return { tipo: 'atraso', titulo: `Ponte al día: ${a.actividad}`, texto: `Estaba programada para el ${fLarga(a.fecha)} (${EMP[a.opec].corto}). Tienes ${atras.length} ${atras.length === 1 ? 'sesión atrasada' : 'sesiones atrasadas'}.`, act: a }; }
  const sig = ACTS.find((a) => enEmpleo(a) && esSesion(a) && a.fecha >= HOY && estado(a) !== 'Completada');
  if (sig) return { tipo: 'siguiente', titulo: sig.actividad, texto: `${temaNom(sig.temaId)} · ${fLarga(sig.fecha)} · ${EMP[sig.opec].corto}`, act: sig };
  return null;
}

// ---------- vista ----------
let ruta = 'inicio', sub = {};
const rutas = { inicio: vInicio, preguntas: vPreguntas, videos: vVideos, pdfs: vPdfs, mas: vMas, plan: vPlan, cronograma: vCronograma, estadisticas: vEstadisticas };
const NAV = [['inicio', 'Inicio', 'home'], ['preguntas', 'Preguntas', 'quiz'], ['videos', 'Videos', 'play'], ['pdfs', 'PDFs', 'doc'], ['mas', 'Más', 'more']];
function go(r, s = {}) { ruta = r; sub = s; try { history.replaceState(null, '', '#' + r); } catch (e) {} render(); window.scrollTo(0, 0); }
function render() {
  if (!D) return;
  vista();
  $('#app').innerHTML = rutas[ruta]();
  const act = ['plan', 'cronograma', 'estadisticas'].includes(ruta) ? 'mas' : ruta;
  $('#nav').innerHTML = NAV.map(([k, l, i]) => `<a href="#${k}" data-go="${k}" ${k === act ? 'aria-current="page"' : ''}>${icon(i, 22)}<span>${l}</span></a>`).join('');
  bind();
}
function heroSimple(titulo, { back = true, extra = '' } = {}) {
  return `<div class="hero slim"><div class="topbar">${back ? `<button class="back" data-back aria-label="Volver">${icon('back')}</button>` : LOGO}<span class="t">${esc(titulo)}</span></div>${extra}</div>`;
}
function selEmpleo() {
  const ops = [['todos', 'Ambos empleos'], ['241258', 'Caldas · 241258'], ['247478', 'Ibagué · 247478']];
  return `<div class="seg" role="group" aria-label="Empleo">${ops.map(([k, l]) => `<button data-emp="${k}" aria-pressed="${P.empleo === k}">${l}</button>`).join('')}</div>`;
}
function chipEmp(opec) { const e = EMP[opec]; return `<span class="chip ${e.cls}">${e.corto}</span>`; }
function chipEstado(e) { const m = { Completada: 'ok', 'En curso': 'warn', 'Requiere refuerzo': 'bad', Pendiente: 'neutral' }; return `<span class="chip ${m[e] || 'neutral'}">${e}</span>`; }
function videoPara(a, k = 0) {
  const vs = VIDS[a.temaId]; if (!vs || !vs.length) return null;
  const idx = ACTS.filter((x) => x.opec === a.opec && x.temaId === a.temaId && esSesion(x)).findIndex((x) => x.id === a.id);
  return vs[Math.max(0, idx) % vs.length];
}
function itemAct(a, { conFecha = false } = {}) {
  const e = estado(a), v = esSesion(a) ? videoPara(a) : null, nq = a.temaId ? preguntasDe(a.temaId).length : 0;
  const tit = esPrueba(a) ? a.actividad : a.actividad;
  const meta = [chipEmp(a.opec), conFecha ? `<span>${fCorta(a.fecha)}</span>` : '', `<span>${esc(esPrueba(a) ? a.tipo : temaNom(a.temaId))}</span>`, a.duracionMin ? `<span class="num">${a.duracionMin} min</span>` : '', e !== 'Pendiente' ? chipEstado(e) : ''].join('');
  let acts = '';
  if (v) acts += `<a class="btn-s" href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener" data-seen="${v.id}">${icon('play', 15)} Ver clase · ${esc(v.duracion)}</a>`;
  if (esSesion(a) && nq) acts += `<button class="btn-s" data-practicar="${a.temaId}">${icon('quiz', 15)} Practicar (${nq})</button>`;
  if (esPrueba(a) && e !== 'Completada') acts += `<button class="btn-s" data-prueba="${a.id}">${icon('clock', 15)} Presentar prueba</button>`;
  if (e !== 'Completada') acts += `<button class="btn-s" data-refuerzo="${a.id}">Requiere refuerzo</button>`;
  if (esPrueba(a) && e === 'Completada') acts += `<span class="chip ok">Puntaje ${puntaje(a) != null ? pct(puntaje(a)) : 'sin registrar'}</span>`;
  return `<div class="item"><button class="check" data-toggle="${a.id}" data-e="${e}" aria-label="Cambiar estado: ${esc(e)}">${e === 'Completada' ? icon('check', 14) : ''}</button>
    <div style="min-width:0"><div class="ttl">${esc(tit)}</div>${a.objetivo ? `<div class="small muted">${esc(a.objetivo)}</div>` : ''}<div class="meta">${meta}</div><div class="acts">${acts}</div></div></div>`;
}
function ring(v, label) {
  const R = 50, C = 2 * Math.PI * R;
  return `<div class="ring"><svg viewBox="0 0 116 116"><circle cx="58" cy="58" r="${R}" fill="none" stroke="var(--surface-2)" stroke-width="11"/><circle class="fg" cx="58" cy="58" r="${R}" fill="none" stroke="var(--accent)" stroke-width="11" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - v)}"/></svg><div class="v"><b class="num">${pct(v)}</b><span>${label}</span></div></div>`;
}

// --- Inicio ---
function vInicio() {
  const m = metricas(), rec = recomendacion();
  const hoy = ACTS.filter((a) => enEmpleo(a) && a.fecha === HOY);
  const prox = ACTS.find((a) => enEmpleo(a) && esPrueba(a) && a.fecha >= HOY && estado(a) !== 'Completada');
  const sigDia = hoy.length ? null : ACTS.find((a) => enEmpleo(a) && a.fecha > HOY);
  const listaDia = hoy.length ? hoy : sigDia ? ACTS.filter((a) => enEmpleo(a) && a.fecha === sigDia.fecha) : [];
  const nr = RESP().length, nok = RESP().filter((r) => r.ok).length;
  return `<div class="hero"><div class="topbar">${LOGO}<span class="t">Aula</span>${state.demo ? '<span class="chip acc">Demo</span>' : ''}</div>
    <div class="greet">¡Hola, Daniel!</div><div class="sub">Hoy es ${fLarga(HOY)} · pruebas CNSC previstas para agosto de 2027</div>${selEmpleo()}</div>
  <div class="body lift">
    <section class="card"><div class="card-h"><h2>Tu avance real</h2><button class="link" data-go="estadisticas">Ver más</button></div>
      <div class="progress">${ring(m.avance, 'del plan')}<div class="kv">
        <div><span>Sesiones completadas</span><b class="num">${m.done} de ${m.ses}</b></div>
        <div><span>Sesiones atrasadas</span><b class="num" style="color:${m.atras ? 'var(--warn)' : 'inherit'}">${m.atras}</b></div>
        <div><span>Horas estudiadas</span><b class="num">${m.horas.toFixed(1)}</b></div>
        <div><span>Preguntas respondidas</span><b class="num">${nr ? `${nr} · ${pct(nok / nr)}` : '0'}</b></div>
      </div></div></section>
    ${rec ? `<section class="reco"><div class="ic">${icon('spark')}</div><div style="min-width:0"><div class="eyebrow" style="color:var(--accent)">${rec.tipo === 'refuerzo' ? 'Requiere refuerzo' : rec.tipo === 'atraso' ? 'Pendiente atrasado' : 'Lo siguiente'}</div><b>${esc(rec.titulo)}</b><div class="small muted">${esc(rec.texto)}</div>${rec.tipo === 'atraso' ? '<button class="btn-s" style="margin-top:8px" data-reorg>Reorganizar mi plan</button>' : ''}</div></section>` : ''}
    <section class="card"><div class="card-h"><h2>${hoy.length ? 'Hoy' : sigDia ? `Próximo día de estudio: ${fLarga(sigDia.fecha)}` : 'Sin actividades'}</h2><span class="small muted num">${listaDia.filter((a) => estado(a) === 'Completada').length} de ${listaDia.length}</span></div>
      ${listaDia.length ? `<div class="list">${listaDia.map((a) => itemAct(a)).join('')}</div>` : `<div class="empty"><b>Día libre</b>Hoy no hay actividades programadas.</div>`}
      <button class="btn ghost" style="margin-top:10px" data-go="plan">Ver la semana completa</button></section>
    ${prox ? `<section class="card"><div class="card-h"><h2>Próxima prueba</h2>${chipEmp(prox.opec)}</div><b>${esc(prox.tipo)} · ${fLarga(prox.fecha)}</b><div class="small muted">${esc(prox.actividad)} · ${Math.round(prox.duracionMin / 6) / 10} h</div></section>` : ''}
    <section><div class="eyebrow" style="margin:4px 2px 8px">Acceso rápido</div><div class="quick">
      ${[['preguntas', 'Practicar preguntas', `${QS.length} preguntas en el banco`, 'quiz', 'var(--accent)'], ['videos', 'Clases de YouTube', 'Videos para tus temas', 'play', '#C2412E'], ['cronograma', 'Cronograma', 'Avance por temas', 'cal', 'var(--info)'], ['pdfs', 'Biblioteca', 'Material y normas', 'doc', 'var(--ok)']]
        .map(([r, t, s, i, c]) => `<button class="q" data-go="${r}"><span class="ic" style="background:color-mix(in srgb, ${c} 15%, transparent);color:${c}">${icon(i)}</span><b>${t}</b><span>${s}</span></button>`).join('')}
    </div></section>
    ${state.demo ? '<p class="notice">Modo demo: el avance se guarda solo en este navegador.</p>' : ''}
  </div>`;
}

// --- Plan semanal ---
function vPlan() {
  const dia = sub.dia || HOY, lun = lunesDe(dia);
  const dias = [...Array(7)].map((_, i) => iso(addDays(parse(lun), i)));
  const xs = ACTS.filter((a) => enEmpleo(a) && a.fecha === dia);
  const semana = ACTS.filter((a) => enEmpleo(a) && a.fecha >= dias[0] && a.fecha <= dias[6]);
  const sesSem = semana.filter(esSesion);
  return heroSimple('Plan de estudio', { extra: selEmpleo() }) + `<div class="body plain">
    <section class="card"><div class="card-h"><button class="btn-s" data-dia="${iso(addDays(parse(lun), -7))}" aria-label="Semana anterior">‹</button><b class="small">Semana del ${fCorta(dias[0])} al ${fCorta(dias[6])}</b><button class="btn-s" data-dia="${iso(addDays(parse(lun), 7))}" aria-label="Semana siguiente">›</button></div>
      <div class="week">${dias.map((d) => { const ys = ACTS.filter((a) => enEmpleo(a) && a.fecha === d); const all = ys.length && ys.every((a) => estado(a) === 'Completada');
        return `<button data-dia="${d}" aria-pressed="${d === dia}"><span>${DIAS[parse(d).getDay()].slice(0, 3)}</span><b class="num">${parse(d).getDate()}</b><i class="${all ? 'done' : ys.length ? 'has' : ''}"></i></button>`; }).join('')}</div>
      <div class="small muted" style="margin-top:10px">Esta semana: <b class="num">${sesSem.filter((a) => estado(a) === 'Completada').length} de ${sesSem.length}</b> sesiones · ${semana.filter(esPrueba).length} prueba(s)</div></section>
    <section class="card"><div class="card-h"><h2>${fLarga(dia)}${dia === HOY ? ' · hoy' : ''}</h2></div>
      ${xs.length ? `<div class="list">${xs.map((a) => itemAct(a)).join('')}</div>` : `<div class="empty"><b>Sin actividades</b>${[0].includes(parse(dia).getDay()) ? 'Domingo de descanso.' : 'Día de descanso o festivo.'}</div>`}</section>
  </div>`;
}

// --- Cronograma ---
// --- Reorganizar pendientes (fase 3) ---
const RO = { usarRefuerzos: true, viernes: false, confirmar: false };
function propuesta() {
  const opecs = P.empleo === 'todos' ? ['241258', '247478'] : [P.empleo];
  return planificar({ acts: BASE, progreso: state.progreso, opecs, hoy: HOY, festivos: (D.festivos || []).map((f) => f.fecha), receso: D.receso, opciones: RO });
}
function tarjetaReorg() {
  const pr = propuesta();
  const filas = Object.entries(pr.resumen).map(([o, r]) => {
    const tarde = r.finContenido && r.finContenido > r.finPlan;
    return `<div class="trow"><div class="top"><b>${chipEmp(o)} OPEC ${o}</b><span class="chip ${r.atrasadas ? 'warn' : 'ok'}">${r.atrasadas} atrasada${r.atrasadas === 1 ? '' : 's'}</span></div>
      <div class="small muted num">${r.movidas} sesiones cambian de fecha${r.refuerzosUsados ? ` · se usan ${r.refuerzosUsados} sesiones de refuerzo como colchón` : ''}</div>
      <div class="small num" style="color:${tarde ? 'var(--bad)' : 'var(--ink-2)'}">Última sesión de estudio: ${r.finContenido ? fLarga(r.finContenido) : '—'}${tarde ? ` · ${r.diasExtra} días después del fin del plan (${fCorta(r.finPlan)})` : ''}</div></div>`;
  }).join('');
  const hay = pr.cambios.length + pr.omitidas.length;
  return `<section class="card"><div class="card-h"><h2>Reorganizar pendientes</h2></div>
    <p class="small muted" style="margin:0 0 8px">Mueve las sesiones no completadas a tus próximos días de estudio, en el mismo orden. Las pruebas de viernes y sábado no se mueven.</p>
    ${filas}
    <label class="small" style="display:flex;gap:8px;align-items:center;margin-top:10px"><input type="checkbox" id="ro-ref" ${RO.usarRefuerzos ? 'checked' : ''}> Usar las sesiones de refuerzo como colchón</label>
    <label class="small" style="display:flex;gap:8px;align-items:center;margin-top:6px"><input type="checkbox" id="ro-vie" ${RO.viernes ? 'checked' : ''}> Estudiar también los viernes</label>
    ${RO.confirmar ? `<div class="fb ok"><b>¿Aplicar la reorganización?</b>Cambian ${pr.cambios.length} sesiones${pr.omitidas.length ? ` y se omiten ${pr.omitidas.length} refuerzos` : ''}. Puedes deshacerlo después.<div class="acts"><button class="btn-s" id="ro-si">Sí, reorganizar</button><button class="btn-s" id="ro-no">Cancelar</button></div></div>`
      : `<button class="btn" style="margin-top:12px" id="ro-ver" ${hay ? '' : 'disabled'}>${hay ? 'Reorganizar mi plan' : 'Tu plan está al día'}</button>`}
    ${state.ajustes ? `<button class="btn ghost" style="margin-top:8px" id="ro-undo">Deshacer la última reorganización (${fLarga(iso(new Date(state.ajustes.ts)))})</button>` : ''}
  </section>`;
}

function vCronograma() {
  const tab = sub.tab || 'temas';
  const tabs = `<div class="tabs" role="tablist">${[['temas', 'Por temas'], ['semanas', 'Planeado vs real']].map(([k, l]) => `<button role="tab" aria-selected="${tab === k}" data-tab="${k}">${l}</button>`).join('')}</div>`;
  let cuerpo = '';
  if (tab === 'temas') {
    const ids = [...new Set(ACTS.filter((a) => enEmpleo(a) && esSesion(a)).map((a) => a.temaId))].filter((t) => t !== 'T-REF');
    const rows = ids.map((t) => [t, estadoTema(t)]).sort((a, b) => (a[1].primera < b[1].primera ? -1 : 1));
    cuerpo = `<section class="card">${rows.map(([t, s]) => `<div class="trow"><div class="top"><b>${esc(temaNom(t))}</b><span class="chip ${s.cls}">${s.e}</span></div>
      <div class="bar"><i class="${s.e === 'Requiere refuerzo' ? 'acc' : ''}" style="width:${s.total ? (s.done / s.total) * 100 : 0}%"></i></div>
      <div class="small muted num">${s.done} de ${s.total} sesiones · ${fCorta(s.primera)} a ${fCorta(s.ultima)}${s.r.n ? ` · ${s.r.ok}/${s.r.n} aciertos` : ''}</div></div>`).join('')}</section>`;
  } else {
    const sesiones = ACTS.filter((a) => enEmpleo(a) && esSesion(a));
    const hechas = sesiones.filter((a) => estado(a) === 'Completada').length;
    const debiaOriginal = BASE.filter((a) => enEmpleo(a) && esSesion(a) && a.fecha < HOY).length;
    const atrasadas = sesiones.filter((a) => a.fecha < HOY && estado(a) !== 'Completada').length;
    const semanas = {};
    for (const a of sesiones) { const k = lunesDe(a.fecha); (semanas[k] ||= []).push(a); }
    const filas = Object.keys(semanas).sort().map((k) => ({ k, n: semanas[k].length, r: semanas[k].filter((a) => estado(a) === 'Completada').length }));
    cuerpo = `<section class="card"><div class="card-h"><h2>A la fecha</h2></div><div class="stat3">
        <div><b class="num">${debiaOriginal}</b><span>Debías llevar según el plan original</span></div>
        <div><b class="num">${hechas}</b><span>Sesiones hechas</span></div>
        <div><b class="num" style="color:${atrasadas ? 'var(--warn)' : 'var(--ok)'}">${atrasadas}</b><span>Atrasadas en el plan actual</span></div></div></section>
      ${tarjetaReorg()}
      <section class="card"><div class="card-h"><h2>Semana a semana</h2><span class="small muted">hechas / programadas</span></div>
      ${filas.map((f) => `<div class="wk"><span class="num">${fCorta(f.k)}</span><div class="bar"><i class="${f.k === lunesDe(HOY) ? 'acc' : ''}" style="width:${(f.r / f.n) * 100}%"></i></div><span class="r num">${f.r}/${f.n}</span></div>`).join('')}</section>`;
  }
  return heroSimple('Mi cronograma', { extra: selEmpleo() }) + `<div class="body plain">${tabs}${cuerpo}</div>`;
}

// --- Preguntas ---
let Z = null; // sesión de práctica
function vPreguntas() {
  if (Z) return vQuiz();
  const temas = [...new Set(QS.map((q) => q.temaId))];
  const f = sub.f || { tema: '', tipo: '' };
  const pool = QS.filter((q) => (!f.tema || q.temaId === f.tema) && (!f.tipo || q.tipo === f.tipo));
  const tipos = [...new Set(QS.map((q) => q.tipo))];
  const nr = RESP().length;
  return heroSimple('Preguntas CNSC', { back: false }) + `<div class="body plain">
    <section class="card"><div class="filters">
      <label class="field">Tema<select id="f-tema"><option value="">Todos (${QS.length})</option>${temas.map((t) => `<option value="${t}" ${f.tema === t ? 'selected' : ''}>${esc(temaNom(t))} (${preguntasDe(t).length})</option>`).join('')}</select></label>
      <label class="field">Tipo<select id="f-tipo"><option value="">Todos</option>${tipos.map((t) => `<option ${f.tipo === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label></div>
      <div style="display:grid;gap:8px;margin-top:12px">
        <button class="btn" data-start="practica" ${pool.length ? '' : 'disabled'}>Practicar ${pool.length} pregunta${pool.length === 1 ? '' : 's'}</button>
        <button class="btn ghost" data-start="simulacro" ${pool.length ? '' : 'disabled'}>${icon('clock', 18)} Simulacro cronometrado · ${Math.min(pool.length, 20)} preguntas, 2 min c/u</button></div></section>
    <section class="card"><div class="card-h"><h2>Tu registro</h2></div>${nr ? `<div class="stat3"><div><b class="num">${nr}</b><span>Respondidas</span></div><div><b class="num" style="color:var(--ok)">${RESP().filter((r) => r.ok).length}</b><span>Correctas</span></div><div><b class="num" style="color:var(--bad)">${RESP().filter((r) => !r.ok).length}</b><span>Incorrectas</span></div></div>
      <button class="btn ghost" style="margin-top:12px" data-start="falladas" ${RESP().some((r) => !r.ok) ? '' : 'disabled'}>Repasar preguntas falladas</button>`
      : `<div class="empty"><b>Aún no has respondido preguntas</b>Tus aciertos por tema aparecerán aquí y actualizarán el cronograma.</div>`}</section>
    <section class="card"><div class="small muted">El banco tiene ${QS.length} preguntas de Semana1_Preguntas.docx. ${QS.filter((q) => !q.explicacionVerificada).length} tienen una explicación redactada por Claude, marcada "Por verificar".</div></section>
  </div>`;
}
function iniciar(modo, opts = {}) {
  const f = sub.f || {};
  let pool;
  if (modo === 'falladas') { const ids = new Set(RESP().filter((r) => !r.ok).map((r) => r.qid)); pool = QS.filter((q) => ids.has(q.id)); }
  else if (opts.temas) pool = QS.filter((q) => opts.temas.includes(q.temaId));
  else pool = QS.filter((q) => (!f.tema || q.temaId === f.tema) && (!f.tipo || q.tipo === f.tipo));
  if (opts.temas && pool.length < 5) pool = QS.slice();
  pool = pool.slice().sort(() => Math.random() - 0.5);
  if (modo === 'simulacro') pool = pool.slice(0, Math.min(20, pool.length));
  Z = { modo, qs: pool, i: 0, sel: null, ok: 0, done: false, fin: modo === 'simulacro' ? Date.now() + pool.length * 120000 : null, act: opts.act || null, respondida: false };
  go('preguntas', sub);
}
function vQuiz() {
  if (Z.done) {
    const p = Z.qs.length ? Z.ok / Z.qs.length : 0;
    return heroSimple(Z.modo === 'simulacro' ? 'Resultado del simulacro' : 'Práctica terminada') + `<div class="body plain"><section class="card" style="text-align:center">
      ${ring(p, 'aciertos')}<h2 style="margin-top:10px">${Z.ok} de ${Z.qs.length} correctas</h2>
      ${Z.act ? `<p class="small muted">Se registró como puntaje de la ${esc(Z.act.tipo.toLowerCase())} del ${fLarga(Z.act.fecha)}.</p>` : ''}
      <button class="btn" style="margin-top:10px" data-salir>Volver</button></section></div>`;
  }
  const q = Z.qs[Z.i];
  const restante = Z.fin ? Math.max(0, Math.round((Z.fin - Date.now()) / 1000)) : null;
  const opts = ['A', 'B', 'C', 'D'].map((k) => { let cls = '';
    if (Z.respondida) { if (k === q.respuesta) cls = 'right'; else if (k === Z.sel) cls = 'wrong'; }
    return `<button class="opt ${cls}" data-opt="${k}" aria-pressed="${Z.sel === k}" ${Z.respondida ? 'disabled' : ''}><span class="l">${k}</span><span>${esc(q.opciones[k])}</span></button>`; }).join('');
  const bien = Z.sel === q.respuesta;
  const fb = Z.respondida ? `<div class="fb ${bien ? 'ok' : 'bad'}"><b>${bien ? 'Correcto.' : `Incorrecto. La respuesta es ${q.respuesta}.`}</b>${esc(q.explicacion || 'Esta pregunta aún no tiene explicación.')}${q.explicacionVerificada ? '' : '\n\n<span class="chip warn">Explicación por verificar</span>'}${q.trampas ? `\n\n<b>Trampas frecuentes</b>${esc(q.trampas)}` : ''}</div>` : '';
  return heroSimple(Z.modo === 'simulacro' ? 'Simulacro' : 'Práctica', { extra: '' }) + `<div class="body plain"><section class="card qcard">
    <div class="card-h"><span class="small muted num">Pregunta ${Z.i + 1} de ${Z.qs.length}</span>${restante != null ? `<span class="timer num" id="timer">${icon('clock', 16)} ${Math.floor(restante / 60)}:${pad(restante % 60)}</span>` : ''}</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px"><span class="chip acc">${esc(temaNom(q.temaId))}</span><span class="chip neutral">${esc(q.tipo)}</span></div>
    ${q.contexto ? `<div class="ctx">${esc(q.contexto)}</div>` : ''}
    <div class="en">${esc(q.enunciado)}</div>${opts}${fb}
    <div style="margin-top:14px;display:grid;gap:8px">${Z.respondida ? `<button class="btn" data-sig>${Z.i + 1 < Z.qs.length ? 'Siguiente' : 'Ver resultado'}</button>` : `<button class="btn" data-responder ${Z.sel ? '' : 'disabled'}>Responder</button>`}
    <button class="btn ghost" data-salir>Salir</button></div></section></div>`;
}
function terminarQuiz() {
  Z.done = true;
  if (Z.act) setEstado(Z.act, 'Completada', { puntaje: Z.qs.length ? Z.ok / Z.qs.length : 0 });
}

// --- Videos ---
function vVideos() {
  const qq = (sub.q || '').toLowerCase();
  const lun = lunesDe(HOY), dom = iso(addDays(parse(lun), 6));
  const temasSem = [...new Set(ACTS.filter((a) => enEmpleo(a) && esSesion(a) && a.fecha >= lun && a.fecha <= dom).map((a) => a.temaId))].filter((t) => VIDS[t]);
  const fila = (v) => `<a class="vid ${state.vistos[v.id] ? 'seen' : ''}" href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener" data-seen="${v.id}"><span class="th">${state.vistos[v.id] ? icon('check', 20) : icon('play', 22)}<small class="num">${esc(v.duracion)}</small></span><span style="min-width:0"><b>${esc(v.titulo)}</b><span class="small muted">${esc(v.canal)}${state.vistos[v.id] ? ' · vista' : ''}</span></span></a>`;
  let cuerpo;
  if (qq) {
    const res = []; const vistos = new Set();
    for (const [t, vs] of Object.entries(VIDS)) for (const v of vs) if (!vistos.has(v.id) && (v.titulo + ' ' + v.canal + ' ' + temaNom(t)).toLowerCase().includes(qq)) { vistos.add(v.id); res.push(v); }
    cuerpo = `<section class="card"><div class="card-h"><h2>${res.length} resultado${res.length === 1 ? '' : 's'}</h2></div>${res.length ? res.map(fila).join('') : '<div class="empty"><b>Sin resultados</b>Prueba con otra palabra, por ejemplo "MIPG" o "señales".</div>'}</section>`;
  } else {
    cuerpo = `<section class="card"><div class="card-h"><h2>Para tus temas de esta semana</h2></div>${temasSem.length ? temasSem.map((t) => `<div class="eyebrow" style="margin:10px 0 2px">${esc(temaNom(t))}</div>${VIDS[t].slice(0, 3).map(fila).join('')}`).join('') : '<div class="empty"><b>Sin videos para esta semana</b>Los temas de esta semana no tienen clases seleccionadas.</div>'}</section>
    <section class="card"><div class="card-h"><h2>Todos los temas</h2></div>${Object.keys(VIDS).filter((t) => TEMAS[t] && !['T-REP', 'T-RF', 'T-SF', 'T-CIE', 'T-REF'].includes(t)).map((t) => `<details><summary style="padding:8px 0;font-weight:700;cursor:pointer">${esc(temaNom(t))} <span class="small muted">· ${VIDS[t].length}</span></summary>${VIDS[t].map(fila).join('')}</details>`).join('')}</section>`;
  }
  return heroSimple('Clases de YouTube', { back: false, extra: `<label class="field" style="margin-top:12px"><input id="vq" type="search" placeholder="Buscar un tema, canal o palabra clave" value="${esc(sub.q || '')}" aria-label="Buscar videos"></label>` }) + `<div class="body plain">${cuerpo}</div>`;
}

// --- PDFs / biblioteca ---
function vPdfs() {
  const docs = [['Semana1_MIPG.pdf', 'MIPG', '6,0 MB'], ['Semana1_MIPG_Presentación.pdf', 'MIPG', '8,1 MB'], ['Semana1_Preguntas.docx', 'Constitución · Función pública · MIPG', '43 KB'],
    ['2_Funciones_Cargo.pdf', 'Manual de funciones OPEC 247478', '365 KB'], ['1_Funciones Cargo.pdf', 'Manual de funciones OPEC 241258', '497 KB'], ['1_Acuerdo_SIMO.pdf', 'Acuerdo de la convocatoria', '770 KB']];
  const conFuentes = D.temas.filter((t) => t.fuentes && t.fuentes.length);
  return heroSimple('Biblioteca', { back: false }) + `<div class="body plain">
    <section class="card"><div class="card-h"><h2>Tus documentos</h2><span class="chip warn">Por subir a Google Drive</span></div>
      ${docs.map(([n, t, s]) => `<div class="doc"><span class="ic">${n.endsWith('.pdf') ? 'PDF' : 'DOC'}</span><div style="min-width:0"><b style="font-size:14px;word-break:break-word">${esc(n)}</b><div class="small muted">${esc(t)} · ${s}</div></div></div>`).join('')}
      <p class="small muted" style="margin:10px 0 0">Cuando estén en Google Drive, cada documento abrirá desde aquí y llevará su resumen de puntos clave.</p></section>
    <section class="card"><div class="card-h"><h2>Normas por tema</h2></div>${conFuentes.map((t) => `<details><summary style="padding:8px 0;font-weight:700;cursor:pointer">${esc(t.nombre)}</summary><ul class="small" style="margin:0 0 8px;padding-left:18px;color:var(--ink-2)">${t.fuentes.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></details>`).join('')}</section>
  </div>`;
}

// --- Más ---
function vMas() {
  const it = [['plan', 'Plan de estudio diario', 'Semana a semana, con clases y preguntas', 'plan'], ['cronograma', 'Cronograma de avance', 'Por temas y planeado vs real', 'cal'], ['estadisticas', 'Resultados y estadísticas', 'Aciertos, pruebas y cumplimiento', 'chart']];
  return heroSimple('Más', { back: false }) + `<div class="body plain"><section class="card more">${it.map(([r, t, s, i]) => `<a href="#${r}" data-go="${r}"><span class="ic">${icon(i)}</span><span><b>${t}</b><br><span class="small muted">${s}</span></span>${icon('chev', 16)}</a>`).join('')}</section>
    <section class="card"><div class="card-h"><h2>Datos del plan</h2></div><div class="kv small">
      <div><span>Empleos</span><b>OPEC 241258 · OPEC 247478</b></div><div><span>Actividades</span><b class="num">${ACTS.length}</b></div><div><span>Temas en el catálogo</span><b class="num">${D.temas.length}</b></div>
      <div><span>Preguntas en el banco</span><b class="num">${QS.length}</b></div><div><span>Videos seleccionados</span><b class="num">${new Set(Object.values(VIDS).flat().map((v) => v.id)).size}</b></div></div>
      ${D.empleos.filter((e, i, arr) => e.pruebas && arr.findIndex((x) => JSON.stringify(x.pruebas) === JSON.stringify(e.pruebas)) === i).map((e) => `<div class="eyebrow" style="margin-top:14px">Pruebas · ${D.empleos.filter((x) => JSON.stringify(x.pruebas) === JSON.stringify(e.pruebas)).length > 1 ? 'ambos empleos' : 'OPEC ' + e.opec}</div>${e.pruebas.items.map((p) => `<div class="trow"><div class="top"><b>${esc(p.prueba)}</b><span class="num">${pct(p.peso)}</span></div><div class="small muted">${esc(p.caracter)}${p.minimo ? ` · mínimo aprobatorio ${p.minimo}/100` : ''}</div></div>`).join('')}<p class="small muted" style="margin:6px 0 0">${esc(e.pruebas.fuente)}</p>`).join('')}
      <div class="small muted" style="margin-top:8px">Contenido cargado el ${D.importado ? fLarga(iso(new Date(D.importado))) : '—'}${D.version ? ` · versión ${esc(D.version)}` : ''}</div>
      <label class="btn" style="margin-top:12px">${icon('up', 18)} Actualizar contenido (aula-datos.json)<input type="file" id="imp" accept=".json,application/json" hidden></label>
      <p class="small muted" style="margin:6px 0 0">Actualizar el contenido agrega o cambia temas, preguntas, videos y actividades. Tu avance no se borra.</p>
      <button class="btn ghost" style="margin-top:12px" data-reset>Borrar todo mi avance</button><div id="reset-confirm"></div></section>
    <section class="card"><div class="card-h"><h2>Cuenta</h2></div><div class="small muted">${esc(state.user?.email || '')}</div>${state.demo ? '' : '<button class="btn ghost" style="margin-top:10px" data-logout>Cerrar sesión</button>'}</section></div>`;
}

// --- Estadísticas ---
function vEstadisticas() {
  const m = metricas(); const nr = RESP().length, nok = RESP().filter((r) => r.ok).length;
  const porTema = Object.entries(RESP().reduce((o, r) => { (o[r.temaId] ||= { n: 0, ok: 0 }); o[r.temaId].n++; if (r.ok) o[r.temaId].ok++; return o; }, {})).sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n);
  const emp = ['241258', '247478'].map((o) => [o, metricas((a) => a.opec === o)]);
  return heroSimple('Resultados y estadísticas', { extra: selEmpleo() }) + `<div class="body plain">
    <section class="card"><div class="card-h"><h2>Preguntas</h2></div>${nr ? `<div class="progress">${ring(nok / nr, 'aciertos')}<div class="kv"><div><span>Respondidas</span><b class="num">${nr}</b></div><div><span>Correctas</span><b class="num" style="color:var(--ok)">${nok}</b></div><div><span>Incorrectas</span><b class="num" style="color:var(--bad)">${nr - nok}</b></div></div></div>`
      : `<div class="empty"><b>Sin respuestas todavía</b>Practica en la sección Preguntas para ver tus aciertos.</div>`}</section>
    <section class="card"><div class="card-h"><h2>Rendimiento por tema</h2></div>${porTema.length ? porTema.map(([t, r]) => { const p = r.ok / r.n; return `<div class="trow"><div class="top"><b>${esc(temaNom(t))}</b><span class="num">${pct(p)}</span></div><div class="bar"><i style="width:${p * 100}%;background:${p < 0.6 ? 'var(--bad)' : p < 0.8 ? 'var(--warn)' : 'var(--ok)'}"></i></div><div class="small muted num">${r.ok} de ${r.n}${r.n >= 4 && p < 0.6 ? ' · requiere refuerzo' : ''}</div></div>`; }).join('') : '<div class="empty">Aparecerá cuando respondas preguntas.</div>'}</section>
    <section class="card"><div class="card-h"><h2>Cumplimiento del plan</h2></div>${emp.map(([o, x]) => `<div class="trow"><div class="top"><b>${chipEmp(o)} OPEC ${o}</b><span class="num">${pct(x.avance)}</span></div><div class="bar"><i style="width:${x.avance * 100}%"></i></div><div class="small muted num">${x.done} de ${x.ses} sesiones · ${x.atras} atrasadas · pruebas ${x.pruHechas}/${x.pru}${x.prom != null ? ` · promedio ${pct(x.prom)}` : ''}</div></div>`).join('')}</section>
  </div>`;
}

// ---------- eventos ----------
let tick = null;
function bind() {
  const app = $('#app');
  document.querySelectorAll('[data-go]').forEach((b) => (b.onclick = (e) => { e.preventDefault(); if (b.dataset.go !== 'preguntas') Z = null; go(b.dataset.go); }));
  app.querySelectorAll('[data-back]').forEach((b) => (b.onclick = () => { Z = null; go(['plan', 'cronograma', 'estadisticas'].includes(ruta) ? 'mas' : 'inicio'); }));
  app.querySelectorAll('[data-emp]').forEach((b) => (b.onclick = () => { P.empleo = b.dataset.emp; save(); render(); }));
  app.querySelectorAll('[data-toggle]').forEach((b) => (b.onclick = () => { const a = ACTS.find((x) => x.id === b.dataset.toggle); const e = estado(a);
    const sig = { Pendiente: 'En curso', 'En curso': 'Completada', Completada: 'Pendiente', 'Requiere refuerzo': 'Completada' }[e]; setEstado(a, sig); render(); }));
  app.querySelectorAll('[data-refuerzo]').forEach((b) => (b.onclick = () => { setEstado(ACTS.find((x) => x.id === b.dataset.refuerzo), 'Requiere refuerzo'); render(); }));
  app.querySelectorAll('[data-seen]').forEach((b) => b.addEventListener('click', () => { if (!state.vistos[b.dataset.seen]) { state.vistos[b.dataset.seen] = Date.now(); guardar(db.marcarVisto(b.dataset.seen)); } setTimeout(render, 300); }));
  app.querySelectorAll('[data-practicar]').forEach((b) => (b.onclick = () => { sub = { f: { tema: b.dataset.practicar, tipo: '' } }; iniciar('practica'); }));
  app.querySelectorAll('[data-prueba]').forEach((b) => (b.onclick = () => { const a = ACTS.find((x) => x.id === b.dataset.prueba);
    const lun = lunesDe(a.fecha); const temas = [...new Set(ACTS.filter((x) => x.opec === a.opec && esSesion(x) && (a.tipo === 'Prueba mensual' ? x.fecha <= a.fecha : x.fecha >= lun && x.fecha <= a.fecha)).map((x) => x.temaId))];
    sub = {}; iniciar('simulacro', { temas, act: a }); }));
  app.querySelectorAll('[data-dia]').forEach((b) => (b.onclick = () => { sub = { dia: b.dataset.dia }; render(); }));
  app.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { sub = { tab: b.dataset.tab }; render(); }));
  const ft = $('#f-tema', app), fp = $('#f-tipo', app);
  if (ft) ft.onchange = fp.onchange = () => { sub = { f: { tema: ft.value, tipo: fp.value } }; render(); };
  app.querySelectorAll('[data-start]').forEach((b) => (b.onclick = () => iniciar(b.dataset.start)));
  app.querySelectorAll('[data-opt]').forEach((b) => (b.onclick = () => { Z.sel = b.dataset.opt; render(); }));
  const r = $('[data-responder]', app); if (r) r.onclick = () => { const q = Z.qs[Z.i]; Z.respondida = true; const ok = Z.sel === q.respuesta; if (ok) Z.ok++;
    const r = { qid: q.id, temaId: q.temaId, ok, ts: Date.now(), modo: Z.modo }; state.respuestas = [...state.respuestas, r]; guardar(db.addRespuesta(r)); render(); };
  const s = $('[data-sig]', app); if (s) s.onclick = () => { if (Z.i + 1 < Z.qs.length) { Z.i++; Z.sel = null; Z.respondida = false; } else terminarQuiz(); render(); window.scrollTo(0, 0); };
  app.querySelectorAll('[data-salir]').forEach((b) => (b.onclick = () => { Z = null; render(); }));
  const vq = $('#vq', app); if (vq) vq.oninput = () => { sub = { q: vq.value }; const pos = vq.selectionStart; render(); const n = $('#vq'); n.focus(); n.setSelectionRange(pos, pos); };
  const rs = $('[data-reset]', app); if (rs) rs.onclick = () => { $('#reset-confirm').innerHTML = `<div class="fb bad"><b>¿Borrar todo tu avance?</b>Se perderán los estados, puntajes, respuestas y videos vistos. El plan y las preguntas se conservan.<div class="acts"><button class="btn-s" id="rs-si">Sí, borrar</button><button class="btn-s" id="rs-no">Cancelar</button></div></div>`;
    $('#rs-si').onclick = async () => { await guardar(db.borrarAvance()); toast('Avance borrado'); render(); }; $('#rs-no').onclick = () => ($('#reset-confirm').innerHTML = ''); };
  const roRef = $('#ro-ref', app); if (roRef) roRef.onchange = () => { RO.usarRefuerzos = roRef.checked; RO.confirmar = false; render(); };
  const roVie = $('#ro-vie', app); if (roVie) roVie.onchange = () => { RO.viernes = roVie.checked; RO.confirmar = false; render(); };
  const roVer = $('#ro-ver', app); if (roVer) roVer.onclick = () => { RO.confirmar = true; render(); };
  const roNo = $('#ro-no', app); if (roNo) roNo.onclick = () => { RO.confirmar = false; render(); };
  const roSi = $('#ro-si', app); if (roSi) roSi.onclick = async () => {
    const pr = propuesta(); const prev = previo(pr, state.progreso);
    for (const c of pr.cambios) state.progreso[c.id] = { ...(state.progreso[c.id] || {}), fecha: c.a };
    for (const o of pr.omitidas) state.progreso[o.id] = { ...(state.progreso[o.id] || {}), omitida: true };
    state.ajustes = { ts: Date.now(), previo: prev, resumen: pr.resumen };
    RO.confirmar = false; render();
    await guardar(db.reprogramar(pr.cambios, pr.omitidas, prev, pr.resumen));
    toast(`Plan reorganizado: ${pr.cambios.length} sesiones movidas`);
  };
  const roUn = $('#ro-undo', app); if (roUn) roUn.onclick = async () => {
    for (const [id, v] of Object.entries(state.ajustes.previo || {})) state.progreso[id] = { ...(state.progreso[id] || {}), fecha: v.fecha, omitida: v.omitida };
    await guardar(db.deshacerReprogramacion()); state.ajustes = null; toast('Reorganización deshecha'); render();
  };
  const reo = $('[data-reorg]', app); if (reo) reo.onclick = () => go('cronograma', { tab: 'semanas' });
  const imp = $('#imp', app); if (imp) imp.onchange = () => importarArchivo(imp.files[0]);
  const lo = $('[data-logout]', app); if (lo) lo.onclick = () => db.logout();
  clearInterval(tick);
  if (Z && Z.fin && !Z.done) tick = setInterval(() => { const t = $('#timer'); const rest = Math.max(0, Math.round((Z.fin - Date.now()) / 1000));
    if (t) t.innerHTML = `${icon('clock', 16)} ${Math.floor(rest / 60)}:${pad(rest % 60)}`; if (!rest) { terminarQuiz(); render(); } }, 1000);
}

// ---------- acceso, carga inicial e importación ----------
async function importarArchivo(f) {
  if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    const n = await db.importar(d);
    toast(`Contenido actualizado: ${n.actividades} actividades, ${n.preguntas} preguntas, ${n.temas} temas`);
  } catch (e) { toast('No se pudo importar: ' + e.message); }
}
const GOOGLE = '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
function pantalla(html) { $('#app').innerHTML = `<section class="login">${html}</section>`; $('#nav').innerHTML = ''; }
function vistaAcceso() {
  if (state.sinConfig) return pantalla(`${LOGO}<h1 class="brand">Aula</h1><p class="muted">Falta la configuración de Firebase. Pega el bloque de tu proyecto en el archivo firebase-config.js y sube el cambio.</p>`);
  pantalla(`${LOGO}<h1 class="brand">Aula</h1><p class="muted">Tu plan de estudio para los concursos CNSC</p>
    ${state.authError ? `<p class="err" role="alert">${esc(state.authError)}</p>` : ''}
    <button class="btn" id="login" style="max-width:320px;background:var(--surface);color:var(--ink);border:1px solid var(--line)">${GOOGLE} ${state.user ? 'Usar otra cuenta' : 'Entrar con Google'}</button>
    <p class="small muted">Solo tu cuenta autorizada puede entrar.</p>`);
  $('#login').onclick = async () => { try { if (state.user) await db.logout(); await db.login(); } catch (e) { state.authError = e.message; vistaAcceso(); } };
}
function vistaVacia() {
  pantalla(`${LOGO}<h1 class="brand">Bienvenido a Aula</h1><p class="muted">Tu cuenta aún no tiene contenido. Carga el archivo <b>aula-datos.json</b> para empezar.</p>
    <label class="btn" style="max-width:320px">${icon('up', 18)} Cargar aula-datos.json<input type="file" id="imp0" accept=".json,application/json" hidden></label><p class="small muted">${esc(state.user?.email || '')}</p>`);
  $('#imp0').onchange = (e) => importarArchivo(e.target.files[0]);
}
function alCambiar() {
  if (!state.ready) { if (!$('.hero')) pantalla(`${LOGO}<p class="muted">Cargando…</p>`); return; }
  if (!state.user || state.authError || state.sinConfig) return vistaAcceso();
  if (state.contenido === undefined) return pantalla(`${LOGO}<p class="muted">Cargando tu plan…</p>`);
  if (!state.contenido) return vistaVacia();
  const firma = state.contenido.importado;
  if (firma !== firmaContenido) { firmaContenido = firma; preparar(state.contenido); }
  if (document.activeElement && document.activeElement.matches('#vq')) return; // no interrumpir la búsqueda
  render();
}
const h0 = (location.hash || '').slice(1); if (rutas[h0]) ruta = h0;
window.addEventListener('hashchange', () => { const k = (location.hash || '').slice(1); if (rutas[k] && k !== ruta) { Z = null; go(k); } });
subscribe(alCambiar);
init();
if ('serviceWorker' in navigator && !new URLSearchParams(location.search).has('demo')) navigator.serviceWorker.register('sw.js').catch(() => {});
