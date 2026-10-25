import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertCircle, ArrowRight, Keyboard, ScanLine } from "lucide-react";
import { useState } from "react";
import { BoothScanner } from "@/components/trishna/BoothScanner";
import { PublicLayout } from "@/components/trishna/PublicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { findBooth } from "@/data/booths";
import { parseBoothCode } from "@/lib/boothUtils";
import { useBooths } from "@/services/store";

export const Route = createFileRoute("/scan")({
  head: () => ({
    meta: [
      { title: "Scan or Enter Booth Code — TRISHNA" },
      {
        name: "description",
        content:
          "Scan the QR code on a water booth, or type its booth code, to see live status and water quality.",
      },
    ],
  }),
  component: ScanPage,
});

function ScanPage() {
  const navigate = useNavigate();
  const booths = useBooths();
  const [tab, setTab] = useState<"scan" | "code">("scan");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  function open(raw: string) {
    const id = parseBoothCode(raw);
    if (!id) {
      setError("That doesn't look like a TRISHNA booth code.");
      return false;
    }
    const booth = findBooth(booths, id);
    if (!booth) {
      setError(`No booth found for "${id}". Check the code printed under the QR and try again.`);
      return false;
    }
    setError("");
    navigate({ to: "/booth/$id", params: { id: booth.id } });
    return true;
  }

  return (
    <PublicLayout>
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="font-display text-3xl font-bold text-primary">Check a water booth</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Scan the QR code on the cooler, or type the booth code printed next to it.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-2 rounded-xl bg-surface p-1">
          {(
            [
              { key: "scan", label: "Scan QR", icon: ScanLine },
              { key: "code", label: "Enter code", icon: Keyboard },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              aria-pressed={tab === t.key}
              onClick={() => {
                setTab(t.key);
                setError("");
              }}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                tab === t.key ? "bg-card text-primary shadow-card" : "text-muted-foreground"
              }`}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {tab === "scan" ? (
            <BoothScanner onScan={(text) => open(text)} />
          ) : (
            <form
              className="card-elevated space-y-4 p-6"
              onSubmit={(e) => {
                e.preventDefault();
                open(code);
              }}
            >
              <label htmlFor="booth-code" className="text-sm font-semibold">
                Booth code
              </label>
              <Input
                id="booth-code"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setError("");
                }}
                list="scan-booth-list"
                placeholder="e.g. B-17"
                autoComplete="off"
                autoCapitalize="characters"
                className="h-12 text-lg font-semibold uppercase tracking-wider"
              />
              <datalist id="scan-booth-list">
                {booths.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.location}
                  </option>
                ))}
              </datalist>
              <Button type="submit" size="lg" className="w-full" disabled={!code.trim()}>
                View booth status <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Try a demo code
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {booths.slice(0, 6).map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => open(b.id)}
                      className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-primary hover:bg-accent"
                    >
                      {b.id}
                    </button>
                  ))}
                </div>
              </div>
            </form>
          )}
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-xl border border-crit/25 bg-crit-soft p-4 text-sm text-crit"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Need a QR to test with? Open{" "}
          <Link
            to="/manage"
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            Add &amp; manage booths
          </Link>{" "}
          and click the QR button on any booth.
        </p>
      </div>
    </PublicLayout>
  );
}
