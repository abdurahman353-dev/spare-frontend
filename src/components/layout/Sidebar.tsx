"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Truck,
  Warehouse,
  FileBarChart,
  Settings,
  ShieldAlert,
  ShieldCheck,
  CarFront,
  RotateCcw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/components/providers/SettingsProvider";

const sidebarLinks = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Products", href: "/dashboard/products", icon: Package },
  { name: "Inventory", href: "/dashboard/inventory", icon: Warehouse },
  { name: "Orders", href: "/dashboard/orders", icon: ShoppingCart },
  { name: "Logistics", href: "/dashboard/logistics", icon: Truck },
  { name: "Returns", href: "/dashboard/returns", icon: RotateCcw },
  { name: "Reports", href: "/dashboard/reports", icon: FileBarChart },
  { name: "Customers", href: "/dashboard/customers", icon: Users },
  { name: "Suppliers", href: "/dashboard/suppliers", icon: ShieldAlert },
  { name: "Admins & Audits", href: "/dashboard/admins", icon: ShieldCheck, superadminOnly: true },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function Sidebar({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { settings } = useSettings();

  const brandName = settings.store_name || "";
  const storeLogo = settings.store_logo || "";

  const links = sidebarLinks.filter(link => {
    if (link.superadminOnly && user?.role !== "superadmin") {
      return false;
    }
    return true;
  });

  return (
    <>
      {/* Backdrop overlay for mobile screens */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "w-64 border-r bg-card flex flex-col h-full min-h-screen transition-transform duration-300 z-40",
          "fixed inset-y-0 left-0 md:relative md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="h-16 flex items-center px-6 border-b justify-between">
          <Link href="/" className="flex items-center gap-2.5 min-w-0" onClick={onClose}>
            {storeLogo ? (
              <div className="h-9 w-9 rounded-full overflow-hidden shrink-0 border border-zinc-200">
                <img
                  src={storeLogo}
                  alt={brandName || "Logo"}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-white shrink-0">
                <CarFront className="h-5 w-5" />
              </div>
            )}
            <span className="text-sm font-bold tracking-tight text-zinc-900 truncate leading-tight">
              {brandName || <><span>Admin</span><span className="text-primary">Panel</span></>}
            </span>
          </Link>
          {/* Close button for mobile screens */}
          {onClose && (
            <button
              onClick={onClose}
              className="md:hidden text-zinc-500 hover:text-zinc-700 p-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className="flex-1 overflow-auto py-4">
          <nav className="space-y-1 px-3">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = link.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname === link.href || pathname.startsWith(link.href + "/");

              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                  onClick={onClose}
                >
                  <Icon className={cn("h-5 w-5", isActive ? "text-primary-foreground" : "text-muted-foreground")} />
                  {link.name}
                </Link>
              );
            })}
          </nav>
        </div>

      </aside>
    </>
  );
}
