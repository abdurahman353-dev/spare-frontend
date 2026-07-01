"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Package, MapPin, Phone, CheckCircle2, Loader2, LogOut, 
  User, Check, ShieldAlert, FileText, ChevronRight, X, ArrowLeft
} from "lucide-react";
import api from "@/lib/axios";
import { toast } from "react-hot-toast";
import { useSettings } from "@/components/providers/SettingsProvider";

interface OrderItem {
  id: number;
  product: {
    name: string;
    part_number?: string;
  };
  quantity: number;
  price: number;
}

interface Order {
  id: number;
  tracking_number: string;
  created_at: string;
  status: string;
  shipping_city: string;
  shipping_address: string;
  shipping_method: string;
  total_amount: number;
  customer?: {
    name: string;
    phone?: string;
  };
  items?: OrderItem[];
  delivery_signature_url?: string;
}

export default function DeliveryPortal() {
  const { user, loading: authLoading, logout } = useAuth();
  const { settings } = useSettings();
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"active" | "completed">("active");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  
  // Signature pad states
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [submittingSignature, setSubmittingSignature] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const currency = settings.currency || "Ksh";

  // Auth Guard
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        window.location.href = "/login";
      } else if (user.role !== "delivery" && user.role !== "admin" && user.role !== "superadmin") {
        router.replace("/products");
      }
    }
  }, [user, authLoading, router]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await api.get("/delivery/orders");
      setOrders(res.data);
    } catch (err) {
      console.error("Failed to fetch delivery orders:", err);
      toast.error("Failed to sync delivery orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && (user.role === "delivery" || user.role === "admin" || user.role === "superadmin")) {
      fetchOrders();
    }
  }, [user]);

  // Separate active (Shipped/Arrived) vs completed (Delivered)
  const activeDeliveries = useMemo(() => {
    return orders.filter(o => o.status === "Shipped" || o.status === "Arrived");
  }, [orders]);

  const completedDeliveries = useMemo(() => {
    return orders.filter(o => o.status === "Delivered");
  }, [orders]);

  // Signature canvas drawing event handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx?.beginPath(); // Reset paths
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ("touches" in e) {
      // Prevent mobile scrolling while drawing
      if (e.cancelable) e.preventDefault();
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const initCanvas = () => {
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#1e293b"; // Charcoal/dark slate color
      
      // Clear initially to avoid leftovers
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }, 100);
  };

  useEffect(() => {
    if (isSignatureModalOpen) {
      initCanvas();
    }
  }, [isSignatureModalOpen]);

  const handleOpenSignature = (order: Order) => {
    setSelectedOrder(order);
    setIsSignatureModalOpen(true);
  };

  const handleSaveSignature = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedOrder) return;

    // Check if blank
    const blank = document.createElement("canvas");
    blank.width = canvas.width;
    blank.height = canvas.height;
    if (canvas.toDataURL() === blank.toDataURL()) {
      toast.error("Please capture the customer's signature first");
      return;
    }

    const base64Data = canvas.toDataURL("image/png");
    setSubmittingSignature(true);

    try {
      await api.post(`/delivery/orders/${selectedOrder.id}/deliver`, {
        signature: base64Data
      });
      
      toast.success(`Order ${selectedOrder.tracking_number} successfully delivered!`, {
        icon: "📦",
        style: { background: "#10b981", color: "#fff", fontWeight: "bold" }
      });
      
      setIsSignatureModalOpen(false);
      setSelectedOrder(null);
      
      // Refresh list
      fetchOrders();
    } catch (err: any) {
      console.error(err);
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
    <div className="min-h-screen bg-zinc-50 flex flex-col font-sans text-slate-900 pb-12">
      {/* Top Header */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-30 shadow-sm">
        <div className="container mx-auto px-4 max-w-xl h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 bg-[#0052cc] rounded-lg flex items-center justify-center text-white font-black text-sm">
              D
            </div>
            <div>
              <h1 className="text-sm font-black uppercase tracking-wider text-slate-800">Delivery Hub</h1>
              <p className="text-[10px] text-zinc-500 font-bold uppercase">
                {user.name} {user.vehicle_plate ? `| ${user.vehicle_plate}` : ""}
              </p>
            </div>
          </div>
          <button 
            onClick={logout} 
            className="h-9 w-9 flex items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
            title="Log Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Panel */}
      <main className="flex-1 container mx-auto px-4 max-w-xl pt-6">
        
        {/* Navigation Tabs */}
        <div className="bg-white p-1 rounded-xl border border-zinc-200 shadow-sm flex mb-6">
          <button
            onClick={() => setActiveTab("active")}
            className={`flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 ${
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
            className={`flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 ${
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

        {/* Content Section */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-[#0052cc]" />
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Syncing manifests...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeTab === "active" && (
              activeDeliveries.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-zinc-200 rounded-2xl p-10 text-center flex flex-col items-center justify-center">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-3" />
                  <h3 className="font-bold text-slate-800">All Deliveries Completed</h3>
                  <p className="text-xs text-zinc-500 mt-1">No active dispatch files assigned to you at the moment.</p>
                </div>
              ) : (
                activeDeliveries.map(order => (
                  <Card key={order.id} className="border-zinc-200 shadow-sm hover:shadow-md transition-shadow rounded-xl overflow-hidden">
                    <CardHeader className="p-4 bg-zinc-50 border-b border-zinc-100 flex flex-row items-center justify-between">
                      <div className="text-left">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">WAYBILL</span>
                        <CardTitle className="text-sm font-black text-slate-800 mt-0.5 tracking-wider">{order.tracking_number}</CardTitle>
                      </div>
                      <Badge className={`rounded-full px-2 py-0.5 text-[9px] font-black tracking-wider border-none uppercase ${
                        order.status === "Arrived" ? "bg-indigo-600 text-white" : "bg-blue-600 text-white"
                      }`}>
                        {order.status}
                      </Badge>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                      {/* Customer Details */}
                      <div className="grid grid-cols-1 gap-2.5 text-xs">
                        <div className="flex items-start gap-2.5">
                          <User className="h-4 w-4 text-zinc-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-slate-800 text-[13px]">{order.customer?.name || "Retail Customer"}</span>
                          </div>
                        </div>
                        
                        {order.customer?.phone && (
                          <div className="flex items-start gap-2.5">
                            <Phone className="h-4 w-4 text-[#0052cc] shrink-0 mt-0.5" />
                            <a href={`tel:${order.customer.phone}`} className="font-bold text-[#0052cc] hover:underline">
                              {order.customer.phone}
                            </a>
                          </div>
                        )}

                        <div className="flex items-start gap-2.5">
                          <MapPin className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <p className="font-semibold text-slate-700 leading-tight">
                              {order.shipping_address}, {order.shipping_city}
                            </p>
                            <span className="text-[9px] font-bold bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded uppercase">{order.shipping_method}</span>
                          </div>
                        </div>
                      </div>

                      {/* Manifest Line Items */}
                      <div className="border-t border-[#f1f5f9] pt-3">
                        <h4 className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Manifest Summary</h4>
                        <div className="space-y-1 bg-zinc-50/50 p-2.5 rounded-lg border border-zinc-100">
                          {order.items?.map((item) => (
                            <div key={item.id} className="flex justify-between items-center text-xs">
                              <span className="font-bold text-slate-700 line-clamp-1 flex-1 pr-4">{item.product.name}</span>
                              <span className="text-zinc-500 font-bold shrink-0">QTY: {item.quantity}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Action trigger */}
                      <Button 
                        onClick={() => handleOpenSignature(order)}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[11px] tracking-wider h-11 shadow-sm rounded-lg"
                      >
                        Capture Digital Signature
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )
            )}

            {activeTab === "completed" && (
              completedDeliveries.length === 0 ? (
                <div className="bg-white border border-zinc-200 rounded-2xl p-10 text-center text-zinc-500">
                  No completed deliveries recorded.
                </div>
              ) : (
                completedDeliveries.map(order => (
                  <Card key={order.id} className="border-zinc-200 shadow-sm rounded-xl overflow-hidden opacity-90">
                    <CardHeader className="p-4 bg-zinc-50 border-b border-zinc-100 flex flex-row items-center justify-between">
                      <div className="text-left">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">WAYBILL</span>
                        <CardTitle className="text-sm font-bold text-slate-600 mt-0.5 tracking-wider">{order.tracking_number}</CardTitle>
                      </div>
                      <Badge className="rounded-full px-2 py-0.5 text-[9px] font-black tracking-wider border-none uppercase bg-emerald-100 text-emerald-800">
                        DELIVERED
                      </Badge>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3 text-xs">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Recipient:</span>
                        <span className="font-bold text-slate-800">{order.customer?.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Destination:</span>
                        <span className="font-semibold text-slate-700">{order.shipping_city}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Total Settlement:</span>
                        <span className="font-bold text-slate-800">{currency} {order.total_amount.toLocaleString()}</span>
                      </div>
                      {order.delivery_signature_url && (
                        <div className="pt-2 border-t border-[#f1f5f9] flex items-center justify-between">
                          <span className="text-zinc-500">Digital Receipt:</span>
                          <span className="text-[10px] font-bold text-emerald-600 uppercase flex items-center gap-1">
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

      {/* Signature Capture Modal */}
      {isSignatureModalOpen && selectedOrder && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <Card className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border-none animate-in fade-in zoom-in-95 duration-200">
            <CardHeader className="p-5 border-b border-zinc-100 flex flex-row justify-between items-center bg-zinc-50">
              <div className="text-left">
                <CardTitle className="text-base font-black text-slate-800 uppercase tracking-tight">Proof of Delivery</CardTitle>
                <CardDescription className="text-[10px] font-bold text-zinc-500 uppercase mt-0.5">Order: {selectedOrder.tracking_number}</CardDescription>
              </div>
              <button 
                onClick={() => setIsSignatureModalOpen(false)}
                className="h-8 w-8 rounded-full bg-zinc-200 hover:bg-zinc-300 text-zinc-600 transition-colors flex items-center justify-center"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">Customer Signature (Draw inside box) *</label>
                <div className="border-2 border-dashed border-zinc-300 rounded-xl overflow-hidden bg-zinc-50/50 relative h-52">
                  <canvas
                    ref={canvasRef}
                    width={400}
                    height={200}
                    className="w-full h-full touch-none cursor-crosshair bg-white"
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
                  className="flex-1 font-bold rounded-lg h-11 border-zinc-200 text-xs text-zinc-600"
                >
                  Clear Pad
                </Button>
                <Button 
                  onClick={handleSaveSignature} 
                  disabled={submittingSignature}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[11px] tracking-wider h-11 shadow-sm rounded-lg"
                >
                  {submittingSignature ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Confirm Handover
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
