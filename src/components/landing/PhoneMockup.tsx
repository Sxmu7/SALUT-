"use client";

import { motion } from "framer-motion";

export function PhoneMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, rotate: -4 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ type: "spring", stiffness: 90, damping: 14, delay: 0.3 }}
      className="relative mx-auto w-[240px] h-[490px] rounded-[42px] p-2.5 glass-strong shadow-2xl"
      style={{ boxShadow: "0 40px 80px -20px rgba(191,90,242,0.35)" }}
    >
      <div className="w-full h-full rounded-[32px] overflow-hidden relative bg-[#0b0b0f]">
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-full z-20" />
        <div className="p-4 pt-8 h-full flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted">Nächstes Event</span>
            <span className="text-[10px]">🎂</span>
          </div>
          <motion.div
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2.4, repeat: Infinity }}
            className="font-display font-extrabold text-4xl gradient-text"
          >
            04 Tage
          </motion.div>

          <div className="mt-2 space-y-2">
            {[
              { icon: "🍻", title: "Ex-Trinker", pts: 20 },
              { icon: "💃", title: "Tanz der Elemente", pts: 35 },
              { icon: "🔥", title: "Wasabi-Wette", pts: 55 },
            ].map((c, i) => (
              <motion.div
                key={c.title}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + i * 0.15 }}
                className="flex items-center gap-2 rounded-xl p-2 card-surface"
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-xs"
                  style={{ background: "var(--gradient-party)" }}
                >
                  {c.icon}
                </div>
                <span className="text-[11px] font-medium flex-1 truncate">{c.title}</span>
                <span className="text-[11px] font-bold gradient-text">+{c.pts}</span>
              </motion.div>
            ))}
          </div>

          <div className="mt-auto rounded-2xl p-3 card-surface">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-muted font-semibold">🏆 Ranking</span>
            </div>
            {[
              { rank: 1, name: "Mia", pts: 480 },
              { rank: 2, name: "Du", pts: 410 },
            ].map((r) => (
              <div key={r.name} className="flex items-center gap-2 py-1">
                <span className="text-[10px] w-3 gradient-gold-text font-bold">{r.rank}</span>
                <span className="text-[11px] flex-1">{r.name}</span>
                <span className="text-[11px] font-bold">{r.pts}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
