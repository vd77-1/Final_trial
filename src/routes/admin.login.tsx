import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/trishna/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEMO_PASSWORD } from "@/data/seed";
import { isDemoMode } from "@/services/backend";
import { signIn, useAuth } from "@/services/auth";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [
      { title: "Staff Sign In — TRISHNA Control Centre" },
      {
        name: "description",
        content: "Authorized IIT (BHU) personnel sign-in for the TRISHNA monitoring system.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLogin,
});

const demoAccounts = [
  { label: "Administrator", email: "admin@trishna.demo" },
  { label: "Maintenance (R. Prasad)", email: "prasad@trishna.demo" },
  { label: "Maintenance (S. Yadav)", email: "yadav@trishna.demo" },
];

function AdminLogin() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={user.role === "admin" ? "/admin/dashboard" : "/mts"} />;

  async function submit(e: string, p: string) {
    if (!e.trim() || !p) return setError("Enter your email and password.");
    setError("");
    setBusy(true);
    try {
      const u = await signIn(e, p);
      navigate({ to: u.role === "admin" ? "/admin/dashboard" : "/mts" });
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? friendly(err.message)
          : "Couldn't sign in. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-brand-gradient p-12 text-primary-foreground lg:flex">
        <Logo size="sm" withText={false} />
        <div>
          <h1 className="font-display text-4xl font-bold leading-tight">TRISHNA Control Centre</h1>
          <p className="mt-4 max-w-md text-sm text-primary-foreground/80">
            Monitoring, complaint verification and maintenance management for the drinking-water
            booths of IIT (BHU), Varanasi.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/70">
          {isDemoMode() ? "Demo mode · simulated data" : "Connected to Firebase"}
        </p>
      </div>

      <div className="flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm">
          <Logo size="md" subtitle="IIT (BHU) Varanasi" className="lg:hidden" />
          <span className="mt-8 inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent-foreground lg:mt-0">
            <Lock className="h-3.5 w-3.5" /> Authorized personnel only
          </span>
          <h2 className="mt-4 font-display text-2xl font-bold text-primary">Sign in</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Administrators and maintenance staff.
          </p>

          <form
            className="mt-6 space-y-4"
            onSubmit={(ev) => {
              ev.preventDefault();
              submit(email, password);
            }}
            noValidate
          >
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                className="mt-2 h-11"
                placeholder="name@itbhu.ac.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                className="mt-2 h-11"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && (
              <p role="alert" className="rounded-lg bg-crit-soft px-3 py-2 text-sm text-crit">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="mr-2 h-4 w-4" />
              )}
              Sign in
            </Button>
          </form>

          {isDemoMode() && (
            <div className="mt-6 rounded-xl border border-border bg-surface p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Demo accounts
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Demo mode has no real authentication. Password for all:{" "}
                <code className="rounded bg-card px-1">{DEMO_PASSWORD}</code>
              </p>
              <div className="mt-3 grid gap-2">
                {demoAccounts.map((a) => (
                  <Button
                    key={a.email}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => submit(a.email, DEMO_PASSWORD)}
                  >
                    Sign in as {a.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <p className="mt-6 text-center text-xs">
            <Link
              to="/"
              className="text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
            >
              Back to public site
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function friendly(msg: string) {
  if (/invalid-credential|wrong-password|user-not-found|invalid-email/i.test(msg))
    return "Incorrect email or password.";
  if (/network/i.test(msg)) return "Network error. Check your connection and try again.";
  if (/too-many-requests/i.test(msg)) return "Too many attempts. Wait a few minutes and try again.";
  return msg;
}
