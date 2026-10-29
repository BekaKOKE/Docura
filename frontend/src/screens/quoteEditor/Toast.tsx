import { useEffect } from 'react'

const SHOW_MS = 6000

export interface ToastProps {
  text: string
  actionLabel: string
  onAction: () => void
  /** Called when the toast has been on screen long enough. Keep it stable (useCallback): a new function restarts the timer. */
  onDismiss: () => void
}

// components.md "Toast": one sentence and one action ("Строка удалена · Вернуть"), polite, gone after a few seconds.
export function Toast({ text, actionLabel, onAction, onDismiss }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, SHOW_MS)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <div className="qe-toast" role="status">
      <span className="qe-toast-text">{text}</span>
      <button type="button" className="qe-toast-action" onClick={onAction}>
        <span className="dc-label">{actionLabel}</span>
      </button>
    </div>
  )
}
