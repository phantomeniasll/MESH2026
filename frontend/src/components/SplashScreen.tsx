"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { LogoMark } from "@/components/brand/LogoMark";
import { useBetreeStore } from "@/store/useBetreeStore";

const MIN_MS = 900;
const MAX_MS = 9000;

export function SplashScreen() {
  const appReady = useBetreeStore((s) => s.appReady);
  const [minDone, setMinDone] = useState(false);
  const [maxExpired, setMaxExpired] = useState(false);

  // Derive visibility: hide once max time expires OR both conditions are met.
  const visible = !(maxExpired || (appReady && minDone));

  useEffect(() => {
    const t = setTimeout(() => setMinDone(true), MIN_MS);
    return () => clearTimeout(t);
  }, []);

  // Hard fallback — never block the app forever
  useEffect(() => {
    const t = setTimeout(() => setMaxExpired(true), MAX_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#FEF9E0]"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: "easeInOut" }}
        >
          <motion.div
            className="flex flex-col items-center gap-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            {/* Logo breathes at a calm pace throughout */}
            <motion.div
              animate={{ scale: [1, 1.045, 1] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
            >
              <LogoMark size={72} className="text-primary" />
            </motion.div>

            <span className="font-heading text-2xl font-semibold tracking-tight text-primary">
              betree
            </span>

            <span className="text-xs text-[#1B5732]/50 font-sans tracking-widest uppercase">
              Proof of care.
            </span>

            {/* Loading bar — single slow indeterminate sweep, same pace always */}
            <div className="mt-3 w-28 h-[2px] rounded-full bg-[#1B5732]/10 overflow-hidden relative">
              <motion.div
                className="absolute inset-y-0 w-[38%] rounded-full bg-[#1B5732]/55"
                animate={{ x: ["-120%", "380%"] }}
                transition={{
                  duration: 2.6,
                  ease: "easeInOut",
                  repeat: Infinity,
                  repeatDelay: 0.3,
                }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
