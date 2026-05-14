"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Search, Filter, Plus, Loader2, Navigation, Package, ArrowRight, RefreshCw, X, MoreHorizontal, Edit, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buttonVariants } from "@/components/ui/button";
import { toast } from "react-hot-toast";

export default function AdminLogisticsPage() {
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    waybill: "",
    carrier: "DHL Global",
    origin: "",
    destination: "",
    status: "Processing"
  });

  // Mock shipments for the table
  const [shipments, setShipments] = useState([
    { id: "WB-2026-001", carrier: "DHL Global", origin: "Nairobi", destination: "Mombasa", status: "In Transit", eta: "2h 15m" },
    { id: "WB-2026-002", carrier: "Maersk", origin: "Mombasa Port", destination: "Kampala", status: "Processing", eta: "1d 4h" },
    { id: "WB-2026-003", carrier: "FedEx", origin: "Nairobi Central", destination: "Garissa", status: "Delivered", eta: "Completed" },
  ]);

  // Real-time status simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setShipments(prev => prev.map(s => {
        if (s.status === "In Transit") {
          // Update ETA or randomly change status
          return { ...s, eta: "2h " + Math.floor(Math.random() * 60) + "m" };
        }
        return s;
      }));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleNewShipment = async () => {
    if (!formData.waybill || !formData.origin || !formData.destination) {
      return toast.error("Please fill in all required fields.");
    }

    setIsSaving(true);
    setTimeout(() => {
      setShipments(prev => [
        { 
          id: formData.waybill, 
          carrier: formData.carrier, 
          origin: formData.origin, 
          destination: formData.destination, 
          status: formData.status, 
          eta: "Calculating..." 
        },
        ...prev
      ]);
      setIsSaving(false);
      setIsModalOpen(false);
      setFormData({ waybill: "", carrier: "DHL Global", origin: "", destination: "", status: "Processing" });
      toast.success("Shipment registered successfully!");
    }, 1000);
  };

  return (
    <div className="space-y-6 p-8 bg-white min-h-screen font-sans">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Logistics & Tracking</h1>
          <p className="text-zinc-500 text-sm mt-1 font-medium italic">Global fleet management and real-time shipment monitoring.</p>
        </div>
        <Button 
          className="bg-primary text-white hover:bg-primary/90 rounded-lg shadow-sm font-bold"
          onClick={() => setIsModalOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" /> New Shipment
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl border border-zinc-100 shadow-sm">
        <div className="flex flex-wrap flex-1 gap-3 w-full">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input 
              placeholder="Search by Waybill, Origin or Destination..." 
              className="pl-10 h-10 border-zinc-200 rounded-lg bg-white font-medium text-sm focus:border-[#0052cc]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select className="h-10 px-3 border border-zinc-200 rounded-lg text-[13px] bg-white font-medium text-zinc-600 outline-none focus:border-[#0052cc]">
             <option>All Carriers</option>
          </select>
          <select className="h-10 px-3 border border-zinc-200 rounded-lg text-[13px] bg-white font-medium text-zinc-600 outline-none focus:border-[#0052cc]">
             <option>All Routes</option>
          </select>
          <select className="h-10 px-3 border border-zinc-200 rounded-lg text-[13px] bg-white font-medium text-zinc-600 outline-none focus:border-[#0052cc]">
             <option>All Statuses</option>
          </select>
          <Button variant="outline" className="h-10 rounded-lg px-4 border-zinc-200 font-bold text-[11px] uppercase tracking-widest text-zinc-400 bg-white hover:bg-zinc-50" onClick={() => { setSearchQuery(""); }}>
             <Filter className="mr-2 h-3.5 w-3.5" /> Clear
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-zinc-100 overflow-hidden">
        <Table>
          <TableHeader className="bg-zinc-50/50 border-b border-zinc-100">
            <TableRow>
              <TableHead className="px-6 h-12 font-bold text-zinc-900 text-[13px]">Waybill ID</TableHead>
              <TableHead className="h-12 font-bold text-zinc-900 text-[13px]">Carrier</TableHead>
              <TableHead className="h-12 font-bold text-zinc-900 text-[13px]">Route (Origin → Dest)</TableHead>
              <TableHead className="h-12 font-bold text-zinc-900 text-[13px]">ETA / Progress</TableHead>
              <TableHead className="h-12 font-bold text-zinc-900 text-[13px]">Status</TableHead>
              <TableHead className="px-6 h-12 font-bold text-zinc-900 text-[13px] text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shipments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-48 text-center text-zinc-500 font-medium">
                  No active shipments in transit.
                </TableCell>
              </TableRow>
            ) : (
              shipments.map((shipment) => (
                <TableRow key={shipment.id} className="hover:bg-zinc-50/50 transition-colors">
                  <TableCell className="px-6 font-black text-zinc-900 text-sm">{shipment.id}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="bg-zinc-100 text-zinc-600 border-none px-2 py-0.5 text-[10px] font-bold uppercase">
                      {shipment.carrier}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700">
                      {shipment.origin} <ArrowRight className="h-3 w-3 text-zinc-400" /> {shipment.destination}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs font-bold text-[#0052cc]">{shipment.eta}</TableCell>
                  <TableCell>
                    <Badge className={cn(
                      "rounded-full px-3 text-[10px] font-bold uppercase border-none tracking-wider",
                      shipment.status === "Delivered" ? "bg-emerald-100 text-emerald-700" : 
                      shipment.status === "In Transit" ? "bg-blue-100 text-[#0052cc]" : "bg-zinc-100 text-zinc-500"
                    )}>
                      {shipment.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-6">
                    <DropdownMenu>
                      <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost" }), "h-8 w-8 p-0 rounded-full")}>
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44 rounded-xl border-zinc-200 shadow-xl p-1">
                        <DropdownMenuGroup>
                          <DropdownMenuLabel className="text-[10px] font-black text-zinc-400 uppercase px-2 py-1.5">Actions</DropdownMenuLabel>
                          <DropdownMenuItem className="cursor-pointer rounded-lg font-bold text-sm">
                            <Edit className="mr-2 h-4 w-4 text-zinc-400" /> Update Status
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600 cursor-pointer rounded-lg font-bold text-sm">
                            <Trash2 className="mr-2 h-4 w-4" /> Cancel
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

      {/* New Shipment Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden bg-white rounded-xl shadow-2xl border border-zinc-200">
            <DialogHeader className="p-6 border-b bg-white">
              <DialogTitle className="text-xl font-bold text-zinc-900">Register New Shipment</DialogTitle>
            </DialogHeader>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-500">Waybill ID *</label>
                  <Input 
                    placeholder="e.g. WB-2026-999" 
                    className="h-10 border-zinc-200 rounded-lg focus:ring-[#0052cc]/20" 
                    value={formData.waybill}
                    onChange={(e) => setFormData({...formData, waybill: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-500">Carrier Partner *</label>
                  <select 
                    className="w-full h-10 px-3 border border-zinc-200 rounded-lg text-sm bg-white outline-none"
                    value={formData.carrier}
                    onChange={(e) => setFormData({...formData, carrier: e.target.value})}
                  >
                    <option>DHL Global</option>
                    <option>Maersk</option>
                    <option>FedEx</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-500">Origin Node *</label>
                  <Input 
                    placeholder="e.g. Nairobi Hub" 
                    className="h-10 border-zinc-200 rounded-lg" 
                    value={formData.origin}
                    onChange={(e) => setFormData({...formData, origin: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-500">Final Destination *</label>
                  <Input 
                    placeholder="e.g. Mombasa Port" 
                    className="h-10 border-zinc-200 rounded-lg" 
                    value={formData.destination}
                    onChange={(e) => setFormData({...formData, destination: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500">Initial Status</label>
                <select 
                  className="w-full h-10 px-3 border border-zinc-200 rounded-lg text-sm bg-white outline-none"
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                >
                  <option value="Processing">Processing</option>
                  <option value="In Transit">In Transit</option>
                </select>
              </div>
            </div>
            <DialogFooter className="p-4 border-t bg-zinc-50/50 flex items-center justify-end gap-3">
              <Button variant="outline" className="h-10 rounded-lg px-6 font-bold text-sm text-zinc-600 bg-white border-zinc-200" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button 
                className="h-10 bg-[#0052cc] text-white hover:bg-[#0747a6] rounded-lg font-black px-8 text-[11px] tracking-widest uppercase shadow-sm" 
                onClick={handleNewShipment}
                disabled={isSaving}
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                REGISTER SHIPMENT
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
}
