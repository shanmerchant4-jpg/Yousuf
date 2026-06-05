import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ISP Billing",
  description: "Customer and payment tracking for ISP staff",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
