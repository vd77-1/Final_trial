import { Camera, ImageUp, Loader2, VideoOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  /** Called with the decoded text of every new QR code seen. */
  onScan: (text: string) => void;
};

/** Live camera QR scanner (falls back to uploading a photo of the QR). */
export function BoothScanner({ onScan }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const [state, setState] = useState<"starting" | "scanning" | "error">("starting");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let scanner: import("qr-scanner").default | undefined;
    let cancelled = false;
    let last = { text: "", at: 0 };

    (async () => {
      try {
        const QrScanner = (await import("qr-scanner")).default;
        if (cancelled || !videoRef.current) return;
        if (!(await QrScanner.hasCamera())) throw new Error("No camera found on this device.");
        scanner = new QrScanner(
          videoRef.current,
          (result) => {
            const now = Date.now();
            // ignore the same code re-detected within 3s
            if (result.data === last.text && now - last.at < 3000) return;
            last = { text: result.data, at: now };
            onScanRef.current(result.data);
          },
          {
            preferredCamera: "environment",
            highlightScanRegion: true,
            highlightCodeOutline: true,
            returnDetailedScanResult: true,
            maxScansPerSecond: 8,
          },
        );
        await scanner.start();
        if (!cancelled) setState("scanning");
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        setError(
          /denied|permission|NotAllowed/i.test(msg)
            ? "Camera permission was blocked. Allow camera access in your browser, or upload a photo of the QR instead."
            : /secure|https/i.test(msg)
              ? "Camera needs HTTPS (or localhost). Upload a photo of the QR instead."
              : msg || "Could not start the camera.",
        );
        setState("error");
      }
    })();

    return () => {
      cancelled = true;
      scanner?.stop();
      scanner?.destroy();
    };
  }, []);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const QrScanner = (await import("qr-scanner")).default;
      const result = await QrScanner.scanImage(file, { returnDetailedScanResult: true });
      onScanRef.current(result.data);
    } catch {
      onScanRef.current("");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div>
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-border bg-black sm:aspect-video">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        {state === "starting" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-white/80">
            <Loader2 className="h-6 w-6 animate-spin" /> Starting camera…
          </div>
        )}
        {state === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card p-6 text-center">
            <VideoOff className="h-8 w-8 text-muted-foreground" />
            <p className="max-w-sm text-sm text-muted-foreground">{error}</p>
          </div>
        )}
        {state === "scanning" && (
          <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs font-medium text-white drop-shadow">
            <Camera className="mr-1 inline h-3.5 w-3.5" /> Point the camera at the booth's QR code
          </p>
        )}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ImageUp className="mr-2 h-4 w-4" />
          )}
          Upload a QR photo
        </Button>
        <span className="text-xs text-muted-foreground">Handy on a desktop without a camera.</span>
      </div>
    </div>
  );
}
