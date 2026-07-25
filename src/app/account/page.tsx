"use client";

import { useEffect, useState, Fragment, useMemo } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Package, Clock, Settings, ShoppingBag, MapPin, CreditCard,
  ChevronRight, LogOut, Loader2, User, Lock, ShieldCheck,
  Eye, EyeOff, CheckCircle2, AlertCircle, Plus, Home, Smartphone,
  Search, Download, ArrowRightLeft, FileText, Truck, Star, Compass,
  RotateCcw, XCircle
} from "lucide-react";
import Link from "next/link";
import { Joyride, Step } from "react-joyride";
const JoyrideComponent = Joyride as any;
import { motion, AnimatePresence } from "framer-motion";
import api from "@/lib/axios";
import { API_ENDPOINTS } from "@/lib/apis";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useSearchParams, useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "react-hot-toast";
import { useSettings } from "@/components/providers/SettingsProvider";
import { exportSingleOrderInvoicePDF, exportCustomerLedgerPDF } from "@/lib/pdf-export";

import { Suspense } from "react";

/**
 * Returns the total amount already refunded for an order.
 * Reads from the backend-persisted `refunded_amount` column (product + shipping).
 * Legacy fallback: proportional calculation if field is absent.
 */
function getOrderRefundedTotal(order: any): number {
  if (!order) return 0;
  if (order.refunded_amount !== undefined && order.refunded_amount !== null) {
    return Number(order.refunded_amount || 0);
  }
  // Legacy fallback: use per-item shipping fee if available, else zero
  if (!order.items) return 0;
  return order.items
    .filter((i: any) => i.cancellation_status === "Cancelled")
    .reduce((sum: number, i: any) => {
      const itemProductCost = Number(i.price) * Number(i.quantity);
      const itemShippingShare = parseFloat(i.shipping_fee_per_unit ?? 0) * Number(i.quantity);
      return sum + itemProductCost + itemShippingShare;
    }, 0);
}

function isWithinReturnPeriod(order: any): boolean {
  if (!order) return false;
  if (order.status === "Delivered") {
    const deliveryDate = new Date(order.updated_at).getTime();
    const fourteenDaysInMs = 14 * 24 * 60 * 60 * 1000;
    return (Date.now() - deliveryDate) <= fourteenDaysInMs;
  }
  return ["Pending", "Processing"].includes(order.status);
}


/**
 * Determines if an order is a same-city (local) shipment by comparing
 * the warehouse location/name against the customer's shipping city.
 * Local  → PIN visible from "Shipped" or "Arrived"
 * Cross-city → PIN visible only from "Arrived" (driver is now in your city)
 */
