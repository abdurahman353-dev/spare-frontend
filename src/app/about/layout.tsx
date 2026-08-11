import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "About Us — AutoSpare East Africa",
    description:
        "Learn about AutoSpare East Africa — the leading distributor of genuine Mercedes-Benz spare parts serving Kenya, Uganda, Tanzania, Rwanda, and Burundi for over 20 years.",
    alternates: { canonical: "/about" },
    openGraph: {
        title: "About AutoSpare East Africa",
        description:
            "Over 20 years of specialized Mercedes-Benz parts distribution across East Africa. 850+ partners, 5 regional hubs, 100% genuine parts.",
        url: "/about",
    },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
