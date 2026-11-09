/**
 * Codificador de códigos QR en modo byte y corrección media (M).
 *
 * Corre al compilar, no en el navegador: la landing no carga ni un byte de
 * JavaScript por el QR, solo el `<path>` que sale de aquí. Sin dependencias.
 *
 * Cubre las versiones 1 a 10 (hasta 216 bytes de datos), de sobra para una URL.
 */

/** Cuadrícula de módulos: `true` es módulo oscuro. */
export type Matriz = boolean[][]

/** Codewords totales (datos + corrección) de cada versión, de la 1 a la 10. */
const CODEWORDS_TOTALES = [26, 44, 70, 100, 134, 172, 196, 242, 292, 346]

/**
 * Para corrección M y cada versión: cuántos codewords de corrección lleva
 * cada bloque y en cuántos bloques se parten los datos.
 */
const BLOQUES_M: ReadonlyArray<readonly [correccion: number, bloques: number]> = [
  [10, 1],
  [16, 1],
  [26, 1],
  [18, 2],
  [24, 2],
  [16, 4],
  [18, 4],
  [22, 4],
  [22, 5],
  [26, 5],
]

/** Centros de los patrones de alineación de cada versión. */
const ALINEACION: ReadonlyArray<readonly number[]> = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
]

// ---------------------------------------------------------------------------
// Aritmética en GF(256), el campo que usa Reed-Solomon con primitivo 0x11D.
// ---------------------------------------------------------------------------

const EXP = new Uint8Array(512)
const LOG = new Uint8Array(256)

for (let i = 0, x = 1; i < 255; i++) {
  EXP[i] = x
  LOG[x] = i
  x <<= 1
  if (x & 0x100) x ^= 0x11d
}
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]

function multiplicar(a: number, b: number): number {
  if (a === 0 || b === 0) return 0
  return EXP[LOG[a] + LOG[b]]
}

/** Polinomio generador de grado `grado`, para Reed-Solomon. */
function generador(grado: number): Uint8Array {
  let poli = Uint8Array.of(1)
  for (let i = 0; i < grado; i++) {
    const siguiente = new Uint8Array(poli.length + 1)
    for (let j = 0; j < poli.length; j++) {
      siguiente[j] ^= poli[j]
      siguiente[j + 1] ^= multiplicar(poli[j], EXP[i])
    }
    poli = siguiente
  }
  return poli
}

/** Los codewords de corrección de un bloque de datos. */
function correccion(datos: Uint8Array, cuantos: number): Uint8Array {
  const gen = generador(cuantos)
  const resto = new Uint8Array(cuantos)
  for (const byte of datos) {
    const factor = byte ^ resto[0]
    resto.copyWithin(0, 1)
    resto[cuantos - 1] = 0
    if (factor !== 0) {
      for (let i = 0; i < cuantos; i++) resto[i] ^= multiplicar(gen[i + 1], factor)
    }
  }
  return resto
}

// ---------------------------------------------------------------------------
// Códigos BCH de los bloques de información.
// ---------------------------------------------------------------------------

/**
 * Resto de la división BCH: se corre el valor bit por bit y cada vez que se
 * sale del grado se le resta el generador.
 */
function bch(valor: number, generador: number, cuantosBits: number, grado: number): number {
  let resto = valor
  for (let i = 0; i < cuantosBits; i++) {
    resto = (resto << 1) ^ ((resto >>> grado) * generador)
  }
  return resto
}

/** 15 bits de información de formato: corrección M (`00`) más la máscara. */
function bitsDeFormato(mascara: number): number {
  const datos = (0b00 << 3) | mascara
  const resto = bch(datos, 0x537, 10, 9)
  return ((datos << 10) | resto) ^ 0x5412
}

/** 18 bits de información de versión; solo las versiones 7 y mayores la llevan. */
function bitsDeVersion(version: number): number {
  return (version << 12) | bch(version, 0x1f25, 12, 11)
}

// ---------------------------------------------------------------------------
// Datos: de texto a codewords.
// ---------------------------------------------------------------------------

class Bits {
  private readonly bytes: number[] = []
  private sueltos = 0

