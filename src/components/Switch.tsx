import { motion, useReducedMotion } from "framer-motion";
import { clsx } from "clsx";

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  className
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={clsx(
        "relative inline-flex h-7 w-12 items-center rounded-full border transition-colors " +
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 focus-visible:ring-offset-2 " +
          "focus-visible:ring-offset-bg disabled:opacity-50 disabled:pointer-events-none",
        checked ? "bg-emerald-500/90 border-emerald-400/30" : "bg-white/10 dark:bg-white/8 border-white/14",
        className
      )}
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      <motion.span
        className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-[0_8px_18px_rgba(0,0,0,.20)]"
        animate={{ x: checked ? 22 : 2 }}
        transition={reduceMotion ? { duration: 0.12 } : { type: "spring", stiffness: 520, damping: 36 }}
      />
    </button>
  );
}

