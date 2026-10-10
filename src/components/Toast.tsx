import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

export interface ToastAction {
  label: string
  onClick: () => void
}

type Show = (message: string, action?: ToastAction) => void

const ToastContext = createContext<Show>(() => {})
export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; message: string; action?: ToastAction } | null>(null)
  const show = useCallback<Show>((message, action) => setToast({ id: Date.now(), message, action }), [])

  useEffect(() => {
    if (!toast) return
    // A toast with an action stays a little longer so there's time to tap it.
    const t = setTimeout(() => setToast(null), toast.action ? 6000 : 4000)
    return () => clearTimeout(t)
  }, [toast])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toast && (
          <div className="toast" key={toast.id}>
            <span>{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                className="toast-action"
                onClick={() => {
                  toast.action!.onClick()
                  setToast(null)
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}
