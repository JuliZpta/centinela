// Centinela · navegación por escenas, gráficos de la exposición y laboratorio.
const $ = id => document.getElementById(id);
const CEN = {
  estado: { umbral: 0.8 },
  alCambiarUmbral: [],
  alCambiarTema: [],
  colores: {},
  datos: [],
};
const fmt = n => Math.round(n).toLocaleString("es-CO");
const pct = p => (p * 100).toFixed(1).replace(".", ",") + " %";
const coma = v => String(v).replace(".", ",");
function hexA(hex, a) {
  if (!hex || hex[0] !== "#") return hex;
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
}
function leerColores() {
  const s = getComputedStyle(document.documentElement);
  for (const k of ["bg", "panel", "ink", "muted", "line", "grid", "orbit", "earth", "sun", "hit", "small", "far", "ok"])
    CEN.colores[k] = s.getPropertyValue("--" + k).trim();
}
leerColores();
function ajustarCanvas(c, alto) {
  const r = c.getBoundingClientRect(), d = window.devicePixelRatio || 1;
  c.width = Math.max(1, Math.round(r.width * d));
  c.height = Math.max(1, Math.round((alto ? alto(r.width) : r.height) * d));
  return d;
}

// ---------------- Datos de asteroides (muestra del examen) ----------------
CEN.listos = fetch("data/asteroides.json").then(r => r.json()).then(filas => {
  CEN.datos = filas.map(r => ({ name: r[0], q: r[1], e: r[2], i: r[3], a: r[4], moid: r[5], H: r[6], cls: r[7], pha: r[8] === 1, diam: r[9] }));
  for (const a of CEN.datos) a.p = probabilidad(a.q, a.e, a.i);
  return CEN.datos;
}).catch(() => []);

// ---------------- Navegación ----------------
const escenas = [...document.querySelectorAll(".escena")];
const COLOR_QUIEN = { "Julián": "var(--julian)", "Juan José": "var(--juanjo)", "Emmanuel": "var(--emma)", "Santiago": "var(--santi)" };
let actual = 0, GUION = {};
$("fases").innerHTML = escenas.map((s, k) => `<button aria-label="Escena ${k + 1}: ${s.dataset.fase}" data-k="${k}"></button>`).join("");
$("fases").addEventListener("click", ev => { const b = ev.target.closest("button"); if (b) ir(+b.dataset.k); });
function ir(k) { k = Math.max(0, Math.min(escenas.length - 1, k)); escenas[k].scrollIntoView({ behavior: "smooth", block: "start" }); }
function marcarActual(k) {
  actual = k;
  const s = escenas[k], quien = s.dataset.quien, c = COLOR_QUIEN[quien];
  $("faseTxt").textContent = s.dataset.fase;
  $("quien").innerHTML = `<span class="chip" style="--c:${c}">${quien}</span>`;
  [...$("fases").children].forEach((b, j) => { b.className = j < k ? "hecha" : j === k ? "actual" : ""; });
  pintarNotas();
}
const visibles = new Map();
const io = new IntersectionObserver(ents => {
  for (const e of ents) {
    visibles.set(e.target, e.intersectionRatio);
    if (e.isIntersecting && e.intersectionRatio > 0.2 && !e.target.classList.contains("vista")) {
      e.target.classList.add("vista");
      e.target.dispatchEvent(new CustomEvent("entra"));
    }
  }
  let mejor = actual, max = 0;
  escenas.forEach((s, k) => { const r = visibles.get(s) || 0; if (r > max) { max = r; mejor = k; } });
  if (mejor !== actual || !$("quien").innerHTML) marcarActual(mejor);
}, { threshold: [0, .2, .4, .6, .8, 1] });
escenas.forEach(s => io.observe(s));
marcarActual(0);

document.addEventListener("keydown", ev => {
  if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
  const t = ev.target, enControl = t.matches && t.matches("input, textarea, select");
  const k = ev.key;
  if ((k === "ArrowRight" || k === "PageDown" || (k === " " && !t.matches("button")) || (k === "ArrowDown" && !enControl)) && !(enControl && k.startsWith("Arrow"))) { ev.preventDefault(); ir(actual + 1); }
  else if ((k === "ArrowLeft" || k === "PageUp" || (k === "ArrowUp" && !enControl)) && !(enControl && k.startsWith("Arrow"))) { ev.preventDefault(); ir(actual - 1); }
  else if (k === "Home") { ev.preventDefault(); ir(0); }
  else if (k === "End") { ev.preventDefault(); ir(escenas.length - 1); }
  else if (k === "n" || k === "N") alternarNotas();
  else if (k === "t" || k === "T") alternarTema();
  else if (k === "f" || k === "F") pantallaCompleta();
});

