// Shows the A4 sheet inside its own box without ever widening the page around it.
//   fit     the sheet is scaled down to the width of the box (a phone, the 520 px preview pane);
//   actual  the sheet at its real size, and the box scrolls sideways by itself.
// The scale is a CSS transform, so the sheet is laid out once at its real size. In print the transform is gone
// (print.css), so the page prints at 100 % whatever the screen showed.

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import './preview.css'
import { fitScale, type Zoom } from './scale'

interface Measure {
  frameWidth: number
  pageWidth: number
  pageHeight: number
}

export function DocumentViewport({ zoom = 'fit', children }: { zoom?: Zoom; children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null)
  const page = useRef<HTMLDivElement>(null)
  const [measure, setMeasure] = useState<Measure | null>(null)

  useLayoutEffect(() => {
    const frameEl = frame.current
    const pageEl = page.current
    if (!frameEl || !pageEl) return
    const update = () =>
      setMeasure((previous) => {
        const next = { frameWidth: frameEl.clientWidth, pageWidth: pageEl.offsetWidth, pageHeight: pageEl.offsetHeight }
        const same =
          previous &&
          previous.frameWidth === next.frameWidth &&
          previous.pageWidth === next.pageWidth &&
          previous.pageHeight === next.pageHeight
        return same ? previous : next
      })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(frameEl)
    observer.observe(pageEl)
    return () => observer.disconnect()
  }, [])

  const scale = zoom === 'fit' && measure ? fitScale(measure.frameWidth, measure.pageWidth) : 1
  // A transform does not change the layout box, so the box around the sheet is sized by hand.
  const box = measure ? { width: measure.pageWidth * scale, height: measure.pageHeight * scale } : undefined

  return (
    <div ref={frame} className="doc-viewport" data-zoom={zoom}>
      <div className="doc-scaler" style={box}>
        <div ref={page} className="doc-scaled" style={scale === 1 ? undefined : { transform: `scale(${scale})` }}>
          {children}
        </div>
      </div>
    </div>
  )
}
