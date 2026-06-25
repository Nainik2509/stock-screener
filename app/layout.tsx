import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ThemeToggle from "@/components/ThemeToggle";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Real-Time Stock Screener",
  description:
    "Real-time US equity screener powered by the Finnhub free-tier API.",
};

/*
 * Inline script injected into <head> before any render so the correct theme
 * class is applied before the first paint — eliminates the flash of
 * unstyled/wrong-theme content. It adds either "dark" or "light" to <html>
 * based on localStorage preference, falling back to the OS setting.
 */
const themeScript = `(function(){
  try {
    var s = localStorage.getItem('theme');
    var d = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.add(s === 'dark' || s === 'light' ? s : d ? 'dark' : 'light');
  } catch(e) {}
})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    /*
     * suppressHydrationWarning: the inline script adds a theme class to <html>
     * before React hydrates, creating a mismatch between server HTML (no class)
     * and client HTML (with class). suppressHydrationWarning tells React to
     * ignore this specific attribute discrepancy on the root element.
     */
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col bg-white antialiased dark:bg-slate-950">
        {/* ---- Global header ---- */}
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/90">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2.5">
              {/* Simple chart icon — inline SVG, no icon library */}
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-blue-600 dark:text-blue-400"
                aria-hidden="true"
              >
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              <span className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                Stock Screener
              </span>
              <span className="hidden rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600 sm:inline dark:bg-blue-950 dark:text-blue-400">
                US Equities
              </span>
            </div>
            <ThemeToggle />
          </div>
        </header>

        {/* ---- Page content ---- */}
        <main className="flex-1">{children}</main>

        {/* ---- Footer ---- */}
        <footer className="border-t border-slate-100 py-4 text-center text-xs text-slate-400 dark:border-slate-800 dark:text-slate-600">
          Data provided by{" "}
          <a
            href="https://finnhub.io"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-slate-600 dark:hover:text-slate-400"
          >
            Finnhub
          </a>
          {" · "}Prices may be delayed outside US market hours.
        </footer>
      </body>
    </html>
  );
}
