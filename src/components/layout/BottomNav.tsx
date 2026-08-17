"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/dashboard", label: "Home", icon: "🏠" },
  { href: "/challenges", label: "Challenges", icon: "🎯" },
  { href: "/ranking", label: "Ranking", icon: "🏆" },
  { href: "/groups", label: "Gruppen", icon: "👥" },
  { href: "/profile", label: "Profil", icon: "⚙️" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-[max(0.75rem,var(--safe-bottom))]">
      <div className="max-w-md mx-auto glass-strong rounded-[28px] px-2 py-2 flex items-center justify-between shadow-2xl">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname?.startsWith(tab.href + "/");
          return (
            <Link key={tab.href} href={tab.href} className="relative flex-1">
              <motion.div
                whileTap={{ scale: 0.9 }}
                className="relative flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-2xl"
              >
                {active && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-2xl"
                    style={{ background: "rgba(255,255,255,0.08)" }}
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <span
                  className={cn(
                    "relative text-lg transition-transform",
                    active && "scale-110"
                  )}
                >
                  {tab.icon}
                </span>
                <span
                  className={cn(
                    "relative text-[10px] font-medium",
                    active ? "text-foreground" : "text-muted"
                  )}
                >
                  {tab.label}
                </span>
              </motion.div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
