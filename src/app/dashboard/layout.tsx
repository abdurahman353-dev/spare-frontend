"use client";

import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Loader2 } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace("/login");
      } else if (user.must_change_password) {
        router.replace("/change-password");
      } else if (user.role !== "admin" && user.role !== "superadmin") {
        router.replace("/products");
      }
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-50">
        <Loader2 className="h-8 w-8 animate-spin text-[#0052cc]" />
      </div>
    );
  }

  // Prevent flash of content if user is unauthorized or must change password or is not admin
  if (!user || user.must_change_password || (user.role !== "admin" && user.role !== "superadmin")) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-zinc-50/50">
          {children}
        </main>
      </div>
    </div>
  );
}
