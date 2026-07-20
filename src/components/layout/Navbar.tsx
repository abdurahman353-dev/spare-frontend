"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Menu, X, CarFront, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navLinks = [
  { name: "Home", href: "/" },
  { name: "About Us", href: "/about" },
  { name: "Products", href: "/products" },
  { name: "Brands", href: "/brands" },
  { name: "Contact", href: "/contact" },
];

import { ShoppingCart, User as UserIcon, LogOut, Package, Settings as SettingsIcon, CreditCard, ChevronDown, LayoutDashboard, MapPin, Truck } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/components/providers/SettingsProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { cart } = useCart();
  const { user, logout, isAuthenticated, loading: authLoading } = useAuth();
  const { settings } = useSettings();
  const cartCount = cart.reduce((count, item) => count + item.quantity, 0);

  const brandName = settings.store_name || "";

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {(settings.store_logo || brandName) ? (
            <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
              {settings.store_logo ? (
                <div className="h-9 w-9 rounded-full overflow-hidden shrink-0 border border-zinc-200/60">
                  <img src={settings.store_logo} alt={brandName || "Logo"} className="h-full w-full object-cover" />
                </div>
              ) : (
                <div className="h-9 w-9 bg-primary flex items-center justify-center text-white font-black text-xl rounded-sm shadow-lg shadow-primary/20">
                  {brandName[0]?.toUpperCase() || "A"}
                </div>
              )}
              {brandName && (
                <span className="text-xl font-black tracking-tighter text-zinc-900">{brandName.toUpperCase()}<span className="text-primary italic">.</span></span>
              )}
            </Link>
          ) : null}
        </div>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center space-x-8">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              className={`text-sm font-medium transition-colors hover:text-primary ${
                pathname === link.href ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {link.name}
              {pathname === link.href && (
                <motion.div
                  layoutId="navbar-indicator"
                  className="h-0.5 w-full bg-primary mt-1"
                />
              )}
            </Link>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-8">
          <div className="flex items-center gap-4 border-r pr-8">
            <Link id="tour-cart-btn" href="/cart" className="relative group p-2 rounded-full hover:bg-secondary transition-colors">
              <motion.div
                key={cartCount}
                initial={{ scale: 1 }}
                animate={{ scale: cartCount > 0 ? [1, 1.3, 1] : 1 }}
                transition={{ duration: 0.3 }}
              >
                <ShoppingCart className="h-5 w-5 text-zinc-700 group-hover:text-primary transition-colors" />
              </motion.div>
              {cartCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 bg-primary text-white text-[10px] font-black h-5 w-5 rounded-full flex items-center justify-center border-2 border-white shadow-lg"
                >
                  {cartCount}
                </motion.span>
              )}
            </Link>
          </div>

          {authLoading ? (
            /* ── Auth resolving: skeleton so Login never flashes ── */
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-zinc-100 animate-pulse" />
              <div className="hidden lg:flex flex-col gap-1">
                <div className="h-2 w-10 rounded bg-zinc-100 animate-pulse" />
                <div className="h-3 w-16 rounded bg-zinc-100 animate-pulse" />
              </div>
            </div>
          ) : isAuthenticated ? (
            <div className="flex items-center gap-4">
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <div id="tour-profile-menu" className="flex items-center gap-2 group outline-none cursor-pointer">
                    <div className="h-8 w-8 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-600 group-hover:bg-primary group-hover:text-white transition-all">
                      <UserIcon className="h-4 w-4" />
                    </div>
                    <div className="hidden lg:flex flex-col items-start leading-none">
                      <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                        {user?.role === "superadmin" ? "Super Admin" : user?.role === "admin" ? "Admin" : user?.role === "delivery" ? "Driver" : "Customer"}
                      </span>
                      <span className="text-sm font-bold text-zinc-900 uppercase tracking-tighter flex items-center gap-1 group-hover:text-primary transition-colors">
                        {user?.name.split(' ')[0]}
                        <ChevronDown className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 mt-2 rounded-xl border-none shadow-2xl p-2 bg-white ring-1 ring-black/5 animate-in fade-in zoom-in duration-200">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="px-3 py-2">
                      {user?.role === "superadmin" || user?.role === "admin" ? (
                        <>
                          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">System Role</p>
                          <p className="text-sm font-black text-primary tracking-tighter uppercase mt-0.5">
                            {user?.role === "superadmin" ? "SUPER ADMINISTRATOR" : "ADMINISTRATOR"}
                          </p>
                        </>
                      ) : user?.role === "delivery" ? (
                        <>
                          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">System Role</p>
                          <p className="text-sm font-black text-indigo-600 tracking-tighter uppercase mt-0.5">
                            DELIVERY DRIVER
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Loyalty Status</p>
                          {(() => {
                            const ltv = user?.total_spent ?? 0;
                            const platThresh   = parseFloat(settings.rank_platinum_threshold || "150000");
                            const goldThresh   = parseFloat(settings.rank_gold_threshold    || "50000");
                            const silverThresh = parseFloat(settings.rank_silver_threshold  || "10000");
                            let label = "Bronze Member", color = "#b45309"; // amber-700
                            if (ltv >= platThresh) { label = "Platinum Customer"; color = "#0052cc"; }
                            else if (ltv >= goldThresh)   { label = "Gold Member";       color = "#ca8a04"; } // yellow-600
                            else if (ltv >= silverThresh) { label = "Silver Member";     color = "#64748b"; } // slate-500
                            return (
                              <p className="text-sm font-black tracking-tighter uppercase mt-0.5" style={{ color }}>
                                {label}
                              </p>
                            );
                          })()}
                        </>
                      )}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-zinc-50" />
                    
                    {user?.role === "superadmin" || user?.role === "admin" ? (
                      <>
                        <DropdownMenuItem onClick={() => router.push("/dashboard")} className="flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 transition-all cursor-pointer">
                          <LayoutDashboard className="h-4 w-4" /> Admin Panel
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push("/dashboard/settings")} className="flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 transition-all cursor-pointer">
                          <SettingsIcon className="h-4 w-4" /> System Settings
                        </DropdownMenuItem>
                      </>
                    ) : user?.role === "delivery" ? (
                      <>
                        <DropdownMenuItem onClick={() => router.push("/delivery")} className="flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 transition-all cursor-pointer">
                          <Truck className="h-4 w-4" /> Delivery Portal
                        </DropdownMenuItem>
                      </>
                    ) : (
                      <>
                        <DropdownMenuItem onClick={() => router.push("/account")} className="flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 transition-all cursor-pointer">
                          <UserIcon className="h-4 w-4" /> Account Dashboard
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push("/account?tab=orders")} className="flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 transition-all cursor-pointer">
                          <Package className="h-4 w-4" /> My Orders
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push("/account?tab=returns")} className="flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 transition-all cursor-pointer">
                          <RotateCcw className="h-4 w-4" /> Returns &amp; Refunds
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push("/account?tab=address")} className="flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 transition-all cursor-pointer">
                          <MapPin className="h-4 w-4" /> Delivery Addresses
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push("/account?tab=settings")} className="flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 transition-all cursor-pointer">
                          <SettingsIcon className="h-4 w-4" /> Account Settings
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator className="bg-zinc-50" />
                  <DropdownMenuItem onClick={logout} className="flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold text-red-600 hover:bg-red-50 transition-all cursor-pointer">
                    <LogOut className="h-4 w-4" /> Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="h-6 w-px bg-zinc-200 mx-2 hidden lg:block" />

              <button 
                onClick={logout}
                className="h-8 w-8 flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-700 transition-all border border-red-100"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-6">
              <Link href="/login" className="text-sm font-bold text-zinc-900 hover:text-primary transition-colors uppercase tracking-tighter">
                Login
              </Link>
              <Link href="/contact" className={cn(buttonVariants(), "h-11 px-6 font-bold bg-zinc-950 text-white rounded-sm hover:bg-primary transition-all")}>
                GET A QUOTE
              </Link>
            </div>
          )}
        </div>

        {/* Mobile: Cart + Menu */}
        <div className="md:hidden flex items-center gap-1">
          <Link href="/cart" className="relative p-2 rounded-full hover:bg-secondary transition-colors">
            <ShoppingCart className="h-5 w-5 text-zinc-700" />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-primary text-white text-[9px] font-black h-4 w-4 rounded-full flex items-center justify-center border-2 border-white shadow">
                {cartCount}
              </span>
            )}
          </Link>
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(!isOpen)}>
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
      </div>

      {/* Mobile Nav Drawer */}
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="md:hidden border-b bg-background shadow-lg"
        >
          <div className="container mx-auto px-4 py-4 flex flex-col space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className={`text-sm font-semibold py-2.5 px-3 rounded-lg transition-colors flex items-center gap-2 ${
                  pathname === link.href
                    ? "text-primary bg-blue-50"
                    : "text-zinc-700 hover:text-primary hover:bg-zinc-50"
                }`}
              >
                {link.name}
              </Link>
            ))}

            <div className="h-px bg-zinc-100 my-1" />

            {isAuthenticated ? (
              <>
                {/* User info */}
                <div className="flex items-center gap-3 px-3 py-2">
                  <div className="h-9 w-9 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-600 shrink-0">
                    <UserIcon className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col leading-tight">
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                      {user?.role === "superadmin" ? "Super Admin" : user?.role === "admin" ? "Admin" : user?.role === "delivery" ? "Driver" : "Customer"}
                    </span>
                    <span className="text-sm font-bold text-zinc-900">{user?.name}</span>
                  </div>
                </div>

                <div className="h-px bg-zinc-100 my-1" />

                {/* Admin links */}
                {(user?.role === "superadmin" || user?.role === "admin") ? (
                  <>
                    <Link href="/dashboard" onClick={() => setIsOpen(false)} className="text-sm font-semibold py-2.5 px-3 rounded-lg text-zinc-700 hover:text-primary hover:bg-zinc-50 flex items-center gap-2">
                      <LayoutDashboard className="h-4 w-4" /> Admin Panel
                    </Link>
                    <Link href="/dashboard/settings" onClick={() => setIsOpen(false)} className="text-sm font-semibold py-2.5 px-3 rounded-lg text-zinc-700 hover:text-primary hover:bg-zinc-50 flex items-center gap-2">
                      <SettingsIcon className="h-4 w-4" /> System Settings
                    </Link>
                  </>
                ) : user?.role === "delivery" ? (
                  <>
                    <Link href="/delivery" onClick={() => setIsOpen(false)} className="text-sm font-semibold py-2.5 px-3 rounded-lg text-zinc-700 hover:text-primary hover:bg-zinc-50 flex items-center gap-2">
                      <Truck className="h-4 w-4" /> Delivery Portal
                    </Link>
                  </>
                ) : (
                  <>
                    <Link href="/account" onClick={() => setIsOpen(false)} className="text-sm font-semibold py-2.5 px-3 rounded-lg text-zinc-700 hover:text-primary hover:bg-zinc-50 flex items-center gap-2">
                      <UserIcon className="h-4 w-4" /> Account Dashboard
                    </Link>
                    <Link href="/account?tab=orders" onClick={() => setIsOpen(false)} className="text-sm font-semibold py-2.5 px-3 rounded-lg text-zinc-700 hover:text-primary hover:bg-zinc-50 flex items-center gap-2">
                      <Package className="h-4 w-4" /> My Orders
                    </Link>
                    <Link href="/account?tab=returns" onClick={() => setIsOpen(false)} className="text-sm font-semibold py-2.5 px-3 rounded-lg text-zinc-700 hover:text-primary hover:bg-zinc-50 flex items-center gap-2">
                      <RotateCcw className="h-4 w-4" /> Returns &amp; Refunds
                    </Link>
                    <Link href="/account?tab=address" onClick={() => setIsOpen(false)} className="text-sm font-semibold py-2.5 px-3 rounded-lg text-zinc-700 hover:text-primary hover:bg-zinc-50 flex items-center gap-2">
                      <MapPin className="h-4 w-4" /> Delivery Addresses
                    </Link>
                    <Link href="/cart" onClick={() => setIsOpen(false)} className="text-sm font-semibold py-2.5 px-3 rounded-lg text-zinc-700 hover:text-primary hover:bg-zinc-50 flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4" /> My Cart {cartCount > 0 && <span className="ml-auto bg-primary text-white text-[10px] font-black h-5 min-w-5 px-1 rounded-full flex items-center justify-center">{cartCount}</span>}
                    </Link>
                  </>
                )}

                <div className="h-px bg-zinc-100 my-1" />

                <button
                  onClick={() => { logout(); setIsOpen(false); }}
                  className="w-full text-left text-sm font-semibold py-2.5 px-3 rounded-lg text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                >
                  <LogOut className="h-4 w-4" /> Sign Out
                </button>
              </>
            ) : (
              <>
                <div className="h-px bg-zinc-100 my-1" />
                <Link href="/login" onClick={() => setIsOpen(false)} className="text-sm font-semibold py-2.5 px-3 rounded-lg text-zinc-700 hover:text-primary hover:bg-zinc-50 flex items-center gap-2">
                  <UserIcon className="h-4 w-4" /> Partner Login
                </Link>
                <Link href="/contact" onClick={() => setIsOpen(false)} className={cn(buttonVariants(), "w-full mt-1 font-bold")}>
                  Get Quote
                </Link>
              </>
            )}
          </div>
        </motion.div>
      )}
    </nav>
  );
}
