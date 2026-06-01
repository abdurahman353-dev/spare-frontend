"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Package, Clock, Settings, ShoppingBag, MapPin, CreditCard, 
  ChevronRight, LogOut, Loader2, User, Lock, ShieldCheck,
  Eye, EyeOff, CheckCircle2, AlertCircle, Plus, Home, Smartphone,
  Search, Download, ArrowRightLeft, FileText, Truck, Star
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/lib/axios";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useSearchParams, useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "react-hot-toast";
import { useSettings } from "@/components/providers/SettingsProvider";
import { exportSingleOrderInvoicePDF, exportCustomerLedgerPDF } from "@/lib/pdf-export";

import { Suspense } from "react";

function AccountPortalInner() {
  const { user, logout } = useAuth();
  const { settings } = useSettings();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Dashboard");

  // Modals state
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [isDeleteAddressModalOpen, setIsDeleteAddressModalOpen] = useState(false);
  const [hiddenAddresses, setHiddenAddresses] = useState<string[]>([]);
  
  const [destinations, setDestinations] = useState<any[]>([]);
  const [availableCities, setAvailableCities] = useState<any[]>([]);
  const [addressFormData, setAddressFormData] = useState({
    country: user?.country || "",
    city: user?.city || "",
    address: user?.address || ""
  });

  useEffect(() => {
    if (user) {
      setAddressFormData({
        country: (user as any).country || "",
        city: (user as any).city || "",
        address: (user as any).address || ""
      });
    }
  }, [user]);

  useEffect(() => {
    api.get("/shipping-destinations/active")
      .then(res => setDestinations(res.data))
      .catch(err => console.error(err));
  }, []);

  const uniqueCountries = Array.from(new Set(destinations.map(d => d.country)));

  const handleCountryChange = (country: string) => {
    setAddressFormData({ ...addressFormData, country, city: "" });
    setAvailableCities(destinations.filter(d => d.country === country));
  };

  const handleSaveAddress = async () => {
    try {
      await api.put('/user/profile', addressFormData);
      toast.success("Delivery address updated successfully!");
      setIsAddressModalOpen(false);
      // Optional: Store in localStorage for immediate checkout prefill
      localStorage.setItem("spare_prefill_shipping", JSON.stringify({
        city: addressFormData.city,
        address: addressFormData.address
      }));
      // We could also refresh the user context here if needed
      window.location.reload(); // Simple way to refresh user data from AuthContext check
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update address");
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem("spare_hidden_addresses");
    if (saved) setHiddenAddresses(JSON.parse(saved));
  }, []);

  // Password Change State
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    current_password: "",
    password: "",
    password_confirmation: ""
  });
  const [passwordStatus, setPasswordStatus] = useState({ loading: false, success: false, error: "" });

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "orders") setActiveTab("My Orders");
    else if (tab === "settings") setActiveTab("Account Settings");
    else if (tab === "address") setActiveTab("Delivery Addresses");
    else if (tab === "payment") setActiveTab("Payment Methods");
    else setActiveTab("Dashboard");
  }, [searchParams]);

  useEffect(() => {
    api.get("/my-orders")
      .then(res => {
        setOrders(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.password !== passwordData.password_confirmation) {
      setPasswordStatus({ loading: false, success: false, error: "New passwords do not match." });
      return;
    }

    setPasswordStatus({ loading: true, success: false, error: "" });

    try {
      await api.post("/change-password", passwordData);
      setPasswordStatus({ loading: false, success: true, error: "" });
      
      setTimeout(async () => {
        await logout();
        router.push("/login");
      }, 2000);
    } catch (err: any) {
      setPasswordStatus({ 
        loading: false, 
        success: false, 
        error: err.response?.data?.message || "Verification failed. Please check your current password." 
      });
    }
  };

  const downloadStatement = () => {
    if (!orders || orders.length === 0) {
      toast.error("No orders to export");
      return;
    }
    exportCustomerLedgerPDF(orders, user, settings).catch(() => toast.error("Failed to generate PDF"));
  };

  const downloadInvoice = (order: any) => {
    exportSingleOrderInvoicePDF(order, settings, user).catch(() => toast.error("Failed to generate invoice PDF"));
  };

  const totalSpent = orders.reduce((sum: number, order: any) => sum + Number(order.total_amount), 0);
  const activeOrders = orders.filter((o: any) => o.status !== "Delivered").length;

  const tabs = [
    { name: "Dashboard", icon: Package },
    { name: "My Orders", icon: ShoppingBag },
    { name: "Delivery Addresses", icon: MapPin },
    { name: "Account Settings", icon: Settings },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-white font-sans text-slate-900">
      <Navbar />
      
      <main className="flex-1 py-10">
        <div className="container mx-auto px-6 max-w-7xl">
          
          {/* Header Section - Matching Image 1 Style */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-[#1e293b]">
                Welcome Back, {user?.name.split(' ')[0]}
              </h1>
              <p className="text-[#64748b] text-[15px] mt-1">Manage your orders and account preferences.</p>
            </div>
             <div className="flex items-center gap-3">
               {loading ? (
                 <div className="animate-pulse bg-slate-200 h-8 w-32 rounded-md" />
               ) : (
                 (() => {
                   const ltv = totalSpent;
                   const platThresh = parseFloat(settings.rank_platinum_threshold || "150000");
                   const goldThresh  = parseFloat(settings.rank_gold_threshold    || "50000");
                   const silverThresh = parseFloat(settings.rank_silver_threshold || "10000");
                   let label = "Bronze Member",   bgClass = "bg-amber-700";
                   if (ltv >= platThresh) { label = "Platinum Customer"; bgClass = "bg-[#0052cc]"; }
                   else if (ltv >= goldThresh)  { label = "Gold Member";     bgClass = "bg-yellow-500"; }
                   else if (ltv >= silverThresh) { label = "Silver Member";   bgClass = "bg-slate-400"; }
                   return (
                     <div className={cn("text-white px-4 py-2 rounded-md font-semibold text-xs uppercase tracking-wider flex items-center gap-2 shadow-sm", bgClass)}>
                       <Star className="h-3 w-3 fill-white" /> {label}
                     </div>
                   );
                 })()
               )}
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Sidebar - Clean Style */}
            <div className="lg:col-span-3 space-y-1">
              <p className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-widest mb-4 ml-2">Account Portal</p>
              {tabs.map((item) => (
                <button 
                  key={item.name}
                  onClick={() => setActiveTab(item.name)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-200 group text-[14px] font-medium",
                    activeTab === item.name 
                    ? "bg-[#f1f5f9] text-[#0052cc]" 
                    : "text-[#64748b] hover:bg-[#f8fafc] hover:text-[#1e293b]"
                  )}
                >
                  <item.icon className={cn("h-4 w-4", activeTab === item.name ? "text-[#0052cc]" : "text-[#94a3b8]")} />
                  <span>{item.name}</span>
                </button>
              ))}
              
              <div className="pt-6 mt-6 border-t border-[#f1f5f9] space-y-2">
                 <Link 
                  href="/products"
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-md text-[#0052cc] hover:bg-[#eff6ff] text-[14px] font-medium transition-all border border-[#0052cc]/20"
                >
                  <ShoppingBag className="h-4 w-4" />
                  Continue Shopping
                </Link>
                 <button 
                  onClick={logout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-md text-[#ef4444] hover:bg-red-50 text-[14px] font-medium transition-all"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="lg:col-span-9">
              <AnimatePresence mode="wait">
                {activeTab === "Dashboard" && (
                  <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="space-y-8"
                  >
                    {/* Stats Grid */}
                    {loading ? (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="bg-white p-6 rounded-lg border border-[#e2e8f0] shadow-sm space-y-3 animate-pulse">
                            <div className="h-3.5 bg-slate-200 rounded w-24"></div>
                            <div className="h-7 bg-slate-200 rounded w-32"></div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                          { label: "Active Orders", value: activeOrders.toString(), color: "text-blue-600" },
                          { label: "Total Spent", value: `Ksh ${totalSpent.toLocaleString()}`, color: "text-slate-900" },
                          { label: "Parts Purchased", value: orders.length.toString(), color: "text-slate-900" },
                        ].map((stat, idx) => (
                          <div key={idx} className="bg-white p-6 rounded-lg border border-[#e2e8f0] shadow-sm">
                            <p className="text-[12px] font-semibold text-[#64748b] uppercase tracking-wider mb-2">{stat.label}</p>
                            <p className={cn("text-2xl font-bold", stat.color)}>{stat.value}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Logistics Lifecycle Stepper Guide */}
                    <div className="bg-white rounded-lg border border-[#e2e8f0] shadow-sm overflow-hidden">
                      <div className="px-6 py-4 border-b border-[#e2e8f0] bg-[#f8fafc]">
                        <h2 className="text-[14px] font-bold text-[#1e293b] flex items-center gap-2">
                          <Truck className="h-4 w-4 text-[#0052cc]" />
                          Your Logistics Journey — Step-by-Step Guide
                        </h2>
                        <p className="text-[11px] text-[#64748b] mt-0.5">Follow these steps to understand how your order moves from our warehouse to your door.</p>
                      </div>
                      <div className="p-6">
                        <div className="relative">
                          {/* Connector line */}
                          <div className="hidden md:block absolute top-8 left-8 right-8 h-0.5 bg-gradient-to-r from-[#0052cc] via-[#0052cc]/40 to-[#f1f5f9] z-0" />
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative z-10">
                            {[
                              {
                                step: 1,
                                icon: ShoppingBag,
                                status: "Pending",
                                title: "Order Placed",
                                color: "bg-amber-500",
                                borderColor: "border-amber-200",
                                bgCard: "bg-amber-50",
                                desc: "Your order has been received and is being prepared. Our team is verifying your parts and allocating stock from the nearest warehouse.",
                                tips: ["Check your email for order confirmation", "You can track status in 'My Orders' tab"]
                              },
                              {
                                step: 2,
                                icon: Package,
                                status: "Processing",
                                title: "Hub Processing",
                                color: "bg-orange-500",
                                borderColor: "border-orange-200",
                                bgCard: "bg-orange-50",
                                desc: "Your parts are being picked, quality-checked, and packaged at our logistics hub. They are getting containerized for dispatch.",
                                tips: ["Items are being containerized", "Inspect section shows your Logistics Intelligence route"]
                              },
                              {
                                step: 3,
                                icon: Truck,
                                status: "Shipped",
                                title: "Dispatched & In Transit",
                                color: "bg-[#0052cc]",
                                borderColor: "border-blue-200",
                                bgCard: "bg-blue-50",
                                desc: "Your container has been dispatched! Click 'Inspect' on any order to view the Live Container Tracking section with waybill, carrier, and ETA.",
                                tips: ["View Waybill & Carrier in Inspect modal", "Logistics Intelligence shows your route"]
                              },
                              {
                                step: 4,
                                icon: CheckCircle2,
                                status: "Delivered",
                                title: "Delivery Confirmed",
                                color: "bg-emerald-500",
                                borderColor: "border-emerald-200",
                                bgCard: "bg-emerald-50",
                                desc: "Your parts have been delivered to your address. Download the invoice from the order 'Inspect' modal for records. Your spending contributes to your loyalty rank.",
                                tips: ["Download invoice for your records", "Spending builds your B2B loyalty rank"]
                              },
                            ].map((item, idx) => (
                              <div key={idx} className={cn("rounded-lg border p-4 relative", item.borderColor, item.bgCard)}>
                                <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm mb-3 shadow-sm", item.color)}>
                                  <item.icon className="h-4 w-4" />
                                </div>
                                <div className={cn("inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider mb-2", item.color, "text-white")}>
                                  {item.status}
                                </div>
                                <h3 className="text-[13px] font-bold text-[#1e293b] mb-1.5">{item.title}</h3>
                                <p className="text-[11px] text-[#64748b] leading-relaxed mb-3">{item.desc}</p>
                                <ul className="space-y-1">
                                  {item.tips.map((tip, ti) => (
                                    <li key={ti} className="flex items-start gap-1.5 text-[10px] text-[#64748b] font-medium">
                                      <ChevronRight className="h-3 w-3 shrink-0 mt-0.5 text-[#0052cc]" />
                                      {tip}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-[#f1f5f9] flex items-start gap-2 text-[11px] text-[#64748b] font-medium">
                          <ArrowRightLeft className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#0052cc]" />
                          <span><strong className="text-[#0052cc]">Pro Tip:</strong> Click the <strong>"Inspect"</strong> button on any order row to see full Logistics Intelligence routing, Live Container Tracking, and download a professional PDF invoice.</span>
                        </div>
                      </div>
                    </div>

                    {/* Content Table Area */}
                    <div className="bg-white rounded-lg border border-[#e2e8f0] shadow-sm overflow-hidden">
                      <div className="px-6 py-5 border-b border-[#e2e8f0] flex items-center justify-between">
                        <h2 className="text-[16px] font-bold text-[#1e293b]">Recent Logistics History</h2>
                        <button onClick={() => setActiveTab("My Orders")} className="text-[12px] font-bold text-[#0052cc] hover:underline uppercase tracking-wider">Explore All</button>
                      </div>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead className="bg-[#f8fafc] text-[11px] uppercase tracking-wider font-bold text-[#64748b] border-b border-[#e2e8f0]">
                            <tr>
                              <th className="px-6 py-4">Order Ref</th>
                              <th className="px-6 py-4">Date</th>
                              <th className="px-6 py-4">Main Products</th>
                              <th className="px-6 py-4 text-center">Items</th>
                              <th className="px-6 py-4">Products Costs</th>
                              <th className="px-6 py-4">Shipment Fee</th>
                              <th className="px-6 py-4 text-right pr-10">Total Amount</th>
                              <th className="px-6 py-4 text-center">Status</th>
                              <th className="px-6 py-4 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#f1f5f9]">
                            {loading ? (
                              <tr><td colSpan={9} className="p-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#64748b]" /></td></tr>
                            ) : orders.length === 0 ? (
                              <tr><td colSpan={9} className="p-10 text-center text-[#64748b]">No order history found.</td></tr>
                            ) : (
                              orders.slice(0, 5).map((order: any) => (
                                <tr key={order.id} className="hover:bg-[#f8fafc] transition-colors">
                                  <td className="px-6 py-4">
                                    <p className="text-[14px] font-bold text-[#1e293b]">{order.tracking_number || `#ORD-${order.id}`}</p>
                                  </td>
                                  <td className="px-6 py-4 text-[13px] text-[#64748b]">
                                    {new Date(order.created_at).toLocaleDateString()}
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="space-y-0.5 max-w-[200px]">
                                      <p className="text-[13px] font-bold text-[#1e293b] truncate">
                                        {order.items?.[0]?.product?.name || "Genuine Spare Part"}
                                      </p>
                                      {order.items && order.items.length > 1 && (
                                        <p className="text-[10px] text-[#94a3b8] font-bold uppercase">+{order.items.length - 1} more items</p>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-1.5">
                                      <Package className="h-3 w-3 text-[#94a3b8]" />
                                      <span className="text-xs font-bold text-[#1e293b]">{order.items?.length || 0}</span>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 text-[13px] font-semibold text-[#64748b]">
                                    Ksh {Math.max(0, (Number(order.total_amount) - Number(order.shipping_fee || 0))).toLocaleString()}
                                  </td>
                                  <td className="px-6 py-4 text-[13px] font-semibold text-[#64748b]">
                                    Ksh {Number(order.shipping_fee || 0).toLocaleString()}
                                  </td>
                                  <td className="px-6 py-4 text-[14px] font-black text-[#1e293b] text-right pr-10">Ksh {Number(order.total_amount).toLocaleString()}</td>
                                  <td className="px-6 py-4 text-center">
                                    <span className={cn(
                                      "text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider",
                                      order.status === "Pending" ? "bg-[#fffbeb] text-[#92400e]" : 
                                      (order.status === "Processing" || order.status === "Shipped" || order.status === "In Transit") ? "bg-[#eff6ff] text-[#1e40af]" : 
                                      "bg-[#f0fdf4] text-[#166534]"
                                    )}>
                                      {order.status === "In Transit" ? "Shipped" : order.status}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    <button 
                                      onClick={() => { setSelectedOrder(order); setIsOrderModalOpen(true); }}
                                      className="text-[#0052cc] hover:text-[#0747a6] font-bold text-[13px] hover:underline"
                                    >
                                      Inspect
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === "Account Settings" && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                    <Card className="border-[#e2e8f0] shadow-sm rounded-lg overflow-hidden">
                      <CardHeader className="px-6 py-5 border-b border-[#e2e8f0]">
                        <CardTitle className="text-lg font-bold text-[#1e293b]">Profile Information</CardTitle>
                      </CardHeader>
                      <CardContent className="p-6 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-1.5">
                            <label className="text-[12px] font-bold text-[#64748b] uppercase tracking-wider">Full Name</label>
                            <Input value={user?.name || ""} readOnly className="bg-[#f8fafc] border-[#e2e8f0] text-[#1e293b]" />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[12px] font-bold text-[#64748b] uppercase tracking-wider">Email Address</label>
                            <Input value={user?.email || ""} readOnly className="bg-[#f8fafc] border-[#e2e8f0] text-[#1e293b]" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-[#e2e8f0] shadow-sm rounded-lg overflow-hidden">
                      <CardHeader className="px-6 py-5 border-b border-[#e2e8f0]">
                        <CardTitle className="text-lg font-bold text-[#1e293b]">Security Settings</CardTitle>
                      </CardHeader>
                      <CardContent className="p-6">
                        <form onSubmit={handlePasswordChange} className="space-y-6">
                          {passwordStatus.error && (
                            <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-md flex items-center gap-2">
                              <AlertCircle className="h-4 w-4" /> {passwordStatus.error}
                            </div>
                          )}
                          {passwordStatus.success && (
                            <div className="p-3 bg-green-50 text-green-600 text-xs font-bold rounded-md flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4" /> Password synchronized. Redirecting to login...
                            </div>
                          )}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-1.5">
                              <label className="text-[12px] font-bold text-[#64748b] uppercase tracking-wider">Current Password</label>
                              <div className="relative">
                                <Input type={showCurrentPassword ? "text" : "password"} required className="border-[#e2e8f0] pr-10" value={passwordData.current_password} onChange={(e) => setPasswordData({...passwordData, current_password: e.target.value})} />
                                <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)} className="absolute right-3 top-2.5 text-[#94a3b8] hover:text-[#64748b]">
                                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[12px] font-bold text-[#64748b] uppercase tracking-wider">New Password</label>
                              <div className="relative">
                                <Input type={showNewPassword ? "text" : "password"} required className="border-[#e2e8f0] pr-10" value={passwordData.password} onChange={(e) => setPasswordData({...passwordData, password: e.target.value})} />
                                <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-2.5 text-[#94a3b8] hover:text-[#64748b]">
                                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[12px] font-bold text-[#64748b] uppercase tracking-wider">Confirm New Password</label>
                              <div className="relative">
                                <Input type={showConfirmPassword ? "text" : "password"} required className="border-[#e2e8f0] pr-10" value={passwordData.password_confirmation} onChange={(e) => setPasswordData({...passwordData, password_confirmation: e.target.value})} />
                                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-2.5 text-[#94a3b8] hover:text-[#64748b]">
                                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                              </div>
                            </div>
                          </div>
                          <div className="flex justify-end">
                            <Button type="submit" disabled={passwordStatus.loading} className="bg-[#0052cc] hover:bg-[#0747a6] text-white px-6 font-bold text-[13px] rounded-md">
                              {passwordStatus.loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Update Password"}
                            </Button>
                          </div>
                        </form>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {activeTab === "My Orders" && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                    <div className="bg-white rounded-lg border border-[#e2e8f0] shadow-sm overflow-hidden">
                      <div className="px-6 py-5 border-b border-[#e2e8f0] flex items-center justify-between">
                        <h2 className="text-[16px] font-bold text-[#1e293b]">Full Order Ledger</h2>
                        <Button onClick={downloadStatement} size="sm" className="bg-[#0052cc] hover:bg-[#0747a6] text-[12px] font-bold text-white uppercase tracking-wider h-9 px-4">
                          <FileText className="h-4 w-4 mr-2" /> Download Statement PDF
                        </Button>
                      </div>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead className="bg-[#f8fafc] text-[11px] uppercase tracking-wider font-bold text-[#64748b] border-b border-[#e2e8f0]">
                            <tr>
                              <th className="px-6 py-4">Order Ref</th>
                              <th className="px-6 py-4">Date</th>
                              <th className="px-6 py-4">Main Products</th>
                              <th className="px-6 py-4 text-center">Items</th>
                              <th className="px-6 py-4">Products Costs</th>
                              <th className="px-6 py-4">Shipment Fee</th>
                              <th className="px-6 py-4 text-right pr-10">Total Amount</th>
                              <th className="px-6 py-4 text-center">Status</th>
                              <th className="px-6 py-4 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#f1f5f9]">
                            {loading ? (
                              <tr><td colSpan={9} className="p-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#64748b]" /></td></tr>
                            ) : orders.map((order: any) => (
                                <tr key={order.id} className="hover:bg-[#f8fafc] transition-colors">
                                  <td className="px-6 py-4">
                                    <p className="text-[14px] font-bold text-[#1e293b]">{order.tracking_number || `#ORD-${order.id}`}</p>
                                  </td>
                                  <td className="px-6 py-4 text-[13px] text-[#64748b]">
                                    {new Date(order.created_at).toLocaleDateString()}
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="space-y-0.5 max-w-[200px]">
                                      <p className="text-[13px] font-bold text-[#1e293b] truncate">
                                        {order.items?.[0]?.product?.name || "Genuine Spare Part"}
                                      </p>
                                      {order.items && order.items.length > 1 && (
                                        <p className="text-[10px] text-[#94a3b8] font-bold uppercase">+{order.items.length - 1} more items</p>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-1.5">
                                      <Package className="h-3 w-3 text-[#94a3b8]" />
                                      <span className="text-xs font-bold text-[#1e293b]">{order.items?.length || 0}</span>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 text-[13px] font-semibold text-[#64748b]">
                                    Ksh {Math.max(0, (Number(order.total_amount) - Number(order.shipping_fee || 0))).toLocaleString()}
                                  </td>
                                  <td className="px-6 py-4 text-[13px] font-semibold text-[#64748b]">
                                    Ksh {Number(order.shipping_fee || 0).toLocaleString()}
                                  </td>
                                  <td className="px-6 py-4 text-[14px] font-black text-[#1e293b] text-right pr-10">Ksh {Number(order.total_amount).toLocaleString()}</td>
                                  <td className="px-6 py-4 text-center">
                                    <span className={cn(
                                      "text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider",
                                      order.status === "Pending" ? "bg-[#fffbeb] text-[#92400e]" : 
                                      (order.status === "Processing" || order.status === "Shipped" || order.status === "In Transit") ? "bg-[#eff6ff] text-[#1e40af]" : 
                                      "bg-[#f0fdf4] text-[#166534]"
                                    )}>
                                      {order.status === "In Transit" ? "Shipped" : order.status}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      onClick={() => { setSelectedOrder(order); setIsOrderModalOpen(true); }}
                                      className="text-[#0052cc] hover:text-[#0747a6] font-bold text-[13px] hover:underline"
                                    >
                                      Inspect
                                    </Button>
                                  </td>
                                </tr>
                              ))
                            }
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === "Delivery Addresses" && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                    <Card className="border-[#e2e8f0] shadow-sm rounded-lg overflow-hidden">
                      <CardHeader className="px-6 py-5 border-b border-[#e2e8f0]">
                        <CardTitle className="text-lg font-bold text-[#1e293b]">Verified Shipping Destinations</CardTitle>
                      </CardHeader>
                      <CardContent className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {orders.length === 0 ? (
                            <div className="col-span-2 text-center py-10 text-[#64748b] bg-[#f8fafc] rounded-lg border border-dashed">
                              No shipping destinations recorded yet.
                            </div>
                          ) : (
                            // Extract unique locations from orders
                            Array.from(new Set(orders.map((o: any) => `${o.shipping_city}|${o.shipping_address}`)))
                              .filter(loc => !hiddenAddresses.includes(loc))
                              .slice(0, 4) // Show top 4 unique locations
                              .map((locString: string, idx: number) => {
                                const [city, address] = locString.split('|');
                                return (
                                  <div key={idx} className="border border-[#e2e8f0] rounded-lg p-5 bg-[#f8fafc] relative">
                                     {idx === 0 && <div className="absolute top-3 right-3 text-[#166534] bg-[#f0fdf4] text-[10px] font-bold px-2 py-0.5 rounded uppercase">Latest</div>}
                                     <h3 className="font-bold text-[#1e293b] mb-1">{city}</h3>
                                     <p className="text-[#64748b] text-[13px] mb-4">
                                        {address}<br/>
                                        {city}, Kenya
                                     </p>
                                     <div className="flex gap-2">
                                       <button 
                                         onClick={() => {
                                           localStorage.setItem("spare_prefill_shipping", JSON.stringify({ city, address }));
                                           toast.success(`Shipping to ${city} selected!`, {
                                             style: { background: '#0052cc', color: '#fff', fontWeight: 'bold' }
                                           });
                                         }}
                                         className="text-[12px] font-bold text-[#0052cc] hover:underline"
                                       >
                                         Select for Order
                                       </button>
                                       <button 
                                         onClick={() => {
                                           const updated = [...hiddenAddresses, locString];
                                           setHiddenAddresses(updated);
                                           localStorage.setItem("spare_hidden_addresses", JSON.stringify(updated));
                                           toast.error(`Destination removed`, {
                                             style: { background: '#ef4444', color: '#fff', fontWeight: 'bold' }
                                           });
                                         }}
                                         className="text-[12px] font-bold text-red-600 hover:underline"
                                       >
                                         Remove
                                       </button>
                                     </div>
                                  </div>
                                );
                              })
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}



              </AnimatePresence>

              {/* Support Banner - Blue as requested */}
              <div className="bg-[#0052cc] p-10 rounded-lg relative overflow-hidden mt-8 shadow-md">
                <div className="relative z-10">
                  <h3 className="text-2xl font-bold text-white mb-2 tracking-tight">Need assistance with your parts?</h3>
                  <p className="text-white/80 text-[15px] max-w-md mb-6 font-medium">Our expert team is available 24/7 to help you find the exact genuine part for your Mercedes-Benz.</p>
                  <Button className="bg-white text-[#0052cc] hover:bg-slate-50 font-bold px-6 py-2 rounded-md transition-all shadow-sm">
                    Contact Support
                  </Button>
                </div>
                <div className="absolute -right-10 -bottom-10 opacity-10 rotate-12">
                   <Package className="h-60 w-60 text-white" />
                </div>
              </div>

            </div>
          </div>
        </div>
      </main>

      <Footer />

      {/* Reusable Modals - Matching Clean Style */}
      <Dialog open={isOrderModalOpen} onOpenChange={setIsOrderModalOpen}>
        <DialogContent className="sm:max-w-[550px] p-0 rounded-lg overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 bg-white border-b border-[#e2e8f0]">
             <DialogTitle className="text-xl font-bold text-[#1e293b]">Order Ref: {selectedOrder?.tracking_number || selectedOrder?.id}</DialogTitle>
             <DialogDescription className="text-[#64748b] font-medium text-sm">
               Placed on {selectedOrder ? new Date(selectedOrder.created_at).toLocaleDateString() : ''}
             </DialogDescription>
          </DialogHeader>
          <div className="p-6 max-h-[60vh] overflow-y-auto space-y-6">
             <div className="bg-[#f8fafc] p-4 rounded-lg border border-[#e2e8f0]">
               <h4 className="text-[11px] font-bold text-[#64748b] uppercase tracking-widest mb-3">Logistics Intelligence</h4>
               <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-[#94a3b8] uppercase">Origin Node</p>
                    <p className="text-[13px] font-bold text-[#1e293b]">
                      {selectedOrder?.items?.[0]?.warehouse?.location?.includes(',') 
                        ? selectedOrder.items[0].warehouse.location.split(',').pop()?.trim() 
                        : selectedOrder?.items?.[0]?.warehouse?.name?.split(' ').shift() || 
                          selectedOrder?.items?.[0]?.warehouse?.code?.split('-').shift() || "Warehouse"}
                    </p>
                  </div>
                  <div className="flex-1 px-4 flex items-center">
                    <div className="h-px flex-1 bg-dashed border-t border-[#cbd5e1]"></div>
                    <ArrowRightLeft className="h-4 w-4 text-[#0052cc] mx-2" />
                    <div className="h-px flex-1 bg-dashed border-t border-[#cbd5e1]"></div>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-[10px] font-bold text-[#94a3b8] uppercase">Final Destination</p>
                    <p className="text-[13px] font-bold text-[#1e293b]">
                      {selectedOrder?.shipping_city 
                        ? `${selectedOrder.shipping_country || 'Tanzania'}, ${selectedOrder.shipping_city}, ${selectedOrder.shipping_address}` 
                        : (selectedOrder?.customer?.address || "Shipping Details")}
                    </p>
                  </div>
               </div>
               <div className="mt-3 flex items-center gap-2 text-[11px] font-medium text-[#64748b]">
                 <MapPin className="h-3 w-3" />
                 <span>Automated Logistics Tracking Active</span>
               </div>
             </div>

             {selectedOrder?.shipment && (
               <div className="bg-[#f8fafc] p-4 rounded-lg border border-[#e2e8f0]">
                 <h4 className="text-[11px] font-bold text-[#64748b] uppercase tracking-widest mb-3">Live Container Tracking</h4>
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                   <div className="space-y-1">
                     <p className="text-[10px] font-bold text-[#94a3b8] uppercase">Waybill / Container</p>
                     <p className="text-[13px] font-black text-[#0052cc] tracking-wider">{selectedOrder.shipment.waybill}</p>
                   </div>
                   <div className="space-y-1">
                     <p className="text-[10px] font-bold text-[#94a3b8] uppercase">Carrier</p>
                     <p className="text-[13px] font-bold text-[#1e293b]">{selectedOrder.shipment.carrier}</p>
                   </div>
                   <div className="space-y-1">
                     <p className="text-[10px] font-bold text-[#94a3b8] uppercase">Status</p>
                     <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase", 
                       selectedOrder.shipment.status === "Delivered" ? "bg-[#f0fdf4] text-[#166534]" : "bg-[#eff6ff] text-[#1e40af]"
                     )}>{selectedOrder.shipment.status}</span>
                   </div>
                   <div className="space-y-1">
                     <p className="text-[10px] font-bold text-[#94a3b8] uppercase">ETA</p>
                     <p className="text-[13px] font-bold text-[#1e293b]">{selectedOrder.shipment.eta || "Pending"}</p>
                   </div>
                 </div>
               </div>
             )}

             <div>
               <h4 className="text-[11px] font-bold text-[#64748b] uppercase tracking-widest mb-3">Manifest Summary</h4>
               {selectedOrder?.items?.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center pb-4 border-b border-[#f1f5f9] last:border-0 last:pb-0">
                    <div className="space-y-1">
                      <p className="font-semibold text-[#1e293b] text-[14px]">{item.product?.name || `Product ID: ${item.product_id}`}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold bg-[#f1f5f9] text-[#64748b] px-2 py-0.5 rounded uppercase">From: {item.warehouse?.name || "Processing Hub"}</span>
                        <span className="text-[11px] font-semibold text-slate-700">Quantity: {item.quantity} × Ksh {Number(item.price).toLocaleString()}</span>
                      </div>
                    </div>
                    <p className="font-bold text-[#1e293b] text-[14px]">Ksh {(Number(item.price) * item.quantity).toLocaleString()}</p>
                  </div>
               ))}
             </div>
              <div className="pt-6 border-t border-[#f1f5f9] space-y-2">
                <div className="flex justify-between items-center text-[#64748b] text-[12px] font-bold uppercase tracking-wider">
                  <span>Logistics Fee ({selectedOrder?.shipping_method || 'Standard'})</span>
                  <span>Ksh {selectedOrder ? Number(selectedOrder.shipping_fee || 0).toLocaleString() : 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-[#1e293b] text-[13px] uppercase tracking-wider">Total Settlement</span>
                  <span className="text-xl font-bold text-[#1e293b]">Ksh {selectedOrder ? Number(selectedOrder.total_amount).toLocaleString() : 0}</span>
                </div>
              </div>
          </div>
          <DialogFooter className="p-4 bg-[#f8fafc] border-t border-[#e2e8f0]">
            <Button variant="outline" className="text-[12px] font-bold border-[#e2e8f0] h-9" onClick={() => setIsOrderModalOpen(false)}>Close</Button>
            <Button className="bg-[#0052cc] hover:bg-[#0747a6] text-white text-[12px] font-bold h-9" onClick={() => selectedOrder && downloadInvoice(selectedOrder)}>
              <FileText className="h-4 w-4 mr-2" /> Download Invoice PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Address Modal */}
      <Dialog open={isAddressModalOpen} onOpenChange={setIsAddressModalOpen}>
        <DialogContent className="rounded-lg border-[#e2e8f0] shadow-xl sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="font-bold text-[#1e293b]">Update Delivery Address</DialogTitle>
            <DialogDescription className="text-xs text-[#64748b]">Select a verified shipping destination for your profile.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Country</label>
              <select 
                className="h-10 w-full rounded-md border border-[#e2e8f0] bg-white px-3 py-2 text-sm text-[#1e293b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0052cc]"
                value={addressFormData.country}
                onChange={(e) => handleCountryChange(e.target.value)}
              >
                <option value="" disabled>Select Country</option>
                {uniqueCountries.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Destination City</label>
              <select 
                disabled={!addressFormData.country}
                className="h-10 w-full rounded-md border border-[#e2e8f0] bg-white px-3 py-2 text-sm text-[#1e293b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0052cc] disabled:opacity-50"
                value={addressFormData.city}
                onChange={(e) => setAddressFormData({...addressFormData, city: e.target.value})}
              >
                <option value="" disabled>Select City</option>
                {availableCities.map(c => <option key={c.id} value={c.city}>{c.city}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Street Address</label>
              <Input 
                className="border-[#e2e8f0]" 
                value={addressFormData.address}
                onChange={(e) => setAddressFormData({...addressFormData, address: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button className="bg-[#0052cc] hover:bg-[#0747a6] w-full font-bold" onClick={handleSaveAddress}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>    </div>
  );
}

export default function AccountPortal() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><div className="h-8 w-8 border-4 border-[#0052cc] border-t-transparent rounded-full animate-spin" /></div>}>
      <AccountPortalInner />
    </Suspense>
  );
}
