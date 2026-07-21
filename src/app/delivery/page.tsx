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
  WifiOff, Key, Lock, AlertTriangle, SortDesc, SortAsc, ArrowRightLeft, AlertOctagon,
} from "lucide-react";
import api from "@/lib/axios";
import { API_ENDPOINTS } from "@/lib/apis";
import { toast } from "react-hot-toast";
import { useSettings } from "@/components/providers/SettingsProvider";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// Custom hook for debounced value
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

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
  assigned_at?: string;
  status: string;
  shipping_city: string;
  shipping_country: string;
  shipping_address: string;
  shipping_method: string;
  total_amount: number;
  delivered_by_user_id: number | null;
  reserved_by_user_id?: number | null;
  reserved_at?: string;
  last_released_by_user_id?: number | null;
  last_release_reason?: string | null;
  last_release_notes?: string | null;
  last_released_at?: string | null;
  pending_assignment_driver_id?: number | null;
  pending_assignment_at?: string | null;
  pending_assignment_expires_at?: string | null;
  delivery_pin?: string;
  pin_locked?: boolean;
  pin_attempts?: number;
  customer?: { name: string; phone?: string; email?: string };
  items?: OrderItem[];
  delivery_signature_url?: string;
  delivery_photo_url?: string;
  driver?: { name: string; phone?: string; vehicle_plate?: string };
  reserved_by_driver?: { name: string; phone?: string; vehicle_plate?: string } | null;
  last_released_by_driver?: { name: string; phone?: string; vehicle_plate?: string } | null;
  pending_assignment_driver?: { name: string; phone?: string; vehicle_plate?: string } | null;
  notes?: string;
  delivery_attempts?: DeliveryAttempt[];
  my_handover_pin?: string | null;
}

interface DeliveryAttempt {
  id: number;
  driver_id: number;
  reason: string;
  notes?: string;
  attempted_at: string;
  driver?: { name: string };
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
  const { user, loading: authLoading, logout, refreshUser } = useAuth();
  const { settings } = useSettings();
  const router = useRouter();

  const [acknowledgingSla, setAcknowledgingSla] = useState(false);

