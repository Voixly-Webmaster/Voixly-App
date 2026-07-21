import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ToastProvider } from "@/components/providers/toast-provider";
import { ConfirmDialogProvider } from "@/components/shared/confirm-dialog";
import { CommandPaletteProvider } from "@/components/shared/command-palette";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ClientHub | Voixly",
  description: "Premium client portal and operations hub by Voixly",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans`}>
        <ThemeProvider>
          <SessionProvider>
            <ToastProvider>
              <ConfirmDialogProvider>
                <CommandPaletteProvider>{children}</CommandPaletteProvider>
              </ConfirmDialogProvider>
            </ToastProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
