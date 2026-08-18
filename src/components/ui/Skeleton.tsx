import { cn } from "@/lib/utils";

/**
 * Platzhalter-Block mit Shimmer-Animation (siehe .skeleton-shimmer in
 * globals.css). Baustein für seitenspezifische Lade-Layouts – damit beim
 * ersten Rendern (localStorage-Hydration) kein leerer/schwarzer Screen
 * aufblitzt, sondern schon die grobe Form der echten Seite zu sehen ist.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton-shimmer rounded-xl", className)} />;
}

/** Platzhalter für eine TopBar (Titel + Untertitel). */
export function TopBarSkeleton() {
  return (
    <div className="safe-top px-5 pt-5 pb-3">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-4 w-28 mt-2" />
    </div>
  );
}

/** Platzhalter für eine card-surface-Card mit ein paar Textzeilen. */
export function CardSkeleton({ className, lines = 2 }: { className?: string; lines?: number }) {
  return (
    <div className={cn("card-surface rounded-[var(--radius-md)] p-5", className)}>
      <Skeleton className="h-4 w-24 mb-3" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("h-3.5 mt-2", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

/** Platzhalter für eine Zeile mit Avatar + Name + Wert (Ranking, Mitgliederlisten). */
export function RowSkeleton() {
  return (
    <div className="flex items-center gap-2.5">
      <Skeleton className="w-8 h-8 rounded-full shrink-0" />
      <Skeleton className="h-3.5 flex-1" />
      <Skeleton className="h-3.5 w-8" />
    </div>
  );
}
