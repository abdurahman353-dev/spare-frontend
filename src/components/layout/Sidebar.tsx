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
  CarFront
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/components/providers/SettingsProvider";

const sidebarLinks = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Products", href: "/dashboard/products", icon: Package },
  { name: "Inventory", href: "/dashboard/inventory", icon: Warehouse },
  { name: "Orders", href: "/dashboard/orders", icon: ShoppingCart },
  { name: "Customers", href: "/dashboard/customers", icon: Users },
  { name: "Suppliers", href: "/dashboard/suppliers", icon: ShieldAlert },
  { name: "Logistics", href: "/dashboard/logistics", icon: Truck },
  { name: "Reports", href: "/dashboard/reports", icon: FileBarChart },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { settings } = useSettings();

  const brandName = settings.store_name || "";
  const storeLogo = settings.store_logo || "";

  const links = user?.role === "superadmin" 
    ? [...sidebarLinks, { name: "Admins & Audits", href: "/dashboard/admins", icon: ShieldCheck }]
    : sidebarLinks;

  return (
    <aside className="w-64 border-r bg-card flex flex-col hidden md:flex h-full min-h-screen">
      <div className="h-16 flex items-center px-6 border-b">
        <Link href="/" className="flex items-center gap-2.5 min-w-0">
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
              >
                <Icon className={cn("h-5 w-5", isActive ? "text-primary-foreground" : "text-muted-foreground")} />
                {link.name}
              </Link>
            );
          })}
        </nav>
      </div>

    </aside>
  );
}
