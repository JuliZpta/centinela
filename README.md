# Centinela

Proyecto final de **Seminario de la Ciencia de los Datos** (Ingeniería de Software, Institución Universitaria Pascual Bravo).

Centinela es una exposición web por escenas que cuenta el proyecto completo y muestra el modelo funcionando en vivo: un radar que revisa asteroides uno por uno, da la alerta cuando encuentra uno potencialmente peligroso y agrupa las alertas según lo que pasó en realidad.

**Equipo:** Julián Zapata Arango · Juan José Orrego Arias · Emmanuel Baena · Santiago Cano
**Docente:** Ricardo José Ruiz Gaviria

## Las escenas

| # | Escena | Fase | Presenta |
|---|---|---|---|
| 1 | Portada | Inicio | Julián |
| 2 | Demasiados asteroides | Problema | Julián |
| 3 | La pregunta y los objetivos | Problema | Julián |
| 4 | ¿Qué hace peligroso a un asteroide? | Problema | Julián |
| 5 | Los datos | Metodología | Juan José |
| 6 | Limpiar antes de enseñar | Metodología | Juan José |
| 7 | Son muy raros | Metodología | Juan José |
| 8 | Lo que importa es pasar cerca del Sol | Metodología | Juan José |
| 9 | Cómo aprende el modelo | Metodología | Emmanuel |
| 10 | Cómo medir bien | Resultados | Emmanuel |
| 11 | Encontró los 467 | Resultados | Emmanuel |
| 12 | ¿Es confiable? | Resultados | Emmanuel |
| 13 | El radar en vivo | En vivo | Santiago |
| 14 | Las alertas se agrupan solas | Interpretación | Santiago |
| 15 | Mover el umbral | Interpretación | Santiago |
| 16 | Los asteroides de esta semana (NASA) | En vivo | Santiago |
| 17 | Conclusiones y recomendaciones | Conclusiones | Julián |
| 18 | Pruébelo usted | Cierre | Julián |

## Cómo se maneja en la sustentación

| Tecla | Qué hace |
|---|---|
| → · espacio · Av Pág | Siguiente escena |
| ← · Re Pág | Escena anterior |
| N | Muestra u oculta el guion de la escena |
| F | Pantalla completa |
| T | Cambia entre tema oscuro y claro |

## Publicar en Vercel

1. Entrar a [vercel.com](https://vercel.com) con la cuenta de GitHub.
2. **Add New → Project**, elegir el repositorio `centinela` y dar **Deploy**. No hay que configurar nada: es un sitio estático con una función en `api/`.
3. (Recomendado) Sacar una llave gratis en [api.nasa.gov](https://api.nasa.gov) y agregarla en Vercel: **Settings → Environment Variables**, nombre `NASA_API_KEY`. Luego **Deployments → Redeploy**. Sin llave la página usa `DEMO_KEY`, que tiene un límite bajo de consultas.

## Cómo funciona

- **El modelo** es el mismo del proyecto final: una regresión logística con pesos balanceados, entrenada con perihelio, excentricidad e inclinación (semilla 42). Sus números (escala, pesos e intercepto) se exportaron desde Google Colab a `js/datos.js`, y la página calcula la probabilidad en el navegador con la misma fórmula. Se comprobó en Colab que da exactamente lo mismo que el modelo de Python.
- **Los asteroides del radar** (`data/asteroides.json`) son una muestra del examen: los 467 peligrosos, 2.500 falsas alarmas y 9.000 asteroides bien descartados, mezclados. En el catálogo real hay 1 peligroso por cada 546; la muestra tiene más a propósito para que se vean alertas.
- **Las bandejas de falsas alarmas** se arman con dos datos que el modelo no usa: la distancia mínima entre la órbita del asteroide y la de la Tierra (MOID) y su brillo, que indica el tamaño.
- **El modo NASA** (`api/asteroides-hoy.js`) consulta el servicio NeoWs de la NASA, toma los asteroides que pasan cerca de la Tierra en los próximos 7 días y le pasa al modelo sus tres datos de órbita. La respuesta queda guardada 6 horas en Vercel, y el navegador guarda la última consulta por si no hay conexión en la sustentación.
- **El guion** de cada escena está en `data/guion.json`.

## Datos

NASA JPL Small-Body Database, publicada en Kaggle como `alfredocook/asteroids-info` (1.281.510 asteroides; 1.275.686 después de limpiar).
