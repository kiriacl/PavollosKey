import { Path, Shape } from 'three'

// Perfis em unidades locais. A extrusão dá espessura às peças e recorta o furo do arco.
function bow(inset: number) {
  const shape = new Shape()
  const left = 0.03 + inset
  const right = 2.48 - inset
  const top = 0.98 - inset
  shape.moveTo(left, 0.3)
  shape.quadraticCurveTo(left, 0.43, left + 0.13, 0.53)
  shape.lineTo(0.67 + inset / 2, top - 0.08)
  shape.quadraticCurveTo(0.78, top, 0.93, top)
  shape.lineTo(1.88, top)
  shape.quadraticCurveTo(2.02, top, 2.1 - inset / 2, top - 0.11)
  shape.lineTo(right - 0.07, 0.54)
  shape.quadraticCurveTo(right, 0.44, right, 0.32)
  shape.lineTo(right, -0.32)
  shape.quadraticCurveTo(right, -0.44, right - 0.07, -0.54)
  shape.lineTo(2.1 - inset / 2, -top + 0.11)
  shape.quadraticCurveTo(2.02, -top, 1.88, -top)
  shape.lineTo(0.93, -top)
  shape.quadraticCurveTo(0.78, -top, 0.67 + inset / 2, -top + 0.08)
  shape.lineTo(left + 0.13, -0.53)
  shape.quadraticCurveTo(left, -0.43, left, -0.3)
  shape.closePath()

  const hole = new Path()
  const radius = 0.105 + inset * 0.45
  hole.moveTo(1.98 + radius, -0.29)
  hole.lineTo(1.98 + radius, 0.29)
  hole.absarc(1.98, 0.29, radius, 0, Math.PI, false)
  hole.lineTo(1.98 - radius, -0.29)
  hole.absarc(1.98, -0.29, radius, Math.PI, Math.PI * 2, false)
  shape.holes.push(hole)
  return shape
}

function polygon(points: [number, number][]) {
  const shape = new Shape()
  const [first, ...rest] = points
  shape.moveTo(...first)
  for (const point of rest) shape.lineTo(...point)
  shape.closePath()
  return shape
}

export const keyShapes = {
  rim: bow(0),
  face: bow(0.105),
  blade: polygon([
    [0.37, 0.39],
    [-0.23, 0.39],
    [-0.26, 0.28],
    [-2.83, 0.28],
    [-3.18, 0.04],
    [-3.0, -0.19],
    [-2.87, -0.19],
    [-2.7, -0.06],
    [-2.47, -0.32],
    [-2.33, -0.32],
    [-2.12, -0.09],
    [-1.91, -0.09],
    [-1.73, -0.37],
    [-1.53, -0.37],
    [-1.34, -0.16],
    [-1.15, -0.38],
    [-1.0, -0.38],
    [-0.81, -0.14],
    [-0.6, -0.37],
    [-0.3, -0.37],
    [-0.26, -0.47],
    [0.37, -0.47],
  ]),
  ridge: polygon([
    [-3.0, 0.085],
    [-2.82, 0.165],
    [0.23, 0.165],
    [0.23, 0.085],
  ]),
  groove: polygon([
    [-2.92, 0.038],
    [-2.76, -0.026],
    [0.15, -0.026],
    [0.15, 0.038],
  ]),
  // Monograma em relevo, desenhado no próprio modelo.
  letterP: (() => {
    const p = polygon([
      [0, 0],
      [0.08, 0.4],
      [0.3, 0.4],
      [0.37, 0.32],
      [0.335, 0.2],
      [0.26, 0.155],
      [0.12, 0.155],
      [0.09, 0],
    ])
    const hole = new Path()
    hole.moveTo(0.135, 0.235)
    hole.lineTo(0.24, 0.235)
    hole.lineTo(0.27, 0.255)
    hole.lineTo(0.278, 0.3)
    hole.lineTo(0.255, 0.319)
    hole.lineTo(0.152, 0.319)
    hole.closePath()
    p.holes.push(hole)
    return p
  })(),
  letterK: polygon([
    [0, 0],
    [0.08, 0.4],
    [0.17, 0.4],
    [0.138, 0.24],
    [0.296, 0.4],
    [0.41, 0.4],
    [0.215, 0.196],
    [0.34, 0],
    [0.225, 0],
    [0.125, 0.16],
    [0.09, 0],
  ]),
}
