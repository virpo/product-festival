import type { Metadata } from "next";
import { Instrument_Sans, Space_Grotesk } from "next/font/google";
import { FestivalProvider } from "@/lib/repository/repository-context";
import { FestivalConnectionNotice } from "@/components/connection/ConnectionNotice";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  variable: "--font-body",
  subsets: ["latin", "latin-ext"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: {
    default: "Product Festival",
    template: "%s · Product Festival",
  },
  description:
    "Try every product, leave useful feedback, and invest fake money without a public leaderboard.",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="sk"
      className={`${instrumentSans.variable} ${spaceGrotesk.variable}`}
    >
      <body>
        <FestivalProvider>
          <FestivalConnectionNotice />
          {children}
        </FestivalProvider>
      </body>
    </html>
  );
}
