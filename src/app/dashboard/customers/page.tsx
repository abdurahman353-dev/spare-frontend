"use client";

import { useEffect, useState, useMemo } from "react";
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
import { Search, Filter, Mail, Phone, MapPin, UserCheck, Plus, Loader2, Building2, ShieldCheck, CheckCircle2, Eye, EyeOff, MoreHorizontal, UserX, FileText, RefreshCw, Star, Pencil } from "lucide-react";
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
import { useSettings } from "@/components/providers/SettingsProvider";
import { exportCustomerStatementPDF } from "@/lib/pdf-export";

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
  const { settings } = useSettings();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Edit Customer Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Customer | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: "",
    company_name: "",
    phone: "",
    secondary_phone: "",
    tax_id: "",
    address: "",
    type: "Retail",
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    company_name: "",
    email: "",
    phone: "",
    secondary_phone: "",
    tax_id: "",
    address: "",
    type: "Retail",
    password: "",
    confirmPassword: ""
  });
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [showFormConfirmPassword, setShowFormConfirmPassword] = useState(false);

  const [errors, setErrors] = useState({
    email: "",
    phone: "",
    password: "",
    confirmPassword: ""
  });

  const fetchCustomers = () => {
    setLoading(true);
    api.get("/customers", { params: { per_page: -1 } })
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
    const newErrors = { email: "", phone: "", password: "", confirmPassword: "" };

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
      isValid = false;
    }

    // Phone validation (flexible for international/E.164 and local formats)
    const cleanedPhone = formData.phone.replace(/[\s\-\(\)]/g, "");
    const phoneRegex = /^\+?[0-9]{7,15}$/;
    if (!phoneRegex.test(cleanedPhone)) {
      newErrors.phone = "Please enter a valid phone number";
      isValid = false;
    }

    // Password is ALWAYS required for all account types
    if (!formData.password || formData.password.length < 8) {
      newErrors.password = "A password (min 8 characters) is required before saving.";
      isValid = false;
    }

    // Confirm password must match
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match.";
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
        password: "",
        confirmPassword: ""
      });
      fetchCustomers();
    } catch (err) {
      console.error("Failed to create customer:", err);
      alert("Failed to save customer. Please check if the email is unique.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenEdit = (customer: Customer) => {
    setEditTarget(customer);
    setEditFormData({
      name: customer.name || "",
      company_name: (customer as any).company_name || "",
      phone: customer.phone || "",
      secondary_phone: (customer as any).secondary_phone || "",
      tax_id: (customer as any).tax_id || "",
      address: customer.address || "",
      type: customer.type || "Retail",
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    if (!editFormData.name.trim()) return toast.error("Name is required.");

    // Optional phone validation for edited details
    if (editFormData.phone) {
      const cleanedPhone = editFormData.phone.replace(/[\s\-\(\)]/g, "");
      const phoneRegex = /^\+?[0-9]{7,15}$/;
      if (!phoneRegex.test(cleanedPhone)) {
        return toast.error("Please enter a valid phone number.");
      }
    }

    setIsSavingEdit(true);
    try {
      await api.put(`/customers/${editTarget.id}`, editFormData);
      toast.success("Customer updated successfully!");
      setIsEditModalOpen(false);
      setEditTarget(null);
      fetchCustomers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update customer.");
    } finally {
      setIsSavingEdit(false);
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

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      if ((c.name || "").toLowerCase() === "walk-in customer") {
        return false;
      }
      const sq = searchQuery.toLowerCase();

      const matchesProducts = (c as any).orders?.some((order: any) => {
        return order.items?.some((item: any) => {
          const prod = item.product;
          if (!prod) return false;
          return (
            (prod.part_number || "").toLowerCase().includes(sq) ||
            (prod.suitable_vehicle || "").toLowerCase().includes(sq) ||
            (prod.engine_model || "").toLowerCase().includes(sq) ||
            (prod.name || "").toLowerCase().includes(sq) ||
            (prod.sku || "").toLowerCase().includes(sq)
          );
        });
      });

      const matchesSearch =
        (c.name || "").toLowerCase().includes(sq) ||
        (c.email || "").toLowerCase().includes(sq) ||
        (c.phone || "").toLowerCase().includes(sq) ||
        (c.company_name || "").toLowerCase().includes(sq) ||
        matchesProducts;

      const matchesType = typeFilter === "All Types" || c.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [customers, searchQuery, typeFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, typeFilter]);

  const totalPages = Math.ceil(filteredCustomers.length / pageSize);
  const paginatedCustomers = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredCustomers.slice(startIndex, startIndex + pageSize);
  }, [filteredCustomers, currentPage, pageSize]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-zinc-500 font-semibold text-sm">Loading customers...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-3 sm:p-6">
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

      <div className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-x-auto custom-scrollbar">
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
              paginatedCustomers.map((customer) => (
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
                    <div className="flex items-start gap-1.5 text-xs text-zinc-500 max-w-[220px]">
                      <MapPin className="h-3 w-3 text-zinc-400 shrink-0 mt-0.5" />
                      <span className="break-words whitespace-normal leading-snug">{customer.address || "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={cn(
                      "font-bold text-[10px] uppercase tracking-wider px-2.5 py-0.5 border-none",
                      customer.type === "Wholesale" ? "bg-[#0052cc] text-white" :
                        customer.type === "Garage" ? "bg-amber-500 text-white" :
                          customer.type === "Retail" ? "bg-purple-100 text-purple-700" :
                            "bg-zinc-100 text-zinc-600"
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
                          <DropdownMenuItem
                            onClick={() => handleOpenEdit(customer)}
                            className="cursor-pointer rounded-lg font-bold text-sm"
                          >
                            <Pencil className="mr-2 h-4 w-4 text-[#0052cc]" /> Edit Info
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

        {/* Pagination Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-white border-t border-zinc-200">
          <div className="text-xs text-zinc-500 font-bold uppercase tracking-wider">
            Showing <span className="text-zinc-900 font-black">{filteredCustomers.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</span> to <span className="text-zinc-900 font-black">{Math.min(filteredCustomers.length, currentPage * pageSize)}</span> of <span className="text-zinc-900 font-black">{filteredCustomers.length}</span> records
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-9 px-2 border border-zinc-200 rounded-lg text-xs font-semibold bg-white outline-none text-zinc-600 focus:ring-2 focus:ring-primary/20"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
            >
              <option value={15}>Show 15</option>
              <option value={30}>Show 30</option>
              <option value={50}>Show 50</option>
              <option value={100}>Show 100</option>
            </select>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="h-9 w-9 p-0 rounded-lg font-bold border-zinc-200 text-zinc-600"
              >
                «
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="h-9 px-2.5 rounded-lg font-bold border-zinc-200 text-zinc-600 text-xs uppercase"
              >
                Prev
              </Button>

              <div className="flex items-center gap-1.5 px-2">
                <span className="text-xs text-zinc-400 font-bold uppercase">Page</span>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={currentPage || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "") {
                      setCurrentPage("" as any);
                      return;
                    }
                    const num = Number(val);
                    if (num >= 1 && num <= totalPages) {
                      setCurrentPage(num);
                    }
                  }}
                  onBlur={() => {
                    if (!currentPage || currentPage < 1) {
                      setCurrentPage(1);
                    }
                  }}
                  className="w-12 h-9 px-1 text-center border border-zinc-200 rounded-lg text-xs font-black bg-white text-zinc-800 outline-none focus:ring-2 focus:ring-primary/20"
                />
                <span className="text-xs text-zinc-400 font-bold uppercase">of {totalPages || 1}</span>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="h-9 px-2.5 rounded-lg font-bold border-zinc-200 text-zinc-600 text-xs uppercase"
              >
                Next
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages || totalPages === 0}
                className="h-9 w-9 p-0 rounded-lg font-bold border-zinc-200 text-zinc-600"
              >
                »
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Insights & History Modal */}
      <Dialog open={isHistoryModalOpen} onOpenChange={setIsHistoryModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[700px] max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white rounded-xl shadow-2xl border border-zinc-200">
          <DialogHeader className="p-6 border-b bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
            <div className="flex flex-col gap-1">
              <DialogTitle className="text-2xl font-black text-zinc-900 leading-none">{selectedCustomer?.name}</DialogTitle>
              <div className="flex flex-wrap items-center gap-3 mt-1">
                <Badge className="bg-[#0052cc] text-white font-bold text-[10px] uppercase tracking-wider">{selectedCustomer?.type}</Badge>
                <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-semibold sm:border-l sm:pl-3">
                  <Mail className="h-3 w-3" /> {selectedCustomer?.email}
                </div>
                <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-semibold sm:border-l sm:pl-3">
                  <Phone className="h-3 w-3" /> {selectedCustomer?.phone}
                </div>
              </div>
            </div>
            <div className="text-left sm:text-right shrink-0">
              <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Lifetime Value (LTV)</div>
              <div className="text-2xl sm:text-3xl font-black text-[#0052cc]">KSh {parseFloat(selectedCustomer?.orders_sum_total_amount || "0").toLocaleString()}</div>
            </div>
          </DialogHeader>
          <div className="p-6 flex-1 overflow-y-auto space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="p-5 bg-zinc-50 rounded-2xl border border-zinc-100 shadow-sm">
                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Total Purchases</div>
                <div className="text-2xl font-black text-zinc-900">{selectedCustomer?.orders_count || 0} <span className="text-xs text-zinc-400 font-bold uppercase ml-1">Orders</span></div>
              </div>
              <div className="p-5 bg-zinc-50 rounded-2xl border border-zinc-100 shadow-sm">
                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Customer Rank</div>
                <div className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                  {(() => {
                    const ltv = parseFloat(selectedCustomer?.orders_sum_total_amount || "0");
                    const platThresh = parseFloat(settings.rank_platinum_threshold || "150000");
                    const goldThresh = parseFloat(settings.rank_gold_threshold || "50000");
                    const silverThresh = parseFloat(settings.rank_silver_threshold || "10000");
                    if (ltv >= platThresh) return <><span className="text-blue-500 font-black">★</span> Platinum</>;
                    if (ltv >= goldThresh) return <><span className="text-yellow-500 font-black">★</span> Gold</>;
                    if (ltv >= silverThresh) return <><span className="text-slate-400 font-black">★</span> Silver</>;
                    return <><span className="text-amber-600 font-black">★</span> Bronze</>;
                  })()}
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
                  <ShieldCheck className="h-4 w-4 text-[#0052cc]" /> B2B Membership Rank
                </h3>
                {(() => {
                  const ltv = parseFloat(selectedCustomer?.orders_sum_total_amount || "0");
                  const platThresh = parseFloat(settings.rank_platinum_threshold || "150000");
                  const goldThresh = parseFloat(settings.rank_gold_threshold || "50000");
                  const silverThresh = parseFloat(settings.rank_silver_threshold || "10000");
                  let tierName = "Bronze", nextTierName = "Silver", nextTierThreshold = silverThresh;
                  let progressPercent = Math.min(100, Math.max(0, (ltv / silverThresh) * 100));
                  let discountText = "Standard Pricing — Level up to unlock logistics discounts";
                  let stars = 1, themeBg = "bg-amber-700", textTheme = "text-amber-800";
                  let medalColor = "#b45309", cardBorder = "border-amber-100 bg-amber-50/30";
                  if (ltv >= platThresh) {
                    tierName = "Platinum"; nextTierName = "Max Tier"; nextTierThreshold = platThresh;
                    progressPercent = 100;
                    discountText = "15% Logistics discount + Express priority dispatch enabled!";
                    stars = 4; themeBg = "bg-blue-600"; textTheme = "text-blue-700";
                    medalColor = "#0052cc"; cardBorder = "border-blue-100 bg-blue-50/30";
                  } else if (ltv >= goldThresh) {
                    tierName = "Gold"; nextTierName = "Platinum"; nextTierThreshold = platThresh;
                    progressPercent = Math.min(100, Math.max(0, ((ltv - goldThresh) / (platThresh - goldThresh)) * 100));
                    discountText = "10% Logistics discount + Priority support enabled!";
                    stars = 3; themeBg = "bg-yellow-500"; textTheme = "text-yellow-700";
                    medalColor = "#d97706"; cardBorder = "border-yellow-100 bg-yellow-50/30";
                  } else if (ltv >= silverThresh) {
                    tierName = "Silver"; nextTierName = "Gold"; nextTierThreshold = goldThresh;
                    progressPercent = Math.min(100, Math.max(0, ((ltv - silverThresh) / (goldThresh - silverThresh)) * 100));
                    discountText = "5% Logistics discount enabled!";
                    stars = 2; themeBg = "bg-slate-400"; textTheme = "text-slate-600";
                    medalColor = "#64748b"; cardBorder = "border-slate-200 bg-slate-50/30";
                  }
                  const remainingToNext = nextTierThreshold - ltv;
                  return (
                    <div className={cn("border rounded-2xl p-5 flex flex-col space-y-4 shadow-sm", cardBorder)}>
                      <div className="flex items-center gap-4">
                        <svg className="w-14 h-14 drop-shadow-md shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M7 2L10 12L12 12L9 2H7Z" fill={medalColor} opacity="0.7" />
                          <path d="M17 2L14 12L12 12L15 2H17Z" fill={medalColor} opacity="0.7" />
                          <path d="M10 2L12 10L14 2H10Z" fill={medalColor} opacity="0.9" />
                          <circle cx="12" cy="14" r="7" fill="white" stroke={medalColor} strokeWidth="2" />
                          <circle cx="12" cy="14" r="5" fill={medalColor} />
                          <path d="M12 11.5L13.1 13.7L15.5 14L13.7 15.6L14.2 18L12 16.7L9.8 18L10.3 15.6L8.5 14L10.9 13.7L12 11.5Z" fill="white" />
                        </svg>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className={cn("font-black text-base uppercase tracking-wider", textTheme)}>{tierName} Tier</span>
                            <div className="flex gap-0.5">
                              {Array.from({ length: stars }).map((_, i) => (
                                <Star key={i} className={cn("h-3.5 w-3.5 fill-current stroke-none", textTheme)} />
                              ))}
                            </div>
                          </div>
                          <p className="text-[11px] font-semibold text-zinc-500">{discountText}</p>
                        </div>
                      </div>
                      <div className="space-y-1.5 pt-2 border-t border-dashed border-zinc-200">
                        <div className="flex justify-between items-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                          <span>LTV Tier Progress</span>
                          {nextTierName === "Max Tier" ? (
                            <span className="text-blue-600 font-extrabold">MAX PLATINUM REACHED ✓</span>
                          ) : (
                            <span>{Math.round(progressPercent)}% to {nextTierName}</span>
                          )}
                        </div>
                        <div className="w-full h-2 bg-zinc-200/60 rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full transition-all duration-700", themeBg)} style={{ width: `${progressPercent}%` }} />
                        </div>
                        {nextTierName !== "Max Tier" && (
                          <p className="text-[10px] text-zinc-400 font-semibold">
                            KSh {remainingToNext.toLocaleString()} more to reach {nextTierName} (KSh {nextTierThreshold.toLocaleString()})
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                  <Plus className="h-4 w-4 text-[#0052cc]" /> Precision Order History
                  <button
                    onClick={() => handleViewHistory(selectedCustomer!)}
                    className="p-1 hover:bg-zinc-100 rounded-full transition-colors text-zinc-400 hover:text-zinc-700"
                    title="Sync History"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </h3>
                <Button
                  onClick={() => {
                    if (selectedCustomer) {
                      exportCustomerStatementPDF(selectedCustomer, {
                        storeName: settings?.store_name,
                        storeTagline: settings?.store_tagline,
                        storeLogo: settings?.store_logo,
                        physicalAddress: settings?.store_address || settings?.physical_address,
                        contactEmail: settings?.store_email || settings?.contact_email,
                        contactPhone: settings?.store_phone || settings?.contact_phone,
                        currency: "Ksh",
                        storeWebsite: settings?.store_website,
                        storeKraPin: settings?.store_kra_pin,
                        storeRegNumber: settings?.store_reg_number
                      });
                    }
                  }}
                  className="h-8 bg-[#0052cc] hover:bg-[#0747a6] text-white text-xs font-bold gap-1.5 rounded-lg shadow-sm w-full sm:w-auto"
                >
                  <FileText className="h-3.5 w-3.5" /> Export B2B Statement
                </Button>
              </div>
              <div className="border rounded-2xl overflow-x-auto custom-scrollbar shadow-sm">
                <Table className="min-w-[700px]">
                  <TableHeader className="bg-zinc-50/50 border-b">
                    <TableRow>
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest px-4 h-12">Reference</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest h-12">Date</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest h-12">Items</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest h-12">Route</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest h-12">Payment</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest h-12 text-right">Shipping Fee</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest h-12 text-right">Total</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest h-12 text-center px-4">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(selectedCustomer as any)?.orders?.length > 0 ? (
                      (selectedCustomer as any).orders.map((order: any) => (
                        <TableRow key={order.id} className="hover:bg-zinc-50/30 transition-colors text-xs">
                          <TableCell className="px-4 py-3">
                            <span className="bg-zinc-100 text-zinc-800 px-2 py-0.5 rounded font-black text-[11px] border border-zinc-200">
                              {order.tracking_number}
                            </span>
                          </TableCell>
                          <TableCell className="text-zinc-500 font-medium">
                            {new Date(order.created_at).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </TableCell>
                          <TableCell className="max-w-[140px] truncate text-zinc-700 font-semibold"
                            title={order.items?.map((i: any) => `${i.product?.name || 'Part'} (${i.quantity})`).join(', ')}>
                            {order.items?.map((i: any) => `${i.product?.name || 'Part'} (${i.quantity})`).join(', ') || '—'}
                          </TableCell>
                          <TableCell>
                            {order.shipping_method === "Pickup" ? (
                              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">In-Store POS</span>
                            ) : (
                              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                                {order.items?.[0]?.warehouse?.name?.split(' ')?.shift() || 'WH'} → {order.shipping_city || 'Dest'}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-0.5">
                              <p className="font-bold text-zinc-800">{order.payment_method || 'Cash'}</p>
                              {order.payment_ref_code && <p className="text-[9px] text-zinc-400 font-bold">Ref: {order.payment_ref_code}</p>}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium text-zinc-500">
                            KSh {parseFloat(order.shipping_fee || 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="font-black text-zinc-900 text-right">
                            KSh {parseFloat(order.total_amount || 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-center px-4 py-3">
                            <Badge className={cn(
                              "text-[9px] font-black uppercase px-2 py-0.5 rounded-full border-none",
                              order.status === "Delivered" ? "bg-emerald-100 text-emerald-700" :
                                order.status === "Shipped" || order.status === "In Transit" ? "bg-blue-100 text-blue-700" :
                                  order.status === "Processing" ? "bg-purple-100 text-purple-700" :
                                    order.status === "Pending" ? "bg-amber-100 text-amber-700" :
                                      order.status === "Cancelled" ? "bg-red-100 text-red-700" :
                                        "bg-zinc-100 text-zinc-600"
                            )}>
                              {order.status === "In Transit" ? "SHIPPED" : order.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="h-32 text-center text-zinc-400 font-medium">No order transactions recorded.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
          <DialogFooter className="p-4 border-t bg-white m-0 shrink-0">
            <Button variant="outline" className="w-full h-10 border-zinc-200 text-zinc-700 hover:bg-zinc-50 font-bold text-sm rounded-lg" onClick={() => setIsHistoryModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Customer Modal — only editable fields */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[560px] p-0 overflow-hidden bg-white rounded-xl shadow-2xl border border-zinc-200">
          <DialogHeader className="p-6 border-b bg-white">
            <DialogTitle className="text-xl font-bold text-zinc-900">Edit Customer Info</DialogTitle>
            <DialogDescription className="text-xs text-zinc-400 mt-1">
              Only editable fields are shown. Email and password cannot be changed here.
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500">Contact Name *</label>
                <Input
                  placeholder="e.g. John Doe"
                  className="h-10 border-zinc-200 rounded-lg"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500">Company Name</label>
                <Input
                  placeholder="e.g. Auto Shop LLC"
                  className="h-10 border-zinc-200 rounded-lg"
                  value={editFormData.company_name}
                  onChange={(e) => setEditFormData({ ...editFormData, company_name: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500">Phone Number</label>
                <Input
                  placeholder="07xxxxxxxx"
                  className="h-10 border-zinc-200 rounded-lg"
                  value={editFormData.phone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    if (val.length <= 10) setEditFormData({ ...editFormData, phone: val });
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500">Tax ID / PIN</label>
                <Input
                  placeholder="e.g. P000000000Z"
                  className="h-10 border-zinc-200 rounded-lg"
                  value={editFormData.tax_id}
                  onChange={(e) => setEditFormData({ ...editFormData, tax_id: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-500">Customer Type</label>
              <select
                className="w-full h-10 px-3 border border-zinc-200 rounded-lg text-sm bg-white outline-none"
                value={editFormData.type}
                onChange={(e) => setEditFormData({ ...editFormData, type: e.target.value })}
              >
                <option value="Retail">Retail</option>
                <option value="Wholesale">Wholesale</option>
                <option value="Garage">Garage</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-500">Main Delivery Address</label>
              <textarea
                placeholder="Full street address, city, country..."
                rows={3}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-[#0052cc]/20 resize-none"
                value={editFormData.address}
                onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
              />
            </div>
            <div className="p-3 bg-zinc-50 border border-zinc-100 rounded-lg">
              <p className="text-[11px] font-semibold text-zinc-400">
                <span className="text-zinc-600 font-bold">Email:</span> {editTarget?.email}
                <span className="ml-4 text-zinc-300">|</span>
                <span className="ml-4 italic">Email and password can only be changed by the customer from their account.</span>
              </p>
            </div>
          </div>
          <DialogFooter className="p-4 border-t bg-zinc-50/50 flex items-center justify-end gap-3 m-0">
            <Button variant="outline" className="h-10 rounded-lg px-6 font-bold text-sm text-zinc-600 bg-white border-zinc-200" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
            <Button
              className="h-10 bg-[#0052cc] text-white hover:bg-[#0747a6] rounded-lg font-black px-8 text-[11px] tracking-widest uppercase shadow-sm"
              onClick={handleSaveEdit}
              disabled={isSavingEdit || !editFormData.name.trim()}
            >
              {isSavingEdit ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              SAVE CHANGES
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Customer Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[600px] p-0 overflow-hidden bg-white rounded-xl shadow-2xl border border-zinc-200">
          <DialogHeader className="p-6 border-b bg-white">
            <DialogTitle className="text-xl font-bold text-zinc-900">Add New Customer</DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-6 max-h-[65vh] overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500">Contact Name *</label>
                <Input
                  placeholder="e.g. John Doe"
                  className="h-10 border-zinc-200 rounded-lg"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500">Company Name</label>
                <Input
                  placeholder="e.g. Auto Shop LLC"
                  className="h-10 border-zinc-200 rounded-lg"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500">Email Address *</label>
                <Input
                  placeholder="john@gmail.com"
                  className={cn("h-10 border-zinc-200 rounded-lg", errors.email && "border-red-500")}
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    if (errors.email) setErrors({ ...errors, email: "" });
                  }}
                />
                {errors.email && <p className="text-[10px] text-red-500 font-bold italic">{errors.email}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500">Customer Type</label>
                <select
                  className="w-full h-10 px-3 border border-zinc-200 rounded-lg text-sm bg-white outline-none"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                >
                  <option value="Retail">Retail</option>
                  <option value="Wholesale">Wholesale</option>
                  <option value="Garage">Garage</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500">Phone Number *</label>
                <Input
                  placeholder="07xxxxxxxx"
                  className={cn("h-10 border-zinc-200 rounded-lg", errors.phone && "border-red-500")}
                  value={formData.phone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    if (val.length <= 10) {
                      setFormData({ ...formData, phone: val });
                      if (errors.phone) setErrors({ ...errors, phone: "" });
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
                  onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-500">Main Delivery Address</label>
              <Input
                placeholder="Full street address"
                className="h-10 border-zinc-200 rounded-lg"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
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
                        setFormData({ ...formData, password: e.target.value });
                        if (errors.password) setErrors({ ...errors, password: "" });
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
                <div className="space-y-1.5">
                  <label className={cn("text-xs font-semibold", "text-[#0052cc]")}>Confirm Account Password *</label>
                  <div className="relative">
                    <Input
                      type={showFormConfirmPassword ? "text" : "password"}
                      placeholder="Re-enter password"
                      className={cn("h-10 border-zinc-200 rounded-lg bg-white pr-10", errors.confirmPassword && "border-red-500 ring-1 ring-red-500")}
                      value={formData.confirmPassword}
                      onChange={(e) => {
                        setFormData({ ...formData, confirmPassword: e.target.value });
                        if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: "" });
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowFormConfirmPassword(!showFormConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-[#0052cc] transition-colors"
                    >
                      {showFormConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.confirmPassword && <p className="text-[10px] text-red-500 font-bold italic">{errors.confirmPassword}</p>}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="p-4 border-t bg-zinc-50/50 flex items-center justify-end gap-3 m-0">
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