  agregar(valor: number, cuantos: number): void {
    for (let i = cuantos - 1; i >= 0; i--) {
      const bit = (valor >>> i) & 1
      if (this.sueltos % 8 === 0) this.bytes.push(0)
      if (bit) this.bytes[this.bytes.length - 1] |= 0x80 >>> this.sueltos % 8
      this.sueltos++
    }
  }

  get longitud(): number {
    return this.sueltos
  }

  /** Rellena hasta `cuantos` codewords: terminador, ceros y el relleno fijo. */
  cerrar(cuantos: number): Uint8Array {
    const tope = cuantos * 8
    this.agregar(0, Math.min(4, tope - this.sueltos))
    if (this.sueltos % 8 !== 0) this.agregar(0, 8 - (this.sueltos % 8))
    const salida = new Uint8Array(cuantos)
    salida.set(this.bytes)
    for (let i = this.bytes.length, alterna = 0; i < cuantos; i++, alterna++) {
      salida[i] = alterna % 2 === 0 ? 0xec : 0x11
    }
    return salida
  }
}

/** Cuántos bits ocupa la cuenta de caracteres en modo byte. */
const bitsDeCuenta = (version: number) => (version < 10 ? 8 : 16)

function codewordsDeDatos(version: number): number {
  const [porBloque, bloques] = BLOQUES_M[version - 1]
  return CODEWORDS_TOTALES[version - 1] - porBloque * bloques
}

/** La versión más chica donde caben los datos. */
function versionQueAlcanza(bytes: number): number {
  for (let version = 1; version <= 10; version++) {
    const cabe = codewordsDeDatos(version) * 8 - 4 - bitsDeCuenta(version)
    if (bytes * 8 <= cabe) return version
  }
  throw new Error(`El texto no cabe en un QR hasta la versión 10: ${bytes} bytes.`)
}

/** Parte los datos en bloques, les agrega corrección y los entrevera. */
function entreverar(datos: Uint8Array, version: number): Uint8Array {
  const [porBloque, cuantosBloques] = BLOQUES_M[version - 1]
  const cortos = Math.floor(datos.length / cuantosBloques)
  const largos = datos.length % cuantosBloques

  const bloques: Uint8Array[] = []
  const correcciones: Uint8Array[] = []
  for (let i = 0, desde = 0; i < cuantosBloques; i++) {
    // Los bloques cortos van primero; los largos llevan un codeword más.
    const tamano = cortos + (i >= cuantosBloques - largos ? 1 : 0)
    const bloque = datos.subarray(desde, desde + tamano)
    bloques.push(bloque)
    correcciones.push(correccion(bloque, porBloque))
    desde += tamano
  }

  const salida: number[] = []
  for (let i = 0; i < cortos + 1; i++) {
    for (const bloque of bloques) if (i < bloque.length) salida.push(bloque[i])
  }
  for (let i = 0; i < porBloque; i++) {
    for (const ec of correcciones) salida.push(ec[i])
  }
  return Uint8Array.from(salida)
}

// ---------------------------------------------------------------------------
// Cuadrícula: patrones fijos, datos y máscara.
// ---------------------------------------------------------------------------

type Lienzo = { modulos: boolean[][]; reservado: boolean[][]; lado: number }

function lienzoVacio(lado: number): Lienzo {
  const vacio = () => Array.from({ length: lado }, () => new Array<boolean>(lado).fill(false))
  return { modulos: vacio(), reservado: vacio(), lado }
}

function poner(l: Lienzo, x: number, y: number, oscuro: boolean): void {
  l.modulos[y][x] = oscuro
  l.reservado[y][x] = true
}

