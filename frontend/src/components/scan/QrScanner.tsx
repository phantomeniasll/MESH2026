"use client";
import { useState } from "react";
import { Scanner } from "@yudiel/react-qr-scanner";
import { decodeTreePayload } from "@/lib/qr";
import { toast } from "sonner";
import { AlertCircle, Lock } from "lucide-react";

interface Props {
  onTreeId: (id: string) => void;
}

export function QrScanner({ onTreeId }: Props) {
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Camera getUserMedia requires HTTPS (or localhost)
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 px-6 text-center">
        <Lock size={36} className="text-muted-foreground" />
        <p className="text-sm font-medium">Camera requires HTTPS</p>
        <p className="text-xs text-muted-foreground">
          Open the app over a secure connection (HTTPS) or use Demo mode below.
        </p>
      </div>
    );
  }

  if (cameraError) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 px-6 text-center">
        <AlertCircle size={36} className="text-muted-foreground" />
        <p className="text-sm font-medium">Camera unavailable</p>
        <p className="text-xs text-muted-foreground">{cameraError}</p>
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-square max-w-sm mx-auto rounded-2xl overflow-hidden">
      <Scanner
        formats={["qr_code"]}
        onScan={(results) => {
          const raw = results[0]?.rawValue;
          if (!raw) return;
          try {
            const id = decodeTreePayload(raw);
            onTreeId(id);
          } catch {
            toast.error("Kein BeTree-Code erkannt");
          }
        }}
        onError={(error) => {
          const msg = error?.message ?? "Kamera konnte nicht gestartet werden.";
          setCameraError(msg);
          toast.error("Kamerafehler: " + msg);
        }}
        constraints={{ facingMode: "environment" }}
        components={{ finder: false }}
        styles={{ container: { borderRadius: "1rem" } }}
      />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-48 h-48 border-2 border-primary-foreground rounded-2xl opacity-80" />
      </div>
    </div>
  );
}
