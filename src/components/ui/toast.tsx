import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { CheckCircle2, TriangleAlert, XCircle, Info, X } from "lucide-react";

type ToastVariant = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: number;
  variant: ToastVariant;
  title: string;
  description?: string;
}

interface ToastInput {
  variant: ToastVariant;
  title: string;
  description?: string;
}

const ToastContext = createContext<{ showToast: (t: ToastInput) => void } | null>(null);

const icons: Record<ToastVariant, ReactNode> = {
  success: <CheckCircle2 size={15} className="text-success" />,
  error: <XCircle size={15} className="text-danger" />,
  warning: <TriangleAlert size={15} className="text-warning" />,
  info: <Info size={15} className="text-info" />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (t: ToastInput) => {
      const id = ++counter.current;
      setItems((list) => [...list.slice(-4), { id, ...t }]);
      setTimeout(() => dismiss(id), 5000);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {createPortal(
        <div className="fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2">
          {items.map((toast) => (
            <div
              key={toast.id}
              role="status"
              className={clsx(
                "flex items-start gap-2.5 rounded-lg border bg-panel px-3.5 py-3 shadow-xl",
                toast.variant === "error"
                  ? "border-danger/40"
                  : toast.variant === "warning"
                    ? "border-warning/40"
                    : toast.variant === "success"
                      ? "border-success/40"
                      : "border-line-strong",
              )}
            >
              <span className="mt-0.5">{icons[toast.variant]}</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-fg">{toast.title}</p>
                {toast.description && (
                  <p className="mt-0.5 text-xs leading-relaxed text-fg-muted break-words">
                    {toast.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => dismiss(toast.id)}
                className="text-fg-subtle hover:text-fg"
                aria-label="Dismiss"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
