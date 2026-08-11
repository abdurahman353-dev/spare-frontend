import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Contact Us — AutoSpare East Africa",
    description:
        "Get in touch with AutoSpare East Africa. Reach our team for spare parts enquiries, wholesale pricing, or distribution partnerships across East Africa.",
    alternates: { canonical: "/contact" },
    openGraph: {
        title: "Contact AutoSpare East Africa",
        description:
            "Contact our team for spare parts enquiries, pricing, and regional distribution partnerships.",
        url: "/contact",
    },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
