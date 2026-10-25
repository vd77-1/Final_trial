import { Download, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Booth } from "@/data/types";
import { boothUrl, printQrLabels, qrDataUrl } from "@/lib/qr";

/** Shows (and lets you download / print) the QR code for a booth. */
export function QrDialog({ booth, onClose }: { booth: Booth | null; onClose: () => void }) {
  const [dataUrl, setDataUrl] = useState("");
  const url = booth ? boothUrl(booth.id) : "";

  useEffect(() => {
    if (!booth) {
      setDataUrl("");
      return;
    }
    qrDataUrl(booth.id).then(setDataUrl);
  }, [booth]);

  return (
    <Dialog open={!!booth} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Booth {booth?.id} · QR code</DialogTitle>
          <DialogDescription>
            Stick this on the booth. Scanning it opens the booth's public status page.
          </DialogDescription>
        </DialogHeader>
        {dataUrl ? (
          <img src={dataUrl} alt={`QR code for booth ${booth?.id}`} className="mx-auto h-64 w-64" />
        ) : (
          <div className="mx-auto h-64 w-64 animate-pulse rounded-xl bg-surface" />
        )}
        <p className="break-all text-center text-[11px] text-muted-foreground">{url}</p>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="flex-1">
            <a href={dataUrl} download={`trishna-${booth?.id ?? "booth"}.png`}>
              <Download className="mr-2 h-4 w-4" /> Download
            </a>
          </Button>
          <Button className="flex-1" onClick={() => booth && printQrLabels([booth])}>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
