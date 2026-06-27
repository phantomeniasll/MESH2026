const PREFIX = "betree:tree:";

export function encodeTreePayload(treeId: string): string {
  return `${PREFIX}${treeId}`;
}

export function decodeTreePayload(raw: string): string {
  if (!raw.startsWith(PREFIX)) throw new Error("Not a BeTree QR code");
  const id = raw.slice(PREFIX.length).trim();
  if (!id) throw new Error("Empty tree id");
  return id;
}
