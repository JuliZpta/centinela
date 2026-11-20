// Números del modelo exportados desde Google Colab (Centinela_Exportar.ipynb).
// Mismo modelo del proyecto final: regresión logística con pesos balanceados, semilla 42.
// La probabilidad se calcula así: escalar cada dato, multiplicar por su peso, sumar el intercepto y aplicar la sigmoide.
const META = {
 "modelo": {
  "entradas": [
   "dist_perihelio_au",
   "excentricidad",
   "inclinacion_grados"
  ],
  "media": [
   2.3075783275259956,
   0.1571226842833458,
   9.224586261498724
  ],
  "desviacion": [
   1.0511354647612192,
   0.09236676281057889,
   6.5614019675165
  ],
  "pesos": [
   -10.344359543872713,
   0.1829181540765712,
   0.1929317517782824
  ],
  "intercepto": -10.870855510426063
 },
 "umbrales": [
  {
   "umbral": 0.5,
   "detectados": 467,
   "escapados": 0,
   "falsas_alarmas": 5712,
   "bien_descartados": 248959
  },
  {
   "umbral": 0.6,
   "detectados": 467,
   "escapados": 0,
   "falsas_alarmas": 5475,
   "bien_descartados": 249196
  },
  {
   "umbral": 0.7,
   "detectados": 467,
   "escapados": 0,
   "falsas_alarmas": 5232,
   "bien_descartados": 249439
  },
  {
   "umbral": 0.8,
   "detectados": 467,
   "escapados": 0,
   "falsas_alarmas": 4817,
   "bien_descartados": 249854
  },
  {
   "umbral": 0.85,
   "detectados": 467,
   "escapados": 0,
   "falsas_alarmas": 4458,
   "bien_descartados": 250213
  },
  {
   "umbral": 0.9,
   "detectados": 459,
   "escapados": 8,
   "falsas_alarmas": 3821,
   "bien_descartados": 250850
  },
  {
   "umbral": 0.95,
   "detectados": 401,
   "escapados": 66,
   "falsas_alarmas": 2719,
   "bien_descartados": 251952
  }
 ],
 "totales": {
  "limpios": 1275686,
  "examen": 255138,
  "peligrosos_examen": 467,
  "falsas_examen": 5712,
  "descartados_examen": 248959
 }
};

function probabilidad(q, e, i) {
  const M = META.modelo, x = [q, e, i];
  let z = M.intercepto;
  for (let k = 0; k < 3; k++) z += (x[k] - M.media[k]) / M.desviacion[k] * M.pesos[k];
  return 1 / (1 + Math.exp(-z));
}
