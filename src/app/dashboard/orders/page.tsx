"use client";

import { useEffect, useState, useMemo, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { ShippingMethodBadge } from "@/components/ui/shipping-method-badge";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  EyeOff,
  Truck,
  Loader2,
  Download,
  CheckCircle2,
  ArrowRightLeft,
  MapPin,
  Calendar,
  CheckSquare,
  Square,
  Package,
  RefreshCw,
  FileText,
  Trash2,
  ShoppingBag,
  User,
  UserPlus,
  CreditCard,
  Pencil,
  Home,
  Minus,
  Plus
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import api from "@/lib/axios";
import { API_ENDPOINTS } from "@/lib/apis";
import { SearchableDropdown } from "@/components/ui/searchable-dropdown";
import { toast } from "react-hot-toast";
import { exportOrdersPDF } from "@/lib/pdf-export";
import { useSettings } from "@/components/providers/SettingsProvider";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { buildFilterCityOptions, buildFilterCountryOptions, PREDEFINED_CITIES } from "@/lib/shipping-locations";
import { AlertTriangle, ShieldAlert } from "lucide-react";

/** Label for walk-in filter/table — mirrors Destination City + Delivery Address from the order form */
function getWalkInDestinationLabel(order: {
  shipping_method?: string;
  shipping_city?: string;
  shipping_address?: string;
}): string {
  const city = (order.shipping_city || "").trim();
  const address = (order.shipping_address || "").trim();

  if (order.shipping_method === "Pickup") {
    if (city && address) return `${city} · ${address}`;
    return "In-Store · Walk-In Counter";
  }

  if (city && address) return `${city} · ${address}`;
  if (city) return city;
  if (address) return address;
  return "";
}

function isOrderVoided(order: { status?: string; payment_status?: string }): boolean {
  return order.status === "Cancelled" || order.payment_status === "Refunded";
}

/**
 * Validates that a string is a genuine Safaricom M-Pesa receipt code.
 * Real codes: 10–12 uppercase alphanumeric like "UGR2B10EHE".
 * Rejects: phone numbers (pure digits), placeholder "MPESA-..." / "MPESA ...", short codes.
 */
function isRealMpesaReceipt(code: string | null | undefined): boolean {
  if (!code) return false;
  const trimmed = code.trim().toUpperCase();
  if (trimmed.startsWith('MPESA')) return false;
  if (/^\d+$/.test(trimmed)) return false;
  if (!/^[A-Z0-9]{8,16}$/.test(trimmed)) return false;
  return true;
}

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

/** Compares warehouse origin name vs shipping destination city to decide
 *  if this is a same-city "Local Shipment" (e.g. Nairobi → Nairobi) or a
 *  cross-city "Shipment" (e.g. Nairobi → Mombasa).
 *
 *  Rule: if the WORD used for origin and destination match (case-insensitive,
 *  either one is a substring of the other) → Local Shipment.
 *  e.g. "nairobi warehouse" contains "nairobi" → Local
 *       "nairobi" is contained in "nairobi cbd" → Local
 *       "nairobi" vs "mombasa" → no match → Cross-City Shipment */
function getShipmentRouteCities(order: any): { origin: string; destination: string } {
  // Warehouse has no 'city' field — use 'name' (e.g. "Nairobi Warehouse")
  const origin = (order.items?.[0]?.warehouse?.name || "").trim().toLowerCase();
  const destination = (order.shipping_city || "").trim().toLowerCase();
  return { origin, destination };
}

function isLocalShipmentRoute(order: any): boolean {
  const { origin, destination } = getShipmentRouteCities(order);
  if (!origin || !destination) return false;
  // Bidirectional substring match, case-insensitive (both already lowercased)
  return origin.includes(destination) || destination.includes(origin);
}

/**
 * Returns the total amount already refunded for an order.
 * Uses the backend-persisted `refunded_amount` field which accurately
 * accumulates product cost + proportional shipping across all cancellations.
 * Falls back to a client-side calculation if the field is missing (legacy data).
 */
function getOrderRefundedTotal(order: any): number {
  if (!order) return 0;
  // Use authoritative backend value when available
  if (order.refunded_amount !== undefined && order.refunded_amount !== null) {
    return Number(order.refunded_amount || 0);
  }
  // Legacy fallback: proportional calculation from items
  if (!order.items) return 0;
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

function getWalkInPayStatusDisplay(order: { status?: string; payment_status?: string }) {
  if (isOrderVoided(order)) {
    return { label: "Cancelled / Refunded", className: "bg-red-100 text-red-700" };
  }
  if (order.payment_status === "Paid") {
    return { label: "Paid", className: "bg-emerald-100 text-emerald-700" };
  }
  return { label: order.payment_status || "Pending", className: "bg-amber-100 text-amber-700" };
}

function AdminOrdersPageInner() {
  const { settings } = useSettings();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [secondsSinceSync, setSecondsSinceSync] = useState(0);

  // Incident state and quick action handlers
  const [previousIncidentIds, setPreviousIncidentIds] = useState<number[]>([]);
  const [isIncidentActionLoading, setIsIncidentActionLoading] = useState<Record<number, boolean>>({});
  const [incidentSearch, setIncidentSearch] = useState("");
  const [incidentFilter, setIncidentFilter] = useState<"all" | "locked" | "failed">("all");

  const activeIncidents = useMemo(() => {
    if (!Array.isArray(orders)) return [];
    return orders.filter(o =>
      (o.pin_locked || (o.failed_attempts_count && o.failed_attempts_count > 0)) &&
      o.status !== "Delivered" &&
      o.status !== "Cancelled" &&
      o.status !== "Returned"
    );
  }, [orders]);

  const filteredIncidents = useMemo(() => {
    let list = activeIncidents;
    // Filter by type
    if (incidentFilter === "locked") list = list.filter(o => !!o.pin_locked);
    else if (incidentFilter === "failed") list = list.filter(o => !o.pin_locked && o.failed_attempts_count > 0);
    // Filter by search query
    if (incidentSearch.trim()) {
      const q = incidentSearch.toLowerCase().trim();
      list = list.filter(o =>
        o.tracking_number?.toLowerCase().includes(q) ||
        o.customer?.name?.toLowerCase().includes(q) ||
        o.driver?.name?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [activeIncidents, incidentFilter, incidentSearch]);

  // Audio alert chime using web audio api when a new incident arrives
  useEffect(() => {
    if (activeIncidents.length > 0) {
      const currentIds = activeIncidents.map(o => o.id);
      const hasNew = currentIds.some(id => !previousIncidentIds.includes(id));
      if (hasNew) {
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(440, ctx.currentTime);
          osc.frequency.setValueAtTime(554, ctx.currentTime + 0.15);
          osc.frequency.setValueAtTime(440, ctx.currentTime + 0.3);

          gain.gain.setValueAtTime(0.15, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.45);
        } catch (e) { /* ignore audio blocked */ }
        setPreviousIncidentIds(currentIds);
        // Auto-switch to Security tab so admin immediately sees the new incident
        setActiveOrdersTab("Security");
      } else {
        // If there are no new incidents, but the list changed (e.g. an incident was resolved)
        const isDifferent = previousIncidentIds.length !== currentIds.length ||
          previousIncidentIds.some(id => !currentIds.includes(id));
        if (isDifferent) {
          setPreviousIncidentIds(currentIds);
        }
      }
    } else {
      if (previousIncidentIds.length > 0) {
        setPreviousIncidentIds([]);
        // All incidents resolved — switch back to Shipment tab if still on Security
        setActiveOrdersTab(prev => prev === "Security" ? "Shipment" : prev);
      }
    }
  }, [activeIncidents, previousIncidentIds]);

  const handleUnlockPin = async (id: number) => {
    setIsIncidentActionLoading(prev => ({ ...prev, [id]: true }));
    try {
      const res = await api.post(`/orders/${id}/unlock-pin`);
      toast.success(res.data.message || "Lockout resolved successfully!");
      fetchOrders(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to unlock PIN.");
    } finally {
      setIsIncidentActionLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleRegeneratePin = async (id: number) => {
    setIsIncidentActionLoading(prev => ({ ...prev, [id]: true }));
    try {
      const res = await api.post(`/orders/${id}/regenerate-pin`);
      toast.success(res.data.message || "PIN regenerated successfully!");
      fetchOrders(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to regenerate PIN.");
    } finally {
      setIsIncidentActionLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  useEffect(() => {
    const status = searchParams ? searchParams.get("status") : null;
    if (status) {
      setStatusFilter(status);
    }
  }, [searchParams]);

  // Advanced Filters — Shipment Orders (completely isolated from Walk-In)
  const [shipmentSearchQuery, setShipmentSearchQuery] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [shipmentDateFrom, setShipmentDateFrom] = useState("");
  const [shipmentDateTo, setShipmentDateTo] = useState("");

  // Advanced Filters — Walk-In Orders (completely isolated from Shipment)
  const [walkInSearchQuery, setWalkInSearchQuery] = useState("");
  const [walkInWarehouseFilter, setWalkInWarehouseFilter] = useState("all");
  const [walkInDestFilter, setWalkInDestFilter] = useState("all");
  const [walkInDateFrom, setWalkInDateFrom] = useState("");
  const [walkInDateTo, setWalkInDateTo] = useState("");

  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [activeCities, setActiveCities] = useState<any[]>([]);
  const [countriesData, setCountriesData] = useState<any[]>([]);

  // Selection
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const currentSelectedOrder = useMemo(() => {
    if (!selectedOrder) return null;
    return orders.find(o => o.id === selectedOrder.id) || selectedOrder;
  }, [orders, selectedOrder]);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  // Full order detail (fetched individually to include delivery_signature_url, delivery_photo_url)
  const [fetchedOrderDetail, setFetchedOrderDetail] = useState<any>(null);

  // Handover History / Timeline state
  const [handoverHistory, setHandoverHistory] = useState<any[]>([]);
  const [loadingHandoverHistory, setLoadingHandoverHistory] = useState(false);

  useEffect(() => {
    if (isOrderModalOpen && currentSelectedOrder?.id) {
      setLoadingHandoverHistory(true);
      setHandoverHistory([]);
      // Fetch full order detail to get delivery_signature_url, delivery_photo_url, etc.
      api.get(API_ENDPOINTS.orders.byId(currentSelectedOrder.id))
        .then(res => setFetchedOrderDetail(res.data))
        .catch(() => setFetchedOrderDetail(null));
      api.get(`/orders/${currentSelectedOrder.id}/handover-history`)
        .then(res => {
          setHandoverHistory(res.data || []);
        })
        .catch(err => {
          console.warn("Failed to load handover history:", err?.message || err);
        })
        .finally(() => {
          setLoadingHandoverHistory(false);
        });
    } else {
      setHandoverHistory([]);
    }
  }, [isOrderModalOpen, currentSelectedOrder?.id]);

  // POS / Walk-in Order State
  const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("walkin");
  const [customerSearch, setCustomerSearch] = useState("");
  const [newCustomerData, setNewCustomerData] = useState({
    name: "",
    company_name: "",
    email: "",
    phone: "",
    secondary_phone: "",
    tax_id: "",
    address: "",
    type: "Retail",
    password: "",
    confirmPassword: ""
  });

  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");
  const [addQuantity, setAddQuantity] = useState<number>(1);

  const [paymentMethod, setPaymentMethod] = useState<string>("Cash");
  const [paymentRefCode, setPaymentRefCode] = useState<string>("");
  const [registerAccount, setRegisterAccount] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [activeOrdersTab, setActiveOrdersTab] = useState<"Shipment" | "WalkIn" | "LocalShipment" | "Security">("Shipment");

  const [paymentStatus, setPaymentStatus] = useState<string>("Paid");
  const [shippingMethod, setShippingMethod] = useState<string>("Pickup");
  const [shippingFee, setShippingFee] = useState<number>(0);
  const [shippingCountry, setShippingCountry] = useState<string>("");
  const [shippingCity, setShippingCity] = useState<string>("");
  const [shippingAddress, setShippingAddress] = useState<string>("");
  // Recipient info — required when walk-in guest selects Dispatch/Shipping
  const [recipientName, setRecipientName] = useState<string>("");
  const [recipientPhone, setRecipientPhone] = useState<string>("");
  const [recipientEmail, setRecipientEmail] = useState<string>("");
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [voidOrderTarget, setVoidOrderTarget] = useState<any>(null);
  const [selectedVoidItemIds, setSelectedVoidItemIds] = useState<number[]>([]);
  const [voidQuantities, setVoidQuantities] = useState<Record<number, number>>({});
  const [isVoidDialogOpen, setIsVoidDialogOpen] = useState(false);
  const [isVoiding, setIsVoiding] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [voidTransactionId, setVoidTransactionId] = useState("");
  const [refundPaymentMethod, setRefundPaymentMethod] = useState("M-Pesa Express");
  const [walkInPayStatusFilter, setWalkInPayStatusFilter] = useState("All");
  const [walkInOrderStatusFilter, setWalkInOrderStatusFilter] = useState("All Status");
  // PIN reveal toggle in order details modal
  const [showDeliveryPin, setShowDeliveryPin] = useState(false);

  // Mark Payment as Pending Confirmation Dialog states
  const [isPendingConfirmOpen, setIsPendingConfirmOpen] = useState(false);
  const [pendingOrderTarget, setPendingOrderTarget] = useState<any>(null);
  const [isMarkingPending, setIsMarkingPending] = useState(false);

  // Edit Walk-In Order
  const [isEditWalkInModalOpen, setIsEditWalkInModalOpen] = useState(false);
  const [editWalkInTarget, setEditWalkInTarget] = useState<any>(null);
  const [editWalkInForm, setEditWalkInForm] = useState({
    payment_method: "",
    payment_ref_code: "",
    shipping_method: "",
    shipping_fee: 0,
    shipping_country: "",
    shipping_city: "",
    shipping_address: "",
  });
  const [isSavingEditWalkIn, setIsSavingEditWalkIn] = useState(false);

  // Mark-Paid Dialog
  const [isMarkPaidDialogOpen, setIsMarkPaidDialogOpen] = useState(false);
  const [markPaidTarget, setMarkPaidTarget] = useState<any>(null);
  const [markPaidMethod, setMarkPaidMethod] = useState<string>("Cash");
  const [markPaidRefCode, setMarkPaidRefCode] = useState<string>("");
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);

  // Cancellation and Refund Admin State
  const [isApproveCancelModalOpen, setIsApproveCancelModalOpen] = useState(false);
  const [isCompleteRefundModalOpen, setIsCompleteRefundModalOpen] = useState(false);
  const [refundTransactionId, setRefundTransactionId] = useState("");
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [updatingOrderIds, setUpdatingOrderIds] = useState<Record<number, boolean>>({});

  // Assign Driver State
  const [isAssignDriverModalOpen, setIsAssignDriverModalOpen] = useState(false);
  const [assignDriverTarget, setAssignDriverTarget] = useState<any>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string>("");
  const [drivers, setDrivers] = useState<any[]>([]);
  const [isAssigningDriver, setIsAssigningDriver] = useState(false);

  const handleOpenAssignDriver = (order: any) => {
    setAssignDriverTarget(order);
    setSelectedDriverId(order.delivered_by_user_id?.toString() || "");
    setIsAssignDriverModalOpen(true);
  };

  const handleAssignDriver = async () => {
    if (!assignDriverTarget) return;
    setIsAssigningDriver(true);
    try {
      const res = await api.post(API_ENDPOINTS.delivery.assignDriver(assignDriverTarget.id), {
        driver_user_id: selectedDriverId ? parseInt(selectedDriverId) : null,
      });
      toast.success(res.data.message || "Driver assigned successfully!");
      setIsAssignDriverModalOpen(false);
      setAssignDriverTarget(null);
      setSelectedDriverId("");
      fetchOrders(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to assign driver.");
    } finally {
      setIsAssigningDriver(false);
    }
  };

  const handleApproveCancel = async () => {
    if (!currentSelectedOrder) return;
    setIsProcessingAction(true);
    try {
      const res = await api.post(API_ENDPOINTS.orders.approveCancel(currentSelectedOrder.id));
      toast.success(res.data.message || "Cancellation approved. Refund marked as pending.");
      setIsApproveCancelModalOpen(false);
      fetchOrders(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to approve cancellation");
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleCompleteRefund = async () => {
    if (!currentSelectedOrder || !refundTransactionId.trim()) {
      toast.error("Transaction ID is required");
      return;
    }
    setIsProcessingAction(true);
    try {
      const res = await api.post(API_ENDPOINTS.orders.completeRefund(currentSelectedOrder.id), {
        refund_transaction_id: refundTransactionId
      });
      toast.success(res.data.message || "Refund marked as completed.");
      setIsCompleteRefundModalOpen(false);
      setRefundTransactionId("");
      fetchOrders(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to complete refund");
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleOpenEditWalkIn = (order: any) => {
    setEditWalkInTarget(order);

    let rawPaymentMethod = order.payment_method || "Cash";
    let rawRefCode = order.payment_ref_code || "";

    if (rawPaymentMethod.includes("(Ref: ")) {
      const match = rawPaymentMethod.match(/^(.*?)\s*\(Ref:\s*(.*?)\)$/);
      if (match) {
        rawPaymentMethod = match[1].trim();
        if (!rawRefCode) {
          rawRefCode = match[2].trim();
        }
      }
    }

    const shippingMethod = order.shipping_method || "Pickup";
    const shippingFee = parseFloat(order.shipping_fee || 0);
    const shippingCountry = order.shipping_country || "";
    const shippingCity = order.shipping_city === "In-Store" ? "" : (order.shipping_city || "");
    const shippingAddress = order.shipping_address === "Walk-In Counter" ? "" : (order.shipping_address || "");

    setEditWalkInForm({
      payment_method: rawPaymentMethod,
      payment_ref_code: rawRefCode,
      shipping_method: shippingMethod,
      shipping_fee: shippingFee,
      shipping_country: shippingCountry,
      shipping_city: shippingCity,
      shipping_address: shippingAddress,
    });
    setIsEditWalkInModalOpen(true);
  };

  const handleSaveEditWalkIn = async () => {
    if (!editWalkInTarget) return;
    setIsSavingEditWalkIn(true);
    try {
      const isDigital = isDigitalPayment(editWalkInForm.payment_method);
      const finalPaymentMethod = (isDigital && editWalkInForm.payment_ref_code.trim())
        ? `${editWalkInForm.payment_method} (Ref: ${editWalkInForm.payment_ref_code.trim()})`
        : editWalkInForm.payment_method;

      const payload = {
        ...editWalkInForm,
        payment_method: finalPaymentMethod,
        payment_ref_code: editWalkInForm.payment_ref_code.trim(),
        shipping_country: editWalkInForm.shipping_method === "Pickup" ? "" : editWalkInForm.shipping_country,
        shipping_city: editWalkInForm.shipping_method === "Pickup" ? "In-Store" : editWalkInForm.shipping_city,
        shipping_address: editWalkInForm.shipping_method === "Pickup" ? "Walk-In Counter" : editWalkInForm.shipping_address,
        shipping_fee: editWalkInForm.shipping_method === "Pickup" ? 0 : Number(editWalkInForm.shipping_fee || 0),
      };

      await api.put(API_ENDPOINTS.orders.byId(editWalkInTarget.id), payload);
      toast.success("Walk-In order updated successfully!");
      setIsEditWalkInModalOpen(false);
      setEditWalkInTarget(null);
      // Silent re-fetch — currentSelectedOrder (useMemo) will auto-update
      // the detail modal in real time without closing it.
      await fetchOrders(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update order.");
    } finally {
      setIsSavingEditWalkIn(false);
    }
  };

  const selectedProductDetails = useMemo(() => {
    return products.find(p => p.id.toString() === selectedProductId);
  }, [products, selectedProductId]);

  // ── Memoized Dropdown Item Arrays ───────────────────────────────────────────
  // These are computed once when the underlying data changes, not on every render.
  // This prevents SearchableDropdown from receiving a new array reference on every keystroke.
  const productDropdownItems = useMemo(() =>
    products.map((p: any) => ({
      id: p.id.toString(),
      name: `${p.name} — Ksh ${Number((p.is_on_offer && p.offer_price) ? p.offer_price : p.price).toLocaleString()}${p.is_on_offer && p.offer_price ? ' 🏷️' : ''}`
    })),
    [products]);

  const warehouseDropdownItems = useMemo(() =>
    (selectedProductDetails?.inventories || []).map((inv: any) => ({
      id: inv.warehouse_id.toString(),
      name: `${inv.warehouse?.name} (Stock: ${inv.quantity})`
    })),
    [selectedProductDetails]);

  const extractCityFromWarehouse = useCallback((warehouse: any): string => {
    if (!warehouse) return "";
    const name = (warehouse.name || "").trim();
    const loc = (warehouse.location || "").trim();
    const knownCities = ["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret", "Kampala", "Dar es Salaam", "Arusha", "Kigali"];
    for (const city of knownCities) {
      if (name.toLowerCase().includes(city.toLowerCase()) || loc.toLowerCase().includes(city.toLowerCase())) {
        return city;
      }
    }
    return loc || name;
  }, []);

  const activeOriginHubCity = useMemo(() => {
    if (orderItems.length > 0) {
      const warehouse = warehouses.find((w: any) => w.id === orderItems[0]?.warehouse_id);
      if (warehouse) return extractCityFromWarehouse(warehouse);
    }
    if (selectedWarehouseId) {
      const warehouse = warehouses.find((w: any) => w.id.toString() === selectedWarehouseId);
      if (warehouse) return extractCityFromWarehouse(warehouse);
    }
    return "";
  }, [orderItems, selectedWarehouseId, warehouses, extractCityFromWarehouse]);

  useEffect(() => {
    if (shippingMethod === "Local Delivery" && activeOriginHubCity) {
      const country = activeOriginHubCity === "Kampala" ? "Uganda" : (activeOriginHubCity === "Kigali" ? "Rwanda" : "Kenya");
      if (shippingCity !== activeOriginHubCity) {
        setShippingCountry(country);
        setShippingCity(activeOriginHubCity);
      }
    }
  }, [shippingMethod, activeOriginHubCity, shippingCity]);

  const editOriginHubCity = useMemo(() => {
    if (editWalkInTarget?.items && editWalkInTarget.items.length > 0) {
      const item = editWalkInTarget.items[0];
      const warehouse = item.warehouse || warehouses.find((w: any) => w.id === item.warehouse_id);
      if (warehouse) return extractCityFromWarehouse(warehouse);
    }
    return "";
  }, [editWalkInTarget, warehouses, extractCityFromWarehouse]);

  useEffect(() => {
    if (editWalkInForm.shipping_method === "Local Delivery" && editOriginHubCity) {
      const country = editOriginHubCity === "Kampala" ? "Uganda" : (editOriginHubCity === "Kigali" ? "Rwanda" : "Kenya");
      if (editWalkInForm.shipping_city !== editOriginHubCity) {
        setEditWalkInForm(prev => ({
          ...prev,
          shipping_country: prev.shipping_country || country,
          shipping_city: editOriginHubCity,
        }));
      }
    }
  }, [editWalkInForm.shipping_method, editOriginHubCity]);

  const countryDropdownItems = useMemo(() =>
    countriesData.map((c: any) => ({ id: c.name, name: c.name })),
    [countriesData]);

  const cityDropdownItems = useMemo(() => {
    if (!shippingCountry) return [];
    const found = countriesData.find((c: any) => c.name === shippingCountry);
    const cities: string[] = found?.cities?.length
      ? found.cities.map((ct: any) => ct.name)
      : (PREDEFINED_CITIES[shippingCountry] || []);
    return cities.sort((a, b) => a.localeCompare(b)).map(city => ({ id: city, name: city }));
  }, [countriesData, shippingCountry]);

  const editCountryDropdownItems = useMemo(() =>
    countriesData.map((c: any) => ({ id: c.name, name: c.name })),
    [countriesData]);

  const editCityDropdownItems = useMemo(() => {
    if (!editWalkInForm.shipping_country) return [];
    const found = countriesData.find((c: any) => c.name === editWalkInForm.shipping_country);
    const cities: string[] = found?.cities?.length
      ? found.cities.map((ct: any) => ct.name)
      : (PREDEFINED_CITIES[editWalkInForm.shipping_country] || []);
    return cities.sort((a, b) => a.localeCompare(b)).map(city => ({ id: city, name: city }));
  }, [countriesData, editWalkInForm.shipping_country]);

  const handleAddItemToOrder = useCallback(() => {
    if (!selectedProductId || !selectedWarehouseId) {
      toast.error("Please select a product and warehouse");
      return;
    }
    const product = products.find(p => p.id.toString() === selectedProductId);
    if (!product) return;

    const inventory = product.inventories?.find((i: any) => i.warehouse_id.toString() === selectedWarehouseId);
    const stockAvailable = inventory ? inventory.quantity : 0;
    const warehouseName = inventory?.warehouse?.name || "Selected Warehouse";

    if (addQuantity < 1) {
      toast.error("Quantity must be at least 1");
      return;
    }

    if (addQuantity > stockAvailable) {
      toast.error(`Insufficient stock! Only ${stockAvailable} items available.`);
      return;
    }

    // Check if item already exists in orderItems from this warehouse
    const existingIndex = orderItems.findIndex(
      item => item.product_id.toString() === selectedProductId && item.warehouse_id.toString() === selectedWarehouseId
    );

    if (existingIndex > -1) {
      const newQty = orderItems[existingIndex].quantity + addQuantity;
      if (newQty > stockAvailable) {
        toast.error(`Cannot add more. Total quantity exceeds stock limit of ${stockAvailable}`);
        return;
      }
      const updated = [...orderItems];
      updated[existingIndex].quantity = newQty;
      setOrderItems(updated);
    } else {
      setOrderItems([
        ...orderItems,
        {
          product_id: product.id,
          name: product.name,
          warehouse_id: parseInt(selectedWarehouseId),
          warehouse_name: warehouseName,
          quantity: addQuantity,
          price: (product.is_on_offer && product.offer_price) ? parseFloat(product.offer_price) : parseFloat(product.price),
          stock: stockAvailable
        }
      ]);
    }

    // Reset selectors
    setSelectedProductId("");
    setSelectedWarehouseId("");
    setAddQuantity(1);
    toast.success("Item added to order list");
  }, [selectedProductId, selectedWarehouseId, products, orderItems, addQuantity]);

  const handleRemoveItemFromOrder = useCallback((index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  }, [orderItems]);

  const generateWalkInRef = useCallback(() => {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `WK-${ts}-${rand}`;
  }, []);

  const isDigitalPayment = useCallback((method: string) => ["M-Pesa", "Card", "Bank Transfer"].includes(method), []);

  const resetWalkInFormFields = useCallback(() => {
    setShippingCountry("");
    setShippingCity("");
    setShippingAddress("");
    setShippingFee(0);
    setShippingMethod("Pickup");
    setPaymentStatus("Paid");
    setPaymentMethod("Cash");
    setPaymentRefCode("");
    setRecipientName("");
    setRecipientPhone("");
    setRecipientEmail("");
  }, []);

  // Open the payment-method selection dialog before confirming mark-paid
  const handleMarkWalkInPaid = useCallback((order: any) => {
    setMarkPaidTarget(order);
    setMarkPaidMethod(order.payment_method || "Cash");
    setMarkPaidRefCode(order.payment_ref_code || "");
    setIsMarkPaidDialogOpen(true);
  }, []);

  const handleConfirmMarkPaid = async () => {
    if (!markPaidTarget) return;
    const isDigital = ["M-Pesa", "Card", "Bank Transfer"].includes(markPaidMethod);
    if (isDigital && !markPaidRefCode.trim()) {
      toast.error("Please enter the transaction / reference code");
      return;
    }
    setIsMarkingPaid(true);
    try {
      // Only update payment fields — NEVER touch status (shipment flow is independent)
      await api.put(API_ENDPOINTS.orders.byId(markPaidTarget.id), {
        payment_status: "Paid",
        payment_method: markPaidMethod,
        ...(markPaidRefCode.trim() ? { payment_ref_code: markPaidRefCode.trim() } : {}),
      });
      toast.success(`Payment confirmed via ${markPaidMethod}`);
      setIsMarkPaidDialogOpen(false);
      setMarkPaidTarget(null);
      fetchOrders(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Update failed");
    } finally {
      setIsMarkingPaid(false);
    }
  };

  const handleMarkWalkInPending = (order: any) => {
    setPendingOrderTarget(order);
    setIsPendingConfirmOpen(true);
  };

  const confirmMarkWalkInPending = async () => {
    if (!pendingOrderTarget) return;
    setIsMarkingPending(true);
    try {
      // NOTE: Only update payment_status — NEVER touch status (shipment flow is independent)
      await api.put(API_ENDPOINTS.orders.byId(pendingOrderTarget.id), { payment_status: "Pending" });
      toast.success("Payment marked as Pending");
      setIsPendingConfirmOpen(false);
      setPendingOrderTarget(null);
      fetchOrders(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Update failed");
    } finally {
      setIsMarkingPending(false);
    }
  };

  const handleOpenVoidDialog = (order: any) => {
    setVoidOrderTarget(order);
    setVoidReason("");
    setVoidTransactionId("");
    const activeItems = (order.items || [])
      .filter((item: any) => item.cancellation_status !== "Cancelled");
    const activeItemIds: number[] = [];
    setSelectedVoidItemIds(activeItemIds);

    const initialQuantities: Record<number, number> = {};
    activeItems.forEach((item: any) => {
      initialQuantities[item.id] = item.quantity;
    });
    setVoidQuantities(initialQuantities);

    setIsVoidDialogOpen(true);
  };

  const handleConfirmVoidRefund = async () => {
    if (!voidOrderTarget) return;
    if (selectedVoidItemIds.length === 0) {
      toast.error("Please select at least one product to cancel / refund.");
      return;
    }
    if (!voidReason.trim()) {
      toast.error("Please enter a void/refund reason.");
      return;
    }
    if (!voidTransactionId.trim()) {
      toast.error("Please enter the refund evidence (transaction ID).");
      return;
    }
    setIsVoiding(true);
    try {
      const res = await api.post(API_ENDPOINTS.orders.voidRefund(voidOrderTarget.id), {
        reason: voidReason,
        refund_transaction_id: voidTransactionId,
        refund_payment_method: refundPaymentMethod,
        cancel_item_ids: selectedVoidItemIds,
        cancel_items: selectedVoidItemIds.map(id => ({
          id,
          quantity: voidQuantities[id] || 1
        })),
      });
      const refunded = parseFloat(res.data?.refunded_amount ?? voidOrderTarget.total_amount ?? 0);
      toast.success(
        `Order ${voidOrderTarget.tracking_number} refund processed. Ksh ${refunded.toLocaleString()} refunded — stock restored to warehouse.`
      );
      setIsVoidDialogOpen(false);
      setVoidOrderTarget(null);
      setVoidReason("");
      setVoidTransactionId("");
      setSelectedVoidItemIds([]);
      await fetchOrders(true);
      await fetchMetadata();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to void order. Please try again.");
    } finally {
      setIsVoiding(false);
    }
  };

  const handleSubmitWalkInOrder = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (orderItems.length === 0) {
      toast.error("Please add at least one item to the order.");
      return;
    }

    if (shippingMethod === "Local Delivery") {
      if (!shippingCountry.trim()) {
        toast.error("Please select a destination country.");
        return;
      }
      if (!shippingCity.trim()) {
        toast.error("Please select a destination city.");
        return;
      }
      if (!shippingAddress.trim()) {
        toast.error("Please enter delivery address.");
        return;
      }
      // Recipient info required for walk-in guests on dispatch
      if (selectedCustomerId === "walkin") {
        if (!recipientName.trim()) {
          toast.error("Recipient name is required for walk-in dispatch orders.");
          return;
        }
        if (!recipientPhone.trim()) {
          toast.error("Recipient phone is required for walk-in dispatch orders.");
          return;
        }
        const phoneDigits = recipientPhone.replace(/\D/g, "");
        if (!/^(?:254|0)?(7|1)\d{8}$/.test(phoneDigits)) {
          toast.error("Please enter a valid Kenyan phone number (e.g., 0712345678 or 254712345678).");
          return;
        }
      }
    }

    // Digital payment ref validation
    if (isDigitalPayment(paymentMethod) && !paymentRefCode.trim()) {
      toast.error(`Please enter the ${paymentMethod} reference code.`);
      return;
    }

    // New customer registration validation — Name, Phone, Email, Password are COMPULSORY
    if (selectedCustomerId === "new") {
      if (!newCustomerData.name?.trim()) {
        toast.error("Customer Name is required.");
        return;
      }
      if (!newCustomerData.phone?.trim()) {
        toast.error("Phone Number is required.");
        return;
      }
      const cleanedPhone = newCustomerData.phone.replace(/[\s\-\(\)]/g, "");
      const phoneRx = /^\+?[0-9]{7,15}$/;
      if (!phoneRx.test(cleanedPhone)) {
        toast.error("Phone number must be valid (e.g., +254 7XXXXXXXX or 07XXXXXXXX).");
        return;
      }
      if (!newCustomerData.email?.trim()) {
        toast.error("Email Address is required for new customer registration.");
        return;
      }
      const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRx.test(newCustomerData.email.trim())) {
        toast.error("Please enter a valid email address.");
        return;
      }
      if (!newCustomerData.password) {
        toast.error("Password is required for new customer registration.");
        return;
      }
      if (newCustomerData.password.length < 8) {
        toast.error("Password must be at least 8 characters.");
        return;
      }
      if (newCustomerData.password !== newCustomerData.confirmPassword) {
        toast.error("Passwords do not match.");
        return;
      }
    }

    setIsSavingOrder(true);
    try {
      let targetCustomerId: number | null = null;

      if (selectedCustomerId === "walkin") {
        const existingWalkIn = customers.find(c => c.name.toLowerCase() === "walk-in customer");
        if (existingWalkIn) {
          targetCustomerId = existingWalkIn.id;
        } else {
          const payload = {
            name: "Walk-In Customer",
            phone: "0700000000",
            address: "Walk-In Counter",
            type: "Retail"
          };
          const res = await api.post(API_ENDPOINTS.customers.base, payload);
          targetCustomerId = res.data.id;
        }
      } else if (selectedCustomerId === "new") {
        const customerPayload: any = {
          name: newCustomerData.name,
          email: newCustomerData.email?.trim() || undefined,
          phone: newCustomerData.phone?.trim() || undefined,
          address: newCustomerData.address?.trim() || undefined,
          company_name: newCustomerData.company_name?.trim() || undefined,
          type: newCustomerData.type || "Retail",
          password: newCustomerData.password || undefined,
          password_confirmation: newCustomerData.confirmPassword || undefined,
        };
        const res = await api.post(API_ENDPOINTS.customers.base, customerPayload);
        targetCustomerId = res.data.id;
      } else {
        targetCustomerId = parseInt(selectedCustomerId);
      }

      if (!targetCustomerId) throw new Error("Unable to resolve customer ID");

      const totalItemsCost = orderItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
      const totalAmount = totalItemsCost + Number(shippingFee);
      const finalPaymentMethod = isDigitalPayment(paymentMethod)
        ? `${paymentMethod} (Ref: ${paymentRefCode.trim()})`
        : paymentMethod;
      const walkInRef = generateWalkInRef();

      const orderPayload: any = {
        customer_id: targetCustomerId,
        tracking_number: walkInRef,
        total_amount: totalAmount,
        // Pickup = customer takes goods immediately → Delivered
        // Local Delivery = needs to be dispatched → Pending
        status: shippingMethod === "Pickup" ? "Delivered" : "Pending",
        payment_status: paymentStatus,
        payment_method: finalPaymentMethod,
        shipping_method: shippingMethod,
        shipping_fee: shippingFee,
        shipping_country: shippingMethod === "Pickup" ? "" : shippingCountry.trim(),
        shipping_city: shippingMethod === "Pickup" ? "In-Store" : shippingCity.trim(),
        shipping_address: shippingMethod === "Pickup" ? "Walk-In Counter" : shippingAddress.trim(),
        items: orderItems.map(item => ({
          product_id: item.product_id,
          warehouse_id: item.warehouse_id,
          quantity: item.quantity,
          price: item.price
        }))
      };
      // Attach recipient / customer info for all walk-in guest orders (dispatch or pickup)
      if (selectedCustomerId === "walkin" && (recipientName.trim() || recipientPhone.trim() || recipientEmail.trim())) {
        orderPayload.notes = `Recipient: ${recipientName.trim()}${recipientPhone.trim() ? ` | Phone: ${recipientPhone.trim()}` : ""}${recipientEmail.trim() ? ` | Email: ${recipientEmail.trim()}` : ""}`;
      }

      await api.post(API_ENDPOINTS.orders.base, orderPayload);
      toast.success(`Walk-in order ${walkInRef} created successfully!`);
      setIsWalkInModalOpen(false);
      setOrderItems([]);
      setSelectedCustomerId("walkin");
      setPaymentRefCode("");
      setRegisterAccount(false);
      setNewCustomerData({ name: "", company_name: "", email: "", phone: "", secondary_phone: "", tax_id: "", address: "", type: "Retail", password: "", confirmPassword: "" });
      resetWalkInFormFields();
      fetchOrders();
      fetchMetadata();
    } catch (err: any) {
      console.warn("Failed to create walk-in order:", err?.message || err);
      toast.error(err.response?.data?.message || "Failed to submit walk-in order.");
    } finally {
      setIsSavingOrder(false);
    }
  }, [orderItems, shippingMethod, shippingCountry, shippingCity, shippingAddress, shippingFee, selectedCustomerId, recipientName, recipientPhone, recipientEmail, paymentMethod, paymentRefCode, paymentStatus, newCustomerData, customers, isDigitalPayment, generateWalkInRef, resetWalkInFormFields]);

  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // Always fetch ALL orders with no filters — filtering is done 100% client-side
      // so that shipment filters never affect the Walk-In data pool and vice versa.
      const res = await api.get(API_ENDPOINTS.orders.base, { params: { per_page: -1 } });
      setOrders(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      console.warn("Failed to fetch orders:", err?.message || err);
      toast.error("Failed to sync orders");
    } finally {
      if (!silent) setLoading(false);
    }
    setLastSyncedAt(new Date());
    setSecondsSinceSync(0);
  }, []);

  const fetchMetadata = async () => {
    try {
      const [wRes, cRes, pRes, locRes, dRes] = await Promise.all([
        api.get(API_ENDPOINTS.warehouses.base),
        api.get(API_ENDPOINTS.customers.base, { params: { per_page: -1 } }),
        api.get(API_ENDPOINTS.products.base, { params: { per_page: -1 } }),
        api.get(API_ENDPOINTS.locations.countries),
        api.get("/delivery-drivers"),
      ]);
      setWarehouses(wRes.data);
      setCustomers(cRes.data);
      setProducts(pRes.data);
      setCountriesData(locRes.data);
      setDrivers(dRes.data || []);
    } catch (err: any) {
      console.warn("Failed to fetch metadata:", err?.message || err);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, []);

  // Filter options — Shipment Orders
  const warehouseOptions = useMemo(() => [
    { id: "all", name: "Origin Warehouse" },
    ...warehouses.map(w => ({ id: w.id.toString(), name: w.name }))
  ], [warehouses]);

  const countryOptions = useMemo(() => {
    let base = orders.filter(o => !(o.tracking_number || "").startsWith("WK-"));
    if (warehouseFilter !== "all") {
      base = base.filter(o => o.items?.some((i: any) => i.warehouse_id.toString() === warehouseFilter));
    }
    const countries = base.map((o: any) => o.shipping_country).filter(Boolean) as string[];
    const pool = countries.length > 0 ? countries : countriesData.map((c) => c.name);
    return buildFilterCountryOptions(pool);
  }, [orders, warehouseFilter, countriesData]);

  const cityOptions = useMemo(() => {
    let base = orders.filter(o => !(o.tracking_number || "").startsWith("WK-"));
    if (warehouseFilter !== "all") {
      base = base.filter(o => o.items?.some((i: any) => i.warehouse_id.toString() === warehouseFilter));
    }
    if (countryFilter !== "all") {
      base = base.filter((o: any) => o.shipping_country?.toLowerCase() === countryFilter.toLowerCase());
    }
    const fallbackCities = base.map((o: any) => o.shipping_city).filter(Boolean) as string[];
    return buildFilterCityOptions(countryFilter, fallbackCities, countriesData);
  }, [orders, warehouseFilter, countryFilter, countriesData]);

  // Filter options — Walk-In Orders
  const walkInWarehouseOptions = useMemo(() => [
    { id: "all", name: "Source Warehouse" },
    ...warehouses.map(w => ({ id: w.id.toString(), name: w.name }))
  ], [warehouses]);

  const walkInDestOptions = useMemo(() => {
    let base = orders.filter(o => (o.tracking_number || "").startsWith("WK-"));
    if (walkInWarehouseFilter !== "all") {
      base = base.filter(o => o.items?.some((i: any) => i.warehouse_id.toString() === walkInWarehouseFilter));
    }
    const unique = Array.from(
      new Set(base.map((o: any) => getWalkInDestinationLabel(o)).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
    return [{ id: "all", name: "Destination / Address" }, ...unique.map((label) => ({ id: label, name: label }))];
  }, [orders, walkInWarehouseFilter]);

  // Legacy — kept for compatibility
  const dynamicCityOptions = useMemo(() => {
    let baseOrders = orders;
    if (warehouseFilter !== "all") {
      baseOrders = orders.filter(o => o.items?.some((i: any) => i.warehouse_id.toString() === warehouseFilter));
    }
    const destinations = Array.from(
      new Map(baseOrders.filter(o => o.shipping_city).map(o => [o.shipping_city, o.shipping_country])).entries()
    );
    return destinations.sort((a, b) => (a[0] as string).localeCompare(b[0] as string));
  }, [orders, warehouseFilter]);

  // Polling Effect
  useEffect(() => {
    fetchOrders();
    setSelectedOrderIds([]); // Reset selection on filter change
    const interval = setInterval(() => fetchOrders(true), 30000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  // Countdown Ticker Effect
  useEffect(() => {
    const ticker = setInterval(() => {
      if (lastSyncedAt) {
        setSecondsSinceSync(Math.floor((Date.now() - lastSyncedAt.getTime()) / 1000));
      }
    }, 1000);
    return () => clearInterval(ticker);
  }, [lastSyncedAt]);

  const handleStatusChange = async (id: number, status: string) => {
    const statusRank: Record<string, number> = {
      Pending: 1, Processing: 2, Shipped: 3, Arrived: 4, Delivered: 5, Returned: 6, Cancelled: 6,
    };
    const order = orders.find((o: any) => o.id === id);
    const currentRank = statusRank[order?.status ?? ""] ?? 0;
    const newRank = statusRank[status] ?? 0;
    if (newRank < currentRank) {
      toast.error(`Cannot change status from "${order?.status}" to "${status}". Orders cannot be moved backwards.`);
      return;
    }
    setUpdatingOrderIds(prev => ({ ...prev, [id]: true }));
    try {
      const res = await api.put(API_ENDPOINTS.orders.byId(id), { status });
      toast.success(`Order marked as ${status}`);

      // Check SMS logs
      if (res.data?.sms_logs && res.data.sms_logs.length > 0) {
        res.data.sms_logs.forEach((log: any) => {
          if (!log.success) {
            toast.error(`SMS to ${log.phone} failed: ${log.error}`, { duration: 6000, icon: '⚠️' });
          } else {
            toast.success(`SMS alert sent to ${log.phone}!`);
          }
        });
      }

      fetchOrders(true);
    } catch (err: any) {
      console.warn("Failed to update status:", err?.message || err);
      const errMsg = err.response?.data?.message || "Status update failed";
      toast.error(errMsg, { duration: 8000 });
    } finally {
      setUpdatingOrderIds(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleBulkStatusChange = async (status: string) => {
    if (selectedOrderIds.length === 0) return;

    // Status progression rank — orders cannot be moved to a lower rank
    const statusRank: Record<string, number> = {
      Pending: 1, Processing: 2, Shipped: 3, Arrived: 4, Delivered: 5, Returned: 6, Cancelled: 6,
    };
    const targetRank = statusRank[status] ?? 0;

    // Filter: only include orders whose current status ranks lower than the target
    const eligibleIds = selectedOrderIds.filter((id) => {
      const order = orders.find((o: any) => o.id === id);
      const currentRank = statusRank[order?.status ?? ""] ?? 0;
      return currentRank < targetRank;
    });

    const skipped = selectedOrderIds.length - eligibleIds.length;

    if (eligibleIds.length === 0) {
      toast.error(`All selected orders are already at "${status}" or beyond — no changes made.`);
      return;
    }

    setIsBulkProcessing(true);
    try {
      const res = await api.post(API_ENDPOINTS.orders.bulkStatus, {
        order_ids: eligibleIds,
        status: status
      });
      const updated = res.data?.updated ?? eligibleIds.length;
      const blocked: string[] = res.data?.blocked ?? [];

      // Show success for updated orders
      if (updated > 0) {
        toast.success(`${updated} order(s) marked as ${status}.${skipped > 0 ? ` ${skipped} skipped (already Delivered/Cancelled).` : ""}`);
      }

      // Show a clear warning for every order blocked by a pending return request
      if (blocked.length > 0) {
        toast(
          `⚠️ ${blocked.length} order${blocked.length > 1 ? "s" : ""} blocked — pending return request must be resolved first:\n${blocked.join(", ")}`,
          {
            duration: 10000,
            icon: "🚫",
            style: {
              background: "#fffbeb",
              border: "1px solid #f59e0b",
              color: "#92400e",
              fontWeight: "600",
              fontSize: "13px",
              maxWidth: "480px",
            },
          }
        );
      }

      // If nothing was updated and nothing was skipped, only blocks happened
      if (updated === 0 && skipped === 0 && blocked.length > 0) {
        // The warning toasts above are enough — no extra toast needed
      } else if (updated === 0 && blocked.length === 0) {
        toast.error("No orders were updated.");
      }

      // Check SMS logs
      if (res.data?.sms_logs && res.data.sms_logs.length > 0) {
        res.data.sms_logs.forEach((log: any) => {
          if (!log.success) {
            toast.error(`SMS to ${log.phone} failed: ${log.error}`, { duration: 6000, icon: '⚠️' });
          } else {
            toast.success(`SMS alert sent to ${log.phone}!`);
          }
        });
      }

      setSelectedOrderIds([]);
      fetchOrders(true);
    } catch (err: any) {
      console.warn("Bulk update failed:", err?.message || err);
      toast.error("Bulk update failed");
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleExport = () => {
    if (orders.length === 0) return;

    const headers = ["Order Ref", "Customer", "Origin", "Destination", "Date", "Amount", "Status"];
    const csvData = orders.map(o => [
      o.tracking_number || `ORD-${o.id}`,
      o.customer?.name || "Guest",
      o.items?.[0]?.warehouse?.name || "N/A",
      o.shipping_city || "N/A",
      new Date(o.created_at).toLocaleDateString(),
      o.total_amount,
      o.status
    ]);

    const csvContent = [headers, ...csvData].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `orders_batch_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    if (orders.length === 0) {
      toast.error("No order available to export");
      return;
    }
    const isWalkIn = activeOrdersTab === "WalkIn";
    // A filter is "active" when the user explicitly selected a specific pay status.
    // In that case the PDF exports the current filtered set as-is (including Pending/Cancelled).
    // With no filter ("All"), only Paid walk-in orders are exported.
    const isFilterActive = isWalkIn && walkInPayStatusFilter !== "All";
    exportOrdersPDF(
      filteredOrders,
      settings.currency || "Ksh",
      settings.store_logo || undefined,
      settings.store_name || undefined,
      isWalkIn,
      {
        tagline: settings.store_tagline || undefined,
        address: settings.store_address || settings.physical_address || undefined,
        phone: settings.store_phone || settings.contact_phone || undefined,
        email: settings.store_email || settings.contact_email || undefined,
        website: settings.store_website || undefined,
        kraPin: settings.store_kra_pin || undefined,
        regNumber: settings.store_reg_number || undefined,
        branch: settings.store_branch || undefined,
      },
      isFilterActive
    );
    toast.success("PDF generated successfully");
  };

  const handleClearFilters = () => {
    setStatusFilter("All Status");
    setWarehouseFilter("all");
    setCountryFilter("all");
    setCityFilter("all");
    setShipmentDateFrom("");
    setShipmentDateTo("");
    setShipmentSearchQuery("");
  };

  const handleClearWalkInFilters = () => {
    setWalkInSearchQuery("");
    setWalkInPayStatusFilter("All");
    setWalkInOrderStatusFilter("All Status");
    setWalkInWarehouseFilter("all");
    setWalkInDestFilter("all");
    setWalkInDateFrom("");
    setWalkInDateTo("");
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Split orders into Shipment and Walk-In by tracking number prefix
  // const shipmentOrders = useMemo(() => orders.filter(o => !((o.tracking_number || "").startsWith("WK-"))), [orders]);
  // const localShipmentOrders = useMemo(() => orders.filter(o => (o.tracking_number || "").startsWith("WK-")), [orders]);
  // const walkInOrders = useMemo(() => orders.filter(o => (o.tracking_number || "").startsWith("WK-")), [orders]);
  // Split orders into Shipment / Local Shipment / Walk-In
  const nonWalkInOrders = useMemo(
    () => orders.filter(o => !((o.tracking_number || "").startsWith("WK-"))),
    [orders]
  );
  // Cross-city routes (e.g. Nairobi → Mombasa)
  const shipmentOrders = useMemo(
    () => nonWalkInOrders.filter(o => !isLocalShipmentRoute(o)),
    [nonWalkInOrders]
  );
  // Same-city routes (e.g. Nairobi → Nairobi)
  const localShipmentOrders = useMemo(
    () => nonWalkInOrders.filter(o => isLocalShipmentRoute(o)),
    [nonWalkInOrders]
  );
  const walkInOrders = useMemo(() => orders.filter(o => (o.tracking_number || "").startsWith("WK-")), [orders]);

  const filteredOrders = useMemo(() => {
    if (activeOrdersTab === "WalkIn") {
      // ── Walk-In filters — completely isolated ──────────────────────────────
      const sq = walkInSearchQuery.toLowerCase();
      return walkInOrders.filter(order => {
        const matchesProducts = order.items?.some((item: any) => {
          const prod = item.product;
          if (!prod) return false;
          return (
            (prod.part_number || "").toLowerCase().includes(sq) ||
            (prod.suitable_vehicle || "").toLowerCase().includes(sq) ||
            (prod.engine_model || "").toLowerCase().includes(sq) ||
            (prod.name || "").toLowerCase().includes(sq) ||
            (prod.sku || "").toLowerCase().includes(sq)
          );
        });
        const matchesSearch = !sq || (
          (order.tracking_number || "").toLowerCase().includes(sq) ||
          (order.customer?.name || "").toLowerCase().includes(sq) ||
          (order.customer?.email || "").toLowerCase().includes(sq) ||
          (order.customer?.phone || "").toLowerCase().includes(sq) ||
          (order.items?.[0]?.warehouse?.name || "").toLowerCase().includes(sq) ||
          getWalkInDestinationLabel(order).toLowerCase().includes(sq) ||
          (order.payment_method || "cash").toLowerCase().includes(sq) ||
          (order.payment_ref_code || "").toLowerCase().includes(sq) ||
          (order.notes || "").toLowerCase().includes(sq) ||
          matchesProducts
        );
        const matchesPayStatus = walkInPayStatusFilter === "All" ||
          (walkInPayStatusFilter === "Cancelled / Refunded"
            ? isOrderVoided(order)
            : order.payment_status === walkInPayStatusFilter);
        const matchesOrderStatus = walkInOrderStatusFilter === "All Status" ||
          (walkInOrderStatusFilter === "Refunded" ? (order.status === "Refunded" || order.payment_status === "Refunded" || order.payment_status === "Cancelled / Refunded" || getOrderRefundedTotal(order) > 0) : order.status === walkInOrderStatusFilter);
        const matchesWarehouse = walkInWarehouseFilter === "all" ||
          order.items?.some((i: any) => i.warehouse_id?.toString() === walkInWarehouseFilter);
        const matchesDest = walkInDestFilter === "all" ||
          getWalkInDestinationLabel(order) === walkInDestFilter;
        const orderDate = new Date(order.created_at).setHours(0, 0, 0, 0);
        const matchesDateFrom = !walkInDateFrom || orderDate >= new Date(walkInDateFrom).setHours(0, 0, 0, 0);
        const matchesDateTo = !walkInDateTo || orderDate <= new Date(walkInDateTo).setHours(0, 0, 0, 0);
        return matchesSearch && matchesPayStatus && matchesOrderStatus && matchesWarehouse && matchesDest && matchesDateFrom && matchesDateTo;
      });
    }

    // ── Shipment filters — completely isolated ─────────────────────────────
    // ── Shipment / Local Shipment filters — same filter set, different route pool ──
    const baseOrders = activeOrdersTab === "LocalShipment" ? localShipmentOrders : shipmentOrders;
    const sq = shipmentSearchQuery.toLowerCase();
    return baseOrders.filter(order => {
      const matchesProducts = order.items?.some((item: any) => {
        const prod = item.product;
        if (!prod) return false;
        return (
          (prod.part_number || "").toLowerCase().includes(sq) ||
          (prod.suitable_vehicle || "").toLowerCase().includes(sq) ||
          (prod.engine_model || "").toLowerCase().includes(sq) ||
          (prod.name || "").toLowerCase().includes(sq) ||
          (prod.sku || "").toLowerCase().includes(sq)
        );
      });
      const matchesSearch = !sq || (
        (order.tracking_number || "").toLowerCase().includes(sq) ||
        (order.customer?.name || "").toLowerCase().includes(sq) ||
        (order.customer?.email || "").toLowerCase().includes(sq) ||
        (order.customer?.phone || "").toLowerCase().includes(sq) ||
        (order.items?.[0]?.warehouse?.name || "").toLowerCase().includes(sq) ||
        (order.shipping_city || "").toLowerCase().includes(sq) ||
        (order.shipping_address || "").toLowerCase().includes(sq) ||
        (order.payment_ref_code || "").toLowerCase().includes(sq) ||
        matchesProducts
      );
      const matchesWarehouse = warehouseFilter === "all" ||
        order.items?.some((i: any) => i.warehouse_id?.toString() === warehouseFilter);
      const matchesCountry = countryFilter === "all" ||
        order.shipping_country?.toLowerCase() === countryFilter.toLowerCase();
      const matchesCity = cityFilter === "all" ||
        order.shipping_city?.toLowerCase() === cityFilter.toLowerCase();
      const matchesStatus = statusFilter === "All Status" ||
        (statusFilter === "Refunded" ? (order.status === "Refunded" || order.payment_status === "Refunded" || order.payment_status === "Cancelled / Refunded" || getOrderRefundedTotal(order) > 0) : order.status === statusFilter);
      const orderDate = new Date(order.created_at).setHours(0, 0, 0, 0);
      const matchesDateFrom = !shipmentDateFrom || orderDate >= new Date(shipmentDateFrom).setHours(0, 0, 0, 0);
      const matchesDateTo = !shipmentDateTo || orderDate <= new Date(shipmentDateTo).setHours(0, 0, 0, 0);
      return matchesSearch && matchesWarehouse && matchesCountry && matchesCity && matchesStatus && matchesDateFrom && matchesDateTo;
    });
  }, [
    activeOrdersTab,
    shipmentOrders, shipmentSearchQuery, localShipmentOrders, warehouseFilter, countryFilter, cityFilter, statusFilter, shipmentDateFrom, shipmentDateTo,
    walkInOrders, walkInSearchQuery, walkInWarehouseFilter, walkInDestFilter, walkInPayStatusFilter, walkInOrderStatusFilter, walkInDateFrom, walkInDateTo,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    activeOrdersTab,
    shipmentSearchQuery, warehouseFilter, countryFilter, cityFilter, statusFilter, shipmentDateFrom, shipmentDateTo,
    walkInSearchQuery, walkInWarehouseFilter, walkInDestFilter, walkInPayStatusFilter, walkInOrderStatusFilter, walkInDateFrom, walkInDateTo,
  ]);

  const totalPages = Math.ceil(filteredOrders.length / pageSize);
  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredOrders.slice(startIndex, startIndex + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  const statuses = ["All Status", "Pending", "Processing", "Shipped", "Arrived", "Delivered", "Returned", "Cancelled", "Cancellation Requested", "Refunded"];

  return (
    <div className="space-y-4 p-3 sm:p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Orders</h1>
          <p className="text-zinc-500 text-sm mt-1">Manage and dispatch customer orders across your logistics network.</p>
          {lastSyncedAt && (
            <div className="flex items-center gap-2 mt-2">
              <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full border transition-colors duration-300 ${secondsSinceSync < 15
                ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                : secondsSinceSync < 30
                  ? "text-amber-700 bg-amber-50 border-amber-200"
                  : "text-red-700 bg-red-50 border-red-200"
                }`}>
                <span className={`h-1.5 w-1.5 rounded-full animate-pulse ${secondsSinceSync < 15
                  ? "bg-emerald-500"
                  : secondsSinceSync < 30
                    ? "bg-amber-500"
                    : "bg-red-500"
                  }`} />
                {secondsSinceSync === 0 ? "Just synced" : `Last synced ${secondsSinceSync}s ago`} · Auto-refresh every 30s
              </span>
              <button
                onClick={() => fetchOrders()}
                className="text-[10px] font-bold text-[#0052cc] hover:text-[#0747a6] flex items-center gap-1 hover:underline underline-offset-2 transition-all"
              >
                <RefreshCw className="h-2.5 w-2.5" /> Refresh Now
              </button>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleExportPDF}
            disabled={loading || orders.length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm font-bold flex items-center gap-1.5 border-none text-xs sm:text-sm"
          >
            <FileText className="mr-1 h-4 w-4" /> {activeOrdersTab === "WalkIn" ? "Export Walk-In PDF" : "Export PDF"}
          </Button>
          {activeOrdersTab === "WalkIn" && (
            <Button
              onClick={() => { resetWalkInFormFields(); setIsWalkInModalOpen(true); }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm font-bold flex items-center gap-1.5 text-xs sm:text-sm"
            >
              <ShoppingBag className="h-4 w-4" /> New Walk-In
            </Button>
          )}
        </div>
      </div>


      {/* Tab Selector: Shipment / Local / Walk-In / Security Alerts */}
      <div className="flex border-b border-zinc-200 overflow-x-auto">
        <button
          onClick={() => setActiveOrdersTab("Shipment")}
          className={cn("px-6 py-3 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 shrink-0",
            activeOrdersTab === "Shipment" ? "border-[#0052cc] text-[#0052cc]" : "border-transparent text-zinc-500 hover:text-zinc-700"
          )}
        >
          <Truck className="h-4 w-4" /> Shipment Orders
          <span className="ml-1 bg-zinc-100 text-zinc-600 rounded-full px-2 py-0.5 text-[10px] font-black">{shipmentOrders.length}</span>
        </button>
        <button
          onClick={() => setActiveOrdersTab("LocalShipment")}
          className={cn("px-6 py-3 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 shrink-0",
            activeOrdersTab === "LocalShipment" ? "border-[#0052cc] text-[#0052cc]" : "border-transparent text-zinc-500 hover:text-zinc-700"
          )}
        >
          <Truck className="h-4 w-4" /> Local Shipment Orders
          <span className="ml-1 bg-zinc-100 text-zinc-600 rounded-full px-2 py-0.5 text-[10px] font-black">{localShipmentOrders.length}</span>
        </button>
        <button
          onClick={() => setActiveOrdersTab("WalkIn")}
          className={cn("px-6 py-3 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 shrink-0",
            activeOrdersTab === "WalkIn" ? "border-emerald-600 text-emerald-600" : "border-transparent text-zinc-500 hover:text-zinc-700"
          )}
        >
          <ShoppingBag className="h-4 w-4" /> Walk-In Orders
          <span className="ml-1 bg-emerald-50 text-emerald-700 rounded-full px-2 py-0.5 text-[10px] font-black">{walkInOrders.length}</span>
        </button>
        {/* Security Alerts tab — only appears when there are active incidents */}
        {activeIncidents.length > 0 && (
          <button
            onClick={() => setActiveOrdersTab("Security")}
            className={cn(
              "px-6 py-3 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 shrink-0",
              activeOrdersTab === "Security"
                ? "border-red-600 text-red-600"
                : "border-transparent text-red-500 hover:text-red-700"
            )}
          >
            <ShieldAlert className="h-4 w-4 animate-pulse" />
            Security Alerts
            <span className="ml-1 bg-red-100 text-red-700 rounded-full px-2 py-0.5 text-[10px] font-black animate-pulse">
              {activeIncidents.length}
            </span>
          </button>
        )}
      </div>

      {/* Filter Bar — Shipment / Local Shipment Orders */}
      {(activeOrdersTab === "Shipment" || activeOrdersTab === "LocalShipment") && (
        <div className="bg-white p-3 rounded-xl shadow-sm border border-zinc-100 flex flex-wrap lg:flex-nowrap items-center gap-2">
          {/* Search — full width on mobile/tablet, flexible on desktop */}
          <div className="relative w-full sm:flex-1 sm:min-w-[180px] lg:min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
            <Input placeholder="Search Ref, Customer, Route..." className="pl-9 h-9 border-zinc-200 focus-visible:ring-[#0052cc] rounded-lg text-xs font-semibold placeholder:text-zinc-400 shadow-none bg-zinc-50/50 w-full"
              value={shipmentSearchQuery} onChange={(e) => setShipmentSearchQuery(e.target.value)} />
          </div>
          {/* Origin Warehouse */}
          <div className="w-full sm:w-[calc(50%-4px)] lg:w-[150px] shrink-0">
            <SearchableDropdown
              items={warehouseOptions}
              value={warehouseFilter}
              onChange={(val) => { setWarehouseFilter(val); setCountryFilter("all"); setCityFilter("all"); }}
              placeholder="Origin Warehouse"
              className="h-9 text-xs"
            />
          </div>
          {/* Destination Country */}
          <div className="w-full sm:w-[calc(50%-4px)] lg:w-[150px] shrink-0">
            <SearchableDropdown
              items={countryOptions}
              value={countryFilter}
              onChange={(val) => { setCountryFilter(val); setCityFilter("all"); }}
              placeholder="Destination Country"
              className="h-9 text-xs"
            />
          </div>
          {/* Destination City */}
          <div className="w-full sm:w-[calc(50%-4px)] lg:w-[150px] shrink-0">
            <SearchableDropdown
              items={cityOptions}
              value={cityFilter}
              onChange={(val) => setCityFilter(val)}
              placeholder="Destination City"
              className="h-9 text-xs"
            />
          </div>
          {/* Status */}
          <div className="w-full sm:w-[calc(50%-4px)] lg:w-[130px] shrink-0">
            <select className="h-9 px-2.5 border border-zinc-200 rounded-lg text-xs font-semibold bg-zinc-50/50 outline-none focus:ring-2 focus:ring-[#0052cc]/20 w-full text-zinc-600 cursor-pointer"
              value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {/* Date Range — always side by side */}
          <div className="flex gap-1.5 w-full sm:flex-1 lg:w-auto shrink-0 items-center">
            <Input type="date" className="h-9 border-zinc-200 focus-visible:ring-[#0052cc] rounded-lg text-xs font-semibold shadow-none bg-zinc-50/50 cursor-pointer flex-1 lg:w-[115px]"
              value={shipmentDateFrom} onChange={(e) => setShipmentDateFrom(e.target.value)} />
            <Input type="date" className="h-9 border-zinc-200 focus-visible:ring-[#0052cc] rounded-lg text-xs font-semibold shadow-none bg-zinc-50/50 cursor-pointer flex-1 lg:w-[115px]"
              value={shipmentDateTo} onChange={(e) => setShipmentDateTo(e.target.value)} />
          </div>
          {/* Clear */}
          <Button variant="outline" className="rounded-lg h-9 border-zinc-200 font-bold text-xs w-full sm:w-auto shrink-0 px-3" onClick={handleClearFilters}>
            <Filter className="h-3.5 w-3.5 text-zinc-500 mr-1.5" /> Clear
          </Button>
        </div>
      )}

      {/* Filter Bar — Walk-In Orders */}
      {activeOrdersTab === "WalkIn" && (
        <div className="bg-white p-3 rounded-xl shadow-sm border border-emerald-100 flex flex-wrap lg:flex-nowrap items-center gap-2">
          {/* Search — full width on mobile, flexible on sm+ */}
          <div className="relative w-full sm:flex-1 sm:min-w-[180px] lg:min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
            <Input placeholder="Search WK-Ref, Customer Name..." className="pl-9 h-9 border-zinc-200 focus-visible:ring-emerald-400 rounded-lg text-xs font-semibold placeholder:text-zinc-400 shadow-none bg-zinc-50/50 w-full"
              value={walkInSearchQuery} onChange={(e) => setWalkInSearchQuery(e.target.value)} />
          </div>
          {/* Source Warehouse */}
          <div className="w-full sm:w-[calc(50%-4px)] lg:w-[150px] shrink-0">
            <SearchableDropdown
              items={walkInWarehouseOptions}
              value={walkInWarehouseFilter}
              onChange={(val) => { setWalkInWarehouseFilter(val); setWalkInDestFilter("all"); }}
              placeholder="Source Warehouse"
              className="h-9 text-xs"
            />
          </div>
          {/* Destination / Address */}
          <div className="w-full sm:w-[calc(50%-4px)] lg:w-[150px] shrink-0">
            <SearchableDropdown
              items={walkInDestOptions}
              value={walkInDestFilter}
              onChange={(val) => setWalkInDestFilter(val)}
              placeholder="Destination / Address"
              className="h-9 text-xs"
            />
          </div>
          {/* Payment Status */}
          <div className="w-full sm:w-[calc(50%-4px)] lg:w-[150px] shrink-0">
            <select
              className="h-9 px-2.5 border border-zinc-200 rounded-lg text-xs font-semibold bg-zinc-50/50 outline-none focus:ring-2 focus:ring-emerald-200 w-full text-zinc-600 cursor-pointer"
              value={walkInPayStatusFilter}
              onChange={(e) => setWalkInPayStatusFilter(e.target.value)}
            >
              <option value="All">All Payment Statuses</option>
              <option value="Paid">Paid</option>
              <option value="Pending">Pending</option>
              <option value="Refunded">Refunded</option>
              <option value="Cancelled / Refunded">Cancelled / Refunded</option>
            </select>
          </div>
          {/* Package / Order Status */}
          <div className="w-full sm:w-[calc(50%-4px)] lg:w-[150px] shrink-0">
            <select
              className="h-9 px-2.5 border border-zinc-200 rounded-lg text-xs font-semibold bg-zinc-50/50 outline-none focus:ring-2 focus:ring-emerald-200 w-full text-zinc-600 cursor-pointer"
              value={walkInOrderStatusFilter}
              onChange={(e) => setWalkInOrderStatusFilter(e.target.value)}
            >
              <option value="All Status">All Package Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Processing">Processing</option>
              <option value="Shipped">Shipped</option>
              <option value="Arrived">Arrived</option>
              <option value="Delivered">Delivered</option>
              <option value="Refunded">Refunded</option>
            </select>
          </div>
          {/* Date Range — always side by side */}
          <div className="flex gap-1.5 w-full sm:w-[calc(50%-4px)] lg:w-auto shrink-0 items-center">
            <Input type="date" className="h-9 border-zinc-200 focus-visible:ring-emerald-400 rounded-lg text-xs font-semibold shadow-none bg-zinc-50/50 cursor-pointer flex-1 lg:w-[115px]"
              value={walkInDateFrom} onChange={(e) => setWalkInDateFrom(e.target.value)} />
            <Input type="date" className="h-9 border-zinc-200 focus-visible:ring-emerald-400 rounded-lg text-xs font-semibold shadow-none bg-zinc-50/50 cursor-pointer flex-1 lg:w-[115px]"
              value={walkInDateTo} onChange={(e) => setWalkInDateTo(e.target.value)} />
          </div>
          {/* Clear */}
          <Button variant="outline" className="rounded-lg h-9 border-zinc-200 font-bold text-xs w-full sm:w-auto shrink-0 px-3" onClick={handleClearWalkInFilters}>
            <Filter className="h-3.5 w-3.5 text-zinc-500 mr-1.5" /> Clear
          </Button>
        </div>
      )}

      {/* Bulk Action Bar - Normalized UI */}
      <AnimatePresence>
        {selectedOrderIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="bg-zinc-100 text-zinc-900 p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 border border-zinc-200 shadow-sm mb-6"
          >
            <div className="flex items-center gap-4 ml-2">
              <Badge className="bg-zinc-900 text-white border-none rounded-full px-3">{selectedOrderIds.length} Selected</Badge>
              <p className="text-sm font-semibold text-zinc-700">Batch Dispatch Operations</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 w-full sm:w-auto">
              <Button
                size="sm"
                disabled={isBulkProcessing}
                onClick={() => handleBulkStatusChange('Processing')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] uppercase tracking-wider shadow-sm min-w-[130px]"
              >
                {isBulkProcessing ? (
                  <><Loader2 className="mr-2 h-3 w-3 animate-spin" /> Updating...</>
                ) : (
                  "Mark Processing"
                )}
              </Button>
              <Button
                size="sm"
                disabled={isBulkProcessing}
                onClick={() => handleBulkStatusChange('Shipped')}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] uppercase tracking-wider shadow-sm min-w-[130px]"
              >
                {isBulkProcessing ? (
                  <><Loader2 className="mr-2 h-3 w-3 animate-spin" /> Updating...</>
                ) : (
                  "Mark Shipped"
                )}
              </Button>
              {/* Mark Arrived & Delivered are DELIVERY GUY ONLY — removed from admin.
                  Delivery portal handles Arrived → Delivered via PIN confirmation. */}
              <Button
                size="sm"
                onClick={() => setSelectedOrderIds([])}
                disabled={isBulkProcessing}
                className="bg-rose-500 hover:bg-rose-600 text-white font-bold text-[10px] uppercase tracking-wider shadow-sm min-w-[80px]"
              >
                Cancel
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SECURITY ALERTS TAB CONTENT ── */}
      {activeOrdersTab === "Security" ? (
        <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm space-y-5">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-red-600 animate-ping shrink-0" />
            <h2 className="text-base font-bold tracking-tight text-zinc-900 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-600" />
              Live Delivery Security Incidents
              <span className="ml-1 bg-red-100 text-red-700 rounded-full px-2.5 py-0.5 text-[11px] font-black">{activeIncidents.length}</span>
            </h2>
          </div>
          <p className="text-xs text-zinc-400 font-semibold -mt-2">
            Incidents are automatically resolved and removed from this list once an order is Delivered, Cancelled, or Returned. PIN-locked orders can be unlocked below.
          </p>

          {/* ── Search + Filter Bar ── */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            {/* Search input */}
            <div className="relative flex-1 w-full">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input
                id="incident-search"
                type="text"
                value={incidentSearch}
                onChange={e => setIncidentSearch(e.target.value)}
                placeholder="Search by tracking #, customer, or driver…"
                className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400 transition"
              />
              {incidentSearch && (
                <button
                  onClick={() => setIncidentSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition"
                  aria-label="Clear search"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Filter pills */}
            <div className="flex gap-2 shrink-0">
              {([
                { key: "all", label: "All", count: activeIncidents.length },
                { key: "locked", label: "🔒 Locked", count: activeIncidents.filter(o => !!o.pin_locked).length },
                { key: "failed", label: "⚠️ Failed Attempts", count: activeIncidents.filter(o => !o.pin_locked && o.failed_attempts_count > 0).length },
              ] as { key: "all" | "locked" | "failed"; label: string; count: number }[]).map(f => (
                <button
                  key={f.key}
                  id={`incident-filter-${f.key}`}
                  onClick={() => setIncidentFilter(f.key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all duration-150",
                    incidentFilter === f.key
                      ? f.key === "locked"
                        ? "bg-red-600 text-white border-red-600 shadow"
                        : f.key === "failed"
                          ? "bg-amber-500 text-white border-amber-500 shadow"
                          : "bg-zinc-800 text-white border-zinc-800 shadow"
                      : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
                  )}
                >
                  {f.label}
                  <span className={cn(
                    "rounded-full px-1.5 py-0 text-[10px] font-black",
                    incidentFilter === f.key ? "bg-white/20" : "bg-zinc-100 text-zinc-500"
                  )}>{f.count}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Results count feedback */}
          {(incidentSearch || incidentFilter !== "all") && (
            <p className="text-xs text-zinc-500 font-semibold">
              Showing <span className="text-zinc-800 font-black">{filteredIncidents.length}</span> of <span className="text-zinc-800 font-black">{activeIncidents.length}</span> incidents
            </p>
          )}

          {/* Incident Cards */}
          {filteredIncidents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <svg className="h-10 w-10 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 0 1 5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
              </svg>
              <p className="text-sm font-bold text-zinc-400">No incidents match your search or filter.</p>
              <button
                onClick={() => { setIncidentSearch(""); setIncidentFilter("all"); }}
                className="text-xs font-bold text-red-600 hover:underline"
              >Clear filters</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredIncidents.map((inc: any) => (
                <div
                  key={inc.id}
                  className={cn(
                    "bg-white p-5 rounded-xl border shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between gap-4 text-left",
                    inc.pin_locked
                      ? "border-red-200 bg-gradient-to-br from-white to-red-50/10"
                      : "border-amber-200 bg-gradient-to-br from-white to-amber-50/10"
                  )}
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                        {inc.tracking_number}
                      </span>
                      <Badge
                        className={cn(
                          "rounded-full text-[9px] font-bold tracking-wider uppercase border-none px-2.5 py-0.5 shrink-0",
                          inc.pin_locked ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                        )}
                      >
                        {inc.pin_locked ? "🔒 Locked" : "⚠️ Failed Attempt"}
                      </Badge>
                    </div>
                    <p className="font-extrabold text-slate-800 text-xs truncate">
                      Cust: {inc.customer?.name || "Retail Customer"}
                    </p>
                    <p className="text-[11px] text-zinc-500 font-semibold leading-snug">
                      {inc.pin_locked ? (
                        <span className="text-red-600">Locked after 3 wrong PIN attempts. Delivery blocked.</span>
                      ) : (
                        <span className="text-amber-600">
                          {inc.failed_attempts_count} failed attempt{inc.failed_attempts_count > 1 ? "s" : ""} logged.
                        </span>
                      )}
                    </p>
                    {inc.driver ? (
                      <div className="flex items-center gap-1.5">
                        <Truck className="h-3 w-3 text-zinc-400 shrink-0" />
                        <span className="text-[10px] text-zinc-500 font-bold truncate">{inc.driver.name}</span>
                        {inc.driver.phone && (
                          <span className="text-[10px] text-zinc-400 font-semibold ml-auto shrink-0">{inc.driver.phone}</span>
                        )}
                      </div>
                    ) : (
                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wide">No driver assigned</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-zinc-100">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setSelectedOrder(inc); setIsOrderModalOpen(true); }}
                      className="text-xs font-bold h-9 flex-1 border border-zinc-200 hover:bg-zinc-50 text-zinc-700 rounded-lg transition-colors"
                    >
                      Inspect Logs
                    </Button>
                    {!!inc.pin_locked && (
                      <div className="flex gap-1.5 flex-1">
                        <Button
                          size="sm"
                          disabled={isIncidentActionLoading[inc.id]}
                          onClick={() => handleUnlockPin(inc.id)}
                          className="text-xs font-bold h-9 flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm border-none transition-colors"
                        >
                          Unlock
                        </Button>
                        <Button
                          size="sm"
                          disabled={isIncidentActionLoading[inc.id]}
                          onClick={() => handleRegeneratePin(inc.id)}
                          className="text-xs font-bold h-9 flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm border-none transition-colors"
                        >
                          New PIN
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden">
          <div className="overflow-x-auto">
            {activeOrdersTab === "WalkIn" ? (
              <Table>
                <TableHeader className="bg-emerald-50/60">
                  <TableRow>
                    <TableHead className="px-4 font-semibold text-zinc-900">WK Reference</TableHead>
                    <TableHead className="font-semibold text-zinc-900">Customer Profile / Recipient</TableHead>
                    <TableHead className="font-semibold text-zinc-900">Order Date</TableHead>
                    <TableHead className="font-semibold text-zinc-900">Items Purchased</TableHead>
                    <TableHead className="font-semibold text-[#0052cc]">Part No (OEM)</TableHead>
                    <TableHead className="font-semibold text-zinc-900">Engine</TableHead>
                    <TableHead className="font-semibold text-zinc-900">Suitable Vehicle</TableHead>
                    <TableHead className="font-semibold text-zinc-900">Source Warehouse</TableHead>
                    <TableHead className="font-semibold text-zinc-900">Destination / Address</TableHead>
                    <TableHead className="font-semibold text-zinc-900">Fulfillment</TableHead>
                    <TableHead className="font-semibold text-zinc-900 text-center">Pay Status</TableHead>
                    <TableHead className="font-semibold text-zinc-900">Payment / Ref</TableHead>
                    <TableHead className="font-semibold text-zinc-900 text-right">Total</TableHead>
                    <TableHead className="px-6 w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={11} className="h-32 text-center"><Loader2 className="h-6 w-6 animate-spin text-emerald-600 mx-auto" /></TableCell></TableRow>
                  ) : filteredOrders.length === 0 ? (
                    <TableRow><TableCell colSpan={11} className="h-32 text-center text-zinc-400 font-medium">No walk-in orders found.</TableCell></TableRow>
                  ) : (
                    paginatedOrders.map((order) => {
                      const isGuest = order.customer?.name?.toLowerCase() === "walk-in customer";
                      const sourceWarehouse = order.items?.[0]?.warehouse?.name || "—";
                      return (
                        <TableRow key={order.id} className="hover:bg-emerald-50/30 transition-colors group">
                          <TableCell className="px-4 py-3">
                            <div className="flex flex-col gap-1 items-start">
                              <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                                {order.tracking_number}
                              </span>
                              <ShippingMethodBadge method={order.shipping_method} />
                            </div>
                          </TableCell>
                          <TableCell>
                            {(() => {
                              const recipient = parseRecipientNotes(order.notes);
                              if (recipient) {
                                return (
                                  <div className="space-y-1">
                                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider text-[9px]">Recipient Info</p>
                                    <p className="text-sm font-bold text-zinc-800 leading-tight">{recipient.name}</p>
                                    <p className="text-[10px] text-indigo-700 font-bold bg-indigo-50 border border-indigo-150 px-1 py-0.5 rounded inline-block">{recipient.phone}</p>
                                    {recipient.email && <p className="text-[10px] text-zinc-400 font-medium">{recipient.email}</p>}
                                  </div>
                                );
                              }
                              return (
                                <div className="space-y-0.5">
                                  <p className="text-sm font-semibold text-zinc-800">{order.customer?.name || "Walk-In Guest"}</p>
                                  {!isGuest && <p className="text-[10px] text-zinc-400 font-medium">{order.customer?.email}</p>}
                                  {!isGuest && order.customer?.phone && (
                                    <p className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded inline-block">{order.customer.phone}</p>
                                  )}
                                  {isGuest ? (
                                    <span className="text-[9px] font-black uppercase text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">Quick Walk-In</span>
                                  ) : (
                                    <span className="text-[9px] font-black uppercase text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">Registered</span>
                                  )}
                                </div>
                              );
                            })()}
                          </TableCell>
                          <TableCell>
                            <p className="text-xs font-bold text-zinc-700">{new Date(order.created_at).toLocaleDateString()}</p>
                            <p className="text-[10px] text-zinc-400">{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-0.5">
                              <p className="text-xs font-bold text-zinc-800 max-w-[130px] truncate">{order.items?.[0]?.product?.name || "Spare Part"}</p>
                              {order.items?.length > 1 && <p className="text-[10px] text-zinc-400 font-bold">+{order.items.length - 1} more</p>}
                              <p className="text-[10px] text-zinc-500">{order.items?.length || 0} item(s)</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              {order.items?.map((item: any, i: number) => (
                                <span key={i} className="text-xs font-bold text-[#0052cc] block truncate max-w-[120px]">
                                  {item.product?.part_number || "—"}
                                </span>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              {order.items?.map((item: any, i: number) => (
                                <span key={i} className="text-xs font-semibold text-zinc-600 block truncate max-w-[100px]">
                                  {item.product?.engine_model || "—"}
                                </span>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              {order.items?.map((item: any, i: number) => (
                                <span key={i} className="text-xs font-semibold text-zinc-600 block truncate max-w-[120px]" title={item.product?.suitable_vehicle}>
                                  {item.product?.suitable_vehicle || "—"}
                                </span>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <div className="h-2 w-2 rounded-full bg-indigo-400 flex-shrink-0" />
                              <p className="text-xs font-bold text-indigo-700">{sourceWarehouse}</p>
                            </div>
                          </TableCell>
                          {/* Destination / Address column */}
                          <TableCell>
                            {order.shipping_method === "Pickup" ? (
                              <span className="text-xs text-zinc-400 font-medium italic">In-Store — No Delivery</span>
                            ) : (
                              <div className="space-y-1 text-left">
                                <p className="text-xs font-bold text-zinc-900">{order.shipping_city || "—"}</p>
                                <p className="text-xs font-bold text-zinc-700 max-w-[160px] truncate">{order.shipping_address || "—"}</p>
                                {order.shipment ? (
                                  <span className="inline-flex items-center gap-1 mt-1 text-[9px] font-black text-blue-700 bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5 uppercase tracking-wide">
                                    🚛 Container: {order.shipment.waybill}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 mt-1 text-[9px] font-black text-teal-700 bg-teal-50 border border-teal-100 rounded px-1.5 py-0.5 uppercase tracking-wide">
                                    📦 Local Hub Direct
                                  </span>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              {updatingOrderIds[order.id] && <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600 shrink-0" />}
                              {order.shipping_method === "Pickup" ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>In-Store
                                </span>
                              ) : (
                                <div className="space-y-1">
                                  {(() => {
                                    let badgeClass = "bg-yellow-50 text-yellow-700 border-yellow-200";
                                    let dotClass = "bg-yellow-500";
                                    let label = "Pending";

                                    if (order.status === "Processing") {
                                      badgeClass = "bg-indigo-50 text-indigo-700 border-indigo-200";
                                      dotClass = "bg-indigo-500";
                                      label = "Processing";
                                    } else if (order.status === "Shipped" || order.status === "In Transit") {
                                      badgeClass = "bg-blue-50 text-blue-700 border-blue-200";
                                      dotClass = "bg-blue-500";
                                      label = "Shipped";
                                    } else if (order.status === "Arrived") {
                                      badgeClass = "bg-purple-50 text-purple-700 border-purple-200";
                                      dotClass = "bg-purple-500";
                                      label = "Arrived";
                                    } else if (order.status === "Delivered") {
                                      badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
                                      dotClass = "bg-emerald-500";
                                      label = "Delivered";
                                    } else if (order.status === "Cancelled" || isOrderVoided(order)) {
                                      badgeClass = "bg-red-50 text-red-700 border-red-200";
                                      dotClass = "bg-red-500";
                                      label = "Cancelled";
                                    }

                                    return (
                                      <span className={cn("inline-flex items-center gap-1 text-[10px] font-black border px-2 py-0.5 rounded-full uppercase tracking-wider", badgeClass)}>
                                        <span className={cn("h-1.5 w-1.5 rounded-full animate-pulse", dotClass)}></span>
                                        Dispatch — {label}
                                      </span>
                                    );
                                  })()}
                                  <p className="text-[10px] font-bold text-zinc-500 ml-1">{order.shipping_city}</p>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {(() => {
                              const pay = getWalkInPayStatusDisplay(order);
                              return (
                                <Badge className={cn("rounded-full px-2 text-[10px] font-bold border-none", pay.className)}>
                                  {pay.label}
                                </Badge>
                              );
                            })()}
                          </TableCell>
                          <TableCell>
                            <p className="text-xs font-semibold text-zinc-700 max-w-[130px] leading-snug">
                              {order.payment_status === "Pending" ? "— (Pending Payment)" : (order.payment_method || "Cash")}
                            </p>
                            {isRealMpesaReceipt(order.payment_ref_code) && (
                              <p className="text-[10px] font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded border border-green-200 mt-1 inline-block tracking-wide">
                                {order.payment_ref_code}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {(() => {
                              const refundedTotal = getOrderRefundedTotal(order);
                              const hasCancelledItems = order.items?.some((i: any) => i.cancellation_status === "Cancelled");
                              const allCancelled = order.items?.every((i: any) => i.cancellation_status === "Cancelled");

                              if (isOrderVoided(order) || allCancelled) {
                                return (
                                  <>
                                    <p className="text-sm font-black text-red-500 line-through opacity-75">
                                      Ksh {refundedTotal.toLocaleString()}
                                    </p>
                                    <p className="text-[9px] font-bold text-red-500 uppercase">Refunded</p>
                                  </>
                                );
                              }

                              return (
                                <>
                                  <p className="text-sm font-black text-zinc-900">
                                    Ksh {parseFloat(order.total_amount || 0).toLocaleString()}
                                  </p>
                                  {refundedTotal > 0 && (
                                    <p className="text-[9px] font-bold text-red-500 uppercase">
                                      Ksh {refundedTotal.toLocaleString()} Refunded
                                    </p>
                                  )}
                                </>
                              );
                            })()}
                          </TableCell>
                          <TableCell className="px-6 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost" }), "h-8 w-8 p-0 rounded-full hover:bg-emerald-100")}>
                                <MoreHorizontal className="h-4 w-4" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-56 rounded-xl border-zinc-200 shadow-xl p-1">
                                <DropdownMenuGroup>
                                  <DropdownMenuLabel className="text-[10px] font-black text-zinc-400 uppercase px-2 py-1.5">Walk-In Actions</DropdownMenuLabel>
                                  <DropdownMenuItem onClick={() => { setSelectedOrder(order); setIsOrderModalOpen(true); }} className="cursor-pointer rounded-lg font-bold text-sm">
                                    <Eye className="mr-2 h-4 w-4 text-zinc-400" /> View Details
                                  </DropdownMenuItem>

                                  {!isOrderVoided(order) && (
                                    <DropdownMenuItem
                                      onClick={() => handleOpenEditWalkIn(order)}
                                      className="cursor-pointer rounded-lg font-bold text-sm text-zinc-650"
                                    >
                                      <Pencil className="mr-2 h-4 w-4 text-zinc-400" /> Edit Order
                                    </DropdownMenuItem>
                                  )}

                                  {/* ── Payment Controls ── */}
                                  {order.payment_status !== "Paid" && !isOrderVoided(order) ? (
                                    <DropdownMenuItem
                                      onClick={() => handleMarkWalkInPaid(order)}
                                      className="cursor-pointer rounded-lg font-bold text-sm text-emerald-600"
                                    >
                                      <CheckCircle2 className="mr-2 h-4 w-4" /> Mark as Paid
                                    </DropdownMenuItem>
                                  ) : order.payment_status === "Paid" && !isOrderVoided(order) ? (
                                    <DropdownMenuItem
                                      onClick={() => handleMarkWalkInPending(order)}
                                      className="cursor-pointer rounded-lg font-bold text-sm text-amber-600"
                                    >
                                      <RefreshCw className="mr-2 h-4 w-4" /> Mark Payment as Pending
                                    </DropdownMenuItem>
                                  ) : null}

                                  {/* ── Refund / Return — only visible when Pending, Processing, or Delivered ── */}
                                  {!isOrderVoided(order) && (order.status === "Pending" || order.status === "Processing" || order.status === "Delivered") && (
                                    <DropdownMenuItem
                                      onClick={() => handleOpenVoidDialog(order)}
                                      className="cursor-pointer rounded-lg font-bold text-sm text-red-650"
                                    >
                                      <Trash2 className="mr-2 h-4 w-4 text-red-400" /> Refund/Return Order
                                    </DropdownMenuItem>
                                  )}

                                  {order.refund_status === "Pending" && order.items?.some((i: any) => i.cancellation_status === "Cancelled") && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuLabel className="text-[10px] font-black text-amber-400 uppercase px-2 py-1.5">Refund Processing</DropdownMenuLabel>
                                      <DropdownMenuItem onClick={() => { setSelectedOrder(order); setIsCompleteRefundModalOpen(true); }} className="cursor-pointer rounded-lg font-bold text-sm text-amber-600">
                                        <CreditCard className="mr-2 h-4 w-4" /> Complete Refund
                                      </DropdownMenuItem>
                                    </>
                                  )}

                                  {/* ── Delivery Status Progression (Local Delivery only, admin caps at Shipped) ── */}
                                  {order.shipping_method === "Local Delivery" && !isOrderVoided(order) && order.status !== "Shipped" && order.status !== "Arrived" && order.status !== "Delivered" && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuLabel className="text-[10px] font-black text-zinc-300 uppercase px-2 pt-2 pb-1">Update Status</DropdownMenuLabel>
                                      {order.status === "Pending" && (
                                        <DropdownMenuItem onClick={() => handleStatusChange(order.id, "Processing")} className="cursor-pointer rounded-lg font-bold text-sm text-indigo-600">
                                          <RefreshCw className="mr-2 h-4 w-4" /> Mark Processing
                                        </DropdownMenuItem>
                                      )}
                                      {(order.status === "Pending" || order.status === "Processing") && (
                                        <DropdownMenuItem onClick={() => handleStatusChange(order.id, "Shipped")} className="cursor-pointer rounded-lg font-bold text-sm text-blue-600">
                                          <Truck className="mr-2 h-4 w-4" /> Mark Shipped
                                        </DropdownMenuItem>
                                      )}
                                      {/* Arrived & Delivered are delivery-guy only — not shown to admin */}
                                    </>
                                  )}
                                  {/* Show read-only label when already with delivery guy */}
                                  {order.shipping_method === "Local Delivery" && !isOrderVoided(order) && (order.status === "Arrived" || order.status === "Shipped") && order.status !== "Delivered" && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuLabel className="text-[10px] font-black text-zinc-300 uppercase px-2 pt-2 pb-1">Delivery Status</DropdownMenuLabel>
                                      <DropdownMenuItem disabled className="cursor-not-allowed rounded-lg font-bold text-sm text-zinc-400 opacity-60">
                                        <Truck className="mr-2 h-4 w-4" /> With Delivery Guy
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuGroup>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            ) : (
              <Table>
                <TableHeader className="bg-zinc-50/50">
                  <TableRow>
                    <TableHead className="w-[50px] px-6 text-center">
                      <button onClick={() => {
                        if (selectedOrderIds.length === filteredOrders.length) setSelectedOrderIds([]);
                        else setSelectedOrderIds(filteredOrders.map(o => o.id));
                      }} className="text-zinc-400 hover:text-zinc-900 transition-colors">
                        {selectedOrderIds.length === filteredOrders.length && filteredOrders.length > 0 ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                      </button>
                    </TableHead>
                    <TableHead className="px-4 font-semibold text-zinc-900">Order Ref</TableHead>
                    <TableHead className="font-semibold text-zinc-900">Customer</TableHead>
                    <TableHead className="font-semibold text-zinc-900">Route (Origin → Dest)</TableHead>
                    <TableHead className="font-semibold text-zinc-900">Order Date</TableHead>
                    <TableHead className="font-semibold text-zinc-900">Main Products</TableHead>
                    <TableHead className="font-semibold text-[#0052cc]">Part No (OEM)</TableHead>
                    <TableHead className="font-semibold text-zinc-900">Engine</TableHead>
                    <TableHead className="font-semibold text-zinc-900">Suitable Vehicle</TableHead>
                    <TableHead className="font-semibold text-zinc-900 text-center">Items</TableHead>
                    <TableHead className="font-semibold text-zinc-900">Products Costs</TableHead>
                    <TableHead className="font-semibold text-zinc-900">Shipment Fee</TableHead>
                    <TableHead className="font-semibold text-zinc-900 text-right">Total</TableHead>
                    <TableHead className="font-semibold text-zinc-900 text-center">Status</TableHead>
                    <TableHead className="px-6 w-[70px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={12} className="h-48 text-center"><div className="flex flex-col items-center justify-center gap-2"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="text-sm text-zinc-500 font-medium">Synchronizing orders...</p></div></TableCell></TableRow>
                  ) : filteredOrders.length === 0 ? (
                    <TableRow><TableCell colSpan={12} className="h-48 text-center text-zinc-500">No shipment orders found.</TableCell></TableRow>
                  ) : (
                    paginatedOrders.map((order) => (
                      <TableRow key={order.id} className={cn("hover:bg-zinc-50/50 transition-colors group", selectedOrderIds.includes(order.id) && "bg-zinc-50/50")}>
                        <TableCell className="px-6 text-center">
                          <button onClick={() => {
                            if (selectedOrderIds.includes(order.id)) setSelectedOrderIds(selectedOrderIds.filter(id => id !== order.id));
                            else setSelectedOrderIds([...selectedOrderIds, order.id]);
                          }} className={cn("transition-colors", selectedOrderIds.includes(order.id) ? "text-[#0052cc]" : "text-zinc-200 group-hover:text-zinc-400")}>
                            {selectedOrderIds.includes(order.id) ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                          </button>
                        </TableCell>
                        <TableCell className="px-4 py-4">
                          <p className="text-sm font-bold text-zinc-900">{order.tracking_number || `ORD-${order.id}`}</p>
                          {isRealMpesaReceipt(order.payment_ref_code) && (
                            <p className="text-[10px] font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded border border-green-200 mt-1 inline-block tracking-wide">
                              M-Pesa: {order.payment_ref_code}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <p className="text-sm font-semibold text-zinc-700">{order.customer?.name || "Guest"}</p>
                            {order.customer?.email && <p className="text-[10px] text-zinc-400 font-medium">{order.customer.email}</p>}
                            {order.customer?.phone && (
                              <p className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded inline-block">{order.customer.phone}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 uppercase">{order.items?.[0]?.warehouse?.name || "Origin"}</div>
                            <span className="text-[10px] font-black text-zinc-400 italic">TO</span>
                            <div className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 uppercase">
                              {order.shipping_city}
                              {order.shipping_country ? `, ${order.shipping_country}` : ""}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell><div className="space-y-0.5"><p className="text-xs font-bold text-zinc-700">{new Date(order.created_at).toLocaleDateString()}</p><p className="text-[10px] text-zinc-400 font-medium uppercase">{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p></div></TableCell>
                        <TableCell>
                          {(() => {
                            const activeItems = (order.items || []).filter((i: any) => i.cancellation_status !== "Cancelled");
                            if (activeItems.length === 0) {
                              return <span className="text-xs font-medium text-zinc-400 italic">—</span>;
                            }
                            return (
                              <div className="space-y-0.5 max-w-[150px]">
                                <p className="text-xs font-bold text-zinc-800 truncate">{activeItems[0]?.product?.name || "Genuine Spare Part"}</p>
                                {activeItems.length > 1 && <p className="text-[10px] text-zinc-400 font-bold uppercase">+{activeItems.length - 1} more items</p>}
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const activeItems = (order.items || []).filter((i: any) => i.cancellation_status !== "Cancelled");
                            if (activeItems.length === 0) return <span className="text-xs font-medium text-zinc-400 italic">—</span>;
                            return (
                              <div className="flex flex-col gap-0.5">
                                {activeItems.map((item: any, i: number) => (
                                  <span key={i} className="text-xs font-bold text-[#0052cc] block truncate max-w-[120px]">
                                    {item.product?.part_number || "—"}
                                  </span>
                                ))}
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const activeItems = (order.items || []).filter((i: any) => i.cancellation_status !== "Cancelled");
                            if (activeItems.length === 0) return <span className="text-xs font-medium text-zinc-400 italic">—</span>;
                            return (
                              <div className="flex flex-col gap-0.5">
                                {activeItems.map((item: any, i: number) => (
                                  <span key={i} className="text-xs font-semibold text-zinc-600 block truncate max-w-[100px]">
                                    {item.product?.engine_model || "—"}
                                  </span>
                                ))}
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const activeItems = (order.items || []).filter((i: any) => i.cancellation_status !== "Cancelled");
                            if (activeItems.length === 0) return <span className="text-xs font-medium text-zinc-400 italic">—</span>;
                            return (
                              <div className="flex flex-col gap-0.5">
                                {activeItems.map((item: any, i: number) => (
                                  <span key={i} className="text-xs font-semibold text-zinc-600 block truncate max-w-[120px]" title={item.product?.suitable_vehicle}>
                                    {item.product?.suitable_vehicle || "—"}
                                  </span>
                                ))}
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-center">
                          {(() => {
                            const activeItems = (order.items || []).filter((i: any) => i.cancellation_status !== "Cancelled");
                            const activeUnitsCount = activeItems.reduce((sum: number, i: any) => sum + Number(i.quantity || 1), 0);
                            return (
                              <div className="flex items-center justify-center gap-1.5">
                                <Package className="h-3 w-3 text-zinc-400" />
                                <span className="text-xs font-bold text-zinc-700">{activeUnitsCount}</span>
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-xs font-bold text-zinc-600">Ksh {Math.max(0, (parseFloat(order.total_amount || 0) - parseFloat(order.shipping_fee || 0))).toLocaleString()}</TableCell>
                        <TableCell className="text-xs font-bold text-zinc-600">Ksh {parseFloat(order.shipping_fee || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          {(() => {
                            const refundedTotal = getOrderRefundedTotal(order);
                            const allCancelled = order.items?.every((i: any) => i.cancellation_status === "Cancelled");

                            if (order.status === "Cancelled" || allCancelled) {
                              return (
                                <>
                                  <p className="text-xs font-black text-red-500 line-through opacity-75">
                                    Ksh {refundedTotal.toLocaleString()}
                                  </p>
                                  <p className="text-[9px] font-bold text-red-500 uppercase">Refunded</p>
                                </>
                              );
                            }

                            return (
                              <>
                                <p className="text-xs font-black text-zinc-900">
                                  Ksh {parseFloat(order.total_amount || 0).toLocaleString()}
                                </p>
                                {refundedTotal > 0 && (
                                  <p className="text-[9px] font-bold text-red-500 uppercase">
                                    Ksh {refundedTotal.toLocaleString()} Refunded
                                  </p>
                                )}
                              </>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center justify-center gap-1">
                            <div className="flex items-center justify-center gap-1.5">
                              {updatingOrderIds[order.id] && <Loader2 className="h-3 w-3 animate-spin text-[#0052cc] shrink-0" />}
                              <Badge className={cn("rounded-full px-3 text-[10px] font-bold uppercase border-none tracking-wider",
                                order.status === "Pending" ? "bg-yellow-400 text-yellow-950" :
                                  order.status === "Processing" ? "bg-orange-500 text-white" :
                                    (order.status === "Shipped" || order.status === "In Transit") ? "bg-blue-600 text-white" :
                                      order.status === "Arrived" ? "bg-indigo-600 text-white" :
                                        order.status === "Delivered" ? "bg-emerald-500 text-white" :
                                          order.status === "Returned" ? "bg-red-600 text-white" :
                                            (order.status === "Cancelled" || order.status === "Cancellation Requested") ? "bg-red-600 text-white" : "bg-zinc-200 text-zinc-700"
                              )}>{order.status === "In Transit" ? "SHIPPED" : order.status === "Cancellation Requested" ? "CANCEL REQ" : order.status}</Badge>
                            </div>
                            <Badge className={cn("rounded-full px-2 py-0.5 text-[9px] font-bold uppercase border-none tracking-wider",
                              (order.payment_status === "Paid" || !isOrderVoided(order)) ? "bg-emerald-100 text-emerald-800" :
                                order.payment_status === "Refunded" || order.payment_status === "Cancelled / Refunded" ? "bg-red-100 text-red-800" :
                                  "bg-amber-100 text-amber-800"
                            )}>
                              {(order.payment_status === "Paid" || !isOrderVoided(order)) ? "✓ M-Pesa Paid" :
                                order.payment_status === "Refunded" || order.payment_status === "Cancelled / Refunded" ? "Refunded" :
                                  "Payment Pending"}
                            </Badge>
                            {/* Driver badge for Shipped/Arrived/Delivered orders */}
                            {(order.status === "Shipped" || order.status === "Arrived" || order.status === "Delivered") && (() => {
                              const assignedDriver = order.driver ?? (order.delivered_by_user_id ? drivers.find((d: any) => d.id === order.delivered_by_user_id) : null);
                              const reservingDriver = order.reserved_by_driver ?? (order.reserved_by_user_id ? drivers.find((d: any) => d.id === order.reserved_by_user_id) : null);
                              const releasingDriver = order.last_released_by_driver ?? (order.last_released_by_user_id ? drivers.find((d: any) => d.id === order.last_released_by_user_id) : null);

                              if (reservingDriver && !assignedDriver) {
                                return (
                                  <div className="flex flex-col gap-0.5 items-center">
                                    <span className="inline-flex items-center gap-1 text-[9px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">
                                      <Truck className="h-2.5 w-2.5 shrink-0 animate-pulse text-amber-500" />
                                      <span>Has Package: {releasingDriver ? releasingDriver.name.split(" ")[0] : "Warehouse"}</span>
                                    </span>
                                    <span className="text-[8px] font-bold text-zinc-400 shrink-0">
                                      (Reserved: {reservingDriver.name.split(" ")[0]})
                                    </span>
                                  </div>
                                );
                              }

                              if (releasingDriver && !assignedDriver && !reservingDriver) {
                                return (
                                  <span className="inline-flex items-center gap-1 text-[9px] font-black text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full shrink-0">
                                    <Truck className="h-2.5 w-2.5 shrink-0 text-rose-500" />
                                    <span>Has Package: {releasingDriver.name.split(" ")[0]} (Released)</span>
                                  </span>
                                );
                              }

                              return assignedDriver ? (
                                <span className="inline-flex items-center gap-1 text-[9px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                                  <Truck className="h-2.5 w-2.5 shrink-0" />
                                  <span>{assignedDriver.name.split(" ")[0]}</span>
                                  {(assignedDriver.city || assignedDriver.country) && (
                                    <span className="text-indigo-400 font-bold">
                                      ({assignedDriver.city || assignedDriver.country})
                                    </span>
                                  )}
                                </span>
                              ) : (order.status === "Shipped" || order.status === "Arrived") ? (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-zinc-400 bg-zinc-50 border border-zinc-200 px-1.5 py-0.5 rounded-full">
                                  No Driver
                                </span>
                              ) : null;
                            })()}
                          </div>
                        </TableCell>
                        <TableCell className="px-6 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost" }), "h-8 w-8 p-0 rounded-full hover:bg-zinc-100")}><MoreHorizontal className="h-4 w-4" /></DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 rounded-xl border-zinc-200 shadow-xl p-1">
                              <DropdownMenuGroup>
                                <DropdownMenuLabel className="text-[10px] font-black text-zinc-400 uppercase px-2 py-1.5">Options</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => { setSelectedOrder(order); setIsOrderModalOpen(true); }} className="cursor-pointer rounded-lg font-bold text-sm"><Eye className="mr-2 h-4 w-4 text-zinc-400" /> View Details</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {order.status === "Pending" && (
                                  <DropdownMenuItem onClick={() => handleStatusChange(order.id, 'Processing')} className="cursor-pointer rounded-lg font-bold text-sm text-indigo-600">
                                    <RefreshCw className="mr-2 h-4 w-4" /> Mark Processing
                                  </DropdownMenuItem>
                                )}
                                {(order.status === "Pending" || order.status === "Processing") && (
                                  <DropdownMenuItem onClick={() => handleStatusChange(order.id, 'Shipped')} className="cursor-pointer rounded-lg font-bold text-sm text-blue-600">
                                    <Truck className="mr-2 h-4 w-4" /> Mark Shipped
                                  </DropdownMenuItem>
                                )}
                                {/* Mark Arrived: NOT available for Shipment/Local tabs — only via waybill bulk in Logistics */}
                                {/* Mark Delivered: NOT available for Shipment/Local tabs — only done by delivery guy via PIN */}




                                {order.refund_status === "Pending" && order.items?.some((i: any) => i.cancellation_status === "Cancelled") && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuLabel className="text-[10px] font-black text-amber-400 uppercase px-2 py-1.5">Refund Processing</DropdownMenuLabel>
                                    <DropdownMenuItem onClick={() => { setSelectedOrder(order); setIsCompleteRefundModalOpen(true); }} className="cursor-pointer rounded-lg font-bold text-sm text-amber-600">
                                      <CreditCard className="mr-2 h-4 w-4" /> Complete Refund
                                    </DropdownMenuItem>
                                  </>
                                )}

                                {/* ── Refund / Return — only visible when Pending, Processing, or Delivered ── */}
                                {!isOrderVoided(order) && (order.status === "Pending" || order.status === "Processing" || order.status === "Delivered") && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => handleOpenVoidDialog(order)}
                                      className="cursor-pointer rounded-lg font-bold text-sm text-red-600"
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" /> Void / Refund Order
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {/* Assign Driver — for local: Shipped or Arrived; for cross-city: Arrived only */}
                                {(() => {
                                  const isCrossCity = !isLocalShipmentRoute(order);
                                  const showAssignDriver = isCrossCity
                                    ? order.status === "Arrived"
                                    : (order.status === "Shipped" || order.status === "Arrived");
                                  return showAssignDriver ? (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuLabel className="text-[10px] font-black text-indigo-400 uppercase px-2 py-1.5">Delivery Assignment</DropdownMenuLabel>
                                      <DropdownMenuItem
                                        onClick={() => handleOpenAssignDriver(order)}
                                        className="cursor-pointer rounded-lg font-bold text-sm text-indigo-600"
                                      >
                                        <UserPlus className="mr-2 h-4 w-4" />
                                        {order.delivered_by_user_id ? "Reassign Driver" : "Assign Driver"}
                                      </DropdownMenuItem>
                                    </>
                                  ) : null;
                                })()}

                              </DropdownMenuGroup>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>
          <PaginationControls
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            pageSize={pageSize}
            setPageSize={setPageSize}
            totalItems={filteredOrders.length}
            itemName="records"
            pageSizeOptions={[15, 30, 50, 100]}
          />
        </div>
      )} {/* end Security ternary */}

      {/* Order Details Modal */}
      <Dialog open={isOrderModalOpen} onOpenChange={setIsOrderModalOpen}>
        <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden bg-white rounded-2xl border-none shadow-2xl">
          <DialogHeader className="p-6 bg-white border-b flex flex-row items-center justify-between">
            <div className="space-y-1 text-left">
              <DialogTitle className="text-xl font-bold text-zinc-900">Order Ref: {currentSelectedOrder?.tracking_number || currentSelectedOrder?.id}</DialogTitle>
              <DialogDescription className="text-zinc-400 font-medium text-xs">
                Placed on {currentSelectedOrder ? new Date(currentSelectedOrder.created_at).toLocaleDateString() : ''}
              </DialogDescription>
            </div>
            <Badge className={cn(
              "rounded-full px-3 py-1 text-[10px] font-bold uppercase border-none",
              currentSelectedOrder?.status === "Pending" ? "bg-yellow-400 text-yellow-950" :
                currentSelectedOrder?.status === "Processing" ? "bg-orange-500 text-white" :
                  currentSelectedOrder?.status === "Shipped" || currentSelectedOrder?.status === "In Transit" ? "bg-blue-600 text-white" :
                    currentSelectedOrder?.status === "Arrived" ? "bg-indigo-600 text-white" :
                      currentSelectedOrder?.status === "Delivered" ? "bg-emerald-500 text-white" :
                        currentSelectedOrder?.status === "Returned" ? "bg-red-600 text-white" :
                          "bg-zinc-200 text-zinc-700"
            )}>
              {currentSelectedOrder?.status === "In Transit" ? "SHIPPED" : currentSelectedOrder?.status}
            </Badge>
          </DialogHeader>
          <div className="p-6 max-h-[60vh] overflow-y-auto">
            <div className="mb-6 space-y-4">
              {/* Origin / Destination — hide destination for walk-in in-store */}
              <div className="bg-zinc-50 p-5 rounded-xl border border-zinc-200">
                {currentSelectedOrder?.shipping_method === "Pickup" || currentSelectedOrder?.shipping_method === "In-Store Collection" ? (
                  <div className="flex items-center gap-3">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Source Warehouse</p>
                      <p className="text-sm font-bold text-slate-700 uppercase">{currentSelectedOrder?.items?.[0]?.warehouse?.name || "Warehouse"}</p>
                    </div>
                    <div className="ml-auto">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>In-Store Collection
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Origin</p>
                      {/* Show only warehouse name — never append country */}
                      <p className="text-sm font-bold text-slate-700 uppercase">
                        {(currentSelectedOrder?.items?.[0]?.warehouse?.name || "Warehouse").split(',')[0].trim()}
                      </p>
                    </div>
                    <ArrowRightLeft className="h-4 w-4 text-zinc-300" />
                    <div className="space-y-1 text-right">
                      <p className="text-[10px] font-bold text-emerald-400 uppercase">Final Destination</p>
                      {/* Show ONLY shipping_city — exactly as typed, no country appended */}
                      <p className="text-sm font-bold text-emerald-700 uppercase">
                        {currentSelectedOrder?.shipping_city || "Delivery Address"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mb-6">
              <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3">Customer Information</h4>
              <div className="bg-white p-4 rounded-xl border border-zinc-200 text-left">
                {(() => {
                  const recipient = parseRecipientNotes(currentSelectedOrder?.notes ?? null);
                  const displayName = recipient?.name || currentSelectedOrder?.customer?.name || "Guest";
                  const displayPhone = recipient?.phone || currentSelectedOrder?.customer?.phone;
                  const displayEmail = recipient?.email || currentSelectedOrder?.customer?.email;
                  const isWalkIn = !!recipient || currentSelectedOrder?.customer?.name?.toLowerCase() === "walk-in customer";

                  return (
                    <>
                      <p className="font-bold text-zinc-900 flex items-center gap-2">
                        {displayName}
                        {isWalkIn && (
                          <span className="text-[9px] font-bold bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded border border-amber-200">
                            WALK-IN
                          </span>
                        )}
                      </p>
                      {displayEmail && !isWalkIn && (
                        <p className="text-sm text-zinc-500 font-medium mt-0.5">{displayEmail}</p>
                      )}
                      {displayPhone && (
                        <p className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded inline-block mt-1">
                          📞 {displayPhone}
                        </p>
                      )}
                      <p className="text-sm text-zinc-500 font-medium mt-1">{currentSelectedOrder?.shipping_address}</p>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* ── Delivery PIN — hidden by default, reveal toggle for admin ── */}
            {currentSelectedOrder?.delivery_pin && (
              <div className="mb-6">
                <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  🔑 Delivery Verification PIN
                </h4>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Customer must share this PIN with the driver</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-2xl font-black tracking-[0.3em] text-amber-900 font-mono">
                        {showDeliveryPin ? currentSelectedOrder.delivery_pin : "••••"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowDeliveryPin(p => !p)}
                        className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        {showDeliveryPin ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        {showDeliveryPin ? "Hide" : "Reveal"}
                      </button>
                    </div>
                  </div>
                  <div className="text-[10px] font-semibold text-amber-600 text-right max-w-[140px] leading-snug">
                    Tell this PIN to the customer before they leave the store
                  </div>
                </div>
              </div>
            )}

            {/* Delivery & Driver — uses fetchedOrderDetail for signature/photo since list API omits those fields */}
            {(currentSelectedOrder?.driver || fetchedOrderDetail?.delivery_signature_url || fetchedOrderDetail?.delivery_photo_url || currentSelectedOrder?.delivery_signature_url || currentSelectedOrder?.delivery_photo_url) && (
              <div className="mb-6">
                <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3">Delivery &amp; Driver Details</h4>
                <div className="bg-white p-4 rounded-xl border border-zinc-200 space-y-3">
                  {currentSelectedOrder?.driver && (
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-700 font-black text-xs border border-indigo-200">
                        {currentSelectedOrder.driver.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-zinc-800 truncate">{currentSelectedOrder.driver.name}</p>
                        {currentSelectedOrder.driver.phone && (
                          <p className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded inline-block mt-0.5">
                            📞 {currentSelectedOrder.driver.phone}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(currentSelectedOrder.driver.city || currentSelectedOrder.driver.country) && (
                            <p className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded truncate">
                              📍 {currentSelectedOrder.driver.city ? `${currentSelectedOrder.driver.city}, ` : ""}{currentSelectedOrder.driver.country || ""}
                            </p>
                          )}
                          {currentSelectedOrder.driver.vehicle_plate && (
                            <p className="text-[10px] font-black text-zinc-700 bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 rounded truncate">
                              Plate: {currentSelectedOrder.driver.vehicle_plate}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  {((fetchedOrderDetail?.delivery_signature_url || fetchedOrderDetail?.delivery_photo_url) || (currentSelectedOrder?.delivery_signature_url || currentSelectedOrder?.delivery_photo_url)) && (
                    <div className="pt-2 border-t border-zinc-100">
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">✅ Delivery Evidence (POD)</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {(fetchedOrderDetail?.delivery_signature_url || currentSelectedOrder?.delivery_signature_url) && (
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Recipient Signature (POD)</p>
                            <div className="border border-zinc-200 rounded-lg p-2 bg-zinc-50/50 inline-block">
                              <img
                                src={fetchedOrderDetail?.delivery_signature_url || currentSelectedOrder?.delivery_signature_url}
                                alt="Customer Signature"
                                className="h-20 max-w-full object-contain"
                              />
                            </div>
                          </div>
                        )}
                        {(fetchedOrderDetail?.delivery_photo_url || currentSelectedOrder?.delivery_photo_url) && (
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Doorstep Photo Proof</p>
                            <div className="border border-zinc-200 rounded-lg overflow-hidden bg-zinc-50/50 max-w-[200px]">
                              <img
                                src={fetchedOrderDetail?.delivery_photo_url || currentSelectedOrder?.delivery_photo_url}
                                alt="Doorstep Photo Proof"
                                className="h-20 w-full object-cover"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Pending Handover Details */}
            {currentSelectedOrder?.reserved_by_user_id && !currentSelectedOrder?.delivered_by_user_id && (
              <div className="mb-6">
                <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3">Pending Handover Details</h4>
                <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200/60 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 bg-amber-100 rounded-lg flex items-center justify-center text-amber-800 font-black text-xs border border-amber-200">
                      {(currentSelectedOrder.last_released_by_driver?.name ?? "WH").substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
                        <Truck className="h-3.5 w-3.5 animate-pulse text-amber-500" /> Physical Possession (Releasing)
                      </p>
                      <p className="text-sm font-bold text-zinc-800 truncate mt-0.5">
                        {currentSelectedOrder.last_released_by_driver?.name ?? "Warehouse Hub"}
                      </p>
                      {currentSelectedOrder.last_released_by_driver?.phone && (
                        <p className="text-[11px] font-bold text-amber-850 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded inline-block mt-0.5">
                          📞 {currentSelectedOrder.last_released_by_driver.phone}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="border-t border-amber-200/50 pt-2 flex items-center gap-3">
                    <div className="h-9 w-9 bg-blue-50 rounded-lg flex items-center justify-center text-blue-700 font-black text-xs border border-blue-200">
                      {(currentSelectedOrder.reserved_by_driver?.name ?? "DR").substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Reserved By (Claiming Driver)</p>
                      <p className="text-sm font-bold text-zinc-800 truncate mt-0.5">
                        {currentSelectedOrder.reserved_by_driver?.name ?? `Driver #${currentSelectedOrder.reserved_by_user_id}`}
                      </p>
                      {currentSelectedOrder.reserved_by_driver?.phone && (
                        <p className="text-[11px] font-bold text-blue-800 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded inline-block mt-0.5">
                          📞 {currentSelectedOrder.reserved_by_driver.phone}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Released and unclaimed possession */}
            {currentSelectedOrder?.last_released_by_user_id && !currentSelectedOrder?.delivered_by_user_id && !currentSelectedOrder?.reserved_by_user_id && (
              <div className="mb-6">
                <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-3 flex items-center gap-1">
                  <Truck className="h-3.5 w-3.5 text-rose-500" /> Physical Possession (Released Order)
                </h4>
                <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-200/60 text-left">
                  <p className="text-[10px] font-bold text-rose-800 uppercase tracking-wider">Releasing Driver possessing package</p>
                  <p className="text-sm font-bold text-zinc-800 mt-0.5">{currentSelectedOrder.last_released_by_driver?.name ?? `Driver #${currentSelectedOrder.last_released_by_user_id}`}</p>
                  {currentSelectedOrder.last_released_by_driver?.phone && (
                    <p className="text-[11px] font-bold text-rose-800 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded inline-block mt-1">
                      📞 {currentSelectedOrder.last_released_by_driver.phone}
                    </p>
                  )}
                  <p className="text-[10px] text-zinc-500 font-semibold mt-2 leading-relaxed">
                    This order was released back to the pool but has not been secured by another driver yet. The physical package is still in this driver's possession.
                  </p>
                </div>
              </div>
            )}

            {/* Handover Flow / Timeline */}
            <div className="mb-6">
              <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <ArrowRightLeft className="h-3.5 w-3.5 text-indigo-500" />
                Handover Flow Timeline
              </h4>
              <div className={cn(
                "bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-left",
                handoverHistory.length > 5 ? "max-h-[380px] overflow-y-auto custom-scrollbar" : "space-y-4"
              )}>
                {loadingHandoverHistory ? (
                  <div className="flex items-center justify-center py-4 gap-2 text-zinc-400 text-xs font-bold uppercase tracking-wider">
                    <Loader2 className="h-4 w-4 animate-spin text-indigo-500" /> Loading Timeline...
                  </div>
                ) : handoverHistory.length === 0 ? (
                  <p className="text-xs text-zinc-450 font-medium text-center py-2">No handover history logged for this order yet.</p>
                ) : (
                  <div className={cn("relative border-l border-zinc-250 pl-4 ml-1", handoverHistory.length > 5 ? "space-y-4 pb-2" : "space-y-4")}>
                    {handoverHistory.map((log: any, idx: number) => {
                      let iconBg = "bg-zinc-200 text-zinc-700";
                      let actionText = log.action;

                      if (log.action.includes("RESERVED")) {
                        iconBg = "bg-amber-100 text-amber-700 border border-amber-250";
                      } else if (log.action.includes("SECURED")) {
                        iconBg = "bg-indigo-105 text-indigo-700 border border-indigo-250";
                      } else if (log.action.includes("HANDOVER")) {
                        iconBg = "bg-blue-100 text-blue-700 border border-blue-250";
                      } else if (log.action.includes("FAILURE") || log.action.includes("WRONG")) {
                        iconBg = "bg-rose-100 text-rose-700 border border-rose-250";
                      } else if (log.action.includes("DELIVERED")) {
                        iconBg = "bg-emerald-100 text-emerald-700 border border-emerald-250";
                      } else if (log.action.includes("RELEASED")) {
                        iconBg = "bg-orange-100 text-orange-700 border border-orange-250";
                      } else if (log.action.includes("RETURN") || log.action.includes("REFUND") || log.action.includes("VOIDED")) {
                        iconBg = "bg-purple-100 text-purple-700 border border-purple-250";
                      }

                      // Determine affected products for return/refund log entries
                      const isReturnRefundLog = (
                        log.action === "RETURN_REQUEST_CREATED" ||
                        log.action === "RETURN_REFUND_PROCESSED" ||
                        log.action === "ORDER_VOIDED_REFUNDED_PARTIAL" ||
                        log.action === "RETURN_REQUEST_APPROVED"
                      );
                      const affectedItems = isReturnRefundLog
                        ? (currentSelectedOrder?.items || []).filter((i: any) => i.cancellation_status === "Cancelled")
                        : [];

                      return (
                        <div key={log.id || idx} className="relative">
                          {/* Dot/Icon */}
                          <span className={cn(
                            "absolute -left-[25px] top-0 h-4.5 w-4.5 rounded-full flex items-center justify-center text-[8px] font-bold shadow-xs",
                            iconBg
                          )}>
                            {idx + 1}
                          </span>
                          <div className="space-y-0.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-black uppercase tracking-wider text-slate-800">
                                {actionText.replace(/_/g, " ")}
                              </span>
                              <span className="text-[9px] text-zinc-400 font-medium shrink-0">
                                {new Date(log.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-650 font-medium leading-relaxed">{log.description}</p>
                            {/* Show affected products for return/refund entries */}
                            {isReturnRefundLog && affectedItems.length > 0 && (
                              <div className="mt-1.5 bg-purple-50 border border-purple-100 rounded-lg px-2.5 py-2 space-y-1">
                                <p className="text-[9px] font-black uppercase tracking-wider text-purple-500">Products in Refund/Return:</p>
                                {affectedItems.map((item: any, i: number) => (
                                  <div key={i} className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-purple-200 text-purple-800 text-[8px] font-black shrink-0">{i + 1}</span>
                                      <span className="text-[10px] font-bold text-zinc-700 truncate">{item.product?.name || `Item #${item.id}`}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {item.product?.part_number && (
                                        <span className="text-[9px] font-bold text-[#0052cc] bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">{item.product.part_number}</span>
                                      )}
                                      <span className="text-[9px] font-bold text-red-600 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded">Qty: {item.quantity}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            {log.user && (
                              <p className="text-[9px] font-bold text-zinc-400 mt-0.5">
                                Action by: <span className="text-zinc-500 font-black">{log.user.name}</span> ({log.user.role})
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {handoverHistory.length > 5 && (
                      <div className="sticky bottom-0 pt-2 text-center">
                        <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">↑ Scroll to see all {handoverHistory.length} events</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>


            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Items Summary</h4>
              {(() => {
                const cancelledItems = (currentSelectedOrder?.items || []).filter((i: any) => i.cancellation_status === "Cancelled");
                const cancelledProductTotal = cancelledItems.reduce((s: number, i: any) => s + Number(i.price) * Number(i.quantity), 0);
                const refundedAmount = Number(currentSelectedOrder?.refunded_amount || 0);
                const refundedShippingTotal = Math.max(0, refundedAmount - cancelledProductTotal);
                const cancelledQtyTotal = Math.max(1, cancelledItems.reduce((s: number, i: any) => s + Number(i.quantity), 0));
                const perUnitShippingRefunded = cancelledQtyTotal > 0 ? refundedShippingTotal / cancelledQtyTotal : 0;

                return (currentSelectedOrder?.items || []).map((item: any, idx: number) => {
                  const isItemCancelled = item.cancellation_status === "Cancelled";
                  const itemProductCost = Number(item.price) * Number(item.quantity);
                  const itemShippingShare = isItemCancelled ? perUnitShippingRefunded * Number(item.quantity) : 0;
                  const itemRefundTotal = itemProductCost + itemShippingShare;
                  return (
                    <div key={idx} className={cn("flex justify-between items-start py-3 border-b last:border-0", isItemCancelled && "bg-red-50/50 px-3 py-2 rounded-xl border border-red-100")}>
                      <div className="space-y-1 flex-1 min-w-0">
                        <p className="font-bold text-zinc-900 text-sm flex items-center gap-2 flex-wrap">
                          <span className={cn(isItemCancelled && "line-through text-zinc-400 font-medium")}>
                            {item.product?.name || `Part ID: ${item.product_id}`}
                          </span>
                          {isItemCancelled && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-red-100 text-red-700 border border-red-200">
                              Cancelled / Refunded
                            </span>
                          )}
                        </p>
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-zinc-500 font-medium">
                          <span className={cn(isItemCancelled && "line-through text-zinc-400")}>
                            Qty: {item.quantity} × Ksh {Number(item.price).toLocaleString()}
                          </span>
                          {item.product?.part_number && (
                            <>
                              <span>|</span>
                              <span className={cn("font-semibold text-[#0052cc]", isItemCancelled && "text-zinc-455 line-through")}>Part No: {item.product.part_number}</span>
                            </>
                          )}
                          {item.product?.engine_model && (
                            <>
                              <span>|</span>
                              <span className={cn(isItemCancelled && "text-zinc-455 line-through")}>Engine: {item.product.engine_model}</span>
                            </>
                          )}
                        </div>
                        {item.product?.suitable_vehicle && (
                          <p className={cn("text-[11px] text-zinc-500 font-medium", isItemCancelled && "line-through text-zinc-400")}>Suitable: {item.product.suitable_vehicle}</p>
                        )}
                        {/* Refund breakdown shown per cancelled item */}
                        {isItemCancelled && (
                          <p className="text-[10px] font-semibold text-red-600 mt-1">
                            Refunded: Ksh {Math.round(itemProductCost).toLocaleString()} product
                            {itemShippingShare > 0 && <> + Ksh {Math.round(itemShippingShare).toLocaleString()} shipping</>}
                            {" "}= <span className="font-black">Ksh {Math.round(itemRefundTotal).toLocaleString()}</span>
                          </p>
                        )}
                      </div>
                      <p className={cn("font-bold text-zinc-900 shrink-0 ml-2", isItemCancelled && "line-through text-red-500")}>
                        Ksh {(Number(item.price) * item.quantity).toLocaleString()}
                      </p>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Cancellation / Refund Details — shows for ANY partial or full cancellation */}
            {(currentSelectedOrder?.status === "Cancelled" ||
              currentSelectedOrder?.status === "Cancellation Requested" ||
              currentSelectedOrder?.refund_transaction_id ||
              currentSelectedOrder?.refund_status ||
              currentSelectedOrder?.items?.some((i: any) => i.cancellation_status === "Cancelled")) && (
                <div className="mt-6 bg-red-50 p-4 rounded-xl border border-red-200">
                  <h4 className="text-[11px] font-bold text-red-800 uppercase tracking-widest mb-3">Cancellation / Refund Details</h4>
                  <div className="space-y-2">
                    {currentSelectedOrder.cancellation_reason && (
                      <p className="text-xs font-semibold text-red-900"><span className="text-red-700">Reason:</span> {currentSelectedOrder.cancellation_reason}</p>
                    )}
                    <p className="text-xs font-semibold text-red-900">
                      <span className="text-red-700">Refund Status:</span>{" "}
                      <span className={cn(
                        "uppercase tracking-wider font-black",
                        (currentSelectedOrder.refund_status === "Completed" || currentSelectedOrder.refund_transaction_id || Number(currentSelectedOrder.refunded_amount || 0) > 0) ? "text-green-700" : "text-orange-600"
                      )}>
                        {currentSelectedOrder.refund_status || (currentSelectedOrder.refund_transaction_id || Number(currentSelectedOrder.refunded_amount || 0) > 0 ? "Completed" : "Pending")}
                      </span>
                    </p>
                    {/* Total refunded amount — reads from backend-persisted refunded_amount */}
                    {(() => {
                      const refunded = Number(currentSelectedOrder?.refunded_amount || 0);
                      if (refunded <= 0) return null;
                      return (
                        <p className="text-xs font-semibold text-red-900">
                          <span className="text-red-700">Total Refunded:</span>{" "}
                          <span className="font-black">Ksh {Math.round(refunded).toLocaleString()}</span>
                          <span className="text-[10px] text-zinc-500 ml-1">(product + shipping)</span>
                        </p>
                      );
                    })()}
                    {currentSelectedOrder.refund_transaction_id && (
                      <p className="text-[11px] font-black text-green-700 bg-green-50 px-2.5 py-1.5 inline-block rounded border border-green-200 uppercase tracking-wider mt-1">
                        Refund Evidence Tx Ref: {currentSelectedOrder.refund_transaction_id}
                      </p>
                    )}
                  </div>
                </div>
              )}

            <div className="mt-6 pt-4 border-t border-zinc-100 space-y-2">
              {(() => {
                const originalShipping = Number(currentSelectedOrder?.shipping_fee || 0);
                const refundedAmount = Number(currentSelectedOrder?.refunded_amount || 0);
                const hasRefund = refundedAmount > 0;
                return (
                  <div className="flex justify-between items-center text-zinc-500 font-bold text-[11px] uppercase tracking-tight">
                    <span>Shipping ({currentSelectedOrder?.shipping_method})</span>
                    <span className="flex items-center gap-1.5">
                      Ksh {originalShipping.toLocaleString()}
                      {hasRefund && originalShipping === 0 && (
                        <span className="text-[9px] font-black text-red-500 uppercase bg-red-50 px-1.5 py-0.5 rounded border border-red-100 ml-1">Refunded</span>
                      )}
                    </span>
                  </div>
                );
              })()}
              <div className="flex justify-between items-center">
                <span className="font-bold text-zinc-900 text-sm">Total Settlement</span>
                <span className="text-xl font-black text-zinc-900">Ksh {Number(currentSelectedOrder?.total_amount).toLocaleString()}</span>
              </div>
            </div>
          </div>
          <DialogFooter className="p-4 bg-zinc-50 border-t flex justify-end gap-3 m-0 shrink-0">
            <Button variant="outline" className="font-bold" onClick={() => setIsOrderModalOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Walk-in POS Order Creation Modal */}
      <Dialog open={isWalkInModalOpen} onOpenChange={setIsWalkInModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] w-full p-0 overflow-hidden bg-white rounded-2xl border-none shadow-2xl">
          <DialogHeader className="p-6 bg-white border-b">
            <DialogTitle className="text-xl font-bold text-zinc-900">Place Walk-In Store Order</DialogTitle>
            <DialogDescription className="text-zinc-400 font-medium text-xs mt-1">
              Create an immediate store order, select inventory items, and process walk-in customer payment.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitWalkInOrder} className="flex flex-col">
            <div className="p-6 space-y-6 max-h-[60vh] sm:max-h-[70vh] overflow-y-auto">

              {/* Section 1: Customer Profile */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">1. Customer Identification</h4>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-500">Customer Type</label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    {(["walkin", "new"] as const).map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setSelectedCustomerId(opt)}
                        className={cn("flex-1 h-10 rounded-lg text-xs font-bold border transition-colors",
                          selectedCustomerId === opt
                            ? opt === "new" ? "bg-blue-600 text-white border-blue-600" : "bg-emerald-600 text-white border-emerald-600"
                            : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400"
                        )}
                      >
                        {opt === "walkin" ? "Quick Walk-In (Guest)" : "+ Register New Customer"}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedCustomerId === "walkin" && (
                  <div className="bg-emerald-50/40 border border-emerald-100 rounded-xl p-4 space-y-3">
                    <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5" /> Customer Info ({shippingMethod === "Local Delivery" ? "Required for Dispatch" : "Optional for Pickup"})
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-600">
                          Customer Name {shippingMethod === "Local Delivery" && <span className="text-red-500">*</span>}
                        </label>
                        <Input placeholder="Full name" className="h-10 border-emerald-200 rounded-lg bg-white"
                          value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-600">
                          Phone Number {shippingMethod === "Local Delivery" && <span className="text-red-500">*</span>}
                        </label>
                        <Input placeholder="07XXXXXXXX" className="h-10 border-emerald-200 rounded-lg bg-white"
                          value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value.replace(/\D/g, ""))} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-600">Email Address <span className="text-zinc-400 font-normal">(optional)</span></label>
                        <Input type="email" placeholder="email@example.com" className="h-10 border-emerald-200 rounded-lg bg-white"
                          value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} />
                      </div>
                    </div>
                  </div>
                )}

                {selectedCustomerId === "new" && (
                  <div className="space-y-4 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                    {/* Info banner */}
                    <div className="flex items-start gap-2 bg-blue-100/70 border border-blue-200 rounded-lg px-3 py-2.5">
                      <span className="text-blue-600 mt-0.5">ℹ️</span>
                      <p className="text-[11px] text-blue-700 font-medium leading-snug">
                        Set an initial password for this customer. They can log in using their email and this password, then reset it from their portal.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-500">Full Name <span className="text-red-500">*</span></label>
                        <Input placeholder="Customer Name" className="h-10 border-zinc-200 rounded-lg bg-white"
                          value={newCustomerData.name} onChange={(e) => setNewCustomerData({ ...newCustomerData, name: e.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-500">Email Address <span className="text-red-500">*</span> <span className="text-zinc-400 font-normal">(used for login)</span></label>
                        <Input type="email" placeholder="name@example.com" className="h-10 border-zinc-200 rounded-lg bg-white"
                          value={newCustomerData.email} onChange={(e) => setNewCustomerData({ ...newCustomerData, email: e.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-500">Phone Number <span className="text-red-500">*</span> <span className="text-zinc-400">(07XXXXXXXX)</span></label>
                        <Input placeholder="0712345678" className="h-10 border-zinc-200 rounded-lg bg-white"
                          value={newCustomerData.phone} onChange={(e) => setNewCustomerData({ ...newCustomerData, phone: e.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-500">City / Town</label>
                        <Input placeholder="Nairobi" className="h-10 border-zinc-200 rounded-lg bg-white"
                          value={newCustomerData.address} onChange={(e) => setNewCustomerData({ ...newCustomerData, address: e.target.value })} />
                      </div>
                    </div>

                    {/* Password fields — always required */}
                    <div className="pt-2 border-t border-blue-100">
                      <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest mb-3">🔐 Login Credentials</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-zinc-500">Initial Password <span className="text-red-500">*</span></label>
                          <div className="relative">
                            <Input
                              type={showNewPass ? "text" : "password"}
                              placeholder="Min 8 characters"
                              className="h-10 border-zinc-200 rounded-lg bg-white pr-10"
                              value={newCustomerData.password}
                              onChange={(e) => setNewCustomerData({ ...newCustomerData, password: e.target.value })}
                            />
                            <button type="button" onClick={() => setShowNewPass(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                              {showNewPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-zinc-500">Confirm Password <span className="text-red-500">*</span></label>
                          <div className="relative">
                            <Input
                              type={showConfirmPass ? "text" : "password"}
                              placeholder="Repeat password"
                              className="h-10 border-zinc-200 rounded-lg bg-white pr-10"
                              value={newCustomerData.confirmPassword}
                              onChange={(e) => setNewCustomerData({ ...newCustomerData, confirmPassword: e.target.value })}
                            />
                            <button type="button" onClick={() => setShowConfirmPass(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                              {showConfirmPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Section 2: Add Inventory Items */}
              <div className="space-y-4 pt-4 border-t border-zinc-100">
                <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">2. Select & Add Spare Parts</h4>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="col-span-1 md:col-span-5 space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-500">Product</label>
                    <SearchableDropdown
                      items={productDropdownItems}
                      value={selectedProductId}
                      onChange={(val) => { setSelectedProductId(val); setSelectedWarehouseId(""); }}
                      placeholder="Search spare parts..."
                    />
                  </div>

                  <div className="col-span-1 md:col-span-4 space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-500">Source Warehouse</label>
                    <SearchableDropdown
                      items={warehouseDropdownItems}
                      value={selectedWarehouseId}
                      onChange={(val) => setSelectedWarehouseId(val)}
                      placeholder={selectedProductId ? "Choose hub..." : "Choose hub..."}
                      disabled={!selectedProductId}
                    />
                  </div>

                  <div className="col-span-1 md:col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-500">Qty</label>
                    <Input
                      type="number"
                      min={1}
                      className="h-10 border-zinc-200 rounded-lg"
                      value={addQuantity}
                      onChange={(e) => setAddQuantity(parseInt(e.target.value) || 1)}
                      disabled={!selectedWarehouseId}
                    />
                  </div>

                  <div className="col-span-1 md:col-span-1">
                    <Button
                      type="button"
                      onClick={handleAddItemToOrder}
                      disabled={!selectedWarehouseId}
                      className="h-10 w-full bg-zinc-900 text-white rounded-lg hover:bg-zinc-800"
                    >
                      Add
                    </Button>
                  </div>
                </div>

                {/* Items Added Table */}
                {orderItems.length > 0 ? (
                  <>
                    {/* Desktop View */}
                    <div className="hidden md:block border border-zinc-200 rounded-xl overflow-x-auto custom-scrollbar bg-zinc-50/50 mt-3">
                      <Table className="min-w-[600px]">
                        <TableHeader className="bg-zinc-50">
                          <TableRow>
                            <TableHead className="h-8 py-1.5 text-xs font-bold text-zinc-600">Product</TableHead>
                            <TableHead className="h-8 py-1.5 text-xs font-bold text-zinc-600">Warehouse</TableHead>
                            <TableHead className="h-8 py-1.5 text-xs font-bold text-zinc-600 text-center">Qty</TableHead>
                            <TableHead className="h-8 py-1.5 text-xs font-bold text-zinc-600 text-right">Price</TableHead>
                            <TableHead className="h-8 py-1.5 text-xs font-bold text-zinc-600 text-right">Subtotal</TableHead>
                            <TableHead className="h-8 py-1.5 text-xs font-bold text-zinc-600 w-12"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {orderItems.map((item, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="py-2 text-xs font-bold text-zinc-800">{item.name}</TableCell>
                              <TableCell className="py-2 text-xs text-zinc-500 font-medium">{item.warehouse_name}</TableCell>
                              <TableCell className="py-2 text-xs text-center font-bold text-zinc-700">{item.quantity}</TableCell>
                              <TableCell className="py-2 text-xs text-right text-zinc-600">Ksh {item.price.toLocaleString()}</TableCell>
                              <TableCell className="py-2 text-xs text-right font-black text-zinc-900">Ksh {(item.price * item.quantity).toLocaleString()}</TableCell>
                              <TableCell className="py-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItemFromOrder(idx)}
                                  className="text-red-500 hover:text-red-700 text-xs font-bold whitespace-nowrap"
                                >
                                  Remove
                                </button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Mobile View */}
                    <div className="block md:hidden space-y-2 mt-3">
                      {orderItems.map((item, idx) => (
                        <div key={idx} className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 flex flex-col gap-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-xs font-bold text-zinc-950 leading-tight">{item.name}</p>
                              <p className="text-[10px] text-zinc-500 font-medium mt-0.5">Hub: {item.warehouse_name}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveItemFromOrder(idx)}
                              className="text-red-600 hover:text-red-800 text-xs font-black bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded shrink-0 transition-all border border-red-200"
                            >
                              Remove
                            </button>
                          </div>
                          <div className="flex justify-between items-center text-xs pt-1.5 border-t border-zinc-100 font-medium text-zinc-600">
                            <span>Qty: <strong className="text-zinc-800">{item.quantity}</strong> × Ksh {item.price.toLocaleString()}</span>
                            <span className="font-black text-zinc-900">Ksh {(item.price * item.quantity).toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="p-6 text-center border-2 border-dashed border-zinc-200 rounded-xl text-zinc-400 text-xs font-bold uppercase tracking-wider bg-zinc-50/20">
                    No spare parts added to this walk-in order.
                  </div>
                )}
              </div>

              {/* Section 3: Billing & Payment */}
              <div className="space-y-4 pt-4 border-t border-zinc-100">
                <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">3. Payment & Settlement</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-500">Payment Status</label>
                    <select
                      className="w-full h-10 px-3 border border-zinc-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-primary/20 text-zinc-600 font-medium"
                      value={paymentStatus}
                      onChange={(e) => setPaymentStatus(e.target.value)}
                    >
                      <option value="Paid">Fully Paid</option>
                      <option value="Pending">Payment Pending</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-500">Payment Method
                      {paymentStatus === "Pending" && <span className="ml-2 text-[10px] text-amber-500 font-bold">(Blocked — no payment received)</span>}
                    </label>
                    <select
                      className={cn("w-full h-10 px-3 border rounded-lg text-sm bg-white outline-none text-zinc-600 font-medium transition-opacity",
                        paymentStatus === "Pending" ? "opacity-40 cursor-not-allowed border-zinc-100 bg-zinc-50" : "border-zinc-200 focus:ring-2 focus:ring-primary/20"
                      )}
                      value={paymentMethod}
                      onChange={(e) => { if (paymentStatus !== "Pending") { setPaymentMethod(e.target.value); setPaymentRefCode(""); } }}
                      disabled={paymentStatus === "Pending"}
                    >
                      <option value="Cash">Cash Sale</option>
                      <option value="M-Pesa">M-Pesa Direct</option>
                      <option value="Card">Visa / MasterCard</option>
                      <option value="Bank Transfer">Bank EFT</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-500">Fulfillment Method</label>
                    <select
                      className="w-full h-10 px-3 border border-zinc-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-primary/20 text-zinc-600 font-medium"
                      value={shippingMethod}
                      onChange={(e) => { setShippingMethod(e.target.value); if (e.target.value === "Pickup") { setShippingFee(0); setShippingCountry(""); setShippingCity(""); setShippingAddress(""); setRecipientName(""); setRecipientPhone(""); setRecipientEmail(""); } }}
                    >
                      <option value="Pickup">In-Store Collection</option>
                      <option value="Local Delivery">Dispatch / Shipping</option>
                    </select>
                  </div>
                </div>

                {/* Digital Payment Reference Code */}
                {isDigitalPayment(paymentMethod) && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-500 flex items-center gap-1.5">
                      <CreditCard className="h-3.5 w-3.5 text-blue-500" />
                      {paymentMethod} Reference Code <span className="text-red-500">*</span>
                    </label>
                    <Input
                      placeholder={`Enter ${paymentMethod} transaction reference...`}
                      className="h-10 border-blue-200 rounded-lg bg-blue-50/30 focus:ring-blue-200"
                      value={paymentRefCode}
                      onChange={(e) => setPaymentRefCode(e.target.value)}
                    />
                    <p className="text-[10px] text-zinc-400">This will be saved as: {paymentMethod} (Ref: {paymentRefCode || "..."}) on the order.</p>
                  </div>
                )}

                {shippingMethod === "Local Delivery" && (
                  <div className="space-y-4">
                    {/* Delivery fee + country + city + address */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-500">Delivery Fee (Ksh)</label>
                        <Input type="number" min={0} placeholder="e.g. 500" className="h-10 border-zinc-200 rounded-lg bg-white"
                          value={shippingFee || ""} onChange={(e) => setShippingFee(parseFloat(e.target.value) || 0)} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-500">Destination Country <span className="text-red-500">*</span></label>
                        <SearchableDropdown
                          items={countryDropdownItems}
                          value={shippingCountry}
                          onChange={(val) => { setShippingCountry(val); setShippingCity(""); }}
                          placeholder="Select Country"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-zinc-500">Destination City <span className="text-red-500">*</span></label>
                          {activeOriginHubCity && (
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              🔒 Local Dispatch (Hub: {activeOriginHubCity})
                            </span>
                          )}
                        </div>
                        <SearchableDropdown
                          disabled={!shippingCountry}
                          items={cityDropdownItems}
                          value={shippingCity}
                          onChange={(val) => setShippingCity(val)}
                          placeholder="Select City"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-500">Delivery Address <span className="text-red-500">*</span></label>
                        <Input placeholder="e.g. Tom Mboya St, CBD" className="h-10 border-zinc-200 rounded-lg bg-white"
                          value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} />
                      </div>
                    </div>

                  </div>
                )}

                {/* Price Breakdown */}
                <div className="bg-zinc-50 rounded-xl border border-zinc-200 overflow-hidden mt-3">
                  {(() => {
                    const subtotal = orderItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
                    const fee = Number(shippingFee) || 0;
                    const grandTotal = subtotal + fee;
                    return (
                      <div className="divide-y divide-zinc-100">
                        <div className="flex justify-between items-center px-4 py-2.5">
                          <span className="text-xs font-bold text-zinc-400 uppercase">Subtotal</span>
                          <span className="text-sm font-black text-zinc-700">Ksh {subtotal.toLocaleString()}</span>
                        </div>
                        {fee > 0 && (
                          <div className="flex justify-between items-center px-4 py-2.5">
                            <span className="text-xs font-bold text-zinc-400 uppercase">Shipping Fee</span>
                            <span className="text-sm font-black text-zinc-500">+ Ksh {fee.toLocaleString()}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center px-4 py-3 bg-zinc-100/60">
                          <span className="font-bold text-zinc-600 text-xs uppercase">Grand Total</span>
                          <span className="text-xl font-black text-zinc-900">Ksh {grandTotal.toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            <DialogFooter className="p-4 bg-zinc-50 border-t flex justify-end gap-3 m-0 shrink-0">
              <Button
                type="button"
                variant="outline"
                className="font-bold text-xs rounded-lg"
                onClick={() => setIsWalkInModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSavingOrder}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm font-bold flex items-center"
              >
                {isSavingOrder && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                COMPLETE WALK-IN ORDER
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payment Pending Confirmation Modal */}
      <Dialog open={isPendingConfirmOpen} onOpenChange={(open) => { setIsPendingConfirmOpen(open); if (!open) setPendingOrderTarget(null); }}>
        <DialogContent className="sm:max-w-[420px] p-0 overflow-hidden bg-white rounded-2xl shadow-2xl border border-zinc-200">
          <div className="p-6 text-center space-y-4">
            <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto border-2 border-amber-100">
              <RefreshCw className="h-7 w-7 text-amber-600 animate-spin-slow" />
            </div>
            <div className="space-y-1.5">
              <DialogTitle className="text-lg font-bold text-zinc-900 text-center block">Mark Payment as Pending?</DialogTitle>
              <p className="text-xs text-zinc-500 leading-relaxed text-center">
                Are you sure you want to mark the payment for order <span className="font-extrabold text-zinc-700">{pendingOrderTarget?.tracking_number}</span> back to <span className="font-bold text-amber-600">Pending</span>? This will reset the payment confirmation details.
              </p>
            </div>
          </div>
          <DialogFooter className="p-4 bg-zinc-50/50 flex items-center justify-center gap-3 border-t m-0 shrink-0">
            <Button
              variant="outline"
              className="flex-1 h-11 rounded-xl font-bold text-xs"
              onClick={() => setIsPendingConfirmOpen(false)}
              disabled={isMarkingPending}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 h-11 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs"
              onClick={confirmMarkWalkInPending}
              disabled={isMarkingPending}
            >
              {isMarkingPending ? <Loader2 className="h-4 w-4 animate-spin mr-2 inline" /> : null}
              Confirm Pending
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Void / Refund Confirmation Dialog */}
      <Dialog open={isVoidDialogOpen} onOpenChange={(open) => { if (!open) { setIsVoidDialogOpen(false); setVoidOrderTarget(null); setSelectedVoidItemIds([]); setVoidQuantities({}); } }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[460px] w-full bg-white rounded-2xl border-none shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-11 w-11 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-zinc-900">Void & Refund Order Items</DialogTitle>
                <DialogDescription className="text-xs text-zinc-400 font-medium mt-0.5">
                  Ref: <span className="font-bold text-zinc-600">{voidOrderTarget?.tracking_number}</span>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="px-6 pb-4 space-y-4">
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 space-y-2">
              <p className="text-xs font-bold text-red-700">What happens when you process this refund:</p>
              <ul className="space-y-1 text-[11px] text-red-600 font-medium">
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />Selected items will be returned to their origin warehouse</li>
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />Their cost is deducted from your revenue records</li>
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />Order status is updated with refund completed</li>
              </ul>
            </div>

            {/* Products Checkbox List */}
            {voidOrderTarget?.items && voidOrderTarget.items.length > 0 && (
              <div className="space-y-2 border border-zinc-200 rounded-xl p-3 bg-zinc-50/50">
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                  Select Products to Void / Refund *
                </label>
                <div className="space-y-2 max-h-[180px] overflow-y-auto">
                  {voidOrderTarget.items.map((item: any) => {
                    const isCancelled = item.cancellation_status === "Cancelled";
                    const isChecked = selectedVoidItemIds.includes(item.id);
                    const qtyToCancel = voidQuantities[item.id] || item.quantity;
                    const activeUnits = Math.max(1, (voidOrderTarget.items || []).filter((i: any) => i.cancellation_status !== "Cancelled").reduce((s: number, i: any) => s + (i.quantity || 1), 0));
                    const remainingShippingFee = Number(voidOrderTarget.shipping_fee || 0);

                    // Use exact item.shipping_fee_per_unit from backend model (strictly 0 if not set)
                    const itemFeePerUnit = Number(item.shipping_fee_per_unit ?? 0);

                    const productCost = Number(item.price) * qtyToCancel;
                    const shippingShare = itemFeePerUnit * qtyToCancel;
                    const itemRefundTotal = productCost + shippingShare;
                    return (
                      <div key={item.id} className="flex flex-col py-2 border-b last:border-0 border-zinc-100 gap-1">
                        <div className="flex items-start justify-between text-xs gap-2">
                          <label className={cn("flex items-start gap-2 cursor-pointer select-none flex-1 min-w-0", isCancelled && "opacity-50 cursor-not-allowed")}>
                            <input
                              type="checkbox"
                              disabled={isCancelled}
                              checked={isChecked && !isCancelled}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedVoidItemIds([...selectedVoidItemIds, item.id]);
                                } else {
                                  setSelectedVoidItemIds(selectedVoidItemIds.filter(id => id !== item.id));
                                }
                              }}
                              className="w-4 h-4 accent-red-600 rounded cursor-pointer mt-0.5 shrink-0"
                            />
                            <span className={cn("font-bold text-zinc-800 leading-snug", isCancelled && "line-through")}>
                              {item.product?.name || "Genuine Spare Part"}
                              {isCancelled && <span className="ml-1 text-[10px] text-red-500 font-bold">(Refunded)</span>}
                            </span>
                          </label>
                          <span className="shrink-0 text-right flex flex-col items-end leading-snug">
                            <span className="text-zinc-500">{qtyToCancel} × Ksh {Number(item.price).toLocaleString()}</span>
                            {shippingShare > 0 && (
                              <span className="text-[10px] text-zinc-400">+ Ksh {shippingShare % 1 === 0 ? shippingShare.toFixed(0) : shippingShare.toFixed(2)} shipping</span>
                            )}
                            <span className="text-[11px] font-black text-zinc-700">= Ksh {(itemRefundTotal % 1 === 0 ? itemRefundTotal.toFixed(0) : itemRefundTotal.toFixed(2))}</span>
                          </span>
                        </div>
                        {isChecked && !isCancelled && (
                          <div className="flex items-center justify-between gap-2 pl-6 mt-1.5 pt-1.5 border-t border-dashed border-zinc-200 text-xs">
                            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Qty to Refund:</span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={qtyToCancel <= 1}
                                onClick={() => {
                                  const newQty = Math.max(1, qtyToCancel - 1);
                                  setVoidQuantities({ ...voidQuantities, [item.id]: newQty });
                                }}
                                className="h-7 w-7 rounded-lg border border-zinc-300 bg-white flex items-center justify-center font-bold text-zinc-700 hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xs"
                                title="Decrease quantity"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                              <input
                                type="number"
                                min={1}
                                max={item.quantity}
                                value={qtyToCancel}
                                onChange={(e) => {
                                  const val = Math.min(item.quantity, Math.max(1, parseInt(e.target.value) || 1));
                                  setVoidQuantities({ ...voidQuantities, [item.id]: val });
                                }}
                                className="w-12 h-7 rounded-lg border border-zinc-300 text-xs text-center font-extrabold focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-white shadow-xs"
                              />
                              <button
                                type="button"
                                disabled={qtyToCancel >= item.quantity}
                                onClick={() => {
                                  const newQty = Math.min(item.quantity, qtyToCancel + 1);
                                  setVoidQuantities({ ...voidQuantities, [item.id]: newQty });
                                }}
                                className="h-7 w-7 rounded-lg border border-zinc-300 bg-white flex items-center justify-center font-bold text-zinc-700 hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xs"
                                title="Increase quantity"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                              <span className="text-[10px] text-zinc-400 font-semibold ml-1">of {item.quantity} max</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Total to Refund — live preview based on checked items */}
                {selectedVoidItemIds.length > 0 && (() => {
                  const allItems = voidOrderTarget?.items || [];
                  const total = allItems
                    .filter((i: any) => selectedVoidItemIds.includes(i.id) && i.cancellation_status !== "Cancelled")
                    .reduce((sum: number, i: any) => {
                      const qty = voidQuantities[i.id] || i.quantity;
                      const itemFeePerUnit = Number(i.shipping_fee_per_unit ?? 0);
                      const productCost = Number(i.price) * qty;
                      const shippingShare = itemFeePerUnit * qty;
                      return sum + productCost + shippingShare;
                    }, 0);
                  return (
                    <div className="mt-2 pt-2 border-t border-zinc-200 flex justify-between items-center">
                      <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Total to Refund to Customer</span>
                      <span className="text-sm font-black text-red-600">
                        Ksh {(total % 1 === 0 ? total.toFixed(0) : total.toFixed(2))}
                      </span>
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="space-y-3">
              <div className="space-y-1 text-left">
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Refund Payment Method *</label>
                <select
                  value={refundPaymentMethod}
                  onChange={(e) => setRefundPaymentMethod(e.target.value)}
                  className="w-full h-9 rounded-md border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                >
                  <option value="M-Pesa Express">M-Pesa Express</option>
                  <option value="M-Pesa Paybill / Till">M-Pesa Paybill / Till</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cash / Over-The-Counter">Cash / Over-The-Counter</option>
                </select>
              </div>
              <div className="space-y-1 text-left">
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Refund Reason *</label>
                <textarea
                  rows={2}
                  placeholder="e.g., Customer requested refund, duplicate order..."
                  className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                />
              </div>
              <div className="space-y-1 text-left">
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Refund Evidence (Transaction ID / Reference) *</label>
                <Input
                  placeholder="e.g. M-Pesa Code or Receipt Ref..."
                  className="h-9 border-zinc-200 text-xs font-semibold"
                  value={voidTransactionId}
                  onChange={(e) => setVoidTransactionId(e.target.value)}
                />
              </div>
            </div>

            <p className="text-[10px] text-zinc-400 font-medium text-center">This action cannot be undone.</p>
          </div>
          <DialogFooter className="px-6 pb-6 flex gap-3 m-0 shrink-0">
            <Button variant="outline" className="flex-1 rounded-xl font-bold border-zinc-200 h-10 text-xs"
              onClick={() => { setIsVoidDialogOpen(false); setVoidOrderTarget(null); setSelectedVoidItemIds([]); setVoidQuantities({}); }}>
              Cancel
            </Button>
            <Button
              disabled={isVoiding || !voidReason.trim() || !voidTransactionId.trim() || selectedVoidItemIds.length === 0}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-sm h-10 text-xs"
              onClick={handleConfirmVoidRefund}
            >
              {isVoiding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Confirm Void & Refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Walk-In Order Dialog */}
      <Dialog open={isEditWalkInModalOpen} onOpenChange={(open) => { if (!open) { setIsEditWalkInModalOpen(false); setEditWalkInTarget(null); } }}>
        <DialogContent className="sm:max-w-[500px] bg-white rounded-2xl border-none shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4 border-b border-zinc-100">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                <Pencil className="h-5 w-5 text-[#0052cc]" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-zinc-900">Edit Walk-In Order</DialogTitle>
                <DialogDescription className="text-xs text-zinc-400 font-medium mt-0.5">
                  Ref: <span className="font-bold text-zinc-600">{editWalkInTarget?.tracking_number}</span>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
            {/* Payment Method */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Payment Method</label>
              <select
                className="h-10 w-full px-3 border border-zinc-200 rounded-lg text-sm font-semibold bg-zinc-50 outline-none focus:ring-2 focus:ring-[#0052cc]/20 text-zinc-700"
                value={editWalkInForm.payment_method}
                onChange={(e) => setEditWalkInForm({ ...editWalkInForm, payment_method: e.target.value })}
              >
                {["Cash", "M-Pesa", "Bank Transfer", "Card", "Credit"].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            {/* Payment Reference Code */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Payment Reference Code</label>
              <Input
                placeholder="e.g. MPESA code, cheque no..."
                className="h-10 border-zinc-200 rounded-lg bg-zinc-50 text-sm font-semibold"
                value={editWalkInForm.payment_ref_code}
                onChange={(e) => setEditWalkInForm({ ...editWalkInForm, payment_ref_code: e.target.value })}
              />
            </div>
            {/* Shipping Method */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Fulfillment Method</label>
                {(editWalkInTarget?.status === "Shipped" || editWalkInTarget?.status === "In Transit" || editWalkInTarget?.status === "Delivered") && (
                  <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Locked — Shipped/Delivered</span>
                )}
              </div>
              <select
                disabled={editWalkInTarget?.status === "Shipped" || editWalkInTarget?.status === "In Transit" || editWalkInTarget?.status === "Delivered"}
                className={cn(
                  "h-10 w-full px-3 border border-zinc-200 rounded-lg text-sm font-semibold bg-zinc-50 outline-none focus:ring-2 focus:ring-[#0052cc]/20 text-zinc-700",
                  (editWalkInTarget?.status === "Shipped" || editWalkInTarget?.status === "In Transit" || editWalkInTarget?.status === "Delivered") && "bg-zinc-100 cursor-not-allowed opacity-75"
                )}
                value={editWalkInForm.shipping_method}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "Pickup") {
                    setEditWalkInForm({
                      ...editWalkInForm,
                      shipping_method: val,
                      shipping_fee: 0,
                      shipping_country: "",
                      shipping_city: "In-Store",
                      shipping_address: "Walk-In Counter",
                    });
                  } else {
                    const defaultCountry = editWalkInForm.shipping_country || editCountryDropdownItems[0]?.id || "Kenya";
                    const cleanCity = editWalkInForm.shipping_city === "In-Store" ? "" : editWalkInForm.shipping_city;
                    const cleanAddress = editWalkInForm.shipping_address === "Walk-In Counter" ? "" : editWalkInForm.shipping_address;

                    setEditWalkInForm({
                      ...editWalkInForm,
                      shipping_method: val,
                      shipping_country: defaultCountry,
                      shipping_city: cleanCity,
                      shipping_address: cleanAddress,
                    });
                  }
                }}
              >
                {["Pickup", "Local Delivery"].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            {editWalkInForm.shipping_method === "Local Delivery" && (
              <>
                {/* Shipping Fee */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Shipping Fee (Ksh)</label>
                  <Input
                    type="number"
                    min={0}
                    disabled={editWalkInTarget?.status === "Shipped" || editWalkInTarget?.status === "In Transit" || editWalkInTarget?.status === "Delivered"}
                    placeholder="0"
                    className="h-10 border-zinc-200 rounded-lg bg-zinc-50 text-sm font-semibold disabled:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-75"
                    value={editWalkInForm.shipping_fee}
                    onChange={(e) => setEditWalkInForm({ ...editWalkInForm, shipping_fee: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                {/* Destination Country */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Destination Country</label>
                  <SearchableDropdown
                    disabled={editWalkInTarget?.status === "Shipped" || editWalkInTarget?.status === "In Transit" || editWalkInTarget?.status === "Delivered"}
                    items={editCountryDropdownItems}
                    value={editWalkInForm.shipping_country}
                    onChange={(val) => setEditWalkInForm({ ...editWalkInForm, shipping_country: val, shipping_city: "" })}
                    placeholder="Select Country"
                  />
                </div>
                {/* Destination City */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Destination City</label>
                    {editOriginHubCity && (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        🔒 Local Dispatch (Hub: {editOriginHubCity})
                      </span>
                    )}
                  </div>
                  <SearchableDropdown
                    disabled={!editWalkInForm.shipping_country || editWalkInTarget?.status === "Shipped" || editWalkInTarget?.status === "In Transit" || editWalkInTarget?.status === "Delivered"}
                    items={editCityDropdownItems}
                    value={editWalkInForm.shipping_city}
                    onChange={(val) => setEditWalkInForm({ ...editWalkInForm, shipping_city: val })}
                    placeholder="Select City"
                  />
                </div>
                {/* Delivery Address */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Delivery Address</label>
                  <Input
                    placeholder={(editWalkInTarget?.status === "Shipped" || editWalkInTarget?.status === "In Transit" || editWalkInTarget?.status === "Delivered") ? "" : "e.g. 123 Moi Avenue"}
                    disabled={editWalkInTarget?.status === "Shipped" || editWalkInTarget?.status === "In Transit" || editWalkInTarget?.status === "Delivered"}
                    className="h-10 border-zinc-200 rounded-lg bg-zinc-50 text-sm font-semibold disabled:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-75"
                    value={editWalkInForm.shipping_address}
                    onChange={(e) => setEditWalkInForm({ ...editWalkInForm, shipping_address: e.target.value })}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter className="px-6 pb-6 pt-4 border-t border-zinc-100 flex gap-3 m-0 shrink-0">
            <Button variant="outline" className="flex-1 rounded-xl font-bold border-zinc-200"
              onClick={() => { setIsEditWalkInModalOpen(false); setEditWalkInTarget(null); }}>
              Cancel
            </Button>
            <Button
              disabled={isSavingEditWalkIn}
              className="flex-1 bg-[#0052cc] hover:bg-[#0747a6] text-white rounded-xl font-bold shadow-sm"
              onClick={handleSaveEditWalkIn}
            >
              {isSavingEditWalkIn ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Pencil className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



      {/* Complete Refund Modal */}
      <Dialog open={isCompleteRefundModalOpen} onOpenChange={setIsCompleteRefundModalOpen}>
        <DialogContent className="rounded-lg shadow-xl sm:max-w-[450px] bg-white border-none p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4 border-b">
            <DialogTitle className="font-bold text-zinc-900">Complete Manual Refund</DialogTitle>
            <DialogDescription className="text-xs text-zinc-500">
              Record the transaction ID after you have manually refunded the customer.
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-4">
            <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
              <p className="text-sm font-bold text-amber-800">
                Refund Amount: Ksh {
                  (() => {
                    // Always read from the backend-persisted refunded_amount.
                    // Do NOT recalculate from items — when the order is fully cancelled
                    // the backend zeros shipping_fee on the record, so item-level math
                    // would omit the original shipping cost portion.
                    const persisted = Number(currentSelectedOrder?.refunded_amount || 0);
                    if (persisted > 0) return Math.round(persisted).toLocaleString();
                    // Fallback: if no persisted value yet, use total_amount
                    return Math.round(Number(currentSelectedOrder?.total_amount || 0)).toLocaleString();
                  })()
                }
              </p>
              <p className="text-xs text-amber-700 mt-1">
                Please transfer this amount manually (e.g. M-Pesa or Bank) to {currentSelectedOrder?.customer?.name || "the customer"}.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700 uppercase">Refund Transaction ID *</label>
              <Input
                placeholder="e.g. MPESA-ABC123XYZ"
                value={refundTransactionId}
                onChange={(e) => setRefundTransactionId(e.target.value)}
                className="h-10 border-zinc-200"
              />
            </div>
          </div>
          <DialogFooter className="p-4 bg-zinc-50 border-t m-0 shrink-0">
            <Button variant="outline" className="font-bold" onClick={() => setIsCompleteRefundModalOpen(false)}>Cancel</Button>
            <Button className="bg-amber-600 hover:bg-amber-700 text-white font-bold" onClick={handleCompleteRefund} disabled={isProcessingAction || !refundTransactionId.trim()}>
              {isProcessingAction ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Submit Refund Ref
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ── Assign Driver Modal ─────────────────────────────────────── */}
      <Dialog open={isAssignDriverModalOpen} onOpenChange={setIsAssignDriverModalOpen}>
        <DialogContent className="rounded-2xl shadow-2xl sm:max-w-[420px] bg-white border-none p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4 border-b bg-indigo-50">
            <DialogTitle className="font-bold text-zinc-900 flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-indigo-600" />
              Assign Delivery Driver
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-500">
              Order: <span className="font-bold text-zinc-700">{assignDriverTarget?.tracking_number}</span>
              {assignDriverTarget?.delivered_by_user_id && (
                <span className="ml-2 text-indigo-600 font-bold">(currently assigned)</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-4">
            {(() => {
              const targetDestCity = (assignDriverTarget?.shipment?.destination || assignDriverTarget?.shipping_city || "").trim();
              const availableDrivers = drivers.filter((d: any) => {
                if (!targetDestCity) return true;
                const destLower = targetDestCity.toLowerCase();
                const driverCity = (d.city || "").toLowerCase();
                const driverCountry = (d.country || "").toLowerCase();
                return driverCity.includes(destLower) || destLower.includes(driverCity) || (driverCity && destLower.startsWith(driverCity));
              });

              // Fallback to all drivers if no specific driver matched destination, but show filter badge
              const displayDrivers = availableDrivers.length > 0 ? availableDrivers : drivers;

              return (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Select Driver</label>
                    {targetDestCity && (
                      <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200">
                        📍 Filtered by Destination: {targetDestCity}
                      </span>
                    )}
                  </div>
                  {drivers.length === 0 ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-xs text-amber-700 font-bold">No active delivery drivers found.</p>
                      <p className="text-xs text-amber-600 mt-1">Create delivery drivers in Admins &amp; Audits → Delivery Drivers.</p>
                    </div>
                  ) : (
                    <select
                      value={selectedDriverId}
                      onChange={(e) => setSelectedDriverId(e.target.value)}
                      className="w-full h-11 px-3 border border-zinc-200 rounded-lg text-sm font-semibold bg-zinc-50 outline-none focus:ring-2 focus:ring-indigo-300"
                    >
                      <option value="">— Unassign / No Driver —</option>
                      {displayDrivers.map((d) => (
                        <option key={d.id} value={d.id.toString()}>
                          {d.name} {d.city || d.country ? `(${d.city || ""}${d.city && d.country ? ", " : ""}${d.country || ""})` : ""} {d.vehicle_plate ? ` · ${d.vehicle_plate}` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              );
            })()}
            {selectedDriverId && (() => {
              const d = drivers.find((dr) => dr.id.toString() === selectedDriverId);
              if (!d) return null;
              return (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 flex items-center gap-3">
                  <div className="h-9 w-9 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-700 font-black text-xs border border-indigo-200">
                    {d.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-zinc-800 truncate">{d.name}</p>
                    {d.phone && <p className="text-xs text-zinc-500 truncate">{d.phone}</p>}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(d.city || d.country) && (
                        <p className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded truncate">
                          📍 {d.city ? `${d.city}, ` : ""}{d.country || ""}
                        </p>
                      )}
                      {d.vehicle_plate && (
                        <p className="text-[10px] font-black text-zinc-700 bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 rounded truncate">
                          Plate: {d.vehicle_plate}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
          <DialogFooter className="p-4 bg-zinc-50 border-t m-0">
            <Button variant="outline" className="font-bold" onClick={() => setIsAssignDriverModalOpen(false)}>Cancel</Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
              onClick={handleAssignDriver}
              disabled={isAssigningDriver}
            >
              {isAssigningDriver ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
              {selectedDriverId ? "Assign Driver" : "Remove Assignment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Mark-Paid Dialog ─────────────────────────────────────────────── */}
      <Dialog open={isMarkPaidDialogOpen} onOpenChange={(v) => { if (!v) { setIsMarkPaidDialogOpen(false); setMarkPaidTarget(null); } }}>
        <DialogContent className="max-w-sm rounded-2xl p-0 overflow-hidden border-0 shadow-2xl">
          <DialogHeader className="px-6 pt-6 pb-4 bg-gradient-to-br from-emerald-50 to-teal-50 border-b border-emerald-100">
            <DialogTitle className="text-lg font-black text-emerald-900 flex items-center gap-2">
              <span className="h-8 w-8 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600 text-base">✓</span>
              Confirm Payment
            </DialogTitle>
            {markPaidTarget && (
              <p className="text-xs text-emerald-700 font-semibold mt-1">Order: <span className="font-black">{markPaidTarget.tracking_number}</span></p>
            )}
          </DialogHeader>
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Payment Method</label>
              <select
                value={markPaidMethod}
                onChange={(e) => { setMarkPaidMethod(e.target.value); setMarkPaidRefCode(""); }}
                className="w-full h-11 px-3 border border-zinc-200 rounded-lg text-sm font-semibold bg-zinc-50 outline-none focus:ring-2 focus:ring-emerald-300"
              >
                {["Cash", "M-Pesa", "Card", "Bank Transfer", "Credit", "Other"].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            {["M-Pesa", "Card", "Bank Transfer"].includes(markPaidMethod) && (
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                  Transaction / Reference Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={markPaidRefCode}
                  onChange={(e) => setMarkPaidRefCode(e.target.value)}
                  placeholder="e.g. MPESA123456"
                  className="w-full h-11 px-3 border border-zinc-200 rounded-lg text-sm font-semibold bg-white outline-none focus:ring-2 focus:ring-emerald-300"
                />
              </div>
            )}
            {markPaidTarget && (
              <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-100">
                <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-1">Order Total</p>
                <p className="text-2xl font-black text-zinc-900">
                  {(settings?.currency_symbol || "KES")} {parseFloat(markPaidTarget.total_amount || 0).toLocaleString("en-KE", { minimumFractionDigits: 2 })}
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="px-6 pb-6 pt-0 flex gap-2">
            <Button variant="outline" className="flex-1 font-bold" onClick={() => { setIsMarkPaidDialogOpen(false); setMarkPaidTarget(null); }}>
              Cancel
            </Button>
            <Button
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              onClick={handleConfirmMarkPaid}
              disabled={isMarkingPaid}
            >
              {isMarkingPaid ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isMarkingPaid ? "Saving…" : "Confirm Paid"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminOrdersPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-white"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>}>
      <AdminOrdersPageInner />
    </Suspense>
  );
}

