import { Link } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

function NavLinks({ className, itemClass }: { className?: string; itemClass: string }) {
  return (
    <div className={className}>
      <Link
        to="/"
        activeOptions={{ exact: true }}
        activeProps={{ className: "text-primary bg-accent" }}
        className={itemClass}
      >
        Home
      </Link>
      <Link to="/scan" activeProps={{ className: "text-primary bg-accent" }} className={itemClass}>
        Scan / Enter Code
      </Link>
      <Link
        to="/find"
        search={{}}
        activeProps={{ className: "text-primary bg-accent" }}
        className={itemClass}
      >
        Find a Booth
      </Link>
      <Link
        to="/report"
        search={{}}
        activeProps={{ className: "text-primary bg-accent" }}
        className={itemClass}
      >
        Report an Issue
      </Link>
      <Link
        to="/track"
        search={{}}
        activeProps={{ className: "text-primary bg-accent" }}
        className={itemClass}
      >
        Track a Report
      </Link>
    </div>
  );
}

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo subtitle="IIT (BHU) Varanasi" />
          <nav className="hidden items-center gap-1 md:flex">
            <NavLinks
              className="flex items-center gap-1"
              itemClass="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            />
            <Button asChild size="sm" className="ml-2">
              <Link to="/find" search={{}}>
                Find a Booth
              </Link>
            </Button>
          </nav>
          <Sheet>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <NavLinks
                className="mt-10 flex flex-col gap-1 px-2"
                itemClass="rounded-lg px-3 py-3 text-base font-medium text-foreground hover:bg-accent"
              />
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
          <div>
            <Logo />
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              Tracking &amp; Reporting Infrastructure for Safe Hydration Network Access — a smart
              campus drinking-water monitoring system for IIT (BHU), Varanasi.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Quick links</h3>
            <NavLinks
              className="mt-3 flex flex-col items-start gap-2 text-sm"
              itemClass="text-muted-foreground hover:text-primary"
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Institute</h3>
            <p className="mt-3 text-sm text-muted-foreground">
              Indian Institute of Technology (BHU)
              <br />
              Varanasi, Uttar Pradesh 221005
            </p>
            <Link
              to="/admin/login"
              className="mt-4 inline-block text-xs text-muted-foreground/80 underline-offset-4 hover:text-primary hover:underline"
            >
              Staff access
            </Link>
          </div>
        </div>
        <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">
          Prototype build · Demonstration data only · © 2026 TRISHNA
        </div>
      </footer>
    </div>
  );
}