// ---------------- Guion (notas del presentador) ----------------
fetch("data/guion.json").then(r => r.json()).then(g => { for (const s of g) GUION[s.id] = s; pintarNotas(); }).catch(() => {});
function pintarNotas() {
  const el = $("notas"); if (el.hidden) return;
  const s = escenas[actual], g = GUION[s.id];
  el.style.setProperty("--c", COLOR_QUIEN[s.dataset.quien]);
  el.innerHTML = g ? `<span class="label">${s.dataset.fase} · ${g.quien}</span><h4>${g.titulo}</h4><p class="acc">${g.accion}</p><p>${g.texto}</p>`
    : `<p>Sin guion para esta escena.</p>`;
}
function alternarNotas() { $("notas").hidden = !$("notas").hidden; pintarNotas(); }
function alternarTema() {
  const r = document.documentElement, nuevo = r.dataset.theme === "light" ? "dark" : "light";
  r.dataset.theme = nuevo; try { localStorage.setItem("centinela-tema", nuevo); } catch (e) {}
  leerColores(); CEN.alCambiarTema.forEach(f => f());
}
function pantallaCompleta() {
  try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch (e) {}
}
$("bNotas").onclick = alternarNotas; $("bTema").onclick = alternarTema; $("bFull").onclick = pantallaCompleta;

// ---------------- Portada: cielo con órbitas ----------------
(function cielo() {
  const c = $("cielo"), g = c.getContext("2d");
  let d = 1, estrellas = [], t0 = performance.now(), activo = true;
  function preparar() {
    d = ajustarCanvas(c);
    estrellas = Array.from({ length: 220 }, () => ({ x: Math.random() * c.width, y: Math.random() * c.height, r: Math.random() * 1.3 * d + .3 * d, f: Math.random() * 6 }));
  }
  const orbitas = [[1, 0.017, 0, "earth"], [1.52, 0.09, .6, "muted"], [2.6, 0.15, 2.1, "muted"], [1.9, 0.62, 4.0, "hit"], [2.3, 0.45, 1.2, "far"], [1.4, 0.55, 5.4, "small"]];
  function cuadro(t) {
    if (!activo) return requestAnimationFrame(cuadro);
    const C = CEN.colores, W = c.width, H = c.height, dt = (t - t0) / 1000;
    g.clearRect(0, 0, W, H);
    for (const s of estrellas) { g.fillStyle = hexA(C.ink, .25 + .25 * Math.sin(dt * 1.3 + s.f)); g.beginPath(); g.arc(s.x, s.y, s.r, 0, 7); g.fill(); }
    const cx = W * (W > H ? .74 : .5), cy = H * (W > H ? .5 : .78), s = Math.min(W, H) * (W > H ? .17 : .13);
    for (const [a, e, ang, col] of orbitas) {
      const b = a * Math.sqrt(1 - e * e), cc = a * e;
      g.strokeStyle = hexA(C[col], col === "muted" ? .25 : .55); g.lineWidth = (col === "earth" ? 2 : 1.4) * d;
      g.beginPath(); g.ellipse(cx - cc * s * Math.cos(ang), cy - cc * s * Math.sin(ang), a * s, b * s, ang, 0, 7); g.stroke();
      const E = dt * 0.5 / Math.pow(a, 1.5) + ang * 3, x = a * (Math.cos(E) - e), y = b * Math.sin(E);
      g.fillStyle = C[col === "muted" ? "orbit" : col];
      g.beginPath(); g.arc(cx + s * (x * Math.cos(ang) - y * Math.sin(ang)), cy + s * (x * Math.sin(ang) + y * Math.cos(ang)), (col === "earth" ? 4 : 3) * d, 0, 7); g.fill();
    }
    g.fillStyle = C.sun; g.beginPath(); g.arc(cx, cy, 7 * d, 0, 7); g.fill();
    requestAnimationFrame(cuadro);
  }
  preparar(); new ResizeObserver(preparar).observe(c);
  new IntersectionObserver(e => { activo = e[0].isIntersecting; }).observe($("portada"));
  requestAnimationFrame(cuadro);
})();

