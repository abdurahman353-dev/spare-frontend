"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Package, MapPin, Phone, CheckCircle2, Loader2, LogOut,
  User, Check, X, ArrowLeft, Bell, Search, Filter,
  Truck, Clock, TrendingUp, RefreshCw, ChevronRight,
  AlertCircle, Shield, Key, Info, BarChart3, Wifi, WifiOff,
  SortAsc, SortDesc, Navigation
} from "lucide-react";
import api from "@/lib/axios";
import { toast } from "react-hot-toast";
import { useSettings } from "@/components/providers/SettingsProvider";
import { motion, AnimatePresence } from "framer-motion";

interface OrderItem {
  id: number;
  product: { name: string; part_number?: string };
  quantity: number;
  price: number;
}

interface Order {
  id: number;
  tracking_number: string;
  created_at: string;
  updated_at: string;
  status: string;
  shipping_city: string;
  shipping_address: string;
  shipping_method: string;
  total_amount: number;
  customer?: { name: string; phone?: string; email?: string };
  items?: OrderItem[];
  delivery_signature_url?: string;
}

interface Notification {
  id: number;
  tracking_number: string;
  status: string;
  customer_name: string;
  shipping_city: string;
  assigned_at: string;
  assigned_ago: string;
  item_count: number;
}

interface Stats {
  today_completed: number;
  active_count: number;
  total_delivered: number;
}

// Status badge config
const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  Shipped:   { label: "SHIPPED",   bg: "bg-blue-600",    text: "text-white",        dot: "bg-blue-400"    },
  Arrived:   { label: "ARRIVED",   bg: "bg-emerald-500", text: "text-white",        dot: "bg-emerald-300" },
  Delivered: { label: "DELIVERED", bg: "bg-emerald-100", text: "text-emerald-800",  dot: "bg-emerald-400" },
};

// Notification sound (Web Audio API)
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.frequency.value = 880;
    oscillator.type = "sine";
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.6);
  } catch (_) {}
}

