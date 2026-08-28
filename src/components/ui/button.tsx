import type { ButtonHTMLAttributes, ReactNode } from "react";
import clsx from "clsx";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "xs" | "sm" | "md";

const variants: Record<Variant, string> = {
  primary:
    "bg-accent-strong text-white hover:bg-accent border border-accent-strong/80 disabled:bg-accent-strong/50",
  secondary: "bg-raised text-fg border border-line hover:border-line-strong hover:bg-hover",
  ghost: "bg-transparent text-fg-muted border border-transparent hover:bg-raised hover:text-fg",
  danger: "bg-danger/10 text-danger border border-danger/40 hover:bg-danger/20",
};

const sizes: Record<Size, string> = {
  xs: "h-6 px-2 text-xs gap-1 rounded-md",
  sm: "h-7 px-2.5 text-xs gap-1.5 rounded-md",
  md: "h-9 px-3.5 text-sm gap-2 rounded-lg",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = "secondary",
  size = "sm",
  loading = false,
  className,
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center font-medium transition-colors select-none",
        "disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Loader2 size={13} className="animate-spin" />}
      {children}
    </button>
  );
}

export function IconButton({
  variant = "ghost",
  size = "sm",
  className,
  children,
  ...rest
}: ButtonProps) {
  const iconSizes: Record<Size, string> = {
    xs: "h-6 w-6 rounded-md",
    sm: "h-7 w-7 rounded-md",
    md: "h-9 w-9 rounded-lg",
  };
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center transition-colors select-none",
        "disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        iconSizes[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
