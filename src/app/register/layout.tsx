import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Create Account — AutoSpare East Africa",
    description: "Create your AutoSpare East Africa account to start ordering genuine Mercedes-Benz spare parts with wholesale pricing.",
    robots: { index: false, follow: false },
    alternates: { canonical: "/register" },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
