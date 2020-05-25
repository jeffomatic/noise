import { vec2 } from 'gl-matrix'

const canvas = document.createElement('canvas')
document.body.appendChild(canvas)

const gradFieldDimensions = vec2.fromValues(16, 10)
const gradTileSize = 64
const viewportDimensions = vec2.scale(
  vec2.create(),
  gradFieldDimensions,
  gradTileSize,
)

canvas.width = viewportDimensions[0]
canvas.height = viewportDimensions[1]
const ctx = canvas.getContext('2d')

enum PixelColor {
  RED = 0,
  GREEN = 1,
  BLUE = 2,
  ALPHA = 3,
  STRIDE = 4,
}

/**
 * Returns an array of (w + 1) x (h + 1) random gradients. Each gradient is a
 * unit vector with a random orienation.
 */
function randomGradientField(dimensions: vec2): vec2[][] {
  const res = []
  for (let i = 0; i < dimensions[1] + 1; i++) {
    const row: vec2[] = []
    res.push(row)
    for (let j = 0; j < dimensions[0] + 1; j++) {
      row.push(
        vec2.rotate(vec2.create(), [1, 0], [0, 0], Math.random() * Math.PI * 2),
      )
    }
  }
  return res
}

function lerp(min: number, max: number, alpha: number): number {
  return min + (max - min) * alpha
}

function lerpAlpha(min: number, max: number, pos: number): number {
  return (pos - min) / (max - min)
}

/**
 * Implements the classical 6t^5 - 15t^4 + 10t^3 ease curve.
 */
function ease(n: number): number {
  return n * n * n * (n * (n * 6 - 15) + 10)
}

const gradField = randomGradientField(gradFieldDimensions)

const pixelBuf = new Uint8ClampedArray(
  viewportDimensions[0] * viewportDimensions[1] * PixelColor.STRIDE,
)

const tileOffsets: vec2[][][] = []
const tileAlphas: vec2[][] = []
for (let i = 0; i < gradTileSize; i++) {
  const offsetRow: vec2[][] = []
  tileOffsets.push(offsetRow)
  const alphaRow: vec2[] = []
  tileAlphas.push(alphaRow)

  for (let j = 0; j < gradTileSize; j++) {
    const center = vec2.fromValues(j + 0.5, i + 0.5)
    const offsets = [
      vec2.fromValues(center[0], center[1]), // nw corner offset
      vec2.fromValues(center[0] - gradTileSize, center[1]), // ne corner offset
      vec2.fromValues(center[0], center[1] - gradTileSize), // sw corner offset
      vec2.fromValues(center[0] - gradTileSize, center[1] - gradTileSize), // se corner offset
    ]
    offsets.forEach((v) => vec2.scale(v, v, 1 / gradTileSize))
    offsetRow.push(offsets)

    alphaRow.push(
      vec2.fromValues(
        ease(lerpAlpha(0, gradTileSize, center[0])),
        ease(lerpAlpha(0, gradTileSize, center[1])),
      ),
    )
  }
}

function updateBuffer(): void {
  for (let gi = 0; gi < gradFieldDimensions[1]; gi++) {
    for (let gj = 0; gj < gradFieldDimensions[0]; gj++) {
      const gradients = [
        gradField[gi][gj], // nw
        gradField[gi][gj + 1], // ne
        gradField[gi + 1][gj], // sw
        gradField[gi + 1][gj + 1], // se
      ]

      for (let pi = 0; pi < gradTileSize; pi++) {
        for (let pj = 0; pj < gradTileSize; pj++) {
          const offsets = tileOffsets[pi][pj]
          const alphas = tileAlphas[pi][pj]
          const avgValue = lerp(
            lerp(
              vec2.dot(offsets[0], gradients[0]), // nw
              vec2.dot(offsets[1], gradients[1]), // ne
              alphas[0],
            ),
            lerp(
              vec2.dot(offsets[2], gradients[2]), // sw
              vec2.dot(offsets[3], gradients[3]), // se
              alphas[0],
            ),
            alphas[1],
          )

          const pixelRow = gi * gradTileSize + pi
          const pixelCol = gj * gradTileSize + pj
          const pixelIndex =
            pixelRow * gradFieldDimensions[0] * gradTileSize + pixelCol
          const bufOffset = pixelIndex * PixelColor.STRIDE

          const value = lerp(0, 255, lerpAlpha(-1, 1, avgValue))
          pixelBuf[bufOffset + PixelColor.RED] = value
          pixelBuf[bufOffset + PixelColor.GREEN] = value
          pixelBuf[bufOffset + PixelColor.BLUE] = value
          pixelBuf[bufOffset + PixelColor.ALPHA] = 255
        }
      }
    }
  }
}

const period = 3000
let lastTime = Date.now()
const tau = Math.PI * 2

function loop() {
  requestAnimationFrame(() => loop())

  // rotate gradients
  const now = Date.now()
  const delta = now - lastTime
  lastTime = now

  const rot = (delta / period) * tau
  for (let i = 0; i < gradFieldDimensions[1]; i++) {
    for (let j = 0; j < gradFieldDimensions[0]; j++) {
      vec2.rotate(gradField[i][j], gradField[i][j], [0, 0], rot)
    }
  }

  updateBuffer()

  const imgdata = new ImageData(
    pixelBuf,
    viewportDimensions[0],
    viewportDimensions[1],
  )

  createImageBitmap(imgdata).then((bitmap) => {
    ctx.drawImage(bitmap, 0, 0)
  })
}

loop()
