import { createFileRoute } from "@tanstack/react-router";
import { Download, Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/trishna/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Booth } from "@/data/types";
import { boothUrl, printQrLabels, qrDataUrl } from "@/lib/qr";
import { useBooths } from "@/services/store";

export const Route = createFileRoute("/admin/qr")({
  head: () => ({
    meta: [{ title: "QR codes — TRISHNA Control Centre" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <AdminShell>
      <QrPage />
    </AdminShell>
  ),
});

function QrCard({ booth }: { booth: Booth }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let off = false;
    qrDataUrl(booth.id, 360).then((s) => !off && setSrc(s));
    return () => {
      off = true;
    };
  }, [booth.id]);
  return (
    <div className="card-elevated p-4 text-center">
      {src ? (
        <img src={src} alt={`QR code for booth ${booth.id}`} className="mx-auto h-40 w-40" />
      ) : (
        <div className="mx-auto h-40 w-40 animate-pulse rounded-lg bg-surface" />
      )}
      <p className="mt-2 font-display font-bold text-primary">{booth.id}</p>
      <p className="truncate text-xs text-muted-foreground">{booth.location}</p>
      <p className="mt-1 break-all text-[10px] text-muted-foreground">{boothUrl(booth.id)}</p>
      <div className="mt-3 flex gap-2">
        <Button asChild size="sm" variant="outline" className="flex-1">
          <a href={src} download={`trishna-${booth.id}.png`}>
            <Download className="mr-1 h-3.5 w-3.5" /> PNG
          </a>
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          onClick={() => printQrLabels([booth])}
        >
          <Printer className="mr-1 h-3.5 w-3.5" /> Print
        </Button>
      </div>
    </div>
  );
}

function QrPage() {
  const booths = useBooths();
  const [q, setQ] = useState("");
  const list = useMemo(
    () =>
      [...booths]
        .filter((b) => !q.trim() || `${b.id} ${b.location}`.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => a.id.localeCompare(b.id)),
    [booths, q],
  );
  return (
    <div className="mx-auto w-full max-w-7xl p-4 lg:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-primary">Booth QR codes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Each code opens the booth's public page. The URL uses this site's address, so print
            codes from the deployed site.
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search booths"
            className="h-10 w-48"
            aria-label="Search booths"
          />
          <Button onClick={() => printQrLabels(list)} disabled={!list.length}>
            <Printer className="mr-2 h-4 w-4" /> Print all ({list.length})
          </Button>
        </div>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {list.map((b) => (
          <QrCard key={b.id} booth={b} />
        ))}
      </div>
    </div>
  );
}
