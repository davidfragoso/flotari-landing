import type { APIRoute } from 'astro'

/**
 * El mapa del sitio se arma al compilar, así no hay que acordarse de
 * actualizarlo cada vez que se agrega una página.
 *
 * Solo van las páginas que sí queremos en los buscadores: la 404 lleva
 * `noindex` y se queda fuera.
 */
const PAGINAS = [
  { ruta: '/', prioridad: '1.0', cambia: 'monthly' },
  { ruta: '/aviso-privacidad/', prioridad: '0.3', cambia: 'yearly' },
  { ruta: '/terminos/', prioridad: '0.3', cambia: 'yearly' },
]

export const GET: APIRoute = ({ site }) => {
  if (!site) throw new Error('Falta `site` en astro.config.mjs: sin eso no hay mapa del sitio.')

  const hoy = new Date().toISOString().slice(0, 10)
  const entradas = PAGINAS.map(
    ({ ruta, prioridad, cambia }) => `  <url>
    <loc>${new URL(ruta, site).href}</loc>
    <lastmod>${hoy}</lastmod>
    <changefreq>${cambia}</changefreq>
    <priority>${prioridad}</priority>
  </url>`,
  ).join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entradas}
</urlset>
`

  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } })
}
