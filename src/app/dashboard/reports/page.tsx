"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileText, Download, TrendingUp, Calendar, Filter, PieChart as PieChartIcon, BarChart as BarChartIcon, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
import api from "@/lib/axios";

export default function AdminReportsPage() {
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/dashboard")
      .then((res) => {
        setReportData(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const pieData = [
    { name: "Engine Parts", value: 45, color: "#3b82f6" },
    { name: "Electrical", value: 25, color: "#6366f1" },
    { name: "Suspension", value: 20, color: "#10b981" },
    { name: "Bodywork", value: 10, color: "#f59e0b" },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-zinc-500 font-semibold text-sm">Generating analytical reports...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Reports</h1>
          <p className="text-zinc-500 text-sm mt-1">Comprehensive data analysis and financial reporting.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="h-10 rounded-lg border-zinc-200 font-semibold">
            <Calendar className="mr-2 h-4 w-4" /> Last 30 Days
          </Button>
          <Button className="h-10 bg-primary text-white hover:bg-primary/90 rounded-lg shadow-sm font-semibold px-4">
            <Download className="mr-2 h-4 w-4" /> Download PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border border-zinc-200 shadow-sm rounded-xl overflow-hidden bg-white">
          <CardHeader className="px-6 py-6 border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-zinc-900">Revenue Growth</CardTitle>
                <CardDescription className="text-sm">Cumulative sales performance over time.</CardDescription>
              </div>
              <div className="h-9 w-9 bg-zinc-50 rounded-lg flex items-center justify-center text-primary border border-zinc-100">
                <BarChartIcon className="h-5 w-5" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                <BarChart data={reportData.sales_chart}>
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
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #f1f1f1', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 600 }}
                  />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1 border border-zinc-200 shadow-sm rounded-xl overflow-hidden bg-white">
          <CardHeader className="px-6 py-6 border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-zinc-900">Inventory Mix</CardTitle>
                <CardDescription className="text-sm text-zinc-500">Sales volume by category.</CardDescription>
              </div>
              <div className="h-9 w-9 bg-zinc-50 rounded-lg flex items-center justify-center text-primary border border-zinc-100">
                <PieChartIcon className="h-5 w-5" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: '1px solid #f1f1f1', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3 mt-6">
              {pieData.map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs font-semibold text-zinc-600">{item.name}</span>
                  </div>
                  <span className="text-sm font-bold text-zinc-900">{item.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "Quarterly Revenue", value: "Ksh 8.4M", trend: "+14%", icon: TrendingUp },
          { label: "Sales Tax Due", value: "Ksh 1.2M", trend: "Processed", icon: FileText },
          { label: "Net Profit", value: "Ksh 2.1M", trend: "+8%", icon: TrendingUp },
          { label: "Operational Cost", value: "Ksh 4.5M", trend: "-2%", icon: TrendingUp },
        ].map((stat, i) => (
          <Card key={i} className="border border-zinc-200 shadow-sm rounded-xl overflow-hidden bg-white hover:border-zinc-300 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="h-9 w-9 bg-zinc-50 rounded-lg flex items-center justify-center text-zinc-400 border border-zinc-100">
                  <stat.icon className="h-4.5 w-4.5" />
                </div>
                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">{stat.trend}</Badge>
              </div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{stat.label}</p>
              <p className="text-xl font-bold text-zinc-900 mt-1">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
