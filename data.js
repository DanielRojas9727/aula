// Capa de datos de Aula: Firebase (Google + Firestore) o modo demo local (?demo).
// El CONTENIDO (plan, temas, preguntas, videos) y el AVANCE (progreso, respuestas, videos vistos)
// se guardan por separado: importar contenido nuevo nunca toca el avance.
import { firebaseConfig } from './firebase-config.js';

const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';
const RAIZ = 'aula/principal';
const listeners = new Set();
export const state = {
  ready: false, demo: false, user: null, authError: null, sinConfig: false,
  contenido: null,          // { empleos, temas, videos, actividades: {opec: []}, preguntas, version, importado }
  progreso: {},             // { actId: { estado, fechaCumplimiento, puntaje, notas, ts } }
  respuestas: [],           // [{ id, qid, temaId, ok, ts, modo }]
  vistos: {},               // { videoId: ts }
};
const emit = () => listeners.forEach((fn) => fn(state));
export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
let api = null;
export const db = new Proxy({}, { get: (_, k) => (...a) => api[k](...a) });

// Divide el contenido en documentos de menos de ~700 KB (límite de Firestore: 1 MB por documento)
function trozos(lista, max = 650000) {
  const out = []; let cur = []; let size = 2;
  for (const x of lista) { const n = JSON.stringify(x).length + 1; if (cur.length && size + n > max) { out.push(cur); cur = []; size = 2; } cur.push(x); size += n; }
  if (cur.length) out.push(cur);
  return out;
}
export function validarContenido(d) {
  const falta = ['empleos', 'temas', 'actividades', 'preguntas'].filter((k) => !d || !d[k]);
  if (falta.length) throw new Error('El archivo no es un aula-datos.json válido (falta: ' + falta.join(', ') + ')');
  const ids = new Set();
  for (const lista of Object.values(d.actividades)) for (const a of lista) { if (ids.has(a.id)) throw new Error('ID de actividad repetido: ' + a.id); ids.add(a.id); }
  const qids = new Set();
  for (const q of d.preguntas) { if (qids.has(q.id)) throw new Error('ID de pregunta repetido: ' + q.id); qids.add(q.id); }
  return { actividades: ids.size, preguntas: qids.size, temas: d.temas.length };
}
const resumen = (d) => ({ empleos: d.empleos, temas: d.temas, videos: d.videos || {}, festivos: d.festivos || [], receso: d.receso || null, version: d.generado || null });

// ---------------- Modo demo (pruebas sin Firebase) ----------------
async function initDemo() {
  state.demo = true;
  const K = 'aula-demo-avance';
  let mem = { progreso: {}, respuestas: [], vistos: {} };
  try { const raw = localStorage.getItem(K); if (raw) mem = JSON.parse(raw); } catch (e) {}
  const sync = () => { try { localStorage.setItem(K, JSON.stringify(mem)); } catch (e) {} Object.assign(state, structuredClone(mem)); emit(); };
  try {
    const d = await fetch('aula-datos.json').then((r) => { if (!r.ok) throw new Error(); return r.json(); });
    state.contenido = { ...resumen(d), actividades: d.actividades, preguntas: d.preguntas, importado: Date.now() };
  } catch (e) { state.contenido = null; }
  state.user = { uid: 'demo', email: 'demo@local', displayName: 'Daniel (demo)' };
  api = {
    setProgreso: async (id, patch) => { mem.progreso[id] = { ...(mem.progreso[id] || {}), ...patch, ts: Date.now() }; sync(); },
    addRespuesta: async (r) => { mem.respuestas.push({ id: Math.random().toString(36).slice(2), ...r }); sync(); },
    marcarVisto: async (vid) => { mem.vistos[vid] = Date.now(); sync(); },
    importar: async (d) => { const n = validarContenido(d); state.contenido = { ...resumen(d), actividades: d.actividades, preguntas: d.preguntas, importado: Date.now() }; emit(); return n; },
    borrarAvance: async () => { mem = { progreso: {}, respuestas: [], vistos: {} }; sync(); },
    login: async () => {}, logout: async () => {},
  };
  Object.assign(state, structuredClone(mem));
  state.ready = true; emit();
}

