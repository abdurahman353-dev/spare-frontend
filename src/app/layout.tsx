import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { CartProvider } from "@/context/CartContext";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "react-hot-toast";
import { SettingsProvider } from "@/components/providers/SettingsProvider";
import PasswordChangeGuard from "@/components/providers/PasswordChangeGuard";
import { getSiteUrl } from "@/lib/site-url";

const inter = Inter({ subsets: ["latin"] });

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "AutoSpare East Africa | Premium Automotive Spare Parts",
    template: "%s | AutoSpare East Africa",
  },
  description:
    "Premium Mercedes-Benz and commercial vehicle spare parts distribution across East Africa. Quality filters, engine components, brake systems, and fast dispatch in Kenya, Uganda, Tanzania, Rwanda, and Burundi.",
  keywords: [
    "AutoSpare East Africa",
    "Mercedes-Benz spare parts",
    "spare parts Kenya",
    "genuine auto parts Nairobi",
    "commercial vehicle spares",
    "engine components",
    "oil filter",
    "brake pads",
    "auto parts distribution",
  ],
  authors: [{ name: "AutoSpare East Africa" }],
  creator: "AutoSpare East Africa",
  publisher: "AutoSpare East Africa",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    title: "AutoSpare East Africa | Genuine Auto Spare Parts & Fast Dispatch",
    description:
      "Find genuine automotive spare parts by part number, vehicle model, or engine code with fast delivery across East Africa.",
    siteName: "AutoSpare East Africa",
  },
  twitter: {
    card: "summary_large_image",
    title: "AutoSpare East Africa | Premium Automotive Spare Parts",
    description:
      "Genuine Mercedes-Benz and commercial automotive spare parts delivered across East Africa.",
  },
  alternates: {
    canonical: siteUrl,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AutoPartsStore",
    name: "AutoSpare East Africa",
    description: "Premium automotive spare parts distribution across Kenya and East Africa.",
    url: siteUrl,
    telephone: "+254700000000",
    priceRange: "KSh",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Nairobi",
      addressCountry: "KE",
    },
    areaServed: ["Kenya", "Uganda", "Tanzania", "Rwanda", "Burundi"],
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${inter.className} min-h-screen flex flex-col bg-background text-foreground antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          forcedTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <SettingsProvider>
            <AuthProvider>
              <PasswordChangeGuard>
                <CartProvider>
                  {children}
                  <Toaster position="top-right" />
                </CartProvider>
              </PasswordChangeGuard>
            </AuthProvider>
          </SettingsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
