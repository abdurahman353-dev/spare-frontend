"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Search, Filter, Mail, Phone, MapPin, ShieldCheck, Plus, Loader2, Globe, Building2, CheckCircle2, MoreHorizontal, Edit, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
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
import api from "@/lib/axios";
import { cn } from "@/lib/utils";
import { toast } from "react-hot-toast";

interface Supplier {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  country: string;
  verification_status: string;
}

export default function AdminSuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [isOnboardModalOpen, setIsOnboardModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    country: "",
    verification_status: "Verified"
  });

  const fetchSuppliers = () => {
    setLoading(true);
    api.get("/suppliers")
      .then((res) => {
        setSuppliers(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch suppliers:", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleOnboardSupplier = async () => {
    if (!formData.name || !formData.email || !formData.country) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setIsSaving(true);
    try {
      await api.post("/suppliers", formData);
      toast.success(`${formData.name} successfully onboarded!`);
      setIsOnboardModalOpen(false);
      setFormData({ 
        name: "", 
        email: "", 
        phone: "", 
        address: "", 
        country: "", 
        verification_status: "Verified" 
      });
      fetchSuppliers();
    } catch (err) {
      console.error("Failed to onboard supplier:", err);
      toast.error("Failed to onboard supplier. Ensure email is unique.");
    } finally {
      setIsSaving(false);
    }
  };

  const filteredSuppliers = suppliers.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         s.country.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "All Status" || s.verification_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-[#0052cc]" />
        <p className="text-zinc-500 font-semibold text-sm">Synchronizing global suppliers...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 font-sans">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Suppliers</h1>
          <p className="text-zinc-500 text-sm mt-1 font-medium italic">Manage OEM and aftermarket parts suppliers globally.</p>
        </div>
        <Button 
          className="bg-primary text-white hover:bg-primary/90 rounded-lg shadow-sm font-bold"
          onClick={() => setIsOnboardModalOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" /> Onboard Supplier
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl border border-zinc-100 shadow-sm">
        <div className="flex flex-wrap flex-1 gap-3 w-full">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input 
              placeholder="Search by name, email or country..." 
              className="pl-10 h-10 border-zinc-200 rounded-lg bg-white font-medium text-sm focus:border-[#0052cc] transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select className="h-10 px-3 border border-zinc-200 rounded-lg text-[13px] bg-white font-medium text-zinc-600 outline-none focus:border-[#0052cc]">
             <option>All Names</option>
          </select>
          <select className="h-10 px-3 border border-zinc-200 rounded-lg text-[13px] bg-white font-medium text-zinc-600 outline-none focus:border-[#0052cc]">
             <option>All Countries</option>
          </select>
          <select 
            className="h-10 px-3 border border-zinc-200 rounded-lg text-[13px] bg-white font-medium text-zinc-600 outline-none focus:border-[#0052cc]"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All Status">All Statuses</option>
            <option value="Verified">Verified</option>
            <option value="Unverified">Pending</option>
          </select>
          <Button variant="outline" className="h-10 rounded-lg px-4 border-zinc-200 font-bold text-[11px] uppercase tracking-widest text-zinc-400 bg-white hover:bg-zinc-50" onClick={() => { setSearchQuery(""); setStatusFilter("All Status"); }}>
             <Filter className="mr-2 h-3.5 w-3.5" /> Clear
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-zinc-100 overflow-hidden">
        <Table>
          <TableHeader className="bg-zinc-50/50 border-b border-zinc-100">
            <TableRow>
              <TableHead className="px-6 h-12 font-bold text-zinc-900 text-[13px]">Name</TableHead>
              <TableHead className="h-12 font-bold text-zinc-900 text-[13px]">Contact Information</TableHead>
              <TableHead className="h-12 font-bold text-zinc-900 text-[13px]">Country</TableHead>
              <TableHead className="h-12 font-bold text-zinc-900 text-[13px]">Verification</TableHead>
              <TableHead className="px-6 h-12 font-bold text-zinc-900 text-[13px] text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSuppliers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-48 text-center text-zinc-500 font-medium">
                  No suppliers identified in the chain.
                </TableCell>
              </TableRow>
            ) : (
              filteredSuppliers.map((supplier) => (
                <TableRow key={supplier.id} className="hover:bg-zinc-50/50 transition-colors">
                  <TableCell className="px-6">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 bg-zinc-100 rounded-lg flex items-center justify-center text-zinc-600 font-bold text-xs">
                        {supplier.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="font-semibold text-zinc-900 text-sm">{supplier.name}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-xs text-zinc-600">
                        <Mail className="h-3 w-3 text-zinc-400" /> {supplier.email}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                        <Phone className="h-3 w-3 text-zinc-400" /> {supplier.phone || "N/A"}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700">
                      <Globe className="h-3 w-3 text-zinc-400" /> {supplier.country}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={cn(
                      "rounded-full px-3 text-[10px] font-bold uppercase border-none tracking-wider",
                      supplier.verification_status === "Verified"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    )}>
                      {supplier.verification_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-6">
                    <DropdownMenu>
                      <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost" }), "h-8 w-8 p-0 rounded-full")}>
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40 rounded-xl border-zinc-200 shadow-xl p-1">
                        <DropdownMenuGroup>
                          <DropdownMenuLabel className="text-[10px] font-black text-zinc-400 uppercase px-2 py-1.5">Options</DropdownMenuLabel>
                          <DropdownMenuItem className="cursor-pointer rounded-lg font-bold text-sm">
                            <Edit className="mr-2 h-4 w-4 text-zinc-400" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600 cursor-pointer rounded-lg font-bold text-sm">
                            <Trash2 className="mr-2 h-4 w-4" /> Remove
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

      {/* Onboard Supplier Modal */}
      <Dialog open={isOnboardModalOpen} onOpenChange={setIsOnboardModalOpen}>
        <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden bg-white rounded-xl shadow-2xl border border-zinc-200">
          <DialogHeader className="p-6 border-b bg-white">
            <DialogTitle className="text-xl font-bold text-zinc-900">Add New Supplier</DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500">Supplier Name *</label>
                <Input 
                  placeholder="e.g. Bosch Global" 
                  className="h-10 border-zinc-200 rounded-lg focus:ring-[#0052cc]/20" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500">Business Email *</label>
                <Input 
                  placeholder="supply@partner.com" 
                  className="h-10 border-zinc-200 rounded-lg focus:ring-[#0052cc]/20" 
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500">Contact Phone</label>
                <Input 
                  placeholder="+49 xxxxxxxx" 
                  className="h-10 border-zinc-200 rounded-lg" 
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500">Country of Origin *</label>
                <Input 
                  placeholder="e.g. Germany" 
                  className="h-10 border-zinc-200 rounded-lg" 
                  value={formData.country}
                  onChange={(e) => setFormData({...formData, country: e.target.value})}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-500">Verification Status</label>
              <select 
                className="w-full h-10 px-3 border border-zinc-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-[#0052cc]/10"
                value={formData.verification_status}
                onChange={(e) => setFormData({...formData, verification_status: e.target.value})}
              >
                <option value="Verified">Verified Partner</option>
                <option value="Unverified">Pending Verification</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-500">Main Logistics Address</label>
              <Input 
                placeholder="Full address of distribution hub" 
                className="h-10 border-zinc-200 rounded-lg" 
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter className="p-4 border-t bg-zinc-50/50 flex items-center justify-end gap-3">
            <Button variant="outline" className="h-10 rounded-lg px-6 font-bold text-sm text-zinc-600 bg-white border-zinc-200" onClick={() => setIsOnboardModalOpen(false)}>Cancel</Button>
            <Button 
              className="h-10 bg-[#0052cc] text-white hover:bg-[#0747a6] rounded-lg font-black px-8 text-[11px] tracking-widest uppercase shadow-sm" 
              onClick={handleOnboardSupplier}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              COMPLETE ONBOARDING
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
