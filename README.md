# PTT Panamá 3D — Plataforma Turística Interactiva

Rediseño completo de **https://pttpanama.com/** (Panamá Transports and Tours) con interfaz **3D interactiva del Istmo de Panamá (Three.js)**, buscador multi-faceta (incluyendo **Escalas PTY** y **Puerto de Cruceros de Colón**), galería real `3:4` con lightbox y cotizador directo a WhatsApp (`+507 6997-5382`) sin precios fijos expuestos.

## Cómo ver en local (Windows, sin instalar Node ni Python)
```powershell
powershell -ExecutionPolicy Bypass -File .\serve.ps1
```
Abre `http://localhost:8787/` en tu navegador.

## Imágenes en el proyecto (fácil de refrescar)
- **Tarjetas principales (`assets/img/`, proporción `16:10`)**:
  - `colon-cruise.jpg` — Foto real Puerto de Cruceros de Colón + Honda Civic PTT
  - `amador-ptt-civic.jpg` — Foto real Honda Civic PTT con tarjeta PTT en Amador
  - `miraflores-real.jpg` — Foto real nivelada de Esclusas de Miraflores (Canal de Panamá)
  - `city-panama.jpg`, `san-blas.jpg`, `monkey-island.jpg`, `valle-anton.jpg`, `shopping-amador.jpg`
- **Galería Real `3:4` (`assets/img/real/`)**:
  - `real-colon-civic.jpg`, `real-amador-civic.jpg`, `real-miraflores.jpg`, `real-viajeros-canal.jpg`, `real-aguaclara.jpg`, `real-tornillo.jpg`, `real-viajeros-costa.jpg`

## Cómo editar catálogo, textos o contacto
Todo el catálogo, rutas de traslado (incluyendo Puerto de Cruceros de Colón), extras, flota y traducciones ES/EN se editan desde `assets/js/data.js`.

## Despliegue a producción (`pttpanama.com`)
Sin compilación (`npm build`). Sube `index.html` y `assets/` directo a tu hosting (cPanel, Cloudflare Pages, Netlify o Vercel).