// ---------------- Problema: contador y rejilla de 546 ----------------
(function problema() {
  const rej = $("rejilla"), cual = 317;
  rej.innerHTML = Array.from({ length: 546 }, (_, k) => `<i${k === cual ? ' class="peligro"' : ""}></i>`).join("");
  $("verPeligro").onclick = () => { rej.classList.toggle("ver"); $("verPeligro").textContent = rej.classList.contains("ver") ? "Ocultar" : "Mostrar el peligroso"; };
  $("problema").addEventListener("entra", () => {
    const el = $("contador"), fin = 1281510, t0 = performance.now();
    (function paso(t) { const f = Math.min(1, (t - t0) / 1600), v = fin * (1 - Math.pow(1 - f, 3)); el.textContent = fmt(v); if (f < 1) requestAnimationFrame(paso); })(t0);
  });
})();

// ---------------- Preparación: embudo ----------------
$("preparacion").addEventListener("entra", () => {
  document.querySelectorAll("#embudo .b").forEach((b, k) => setTimeout(() => { b.style.width = b.dataset.w + "%"; }, 150 + k * 260));
});
// Sin animación (o si el observador no corre) el embudo queda dibujado igual
if (matchMedia("(prefers-reduced-motion: reduce)").matches) document.querySelectorAll("#embudo .b").forEach(b => b.style.width = b.dataset.w + "%");

// ---------------- Modelo: pesos ----------------
(function pesos() {
  const max = 10.34;
  document.querySelectorAll("#pesos i").forEach(i => {
    const v = +i.dataset.v, w = Math.max(.6, Math.abs(v) / max * 50);
    i.style.width = w + "%"; i.style.background = v < 0 ? "var(--hit)" : "var(--emma)";
    if (v < 0) i.style.right = "50%"; else i.style.left = "50%";
  });
})();

// ---------------- Exploración: dispersión perihelio vs excentricidad ----------------
(function dispersion() {
  const c = $("disp"), g = c.getContext("2d"), tip = $("tip");
  let d = 1, puntos = [];
  const X0 = 0, X1 = 4.2, mL = 46, mB = 38, mT = 14, mR = 14;
  function px(q, W) { return mL * d + (q - X0) / (X1 - X0) * (W - (mL + mR) * d); }
  function py(e, H) { return H - mB * d - e * (H - (mB + mT) * d); }
  function dibujar() {
    if (!CEN.datos.length) return;
    d = ajustarCanvas(c, w => w * 3 / 4);
    const C = CEN.colores, W = c.width, H = c.height;
    g.clearRect(0, 0, W, H); g.fillStyle = C.panel; g.fillRect(0, 0, W, H);
    g.font = `${11 * d}px JetBrains Mono, monospace`; g.lineWidth = 1 * d;
    for (let q = 0; q <= 4; q++) { const x = px(q, W); g.strokeStyle = C.grid; g.beginPath(); g.moveTo(x, mT * d); g.lineTo(x, H - mB * d); g.stroke(); g.fillStyle = C.muted; g.fillText(q + "", x - 3 * d, H - mB * d + 16 * d); }
    for (let e = 0; e <= 1.001; e += .25) { const y = py(e, H); g.strokeStyle = C.grid; g.beginPath(); g.moveTo(mL * d, y); g.lineTo(W - mR * d, y); g.stroke(); g.fillStyle = C.muted; g.fillText(e.toFixed(2).replace(".", ","), 4 * d, y + 4 * d); }
    g.fillStyle = C.muted; g.fillText("Perihelio (UA) →", W - 150 * d, H - 6 * d);
    g.save(); g.translate(12 * d, mT * d + 100 * d); g.restore();
    g.fillText("↑ Excentricidad", mL * d + 6 * d, mT * d + 12 * d);
    // zona de la Tierra
    const x13 = px(1.3, W); g.fillStyle = hexA(C.earth, .07); g.fillRect(mL * d, mT * d, x13 - mL * d, H - (mB + mT) * d);
    g.setLineDash([4 * d, 4 * d]); g.strokeStyle = C.earth; g.beginPath(); g.moveTo(x13, mT * d); g.lineTo(x13, H - mB * d); g.stroke(); g.setLineDash([]);
    g.fillStyle = C.earth; g.fillText("1,3 UA", x13 + 5 * d, mT * d + 28 * d);
    puntos = [];
    for (const a of CEN.datos) { if (a.q > X1) continue; const p = { x: px(a.q, W), y: py(a.e, H), a }; puntos.push(p); if (!a.pha) { g.fillStyle = hexA(C.orbit, .28); g.fillRect(p.x - 1 * d, p.y - 1 * d, 2 * d, 2 * d); } }
    for (const p of puntos) if (p.a.pha) { g.fillStyle = C.hit; g.beginPath(); g.arc(p.x, p.y, 2.4 * d, 0, 7); g.fill(); }
    const x106 = px(1.06, W); g.strokeStyle = C.hit; g.beginPath(); g.moveTo(x106, mT * d); g.lineTo(x106, H - mB * d); g.stroke();
    g.fillStyle = C.hit; g.fillText("máx. 1,06", x106 + 5 * d, mT * d + 46 * d);
  }
  c.addEventListener("mousemove", ev => {
    const r = c.getBoundingClientRect(), mx = (ev.clientX - r.left) * d, my = (ev.clientY - r.top) * d;
    let best = null, bd = (10 * d) ** 2;
    for (const p of puntos) { const dd = (p.x - mx) ** 2 + (p.y - my) ** 2; if (dd < bd || (best && !best.a.pha && p.a.pha && dd < (14 * d) ** 2)) { bd = dd; best = p; } }
    if (!best) { tip.style.opacity = 0; return; }
    tip.textContent = `${best.a.name} · q ${coma(best.a.q.toFixed(2))} · e ${coma(best.a.e.toFixed(2))}${best.a.pha ? " · peligroso" : ""}`;
    tip.style.left = (best.x / d + c.offsetLeft) + "px"; tip.style.top = (best.y / d + c.offsetTop) + "px"; tip.style.opacity = 1;
  });
  c.addEventListener("mouseleave", () => tip.style.opacity = 0);
  CEN.listos.then(datos => {
    const n = datos.filter(a => a.pha).length;
    $("dispNota").textContent = `Muestra del examen: ${fmt(datos.length)} asteroides, de ellos los ${n} peligrosos (en rojo). Pase el mouse por un punto para ver cuál es.`;
    dibujar();
  });
  new ResizeObserver(dibujar).observe(c);
  CEN.alCambiarTema.push(dibujar);
})();

