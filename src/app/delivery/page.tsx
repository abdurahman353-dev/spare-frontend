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
  User, Check, X, Bell, Search, RefreshCw,
  Truck, TrendingUp, Shield, Navigation,
  ChevronRight, Filter, BarChart3,
  WifiOff, Key, Lock, AlertTriangle, SortDesc, SortAsc, ArrowRightLeft,
} from "lucide-react";
import api from "@/lib/axios";
import { API_ENDPOINTS } from "@/lib/apis";
import { toast } from "react-hot-toast";
import { useSettings } from "@/components/providers/SettingsProvider";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface OrderItem {
  id: number;
  product: { name: string };
  quantity: number;
  price: number;
  warehouse?: { name?: string; location?: string };
}

interface Order {
  id: number;
  tracking_number: string;
  created_at: string;
  updated_at: string;
  status: string;
  shipping_city: string;
  shipping_country: string;
  shipping_address: string;
  shipping_method: string;
  total_amount: number;
  delivered_by_user_id: number | null;
  delivery_pin?: string;
  customer?: { name: string; phone?: string; email?: string };
  items?: OrderItem[];
  delivery_signature_url?: string;
  delivery_photo_url?: string;
  driver?: { name: string; phone?: string; vehicle_plate?: string };
  notes?: string;
}

interface DeliveryNotification {
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

// ── Notes Parser helper ──────────────────────────────────────────────────────
/** Parses recipient name, phone, and optional email from walk-in order notes field */
function parseRecipientNotes(notes: string | null) {
  if (!notes) return null;
  const nameMatch = notes.match(/Recipient:\s*([^|]+)/);
  const phoneMatch = notes.match(/Phone:\s*([^|]+)/);
  const emailMatch = notes.match(/Email:\s*([^|]+)/);
  
  if (!nameMatch && !phoneMatch) return null;
  
  return {
    name: nameMatch ? nameMatch[1].trim() : "",
    phone: phoneMatch ? phoneMatch[1].trim() : "",
    email: emailMatch ? emailMatch[1].trim() : ""
  };
}

// ── Route type helper ────────────────────────────────────────────────────────
/**
 * Returns true when the order should enter the delivery pool at "Shipped" status:
 *   • Walk-in orders (WK- prefix) with Local Delivery method
 *   • Local shipment orders where warehouse city == destination city
 * Returns false for cross-city shipment orders — those only enter the pool at "Arrived"
 * (they must physically reach the destination hub first).
 */
function isLocalDelivery(order: Order): boolean {
  // Walk-in orders are always handled as local dispatch
  if ((order.tracking_number ?? "").startsWith("WK-")) return true;

  // Pickup = in-store, treat as local
  if (order.shipping_method === "Pickup") return true;

  // Compare warehouse origin city to destination city (same logic as admin orders page)
  const warehouseLocation = (order.items?.[0]?.warehouse?.location ?? "").trim().toLowerCase();
  const warehouseName     = (order.items?.[0]?.warehouse?.name     ?? "").trim().toLowerCase();
  const destination       = (order.shipping_city ?? "").trim().toLowerCase();

  if (!destination) return false;

  return warehouseLocation.includes(destination) ||
         destination.includes(warehouseLocation) ||
         warehouseName.includes(destination)     ||
         destination.includes(warehouseName);
}

function getStatusBadge(order: Order, myId: number) {
  const isMe    = order.delivered_by_user_id === myId;
  const isLocal = isLocalDelivery(order);

  if (order.status === "Shipped") {
    // Local orders appear in pool at Shipped stage
    if (isMe) return { label: "IN TRANSIT",     bg: "bg-blue-600 text-white",   dot: "bg-blue-300"   };
    return       { label: "READY TO SHIP",       bg: "bg-amber-500 text-white",  dot: "bg-amber-200"  };
  }
  if (order.status === "Arrived") {
    if (isLocal) {
      // Local: driver has marked arrived at customer doorstep
      return { label: "AT DOORSTEP",        bg: "bg-emerald-500 text-white", dot: "bg-emerald-200" };
    } else {
      // Cross-city: admin marked arrived at destination hub — ready for last-mile delivery
      if (isMe) return { label: "OUT FOR DELIVERY",  bg: "bg-emerald-500 text-white", dot: "bg-emerald-200" };
      return         { label: "ARRIVED AT DEST.",    bg: "bg-purple-600 text-white",  dot: "bg-purple-300"  };
    }
  }
  if (order.status === "Delivered") {
    return { label: "DELIVERED", bg: "bg-emerald-100 text-emerald-800", dot: "bg-emerald-400" };
  }
  return { label: order.status.toUpperCase(), bg: "bg-zinc-200 text-zinc-700", dot: "bg-zinc-400" };
}


// ── Audio alert ───────────────────────────────────────────────────────────────
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
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
  } catch { /* silently ignore if audio is blocked */ }
}

