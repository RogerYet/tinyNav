import { Laptop2, Moon, Settings, Sun, User } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../lib/theme";
import { Button } from "./Button";

export function Navbar({ authed }: { authed: boolean }) {
  const reduceMotion = useReducedMotion();
  const { mode, resolved, setMode } = useTheme();
  const [open, setOpen] = useState(false);
  const currentIcon =
    mode === "system" ? <Laptop2 size={18} /> : resolved === "dark" ? <Moon size={18} /> : <Sun size={18} />;

  return (
    <header className="sticky top-0 z-40">
      <div className="mx-auto max-w-6xl px-4 pt-4">
        <div className="glass flex items-center justify-between rounded-2xl px-4 py-3 shadow-soft dark:shadow-softDark">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-b from-white/30 to-white/10 dark:from-white/18 dark:to-white/8 border border-white/10" />
            <div className="leading-tight">
              <div className="text-sm font-semibold">AppleBar</div>
              <div className="text-xs text-muted">个人导航</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Button
                variant="ghost"
                className="h-10 px-3"
                aria-label="Theme"
                onClick={() => setOpen((v) => !v)}
                leftIcon={currentIcon}
              >
                {mode === "system" ? "系统" : resolved === "dark" ? "深色" : "浅色"}
              </Button>
              <AnimatePresence>
                {open ? (
                  <motion.div
                    initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 }}
                    animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 }}
                    transition={reduceMotion ? { duration: 0.12 } : { type: "spring", stiffness: 420, damping: 34 }}
                    className="absolute right-0 mt-2 w-44 rounded-2xl glass-strong p-2 shadow-[0_30px_90px_rgba(0,0,0,.18)] dark:shadow-[0_30px_110px_rgba(0,0,0,.55)]"
                  >
                    <div className="space-y-1">
                      <Button
                        variant={mode === "system" ? "secondary" : "ghost"}
                        className="w-full justify-start"
                        leftIcon={<Laptop2 size={18} />}
                        onClick={() => {
                          setMode("system");
                          setOpen(false);
                        }}
                      >
                        系统
                      </Button>
                      <Button
                        variant={mode === "light" ? "secondary" : "ghost"}
                        className="w-full justify-start"
                        leftIcon={<Sun size={18} />}
                        onClick={() => {
                          setMode("light");
                          setOpen(false);
                        }}
                      >
                        浅色
                      </Button>
                      <Button
                        variant={mode === "dark" ? "secondary" : "ghost"}
                        className="w-full justify-start"
                        leftIcon={<Moon size={18} />}
                        onClick={() => {
                          setMode("dark");
                          setOpen(false);
                        }}
                      >
                        深色
                      </Button>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
            {authed ? (
              <Link to="/admin">
                <Button variant="secondary" leftIcon={<Settings size={18} />}>
                  管理
                </Button>
              </Link>
            ) : (
              <Link to="/login">
                <Button variant="ghost" leftIcon={<User size={18} />}>登录</Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