function isLocalShipmentOrder(order: any): boolean {
  // Walk-in orders are always local
  if ((order?.tracking_number ?? '').startsWith('WK-')) return true;
  // Pickup = in-store, always local
  if (order?.shipping_method === 'Pickup') return true;

  const warehouse = order?.items?.[0]?.warehouse;
  // Use location field (backend now returns it); fall back to name
  const origin = (warehouse?.location || warehouse?.name || "")
    .trim().toLowerCase();
  const destination = (order?.shipping_city || "").trim().toLowerCase();
  if (!origin || !destination) return false;
  return origin.includes(destination) || destination.includes(origin);
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

  // Redirect delivery drivers to their portal immediately
  useEffect(() => {
    if (user && user.role === "delivery") {
      router.replace("/delivery");
    }
  }, [user, router]);

  const bizName = settings.store_name || "our store";
  const bizTagline = settings.store_tagline || "";
  const bizCurrency = settings.currency || "Ksh";
  const bizEmail = settings.contact_email || "";
  const bizPhone = settings.contact_phone || "";
  const bizWA = settings.contact_whatsapp || "";
  const bizAddress = settings.physical_address || "";
  const bizHours = settings.working_hours || "";
  const bizWebsite = settings.store_website || "";
  const bizBranch = settings.store_branch || "";
  const bizCountry = settings.store_country || "";

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
      content: `View status details of your recent orders placed with ${bizName}. Click the 'Inspect' button on any row to open Logistics Intelligence details, see live Container Waybills, check carrier names, track ETAs, and view your delivery driver's name, phone, vehicle plate, and proof-of-delivery once your package arrives.`,
    },
    {
      target: "#tour-table",
      placement: "top" as const,
      title: "🔐 Delivery Security PIN — Important",
      content: `When your order is dispatched (status changes to Shipped or Arrived), a unique 4-digit Security PIN will appear inside the 'Inspect' modal for that order. You MUST NOT share this PIN with anyone — not even the driver — until they physically arrive at your doorstep with your package. The driver will ask for this PIN at your door to confirm delivery. Sharing it early may result in your package being handed to the wrong person.`,
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
    api.get(API_ENDPOINTS.shippingDestinations.active)
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
      await api.put(API_ENDPOINTS.profile.user, addressFormData);
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

  // Order Search + Filter State
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("All");

  // Return Request State
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [returnExplanation, setReturnExplanation] = useState("");
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [myReturns, setMyReturns] = useState<any[]>([]);
  const [returnsLoading, setReturnsLoading] = useState(true);
  const [selectedReturnItems, setSelectedReturnItems] = useState<Record<number, number>>({});

  const openReturnModal = (order: any) => {
    setSelectedOrder(order);
    setSelectedReturnItems({});
    setReturnReason("");
    setReturnExplanation("");
    setIsReturnModalOpen(true);
  };

  const fetchReturns = () => {
    api.get(API_ENDPOINTS.returns.mine)
      .then(res => {
        setMyReturns(res.data);
        setReturnsLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch returns history:", err);
        setReturnsLoading(false);
      });
  };

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "orders") setActiveTab("My Orders");
    else if (tab === "settings") setActiveTab("Account Settings");
    else if (tab === "address") setActiveTab("Delivery Addresses");
    else if (tab === "payment") setActiveTab("Payment Methods");
    else if (tab === "returns") setActiveTab("Returns & Refunds");
    else setActiveTab("Dashboard");
  }, [searchParams]);

  useEffect(() => {
    api.get(API_ENDPOINTS.userOrders.mine)
      .then(res => {
        setOrders(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });

    // Load returns
    fetchReturns();

    // 3-second silent polling in background for instant updates
    const interval = setInterval(() => {
      api.get("/my-orders")
        .then(res => setOrders(res.data))
        .catch(err => console.error("Silent orders update failed:", err));
      fetchReturns();
    }, 3000);

    return () => clearInterval(interval);
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
      await api.post(API_ENDPOINTS.auth.changePassword, passwordData);
      setPasswordStatus({ loading: false, success: true, error: "" });

      setTimeout(() => {
        logout();
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

  const handleRequestReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    if (!returnReason) {
      toast.error("Please select a reason for the return");
      return;
    }
    if (returnReason === "Other (Specify in text box)" && !returnExplanation.trim()) {
      toast.error("Please provide a detailed explanation of your reason");
      return;
    }
    if (Object.keys(selectedReturnItems).length === 0) {
      toast.error("Please select at least one item to return");
      return;
    }

    setSubmittingReturn(true);
    try {
      await api.post(API_ENDPOINTS.returns.submit, {
        order_id: selectedOrder.id,
        reason: returnReason,
        explanation: returnExplanation,
        return_items: Object.entries(selectedReturnItems).map(([id, qty]) => ({
          order_item_id: parseInt(id),
          quantity: qty
        }))
      });
      toast.success("Return request submitted successfully! Administration will review your request.", {
        duration: 5000,
        icon: "🔄"
      });
      setIsReturnModalOpen(false);
      setReturnReason("");
      setReturnExplanation("");
      setSelectedReturnItems({});


      // Refresh list
      api.get(API_ENDPOINTS.userOrders.mine).then(res => setOrders(res.data));
      fetchReturns();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to submit return request");
    } finally {
      setSubmittingReturn(false);
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
      const res = await api.post(API_ENDPOINTS.orders.requestCancel(selectedOrder.id), {
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
    .filter((o: any) => o.status !== "Cancelled" && o.status !== "Returned")
    .reduce((sum: number, order: any) => sum + Number(order.total_amount), 0);
  const activeOrders = orders.filter((o: any) => o.status !== "Delivered" && o.status !== "Cancelled" && o.status !== "Returned").length;
  const partsPurchased = orders
    .filter((o: any) => o.status !== "Cancelled" && o.status !== "Returned")
    .reduce((sum: number, order: any) => {
      const itemsCount = order.items?.reduce((itemSum: number, item: any) => {
        if (item.cancellation_status === "Cancelled") {
          return itemSum;
        }
        return itemSum + Number(item.quantity || 0);
      }, 0) || 0;
      return sum + itemsCount;
    }, 0);

  // ── Filtered + searched orders for the My Orders tab ──────────────────────
  const filteredOrders = useMemo(() => {
    const sq = orderSearch.toLowerCase().trim();
    return orders.filter((o: any) => {
      const matchesStatus = orderStatusFilter === "All" || o.status === orderStatusFilter;
      if (!matchesStatus) return false;
      if (!sq) return true;
      const trackingMatch = (o.tracking_number || "").toLowerCase().includes(sq);
      const productMatch = o.items?.some((item: any) =>
        (item.product?.name || "").toLowerCase().includes(sq) ||
        (item.product?.part_number || "").toLowerCase().includes(sq)
      );
      const refMatch = (o.payment_ref_code || "").toLowerCase().includes(sq);
      return trackingMatch || productMatch || refMatch;
    });
  }, [orders, orderSearch, orderStatusFilter]);

  const tabs = [
    { name: "Dashboard", icon: Package },
    { name: "My Orders", icon: ShoppingBag },
    { name: "Delivery Addresses", icon: MapPin },
    { name: "Returns & Refunds", icon: RotateCcw },
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

      <main className="flex-1 py-6 sm:py-10">
        <div className="container mx-auto px-4 sm:px-6 max-w-7xl">

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
                  const goldThresh = parseFloat(settings.rank_gold_threshold || "50000");
                  const silverThresh = parseFloat(settings.rank_silver_threshold || "10000");
                  let label = "Bronze Member", bgClass = "bg-amber-700";
                  if (ltv >= platThresh) { label = "Platinum Customer"; bgClass = "bg-[#0052cc]"; }
                  else if (ltv >= goldThresh) { label = "Gold Member"; bgClass = "bg-yellow-500"; }
                  else if (ltv >= silverThresh) { label = "Silver Member"; bgClass = "bg-slate-400"; }
                  return (
                    <div id="tour-loyalty" className={cn("text-white px-4 py-2 rounded-md font-semibold text-xs uppercase tracking-wider flex items-center gap-2 shadow-sm", bgClass)}>
                      <Star className="h-3 w-3 fill-white" /> {label}
                    </div>
                  );
                })()
              )}
            </div>
          </div>

          {/* ── Mobile horizontal tab bar ───────────────────────────── */}
          <div id="tour-nav" className="lg:hidden mb-5 -mx-4 px-4 overflow-x-auto">
            <div className="flex items-center gap-2 pb-2" style={{ minWidth: 'max-content' }}>
              {tabs.map((item) => (
                <button
                  key={item.name}
                  onClick={() => setActiveTab(item.name)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-bold transition-all whitespace-nowrap border",
                    activeTab === item.name
                      ? "bg-[#0052cc] text-white border-[#0052cc] shadow-sm"
                      : "bg-white text-[#64748b] border-[#e2e8f0] hover:border-[#0052cc]/40 hover:text-[#0052cc]"
                  )}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.name}
                </button>
              ))}
              <Link href="/products" className="flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-bold text-[#0052cc] border border-[#0052cc]/30 bg-white whitespace-nowrap">
                <ShoppingBag className="h-3.5 w-3.5" /> Shop
              </Link>
              <button onClick={logout} className="flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-bold text-red-500 border border-red-200 bg-white whitespace-nowrap">
                <LogOut className="h-3.5 w-3.5" /> Sign Out
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

            {/* Sidebar - Desktop only */}
            <div className="hidden lg:block lg:col-span-3 space-y-1">
              <p className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-widest mb-4 ml-2">Account Portal</p>
              {tabs.map((item) => (
                <button
                  key={item.name}
                  onClick={() => setActiveTab(item.name)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-200 group text-[14px] font-medium border-l-2",
                    activeTab === item.name
                      ? "bg-blue-50 text-[#0052cc] font-semibold border-[#0052cc] shadow-sm"
                      : "text-[#64748b] hover:bg-[#f8fafc] hover:text-[#1e293b] border-transparent"
                  )}
                >
                  <item.icon className={cn("h-4 w-4 shrink-0", activeTab === item.name ? "text-[#0052cc]" : "text-[#94a3b8] group-hover:text-[#475569]")} />
                  <span>{item.name}</span>
                </button>
              ))}

              <div className="pt-6 mt-6 border-t border-[#f1f5f9] space-y-2">
                <Link
                  id="tour-shop"
                  href="/products"
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-md bg-[#0052cc] hover:bg-[#0747a6] active:bg-[#053d8a] text-white text-[13px] font-bold tracking-wide transition-all shadow-sm hover:shadow-md"
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
                          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative z-10">
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
                                title: "Dispatched",
                                color: "bg-blue-500",
                                borderColor: "border-blue-200",
                                bgCard: "bg-blue-50",
                                desc: "Your container has been dispatched! Click 'Inspect' on any order to view the Live Container Tracking section with waybill, carrier, and ETA.",
                                tips: ["View Waybill & Carrier in Inspect modal", "Logistics Intelligence shows your route"]
                              },
                              {
                                step: 4,
                                icon: MapPin,
                                status: "Arrived",
                                title: "Ready for Pickup",
                                color: "bg-[#0052cc]",
                                borderColor: "border-indigo-200",
                                bgCard: "bg-indigo-50",
                                desc: "Your parts have arrived at the destination office and are ready for pickup. Please collect them or coordinate final delivery.",
                                tips: ["Bring your Order Ref for pickup", "SMS notification has pickup details"]
                              },
                              {
                                step: 5,
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

                      <div className="overflow-x-auto overflow-y-auto max-h-[480px] custom-scrollbar">
                        <table className="w-full min-w-[900px] text-left">
                          <thead className="sticky top-0 z-10 bg-[#f8fafc] text-[11px] uppercase tracking-wider font-bold text-[#64748b] border-b border-[#e2e8f0]">
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
                              orders.map((order: any) => {
                                const validItems = order.items?.filter((item: any) => item.cancellation_status !== "Cancelled") || [];
                                return (
                                <tr key={order.id} className="hover:bg-[#f8fafc] transition-colors">
                                  <td className="px-6 py-4">
                                    <p className="text-[14px] font-bold text-[#1e293b]">{order.tracking_number || `#ORD-${order.id}`}</p>
                                    {order.payment_ref_code && (
                                      <p className="text-[10px] font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded border border-green-200 mt-1 inline-block tracking-wide">
                                        M-Pesa: {order.payment_ref_code}
                                      </p>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 text-[13px] text-[#64748b]">
                                    {new Date(order.created_at).toLocaleDateString()}
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="space-y-0.5 max-w-[200px]">
                                      <p className="text-[13px] font-bold text-[#1e293b] truncate">
                                        {validItems[0]?.product?.name || "Genuine Spare Part"}
                                      </p>
                                      {validItems.length > 1 && (
                                        <p className="text-[10px] text-[#94a3b8] font-bold uppercase">+{validItems.length - 1} more items</p>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="flex flex-col gap-0.5">
                                      {validItems.map((item: any, i: number) => (
                                        <span key={i} className="text-xs font-bold text-[#0052cc] block truncate max-w-[120px]">
                                          {item.product?.part_number || "—"}
                                        </span>
                                      ))}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="flex flex-col gap-0.5">
                                      {validItems.map((item: any, i: number) => (
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
                                    <span className={cn(
                                      "inline-flex items-center rounded-full px-3 py-0.5 text-[10px] font-black uppercase tracking-wider",
                                      order.status === "Pending" ? "bg-yellow-400 text-yellow-950" :
                                      order.status === "Processing" ? "bg-orange-500 text-white" :
                                      (order.status === "Shipped" || order.status === "In Transit") ? "bg-blue-600 text-white" :
                                      order.status === "Arrived" ? "bg-indigo-600 text-white" :
                                      order.status === "Delivered" ? "bg-emerald-500 text-white" :
                                      order.status === "Returned" ? "bg-red-600 text-white" :
                                      (order.status === "Cancelled" || order.status === "Cancellation Requested") ? "bg-red-100 text-red-700" :
                                      "bg-zinc-200 text-zinc-700"
                                    )}>
                                      {order.status === "In Transit" ? "SHIPPED" : order.status}
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
                                );
                              })
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
                                <Input type={showCurrentPassword ? "text" : "password"} required className="border-[#e2e8f0] pr-10" value={passwordData.current_password} onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })} />
                                <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)} className="absolute right-3 top-2.5 text-[#94a3b8] hover:text-[#64748b]">
                                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[12px] font-bold text-[#64748b] uppercase tracking-wider">New Password</label>
                              <div className="relative">
                                <Input type={showNewPassword ? "text" : "password"} required className="border-[#e2e8f0] pr-10" value={passwordData.password} onChange={(e) => setPasswordData({ ...passwordData, password: e.target.value })} />
                                <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-2.5 text-[#94a3b8] hover:text-[#64748b]">
                                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[12px] font-bold text-[#64748b] uppercase tracking-wider">Confirm New Password</label>
                              <div className="relative">
                                <Input type={showConfirmPassword ? "text" : "password"} required className="border-[#e2e8f0] pr-10" value={passwordData.password_confirmation} onChange={(e) => setPasswordData({ ...passwordData, password_confirmation: e.target.value })} />
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
                      <div className="px-6 py-5 border-b border-[#e2e8f0] flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                        <div>
                          <h2 className="text-[16px] font-bold text-[#1e293b]">Full Order Ledger</h2>
                          <p className="text-[11px] text-[#94a3b8] font-medium mt-0.5">{filteredOrders.length} of {orders.length} orders</p>
                        </div>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                          {/* Search */}
                          <div className="relative flex-1 sm:w-56">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#94a3b8]" />
                            <input
                              type="text"
                              placeholder="Search orders, parts, M-Pesa ref..."
                              value={orderSearch}
                              onChange={e => setOrderSearch(e.target.value)}
                              className="w-full pl-8 pr-3 h-9 text-[12px] border border-[#e2e8f0] rounded-lg bg-[#f8fafc] text-[#1e293b] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#0052cc]/20 focus:border-[#0052cc] transition-all"
                            />
                          </div>
                          {/* Status Filter */}
                          <select
                            value={orderStatusFilter}
                            onChange={e => setOrderStatusFilter(e.target.value)}
                            className="h-9 px-3 text-[12px] border border-[#e2e8f0] rounded-lg bg-[#f8fafc] text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#0052cc]/20 focus:border-[#0052cc] font-semibold transition-all cursor-pointer"
                          >
                            <option value="All">All Statuses</option>
                            <option value="Pending">🟡 Pending</option>
                            <option value="Processing">🟠 Processing</option>
                            <option value="Shipped">🔵 Shipped</option>
                            <option value="Arrived">🟣 Arrived</option>
                            <option value="Delivered">🟢 Delivered</option>
                            <option value="Returned">🔴 Returned</option>
                            <option value="Cancelled">❌ Cancelled</option>
                          </select>
                          {/* PDF Export */}
                          <Button onClick={downloadStatement} size="sm" className="bg-[#0052cc] hover:bg-[#0747a6] text-[12px] font-bold text-white uppercase tracking-wider h-9 px-4 shrink-0">
                            <FileText className="h-4 w-4 mr-2" /> Statement
                          </Button>
                        </div>
                      </div>

                      <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                        <table className="w-full min-w-[950px] text-left">
                          <thead className="bg-[#f8fafc] text-[11px] uppercase tracking-wider font-bold text-[#64748b] border-b border-[#e2e8f0] sticky top-0 z-10">
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
                              <tr><td colSpan={12} className="p-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#64748b]" /></td></tr>
                            ) : filteredOrders.length === 0 ? (
                              <tr><td colSpan={12} className="p-12 text-center">
                                <div className="flex flex-col items-center gap-2">
                                  <Search className="h-8 w-8 text-[#cbd5e1]" />
                                  <p className="text-[13px] font-semibold text-[#94a3b8]">No orders match your search</p>
                                  <button onClick={() => { setOrderSearch(""); setOrderStatusFilter("All"); }} className="text-[12px] text-[#0052cc] font-bold hover:underline mt-1">Clear filters</button>
                                </div>
                              </td></tr>
                            ) : filteredOrders.map((order: any) => {
                              const validItems = order.items?.filter((item: any) => item.cancellation_status !== "Cancelled") || [];
                              return (
                              <tr key={order.id} className="hover:bg-[#f8fafc] transition-colors">
                                <td className="px-6 py-4">
                                  <p className="text-[14px] font-bold text-[#1e293b]">{order.tracking_number || `#ORD-${order.id}`}</p>
                                  {order.payment_ref_code && (
                                    <p className="text-[10px] font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded border border-green-200 mt-1 inline-block tracking-wide">
                                      M-Pesa: {order.payment_ref_code}
                                    </p>
                                  )}
                                </td>
                                <td className="px-6 py-4 text-[13px] text-[#64748b]">
                                  {new Date(order.created_at).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4">
                                  <div className="space-y-0.5 max-w-[200px]">
                                    <p className="text-[13px] font-bold text-[#1e293b] truncate">
                                      {validItems[0]?.product?.name || "Genuine Spare Part"}
                                    </p>
                                    {validItems.length > 1 && (
                                      <p className="text-[10px] text-[#94a3b8] font-bold uppercase">+{validItems.length - 1} more items</p>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex flex-col gap-0.5">
                                    {validItems.map((item: any, i: number) => (
                                      <span key={i} className="text-xs font-bold text-[#0052cc] block truncate max-w-[120px]">
                                        {item.product?.part_number || "—"}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex flex-col gap-0.5">
                                    {validItems.map((item: any, i: number) => (
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
                                  <span className={cn(
                                    "inline-flex items-center rounded-full px-3 py-0.5 text-[10px] font-black uppercase tracking-wider",
                                    order.status === "Pending" ? "bg-yellow-400 text-yellow-950" :
                                    order.status === "Processing" ? "bg-orange-500 text-white" :
                                    (order.status === "Shipped" || order.status === "In Transit") ? "bg-blue-600 text-white" :
                                    order.status === "Arrived" ? "bg-indigo-600 text-white" :
                                    order.status === "Delivered" ? "bg-emerald-500 text-white" :
                                    order.status === "Returned" ? "bg-red-600 text-white" :
                                    (order.status === "Cancelled" || order.status === "Cancellation Requested") ? "bg-red-100 text-red-700" :
                                    "bg-zinc-200 text-zinc-700"
                                  )}>
                                    {order.status === "In Transit" ? "SHIPPED" : order.status}
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
                                );
                              })
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
                        <div className="max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {loading ? (
                              /* ── Skeleton shimmer for addresses ── */
                              [1, 2, 3, 4].map((i) => (
                                <div key={i} className="border border-[#e2e8f0] rounded-lg p-5 bg-[#f8fafc] animate-pulse space-y-3">
                                  {/* City title */}
                                  <div className="h-4 w-28 bg-zinc-200 rounded" />
                                  {/* Address lines */}
                                  <div className="space-y-1.5">
                                    <div className="h-3 w-48 bg-zinc-100 rounded" />
                                    <div className="h-3 w-32 bg-zinc-100 rounded" />
                                  </div>
                                  {/* Action buttons */}
                                  <div className="flex gap-3 pt-1">
                                    <div className="h-4 w-24 bg-zinc-200 rounded" />
                                    <div className="h-4 w-16 bg-zinc-100 rounded" />
                                  </div>
                                </div>
                              ))
                            ) : orders.length === 0 ? (
                              <div className="col-span-2 text-center py-10 text-[#64748b] bg-[#f8fafc] rounded-lg border border-dashed">
                                No shipping destinations recorded yet.
                              </div>
                            ) : (
                              // Extract unique locations from orders
                              Array.from(new Set(orders.map((o: any) => `${o.shipping_city}|${o.shipping_address}`)))
                                .filter(loc => !hiddenAddresses.includes(loc))
                                .map((locString: string, idx: number) => {
                                  const [city, address] = locString.split('|');
                                  return (
                                    <div key={idx} className="border border-[#e2e8f0] rounded-lg p-5 bg-[#f8fafc] relative">
                                      {idx === 0 && <div className="absolute top-3 right-3 text-[#166534] bg-[#f0fdf4] text-[10px] font-bold px-2 py-0.5 rounded uppercase">Latest</div>}
                                      <h3 className="font-bold text-[#1e293b] mb-1">{city}</h3>
                                      <p className="text-[#64748b] text-[13px] mb-4">
                                        {address}<br />
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
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {activeTab === "Returns & Refunds" && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">

                    {/* ── Policy Banner ─────────────────────────────────────── */}
                    <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-5 py-4 flex gap-3 items-start">
                      <div className="shrink-0 mt-0.5 bg-blue-100 rounded-full p-1.5">
                        <AlertCircle className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-blue-900 mb-0.5">Returns &amp; Refunds Policy</p>
                        <p className="text-xs text-blue-700 leading-relaxed">
                          Returns can be requested within <strong>14 days of delivery</strong>. Parts must be in their <strong>original, unused condition</strong> with all original packaging.
                          {" "}For orders that have <strong>not yet been delivered</strong>, refunds are processed immediately once approved.
                          {" "}For <strong>delivered orders</strong>, you will need to return the part to our warehouse first — once we confirm receipt, your refund will be sent to your M-Pesa.
                        </p>
                      </div>
                    </div>

                    {/* ── How It Works Steps ────────────────────────────────── */}
                    <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm overflow-hidden">
                      <div className="px-5 py-4 border-b border-[#f1f5f9] bg-zinc-50/40">
                        <p className="text-xs font-extrabold uppercase tracking-widest text-zinc-500">How Returns Work</p>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-[#f1f5f9]">
                        {[
                          { step: "1", icon: "📋", title: "Submit Request", desc: "Go to My Orders, find your order and click \"Request Return\"." },
                          { step: "2", icon: "🔍", title: "Admin Review", desc: "Our team reviews your request within 1–2 business days." },
                          { step: "3", icon: "📦", title: "Return Item", desc: "For delivered orders: return the part to our warehouse. Pending/processing orders: nothing to return — item is still with us." },
                          { step: "4", icon: "💰", title: "Receive Refund", desc: "Refund is sent to your M-Pesa once approved (immediate for pending orders, after receipt confirmation for delivered orders)." },
                        ].map(s => (
                          <div key={s.step} className="px-4 py-4 flex flex-col gap-1">
                            <span className="text-xl mb-1">{s.icon}</span>
                            <p className="text-[11px] font-extrabold text-[#1e293b] uppercase tracking-wide">{s.title}</p>
                            <p className="text-[11px] text-zinc-500 leading-relaxed">{s.desc}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* ── Returns Ledger ────────────────────────────────────── */}
                    <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm overflow-hidden">
                      <div className="px-5 py-4 border-b border-[#f1f5f9] flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-[#1e293b]">My Return Requests</p>
                          <p className="text-[11px] text-zinc-500 font-medium mt-0.5">Track the status of all your submitted return requests below.</p>
                        </div>
                        <span className="text-[11px] font-black bg-purple-50 text-purple-700 px-3 py-1 rounded-full border border-purple-100 shadow-sm">
                          {returnsLoading ? "—" : `${myReturns.length} request${myReturns.length !== 1 ? "s" : ""}`}
                        </span>
                      </div>

                      {returnsLoading ? (
                        /* ── Skeleton shimmer ── */
                        <div className="divide-y divide-[#f1f5f9]">
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="px-5 py-5 space-y-3 animate-pulse">
                              <div className="flex items-center justify-between">
                                <div className="h-4 w-32 bg-zinc-200 rounded-md" />
                                <div className="h-5 w-20 bg-zinc-100 rounded-full" />
                              </div>
                              <div className="h-3 w-48 bg-zinc-100 rounded" />
                              <div className="flex gap-2 pt-1">
                                <div className="h-8 w-24 bg-zinc-100 rounded-lg" />
                                <div className="h-8 w-24 bg-zinc-100 rounded-lg" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : myReturns.length === 0 ? (
                        <div className="text-center py-14 text-zinc-400 flex flex-col items-center gap-3">
                          <RotateCcw className="h-8 w-8 opacity-30" />
                          <div>
                            <p className="text-sm font-bold text-zinc-500">No return requests yet</p>
                            <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto">If you need to return a part, go to the <strong>My Orders</strong> tab, find the delivered order, and click <strong>"Request Return"</strong>.</p>
                          </div>
                        </div>
                      ) : (
                        <div
                          className="divide-y divide-[#f1f5f9] overflow-y-auto"
                          style={{ maxHeight: myReturns.length > 1 ? "680px" : "none" }}
                        >
                          {myReturns.length > 1 && (
                            <div className="px-5 py-2 bg-zinc-50/60 border-b border-[#f1f5f9] flex items-center gap-2">
                              <span className="text-[10px] text-zinc-400 font-semibold">
                                ↕ Scroll to see all {myReturns.length} requests
                              </span>
                            </div>
                          )}
                          {myReturns.map((ret: any) => {
                            const items = ret.order?.items ?? [];
                            const returnItemIds: number[] = (ret.return_items ?? []).map((ri: any) => ri.order_item_id);
                            const returnedItems = returnItemIds.length > 0
                              ? items.filter((i: any) => returnItemIds.includes(i.id))
                              : items;
                            let productCostTotal = 0;
                            let shippingShareTotal = 0;
                            returnedItems.forEach((i: any) => {
                              const qty = ret.return_items?.find((ri: any) => ri.order_item_id === i.id)?.quantity ?? i.quantity;
                              productCostTotal += parseFloat(i.price ?? 0) * qty;
                              shippingShareTotal += parseFloat(i.shipping_fee_per_unit ?? 0) * qty;
                            });
                            const refundTotal = productCostTotal + shippingShareTotal;
                            const isPartial = ret.return_items && ret.return_items.length > 0;

                            return (
                              <div key={ret.id} className="p-4 sm:p-5 hover:bg-zinc-50/40 transition-colors">
                                {/* Header row */}
                                <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3 sm:justify-between mb-4">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-extrabold text-[#0052cc]">RET-{ret.id}</span>
                                    <span className="text-zinc-300 text-xs hidden sm:inline">•</span>
                                    <span className="text-xs font-semibold text-zinc-600">Order: <span className="text-[#1e293b] font-bold">{ret.order?.tracking_number || `#${ret.order_id}`}</span></span>
                                    <span className="text-zinc-300 text-xs hidden sm:inline">•</span>
                                    <span className="text-xs text-zinc-400 font-medium">Filed {new Date(ret.created_at).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}</span>
                                    {isPartial && (
                                      <span className="text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full uppercase tracking-wide">Partial Return</span>
                                    )}
                                  </div>
                                  <span className={cn(
                                    "inline-flex self-start sm:self-auto items-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider whitespace-nowrap",
                                    ret.status === "Approved" ? "bg-blue-100 text-blue-700 border border-blue-200" :
                                    ret.status === "Completed" ? "bg-emerald-500 text-white" :
                                    ret.status === "Rejected" ? "bg-red-600 text-white" :
                                    "bg-amber-100 text-amber-700 border border-amber-200"
                                  )}>
                                    {ret.status === "Pending" && "⏳ Pending Review"}
                                    {ret.status === "Approved" && "📦 Awaiting Return"}
                                    {ret.status === "Completed" && "✅ Refunded"}
                                    {ret.status === "Rejected" && "✕ Rejected"}
                                  </span>
                                </div>

                                {/* Reason + Items grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                  {/* Reason block */}
                                  <div className="bg-zinc-50 rounded-lg border border-zinc-100 px-4 py-3">
                                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400 mb-1.5">Return Reason</p>
                                    <p className="text-xs font-bold text-[#1e293b]">{ret.reason}</p>
                                    {ret.explanation && (
                                      <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{ret.explanation}</p>
                                    )}
                                  </div>

                                  {/* Items being returned */}
                                  <div className="bg-zinc-50 rounded-lg border border-zinc-100 px-4 py-3">
                                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400 mb-2">
                                      {isPartial ? "Items Being Returned" : "All Items (Full Return)"}
                                    </p>
                                    {returnedItems.length > 0 ? (
                                      <div className="space-y-1.5">
                                        {returnedItems.map((item: any) => {
                                          const qty = ret.return_items?.find((ri: any) => ri.order_item_id === item.id)?.quantity ?? item.quantity;
                                          return (
                                            <div key={item.id} className="flex items-center justify-between gap-2">
                                              <div className="flex items-start gap-1.5 min-w-0">
                                                <span className="text-zinc-400 text-[10px] mt-0.5 shrink-0">›</span>
                                                <p className="text-xs font-semibold text-[#1e293b] truncate">{item.product?.name ?? `Product #${item.product_id}`}</p>
                                              </div>
                                              <span className="text-[10px] font-bold text-zinc-500 shrink-0 bg-white border border-zinc-200 rounded px-1.5 py-0.5">×{qty}</span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <p className="text-xs text-zinc-400">All items in the order</p>
                                    )}
                                  </div>
                                </div>

                                {/* Estimated refund breakdown */}
                                {refundTotal > 0 && (
                                  <div className={cn(
                                    "rounded-lg border mb-4 overflow-hidden",
                                    ret.status === "Approved" ? "border-emerald-100" :
                                    ret.status === "Rejected" ? "border-red-100 opacity-60" :
                                    "border-amber-100"
                                  )}>
                                    <div className={cn(
                                      "flex items-center gap-2 px-4 py-2.5 text-xs font-extrabold uppercase tracking-widest",
                                      ret.status === "Approved" ? "bg-emerald-50 text-emerald-700" :
                                      ret.status === "Rejected" ? "bg-red-50 text-red-600" :
                                      "bg-amber-50 text-amber-700"
                                    )}>
                                      <span className="text-sm">💸</span>
                                      {ret.status === "Approved" ? "Approved Refund Breakdown" : ret.status === "Rejected" ? "Estimated Refund (Not Approved)" : "Estimated Refund Breakdown"}
                                    </div>
                                    <div className="px-4 py-3 bg-white space-y-1.5">
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="text-zinc-500 font-medium">Product cost</span>
                                        <span className="font-bold text-[#1e293b]">Ksh {productCostTotal.toLocaleString("en-KE", { minimumFractionDigits: 2 })}</span>
                                      </div>
                                      {shippingShareTotal > 0 && (
                                        <div className="flex items-center justify-between text-xs">
                                          <span className="text-zinc-500 font-medium">
                                            Shipping fee <span className="hidden sm:inline text-zinc-400">(per returned unit)</span>
                                          </span>
                                          <span className="font-bold text-[#1e293b]">Ksh {shippingShareTotal.toLocaleString("en-KE", { minimumFractionDigits: 2 })}</span>
                                        </div>
                                      )}
                                      <div className="border-t border-zinc-100 pt-1.5 flex items-center justify-between text-xs">
                                        <span className={cn("font-extrabold", ret.status === "Rejected" ? "text-red-600 line-through" : "text-[#1e293b]")}>Total Refund</span>
                                        <span className={cn("text-sm font-extrabold", ret.status === "Approved" || ret.status === "Completed" ? "text-emerald-600" : ret.status === "Rejected" ? "text-red-500 line-through" : "text-amber-700")}>
                                          Ksh {refundTotal.toLocaleString("en-KE", { minimumFractionDigits: 2 })}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Status timeline */}
                                <div className="flex items-center gap-0 text-[10px] font-semibold mb-4 overflow-x-auto pb-1">
                                  {[
                                    { label: "Submitted", done: true },
                                    { label: "Under Review", done: ret.status !== "Pending" },
                                    { label: ret.status === "Rejected" ? "Rejected" : "Approved", done: ret.status === "Approved" || ret.status === "Completed" || ret.status === "Rejected", rejected: ret.status === "Rejected" },
                                    { label: "Refund Sent", done: ret.status === "Completed" },
                                  ].map((s, idx, arr) => (
                                    <Fragment key={s.label}>
                                      <div className="flex flex-col items-center gap-1 shrink-0">
                                        <div className={cn(
                                          "w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black border-2",
                                          s.done && !s.rejected ? "bg-emerald-500 border-emerald-500 text-white" :
                                          s.rejected ? "bg-red-500 border-red-500 text-white" :
                                          "bg-white border-zinc-200 text-zinc-300"
                                        )}>
                                          {s.done ? (s.rejected ? "✕" : "✓") : idx + 1}
                                        </div>
                                        <span className={cn("text-[9px] font-bold text-center", s.done ? (s.rejected ? "text-red-500" : "text-emerald-600") : "text-zinc-400")}>{s.label}</span>
                                      </div>
                                      {idx < arr.length - 1 && (
                                        <div className={cn("flex-1 min-w-[16px] h-0.5 mx-1 mb-4 rounded-full", s.done && !s.rejected ? "bg-emerald-400" : "bg-zinc-100")} />
                                      )}
                                    </Fragment>
                                  ))}
                                </div>

                                {/* Next steps guidance */}
                                {ret.status === "Pending" && (
                                  <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 text-xs text-amber-800 font-medium flex gap-2 items-start">
                                    <span className="text-base shrink-0">⏳</span>
                                    <span><strong>What happens next:</strong> Our admin team is reviewing your return request. This typically takes 1–2 business days. You will receive an update in this tab once a decision is made.</span>
                                  </div>
                                )}
                                {ret.status === "Approved" && (
                                  <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-xs text-blue-800 font-medium flex gap-2 items-start">
                                    <span className="text-base shrink-0">📦</span>
                                    <span><strong>Return authorized — action required:</strong> Please carefully pack the part(s) and send them back to our warehouse using a tracked courier or drop them off at our branch. Once we confirm receipt of the returned items, your refund of <strong>Ksh {refundTotal.toLocaleString("en-KE", { minimumFractionDigits: 2 })}</strong> will be processed to your M-Pesa.</span>
                                  </div>
                                )}
                                {ret.status === "Completed" && (
                                  <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-3 text-xs text-emerald-800 font-medium flex gap-2 items-start">
                                    <span className="text-base shrink-0">✅</span>
                                    <span>
                                      <strong>Refund processed!</strong> Your return has been finalized. A refund of <strong>Ksh {refundTotal.toLocaleString("en-KE", { minimumFractionDigits: 2 })}</strong> has been sent via <strong>{ret.refund_payment_method || "your selected method"}</strong>.
                                      {ret.refund_reference && <> Transaction ref: <span className="font-mono font-black text-[#0052cc] bg-blue-50/50 border border-blue-100 px-1.5 py-0.5 rounded text-[10px]">{ret.refund_reference}</span>.</>}
                                      {" "}Please allow up to 24 hours for the amount to reflect in your account.
                                    </span>
                                  </div>
                                )}
                                {ret.status === "Rejected" && !ret.admin_notes && (
                                  <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3 text-xs text-red-700 font-medium flex gap-2 items-start">
                                    <span className="text-base shrink-0">❌</span>
                                    <span><strong>Return request not approved.</strong> Unfortunately, this return request did not meet our return policy criteria. If you believe this is an error, please contact our support team with your order reference <strong>{ret.order?.tracking_number}</strong>.</span>
                                  </div>
                                )}

                                {/* Admin notes */}
                                {ret.admin_notes && (
                                  <div className={cn(
                                    "mt-3 rounded-lg border px-4 py-3 text-xs font-medium flex gap-2.5 items-start",
                                    ret.status === "Rejected"
                                      ? "bg-red-50/60 border-red-100 text-red-800"
                                      : "bg-emerald-50/60 border-emerald-100 text-emerald-800"
                                  )}>
                                    <AlertCircle className={cn("h-4 w-4 shrink-0 mt-0.5", ret.status === "Rejected" ? "text-red-500" : "text-emerald-500")} />
                                    <div>
                                      <p className="font-extrabold uppercase tracking-widest text-[9px] opacity-80 mb-1">
                                        {ret.status === "Rejected" ? "Reason for Rejection (from Admin)" : "Approval Notes (from Admin)"}
                                      </p>
                                      <p className="leading-relaxed">{ret.admin_notes}</p>
                                    </div>
                                  </div>
                                )}

                                {/* Refund payment method + reference display */}
                                {ret.refund_payment_method && (
                                  <div className="mt-3 bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-3 space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                      <span className="text-zinc-500 font-medium">Refund Method</span>
                                      <span className="font-bold text-[#0052cc] bg-blue-50 border border-blue-100 px-2.5 py-0.5 rounded-full">
                                        {ret.refund_payment_method}
                                      </span>
                                    </div>
                                    {ret.refund_reference && (
                                      <div className="flex items-center justify-between text-xs border-t border-zinc-100 pt-2">
                                        <span className="text-zinc-500 font-medium">Transaction Reference</span>
                                        <span className="font-mono font-black text-[#0052cc] bg-blue-50/50 border border-blue-100 px-2.5 py-0.5 rounded tracking-wide text-[11px]">
                                          {ret.refund_reference}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}



              </AnimatePresence>

              {/* Support Banner - Blue as requested */}
              <div className="bg-[#0052cc] p-10 rounded-lg relative overflow-hidden mt-8 shadow-md">
                <div className="relative z-10">
                  <h3 className="text-2xl font-bold text-white mb-2 tracking-tight">Need assistance with your parts?</h3>
                  <p className="text-white/80 text-[15px] max-w-md mb-6 font-medium">Our expert team is available 24/7 to help you find the exact genuine part for your Mercedes-Benz.</p>
                  <a href={`tel:${settings?.support_phone || settings?.contact_phone || ""}`}>
                    <Button className="bg-white text-[#0052cc] hover:bg-slate-50 font-bold px-6 py-2 rounded-md transition-all shadow-sm flex items-center gap-2">
                      <Smartphone className="h-4 w-4" /> Contact Support
                    </Button>
                  </a>
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
             <span className={cn(
               "inline-flex items-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider",
               selectedOrder?.status === "Pending" ? "bg-yellow-400 text-yellow-950" :
               selectedOrder?.status === "Processing" ? "bg-orange-500 text-white" :
               (selectedOrder?.status === "Shipped" || selectedOrder?.status === "In Transit") ? "bg-blue-600 text-white" :
               selectedOrder?.status === "Arrived" ? "bg-indigo-600 text-white" :
               selectedOrder?.status === "Delivered" ? "bg-emerald-500 text-white" :
               selectedOrder?.status === "Returned" ? "bg-red-600 text-white" :
               (selectedOrder?.status === "Cancelled" || selectedOrder?.status === "Cancellation Requested") ? "bg-red-100 text-red-700" :
               "bg-zinc-200 text-zinc-700"
             )}>
               {selectedOrder?.status === "In Transit" ? "SHIPPED" : selectedOrder?.status}
             </span>
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

            {/* ── DRIVER & DELIVERY PROOFS — shown when order is Shipped/Arrived/Delivered ── */}
            {selectedOrder?.shipping_method !== "Pickup" && (selectedOrder?.driver || selectedOrder?.delivery_signature_url || selectedOrder?.delivery_photo_url) && (
              <div className="bg-[#f8fafc] p-4 rounded-lg border border-[#e2e8f0] space-y-3">
                <h4 className="text-[11px] font-bold text-[#64748b] uppercase tracking-widest">Delivery &amp; Driver Details</h4>
                {selectedOrder?.driver && (
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-700 font-black text-xs border border-indigo-200">
                      {selectedOrder.driver.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-zinc-800 truncate">{selectedOrder.driver.name}</p>
                      {selectedOrder.driver.phone && <p className="text-xs text-zinc-500 truncate">{selectedOrder.driver.phone}</p>}
                      {selectedOrder.driver.vehicle_plate && (
                        <p className="text-[10px] font-black text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                          Plate: {selectedOrder.driver.vehicle_plate}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                {(selectedOrder?.delivery_signature_url || selectedOrder?.delivery_photo_url) && (
                  <div className="pt-3 border-t border-[#e2e8f0] grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedOrder?.delivery_signature_url && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Recipient Signature (POD)</p>
                        <div className="border border-zinc-200 rounded-lg p-2 bg-white inline-block">
                          <img src={selectedOrder.delivery_signature_url} alt="Recipient Signature" className="h-16 max-w-full object-contain" />
                        </div>
                      </div>
                    )}
                    {selectedOrder?.delivery_photo_url && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Doorstep Photo Proof</p>
                        <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white max-w-[160px]">
                          <img src={selectedOrder.delivery_photo_url} alt="Doorstep Photo" className="w-full h-auto object-cover max-h-[100px]" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}


            {/* Delivery PIN — visible from Shipped AND Arrived for all order types */}
            {selectedOrder?.delivery_pin && (
              ["Shipped", "Arrived"].includes(selectedOrder.status)
            ) && (
              <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-5 text-center shadow-inner">
                <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-1 flex items-center justify-center gap-1.5">
                  <Lock className="h-3.5 w-3.5" /> Delivery Verification PIN
                </p>
                <p className="text-[11px] text-amber-600 font-medium mb-3">
                  For order <span className="font-black">{selectedOrder.tracking_number}</span>
                </p>
                <div className="flex items-center justify-center gap-3 mb-3">
                  {String(selectedOrder.delivery_pin).split("").map((digit: string, i: number) => (
                    <div
                      key={i}
                      className="h-14 w-12 rounded-xl bg-white border-2 border-amber-400 flex items-center justify-center text-2xl font-black text-amber-800 shadow-sm"
                    >
                      {digit}
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-amber-700 font-bold leading-snug max-w-[280px] mx-auto">
                  🔐 Only share this PIN with the driver at the moment they hand you the package. Do <strong>not</strong> share it before the package is physically in your hands.
                </p>
              </div>
            )}

            <div>
              <h4 className="text-[11px] font-bold text-[#64748b] uppercase tracking-widest mb-3">Manifest Summary</h4>
              {(() => {
                // Derive per-item shipping from backend-persisted refunded_amount (ground truth)
                // so the display is always accurate even after partial returns change shipping_fee
                const cancelledItems = (selectedOrder?.items || []).filter((i: any) => i.cancellation_status === "Cancelled");
                const cancelledProductTotal = cancelledItems.reduce((s: number, i: any) => s + Number(i.price) * Number(i.quantity), 0);
                const refundedAmount = Number(selectedOrder?.refunded_amount || 0);
                // Total shipping that was actually refunded = refunded_amount - product costs of cancelled items
                const refundedShippingTotal = Math.max(0, refundedAmount - cancelledProductTotal);
                const cancelledQtyTotal = Math.max(1, cancelledItems.reduce((s: number, i: any) => s + Number(i.quantity), 0));
                // Per-unit shipping refunded (spread evenly across returned units)
                const perUnitShippingRefunded = cancelledQtyTotal > 0 ? refundedShippingTotal / cancelledQtyTotal : 0;

                return (selectedOrder?.items || []).map((item: any, idx: number) => {
                  const isItemCancelled = item.cancellation_status === "Cancelled";
                  const itemProductCost = Number(item.price) * Number(item.quantity);
                  // Use the backend-derived per-unit shipping for accuracy
                  const itemShippingShare = isItemCancelled ? perUnitShippingRefunded * Number(item.quantity) : 0;
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
                              item.cancellation_status === "Pending" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-red-600 text-white border-red-600"
                            )}>
                              {item.cancellation_status === "Pending" ? "Return Pending" : "Returned"}
                            </span>
                          )}
                        </div>
                        {/* Per-item refund breakdown — uses backend refunded_amount for accuracy */}
                        {isItemCancelled && (
                          <p className="text-[11px] font-semibold text-red-600 mt-1">
                            Refunded: Ksh {Math.round(itemProductCost).toLocaleString()} product
                            {itemShippingShare > 0 && <> + Ksh {Math.round(itemShippingShare).toLocaleString()} shipping</>}
                            {" "}= <span className="font-black">Ksh {Math.round(itemRefundTotal).toLocaleString()}</span>
                          </p>
                        )}
                      </div>
                      <p className={cn("font-bold text-[#1e293b] text-[14px] shrink-0 ml-2", isItemCancelled && "line-through text-red-400")}>Ksh {(Number(item.price) * Number(item.quantity)).toLocaleString()}</p>
                    </div>
                  );
                });
              })()}
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
                          (selectedOrder?.refund_status === "Completed" || selectedOrder?.refund_transaction_id || Number(selectedOrder?.refunded_amount || 0) > 0) ? "text-green-700" : "text-orange-600"
                        )}>
                          {selectedOrder?.refund_status || (selectedOrder?.refund_transaction_id || Number(selectedOrder?.refunded_amount || 0) > 0 ? "Completed" : "Pending")}
                        </span>
                      </p>
                      {/* Total refunded — reads from backend-persisted refunded_amount */}
                      {(() => {
                        const refunded = Number(selectedOrder?.refunded_amount || 0);
                        if (refunded <= 0) return null;
                        return (
                          <p className="text-[12px] font-semibold text-red-900">
                            <span className="text-red-700">Amount Refunded: </span>
                            <span className="font-black text-[#1e293b]">Ksh {Math.round(refunded).toLocaleString()}</span>
                            <span className="text-[10px] text-zinc-500 ml-1">(product + shipping)</span>
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

            {/* Verification PIN Section — visible from Shipped AND Arrived for all order types */}
            {selectedOrder && selectedOrder.delivery_pin && (
              ["Shipped", "Arrived"].includes(selectedOrder.status)
            ) && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-left my-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2 text-amber-800">
                  <ShieldCheck className="h-4.5 w-4.5 text-amber-600" />
                  <h5 className="text-[12px] font-bold uppercase tracking-wider">Delivery Verification PIN</h5>
                </div>
                <p className="text-[11px] text-amber-700 leading-relaxed mb-3">
                  🔐 Only share this PIN with the driver at the exact moment they hand you the package. Do <strong>not</strong> share it before the package is physically in your hands.
                </p>
                <div className="inline-flex items-center bg-white border border-amber-300 rounded-lg px-4 py-2 font-mono text-lg font-black tracking-widest text-[#0052cc] shadow-sm select-all">
                  {selectedOrder.delivery_pin}
                </div>
              </div>
            )}

            <div className="pt-6 border-t border-[#f1f5f9] space-y-2">
              <div className="flex justify-between items-center text-[#64748b] text-[12px] font-bold uppercase tracking-wider">
                <span>Logistics Fee ({selectedOrder?.shipping_method || 'Standard'})</span>
                <span className="flex items-center gap-1.5">
                  Ksh {selectedOrder ? Number(selectedOrder.shipping_fee || 0).toLocaleString() : 0}
                  {selectedOrder && Number(selectedOrder.shipping_fee || 0) === 0 && Number(selectedOrder.refunded_amount || 0) > 0 && (
                    <span className="text-[9px] font-black text-red-500 uppercase bg-red-50 px-1.5 py-0.5 rounded border border-red-100">Refunded</span>
                  )}
                </span>
              </div>
              {selectedOrder?.payment_method && (
                <div className="flex justify-between items-center text-[#64748b] text-[12px] font-bold uppercase tracking-wider">
                  <span>Payment Method</span>
                  <span className="text-[#1e293b] font-semibold text-[13px]">{selectedOrder.payment_method}</span>
                </div>
              )}
              {selectedOrder?.payment_ref_code && (
                <div className="flex justify-between items-center text-[#64748b] text-[12px] font-bold uppercase tracking-wider">
                  <span>Payment Ref Code</span>
                  <span className="text-green-700 bg-green-50 px-1.5 py-0.5 rounded border border-green-200 font-bold">{selectedOrder.payment_ref_code}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="font-semibold text-[#1e293b] text-[13px] uppercase tracking-wider">Total Settlement</span>
                <span className="text-xl font-bold text-[#1e293b]">Ksh {selectedOrder ? Number(selectedOrder.total_amount).toLocaleString() : 0}</span>
              </div>
            </div>
          </div>
          <DialogFooter className="p-4 bg-[#f8fafc] border-t border-[#e2e8f0] flex-col sm:flex-row justify-between gap-3">
            <div className="flex gap-2 flex-wrap">
              {selectedOrder && isWithinReturnPeriod(selectedOrder) && (
                selectedOrder.status === "Delivered"
                  ? !myReturns.some((r: any) => r.order_id === selectedOrder.id && r.is_post_delivery)
                  : !myReturns.some((r: any) => r.order_id === selectedOrder.id)
              ) && (
                <Button
                  variant="outline"
                  className="text-[12px] font-bold h-9 border-purple-200 text-purple-700 hover:bg-purple-50"
                  onClick={() => {
                    setIsOrderModalOpen(false);
                    openReturnModal(selectedOrder);
                  }}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Request Return
                </Button>
              )}
              {selectedOrder && myReturns.some((r: any) => r.order_id === selectedOrder.id && r.status === "Rejected") && (
                <a
                  href={`mailto:support@spare.com?subject=Return Request Dispute — Order #${selectedOrder?.id}`}
                  className="inline-flex items-center gap-1.5 text-[12px] font-bold h-9 px-3 rounded-md border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Contact Support
                </a>
              )}

              {/* Render Status Badges for each Return Request for this order */}
              {selectedOrder && myReturns
                .filter((r: any) => r.order_id === selectedOrder.id)
                .map((r: any) => {
                  const typeLabel = r.is_post_delivery ? "Delivered Return" : "Pre-Delivery Cancel";
                  return (
                    <div key={r.id} className="flex flex-col gap-1 text-left">
                      {r.status === "Pending" && (
                        <span className="text-[11px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-md flex items-center gap-1.5">
                          <RotateCcw className="h-3 w-3" /> {typeLabel}: Pending Review
                        </span>
                      )}
                      {r.status === "Approved" && (
                        <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded-md flex items-center gap-1.5">
                          <CheckCircle2 className="h-3 w-3" /> {typeLabel}: Approved
                        </span>
                      )}
                      {r.status === "Completed" && (
                        <span className="text-[11px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2.5 py-1.5 rounded-md flex items-center gap-1.5">
                          <CheckCircle2 className="h-3 w-3" /> {typeLabel}: Refunded
                        </span>
                      )}
                      {r.status === "Rejected" && (
                        <div className="flex flex-col gap-1">
                          <span className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 px-2.5 py-1.5 rounded-md flex items-center gap-1.5">
                            <AlertCircle className="h-3 w-3 shrink-0" /> {typeLabel}: Rejected
                          </span>
                          {r.admin_notes && (
                            <span className="text-[10px] font-semibold text-red-700 bg-red-50/60 border border-red-100 px-2.5 py-1 rounded-md leading-snug">
                              Reason: {r.admin_notes}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

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
        <DialogContent className="rounded-xl border-none shadow-2xl sm:max-w-[500px] p-0 overflow-hidden">
          <DialogHeader className="px-6 py-5 bg-red-50 border-b border-red-100">
            <DialogTitle className="font-bold text-[#1e293b] flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" /> Cancel Order — {selectedOrder?.tracking_number}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748b] font-medium mt-1">
              Select the items you wish to cancel and provide a reason. Our team will review your request.
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

      {/* Return Request Modal */}
      <Dialog open={isReturnModalOpen} onOpenChange={setIsReturnModalOpen}>
        <DialogContent className="rounded-xl border-none shadow-2xl sm:max-w-[500px] p-0 overflow-hidden">
          <DialogHeader className="px-6 py-5 bg-purple-50 border-b border-purple-100">
            <DialogTitle className="font-bold text-[#1e293b] flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-purple-600" /> Request Return — {selectedOrder?.tracking_number}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748b] font-medium mt-1">
              Select the items you wish to return and specify quantities. Our team will review your request within 2–3 business days.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRequestReturn}>
            <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
              {/* One-time Submission Warning Banner */}
              <div className="rounded-lg border border-amber-100 bg-amber-50/70 p-3 flex gap-2.5 items-start text-xs text-amber-800 leading-normal">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Single Return Request Permitted</span>
                  You can only submit one return request per order reference. Please make sure to select all items you wish to return in this form. Subsequent requests for this order will be blocked — <span className="font-bold">except if the order is marked as Delivered, in which case one additional return request may be submitted.</span>
                </div>
              </div>

              {/* Item Selection with Quantity Pickers */}
              {selectedOrder?.items && selectedOrder.items.filter((i: any) => i.cancellation_status !== "Cancelled").length > 0 && (
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-[#64748b] uppercase tracking-widest block">Select Items to Return *</label>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto border border-purple-100 rounded-lg p-3 bg-purple-50/30">
                    {selectedOrder.items
                      .filter((item: any) => item.cancellation_status !== "Cancelled")
                      .map((item: any) => {
                        const selected = selectedReturnItems[item.id] !== undefined;
                        const qty = selectedReturnItems[item.id] ?? 0;
                        return (
                          <div key={item.id} className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all ${selected ? "bg-white border-purple-300 shadow-sm" : "bg-white/60 border-transparent hover:border-purple-200"}`}>
                            <input
                              type="checkbox"
                              className="w-4 h-4 accent-purple-600 rounded cursor-pointer shrink-0"
                              checked={selected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedReturnItems({ ...selectedReturnItems, [item.id]: 1 });
                                } else {
                                  const updated = { ...selectedReturnItems };
                                  delete updated[item.id];
                                  setSelectedReturnItems(updated);
                                }
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-zinc-800 text-xs leading-tight truncate">{item.product?.name || "Genuine Part"}</p>
                              <p className="text-[10px] text-zinc-400 font-medium">Ksh {Number(item.price).toLocaleString()} · Available: {item.quantity}</p>
                            </div>
                            {selected && (
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  className="w-6 h-6 rounded bg-purple-100 text-purple-700 font-black text-sm flex items-center justify-center hover:bg-purple-200 transition"
                                  onClick={() => {
                                    if (qty > 1) setSelectedReturnItems({ ...selectedReturnItems, [item.id]: qty - 1 });
                                    else {
                                      const updated = { ...selectedReturnItems };
                                      delete updated[item.id];
                                      setSelectedReturnItems(updated);
                                    }
                                  }}
                                >−</button>
                                <span className="w-6 text-center font-black text-zinc-800 text-sm">{qty}</span>
                                <button
                                  type="button"
                                  className="w-6 h-6 rounded bg-purple-100 text-purple-700 font-black text-sm flex items-center justify-center hover:bg-purple-200 transition"
                                  onClick={() => {
                                    if (qty < item.quantity) setSelectedReturnItems({ ...selectedReturnItems, [item.id]: qty + 1 });
                                  }}
                                >+</button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                  {Object.keys(selectedReturnItems).length > 0 && (
                    <p className="text-[10px] font-bold text-purple-600">
                      {Object.keys(selectedReturnItems).length} item(s) selected for return
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-[#64748b] uppercase tracking-widest block">Return Reason *</label>
                <select
                  className="w-full h-10 px-3 border border-[#e2e8f0] rounded-lg text-sm font-medium bg-white outline-none focus:ring-2 focus:ring-purple-200 text-[#1e293b]"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  required
                >
                  <option value="">Select a reason...</option>
                  <option value="Wrong part delivered">Wrong part delivered</option>
                  <option value="Part is defective or damaged">Part is defective or damaged</option>
                  <option value="Part does not fit my vehicle">Part does not fit my vehicle</option>
                  <option value="Ordered by mistake">Ordered by mistake</option>
                  <option value="Duplicate order">Duplicate order</option>
                  <option value="Part arrived too late">Part arrived too late</option>
                  <option value="Quality not as described">Quality not as described</option>
                  <option value="Other (Specify in text box)">Other (Specify in text box)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-[#64748b] uppercase tracking-widest block">
                  Additional Details {returnReason === "Other (Specify in text box)" ? "*" : "(Optional)"}
                </label>
                <textarea
                  className="w-full h-20 px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm font-medium bg-white outline-none focus:ring-2 focus:ring-purple-200 text-[#1e293b] resize-none"
                  placeholder="Provide more detail to help us process your return faster..."
                  value={returnExplanation}
                  onChange={(e) => setReturnExplanation(e.target.value)}
                  required={returnReason === "Other (Specify in text box)"}
                />
              </div>
              <p className="text-[10px] text-zinc-400 font-medium leading-relaxed bg-zinc-50 p-3 rounded-lg border border-zinc-100">
                ⚠️ Return requests can only be submitted within the eligible return window. Approved returns must be shipped back in original condition. Refunds are processed within 5–7 business days of receiving the part.
              </p>
            </div>
            <DialogFooter className="px-6 pb-5 flex gap-3">
              <Button type="button" variant="outline" className="font-bold flex-1" onClick={() => setIsReturnModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submittingReturn} className="font-bold flex-1 bg-purple-600 hover:bg-purple-700 text-white">
                {submittingReturn ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                Submit Return Request
              </Button>
            </DialogFooter>
          </form>
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
                onChange={(e) => setAddressFormData({ ...addressFormData, city: e.target.value })}
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
                onChange={(e) => setAddressFormData({ ...addressFormData, address: e.target.value })}
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
