import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Minimal Fify React starter",
  description:
    "A minimal trusted information interface using the supported Fify packages.",
};

export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
