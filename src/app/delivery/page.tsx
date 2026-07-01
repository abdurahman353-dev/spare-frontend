"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Package, MapPin, Phone, CheckCircle2, Loader2, LogOut,
  User, Check, X, ArrowLeft, Search, RefreshCw, Navigation,
  Smartphone, ShieldAlert
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
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState<"active" | "completed">("active");

  // Search
  const [searchQuery, setSearchQuery] = useState("");

  // Signature pad
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [submittingSignature, setSubmittingSignature] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Arriving action
  const [markingArrived, setMarkingArrived] = useState<number | null>(null);

  // Polling reference
  const knownOrderIdsRef = useRef<Set<number>>(new Set());
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const currency = settings.currency || "Ksh";

  // Auth Guard
  useEffect(() => {
    if (!authLoading) {
      if (!user) { window.location.href = "/login"; return; }
      if (user.role !== "delivery" && user.role !== "admin" && user.role !== "superadmin") {
        router.replace("/products");
      }
    }
  }, [user, authLoading, router]);

  // Request browser notification permissions
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  }, []);

  // Sync / Fetch Orders
  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setIsSyncing(true);
    try {
      const res = await api.get("/delivery/orders");
      const incoming: Order[] = res.data;

      // Auto assignment notification logic
      const incomingIds = new Set(incoming.map(o => o.id));
      if (knownOrderIdsRef.current.size > 0) {
        const newIds = [...incomingIds].filter(id => !knownOrderIdsRef.current.has(id));
        if (newIds.length > 0) {
          const newOrders = incoming.filter(o => newIds.includes(o.id));
          playNotificationSound();
          newOrders.forEach(o => {
            toast(`🚚 Order Assigned: ${o.tracking_number} (${o.shipping_city})`, {
              duration: 8000,
              style: { background: "#0052cc", color: "#fff", fontWeight: "bold", borderRadius: "8px" },
            });
            if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
              new Notification("New Order Assigned", {
                body: `Waybill ${o.tracking_number} assigned to you for ${o.customer?.name ?? "Customer"}`,
              });
            }
          });
        }
      }
      knownOrderIdsRef.current = incomingIds;
      setOrders(incoming);
    } catch (err: any) {
      console.error("Fetch delivery orders error:", err);
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
  }, []);

  // Initial and dynamic polling load
  useEffect(() => {
    if (user && (user.role === "delivery" || user.role === "admin" || user.role === "superadmin")) {
      fetchOrders(false);

      pollingIntervalRef.current = setInterval(() => {
        fetchOrders(true);
      }, 30000);
    }
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, [user, fetchOrders]);

  // Filtered active & completed orders
  const activeDeliveries = useMemo(() => {
    let list = orders.filter(o => o.status === "Shipped" || o.status === "Arrived");
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(o =>
        o.tracking_number.toLowerCase().includes(q) ||
        (o.customer?.name ?? "").toLowerCase().includes(q) ||
        o.shipping_city.toLowerCase().includes(q)
      );
    }
    return list;
  }, [orders, searchQuery]);

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
    return list;
  }, [orders, searchQuery, activeTab]);

  // Actions
  const handleMarkArrived = async (order: Order) => {
    setMarkingArrived(order.id);
    try {
      await api.post(`/delivery/orders/${order.id}/mark-arrived`);
      toast.success(`Waybill ${order.tracking_number} marked as Arrived!`, {
        style: { background: "#10b981", color: "#fff", fontWeight: "bold" }
      });
      fetchOrders(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to mark as Arrived");
    } finally {
      setMarkingArrived(null);
    }
  };

  // Signature canvas
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
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSaveSignature = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedOrder) return;
    const blank = document.createElement("canvas");
    blank.width = canvas.width;
    blank.height = canvas.height;
    if (canvas.toDataURL() === blank.toDataURL()) {
      toast.error("Please capture signature first");
      return;
    }
    setSubmittingSignature(true);
    try {
      await api.post(`/delivery/orders/${selectedOrder.id}/deliver`, { signature: canvas.toDataURL("image/png") });
      toast.success(`Waybill ${selectedOrder.tracking_number} Delivered!`, {
        icon: "📦",
        style: { background: "#10b981", color: "#fff", fontWeight: "bold" }
      });
      setIsSignatureModalOpen(false);
      setSelectedOrder(null);
      fetchOrders(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to submit signature");
    } finally {
      setSubmittingSignature(false);
    }
  };

  if (authLoading || !user || (user.role !== "delivery" && user.role !== "admin" && user.role !== "superadmin")) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-50">
        <Loader2 className="h-8 w-8 animate-spin text-[#0052cc]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f4f6] flex flex-col font-sans text-[#1e293b] pb-12">

      {/* ── HEADER (WHITE AS SHOWN IN IMAGE 2) ────────────────────────── */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-30 shadow-sm">
        <div className="container mx-auto px-4 max-w-xl h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Blue Icon 'D' */}
            <div className="h-12 w-12 bg-[#0052cc] rounded-xl flex items-center justify-center text-white font-black text-xl shadow-md shadow-blue-500/10 shrink-0">
              D
            </div>
            <div className="text-left">
              <h1 className="text-base font-black uppercase tracking-tight text-[#0f172a] leading-none">Delivery Hub</h1>
              <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-wider mt-1.5 leading-none">
                {user.name} {user.vehicle_plate ? `| ${user.vehicle_plate}` : ""}
              </p>
            </div>
          </div>

          <button
            onClick={logout}
            className="h-10 w-10 flex items-center justify-center rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors border border-red-100/50 shrink-0"
            title="Log Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* ── MAIN CONTENT (MAX-W-XL COMPACT DRIVER VIEW) ────────────────── */}
      <main className="flex-1 container mx-auto px-4 max-w-xl pt-6">

        {/* Navigation Tabs (Perfect replica of Image 2) */}
        <div className="bg-white p-1.5 rounded-2xl border border-zinc-200 shadow-xs flex mb-6">
          <button
            onClick={() => setActiveTab("active")}
            className={`flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === "active"
                ? "bg-[#0052cc] text-white shadow-sm"
                : "text-zinc-500 hover:text-slate-800"
            }`}
          >
            <Package className="h-4 w-4" />
            Active Tasks
            {activeDeliveries.length > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${activeTab === "active" ? "bg-white text-[#0052cc]" : "bg-blue-50 text-[#0052cc]"}`}>
                {activeDeliveries.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("completed")}
            className={`flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === "completed"
                ? "bg-[#0052cc] text-white shadow-sm"
                : "text-zinc-500 hover:text-slate-800"
            }`}
          >
            <CheckCircle2 className="h-4 w-4" />
            Completed
            {completedDeliveries.length > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${activeTab === "completed" ? "bg-white text-[#0052cc]" : "bg-zinc-100 text-zinc-600"}`}>
                {completedDeliveries.length}
              </span>
            )}
          </button>
        </div>

        {/* Search & Refresh Row */}
        <div className="flex gap-2 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input
              placeholder="Search waybill, customer, city..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10 pr-10 h-11 bg-white border-zinc-200 text-sm font-medium rounded-xl shadow-xs"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => fetchOrders(false)}
            disabled={isSyncing}
            className="h-11 w-11 flex items-center justify-center rounded-xl bg-white border border-zinc-200 text-zinc-500 hover:border-zinc-300 shadow-xs transition-all shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin text-[#0052cc]" : ""}`} />
          </button>
        </div>

        {/* Lists */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-[#0052cc]" />
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Syncing waybills...</p>
          </div>
        ) : (
          <div className="space-y-6">

            {/* ACTIVE LIST */}
            {activeTab === "active" && (
              activeDeliveries.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-zinc-200 rounded-2xl p-12 text-center flex flex-col items-center justify-center">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-3" />
                  <h3 className="font-bold text-slate-800">All Tasks Complete</h3>
                  <p className="text-xs text-zinc-500 mt-1">No active manifests assigned to you at this moment.</p>
                </div>
              ) : (
                activeDeliveries.map(order => (
                  <Card key={order.id} className="border-zinc-200/80 shadow-sm bg-white rounded-2xl overflow-hidden text-left">
                    {/* Header: Waybill + Status Badge */}
                    <div className="p-5 bg-zinc-50/50 border-b border-zinc-100 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">WAYBILL</span>
                        <h3 className="text-[15px] font-black text-slate-800 tracking-wider mt-0.5">{order.tracking_number}</h3>
                      </div>
                      <Badge className={`rounded-full px-3 py-1 text-[9px] font-black tracking-widest border-none uppercase ${
                        order.status === "Arrived" ? "bg-emerald-500 text-white" : "bg-blue-600 text-white"
                      }`}>
                        {order.status}
                      </Badge>
                    </div>

                    {/* Details Block */}
                    <CardContent className="p-5 space-y-5">
                      <div className="space-y-3 text-[13px] text-zinc-600">
                        {/* Name */}
                        <div className="flex items-center gap-3">
                          <User className="h-4.5 w-4.5 text-zinc-400 shrink-0" />
                          <span className="font-bold text-slate-800">{order.customer?.name || "Retail Customer"}</span>
                        </div>

                        {/* Phone */}
                        {order.customer?.phone && (
                          <div className="flex items-center gap-3">
                            <Phone className="h-4.5 w-4.5 text-[#0052cc] shrink-0" />
                            <a href={`tel:${order.customer.phone}`} className="font-bold text-[#0052cc] hover:underline">
                              {order.customer.phone}
                            </a>
                          </div>
                        )}

                        {/* Address */}
                        <div className="flex items-start gap-3">
                          <MapPin className="h-4.5 w-4.5 text-rose-500 shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <span className="font-semibold text-slate-700 leading-snug">
                              {order.shipping_address}, {order.shipping_city}
                            </span>
                            <div className="pt-0.5">
                              <span className="text-[9px] font-black bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded uppercase">
                                {order.shipping_method}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Manifest Line Items */}
                      <div className="border-t border-zinc-100 pt-4">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-2">Manifest Summary</span>
                        <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-100/50 space-y-1.5">
                          {order.items?.map(item => (
                            <div key={item.id} className="flex justify-between items-center text-xs">
                              <span className="font-bold text-slate-700 truncate pr-3">{item.product.name}</span>
                              <span className="text-zinc-500 font-bold shrink-0">QTY: {item.quantity}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Action Triggers */}
                      <div className="space-y-2 pt-1">
                        {order.status === "Shipped" && (
                          <Button
                            onClick={() => handleMarkArrived(order)}
                            disabled={markingArrived === order.id}
                            className="w-full bg-[#0052cc] hover:bg-[#003d99] text-white font-black uppercase text-[11px] tracking-wider h-12 rounded-xl shadow-xs"
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
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[11px] tracking-wider h-12 rounded-xl shadow-xs"
                        >
                          Capture Digital Signature
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )
            )}

            {/* COMPLETED LIST */}
            {activeTab === "completed" && (
              completedDeliveries.length === 0 ? (
                <div className="bg-white border border-zinc-200 rounded-2xl p-10 text-center text-zinc-500">
                  No completed deliveries recorded.
                </div>
              ) : (
                completedDeliveries.map(order => (
                  <Card key={order.id} className="border-zinc-200/80 shadow-sm bg-white rounded-2xl overflow-hidden opacity-95 text-left">
                    <div className="p-5 bg-zinc-50/50 border-b border-zinc-100 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">WAYBILL</span>
                        <h3 className="text-[14px] font-bold text-slate-600 tracking-wider mt-0.5">{order.tracking_number}</h3>
                      </div>
                      <Badge className="rounded-full px-3 py-1 text-[9px] font-black tracking-widest border-none uppercase bg-emerald-100 text-emerald-800">
                        DELIVERED
                      </Badge>
                    </div>

                    <CardContent className="p-5 space-y-3.5 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-400 font-bold">Recipient</span>
                        <span className="font-bold text-slate-800">{order.customer?.name}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-400 font-bold">Destination</span>
                        <span className="font-semibold text-slate-700">{order.shipping_city}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-400 font-bold">Total Settlement</span>
                        <span className="font-bold text-slate-800">{currency} {Number(order.total_amount).toLocaleString()}</span>
                      </div>
                      {order.delivery_signature_url && (
                        <div className="pt-3.5 border-t border-zinc-100 flex items-center justify-between">
                          <span className="text-zinc-400 font-bold">Digital Receipt</span>
                          <span className="text-[10px] font-black text-emerald-600 uppercase flex items-center gap-1">
                            <Check className="h-3.5 w-3.5" /> Signature Saved
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )
            )}

          </div>
        )}
      </main>

      {/* ── SIGNATURE MODAL (PROFESSIONAL SLIDE-UP) ────────────────────── */}
      <AnimatePresence>
        {isSignatureModalOpen && selectedOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-xs"
          >
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden text-left"
            >
              <div className="p-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
                <div>
                  <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Proof of Delivery</h3>
                  <p className="text-[10px] font-bold text-zinc-500 mt-0.5">Order: {selectedOrder.tracking_number}</p>
                </div>
                <button
                  onClick={() => setIsSignatureModalOpen(false)}
                  className="h-8 w-8 rounded-full bg-zinc-200 hover:bg-zinc-300 text-zinc-600 transition-colors flex items-center justify-center"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>
              
              <div className="p-5 space-y-4">
                <div className="space-y-1">
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
                      className="w-full h-full touch-none cursor-crosshair relative z-10"
                      onMouseDown={startDrawing}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onMouseMove={draw}
                      onTouchStart={startDrawing}
                      onTouchEnd={stopDrawing}
                      onTouchMove={draw}
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
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
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[11px] tracking-wider h-11 shadow-sm rounded-xl"
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
