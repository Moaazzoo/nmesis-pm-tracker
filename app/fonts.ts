import localFont from "next/font/local";

export const cera = localFont({
  src: [
    { path: "./fonts/cera-pro-light.woff2", weight: "300", style: "normal" },
    { path: "./fonts/cera-pro-regular.woff2", weight: "400", style: "normal" },
  ],
  variable: "--font-cera",
  display: "swap",
});

export const arquitecta = localFont({
  src: [{ path: "./fonts/arquitecta-office.woff2", weight: "400", style: "normal" }],
  variable: "--font-arquitecta",
  display: "swap",
});
