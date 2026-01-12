import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";

export function Modal({
  open,
  title,
  children,
  onClose
}: {
  open: boolean;
  title?: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            aria-label="Close"
            className="absolute inset-0 bg-black/25 dark:bg-black/45"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className="relative flex w-full max-w-xl max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-2xl glass-strong shadow-[0_40px_120px_rgba(0,0,0,.35)]"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
            transition={reduceMotion ? { duration: 0.12 } : { type: "spring", stiffness: 420, damping: 34 }}
          >
            <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
              <div className="text-base font-semibold">{title}</div>
              <Button variant="ghost" className="h-9 px-3" onClick={onClose} leftIcon={<X size={18} />}>
                关闭
              </Button>
            </div>
            <div className="px-5 py-4 overflow-auto">{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
