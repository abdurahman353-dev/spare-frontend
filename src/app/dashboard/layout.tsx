import type { Metadata } from "next";
import DashboardShell from "./dashboard-shell";

/**
 * Server Component layout — exports metadata (noindex) for the dashboard.
 * The actual client-side UI shell is in dashboard-shell.tsx.
 */
export const metadata: Metadata = {
    title: "Admin Dashboard — AutoSpare East Africa",
    robots: { index: false, follow: false, noarchive: true },
};

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <DashboardShell>{children}</DashboardShell>;
}
