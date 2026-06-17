"use client";

import { Bell, Search, Menu, User, LogOut, Settings, Key, ChevronRight, Home, Undo2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { usePathname } from "next/navigation";
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
import { useEffect, useState } from "react";
import api from "@/lib/axios";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const { user, logout } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const pathname = usePathname();

  const pathSegments = pathname ? pathname.split("/").filter(Boolean) : [];
  
  const getSegmentTitle = (segment: string) => {
    const titleMap: Record<string, string> = {
      dashboard: "Overview",
      products: "Products",
      inventory: "Inventory",
      orders: "Orders",
      customers: "Customers",
      suppliers: "Suppliers",
      logistics: "Logistics Hub",
      reports: "Reports & Analytics",
      settings: "System Settings",
    };
    return titleMap[segment.toLowerCase()] || segment.charAt(0).toUpperCase() + segment.slice(1);
  };

  const fetchNotifications = async () => {
    try {
      const res = await api.get("/notifications");
      const dismissed = JSON.parse(localStorage.getItem("dismissed_notifications") || "[]");
      const active = res.data.notifications.filter((n: any) => !dismissed.includes(n.id));
      setNotifications(active);
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const cancellationNotifications = notifications.filter((n: any) => n.type === 'cancellation_request');
  const generalNotifications = notifications.filter((n: any) => n.type !== 'cancellation_request');
  const generalUnreadCount = generalNotifications.length;
  const cancellationUnreadCount = cancellationNotifications.length;

  const handleMarkAllGeneralRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const dismissed = JSON.parse(localStorage.getItem("dismissed_notifications") || "[]");
    const newDismissed = [...dismissed, ...generalNotifications.map((n: any) => n.id)];
    localStorage.setItem("dismissed_notifications", JSON.stringify(newDismissed));
    setNotifications(notifications.filter((n: any) => n.type === 'cancellation_request'));
  };

  const handleMarkAllCancellationsRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const dismissed = JSON.parse(localStorage.getItem("dismissed_notifications") || "[]");
    const newDismissed = [...dismissed, ...cancellationNotifications.map((n: any) => n.id)];
    localStorage.setItem("dismissed_notifications", JSON.stringify(newDismissed));
    setNotifications(notifications.filter((n: any) => n.type !== 'cancellation_request'));
  };

  const handleDismissNotification = (id: string) => {
    const dismissed = JSON.parse(localStorage.getItem("dismissed_notifications") || "[]");
    if (!dismissed.includes(id)) {
      localStorage.setItem("dismissed_notifications", JSON.stringify([...dismissed, id]));
    }
    const active = notifications.filter((n: any) => n.id !== id);
    setNotifications(active);
  };

  return (
    <header className="h-16 border-b bg-white flex items-center justify-between px-4 lg:px-6 shadow-sm z-30">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="md:hidden text-zinc-500" onClick={onMenuClick}>
          <Menu className="h-5 w-5" />
        </Button>
        <div className="hidden md:flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500 bg-zinc-50 border border-zinc-200 px-3.5 py-2 rounded-xl">
          <Link href="/dashboard" className="flex items-center gap-1.5 text-zinc-500 hover:text-[#0052cc] transition-all">
            <Home className="h-3.5 w-3.5 text-zinc-400" />
            <span>Dashboard</span>
          </Link>
          {pathSegments.length > 1 && (
            <>
              <ChevronRight className="h-3 w-3 text-zinc-300 stroke-[3]" />
              <Link href={pathname || "/dashboard"} className="text-[#0052cc] font-black transition-all hover:opacity-90">
                {getSegmentTitle(pathSegments[pathSegments.length - 1])}
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Cancellation Alert Dropdown (Critical Action Alerts) */}
        {cancellationNotifications.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger className="relative text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer outline-none rounded-full h-10 w-10 flex items-center justify-center shrink-0">
              <Undo2 className={cn(
                "h-5 w-5 transition-all duration-300",
                cancellationUnreadCount > 0 ? "text-rose-600 animate-pulse stroke-[2.5]" : "text-zinc-500"
              )} />
              {cancellationUnreadCount > 0 && (
                <span className="absolute top-2 right-2 h-4 min-w-4 px-1 rounded-full bg-rose-600 border-2 border-white text-[8px] font-black text-white flex items-center justify-center animate-bounce">
                  {cancellationUnreadCount}
                </span>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80 mt-2 rounded-xl shadow-2xl border-zinc-200 p-0 overflow-hidden" align="end">
              <div className="p-4 border-b border-rose-100 bg-rose-50/30 flex justify-between items-center">
                <span className="text-xs font-black text-rose-850 uppercase tracking-wider">Cancellations</span>
                <div className="flex items-center gap-3">
                  {cancellationUnreadCount > 0 && (
                    <button 
                      onClick={handleMarkAllCancellationsRead}
                      className="text-[10px] font-black text-rose-700 hover:text-rose-800 transition-colors uppercase tracking-wider cursor-pointer outline-none border-none bg-transparent"
                    >
                      Clear all
                    </button>
                  )}
                  <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-200 border-none font-bold text-[10px]">
                    {cancellationNotifications.length}
                  </Badge>
                </div>
              </div>
              <div className="max-h-[260px] overflow-y-auto divide-y divide-rose-50">
                {cancellationNotifications.map((notif: any) => (
                  <Link href={notif.link || "/dashboard/orders?status=Cancellation Requested"} key={notif.id} className="block" onClick={() => handleDismissNotification(notif.id)}>
                    <DropdownMenuItem className="p-4 cursor-pointer hover:bg-rose-50/25 transition-colors flex flex-col items-start gap-1">
                      <div className="flex items-center justify-between w-full">
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-rose-100 text-rose-700">
                          {notif.title}
                        </span>
                        <span className="text-[9px] font-medium text-zinc-400">{notif.time}</span>
                      </div>
                      <p className="text-xs font-semibold text-zinc-700 leading-snug mt-1">{notif.message}</p>
                    </DropdownMenuItem>
                  </Link>
                ))}
              </div>
              <div className="p-3 bg-zinc-50 border-t border-zinc-100 text-center">
                <Link 
                  href="/dashboard/orders?status=Cancellation Requested" 
                  className="inline-flex items-center justify-center w-full py-2 bg-rose-600 hover:bg-rose-750 text-white rounded-lg text-xs font-bold shadow-sm transition-all"
                >
                  Open Cancellation Manager
                </Link>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Standard Notification Bell Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger className="relative text-zinc-500 hover:text-[#0052cc] hover:bg-blue-50 transition-colors cursor-pointer outline-none rounded-full h-10 w-10 flex items-center justify-center shrink-0">
            <Bell className={cn(
              "h-5 w-5 transition-all duration-300",
              generalUnreadCount > 0 ? "text-red-500 animate-pulse stroke-[2.5]" : "text-zinc-500"
            )} />
            {generalUnreadCount > 0 && (
              <span className="absolute top-2 right-2 h-4 min-w-4 px-1 rounded-full bg-red-500 border-2 border-white text-[8px] font-black text-white flex items-center justify-center animate-bounce">
                {generalUnreadCount}
              </span>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-80 mt-2 rounded-xl shadow-2xl border-zinc-200 p-0 overflow-hidden" align="end">
            <div className="p-4 border-b border-zinc-100 bg-zinc-50/50 flex justify-between items-center">
              <span className="text-xs font-black text-zinc-900 uppercase tracking-wider">Alert Center</span>
              <div className="flex items-center gap-3">
                {generalUnreadCount > 0 && (
                  <button 
                    onClick={handleMarkAllGeneralRead}
                    className="text-[10px] font-black text-[#0052cc] hover:text-[#0052cc]/85 transition-colors uppercase tracking-wider cursor-pointer outline-none border-none bg-transparent"
                  >
                    Mark all read
                  </button>
                )}
                {generalNotifications.length > 0 && (
                  <Badge className="bg-blue-100 text-[#0052cc] hover:bg-blue-200 border-none font-bold text-[10px]">
                    {generalNotifications.length}
                  </Badge>
                )}
              </div>
            </div>
            <div className="max-h-[300px] overflow-y-auto divide-y divide-zinc-100">
              {generalNotifications.length === 0 ? (
                <div className="p-8 text-center text-zinc-400 flex flex-col items-center gap-2">
                  <Bell className="h-8 w-8 text-zinc-300 stroke-[1.5]" />
                  <p className="text-xs font-bold uppercase tracking-wider">All quiet here</p>
                  <p className="text-[10px] text-zinc-400">No active stock or order alerts.</p>
                </div>
              ) : (
                generalNotifications.map((notif: any) => (
                  <Link href={notif.link} key={notif.id} className="block" onClick={() => handleDismissNotification(notif.id)}>
                    <DropdownMenuItem className="p-4 cursor-pointer hover:bg-zinc-50 transition-colors flex flex-col items-start gap-1">
                      <div className="flex items-center justify-between w-full">
                        <span className={cn(
                          "text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded",
                          notif.type === 'low_stock' && "bg-red-50 text-red-700",
                          notif.type === 'new_order' && "bg-emerald-50 text-emerald-700",
                          notif.type === 'daily_report' && "bg-indigo-50 text-indigo-700",
                          notif.type === 'inquiry' && "bg-blue-50 text-blue-700"
                        )}>
                          {notif.title}
                        </span>
                        <span className="text-[9px] font-medium text-zinc-400">{notif.time}</span>
                      </div>
                      <p className="text-xs font-medium text-zinc-600 leading-snug mt-1">{notif.message}</p>
                    </DropdownMenuItem>
                  </Link>
                ))
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
        
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
