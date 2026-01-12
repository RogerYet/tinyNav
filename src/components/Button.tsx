import { clsx } from "clsx";
import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "destructive" | "danger";
type Size = "sm" | "md" | "lg";

export function Button({
  variant = "secondary",
  size = "md",
  leftIcon,
  rightIcon,
  className,
  disabled,
  children,
  ...props
}: Omit<HTMLMotionProps<"button">, "children"> & {
  variant?: Variant;
  size?: Size;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  children?: ReactNode;
}) {
  const reduceMotion = useReducedMotion();

  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl2 px-4 font-medium leading-none " +
    "transition-[box-shadow,transform,background,border-color,opacity] select-none " +
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 focus-visible:ring-offset-2 " +
    "focus-visible:ring-offset-bg disabled:opacity-50 disabled:pointer-events-none";

  const sizes: Record<Size, string> = {
    sm: "h-9 text-sm",
    md: "h-10 text-sm",
    lg: "h-11 text-base"
  };

  const variants: Record<Exclude<Variant, "danger">, string> = {
    primary:
      "text-white border border-white/10 bg-gradient-to-b from-accent/90 to-accent/75 shadow-soft " +
      "hover:shadow-[0_14px_34px_rgba(0,0,0,.16)]",
    secondary:
      "glass text-fg hover:border-white/10 shadow-[0_10px_24px_rgba(0,0,0,.10)] " +
      "hover:shadow-[0_14px_34px_rgba(0,0,0,.14)]",
    ghost: "text-fg/80 hover:text-fg hover:bg-white/6 dark:hover:bg-white/8",
    destructive:
      "text-red-600 dark:text-red-400 focus-visible:ring-red-500/30 " +
      "border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/6 backdrop-blur-md " +
      "shadow-[0_10px_24px_rgba(0,0,0,.10)] hover:shadow-[0_14px_34px_rgba(0,0,0,.14)] " +
      "hover:bg-black/8 dark:hover:bg-white/9 hover:border-black/12 dark:hover:border-white/14"
  };

  const whileHover = disabled || reduceMotion ? undefined : { y: -1 };
  const whileTap = disabled || reduceMotion ? undefined : { scale: 0.98, y: 0 };

  return (
    <motion.button
      type={props.type ?? "button"}
      whileHover={whileHover}
      whileTap={whileTap}
      className={clsx(base, sizes[size], variants[variant === "danger" ? "destructive" : variant], className)}
      disabled={disabled}
      {...props}
    >
      {leftIcon ? (
        <span className="inline-flex h-4 w-4 items-center justify-center shrink-0 leading-none [&>svg]:block [&>svg]:h-4 [&>svg]:w-4">
          {leftIcon}
        </span>
      ) : null}
      {children != null ? <span className="leading-none">{children}</span> : null}
      {rightIcon ? (
        <span className="inline-flex h-4 w-4 items-center justify-center shrink-0 leading-none [&>svg]:block [&>svg]:h-4 [&>svg]:w-4">
          {rightIcon}
        </span>
      ) : null}
    </motion.button>
  );
}
