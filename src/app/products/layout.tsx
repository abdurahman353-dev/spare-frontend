import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Parts Catalog — Genuine Mercedes-Benz Spare Parts",
    description:
        "Browse our extensive catalog of genuine Mercedes-Benz OEM and aftermarket spare parts. Live inventory across East African warehouse hubs. Order online with M-Pesa.",
    alternates: { canonical: "/products" },
    openGraph: {
        title: "Parts Catalog — AutoSpare East Africa",
        description:
            "10,000+ SKUs of genuine Mercedes-Benz spare parts. Real-time stock levels, competitive wholesale pricing, and fast regional delivery.",
        url: "/products",
    },
    keywords: [
        "Mercedes-Benz parts catalog",
        "OEM spare parts",
        "Mercedes spare parts Kenya",
        "buy Mercedes parts online",
        "M-Pesa spare parts",
    ],
};

export default function ProductsLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