function patronesFijos(l: Lienzo, version: number): void {
  const n = l.lado

  // Los tres patrones de localización, con su separador.
  for (const [cx, cy] of [
    [0, 0],
    [n - 7, 0],
    [0, n - 7],
  ]) {
    for (let y = -1; y <= 7; y++) {
      for (let x = -1; x <= 7; x++) {
        const px = cx + x
        const py = cy + y
        if (px < 0 || py < 0 || px >= n || py >= n) continue
        const anillo = Math.max(Math.abs(x - 3), Math.abs(y - 3))
        poner(l, px, py, anillo !== 2 && anillo <= 3)
      }
    }
  }

  // Las dos líneas de sincronía.
  for (let i = 8; i < n - 8; i++) {
    poner(l, i, 6, i % 2 === 0)
    poner(l, 6, i, i % 2 === 0)
  }

  // Los patrones de alineación, salvo donde chocan con los de localización.
  const centros = ALINEACION[version - 1]
  for (const cy of centros) {
    for (const cx of centros) {
      const esquina = (cx === 6 && cy === 6) || (cx === 6 && cy === n - 7) || (cx === n - 7 && cy === 6)
      if (esquina) continue
      for (let y = -2; y <= 2; y++) {
        for (let x = -2; x <= 2; x++) {
          poner(l, cx + x, cy + y, Math.max(Math.abs(x), Math.abs(y)) !== 1)
        }
      }
    }
  }

  // El módulo que siempre va oscuro.
  poner(l, 8, n - 8, true)

  // Se aparta el lugar de la información de formato; se llena después.
  for (let i = 0; i <= 8; i++) {
    if (i !== 6) {
      l.reservado[8][i] = true
      l.reservado[i][8] = true
    }
  }
  for (let i = 0; i < 8; i++) {
    l.reservado[8][n - 1 - i] = true
    l.reservado[n - 1 - i][8] = true
  }

  // Y el de la información de versión, de la 7 en adelante.
  if (version >= 7) {
    for (let i = 0; i < 18; i++) {
      const a = Math.floor(i / 3)
      const b = (i % 3) + n - 11
      l.reservado[b][a] = true
      l.reservado[a][b] = true
    }
  }
}

/** Recorre la cuadrícula en zigzag y acomoda los bits de datos. */
function acomodarDatos(l: Lienzo, codewords: Uint8Array): void {
  const n = l.lado
  let bit = 0
  const siguiente = () => {
    const valor = bit < codewords.length * 8 && ((codewords[bit >>> 3] >>> (7 - (bit % 8))) & 1) === 1
    bit++
    return valor
  }

  for (let derecha = n - 1; derecha >= 1; derecha -= 2) {
    // La columna 6 es de sincronía: el recorrido la salta entera.
    if (derecha === 6) derecha = 5
    for (let paso = 0; paso < n; paso++) {
      const sube = ((n - 1 - derecha) >> 1) % 2 === 0
      const y = sube ? n - 1 - paso : paso
      for (const x of [derecha, derecha - 1]) {
        if (!l.reservado[y][x]) l.modulos[y][x] = siguiente()
      }
    }
  }
}

const MASCARAS: ReadonlyArray<(x: number, y: number) => boolean> = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
]

/** Las cuatro penalizaciones del estándar; gana la máscara con menos. */
function penalizacion(m: boolean[][]): number {
  const n = m.length
  let total = 0

  // 1: corridas de cinco o más del mismo color.
  for (let i = 0; i < n; i++) {
    for (const leer of [(k: number) => m[i][k], (k: number) => m[k][i]]) {
      let corrida = 1
      for (let k = 1; k < n; k++) {
        if (leer(k) === leer(k - 1)) {
          corrida++
          if (corrida === 5) total += 3
          else if (corrida > 5) total += 1
        } else corrida = 1
      }
    }
  }

  // 2: cuadros de 2×2 de un solo color.
  for (let y = 0; y < n - 1; y++) {
    for (let x = 0; x < n - 1; x++) {
      const a = m[y][x]
      if (a === m[y][x + 1] && a === m[y + 1][x] && a === m[y + 1][x + 1]) total += 3
    }
  }

  // 3: el patrón que se confunde con uno de localización.
  const patron = [true, false, true, true, true, false, true]
  const claros = [false, false, false, false]
  const buscar = (leer: (k: number) => boolean, desde: number, largo: number) => {
    const iguales = (inicio: number, lista: boolean[]) =>
      lista.every((v, k) => inicio + k >= 0 && inicio + k < largo && leer(inicio + k) === v)
    return (
      (iguales(desde, patron) && iguales(desde + 7, claros)) ||
      (iguales(desde, patron) && iguales(desde - 4, claros))
    )
  }
  for (let i = 0; i < n; i++) {
    for (let k = 0; k <= n - 7; k++) {
      if (buscar((j) => m[i][j], k, n)) total += 40
      if (buscar((j) => m[j][i], k, n)) total += 40
    }
  }

  // 4: qué tan lejos está del medio y medio.
  let oscuros = 0
  for (const fila of m) for (const v of fila) if (v) oscuros++
  const proporcion = (oscuros * 100) / (n * n)
  total += Math.floor(Math.abs(proporcion - 50) / 5) * 10

  return total
}

