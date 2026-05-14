"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Menu, X, CarFront, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { useTheme } from "next-themes";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navLinks = [
  { name: "Home", href: "/" },
  { name: "About Us", href: "/about" },
  { name: "Products", href: "/products" },
  { name: "Brands", href: "/brands" },
  { name: "Contact", href: "/contact" },
];

import { ShoppingCart, User as UserIcon, LogOut, Package, Settings as SettingsIcon, CreditCard, ChevronDown } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
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
  const { theme, setTheme } = useTheme();
  const { cart } = useCart();
  const { user, logout, isAuthenticated } = useAuth();
  const cartCount = cart.reduce((count, item) => count + item.quantity, 0);

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
            <div className="h-9 w-9 bg-primary flex items-center justify-center text-white font-black text-xl rounded-sm shadow-lg shadow-primary/20">
              A
            </div>
            <span className="text-xl font-black tracking-tighter text-zinc-900">AUTOSPARE<span className="text-primary italic">.</span></span>
          </Link>
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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>

            <Link href="/cart" className="relative group p-2 rounded-full hover:bg-secondary transition-colors">
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

          {isAuthenticated ? (
            <div className="flex items-center gap-4">
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <div className="flex items-center gap-2 group outline-none cursor-pointer">
                    <div className="h-8 w-8 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-600 group-hover:bg-primary group-hover:text-white transition-all">
                      <UserIcon className="h-4 w-4" />
                    </div>
                    <div className="hidden lg:flex flex-col items-start leading-none">
                      <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Customer</span>
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
                      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Loyalty Status</p>
                      <p className="text-sm font-black text-primary tracking-tighter uppercase mt-0.5">PLATINUM CUSTOMER</p>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-zinc-50" />
                    <DropdownMenuItem onClick={() => router.push("/account")} className="flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 transition-all cursor-pointer">
                      <UserIcon className="h-4 w-4" /> Account Dashboard
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push("/account?tab=orders")} className="flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 transition-all cursor-pointer">
                      <Package className="h-4 w-4" /> My Orders
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push("/account?tab=payment")} className="flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 transition-all cursor-pointer">
                      <CreditCard className="h-4 w-4" /> Payment Methods
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push("/account?tab=settings")} className="flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 transition-all cursor-pointer">
                      <SettingsIcon className="h-4 w-4" /> Account Settings
                    </DropdownMenuItem>
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

        {/* Mobile menu button */}
        <div className="md:hidden flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(!isOpen)}>
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
      </div>

      {/* Mobile Nav */}
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="md:hidden border-b bg-background"
        >
          <div className="container mx-auto px-4 py-4 flex flex-col space-y-4">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className={`text-sm font-medium transition-colors ${
                  pathname === link.href ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {link.name}
              </Link>
            ))}
            <div className="h-px bg-border my-2" />
            <Link href="/login" onClick={() => setIsOpen(false)} className="text-sm font-medium text-muted-foreground">
              Partner Login
            </Link>
            <Link href="/contact" onClick={() => setIsOpen(false)} className={cn(buttonVariants(), "w-full mt-2")}>
              Get Quote
            </Link>
          </div>
        </motion.div>
      )}
    </nav>
  );
}
