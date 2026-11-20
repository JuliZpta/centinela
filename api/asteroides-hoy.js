// Función de Vercel: consulta a la NASA (NeoWs) los asteroides que pasan cerca de la Tierra
// en los próximos 7 días y devuelve, para cada uno, los tres datos de órbita que usa el modelo.
// Llave: variable de entorno NASA_API_KEY (gratis en https://api.nasa.gov). Si no existe, usa DEMO_KEY.
// La respuesta queda guardada 6 horas en la caché de Vercel, así que la NASA casi no se consulta.

const BASE = "https://api.nasa.gov/neo/rest/v1";
const MAXIMO = 14; // asteroides que se revisan con detalle (una consulta por cada uno)

function fecha(d) { return d.toISOString().slice(0, 10); }
const num = v => (v == null || v === "" ? null : Number(v));

async function traer(url) {
  const r = await fetch(url, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`La NASA respondió ${r.status}`);
  return r.json();
}

module.exports = async (req, res) => {
  const llave = process.env.NASA_API_KEY || "DEMO_KEY";
  const hoy = new Date(), fin = new Date(hoy.getTime() + 6 * 864e5);
  try {
    const feed = await traer(`${BASE}/feed?start_date=${fecha(hoy)}&end_date=${fecha(fin)}&api_key=${llave}`);
    const todos = [];
    for (const [dia, lista] of Object.entries(feed.near_earth_objects || {})) {
      for (const o of lista) {
        const paso = (o.close_approach_data || [])[0] || {};
        todos.push({
          id: o.id, nombre: o.name, dia,
          fecha: paso.close_approach_date_full || paso.close_approach_date || dia,
          distancia_lunar: num(paso.miss_distance && paso.miss_distance.lunar),
          distancia_km: num(paso.miss_distance && paso.miss_distance.kilometers),
          velocidad_kmh: num(paso.relative_velocity && paso.relative_velocity.kilometers_per_hour),
          diametro_min_m: num(o.estimated_diameter && o.estimated_diameter.meters && o.estimated_diameter.meters.estimated_diameter_min),
          diametro_max_m: num(o.estimated_diameter && o.estimated_diameter.meters && o.estimated_diameter.meters.estimated_diameter_max),
          magnitud: num(o.absolute_magnitude_h),
          peligroso_nasa: !!o.is_potentially_hazardous_asteroid,
        });
      }
    }
    // Primero todos los que la NASA marca como peligrosos, luego los que pasan más cerca
    todos.sort((a, b) => (b.peligroso_nasa - a.peligroso_nasa) || ((a.distancia_lunar ?? 1e9) - (b.distancia_lunar ?? 1e9)));
    const elegidos = todos.slice(0, MAXIMO);
    const detalles = await Promise.allSettled(elegidos.map(o => traer(`${BASE}/neo/${o.id}?api_key=${llave}`)));
    const asteroides = [];
    elegidos.forEach((o, k) => {
      const d = detalles[k];
      if (d.status !== "fulfilled" || !d.value.orbital_data) return;
      const od = d.value.orbital_data;
      const q = num(od.perihelion_distance), e = num(od.eccentricity), i = num(od.inclination);
      if (q == null || e == null || i == null) return;
      asteroides.push({ ...o, q, e, i, a: num(od.semi_major_axis), moid: num(od.minimum_orbit_intersection),
        clase: od.orbit_class && od.orbit_class.orbit_class_type || null });
    });
    if (!asteroides.length) throw new Error("La NASA no devolvió datos de órbita");
    res.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=86400");
    res.status(200).json({ fuente: "NASA NeoWs (api.nasa.gov)", consultado: new Date().toISOString(),
      desde: fecha(hoy), hasta: fecha(fin), total_semana: todos.length, asteroides });
  } catch (err) {
    res.setHeader("Cache-Control", "no-store");
    res.status(502).json({ error: String(err.message || err) });
  }
};
