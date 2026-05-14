"use client";

import { useEffect, useState, useMemo } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Search, Filter, MoreHorizontal, Eye, Truck, Loader2, Download, CheckCircle2, ArrowRightLeft, MapPin } from "lucide-react";
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

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await api.get("/orders");
      setOrders(res.data);
    } catch (err) {
      console.error("Failed to fetch orders:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleStatusChange = async (id: number, status: string) => {
    try {
      await api.put(`/orders/${id}`, { status });
      fetchOrders();
    } catch (err) {
      console.error("Failed to update status", err);
    }
  };

  const handleExport = () => {
    if (orders.length === 0) return;
    
    const headers = ["Order ID", "Customer", "Date", "Amount", "Status", "Payment"];
    const csvData = orders.map(o => [
      `ORD-${o.id}`,
      o.customer?.name || "Guest",
      new Date(o.created_at).toLocaleDateString(),
      o.total_amount,
      o.status,
      o.payment_status
    ]);
    
    const csvContent = [headers, ...csvData].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `orders_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtering Logic
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const idStr = order.id?.toString() || "";
      const customerName = order.customer?.name || "";
      const customerEmail = order.customer?.email || "";

      const matchesSearch = 
        idStr.includes(searchQuery) ||
        customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customerEmail.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === "All Status" || order.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [orders, searchQuery, statusFilter]);

  const statuses = ["All Status", "Pending", "Processing", "Shipped", "Delivered", "Cancelled"];

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Order Management</h1>
          <p className="text-zinc-500 text-sm mt-1">Monitor and process all customer transactions.</p>
        </div>
        <Button 
          onClick={handleExport}
          disabled={loading || orders.length === 0}
          className="bg-primary text-white hover:bg-primary/90 rounded-lg shadow-sm"
        >
          <Download className="mr-2 h-4 w-4" /> Export Report
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input 
            placeholder="Search by ID, Customer or Email..." 
            className="pl-10 h-10 border-zinc-200 rounded-lg"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <select 
            className="h-10 pl-3 pr-8 border border-zinc-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-primary/20"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {statuses.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <Button variant="outline" className="rounded-lg h-10 px-3">
             <Filter className="h-4 w-4 text-zinc-500" />
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden">
        <Table>
          <TableHeader className="bg-zinc-50/50">
            <TableRow>
              <TableHead className="px-6 font-semibold text-zinc-900">Order ID</TableHead>
              <TableHead className="font-semibold text-zinc-900">Customer</TableHead>
              <TableHead className="font-semibold text-zinc-900 text-right">Value</TableHead>
              <TableHead className="font-semibold text-zinc-900 text-center">Status</TableHead>
              <TableHead className="font-semibold text-zinc-900">Payment</TableHead>
              <TableHead className="px-6 w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-zinc-500">Loading orders...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-48 text-center text-zinc-500">
                   No orders found.
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((order) => (
                <TableRow key={order.id} className="hover:bg-zinc-50/50">
                  <TableCell className="px-6 font-bold text-zinc-900">#ORD-{order.id}</TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">{order.customer?.name || "Guest"}</p>
                      <p className="text-xs text-zinc-500">{order.customer?.email}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold text-zinc-900">
                    Ksh {Number(order.total_amount).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={cn(
                      "rounded-full px-3 text-[10px] font-bold",
                      order.status === "Pending" ? "border-yellow-200 bg-yellow-50 text-yellow-700" : 
                      order.status === "Delivered" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : 
                      "border-blue-200 bg-blue-50 text-blue-700"
                    )}>
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <div className={cn("h-1.5 w-1.5 rounded-full", order.payment_status === 'Paid' ? 'bg-emerald-500' : 'bg-red-500')} />
                      <span className="text-xs font-semibold text-zinc-600 uppercase">{order.payment_status}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-6">
                    <DropdownMenu>
                      <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost" }), "h-8 w-8 p-0")}>
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuGroup>
                          <DropdownMenuLabel>Order Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => { setSelectedOrder(order); setIsOrderModalOpen(true); }} className="cursor-pointer">
                            <Eye className="mr-2 h-4 w-4 text-zinc-500" /> View Details
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleStatusChange(order.id, 'Shipped')} className="cursor-pointer">
                            <Truck className="mr-2 h-4 w-4 text-zinc-500" /> Mark as Shipped
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(order.id, 'Delivered')} className="cursor-pointer text-emerald-600">
                            <CheckCircle2 className="mr-2 h-4 w-4" /> Mark as Delivered
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Order Details Modal */}
      <Dialog open={isOrderModalOpen} onOpenChange={setIsOrderModalOpen}>
        <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden bg-white rounded-3xl border-none shadow-2xl">
          <DialogHeader className="p-6 bg-white border-b flex flex-row items-center justify-between">
            <div className="space-y-1 text-left">
              <DialogTitle className="text-xl font-black uppercase tracking-tighter">Order #{selectedOrder?.id}</DialogTitle>
              <DialogDescription className="text-zinc-400 font-bold text-xs uppercase tracking-widest">
                Placed on {selectedOrder ? new Date(selectedOrder.created_at).toLocaleDateString() : ''}
              </DialogDescription>
            </div>
            <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
              selectedOrder?.status === "Pending" ? "bg-yellow-500 text-yellow-950" : 
              selectedOrder?.status === "Processing" ? "bg-blue-500 text-blue-950" : 
              "bg-green-500 text-green-950"
            }`}>
              {selectedOrder?.status}
            </div>
          </DialogHeader>
          <div className="p-6 max-h-[60vh] overflow-y-auto">
            <h4 className="font-black text-xs text-zinc-400 uppercase tracking-widest mb-4">Logistics Intelligence</h4>
            <div className="mb-6 bg-[#f8fafc] p-5 rounded-xl border border-[#e2e8f0]">
               <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-[#94a3b8] uppercase">Origin Node</p>
                    <p className="text-[13px] font-bold text-[#1e293b]">
                       {selectedOrder?.items?.[0]?.warehouse?.location?.includes(',') 
                        ? selectedOrder.items[0].warehouse.location.split(',').pop()?.trim() 
                        : selectedOrder?.items?.[0]?.warehouse?.name?.split(' ').shift() || 
                          selectedOrder?.items?.[0]?.warehouse?.code?.split('-').shift() || "Warehouse"}
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
                        ? `${selectedOrder.shipping_city}, ${selectedOrder.shipping_address}` 
                        : (selectedOrder?.customer?.address || "Shipping Details")}
                    </p>
                  </div>
               </div>
            </div>

            <h4 className="font-black text-xs text-zinc-400 uppercase tracking-widest mb-4">Customer Details</h4>
            <div className="mb-6 bg-zinc-50 p-4 rounded-xl border border-zinc-100">
              <p className="font-bold text-zinc-900">{selectedOrder?.customer?.name || "Guest User"}</p>
              <p className="text-sm text-zinc-500">{selectedOrder?.customer?.email || "No email provided"}</p>
              {selectedOrder?.customer?.phone && <p className="text-sm text-zinc-500">{selectedOrder.customer.phone}</p>}
            </div>

            <h4 className="font-black text-xs text-zinc-400 uppercase tracking-widest mb-4">Items Included</h4>
            <div className="space-y-4">
              {selectedOrder?.items?.map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center pb-4 border-b last:border-0 last:pb-0">
                  <div className="space-y-1">
                    <p className="font-bold text-zinc-900 text-[14px]">{item.product?.name || `Product ID: ${item.product_id}`}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded uppercase tracking-tighter">Source: {item.warehouse?.name || "Processing Hub"}</span>
                      <span className="text-xs text-zinc-500 font-medium">Qty: {item.quantity} × Ksh {Number(item.price).toLocaleString()}</span>
                    </div>
                  </div>
                  <p className="font-black text-zinc-900">Ksh {(Number(item.price) * item.quantity).toLocaleString()}</p>
                </div>
              ))}
              {(!selectedOrder?.items || selectedOrder.items.length === 0) && (
                <p className="text-sm text-zinc-500">No items found for this order.</p>
              )}
            </div>
            <div className="mt-8 pt-4 border-t border-zinc-100 flex justify-between items-center">
              <span className="font-bold text-zinc-500 uppercase tracking-widest text-xs">Total Settlement</span>
              <span className="text-2xl font-black text-zinc-900">Ksh {selectedOrder ? Number(selectedOrder.total_amount).toLocaleString() : 0}</span>
            </div>
          </div>
          <DialogFooter className="p-6 bg-zinc-50 border-t">
            <Button variant="outline" className="font-bold uppercase text-xs" onClick={() => setIsOrderModalOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
