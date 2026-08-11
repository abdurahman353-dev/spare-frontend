import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({ subsets: ["latin"] });

const SITE_URL = "https://spare-backend-k79l.onrender.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Spare Parts Distribution | Mercedes-Benz East Africa",
    template: "%s | AutoSpare East Africa",
  },
  description:
    "Premium Mercedes-Benz genuine spare parts distribution across East Africa. Serving Kenya, Uganda, Tanzania, Rwanda, and Burundi with OEM and aftermarket parts from certified German suppliers.",
  keywords: [
    "Mercedes-Benz spare parts",
    "Mercedes parts East Africa",
    "OEM spare parts Kenya",
    "automotive spare parts Nairobi",
    "genuine Mercedes parts",
    "AutoSpare East Africa",
    "spare parts distribution Kenya",
  ],
  authors: [{ name: "AutoSpare East Africa" }],
  creator: "AutoSpare East Africa",
  publisher: "AutoSpare East Africa",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_KE",
    url: SITE_URL,
    siteName: "AutoSpare East Africa",
    title: "Spare Parts Distribution | Mercedes-Benz East Africa",
    description:
      "Premium Mercedes-Benz genuine spare parts distribution across East Africa. OEM & aftermarket parts sourced from certified German suppliers.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "AutoSpare East Africa — Mercedes-Benz Spare Parts",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@AutoSpareEA",
    title: "AutoSpare East Africa — Genuine Mercedes-Benz Parts",
    description:
      "Premium spare parts distribution across East Africa. Serving Kenya, Uganda, Tanzania, Rwanda, and Burundi.",
    images: ["/og-image.png"],
  },
};

import { CartProvider } from "@/context/CartContext";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "react-hot-toast";
import { SettingsProvider } from "@/components/providers/SettingsProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: "AutoSpare East Africa",
        url: SITE_URL,
        logo: {
          "@type": "ImageObject",
          url: `${SITE_URL}/favicon.ico`,
        },
        description:
          "Premium Mercedes-Benz genuine spare parts distribution across East Africa.",
        areaServed: ["Kenya", "Uganda", "Tanzania", "Rwanda", "Burundi"],
        sameAs: [],
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: "AutoSpare East Africa",
        publisher: { "@id": `${SITE_URL}/#organization` },
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${SITE_URL}/products?search={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen flex flex-col bg-background text-foreground antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          forcedTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <SettingsProvider>
            <AuthProvider>
              <CartProvider>
                {children}
                <Toaster position="top-right" />
              </CartProvider>
            </AuthProvider>
          </SettingsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
