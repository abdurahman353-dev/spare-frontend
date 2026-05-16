"use client";

import { useEffect, useState } from "react";
import {
  Package, ShoppingCart, TrendingUp, ArrowUpRight, Users, CreditCard,
  Activity, Box, ShieldCheck, Loader2, ArrowRight, BarChart3,
  AlertTriangle, CheckCircle2, Clock, Truck
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import api from "@/lib/axios";

interface DashboardData {
  stats: {
    revenue: number;
    orders: number;
    products: number;
    customers: number;
  };
  recent_orders: any[];
  low_stock: any[];
  sales_chart: any[];
}

const STATUS_STYLES: Record<string, string> = {
  Pending:    "bg-amber-50 text-amber-700 border-amber-200",
  Processing: "bg-blue-50 text-blue-700 border-blue-200",
  Delivered:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  Cancelled:  "bg-red-50 text-red-700 border-red-200",
};

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Defer chart rendering until client DOM is ready — prevents Recharts -1 size error
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    api.get("/dashboard")
      .then((res) => { setData(res.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-zinc-500 font-semibold text-sm">Loading analytics...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center space-y-2">
          <AlertTriangle className="h-10 w-10 text-red-400 mx-auto" />
          <p className="font-bold text-zinc-700">System offline. Please check your connection.</p>
        </div>
      </div>
    );
  }

  const kpis = [
    {
      title: "Total Revenue",
      value: `Ksh ${Number(data.stats.revenue).toLocaleString()}`,
      icon: CreditCard,
      trend: "+12.5%",
      trendUp: true,
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
      trendBg: "bg-emerald-50",
      trendColor: "text-emerald-700",
      border: "border-l-emerald-500",
    },
    {
      title: "Active Orders",
      value: data.stats.orders.toString(),
      icon: ShoppingCart,
      trend: "+4.2%",
      trendUp: true,
      iconBg: "bg-blue-50",
      iconColor: "text-[#0052cc]",
      trendBg: "bg-blue-50",
      trendColor: "text-[#0052cc]",
      border: "border-l-[#0052cc]",
    },
    {
      title: "Inventory SKUs",
      value: data.stats.products.toString(),
      icon: Box,
      trend: "Stable",
      trendUp: null,
      iconBg: "bg-zinc-100",
      iconColor: "text-zinc-600",
      trendBg: "bg-zinc-100",
      trendColor: "text-zinc-600",
      border: "border-l-zinc-400",
    },
    {
      title: "B2B Partners",
      value: data.stats.customers.toString(),
      icon: Users,
      trend: "+2 new",
      trendUp: true,
      iconBg: "bg-violet-50",
      iconColor: "text-violet-600",
      trendBg: "bg-violet-50",
      trendColor: "text-violet-700",
      border: "border-l-violet-500",
    },
  ];

  return (
    <div className="space-y-6 p-6 bg-zinc-50 min-h-screen">

      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Dashboard</h1>
          <p className="text-zinc-500 text-sm mt-1">Real-time performance analytics for AutoSpare East Africa.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Live</span>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi, i) => (
          <div
            key={i}
            className={cn(
              "bg-white rounded-xl border border-zinc-200 shadow-sm p-5 flex flex-col gap-4 hover:shadow-md transition-all border-l-4",
              kpi.border
            )}
          >
            <div className="flex items-center justify-between">
              <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", kpi.iconBg, kpi.iconColor)}>
                <kpi.icon className="h-4 w-4" />
              </div>
              <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1", kpi.trendBg, kpi.trendColor)}>
                {kpi.trendUp !== null && <TrendingUp className="h-3 w-3" />}
                {kpi.trend}
              </span>
            </div>
            <div>
              <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{kpi.title}</p>
              <p className="text-2xl font-black text-zinc-900 tracking-tight">{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Charts Row ── */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-7">

        {/* Sales Chart */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100">
            <div>
              <h2 className="text-base font-bold text-zinc-900">Sales Performance</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Monthly revenue across all channels</p>
            </div>
            <div className="h-8 w-8 bg-zinc-50 rounded-lg flex items-center justify-center border border-zinc-200">
              <BarChart3 className="h-4 w-4 text-zinc-400" />
            </div>
          </div>
          <div className="p-6">
            <div style={{ width: "100%", height: 280 }}>
              {mounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.sales_chart} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#0052cc" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="#0052cc" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#a1a1aa", fontSize: 11, fontWeight: 600 }}
                    dy={8}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#a1a1aa", fontSize: 11, fontWeight: 600 }}
                    tickFormatter={(v) => `${v/1000}k`}
                    width={40}
                  />
                  <Tooltip
                    formatter={(v: any) => [`Ksh ${Number(v).toLocaleString()}`, "Revenue"]}
                    contentStyle={{ borderRadius: 10, border: "1px solid #e4e4e7", boxShadow: "0 10px 25px rgba(0,0,0,0.08)", fontWeight: 600, fontSize: 12 }}
                    cursor={{ stroke: "#0052cc", strokeWidth: 1, strokeDasharray: "4 2" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="#0052cc"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                    dot={false}
                    activeDot={{ r: 5, fill: "#0052cc", stroke: "#fff", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
              ) : null}
            </div>
          </div>
        </div>

        {/* Inventory Health */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100">
            <div>
              <h2 className="text-base font-bold text-zinc-900">Inventory Health</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Stock levels relative to demand</p>
            </div>
            <div className="h-8 w-8 bg-zinc-50 rounded-lg flex items-center justify-center border border-zinc-200">
              <Package className="h-4 w-4 text-zinc-400" />
            </div>
          </div>
          <div className="p-4 space-y-2">
            {data.low_stock.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <div className="h-14 w-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-7 w-7 text-emerald-500" />
                </div>
                <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Stock Fully Optimized</p>
              </div>
            ) : (
              data.low_stock.slice(0, 5).map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-zinc-50 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-red-50 rounded-lg flex items-center justify-center group-hover:bg-red-100 transition-colors">
                      <Package className="h-3.5 w-3.5 text-red-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-zinc-900 line-clamp-1">{item.product?.name}</p>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-tight">{item.product?.sku}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-red-600 font-black text-sm">{item.quantity}</p>
                    <Badge className="text-[9px] bg-red-50 text-red-600 border-red-100 rounded-full px-1.5 uppercase border font-bold">Low</Badge>
                  </div>
                </div>
              ))
            )}
            <div className="pt-2">
              <Button className="w-full bg-zinc-900 text-white hover:bg-zinc-700 font-bold h-9 rounded-xl text-xs">
                Replenish Inventory
              </Button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
