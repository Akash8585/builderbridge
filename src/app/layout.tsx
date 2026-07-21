import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import "./globals.css";

/* Clear any legacy html-level theme so marketing pages never inherit app dark mode. */
const themeInitializer = `
try {
  delete document.documentElement.dataset.appTheme;
  document.documentElement.style.colorScheme = "light";
} catch (_) {}
`;

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BuilderBridge — Construction Scheduling",
  description: "Simple scheduling & collaboration for construction projects",
  appleWebApp: {
    capable: true,
    title: "BuilderBridge",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#111111",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
      style={{ colorScheme: "light" }}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitializer }} />
      </head>
      <body className="min-h-full flex flex-col bg-canvas text-ink">
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
