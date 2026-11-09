/*
  Lo poco que necesita JavaScript. Astro lo empaqueta como archivo aparte
  (/_astro/…js), así que la política de seguridad puede seguir sin permitir
  código en línea. Sin este script la página funciona igual: todo se ve, las
  pestañas se muestran apiladas y nada se queda escondido.
*/

const raiz = document.documentElement
raiz.classList.remove('sin-js')
const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches

// 1. El encabezado toma fondo en cuanto la página se mueve.
const encabezado = document.querySelector<HTMLElement>('.encabezado')
const alBajar = () => encabezado?.classList.toggle('con-fondo', scrollY > 8)
addEventListener('scroll', alBajar, { passive: true })
// Y se evalúa de entrada: al recargar, el navegador restaura la posición
// de scroll, y sin esto el encabezado se quedaba transparente encima del
// contenido hasta que la persona moviera la rueda.
alBajar()
alBajar()

// 2. Aparecer al bajar. Solo se esconde lo que está FUERA de la pantalla al
//    cargar: lo que ya se ve no parpadea.
const porAparecer = [...document.querySelectorAll<HTMLElement>('[data-aparece]')]
const observador = new IntersectionObserver(
  (entradas) => {
    for (const e of entradas) {
      if (!e.isIntersecting) continue
      const el = e.target as HTMLElement
      el.classList.remove('oculto')
      el.classList.add('visible')
      observador.unobserve(el)
    }
  },
  { rootMargin: '0px 0px -12% 0px', threshold: 0.12 },
)
for (const el of porAparecer) {
  const caja = el.getBoundingClientRect()
  const yaSeVe = caja.top < innerHeight && caja.bottom > 0
  if (yaSeVe || quieto) {
    el.classList.add('visible')
    continue
  }
  el.classList.add('oculto', 'aparece')
  observador.observe(el)
}

// 3. El foco de luz que sigue al cursor en las celdas de funciones.
if (!quieto && matchMedia('(hover: hover)').matches) {
  for (const celda of document.querySelectorAll<HTMLElement>('.celda')) {
    celda.addEventListener('pointermove', (e) => {
      const caja = celda.getBoundingClientRect()
      celda.style.setProperty('--x', `${e.clientX - caja.left}px`)
      celda.style.setProperty('--y', `${e.clientY - caja.top}px`)
    })
  }
}

// 4. Pestañas de los giros, con teclado (flechas, Inicio y Fin) como pide ARIA.
for (const grupo of document.querySelectorAll<HTMLElement>('[role="tablist"]')) {
  const botones = [...grupo.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
  const marca = grupo.querySelector<HTMLElement>('.pestanas__marca')

  const moverMarca = (b: HTMLButtonElement) => {
    if (!marca) return
    marca.style.width = `${b.offsetWidth}px`
    marca.style.transform = `translateX(${b.offsetLeft}px)`
  }

  const elegir = (b: HTMLButtonElement, enfocar = false) => {
    for (const otro of botones) {
      const activo = otro === b
      otro.setAttribute('aria-selected', String(activo))
      otro.tabIndex = activo ? 0 : -1
      const panel = document.getElementById(otro.getAttribute('aria-controls') ?? '')
      if (!panel) continue
      panel.hidden = !activo
      if (activo && !quieto) {
        panel.classList.remove('entra')
        void panel.offsetWidth // reinicia la animación de entrada
        panel.classList.add('entra')
      }
    }
    moverMarca(b)
    if (enfocar) b.focus()
  }

  botones.forEach((b, i) => {
    b.addEventListener('click', () => elegir(b))
    b.addEventListener('keydown', (e) => {
      const destino =
        e.key === 'ArrowRight' ? botones[(i + 1) % botones.length]
        : e.key === 'ArrowLeft' ? botones[(i - 1 + botones.length) % botones.length]
        : e.key === 'Home' ? botones[0]
        : e.key === 'End' ? botones[botones.length - 1]
        : null
      if (destino) {
        e.preventDefault()
        elegir(destino, true)
      }
    })
  })

  elegir(botones.find((b) => b.getAttribute('aria-selected') === 'true') ?? botones[0])
  addEventListener('resize', () => {
    const activo = botones.find((b) => b.getAttribute('aria-selected') === 'true')
    if (activo) moverMarca(activo)
  })
  // La letra puede llegar después del primer cálculo y cambiar los anchos.
  document.fonts?.ready.then(() => {
    const activo = botones.find((b) => b.getAttribute('aria-selected') === 'true')
    if (activo) moverMarca(activo)
  })
}