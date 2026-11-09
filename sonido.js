// Aula · sonidos y vibración. Todo se sintetiza con Web Audio: no hay archivos de audio que descargar.
// Reglas: se activa con el primer toque del usuario (lo exigen iOS y Chrome), los sonidos duran menos de medio segundo
// y hay un interruptor en Más. Si el navegador no soporta audio, las funciones no hacen nada.

const K = 'aula-sonido';
let activo = true;
try { activo = localStorage.getItem(K) !== '0'; } catch (e) {}

let ctx = null, master = null;
function asegurar() {
  if (!activo) return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch (e) { return null; }
}
// Prepara el audio en el primer toque para que el primer sonido no llegue tarde
['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, () => { asegurar(); }, { once: true, passive: true }));

// Una nota: ataque de 6 ms y caída exponencial (evita los "clics" al empezar y terminar)
function nota(c, dest, { f, t = 0, d = 0.15, tipo = 'sine', v = 0.2, f2 = null }) {
  const o = c.createOscillator(), g = c.createGain(), t0 = c.currentTime + t;
  o.type = tipo; o.frequency.setValueAtTime(f, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + d);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(v, t0 + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  o.connect(g); g.connect(dest);
  o.start(t0); o.stop(t0 + d + 0.02);
}

// Catálogo de sonidos (frecuencias en Hz). Exportado para poder probarlo con un AudioContext sin conexión.
export const SONIDOS = {
  tap:   [{ f: 880, f2: 700, d: 0.05, v: 0.12 }],                                                    // elegir una opción
  ok:    [{ f: 659.25, d: 0.14, v: 0.2 }, { f: 987.77, t: 0.09, d: 0.22, v: 0.2 }],                   // respuesta correcta
  mal:   [{ f: 330, d: 0.14, tipo: 'triangle', v: 0.2 }, { f: 247, t: 0.11, d: 0.24, tipo: 'triangle', v: 0.2 }], // incorrecta (suave, no regaña)
  listo: [{ f: 523.25, d: 0.12 }, { f: 659.25, t: 0.08, d: 0.12 }, { f: 783.99, t: 0.16, d: 0.12 }, { f: 1046.5, t: 0.24, d: 0.38, v: 0.22 }], // sesión completada
  fin:   [{ f: 392, d: 0.14, v: 0.18 }, { f: 523.25, t: 0.12, d: 0.14, v: 0.18 }, { f: 659.25, t: 0.24, d: 0.4, v: 0.2 }],                      // termina práctica o simulacro
};
export function tocar(c, dest, nombre) { (SONIDOS[nombre] || []).forEach((n) => nota(c, dest, n)); }

const VIBRA = { ok: 12, mal: [22, 45, 22], listo: [14, 40, 14, 40, 30], fin: 20 }; // solo Android; iOS no lo permite

export function sonar(nombre) {
  if (!activo) return;
  const c = asegurar();
  if (!c || c.state === 'closed') return;
  try { tocar(c, master, nombre); } catch (e) {}
  try { if (VIBRA[nombre] && navigator.vibrate) navigator.vibrate(VIBRA[nombre]); } catch (e) {}
}
export const sonidoActivo = () => activo;
export function fijarSonido(v) {
  activo = !!v;
  try { localStorage.setItem(K, activo ? '1' : '0'); } catch (e) {}
  if (activo) { asegurar(); sonar('tap'); }
}
