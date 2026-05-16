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
import { Search, Filter, Mail, Phone, MapPin, UserCheck, Plus, Loader2, Building2, ShieldCheck, CheckCircle2, Eye, EyeOff, MoreHorizontal, UserX } from "lucide-react";
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
import toast from "react-hot-toast";

interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  type: string;
  created_at: string;
  company_name?: string;
  tax_id?: string;
  orders_count?: number;
  orders_sum_total_amount?: string;
  user?: { id: number; is_active: boolean };
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    company_name: "",
    email: "",
    phone: "",
    secondary_phone: "",
    tax_id: "",
    address: "",
    type: "Retail",
    password: ""
  });
  const [showFormPassword, setShowFormPassword] = useState(false);

  const [errors, setErrors] = useState({
    email: "",
    phone: "",
    password: ""
  });

  const fetchCustomers = () => {
    setLoading(true);
    api.get("/customers")
      .then((res) => {
        setCustomers(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch customers:", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const validateForm = () => {
    let isValid = true;
    const newErrors = { email: "", phone: "", password: "" };

    // Email validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
    if (!emailRegex.test(formData.email)) {
      newErrors.email = "Email must be a valid @gmail.com address";
      isValid = false;
    }

    // Phone validation
    const phoneRegex = /^(07|01)\d{8}$/;
    if (!phoneRegex.test(formData.phone)) {
      newErrors.phone = "Phone must be 10 digits starting with 07 or 01";
      isValid = false;
    }

    // Password is ALWAYS required for all account types
    if (!formData.password || formData.password.length < 8) {
      newErrors.password = "A password (min 8 characters) is required before saving.";
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleViewHistory = (customer: Customer) => {
    setLoading(true);
    api.get(`/customers/${customer.id}`)
      .then(res => {
        setSelectedCustomer(res.data);
        setIsHistoryModalOpen(true);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch customer history:", err);
        setLoading(false);
      });
  };

  const handleSaveCustomer = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      await api.post("/customers", formData);
      setIsCreateModalOpen(false);
      setFormData({ 
        name: "", 
        company_name: "", 
        email: "", 
        phone: "", 
        secondary_phone: "",
        tax_id: "",
        address: "", 
        type: "Retail",
        password: ""
      });
      fetchCustomers();
    } catch (err) {
      console.error("Failed to create customer:", err);
      alert("Failed to save customer. Please check if the email is unique.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (customer: Customer) => {
    try {
      const res = await api.patch(`/customers/${customer.id}/toggle-status`);
      toast.success(res.data.message);
      fetchCustomers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update status.");
    }
  };

  const filteredCustomers = customers.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "All Types" || c.type === typeFilter;
    return matchesSearch && matchesType;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-zinc-500 font-semibold text-sm">Loading customers...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Customers</h1>
          <p className="text-zinc-500 text-sm mt-1">Manage your B2B clients and registered customers.</p>
        </div>
        <Button className="bg-primary text-white hover:bg-primary/90 rounded-lg shadow-sm font-bold" onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Customer
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input 
            placeholder="Search by name or email..." 
            className="pl-10 h-10 border-zinc-200 rounded-lg bg-white"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <select 
            className="h-10 pl-3 pr-8 border border-zinc-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-primary/20"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="All Types">All Types</option>
            <option value="Retail">Retail</option>
            <option value="Wholesale">Wholesale</option>
          </select>
          <Button variant="outline" className="h-10 rounded-lg px-4 border-zinc-200">
            <Filter className="mr-2 h-4 w-4 text-zinc-500" /> Filters
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden">
        <Table>
          <TableHeader className="bg-zinc-50/50">
            <TableRow>
              <TableHead className="px-6 font-semibold text-zinc-900">Client Name</TableHead>
              <TableHead className="font-semibold text-zinc-900">Contact Information</TableHead>
              <TableHead className="font-semibold text-zinc-900">Main Delivery Address</TableHead>
              <TableHead className="font-semibold text-zinc-900">Account Type</TableHead>
              <TableHead className="font-semibold text-zinc-900 text-center">Status</TableHead>
              <TableHead className="px-6 w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCustomers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-48 text-center text-zinc-500">
                  No customers identified.
                </TableCell>
              </TableRow>
            ) : (
              filteredCustomers.map((customer) => (
                <TableRow key={customer.id} className="hover:bg-zinc-50/50 transition-colors">
                  <TableCell className="px-6">
                    <div className="flex items-center gap-3">
                      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs", customer.user?.is_active === false ? "bg-zinc-100 text-zinc-400" : "bg-blue-50 text-[#0052cc]")}>
                        {customer.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-zinc-900 text-sm">{customer.name}</div>
                        <div className="text-[10px] text-zinc-400 uppercase font-bold tracking-tighter">ID: #{customer.id}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-xs text-zinc-600">
                        <Mail className="h-3 w-3 text-zinc-400" /> {customer.email}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                        <Phone className="h-3 w-3 text-zinc-400" /> {customer.phone || "N/A"}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500 max-w-[160px] truncate">
                      <MapPin className="h-3 w-3 text-zinc-400 shrink-0" /> {customer.address || "—"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={cn(
                      "font-bold text-[10px] uppercase tracking-wider px-2.5 py-0.5 border-none",
                      customer.type === "Wholesale" ? "bg-[#0052cc] text-white" :
                      customer.type === "Garage" ? "bg-amber-500 text-white" : "bg-zinc-100 text-zinc-700"
                    )}>
                      {customer.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={cn(
                      "rounded-full px-3 text-[10px] font-bold uppercase border-none tracking-wider",
                      customer.user?.is_active === false
                        ? "bg-red-100 text-red-600"
                        : "bg-emerald-100 text-emerald-700"
                    )}>
                      {customer.user?.is_active === false ? "Inactive" : "Active"}
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
                          <DropdownMenuItem
                            onClick={() => handleViewHistory(customer)}
                            className="cursor-pointer rounded-lg font-bold text-sm"
                          >
                            <Eye className="mr-2 h-4 w-4 text-zinc-400" /> View Insights
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {customer.user ? (
                            <DropdownMenuItem
                              onClick={() => handleToggleStatus(customer)}
                              className={cn(
                                "cursor-pointer rounded-lg font-bold text-sm",
                                customer.user.is_active ? "text-red-600 hover:text-red-700" : "text-emerald-600 hover:text-emerald-700"
                              )}
                            >
                              {customer.user.is_active
                                ? <><UserX className="mr-2 h-4 w-4" /> Deactivate</>
                                : <><UserCheck className="mr-2 h-4 w-4" /> Activate</>
                              }
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem disabled className="cursor-not-allowed rounded-lg font-bold text-sm text-zinc-300">
                              <UserX className="mr-2 h-4 w-4" /> No login account
                            </DropdownMenuItem>
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
      </div>

      {/* Customer Insights & History Modal */}
      <Dialog open={isHistoryModalOpen} onOpenChange={setIsHistoryModalOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden bg-white rounded-xl shadow-2xl border border-zinc-200">
          <DialogHeader className="p-6 border-b bg-white flex flex-row items-center justify-between">
            <div className="flex flex-col gap-1">
              <DialogTitle className="text-2xl font-black text-zinc-900 leading-none">{selectedCustomer?.name}</DialogTitle>
              <div className="flex items-center gap-3 mt-1">
                <Badge className="bg-[#0052cc] text-white font-bold text-[10px] uppercase tracking-wider">{selectedCustomer?.type}</Badge>
                <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-semibold border-l pl-3">
                  <Mail className="h-3 w-3" /> {selectedCustomer?.email}
                </div>
                <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-semibold border-l pl-3">
                  <Phone className="h-3 w-3" /> {selectedCustomer?.phone}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Lifetime Value (LTV)</div>
              <div className="text-3xl font-black text-[#0052cc]">KSh {parseFloat(selectedCustomer?.orders_sum_total_amount || "0").toLocaleString()}</div>
            </div>
          </DialogHeader>
          <div className="p-6 max-h-[70vh] overflow-y-auto space-y-8">
             <div className="grid grid-cols-3 gap-6">
               <div className="p-5 bg-zinc-50 rounded-2xl border border-zinc-100 shadow-sm">
                 <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Total Purchases</div>
                 <div className="text-2xl font-black text-zinc-900">{selectedCustomer?.orders_count || 0} <span className="text-xs text-zinc-400 font-bold uppercase ml-1">Orders</span></div>
               </div>
               <div className="p-5 bg-zinc-50 rounded-2xl border border-zinc-100 shadow-sm">
                 <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Primary Node</div>
                 <div className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                   <MapPin className="h-4 w-4 text-[#0052cc]" /> Nairobi, KE
                 </div>
               </div>
               <div className="p-5 bg-zinc-50 rounded-2xl border border-zinc-100 shadow-sm">
                 <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Member Since</div>
                 <div className="text-lg font-bold text-zinc-900">{selectedCustomer && new Date(selectedCustomer.created_at).toLocaleDateString('en-KE', { month: 'short', year: 'numeric', day: 'numeric' })}</div>
               </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="space-y-4">
                 <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                   <Building2 className="h-4 w-4 text-[#0052cc]" /> Shipping Profile
                 </h3>
                 <div className="bg-white border rounded-2xl p-5 space-y-3 shadow-sm">
                   <div className="flex justify-between items-center border-b pb-2">
                     <span className="text-xs font-bold text-zinc-400">Company</span>
                     <span className="text-sm font-bold text-zinc-900">{selectedCustomer?.company_name || "N/A"}</span>
                   </div>
                   <div className="flex justify-between items-center border-b pb-2">
                     <span className="text-xs font-bold text-zinc-400">Tax ID / PIN</span>
                     <span className="text-sm font-bold text-zinc-900">{selectedCustomer?.tax_id || "N/A"}</span>
                   </div>
                   <div className="flex flex-col gap-1">
                     <span className="text-xs font-bold text-zinc-400 uppercase tracking-tighter">Registered Address</span>
                     <span className="text-sm font-semibold text-zinc-600 italic">"{selectedCustomer?.address || "No address on file"}"</span>
                   </div>
                 </div>
               </div>

               <div className="space-y-4">
                 <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                   <ShieldCheck className="h-4 w-4 text-[#0052cc]" /> Account Status
                 </h3>
                 <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-emerald-200">
                        <CheckCircle2 className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-emerald-900">Verified Partner</div>
                        <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Active since 2026</div>
                      </div>
                    </div>
                    <Badge className="bg-emerald-500 text-white font-black uppercase text-[9px] tracking-tighter">WHITELISTED</Badge>
                 </div>
               </div>
             </div>

             <div className="space-y-4">
               <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                 <Plus className="h-4 w-4 text-[#0052cc]" /> Precision Order History
               </h3>
               <div className="border rounded-2xl overflow-hidden shadow-sm">
                 <Table>
                   <TableHeader className="bg-zinc-50/50 border-b">
                     <TableRow>
                       <TableHead className="font-bold text-[10px] uppercase tracking-widest px-6 h-12">Order ID</TableHead>
                       <TableHead className="font-bold text-[10px] uppercase tracking-widest h-12">Date</TableHead>
                       <TableHead className="font-bold text-[10px] uppercase tracking-widest h-12 text-center">Payment</TableHead>
                       <TableHead className="font-bold text-[10px] uppercase tracking-widest h-12">Amount</TableHead>
                       <TableHead className="font-bold text-[10px] uppercase tracking-widest h-12 text-right px-6">Status</TableHead>
                     </TableRow>
                   </TableHeader>
                   <TableBody>
                     {(selectedCustomer as any)?.orders?.length > 0 ? (
                       (selectedCustomer as any).orders.map((order: any) => (
                         <TableRow key={order.id} className="hover:bg-zinc-50/30 transition-colors">
                           <TableCell className="font-black text-zinc-900 px-6 py-4 text-sm">#ORD-{order.id}</TableCell>
                           <TableCell className="text-zinc-500 text-xs font-medium">{new Date(order.created_at).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' })}</TableCell>
                           <TableCell className="text-center py-4">
                              <Badge className={cn(
                                "text-[9px] font-black uppercase px-2 py-0.5 rounded",
                                order.payment_status === "Paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                              )}>
                                {order.payment_status || "UNPAID"}
                              </Badge>
                           </TableCell>
                           <TableCell className="font-black text-zinc-900 text-sm">KSh {parseFloat(order.total_amount).toLocaleString()}</TableCell>
                           <TableCell className="text-right px-6 py-4">
                             <Badge className={cn(
                                "text-[10px] font-black uppercase px-3 py-1 rounded-full",
                                order.status === "Delivered" ? "bg-emerald-100 text-emerald-700" : 
                                order.status === "Shipped" ? "bg-blue-100 text-blue-700" : 
                                order.status === "Processing" ? "bg-purple-100 text-purple-700" :
                                order.status === "Pending" ? "bg-amber-100 text-amber-700" :
                                order.status === "Cancelled" ? "bg-red-100 text-red-700" :
                                "bg-zinc-100 text-zinc-600"
                              )}>
                               {order.status}
                             </Badge>
                           </TableCell>
                         </TableRow>
                       ))
                     ) : (
                       <TableRow>
                         <TableCell colSpan={5} className="h-32 text-center text-zinc-400 font-medium">No order transactions recorded.</TableCell>
                       </TableRow>
                     )}
                   </TableBody>
                 </Table>
               </div>
             </div>
          </div>
          <DialogFooter className="p-4 border-t bg-white">
            <Button variant="outline" className="w-full h-10 border-zinc-200 text-zinc-700 hover:bg-zinc-50 font-bold text-sm rounded-lg" onClick={() => setIsHistoryModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Customer Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden bg-white rounded-xl shadow-2xl border border-zinc-200">
          <DialogHeader className="p-6 border-b bg-white">
            <DialogTitle className="text-xl font-bold text-zinc-900">Add New Customer</DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500">Contact Name *</label>
                <Input 
                  placeholder="e.g. John Doe" 
                  className="h-10 border-zinc-200 rounded-lg" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500">Company Name</label>
                <Input 
                  placeholder="e.g. Auto Shop LLC" 
                  className="h-10 border-zinc-200 rounded-lg" 
                  value={formData.company_name}
                  onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500">Email Address *</label>
                <Input 
                  placeholder="john@gmail.com" 
                  className={cn("h-10 border-zinc-200 rounded-lg", errors.email && "border-red-500")} 
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({...formData, email: e.target.value});
                    if (errors.email) setErrors({...errors, email: ""});
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500">Customer Type</label>
                <select 
                  className="w-full h-10 px-3 border border-zinc-200 rounded-lg text-sm bg-white outline-none"
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value})}
                >
                  <option value="Retail">Retail</option>
                  <option value="Wholesale">Wholesale</option>
                  <option value="Garage">Garage</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500">Phone Number *</label>
                <Input 
                  placeholder="07xxxxxxxx" 
                  className={cn("h-10 border-zinc-200 rounded-lg", errors.phone && "border-red-500")} 
                  value={formData.phone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    if (val.length <= 10) {
                      setFormData({...formData, phone: val});
                      if (errors.phone) setErrors({...errors, phone: ""});
                    }
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500">Tax ID / PIN</label>
                <Input 
                  placeholder="e.g. P000000000Z" 
                  className="h-10 border-zinc-200 rounded-lg" 
                  value={formData.tax_id}
                  onChange={(e) => setFormData({...formData, tax_id: e.target.value})}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-500">Main Delivery Address</label>
              <Input 
                placeholder="Full street address" 
                className="h-10 border-zinc-200 rounded-lg" 
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
              />
            </div>

            {/* Login Setup Section */}
            <div className="pt-4 border-t space-y-4">
               <h3 className="text-xs font-bold text-[#0052cc] uppercase tracking-widest flex items-center gap-2">
                 <ShieldCheck className="h-4 w-4" /> Credentials Setup
               </h3>
               <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl space-y-3">
               <p className="text-[11px] text-blue-700 font-medium leading-relaxed">
                    You must set an initial login password for this customer. They will be required to change it on first login for their security.
                  </p>
                  <div className="space-y-1.5">
                     <label className={cn("text-xs font-semibold", "text-[#0052cc]")}>Assign Account Password *</label>
                     <div className="relative">
                       <Input 
                         type={showFormPassword ? "text" : "password"}
                         placeholder="Minimum 8 characters" 
                         className={cn("h-10 border-zinc-200 rounded-lg bg-white pr-10", errors.password && "border-red-500 ring-1 ring-red-500")} 
                         value={formData.password}
                         onChange={(e) => {
                           setFormData({...formData, password: e.target.value});
                           if (errors.password) setErrors({...errors, password: ""});
                         }}
                       />
                       <button
                         type="button"
                         onClick={() => setShowFormPassword(!showFormPassword)}
                         className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-[#0052cc] transition-colors"
                       >
                         {showFormPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                       </button>
                     </div>
                     {errors.password && <p className="text-[10px] text-red-500 font-bold italic">{errors.password}</p>}
                  </div>
               </div>
            </div>
          </div>
          <DialogFooter className="p-4 border-t bg-zinc-50/50 flex items-center justify-end gap-3">
            <Button variant="outline" className="h-10 rounded-lg px-6 font-bold text-sm text-zinc-600 bg-white border-zinc-200" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
            <Button 
              className="h-10 bg-[#0052cc] text-white hover:bg-[#0747a6] rounded-lg font-black px-8 text-[11px] tracking-widest uppercase shadow-sm" 
              onClick={handleSaveCustomer}
              disabled={isSaving || !formData.name || !formData.email}
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              SAVE CUSTOMER
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