export default function DeliveryPortal() {
  const { user, loading: authLoading, logout } = useAuth();
  const { settings } = useSettings();
  const router = useRouter();

  // Core state
  const [orders, setOrders]           = useState<Order[]>([]);
  const [stats, setStats]             = useState<Stats>({ today_completed: 0, active_count: 0, total_delivered: 0 });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading]         = useState(true);
  const [isOnline, setIsOnline]       = useState(true);
  const [lastSynced, setLastSynced]   = useState<Date | null>(null);
  const [isSyncing, setIsSyncing]     = useState(false);

  // UI panels
  const [activeTab, setActiveTab]             = useState<"active" | "completed">("active");
  const [showProfile, setShowProfile]         = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifUnread, setNotifUnread]         = useState(0);

  // Filter & search
  const [searchQuery, setSearchQuery]         = useState("");
  const [statusFilter, setStatusFilter]       = useState<"all" | "Shipped" | "Arrived">("all");
  const [sortOrder, setSortOrder]             = useState<"newest" | "oldest">("newest");
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  // Signature pad
  const [selectedOrder, setSelectedOrder]     = useState<Order | null>(null);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [submittingSignature, setSubmittingSignature]   = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing]             = useState(false);

  // Arriving action
  const [markingArrived, setMarkingArrived]   = useState<number | null>(null);

  // Polling refs
  // Track orderId → assigned driver ID so we detect reassignment of already-visible unassigned orders
  const knownAssignmentsRef = useRef<Map<number, number | null>>(new Map());
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const secondsRef = useRef<NodeJS.Timeout | null>(null);
  const [secondsSinceSync, setSecondsSinceSync] = useState(0);

  const currency = settings.currency || "Ksh";

  // Auth guard
  useEffect(() => {
    if (!authLoading) {
      if (!user) { window.location.href = "/login"; return; }
      if (user.role !== "delivery" && user.role !== "admin" && user.role !== "superadmin") {
        router.replace("/products");
      }
    }
  }, [user, authLoading, router]);

  // Request browser notification permission
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  }, []);

  // Network online/offline detection
  useEffect(() => {
    const online  = () => { setIsOnline(true);  toast.success("Connection restored", { icon: "📶" }); };
    const offline = () => { setIsOnline(false); toast.error("You are offline. Data may be stale.", { icon: "📵", duration: 6000 }); };
    window.addEventListener("online",  online);
    window.addEventListener("offline", offline);
    return () => { window.removeEventListener("online", online); window.removeEventListener("offline", offline); };
  }, []);

  // Fetch orders (silent poll)
  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setIsSyncing(true);
    try {
      const res = await api.get("/delivery/orders");
      const incoming: Order[] = (res.data as any[]);

      // Detect newly ASSIGNED orders — compare delivered_by_user_id changes
      // This catches both: brand new orders AND previously-unassigned orders that got assigned
      if (knownAssignmentsRef.current.size > 0 && user) {
        const newlyAssigned = incoming.filter(o => {
          const prevAssignee = knownAssignmentsRef.current.get(o.id);
          const nowAssignedToMe = (o as any).delivered_by_user_id === user.id;
          const wasNotAssignedToMe = prevAssignee !== user.id;
          // Fire if: order is NOW assigned to me but previously wasn't (or didn't exist)
          return nowAssignedToMe && wasNotAssignedToMe;
        });

        if (newlyAssigned.length > 0) {
          playNotificationSound();
          newlyAssigned.forEach(o => {
            toast(`🚚 Order assigned to you: ${o.tracking_number} — ${o.customer?.name ?? ""} in ${o.shipping_city}`, {
              duration: 10000,
              style: { background: "#0052cc", color: "#fff", fontWeight: "bold", borderRadius: "12px" },
            });
            if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
              new Notification("New Delivery Assigned!", {
                body: `Waybill ${o.tracking_number} — ${o.customer?.name ?? "Customer"} in ${o.shipping_city}`,
                icon: "/favicon.ico",
              });
            }
          });
          // Bump unread bell count for new assignments
          setNotifUnread(prev => prev + newlyAssigned.length);
        }
      }

      // Update the known assignments map with current state
      const newMap = new Map<number, number | null>();
      incoming.forEach(o => newMap.set(o.id, (o as any).delivered_by_user_id ?? null));
      knownAssignmentsRef.current = newMap;

      setOrders(incoming);
      setLastSynced(new Date());
      setSecondsSinceSync(0);
    } catch (err: any) {
      if (!silent) toast.error("Failed to sync delivery manifests");
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
  }, [user]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get("/delivery/stats");
      setStats(res.data);
    } catch (_) {}
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get("/delivery/notifications");
      const incoming: Notification[] = res.data.notifications ?? [];
      setNotifications(incoming);
      // NOTE: notifUnread is ONLY controlled by fetchOrders (when a new assignment
      // is detected). fetchNotifications just populates the drawer content.
      // Do NOT set notifUnread here — it would overwrite the badge every 30s.
    } catch (_) {}
  }, []);

  // Initial load
  useEffect(() => {
    if (user && (user.role === "delivery" || user.role === "admin" || user.role === "superadmin")) {
      fetchOrders(false);
      fetchStats();
      fetchNotifications();
    }
  }, [user, fetchOrders, fetchStats, fetchNotifications]);

  // 30-second polling
  useEffect(() => {
    if (!user) return;
    pollingIntervalRef.current = setInterval(() => {
      if (isOnline) {
        fetchOrders(true);
        fetchStats();
        fetchNotifications();
      }
    }, 30000);
    secondsRef.current = setInterval(() => {
      setSecondsSinceSync(s => s + 1);
    }, 1000);
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      if (secondsRef.current) clearInterval(secondsRef.current);
    };
  }, [user, isOnline, fetchOrders, fetchStats, fetchNotifications]);

  // Filtered & sorted active orders
  const activeDeliveries = useMemo(() => {
    let list = orders.filter(o => o.status === "Shipped" || o.status === "Arrived");
    if (statusFilter !== "all") list = list.filter(o => o.status === statusFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(o =>
        o.tracking_number.toLowerCase().includes(q) ||
        (o.customer?.name ?? "").toLowerCase().includes(q) ||
        o.shipping_city.toLowerCase().includes(q) ||
        (o.customer?.phone ?? "").includes(q)
      );
    }
    list = [...list].sort((a, b) => {
      const da = new Date(a.updated_at).getTime();
      const db = new Date(b.updated_at).getTime();
      return sortOrder === "newest" ? db - da : da - db;
    });
    return list;
  }, [orders, statusFilter, searchQuery, sortOrder]);

  const completedDeliveries = useMemo(() => {
    let list = orders.filter(o => o.status === "Delivered");
    if (searchQuery.trim() && activeTab === "completed") {
      const q = searchQuery.toLowerCase();
      list = list.filter(o =>
        o.tracking_number.toLowerCase().includes(q) ||
        (o.customer?.name ?? "").toLowerCase().includes(q) ||
        o.shipping_city.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }, [orders, searchQuery, activeTab]);

  // Actions
  const handleMarkArrived = async (order: Order) => {
    setMarkingArrived(order.id);
    try {
      await api.post(`/delivery/orders/${order.id}/mark-arrived`);
      toast.success(`Order ${order.tracking_number} marked as Arrived!`, {
        icon: "📍",
        style: { background: "#10b981", color: "#fff", fontWeight: "bold" },
      });
      await fetchOrders(true);
      await fetchStats();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to mark as Arrived");
    } finally {
      setMarkingArrived(null);
    }
  };

  // Signature canvas
  const initCanvas = () => {
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#1e293b";
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }, 100);
  };

  useEffect(() => {
    if (isSignatureModalOpen) initCanvas();
  }, [isSignatureModalOpen]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    draw(e);
  };
  const stopDrawing = () => {
    setIsDrawing(false);
    canvasRef.current?.getContext("2d")?.beginPath();
  };
  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;
    if ("touches" in e) {
      if (e.cancelable) e.preventDefault();
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSaveSignature = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedOrder) return;
    const blank = document.createElement("canvas");
    blank.width = canvas.width;
    blank.height = canvas.height;
    if (canvas.toDataURL() === blank.toDataURL()) {
      toast.error("Please capture signature");
      return;
    }
    setSubmittingSignature(true);
    try {
      await api.post(`/delivery/orders/${selectedOrder.id}/deliver`, { signature: canvas.toDataURL("image/png") });
      toast.success(`Order ${selectedOrder.tracking_number} delivered successfully!`, {
        icon: "📦",
        style: { background: "#10b981", color: "#fff", fontWeight: "bold" },
      });
      setIsSignatureModalOpen(false);
      setSelectedOrder(null);
      fetchOrders(true);
      fetchStats();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to submit signature");
    } finally {
      setSubmittingSignature(false);
    }
  };

  if (authLoading || !user || (user.role !== "delivery" && user.role !== "admin" && user.role !== "superadmin")) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0052cc]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-white/20 flex items-center justify-center text-white font-black text-2xl">D</div>
          <Loader2 className="h-7 w-7 animate-spin text-white" />
          <p className="text-white/80 text-xs font-bold uppercase tracking-widest">Initializing Hub...</p>
        </div>
      </div>
    );
  }

  const initials = user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-[#f0f4f8] flex flex-col font-sans text-slate-900">

      {/* ── TOP HEADER ──────────────────────────────────────────────────── */}
      <header className="bg-[#0052cc] sticky top-0 z-30 shadow-lg">
        <div className="container mx-auto px-4 max-w-xl h-16 flex items-center justify-between">
          {/* Left: Avatar + name */}
          <button onClick={() => setShowProfile(true)} className="flex items-center gap-3 group text-left">
            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center text-white font-black text-sm border border-white/30 group-hover:bg-white/30 transition-colors">
              {initials}
            </div>
            <div className="text-left">
              <p className="text-[10px] font-bold text-blue-200 uppercase tracking-widest leading-none">Delivery Hub</p>
              <p className="text-sm font-black text-white tracking-tight leading-tight truncate max-w-[150px]">
                {user.name}
                {(user as any).vehicle_plate ? <span className="text-blue-200 font-bold"> | {(user as any).vehicle_plate}</span> : ""}
              </p>
            </div>
          </button>

          {/* Right: Online dot + Notification bell + Logout */}
          <div className="flex items-center gap-2">
            {/* Sync status */}
            <div className="hidden sm:flex items-center gap-1.5 bg-white/10 rounded-lg px-2 py-1.5">
              {isSyncing ? (
                <RefreshCw className="h-3 w-3 text-blue-200 animate-spin" />
              ) : isOnline ? (
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              ) : (
                <WifiOff className="h-3 w-3 text-red-300" />
              )}
              <span className="text-[9px] font-bold text-blue-200 uppercase tracking-wide">
                {isSyncing ? "Syncing..." : lastSynced ? `${secondsSinceSync}s ago` : "---"}
              </span>
            </div>

            {/* Notification bell */}
            <button
              onClick={() => {
              setShowNotifications(true);
              setNotifUnread(0);
              // Mark all current notifications as seen
              localStorage.setItem("delivery_notif_last_seen", Date.now().toString());
            }}
              className="relative h-9 w-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-white"
            >
              <Bell className="h-4 w-4" />
              {notifUnread > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center border border-[#0052cc]">
                  {notifUnread > 9 ? "9+" : notifUnread}
                </span>
              )}
            </button>

            {/* Logout */}
            <button
              onClick={logout}
              className="h-9 w-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-red-500/40 transition-colors text-white"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── STATS BAR ───────────────────────────────────────────────────── */}
      <div className="bg-[#003d99] border-b border-[#0044aa]">
        <div className="container mx-auto px-4 max-w-xl py-3">
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: CheckCircle2, label: "Today's Deliveries", value: stats.today_completed, color: "text-emerald-300" },
              { icon: Package,      label: "Active Tasks",       value: stats.active_count,    color: "text-amber-300"   },
              { icon: TrendingUp,   label: "All-Time Delivered", value: stats.total_delivered, color: "text-blue-200"    },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col items-center gap-0.5">
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
                <p className={`text-lg font-black ${stat.color}`}>{stat.value}</p>
                <p className="text-[8px] font-bold text-blue-300 uppercase tracking-wider text-center leading-tight">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ────────────────────────────────────────────────── */}
      <main className="flex-1 container mx-auto px-4 max-w-xl pt-4 pb-16">

        {/* Tabs */}
        <div className="bg-white p-1 rounded-xl border border-zinc-200 shadow-sm flex mb-4">
          {(["active", "completed"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 ${
                activeTab === tab ? "bg-[#0052cc] text-white shadow-sm" : "text-zinc-500 hover:text-slate-800"
              }`}
            >
              {tab === "active" ? <Package className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {tab === "active" ? "Active Tasks" : "Completed"}
              {tab === "active" && activeDeliveries.length > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${activeTab === "active" ? "bg-white text-[#0052cc]" : "bg-blue-50 text-[#0052cc]"}`}>
                  {activeDeliveries.length}
                </span>
              )}
              {tab === "completed" && completedDeliveries.length > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${activeTab === "completed" ? "bg-white text-[#0052cc]" : "bg-zinc-100 text-zinc-600"}`}>
                  {completedDeliveries.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search + Filter Row */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input
              placeholder={activeTab === "active" ? "Search waybill, customer, city..." : "Search completed deliveries..."}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-10 bg-white border-zinc-200 text-sm font-medium rounded-xl shadow-sm"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {activeTab === "active" && (
            <button
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className={`h-10 w-10 flex items-center justify-center rounded-xl border shadow-sm transition-all ${showFilterPanel ? "bg-[#0052cc] text-white border-[#0052cc]" : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300"}`}
            >
              <Filter className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => { fetchOrders(false); fetchStats(); fetchNotifications(); }}
            disabled={isSyncing}
            className="h-10 w-10 flex items-center justify-center rounded-xl bg-white border border-zinc-200 text-zinc-600 hover:border-zinc-300 shadow-sm transition-all"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin text-[#0052cc]" : ""}`} />
          </button>
        </div>

        {/* Filter Panel */}
        <AnimatePresence>
          {showFilterPanel && activeTab === "active" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-white border border-zinc-200 rounded-xl p-4 mb-4 shadow-sm space-y-3 overflow-hidden"
            >
              <div>
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Filter by Status</p>
                <div className="flex gap-2">
                  {(["all", "Shipped", "Arrived"] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all ${
                        statusFilter === s ? "bg-[#0052cc] text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                      }`}
                    >
                      {s === "all" ? "All" : s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Sort by Date</p>
                <div className="flex gap-2">
                  {(["newest", "oldest"] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setSortOrder(s)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all ${
                        sortOrder === s ? "bg-[#0052cc] text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                      }`}
                    >
                      {s === "newest" ? <SortDesc className="h-3 w-3" /> : <SortAsc className="h-3 w-3" />}
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-3">
            <div className="h-14 w-14 rounded-full bg-[#0052cc]/10 flex items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-[#0052cc]" />
            </div>
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Syncing manifests...</p>
          </div>
        ) : (
          <div className="space-y-4">

            {/* ── ACTIVE TAB ────────────────────────────────────────────── */}
            {activeTab === "active" && (
              activeDeliveries.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-zinc-200 rounded-2xl p-12 text-center flex flex-col items-center gap-3">
                  <div className="h-14 w-14 rounded-full bg-emerald-50 flex items-center justify-center">
                    <CheckCircle2 className="h-7 w-7 text-emerald-500" />
                  </div>
                  <h3 className="font-black text-slate-800 tracking-tight">All Tasks Complete</h3>
                  <p className="text-xs text-zinc-400 max-w-[200px] leading-relaxed">
                    {searchQuery || statusFilter !== "all" ? "No orders match your current filters." : "No active dispatch files assigned to you at the moment."}
                  </p>
                  {(searchQuery || statusFilter !== "all") && (
                    <button onClick={() => { setSearchQuery(""); setStatusFilter("all"); }} className="text-xs font-bold text-[#0052cc] underline mt-1">
                      Clear filters
                    </button>
                  )}
                </div>
              ) : (
                activeDeliveries.map(order => {
                  const cfg = statusConfig[order.status] ?? statusConfig.Shipped;
                  return (
                    <motion.div
                      key={order.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Card className="border-zinc-200 bg-white shadow-sm hover:shadow-md transition-shadow rounded-2xl overflow-hidden">
                        {/* Card Header */}
                        <CardHeader className="p-4 bg-zinc-50/80 border-b border-zinc-100 flex flex-row items-start justify-between gap-2">
                          <div className="text-left">
                            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Waybill</span>
                            <CardTitle className="text-base font-black text-slate-800 tracking-wider leading-tight">{order.tracking_number}</CardTitle>
                            <p className="text-[10px] text-zinc-400 font-medium mt-0.5">
                              Assigned {new Date(order.updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                            </p>
                          </div>
                          <Badge className={`rounded-full px-2.5 py-1 text-[9px] font-black tracking-wider border-none uppercase shrink-0 flex items-center gap-1 ${cfg.bg} ${cfg.text}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot} inline-block`} />
                            {cfg.label}
                          </Badge>
                        </CardHeader>

                        <CardContent className="p-4 space-y-4">
                          {/* Customer Details */}
                          <div className="space-y-2.5 text-left">
                            <div className="flex items-start gap-3">
                              <div className="h-8 w-8 rounded-full bg-zinc-100 flex items-center justify-center shrink-0">
                                <User className="h-4 w-4 text-zinc-400" />
                              </div>
                              <div>
                                <p className="font-black text-slate-800 text-[13px]">{order.customer?.name ?? "Retail Customer"}</p>
                                {order.customer?.email && (
                                  <p className="text-[10px] text-zinc-400 font-medium">{order.customer.email}</p>
                                )}
                              </div>
                            </div>

                            {order.customer?.phone && (
                              <a
                                href={`tel:${order.customer.phone}`}
                                className="flex items-center gap-3 p-2.5 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors group"
                              >
                                <div className="h-7 w-7 rounded-full bg-[#0052cc] flex items-center justify-center shrink-0">
                                  <Phone className="h-3.5 w-3.5 text-white" />
                                </div>
                                <span className="font-black text-[#0052cc] text-sm group-hover:underline">{order.customer.phone}</span>
                                <ChevronRight className="h-4 w-4 text-[#0052cc] ml-auto" />
                              </a>
                            )}

                            <div className="flex items-start gap-3">
                              <div className="h-7 w-7 rounded-full bg-rose-50 flex items-center justify-center shrink-0 mt-0.5">
                                <MapPin className="h-3.5 w-3.5 text-rose-500" />
                              </div>
                              <div>
                                <p className="font-bold text-slate-700 text-xs leading-snug">{order.shipping_address}</p>
                                <p className="font-black text-slate-800 text-sm">{order.shipping_city}</p>
                                <span className="inline-block mt-1 text-[9px] font-bold bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded uppercase">{order.shipping_method}</span>
                              </div>
                            </div>
                          </div>

                          {/* Manifest */}
                          <div className="border-t border-zinc-100 pt-3 text-left">
                            <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Manifest Summary</p>
                            <div className="space-y-1.5 bg-zinc-50 rounded-xl p-3 border border-zinc-100">
                              {order.items?.map(item => (
                                <div key={item.id} className="flex justify-between items-center">
                                  <span className="font-bold text-slate-700 text-xs flex-1 pr-3 leading-snug">{item.product.name}</span>
                                  <span className="text-[10px] font-black text-zinc-500 shrink-0 bg-white border border-zinc-200 rounded px-2 py-0.5">QTY: {item.quantity}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Value row */}
                          <div className="flex items-center justify-between bg-zinc-50 rounded-xl px-3 py-2 border border-zinc-100">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Order Value</span>
                            <span className="font-black text-slate-800 text-sm">{currency} {Number(order.total_amount).toLocaleString()}</span>
                          </div>

                          {/* Action Buttons */}
                          <div className="space-y-2 pt-1">
                            {order.status === "Shipped" && (
                              <Button
                                onClick={() => handleMarkArrived(order)}
                                disabled={markingArrived === order.id}
                                className="w-full bg-[#0052cc] hover:bg-[#003d99] text-white font-black uppercase text-[11px] tracking-wider h-11 rounded-xl shadow-sm"
                              >
                                {markingArrived === order.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                  <Navigation className="h-4 w-4 mr-2" />
                                )}
                                Mark as Arrived at Destination
                              </Button>
                            )}
                            <Button
                              onClick={() => { setSelectedOrder(order); setIsSignatureModalOpen(true); }}
                              disabled={markingArrived === order.id}
                              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[11px] tracking-wider h-11 rounded-xl shadow-sm"
                            >
                              <Shield className="h-4 w-4 mr-2" />
                              Capture Digital Signature & Deliver
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })
              )
            )}

            {/* ── COMPLETED TAB ─────────────────────────────────────────── */}
            {activeTab === "completed" && (
              completedDeliveries.length === 0 ? (
                <div className="bg-white border border-zinc-200 rounded-2xl p-12 text-center flex flex-col items-center gap-3">
                  <div className="h-14 w-14 rounded-full bg-zinc-50 flex items-center justify-center">
                    <Package className="h-7 w-7 text-zinc-300" />
                  </div>
                  <h3 className="font-black text-slate-500 text-sm">No completed deliveries yet</h3>
                  <p className="text-xs text-zinc-400">Completed deliveries will appear here once you have finished your first handover.</p>
                </div>
              ) : (
                completedDeliveries.map(order => (
                  <motion.div key={order.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                    <Card className="border-zinc-200 bg-white shadow-sm rounded-2xl overflow-hidden text-left">
                      <CardHeader className="p-4 bg-emerald-50/60 border-b border-emerald-100 flex flex-row items-center justify-between">
                        <div>
                          <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Waybill</span>
                          <CardTitle className="text-sm font-black text-slate-700 tracking-wider">{order.tracking_number}</CardTitle>
                          <p className="text-[10px] text-zinc-400 mt-0.5">
                            Delivered {new Date(order.updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                        <Badge className="rounded-full px-2.5 py-1 text-[9px] font-black tracking-wider border-none uppercase bg-emerald-100 text-emerald-700 flex items-center gap-1">
                          <Check className="h-3 w-3" /> Delivered
                        </Badge>
                      </CardHeader>
                      <CardContent className="p-4 space-y-2.5 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-400 font-bold">Recipient</span>
                          <span className="font-black text-slate-800">{order.customer?.name ?? "—"}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-400 font-bold">Destination</span>
                          <span className="font-bold text-slate-700">{order.shipping_city}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-400 font-bold">Order Value</span>
                          <span className="font-black text-slate-800">{currency} {Number(order.total_amount).toLocaleString()}</span>
                        </div>
                        {order.delivery_signature_url && (
                          <div className="flex items-center justify-between pt-2 border-t border-emerald-100">
                            <span className="text-zinc-400 font-bold">Proof of Delivery</span>
                            <span className="text-[10px] font-black text-emerald-600 flex items-center gap-1">
                              <Check className="h-3.5 w-3.5" /> Signature Saved
                            </span>
                          </div>
                        )}
                        {order.items && order.items.length > 0 && (
                          <div className="pt-2 border-t border-zinc-100">
                            <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Items Delivered</p>
                            <div className="space-y-1">
                              {order.items.map(item => (
                                <div key={item.id} className="flex justify-between text-[11px]">
                                  <span className="text-slate-600 font-medium truncate flex-1 pr-3">{item.product.name}</span>
                                  <span className="text-zinc-400 font-bold shrink-0">× {item.quantity}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))
              )
            )}
          </div>
        )}
      </main>

      {/* ── PROFILE DRAWER ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {showProfile && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
              onClick={() => setShowProfile(false)}
            />
            <motion.div
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="fixed left-0 top-0 bottom-0 w-80 bg-white z-50 shadow-2xl flex flex-col text-left"
            >
              {/* Profile header */}
              <div className="bg-[#0052cc] p-6 pb-8">
                <div className="flex items-center justify-between mb-6">
                  <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest">Driver Profile</p>
                  <button onClick={() => setShowProfile(false)} className="h-7 w-7 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex flex-col items-center gap-3">
                  <div className="h-20 w-20 rounded-2xl bg-white/20 flex items-center justify-center text-white font-black text-2xl border-2 border-white/30">
                    {initials}
                  </div>
                  <div className="text-center">
                    <h2 className="text-xl font-black text-white">{user.name}</h2>
                    <p className="text-blue-200 text-xs font-medium">{user.email}</p>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1">
                    <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] font-black text-white uppercase tracking-wider">Active Driver</span>
                  </div>
                </div>
              </div>

              {/* Profile details */}
              <div className="flex-1 p-5 space-y-3 overflow-y-auto">
                {[
                  { label: "Email Address", value: user.email, icon: User },
                  { label: "Vehicle Plate", value: (user as any).vehicle_plate || "Not assigned", icon: Truck },
                  { label: "License Number", value: (user as any).license_number || "Not assigned", icon: Shield },
                  { label: "Account Role", value: "Delivery Driver", icon: BarChart3 },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-3 p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                    <div className="h-9 w-9 rounded-lg bg-white border border-zinc-200 flex items-center justify-center shrink-0">
                      <item.icon className="h-4 w-4 text-zinc-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{item.label}</p>
                      <p className="text-sm font-bold text-slate-800 truncate">{item.value}</p>
                    </div>
                  </div>
                ))}

                {/* Stats in profile */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  {[
                    { label: "Total Delivered", value: stats.total_delivered, color: "text-emerald-600" },
                    { label: "Today", value: stats.today_completed, color: "text-[#0052cc]" },
                  ].map(s => (
                    <div key={s.label} className="bg-zinc-50 border border-zinc-100 rounded-xl p-3 text-center">
                      <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                      <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wide mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sign out */}
              <div className="p-5 border-t border-zinc-100">
                <button
                  onClick={() => { setShowProfile(false); logout(); }}
                  className="w-full flex items-center justify-center gap-2 h-12 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 font-black text-sm transition-all border border-red-100"
                >
                  <LogOut className="h-4 w-4" /> Sign Out
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── NOTIFICATIONS DRAWER ────────────────────────────────────────── */}
      <AnimatePresence>
        {showNotifications && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
              onClick={() => setShowNotifications(false)}
            />
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="fixed right-0 top-0 bottom-0 w-80 bg-white z-50 shadow-2xl flex flex-col text-left"
            >
              <div className="bg-[#0052cc] p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest">Notifications</p>
                    <h2 className="text-lg font-black text-white">Recent Assignments</h2>
                  </div>
                  <button onClick={() => setShowNotifications(false)} className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                    <Bell className="h-10 w-10 text-zinc-200" />
                    <p className="text-sm font-bold text-zinc-400">No recent assignments</p>
                    <p className="text-xs text-zinc-300">Orders assigned to you in the last 24 hours will appear here.</p>
                  </div>
                ) : (
                  notifications.map(notif => {
                    const cfg = statusConfig[notif.status] ?? statusConfig.Shipped;
                    return (
                      <div key={notif.id} className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-100 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-black text-slate-800">{notif.tracking_number}</p>
                            <p className="text-[10px] text-zinc-400 font-medium">{notif.assigned_ago}</p>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-[8px] font-black tracking-wider uppercase shrink-0 ${cfg.bg} ${cfg.text}`}>
                            {notif.status}
                          </span>
                        </div>
                        <div className="space-y-1 text-[11px]">
                          <div className="flex items-center gap-1.5 text-zinc-600">
                            <User className="h-3 w-3 text-zinc-400" />
                            <span className="font-bold">{notif.customer_name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-zinc-600">
                            <MapPin className="h-3 w-3 text-zinc-400" />
                            <span className="font-medium">{notif.shipping_city}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-zinc-600">
                            <Package className="h-3 w-3 text-zinc-400" />
                            <span className="font-medium">{notif.item_count} item{notif.item_count !== 1 ? "s" : ""}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="p-4 border-t border-zinc-100">
                <p className="text-[9px] text-center text-zinc-400 font-bold uppercase tracking-widest">
                  Data refreshes every 30 seconds · Tap an order in Active Tasks to act
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── SIGNATURE MODAL ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {isSignatureModalOpen && selectedOrder && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border-none"
            >
              <div className="p-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
                <div className="text-left">
                  <h2 className="text-base font-black text-slate-800 uppercase tracking-tight">Proof of Delivery</h2>
                  <p className="text-[10px] font-bold text-zinc-500 mt-0.5">Order: {selectedOrder.tracking_number}</p>
                  <p className="text-[10px] font-medium text-zinc-400">Recipient: {selectedOrder.customer?.name ?? "Customer"}</p>
                </div>
                <button
                  onClick={() => setIsSignatureModalOpen(false)}
                  className="h-8 w-8 rounded-full bg-zinc-200 hover:bg-zinc-300 text-zinc-600 transition-colors flex items-center justify-center"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">
                    Customer Signature (Draw inside box) *
                  </label>
                  <div className="border-2 border-dashed border-zinc-300 rounded-xl overflow-hidden bg-white relative h-52">
                    <p className="absolute inset-0 flex items-center justify-center text-zinc-200 text-xs font-bold pointer-events-none select-none">
                      Sign here
                    </p>
                    <canvas
                      ref={canvasRef}
                      width={400}
                      height={200}
                      className="w-full h-full touch-none cursor-crosshair relative z-10 bg-transparent"
                      onMouseDown={startDrawing}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onMouseMove={draw}
                      onTouchStart={startDrawing}
                      onTouchEnd={stopDrawing}
                      onTouchMove={draw}
                    />
                  </div>
                  <p className="text-[9px] text-zinc-400 font-medium">
                    ⚠️ By signing, the recipient confirms receipt of all items in good condition.
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={clearCanvas}
                    variant="outline"
                    disabled={submittingSignature}
                    className="flex-1 font-bold rounded-xl h-11 border-zinc-200 text-xs text-zinc-600"
                  >
                    Clear Pad
                  </Button>
                  <Button
                    onClick={handleSaveSignature}
                    disabled={submittingSignature}
                    className="flex-1 bg-[#0052cc] hover:bg-[#003d99] text-white font-black uppercase text-[11px] tracking-wider h-11 shadow-sm rounded-xl"
                  >
                    {submittingSignature && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Confirm Handover
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