// ---------------- Umbral ----------------
function ponerUmbral(v) {
  CEN.estado.umbral = v;
  const U = META.umbrales, u = U.find(x => x.umbral === v), base = U[0];
  for (const b of $("umbrales").children) b.setAttribute("aria-pressed", +b.dataset.v === v ? "true" : "false");
  $("uFA").textContent = fmt(u.falsas_alarmas);
  $("uFN").textContent = fmt(u.escapados); $("uFN").style.color = u.escapados ? "var(--hit)" : "var(--ok)";
  const baja = Math.round((1 - u.falsas_alarmas / base.falsas_alarmas) * 100);
  $("uLee").textContent = u.escapados === 0
    ? (v === 0.5 ? "Es el umbral normal: no se escapa ninguno, pero da la mayor cantidad de falsas alarmas." : `Frente al umbral 0,5 las falsas alarmas bajan ${baja} % y no se escapa ningún peligroso.${v === 0.8 ? " Es el que recomendamos." : ""}`)
    : `Las falsas alarmas bajan ${baja} %, pero ya se escapan ${u.escapados} peligrosos. Ese costo no vale la pena.`;
  const maxFA = Math.max(...U.map(x => x.falsas_alarmas)), maxFN = Math.max(...U.map(x => x.escapados));
  $("colFA").innerHTML = U.map(x => `<button class="col${x.umbral === v ? " sel" : ""}" data-v="${x.umbral}" aria-label="Umbral ${coma(x.umbral)}: ${x.falsas_alarmas} falsas alarmas"><span>${fmt(x.falsas_alarmas)}</span><i style="height:${x.falsas_alarmas / maxFA * 80}%"></i></button>`).join("");
  $("colFN").innerHTML = U.map(x => `<button class="col${x.umbral === v ? " sel" : ""}" data-v="${x.umbral}" aria-label="Umbral ${coma(x.umbral)}: ${x.escapados} escapados"><span>${x.escapados}</span><i style="height:${x.escapados / maxFN * 66}%"></i></button>`).join("");
  $("marcasU").innerHTML = U.map(x => `<span class="${x.umbral === v ? "sel" : ""}">${coma(x.umbral)}</span>`).join("");
  document.querySelectorAll(".m-umbral").forEach(m => m.style.left = (v * 100) + "%");
  document.querySelectorAll(".m-umbral-t").forEach(m => m.textContent = "umbral " + coma(v));
  CEN.alCambiarUmbral.forEach(f => f(v));
}
$("umbrales").innerHTML = META.umbrales.map(u => `<button data-v="${u.umbral}">${coma(u.umbral)}</button>`).join("");
$("umbrales").addEventListener("click", ev => { const b = ev.target.closest("button"); if (b) ponerUmbral(+b.dataset.v); });
for (const id of ["colFA", "colFN"]) $(id).addEventListener("click", ev => { const b = ev.target.closest(".col"); if (b) ponerUmbral(+b.dataset.v); });

