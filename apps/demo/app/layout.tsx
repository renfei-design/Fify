import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./shadcn.css";

export const metadata: Metadata = {
  title: "Fify — AI that speaks interface",
  description:
    "A framework for streaming AI answers as trusted, well-designed user interfaces.",
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#171717",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark" style={{ background: "#171717" }}>
      <body className="fify-document-canvas">
        <div
          aria-hidden="true"
          className="fify-shell-backdrop"
          style={{
            position: "fixed",
            inset: 0,
            display: "grid",
            gridTemplateColumns: "248px minmax(0, 1fr)",
            minHeight: "100svh",
            color: "#ececf2",
            background: "#171717",
          }}
        >
          <aside>
            <strong>Fify</strong>
          </aside>
          <main>
            <span />
            <span />
            <span />
          </main>
        </div>
        <div className="fify-route-content">{children}</div>
      </body>
    </html>
  );
}