// ---------------- Firebase ----------------
async function initFirebase() {
  const [{ initializeApp }, A, F] = await Promise.all([
    import(FB + 'firebase-app.js'), import(FB + 'firebase-auth.js'), import(FB + 'firebase-firestore.js'),
  ]);
  const app = initializeApp(firebaseConfig);
  const auth = A.getAuth(app);
  const fdb = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) });
  const col = (n) => F.collection(fdb, `${RAIZ}/${n}`);
  const docu = (n, id) => F.doc(fdb, `${RAIZ}/${n}/${id}`);
  const raiz = F.doc(fdb, RAIZ);
  let unsubs = [];
  let piezas = {};   // documentos de contenido recibidos

  const armarContenido = (meta) => {
    if (!meta || !meta.importado) { state.contenido = null; return; }
    const cat = piezas.catalogo;
    if (!cat || (meta.planes || []).some((p) => !piezas[p]) || (meta.bancos || []).some((b) => !piezas[b])) return; // aún cargando
    const actividades = {};
    for (const p of meta.planes) { const x = piezas[p]; (actividades[x.opec] ||= []).push(...x.actividades); }
    const preguntas = meta.bancos.flatMap((b) => piezas[b].preguntas);
    state.contenido = { ...cat, actividades, preguntas, importado: meta.importado };
  };

  api = {
    setProgreso: (id, patch) => F.setDoc(docu('progreso', id), { ...patch, ts: Date.now() }, { merge: true }),
    addRespuesta: (r) => F.addDoc(col('respuestas'), r),
    marcarVisto: (vid) => F.setDoc(docu('vistos', vid), { ts: Date.now() }),
    // Importa o actualiza el CONTENIDO. El avance (progreso, respuestas, vistos) no se toca.
    importar: async (d) => {
      const n = validarContenido(d);
      const ops = [[docu('contenido', 'catalogo'), resumen(d)]];
      const planes = [], bancos = [];
      for (const [opec, lista] of Object.entries(d.actividades)) trozos(lista).forEach((t, i) => { const id = `plan-${opec}-${i + 1}`; planes.push(id); ops.push([docu('contenido', id), { opec, actividades: t }]); });
      trozos(d.preguntas).forEach((t, i) => { const id = `banco-${i + 1}`; bancos.push(id); ops.push([docu('contenido', id), { preguntas: t }]); });
      const b = F.writeBatch(fdb);
      ops.forEach(([r, x]) => b.set(r, x));
      b.set(raiz, { importado: Date.now(), version: d.generado || null, planes, bancos }, { merge: true });
      await b.commit();
      return n;
    },
    borrarAvance: async () => {
      for (const n of ['progreso', 'respuestas', 'vistos']) {
        const s = await F.getDocs(col(n));
        for (let i = 0; i < s.docs.length; i += 400) { const b = F.writeBatch(fdb); s.docs.slice(i, i + 400).forEach((x) => b.delete(x.ref)); await b.commit(); }
      }
    },
    login: async () => {
      const p = new A.GoogleAuthProvider();
      p.setCustomParameters({ prompt: 'select_account' });
      try { await A.signInWithPopup(auth, p); } catch (e) { if (String(e.code).includes('popup')) await A.signInWithRedirect(auth, p); else throw e; }
    },
    logout: () => A.signOut(auth),
  };
  window.__aula = api;

  await A.getRedirectResult(auth).catch((e) => { state.authError = e.message; });
  A.onAuthStateChanged(auth, (u) => {
    unsubs.forEach((f) => f()); unsubs = []; piezas = {};
    state.user = u; state.authError = null;
    if (!u) { state.ready = true; emit(); return; }
    state.ready = false; emit();
    const fail = (e) => { state.authError = e.code === 'permission-denied' ? `La cuenta ${u.email} no tiene acceso a Aula.` : e.message; state.ready = true; emit(); };
    let meta = null, pend = 4;
    const listo = () => { if (--pend <= 0) state.ready = true; emit(); };
    unsubs.push(F.onSnapshot(raiz, (s) => { meta = s.data() || null; armarContenido(meta); listo(); }, fail));
    unsubs.push(F.onSnapshot(col('contenido'), (s) => { piezas = {}; s.docs.forEach((d) => (piezas[d.id] = d.data())); armarContenido(meta); emit(); }, fail));
    unsubs.push(F.onSnapshot(col('progreso'), (s) => { const o = {}; s.docs.forEach((d) => (o[d.id] = d.data())); state.progreso = o; listo(); }, fail));
    unsubs.push(F.onSnapshot(col('respuestas'), (s) => { state.respuestas = s.docs.map((d) => ({ id: d.id, ...d.data() })); listo(); }, fail));
    unsubs.push(F.onSnapshot(col('vistos'), (s) => { const o = {}; s.docs.forEach((d) => (o[d.id] = d.data().ts)); state.vistos = o; listo(); }, fail));
  });
}

export async function init() {
  const demo = new URLSearchParams(location.search).has('demo');
  if (demo) return initDemo();
  if (!firebaseConfig || !firebaseConfig.apiKey) { state.sinConfig = true; state.ready = true; emit(); return; }
  try { await initFirebase(); } catch (e) { state.authError = 'No se pudo conectar: ' + e.message; state.ready = true; emit(); }
}
