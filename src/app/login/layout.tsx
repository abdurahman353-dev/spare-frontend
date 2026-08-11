import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Sign In — AutoSpare East Africa",
    description: "Sign in to your AutoSpare East Africa account to browse parts, track orders, and manage your profile.",
    robots: { index: false, follow: false },
    alternates: { canonical: "/login" },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
