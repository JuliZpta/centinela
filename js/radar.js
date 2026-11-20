// Centinela · el radar en vivo y las bandejas de alertas.
(function radar() {
  const cv = $("radar"), ctx = cv.getContext("2d");
  const st = { idx: 0, corriendo: false, vel: 1, zoom: 3.8, sonido: true };
  const POR_SEG = { 1: 1.4, 5: 7, 25: 35, 150: 210 };
  let D = [], acc = 0, tPrev = 0, actualA = null, Eact = 0, rastros = [], audio = null, ultBeep = 0, ultToast = 0, DPR = 1;
  let cnt = nuevoConteo();
  const listas = { hit: [], small: [], far: [], esc: [] };

  function nuevoConteo() { return { tp: 0, fn: 0, fp: 0, tn: 0, g: { hit: 0, small: 0, far: 0 } }; }
  function angulo(s) { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return ((h >>> 0) % 3600) / 3600 * Math.PI * 2; }
  function grupo(a) { if (a.pha) return "hit"; return (a.moid == null || a.moid > 0.05) ? "far" : "small"; }

  function ajustar() { DPR = ajustarCanvas(cv, w => w); }
  ajustar(); new ResizeObserver(ajustar).observe(cv);

  function elipse(cx, cy, s, a, e, ang) {
    const c = a * e, b = a * Math.sqrt(1 - e * e);
    ctx.beginPath(); ctx.ellipse(cx - c * s * Math.cos(ang), cy - c * s * Math.sin(ang), a * s, b * s, ang, 0, Math.PI * 2);
  }
  function posicion(cx, cy, s, a, e, ang, E) {
    const b = a * Math.sqrt(1 - e * e), x = a * (Math.cos(E) - e), y = b * Math.sin(E);
    return [cx + s * (x * Math.cos(ang) - y * Math.sin(ang)), cy + s * (x * Math.sin(ang) + y * Math.cos(ang))];
  }
  let Etierra = 0, barrido = 0;
  function dibujar(dt) {
    const C = CEN.colores, W = cv.width, cx = W / 2, cy = W / 2, s = (W / 2 - 14 * DPR) / st.zoom, d = DPR;
    ctx.clearRect(0, 0, W, W); ctx.fillStyle = C.panel; ctx.fillRect(0, 0, W, W);
    ctx.lineWidth = d; ctx.font = `${10 * d}px JetBrains Mono, monospace`;
    for (let r = 1; r <= Math.floor(st.zoom); r++) {
      ctx.strokeStyle = C.grid; ctx.beginPath(); ctx.arc(cx, cy, r * s, 0, 7); ctx.stroke();
      ctx.fillStyle = C.muted; ctx.fillText(r + " UA", cx + r * s * .707 + 4 * d, cy - r * s * .707);
    }
    ctx.strokeStyle = C.grid; ctx.beginPath(); ctx.moveTo(cx, 8 * d); ctx.lineTo(cx, W - 8 * d); ctx.moveTo(8 * d, cy); ctx.lineTo(W - 8 * d, cy); ctx.stroke();
    if (st.corriendo) barrido += dt * .0012;
    if (ctx.createConicGradient) {
      const g = ctx.createConicGradient(barrido, cx, cy);
      g.addColorStop(0, hexA(C.orbit, .2)); g.addColorStop(.08, hexA(C.orbit, 0)); g.addColorStop(1, hexA(C.orbit, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, st.zoom * s, 0, 7); ctx.fill();
    }
    for (const [r, n] of [[.387, "Mercurio"], [.723, "Venus"], [1, "Tierra"], [1.524, "Marte"], [5.2, "Júpiter"]]) {
      if (r > st.zoom) continue;
      const t = n === "Tierra";
      ctx.strokeStyle = t ? C.earth : hexA(C.muted, .55); ctx.lineWidth = (t ? 2 : 1) * d;
      ctx.setLineDash(t ? [] : [3 * d, 4 * d]); ctx.beginPath(); ctx.arc(cx, cy, r * s, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      if (!t && r * s > 30 * d) { ctx.fillStyle = C.muted; ctx.fillText(n, cx - r * s * .707 - 4 * d - ctx.measureText(n).width, cy + r * s * .707 + 10 * d); }
    }
    for (const r of rastros) { ctx.strokeStyle = hexA(C[r.g], r.g === "hit" ? .6 : .22); ctx.lineWidth = (r.g === "hit" ? 1.6 : 1) * d; elipse(cx, cy, s, r.a, r.e, r.ang); ctx.stroke(); }
    Etierra += dt * (st.corriendo ? .0006 * Math.min(st.vel, 5) : .00015);
    ctx.fillStyle = C.sun; ctx.beginPath(); ctx.arc(cx, cy, 6 * d, 0, 7); ctx.fill();
    ctx.fillStyle = C.earth; ctx.beginPath(); ctx.arc(cx + s * Math.cos(Etierra), cy + s * Math.sin(Etierra), 4.5 * d, 0, 7); ctx.fill();
    if (actualA) {
      const a = actualA, al = a.p >= CEN.estado.umbral, col = al ? C[grupo(a)] : C.orbit;
      ctx.strokeStyle = col; ctx.lineWidth = (al ? 2.4 : 1.6) * d;
      if (al) { ctx.shadowColor = col; ctx.shadowBlur = 12 * d; }
      elipse(cx, cy, s, a.a, a.e, a.ang); ctx.stroke(); ctx.shadowBlur = 0;
      Eact += dt * .004 / Math.pow(a.a, 1.5) * (1 + a.e);
      const [x, y] = posicion(cx, cy, s, a.a, a.e, a.ang, Eact);
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 5 * d, 0, 7); ctx.fill();
      const [px, py] = posicion(cx, cy, s, a.a, a.e, a.ang, 0);
      ctx.strokeStyle = hexA(col, .6); ctx.setLineDash([2 * d, 3 * d]); ctx.lineWidth = d; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = C.ink; ctx.font = `600 ${11 * d}px JetBrains Mono, monospace`; ctx.fillText("q = " + coma(a.q.toFixed(2)) + " UA", px + 6 * d, py - 6 * d);
    }
  }

  let visible = false;
  new IntersectionObserver(e => { visible = e[0].isIntersecting; }).observe(cv);
  function ciclo(t) {
    const dt = Math.min(100, t - (tPrev || t)); tPrev = t;
    if (st.corriendo && D.length) {
      acc += dt / 1000 * POR_SEG[st.vel];
      let n = Math.floor(acc); acc -= n;
      while (n-- > 0 && st.idx < D.length) procesar(D[st.idx++], n === 0);
      if (st.idx >= D.length) { st.corriendo = false; $("play").textContent = "Escaneo completo"; }
    }
    if (visible) dibujar(dt);
    requestAnimationFrame(ciclo);
  }

  function procesar(a, mostrar) {
    const al = a.p >= CEN.estado.umbral;
    if (a.pha && al) cnt.tp++; else if (a.pha) cnt.fn++; else if (al) cnt.fp++; else cnt.tn++;
    if (al) {
      const g = grupo(a); cnt.g[g]++; listas[g].unshift(a); if (listas[g].length > 40) listas[g].pop();
      rastros.push({ a: a.a, e: a.e, ang: a.ang, g }); if (rastros.length > 36) rastros.shift();
      destello(g); pitido(g);
      if (g === "hit") aviso(`Peligroso detectado: ${a.name}`, `Alerta · probabilidad ${pct(a.p)}`, false);
      pintarBandeja(g, true);
    } else if (a.pha) {
      listas.esc.unshift(a); if (listas.esc.length > 40) listas.esc.pop();
      aviso(`Se escapó: ${a.name}`, `Peligroso sin alerta · probabilidad ${pct(a.p)}`, true); pitido("esc"); pintarBandeja("esc", true);
    }
    if (mostrar || st.vel <= 5) { actualA = a; Eact = 0; pintarAhora(a); }
    pintarConteos();
  }
  function recalcular() {
    cnt = nuevoConteo(); for (const k in listas) listas[k] = []; rastros = [];
    for (let k = 0; k < st.idx; k++) {
      const a = D[k], al = a.p >= CEN.estado.umbral;
      if (a.pha && al) cnt.tp++; else if (a.pha) cnt.fn++; else if (al) cnt.fp++; else cnt.tn++;
      if (al) { const g = grupo(a); cnt.g[g]++; listas[g].unshift(a); rastros.push({ a: a.a, e: a.e, ang: a.ang, g }); }
      else if (a.pha) listas.esc.unshift(a);
    }
    for (const k in listas) listas[k] = listas[k].slice(0, 40);
    rastros = rastros.slice(-36);
    ["hit", "small", "far", "esc"].forEach(g => pintarBandeja(g, false));
    pintarConteos(); if (actualA) pintarAhora(actualA);
  }

  function pintarAhora(a) {
    $("aNombre").textContent = a.name;
    $("aQ").textContent = coma(a.q.toFixed(3)) + " UA"; $("aE").textContent = coma(a.e.toFixed(3)); $("aI").textContent = coma(a.i.toFixed(1)) + "°";
    $("aP").textContent = pct(a.p);
    const al = a.p >= CEN.estado.umbral, g = grupo(a), pill = $("aPill");
    $("aLleno").style.width = (a.p * 100) + "%"; $("aLleno").style.background = al ? `var(--${g})` : "var(--orbit)";
    if (al) { $("aVer").textContent = "Alerta"; pill.className = "pill " + g; pill.textContent = g === "hit" ? "peligroso confirmado" : g === "small" ? "falsa alarma: pequeño" : "falsa alarma: órbita lejana"; }
    else if (a.pha) { $("aVer").textContent = "Se escapó"; pill.className = "pill hit"; pill.textContent = "era peligroso"; }
    else { $("aVer").textContent = "Descartado"; pill.className = "pill ok"; pill.textContent = "bien descartado"; }
    $("progreso").textContent = `${fmt(st.idx)} de ${fmt(D.length)} revisados · clase ${a.cls}`;
  }
  function pintarConteos() {
    $("cRev").textContent = fmt(st.idx); $("cAl").textContent = fmt(cnt.tp + cnt.fp); $("cTP").textContent = fmt(cnt.tp);
    $("cFN").textContent = fmt(cnt.fn); $("cFNc").classList.toggle("mal", cnt.fn > 0);
    $("mTP").textContent = fmt(cnt.tp); $("mFN").textContent = fmt(cnt.fn); $("mFP").textContent = fmt(cnt.fp); $("mTN").textContent = fmt(cnt.tn);
    const tot = cnt.g.hit + cnt.g.small + cnt.g.far || 1;
    for (const [g, id] of [["hit", "Hit"], ["small", "Small"], ["far", "Far"]]) { $("b" + id).textContent = fmt(cnt.g[g]); $("q" + id).style.width = (cnt.g[g] / tot * 100) + "%"; }
    $("bEsc").textContent = fmt(cnt.fn); $("escFila").hidden = cnt.fn === 0;
  }
  const pendiente = {};
  function pintarBandeja(g, animar) {
    if (pendiente[g]) return; pendiente[g] = true;
    requestAnimationFrame(() => {
      pendiente[g] = false;
      const el = $({ hit: "lHit", small: "lSmall", far: "lFar", esc: "lEsc" }[g]), arr = listas[g].slice(0, 24), cv2 = g === "esc" ? "hit" : g;
      if (!arr.length) { el.innerHTML = g === "esc" ? "" : '<p class="vacio">Inicie el radar para ver alertas.</p>'; return; }
      el.innerHTML = arr.map((a, k) => {
        const tam = a.diam ? `${coma(a.diam.toFixed(2))} km` : (a.H != null ? `brillo H ${coma(a.H.toFixed(1))}` : "tamaño sin dato");
        return `<div class="tarjeta${animar && k === 0 && st.vel <= 25 ? " nueva" : ""}" style="--c:var(--${cv2})"><b>${esc(a.name)}</b><span class="p">${pct(a.p)}</span>` +
          `<span class="d">${a.cls} · q ${coma(a.q.toFixed(2))} UA · MOID ${a.moid != null ? coma(a.moid.toFixed(3)) : "s/d"} UA · ${tam}</span></div>`;
      }).join("");
    });
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function destello(g) { if (st.vel > 25 && g !== "hit") return; const w = $("radarWrap"); w.classList.remove("f-hit", "f-far", "f-small"); void w.offsetWidth; w.classList.add("f-" + g); }
  let tAviso = 0;
  function aviso(texto, etiqueta, escapo) {
    const ahora = performance.now(); if (ahora - ultToast < (st.vel > 25 ? 900 : 300)) return; ultToast = ahora;
    const t = $("toast"); $("toastText").textContent = texto; $("toastLabel").textContent = etiqueta;
    t.classList.toggle("escape", escapo); t.classList.add("ver"); clearTimeout(tAviso);
    tAviso = setTimeout(() => t.classList.remove("ver"), st.vel > 25 ? 1100 : 2200);
  }
  function pitido(g) {
    if (!st.sonido || !audio) return;
    const ahora = performance.now(); if (g !== "hit" && g !== "esc" && ahora - ultBeep < 180) return; if (ahora - ultBeep < 70) return; ultBeep = ahora;
    const tonos = { hit: [880, 1320], small: [520], far: [440], esc: [330, 220] }[g];
    tonos.forEach((f, k) => {
      const o = audio.createOscillator(), v = audio.createGain(), t0 = audio.currentTime + k * .11;
      o.type = g === "hit" ? "triangle" : "sine"; o.frequency.value = f;
      v.gain.setValueAtTime(.0001, t0); v.gain.exponentialRampToValueAtTime(g === "hit" ? .18 : .06, t0 + .01); v.gain.exponentialRampToValueAtTime(.0001, t0 + .1);
      o.connect(v).connect(audio.destination); o.start(t0); o.stop(t0 + .12);
    });
  }

  $("play").onclick = () => {
    if (!D.length) return;
    if (!audio) { try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audio = null; } }
    if (st.idx >= D.length) return;
    st.corriendo = !st.corriendo; $("play").textContent = st.corriendo ? "Pausar" : "Seguir escaneando";
  };
  $("reset").onclick = () => {
    st.idx = 0; st.corriendo = false; actualA = null; recalcular();
    $("play").textContent = "Iniciar escaneo"; $("aNombre").textContent = "Listo para escanear"; $("progreso").textContent = `0 de ${fmt(D.length)} revisados`;
    for (const id of ["aQ", "aE", "aI", "aP", "aVer"]) $(id).textContent = "-";
    $("aLleno").style.width = "0%"; $("aPill").className = "pill"; $("aPill").textContent = "sin revisar";
  };
  function segmento(id, f) {
    $(id).addEventListener("click", ev => {
      const b = ev.target.closest("button"); if (!b) return;
      for (const x of $(id).querySelectorAll("button")) x.setAttribute("aria-pressed", x === b ? "true" : "false");
      f(parseFloat(b.dataset.v));
    });
  }
  segmento("vel", v => st.vel = v);
  segmento("zoom", v => st.zoom = v);
  $("sonido").onclick = () => { st.sonido = !st.sonido; $("sonido").setAttribute("aria-pressed", st.sonido); $("sonido").textContent = "Sonido: " + (st.sonido ? "sí" : "no"); };
  CEN.alCambiarUmbral.push(recalcular);

  CEN.listos.then(datos => {
    D = datos; for (const a of D) a.ang = angulo(a.name);
    const n = D.filter(a => a.pha).length;
    $("progreso").textContent = `0 de ${fmt(D.length)} revisados`;
    $("muestraTxt").textContent = `Muestra del examen: ${fmt(D.length)} asteroides mezclados (los ${n} peligrosos, 2.500 falsas alarmas y 9.000 descartados). En el catálogo real hay 1 peligroso por cada 546.`;
  });
  requestAnimationFrame(ciclo);
})();