function escribirFormato(m: boolean[][], mascara: number): void {
  const n = m.length
  const bits = bitsDeFormato(mascara)
  const leer = (i: number) => ((bits >>> i) & 1) === 1

  // Primera copia: baja por la columna 8 y sigue por la fila 8.
  for (let i = 0; i <= 5; i++) m[i][8] = leer(i)
  m[7][8] = leer(6)
  m[8][8] = leer(7)
  m[8][7] = leer(8)
  for (let i = 9; i < 15; i++) m[8][14 - i] = leer(i)

  // Segunda copia: la fila 8 por la derecha y la columna 8 por abajo.
  for (let i = 0; i < 8; i++) m[8][n - 1 - i] = leer(i)
  for (let i = 8; i < 15; i++) m[n - 15 + i][8] = leer(i)
}

function escribirVersion(m: boolean[][], version: number): void {
  if (version < 7) return
  const n = m.length
  const bits = bitsDeVersion(version)
  for (let i = 0; i < 18; i++) {
    const encendido = ((bits >>> i) & 1) === 1
    const a = Math.floor(i / 3)
    const b = (i % 3) + n - 11
    m[b][a] = encendido
    m[a][b] = encendido
  }
}

/**
 * Codifica un texto en una cuadrícula de módulos, con corrección media.
 * Elige la versión más chica donde cabe y la máscara que menos penaliza.
 */
export function codificarQr(texto: string): Matriz {
  const datos = new TextEncoder().encode(texto)
  const version = versionQueAlcanza(datos.length)

  const bits = new Bits()
  bits.agregar(0b0100, 4) // modo byte
  bits.agregar(datos.length, bitsDeCuenta(version))
  for (const byte of datos) bits.agregar(byte, 8)
  const codewords = entreverar(bits.cerrar(codewordsDeDatos(version)), version)

  const lienzo = lienzoVacio(4 * version + 17)
  patronesFijos(lienzo, version)
  acomodarDatos(lienzo, codewords)

  let mejor: boolean[][] | null = null
  let mejorPuntaje = Infinity
  for (let mascara = 0; mascara < 8; mascara++) {
    const candidato = lienzo.modulos.map((fila, y) =>
      fila.map((v, x) => (lienzo.reservado[y][x] ? v : v !== MASCARAS[mascara](x, y))),
    )
    escribirFormato(candidato, mascara)
    escribirVersion(candidato, version)
    const puntaje = penalizacion(candidato)
    if (puntaje < mejorPuntaje) {
      mejorPuntaje = puntaje
      mejor = candidato
    }
  }
  return mejor!
}

/**
 * Convierte la cuadrícula en un solo `<path>`: un `viewBox` de `lado × lado`
 * y la `d` con un cuadrito por módulo oscuro. Deja el margen de 4 módulos que
 * pide el estándar, sin el cual muchos lectores no lo ven.
 */
export function rutaSvg(modulos: Matriz, escala = 1): { lado: number; d: string } {
  const margen = 4
  const n = modulos.length
  const partes: string[] = []
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!modulos[y][x]) continue
      const px = (x + margen) * escala
      const py = (y + margen) * escala
      partes.push(`M${px} ${py}h${escala}v${escala}h-${escala}z`)
    }
  }
  return { lado: (n + margen * 2) * escala, d: partes.join('') }
}
