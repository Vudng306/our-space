import type { Metadata, Viewport } from "next";
import { Dancing_Script, Patrick_Hand, Quicksand } from "next/font/google";
import "./globals.css";

/**
 * Every face here was checked for a Vietnamese subset before being used — the
 * usual pencil fonts (Caveat, Architects Daughter) ship none, and the
 * diacritics would have fallen back to a different typeface mid-word.
 */
const quicksand = Quicksand({
  subsets: ["latin", "vietnamese"],
  variable: "--font-quicksand",
  display: "swap",
});

const patrickHand = Patrick_Hand({
  weight: "400",
  subsets: ["latin", "vietnamese"],
  variable: "--font-patrick",
  display: "swap",
});

const dancingScript = Dancing_Script({
  subsets: ["latin", "vietnamese"],
  variable: "--font-dancing",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Our Space",
  description: "Một không gian riêng cho hai người.",
  // Nothing here is for the public — keep it out of search results entirely.
  robots: { index: false, follow: false, nocache: true },
  applicationName: "Our Space",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fbf7ef",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="vi"
      className={`${quicksand.variable} ${patrickHand.variable} ${dancingScript.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