  // Core data
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<Stats>({ today_completed: 0, active_count: 0, total_delivered: 0 });
  const [notifications, setNotifications] = useState<DeliveryNotification[]>([]);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false); // only for the small refresh button spinner
  const [isOnline, setIsOnline] = useState(true);

  // Tabs: "pool" | "mine" | "completed"
  const [activeTab, setActiveTab] = useState<"pool" | "mine" | "completed">("pool");

  // UI drawers
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifUnread, setNotifUnread] = useState(0);

  // Search & filter
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300); // 300ms debounce
  const [countryFilter, setCountryFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  // Order actions
  const [claimingId, setClaimingId]     = useState<number | null>(null);
  const [reservingId, setReservingId]   = useState<number | null>(null);
  const [confirmReceiptOrder, setConfirmReceiptOrder] = useState<Order | null>(null);
  const [confirmingReceiptId, setConfirmingReceiptId] = useState<number | null>(null);
  const [confirmingHandoverId, setConfirmingHandoverId] = useState<number | null>(null);
  const [releasingId, setReleasingId]   = useState<number | null>(null);
  const [markingId, setMarkingId]       = useState<number | null>(null);
  const [confirmClaimOrder, setConfirmClaimOrder] = useState<Order | null>(null); // custom claim confirm dialog
  const [confirmReserveOrder, setConfirmReserveOrder] = useState<Order | null>(null); // custom reserve confirm dialog
  const [pendingAssignmentDialog, setPendingAssignmentDialog] = useState<Order | null>(null); // pending assignment confirmation dialog


  // PIN verification
  const [pinOrder, setPinOrder] = useState<Order | null>(null);
  const [pinValue, setPinValue] = useState("");
  const [pinLoading, setPinLoading] = useState(false);
  const [pinVerified, setPinVerified] = useState(false);
  const [pinError, setPinError] = useState("");
  const [showPinDialog, setShowPinDialog] = useState(false);

  // Handover PIN verification
  const [handoverPinOrder, setHandoverPinOrder] = useState<Order | null>(null);
  const [handoverPinInput, setHandoverPinInput] = useState("");
  const [handoverPinError, setHandoverPinError] = useState("");

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
  const hasInitialLoadedRef = useRef(false);
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
    // SILENT background syncs: never touch the loading state at all.
    // Only the initial load (silent=false) and manual refresh show the spinner.
    if (!silent) setLoading(true);
    try {
      const res = await api.get(API_ENDPOINTS.delivery.orders);
      const incoming: Order[] = Array.isArray(res.data) ? res.data as Order[] : [];

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
      // Only turn off the loading spinner if we turned it on (non-silent calls only)
      if (!silent) setLoading(false);
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
      if (!hasInitialLoadedRef.current) {
        hasInitialLoadedRef.current = true;
        fetchOrders(false);
        fetchStats();
        fetchNotifications();
      }
    }
  }, [user?.id, fetchOrders, fetchStats, fetchNotifications]);

  // ── Filtered lists ─────────────────────────────────────────────────────────
  const myId = user?.id ?? 0;

  // ── myTasks MUST be declared before any useEffect that reads myTasks ────────
  // (JavaScript temporal dead zone: useMemo is a const, so hoisting a useEffect
  //  dependency on it before declaration causes a ReferenceError at runtime.)
  const myTasks = useMemo(() => {
    let list = orders.filter(o =>
      (o.status === "Shipped" || o.status === "Arrived") &&
      o.delivered_by_user_id === myId
    );
    if (debouncedSearchQuery.trim()) {
      const q = debouncedSearchQuery.toLowerCase();
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
  }, [orders, myId, debouncedSearchQuery, sortOrder]);

  const pendingHandovers = useMemo(() => {
    return orders.filter(o =>
      o.last_released_by_user_id === myId &&
      o.delivered_by_user_id === null &&
      o.reserved_by_user_id !== null &&
      o.reserved_by_user_id !== undefined
    );
  }, [orders, myId]);

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
      if (isOnline) {
        fetchOrders(true);
        fetchStats();
        fetchNotifications();
        refreshUser();
      }
    }, 15000); // Reduced to 15 seconds for faster updates
    secondsRef.current = setInterval(() => setSecondsSinceSync(s => s + 1), 1000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (secondsRef.current) clearInterval(secondsRef.current);
    };
  }, [user, isOnline, fetchOrders, fetchStats, fetchNotifications, refreshUser]);

  // NOTE: SLA breaches do NOT auto-logout. Drivers may finish their active orders
  // after an SLA breach. The SLA Breach Warning Modal (below in JSX) handles
  // notifying the driver and requiring them to acknowledge. Claiming new orders
  // is blocked server-side when sla_breaches >= 3.

  const openPool = useMemo(() => {
    let list = orders.filter(o => {
      if (o.delivered_by_user_id !== null) return false;
      // Exclude orders with pending assignments (they're locked to another driver)
      if (o.pending_assignment_driver_id !== null) return false;

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
    if (debouncedSearchQuery.trim()) {
      const q = debouncedSearchQuery.toLowerCase();
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
  }, [orders, countryFilter, cityFilter, debouncedSearchQuery, sortOrder]);

  // Pending assignments from admin - awaiting driver confirmation
  const pendingAssignments = useMemo(() => {
    return orders.filter(o => o.pending_assignment_driver_id === myId);
  }, [orders, myId]);

  // Countdown timer for pending assignments
  const [timeRemaining, setTimeRemaining] = useState<{ [orderId: number]: number }>({});

  useEffect(() => {
    const interval = setInterval(() => {
      const newTimeRemaining: { [orderId: number]: number } = {};
      pendingAssignments.forEach(order => {
        if (order.pending_assignment_expires_at) {
          const expiresAt = new Date(order.pending_assignment_expires_at).getTime();
          const now = Date.now();
          const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
          newTimeRemaining[order.id] = remaining;
        }
      });
      setTimeRemaining(newTimeRemaining);
    }, 1000);

    return () => clearInterval(interval);
  }, [pendingAssignments]);

  const completedOrders = useMemo(() => {
    let list = orders.filter(o => o.status === "Delivered" && o.delivered_by_user_id === myId);
    if (debouncedSearchQuery.trim()) {
      const q = debouncedSearchQuery.toLowerCase();
      list = list.filter(o =>
        o.tracking_number.toLowerCase().includes(q) ||
        (o.customer?.name ?? "").toLowerCase().includes(q) ||
        o.shipping_city.toLowerCase().includes(q) ||
        (o.shipping_address ?? "").toLowerCase().includes(q) ||
        (o.notes ?? "").toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }, [orders, myId, debouncedSearchQuery]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleReserve = (order: Order) => {
    if ((user?.sla_breaches ?? 0) >= 3) {
      toast.error(
        "Your account is temporarily suspended due to 3 SLA breaches. Please complete your active deliveries. Contact the admin to reactivate your account.",
        {
          duration: 8000,
          icon: "🚫",
          style: { background: "#dc2626", color: "#fff", fontWeight: "bold", fontSize: "12px", borderRadius: "10px", maxWidth: "420px" }
        }
      );
      return;
    }
    const reservedCount = orders.filter(o => o.reserved_by_user_id === user?.id && o.delivered_by_user_id === null).length;
    if (myTasks.length + reservedCount >= 5) {
      toast.error(
        "You already have 5 active/reserved orders. Complete or release one before reserving another.",
        {
          duration: 6000,
          icon: "⚠️",
          style: { background: "#d97706", color: "#fff", fontWeight: "bold", fontSize: "12px", borderRadius: "10px", maxWidth: "400px" }
        }
      );
      return;
    }
    if (order.shipping_city && user?.city &&
      order.shipping_city.toLowerCase() !== (user.city ?? "").toLowerCase()) {
      toast.error(
        `Location Mismatch: This order is destined for ${order.shipping_city}, but your profile is registered to ${user.city}. You cannot reserve orders outside your registered hub.`,
        {
          duration: 5000,
          icon: "🚫",
          style: { background: "#ef4444", color: "#fff", fontWeight: "bold", fontSize: "12px", borderRadius: "10px", maxWidth: "400px" }
        }
      );
      return;
    }
    setConfirmReserveOrder(order);
  };

  const handleReserveConfirmed = async () => {
    const order = confirmReserveOrder;
    if (!order) return;
    setConfirmReserveOrder(null);
    setReservingId(order.id);
    try {
      const response = await api.post(`/delivery/orders/${order.id}/reserve`);
      const handoverPin = response.data?.handover_pin;
      const prevDriverName = order.last_released_by_driver?.name;
      const prevDriverPhone = order.last_released_by_driver?.phone;

      let msg = `Order reserved successfully!`;
      if (handoverPin) {
        msg += ` Your Handover PIN is: ${handoverPin}.`;
      }
      if (prevDriverName && prevDriverPhone) {
        msg += ` Please contact previous driver ${prevDriverName} at ${prevDriverPhone} to collect the package.`;
      }

      toast.success(msg, {
        duration: 12000,
        icon: "📌",
      });
      fetchOrders(true);
      fetchStats();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to reserve order";
      toast.error(msg);
    } finally {
      setReservingId(null);
    }
  };

  const handleAcceptPendingAssignment = async () => {
    const order = pendingAssignmentDialog;
    if (!order) return;
    setPendingAssignmentDialog(null);
    setClaimingId(order.id);
    try {
      await api.post(API_ENDPOINTS.delivery.acceptPendingAssignment(order.id));
      toast.success(`Assignment accepted! Your SLA timer has started for order ${order.tracking_number}.`, {
        icon: "✅",
        style: { background: "#10b981", color: "#fff", fontWeight: "bold" },
      });
      setActiveTab("mine");
      fetchOrders(true);
      fetchStats();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to accept assignment";
      toast.error(msg);
    } finally {
      setClaimingId(null);
    }
  };

  const handleDeclinePendingAssignment = async () => {
    const order = pendingAssignmentDialog;
    if (!order) return;
    setPendingAssignmentDialog(null);
    setReleasingId(order.id);
    try {
      await api.post(API_ENDPOINTS.delivery.declinePendingAssignment(order.id));
      toast.success(`Assignment declined. Order ${order.tracking_number} has been returned to the pool.`, {
        icon: "🔄",
      });
      fetchOrders(true);
      fetchStats();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to decline assignment";
      toast.error(msg);
    } finally {
      setReleasingId(null);
    }
  };

  const handleConfirmReceipt = async () => {
    const order = confirmReceiptOrder;
    if (!order) return;
    setConfirmReceiptOrder(null);
    setConfirmingReceiptId(order.id);
    try {
      await api.post(`/delivery/orders/${order.id}/confirm-receipt`);
      toast.success(`Receipt confirmed! Order ${order.tracking_number} is now assigned to you.`, {
        icon: "✅",
        style: { background: "#10b981", color: "#fff", fontWeight: "bold" },
      });
      setActiveTab("mine");
      // Optimistic update - background sync
      fetchOrders(true);
      fetchStats();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to confirm receipt";
      toast.error(msg);
    } finally {
      setConfirmingReceiptId(null);
    }
  };

  const handleConfirmHandover = (order: Order) => {
    setHandoverPinOrder(order);
    setHandoverPinInput("");
    setHandoverPinError("");
  };

  const handleHandoverSubmit = async () => {
    if (!handoverPinOrder) return;
    if (handoverPinInput.length !== 4) {
      setHandoverPinError("Please enter a valid 4-digit PIN.");
      return;
    }
    const order = handoverPinOrder;
    const nextDriverName = order.reserved_by_driver?.name ?? `Driver #${order.reserved_by_user_id}`;
    setConfirmingHandoverId(order.id);
    setHandoverPinError("");
    try {
      await api.post(`/delivery/orders/${order.id}/confirm-handover`, { pin: handoverPinInput });
      toast.success(`Handover confirmed! Order ${order.tracking_number} is now assigned to ${nextDriverName}.`, {
        icon: "🤝",
        style: { background: "#10b981", color: "#fff", fontWeight: "bold" },
      });
      setHandoverPinOrder(null);
      setHandoverPinInput("");
      // Optimistic update - don't wait for fetchOrders
      fetchOrders(true);
      fetchStats();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to confirm handover";
      setHandoverPinError(msg);
    } finally {
      setConfirmingHandoverId(null);
    }
  };

  const handleClaim = async (order: Order) => {
    // ── SLA Suspension Guard ─────────────────────────────────────────────────
    // If the driver has 3+ SLA breaches their account is suspended.
    // They can still DELIVER existing orders, but cannot claim new ones.
    if ((user?.sla_breaches ?? 0) >= 3) {
      toast.error(
        "Your account is temporarily suspended due to 3 SLA breaches. Please complete your active deliveries. Contact the admin to reactivate your account.",
        {
          duration: 8000,
          icon: "🚫",
          style: { background: "#dc2626", color: "#fff", fontWeight: "bold", fontSize: "12px", borderRadius: "10px", maxWidth: "420px" }
        }
      );
      return;
    }
    // ── Max Active Orders Cap (5) ────────────────────────────────────────────
    if (myTasks.length >= 5) {
      toast.error(
        "You have reached the maximum of 5 active orders. Deliver an existing order before claiming a new one.",
        {
          duration: 6000,
          icon: "⚠️",
          style: { background: "#d97706", color: "#fff", fontWeight: "bold", fontSize: "12px", borderRadius: "10px", maxWidth: "400px" }
        }
      );
      return;
    }
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
      setActiveTab("mine");
      // Optimistic update - background sync
      fetchOrders(true);
      fetchStats();
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
    if (!releaseReason) {
      toast.error(releaseType === "failure" ? "Please select a failure reason" : "Please select an operational reason");
      return;
    }

    setReleasingId(releaseModalOrder.id);
    try {
      const res = await api.post(`/delivery/orders/${releaseModalOrder.id}/release`, {
        release_type: releaseType,
        reason: releaseReason,
        notes: releaseNotes || null,
      });

      toast.success(res.data.message || `Order ${releaseModalOrder.tracking_number} released back to the pool.`);
      setReleaseModalOrder(null);
      // Optimistic update - background sync
      fetchOrders(true);
      fetchStats();
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
      // Optimistic update - background sync
      fetchOrders(true);
      fetchStats();
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
    const signatureData = canvas.toDataURL("image/jpeg", 0.65);

    try {
      await api.post(API_ENDPOINTS.delivery.deliver(signatureOrder.id), {
        signature: signatureData,
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
      setActiveTab("completed");
      // Optimistic update - background sync
      fetchOrders(true);
      fetchStats();
      refreshUser();
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
      fetchOrders(true);
    } catch (err: any) {
      const msg = err.response?.data?.message ?? "Failed to log attempt";
      toast.error(msg);
    } finally {
      setFailedLoading(false);
    }
  };

  // Acknowledge SLA breaches handler
  const handleAcknowledgeSla = async () => {
    setAcknowledgingSla(true);
    // Optimistic update — close modal immediately
    if (user) {
      user.sla_breaches_acknowledged = user.sla_breaches;
      if (typeof window !== "undefined") {
        localStorage.setItem(`sla_acknowledged_${user.id}`, Date.now().toString());
      }
    }
    try {
      await api.post("/delivery/acknowledge-sla-breaches");
      toast.success("SLA warning acknowledged.", { icon: "📝" });
      refreshUser();
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? "Failed to acknowledge warning.");
    } finally {
      setAcknowledgingSla(false);
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
              {/* Persistent SLA breach indicator in the header */}
              {(user.sla_breaches ?? 0) > 0 && (
                <div className="flex items-center gap-1 mt-0.5">
                  {[1, 2, 3].map(i => (
                    <div
                      key={i}
                      className={`h-1.5 w-4 rounded-full ${
                        i <= (user.sla_breaches ?? 0)
                          ? i === 3 ? "bg-red-400" : "bg-amber-400"
                          : "bg-white/20"
                      }`}
                    />
                  ))}
                  <span className={`text-[9px] font-black uppercase tracking-wide ml-0.5 ${(user.sla_breaches ?? 0) >= 3 ? "text-red-300" : "text-amber-300"}`}>
                    {(user.sla_breaches ?? 0) >= 3 ? "SUSPENDED" : `Breach ${user.sla_breaches}/3`}
                  </span>
                </div>
              )}
            </div>
          </button>

          <div className="flex items-center gap-2">
            {/* Sync indicator — always quiet green dot during background sync */}
            <div className="hidden sm:flex items-center gap-1.5 bg-white/10 rounded-lg px-2 py-1.5">
              {isOnline ? (
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              ) : (
                <WifiOff className="h-3 w-3 text-red-300" />
              )}
              <span className="text-[9px] font-bold text-blue-200 uppercase tracking-wide">
                {secondsSinceSync}s ago
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

        {/* ── PERSISTENT SLA BREACH RECORD CARD ────────────────────────────── */}
        {/* Shows at all times when the driver has acknowledged breaches, so they always know their strike count */}
        {(user.sla_breaches ?? 0) > 0 && (user.sla_breaches ?? 0) <= (user.sla_breaches_acknowledged ?? 0) && (
          <div className={`rounded-xl border mb-4 p-3 ${
            (user.sla_breaches ?? 0) >= 3
              ? "bg-red-50 border-red-200"
              : "bg-amber-50 border-amber-200"
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                  (user.sla_breaches ?? 0) >= 3 ? "bg-red-100" : "bg-amber-100"
                }`}>
                  <AlertOctagon className={`h-4 w-4 ${(user.sla_breaches ?? 0) >= 3 ? "text-red-600" : "text-amber-600"}`} />
                </div>
                <div>
                  <p className={`text-[11px] font-black uppercase tracking-wide ${(user.sla_breaches ?? 0) >= 3 ? "text-red-700" : "text-amber-700"}`}>
                    SLA Record — Strike {user.sla_breaches} of 3
                  </p>
                  <p className="text-[10px] text-zinc-500 font-medium">
                    {(user.sla_breaches ?? 0) >= 3
                      ? "Account suspended. Contact admin to reactivate."
                      : `${3 - (user.sla_breaches ?? 0)} strike(s) remaining before suspension`}
                  </p>
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                {[1, 2, 3].map(i => (
                  <div
                    key={i}
                    className={`h-2 w-5 rounded-full ${
                      i <= (user.sla_breaches ?? 0)
                        ? i === 3 ? "bg-red-500" : "bg-amber-500"
                        : "bg-zinc-200"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Pending Assignments Banner */}
        {pendingAssignments.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 shadow-sm animate-pulse">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-amber-600" />
                <h3 className="text-sm font-black text-amber-900 uppercase tracking-wider">
                  Pending Assignments ({pendingAssignments.length})
                </h3>
              </div>
              <span className="text-[10px] font-bold text-amber-700 bg-white border border-amber-300 px-2 py-1 rounded-full">
                Action Required
              </span>
            </div>
            <div className="space-y-2">
              {pendingAssignments.slice(0, 3).map(order => (
                <div
                  key={order.id}
                  onClick={() => setPendingAssignmentDialog(order)}
                  className="bg-white border border-amber-200 rounded-lg p-3 cursor-pointer hover:bg-amber-100 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black text-slate-800">{order.tracking_number}</span>
                    <span className="text-[10px] font-bold text-amber-700">
                      {(() => {
                        const seconds = timeRemaining[order.id] || 0;
                        const minutes = Math.floor(seconds / 60);
                        const secs = seconds % 60;
                        const pad = (n: number) => String(n).padStart(2, "0");
                        return `${pad(minutes)}:${pad(secs)}`;
                      })()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-zinc-600">
                    <MapPin className="h-3 w-3" />
                    <span>{order.shipping_city}, {order.shipping_country}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-zinc-600 mt-1">
                    <User className="h-3 w-3" />
                    <span>{order.customer?.name}</span>
                  </div>
                </div>
              ))}
            </div>
            {pendingAssignments.length > 3 && (
              <p className="text-[10px] font-bold text-amber-700 mt-2 text-center">
                +{pendingAssignments.length - 3} more pending assignments
              </p>
            )}
          </div>
        )}

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
            onClick={async () => {
              setIsManualRefreshing(true);
              await Promise.all([fetchOrders(false), fetchStats(), fetchNotifications()]);
              setIsManualRefreshing(false);
            }}
            disabled={isManualRefreshing}
            className="h-10 w-10 flex items-center justify-center rounded-xl bg-white border border-zinc-200 text-zinc-600 shadow-sm shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${isManualRefreshing ? "animate-spin text-[#0052cc]" : ""}`} />
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
                    isClaimLoading={confirmingReceiptId === order.id || claimingId === order.id}
                    isReserveLoading={reservingId === order.id}
                    isReleaseLoading={releasingId === order.id}
                    isMarkLoading={false}
                    allOrders={orders}
                    manifestChecked={manifestChecked}
                    onManifestCheckToggle={(orderId, checked) => setManifestChecked(prev => ({ ...prev, [orderId]: checked }))}
                    onClaim={() => handleClaim(order)}
                    onReserve={() => handleReserve(order)}
                    onConfirmReceipt={() => setConfirmReceiptOrder(order)}
                    onRelease={() => openReleaseModal(order)}
                    onMarkArrived={() => { }}
                    onDeliver={() => openPinDialog(order)}
                    onLogFailedAttempt={() => { }}
                    onHandoverExpired={() => fetchOrders(true)}
                  />
                ))
              )
            )}

            {/* ── MY TASKS TAB ──────────────────────────────────────────── */}
            {activeTab === "mine" && (
              <div className="space-y-4">
                {/* Pending Handovers Section */}
                {pendingHandovers.length > 0 && (
                  <div className="bg-blue-50/75 border border-blue-100 rounded-2xl p-4 text-left space-y-3 shadow-xs">
                    <div className="flex items-center gap-2">
                      <ArrowRightLeft className="h-4 w-4 text-[#0052cc] animate-pulse shrink-0" />
                      <h3 className="font-black text-slate-800 text-[11px] uppercase tracking-wider">Pending Handovers (Action Required)</h3>
                    </div>
                    <p className="text-[11px] font-bold text-slate-500 leading-snug">
                      The following orders you released have been reserved by other drivers. Confirm physical handover below once they collect the package to start their SLA:
                    </p>
                    <div className="space-y-2">
                      {pendingHandovers.map(handover => (
                        <div key={handover.id} className="bg-white p-3 rounded-xl border border-blue-100/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <p className="font-extrabold text-slate-800 text-xs flex items-center flex-wrap gap-2">
                              <span>Waybill:</span>
                              <span className="text-[#0052cc] tracking-wide font-black">{handover.tracking_number}</span>
                              {handover.reserved_at && (
                                <HandoverCountdown reservedAt={handover.reserved_at} onExpired={() => fetchOrders(true)} />
                              )}
                            </p>
                            <p className="text-[10px] text-zinc-500 font-extrabold uppercase">
                              Reserved By: <span className="text-zinc-700 font-black">{handover.reserved_by_driver?.name ?? `Driver #${handover.reserved_by_user_id}`}</span> 
                              {handover.reserved_by_driver?.vehicle_plate && ` (${handover.reserved_by_driver.vehicle_plate})`}
                            </p>
                          </div>
                          <Button
                            onClick={() => handleConfirmHandover(handover)}
                            disabled={confirmingHandoverId === handover.id}
                            className="bg-[#0052cc] hover:bg-[#003d99] text-white font-black uppercase text-[10px] tracking-wider h-8 px-4 rounded-xl shrink-0 border-none"
                          >
                            {confirmingHandoverId === handover.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                            ) : (
                              <Check className="h-3.5 w-3.5 mr-1.5" />
                            )}
                            Confirm Handover
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {myTasks.length === 0 ? (
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
                      isReserveLoading={false}
                      isReleaseLoading={releasingId === order.id}
                      isMarkLoading={markingId === order.id}
                      allOrders={orders}
                      manifestChecked={manifestChecked}
                      onManifestCheckToggle={(orderId, checked) => setManifestChecked(prev => ({ ...prev, [orderId]: checked }))}
                      onClaim={() => { }}
                      onReserve={() => { }}
                      onConfirmReceipt={() => { }}
                      onRelease={() => openReleaseModal(order)}
                      onMarkArrived={() => handleMarkArrived(order)}
                      onDeliver={() => openPinDialog(order)}
                      onLogFailedAttempt={() => openFailedAttemptModal(order)}
                      onHandoverExpired={() => fetchOrders(true)}
                    />
                  ))
                )}
              </div>
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
            { label: "Location / Hub", value: user.city && user.country ? `${user.city}, ${user.country}` : user.city || user.country || "Not set", icon: MapPin },
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
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">Additional Notes / Context *</label>
                <textarea
                  value={failedNotes}
                  onChange={e => setFailedNotes(e.target.value)}
                  placeholder="Please write down the detailed reason you chose above..."
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
                  disabled={failedLoading || !failedReason || !failedNotes.trim()}
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

              {/* Dropdown if releaseType is operational */}
              {releaseType === "operational" && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">Operational Reason *</label>
                  <select
                    value={releaseReason}
                    onChange={e => setReleaseReason(e.target.value)}
                    className="w-full h-11 border border-zinc-200 rounded-xl px-3 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0052cc]"
                  >
                    <option value="">-- Select an Operational Reason --</option>
                    <option value="Vehicle Breakdown">Vehicle Breakdown (Flat tire, engine fail)</option>
                    <option value="End of Shift">Ran Out of Time / End of Shift</option>
                    <option value="Severe Weather">Severe Weather / Road Blocked</option>
                    <option value="Emergency">Personal / Medical Emergency</option>
                    <option value="Other">Other (Specify in notes)</option>
                  </select>
                </div>
              )}

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
                  {releaseType === "failure" ? "Failure Notes & Release Explanation *" : "Operational Notes / Reason Explanation *"}
                </label>
                <textarea
                  value={releaseNotes}
                  onChange={e => setReleaseNotes(e.target.value)}
                  placeholder={releaseType === "failure" ? "Please detail why the delivery failed before releasing..." : "Please write down the detailed operational reason you chose above..."}
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
                  disabled={releasingId !== null || !releaseReason || !releaseNotes.trim()}
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

      {/* ── CONFIRM PHYSICAL PACKAGE RECEIPT DIALOG ── */}
      <AnimatePresence>
        {confirmReceiptOrder && (
          <Modal onClose={() => setConfirmReceiptOrder(null)}>
            <div className="p-5 border-b border-zinc-150 flex items-center justify-between bg-zinc-50">
              <div className="text-left">
                <h2 className="text-base font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                  <Check className="h-5 w-5 text-emerald-600" /> Confirm Package Receipt
                </h2>
                <p className="text-[10px] font-bold text-zinc-500 mt-0.5">Order Ref: {confirmReceiptOrder.tracking_number}</p>
              </div>
              <button
                onClick={() => setConfirmReceiptOrder(null)}
                className="h-8 w-8 rounded-full bg-zinc-200 flex items-center justify-center text-zinc-650 hover:bg-zinc-300 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-left">
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                <p className="text-[11px] font-bold text-amber-700 flex items-start gap-2 leading-relaxed">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                  <span>
                    WARNING: Only confirm if you have the physical package in your hands right now. The 4-hour SLA delivery clock will start immediately.
                  </span>
                </p>
              </div>

              {confirmReceiptOrder.last_released_by_driver && (
                <div className="bg-zinc-50 border border-zinc-150 rounded-xl p-3 text-xs space-y-1.5">
                  <p className="font-extrabold text-slate-700">Handover details:</p>
                  <p className="font-medium">Previous Driver: <span className="font-bold">{confirmReceiptOrder.last_released_by_driver.name}</span></p>
                  {confirmReceiptOrder.last_released_by_driver.phone && (
                    <p className="font-medium">Phone: <a href={`tel:${confirmReceiptOrder.last_released_by_driver.phone}`} className="text-blue-600 underline font-bold">{confirmReceiptOrder.last_released_by_driver.phone}</a></p>
                  )}
                  {confirmReceiptOrder.last_release_reason && (
                    <p className="font-medium">Release Reason: <span className="text-red-500 font-bold">{confirmReceiptOrder.last_release_reason}</span></p>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setConfirmReceiptOrder(null)}
                  className="flex-1 font-bold rounded-xl h-11 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmReceipt}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[11px] tracking-wider h-11 rounded-xl"
                >
                  Yes, I Have Package
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

      {/* ── CUSTOM RESERVE ORDER CONFIRMATION DIALOG ── */}
      <AnimatePresence>
        {confirmReserveOrder && (
          <Modal onClose={() => setConfirmReserveOrder(null)}>
            <div className="p-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
              <div className="text-left">
                <h2 className="text-base font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-[#0052cc]" /> Confirm Reservation
                </h2>
                <p className="text-[10px] font-bold text-zinc-500 mt-0.5">Order Ref: {confirmReserveOrder.tracking_number}</p>
              </div>
              <button
                onClick={() => setConfirmReserveOrder(null)}
                className="h-8 w-8 rounded-full bg-zinc-200 flex items-center justify-center text-zinc-650 hover:bg-zinc-300 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-left">
              <p className="text-xs font-bold text-zinc-600 leading-relaxed">
                By reserving this order, you are claiming responsibility to collect the physical package from the previous driver (or the warehouse hub) and proceed with the delivery.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] font-bold text-amber-800 leading-snug space-y-1.5">
                <p>⚠️ Note: The SLA timer has not started yet. The SLA clock will begin only after you confirm the physical package receipt.</p>
                <p>⏱️ Handover Window: You have exactly 15 minutes to coordinate with the other driver to confirm the order handover. If the handover is not confirmed within this 15-minute window, the reservation will automatically expire, the order will go back to the open pool, and it can be secured by another driver.</p>
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setConfirmReserveOrder(null)}
                  className="flex-1 font-bold rounded-xl h-11 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleReserveConfirmed}
                  className="flex-1 bg-[#0052cc] hover:bg-[#003d99] text-white font-black uppercase text-[11px] tracking-wider h-11 rounded-xl"
                >
                  Yes, Reserve Order
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* ── HANDOVER PIN MODAL ── */}
      <AnimatePresence>
        {handoverPinOrder && (
          <Modal onClose={() => {
            setHandoverPinOrder(null);
            setHandoverPinInput("");
            setHandoverPinError("");
          }}>
            <div className="p-5 border-b border-zinc-150 flex items-center justify-between bg-zinc-50">
              <div className="text-left">
                <h2 className="text-base font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                  <ArrowRightLeft className="h-5 w-5 text-[#0052cc]" /> Verify Handover PIN
                </h2>
                <p className="text-[10px] font-bold text-zinc-500 mt-0.5">Order Ref: {handoverPinOrder.tracking_number}</p>
              </div>
              <button
                onClick={() => {
                  setHandoverPinOrder(null);
                  setHandoverPinInput("");
                  setHandoverPinError("");
                }}
                className="h-8 w-8 rounded-full bg-zinc-200 flex items-center justify-center text-zinc-650 hover:bg-zinc-300 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-left">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                <p className="text-[11px] font-bold text-blue-800 leading-relaxed">
                  Enter the unique 4-digit Handover PIN displayed on the claiming driver's screen (<strong>{handoverPinOrder.reserved_by_driver?.name ?? `Driver #${handoverPinOrder.reserved_by_user_id}`}</strong>). This confirms face-to-face handover.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">4-Digit Handover PIN</label>
                <Input
                  type="text"
                  maxLength={4}
                  placeholder="Enter 4-digit PIN"
                  value={handoverPinInput}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, "");
                    setHandoverPinInput(val);
                    setHandoverPinError("");
                  }}
                  className="h-12 bg-zinc-50 border-zinc-200 text-center text-lg font-black tracking-widest rounded-xl focus-visible:ring-[#0052cc]"
                />
                {handoverPinError && (
                  <p className="text-[10px] font-extrabold text-red-650 mt-1">⚠️ {handoverPinError}</p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setHandoverPinOrder(null);
                    setHandoverPinInput("");
                    setHandoverPinError("");
                  }}
                  className="flex-1 font-bold rounded-xl h-11 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleHandoverSubmit}
                  disabled={confirmingHandoverId !== null || handoverPinInput.length !== 4}
                  className="flex-1 bg-[#0052cc] hover:bg-[#003d99] text-white font-black uppercase text-[11px] tracking-wider h-11 rounded-xl"
                >
                  {confirmingHandoverId !== null && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Verify &amp; Handover
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* ── PENDING ASSIGNMENT CONFIRMATION DIALOG ── */}
      <AnimatePresence>
        {pendingAssignmentDialog && (
          <Modal onClose={() => setPendingAssignmentDialog(null)}>
            <div className="p-5 border-b border-zinc-150 flex items-center justify-between bg-zinc-50">
              <div className="text-left">
                <h2 className="text-base font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                  <Bell className="h-5 w-5 text-amber-500" /> Pending Assignment
                </h2>
                <p className="text-[10px] font-bold text-zinc-500 mt-0.5">Order Ref: {pendingAssignmentDialog.tracking_number}</p>
              </div>
              <button
                onClick={() => setPendingAssignmentDialog(null)}
                className="h-8 w-8 rounded-full bg-zinc-200 flex items-center justify-center text-zinc-650 hover:bg-zinc-300 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-left">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                <p className="text-[11px] font-bold text-amber-900 leading-relaxed">
                  Admin has assigned this order to you. You have <strong>15 minutes</strong> to accept or decline this assignment.
                </p>
                <div className="flex items-center justify-center bg-white border border-amber-300 rounded-lg px-4 py-3">
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1">Time Remaining</p>
                    <p className="text-2xl font-black text-amber-900 tracking-wider">
                      {(() => {
                        const seconds = timeRemaining[pendingAssignmentDialog.id] || 0;
                        const minutes = Math.floor(seconds / 60);
                        const secs = seconds % 60;
                        const pad = (n: number) => String(n).padStart(2, "0");
                        return `${pad(minutes)}:${pad(secs)}`;
                      })()}
                    </p>
                  </div>
                </div>
                <div className="space-y-2 text-[10px] font-bold text-amber-800">
                  <p>• <strong>YES:</strong> Accept assignment → SLA timer starts immediately</p>
                  <p>• <strong>NO:</strong> Decline assignment → Order returns to pool for other drivers</p>
                  <p>• <strong>EXPIRES:</strong> If no response within 15 minutes, order automatically returns to pool</p>
                </div>
              </div>

              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3">
                <p className="text-[10px] font-bold text-zinc-600">
                  <strong>Customer:</strong> {pendingAssignmentDialog.customer?.name}<br />
                  <strong>Destination:</strong> {pendingAssignmentDialog.shipping_city}, {pendingAssignmentDialog.shipping_country}<br />
                  <strong>Amount:</strong> {currency} {pendingAssignmentDialog.total_amount?.toFixed(2)}
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={handleDeclinePendingAssignment}
                  disabled={releasingId !== null}
                  className="flex-1 border-red-200 text-red-600 hover:bg-red-50 font-bold rounded-xl h-11 text-xs"
                >
                  {releasingId !== null && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Decline (Return to Pool)
                </Button>
                <Button
                  onClick={handleAcceptPendingAssignment}
                  disabled={claimingId !== null}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[11px] tracking-wider h-11 rounded-xl"
                >
                  {claimingId !== null && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Accept (Start SLA)
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* ── SLA BREACH WARNING MODAL ── */}
      <AnimatePresence>
        {user && (user.sla_breaches ?? 0) > (user.sla_breaches_acknowledged ?? 0) && (
          <Modal onClose={() => {}}>
            <div className="p-6 text-center space-y-4">
              <div className={`h-14 w-14 rounded-full flex items-center justify-center mx-auto border-2 animate-pulse ${
                (user.sla_breaches ?? 0) >= 3
                  ? "bg-red-100 border-red-400"
                  : "bg-amber-50 border-amber-300"
              }`}>
                <AlertOctagon className={`h-7 w-7 shrink-0 ${(user.sla_breaches ?? 0) >= 3 ? "text-red-600" : "text-amber-500"}`} />
              </div>
              <div className="space-y-2">
                <h2 className={`text-lg font-black uppercase tracking-tight ${(user.sla_breaches ?? 0) >= 3 ? "text-red-700" : "text-amber-700"}`}>
                  {(user.sla_breaches ?? 0) >= 3 ? "⛔ Account Suspended" : "⚠️ SLA Breach Strike"}
                </h2>
                <p className="text-xs font-bold text-zinc-600 leading-relaxed">
                  You failed to deliver an order within the <span className="font-black text-red-600">4-hour SLA window</span>. You have received a strike against your account.
                </p>

                {/* Strike progress bar */}
                <div className="flex gap-1.5 justify-center pt-1">
                  {[1, 2, 3].map(i => (
                    <div
                      key={i}
                      className={`h-3 flex-1 rounded-full border transition-all ${
                        i <= (user.sla_breaches ?? 0)
                          ? i === 3
                            ? "bg-red-600 border-red-700"
                            : "bg-amber-500 border-amber-600"
                          : "bg-zinc-100 border-zinc-200"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                  Strike {user.sla_breaches} of 3
                </p>

                <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2 text-left">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-500 font-bold">Account Status:</span>
                    <span className={`font-black uppercase text-[10px] ${(user.sla_breaches ?? 0) >= 3 ? "text-red-600" : "text-amber-600"}`}>
                      {(user.sla_breaches ?? 0) >= 3 ? "Suspended — Cannot Claim" : (user.sla_breaches ?? 0) === 2 ? "Final Warning" : "Warning Strike"}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-500 font-bold">Active Orders:</span>
                    <span className="font-black text-emerald-600">You may still deliver these</span>
                  </div>
                </div>

                <div className={`text-[11px] font-semibold leading-normal pt-1 p-3 rounded-xl border ${
                  (user.sla_breaches ?? 0) >= 3
                    ? "bg-red-50 border-red-200 text-red-700"
                    : "bg-amber-50 border-amber-200 text-amber-800"
                }`}>
                  {(user.sla_breaches ?? 0) >= 3 ? (
                    <>
                      <span className="font-extrabold block mb-1">Account Temporarily Closed</span>
                      You have reached 3 SLA breaches. You can still complete your currently assigned orders peacefully, but you <span className="font-extrabold underline">cannot claim new orders</span> until an administrator reactivates your account.
                    </>
                  ) : (user.sla_breaches ?? 0) === 2 ? (
                    <>
                      <span className="font-extrabold block mb-1">⚠️ Final Warning — 1 Strike Remaining</span>
                      One more SLA breach will temporarily close your account. You will still be able to deliver your active orders, but will be unable to claim new ones until an admin reactivates you.
                    </>
                  ) : (
                    <>
                      You have <span className="font-extrabold text-red-600">{3 - (user.sla_breaches ?? 0)} more strike(s)</span> remaining before your account is temporarily suspended. Deliver orders on time to avoid further penalties.
                    </>
                  )}
                </div>
              </div>
              <div className="pt-2">
                <Button
                  onClick={handleAcknowledgeSla}
                  disabled={acknowledgingSla}
                  className={`w-full text-white font-black uppercase text-[11px] tracking-wider h-11 rounded-xl shadow-md border-none ${
                    (user.sla_breaches ?? 0) >= 3
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-amber-500 hover:bg-amber-600"
                  }`}
                >
                  {acknowledgingSla ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  I Understand &amp; Mark as Read
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
  // isBreached is a one-way latch: once true it never goes back to false
  const [isBreached, setIsBreached] = useState(false);
  const [isCritical, setIsCritical] = useState(false);
  const [isDelivered, setIsDelivered] = useState(false);
  const [isArrived, setIsArrived] = useState(false);

  // Compute the SLA start time once and keep it stable.
  // We ONLY use assigned_at — never updated_at — so that wrong-PIN
  // DB updates or admin unlocks cannot accidentally restart the countdown.
  const slaStartTime = useMemo(() => {
    if (!order.assigned_at) return null;
    let dateStr = order.assigned_at;
    if (typeof dateStr === "string" && !dateStr.includes("T") && !dateStr.includes("Z") && !dateStr.includes("+")) {
      dateStr = dateStr.replace(" ", "T") + "Z";
    }
    return new Date(dateStr).getTime();
  }, [order.assigned_at]);

  useEffect(() => {
    // SLA only stops at Delivered — Arrived does NOT stop the timer
    if (order.status === "Delivered") {
      setIsDelivered(true);
      setTimeLeft("✅ Delivered");
      return;
    }
    setIsDelivered(false);

    // If we have no assigned_at, we cannot compute a meaningful SLA
    if (!slaStartTime) {
      setTimeLeft("—");
      return;
    }

    const updateTimer = () => {
      // Already latched as breached — do not recalculate; just keep displaying breached
      if (isBreached) {
        setTimeLeft("SLA BREACHED ⚠️");
        return;
      }

      const breachTime = slaStartTime + 4 * 60 * 60 * 1000;
      const diff = breachTime - Date.now();

      if (diff <= 0) {
        // Latch permanently — never reset from this state
        setIsBreached(true);
        setIsCritical(false);
        setIsArrived(false);
        setTimeLeft("SLA BREACHED ⚠️");
        return;
      }

      const hrs = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);

      setIsArrived(order.status === "Arrived");
      setIsCritical(diff < 1800000); // under 30 min = critical
      setTimeLeft(`${hrs}h ${mins}m ${secs}s left`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  // NOTE: isBreached intentionally NOT in deps — it's a one-way latch
  // NOTE: order.updated_at intentionally excluded — it must not trigger SLA restart
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.status, slaStartTime]);

  if (isDelivered) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center justify-between">
        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">SLA Release Timer</span>
        <span className="text-sm font-black text-emerald-600">✅ Delivered</span>
      </div>
    );
  }

  if (isBreached) {
    return (
      <div className="bg-red-600 border-2 border-red-700 rounded-xl px-4 py-3 flex items-center justify-between animate-pulse">
        <span className="text-[10px] font-black text-red-100 uppercase tracking-widest">SLA Release Timer</span>
        <span className="text-sm font-black text-white">⚠️ SLA BREACHED</span>
      </div>
    );
  }

  return (
    <div className={`rounded-xl px-4 py-3 border-2 ${
      isCritical
        ? "bg-red-600 border-red-700 animate-pulse"
        : isArrived
          ? "bg-purple-50 border-purple-300"
          : "bg-red-50 border-red-400"
    }`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className={`text-[10px] font-black uppercase tracking-widest ${
            isCritical ? "text-red-100" : isArrived ? "text-purple-600" : "text-red-600"
          }`}>SLA Release Timer</span>
          {isArrived && (
            <span className="text-[9px] font-bold text-purple-500 uppercase tracking-wide">📍 At Doorstep — Complete delivery!</span>
          )}
        </div>
        <span className={`text-base font-black tabular-nums tracking-tight ${
          isCritical ? "text-white" : isArrived ? "text-purple-700" : "text-red-600"
        }`}>{timeLeft}</span>
      </div>
    </div>
  );
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

interface ReleaseCooldownProps {
  lastReleasedAt: string;
  onTimeout: () => void;
}

function ReleaseCooldown({ lastReleasedAt, onTimeout }: ReleaseCooldownProps) {
  const [timeLeftStr, setTimeLeftStr] = useState("");

  useEffect(() => {
    let releasedStr = lastReleasedAt;
    if (!releasedStr.includes("T") && !releasedStr.includes("Z") && !releasedStr.includes("+")) {
      releasedStr = releasedStr.replace(" ", "T") + "Z";
    }
    const releaseTime = new Date(releasedStr).getTime();
    const endTime = releaseTime + 24 * 60 * 60 * 1000;

    const updateTimer = () => {
      const diff = endTime - Date.now();
      if (diff <= 0) {
        setTimeLeftStr("00 hrs 00 min 00 sec");
        onTimeout();
        return;
      }

      const totalSeconds = Math.floor(diff / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      const pad = (n: number) => String(n).padStart(2, "0");
      setTimeLeftStr(`${pad(hours)} hrs ${pad(minutes)} min ${pad(seconds)} sec`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [lastReleasedAt, onTimeout]);

  return <span className="font-black text-red-800">({timeLeftStr} remaining)</span>;
}

interface HandoverCountdownProps {
  reservedAt: string;
  onExpired?: () => void;
}

function HandoverCountdown({ reservedAt, onExpired }: HandoverCountdownProps) {
  const [timeLeftStr, setTimeLeftStr] = useState("");
  const [isCritical, setIsCritical] = useState(false);

  useEffect(() => {
    let dateStr = reservedAt;
    if (typeof dateStr === "string" && !dateStr.includes("T") && !dateStr.includes("Z") && !dateStr.includes("+")) {
      dateStr = dateStr.replace(" ", "T") + "Z";
    }
    const startTime = new Date(dateStr).getTime();
    const endTime = startTime + 15 * 60 * 1000; // 15 minutes

    const updateTimer = () => {
      const diff = endTime - Date.now();
      if (diff <= 0) {
        setTimeLeftStr("00:00 (Expired)");
        setIsCritical(true);
        if (onExpired) onExpired();
        return;
      }

      const totalSeconds = Math.floor(diff / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;

      const pad = (n: number) => String(n).padStart(2, "0");
      setTimeLeftStr(`${pad(minutes)}:${pad(seconds)}`);

      if (minutes < 3) {
        setIsCritical(true);
      } else {
        setIsCritical(false);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [reservedAt, onExpired]);

  return (
    <span className={cn(
      "font-black tracking-wider text-[10px] uppercase px-2 py-0.5 rounded-md shrink-0 inline-flex items-center gap-1",
      isCritical 
        ? "bg-rose-100 text-rose-700 animate-pulse border border-rose-200" 
        : "bg-amber-100 text-amber-700 border border-amber-250"
    )}>
      ⏱️ {timeLeftStr}
    </span>
  );
}

function OrderCard({
  order,
  myId,
  tab,
  currency,
  isClaimLoading,
  isReserveLoading = false,
  isReleaseLoading,
  isMarkLoading,
  allOrders,
  manifestChecked,
  onManifestCheckToggle,
  onClaim,
  onReserve = () => {},
  onConfirmReceipt = () => {},
  onRelease,
  onMarkArrived,
  onDeliver,
  onLogFailedAttempt,
  onHandoverExpired
}: {
  order: Order;
  myId: number;
  tab: "pool" | "mine";
  currency: string;
  isClaimLoading: boolean;
  isReserveLoading?: boolean;
  isReleaseLoading: boolean;
  isMarkLoading: boolean;
  allOrders: Order[];
  manifestChecked: { [orderId: number]: boolean };
  onManifestCheckToggle: (orderId: number, checked: boolean) => void;
  onClaim: () => void;
  onReserve?: () => void;
  onConfirmReceipt?: () => void;
  onRelease: () => void;
  onMarkArrived: () => void;
  onDeliver: () => void;
  onLogFailedAttempt: () => void;
  onHandoverExpired?: () => void;
}) {
  const badge = getStatusBadge(order, myId);

  const [cooldownExpired, setCooldownExpired] = useState(false);

  useEffect(() => {
    setCooldownExpired(false);
  }, [order.id, order.last_released_at]);

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

        {/* Released by previous driver banner */}
        {order.last_released_by_driver && (
          <div className="bg-rose-50 border-b border-rose-100 px-4 py-3 text-left space-y-1.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-[10px] font-black text-rose-800 flex items-center gap-1.5 leading-snug uppercase tracking-wider">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 animate-pulse" />
                <span>Released Order Info</span>
              </p>
              {order.reserved_by_user_id === myId && order.reserved_at && (
                <HandoverCountdown reservedAt={order.reserved_at} onExpired={onHandoverExpired} />
              )}
            </div>
            <p className="text-[11px] font-bold text-rose-700 leading-tight">
              Previously released by <span className="font-extrabold">{order.last_released_by_driver.name}</span>. You must collect the physical package from them!
            </p>
            <div className="flex flex-col gap-1.5 mt-1 bg-white p-2.5 rounded-xl border border-rose-100 shadow-sm text-xs text-zinc-700">
              {order.reserved_by_user_id === myId && order.my_handover_pin && (
                <div className="flex items-center justify-between bg-blue-50/75 p-2 rounded-lg border border-blue-100 mb-1">
                  <span className="font-extrabold text-[#0052cc] text-[10px] uppercase tracking-wider">Your Handover PIN:</span>
                  <span className="font-black bg-[#0052cc] text-white px-2 py-0.5 rounded text-[13px] tracking-wider">{order.my_handover_pin}</span>
                </div>
              )}
              {order.last_released_by_driver.phone && (
                <div className="flex items-center justify-between">
                  <span className="font-bold">Contact Driver:</span>
                  <a href={`tel:${order.last_released_by_driver.phone}`} className="text-[#0052cc] hover:underline font-extrabold flex items-center gap-1">
                    📞 {order.last_released_by_driver.phone}
                  </a>
                </div>
              )}
              {order.last_release_reason && (
                <div>
                  <span className="font-bold">Reason for Release:</span> <span className="font-medium text-rose-600">{order.last_release_reason}</span>
                </div>
              )}
              {order.last_release_notes && (
                <div className="italic text-zinc-500 font-medium">
                  "{order.last_release_notes}"
                </div>
              )}
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
            <SlaTimer order={order} />
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

          {/* Previous attempts / Failure reasons */}
          {order.delivery_attempts && order.delivery_attempts.length > 0 && (
            <div className="border-t border-zinc-100 pt-3 text-left">
              <p className="text-[9px] font-bold text-[#64748b] uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
                <span>Previous Attempts / Failure Logs</span>
              </p>
              <div className="space-y-2">
                {order.delivery_attempts.map((attempt) => (
                  <div key={attempt.id} className="bg-amber-50/40 border border-amber-100 rounded-xl p-2.5 space-y-1 text-xs">
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-amber-800 uppercase text-[10px] tracking-wide">
                        ⚠️ {attempt.reason}
                      </span>
                      <span className="text-zinc-400 text-[10px]">
                        {new Date(attempt.attempted_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    {attempt.notes && (
                      <p className="text-slate-600 font-medium italic leading-relaxed py-0.5">
                        "{attempt.notes}"
                      </p>
                    )}
                    <p className="text-[9px] font-bold text-zinc-400 text-right">
                      Logged by: <span className="text-slate-500">{attempt.driver?.name ?? `Driver #${attempt.driver_id}`}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

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
              <>
                {(() => {
                  const isReserved = !!order.reserved_by_user_id;
                  const isReservedByMe = order.reserved_by_user_id === myId;
                  const reservedByName = order.reserved_by_driver?.name ?? "Another Driver";
                  const isTouched = !!order.last_released_by_user_id;

                  if (isReservedByMe) {
                    return (
                      <div className="space-y-2">
                        {order.my_handover_pin && (
                          <div className="flex flex-col gap-1.5 bg-[#0052cc]/5 border border-[#0052cc]/20 rounded-xl p-3 text-left mb-1.5">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-bold text-[#0052cc] uppercase tracking-wider flex items-center gap-1">
                                <Key className="h-3.5 w-3.5" /> Handover Verification PIN
                              </span>
                              <span className="bg-[#0052cc] text-white text-base font-black px-2.5 py-1 rounded-lg tracking-widest">{order.my_handover_pin}</span>
                            </div>
                            <p className="text-[10px] font-bold text-slate-500 leading-tight">
                              Show this PIN to the releasing driver. They must enter it on their screen to confirm the handover.
                            </p>
                          </div>
                        )}
                        {order.reserved_at && (
                          <div className="flex items-center justify-between bg-zinc-50 border border-zinc-150 rounded-xl px-3 py-2 text-left mb-1.5">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">⏰ Handover Deadline</span>
                            <HandoverCountdown reservedAt={order.reserved_at} onExpired={onHandoverExpired} />
                          </div>
                        )}
                        <Button
                          onClick={onConfirmReceipt}
                          disabled={isClaimLoading}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[11px] tracking-wider h-11 rounded-xl border-none shadow-md"
                        >
                          {isClaimLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                          Confirm Physical Package Receipt
                        </Button>
                        <Button
                          onClick={onRelease}
                          disabled={isReleaseLoading}
                          variant="outline"
                          className="w-full border-red-200 text-red-500 hover:bg-red-50 font-bold text-[10px] h-9 rounded-xl uppercase tracking-wider"
                        >
                          Cancel Reservation
                        </Button>
                      </div>
                    );
                  }

                  if (isReserved) {
                    return (
                      <Button
                        disabled
                        className="w-full bg-zinc-100 text-zinc-400 font-black uppercase text-[11px] tracking-wider h-11 rounded-xl cursor-not-allowed border border-zinc-200"
                      >
                        <Lock className="h-4 w-4 mr-2" /> Reserved by {reservedByName}
                      </Button>
                    );
                  }

                  if (isTouched) {
                    // Check if the current driver is blocked (released this order < 24 hrs ago)
                    const didIRelease = order.last_released_by_user_id === myId;
                    let hoursRemaining = 0;
                    if (didIRelease && order.last_released_at) {
                      let releasedStr = order.last_released_at;
                      if (!releasedStr.includes("T") && !releasedStr.includes("Z") && !releasedStr.includes("+")) {
                        releasedStr = releasedStr.replace(" ", "T") + "Z";
                      }
                      const elapsed = (Date.now() - new Date(releasedStr).getTime()) / 3600000;
                      hoursRemaining = Math.max(0, Math.ceil(24 - elapsed));
                    }

                    if (didIRelease && !cooldownExpired && order.last_released_at) {
                      let releasedStr = order.last_released_at;
                      if (!releasedStr.includes("T") && !releasedStr.includes("Z") && !releasedStr.includes("+")) {
                        releasedStr = releasedStr.replace(" ", "T") + "Z";
                      }
                      const elapsedMs = Date.now() - new Date(releasedStr).getTime();
                      const isCooldownActive = elapsedMs < 24 * 60 * 60 * 1000;

                      if (isCooldownActive) {
                        // Self-blocked: show a clear, non-clickable message
                        return (
                          <div className="w-full bg-red-50 border border-red-200 rounded-xl px-3 py-3 flex items-start gap-2.5 text-left">
                            <span className="text-red-500 text-base shrink-0 mt-0.5">❌</span>
                            <p className="text-[11px] font-bold text-red-700 leading-snug">
                              You released or logged a failure on this order recently. You cannot secure/reserve it again for the next 24 hours.{" "}
                              <ReleaseCooldown lastReleasedAt={order.last_released_at} onTimeout={() => setCooldownExpired(true)} />
                            </p>
                          </div>
                        );
                      }
                    }

                    return (
                      <Button
                        onClick={onReserve}
                        disabled={isReserveLoading}
                        className="w-full bg-[#0052cc] hover:bg-[#003d99] text-white font-black uppercase text-[11px] tracking-wider h-11 rounded-xl border-none shadow-md"
                      >
                        {isReserveLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <MapPin className="h-4 w-4 mr-2" />}
                        Reserve This Order
                      </Button>
                    );
                  }

                  // Untouched orders: claim directly in 1 click
                  return (
                    <Button
                      onClick={onClaim}
                      disabled={isClaimLoading}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[11px] tracking-wider h-11 rounded-xl border-none shadow-md"
                    >
                      {isClaimLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                      Secure Order (SLA Starts)
                    </Button>
                  );
                })()}
              </>
            )}

            {tab === "mine" && (
              <>
                {/* PIN Locked Banner */}
                {!!order.pin_locked && (
                  <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                    <Lock className="h-4 w-4 text-red-600 shrink-0" />
                    <div className="text-left min-w-0">
                      <p className="text-[10px] font-black text-red-700 uppercase tracking-wider">Order Locked</p>
                      <p className="text-[11px] font-bold text-red-600 leading-snug">3 wrong PIN attempts. Contact supervisor to unlock.</p>
                    </div>
                  </div>
                )}

                {(() => {
                  const isLocal = isLocalDelivery(order);
                  const isPinLocked = !!order.pin_locked;
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
                      disabled={isMarkLoading || !manifestChecked[order.id] || isPinLocked}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[11px] tracking-wider h-11 rounded-xl disabled:opacity-40 disabled:pointer-events-none"
                    >
                      {isPinLocked
                        ? <><Lock className="h-4 w-4 mr-2" /> PIN Locked — Contact Supervisor</>
                        : <><Key className="h-4 w-4 mr-2" /> Verify PIN &amp; Deliver</>
                      }
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
          <div className="flex justify-between items-start">
            <span className="text-zinc-400 font-bold">Destination</span>
            <div className="text-right">
              <span className="font-bold text-slate-700">{order.shipping_city}</span>
              {order.shipping_address && (
                <p className="text-[10px] text-zinc-650 font-extrabold mt-0.5 max-w-[200px] leading-snug">{order.shipping_address}</p>
              )}
            </div>
          </div>
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
