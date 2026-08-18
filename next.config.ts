import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Fast alle Seiten (Dashboard, Gruppen, Profil, Ranking, ...) sind
    // reine Client-Components, die ihre Daten per useEffect aus dem
    // Demo-Speicher oder Supabase laden – es gibt keine Server-Daten, die
    // sich "cachen" lassen sollten. Next.js' Client-Router-Cache stuft sie
    // trotzdem als "static" ein (kein serverseitiges Fetching) und würde
    // sie standardmäßig 5 Minuten lang vorhalten. staleTime 0 erzwingt bei
    // jeder Navigation einen frischen Mount/Refetch statt eines evtl.
    // veralteten, zwischengespeicherten Renders.
    staleTimes: {
      dynamic: 0,
      static: 0,
    },
  },
};

export default nextConfig;
