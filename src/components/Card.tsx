import { clsx } from "clsx";
import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

export function Card({
  as = "div",
  className,
  children,
  ...props
}: {
  as?: "div" | "a";
  className?: string;
  children: ReactNode;
} & (JSX.IntrinsicElements["div"] | JSX.IntrinsicElements["a"])) {
  const reduceMotion = useReducedMotion();
  const MotionTag = as === "a" ? (motion.a as any) : (motion.div as any);

  return (
    <MotionTag
      {...(props as any)}
      className={clsx(
        "group relative overflow-hidden rounded-2xl glass-strong shadow-soft dark:shadow-softDark " +
          "transition-[box-shadow,transform,border-color] " +
          "hover:shadow-[0_26px_70px_rgba(0,0,0,.14)] dark:hover:shadow-[0_26px_90px_rgba(0,0,0,.62)] hover:border-white/12",
        className
      )}
      whileHover={reduceMotion ? undefined : { y: -1 }}
      whileTap={reduceMotion ? undefined : { scale: 0.99, y: 0 }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <div className="absolute -inset-24 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,.22),transparent_55%)]" />
      </div>
      {children}
    </MotionTag>
  );
}
