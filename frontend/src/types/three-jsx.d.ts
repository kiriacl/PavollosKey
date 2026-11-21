import type { ThreeElements } from '@react-three/fiber'

// O JSX do React instalado em frontend/ também recebe os elementos 3D tipados da raiz.
declare module 'react' {
  namespace JSX {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Esta interface complementa a declaração existente no React.
    interface IntrinsicElements extends ThreeElements {}
  }
}
