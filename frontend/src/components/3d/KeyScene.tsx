import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Float } from '@react-three/drei/core/Float.js'
import { Environment } from '@react-three/drei/core/Environment.js'
import { Lightformer } from '@react-three/drei/core/Lightformer.js'
import {
  CanvasTexture,
  MathUtils,
  RepeatWrapping,
  SRGBColorSpace,
  type Group,
  type Shape,
  type Texture,
} from 'three'
import { keyShapes } from './keyShapes'

function Studio({ onLost }: { onLost: () => void }) {
  const gl = useThree((state) => state.gl)
  useEffect(() => {
    const canvas = gl.domElement
    canvas.addEventListener('webglcontextlost', onLost)
    return () => canvas.removeEventListener('webglcontextlost', onLost)
  }, [gl, onLost])
  return (
    <>
      <Environment frames={1} resolution={64}>
        <color attach="background" args={['#475568']} />
        <Lightformer position={[-4, 4, 5]} target={[0, 0, 0]} scale={[7, 2.4, 1]} intensity={5.5} />
        <Lightformer position={[-4, -4, 4]} target={[0, 0, 0]} scale={[7, 0.9, 1]} intensity={3.4} />
        <Lightformer
          position={[3, 1, 4]}
          target={[0, 0, 0]}
          scale={[2, 7, 1]}
          intensity={3.9}
          color="#c0d7ff"
        />
        <Lightformer
          position={[1, -4, -2]}
          target={[0, 0, 0]}
          scale={[7, 1, 1]}
          intensity={1.6}
          color="#719af8"
        />
      </Environment>
      <directionalLight position={[-3, 5, 5]} intensity={2.1} color="#f3f8ff" />
      <directionalLight position={[4, -2, 3]} intensity={1.4} color="#8bb5ff" />
      <directionalLight position={[-4, 0, -2]} intensity={1.2} color="#477ab3" />
    </>
  )
}

interface PartProps {
  shape: Shape
  depth: number
  bevel: number
  color: string
  metalness?: number
  roughness?: number
  position?: [number, number, number]
  finish?: Texture
}

// Uma pequena textura local dá ao metal as faixas e os riscos finos do acabamento escovado.
function brushedFinish() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createLinearGradient(0, 256, 96, 0)
  for (const [stop, color] of [
    [0, '#8394a8'],
    [0.26, '#dce6ef'],
    [0.39, '#ffffff'],
    [0.52, '#abbdd3'],
    [0.74, '#e8eff6'],
    [1, '#8394a8'],
  ] as const) {
    gradient.addColorStop(stop, color)
  }
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 256, 256)
  for (let y = 0; y < 256; y += 2) {
    ctx.fillStyle = `rgba(38, 53, 70, ${0.04 + Math.abs(Math.sin(y * 13)) * 0.09})`
    ctx.fillRect(0, y, 256, 1)
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.repeat.set(0.19, 0.5)
  texture.offset.set(0.52, 0.5)
  return texture
}

function Part({
  shape,
  depth,
  bevel,
  color,
  metalness = 0.88,
  roughness = 0.29,
  position,
  finish,
}: PartProps) {
  return (
    <mesh position={position}>
      <extrudeGeometry
        args={[
          shape,
          { depth, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 12 },
        ]}
      />
      <meshStandardMaterial color={color} map={finish ?? null} metalness={metalness} roughness={roughness} />
    </mesh>
  )
}

function Key({ playing, onReady }: { playing: boolean; onReady: () => void }) {
  const parallax = useRef<Group>(null)
  const firstFrame = useRef(true)
  const width = useThree((state) => state.viewport.width)
  const finish = useMemo(() => brushedFinish(), [])
  useEffect(() => () => finish.dispose(), [finish])

  useFrame(({ pointer }, delta) => {
    if (firstFrame.current) {
      firstFrame.current = false
      onReady()
    }
    if (!playing || !parallax.current) return
    const rotation = parallax.current.rotation
    const step = Math.min(delta, 1 / 30)
    rotation.y = MathUtils.damp(rotation.y, MathUtils.clamp(pointer.x, -1, 1) * 0.16, 3.5, step)
    rotation.x = MathUtils.damp(rotation.x, MathUtils.clamp(-pointer.y, -1, 1) * 0.11, 3.5, step)
  })

  return (
    <group ref={parallax} position={[0.13, 0.1, 0]} scale={Math.min(1, width / 5.8)}>
      <Float enabled={playing} speed={1.15} rotationIntensity={0.25} floatingRange={[-0.035, 0.035]}>
        <group rotation={[0.4, -0.37, 0.59]}>
          <Part
            shape={keyShapes.blade}
            position={[0, 0, -0.12]}
            depth={0.23}
            bevel={0.032}
            color="#e5ebf2"
            finish={finish}
          />
          <Part shape={keyShapes.ridge} position={[0, 0, 0.12]} depth={0.018} bevel={0.02} color="#d4e0e9" />
          <Part
            shape={keyShapes.groove}
            position={[0, 0, 0.114]}
            depth={0.005}
            bevel={0.005}
            color="#657489"
          />
          <Part
            shape={keyShapes.rim}
            position={[0, 0, -0.27]}
            depth={0.43}
            bevel={0.064}
            color="#e2e8f1"
            finish={finish}
          />
          <Part
            shape={keyShapes.face}
            position={[0, 0, 0.19]}
            depth={0.08}
            bevel={0.031}
            color="#265ca9"
            metalness={0.73}
            roughness={0.34}
            finish={finish}
          />
          <Part
            shape={keyShapes.letterP}
            position={[0.7, -0.22, 0.3]}
            depth={0.007}
            bevel={0.004}
            color="#bdd6fa"
          />
          <Part
            shape={keyShapes.letterK}
            position={[1.09, -0.22, 0.3]}
            depth={0.007}
            bevel={0.004}
            color="#bdd6fa"
          />
        </group>
      </Float>
    </group>
  )
}

export default function KeyScene({
  playing,
  onReady,
  onLost,
}: {
  playing: boolean
  onReady: () => void
  onLost: () => void
}) {
  return (
    <Canvas
      camera={{ position: [0, 0, 8.6], fov: 31 }}
      dpr={[1, 1.5]}
      gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
      frameloop={playing ? 'always' : 'demand'}
      aria-hidden="true"
    >
      <Studio onLost={onLost} />
      <Key playing={playing} onReady={onReady} />
    </Canvas>
  )
}
