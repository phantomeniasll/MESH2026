"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Nfc } from "lucide-react";
import { decodeTreePayload } from "@/lib/qr";

interface Props {
  onTreeId: (id: string) => void;
}

type NDEFRecord = { recordType: string; toText: () => string };
type NDEFReadingEvent = { message: { records: NDEFRecord[] } };

interface NDEFReaderInstance {
  scan(): Promise<void>;
  onreading: ((event: NDEFReadingEvent) => void) | null;
}

export function NfcReader({ onTreeId }: Props) {
  const [scanning, setScanning] = useState(false);

  const start = async () => {
    setScanning(true);
    try {
      const NDEFReaderClass = (window as unknown as Record<string, unknown>)["NDEFReader"] as new () => NDEFReaderInstance;
      const ndef = new NDEFReaderClass();
      await ndef.scan();
      ndef.onreading = (event: NDEFReadingEvent) => {
        const record = event.message.records.find((r) => r.recordType === "text");
        if (record) {
          try {
            const id = decodeTreePayload(record.toText());
            onTreeId(id);
          } catch {
            // Not a BeTree tag
          }
        }
      };
    } catch {
      setScanning(false);
    }
  };

  return (
    <Button onClick={start} disabled={scanning} variant="outline" className="w-full gap-2">
      <Nfc size={18} />
      {scanning ? "Waiting for NFC tag…" : "Tap NFC tag"}
    </Button>
  );
}
