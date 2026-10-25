import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Booth } from "@/data/types";
import { recordFilterReplacement } from "@/services/actions";
import { useAuth } from "@/services/auth";

/** Records a filter replacement: resets litres processed and the install date, and logs service history. */
export function ReplaceFilterDialog({
  booth,
  onClose,
}: {
  booth: Booth | null;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [type, setType] = useState("");
  const [cap, setCap] = useState("");
  const [days, setDays] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (booth) {
      setType(booth.filter.type);
      setCap(String(booth.filter.ratedCapacityL));
      setDays(String(booth.filter.maxServiceDays));
      setErr("");
    }
  }, [booth]);

  async function submit() {
    const c = Number(cap);
    const d = Number(days);
    if (!(c > 0) || !(d > 0))
      return setErr("Capacity and service interval must be greater than 0.");
    if (!booth || !user) return;
    setBusy(true);
    try {
      await recordFilterReplacement(booth.id, user.id, {
        type: type.trim() || booth.filter.type,
        ratedCapacityL: c,
        maxServiceDays: d,
      });
      toast.success(`Filter replacement recorded for ${booth.id}. Counters reset.`);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!booth} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record filter replacement · {booth?.id}</DialogTitle>
          <DialogDescription>
            Resets litres processed to 0 and the install date to now. The change is stored in
            service history.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="ft">Filter type</Label>
            <Input
              id="ft"
              className="mt-1"
              value={type}
              onChange={(e) => setType(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="fc">Rated capacity (L)</Label>
              <Input
                id="fc"
                type="number"
                min={1}
                className="mt-1"
                value={cap}
                onChange={(e) => setCap(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="fd">Max service interval (days)</Label>
              <Input
                id="fd"
                type="number"
                min={1}
                className="mt-1"
                value={days}
                onChange={(e) => setDays(e.target.value)}
              />
            </div>
          </div>
          {err && (
            <p role="alert" className="text-sm text-crit">
              {err}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Saving…" : "Record replacement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