// ─────────────────────────────────────────────────────────────────────────────
export default function DeliveryPortal() {
  const { user, loading: authLoading, logout } = useAuth();
  const { settings } = useSettings();
  const router = useRouter();

  // Core data
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<Stats>({ today_completed: 0, active_count: 0, total_delivered: 0 });
  const [notifications, setNotifications] = useState<DeliveryNotification[]>([]);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // Tabs: "pool" | "mine" | "completed"
  const [activeTab, setActiveTab] = useState<"pool" | "mine" | "completed">("pool");

  // UI drawers
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifUnread, setNotifUnread] = useState(0);

  // Search & filter
  const [searchQuery, setSearchQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  // Order actions
  const [claimingId, setClaimingId]     = useState<number | null>(null);
  const [releasingId, setReleasingId]   = useState<number | null>(null);
  const [markingId, setMarkingId]       = useState<number | null>(null);
  const [confirmClaimOrder, setConfirmClaimOrder] = useState<Order | null>(null); // custom claim confirm dialog

  // PIN verification
  const [pinOrder, setPinOrder] = useState<Order | null>(null);
  const [pinValue, setPinValue] = useState("");
  const [pinLoading, setPinLoading] = useState(false);
  const [pinVerified, setPinVerified] = useState(false);
  const [pinError, setPinError] = useState("");
  const [showPinDialog, setShowPinDialog] = useState(false);

  // Signature capture
  const [signatureOrder, setSignatureOrder] = useState<Order | null>(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [submittingSignature, setSubmittingSignature] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strokeCount, setStrokeCount] = useState(0);

  // Doorstep photo
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);

  // Failed delivery attempt
  const [failedAttemptOrder, setFailedAttemptOrder] = useState<Order | null>(null);
  const [failedReason, setFailedReason] = useState("");
  const [failedNotes, setFailedNotes] = useState("");
  const [failedLoading, setFailedLoading] = useState(false);
  const [showFailedModal, setShowFailedModal] = useState(false);

  // Unified Release modal
  const [releaseModalOrder, setReleaseModalOrder] = useState<Order | null>(null);
  const [releaseType, setReleaseType] = useState<"failure" | "operational">("operational");
  const [releaseReason, setReleaseReason] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");

  // Manifest acknowledgement per order
  const [manifestChecked, setManifestChecked] = useState<{ [orderId: number]: boolean }>({});

  // Polling refs
  const knownAssignmentsRef = useRef<Map<number, number | null>>(new Map());
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const secondsRef = useRef<NodeJS.Timeout | null>(null);
  const [secondsSinceSync, setSecondsSinceSync] = useState(0);

  const currency = settings?.currency ?? "Ksh";

  // ── Auth Guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading) {
      if (!user) { window.location.href = "/login"; return; }
      if (user.role !== "delivery" && user.role !== "admin" && user.role !== "superadmin") {
        router.replace("/products");
      }
    }
  }, [user, authLoading, router]);

  // ── Browser notification permission ───────────────────────────────────────
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // ── Online/offline detection ───────────────────────────────────────────────
  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); toast.success("Connection restored", { icon: "📶" }); };
    const handleOffline = () => { setIsOnline(false); toast.error("You are offline. Data may be stale.", { duration: 6000 }); };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // ── Data Fetching ─────────────────────────────────────────────────────────
  const fetchOrders = useCallback(async (silent = false) => {
    if (!user) return;
    if (!silent) setLoading(true); else setIsSyncing(true);
    try {
      const res = await api.get(API_ENDPOINTS.delivery.orders);
      const incoming: Order[] = res.data as Order[];

      // Detect newly assigned orders (delivered_by_user_id changed to my id)
      if (knownAssignmentsRef.current.size > 0) {
        const newlyAssigned = incoming.filter(o => {
          const prev = knownAssignmentsRef.current.get(o.id);
          return o.delivered_by_user_id === user.id && prev !== user.id;
        });
        if (newlyAssigned.length > 0) {
          playNotificationSound();
          newlyAssigned.forEach(o => {
            toast(`🚚 Assigned: ${o.tracking_number} — ${o.customer?.name ?? ""} in ${o.shipping_city}`, {
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
          setNotifUnread(prev => prev + newlyAssigned.length);
        }
      }

      const newMap = new Map<number, number | null>();
      incoming.forEach(o => newMap.set(o.id, o.delivered_by_user_id));
      knownAssignmentsRef.current = newMap;

      setOrders(incoming);
      setSecondsSinceSync(0);
    } catch {
      if (!silent) toast.error("Failed to load delivery manifests");
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
  }, [user]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get(API_ENDPOINTS.delivery.stats);
      setStats(res.data as Stats);
    } catch { /* silently fail */ }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get(API_ENDPOINTS.delivery.notifications);
      setNotifications((res.data.notifications ?? []) as DeliveryNotification[]);
    } catch { /* silently fail */ }
  }, []);

  // Initial load
  useEffect(() => {
    if (user && (user.role === "delivery" || user.role === "admin" || user.role === "superadmin")) {
      fetchOrders(false);
      fetchStats();
      fetchNotifications();
    }
  }, [user, fetchOrders, fetchStats, fetchNotifications]);

  // ── Filtered lists ─────────────────────────────────────────────────────────
  const myId = user?.id ?? 0;

  // Unique countries & cities for filter selectors.
  // IMPORTANT: These must be declared BEFORE the polling useEffect (line ~300)
  // and before any useEffect that uses them in its dependency array.
  const availableCountries = useMemo(() => {
    const countries = orders
      .filter(o => o.delivered_by_user_id === null && (o.status === "Shipped" || o.status === "Arrived"))
      .map(o => o.shipping_country)
      .filter(Boolean);
    return Array.from(new Set(countries)).sort() as string[];
  }, [orders]);

  const availableCities = useMemo(() => {
    const cities = orders
      .filter(o => {
        if (o.delivered_by_user_id !== null) return false;
        if (countryFilter !== "all" && o.shipping_country?.toLowerCase() !== countryFilter.toLowerCase()) return false;
        const isLocal = isLocalDelivery(o);
        return isLocal ? (o.status === "Shipped" || o.status === "Arrived") : o.status === "Arrived";
      })
      .map(o => o.shipping_city)
      .filter(Boolean);
    return Array.from(new Set(cities)).sort() as string[];
  }, [orders, countryFilter]);

  // Auto-filter open pool to driver's registered country + city on first load.
  // Runs whenever orders load or driver profile is set.
  useEffect(() => {
    if (!user) return;
    if (user.country && availableCountries.length > 0 && countryFilter === "all") {
      const match = availableCountries.find(c => c.toLowerCase() === (user.country ?? "").toLowerCase());
      if (match) setCountryFilter(match);
    }
    if (user.city && availableCities.length > 0 && cityFilter === "all") {
      const match = availableCities.find(c => c.toLowerCase() === (user.city ?? "").toLowerCase());
      if (match) setCityFilter(match);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, availableCountries, availableCities]);

  // 30-second polling
  useEffect(() => {
    if (!user) return;
    pollingRef.current = setInterval(() => {
      if (isOnline) { fetchOrders(true); fetchStats(); fetchNotifications(); }
    }, 30000);
    secondsRef.current = setInterval(() => setSecondsSinceSync(s => s + 1), 1000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (secondsRef.current) clearInterval(secondsRef.current);
    };
  }, [user, isOnline, fetchOrders, fetchStats, fetchNotifications]);

  const myTasks = useMemo(() => {
    let list = orders.filter(o =>
      (o.status === "Shipped" || o.status === "Arrived") &&
      o.delivered_by_user_id === myId
    );
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(o =>
        o.tracking_number.toLowerCase().includes(q) ||
        (o.customer?.name ?? "").toLowerCase().includes(q) ||
        o.shipping_city.toLowerCase().includes(q) ||
        (o.notes ?? "").toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) =>
      sortOrder === "newest"
        ? new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        : new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
    );
  }, [orders, myId, searchQuery, sortOrder]);

  const openPool = useMemo(() => {
    let list = orders.filter(o => {
      if (o.delivered_by_user_id !== null) return false;

      const isLocal = isLocalDelivery(o);

      if (isLocal) {
        // Direct local delivery: show in pool when Shipped (out of warehouse) or Arrived
        return o.status === "Shipped" || o.status === "Arrived";
      } else {
        // Containerized delivery: only show once it has physically Arrived at the destination hub
        return o.status === "Arrived";
      }
    });
    if (countryFilter !== "all") list = list.filter(o => o.shipping_country?.toLowerCase() === countryFilter.toLowerCase());
    if (cityFilter !== "all") list = list.filter(o => o.shipping_city === cityFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(o =>
        o.tracking_number.toLowerCase().includes(q) ||
        (o.customer?.name ?? "").toLowerCase().includes(q) ||
        o.shipping_city.toLowerCase().includes(q) ||
        (o.notes ?? "").toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) =>
      sortOrder === "newest"
        ? new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        : new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
    );
  }, [orders, countryFilter, cityFilter, searchQuery, sortOrder]);

  const completedOrders = useMemo(() => {
    let list = orders.filter(o => o.status === "Delivered" && o.delivered_by_user_id === myId);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(o =>
        o.tracking_number.toLowerCase().includes(q) ||
        (o.customer?.name ?? "").toLowerCase().includes(q) ||
        o.shipping_city.toLowerCase().includes(q) ||
        (o.notes ?? "").toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }, [orders, myId, searchQuery]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleClaim = async (order: Order) => {
    // ── Location Mismatch Guard ──────────────────────────────────────────────
    if (order.shipping_city && user?.city &&
      order.shipping_city.toLowerCase() !== (user.city ?? "").toLowerCase()) {
      toast.error(
        `Location Mismatch: This order is destined for ${order.shipping_city}, but your profile is registered to ${user.city}. You cannot claim orders outside your registered hub.`,
        {
          duration: 5000,
          icon: "🚫",
          style: { background: "#ef4444", color: "#fff", fontWeight: "bold", fontSize: "12px", borderRadius: "10px", maxWidth: "400px" }
        }
      );
      return;
    }
    // ── Show branded custom confirmation dialog (replaces window.confirm) ─────
    setConfirmClaimOrder(order);
  };

  const handleClaimConfirmed = async () => {
    const order = confirmClaimOrder;
    if (!order) return;
    setConfirmClaimOrder(null);
    setClaimingId(order.id);
    try {
      await api.post(`/delivery/orders/${order.id}/claim`);
      toast.success(`Order ${order.tracking_number} secured! It is now assigned to you.`, {
        icon: "🔒",
        style: { background: "#0052cc", color: "#fff", fontWeight: "bold" },
      });
      await fetchOrders(true);
      await fetchStats();
      setActiveTab("mine");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to secure order";
      toast.error(msg);
    } finally {
      setClaimingId(null);
    }
  };

  const openReleaseModal = (order: Order) => {
    setReleaseModalOrder(order);
    setReleaseType("operational");
    setReleaseReason("");
    setReleaseNotes("");
  };

  const handleReleaseSubmit = async () => {
    if (!releaseModalOrder) return;
    if (releaseType === "failure" && !releaseReason) {
      toast.error("Please select a failure reason");
      return;
    }

    setReleasingId(releaseModalOrder.id);
    try {
      const res = await api.post(`/delivery/orders/${releaseModalOrder.id}/release`, {
        release_type: releaseType,
        reason: releaseType === "failure" ? releaseReason : null,
        notes: releaseNotes || null,
      });

      toast.success(res.data.message || `Order ${releaseModalOrder.tracking_number} released back to the pool.`);
      setReleaseModalOrder(null);
      await fetchOrders(true);
      await fetchStats();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to release order";
      toast.error(msg);
    } finally {
      setReleasingId(null);
    }
  };

  const handleMarkArrived = async (order: Order) => {
    setMarkingId(order.id);
    try {
      await api.post(API_ENDPOINTS.delivery.markArrived(order.id));
      toast.success(`Order ${order.tracking_number} marked as Arrived!`, {
        icon: "📍",
        style: { background: "#10b981", color: "#fff", fontWeight: "bold" },
      });
      await fetchOrders(true);
      await fetchStats();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to mark as arrived";
      toast.error(msg);
    } finally {
      setMarkingId(null);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Limit dimensions to max 800px width/height to keep size small (~100KB)
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          // Convert to jpeg with 70% quality compression
          const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);
          setPhotoBase64(compressedBase64);
          toast.success("Doorstep photo captured and optimized successfully!");
        } else {
          // Fallback if canvas context is not supported
          setPhotoBase64(event.target?.result as string);
          toast.success("Doorstep photo captured!");
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };



  // PIN flow
  const openPinDialog = (order: Order) => {
    setPinOrder(order);
    setPinValue("");
    setPinVerified(false);
    setPinError("");
    setPhotoBase64(null);
    setShowPinDialog(true);
  };

  const handleVerifyPin = async () => {
    if (!pinOrder || pinValue.length !== 4) { setPinError("Enter the 4-digit PIN from the customer's portal"); return; }
    setPinLoading(true);
    setPinError("");
    try {
      const res = await api.post(`/delivery/orders/${pinOrder.id}/verify-pin`, { pin: pinValue });
      setPinVerified(true);
      toast.success(res.data.message || "PIN verified! You may now capture the signature.");
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { message?: string, pin_locked?: boolean } } })?.response?.data;
      const msg = data?.message ?? "Incorrect PIN";
      setPinError(msg);
      if (data?.pin_locked) {
        toast.error("🔒 Security Lock: This order is locked. Please contact your supervisor.");
      }
    } finally {
      setPinLoading(false);
    }
  };

  const openSignatureModal = () => {
    if (!pinOrder) return;
    setSignatureOrder(pinOrder);
    setShowPinDialog(false);
    setPinOrder(null);
    setStrokeCount(0);
    setTimeout(() => {
      setShowSignatureModal(true);
      initCanvas();
    }, 150);
  };

  // Canvas helpers
  const initCanvas = () => {
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#1e293b";
      setStrokeCount(0);
    }, 80);
  };

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    moveDraw(e);
  };
  const stopDraw = () => {
    setIsDrawing(false);
    canvasRef.current?.getContext("2d")?.beginPath();
  };
  const moveDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    let cx: number, cy: number;
    if ("touches" in e) {
      if (e.cancelable) e.preventDefault();
      cx = e.touches[0].clientX - rect.left;
      cy = e.touches[0].clientY - rect.top;
    } else {
      cx = e.clientX - rect.left;
      cy = e.clientY - rect.top;
    }
    ctx.lineTo(cx, cy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    setStrokeCount(prev => prev + 1);
  };
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setStrokeCount(0);
  };

  const handleDeliver = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !signatureOrder) return;
    // Check canvas is not blank
    const blank = document.createElement("canvas");
    blank.width = canvas.width; blank.height = canvas.height;
    if (canvas.toDataURL() === blank.toDataURL()) {
      toast.error("Please capture the recipient's signature first");
      return;
    }

    // SECURITY: Minimum stroke length verification
    if (strokeCount < 20) {
      toast.error("Signature too short. Please ask the recipient to sign properly.");
      return;
    }

    setSubmittingSignature(true);
    try {
      await api.post(API_ENDPOINTS.delivery.deliver(signatureOrder.id), {
        signature: canvas.toDataURL("image/png"),
        delivery_lat: null,
        delivery_lng: null,
        delivery_photo: photoBase64 || null,
        manifest_acknowledged: true,
      });
      toast.success(`Order ${signatureOrder.tracking_number} delivered successfully!`, {
        icon: "📦",
        style: { background: "#10b981", color: "#fff", fontWeight: "bold" },
      });
      setShowSignatureModal(false);
      setSignatureOrder(null);
      setPhotoBase64(null);
      await fetchOrders(true);
      await fetchStats();
      setActiveTab("completed");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to complete delivery";
      toast.error(msg);
    } finally {
      setSubmittingSignature(false);
    }
  };

  // Log Failed Attempt Handler
  const openFailedAttemptModal = (order: Order) => {
    setFailedAttemptOrder(order);
    setFailedReason("");
    setFailedNotes("");
    setFailedLoading(false);
    setShowFailedModal(true);
  };

  const handleFailedAttempt = async () => {
    if (!failedAttemptOrder || !failedReason) {
      toast.error("Please select a failure reason");
      return;
    }
    setFailedLoading(true);
    try {
      const res = await api.post(`/delivery/orders/${failedAttemptOrder.id}/log-failed-attempt`, {
        reason: failedReason,
        notes: failedNotes,
        lat: null,
        lng: null,
      });
      toast.success(res.data.message || "Failed delivery attempt logged successfully.", { icon: "📝" });
      setShowFailedModal(false);
      setFailedAttemptOrder(null);
      setFailedReason("");
      setFailedNotes("");
      await fetchOrders(true);
    } catch (err: any) {
      const msg = err.response?.data?.message ?? "Failed to log attempt";
      toast.error(msg);
    } finally {
      setFailedLoading(false);
    }
  };

  // ── Loading screen ─────────────────────────────────────────────────────────
  if (authLoading || !user) {
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

  const initials = (user.name ?? "?").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
  const isDriver = user.role === "delivery";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f0f4f8] flex flex-col font-sans text-slate-900">

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header className="bg-[#0052cc] sticky top-0 z-30 shadow-lg">
        <div className="container mx-auto px-4 max-w-xl h-16 flex items-center justify-between">
          <button onClick={() => setShowProfile(true)} className="flex items-center gap-3 group">
            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center text-white font-black text-sm border border-white/30 group-hover:bg-white/30 transition-colors">
              {initials}
            </div>
            <div className="text-left">
              <p className="text-[10px] font-bold text-blue-200 uppercase tracking-widest leading-none">Delivery Hub</p>
              <p className="text-sm font-black text-white truncate max-w-[160px] leading-tight">
                {user.name}
                {(user as { vehicle_plate?: string }).vehicle_plate
                  ? <span className="text-blue-200 font-bold"> | {(user as { vehicle_plate?: string }).vehicle_plate}</span>
                  : ""}
              </p>
            </div>
          </button>

          <div className="flex items-center gap-2">
            {/* Sync indicator */}
            <div className="hidden sm:flex items-center gap-1.5 bg-white/10 rounded-lg px-2 py-1.5">
              {isSyncing ? (
                <RefreshCw className="h-3 w-3 text-blue-200 animate-spin" />
              ) : isOnline ? (
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              ) : (
                <WifiOff className="h-3 w-3 text-red-300" />
              )}
              <span className="text-[9px] font-bold text-blue-200 uppercase tracking-wide">
                {isSyncing ? "Syncing..." : `${secondsSinceSync}s ago`}
              </span>
            </div>

            <button
              onClick={() => { setShowNotifications(true); setNotifUnread(0); localStorage.setItem("delivery_notif_seen", Date.now().toString()); }}
              className="relative h-9 w-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-white"
            >
              <Bell className="h-4 w-4" />
              {notifUnread > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center border border-[#0052cc]">
                  {notifUnread > 9 ? "9+" : notifUnread}
                </span>
              )}
            </button>

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

      {/* ── STATS BAR ──────────────────────────────────────────────────────── */}
      <div className="bg-[#003d99] border-b border-[#004bbf]">
        <div className="container mx-auto px-4 max-w-xl py-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col items-center gap-0.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              <p className="text-xl font-black text-emerald-300">{stats.today_completed}</p>
              <p className="text-[8px] font-bold text-blue-300 uppercase tracking-wider">Today</p>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <Package className={`h-4 w-4 ${myTasks.length >= 5 ? "text-rose-400" : "text-amber-300"}`} />
              <p className={`text-xl font-black ${myTasks.length >= 5 ? "text-rose-400 font-extrabold animate-pulse" : "text-amber-300"}`}>
                {myTasks.length} / 5
              </p>
              <p className="text-[8px] font-bold text-blue-300 uppercase tracking-wider">My Active (Cap)</p>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <TrendingUp className="h-4 w-4 text-blue-200" />
              <p className="text-xl font-black text-blue-200">{stats.total_delivered}</p>
              <p className="text-[8px] font-bold text-blue-300 uppercase tracking-wider">Total Done</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN ───────────────────────────────────────────────────────────── */}
      <main className="flex-1 container mx-auto px-4 max-w-xl pt-4 pb-20">

        {/* 3-Tab Navigation */}
        <div className="bg-white p-1 rounded-xl border border-zinc-200 shadow-sm flex mb-4">
          {([
            { key: "pool", label: "Open Pool", icon: Package, count: openPool.length },
            { key: "mine", label: "My Tasks", icon: Truck, count: myTasks.length },
            { key: "completed", label: "Completed", icon: CheckCircle2, count: completedOrders.length },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 ${activeTab === tab.key ? "bg-[#0052cc] text-white shadow-sm" : "text-zinc-500 hover:text-slate-800"
                }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
              {tab.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${activeTab === tab.key ? "bg-white text-[#0052cc]" : "bg-zinc-100 text-zinc-600"
                  }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search row */}
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input
              placeholder="Search order reference, customer, city..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-10 bg-white border-zinc-200 text-sm rounded-xl shadow-sm"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {activeTab === "pool" && (
            <button
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className={`h-10 w-10 flex items-center justify-center rounded-xl border shadow-sm transition-all shrink-0 ${showFilterPanel ? "bg-[#0052cc] text-white border-[#0052cc]" : "bg-white border-zinc-200 text-zinc-600"
                }`}
            >
              <Filter className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => { fetchOrders(false); fetchStats(); fetchNotifications(); }}
            disabled={isSyncing}
            className="h-10 w-10 flex items-center justify-center rounded-xl bg-white border border-zinc-200 text-zinc-600 shadow-sm shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin text-[#0052cc]" : ""}`} />
          </button>
        </div>

        {/* ── List Content ────────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="h-14 w-14 rounded-full bg-[#0052cc]/10 flex items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-[#0052cc]" />
            </div>
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Loading manifests...</p>
          </div>
        ) : (
          <div className="space-y-4">

            {/* ── OPEN POOL TAB ─────────────────────────────────────────── */}
            {activeTab === "pool" && (
              openPool.length === 0 ? (
                <EmptyState
                  icon={Package}
                  title="No Open Orders"
                  message={cityFilter !== "all" ? `No orders available in ${cityFilter}. Try another city.` : "All orders have been claimed. Check back shortly."}
                  action={cityFilter !== "all" ? { label: "Show All Cities", onClick: () => setCityFilter("all") } : undefined}
                />
              ) : (
                openPool.map(order => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    myId={myId}
                    tab="pool"
                    currency={currency}
                    isClaimLoading={claimingId === order.id}
                    isReleaseLoading={false}
                    isMarkLoading={false}
                    allOrders={orders}
                    manifestChecked={manifestChecked}
                    onManifestCheckToggle={(orderId, checked) => setManifestChecked(prev => ({ ...prev, [orderId]: checked }))}
                    onClaim={() => handleClaim(order)}
                    onRelease={() => { }}
                    onMarkArrived={() => { }}
                    onDeliver={() => openPinDialog(order)}
                    onLogFailedAttempt={() => { }}
                  />
                ))
              )
            )}

            {/* ── MY TASKS TAB ──────────────────────────────────────────── */}
            {activeTab === "mine" && (
              myTasks.length === 0 ? (
                <EmptyState
                  icon={Truck}
                  title="No Active Tasks"
                  message="You have no claimed orders. Go to Open Pool to secure a delivery."
                  action={{ label: "View Open Pool", onClick: () => setActiveTab("pool") }}
                />
              ) : (
                myTasks.map(order => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    myId={myId}
                    tab="mine"
                    currency={currency}
                    isClaimLoading={false}
                    isReleaseLoading={releasingId === order.id}
                    isMarkLoading={markingId === order.id}
                    allOrders={orders}
                    manifestChecked={manifestChecked}
                    onManifestCheckToggle={(orderId, checked) => setManifestChecked(prev => ({ ...prev, [orderId]: checked }))}
                    onClaim={() => { }}
                    onRelease={() => openReleaseModal(order)}
                    onMarkArrived={() => handleMarkArrived(order)}
                    onDeliver={() => openPinDialog(order)}
                    onLogFailedAttempt={() => openFailedAttemptModal(order)}
                  />
                ))
              )
            )}

            {/* ── COMPLETED TAB ─────────────────────────────────────────── */}
            {activeTab === "completed" && (
              <>

                {completedOrders.length === 0 ? (
                  <EmptyState
                    icon={CheckCircle2}
                    title="No Completed Deliveries"
                    message="Your completed deliveries will appear here once you finish your first handover."
                  />
                ) : (
                  completedOrders.map(order => (
                    <CompletedCard key={order.id} order={order} currency={currency} />
                  ))
                )}
              </>
            )}
          </div>
        )}
      </main>

      {/* ── PROFILE DRAWER ─────────────────────────────────────────────────── */}
      <Drawer show={showProfile} side="left" onClose={() => setShowProfile(false)}>
        <div className="bg-[#0052cc] p-6 pb-8">
          <div className="flex items-center justify-between mb-6">
            <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest">Driver Profile</p>
            <button onClick={() => setShowProfile(false)} className="h-7 w-7 rounded-full bg-white/20 flex items-center justify-center text-white">
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
        <div className="flex-1 p-5 space-y-3 overflow-y-auto">
          {([
            { label: "Email", value: user.email, icon: User },
            { label: "Vehicle Plate", value: (user as { vehicle_plate?: string }).vehicle_plate ?? "Not set", icon: Truck },
            { label: "License", value: (user as { license_number?: string }).license_number ?? "Not set", icon: Shield },
            { label: "Role", value: "Delivery Driver", icon: BarChart3 },
          ] as const).map(item => (
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
          <div className="grid grid-cols-2 gap-2 pt-2">
            <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-emerald-600">{stats.total_delivered}</p>
              <p className="text-[9px] font-bold text-zinc-400 uppercase">Total Delivered</p>
            </div>
            <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-[#0052cc]">{stats.today_completed}</p>
              <p className="text-[9px] font-bold text-zinc-400 uppercase">Today</p>
            </div>
          </div>
        </div>
        <div className="p-5 border-t border-zinc-100">
          <button
            onClick={() => { setShowProfile(false); logout(); }}
            className="w-full flex items-center justify-center gap-2 h-12 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 font-black text-sm border border-red-100"
          >
            <LogOut className="h-4 w-4" /> Sign Out
          </button>
        </div>
      </Drawer>

      {/* ── NOTIFICATIONS DRAWER ───────────────────────────────────────────── */}
      <Drawer show={showNotifications} side="right" onClose={() => setShowNotifications(false)}>
        <div className="bg-[#0052cc] p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest">Notifications</p>
              <h2 className="text-lg font-black text-white">Recent Assignments</h2>
            </div>
            <button onClick={() => setShowNotifications(false)} className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <Bell className="h-10 w-10 text-zinc-200" />
              <p className="text-sm font-bold text-zinc-400">No recent assignments</p>
            </div>
          ) : notifications.map(n => (
            <div key={n.id} className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-100 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-black text-slate-800">{n.tracking_number}</p>
                  <p className="text-[10px] text-zinc-400">{n.assigned_ago}</p>
                </div>
                <span className="text-[8px] font-black uppercase bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full shrink-0">{n.status}</span>
              </div>
              <div className="text-[11px] text-zinc-600 space-y-1">
                <div className="flex items-center gap-1.5"><User className="h-3 w-3 text-zinc-400" /><span className="font-bold">{n.customer_name}</span></div>
                <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3 text-zinc-400" /><span>{n.shipping_city}</span></div>
                <div className="flex items-center gap-1.5"><Package className="h-3 w-3 text-zinc-400" /><span>{n.item_count} item{n.item_count !== 1 ? "s" : ""}</span></div>
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-zinc-100">
          <p className="text-[9px] text-center text-zinc-400 font-bold uppercase tracking-widest">Refreshes every 30 seconds</p>
        </div>
      </Drawer>



      {/* ── PIN VERIFICATION DIALOG ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showPinDialog && pinOrder && (
          <Modal onClose={() => { setShowPinDialog(false); setPinOrder(null); }}>
            <div className="p-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
              <div className="text-left">
                <h2 className="text-base font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                  <Key className="h-4 w-4 text-amber-500" /> PIN Verification
                </h2>
                <p className="text-[10px] font-bold text-[#64748b] mt-0.5">Order Reference: {pinOrder.tracking_number}</p>
              </div>
              <button onClick={() => { setShowPinDialog(false); setPinOrder(null); }} className="h-8 w-8 rounded-full bg-zinc-200 flex items-center justify-center text-zinc-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-left">
                <p className="text-[11px] font-bold text-amber-700 flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  Ask the customer for the 4-digit verification PIN displayed on their customer account portal to secure this delivery.
                </p>
              </div>
              <div className="space-y-2 text-left">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">Customer's Verification PIN *</label>
                <Input
                  type="number"
                  maxLength={4}
                  placeholder="Enter 4-digit PIN"
                  value={pinValue}
                  onChange={e => { setPinValue(e.target.value.slice(0, 4)); setPinError(""); }}
                  className="h-12 text-center text-2xl font-black tracking-[0.5em] border-zinc-200 rounded-xl"
                  disabled={pinVerified}
                />
                {pinError && (
                  <p className="text-xs font-bold text-red-500 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" /> {pinError}
                  </p>
                )}
                {pinVerified && (
                  <p className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5" /> PIN verified successfully!
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => { setShowPinDialog(false); setPinOrder(null); }}
                  className="flex-1 font-bold rounded-xl h-11 text-xs"
                >
                  Cancel
                </Button>
                {!pinVerified ? (
                  <Button
                    onClick={handleVerifyPin}
                    disabled={pinLoading || pinValue.length !== 4}
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-black uppercase text-[11px] tracking-wider h-11 rounded-xl"
                  >
                    {pinLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
                    Verify PIN
                  </Button>
                ) : (
                  <Button
                    onClick={openSignatureModal}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[11px] tracking-wider h-11 rounded-xl"
                  >
                    <Shield className="h-4 w-4 mr-2" /> Capture Signature
                  </Button>
                )}
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* ── SIGNATURE MODAL ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showSignatureModal && signatureOrder && (
          <Modal onClose={() => { setShowSignatureModal(false); setSignatureOrder(null); }}>
            <div className="p-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
              <div className="text-left">
                <h2 className="text-base font-black text-slate-800 uppercase tracking-tight">Proof of Delivery</h2>
                <p className="text-[10px] font-bold text-zinc-500 mt-0.5">Order Reference: {signatureOrder.tracking_number}</p>
                <p className="text-[10px] text-zinc-400">Recipient: {signatureOrder.customer?.name}</p>
              </div>
              <button
                onClick={() => { setShowSignatureModal(false); setSignatureOrder(null); }}
                className="h-8 w-8 rounded-full bg-zinc-200 flex items-center justify-center text-zinc-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-left">
              {/* Recipient Signature pad */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">
                  Recipient Signature *
                </label>
                <div className="border-2 border-dashed border-zinc-300 rounded-xl overflow-hidden bg-white relative h-44">
                  <p className="absolute inset-0 flex items-center justify-center text-zinc-200 text-xs font-bold pointer-events-none select-none">Sign here</p>
                  <canvas
                    ref={canvasRef}
                    width={400}
                    height={180}
                    className="w-full h-full touch-none cursor-crosshair relative z-10 bg-transparent"
                    onMouseDown={startDraw}
                    onMouseUp={stopDraw}
                    onMouseLeave={stopDraw}
                    onMouseMove={moveDraw}
                    onTouchStart={startDraw}
                    onTouchEnd={stopDraw}
                    onTouchMove={moveDraw}
                  />
                </div>
                <p className="text-[9px] text-zinc-400 font-medium">⚠️ Recipient confirms receipt in good condition.</p>
              </div>

              {/* Doorstep Photo attachment option */}
              <div className="space-y-2 pt-2 border-t border-zinc-100">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">
                  Doorstep / Package Photo (Optional)
                </label>

                {photoBase64 ? (
                  <div className="relative rounded-xl overflow-hidden border border-zinc-200 bg-zinc-50 h-44 flex items-center justify-center">
                    <img src={photoBase64} alt="Doorstep delivery proof" className="h-full w-full object-cover" />
                    <button
                      onClick={() => setPhotoBase64(null)}
                      className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1.5 shadow hover:bg-red-700 transition-colors"
                      title="Remove Photo"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-300 rounded-xl p-4 bg-zinc-50 cursor-pointer hover:bg-zinc-100/50 transition-colors text-center">
                    <span className="text-[11px] font-bold text-zinc-500">📸 Take doorstep picture with camera</span>
                    <span className="text-[9px] text-zinc-400 mt-1">Accepts images from environment camera</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>


              {/* Action buttons */}
              <div className="flex gap-3 pt-2">
                <Button onClick={clearCanvas} variant="outline" disabled={submittingSignature} className="flex-1 font-bold rounded-xl h-11 text-xs">
                  Clear Pad
                </Button>
                <Button
                  onClick={handleDeliver}
                  disabled={submittingSignature}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[11px] tracking-wider h-11 rounded-xl"
                >
                  {submittingSignature && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Confirm Handover
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* ── FAILED ATTEMPT MODAL ────────────────────────────────────────────── */}
      <AnimatePresence>
        {showFailedModal && failedAttemptOrder && (
          <Modal onClose={() => { setShowFailedModal(false); setFailedAttemptOrder(null); }}>
            <div className="p-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
              <div className="text-left">
                <h2 className="text-base font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-500" /> Log Delivery Failure
                </h2>
                <p className="text-[10px] font-bold text-zinc-500 mt-0.5">Order Reference: {failedAttemptOrder.tracking_number}</p>
              </div>
              <button
                onClick={() => { setShowFailedModal(false); setFailedAttemptOrder(null); }}
                className="h-8 w-8 rounded-full bg-zinc-200 flex items-center justify-center text-zinc-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-left">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">Reason for Failure *</label>
                <select
                  value={failedReason}
                  onChange={e => setFailedReason(e.target.value)}
                  className="w-full h-11 border border-zinc-200 rounded-xl px-3 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0052cc]"
                >
                  <option value="">-- Select a Reason --</option>
                  <option value="Customer Not Available">Customer Not Available</option>
                  <option value="Wrong Address Provided">Wrong Address Provided</option>
                  <option value="Customer Refused Delivery">Customer Refused Delivery</option>
                  <option value="Package Damaged">Package Damaged</option>
                  <option value="Access Denied">Access Denied</option>
                  <option value="Other">Other (Specify in notes)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">Additional Notes / Context</label>
                <textarea
                  value={failedNotes}
                  onChange={e => setFailedNotes(e.target.value)}
                  placeholder="Provide any helpful instructions or explanation..."
                  className="w-full h-24 border border-zinc-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0052cc] resize-none"
                />
              </div>


              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => { setShowFailedModal(false); setFailedAttemptOrder(null); }}
                  className="flex-1 font-bold rounded-xl h-11 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleFailedAttempt}
                  disabled={failedLoading || !failedReason}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[11px] tracking-wider h-11 rounded-xl"
                >
                  {failedLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Submit Failure Log
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* ── UNIFIED RELEASE MODAL ────────────────────────────────────────── */}
      <AnimatePresence>
        {releaseModalOrder && (
          <Modal onClose={() => setReleaseModalOrder(null)}>
            <div className="p-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
              <div className="text-left">
                <h2 className="text-base font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                  <ArrowRightLeft className="h-4 w-4 text-zinc-600" /> Release Claimed Order
                </h2>
                <p className="text-[10px] font-bold text-zinc-500 mt-0.5">Order Reference: {releaseModalOrder.tracking_number}</p>
              </div>
              <button
                onClick={() => setReleaseModalOrder(null)}
                className="h-8 w-8 rounded-full bg-zinc-200 flex items-center justify-center text-zinc-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-left">
              {/* Type Select buttons */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">Reason Category *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => { setReleaseType("operational"); setReleaseReason(""); }}
                    className={cn(
                      "py-2.5 px-3 rounded-xl border text-xs font-bold transition-all duration-200",
                      releaseType === "operational"
                        ? "bg-zinc-100 border-zinc-300 text-zinc-900 shadow-sm"
                        : "bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-50"
                    )}
                  >
                    🛠️ Operational Reason
                  </button>
                  <button
                    onClick={() => setReleaseType("failure")}
                    className={cn(
                      "py-2.5 px-3 rounded-xl border text-xs font-bold transition-all duration-200",
                      releaseType === "failure"
                        ? "bg-amber-50 border-amber-300 text-amber-900 shadow-sm"
                        : "bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-50"
                    )}
                  >
                    ⚠️ Delivery Failed First
                  </button>
                </div>
              </div>

              {/* Dropdown if releaseType is failure */}
              {releaseType === "failure" && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">Failure Reason *</label>
                  <select
                    value={releaseReason}
                    onChange={e => setReleaseReason(e.target.value)}
                    className="w-full h-11 border border-zinc-200 rounded-xl px-3 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0052cc]"
                  >
                    <option value="">-- Select a Failure Reason --</option>
                    <option value="Customer Not Available">Customer Not Available</option>
                    <option value="Wrong Address Provided">Wrong Address Provided</option>
                    <option value="Customer Refused Delivery">Customer Refused Delivery</option>
                    <option value="Package Damaged">Package Damaged</option>
                    <option value="Access Denied">Access Denied</option>
                    <option value="Other">Other (Specify in notes)</option>
                  </select>
                </div>
              )}

              {/* Notes */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">
                  {releaseType === "failure" ? "Failure Notes & Release Explanation *" : "Operational Notes / Reason"}
                </label>
                <textarea
                  value={releaseNotes}
                  onChange={e => setReleaseNotes(e.target.value)}
                  placeholder={releaseType === "failure" ? "Please detail why the delivery failed before releasing..." : "Flat tire, ran out of time, end of shift..."}
                  className="w-full h-24 border border-zinc-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0052cc] resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setReleaseModalOrder(null)}
                  className="flex-1 font-bold rounded-xl h-11 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleReleaseSubmit}
                  disabled={releasingId !== null || (releaseType === "failure" && (!releaseReason || !releaseNotes))}
                  className="flex-1 bg-zinc-950 hover:bg-zinc-800 text-white font-black uppercase text-[11px] tracking-wider h-11 rounded-xl"
                >
                  {releasingId !== null && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Confirm Release
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* ── CUSTOM SECURE ORDER CONFIRMATION DIALOG ── */}
      <AnimatePresence>
        {confirmClaimOrder && (
          <Modal onClose={() => setConfirmClaimOrder(null)}>
            <div className="p-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
              <div className="text-left">
                <h2 className="text-base font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                  <Shield className="h-5 w-5 text-[#0052cc]" /> Confirm Secure Order
                </h2>
                <p className="text-[10px] font-bold text-zinc-500 mt-0.5">Order Ref: {confirmClaimOrder.tracking_number}</p>
              </div>
              <button
                onClick={() => setConfirmClaimOrder(null)}
                className="h-8 w-8 rounded-full bg-zinc-200 flex items-center justify-center text-zinc-650 hover:bg-zinc-300 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-left">
              <p className="text-xs font-bold text-zinc-600 leading-relaxed">
                Are you sure you want to secure and claim this order for delivery? Once secured, you must deliver it within the 4-hour SLA window to prevent account strikes.
              </p>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setConfirmClaimOrder(null)}
                  className="flex-1 font-bold rounded-xl h-11 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleClaimConfirmed}
                  className="flex-1 bg-[#0052cc] hover:bg-[#003d99] text-white font-black uppercase text-[11px] tracking-wider h-11 rounded-xl"
                >
                  Yes, Secure Order
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function Drawer({ show, side, onClose, children }: {
  show: boolean;
  side: "left" | "right";
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {show && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: side === "left" ? "-100%" : "100%" }}
            animate={{ x: 0 }}
            exit={{ x: side === "left" ? "-100%" : "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed top-0 bottom-0 w-80 bg-white z-50 shadow-2xl flex flex-col"
            style={{ [side]: 0 }}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

function EmptyState({ icon: Icon, title, message, action }: {
  icon: React.ElementType;
  title: string;
  message: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="bg-white border-2 border-dashed border-zinc-200 rounded-2xl p-12 text-center flex flex-col items-center gap-3">
      <div className="h-14 w-14 rounded-full bg-zinc-50 flex items-center justify-center">
        <Icon className="h-7 w-7 text-zinc-300" />
      </div>
      <h3 className="font-black text-slate-700">{title}</h3>
      <p className="text-xs text-zinc-400 max-w-[240px] leading-relaxed">{message}</p>
      {action && (
        <button onClick={action.onClick} className="text-xs font-black text-[#0052cc] underline mt-1">{action.label}</button>
      )}
    </div>
  );
}

function SlaTimer({ order }: { order: Order }) {
  const [timeLeft, setTimeLeft] = useState("");
  const [color, setColor] = useState("text-zinc-500");

  useEffect(() => {
    // If the driver has arrived at the customer's doorstep (local) or is out for delivery (shipment), stop the timer
    if (order.status === "Arrived") {
      const local = isLocalDelivery(order);
      setTimeLeft(local ? "At Customer Doorstep 📍" : "At Destination Hub 📦");
      setColor("text-emerald-600 font-black");
      return;
    }

    const updateTimer = () => {
      const claimTime = new Date(order.updated_at).getTime();
      const breachTime = claimTime + 4 * 60 * 60 * 1000;
      const diff = breachTime - Date.now();

      if (diff <= 0) {
        setTimeLeft("SLA BREACHED ⚠️ (Auto-released + Strike Marked)");
        setColor("text-red-600 font-black animate-pulse");
        return;
      }

      const hrs = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);

      setTimeLeft(`${hrs}h ${mins}m ${secs}s left`);
      if (diff < 1800000) {
        setColor("text-rose-500 font-black animate-pulse");
      } else {
        setColor("text-amber-500 font-bold");
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [order.status, order.updated_at]);

  return <span className={`text-xs font-bold ${color}`}>{timeLeft}</span>;
}

function formatWhatsAppNumber(phone: string): string {
  const clean = phone.replace(/[^0-9]/g, "");
  if (/^254\d{9}$/.test(clean)) {
    return clean;
  }
  if (/^0\d{9}$/.test(clean)) {
    return "254" + clean.substring(1);
  }
  if (/^\d{9}$/.test(clean)) {
    return "254" + clean;
  }
  if (clean.startsWith("0")) {
    return "254" + clean.substring(1);
  }
  return clean;
}

function OrderCard({
  order,
  myId,
  tab,
  currency,
  isClaimLoading,
  isReleaseLoading,
  isMarkLoading,
  allOrders,
  manifestChecked,
  onManifestCheckToggle,
  onClaim,
  onRelease,
  onMarkArrived,
  onDeliver,
  onLogFailedAttempt
}: {
  order: Order;
  myId: number;
  tab: "pool" | "mine";
  currency: string;
  isClaimLoading: boolean;
  isReleaseLoading: boolean;
  isMarkLoading: boolean;
  allOrders: Order[];
  manifestChecked: { [orderId: number]: boolean };
  onManifestCheckToggle: (orderId: number, checked: boolean) => void;
  onClaim: () => void;
  onRelease: () => void;
  onMarkArrived: () => void;
  onDeliver: () => void;
  onLogFailedAttempt: () => void;
}) {
  const badge = getStatusBadge(order, myId);

  // Check duplicate destinations locally (non-blocking warning banner with driver details)
  const duplicateOrders = useMemo(() => {
    if (tab !== "pool" || !order.shipping_address || !order.shipping_city) return [];
    return allOrders.filter(o =>
      o.id !== order.id &&
      o.shipping_address === order.shipping_address &&
      o.shipping_city === order.shipping_city &&
      o.delivered_by_user_id !== null &&
      o.driver &&
      (o.status === "Shipped" || o.status === "Arrived")
    );
  }, [order, allOrders, tab]);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <Card className="border-zinc-200 bg-white shadow-sm rounded-2xl overflow-hidden">
        {/* Anti-theft warning if duplicate address */}
        {duplicateOrders.length > 0 && (
          <div className="bg-amber-50 border-b border-amber-100 px-4 py-3 text-left space-y-1.5">
            <p className="text-[10px] font-black text-amber-800 flex items-center gap-1.5 leading-snug uppercase tracking-wider">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 animate-pulse" />
              <span>Duplicate Destination Warning</span>
            </p>
            <p className="text-[11px] font-bold text-amber-700 leading-tight">
              Another driver has secured an order for this exact address. Coordinate to avoid wrong delivery:
            </p>
            <div className="mt-2 space-y-1.5">
              {duplicateOrders.map(o => (
                <div key={o.id} className="flex items-center justify-between bg-white p-2 rounded-xl border border-amber-100 shadow-sm gap-2">
                  <div className="min-w-0">
                    <p className="font-extrabold text-slate-800 text-xs truncate">{o.driver?.name}</p>
                    <p className="text-[10px] text-zinc-500 font-bold">Order: {o.tracking_number}</p>
                  </div>
                  {o.driver?.phone && (
                    <a
                      href={`tel:${o.driver.phone}`}
                      className="text-[10px] font-black text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors shrink-0"
                    >
                      📞 Call Driver
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Header */}
        <CardHeader className="p-4 bg-zinc-50/80 border-b border-zinc-100 flex flex-row items-start justify-between gap-2">
          <div className="text-left">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Order Reference</span>
            <CardTitle className="text-base font-black text-slate-800 tracking-wider leading-tight">{order.tracking_number}</CardTitle>
            <p className="text-[10px] text-slate-500 mt-0.5 font-semibold">
              {new Date(order.updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          </div>
          <Badge className={`rounded-full px-2.5 py-1 text-[9px] font-black tracking-wider border-none uppercase shrink-0 flex items-center gap-1 ${badge.bg}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${badge.dot} inline-block`} />
            {badge.label}
          </Badge>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          {/* SLA countdown timer inside task detail if assigned */}
          {order.delivered_by_user_id === myId && (
            <div className="bg-zinc-50 border border-zinc-100 rounded-xl px-3 py-2 flex items-center justify-between">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">SLA Release Timer</span>
              <SlaTimer order={order} />
            </div>
          )}

          {/* Customer info */}
          {(() => {
            const recipient = parseRecipientNotes(order.notes ?? null);
            const isWalkIn = !!recipient;
            const displayName   = isWalkIn ? recipient!.name  : (order.customer?.name  ?? "Retail Customer");
            const displayPhone  = isWalkIn ? recipient!.phone : (order.customer?.phone ?? "");
            const displayEmail  = isWalkIn ? recipient!.email : (order.customer?.email ?? "");

            return (
              <div className="space-y-2.5 text-left">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-zinc-100 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-zinc-400" />
                  </div>
                  <div>
                    <p className="font-black text-slate-800 text-[13px]">{displayName}</p>
                    {displayEmail && <p className="text-[10px] text-zinc-400">{displayEmail}</p>}
                    {isWalkIn && (
                      <span className="inline-block mt-0.5 text-[9px] font-bold bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded border border-amber-200">WALK-IN</span>
                    )}
                  </div>
                </div>

                {displayPhone && (
                  <div className="flex gap-2">
                    <a href={`tel:${displayPhone}`}
                      className="flex items-center gap-2.5 p-2.5 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors group flex-1">
                      <div className="h-7 w-7 rounded-full bg-[#0052cc] flex items-center justify-center shrink-0">
                        <Phone className="h-3.5 w-3.5 text-white" />
                      </div>
                      <span className="font-black text-[#0052cc] text-xs group-hover:underline truncate">{displayPhone}</span>
                    </a>
                    <a href={`https://wa.me/${formatWhatsAppNumber(displayPhone)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 p-2.5 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition-colors group px-3.5">
                      <div className="h-7 w-7 rounded-full bg-emerald-600 flex items-center justify-center shrink-0">
                        <span className="text-white font-extrabold text-xs">WA</span>
                      </div>
                      <span className="font-black text-emerald-600 text-xs group-hover:underline">Chat</span>
                    </a>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <div className="h-7 w-7 rounded-full bg-rose-50 flex items-center justify-center shrink-0 mt-0.5">
                    <MapPin className="h-3.5 w-3.5 text-rose-500" />
                  </div>
                  <div>
                    <p className="font-black text-slate-800 text-sm">{order.shipping_city}{order.shipping_country ? `, ${order.shipping_country}` : ""}</p>
                    {order.shipping_address && (
                      <p className="font-bold text-slate-700 text-xs leading-snug mt-0.5">{order.shipping_address}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

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

          {/* Package Count Verification acknowledgement (Required) */}
          {tab === "mine" && (
            <div className="flex items-center gap-2.5 p-2.5 bg-zinc-50 border border-zinc-150 rounded-xl text-left">
              <input
                type="checkbox"
                id={`manifest-check-${order.id}`}
                checked={!!manifestChecked[order.id]}
                onChange={e => onManifestCheckToggle(order.id, e.target.checked)}
                className="h-4.5 w-4.5 rounded border-zinc-300 text-[#0052cc] focus:ring-[#0052cc] cursor-pointer"
              />
              <label htmlFor={`manifest-check-${order.id}`} className="text-[11px] font-bold text-slate-700 cursor-pointer select-none leading-tight">
                I verify that the physical package count matches this manifest *
              </label>
            </div>
          )}

          {/* Grand Total */}
          <div className="flex items-center justify-between bg-[#0052cc]/5 rounded-xl px-3 py-2.5 border border-[#0052cc]/10">
            <span className="text-[10px] font-bold text-[#0052cc] uppercase tracking-widest">Grand Total</span>
            <span className="font-black text-[#0052cc] text-base">{currency} {Number(order.total_amount).toLocaleString()}</span>
          </div>

          {/* Action buttons */}
          <div className="space-y-2 pt-1">
            {tab === "pool" && (
              <Button
                onClick={onClaim}
                disabled={isClaimLoading}
                className="w-full bg-[#0052cc] hover:bg-[#003d99] text-white font-black uppercase text-[11px] tracking-wider h-11 rounded-xl"
              >
                {isClaimLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
                Secure This Order
              </Button>
            )}

            {tab === "mine" && (
              <>
                {(() => {
                  const isLocal = isLocalDelivery(order);
                  // Local shipment: Shipped → Mark Arrived → Verify PIN & Deliver
                  // Cross-city shipment: already Arrived (admin did it) → Verify PIN & Deliver directly
                  if (isLocal && order.status === "Shipped") {
                    return (
                      <Button
                        onClick={onMarkArrived}
                        disabled={isMarkLoading}
                        className="w-full bg-[#0052cc] hover:bg-[#003d99] text-white font-black uppercase text-[11px] tracking-wider h-11 rounded-xl"
                      >
                        {isMarkLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <MapPin className="h-4 w-4 mr-2" />}
                        📍 Mark Arrived at Customer Doorstep
                      </Button>
                    );
                  }
                  // Local order that's Arrived OR cross-city order that's Arrived → Deliver
                  return (
                    <Button
                      onClick={onDeliver}
                      disabled={isMarkLoading || !manifestChecked[order.id]}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[11px] tracking-wider h-11 rounded-xl disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <Key className="h-4 w-4 mr-2" /> Verify PIN & Deliver
                    </Button>
                  );
                })()}

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={onLogFailedAttempt}
                    disabled={isMarkLoading}
                    variant="outline"
                    className="border-zinc-200 text-zinc-600 hover:bg-zinc-50 font-bold text-[10px] h-9 rounded-xl uppercase tracking-wider"
                  >
                    Log Failure
                  </Button>
                  <Button
                    onClick={onRelease}
                    disabled={isReleaseLoading}
                    variant="outline"
                    className="border-red-200 text-red-500 hover:bg-red-50 font-bold text-[10px] h-9 rounded-xl uppercase tracking-wider"
                  >
                    {isReleaseLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : null}
                    Release Back
                  </Button>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function CompletedCard({ order, currency }: { order: Order; currency: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="border-zinc-200 bg-white shadow-sm rounded-2xl overflow-hidden text-left">
        <CardHeader className="p-4 bg-emerald-50/60 border-b border-emerald-100 flex flex-row items-center justify-between">
          <div>
            <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Waybill</span>
            <CardTitle className="text-sm font-black text-slate-700 tracking-wider">{order.tracking_number}</CardTitle>
            <p className="text-[10px] text-zinc-400 mt-0.5">
              {new Date(order.updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          <Badge className="rounded-full px-2.5 py-1 text-[9px] font-black tracking-wider border-none uppercase bg-emerald-100 text-emerald-700 flex items-center gap-1">
            <Check className="h-3 w-3" /> Delivered
          </Badge>
        </CardHeader>
        <CardContent className="p-4 space-y-2.5 text-xs">
          <div className="flex justify-between"><span className="text-zinc-400 font-bold">Recipient</span><span className="font-black text-slate-800">{order.customer?.name ?? "—"}</span></div>
          <div className="flex justify-between"><span className="text-zinc-400 font-bold">Destination</span><span className="font-bold text-slate-700">{order.shipping_city}</span></div>
          <div className="flex justify-between"><span className="text-zinc-400 font-bold">Order Value</span><span className="font-black text-slate-800">{currency} {Number(order.total_amount).toLocaleString()}</span></div>
          {order.delivery_signature_url && (
            <div className="flex items-center justify-between pt-2 border-t border-emerald-100">
              <span className="text-zinc-400 font-bold">Proof of Delivery</span>
              <span className="text-[10px] font-black text-emerald-600 flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Signature Saved</span>
            </div>
          )}
          {order.items && order.items.length > 0 && (
            <div className="pt-2 border-t border-zinc-100">
              <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Items</p>
              {order.items.map(item => (
                <div key={item.id} className="flex justify-between text-[11px]">
                  <span className="text-slate-600 font-medium truncate flex-1 pr-3">{item.product.name}</span>
                  <span className="text-zinc-400 font-bold shrink-0">× {item.quantity}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
