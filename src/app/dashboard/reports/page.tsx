"use client";

import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  FileText, Download, Package, Users, Receipt,
  Loader2, MapPin, TrendingUp, Check, ChevronsUpDown, Search
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import api from "@/lib/axios";
import { API_ENDPOINTS } from "@/lib/apis";
import { useSettings } from "@/components/providers/SettingsProvider";
import { PaginationControls } from "@/components/ui/pagination-controls";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend
} from "recharts";

const STATUS_COLORS: Record<string, string> = {
  Pending: "#f59e0b", // amber-500
  Processing: "#3b82f6", // blue-500
  Shipped: "#3b82f6", // blue-500
  Delivered: "#10b981", // emerald-500
  Cancelled: "#ef4444", // red-500
};

const STATUS_STYLES: Record<string, string> = {
  Pending: "bg-amber-50 text-amber-700 border-amber-200",
  Processing: "bg-blue-50 text-blue-700 border-blue-200",
  Shipped: "bg-blue-50 text-blue-700 border-blue-200",
  Delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Cancelled: "bg-red-50 text-red-700 border-red-200",
};

function DocumentHeader({ title, subtitle, period, storeName }: { title: string; subtitle: string; period: string; storeName?: string }) {
  const now = new Date().toLocaleString("en-KE", { year: "numeric", month: "long", day: "numeric", hour: '2-digit', minute: '2-digit' });
  return (
    <div className="flex flex-col md:flex-row justify-between items-start gap-4 pb-5 border-b-2 border-zinc-900 mb-6 print:mb-4">
      <div>
        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">{storeName}</p>
        <h2 className="text-2xl font-black text-zinc-900 tracking-tight">{title}</h2>
        <p className="text-sm text-zinc-800 font-semibold mt-0.5">{subtitle}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Report Period</p>
        <p className="text-sm font-bold text-zinc-900 mt-0.5">{period}</p>
        <p className="text-[10px] text-zinc-600 font-bold mt-1">Generated: {now}</p>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white shadow-sm border border-zinc-200 rounded-xl p-5 hover:shadow-md transition-shadow">
      <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">{label}</p>
      <p className="text-2xl font-black text-zinc-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-zinc-700 mt-1 font-semibold">{sub}</p>}
    </div>
  );
}

