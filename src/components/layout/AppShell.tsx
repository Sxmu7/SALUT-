"use client";

import { ReactNode } from "react";
import { BottomNav } from "./BottomNav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 pb-28 max-w-md w-full mx-auto">{children}</div>
      <BottomNav />
    </div>
  );
}
