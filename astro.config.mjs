import { defineConfig } from 'astro/config'

export default defineConfig({
  // Tu dominio real: Astro lo usa para las URL canónicas y de Open Graph.
  site: 'https://flotari.com.mx',
  build: {
    // El CSS en su propio archivo y no en línea: así la política de
    // seguridad del .htaccess puede prohibir estilos en línea.
    inlineStylesheets: 'never',
  },
  // Que Astro NUNCA meta el script dentro del HTML (lo hace con los chicos):
  // como archivo aparte lo permite la CSP sin abrirle la puerta al código en línea.
  vite: { build: { assetsInlineLimit: 0 } },
  // Sin barra de desarrollo: no la necesitamos y es código de más.
  devToolbar: { enabled: false },
})