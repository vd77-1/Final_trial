import { Link, Navigate, useNavigate } from "@tanstack/react-router";
import { Bell, ChevronDown, Loader2, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "./Logo";
import { DataModeBanner } from "./DataModeBanner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { UserRole } from "@/data/types";
import { cn } from "@/lib/utils";
import { signOut, useAuth } from "@/services/auth";
import { useComplaints, useMounted } from "@/services/store";

const adminTabs = [
  { to: "/admin/dashboard", label: "Overview" },
  { to: "/admin/booths", label: "Booths" },
  { to: "/admin/complaints", label: "Complaints" },
  { to: "/admin/maintenance", label: "Maintenance" },
  { to: "/admin/risk", label: "Risk" },
  { to: "/admin/qr", label: "QR codes" },
  { to: "/manage", label: "Add booth" },
] as const;

/**
 * Protected layout for staff pages. `requires` is enforced here in the UI; the data itself is
 * protected by Firestore security rules in Firebase mode (see firestore.rules).
 */
export function AdminShell({
  children,
  requires = "admin",
}: {
  children: ReactNode;
  requires?: UserRole;
}) {
  const { user, loading } = useAuth();
  const mounted = useMounted();
  const navigate = useNavigate();
  const complaints = useComplaints();
  const newCount = complaints.filter((c) => c.status === "Submitted").length;

  if (!mounted || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking your session…
      </div>
    );
  }
  if (!user) return <Navigate to="/admin/login" />;
  if (user.role !== requires) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
        <ShieldAlert className="h-10 w-10 text-crit" />
        <h1 className="mt-4 font-display text-2xl font-bold text-primary">Not authorised</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You are signed in as {user.name} (
          {user.role === "admin" ? "Administrator" : "Maintenance staff"}), which cannot open this
          area.
        </p>
        <div className="mt-6 flex gap-2">
          <Button asChild>
            <Link to={user.role === "admin" ? "/admin/dashboard" : "/mts"}>Go to my dashboard</Link>
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              await signOut();
              navigate({ to: "/admin/login" });
            }}
          >
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  const roleLabel = user.role === "admin" ? "Administrator" : "Maintenance staff (MTS)";
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="sticky top-0 z-30 border-b border-border bg-card">
        <div className="flex h-14 items-center gap-4 px-4 sm:px-6">
          <Logo size="sm" subtitle={user.role === "admin" ? "Control Centre" : "Maintenance"} />
          {user.role === "admin" && (
            <nav className="hidden flex-1 items-center gap-1 lg:flex" aria-label="Admin">
              {adminTabs.map((t) => (
                <Link
                  key={t.to}
                  to={t.to}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
                  activeProps={{ className: "bg-accent !text-accent-foreground" }}
                >
                  {t.label}
                </Link>
              ))}
            </nav>
          )}
          <div className="ml-auto flex items-center gap-2">
            {user.role === "admin" && (
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="relative"
                aria-label={`${newCount} new complaints`}
              >
                <Link to="/admin/complaints">
                  <Bell className="h-5 w-5" />
                  {newCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-crit px-1 text-[10px] font-bold text-white">
                      {newCount}
                    </span>
                  )}
                </Link>
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-brand-gradient text-xs text-primary-foreground">
                      {user.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden text-left leading-tight sm:block">
                    <span className="block text-xs font-semibold">{user.name}</span>
                    <span className="block text-[10px] text-muted-foreground">{roleLabel}</span>
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>{roleLabel}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {user.role === "admin" &&
                  adminTabs.map((t) => (
                    <DropdownMenuItem key={t.to} asChild className="lg:hidden">
                      <Link to={t.to}>{t.label}</Link>
                    </DropdownMenuItem>
                  ))}
                <DropdownMenuItem asChild>
                  <Link to="/">Public site</Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={async () => {
                    await signOut();
                    navigate({ to: "/admin/login" });
                  }}
                >
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-7xl px-4 pt-4 lg:px-6">
        <DataModeBanner />
      </div>
      <div className={cn("min-h-0 flex-1")}>{children}</div>
    </div>
  );
}
