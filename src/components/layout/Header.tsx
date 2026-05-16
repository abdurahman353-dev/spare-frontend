"use client";

import { Bell, Search, Menu, User, LogOut, Settings, Key } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import Link from "next/link";

export function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="h-16 border-b bg-white flex items-center justify-between px-4 lg:px-6 shadow-sm z-30">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="md:hidden text-zinc-500">
          <Menu className="h-5 w-5" />
        </Button>
        <div className="hidden md:flex relative w-64 lg:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input 
            type="search" 
            placeholder="Search precision parts, orders..." 
            className="w-full bg-zinc-50 pl-10 border-zinc-200 rounded-lg h-10 text-sm focus-visible:ring-[#0052cc]"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="relative text-zinc-500 hover:text-[#0052cc] hover:bg-blue-50 transition-colors">
          <Bell className="h-5 w-5" />
          <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-red-500 border-2 border-white" />
        </Button>
        
        <div className="h-8 w-px bg-zinc-200 mx-1" />

        <DropdownMenu>
          <DropdownMenuTrigger className="relative h-10 flex items-center gap-2 px-2 group outline-none cursor-pointer">
            <div className="h-8 w-8 bg-[#0052cc] rounded-full flex items-center justify-center text-white shadow-sm">
              <User className="h-4 w-4" />
            </div>
            <div className="hidden lg:flex flex-col items-start leading-none">
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Admin Portal</span>
              <span className="text-sm font-bold text-[#0052cc] uppercase tracking-tighter flex items-center gap-1 transition-colors mt-1">
                {user?.name || "Admin"}
              </span>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64 mt-2 rounded-xl shadow-2xl border-zinc-200" align="end">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-4 bg-zinc-50/50 rounded-t-xl">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-black text-zinc-900 leading-none">{user?.name}</p>
                  <p className="text-xs font-medium text-zinc-500 truncate">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup className="p-2">
              <Link href="/dashboard/settings">
                <DropdownMenuItem className="cursor-pointer rounded-lg flex items-center gap-3 py-2.5 px-3 hover:bg-blue-50 hover:text-[#0052cc] transition-colors font-bold text-xs">
                  <Key className="h-4 w-4" />
                  Change Password
                </DropdownMenuItem>
              </Link>
              <Link href="/dashboard/settings">
                <DropdownMenuItem className="cursor-pointer rounded-lg flex items-center gap-3 py-2.5 px-3 hover:bg-blue-50 hover:text-[#0052cc] transition-colors font-bold text-xs">
                  <Settings className="h-4 w-4" />
                  Account Settings
                </DropdownMenuItem>
              </Link>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <div className="p-2">
              <DropdownMenuItem 
                onClick={() => logout()}
                className="cursor-pointer rounded-lg flex items-center gap-3 py-2.5 px-3 text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors font-bold text-xs"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
