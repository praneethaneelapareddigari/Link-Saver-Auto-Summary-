import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Link Saver",
  description: "Bookmark saver with auto-summary",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
