import SignaturePadLib, { type PointGroup } from 'signature_pad'
import { useEffect, useImperativeHandle, useRef, type Ref } from 'react'
import { t } from '../../i18n/t'
import {
  base64Bytes,
  fitWithin,
  MAX_PNG_BYTES,
  signatureStats,
  stripDataUrl,
  type SignatureStats,
} from './signature'

export interface SignaturePadHandle {
  clear: () => void
  /** The drawing cropped to its strokes as a base64 PNG (no `data:` prefix) within the size limits, or null when empty. */
  toPng: () => string | null
}

export interface SignaturePadProps {
  ref?: Ref<SignaturePadHandle>
  /** Called after every stroke and after "Очистить": what is drawn now, null when nothing. */
  onChange: (stats: SignatureStats | null) => void
}

const CROP_MARGIN = 10
const SHRINK = 0.75

/** The canvas of a person's signature: pointer events (finger, mouse, pen), page scroll locked on the canvas only. */
export function SignaturePad({ ref, onChange }: SignaturePadProps) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const pad = useRef<SignaturePadLib | null>(null)
  const notify = useRef(onChange)
  // The newest callback, for the pad's own events, which are registered once.
  useEffect(() => {
    notify.current = onChange
  })

  useEffect(() => {
    const element = canvas.current
    if (!element) return
    // The ink colour is a design token, read from the page, so the pad has no colour of its own.
    const ink = getComputedStyle(element).getPropertyValue('--dc-color-signature-ink').trim() || 'currentColor'
    const instance = new SignaturePadLib(element, { penColor: ink, minWidth: 1.5, maxWidth: 3, throttle: 8 })
    pad.current = instance

    // The canvas has one pixel per device pixel; it is redrawn when its box changes (rotation), keeping the ink.
    function fit() {
      if (!element) return
      const ratio = Math.max(globalThis.devicePixelRatio || 1, 1)
      const saved: PointGroup[] = instance.toData()
      element.width = Math.round(element.offsetWidth * ratio)
      element.height = Math.round(element.offsetHeight * ratio)
      element.getContext('2d')?.scale(ratio, ratio)
      instance.clear()
      if (saved.length > 0) instance.fromData(saved)
    }
    fit()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit)
    observer?.observe(element)

    const changed = () => notify.current(signatureStats(instance.toData()))
    instance.addEventListener('endStroke', changed)

    return () => {
      observer?.disconnect()
      instance.removeEventListener('endStroke', changed)
      instance.off()
      pad.current = null
    }
  }, [])

  useImperativeHandle(ref, () => ({
    clear() {
      pad.current?.clear()
      notify.current(null)
    },
    toPng() {
      const instance = pad.current
      const source = canvas.current
      const stats = instance ? signatureStats(instance.toData()) : null
      if (!instance || !source || !stats) return null

      const ratio = source.width / Math.max(source.offsetWidth, 1)
      const left = Math.max(0, stats.box.left - CROP_MARGIN)
      const top = Math.max(0, stats.box.top - CROP_MARGIN)
      const width = Math.min(source.offsetWidth - left, stats.box.width + CROP_MARGIN * 2)
      const height = Math.min(source.offsetHeight - top, stats.box.height + CROP_MARGIN * 2)

      // Within 1200 × 400, then smaller still until the file is within 200 KB.
      let target = fitWithin(width * ratio, height * ratio)
      for (;;) {
        const out = document.createElement('canvas')
        out.width = target.width
        out.height = target.height
        out.getContext('2d')?.drawImage(source, left * ratio, top * ratio, width * ratio, height * ratio, 0, 0, target.width, target.height)
        const base64 = stripDataUrl(out.toDataURL('image/png'))
        if (base64Bytes(base64) <= MAX_PNG_BYTES || target.width <= 60) return base64
        target = { width: Math.round(target.width * SHRINK), height: Math.max(1, Math.round(target.height * SHRINK)) }
      }
    },
  }))

  return (
    <canvas
      ref={canvas}
      className="pub-pad"
      role="img"
      aria-label={t('pub.pad.aria')}
    />
  )
}