export default function AdminReportsPage() {
  const { settings } = useSettings();
  const [orders, setOrders] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [storeName, setStoreName] = useState("My Business");
  const [storeKraPin, setStoreKraPin] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [storePhone, setStorePhone] = useState("");
  const [storeEmail, setStoreEmail] = useState("");
  const [storeWebsite, setStoreWebsite] = useState("");
  const [storeRegNumber, setStoreRegNumber] = useState("");
  const [storeBranch, setStoreBranch] = useState("");
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("All");
  const [storeTagline, setStoreTagline] = useState("");
  const [mounted, setMounted] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];

  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [activeTab, setActiveTab] = useState("sales");
  const [openCustomerSelect, setOpenCustomerSelect] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCustomers = useMemo(() => {
    const activeCustomers = customers.filter(c => c.name?.toLowerCase() !== "walk-in customer");
    if (!searchQuery) return activeCustomers;
    const q = searchQuery.toLowerCase();
    return activeCustomers.filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  }, [customers, searchQuery]);

  useEffect(() => {
    // Fetch admin settings to get business name and KRA PIN
    api.get(API_ENDPOINTS.settings.base).then(r => {
      if (r.data?.store_name) setStoreName(r.data.store_name);
      if (r.data?.store_kra_pin) setStoreKraPin(r.data.store_kra_pin);
      if (r.data?.store_address) setStoreAddress(r.data.store_address);
      if (r.data?.store_phone) setStorePhone(r.data.store_phone);
      if (r.data?.store_email) setStoreEmail(r.data.store_email);
      if (r.data?.store_website) setStoreWebsite(r.data.store_website);
      if (r.data?.store_reg_number) setStoreRegNumber(r.data.store_reg_number);
      if (r.data?.store_branch) setStoreBranch(r.data.store_branch);
      if (r.data?.store_tagline) setStoreTagline(r.data.store_tagline);
    }).catch(() => { });

    Promise.all([
      api.get(API_ENDPOINTS.orders.base, { params: { per_page: -1 } }),
      api.get(API_ENDPOINTS.inventory.base, { params: { per_page: -1 } }),
      api.get(API_ENDPOINTS.customers.base, { params: { per_page: -1 } }),
      api.get(API_ENDPOINTS.warehouses.base),
    ]).then(([o, i, c, w]) => {
      setOrders(o.data);
      setInventory(i.data);
      setCustomers(c.data);
      setWarehouses(w.data || []);
    }).catch(console.error)
      .finally(() => {
        setLoading(false);
        setMounted(true);
      });
  }, []);

  // Step 1: Date-only filter (before channel or warehouse)
  // Exclude Cancelled, Returned, and fully-Refunded orders from ALL financial reports
  const dateFilteredOrders = useMemo(() => orders.filter(o => {
    if (o.status?.toLowerCase() === "cancelled") return false;
    if (o.status?.toLowerCase() === "returned") return false;
    if (o.payment_status?.toLowerCase() === "refunded") return false;
    if (o.created_at) {
      const d = o.created_at.split("T")[0];
      if (d < startDate || d > endDate) return false;
    }
    return true;
  }), [orders, startDate, endDate]);

  // Order channel filter: All / Walk-In POS / Shipment Deliveries (applied second)
  const [orderChannelFilter, setOrderChannelFilter] = useState("All");

  const channelFilteredOrders = useMemo(() => {
    let base = dateFilteredOrders;
    if (orderChannelFilter === "Walk-In POS") {
      base = base.filter(o => !o.shipping_country || o.shipping_method === "Pickup" || o.shipping_method === "Local Delivery");
    } else if (orderChannelFilter === "Shipment Deliveries") {
      base = base.filter(o => o.shipping_country && o.shipping_method !== "Pickup" && o.shipping_method !== "Local Delivery");
    }
    // Step 3: Apply warehouse filter on top of channel filter
    if (selectedWarehouseId !== "All") {
      base = base.filter(o =>
        o.items?.some((i: any) =>
          String(i.warehouse_id) === selectedWarehouseId ||
          i.warehouse?.id?.toString() === selectedWarehouseId
        )
      );
    }
    return base;
  }, [dateFilteredOrders, orderChannelFilter, selectedWarehouseId]);

  // filteredOrders = channelFilteredOrders (kept for compatibility with statement tab which doesn't use channel)
  const filteredOrders = channelFilteredOrders;

  const isVoidedOrder = (o: any) => o.status === "Cancelled" || o.payment_status === "Refunded";

  // Revenue-eligible orders: Paid + not cancelled/returned/refunded, respecting both filters
  const channelRevenueOrders = useMemo(
    () => channelFilteredOrders.filter(o =>
      o.payment_status === "Paid" &&
      o.status !== "Cancelled" &&
      o.status !== "Returned" &&
      o.payment_status !== "Refunded"
    ),
    [channelFilteredOrders]
  );

  // Pagination for Sales table — only Paid, non-cancelled orders shown (reports = financial records)
  const [salesPage, setSalesPage] = useState(1);
  const SALES_PAGE_SIZE = 15;
  const paginatedSalesOrders = useMemo(() => {
    const start = (salesPage - 1) * SALES_PAGE_SIZE;
    return channelRevenueOrders.slice(start, start + SALES_PAGE_SIZE);
  }, [channelRevenueOrders, salesPage]);

  // Filter Inventory based on active warehouse hub filter
  const filteredInventory = useMemo(() => {
    if (selectedWarehouseId === "All") return inventory;
    return inventory.filter(i =>
      String(i.warehouse_id) === selectedWarehouseId ||
      i.warehouse?.id?.toString() === selectedWarehouseId
    );
  }, [inventory, selectedWarehouseId]);

  // Pagination for Inventory table
  const [inventoryPage, setInventoryPage] = useState(1);
  const INVENTORY_PAGE_SIZE = 15;
  const paginatedInventory = useMemo(() => {
    const start = (inventoryPage - 1) * INVENTORY_PAGE_SIZE;
    return filteredInventory.slice(start, start + INVENTORY_PAGE_SIZE);
  }, [filteredInventory, inventoryPage]);

  // Summary stats — fully reflect both warehouse and channel filters
  const totalRevenue = channelRevenueOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const totalShippingFeesInPeriod = channelRevenueOrders.reduce((s, o) => s + Number(o.shipping_fee || 0), 0);
  const totalVAT = totalRevenue * 0.16;
  const netRevenue = totalRevenue - totalVAT;
  const periodLabel = `${new Date(startDate).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })} – ${new Date(endDate).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}`;
  const channelLabel = orderChannelFilter === "All" ? "All Channels" : orderChannelFilter;
  const warehouseLabel = selectedWarehouseId === "All" ? "All Hubs" : (warehouses.find(w => String(w.id) === selectedWarehouseId)?.name || "Selected Hub");

  // BI Calculations: Timeline Data — respects BOTH warehouse and channel filters
  const timelineData = useMemo(() => {
    const map = new Map<string, number>();
    channelRevenueOrders.forEach(o => {
      const date = o.created_at ? new Date(o.created_at).toLocaleDateString("en-KE", { month: "short", day: "numeric" }) : "Unknown";
      map.set(date, (map.get(date) || 0) + Number(o.total_amount || 0));
    });
    return Array.from(map.entries()).map(([date, revenue]) => ({ date, revenue })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [channelRevenueOrders]);

  // BI Calculations: Status Breakdown — respects BOTH filters
  const statusData = useMemo(() => {
    const map = new Map<string, number>();
    channelFilteredOrders.forEach(o => {
      const st = o.status || "Unknown";
      map.set(st, (map.get(st) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [channelFilteredOrders]);

  // BI Calculations: Top Products — respects BOTH filters
  const topProducts = useMemo(() => {
    const map = new Map<string, { revenue: number, qty: number }>();
    channelRevenueOrders.forEach(o => {
      if (o.items && Array.isArray(o.items)) {
        o.items.forEach((item: any) => {
          const pName = item.product?.name || `Product #${item.product_id}`;
          const current = map.get(pName) || { revenue: 0, qty: 0 };
          current.revenue += (Number(item.price) * Number(item.quantity));
          current.qty += Number(item.quantity);
          map.set(pName, current);
        });
      }
    });
    return Array.from(map.entries()).map(([name, data]) => ({ name, revenue: data.revenue, qty: data.qty }))
      .sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [channelRevenueOrders]);

  // BI Calculations: Sales by Location — respects BOTH filters
  const locationData = useMemo(() => {
    const map = new Map<string, number>();
    channelRevenueOrders.forEach(o => {
      const loc = o.shipping_city ? `${o.shipping_city}, ${o.shipping_country || 'KE'}` : "Unknown Origin";
      map.set(loc, (map.get(loc) || 0) + Number(o.total_amount || 0));
    });
    return Array.from(map.entries()).map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [channelRevenueOrders]);

  // Customer Statement Logic
  const customerOrders = useMemo(() => selectedCustomerId
    ? orders.filter(o => String(o.customer_id) === selectedCustomerId || String(o.customer?.id) === selectedCustomerId)
    : [], [orders, selectedCustomerId]);
  const selectedCustomer = customers.find(c => String(c.id) === selectedCustomerId);

  const selectedCustomerLtv = useMemo(() => {
    return customerOrders
      .filter(o => o.status?.toLowerCase() !== "cancelled")
      .reduce((s, o) => s + Number(o.total_amount || 0), 0);
  }, [customerOrders]);

  const selectedCustomerRank = useMemo(() => {
    if (!selectedCustomer) return null;
    const platThresh = parseFloat(settings.rank_platinum_threshold || "150000");
    const goldThresh = parseFloat(settings.rank_gold_threshold || "50000");
    const silverThresh = parseFloat(settings.rank_silver_threshold || "10000");

    if (selectedCustomerLtv >= platThresh) return { name: "Platinum", icon: "💎", badgeCls: "bg-blue-100 text-blue-800 border-blue-200" };
    if (selectedCustomerLtv >= goldThresh) return { name: "Gold", icon: "🥇", badgeCls: "bg-amber-100 text-amber-800 border-amber-200" };
    if (selectedCustomerLtv >= silverThresh) return { name: "Silver", icon: "🥈", badgeCls: "bg-zinc-100 text-zinc-800 border-zinc-200" };
    return { name: "Bronze", icon: "🥉", badgeCls: "bg-orange-100 text-orange-800 border-orange-200" };
  }, [selectedCustomer, selectedCustomerLtv, settings]);

  // ── Professional PDF Export Engine ──
  const exportToPDF = async () => {
    const isStatement = activeTab === "statement";
    const doc = new jsPDF(isStatement ? { orientation: "landscape", unit: "mm", format: "a4" } : undefined);
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    // Generate a unique report ID based on tab and date
    const dateStamp = new Date().toISOString().slice(0, 7).replace("-", "");
    const randomSeq = Math.floor(100 + Math.random() * 900);
    const reportCode = activeTab.toUpperCase();
    const docId = `${reportCode}-${dateStamp}-${randomSeq}`;

    // Company details from real settings
    const legalName = storeName;
    const tagline = storeTagline || "";
    const addressLine = storeAddress || "";
    const telNo = storePhone || "";
    const emailAddr = storeEmail || "";
    const websiteUrl = storeWebsite || "";
    const kraPin = storeKraPin || "";
    const businessReg = storeRegNumber || "";
    const activeBranch = storeBranch || "Main Branch";
    const currentUserName = "Admin";

    // 1. Draw Branded Header with real logo
    const { drawBrandedHeader, loadImgAsBase64 } = await import("@/lib/pdf-export");
    const logoUrl = settings.store_logo || "";
    const logoBase64 = logoUrl ? await loadImgAsBase64(logoUrl) : "";
    await drawBrandedHeader(doc as any, {
      storeName: legalName,
      storeTagline: tagline,
      storeAddress: addressLine,
      storePhone: telNo,
      storeEmail: emailAddr,
      storeWebsite: websiteUrl,
      storeKraPin: kraPin,
      storeRegNumber: businessReg,
      storeLogo: logoBase64
    });

    // 2. Report Information Block (2 Columns - Clean and Spacious)
    const infoY = 38;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, infoY, pageWidth - 28, 28, 2, 2, 'F');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);

    // Left column
    doc.text(`Report ID:`, 20, infoY + 7);
    doc.text(`Generated By:`, 20, infoY + 14);
    doc.text(`Generated On:`, 20, infoY + 21);

    doc.setFont("helvetica", "normal");
    doc.text(docId, 45, infoY + 7);
    doc.text(currentUserName, 45, infoY + 14);
    doc.text(new Date().toLocaleString("en-KE", { hour12: false }), 45, infoY + 21);

    // Right column
    doc.setFont("helvetica", "bold");
    doc.text(`Branch:`, 110, infoY + 7);
    doc.text(`Currency:`, 110, infoY + 14);

    doc.setFont("helvetica", "normal");
    doc.text(activeBranch, 132, infoY + 7);
    doc.text("KES (Kenyan Shilling)", 132, infoY + 14);

    let currentY = infoY + 34;

    // 3. Tab-Specific Reports
    if (activeTab === "sales") {
      // Summary Metrics Card
      doc.setFillColor(239, 246, 255);
      doc.roundedRect(14, currentY, pageWidth - 28, 16, 2, 2, 'F');

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);

      doc.text(`Total Invoices: ${channelRevenueOrders.length}`, 16, currentY + 10);
      doc.text(`Gross (Ksh): ${totalRevenue.toLocaleString()}`, 64, currentY + 10);
      doc.text(`VAT 16% (Ksh): ${totalVAT.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, 114, currentY + 10);
      doc.text(`Net (Ksh): ${netRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, 164, currentY + 10);

      currentY += 22;

      // Group orders by date for daily totals
      const dailySalesMap = new Map<string, number>();
      channelRevenueOrders.forEach(o => {
        const d = o.created_at ? new Date(o.created_at).toLocaleDateString("en-KE") : "Unknown";
        dailySalesMap.set(d, (dailySalesMap.get(d) || 0) + Number(o.total_amount || 0));
      });
      const dailySalesRows = Array.from(dailySalesMap.entries())
        .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
        .map(([date, total]) => [date, total.toLocaleString()]);

      autoTable(doc, {
        startY: currentY,
        head: [['Date', 'Daily Total (Ksh)']],
        body: dailySalesRows,
        foot: [['TOTAL', `Ksh ${totalRevenue.toLocaleString()}`]],
        theme: 'grid',
        headStyles: { fillColor: [0, 82, 204], fontSize: 9, fontStyle: 'bold' },
        footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 9 },
        styles: { fontSize: 8.5, cellPadding: 3 }
      });

    } else if (activeTab === "inventory") {
      // Summary Metrics Card
      doc.setFillColor(254, 242, 242);
      doc.roundedRect(14, currentY, pageWidth - 28, 16, 2, 2, 'F');

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);

      const lowStockCount = filteredInventory.filter(i => i.quantity > 0 && i.quantity <= (Number(i.min_stock) || 5)).length;
      const outOfStockCount = filteredInventory.filter(i => i.quantity === 0).length;

      doc.text(`Total Monitored SKUs: ${filteredInventory.length}`, 22, currentY + 10);
      doc.text(`Low Stock Warn: ${lowStockCount}`, 85, currentY + 10);
      doc.text(`Critical Out of Stock: ${outOfStockCount}`, 145, currentY + 10);

      currentY += 22;

      autoTable(doc, {
        startY: currentY,
        head: [['SKU Code', 'Product / Item Description', 'Warehouse Hub', 'Min Stock', 'Available Qty', 'System Status']],
        body: filteredInventory.map(i => {
          const qty = Number(i.quantity);
          const minSt = Number(i.min_stock) || 5;
          const st = qty === 0 ? "Out of Stock" : qty <= minSt ? "Low Stock" : "In Stock";
          return [
            i.product?.sku || "—",
            i.product?.name || "—",
            i.warehouse?.name || activeBranch,
            `${minSt} PCS`,
            qty.toString(),
            st
          ];
        }),
        theme: 'grid',
        headStyles: { fillColor: [0, 82, 204], fontSize: 8, fontStyle: 'bold' },
        styles: { fontSize: 7.5, cellPadding: 2.5 }
      });

    } else if (activeTab === "statement") {
      if (!selectedCustomer) {
        alert("Please select a customer first.");
        return;
      }

      const currency = settings.currency || "Ksh";
      const fmt = (n: number) => `${currency} ${n.toLocaleString()}`;

      // Summary Metrics Card
      doc.setFillColor(240, 253, 250);
      doc.roundedRect(14, currentY, doc.internal.pageSize.width - 28, 16, 2, 2, 'F');

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);

      const activeCustomerOrders = customerOrders.filter(o => o.status?.toLowerCase() !== "cancelled");
      const totalStatementVal = activeCustomerOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0);
      const totalStatementFees = activeCustomerOrders.reduce((s, o) => s + Number(o.shipping_fee || 0), 0);
      const totalStatementItems = activeCustomerOrders.reduce((s, o) => s + (o.items?.length || 0), 0);
      const totalStatementUnits = activeCustomerOrders.reduce((s, o) => s + (o.items || []).reduce((acc: number, i: any) => acc + (i.quantity || 0), 0), 0);

      doc.text(`Account: ${selectedCustomer.name}`, 16, currentY + 10);
      doc.text(`Tier: ${selectedCustomerRank?.name || "Bronze"}`, 85, currentY + 10);
      doc.text(`Orders: ${activeCustomerOrders.length}`, 145, currentY + 10);
      doc.text(`LTV: ${fmt(totalStatementVal)}`, 195, currentY + 10);

      currentY += 22;

      // ── CUSTOMER ACCOUNT STATEMENT & LEDGER table (identical to exportCustomerLedgerPDF) ──
      const grandTotalItemsCount = activeCustomerOrders.reduce((s: number, o: any) => s + (o.items?.length || 0), 0);
      const grandTotalUnitsCount = activeCustomerOrders.reduce((s: number, o: any) => s + (o.items || []).reduce((acc: number, i: any) => acc + (i.quantity || 0), 0), 0);

      const statementHead = [
        "Order Ref",
        "Order Date",
        "Main Product Reference",
        "Items Count",
        "Origin Warehouse",
        "Fulfillment Destination",
        `Products Cost (${currency})`,
        `Shipping Fee (${currency})`,
        `Total Paid (${currency})`,
        "Order Status",
        "Payment Mode",
      ];

      const statementRows: string[][] = activeCustomerOrders.map((o: any) => {
        const subtotal = Math.max(0, Number(o.total_amount || 0) - Number(o.shipping_fee || 0));
        const productNames = (o.items || [])
          .map((item: any) => `${item.product?.name || "Genuine Spare Part"} (Qty: ${item.quantity || 1})`)
          .filter(Boolean)
          .join(", ") || "Genuine Spare Part";
        const totalQty = (o.items || []).reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
        return [
          o.tracking_number || `ORD-${o.id}`,
          o.created_at ? new Date(o.created_at).toLocaleDateString("en-KE") : "—",
          productNames,
          `${o.items?.length || 0} Item(s) (${totalQty} Unit${totalQty !== 1 ? "s" : ""})`,
          o.items?.[0]?.warehouse?.name || "Main Warehouse Hub",
          o.shipping_city ? `${o.shipping_city}, ${o.shipping_country || "Kenya"}` : "In-Store Collection",
          fmt(subtotal),
          fmt(Number(o.shipping_fee || 0)),
          fmt(Number(o.total_amount || 0)),
          o.status === "In Transit" ? "Shipped" : (o.status || "Pending"),
          o.payment_method || "M-Pesa",
        ];
      });

      // Grand totals row
      statementRows.push([
        "TOTALS",
        `${activeCustomerOrders.length} order(s)`,
        "",
        `${grandTotalItemsCount} item(s) (${grandTotalUnitsCount} unit${grandTotalUnitsCount !== 1 ? "s" : ""})`,
        "", "",
        fmt(totalStatementVal - totalStatementFees),
        fmt(totalStatementFees),
        fmt(totalStatementVal),
        "", "",
      ]);

      const pageW = doc.internal.pageSize.width;
      const mL = 14;
      const mR = 14;

      autoTable(doc, {
        startY: currentY,
        head: [statementHead],
        body: statementRows,
        theme: "grid",
        showHead: "everyPage",
        headStyles: { fillColor: [0, 82, 204], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.5 },
        bodyStyles: { fontSize: 7.5, textColor: [51, 65, 85] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 28, fontStyle: "bold" },
          1: { cellWidth: 22, halign: "center" },
          3: { cellWidth: 20, halign: "center" },
          4: { cellWidth: 28 },
          5: { cellWidth: 32 },
          6: { halign: "right" },
          7: { halign: "right" },
          8: { halign: "right", fontStyle: "bold" },
          9: { cellWidth: 22, halign: "center" },
          10: { cellWidth: 24, halign: "center" },
        },
        margin: { top: 37, left: mL, right: mR },
        didParseCell: (data: any) => {
          if (data.row.index === statementRows.length - 1) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fillColor = [241, 245, 249];
            data.cell.styles.textColor = [15, 23, 42];
          }
        },
      });

    } else if (activeTab === "vat") {
      // Summary Metrics Card
      doc.setFillColor(245, 243, 255);
      doc.roundedRect(14, currentY, pageWidth - 28, 16, 2, 2, 'F');

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);

      doc.text(`Total Invoices: ${channelRevenueOrders.length}`, 16, currentY + 10);
      doc.text(`Gross (Ksh): ${totalRevenue.toLocaleString()}`, 64, currentY + 10);
      doc.text(`VAT 16% (Ksh): ${totalVAT.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, 114, currentY + 10);
      doc.text(`Net (Ksh): ${netRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, 164, currentY + 10);

      currentY += 22;

      // Group by date for daily VAT breakdown
      const dailyVatMap = new Map<string, { gross: number; vat: number; net: number }>();
      channelRevenueOrders.forEach(o => {
        const d = o.created_at ? new Date(o.created_at).toLocaleDateString("en-KE") : "Unknown";
        const gross = Number(o.total_amount || 0);
        const prev = dailyVatMap.get(d) || { gross: 0, vat: 0, net: 0 };
        prev.gross += gross;
        prev.vat += gross * 0.16;
        prev.net += gross * 0.84;
        dailyVatMap.set(d, prev);
      });
      const dailyVatRows = Array.from(dailyVatMap.entries())
        .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
        .map(([date, t]) => [
          date,
          t.gross.toLocaleString(),
          t.vat.toLocaleString(undefined, { maximumFractionDigits: 0 }),
          t.net.toLocaleString(undefined, { maximumFractionDigits: 0 })
        ]);

      autoTable(doc, {
        startY: currentY,
        head: [['Date', 'Gross (Ksh)', 'VAT 16% (Ksh)', 'Net (Ksh)']],
        body: dailyVatRows,
        foot: [['TOTALS', totalRevenue.toLocaleString(), totalVAT.toLocaleString(undefined, { maximumFractionDigits: 0 }), netRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })]],
        theme: 'grid',
        headStyles: { fillColor: [0, 82, 204], fontSize: 9, fontStyle: 'bold' },
        footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 9 },
        styles: { fontSize: 8.5, cellPadding: 3 }
      });
    }

    // 4. Draw Professional Signatures & Approval Blocks (Only on the last page)
    let finalY = (doc as any).lastAutoTable.finalY || currentY;
    if (finalY + 45 > pageHeight - 35) {
      doc.addPage();
      finalY = 25;
    } else {
      finalY += 15;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);

    doc.text("Prepared By: __________________", 14, finalY);
    doc.text("Reviewed By: __________________", pageWidth / 3 + 8, finalY);
    doc.text("Approved By: __________________", (pageWidth / 3) * 2 + 2, finalY);

    // 5. Post-Process Loop for Watermark, Confidentiality Note and Page Numbers on All Pages
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);

      // Top header line accent (very faint)
      doc.setDrawColor(240, 240, 240);
      doc.setLineWidth(0.3);
      doc.line(14, 10, pageWidth - 14, 10);

      // Bottom footer line
      doc.line(14, pageHeight - 16, pageWidth - 14, pageHeight - 16);

      // Confidentiality disclaimer
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184); // Slate grey
      doc.setFont("helvetica", "bold");
      doc.text("This report is system-generated and confidential.", 14, pageHeight - 10);

      // Page numbering
      doc.setFont("helvetica", "normal");
      doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, pageHeight - 10, { align: 'right' });
    }

    doc.save(`${(storeName || "Report").replace(/\s+/g, "_")}_${activeTab}_${today}.pdf`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-zinc-500 font-semibold text-sm">Compiling business intelligence...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-zinc-100">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-zinc-900">Reports & Analytics</h1>
          <p className="text-zinc-500 text-sm mt-1 font-medium">Professional business intelligence and documentation exports.</p>
        </div>
        <Button onClick={exportToPDF} className="bg-[#0052cc] text-white hover:bg-[#0052cc]/90 rounded-lg shadow-sm font-bold h-11 px-6">
          <Download className="mr-2 h-4 w-4" /> Export to PDF
        </Button>
      </div>

      {/* Tabs Layout */}
      <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 overflow-hidden flex flex-col md:flex-row min-h-[800px]">
        {/* Sidebar Nav */}
        <div className="w-full md:w-64 shrink-0 bg-zinc-50/50 border-b md:border-b-0 md:border-r border-zinc-100 p-4">
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-3 pt-2 pb-4">Report Type</p>
          <Tabs orientation="vertical" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="flex flex-col h-auto w-full bg-transparent p-0 gap-1.5">
              {[
                { value: "sales", icon: TrendingUp, label: "Sales & BI Analytics" },
                { value: "inventory", icon: Package, label: "Inventory Status" },
                { value: "statement", icon: Users, label: "Customer Statement" },
                { value: "vat", icon: Receipt, label: "VAT / Tax Filing" },
              ].map(({ value, icon: Icon, label }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="w-full justify-start gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-zinc-500
                    data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-[#0052cc] data-[state=active]:font-bold
                    hover:bg-white/60 hover:text-zinc-700 transition-all border border-transparent data-[state=active]:border-zinc-200/60"
                >
                  <Icon className="h-4 w-4 shrink-0" /> {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 p-3 sm:p-6 md:p-8 bg-zinc-50/30 overflow-y-auto">

          {/* Global Date Filter (Visible on all tabs) */}
          <div className="flex flex-wrap items-end gap-4 mb-8 p-5 bg-white rounded-2xl shadow-sm border border-zinc-200">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">From Date</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-10 border-zinc-200 rounded-lg bg-zinc-50 text-sm font-semibold" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">To Date</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-10 border-zinc-200 rounded-lg bg-zinc-50 text-sm font-semibold" />
            </div>
            <div className="flex gap-2">
              {[
                { label: "Today", fn: () => { setStartDate(today); setEndDate(today); } },
                { label: "This Month", fn: () => { setStartDate(firstOfMonth); setEndDate(today); } },
              ].map(b => (
                <Button key={b.label} variant="outline" onClick={b.fn} className="h-10 rounded-lg border-zinc-200 font-bold text-xs hover:bg-zinc-100 hover:text-zinc-900">
                  {b.label}
                </Button>
              ))}
            </div>
            {/* Order Channel Filter */}
            <div className="space-y-1.5 ml-auto">
              <Label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Order Channel</Label>
              <select
                className="h-10 px-3 border border-zinc-200 rounded-lg text-xs font-semibold bg-zinc-50 outline-none focus:ring-2 focus:ring-[#0052cc]/20 text-zinc-700"
                value={orderChannelFilter}
                onChange={(e) => { setOrderChannelFilter(e.target.value); setSalesPage(1); }}
              >
                {["All", "Walk-In POS", "Shipment Deliveries"].map(ch => (
                  <option key={ch} value={ch}>{ch}</option>
                ))}
              </select>
            </div>

            {/* Warehouse/Hub Filter */}
            <div className="space-y-1.5 ml-4">
              <Label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Warehouse Hub</Label>
              <select
                className="h-10 px-3 border border-zinc-200 rounded-lg text-xs font-semibold bg-zinc-50 outline-none focus:ring-2 focus:ring-[#0052cc]/20 text-zinc-700"
                value={selectedWarehouseId}
                onChange={(e) => {
                  setSelectedWarehouseId(e.target.value);
                  setSalesPage(1);
                  setInventoryPage(1);
                }}
              >
                <option value="All">All Hubs</option>
                {warehouses.map(w => (
                  <option key={w.id} value={String(w.id)}>{w.name}</option>
                ))}
              </select>
            </div>
          </div>

          <Tabs value={activeTab} className="w-full">
            {/* ── TAB 1: Sales Summary & BI ── */}
            <TabsContent value="sales" className="mt-0 space-y-8 animate-in fade-in duration-500">
              <DocumentHeader
                title="Sales Summary & Analytics"
                subtitle={`${channelLabel} · ${warehouseLabel}`}
                period={periodLabel}
                storeName={storeName}
              />

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                <SummaryCard label="Total Paid Orders" value={String(channelRevenueOrders.length)} sub={`${channelLabel} | ${warehouseLabel}`} />
                <SummaryCard label="Gross Revenue" value={`Ksh ${totalRevenue.toLocaleString()}`} />
                <SummaryCard label="VAT Collected" value={`Ksh ${totalVAT.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} sub="16% standard rate" />
                <SummaryCard label="Net Revenue" value={`Ksh ${netRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
              </div>

              {/* BI Charts Section */}
              {activeTab === "sales" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Revenue Timeline */}
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
                    <h3 className="text-sm font-black text-zinc-800 mb-6 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-[#0052cc]" /> Revenue Timeline</h3>
                    <div className="h-[250px] w-full">
                      {timelineData.length > 0 && mounted ? (
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                          <LineChart data={timelineData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                            <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#71717a' }} dy={10} />
                            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#71717a' }} tickFormatter={(value) => `Ksh ${value.toLocaleString()}`} width={80} />
                            <RechartsTooltip cursor={{ stroke: '#f4f4f5', strokeWidth: 2 }} contentStyle={{ borderRadius: '12px', border: '1px solid #e4e4e7', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                            <Line type="monotone" dataKey="revenue" stroke="#0052cc" strokeWidth={3} dot={{ r: 4, fill: '#0052cc', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-sm font-medium text-zinc-400">No data for selected period</div>
                      )}
                    </div>
                  </div>

                  {/* Status Breakdown */}
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
                    <h3 className="text-sm font-black text-zinc-800 mb-6 flex items-center gap-2"><PieChart className="h-4 w-4 text-[#0052cc]" /> Fulfillment Status</h3>
                    <div className="h-[250px] w-full">
                      {statusData.length > 0 && mounted ? (
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                          <PieChart>
                            <Pie
                              data={statusData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {statusData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || '#a1a1aa'} />
                              ))}
                            </Pie>
                            <RechartsTooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e4e4e7' }} />
                            <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-sm font-medium text-zinc-400">No data for selected period</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Secondary BI Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Products */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
                  <h3 className="text-sm font-black text-zinc-800 mb-6 flex items-center gap-2"><Package className="h-4 w-4 text-[#0052cc]" /> Top Selling Products</h3>
                  <div className="space-y-4">
                    {topProducts.length > 0 ? topProducts.map((p, i) => (
                      <div key={i} className="flex justify-between items-center pb-3 border-b border-zinc-100 last:border-0 last:pb-0">
                        <div>
                          <p className="text-xs font-bold text-zinc-900">{p.name}</p>
                          <p className="text-[10px] text-zinc-500 font-medium">{p.qty} units sold</p>
                        </div>
                        <p className="text-sm font-black text-[#0052cc]">Ksh {p.revenue.toLocaleString()}</p>
                      </div>
                    )) : <div className="text-sm font-medium text-zinc-400 py-4">No product data</div>}
                  </div>
                </div>

                {/* Top Locations */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
                  <h3 className="text-sm font-black text-zinc-800 mb-6 flex items-center gap-2"><MapPin className="h-4 w-4 text-[#0052cc]" /> Top Regional Destinations</h3>
                  <div className="h-[200px] w-full mt-4">
                    {locationData.length > 0 && mounted && activeTab === "sales" ? (
                      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <BarChart data={locationData} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e4e4e7" />
                          <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#3f3f46', fontWeight: 'bold' }} width={100} axisLine={false} tickLine={false} />
                          <RechartsTooltip cursor={{ fill: '#f4f4f5' }} contentStyle={{ borderRadius: '12px' }} />
                          <Bar dataKey="revenue" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <div className="h-full flex items-center justify-center text-sm font-medium text-zinc-400">No location data</div>}
                  </div>
                </div>
              </div>

              {/* Data Table */}
              <div className="rounded-2xl border border-zinc-200 overflow-x-auto custom-scrollbar bg-white shadow-sm mt-8">
                <div className="p-5 border-b border-zinc-100 bg-zinc-50/50">
                  <h3 className="text-sm font-black text-zinc-800">Recent Transactions Log</h3>
                </div>
                <Table>
                  <TableHeader className="bg-zinc-50">
                    <TableRow>
                      <TableHead className="px-6 font-bold text-zinc-900">Order Ref</TableHead>
                      <TableHead className="font-bold text-zinc-900">Client</TableHead>
                      <TableHead className="font-bold text-zinc-900">Date</TableHead>
                      <TableHead className="font-bold text-zinc-900">Status</TableHead>
                      <TableHead className="font-bold text-zinc-900 text-right">Amount (Ksh)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {channelRevenueOrders.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="h-32 text-center text-zinc-400 font-medium">No paid transactions in this period.</TableCell></TableRow>
                    ) : paginatedSalesOrders.map((o, i) => (
                      <TableRow key={i} className="hover:bg-zinc-50/80 transition-colors">
                        <TableCell className="px-6 font-bold text-zinc-800 font-mono text-xs">
                          {o.tracking_number || `#ORD-${String(o.id).padStart(4, "0")}`}
                        </TableCell>
                        <TableCell className="font-bold text-zinc-700">{o.customer?.name || "—"}</TableCell>
                        <TableCell className="text-zinc-500 text-sm font-medium">
                          {o.created_at ? new Date(o.created_at).toLocaleDateString("en-KE", { day: 'numeric', month: 'short', year: 'numeric' }) : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("text-[10px] font-bold px-3 py-0.5 rounded-full uppercase border tracking-wider", STATUS_STYLES[o.status] || "bg-zinc-50 text-zinc-600 border-zinc-200")}>
                            {o.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-black text-zinc-900">
                          {Number(o.total_amount).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                    {channelRevenueOrders.length > 0 && (
                      <TableRow className="bg-zinc-100/50 hover:bg-zinc-100/50">
                        <TableCell colSpan={4} className="px-6 font-black text-zinc-900 text-sm tracking-widest">
                          TOTAL REVENUE — {channelLabel} {selectedWarehouseId !== "All" ? `| ${warehouseLabel}` : ""}
                        </TableCell>
                        <TableCell className="text-right font-black text-[#0052cc] text-base">Ksh {totalRevenue.toLocaleString()}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                <PaginationControls
                  currentPage={salesPage}
                  setCurrentPage={setSalesPage}
                  pageSize={SALES_PAGE_SIZE}
                  setPageSize={() => { }}
                  totalItems={channelRevenueOrders.length}
                  itemName="orders"
                />
              </div>
            </TabsContent>

            {/* ── TAB 2: Inventory Report ── */}
            <TabsContent value="inventory" className="mt-0 space-y-8 animate-in fade-in duration-500">
              <DocumentHeader title="Inventory Status Report" subtitle="Real-time stock level analysis across all distribution hubs" period={`As of ${new Date().toLocaleDateString("en-KE")}`} storeName={storeName} />

              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <SummaryCard label="Total Monitored SKUs" value={String(filteredInventory.length)} />
                <SummaryCard label="Low Stock Warning" value={String(filteredInventory.filter(i => i.quantity > 0 && i.quantity <= (Number(i.min_stock) || 5)).length)} sub="Items at or below their threshold" />
                <SummaryCard label="Critical Out of Stock" value={String(filteredInventory.filter(i => i.quantity === 0).length)} sub="Requires immediate replenishment" />
              </div>

              <div className="rounded-2xl border border-zinc-200 overflow-x-auto custom-scrollbar bg-white shadow-sm">
                <Table>
                  <TableHeader className="bg-zinc-50">
                    <TableRow>
                      <TableHead className="px-6 font-bold text-zinc-900">SKU</TableHead>
                      <TableHead className="font-bold text-zinc-900">Product</TableHead>
                      <TableHead className="font-bold text-zinc-900">Location</TableHead>
                      <TableHead className="font-bold text-zinc-900 text-right">Available Qty</TableHead>
                      <TableHead className="font-bold text-zinc-900 text-center">System Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInventory.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="h-32 text-center text-zinc-400 font-medium">No inventory data available.</TableCell></TableRow>
                    ) : paginatedInventory.map((item, i) => {
                      const qty = Number(item.quantity);
                      const minSt = Number(item.min_stock) || 5;
                      const status = qty === 0 ? "OUT OF STOCK" : qty <= minSt ? "LOW STOCK" : "IN STOCK";
                      const statusCls = qty === 0
                        ? "bg-red-900 text-white hover:bg-red-950 border-none font-bold uppercase tracking-wider"
                        : qty <= minSt
                          ? "bg-red-600 text-white hover:bg-red-700 animate-blink border-none font-bold uppercase tracking-wider"
                          : "bg-emerald-500 text-white hover:bg-emerald-600 border-none font-bold uppercase tracking-wider";
                      return (
                        <TableRow key={i} className="hover:bg-zinc-50/80">
                          <TableCell className="px-6 font-bold text-zinc-800 font-mono text-xs">{item.product?.sku || "—"}</TableCell>
                          <TableCell className="font-bold text-zinc-700">{item.product?.name || "—"}</TableCell>
                          <TableCell className="text-zinc-500 text-sm font-medium">{item.warehouse?.name || "—"}</TableCell>
                          <TableCell className="text-right font-black text-zinc-900">{qty}</TableCell>
                          <TableCell className="text-center">
                            <Badge className={cn("text-[10px] font-bold px-3 py-0.5 rounded-full uppercase border tracking-wider", statusCls)}>
                              {status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <PaginationControls
                  currentPage={inventoryPage}
                  setCurrentPage={setInventoryPage}
                  pageSize={INVENTORY_PAGE_SIZE}
                  setPageSize={() => { }}
                  totalItems={inventory.length}
                  itemName="SKUs"
                />
              </div>
            </TabsContent>

            {/* ── TAB 3: Customer Statement ── */}
            <TabsContent value="statement" className="mt-0 space-y-8 animate-in fade-in duration-500">
              <DocumentHeader
                title="Customer Account Statement"
                subtitle={selectedCustomer ? `Official statement for ${selectedCustomer.name}` : "Select a customer profile to generate statement"}
                period={periodLabel}
                storeName={storeName}
              />

              <div className="flex items-end gap-4 p-5 bg-white rounded-2xl shadow-sm border border-zinc-200">
                <div className="space-y-1.5 w-full md:w-96 flex flex-col">
                  <Label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Select Client Account</Label>
                  <Popover open={openCustomerSelect} onOpenChange={setOpenCustomerSelect}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openCustomerSelect}
                        className="w-full justify-between h-11 bg-zinc-50 border-zinc-200 text-zinc-800 font-bold"
                      >
                        {selectedCustomerId
                          ? customers.find((c) => String(c.id) === selectedCustomerId)?.name
                          : "— Choose a customer profile —"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[360px] p-0" align="start">
                      <div className="flex flex-col bg-white rounded-xl shadow-md border border-zinc-150 overflow-hidden">
                        {/* Search Input with Search Icon */}
                        <div className="flex items-center gap-2 border-b border-zinc-100 px-3 py-2 bg-zinc-50/50">
                          <Search className="h-4 w-4 text-zinc-400 shrink-0" />
                          <input
                            type="text"
                            placeholder="Search customers..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            className="flex h-9 w-full bg-transparent py-1 text-sm outline-none placeholder:text-zinc-400 font-semibold text-zinc-800"
                          />
                        </div>
                        {/* Scrollable list - explicitly scrollable */}
                        <div className="max-h-[260px] overflow-y-scroll p-1 space-y-0.5 scrollbar-thin scroll-smooth">
                          {filteredCustomers.length === 0 ? (
                            <div className="py-6 text-center text-sm font-medium text-zinc-500">
                              No customer found.
                            </div>
                          ) : (
                            filteredCustomers.map((c) => (
                              <button
                                key={c.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedCustomerId(String(c.id));
                                  setOpenCustomerSelect(false);
                                  setSearchQuery("");
                                }}
                                className={cn(
                                  "w-full flex items-center justify-between px-3 py-2 text-sm font-semibold rounded-lg text-left transition-colors duration-150",
                                  selectedCustomerId === String(c.id)
                                    ? "bg-[#0052cc]/10 text-[#0052cc]"
                                    : "text-zinc-700 hover:bg-zinc-100"
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  <Check
                                    className={cn(
                                      "h-4 w-4 shrink-0",
                                      selectedCustomerId === String(c.id) ? "opacity-100 text-[#0052cc]" : "opacity-0"
                                    )}
                                  />
                                  <span className="truncate">{c.name}</span>
                                </div>
                                {c.phone && <span className="text-xs text-zinc-400 font-normal shrink-0">{c.phone}</span>}
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {selectedCustomer && (
                <div className="p-6 bg-[#0052cc]/5 border border-[#0052cc]/10 rounded-2xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 text-sm">
                  <div>
                    <p className="text-[10px] font-black text-[#0052cc] uppercase tracking-widest font-bold">Account Name</p>
                    <p className="font-bold text-zinc-900 mt-1 text-lg leading-tight">{selectedCustomer.name}</p>
                    <p className="font-bold text-zinc-400 text-xs font-mono">ACC-{String(selectedCustomer.id).padStart(4, "0")}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-[#0052cc] uppercase tracking-widest font-bold">Loyalty Status</p>
                    {selectedCustomerRank && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="text-xl">{selectedCustomerRank.icon}</span>
                        <span className={cn("text-[10px] font-black px-2.5 py-0.5 rounded-full border tracking-wide uppercase", selectedCustomerRank.badgeCls)}>
                          {selectedCustomerRank.name}
                        </span>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-[#0052cc] uppercase tracking-widest font-bold">Lifetime Value (LTV)</p>
                    <p className="font-black text-zinc-950 mt-1.5 text-lg">Ksh {selectedCustomerLtv.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-[#0052cc] uppercase tracking-widest font-bold">KRA Tax ID / PIN</p>
                    <p className="font-extrabold text-zinc-900 mt-1.5 text-base font-mono uppercase tracking-wider">{selectedCustomer.tax_id || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-[#0052cc] uppercase tracking-widest font-bold">Primary Contact</p>
                    <p className="font-semibold text-zinc-800 mt-1 text-xs">{selectedCustomer.phone || "No Phone"}</p>
                    <p className="font-semibold text-zinc-500 text-xs truncate">{selectedCustomer.email || "No Email"}</p>
                  </div>
                </div>
              )}

              {selectedCustomerId ? (
                <div className="rounded-2xl border border-zinc-200 overflow-x-auto custom-scrollbar bg-white shadow-sm">
                  <Table>
                    <TableHeader className="bg-zinc-50">
                      <TableRow>
                        <TableHead className="px-6 font-bold text-zinc-900">Invoice Ref</TableHead>
                        <TableHead className="font-bold text-zinc-900">Date Issued</TableHead>
                        <TableHead className="font-bold text-zinc-900">Description</TableHead>
                        <TableHead className="font-bold text-zinc-900 text-center">Payment Status</TableHead>
                        <TableHead className="font-bold text-zinc-900 text-right">Amount (Ksh)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customerOrders.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="h-32 text-center text-zinc-400 font-medium">No order history found for this account.</TableCell></TableRow>
                      ) : customerOrders.map((o, i) => (
                        <TableRow key={i} className="hover:bg-zinc-50/80">
                          <TableCell className="px-6 font-bold text-zinc-800 font-mono text-xs">{o.tracking_number || `#ORD-${String(o.id).padStart(4, "0")}`}</TableCell>
                          <TableCell className="text-zinc-500 text-sm font-medium">{o.created_at ? new Date(o.created_at).toLocaleDateString("en-KE") : "—"}</TableCell>
                          <TableCell className="text-zinc-600 text-sm font-medium">Auto Parts Fulfillment — {o.items?.length || 0} items</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={cn("text-[10px] font-bold px-3 py-0.5 rounded-full uppercase border tracking-wider", STATUS_STYLES[o.status] || "bg-zinc-50 text-zinc-600 border-zinc-200")}>
                              {o.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-black text-zinc-900">{Number(o.total_amount).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                      {customerOrders.length > 0 && (
                        <TableRow className="bg-[#0052cc]/5">
                          <TableCell colSpan={4} className="px-6 font-black text-[#0052cc] text-sm tracking-widest">TOTAL ACCOUNT VALUE</TableCell>
                          <TableCell className="text-right font-black text-[#0052cc] text-base">
                            Ksh {selectedCustomerLtv.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center border-2 border-dashed border-zinc-200 rounded-2xl bg-zinc-50/50">
                  <div className="text-center space-y-3">
                    <Users className="h-10 w-10 text-zinc-300 mx-auto" />
                    <p className="text-zinc-500 text-sm font-bold">Awaiting Client Selection</p>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ── TAB 4: VAT / Tax Report ── */}
            <TabsContent value="vat" className="mt-0 space-y-8 animate-in fade-in duration-500">
              <DocumentHeader title="VAT & Tax Compliance Report" subtitle="Financial breakdown of taxable transactions for KRA filing" period={periodLabel} storeName={storeName} />

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <SummaryCard label="Total Gross Sales" value={`Ksh ${totalRevenue.toLocaleString()}`} />
                <SummaryCard label="Taxable Amount" value={`Ksh ${totalRevenue.toLocaleString()}`} sub="100% of transactions" />
                <SummaryCard label="VAT Remittable @ 16%" value={`Ksh ${totalVAT.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
                <SummaryCard label="Net Income (ex-VAT)" value={`Ksh ${netRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
              </div>

              <div className="rounded-2xl border border-zinc-200 overflow-x-auto custom-scrollbar bg-white shadow-sm">
                <Table>
                  <TableHeader className="bg-zinc-50">
                    <TableRow>
                      <TableHead className="px-6 font-bold text-zinc-900">Invoice Ref</TableHead>
                      <TableHead className="font-bold text-zinc-900">Date</TableHead>
                      <TableHead className="font-bold text-zinc-900">Client</TableHead>
                      <TableHead className="font-bold text-zinc-900 text-right">Gross (Ksh)</TableHead>
                      <TableHead className="font-bold text-zinc-900 text-right">VAT 16% (Ksh)</TableHead>
                      <TableHead className="font-bold text-zinc-900 text-right">Net (Ksh)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {channelRevenueOrders.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="h-32 text-center text-zinc-400 font-medium">No taxable transactions found.</TableCell></TableRow>
                    ) : channelRevenueOrders.map((o: any, i: number) => {
                      const gross = Number(o.total_amount || 0);
                      const vat = gross * 0.16;
                      const net = gross - vat;
                      return (
                        <TableRow key={i} className="hover:bg-zinc-50/80">
                          <TableCell className="px-6 font-bold text-zinc-800 font-mono text-xs">{o.tracking_number || `#ORD-${String(o.id).padStart(4, "0")}`}</TableCell>
                          <TableCell className="text-zinc-500 text-sm font-medium">{o.created_at ? new Date(o.created_at).toLocaleDateString("en-KE") : "—"}</TableCell>
                          <TableCell className="font-bold text-zinc-700">{o.customer?.name || "—"}</TableCell>
                          <TableCell className="text-right font-black text-zinc-800">{gross.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-black text-amber-600">{vat.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                          <TableCell className="text-right font-black text-emerald-600">{net.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                        </TableRow>
                      );
                    })}
                    {channelRevenueOrders.length > 0 && (
                      <TableRow className="bg-zinc-100/50">
                        <TableCell colSpan={3} className="px-6 font-black text-zinc-900 text-sm tracking-widest">AGGREGATE TOTALS</TableCell>
                        <TableCell className="text-right font-black text-zinc-900 text-base">{totalRevenue.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-black text-amber-600 text-base">{totalVAT.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                        <TableCell className="text-right font-black text-emerald-600 text-base">{netRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-xs font-semibold text-zinc-500">
                ⚠️ Legal Note: VAT is calculated at the standard rate of 16% strictly following Kenya Revenue Authority (KRA) guidelines. This system-generated report serves as preliminary supporting documentation for iTax filings.
              </div>
            </TabsContent>

          </Tabs>
        </div>
      </div>
    </div>
  );
}
