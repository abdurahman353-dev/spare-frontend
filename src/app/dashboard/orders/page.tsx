"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
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
  Pencil
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
import { SearchableDropdown } from "@/components/ui/searchable-dropdown";
import { toast } from "react-hot-toast";
import { exportOrdersPDF } from "@/lib/pdf-export";
import { useSettings } from "@/components/providers/SettingsProvider";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { buildFilterCityOptions, buildFilterCountryOptions } from "@/lib/shipping-locations";

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

function getWalkInPayStatusDisplay(order: { status?: string; payment_status?: string }) {
  if (isOrderVoided(order)) {
    return { label: "Cancelled / Refunded", className: "bg-red-100 text-red-700" };
  }
  if (order.payment_status === "Paid") {
    return { label: "Paid", className: "bg-emerald-100 text-emerald-700" };
  }
  return { label: order.payment_status || "Pending", className: "bg-amber-100 text-amber-700" };
}

export default function AdminOrdersPage() {
  const { settings } = useSettings();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [secondsSinceSync, setSecondsSinceSync] = useState(0);

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
  const [activeOrdersTab, setActiveOrdersTab] = useState<"Shipment" | "WalkIn">("Shipment");

  const [paymentStatus, setPaymentStatus] = useState<string>("Paid");
  const [shippingMethod, setShippingMethod] = useState<string>("Pickup");
  const [shippingFee, setShippingFee] = useState<number>(0);
  const [shippingCity, setShippingCity] = useState<string>("");
  const [shippingAddress, setShippingAddress] = useState<string>("");
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [voidOrderTarget, setVoidOrderTarget] = useState<any>(null);
  const [selectedVoidItemIds, setSelectedVoidItemIds] = useState<number[]>([]);
  const [isVoidDialogOpen, setIsVoidDialogOpen] = useState(false);
  const [isVoiding, setIsVoiding] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [voidTransactionId, setVoidTransactionId] = useState("");
  const [walkInPayStatusFilter, setWalkInPayStatusFilter] = useState("All");

  // Edit Walk-In Order
  const [isEditWalkInModalOpen, setIsEditWalkInModalOpen] = useState(false);
  const [editWalkInTarget, setEditWalkInTarget] = useState<any>(null);
  const [editWalkInForm, setEditWalkInForm] = useState({
    payment_method: "",
    payment_ref_code: "",
    shipping_method: "",
    shipping_fee: 0,
    shipping_city: "",
    shipping_address: "",
  });
  const [isSavingEditWalkIn, setIsSavingEditWalkIn] = useState(false);

  // Cancellation and Refund Admin State
  const [isApproveCancelModalOpen, setIsApproveCancelModalOpen] = useState(false);
  const [isCompleteRefundModalOpen, setIsCompleteRefundModalOpen] = useState(false);
  const [refundTransactionId, setRefundTransactionId] = useState("");
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [updatingOrderIds, setUpdatingOrderIds] = useState<Record<number, boolean>>({});

  const handleApproveCancel = async () => {
    if (!currentSelectedOrder) return;
    setIsProcessingAction(true);
    try {
      const res = await api.post(`/orders/${currentSelectedOrder.id}/approve-cancel`);
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
      const res = await api.post(`/orders/${currentSelectedOrder.id}/complete-refund`, {
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
    setEditWalkInForm({
      payment_method: order.payment_method || "Cash",
      payment_ref_code: order.payment_ref_code || "",
      shipping_method: order.shipping_method || "Pickup",
      shipping_fee: parseFloat(order.shipping_fee || 0),
      shipping_city: order.shipping_city || "",
      shipping_address: order.shipping_address || "",
    });
    setIsEditWalkInModalOpen(true);
  };

  const handleSaveEditWalkIn = async () => {
    if (!editWalkInTarget) return;
    setIsSavingEditWalkIn(true);
    try {
      await api.put(`/orders/${editWalkInTarget.id}`, editWalkInForm);
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

  const handleAddItemToOrder = () => {
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
          price: parseFloat(product.price),
          stock: stockAvailable
        }
      ]);
    }

    // Reset selectors
    setSelectedProductId("");
    setSelectedWarehouseId("");
    setAddQuantity(1);
    toast.success("Item added to order list");
  };

  const handleRemoveItemFromOrder = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const generateWalkInRef = () => {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `WK-${ts}-${rand}`;
  };

  const isDigitalPayment = (method: string) => ["M-Pesa", "Card", "Bank Transfer"].includes(method);

  const resetWalkInFormFields = () => {
    setShippingCity("");
    setShippingAddress("");
    setShippingFee(0);
    setShippingMethod("Pickup");
    setPaymentStatus("Paid");
    setPaymentMethod("Cash");
    setPaymentRefCode("");
  };

  const handleMarkWalkInPaid = async (order: any) => {
    try {
      await api.put(`/orders/${order.id}`, { payment_status: "Paid", status: "Delivered" });
      toast.success("Payment confirmed — marked as Paid");
      fetchOrders();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Update failed");
    }
  };

  const handleMarkWalkInPending = async (order: any) => {
    try {
      await api.put(`/orders/${order.id}`, { payment_status: "Pending", status: "Pending" });
      toast.success("Marked as Pending");
      fetchOrders();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Update failed");
    }
  };

  const handleOpenVoidDialog = (order: any) => {
    setVoidOrderTarget(order);
    setVoidReason("");
    setVoidTransactionId("");
    const activeItemIds = (order.items || [])
      .filter((item: any) => item.cancellation_status !== "Cancelled")
      .map((item: any) => item.id);
    setSelectedVoidItemIds(activeItemIds);
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
      const res = await api.post(`/orders/${voidOrderTarget.id}/void-refund`, {
        reason: voidReason,
        refund_transaction_id: voidTransactionId,
        cancel_item_ids: selectedVoidItemIds,
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

  const handleSubmitWalkInOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (orderItems.length === 0) {
      toast.error("Please add at least one item to the order.");
      return;
    }

    if (shippingMethod === "Local Delivery") {
      if (!shippingCity.trim()) {
        toast.error("Please enter destination city.");
        return;
      }
      if (!shippingAddress.trim()) {
        toast.error("Please enter delivery address.");
        return;
      }
    }

    // Digital payment ref validation
    if (isDigitalPayment(paymentMethod) && !paymentRefCode.trim()) {
      toast.error(`Please enter the ${paymentMethod} reference code.`);
      return;
    }

    // New customer validation
    if (selectedCustomerId === "new") {
      if (!newCustomerData.name || !newCustomerData.email) {
        toast.error("Customer Name and Email are required.");
        return;
      }
      const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRx.test(newCustomerData.email)) {
        toast.error("Please enter a valid email address.");
        return;
      }
      if (newCustomerData.phone) {
        const cleanedPhone = newCustomerData.phone.replace(/[\s\-\(\)]/g, "");
        const phoneRx = /^\+?[0-9]{7,15}$/;
        if (!phoneRx.test(cleanedPhone)) {
          toast.error("Phone number must be valid (e.g., +254 7XXXXXXXX or 07XXXXXXXX).");
          return;
        }
      }
      if (registerAccount) {
        if (!newCustomerData.password) {
          toast.error("Password is required when registering a login account.");
          return;
        }
        if (newCustomerData.password !== newCustomerData.confirmPassword) {
          toast.error("Passwords do not match.");
          return;
        }
        if (newCustomerData.password.length < 8) {
          toast.error("Password must be at least 8 characters.");
          return;
        }
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
          const res = await api.post("/customers", payload);
          targetCustomerId = res.data.id;
        }
      } else if (selectedCustomerId === "new") {
        const customerPayload: any = {
          name: newCustomerData.name,
          email: newCustomerData.email,
          phone: newCustomerData.phone,
          address: newCustomerData.address,
          company_name: newCustomerData.company_name,
          type: newCustomerData.type
        };
        if (registerAccount && newCustomerData.password) {
          customerPayload.password = newCustomerData.password;
          customerPayload.password_confirmation = newCustomerData.confirmPassword;
        }
        const res = await api.post("/customers", customerPayload);
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

      const orderPayload = {
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
        shipping_city: shippingMethod === "Pickup" ? "In-Store" : shippingCity.trim(),
        shipping_address: shippingMethod === "Pickup" ? "Walk-In Counter" : shippingAddress.trim(),
        items: orderItems.map(item => ({
          product_id: item.product_id,
          warehouse_id: item.warehouse_id,
          quantity: item.quantity,
          price: item.price
        }))
      };

      await api.post("/orders", orderPayload);
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
      console.error("Failed to create walk-in order:", err);
      toast.error(err.response?.data?.message || "Failed to submit walk-in order.");
    } finally {
      setIsSavingOrder(false);
    }
  };

  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // Always fetch ALL orders with no filters — filtering is done 100% client-side
      // so that shipment filters never affect the Walk-In data pool and vice versa.
      const res = await api.get("/orders");
      setOrders(res.data);
    } catch (err) {
      console.error("Failed to fetch orders:", err);
      toast.error("Failed to sync orders");
    } finally {
      if (!silent) setLoading(false);
    }
    setLastSyncedAt(new Date());
    setSecondsSinceSync(0);
  }, []);

  const fetchMetadata = async () => {
    try {
      const [wRes, cRes, pRes, locRes] = await Promise.all([
        api.get("/warehouses"),
        api.get("/customers"),
        api.get("/products"),
        api.get("/locations/countries"),
      ]);
      setWarehouses(wRes.data);
      setCustomers(cRes.data);
      setProducts(pRes.data);
      setCountriesData(locRes.data);
    } catch (err) {
      console.error("Failed to fetch metadata:", err);
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
      Pending: 1, Processing: 2, Shipped: 3, Delivered: 4, Cancelled: 5,
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
      const res = await api.put(`/orders/${id}`, { status });
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
    } catch (err) {
      console.error("Failed to update status", err);
      toast.error("Status update failed");
    } finally {
      setUpdatingOrderIds(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleBulkStatusChange = async (status: string) => {
    if (selectedOrderIds.length === 0) return;

    // Status progression rank — orders cannot be moved to a lower rank
    const statusRank: Record<string, number> = {
      Pending: 1, Processing: 2, Shipped: 3, Delivered: 4, Cancelled: 5,
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
      const res = await api.post("/orders/bulk-status", {
        order_ids: eligibleIds,
        status: status
      });
      const updated = res.data?.updated ?? eligibleIds.length;
      toast.success(`${updated} order(s) marked as ${status}.${skipped > 0 ? ` ${skipped} skipped (already Delivered/Cancelled).` : ""}`);

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
    } catch (err) {
      console.error("Bulk update failed", err);
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
      toast.error("No orders available to export");
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
        tagline:   settings.store_tagline   || undefined,
        address:   settings.store_address   || settings.physical_address || undefined,
        phone:     settings.store_phone     || settings.contact_phone   || undefined,
        email:     settings.store_email     || settings.contact_email   || undefined,
        website:   settings.store_website   || undefined,
        kraPin:    settings.store_kra_pin   || undefined,
        regNumber: settings.store_reg_number || undefined,
        branch:    settings.store_branch    || undefined,
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
    setWalkInWarehouseFilter("all");
    setWalkInDestFilter("all");
    setWalkInDateFrom("");
    setWalkInDateTo("");
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Split orders into Shipment and Walk-In by tracking number prefix
  const shipmentOrders = useMemo(() => orders.filter(o => !((o.tracking_number || "").startsWith("WK-"))), [orders]);
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
          (order.items?.[0]?.warehouse?.name || "").toLowerCase().includes(sq) ||
          getWalkInDestinationLabel(order).toLowerCase().includes(sq) ||
          (order.payment_method || "cash").toLowerCase().includes(sq) ||
          matchesProducts
        );
        const matchesPayStatus = walkInPayStatusFilter === "All" ||
          (walkInPayStatusFilter === "Cancelled / Refunded"
            ? isOrderVoided(order)
            : order.payment_status === walkInPayStatusFilter);
        const matchesWarehouse = walkInWarehouseFilter === "all" ||
          order.items?.some((i: any) => i.warehouse_id?.toString() === walkInWarehouseFilter);
        const matchesDest = walkInDestFilter === "all" ||
          getWalkInDestinationLabel(order) === walkInDestFilter;
        const orderDate = new Date(order.created_at).setHours(0, 0, 0, 0);
        const matchesDateFrom = !walkInDateFrom || orderDate >= new Date(walkInDateFrom).setHours(0, 0, 0, 0);
        const matchesDateTo   = !walkInDateTo   || orderDate <= new Date(walkInDateTo).setHours(0, 0, 0, 0);
        return matchesSearch && matchesPayStatus && matchesWarehouse && matchesDest && matchesDateFrom && matchesDateTo;
      });
    }

    // ── Shipment filters — completely isolated ─────────────────────────────
    const sq = shipmentSearchQuery.toLowerCase();
    return shipmentOrders.filter(order => {
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
        (order.items?.[0]?.warehouse?.name || "").toLowerCase().includes(sq) ||
        (order.shipping_city || "").toLowerCase().includes(sq) ||
        (order.shipping_address || "").toLowerCase().includes(sq) ||
        matchesProducts
      );
      const matchesWarehouse = warehouseFilter === "all" ||
        order.items?.some((i: any) => i.warehouse_id?.toString() === warehouseFilter);
      const matchesCountry = countryFilter === "all" ||
        order.shipping_country?.toLowerCase() === countryFilter.toLowerCase();
      const matchesCity = cityFilter === "all" ||
        order.shipping_city?.toLowerCase() === cityFilter.toLowerCase();
      const matchesStatus = statusFilter === "All Status" || order.status === statusFilter;
      const orderDate = new Date(order.created_at).setHours(0, 0, 0, 0);
      const matchesDateFrom = !shipmentDateFrom || orderDate >= new Date(shipmentDateFrom).setHours(0, 0, 0, 0);
      const matchesDateTo   = !shipmentDateTo   || orderDate <= new Date(shipmentDateTo).setHours(0, 0, 0, 0);
      return matchesSearch && matchesWarehouse && matchesCountry && matchesCity && matchesStatus && matchesDateFrom && matchesDateTo;
    });
  }, [
    activeOrdersTab,
    shipmentOrders, shipmentSearchQuery, warehouseFilter, countryFilter, cityFilter, statusFilter, shipmentDateFrom, shipmentDateTo,
    walkInOrders, walkInSearchQuery, walkInWarehouseFilter, walkInDestFilter, walkInPayStatusFilter, walkInDateFrom, walkInDateTo,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    activeOrdersTab,
    shipmentSearchQuery, warehouseFilter, countryFilter, cityFilter, statusFilter, shipmentDateFrom, shipmentDateTo,
    walkInSearchQuery, walkInWarehouseFilter, walkInDestFilter, walkInPayStatusFilter, walkInDateFrom, walkInDateTo,
  ]);

  const totalPages = Math.ceil(filteredOrders.length / pageSize);
  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredOrders.slice(startIndex, startIndex + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  const statuses = ["All Status", "Pending", "Processing", "Shipped", "Delivered", "Cancelled", "Cancellation Requested"];

  return (
    <div className="space-y-4 p-3 sm:p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Orders</h1>
          <p className="text-zinc-500 text-sm mt-1">Manage and dispatch customer orders across your logistics network.</p>
          {lastSyncedAt && (
            <div className="flex items-center gap-2 mt-2">
              <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full border transition-colors duration-300 ${
                secondsSinceSync < 15 
                  ? "text-emerald-700 bg-emerald-50 border-emerald-200" 
                  : secondsSinceSync < 30 
                    ? "text-amber-700 bg-amber-50 border-amber-200" 
                    : "text-red-700 bg-red-50 border-red-200"
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full animate-pulse ${
                  secondsSinceSync < 15 
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

      {/* Tab Selector: Shipment vs Walk-In */}
      <div className="flex border-b border-zinc-200">
        <button
          onClick={() => setActiveOrdersTab("Shipment")}
          className={cn("px-6 py-3 font-bold text-sm border-b-2 transition-colors flex items-center gap-2",
            activeOrdersTab === "Shipment" ? "border-[#0052cc] text-[#0052cc]" : "border-transparent text-zinc-500 hover:text-zinc-700"
          )}
        >
          <Truck className="h-4 w-4" /> Shipment Orders
          <span className="ml-1 bg-zinc-100 text-zinc-600 rounded-full px-2 py-0.5 text-[10px] font-black">{shipmentOrders.length}</span>
        </button>
        <button
          onClick={() => setActiveOrdersTab("WalkIn")}
          className={cn("px-6 py-3 font-bold text-sm border-b-2 transition-colors flex items-center gap-2",
            activeOrdersTab === "WalkIn" ? "border-emerald-600 text-emerald-600" : "border-transparent text-zinc-500 hover:text-zinc-700"
          )}
        >
          <ShoppingBag className="h-4 w-4" /> Walk-In Orders
          <span className="ml-1 bg-emerald-50 text-emerald-700 rounded-full px-2 py-0.5 text-[10px] font-black">{walkInOrders.length}</span>
        </button>
      </div>

      {/* Filter Bar — Shipment Orders */}
      {activeOrdersTab === "Shipment" && (
      <div className="bg-white p-5 rounded-xl shadow-sm border border-zinc-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
        {/* Search */}
        <div className="relative lg:col-span-2">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input placeholder="Search Ref, Customer, Route..." className="pl-9 h-11 border-zinc-200 focus-visible:ring-[#0052cc] rounded-lg text-xs font-semibold placeholder:text-zinc-400 shadow-none bg-zinc-50/50 w-full"
            value={shipmentSearchQuery} onChange={(e) => setShipmentSearchQuery(e.target.value)} />
        </div>
        {/* Origin Warehouse */}
        <div className="flex flex-col justify-center">
          <SearchableDropdown
            items={warehouseOptions}
            value={warehouseFilter}
            onChange={(val) => { setWarehouseFilter(val); setCountryFilter("all"); setCityFilter("all"); }}
            placeholder="Origin Warehouse"
          />
        </div>
        {/* Destination Country */}
        <div className="flex flex-col justify-center">
          <SearchableDropdown
            items={countryOptions}
            value={countryFilter}
            onChange={(val) => { setCountryFilter(val); setCityFilter("all"); }}
            placeholder="Destination Country"
          />
        </div>
        {/* Destination City — cascades from Country */}
        <div className="flex flex-col justify-center">
          <SearchableDropdown
            items={cityOptions}
            value={cityFilter}
            onChange={(val) => setCityFilter(val)}
            placeholder="Destination City"
          />
        </div>
        {/* Status */}
        <div className="flex flex-col justify-center">
          <select className="h-11 px-3 border border-zinc-200 rounded-lg text-xs font-semibold bg-zinc-50/50 outline-none focus:ring-2 focus:ring-[#0052cc]/20 w-full text-zinc-600 cursor-pointer"
            value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {statuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {/* Clear */}
        <Button variant="outline" className="rounded-lg h-11 border-zinc-200 font-bold text-xs" onClick={handleClearFilters}>
          <Filter className="h-4 w-4 text-zinc-500 mr-2" /> Clear
        </Button>
        {/* Date Range */}
        <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
          <Input type="date" className="h-11 border-zinc-200 focus-visible:ring-[#0052cc] rounded-lg text-xs font-semibold shadow-none bg-zinc-50/50 cursor-pointer flex-1"
            value={shipmentDateFrom} onChange={(e) => setShipmentDateFrom(e.target.value)} />
          <Input type="date" className="h-11 border-zinc-200 focus-visible:ring-[#0052cc] rounded-lg text-xs font-semibold shadow-none bg-zinc-50/50 cursor-pointer flex-1"
            value={shipmentDateTo} onChange={(e) => setShipmentDateTo(e.target.value)} />
        </div>
      </div>
      )}

      {/* Filter Bar — Walk-In Orders */}
      {activeOrdersTab === "WalkIn" && (
      <div className="bg-white p-5 rounded-xl shadow-sm border border-emerald-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Search */}
        <div className="relative lg:col-span-2">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input placeholder="Search WK-Ref, Customer Name..." className="pl-9 h-11 border-zinc-200 focus-visible:ring-emerald-400 rounded-lg text-xs font-semibold placeholder:text-zinc-400 shadow-none bg-zinc-50/50 w-full"
            value={walkInSearchQuery} onChange={(e) => setWalkInSearchQuery(e.target.value)} />
        </div>
        {/* Source Warehouse */}
        <div className="flex flex-col justify-center">
          <SearchableDropdown
            items={walkInWarehouseOptions}
            value={walkInWarehouseFilter}
            onChange={(val) => { setWalkInWarehouseFilter(val); setWalkInDestFilter("all"); }}
            placeholder="Source Warehouse"
          />
        </div>
        {/* Destination / Address (city) — cascades from warehouse */}
        <div className="flex flex-col justify-center">
          <SearchableDropdown
            items={walkInDestOptions}
            value={walkInDestFilter}
            onChange={(val) => setWalkInDestFilter(val)}
            placeholder="Destination / Address"
          />
        </div>
        {/* Payment Status */}
        <div className="flex flex-col justify-center">
          <select
            className="h-11 px-3 border border-zinc-200 rounded-lg text-xs font-semibold bg-zinc-50/50 outline-none focus:ring-2 focus:ring-emerald-200 w-full text-zinc-600 cursor-pointer"
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
        {/* Clear */}
        <Button variant="outline" className="rounded-lg h-11 border-zinc-200 font-bold text-xs" onClick={handleClearWalkInFilters}>
          <Filter className="h-4 w-4 text-zinc-500 mr-2" /> Clear
        </Button>
        {/* Date Range */}
        <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
          <Input type="date" className="h-11 border-zinc-200 focus-visible:ring-emerald-400 rounded-lg text-xs font-semibold shadow-none bg-zinc-50/50 cursor-pointer flex-1"
            value={walkInDateFrom} onChange={(e) => setWalkInDateFrom(e.target.value)} />
          <Input type="date" className="h-11 border-zinc-200 focus-visible:ring-emerald-400 rounded-lg text-xs font-semibold shadow-none bg-zinc-50/50 cursor-pointer flex-1"
            value={walkInDateTo} onChange={(e) => setWalkInDateTo(e.target.value)} />
        </div>
      </div>
      )}

        {/* Bulk Action Bar - Normalized UI */}
        <AnimatePresence>
          {selectedOrderIds.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="bg-zinc-100 text-zinc-900 p-4 rounded-xl flex items-center justify-between border border-zinc-200 shadow-sm mb-6"
            >
              <div className="flex items-center gap-4 ml-2">
                <Badge className="bg-zinc-900 text-white border-none rounded-full px-3">{selectedOrderIds.length} Selected</Badge>
                <p className="text-sm font-semibold text-zinc-700">Batch Dispatch Operations</p>
              </div>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  disabled={isBulkProcessing}
                  onClick={() => handleBulkStatusChange('Processing')}
                  variant="outline"
                  className="bg-white hover:bg-zinc-50 font-bold text-[10px] uppercase tracking-wider border-zinc-200 min-w-[140px]"
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
                <Button 
                  size="sm" 
                  disabled={isBulkProcessing}
                  onClick={() => handleBulkStatusChange('Delivered')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] uppercase tracking-wider shadow-sm min-w-[130px]"
                >
                  {isBulkProcessing ? (
                    <><Loader2 className="mr-2 h-3 w-3 animate-spin" /> Updating...</>
                  ) : (
                    "Mark Delivered"
                  )}
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => setSelectedOrderIds([])}
                  disabled={isBulkProcessing}
                  className="text-zinc-500 hover:text-zinc-900 font-bold text-[10px] uppercase tracking-wider"
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      <div className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden">
        <div className="overflow-x-auto">
        {activeOrdersTab === "WalkIn" ? (
          <Table>
            <TableHeader className="bg-emerald-50/60">
              <TableRow>
                <TableHead className="px-4 font-semibold text-zinc-900">WK Reference</TableHead>
                <TableHead className="font-semibold text-zinc-900">Customer Profile</TableHead>
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
                      <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                        {order.tracking_number}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        <p className="text-sm font-semibold text-zinc-800">{order.customer?.name || "Walk-In Guest"}</p>
                        {!isGuest && <p className="text-[10px] text-zinc-400 font-medium">{order.customer?.email}</p>}
                        {isGuest ? (
                          <span className="text-[9px] font-black uppercase text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">Quick Walk-In</span>
                        ) : (
                          <span className="text-[9px] font-black uppercase text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">Registered</span>
                        )}
                      </div>
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
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-zinc-900">{order.shipping_city || "—"}</p>
                          <p className="text-xs font-bold text-zinc-700 max-w-[160px] truncate">{order.shipping_address || "—"}</p>
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
                    </TableCell>
                    <TableCell className="text-right">
                      <p className={cn(
                        "text-sm font-black",
                        isOrderVoided(order) ? "text-red-500 line-through opacity-75" : "text-zinc-900"
                      )}>
                        Ksh {parseFloat(order.total_amount || 0).toLocaleString()}
                      </p>
                      {isOrderVoided(order) && (
                        <p className="text-[9px] font-bold text-red-500 uppercase">Refunded</p>
                      )}
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
                            <DropdownMenuSeparator />

                            {/* ── Delivery Status Progression (Local Delivery only) ── */}
                            {order.shipping_method === "Local Delivery" && !isOrderVoided(order) && order.status !== "Delivered" && (
                              <>
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
                                {(order.status === "Pending" || order.status === "Processing" || order.status === "Shipped") && (
                                  <DropdownMenuItem onClick={() => handleStatusChange(order.id, "Delivered")} className="cursor-pointer rounded-lg font-bold text-sm text-emerald-600">
                                    <CheckCircle2 className="mr-2 h-4 w-4" /> Mark Delivered
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                              </>
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
                                <RefreshCw className="mr-2 h-4 w-4" /> Mark as Pending
                              </DropdownMenuItem>
                            ) : null}
                            {!isOrderVoided(order) && (
                            <DropdownMenuItem
                              onClick={() => handleOpenVoidDialog(order)}
                              className="cursor-pointer rounded-lg font-bold text-sm text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Void / Refund Order
                            </DropdownMenuItem>
                            )}
                            {!isOrderVoided(order) && (
                            <DropdownMenuItem
                              onClick={() => handleOpenEditWalkIn(order)}
                              className="cursor-pointer rounded-lg font-bold text-sm text-zinc-600"
                            >
                              <Pencil className="mr-2 h-4 w-4" /> Edit Order
                            </DropdownMenuItem>
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
                    <TableCell className="px-4 py-4"><p className="text-sm font-bold text-zinc-900">{order.tracking_number || `ORD-${order.id}`}</p></TableCell>
                    <TableCell><div className="space-y-0.5"><p className="text-sm font-semibold text-zinc-700">{order.customer?.name || "Guest"}</p><p className="text-[11px] text-zinc-500 font-medium">{order.customer?.email}</p></div></TableCell>
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
                    <TableCell><div className="space-y-0.5 max-w-[150px]"><p className="text-xs font-bold text-zinc-800 truncate">{order.items?.[0]?.product?.name || "Genuine Spare Part"}</p>{order.items && order.items.length > 1 && <p className="text-[10px] text-zinc-400 font-bold uppercase">+{order.items.length - 1} more items</p>}</div></TableCell>
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
                    <TableCell className="text-center"><div className="flex items-center justify-center gap-1.5"><Package className="h-3 w-3 text-zinc-400" /><span className="text-xs font-bold text-zinc-700">{order.items?.length || 0}</span></div></TableCell>
                    <TableCell className="text-xs font-bold text-zinc-600">Ksh {Math.max(0, (parseFloat(order.total_amount || 0) - parseFloat(order.shipping_fee || 0))).toLocaleString()}</TableCell>
                    <TableCell className="text-xs font-bold text-zinc-600">Ksh {parseFloat(order.shipping_fee || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right"><p className="text-xs font-black text-zinc-900">Ksh {parseFloat(order.total_amount || 0).toLocaleString()}</p></TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <div className="flex items-center justify-center gap-1.5">
                          {updatingOrderIds[order.id] && <Loader2 className="h-3 w-3 animate-spin text-[#0052cc] shrink-0" />}
                          <Badge className={cn("rounded-full px-3 text-[10px] font-bold uppercase border-none tracking-wider",
                            order.status === "Pending" ? "bg-yellow-400 text-yellow-950" : order.status === "Processing" ? "bg-orange-500 text-white" :
                            order.status === "Shipped" || order.status === "In Transit" ? "bg-blue-600 text-white" :
                            order.status === "Delivered" ? "bg-emerald-500 text-white" : 
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
                            {(order.status === "Pending" || order.status === "Processing" || order.status === "Shipped" || order.status === "In Transit") && (
                              <DropdownMenuItem onClick={() => handleStatusChange(order.id, 'Delivered')} className="cursor-pointer rounded-lg font-bold text-sm text-emerald-600">
                                <CheckCircle2 className="mr-2 h-4 w-4" /> Mark Delivered
                              </DropdownMenuItem>
                            )}
                            
                            {order.status === "Cancellation Requested" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuLabel className="text-[10px] font-black text-red-400 uppercase px-2 py-1.5">Cancellation</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => { setSelectedOrder(order); setIsApproveCancelModalOpen(true); }} className="cursor-pointer rounded-lg font-bold text-sm text-red-600">
                                  <CheckCircle2 className="mr-2 h-4 w-4" /> Approve Cancellation
                                </DropdownMenuItem>
                              </>
                            )}
                            
                            {order.status === "Cancelled" && order.refund_status === "Pending" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuLabel className="text-[10px] font-black text-amber-400 uppercase px-2 py-1.5">Refund Processing</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => { setSelectedOrder(order); setIsCompleteRefundModalOpen(true); }} className="cursor-pointer rounded-lg font-bold text-sm text-amber-600">
                                  <CreditCard className="mr-2 h-4 w-4" /> Complete Refund
                                </DropdownMenuItem>
                              </>
                            )}

                            {!isOrderVoided(order) && order.status !== "Cancellation Requested" && (
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
              currentSelectedOrder?.status === "Delivered" ? "bg-emerald-500 text-white" :
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
                <div className="bg-white p-4 rounded-xl border border-zinc-200">
                  <p className="font-bold text-zinc-900">{currentSelectedOrder?.customer?.name || "Guest"}</p>
                  {/* Hide auto-generated walk-in emails */}
                  {currentSelectedOrder?.customer?.name?.toLowerCase() !== "walk-in customer" && (
                    <p className="text-sm text-zinc-500 font-medium">{currentSelectedOrder?.customer?.email}</p>
                  )}
                  <p className="text-sm text-zinc-500 font-medium mt-1">{currentSelectedOrder?.shipping_address}</p>
                </div>
              </div>

            <div className="space-y-4">
               <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Items Summary</h4>
              {currentSelectedOrder?.items?.map((item: any, idx: number) => {
                const isItemCancelled = item.cancellation_status === "Cancelled";
                // Per-item refund total = product cost + proportional shipping share
                const totalUnits = Math.max(1, (currentSelectedOrder.items || []).reduce((s: number, i: any) => s + (i.quantity || 1), 0));
                const shippingFee = Number(currentSelectedOrder.shipping_fee || 0);
                const itemProductCost = Number(item.price) * item.quantity;
                const itemShippingShare = (shippingFee / totalUnits) * item.quantity;
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
                            <span className={cn("font-semibold text-[#0052cc]", isItemCancelled && "text-zinc-450 line-through")}>Part No: {item.product.part_number}</span>
                          </>
                        )}
                        {item.product?.engine_model && (
                          <>
                            <span>|</span>
                            <span className={cn(isItemCancelled && "text-zinc-450 line-through")}>Engine: {item.product.engine_model}</span>
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
              })}
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
                      (currentSelectedOrder.refund_status === "Completed" || currentSelectedOrder.refund_transaction_id) ? "text-green-700" : "text-orange-600"
                    )}>
                      {currentSelectedOrder.refund_status || (currentSelectedOrder.refund_transaction_id ? "Completed" : "Pending")}
                    </span>
                  </p>
                  {/* Total refunded amount (product + shipping) across all cancelled items */}
                  {(() => {
                    const cancelledItems = (currentSelectedOrder.items || []).filter((i: any) => i.cancellation_status === "Cancelled");
                    if (cancelledItems.length === 0) return null;
                    const totalUnits = Math.max(1, (currentSelectedOrder.items || []).reduce((s: number, i: any) => s + (i.quantity || 1), 0));
                    const shippingFee = Number(currentSelectedOrder.shipping_fee || 0);
                    const totalRefunded = cancelledItems.reduce((sum: number, i: any) => {
                      return sum + (Number(i.price) * i.quantity) + ((shippingFee / totalUnits) * i.quantity);
                    }, 0);
                    return (
                      <p className="text-xs font-semibold text-red-900">
                        <span className="text-red-700">Total Refunded:</span>{" "}
                        <span className="font-black">Ksh {Math.round(totalRefunded).toLocaleString()}</span>
                        <span className="text-[10px] text-zinc-500 ml-1">(incl. shipping)</span>
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
              <div className="flex justify-between items-center text-zinc-500 font-bold text-[11px] uppercase tracking-tight">
                <span>Shipping ({currentSelectedOrder?.shipping_method})</span>
                <span>Ksh {Number(currentSelectedOrder?.shipping_fee || 0).toLocaleString()}</span>
              </div>
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

                {/* Searchable Existing Customer Lookup */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-500">Or Search Existing Customer Account</label>
                  <SearchableDropdown
                    items={customers
                      .filter(c => c.name.toLowerCase() !== "walk-in customer")
                      .map(c => ({ id: c.id.toString(), name: `${c.name} — ${c.email}` }))}
                    value={!["walkin","new"].includes(selectedCustomerId) ? selectedCustomerId : ""}
                    onChange={(val) => setSelectedCustomerId(val || "walkin")}
                    placeholder="Search by name or email..."
                  />
                </div>

                {selectedCustomerId === "new" && (
                  <div className="space-y-4 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-500">Full Name *</label>
                        <Input placeholder="Customer Name" className="h-10 border-zinc-200 rounded-lg bg-white"
                          value={newCustomerData.name} onChange={(e) => setNewCustomerData({...newCustomerData, name: e.target.value})} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-500">Gmail Address * <span className="text-zinc-400">(name@gmail.com)</span></label>
                        <Input type="email" placeholder="name@gmail.com" className="h-10 border-zinc-200 rounded-lg bg-white"
                          value={newCustomerData.email} onChange={(e) => setNewCustomerData({...newCustomerData, email: e.target.value})} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-500">Phone <span className="text-zinc-400">(07XXXXXXXX)</span></label>
                        <Input placeholder="0712345678" className="h-10 border-zinc-200 rounded-lg bg-white"
                          value={newCustomerData.phone} onChange={(e) => setNewCustomerData({...newCustomerData, phone: e.target.value})} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-500">City / Town</label>
                        <Input placeholder="Nairobi" className="h-10 border-zinc-200 rounded-lg bg-white"
                          value={newCustomerData.address} onChange={(e) => setNewCustomerData({...newCustomerData, address: e.target.value})} />
                      </div>
                    </div>

                    {/* Register Login Account Toggle */}
                    <div className="pt-2 border-t border-blue-100">
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={registerAccount}
                          onChange={(e) => { setRegisterAccount(e.target.checked); if (!e.target.checked) setNewCustomerData(p => ({...p, password: "", confirmPassword: ""})); }}
                          className="w-4 h-4 accent-blue-600 rounded"
                        />
                        <span className="text-xs font-bold text-zinc-700">Register Login Account for this Customer</span>
                      </label>
                    </div>

                    {registerAccount && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-zinc-500">Password *</label>
                          <div className="relative">
                            <Input
                              type={showNewPass ? "text" : "password"}
                              placeholder="Min 8 characters"
                              className="h-10 border-zinc-200 rounded-lg bg-white pr-10"
                              value={newCustomerData.password}
                              onChange={(e) => setNewCustomerData({...newCustomerData, password: e.target.value})}
                            />
                            <button type="button" onClick={() => setShowNewPass(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                              {showNewPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-zinc-500">Confirm Password *</label>
                          <div className="relative">
                            <Input
                              type={showConfirmPass ? "text" : "password"}
                              placeholder="Repeat password"
                              className="h-10 border-zinc-200 rounded-lg bg-white pr-10"
                              value={newCustomerData.confirmPassword}
                              onChange={(e) => setNewCustomerData({...newCustomerData, confirmPassword: e.target.value})}
                            />
                            <button type="button" onClick={() => setShowConfirmPass(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                              {showConfirmPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
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
                      items={products.map(p => ({ id: p.id.toString(), name: `${p.name} — Ksh ${Number(p.price).toLocaleString()}` }))}
                      value={selectedProductId}
                      onChange={(val) => { setSelectedProductId(val); setSelectedWarehouseId(""); }}
                      placeholder="Search spare parts..."
                    />
                  </div>

                  <div className="col-span-1 md:col-span-4 space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-500">Source Warehouse</label>
                    <SearchableDropdown
                      items={(selectedProductDetails?.inventories || []).map((inv: any) => ({ id: inv.warehouse_id.toString(), name: `from ${inv.warehouse?.name} (Stock: ${inv.quantity})` }))}
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
                      onChange={(e) => { setShippingMethod(e.target.value); if (e.target.value === "Pickup") { setShippingFee(0); setShippingCity(""); setShippingAddress(""); } }}
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
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-500">Delivery Fee (Ksh)</label>
                      <Input type="number" min={0} placeholder="e.g. 500" className="h-10 border-zinc-200 rounded-lg bg-white"
                        value={shippingFee || ""} onChange={(e) => setShippingFee(parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-500">Destination City</label>
                      <Input placeholder="e.g. Mombasa" className="h-10 border-zinc-200 rounded-lg bg-white"
                        value={shippingCity} onChange={(e) => setShippingCity(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-500">Delivery Address</label>
                      <Input placeholder="e.g. Tom Mboya St, CBD" className="h-10 border-zinc-200 rounded-lg bg-white"
                        value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} />
                    </div>
                  </div>
                )}

                <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 flex justify-between items-center mt-3">
                  <span className="font-bold text-zinc-500 text-xs uppercase">Grand Total (Tax Included)</span>
                  <span className="text-xl font-black text-zinc-900">
                    Ksh {(orderItems.reduce((acc, item) => acc + (item.price * item.quantity), 0) + Number(shippingFee)).toLocaleString()}
                  </span>
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

      {/* Void / Refund Confirmation Dialog */}
      <Dialog open={isVoidDialogOpen} onOpenChange={(open) => { if (!open) { setIsVoidDialogOpen(false); setVoidOrderTarget(null); setSelectedVoidItemIds([]); } }}>
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
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />Selected items will be refunded to the customer</li>
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />Their cost is deducted from your revenue records</li>
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />Returned items are restored to warehouse stock</li>
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
                    const totalUnits = Math.max(1, (voidOrderTarget.items || []).reduce((s: number, i: any) => s + (i.quantity || 1), 0));
                    const shippingFee = Number(voidOrderTarget.shipping_fee || 0);
                    const productCost = Number(item.price) * item.quantity;
                    const shippingShare = (shippingFee / totalUnits) * item.quantity;
                    const itemRefundTotal = productCost + shippingShare;
                    return (
                      <div key={item.id} className="flex items-start justify-between text-xs py-2 border-b last:border-0 border-zinc-100 gap-2">
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
                          <span className="text-zinc-500">{item.quantity} × Ksh {Number(item.price).toLocaleString()}</span>
                          {shippingShare > 0 && (
                            <span className="text-[10px] text-zinc-400">+ Ksh {Math.round(shippingShare).toLocaleString()} shipping</span>
                          )}
                          <span className="text-[11px] font-black text-zinc-700">= Ksh {Math.round(itemRefundTotal).toLocaleString()}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
                {/* Total to Refund — live preview based on checked items */}
                {selectedVoidItemIds.length > 0 && (() => {
                  const allItems = voidOrderTarget?.items || [];
                  const totalUnits = Math.max(1, allItems.reduce((s: number, i: any) => s + (i.quantity || 1), 0));
                  const shippingFee = Number(voidOrderTarget?.shipping_fee || 0);
                  const total = allItems
                    .filter((i: any) => selectedVoidItemIds.includes(i.id) && i.cancellation_status !== "Cancelled")
                    .reduce((sum: number, i: any) => {
                      const productCost = Number(i.price) * i.quantity;
                      const shippingShare = (shippingFee / totalUnits) * i.quantity;
                      return sum + productCost + shippingShare;
                    }, 0);
                  return (
                    <div className="mt-2 pt-2 border-t border-zinc-200 flex justify-between items-center">
                      <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Total to Refund to Customer</span>
                      <span className="text-sm font-black text-red-600">Ksh {Math.round(total).toLocaleString()}</span>
                    </div>
                  );
                })()}
              </div>
            )}
            
            <div className="space-y-3">
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
              onClick={() => { setIsVoidDialogOpen(false); setVoidOrderTarget(null); setSelectedVoidItemIds([]); }}>
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
                      shipping_city: "",
                      shipping_address: "",
                    });
                  } else {
                    setEditWalkInForm({
                      ...editWalkInForm,
                      shipping_method: val,
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
                {/* Destination City */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Destination City</label>
                  <Input
                    placeholder={(editWalkInTarget?.status === "Shipped" || editWalkInTarget?.status === "In Transit" || editWalkInTarget?.status === "Delivered") ? "" : "e.g. Nairobi"}
                    disabled={editWalkInTarget?.status === "Shipped" || editWalkInTarget?.status === "In Transit" || editWalkInTarget?.status === "Delivered"}
                    className="h-10 border-zinc-200 rounded-lg bg-zinc-50 text-sm font-semibold disabled:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-75"
                    value={editWalkInForm.shipping_city}
                    onChange={(e) => setEditWalkInForm({ ...editWalkInForm, shipping_city: e.target.value })}
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

      {/* Approve Cancellation Modal */}
      <Dialog open={isApproveCancelModalOpen} onOpenChange={setIsApproveCancelModalOpen}>
        <DialogContent className="rounded-lg shadow-xl sm:max-w-[450px] bg-white border-none p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4 border-b">
            <DialogTitle className="font-bold text-zinc-900">Approve Cancellation</DialogTitle>
            <DialogDescription className="text-xs text-zinc-500">
              Approving this will approve the cancellation request, restore inventory to the warehouse, and mark the refund as pending.
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-4">
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <p className="text-xs font-semibold text-red-700 mb-1">Customer Reason:</p>
              <p className="text-sm text-red-900 italic">"{currentSelectedOrder?.cancellation_reason || 'No reason provided'}"</p>
            </div>
            
            {currentSelectedOrder?.items && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Items Requested for Cancellation:</p>
                <div className="space-y-1.5 max-h-[150px] overflow-y-auto border border-zinc-200 rounded-lg p-2.5 bg-zinc-50">
                  {currentSelectedOrder.items
                    .filter((item: any) => item.cancellation_status === "Pending")
                    .map((item: any) => (
                      <div key={item.id} className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-zinc-800 truncate max-w-[250px]">{item.product?.name || "Genuine Part"}</span>
                        <span className="text-zinc-500 font-bold shrink-0">{item.quantity} × Ksh {Number(item.price).toLocaleString()}</span>
                      </div>
                    ))}
                  {currentSelectedOrder.items.filter((item: any) => item.cancellation_status === "Pending").length === 0 && (
                    <p className="text-xs font-medium text-zinc-400 italic">All order items</p>
                  )}
                </div>
              </div>
            )}
            
            <p className="text-sm font-black text-zinc-900 pt-3 border-t border-zinc-100">
              Total Refund Value: Ksh {
                (() => {
                  const pendingItems = currentSelectedOrder?.items?.filter((i: any) => i.cancellation_status === "Pending") || [];
                  const amt = pendingItems.length > 0
                    ? pendingItems.reduce((acc: number, i: any) => acc + (Number(i.price) * i.quantity), 0)
                    : parseFloat(currentSelectedOrder?.total_amount || 0);
                  return amt.toLocaleString();
                })()
              }
            </p>
          </div>
          <DialogFooter className="p-4 bg-zinc-50 border-t m-0 shrink-0">
            <Button variant="outline" className="font-bold" onClick={() => setIsApproveCancelModalOpen(false)}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white font-bold" onClick={handleApproveCancel} disabled={isProcessingAction}>
              {isProcessingAction ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Approve Cancellation
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
                Refund Amount: Ksh {parseFloat(currentSelectedOrder?.total_amount || 0).toLocaleString()}
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
    </div>
  );
}

