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
  Search, Download, ArrowRightLeft, FileText, Truck, Star, Compass
} from "lucide-react";
import Link from "next/link";
import { Joyride, Step } from "react-joyride";
const JoyrideComponent = Joyride as any;
import { motion, AnimatePresence } from "framer-motion";
import api from "@/lib/axios";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useSearchParams, useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "react-hot-toast";
import { useSettings } from "@/components/providers/SettingsProvider";
import { exportSingleOrderInvoicePDF, exportCustomerLedgerPDF } from "@/lib/pdf-export";

import { Suspense } from "react";

function getOrderRefundedTotal(order: any): number {
  if (!order || !order.items) return 0;
  const totalUnits = Math.max(1, order.items.reduce((s: number, i: any) => s + (i.quantity || 1), 0));
  const shippingFee = Number(order.shipping_fee || 0);
  return order.items
    .filter((i: any) => i.cancellation_status === "Cancelled")
    .reduce((sum: number, i: any) => {
      const itemProductCost = Number(i.price) * i.quantity;
      const itemShippingShare = (shippingFee / totalUnits) * i.quantity;
      return sum + itemProductCost + itemShippingShare;
    }, 0);
}

function AccountPortalInner() {
  const { user, logout, refreshUser } = useAuth();
  const { settings } = useSettings();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Dashboard");

  // Onboarding Tour State
  const [mounted, setMounted] = useState(false);
  const [runTour, setRunTour] = useState(false);

  useEffect(() => {
    setMounted(true);
    const completed = localStorage.getItem("spare_tour_done");
    if (!completed) {
      localStorage.setItem("spare_tour_done", "true");
      const timer = setTimeout(() => {
        setRunTour(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const bizName     = settings.store_name      || "our store";
  const bizTagline  = settings.store_tagline   || "";
  const bizCurrency = settings.currency        || "Ksh";
  const bizEmail    = settings.contact_email   || "";
  const bizPhone    = settings.contact_phone   || "";
  const bizWA       = settings.contact_whatsapp|| "";
  const bizAddress  = settings.physical_address|| "";
  const bizHours    = settings.working_hours   || "";
  const bizWebsite  = settings.store_website   || "";
  const bizBranch   = settings.store_branch    || "";
  const bizCountry  = settings.store_country   || "";

  const tourSteps: Step[] = [
    {
      target: "body",
      placement: "center" as const,
      title: `👋 Welcome to ${bizName}!`,
      content: `${bizTagline ? `"${bizTagline}" — ` : ""}Let's take a quick guided tour of your customer portal. We'll show you how to track orders, print statements & invoices, manage delivery addresses, and more.${bizWebsite ? ` Visit us at ${bizWebsite}.` : ""}`,
      skipBeacon: true,
    },
    {
      target: "#tour-loyalty",
      placement: "bottom" as const,
      title: "⭐ Your B2B Loyalty Status",
      content: `Every purchase you make at ${bizName} increases your Lifetime Spent in ${bizCurrency}. Based on this, you're assigned a Loyalty Tier (Bronze, Silver, Gold, or Platinum). Higher tiers unlock special discounts and priority logistics handling.`,
    },
    {
      target: "#tour-nav",
      placement: "right" as const,
      title: "📂 Portal Navigation Sidebar",
      content: `Quickly navigate through sections of your ${bizName} account: Dashboard overview, full Order Ledger, saved Delivery Addresses, and Security Settings.`,
    },
    {
      target: "#tour-shop",
      placement: "right" as const,
      title: "🛒 Start/Continue Shopping",
      content: `Click this button to go straight to the ${bizName} parts catalog and browse our inventory of genuine Mercedes-Benz spare parts ready for delivery.${bizBranch ? ` Our primary warehouse is "${bizBranch}".` : ""}`,
    },
    {
      target: "#tour-stats",
      placement: "bottom" as const,
      title: "📊 Real-Time Account Metrics",
      content: `Track your active (undelivered) orders, lifetime spent (in ${bizCurrency}), and total count of parts purchased — all updated in real-time from ${bizName}'s system.`,
    },
    {
      target: "#tour-stepper",
      placement: "top" as const,
      title: "🚚 Logistics Lifecycle — How Your Order Moves",
      content: `Your order moves through 4 key stages: Pending → Hub Processing → Shipped → Delivered. Note that an order that is in pending or processing will only be cancelled and nothing else. ${bizName} sends you automated email notifications at each stage (Processing, Shipped, and Delivered) to keep you fully informed.${bizHours ? ` Our team operates: ${bizHours}.` : ""}`,
    },
    {
      target: "#tour-table",
      placement: "top" as const,
      title: "📦 Recent History & Live Waybills",
      content: `View status details of your recent orders placed with ${bizName}. Click the 'Inspect' button on any row to open Logistics Intelligence details, see live Container Waybills, check carrier names, and track ETAs.`,
    },
    {
      target: "#tour-statement-section",
      placement: "bottom" as const,
      title: "📄 Export Ledger Statements",
      content: `From the My Orders tab, click 'Download Statement PDF' to get a professional statement of all your purchases from ${bizName}${bizEmail ? ` (${bizEmail})` : ""}. Single invoices can also be downloaded from any order's Inspect modal.`,
    },
    {
      target: "#tour-addresses-section",
      placement: "top" as const,
      title: "📍 Verified Shipping Destinations",
      content: `Save your frequently used delivery addresses${bizCountry ? ` in ${bizCountry}` : ""}. Saved addresses can be selected during checkout to instantly prefill your delivery details and compute accurate ${bizName} logistics fees.${bizPhone ? ` Need help? Call us: ${bizPhone}.` : ""}${bizWA ? ` WhatsApp: ${bizWA}.` : ""}${bizAddress ? ` We are located at: ${bizAddress}.` : ""}`,
    },
  ];

  const handleJoyrideCallback = (data: any) => {
    const { action, index, status, type } = data;
    if (type === "step:after") {
      if (index === 6) {
        setActiveTab("My Orders");
      } else if (index === 7) {
        setActiveTab("Delivery Addresses");
      }
    } else if (type === "step:before") {
      if (index <= 6) {
        setActiveTab("Dashboard");
      } else if (index === 7) {
        setActiveTab("My Orders");
      } else if (index === 8) {
        setActiveTab("Delivery Addresses");
      }
    }
    if (["finished", "skipped"].includes(status)) {
      setRunTour(false);
      localStorage.setItem("spare_tour_done", "true");
    }
  };

  // Modals state
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [selectedItemIdsToCancel, setSelectedItemIdsToCancel] = useState<number[]>([]);
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

  // Refresh live user profile on mount so loyalty badge is real-time
  useEffect(() => { refreshUser(); }, []);

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

  const handleRequestCancel = async () => {
    if (selectedItemIdsToCancel.length === 0) {
      toast.error("Please select at least one product to cancel");
      return;
    }
    if (!cancelReason.trim()) {
      toast.error("Please provide a reason for cancellation");
      return;
    }
    setIsCancelling(true);
    try {
      const res = await api.post(`/orders/${selectedOrder.id}/request-cancel`, { 
        reason: cancelReason,
        cancel_item_ids: selectedItemIdsToCancel
      });
      toast.success(res.data.message || "Cancellation requested successfully");
      setIsCancelModalOpen(false);
      setCancelReason("");
      setSelectedItemIdsToCancel([]);
      setSelectedOrder(res.data.order);
      // Update the local orders list
      setOrders(orders.map((o: any) => o.id === res.data.order.id ? res.data.order : o));
      // Re-open the order detail modal so the customer can see the updated status
      setIsOrderModalOpen(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to request cancellation");
    } finally {
      setIsCancelling(false);
    }
  };

  const totalSpent = orders
    .filter((o: any) => o.status !== "Cancelled")
    .reduce((sum: number, order: any) => sum + Number(order.total_amount), 0);
  const activeOrders = orders.filter((o: any) => o.status !== "Delivered" && o.status !== "Cancelled").length;
  const partsPurchased = orders
    .filter((o: any) => o.status !== "Cancelled")
    .reduce((sum: number, order: any) => {
      const itemsCount = order.items?.reduce((itemSum: number, item: any) => {
        if (item.cancellation_status === "Cancelled") {
          return itemSum;
        }
        return itemSum + Number(item.quantity || 0);
      }, 0) || 0;
      return sum + itemsCount;
    }, 0);

  const tabs = [
    { name: "Dashboard", icon: Package },
    { name: "My Orders", icon: ShoppingBag },
    { name: "Delivery Addresses", icon: MapPin },
    { name: "Account Settings", icon: Settings },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-white font-sans text-slate-900">
      {mounted && (
        <JoyrideComponent
          callback={handleJoyrideCallback}
          continuous
          run={runTour}
          scrollToFirstStep
          showProgress
          showSkipButton
          steps={tourSteps as any}
          styles={{
            options: {
              arrowColor: '#ffffff',
              backgroundColor: '#ffffff',
              overlayColor: 'rgba(0, 0, 0, 0.45)',
              primaryColor: '#0052cc',
              textColor: '#1e293b',
              zIndex: 10000,
            },
            tooltip: {
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
              fontFamily: 'sans-serif'
            },
            tooltipTitle: {
              fontWeight: 800,
              fontSize: '16px',
              color: '#1e293b',
              marginBottom: '10px'
            },
            tooltipContent: {
              fontSize: '13px',
              lineHeight: 1.6,
              color: '#64748b'
            },
            buttonNext: {
              backgroundColor: '#0052cc',
              color: '#ffffff',
              fontWeight: 'bold',
              borderRadius: '6px',
              padding: '8px 16px',
              fontSize: '12px'
            },
            buttonBack: {
              marginRight: '12px',
              color: '#64748b',
              fontWeight: 'bold',
              fontSize: '12px'
            },
            buttonSkip: {
              color: '#ef4444',
              fontWeight: 'bold',
              fontSize: '12px'
            }
          } as any}
        />
      )}
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
               <Button 
                 onClick={() => { setRunTour(true); }}

                 className="bg-[#0052cc] hover:bg-[#004bb3] text-white font-bold text-xs h-9 px-4 rounded-md transition-all shadow-sm border-none flex items-center gap-2"
               >
                 <Compass className="h-4 w-4" /> Start Tour
               </Button>
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
                     <div id="tour-loyalty" className={cn("text-white px-4 py-2 rounded-md font-semibold text-xs uppercase tracking-wider flex items-center gap-2 shadow-sm", bgClass)}>
                       <Star className="h-3 w-3 fill-white" /> {label}
                     </div>
                   );
                 })()
               )}
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Sidebar - Clean Style */}
            <div id="tour-nav" className="lg:col-span-3 space-y-1">
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
                  id="tour-shop"
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
                    <div id="tour-stats">
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
                          { label: "Parts Purchased", value: partsPurchased.toString(), color: "text-slate-900" },
                        ].map((stat, idx) => (
                          <div key={idx} className="bg-white p-6 rounded-lg border border-[#e2e8f0] shadow-sm">
                            <p className="text-[12px] font-semibold text-[#64748b] uppercase tracking-wider mb-2">{stat.label}</p>
                            <p className={cn("text-2xl font-bold", stat.color)}>{stat.value}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    </div>

                    {/* Logistics Lifecycle Stepper Guide */}
                    <div id="tour-stepper" className="bg-white rounded-lg border border-[#e2e8f0] shadow-sm overflow-hidden">
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
                    <div id="tour-table" className="bg-white rounded-lg border border-[#e2e8f0] shadow-sm overflow-hidden">
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
                              <th className="px-6 py-4 text-[#0052cc]">Part No (OEM)</th>
                              <th className="px-6 py-4">Engine</th>
                              <th className="px-6 py-4">Suitable Vehicle</th>
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
                                    <div className="flex flex-col gap-0.5">
                                      {order.items?.map((item: any, i: number) => (
                                        <span key={i} className="text-xs font-bold text-[#0052cc] block truncate max-w-[120px]">
                                          {item.product?.part_number || "—"}
                                        </span>
                                      ))}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="flex flex-col gap-0.5">
                                      {order.items?.map((item: any, i: number) => (
                                        <span key={i} className="text-xs font-semibold text-zinc-600 block truncate max-w-[100px]">
                                          {item.product?.engine_model || "—"}
                                        </span>
                                      ))}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="flex flex-col gap-0.5">
                                      {order.items?.map((item: any, i: number) => (
                                        <span key={i} className="text-xs font-semibold text-zinc-600 block truncate max-w-[120px]" title={item.product?.suitable_vehicle}>
                                          {item.product?.suitable_vehicle || "—"}
                                        </span>
                                      ))}
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
                                  <td className="px-6 py-4 text-right pr-10">
                                    {(() => {
                                      const refundedTotal = getOrderRefundedTotal(order);
                                      const allCancelled = order.items?.every((i: any) => i.cancellation_status === "Cancelled");
                                      
                                      if (order.status === "Cancelled" || allCancelled) {
                                        return (
                                          <>
                                            <p className="text-[14px] font-black text-red-500 line-through opacity-75">
                                              Ksh {refundedTotal.toLocaleString()}
                                            </p>
                                            <p className="text-[10px] font-bold text-red-500 uppercase tracking-wide">Refunded</p>
                                          </>
                                        );
                                      }
                                      
                                      return (
                                        <>
                                          <p className="text-[14px] font-black text-[#1e293b]">
                                            Ksh {Number(order.total_amount || 0).toLocaleString()}
                                          </p>
                                          {refundedTotal > 0 && (
                                            <p className="text-[10px] font-bold text-red-500 uppercase tracking-wide">
                                              Ksh {refundedTotal.toLocaleString()} Refunded
                                            </p>
                                          )}
                                        </>
                                      );
                                    })()}
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                    <Badge className={cn(
                                      "rounded-full px-3 text-[10px] font-bold uppercase border-none tracking-wider",
                                      order.status === "Pending" ? "bg-yellow-400 text-yellow-950" : 
                                      order.status === "Processing" ? "bg-orange-500 text-white" :
                                      (order.status === "Shipped" || order.status === "In Transit") ? "bg-blue-600 text-white" : 
                                      order.status === "Delivered" ? "bg-emerald-500 text-white" : 
                                      (order.status === "Cancelled" || order.status === "Cancellation Requested") ? "bg-red-100 text-red-700 font-black" :
                                      "bg-zinc-200 text-zinc-700"
                                    )}>
                                      {order.status === "In Transit" ? "SHIPPED" : order.status}
                                    </Badge>
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
                    <div id="tour-statement-section" className="bg-white rounded-lg border border-[#e2e8f0] shadow-sm overflow-hidden">
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
                              <th className="px-6 py-4 text-[#0052cc]">Part No (OEM)</th>
                              <th className="px-6 py-4">Engine</th>
                              <th className="px-6 py-4">Suitable Vehicle</th>
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
                                    <div className="flex flex-col gap-0.5">
                                      {order.items?.map((item: any, i: number) => (
                                        <span key={i} className="text-xs font-bold text-[#0052cc] block truncate max-w-[120px]">
                                          {item.product?.part_number || "—"}
                                        </span>
                                      ))}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="flex flex-col gap-0.5">
                                      {order.items?.map((item: any, i: number) => (
                                        <span key={i} className="text-xs font-semibold text-zinc-600 block truncate max-w-[100px]">
                                          {item.product?.engine_model || "—"}
                                        </span>
                                      ))}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="flex flex-col gap-0.5">
                                      {order.items?.map((item: any, i: number) => (
                                        <span key={i} className="text-xs font-semibold text-zinc-600 block truncate max-w-[120px]" title={item.product?.suitable_vehicle}>
                                          {item.product?.suitable_vehicle || "—"}
                                        </span>
                                      ))}
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
                                  <td className="px-6 py-4 text-right pr-10">
                                    {(() => {
                                      const refundedTotal = getOrderRefundedTotal(order);
                                      const allCancelled = order.items?.every((i: any) => i.cancellation_status === "Cancelled");
                                      
                                      if (order.status === "Cancelled" || allCancelled) {
                                        return (
                                          <>
                                            <p className="text-[14px] font-black text-red-500 line-through opacity-75">
                                              Ksh {refundedTotal.toLocaleString()}
                                            </p>
                                            <p className="text-[10px] font-bold text-red-500 uppercase tracking-wide">Refunded</p>
                                          </>
                                        );
                                      }
                                      
                                      return (
                                        <>
                                          <p className="text-[14px] font-black text-[#1e293b]">
                                            Ksh {Number(order.total_amount || 0).toLocaleString()}
                                          </p>
                                          {refundedTotal > 0 && (
                                            <p className="text-[10px] font-bold text-red-500 uppercase tracking-wide">
                                              Ksh {refundedTotal.toLocaleString()} Refunded
                                            </p>
                                          )}
                                        </>
                                      );
                                    })()}
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                    <Badge className={cn(
                                      "rounded-full px-3 text-[10px] font-bold uppercase border-none tracking-wider",
                                      order.status === "Pending" ? "bg-yellow-400 text-yellow-950" : 
                                      order.status === "Processing" ? "bg-orange-500 text-white" :
                                      (order.status === "Shipped" || order.status === "In Transit") ? "bg-blue-600 text-white" : 
                                      order.status === "Delivered" ? "bg-emerald-500 text-white" : 
                                      (order.status === "Cancelled" || order.status === "Cancellation Requested") ? "bg-red-100 text-red-700 font-black" :
                                      "bg-zinc-200 text-zinc-700"
                                    )}>
                                      {order.status === "In Transit" ? "SHIPPED" : order.status}
                                    </Badge>
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
                    <Card id="tour-addresses-section" className="border-[#e2e8f0] shadow-sm rounded-lg overflow-hidden">
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
          <DialogHeader className="p-6 bg-white border-b border-[#e2e8f0] flex flex-row items-center justify-between">
             <div className="space-y-1 text-left">
               <DialogTitle className="text-xl font-bold text-[#1e293b]">Order Ref: {selectedOrder?.tracking_number || selectedOrder?.id}</DialogTitle>
               <DialogDescription className="text-[#64748b] font-medium text-sm">
                 Placed on {selectedOrder ? new Date(selectedOrder.created_at).toLocaleDateString() : ''}
               </DialogDescription>
             </div>
             <Badge className={cn(
               "rounded-full px-3 py-1 text-[10px] font-bold uppercase border-none tracking-wider",
               selectedOrder?.status === "Pending" ? "bg-yellow-400 text-yellow-950" : 
               selectedOrder?.status === "Processing" ? "bg-orange-500 text-white" :
               selectedOrder?.status === "Shipped" || selectedOrder?.status === "In Transit" ? "bg-blue-600 text-white" :
               selectedOrder?.status === "Delivered" ? "bg-emerald-500 text-white" :
               (selectedOrder?.status === "Cancelled" || selectedOrder?.status === "Cancellation Requested") ? "bg-red-100 text-red-700 font-black" :
               "bg-zinc-200 text-zinc-700"
             )}>
               {selectedOrder?.status === "In Transit" ? "SHIPPED" : selectedOrder?.status}
             </Badge>
          </DialogHeader>
          <div className="p-6 max-h-[60vh] overflow-y-auto space-y-6">
             <div className="bg-[#f8fafc] p-4 rounded-lg border border-[#e2e8f0]">
               <h4 className="text-[11px] font-bold text-[#64748b] uppercase tracking-widest mb-3">Logistics Intelligence</h4>
               <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-[#94a3b8] uppercase">Origin Node</p>
                    <p className="text-[13px] font-bold text-[#1e293b]">
                      {selectedOrder?.items?.[0]?.warehouse?.name || 
                        selectedOrder?.items?.[0]?.warehouse?.code || "Warehouse"}
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
               {selectedOrder?.items?.map((item: any, idx: number) => {
                 const isItemCancelled = item.cancellation_status === "Cancelled";
                 const totalUnits = Math.max(1, (selectedOrder.items || []).reduce((s: number, i: any) => s + (i.quantity || 1), 0));
                 const shippingFee = Number(selectedOrder.shipping_fee || 0);
                 const itemProductCost = Number(item.price) * item.quantity;
                 const itemShippingShare = (shippingFee / totalUnits) * item.quantity;
                 const itemRefundTotal = itemProductCost + itemShippingShare;
                 return (
                   <div key={idx} className={cn("flex justify-between items-start pb-4 border-b border-[#f1f5f9] last:border-0 last:pb-0", isItemCancelled && "bg-red-50/60 px-3 py-3 rounded-lg border border-red-100 mb-2")}>
                     <div className="space-y-1 flex-1 min-w-0">
                       <p className={cn("font-semibold text-[#1e293b] text-[14px]", isItemCancelled && "line-through text-zinc-400")}>{item.product?.name || `Product ID: ${item.product_id}`}</p>
                       <div className="flex flex-wrap items-center gap-2">
                         <span className="text-[10px] font-bold bg-[#f1f5f9] text-[#64748b] px-2 py-0.5 rounded uppercase">From: {item.warehouse?.name || "Processing Hub"}</span>
                         <span className={cn("text-[11px] font-semibold text-slate-700", isItemCancelled && "line-through text-zinc-400")}>Quantity: {item.quantity} × Ksh {Number(item.price).toLocaleString()}</span>
                         {item.product?.part_number && (
                           <span className={cn("text-xs font-bold text-[#0052cc]", isItemCancelled && "line-through text-zinc-400")}>Part No: {item.product.part_number}</span>
                         )}
                         {item.product?.engine_model && (
                           <span className={cn("text-xs text-zinc-500 font-medium", isItemCancelled && "line-through text-zinc-400")}>Engine: {item.product.engine_model}</span>
                         )}
                         {item.product?.suitable_vehicle && (
                           <span className={cn("text-xs text-zinc-500 font-medium", isItemCancelled && "line-through text-zinc-400")}>Suitable: {item.product.suitable_vehicle}</span>
                         )}
                         {item.cancellation_status && item.cancellation_status !== "None" && (
                           <span className={cn(
                             "text-[9px] font-black uppercase px-2 py-0.5 rounded border tracking-wider",
                             item.cancellation_status === "Pending" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-red-50 text-red-700 border-red-200"
                           )}>
                             {item.cancellation_status === "Pending" ? "Cancellation Pending" : "Cancelled / Refunded"}
                           </span>
                         )}
                       </div>
                       {/* Per-item refund breakdown for cancelled items */}
                       {isItemCancelled && (
                         <p className="text-[11px] font-semibold text-red-600 mt-1">
                           Refunded: Ksh {Math.round(itemProductCost).toLocaleString()} product
                           {itemShippingShare > 0 && <> + Ksh {Math.round(itemShippingShare).toLocaleString()} shipping</>}
                           {" "}= <span className="font-black">Ksh {Math.round(itemRefundTotal).toLocaleString()}</span>
                         </p>
                       )}
                     </div>
                     <p className={cn("font-bold text-[#1e293b] text-[14px] shrink-0 ml-2", isItemCancelled && "line-through text-red-400")}>Ksh {(Number(item.price) * item.quantity).toLocaleString()}</p>
                   </div>
                 );
               })}
             </div>
             
             {/* Cancellation / Refund block — shows for partial OR full cancellations */}
             {(selectedOrder?.status === "Cancelled" ||
               selectedOrder?.status === "Cancellation Requested" ||
               selectedOrder?.refund_status ||
               selectedOrder?.refund_transaction_id ||
               selectedOrder?.items?.some((i: any) => i.cancellation_status === "Cancelled")) && (
                <div className="bg-red-50 p-4 rounded-lg border border-red-200 mt-4 mb-4">
                  <h4 className="text-[13px] font-bold text-red-800 flex items-center gap-2 mb-3">
                    <AlertCircle className="h-4 w-4" />
                    {selectedOrder?.status === "Cancellation Requested" ? "Cancellation Requested" :
                     selectedOrder?.status === "Cancelled" ? "Order Cancelled" : "Partial Cancellation"}
                  </h4>
                  {selectedOrder?.status === "Cancellation Requested" ? (
                    <div className="space-y-2">
                      <p className="text-[12px] text-red-700 font-medium leading-relaxed">
                        You have requested to cancel this order. The cancellation is pending approval by the administration. You will be notified once it is approved.
                      </p>
                      {selectedOrder.cancellation_reason && (
                        <p className="text-[11px] text-red-700/80 bg-white/60 p-2 rounded-md border border-red-100">
                          <strong>Reason for cancellation:</strong> {selectedOrder.cancellation_reason}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedOrder?.cancellation_reason && (
                        <p className="text-[11px] text-red-700/80 bg-white/60 p-2 rounded-md border border-red-100">
                          <strong>Reason:</strong> {selectedOrder.cancellation_reason}
                        </p>
                      )}
                      {/* Refund Status */}
                      <p className="text-[12px] font-semibold text-red-900">
                        <span className="text-red-700">Refund Status: </span>
                        <span className={cn(
                          "font-black uppercase tracking-wider",
                          (selectedOrder?.refund_status === "Completed" || selectedOrder?.refund_transaction_id) ? "text-green-700" : "text-orange-600"
                        )}>
                          {selectedOrder?.refund_status || (selectedOrder?.refund_transaction_id ? "Completed" : "Pending")}
                        </span>
                      </p>
                      {/* Total refunded (product + proportional shipping) */}
                      {(() => {
                        const cancelledItems = (selectedOrder?.items || []).filter((i: any) => i.cancellation_status === "Cancelled");
                        if (cancelledItems.length === 0) return null;
                        const totalUnits = Math.max(1, (selectedOrder?.items || []).reduce((s: number, i: any) => s + (i.quantity || 1), 0));
                        const shippingFee = Number(selectedOrder?.shipping_fee || 0);
                        const totalRefunded = cancelledItems.reduce((sum: number, i: any) => {
                          return sum + (Number(i.price) * i.quantity) + ((shippingFee / totalUnits) * i.quantity);
                        }, 0);
                        return (
                          <p className="text-[12px] font-semibold text-red-900">
                            <span className="text-red-700">Amount to be Refunded: </span>
                            <span className="font-black text-[#1e293b]">Ksh {Math.round(totalRefunded).toLocaleString()}</span>
                            <span className="text-[10px] text-zinc-500 ml-1">(incl. shipping)</span>
                          </p>
                        );
                      })()}
                      {/* Refund evidence */}
                      {selectedOrder?.refund_transaction_id && (
                        <p className="text-[13px] font-black text-[#1e293b] bg-white px-3 py-2 rounded-md border border-green-200 inline-block mt-1 text-green-700">
                          Transaction ID: <span className="text-green-700">{selectedOrder.refund_transaction_id}</span>
                        </p>
                      )}
                      {/* Pending refund message (no tx ID yet) */}
                      {!selectedOrder?.refund_transaction_id && selectedOrder?.status === "Cancelled" && (
                        <p className="text-[12px] text-red-700 font-medium leading-relaxed">
                          Your refund is being processed manually and will be sent to you within 3–5 business days. If you do not receive it, please call us with your Order Reference.
                        </p>
                      )}
                    </div>
                  )}
                </div>
             )}

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
          <DialogFooter className="p-4 bg-[#f8fafc] border-t border-[#e2e8f0] flex-col sm:flex-row justify-between gap-3">
            <div className="flex gap-2">
              {(selectedOrder?.status === "Pending" || selectedOrder?.status === "Processing") && (
                <Button variant="destructive" className="text-[12px] font-bold h-9 bg-red-600 hover:bg-red-700 text-white hover:text-white border-none shadow-none" onClick={() => { 
                  setIsOrderModalOpen(false); 
                  setIsCancelModalOpen(true); 
                  const eligibleIds = selectedOrder?.items
                    ?.filter((i: any) => i.cancellation_status !== "Cancelled" && i.cancellation_status !== "Pending")
                    ?.map((i: any) => i.id) || [];
                  setSelectedItemIdsToCancel(eligibleIds);
                }}>
                  Request Cancellation
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="text-[12px] font-bold border-[#e2e8f0] h-9" onClick={() => setIsOrderModalOpen(false)}>Close</Button>
              <Button className="bg-[#0052cc] hover:bg-[#0747a6] text-white text-[12px] font-bold h-9" onClick={() => selectedOrder && downloadInvoice(selectedOrder)}>
                <FileText className="h-4 w-4 mr-2" /> Download Invoice PDF
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Order Modal */}
      <Dialog open={isCancelModalOpen} onOpenChange={setIsCancelModalOpen}>
        <DialogContent className="rounded-lg border-[#e2e8f0] shadow-xl sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="font-bold text-[#1e293b]">Request Order Cancellation</DialogTitle>
            <DialogDescription className="text-xs text-[#64748b]">
              Select the products you wish to cancel and provide a cancellation reason.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedOrder?.items && (
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider block">Tick Products to Cancel *</label>
                <div className="space-y-2 max-h-[180px] overflow-y-auto border border-[#e2e8f0] rounded-md p-3 bg-slate-50/50">
                  {selectedOrder.items.map((item: any) => {
                    const isItemCancelled = item.cancellation_status === "Cancelled" || item.cancellation_status === "Pending";
                    return (
                      <label key={item.id} className={cn("flex items-start gap-3 p-2 rounded-lg border border-transparent hover:bg-white transition-colors cursor-pointer", isItemCancelled && "opacity-60 cursor-not-allowed")}>
                        <input
                          type="checkbox"
                          disabled={isItemCancelled}
                          checked={isItemCancelled || selectedItemIdsToCancel.includes(item.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedItemIdsToCancel([...selectedItemIdsToCancel, item.id]);
                            } else {
                              setSelectedItemIdsToCancel(selectedItemIdsToCancel.filter(id => id !== item.id));
                            }
                          }}
                          className="w-4 h-4 accent-[#0052cc] rounded mt-0.5 cursor-pointer"
                        />
                        <div className="text-xs">
                          <p className="font-bold text-slate-800 leading-tight">{item.product?.name || "Genuine Part"}</p>
                          <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                            Qty: {item.quantity} · Price: Ksh {Number(item.price).toLocaleString()}
                          </p>
                          {item.cancellation_status && item.cancellation_status !== "None" && (
                            <span className={cn(
                              "text-[9px] font-black uppercase border px-1.5 py-0.2 rounded mt-1 inline-block",
                              item.cancellation_status === "Pending" ? "bg-amber-50 text-amber-700 border-amber-100" : "bg-red-50 text-red-700 border-red-100"
                            )}>
                              {item.cancellation_status === "Pending" ? "Pending Approval" : "Cancelled / Refunded"}
                            </span>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
            
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Cancellation Reason *</label>
              <textarea 
                rows={3}
                placeholder="e.g., I ordered the wrong item, or I changed my mind..."
                className="w-full rounded-md border border-[#e2e8f0] bg-white px-3 py-2 text-sm text-[#1e293b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0052cc]"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="font-bold" onClick={() => setIsCancelModalOpen(false)}>Back</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white font-bold" onClick={handleRequestCancel} disabled={isCancelling}>
              {isCancelling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Submit Request
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
              <label className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Destination Country</label>
              <select 
                className="h-10 w-full rounded-md border border-[#e2e8f0] bg-white px-3 py-2 text-sm text-[#1e293b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0052cc]"
                value={addressFormData.country}
                onChange={(e) => handleCountryChange(e.target.value)}
              >
                <option value="" disabled>Select Destination Country</option>
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
                <option value="" disabled>Select Destination City</option>
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
