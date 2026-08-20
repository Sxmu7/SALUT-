"use client";

import { ReactNode, createContext, useContext, useEffect, useState } from "react";
import { LS_KEYS, readLS, writeLS } from "@/lib/storage";

type CoworkerTheme = "dark" | "light";

/**
 * Eigene, in sich geschlossene Designsprache für den Kollegen-Modus
 * (Sparkassen-Rot statt Party-Lila, siehe globals.css ".theme-coworker") –
 * "komplett getrennt" vom Trinkspiel-Teil, wie vom Nutzer gewünscht. Anders
 * als der Rest der App (die nur Dark kennt) ist hier Dark/Light umschaltbar
 * (Toggle siehe app/coworker/page.tsx TopBar), rein lokal auf diesem Gerät
 * gemerkt – unabhängig vom sonstigen Nutzerprofil.
 */
export default function CoworkerLayout({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<CoworkerTheme>("dark");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setTheme(readLS<CoworkerTheme>(LS_KEYS.coworkerTheme, "dark"));
    setReady(true);
  }, []);

  // Bewusst erst nach dem Client-Mount rendern (kein SSR-Mismatch): der
  // Toggle-Zustand kommt aus localStorage, das existiert serverseitig
  // nicht. Bis dahin ein simpler dunkler Platzhalter in der Zielfarbe,
  // damit es nicht kurz weiß aufblitzt.
  if (!ready) {
    return <div className="theme-coworker dark min-h-screen" style={{ background: "#0d0405" }} />;
  }

  return (
    <CoworkerThemeProvider theme={theme} onChangeTheme={setTheme}>
      {children}
    </CoworkerThemeProvider>
  );
}

const ThemeCtx = createContext<{
  theme: CoworkerTheme;
  toggle: () => void;
}>({ theme: "dark", toggle: () => {} });

export function useCoworkerTheme() {
  return useContext(ThemeCtx);
}

function CoworkerThemeProvider({
  theme,
  onChangeTheme,
  children,
}: {
  theme: CoworkerTheme;
  onChangeTheme: (t: CoworkerTheme) => void;
  children: ReactNode;
}) {
  function toggle() {
    const next: CoworkerTheme = theme === "dark" ? "light" : "dark";
    onChangeTheme(next);
    writeLS(LS_KEYS.coworkerTheme, next);
  }

  return (
    <ThemeCtx.Provider value={{ theme, toggle }}>
      <div className={`theme-coworker ${theme} min-h-screen`} style={{ background: "var(--background)", color: "var(--foreground)" }}>
        {children}
      </div>
    </ThemeCtx.Provider>
  );
}
