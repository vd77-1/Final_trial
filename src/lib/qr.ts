import QRCode from "qrcode";
import type { Booth } from "@/data/types";

/** Public URL a booth's QR code opens, e.g. https://site/booth/B-17 */
export const boothUrl = (id: string) => `${window.location.origin}/booth/${encodeURIComponent(id)}`;

export const qrDataUrl = (id: string, width = 560) =>
  QRCode.toDataURL(boothUrl(id), { width, margin: 2, errorCorrectionLevel: "M" });

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Opens a print sheet with one or more QR labels (booth names are HTML-escaped). */
export async function printQrLabels(booths: Booth[]) {
  const w = window.open("", "_blank", "width=720,height=900");
  if (!w) return false;
  const cells = await Promise.all(
    booths.map(async (b) => {
      const src = await qrDataUrl(b.id, 480);
      return `<div class="c"><h3>TRISHNA · Booth ${esc(b.id)}</h3><p>${esc(b.location)}</p><img src="${src}"/><small>Scan to check water status</small></div>`;
    }),
  );
  w.document.write(
    `<!doctype html><title>TRISHNA QR codes</title><style>body{font-family:sans-serif;margin:16px}` +
      `.g{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}.c{border:1px solid #ccc;padding:12px;text-align:center;break-inside:avoid}` +
      `h3{margin:0}p{margin:4px 0;font-size:12px}img{width:220px;height:220px}small{display:block;font-size:11px}</style>` +
      `<div class="g">${cells.join("")}</div><script>window.onload=()=>window.print()</script>`,
  );
  w.document.close();
  return true;
}
