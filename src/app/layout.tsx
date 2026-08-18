import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PushNavigationBridge } from "@/components/PushNavigationBridge";

export const metadata: Metadata = {
  title: "Salut! – Die Trinkspiel App",
  description:
    "Salut! bringt jede Party auf ein neues Level: Trinkchallenges mit Foto- & Videobeweis, Live-Ranking und automatische Geburtstags-Events.",
  applicationName: "Salut!",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Salut!",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.svg",
    apple: "/apple-icon.png",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#050505",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground bg-noise">
        <PushNavigationBridge />
        {children}
      </body>
    </html>
  );
}
