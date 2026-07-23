import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { ToastContainer } from "@/components/ui/toast";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Vibrant Construction Co. | ERP",
  description: "Vibrant Construction Co. — Precision in every project. Construction management and ERP portal.",
  icons: { icon: "/icon.png" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SessionProvider>
          <Providers>
            {children}
            <ToastContainer />
          </Providers>
        </SessionProvider>
      </body>
    </html>
  );
}
