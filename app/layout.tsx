import type { Metadata } from "next";
import localFont from "next/font/local";
import { Suspense } from "react";
import "./globals.css";
import Header from "./components/Header";
import { getCurrentUser } from "./actions/auth";
import { MobileMenuProvider } from "./components/MobileMenuProvider";
import MobileSidebar from "./components/MobileSidebar";
import Sidebar from "./components/Sidebar";
import { WalletProvider } from "./components/WalletProvider";
import SWRProvider from "./components/SWRProvider";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Wrootz - Lock Value, Own Content",
  description: "A content platform where time-locked value determines curation and profit sharing",
};

// Force dynamic rendering to avoid cookie-related build errors
export const dynamic = 'force-dynamic';

function SidebarSkeleton() {
  return (
    <div className="space-y-5">
      <div className="card h-48 animate-pulse bg-[var(--surface-2)]" />
      <div className="card h-32 animate-pulse bg-[var(--surface-2)]" />
      <div className="card h-32 animate-pulse bg-[var(--surface-2)]" />
      <div className="card h-24 animate-pulse bg-[var(--surface-2)]" />
    </div>
  );
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let user = null;
  try {
    user = await getCurrentUser();
  } catch (e) {
    console.error('Failed to get current user:', e);
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('wrootz_theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}})()` }} />
        <style dangerouslySetInnerHTML={{ __html: `
          :root {
            --background: #f8fafc;
            --foreground: #0f172a;
            --surface-1: #ffffff;
            --border: #e2e8f0;
          }
          [data-theme="dark"] {
            --background: #0c0f14;
            --foreground: #f1f5f9;
            --surface-1: #151921;
            --border: #2d3748;
          }
          body {
            background: var(--background);
            color: var(--foreground);
          }
        `}} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}
        style={{ background: 'var(--background)', color: 'var(--foreground)' }}
      >
        <SWRProvider>
        <WalletProvider>
          <MobileMenuProvider>
            <Header user={user} />
            <MobileSidebar>
              <Suspense fallback={<SidebarSkeleton />}>
                <Sidebar />
              </Suspense>
            </MobileSidebar>
            <main className="max-w-6xl mx-auto px-4 py-6">
              {children}
            </main>
          </MobileMenuProvider>
        </WalletProvider>
        </SWRProvider>
      </body>
    </html>
  );
}
