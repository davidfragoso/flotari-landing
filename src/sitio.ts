export const SITIO = {
  nombre: 'Flotari',
  dominio: 'https://flotari.com.mx',
  /** Donde vive el sistema (el VPS). */
  app: 'https://app.flotari.com.mx',
  /** Con lada de país y sin signos: 52 + 10 dígitos. */
  whatsapp: '529987906989',
  correo: 'administrador@flotari.com.mx',
}

/**
 * Quién responde por los datos personales, para el aviso de privacidad.
 *
 * Mientras alguno de estos campos siga en `POR DEFINIR`, el aviso enseña un
 * recuadro de advertencia y el build avisa en la consola. No publiques así.
 */
export const RESPONSABLE = {
  /** Tu nombre completo si eres persona física, o la razón social. */
  nombre: 'David Uriel Fragoso Madera',
  /** Domicilio fiscal o el que uses para recibir notificaciones. */
  domicilio: 'Cancún, Quintana Roo, México',
  /** A dónde llegan las solicitudes de derechos ARCO. */
  correo: 'privacidad@flotari.com.mx',
  /** Última actualización del aviso, en formato ISO. */
  actualizado: '2026-11-08',
}

/** `true` mientras falte llenar algún dato del responsable. */
export const RESPONSABLE_INCOMPLETO = Object.values(RESPONSABLE).some((v) => v.includes('POR DEFINIR'))

export const ENLACE_PRIVACIDAD = `mailto:${RESPONSABLE.correo}?subject=${encodeURIComponent('Solicitud de derechos ARCO')}`

/**
 * Los números y lugares que aparecen en los términos y condiciones.
 *
 * Son decisiones comerciales y legales, no de código: revísalos uno por uno
 * y cámbialos antes de publicar.
 */
export const CONTRATO = {
  /** Días de la prueba sin costo. Hoy la landing promete 14. */
  diasDePrueba: 14,
  /** Con cuántos días de anticipación hay que avisar para no renovar. */
  diasParaCancelar: 30,
  /** Días de atraso en el pago antes de poder suspender la cuenta. */
  diasParaSuspender: 15,
  /** Cuántos días se conservan los datos tras terminar, para que los descarguen. */
  diasParaDescargar: 30,
  /** Meses de pagos que sirven de tope a la responsabilidad. */
  mesesDeTope: 3,
  /** Ciudad y estado cuyos tribunales resuelven una disputa. */
  jurisdiccion: 'Cancún, Quintana Roo',
  /** Última actualización, en formato ISO. */
  actualizado: '2026-11-08',
}

/**
 * Mientras esto sea `true`, los términos se enseñan marcados como borrador.
 * Ponlo en `false` cuando un abogado los haya revisado.
 */
export const TERMINOS_EN_BORRADOR = false

const mensaje = 'Hola, me interesa ver una demo de Flotari.'
export const ENLACE_WHATSAPP = `https://wa.me/${SITIO.whatsapp}?text=${encodeURIComponent(mensaje)}`
export const ENLACE_CORREO = `mailto:${SITIO.correo}?subject=${encodeURIComponent('Demo de Flotari')}`