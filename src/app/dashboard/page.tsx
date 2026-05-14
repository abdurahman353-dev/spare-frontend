"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Package, ShoppingCart, TrendingUp, ArrowUpRight, Users, CreditCard, Activity, Box, Search, Download, ShieldCheck, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
} from "recharts";
import api from "@/lib/axios";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/dashboard")
      .then((res) => {
        setData(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch dashboard data:", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-zinc-500 font-semibold text-sm">Loading analytics...</p>
      </div>
    );
  }

  if (!data) {
    return <div className="flex h-96 items-center justify-center text-destructive font-bold">System offline. Please check your connection.</div>;
  }

  return (
    <div className="space-y-6 p-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Dashboard</h1>
          <p className="text-zinc-500 text-sm mt-1">Real-time performance analytics for AutoSpare East Africa.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input placeholder="Search records..." className="pl-10 h-10 border-zinc-200 rounded-lg bg-white" />
          </div>
          <Button className="h-10 px-4 bg-primary text-white hover:bg-primary/90 rounded-lg shadow-sm">
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { title: "Total Revenue", value: `Ksh ${data.stats.revenue.toLocaleString()}`, icon: CreditCard, trend: "+12.5%", color: "text-emerald-600", bg: "bg-emerald-50" },
          { title: "Active Orders", value: data.stats.orders.toString(), icon: ShoppingCart, trend: "+4.2%", color: "text-blue-600", bg: "bg-blue-50" },
          { title: "Inventory Assets", value: data.stats.products.toString(), icon: Box, trend: "Stable", color: "text-zinc-600", bg: "bg-zinc-50" },
          { title: "B2B Partners", value: data.stats.customers.toString(), icon: Users, trend: "+2 new", color: "text-indigo-600", bg: "bg-indigo-50" },
        ].map((kpi, i) => (
          <Card key={i} className="border border-zinc-200 shadow-sm rounded-xl overflow-hidden hover:border-zinc-300 transition-colors">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className={`p-2.5 rounded-lg ${kpi.bg} ${kpi.color}`}>
                  <kpi.icon className="h-5 w-5" />
                </div>
                <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${kpi.bg} ${kpi.color} flex items-center gap-1`}>
                  <TrendingUp className="h-3 w-3" />
                  {kpi.trend}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{kpi.title}</p>
                <p className="text-2xl font-bold text-zinc-900">{kpi.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Charts */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-7">
        <Card className="lg:col-span-4 border border-zinc-200 shadow-sm rounded-xl overflow-hidden bg-white">
          <CardHeader className="px-6 py-6 border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-zinc-900">Sales Performance</CardTitle>
                <CardDescription className="text-sm">Monthly revenue distribution across regions.</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg"><Activity className="h-4 w-4" /></Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                <AreaChart data={data.sales_chart}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#71717a', fontSize: 11, fontWeight: 500 }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#71717a', fontSize: 11, fontWeight: 500 }}
                    tickFormatter={(val) => `Ksh ${val/1000}k`}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: '1px solid #f1f1f1', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 600 }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="total" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorTotal)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 border border-zinc-200 shadow-sm rounded-xl overflow-hidden bg-white">
          <CardHeader className="px-6 py-6 border-b">
            <CardTitle className="text-lg font-bold text-zinc-900">Inventory Health</CardTitle>
            <CardDescription className="text-sm">Stock levels relative to demand.</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-5">
              {data.low_stock.slice(0, 5).map((item, i) => (
                <div key={i} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 bg-zinc-50 rounded-lg flex items-center justify-center text-zinc-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                      <Package className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-zinc-900 line-clamp-1">{item.product.name}</div>
                      <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-tight">{item.product.sku}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-red-600 font-bold text-sm">{item.quantity} PCS</div>
                    <Badge variant="secondary" className="text-[9px] h-4 rounded-full bg-red-50 text-red-600 border-red-100 uppercase">Critical</Badge>
                  </div>
                </div>
              ))}
              {data.low_stock.length === 0 && (
                <div className="py-16 text-center space-y-3">
                  <ShieldCheck className="h-12 w-12 text-emerald-500 mx-auto opacity-20" />
                  <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Stock fully optimized</p>
                </div>
              )}
            </div>
            <Button className="w-full mt-6 bg-zinc-900 text-white hover:bg-zinc-800 font-bold h-10 rounded-lg">
              Replenish Inventory
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders Table */}
      <Card className="border border-zinc-200 shadow-sm rounded-xl overflow-hidden bg-white">
        <CardHeader className="px-6 py-6 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold text-zinc-900">Live Order Stream</CardTitle>
            <Button variant="ghost" size="sm" className="text-primary font-bold text-xs hover:bg-primary/5">View All History</Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-zinc-50 text-[10px] uppercase tracking-wider font-bold text-zinc-400">
                <tr>
                  <th className="px-6 py-4">Client</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Payment</th>
                  <th className="px-6 py-4 text-right">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {data.recent_orders.map((order, i) => (
                  <tr key={i} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-6 py-5">
                      <div className="font-semibold text-zinc-900">{order.customer.name}</div>
                      <div className="text-xs text-zinc-500">{order.tracking_number || "#PENDING"}</div>
                    </td>
                    <td className="px-6 py-5">
                      <Badge variant="outline" className={cn(
                        "text-[9px] font-bold px-2 py-0.5 rounded-full uppercase",
                        order.status === "Pending" ? "border-yellow-200 bg-yellow-50 text-yellow-700" : 
                        order.status === "Delivered" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : 
                        "border-blue-200 bg-blue-50 text-blue-700"
                      )}>
                        {order.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        <span className="text-xs font-semibold text-zinc-600">STK Push Active</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right font-bold text-zinc-900">Ksh {order.total_amount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
