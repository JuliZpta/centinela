// Centinela · modo en vivo con los asteroides de esta semana (NASA NeoWs, a través de /api/asteroides-hoy).
(function nasa() {
  let ultimo = null, ultimoCache = false;
  const CLAVE = "centinela-nasa";
  const lunar = v => v == null ? "s/d" : coma(v.toFixed(1)) + " veces la distancia a la Luna";

  function pintar(datos, desdeCache) {
    ultimo = datos; ultimoCache = desdeCache;
    const u = CEN.estado.umbral, L = datos.asteroides.map(a => ({ ...a, p: probabilidad(a.q, a.e, a.i) }));
    const alertas = L.filter(a => a.p >= u).length, nasaSi = L.filter(a => a.peligroso_nasa).length;
    const coinciden = L.filter(a => (a.p >= u) === a.peligroso_nasa).length;
    const cuando = new Date(datos.consultado).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
    $("nasaEstado").textContent = (desdeCache ? "Sin conexión con la NASA ahora mismo. Se muestra la última consulta guardada, del " : "Consulta del ") +
      `${cuando}. Semana del ${datos.desde} al ${datos.hasta}: ${datos.total_semana} asteroides pasan cerca; aquí se revisan ${L.length}.`;
    $("nasaResumen").hidden = false;
    $("nasaResumen").innerHTML = `<div><span class="label">Revisados</span><b class="mono">${L.length}</b></div>` +
      `<div><span class="label">Alertas del modelo</span><b class="mono" style="color:var(--hit)">${alertas}</b></div>` +
      `<div><span class="label">Peligrosos según la NASA</span><b class="mono">${nasaSi}</b></div>` +
      `<div><span class="label">Veredictos que coinciden</span><b class="mono" style="color:var(--ok)">${coinciden} de ${L.length}</b></div>`;
    $("nasaLista").innerHTML = L.map(a => {
      const al = a.p >= u, tam = a.diametro_min_m != null ? `${Math.round(a.diametro_min_m)} a ${Math.round(a.diametro_max_m)} m` : "tamaño s/d";
      return `<article class="neo${al ? " alerta" : ""}"><header><b>${a.nombre.replace(/[<>&]/g, "")}</b><span class="mono nota">${a.clase || ""}</span></header>` +
        `<span class="datos">Pasa el ${a.fecha} · a ${lunar(a.distancia_lunar)}</span>` +
        `<span class="datos">q ${coma(a.q.toFixed(3))} UA · e ${coma(a.e.toFixed(3))} · i ${coma(a.i.toFixed(1))}° · ${tam}</span>` +
        `<div class="vs"><div style="${al ? "background:var(--hit-soft)" : ""}"><span class="label">Centinela</span><b style="color:${al ? "var(--hit)" : "var(--ok)"}">${al ? "Alerta" : "Descartado"} · ${pct(a.p)}</b></div>` +
        `<div style="${a.peligroso_nasa ? "background:var(--hit-soft)" : ""}"><span class="label">NASA</span><b>${a.peligroso_nasa ? "Potencialmente peligroso" : "No peligroso"}</b></div></div></article>`;
    }).join("");
  }
  async function consultar() {
    $("nasaBtn").disabled = true; $("nasaEstado").textContent = "Consultando a la NASA…";
    try {
      const r = await fetch("/api/asteroides-hoy", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok || !j.asteroides) throw new Error(j.error || "Respuesta inválida");
      try { localStorage.setItem(CLAVE, JSON.stringify(j)); } catch (e) {}
      pintar(j, false);
    } catch (err) {
      let guardado = null; try { guardado = JSON.parse(localStorage.getItem(CLAVE)); } catch (e) {}
      if (guardado && guardado.asteroides) pintar(guardado, true);
      else $("nasaEstado").textContent = `No se pudo consultar a la NASA (${err.message}). Revise la conexión o la llave NASA_API_KEY en Vercel; mientras tanto, el radar funciona con los datos del examen.`;
    } finally { $("nasaBtn").disabled = false; }
  }
  $("nasaBtn").onclick = consultar;
  CEN.alCambiarUmbral.push(() => { if (ultimo) pintar(ultimo, ultimoCache); });
})();

// Con todos los módulos listos, se aplica el umbral recomendado
ponerUmbral(0.8);
