import type { Metadata } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";

export const metadata: Metadata = {
  title: "CSA Trading Cards",
  description: "Collect, trade, and showcase digital trading cards of CSA Rocket League players",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <NavBar />
        <main className="main">
          {children}
        </main>
      </body>
    </html>
  );
}
