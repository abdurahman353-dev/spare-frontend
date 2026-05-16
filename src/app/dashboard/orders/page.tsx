"use client";

import { useEffect, useState, useMemo } from "react";
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
  RefreshCw 
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
import { toast } from "react-hot-toast";

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");
  
  // Advanced Filters
  const [warehouseFilter, setWarehouseFilter] = useState("All Origins");
  const [cityFilter, setCityFilter] = useState("All Destinations");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [activeCities, setActiveCities] = useState<any[]>([]);
  
  // Selection
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "All Status") params.append("status", statusFilter);
      if (warehouseFilter !== "All Origins") params.append("warehouse_id", warehouseFilter);
      if (cityFilter !== "All Destinations") params.append("city", cityFilter);
      if (dateFrom) params.append("date_from", dateFrom);
      if (dateTo) params.append("date_to", dateTo);

      const res = await api.get(`/orders?${params.toString()}`);
      setOrders(res.data);
    } catch (err) {
      console.error("Failed to fetch orders:", err);
      toast.error("Failed to sync orders");
    } finally {
      setLoading(false);
    }
  };

  const fetchMetadata = async () => {
    try {
      const [wRes] = await Promise.all([
        api.get("/warehouses")
      ]);
      setWarehouses(wRes.data);
    } catch (err) {
      console.error("Failed to fetch metadata:", err);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, []);

  // Dynamically derive destinations based on the selected Warehouse
  const dynamicCityOptions = useMemo(() => {
    let baseOrders = orders;
    if (warehouseFilter !== "All Origins") {
      baseOrders = orders.filter(o => o.items?.some((i: any) => i.warehouse_id.toString() === warehouseFilter));
    }
    const cities = Array.from(new Set(baseOrders.map(o => o.shipping_city).filter(Boolean)));
    return cities.sort();
  }, [orders, warehouseFilter]);

  useEffect(() => {
    fetchOrders();
    setSelectedOrderIds([]); // Reset selection on filter change
  }, [statusFilter, warehouseFilter, cityFilter, dateFrom, dateTo]);

  const handleStatusChange = async (id: number, status: string) => {
    try {
      await api.put(`/orders/${id}`, { status });
      toast.success(`Order marked as ${status}`);
      fetchOrders();
    } catch (err) {
      console.error("Failed to update status", err);
      toast.error("Status update failed");
    }
  };

  const handleBulkStatusChange = async (status: string) => {
    if (selectedOrderIds.length === 0) return;
    setIsBulkProcessing(true);
    try {
      await api.post("/orders/bulk-status", {
        order_ids: selectedOrderIds,
        status: status
      });
      toast.success(`${selectedOrderIds.length} orders updated to ${status}`);
      setSelectedOrderIds([]);
      fetchOrders();
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

  const handleClearFilters = () => {
    setStatusFilter("All Status");
    setWarehouseFilter("All Origins");
    setCityFilter("All Destinations");
    setDateFrom("");
    setDateTo("");
    setSearchQuery("");
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const trackingNumber = order.tracking_number || "";
      const customerName = order.customer?.name || "";
      const customerEmail = order.customer?.email || "";
      const warehouseName = order.items?.[0]?.warehouse?.name || "";
      const destinationCity = order.shipping_city || "";

      return (
        trackingNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customerEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
        warehouseName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        destinationCity.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [orders, searchQuery]);

  const statuses = ["All Status", "Pending", "Processing", "Shipped", "Delivered", "Cancelled"];

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Orders</h1>
          <p className="text-zinc-500 text-sm mt-1">Manage and dispatch customer orders across your logistics network.</p>
        </div>
        <div className="flex gap-3">
          <Button 
            onClick={handleExport}
            disabled={loading || orders.length === 0}
            variant="outline"
            className="rounded-lg shadow-sm font-bold border-zinc-200"
          >
            <Download className="mr-2 h-4 w-4 text-zinc-500" /> Export Batch
          </Button>
          <Button 
            onClick={() => fetchOrders()}
            className="bg-primary text-white hover:bg-primary/90 rounded-lg shadow-sm font-bold"
          >
            Refresh Data
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
        <div className="relative w-full sm:flex-1 sm:min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input 
            placeholder="Search Ref, Customer, Route..." 
            className="pl-10 h-10 border-zinc-200 rounded-lg bg-white w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="w-full sm:w-[180px]">
          <select 
            className="h-10 px-3 border border-zinc-200 rounded-lg text-sm font-medium bg-white outline-none focus:ring-2 focus:ring-primary/20 w-full text-zinc-600"
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
          >
            <option>All Origins</option>
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>

        <div className="w-full sm:w-[180px]">
          <select 
            className="h-10 px-3 border border-zinc-200 rounded-lg text-sm font-medium bg-white outline-none focus:ring-2 focus:ring-primary/20 w-full text-zinc-600"
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
          >
            <option>All Destinations</option>
            {dynamicCityOptions.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="w-full sm:w-[150px]">
          <select 
            className="h-10 px-3 border border-zinc-200 rounded-lg text-sm font-medium bg-white outline-none focus:ring-2 focus:ring-primary/20 w-full text-zinc-600"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {statuses.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <Input 
            type="date"
            className="h-10 border-zinc-200 rounded-lg text-xs font-medium bg-white w-[130px]"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <Input 
            type="date"
            className="h-10 border-zinc-200 rounded-lg text-xs font-medium bg-white w-[130px]"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>

        <Button variant="outline" className="w-full sm:w-auto rounded-lg h-10 px-3 border-zinc-200" onClick={handleClearFilters}>
           <Filter className="h-4 w-4 text-zinc-500 mr-2" /> Clear
        </Button>
      </div>

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
                  className="bg-white hover:bg-zinc-50 font-bold text-[10px] uppercase tracking-wider border-zinc-200"
                >
                  Mark Processing
                </Button>
                <Button 
                  size="sm" 
                  disabled={isBulkProcessing}
                  onClick={() => handleBulkStatusChange('Shipped')}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] uppercase tracking-wider shadow-sm"
                >
                  Mark Shipped
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => setSelectedOrderIds([])}
                  className="text-zinc-500 hover:text-zinc-900 font-bold text-[10px] uppercase tracking-wider"
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      <div className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden">
        <Table>
          <TableHeader className="bg-zinc-50/50">
            <TableRow>
              <TableHead className="w-[50px] px-6 text-center">
                 <button 
                  onClick={() => {
                    if (selectedOrderIds.length === filteredOrders.length) setSelectedOrderIds([]);
                    else setSelectedOrderIds(filteredOrders.map(o => o.id));
                  }}
                  className="text-zinc-400 hover:text-zinc-900 transition-colors"
                >
                  {selectedOrderIds.length === filteredOrders.length && filteredOrders.length > 0 ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                </button>
              </TableHead>
              <TableHead className="px-4 font-semibold text-zinc-900">Order Ref</TableHead>
              <TableHead className="font-semibold text-zinc-900">Customer</TableHead>
              <TableHead className="font-semibold text-zinc-900">Route (Origin → Dest)</TableHead>
              <TableHead className="font-semibold text-zinc-900">Order Date</TableHead>
              <TableHead className="font-semibold text-zinc-900">Main Products</TableHead>
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
              <TableRow>
                <TableCell colSpan={11} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-zinc-500 font-medium">Synchronizing orders...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="h-48 text-center text-zinc-500">
                   No orders found matching your filters.
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((order) => (
                <TableRow key={order.id} className={cn(
                  "hover:bg-zinc-50/50 transition-colors group",
                  selectedOrderIds.includes(order.id) && "bg-zinc-50/50"
                )}>
                  <TableCell className="px-6 text-center">
                    <button 
                      onClick={() => {
                        if (selectedOrderIds.includes(order.id)) setSelectedOrderIds(selectedOrderIds.filter(id => id !== order.id));
                        else setSelectedOrderIds([...selectedOrderIds, order.id]);
                      }}
                      className={cn(
                        "transition-colors",
                        selectedOrderIds.includes(order.id) ? "text-[#0052cc]" : "text-zinc-200 group-hover:text-zinc-400"
                      )}
                    >
                      {selectedOrderIds.includes(order.id) ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                    </button>
                  </TableCell>
                  <TableCell className="px-4 py-4">
                    <p className="text-sm font-bold text-zinc-900">{order.tracking_number || `ORD-${order.id}`}</p>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-zinc-700">{order.customer?.name || "Guest"}</p>
                      <p className="text-[11px] text-zinc-500 font-medium">{order.customer?.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                       <div className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 uppercase">
                          {order.items?.[0]?.warehouse?.name?.split(' ').shift() || "Origin"}
                       </div>
                       <ArrowRightLeft className="h-3 w-3 text-zinc-300" />
                       <div className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 uppercase">
                          {order.shipping_city}
                       </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-zinc-700">{new Date(order.created_at).toLocaleDateString()}</p>
                      <p className="text-[10px] text-zinc-400 font-medium uppercase">{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5 max-w-[150px]">
                      <p className="text-xs font-bold text-zinc-800 truncate">
                        {order.items?.[0]?.product?.name || "Genuine Spare Part"}
                      </p>
                      {order.items && order.items.length > 1 && (
                        <p className="text-[10px] text-zinc-400 font-bold uppercase">+{order.items.length - 1} more items</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <Package className="h-3 w-3 text-zinc-400" />
                      <span className="text-xs font-bold text-zinc-700">{order.items?.length || 0}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs font-bold text-zinc-600">
                    Ksh {Math.max(0, (parseFloat(order.total_amount || 0) - parseFloat(order.shipping_fee || 0))).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs font-bold text-zinc-600">
                    Ksh {parseFloat(order.shipping_fee || 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <p className="text-xs font-black text-zinc-900">Ksh {parseFloat(order.total_amount || 0).toLocaleString()}</p>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={cn(
                      "rounded-full px-3 text-[10px] font-bold uppercase border-none tracking-wider",
                      order.status === "Pending" ? "bg-yellow-400 text-yellow-950 hover:bg-yellow-500" : 
                      order.status === "Processing" ? "bg-orange-500 text-white hover:bg-orange-600" :
                      order.status === "Shipped" || order.status === "In Transit" ? "bg-blue-600 text-white hover:bg-blue-700" :
                      order.status === "Delivered" ? "bg-emerald-500 text-white hover:bg-emerald-600" :
                      "bg-zinc-200 text-zinc-700"
                    )}>
                      {order.status === "In Transit" ? "SHIPPED" : order.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-6 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost" }), "h-8 w-8 p-0 rounded-full hover:bg-zinc-100")}>
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 rounded-xl border-zinc-200 shadow-xl p-1">
                        <DropdownMenuGroup>
                          <DropdownMenuLabel className="text-[10px] font-black text-zinc-400 uppercase px-2 py-1.5">Options</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => { setSelectedOrder(order); setIsOrderModalOpen(true); }} className="cursor-pointer rounded-lg font-bold text-sm">
                            <Eye className="mr-2 h-4 w-4 text-zinc-400" /> View Details
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleStatusChange(order.id, 'Processing')} className="cursor-pointer rounded-lg font-bold text-sm">
                            <RefreshCw className="mr-2 h-4 w-4 text-indigo-500" /> Mark Processing
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(order.id, 'Shipped')} className="cursor-pointer rounded-lg font-bold text-sm">
                            <Truck className="mr-2 h-4 w-4 text-blue-500" /> Mark Shipped
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(order.id, 'Delivered')} className="cursor-pointer rounded-lg font-bold text-sm text-emerald-600">
                            <CheckCircle2 className="mr-2 h-4 w-4" /> Mark Delivered
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
        <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden bg-white rounded-2xl border-none shadow-2xl">
          <DialogHeader className="p-6 bg-white border-b flex flex-row items-center justify-between">
            <div className="space-y-1 text-left">
              <DialogTitle className="text-xl font-bold text-zinc-900">Order Ref: {selectedOrder?.tracking_number || selectedOrder?.id}</DialogTitle>
              <DialogDescription className="text-zinc-400 font-medium text-xs">
                Placed on {selectedOrder ? new Date(selectedOrder.created_at).toLocaleDateString() : ''}
              </DialogDescription>
            </div>
            <Badge className={cn(
              "rounded-full px-3 py-1 text-[10px] font-bold uppercase border-none",
              selectedOrder?.status === "Pending" ? "bg-yellow-400 text-yellow-950" : 
              selectedOrder?.status === "Processing" ? "bg-orange-500 text-white" :
              selectedOrder?.status === "Shipped" || selectedOrder?.status === "In Transit" ? "bg-blue-600 text-white" :
              selectedOrder?.status === "Delivered" ? "bg-emerald-500 text-white" :
              "bg-zinc-200 text-zinc-700"
            )}>
              {selectedOrder?.status === "In Transit" ? "SHIPPED" : selectedOrder?.status}
            </Badge>
          </DialogHeader>
          <div className="p-6 max-h-[60vh] overflow-y-auto">
            <div className="mb-6 space-y-4">
              <div className="bg-zinc-50 p-5 rounded-xl border border-zinc-200">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Origin</p>
                      <p className="text-sm font-bold text-slate-700 uppercase">
                        {selectedOrder?.items?.[0]?.warehouse?.name || "Warehouse"}
                      </p>
                    </div>
                    <ArrowRightLeft className="h-4 w-4 text-zinc-300" />
                    <div className="space-y-1 text-right">
                      <p className="text-[10px] font-bold text-emerald-400 uppercase">Final Destination</p>
                      <p className="text-sm font-bold text-emerald-700 uppercase">
                        {selectedOrder?.shipping_city 
                          ? `${selectedOrder.shipping_country || 'Tanzania'}, ${selectedOrder.shipping_city}, ${selectedOrder.shipping_address}` 
                          : "Delivery Address"}
                      </p>
                    </div>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3">Customer Information</h4>
              <div className="bg-white p-4 rounded-xl border border-zinc-200">
                <p className="font-bold text-zinc-900">{selectedOrder?.customer?.name || "Guest"}</p>
                <p className="text-sm text-zinc-500 font-medium">{selectedOrder?.customer?.email}</p>
                <p className="text-sm text-zinc-500 font-medium mt-1">{selectedOrder?.shipping_address}</p>
              </div>
            </div>

            <div className="space-y-4">
               <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Items Summary</h4>
              {selectedOrder?.items?.map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center py-3 border-b last:border-0">
                  <div className="space-y-1">
                    <p className="font-bold text-zinc-900 text-sm">{item.product?.name || `Part ID: ${item.product_id}`}</p>
                    <p className="text-xs text-zinc-500 font-medium">Qty: {item.quantity} × Ksh {Number(item.price).toLocaleString()}</p>
                  </div>
                  <p className="font-bold text-zinc-900">Ksh {(Number(item.price) * item.quantity).toLocaleString()}</p>
                </div>
              ))}
            </div>
            
            <div className="mt-6 pt-4 border-t border-zinc-100 space-y-2">
              <div className="flex justify-between items-center text-zinc-500 font-bold text-[11px] uppercase tracking-tight">
                <span>Shipping ({selectedOrder?.shipping_method})</span>
                <span>Ksh {Number(selectedOrder?.shipping_fee || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold text-zinc-900 text-sm">Total Settlement</span>
                <span className="text-xl font-black text-zinc-900">Ksh {Number(selectedOrder?.total_amount).toLocaleString()}</span>
              </div>
            </div>
          </div>
          <DialogFooter className="p-4 bg-zinc-50 border-t">
            <Button variant="outline" className="font-bold text-xs rounded-lg" onClick={() => setIsOrderModalOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