// ---------------- Laboratorio ----------------
(function laboratorio() {
  const mini = $("mini"), g = mini.getContext("2d");
  function actualizar() {
    const q = +$("sq").value, e = +$("se").value, i = +$("si").value, u = CEN.estado.umbral;
    $("oq").textContent = coma(q.toFixed(2)) + " UA"; $("oe").textContent = coma(e.toFixed(2)); $("oi").textContent = coma(i.toFixed(1)) + "°";
    const p = probabilidad(q, e, i), al = p >= u;
    $("lP").textContent = pct(p); $("lLleno").style.width = (p * 100) + "%"; $("lLleno").style.background = al ? "var(--hit)" : "var(--orbit)";
    $("lVer").textContent = al ? "Daría la alerta" : "Lo descartaría";
    $("lPill").className = "pill " + (al ? "hit" : "ok"); $("lPill").textContent = al ? "revisar con telescopio" : "sin riesgo para el modelo";
    $("lPor").textContent = q <= 1.3
      ? "Su perihelio es menor a 1,3 UA: entra a la zona de la Tierra, y eso es lo que más sube la probabilidad."
      : "Su perihelio es mayor a 1,3 UA: nunca entra a la zona de la Tierra, así que el modelo lo ve tranquilo aunque la órbita sea alargada.";
    dibujar();
  }
  function dibujar() {
    const d = ajustarCanvas(mini, w => w), C = CEN.colores, W = mini.width, cx = W / 2, cy = W / 2;
    const q = +$("sq").value, e = +$("se").value, a = q / (1 - e), alcance = Math.max(1.6, Math.min(a * (1 + e), 12) * 1.05), s = (W / 2 - 10 * d) / alcance;
    g.clearRect(0, 0, W, W); g.fillStyle = C.panel; g.fillRect(0, 0, W, W);
    g.strokeStyle = C.earth; g.lineWidth = 2 * d; g.beginPath(); g.arc(cx, cy, s, 0, 7); g.stroke();
    g.setLineDash([3 * d, 4 * d]); g.strokeStyle = hexA(C.muted, .6); g.lineWidth = 1 * d; g.beginPath(); g.arc(cx, cy, 1.3 * s, 0, 7); g.stroke(); g.setLineDash([]);
    const p = probabilidad(q, e, +$("si").value), col = p >= CEN.estado.umbral ? C.hit : C.orbit, ang = -Math.PI / 5, c2 = a * e, b = a * Math.sqrt(1 - e * e);
    g.strokeStyle = col; g.lineWidth = 2.4 * d; g.beginPath(); g.ellipse(cx - c2 * s * Math.cos(ang), cy - c2 * s * Math.sin(ang), a * s, b * s, ang, 0, 7); g.stroke();
    g.fillStyle = C.sun; g.beginPath(); g.arc(cx, cy, 5 * d, 0, 7); g.fill();
    g.fillStyle = C.muted; g.font = `${11 * d}px JetBrains Mono, monospace`;
    g.fillText("Tierra", cx + s * .72 + 4 * d, cy - s * .72); g.fillText("zona de 1,3 UA", cx - 1.3 * s * .72 - 100 * d, cy + 1.3 * s * .72 + 14 * d);
  }
  for (const id of ["sq", "se", "si"]) $(id).addEventListener("input", actualizar);
  $("atajos").addEventListener("click", ev => { const b = ev.target.closest("button"); if (!b) return; $("sq").value = b.dataset.q; $("se").value = b.dataset.e; $("si").value = b.dataset.i; actualizar(); });
  CEN.alCambiarUmbral.push(actualizar); CEN.alCambiarTema.push(dibujar);
  new ResizeObserver(dibujar).observe(mini);
  actualizar();
})();

// ---------------- QR de la página ----------------
try { if (window.QRCode) new QRCode($("qr"), { text: location.href.split("#")[0], width: 116, height: 116, colorDark: "#0D1A2B", colorLight: "#ffffff" }); } catch (e) {}
