"use client";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { QrCode, X } from "lucide-react";
import { useBetreeStore } from "@/store/useBetreeStore";
import { QrScanner } from "./QrScanner";
import { NfcReader } from "./NfcReader";
import { VerifyView } from "./VerifyView";
import { VerifiedConfetti } from "./VerifiedConfetti";
import { getDict } from "@/lib/i18n";
import { getTreeById } from "@/lib/mock/trees";
import { toast } from "sonner";

export function ScanSheet() {
  const {
    scanPhase,
    scanTreeId,
    scanMode,
    setScanMode,
    rejectionReason,
    closeScan,
    setScanPhase,
    setScanTreeId,
    confirmWatering,
    rejectWatering,
    mapTreesFC,
    lang,
  } = useBetreeStore();
  const t = getDict(lang);

  const hasNfc = typeof window !== "undefined" && "NDEFReader" in window;
  const open = scanPhase !== "idle";

  const handleTreeId = (id: string) => {
    setScanTreeId(id);
    setScanPhase("verifying");
  };

  const handleVerified = async () => {
    if (!scanTreeId) return;
    const result = await confirmWatering(scanTreeId);
    const earned = result?.points_earned ?? 25;
    const species =
      mapTreesFC?.features.find((f) => f.properties.id === scanTreeId)?.properties.species ??
      getTreeById(scanTreeId)?.properties.species;
    toast.success(`+${earned} Credits · Proof of care`, {
      description: species,
    });
    setTimeout(closeScan, 2000);
  };

  const handleRejected = (reason: string) => {
    rejectWatering(reason);
    toast.error(reason);
  };

  // Right button: verify against the REAL sensor on KA-00001.
  const handleLiveDemo = () => {
    setScanMode("live");
    setScanTreeId("KA-00001");
    setScanPhase("verifying");
  };

  const handleDemoMode = () => {
    setScanMode("sim");
    if (mapTreesFC) {
      const thirsty = mapTreesFC.features.find(
        (f) => f.properties.status === "thirsty"
      );
      const id =
        scanTreeId ??
        thirsty?.properties.id ??
        mapTreesFC.features[0]?.properties.id;
      if (id) handleTreeId(id);
      return;
    }
    (async () => {
      const { generateTrees } = await import("@/lib/mock/trees");
      const trees = generateTrees();
      const thirsty = trees.features.find(
        (f) => f.properties.status === "thirsty"
      );
      const id =
        scanTreeId ??
        thirsty?.properties.id ??
        trees.features[0].properties.id;
      handleTreeId(id);
    })();
  };

  return (
    <Drawer open={open} onOpenChange={(v) => !v && closeScan()}>
      <DrawerContent className="flex flex-col min-h-[40dvh] data-[vaul-drawer-direction=bottom]:bottom-[calc(3.5rem+env(safe-area-inset-bottom))] data-[vaul-drawer-direction=bottom]:rounded-b-xl">
        <DrawerHeader className="flex items-center justify-between border-b border-border pb-3">
          <DrawerTitle className="font-heading">
            {scanPhase === "verifying"
              ? "Confirm watering"
              : scanPhase === "verified"
              ? "Confirmed!"
              : scanPhase === "rejected"
              ? "Not confirmed"
              : t.scanning}
          </DrawerTitle>
          <button
            onClick={closeScan}
            className="text-muted-foreground hover:text-foreground"
          >
            <X size={20} />
          </button>
        </DrawerHeader>

        <div className="flex-1 relative overflow-hidden">
          <VerifiedConfetti show={scanPhase === "verified"} />

          {scanPhase === "rejected" && (
            <div className="flex flex-col items-center justify-center h-full gap-4 px-6">
              <p className="text-center text-sm text-muted-foreground">{rejectionReason}</p>
              <Button onClick={closeScan} variant="outline">
                Close
              </Button>
            </div>
          )}

          {(scanPhase === "verifying" || scanPhase === "verified") && scanTreeId && (
            <VerifyView
              treeId={scanTreeId}
              live={scanMode === "live" || scanTreeId === "KA-00001"}
              onVerified={handleVerified}
              onRejected={handleRejected}
            />
          )}

          {(scanPhase === "picking-method" ||
            scanPhase === "scanning-qr" ||
            scanPhase === "scanning-nfc") && (
            <div className="flex flex-col gap-4 p-4 h-full">
              {scanPhase === "scanning-qr" && (
                <QrScanner onTreeId={handleTreeId} />
              )}
              {scanPhase === "scanning-nfc" && (
                <NfcReader onTreeId={handleTreeId} />
              )}

              {scanPhase === "picking-method" && (
                <div className="flex flex-col gap-3 mt-4">
                  <Button
                    className="w-full gap-2"
                    onClick={() => setScanPhase("scanning-qr")}
                  >
                    <QrCode size={18} />
                    {t.scanQr}
                  </Button>
                  {hasNfc && (
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() => setScanPhase("scanning-nfc")}
                    >
                      {t.tapNfc}
                    </Button>
                  )}
                  {/* Demo: left = simulated watering, right = real KA-00001 sensor */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Button
                      variant="outline"
                      className="w-full text-xs h-auto py-2 leading-tight"
                      onClick={handleDemoMode}
                    >
                      Demo watering
                      <span className="block text-[10px] text-muted-foreground">simulated</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full text-xs h-auto py-2 leading-tight border-primary/40"
                      onClick={handleLiveDemo}
                    >
                      Live sensor
                      <span className="block text-[10px] text-muted-foreground">Tree KA-00001</span>
                    </Button>
                  </div>
                </div>
              )}

              {scanPhase !== "picking-method" && (
                <Button
                  variant="ghost"
                  className="mt-auto text-muted-foreground"
                  onClick={() => setScanPhase("picking-method")}
                >
                  ← Back
                </Button>
              )}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
