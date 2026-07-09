declare module 'troika-three-text' {
  import { Mesh } from 'three'

  export class Text extends Mesh {
    text: string
    fontSize: number
    color: string | number
    anchorX: number | 'left' | 'center' | 'right' | `${number}%`
    anchorY: number | 'top' | 'top-baseline' | 'middle' | 'bottom-baseline' | 'bottom' | `${number}%`
    font: string | null
    textAlign: 'left' | 'right' | 'center' | 'justify'
    maxWidth: number
    lineHeight: number | 'normal'
    letterSpacing: number
    sync(callback?: () => void): void
    dispose(): void
  }
}
