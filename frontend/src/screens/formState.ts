import { useCallback, useState } from 'react'
import { flushSync } from 'react-dom'

// The error messages of a form, by field, plus the focus rule of components.md: a blocked save moves focus
// to the first field with an error.

export type FieldErrors<K extends string> = Partial<Record<K, string>>

export function useFieldErrors<K extends string>() {
  const [errors, setErrors] = useState<FieldErrors<K>>({})

  /** Sets or (with null) clears the message of one field. */
  const setError = useCallback((field: K, message: string | null) => {
    setErrors((current) => {
      if (message === null) {
        if (!(field in current)) return current
        const { [field]: _removed, ...rest } = current
        return rest as FieldErrors<K>
      }
      return current[field] === message ? current : { ...current, [field]: message }
    })
  }, [])

  return { errors, setError, setErrors }
}

/** Shows `errors` now and puts the cursor in the first field that has one. */
export function showErrorsAndFocus<K extends string>(
  form: HTMLFormElement | null,
  errors: FieldErrors<K>,
  setErrors: (errors: FieldErrors<K>) => void,
): void {
  flushSync(() => setErrors(errors))
  form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
}
