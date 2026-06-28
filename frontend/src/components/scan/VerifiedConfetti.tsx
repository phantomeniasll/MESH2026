"use client";
import { motion, AnimatePresence } from "motion/react";
import { LogoMark } from "@/components/brand/LogoMark";
import { REWARD_PER_WATER } from "@/lib/constants";

const DOTS = Array.from({ length: 20 }, (_, i) => i);

export function VerifiedConfetti({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="absolute inset-0 flex flex-col items-center justify-center bg-background/70 backdrop-blur-[1px] z-20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {DOTS.map((i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full"
              style={{
                background: i % 2 === 0 ? "#1B5732" : "#2E9E63",
                left: "50%",
                top: "40%",
              }}
              initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
              animate={{
                x: Math.cos((i / 20) * Math.PI * 2) * 120,
                y: Math.sin((i / 20) * Math.PI * 2) * 100 - 40,
                opacity: 0,
                scale: [0, 1.5, 0],
              }}
              transition={{ delay: i * 0.02, duration: 0.8, ease: "easeOut" }}
            />
          ))}

          <motion.div
            className="flex flex-col items-center gap-3"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 300 }}
          >
            <div className="w-20 h-20 rounded-full bg-[var(--verified)] flex items-center justify-center">
              <LogoMark size={48} className="text-white" />
            </div>
            <h2 className="font-heading text-2xl font-semibold text-foreground">
              +{REWARD_PER_WATER} Credits
            </h2>
            <p className="text-sm text-muted-foreground">Proof of care.</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
