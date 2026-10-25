import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, ImagePlus, Info, Loader2, MapPin, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PublicLayout } from "@/components/trishna/PublicLayout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { findBooth } from "@/data/booths";
import { COMPLAINT_CATEGORIES, type ComplaintCategory } from "@/data/types";
import { MAX_PHOTO_BYTES, submitComplaint, validateComplaint } from "@/services/actions";
import { useBooths } from "@/services/store";

export const Route = createFileRoute("/report")({
  validateSearch: (search: Record<string, unknown>): { booth?: string } =>
    typeof search["booth"] === "string" ? { booth: search["booth"] } : {},
  head: () => ({
    meta: [
      { title: "Report a Water Booth Issue — TRISHNA" },
      {
        name: "description",
        content: "Report a faulty drinking-water booth on the IIT (BHU) campus. No login required.",
      },
    ],
  }),
  component: ReportPage,
});

const selectClass =
  "h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

function ReportPage() {
  const { booth: boothParam } = Route.useSearch();
  const booths = useBooths();
  const [boothId, setBoothId] = useState(boothParam ?? "");
  const [category, setCategory] = useState<ComplaintCategory>(COMPLAINT_CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ id: string; photoFailed: boolean } | null>(null);

  const booth = findBooth(booths, boothId || "");
  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : ""), [photo]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input = { boothId, category, description, photo };
    const problem = validateComplaint(input);
    if (problem) return setError(problem);
    setError("");
    setBusy(true);
    try {
      setDone(await submitComplaint(input));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't send your report. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <PublicLayout>
        <div className="mx-auto w-full max-w-xl px-4 py-20 text-center sm:px-6">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-ok-soft">
            <CheckCircle2 className="h-8 w-8 text-ok" />
          </span>
          <h1 className="mt-6 font-display text-2xl font-bold text-primary">Report submitted</h1>
          <p className="mt-3 text-sm text-muted-foreground">Your reference number is</p>
          <p className="mt-1 select-all font-display text-3xl font-bold tracking-wider text-primary">
            {done.id}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Save it to track progress. Reports are reviewed by an administrator before they change
            the booth's official status.
          </p>
          {done.photoFailed && (
            <p
              role="alert"
              className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn-foreground"
            >
              Your report was saved, but the photo could not be uploaded.
            </p>
          )}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link to="/track" search={{ ref: done.id }}>
                Track this report
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/find" search={{}}>
                Find another booth
              </Link>
            </Button>
          </div>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="font-display text-3xl font-bold text-primary">Report an issue</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          No account needed. Anyone on campus can report a problem.
        </p>

        <form className="card-elevated mt-6 space-y-6 p-6" onSubmit={onSubmit} noValidate>
          <div>
            <Label htmlFor="boothId">Booth</Label>
            <select
              id="boothId"
              className={`${selectClass} mt-2`}
              value={booth?.id ?? ""}
              onChange={(e) => setBoothId(e.target.value)}
              aria-required
            >
              <option value="">Select the booth ID…</option>
              {[...booths]
                .sort((a, b) => a.id.localeCompare(b.id))
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.id} · {b.location}
                  </option>
                ))}
            </select>
            {booth && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" /> {booth.building} · {booth.floor}
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Not sure of the ID?{" "}
              <Link to="/scan" className="underline">
                Scan the QR code
              </Link>
              .
            </p>
          </div>

          <fieldset>
            <legend className="text-sm font-semibold">Issue category</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {COMPLAINT_CATEGORIES.map((c) => (
                <label
                  key={c}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
                    category === c
                      ? "border-primary bg-accent text-accent-foreground"
                      : "border-border hover:bg-surface"
                  }`}
                >
                  <input
                    type="radio"
                    name="category"
                    value={c}
                    checked={category === c}
                    onChange={() => setCategory(c)}
                    className="h-4 w-4 accent-[var(--primary)]"
                  />
                  {c}
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={4}
              maxLength={1000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What did you observe? For example: the cooler is running but the water is warm."
              className="mt-2"
              aria-required
            />
            <p className="mt-1 text-right text-[11px] text-muted-foreground">
              {description.length}/1000
            </p>
          </div>

          <div>
            <Label htmlFor="photo">Photo (optional)</Label>
            {photo ? (
              <div className="mt-2 flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
                <img
                  src={preview}
                  alt="Selected photo preview"
                  className="h-16 w-16 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="truncate font-medium">{photo.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(photo.size / 1024).toFixed(0)} KB
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove photo"
                  onClick={() => setPhoto(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label
                htmlFor="photo"
                className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-8 text-center transition-colors hover:border-aqua"
              >
                <ImagePlus className="h-6 w-6 text-aqua" />
                <span className="mt-2 text-sm font-medium">Add a photo of the booth</span>
                <span className="text-xs text-muted-foreground">
                  Image file, up to {MAX_PHOTO_BYTES / 1024 / 1024} MB
                </span>
              </label>
            )}
            <input
              id="photo"
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                e.target.value = "";
                if (f && !f.type.startsWith("image/"))
                  return setError("The photo must be an image file.");
                if (f && f.size > MAX_PHOTO_BYTES)
                  return setError("The photo must be 5 MB or smaller.");
                setError("");
                setPhoto(f);
              }}
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-crit-soft px-3 py-2 text-sm text-crit">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {busy ? "Sending…" : "Submit Report"}
          </Button>
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Reports are reviewed before they are reflected in the official booth status.
          </p>
        </form>
      </div>
    </PublicLayout>
  );
}
