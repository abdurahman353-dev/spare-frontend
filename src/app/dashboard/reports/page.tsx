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
  Pending:    "bg-amber-50 text-amber-700 border-amber-200",
  Processing: "bg-blue-50 text-blue-700 border-blue-200",
  Shipped:    "bg-blue-50 text-blue-700 border-blue-200",
  Delivered:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  Cancelled:  "bg-red-50 text-red-700 border-red-200",
};

function DocumentHeader({ title, subtitle, period, storeName = "AutoSpare Distributors" }: { title: string; subtitle: string; period: string; storeName?: string }) {
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
  const [orders, setOrders]       = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [storeName, setStoreName] = useState("My Business");
  const [storeKraPin, setStoreKraPin] = useState("");
  const [mounted, setMounted] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];

  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate]     = useState(today);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [activeTab, setActiveTab] = useState("sales");
  const [openCustomerSelect, setOpenCustomerSelect] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCustomers = useMemo(() => {
    if (!searchQuery) return customers;
    const q = searchQuery.toLowerCase();
    return customers.filter(c => 
      c.name?.toLowerCase().includes(q) || 
      c.phone?.toLowerCase().includes(q) || 
      c.email?.toLowerCase().includes(q)
    );
  }, [customers, searchQuery]);

  useEffect(() => {
    // Fetch admin settings to get business name and KRA PIN
    api.get("/settings").then(r => {
      if (r.data?.store_name)    setStoreName(r.data.store_name);
      if (r.data?.store_kra_pin) setStoreKraPin(r.data.store_kra_pin);
    }).catch(() => {});

    Promise.all([
      api.get("/orders"),
      api.get("/inventory"),
      api.get("/customers"),
    ]).then(([o, i, c]) => {
      setOrders(o.data);
      setInventory(i.data);
      setCustomers(c.data);
    }).catch(console.error)
      .finally(() => {
        setLoading(false);
        setMounted(true);
      });
  }, []);

  // Filter Orders based on date and exclude Cancelled orders
  const filteredOrders = useMemo(() => orders.filter(o => {
    if (o.status?.toLowerCase() === "cancelled") return false;
    if (!o.created_at) return true;
    const d = o.created_at.split("T")[0];
    return d >= startDate && d <= endDate;
  }), [orders, startDate, endDate]);

  const isVoidedOrder = (o: any) => o.status === "Cancelled" || o.payment_status === "Refunded";
  // Revenue only counts explicitly Paid, non-cancelled orders — matches backend scopeExcludingVoided
  const revenueOrders = useMemo(
    () => filteredOrders.filter(o => o.payment_status === "Paid" && o.status !== "Cancelled"),
    [filteredOrders]
  );

  // Order channel filter: All / Walk-In POS / Shipment Deliveries
  const [orderChannelFilter, setOrderChannelFilter] = useState("All");

  const channelFilteredOrders = useMemo(() => {
    if (orderChannelFilter === "Walk-In POS") {
      return filteredOrders.filter(o => !o.shipping_country || o.shipping_method === "Pickup" || o.shipping_method === "Local Delivery");
    }
    if (orderChannelFilter === "Shipment Deliveries") {
      return filteredOrders.filter(o => o.shipping_country && o.shipping_method !== "Pickup" && o.shipping_method !== "Local Delivery");
    }
    return filteredOrders;
  }, [filteredOrders, orderChannelFilter]);

  // Channel-aware revenue: respects both Paid/non-cancelled AND the active channel filter
  // This ensures Walk-In totals show only walk-in fees, and Shipment totals show only shipment fees
  const channelRevenueOrders = useMemo(
    () => channelFilteredOrders.filter(o => o.payment_status === "Paid" && o.status !== "Cancelled"),
    [channelFilteredOrders]
  );

  // Pagination for Sales table
  const [salesPage, setSalesPage] = useState(1);
  const SALES_PAGE_SIZE = 15;
  const paginatedSalesOrders = useMemo(() => {
    const start = (salesPage - 1) * SALES_PAGE_SIZE;
    return channelFilteredOrders.slice(start, start + SALES_PAGE_SIZE);
  }, [channelFilteredOrders, salesPage]);

  // Pagination for Inventory table
  const [inventoryPage, setInventoryPage] = useState(1);
  const INVENTORY_PAGE_SIZE = 15;
  const paginatedInventory = useMemo(() => {
    const start = (inventoryPage - 1) * INVENTORY_PAGE_SIZE;
    return inventory.slice(start, start + INVENTORY_PAGE_SIZE);
  }, [inventory, inventoryPage]);

  // Summary stats respect the active channel filter so Walk-In and Shipment totals are accurate
  const totalRevenue  = channelRevenueOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const totalShippingFeesInPeriod = channelRevenueOrders.reduce((s, o) => s + Number(o.shipping_fee || 0), 0);
  const totalVAT      = totalRevenue * 0.16;
  const netRevenue    = totalRevenue - totalVAT;
  const periodLabel   = `${new Date(startDate).toLocaleDateString("en-KE", { day:"numeric", month:"short", year:"numeric" })} – ${new Date(endDate).toLocaleDateString("en-KE", { day:"numeric", month:"short", year:"numeric" })}`;
  const channelLabel  = orderChannelFilter === "All" ? "All Channels" : orderChannelFilter;

  // BI Calculations: Timeline Data
  const timelineData = useMemo(() => {
    const map = new Map<string, number>();
    revenueOrders.forEach(o => {
      const date = o.created_at ? new Date(o.created_at).toLocaleDateString("en-KE", { month: "short", day: "numeric" }) : "Unknown";
      map.set(date, (map.get(date) || 0) + Number(o.total_amount || 0));
    });
    return Array.from(map.entries()).map(([date, revenue]) => ({ date, revenue })).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [revenueOrders]);

  // BI Calculations: Status Breakdown
  const statusData = useMemo(() => {
    const map = new Map<string, number>();
    filteredOrders.forEach(o => {
      const st = o.status || "Unknown";
      map.set(st, (map.get(st) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [filteredOrders]);

  // BI Calculations: Top Products
  const topProducts = useMemo(() => {
    const map = new Map<string, { revenue: number, qty: number }>();
    revenueOrders.forEach(o => {
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
      .sort((a,b) => b.revenue - a.revenue).slice(0, 5);
  }, [revenueOrders]);

  // BI Calculations: Sales by Location
  const locationData = useMemo(() => {
    const map = new Map<string, number>();
    revenueOrders.forEach(o => {
      const loc = o.shipping_city ? `${o.shipping_city}, ${o.shipping_country || 'KE'}` : "Unknown Origin";
      map.set(loc, (map.get(loc) || 0) + Number(o.total_amount || 0));
    });
    return Array.from(map.entries()).map(([name, revenue]) => ({ name, revenue })).sort((a,b) => b.revenue - a.revenue).slice(0, 5);
  }, [revenueOrders]);

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

  // PDF Export Engine
  const exportToPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const docId = 'REF-' + Math.random().toString(36).substring(2, 10).toUpperCase();
    
    // Header Letterhead
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 82, 204); // Primary Brand Color #0052cc
    doc.text(storeName, 14, 22);
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text("Business Intelligence Report", 14, 30);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 35);
    
    let currentY = 45;

    if (activeTab === "sales") {
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text("Sales Summary Report", 14, currentY);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Period: ${periodLabel}`, 14, currentY + 6);
      
      currentY += 18;
      
      // Summary Stats Block
      doc.setFillColor(245, 245, 245);
      doc.rect(14, currentY, pageWidth - 28, 20, 'F');
      doc.setFont("helvetica", "bold");
      doc.text(`Total Orders: ${filteredOrders.length}`, 20, currentY + 12);
      doc.text(`Gross Revenue: Ksh ${totalRevenue.toLocaleString()}`, 70, currentY + 12);
      doc.text(`Net Revenue: Ksh ${netRevenue.toLocaleString()}`, 140, currentY + 12);
      
      currentY += 30;
      
      autoTable(doc, {
        startY: currentY,
        head: [['Order Ref', 'Client', 'Date', 'Status', 'Amount (Ksh)']],
        body: filteredOrders.map(o => [
          o.tracking_number || `#ORD-${String(o.id).padStart(4, "0")}`,
          o.customer?.name || "—",
          o.created_at ? new Date(o.created_at).toLocaleDateString("en-KE") : "—",
          o.status || "Unknown",
          Number(o.total_amount).toLocaleString()
        ]),
        foot: [['TOTAL', '', '', '', `Ksh ${totalRevenue.toLocaleString()}`]],
        theme: 'grid',
        headStyles: { fillColor: [0, 82, 204] }, // Primary color
        footStyles: { fillColor: [240, 240, 240], textColor: [0,0,0], fontStyle: 'bold' }
      });
    } else if (activeTab === "inventory") {
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text("Inventory Status Report", 14, currentY);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`As of: ${new Date().toLocaleDateString()}`, 14, currentY + 6);
      
      currentY += 15;
      
      autoTable(doc, {
        startY: currentY,
        head: [['SKU', 'Product', 'Warehouse', 'Qty', 'Status']],
        body: inventory.map(i => {
          const qty = Number(i.quantity);
          const st = qty === 0 ? "Out of Stock" : qty <= 5 ? "Low Stock" : "In Stock";
          return [
            i.product?.sku || "—",
            i.product?.name || "—",
            i.warehouse?.name || "—",
            qty.toString(),
            st
          ];
        }),
        theme: 'grid',
        headStyles: { fillColor: [0, 82, 204] }
      });
    } else if (activeTab === "statement") {
      if (!selectedCustomer) {
        alert("Please select a customer first.");
        return;
      }
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text("Customer Account Statement", 14, currentY);
      
      currentY += 10;
      doc.setFontSize(10);
      doc.text(`Account Name: ${selectedCustomer.name}`, 14, currentY);
      doc.text(`Account No: ACC-${String(selectedCustomer.id).padStart(4, "0")}`, 14, currentY + 6);
      doc.text(`Period: ${periodLabel}`, 14, currentY + 12);
      
      currentY += 20;
      
      autoTable(doc, {
        startY: currentY,
        head: [['Invoice #', 'Date', 'Description', 'Status', 'Amount (Ksh)']],
        body: customerOrders.map(o => [
          o.tracking_number || `#ORD-${String(o.id).padStart(4, "0")}`,
          o.created_at ? new Date(o.created_at).toLocaleDateString("en-KE") : "—",
          `Parts Order — ${o.items?.length || 0} items`,
          o.status || "Unknown",
          Number(o.total_amount).toLocaleString()
        ]),
        foot: [['ACCOUNT TOTAL', '', '', '', `Ksh ${customerOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0).toLocaleString()}`]],
        theme: 'grid',
        headStyles: { fillColor: [0, 82, 204] },
        footStyles: { fillColor: [240, 240, 240], textColor: [0,0,0], fontStyle: 'bold' }
      });
    } else if (activeTab === "vat") {
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text("VAT / Tax Summary Report", 14, currentY);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Period: ${periodLabel}`, 14, currentY + 6);
      
      currentY += 15;
      
      autoTable(doc, {
        startY: currentY,
        head: [['Invoice #', 'Date', 'Client', 'Gross (Ksh)', 'VAT 16% (Ksh)', 'Net (Ksh)']],
        body: revenueOrders.map(o => {
          const gross = Number(o.total_amount || 0);
          const vat = gross * 0.16;
          const net = gross - vat;
          return [
            o.tracking_number || `#ORD-${String(o.id).padStart(4, "0")}`,
            o.created_at ? new Date(o.created_at).toLocaleDateString("en-KE") : "—",
            o.customer?.name || "—",
            gross.toLocaleString(),
            vat.toLocaleString(undefined, { maximumFractionDigits: 0 }),
            net.toLocaleString(undefined, { maximumFractionDigits: 0 })
          ];
        }),
        foot: [['TOTALS', '', '', totalRevenue.toLocaleString(), totalVAT.toLocaleString(undefined, { maximumFractionDigits: 0 }), netRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })]],
        theme: 'grid',
        headStyles: { fillColor: [0, 82, 204] },
        footStyles: { fillColor: [240, 240, 240], textColor: [0,0,0], fontStyle: 'bold' }
      });
    }
    
    // Watermark, Footer, and Doc ID on all pages
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      const pageHeight = doc.internal.pageSize.height;
      const currentWidth = doc.internal.pageSize.width;
      
      // Footer
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.setFont("helvetica", "bold");
      doc.text(`CONFIDENTIAL & PROPRIETARY - INTERNAL USE ONLY | Doc Ref: ${docId}`, 14, pageHeight - 10);
      doc.setFont("helvetica", "normal");
      doc.text(`Page ${i} of ${pageCount}`, currentWidth - 25, pageHeight - 10);
    }
    
    doc.save(`AutoSpare_Report_${activeTab}_${today}.pdf`);
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
                { value: "sales",     icon: TrendingUp,    label: "Sales & BI Analytics"  },
                { value: "inventory", icon: Package,       label: "Inventory Status"      },
                { value: "statement", icon: Users,         label: "Customer Statement"    },
                { value: "vat",       icon: Receipt,       label: "VAT / Tax Filing"      },
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
        <div className="flex-1 p-6 md:p-8 bg-zinc-50/30 overflow-y-auto">
          
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
          </div>

          <Tabs value={activeTab} className="w-full">
            {/* ── TAB 1: Sales Summary & BI ── */}
            <TabsContent value="sales" className="mt-0 space-y-8 animate-in fade-in duration-500">
              <DocumentHeader title="Sales Summary & Analytics" subtitle="Comprehensive view of revenue and volume performance" period={periodLabel} />

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                <SummaryCard label="Total Orders"   value={String(filteredOrders.length)} />
                <SummaryCard label="Gross Revenue"  value={`Ksh ${totalRevenue.toLocaleString()}`} />
                <SummaryCard label="VAT Collected"  value={`Ksh ${totalVAT.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} sub="16% standard rate" />
                <SummaryCard label="Net Revenue"    value={`Ksh ${netRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
              </div>

              {/* BI Charts Section */}
              {activeTab === "sales" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Revenue Timeline */}
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200">
                    <h3 className="text-sm font-black text-zinc-800 mb-6 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-[#0052cc]"/> Revenue Timeline</h3>
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
                    <h3 className="text-sm font-black text-zinc-800 mb-6 flex items-center gap-2"><PieChart className="h-4 w-4 text-[#0052cc]"/> Fulfillment Status</h3>
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
                  <h3 className="text-sm font-black text-zinc-800 mb-6 flex items-center gap-2"><Package className="h-4 w-4 text-[#0052cc]"/> Top Selling Products</h3>
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
                  <h3 className="text-sm font-black text-zinc-800 mb-6 flex items-center gap-2"><MapPin className="h-4 w-4 text-[#0052cc]"/> Top Regional Destinations</h3>
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
              <div className="rounded-2xl border border-zinc-200 overflow-hidden bg-white shadow-sm mt-8">
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
                    {channelFilteredOrders.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="h-32 text-center text-zinc-400 font-medium">No orders in this period.</TableCell></TableRow>
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
                    {channelFilteredOrders.length > 0 && (
                      <TableRow className="bg-zinc-100/50 hover:bg-zinc-100/50">
                        <TableCell colSpan={4} className="px-6 font-black text-zinc-900 text-sm tracking-widest">TOTAL REVENUE ({orderChannelFilter})</TableCell>
                        <TableCell className="text-right font-black text-[#0052cc] text-base">Ksh {channelFilteredOrders.filter(o => o.payment_status === "Paid" && o.status !== "Cancelled").reduce((s, o) => s + Number(o.total_amount || 0), 0).toLocaleString()}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                <PaginationControls
                  currentPage={salesPage}
                  setCurrentPage={setSalesPage}
                  pageSize={SALES_PAGE_SIZE}
                  setPageSize={() => {}}
                  totalItems={channelFilteredOrders.length}
                  itemName="orders"
                />
              </div>
            </TabsContent>

            {/* ── TAB 2: Inventory Report ── */}
            <TabsContent value="inventory" className="mt-0 space-y-8 animate-in fade-in duration-500">
              <DocumentHeader title="Inventory Status Report" subtitle="Real-time stock level analysis across all distribution hubs" period={`As of ${new Date().toLocaleDateString("en-KE")}`} />

              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <SummaryCard label="Total Monitored SKUs"    value={String(inventory.length)} />
                <SummaryCard label="Low Stock Warning"     value={String(inventory.filter(i => i.quantity <= 5 && i.quantity > 0).length)} sub="Items ≤ 5 units remaining" />
                <SummaryCard label="Critical Out of Stock"  value={String(inventory.filter(i => i.quantity === 0).length)} sub="Requires immediate replenishment" />
              </div>

              <div className="rounded-2xl border border-zinc-200 overflow-hidden bg-white shadow-sm">
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
                    {inventory.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="h-32 text-center text-zinc-400 font-medium">No inventory data available.</TableCell></TableRow>
                    ) : paginatedInventory.map((item, i) => {
                      const qty = Number(item.quantity);
                      const status = qty === 0 ? "OUT OF STOCK" : qty <= 5 ? "LOW STOCK" : "IN STOCK";
                      const statusCls = qty === 0
                        ? "bg-red-900 text-white hover:bg-red-950 border-none font-bold uppercase tracking-wider"
                        : qty <= 5
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
                  setPageSize={() => {}}
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
                <div className="rounded-2xl border border-zinc-200 overflow-hidden bg-white shadow-sm">
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
                            Ksh {customerOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0).toLocaleString()}
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
              <DocumentHeader title="VAT & Tax Compliance Report" subtitle="Financial breakdown of taxable transactions for KRA filing" period={periodLabel} />

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <SummaryCard label="Total Gross Sales"     value={`Ksh ${totalRevenue.toLocaleString()}`} />
                <SummaryCard label="Taxable Amount"  value={`Ksh ${totalRevenue.toLocaleString()}`} sub="100% of transactions" />
                <SummaryCard label="VAT Remittable @ 16%"       value={`Ksh ${totalVAT.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
                <SummaryCard label="Net Income (ex-VAT)"    value={`Ksh ${netRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
              </div>

              <div className="rounded-2xl border border-zinc-200 overflow-hidden bg-white shadow-sm">
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
                    {revenueOrders.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="h-32 text-center text-zinc-400 font-medium">No taxable transactions found.</TableCell></TableRow>
                    ) : revenueOrders.map((o, i) => {
                      const gross = Number(o.total_amount || 0);
                      const vat   = gross * 0.16;
                      const net   = gross - vat;
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
                    {revenueOrders.length > 0 && (
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
