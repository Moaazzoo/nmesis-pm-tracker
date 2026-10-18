import type { Metadata } from "next";
import { cera, arquitecta } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "NMESIS Tracker",
  description: "Production tracker for NMESIS MotionLab.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${cera.variable} ${arquitecta.variable}`}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
