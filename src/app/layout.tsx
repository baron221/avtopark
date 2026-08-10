import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Manrope } from "next/font/google";
import { ServiceWorkerRegister } from "./ServiceWorkerRegister";
import { InstallPrompt } from "./InstallPrompt";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Автопарк Фойда Тизими",
  description: "Фарғона–Қува автопарк учун фойда ҳисоби тизими",
  appleWebApp: {
    capable: true,
    title: "Автопарк",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#4F46E5",
  // Without this, env(safe-area-inset-bottom) always resolves to 0 — needed
  // so the fixed mobile bottom nav doesn't crowd a device's on-screen
  // gesture bar/nav buttons.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="uz"
      className={`${spaceGrotesk.variable} ${manrope.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-page text-heading">
        <ServiceWorkerRegister />
        <InstallPrompt />
        {children}
      </body>
    </html>
  );
}
