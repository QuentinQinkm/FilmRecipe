import 'vitest-canvas-mock'
import '@testing-library/jest-dom'

// jsdom does not implement PointerEvent — provide a minimal polyfill
if (typeof globalThis.PointerEvent === 'undefined') {
  class PointerEvent extends MouseEvent {
    constructor(type, params = {}) {
      super(type, params)
      this.pointerId = params.pointerId ?? 1
    }
  }
  globalThis.PointerEvent = PointerEvent
}
