const PREFIX = "betree:tree:";

// Demo override: the physical QR sticker on the demo tree encodes KA-00103,
// but the tree with the live sensor in the DB is KA-00001. Map it so scanning
// the sticker drives the real sensored tree.
const DEMO_ID_OVERRIDES: Record<string, string> = {
  "KA-00103": "KA-00001",
};

/** Normalise "KA00103", "ka-103", "KA-00103" → canonical "KA-00103". */
function canonicalId(raw: string): string {
  const m = raw.toUpperCase().match(/KA-?0*(\d{1,5})/);
  if (!m) return raw.trim();
  return `KA-${m[1].padStart(5, "0")}`;
}

export function encodeTreePayload(treeId: string): string {
  return `${PREFIX}${treeId}`;
}

/**
 * Decode a scanned QR value into a tree id. Tolerant of several encodings so a
 * real-world sticker scans reliably:
 *   - "betree:tree:KA-00103"  (our canonical payload)
 *   - "KA-00103" / "KA00103"  (bare id)
 *   - "https://betree.me/t/KA-00103"  (URL form)
 * Applies the demo id override at the end.
 */
export function decodeTreePayload(raw: string): string {
  let value = raw.trim();
  if (value.startsWith(PREFIX)) value = value.slice(PREFIX.length);
  if (value.includes("/")) value = value.split("/").filter(Boolean).pop() ?? value;

  const id = canonicalId(value);
  if (!/^KA-\d{5}$/.test(id)) throw new Error("Not a BeTree QR code");
  return DEMO_ID_OVERRIDES[id] ?? id;
}
