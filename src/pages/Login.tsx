import { motion, useReducedMotion } from "framer-motion";
import { Lock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Navbar } from "../components/Navbar";
import { api } from "../lib/api";
import { useMe } from "../lib/auth";

export default function Login() {
  const reduceMotion = useReducedMotion();
  const { authed } = useMe();
  const nav = useNavigate();
  const location = useLocation();
  const next = useMemo(() => {
    const from = (location.state as any)?.from as string | undefined;
    return from || "/admin";
  }, [location.state]);

  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authed === true) nav("/admin", { replace: true });
  }, [authed, nav]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.login(password);
      nav(next, { replace: true });
    } catch (e2: unknown) {
      setError(e2 instanceof Error ? e2.message : "登录失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-bg">
      <Navbar authed={authed === true} />
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-10">
        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          transition={reduceMotion ? { duration: 0.18 } : { type: "spring", stiffness: 420, damping: 34 }}
          className="mx-auto max-w-md"
        >
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/10 dark:bg-white/6">
                <Lock size={18} className="text-fg/80" />
              </div>
              <div>
                <div className="text-lg font-semibold">登录</div>
                <div className="text-sm text-muted">使用管理密码进入后台</div>
              </div>
            </div>

            <form className="mt-5 space-y-4" onSubmit={onSubmit}>
              <label className="block space-y-2">
                <div className="text-sm font-medium text-fg/80">PASSWORD</div>
                <input
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  className="glass w-full rounded-2xl px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                  placeholder="输入 PASSWORD…"
                />
              </label>

              {error ? <div className="text-sm text-danger">{error}</div> : null}

              <div className="flex items-center justify-between">
                <Button type="submit" variant="primary" disabled={busy || !password}>
                  {busy ? "正在登录…" : "登录"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => nav("/", { replace: true })}>
                  返回首页
                </Button>
              </div>
            </form>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
