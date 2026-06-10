"use client";

import { motion } from "framer-motion";

export function ReportLoadingAnimation() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-midnight/95 backdrop-blur-sm">
      {/* Breathing concentric rings */}
      <div className="relative flex items-center justify-center w-48 h-48">
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border border-glow-gold/20"
            initial={{ width: 40, height: 40, opacity: 0 }}
            animate={{
              width: [40 + i * 30, 80 + i * 40, 40 + i * 30],
              height: [40 + i * 30, 80 + i * 40, 40 + i * 30],
              opacity: [0.1 + i * 0.05, 0.4 - i * 0.05, 0.1 + i * 0.05],
            }}
            transition={{
              duration: 3,
              delay: i * 0.6,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}

        {/* Central glowing dot */}
        <motion.div
          className="absolute w-3 h-3 rounded-full bg-glow-gold/60"
          animate={{
            scale: [1, 1.4, 1],
            opacity: [0.6, 1, 0.6],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>

      {/* Loading text */}
      <motion.p
        className="mt-8 text-sm text-muted/60 tracking-wider"
        animate={{ opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
      >
        正在凝视你的深夜轨迹...
      </motion.p>
    </div>
  );
}
