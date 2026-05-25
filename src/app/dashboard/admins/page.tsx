"use client";

import { useEffect, useState, useMemo } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PaginationControls } from "@/components/ui/pagination-controls";
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
  Plus, 
  Loader2, 
  Shield, 
  UserCheck, 
  Lock, 
  Globe, 
  Mail, 
  Phone, 
  MapPin, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  Activity, 
  Smartphone,
  Info,
  Pencil
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import api from "@/lib/axios";
import { cn } from "@/lib/utils";
import { toast } from "react-hot-toast";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  phone: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  created_at: string;
}

interface AuditLog {
  id: number;
  user_id: number | null;
  action: string;
  description: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  user: User | null;
}

export default function AdminsAndAuditsPage() {
  const [activeTab, setActiveTab] = useState<"admins" | "audits">("admins");
  
  // Data State
  const [admins, setAdmins] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  
  // Loading State
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [loadingAudits, setLoadingAudits] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTogglingId, setIsTogglingId] = useState<number | null>(null);

  // Search & Filtering State
  const [adminSearch, setAdminSearch] = useState("");
  const [auditSearch, setAuditSearch] = useState("");
  
  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    password_confirmation: "",
    role: "admin",
    phone: "",
    country: "",
    city: "",
    address: ""
  });

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedAdminId, setSelectedAdminId] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: "",
    email: "",
    role: "admin",
    phone: "",
    country: "",
    city: "",
    address: ""
  });

  const handleOpenEditModal = (admin: User) => {
    setSelectedAdminId(admin.id);
    setEditFormData({
      name: admin.name || "",
      email: admin.email || "",
      role: admin.role || "admin",
      phone: admin.phone || "",
      country: admin.country || "",
      city: admin.city || "",
      address: admin.address || ""
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFormData.name || !editFormData.email) {
      toast.error("Please fill in all required fields.");
      return;
    }

    // Gmail format validation
    const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
    if (!gmailRegex.test(editFormData.email)) {
      toast.error("Admin email must be a valid Gmail address (e.g. name@gmail.com).");
      return;
    }

    // Strict Kenyan phone format validation (requiring +254 prefix and 9 digits starting with 7 or 1)
    if (editFormData.phone) {
      const phoneRegex = /^\+254\s?[71]\d{8}$/;
      if (!phoneRegex.test(editFormData.phone)) {
        toast.error("Phone number must be in the format: +254 7XXXXXXXX or +254 1XXXXXXXX.");
        return;
      }
    }

    setIsSaving(true);
    try {
      await api.put(`/admins/${selectedAdminId}`, editFormData);
      toast.success("Administrator details updated successfully!");
      setIsEditModalOpen(false);
      fetchAdmins();
      fetchAuditLogs();
    } catch (err: any) {
      console.error("Failed to update admin:", err);
      toast.error(err.response?.data?.message || "Failed to update administrator.");
    } finally {
      setIsSaving(false);
    }
  };

  const fetchAdmins = async () => {
    setLoadingAdmins(true);
    try {
      const res = await api.get("/admins");
      setAdmins(res.data);
    } catch (err: any) {
      console.error("Failed to fetch admins:", err);
      toast.error(err.response?.data?.message || "Failed to load administrators.");
    } finally {
      setLoadingAdmins(false);
    }
  };

  const fetchAuditLogs = async () => {
    setLoadingAudits(true);
    try {
      const res = await api.get("/admins/logs");
      setAuditLogs(res.data);
    } catch (err: any) {
      console.error("Failed to fetch audit logs:", err);
      toast.error(err.response?.data?.message || "Failed to load audit logs.");
    } finally {
      setLoadingAudits(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
    fetchAuditLogs();
  }, []);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.password || !formData.password_confirmation) {
      toast.error("Please fill in all required fields.");
      return;
    }

    // Gmail format validation
    const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
    if (!gmailRegex.test(formData.email)) {
      toast.error("Admin email must be a valid Gmail address (e.g. name@gmail.com).");
      return;
    }

    if (formData.password !== formData.password_confirmation) {
      toast.error("Passwords do not match.");
      return;
    }

    if (formData.password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }

    // Strict Kenyan phone format validation (requiring +254 prefix and 9 digits starting with 7 or 1)
    if (formData.phone) {
      const phoneRegex = /^\+254\s?[71]\d{8}$/;
      if (!phoneRegex.test(formData.phone)) {
        toast.error("Phone number must be in the format: +254 7XXXXXXXX or +254 1XXXXXXXX.");
        return;
      }
    }

    setIsSaving(true);
    try {
      await api.post("/admins", formData);
      toast.success("Administrator successfully created! Force password change pending.");
      setIsCreateModalOpen(false);
      setFormData({
        name: "",
        email: "",
        password: "",
        password_confirmation: "",
        role: "admin",
        phone: "",
        country: "",
        city: "",
        address: ""
      });
      setShowPassword(false);
      setShowConfirmPassword(false);
      // Reload both lists
      fetchAdmins();
      fetchAuditLogs();
    } catch (err: any) {
      console.error("Failed to create admin:", err);
      toast.error(err.response?.data?.message || "Failed to create administrator. Email may already be in use.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (id: number) => {
    setIsTogglingId(id);
    try {
      const res = await api.patch(`/admins/${id}/toggle-status`);
      toast.success(res.data.message || "Status updated successfully.");
      fetchAdmins();
      fetchAuditLogs();
    } catch (err: any) {
      console.error("Failed to toggle admin status:", err);
      toast.error(err.response?.data?.message || "Failed to change administrator status.");
    } finally {
      setIsTogglingId(null);
    }
  };

  const filteredAdmins = useMemo(() => {
    return admins.filter(admin => 
      admin.name.toLowerCase().includes(adminSearch.toLowerCase()) ||
      admin.email.toLowerCase().includes(adminSearch.toLowerCase()) ||
      (admin.phone && admin.phone.includes(adminSearch)) ||
      (admin.city && admin.city.toLowerCase().includes(adminSearch.toLowerCase()))
    );
  }, [admins, adminSearch]);

  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter(log => 
      log.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.description.toLowerCase().includes(auditSearch.toLowerCase()) ||
      (log.user && log.user.name.toLowerCase().includes(auditSearch.toLowerCase())) ||
      (log.user && log.user.email.toLowerCase().includes(auditSearch.toLowerCase()))
    );
  }, [auditLogs, auditSearch]);

  // Pagination
  const [adminPage, setAdminPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);
  const PAGE_SIZE = 15;

  const paginatedAdmins = useMemo(() => {
    const start = (adminPage - 1) * PAGE_SIZE;
    return filteredAdmins.slice(start, start + PAGE_SIZE);
  }, [filteredAdmins, adminPage]);

  const paginatedAuditLogs = useMemo(() => {
    const start = (auditPage - 1) * PAGE_SIZE;
    return filteredAuditLogs.slice(start, start + PAGE_SIZE);
  }, [filteredAuditLogs, auditPage]);

  // Reset pagination when search changes
  useMemo(() => { setAdminPage(1); }, [adminSearch]);
  useMemo(() => { setAuditPage(1); }, [auditSearch]);

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case "LOGIN":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "LOGOUT":
        return "bg-zinc-100 text-zinc-700 border-zinc-200";
      case "CREATE_ADMIN":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "TOGGLE_ADMIN_STATUS":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "CHANGE_PASSWORD":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
      case "SHIPMENT_CREATED":
        return "bg-sky-50 text-sky-700 border-sky-200";
      case "SHIPMENT_DISPATCHED":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "SHIPMENT_DELIVERED":
        return "bg-teal-50 text-teal-700 border-teal-200";
      default:
        return "bg-zinc-100 text-zinc-700 border-zinc-200";
    }
  };

  return (
    <div className="space-y-6 p-6 font-sans">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
            <Shield className="h-6 w-6 text-[#0052cc]" />
            Admins & Audit Logs
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            Manage administrator accounts, control access privileges, and review system audit history.
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === "admins" && (
            <Button 
              className="bg-primary text-white hover:bg-primary/90 rounded-lg shadow-sm font-bold"
              onClick={() => setIsCreateModalOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" /> Create Administrator
            </Button>
          )}
          <Button
            variant="outline"
            className="rounded-lg h-10 border-zinc-200"
            onClick={activeTab === "admins" ? fetchAdmins : fetchAuditLogs}
          >
            <RefreshCw className="h-4 w-4 text-zinc-500" />
          </Button>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="flex border-b border-zinc-200">
        <button
          onClick={() => setActiveTab("admins")}
          className={cn(
            "py-2.5 px-6 font-semibold text-sm border-b-2 transition-all -mb-px flex items-center gap-2",
            activeTab === "admins"
              ? "border-primary text-primary"
              : "border-transparent text-zinc-500 hover:text-zinc-800"
          )}
        >
          <UserCheck className="h-4 w-4" />
          Administrators
        </button>
        <button
          onClick={() => setActiveTab("audits")}
          className={cn(
            "py-2.5 px-6 font-semibold text-sm border-b-2 transition-all -mb-px flex items-center gap-2",
            activeTab === "audits"
              ? "border-primary text-primary"
              : "border-transparent text-zinc-500 hover:text-zinc-800"
          )}
        >
          <Activity className="h-4 w-4" />
          Audit Logs
        </button>
      </div>

      {/* TAB CONTENTS: ADMINS */}
      {activeTab === "admins" && (
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="relative max-w-md bg-white rounded-lg shadow-sm border border-zinc-100 p-1.5 flex items-center">
            <Search className="h-4 w-4 text-zinc-400 ml-3" />
            <Input 
              placeholder="Search admins by name, email or phone..." 
              className="pl-3 h-9 border-none bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 text-sm font-medium"
              value={adminSearch}
              onChange={(e) => setAdminSearch(e.target.value)}
            />
          </div>

          {/* Table Container */}
          <div className="bg-white rounded-xl shadow-sm border border-zinc-100 overflow-hidden">
            <Table>
              <TableHeader className="bg-zinc-50/50 border-b border-zinc-100">
                <TableRow>
                  <TableHead className="px-6 h-12 font-bold text-zinc-900 text-[13px]">Administrator</TableHead>
                  <TableHead className="h-12 font-bold text-zinc-900 text-[13px]">Privileges</TableHead>
                  <TableHead className="h-12 font-bold text-zinc-900 text-[13px]">Contact Info</TableHead>
                  <TableHead className="h-12 font-bold text-zinc-900 text-[13px]">Location / Address</TableHead>
                  <TableHead className="h-12 font-bold text-zinc-900 text-[13px]">Status</TableHead>
                  <TableHead className="px-6 h-12 font-bold text-zinc-900 text-[13px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingAdmins ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm text-zinc-500 font-medium">Loading administrative registry...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredAdmins.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-48 text-center text-zinc-500 font-medium">
                      No administrators matching criteria found.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedAdmins.map((admin) => (
                    <TableRow key={admin.id} className="hover:bg-zinc-50/50 transition-colors">
                      <TableCell className="px-6">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 bg-zinc-100 rounded-lg flex items-center justify-center text-zinc-600 font-bold text-xs border border-zinc-200">
                            {admin.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-zinc-900 text-sm">{admin.name}</div>
                            <div className="text-zinc-400 text-xs font-mono">ID: {admin.id}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn(
                          "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase border tracking-wider",
                          admin.role === "superadmin"
                            ? "bg-purple-50 text-purple-700 border-purple-200"
                            : "bg-blue-50 text-blue-700 border-blue-200"
                        )}>
                          {admin.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-xs text-zinc-600">
                            <Mail className="h-3.5 w-3.5 text-zinc-400" /> {admin.email}
                          </div>
                          {admin.phone && (
                            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                              <Phone className="h-3.5 w-3.5 text-zinc-400" /> {admin.phone}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {admin.country || admin.city || admin.address ? (
                          <div className="space-y-0.5 text-xs text-zinc-600">
                            <div className="flex items-center gap-1.5 font-medium">
                              <Globe className="h-3.5 w-3.5 text-zinc-400" /> 
                              {admin.city ? `${admin.city}, ` : ""}{admin.country || "Global"}
                            </div>
                            {admin.address && (
                              <div className="text-zinc-400 truncate max-w-[200px] pl-5">{admin.address}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-zinc-400 text-xs italic">Not Assigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={cn(
                          "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase border tracking-wider",
                          admin.is_active
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-red-50 text-red-700 border-red-200"
                        )}>
                          {admin.is_active ? "Active" : "Deactivated"}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-6 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="font-bold text-xs h-8 rounded-lg flex items-center gap-1 border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                            onClick={() => handleOpenEditModal(admin)}
                          >
                            <Pencil className="h-3 w-3" /> Edit
                          </Button>
                          <Button
                            variant={admin.is_active ? "destructive" : "outline"}
                            size="sm"
                            className={cn(
                              "font-bold text-xs h-8 rounded-lg",
                              !admin.is_active && "bg-emerald-600 hover:bg-emerald-700 text-white border-none shadow-xs"
                            )}
                            onClick={() => handleToggleStatus(admin.id)}
                            disabled={isTogglingId === admin.id}
                          >
                            {isTogglingId === admin.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : admin.is_active ? (
                              "Deactivate"
                            ) : (
                              "Activate"
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <PaginationControls
            currentPage={adminPage}
            setCurrentPage={setAdminPage}
            pageSize={PAGE_SIZE}
            setPageSize={() => {}}
            totalItems={filteredAdmins.length}
            itemName="admins"
          />
        </div>
      )}

      {/* TAB CONTENTS: AUDITS */}
      {activeTab === "audits" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-white p-4 rounded-xl border border-zinc-100 shadow-sm">
            <div className="relative flex-1 max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input 
                placeholder="Search audit trail by actor, action or description..." 
                className="pl-10 h-10 border-zinc-200 rounded-lg bg-white font-medium text-sm focus:border-primary transition-all w-full"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-semibold bg-zinc-50 border border-zinc-200 px-3 py-2 rounded-lg">
              <Info className="h-4 w-4 text-[#0052cc]" />
              Showing last 200 events in real-time.
            </div>
          </div>

          {/* Audit Logs Table */}
          <div className="bg-white rounded-xl shadow-sm border border-zinc-100 overflow-hidden">
            <Table>
              <TableHeader className="bg-zinc-50/50 border-b border-zinc-100">
                <TableRow>
                  <TableHead className="px-6 h-12 font-bold text-zinc-900 text-[13px] w-[180px]">Timestamp</TableHead>
                  <TableHead className="h-12 font-bold text-zinc-900 text-[13px] w-[180px]">Actor (User)</TableHead>
                  <TableHead className="h-12 font-bold text-zinc-900 text-[13px] w-[180px]">Action</TableHead>
                  <TableHead className="h-12 font-bold text-zinc-900 text-[13px]">Event Description</TableHead>
                  <TableHead className="px-6 h-12 font-bold text-zinc-900 text-[13px] w-[200px]">Network Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingAudits ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm text-zinc-500 font-medium">Scanning audit records...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredAuditLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-48 text-center text-zinc-500 font-medium">
                      No audit logs matching search found.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedAuditLogs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-zinc-50/50 transition-colors">
                      <TableCell className="px-6 text-xs font-mono text-zinc-500">
                        {new Date(log.created_at).toLocaleString("en-US", {
                          dateStyle: "medium",
                          timeStyle: "short"
                        })}
                      </TableCell>
                      <TableCell>
                        {log.user ? (
                          <div>
                            <div className="font-semibold text-zinc-900 text-sm">{log.user.name}</div>
                            <div className="text-zinc-500 text-xs">{log.user.email}</div>
                          </div>
                        ) : (
                          <span className="text-zinc-400 text-xs italic font-medium">System Action</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={cn(
                          "rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase border tracking-wider",
                          getActionBadgeColor(log.action)
                        )}>
                          {log.action.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-medium text-zinc-700">
                        {log.description}
                      </TableCell>
                      <TableCell className="px-6">
                        <div className="space-y-0.5 text-[11px] font-mono text-zinc-500">
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-zinc-400">IP:</span> 
                            {log.ip_address || "N/A"}
                          </div>
                          <div className="text-zinc-400 max-w-[180px] truncate" title={log.user_agent || "N/A"}>
                            <span className="font-bold">UA:</span> {log.user_agent || "N/A"}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <PaginationControls
            currentPage={auditPage}
            setCurrentPage={setAuditPage}
            pageSize={PAGE_SIZE}
            setPageSize={() => {}}
            totalItems={filteredAuditLogs.length}
            itemName="logs"
          />
        </div>
      )}

      {/* CREATE ADMINISTRATOR MODAL */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-[650px] p-0 overflow-hidden bg-white rounded-xl shadow-2xl border border-zinc-200">
          <DialogHeader className="p-6 border-b bg-white">
            <DialogTitle className="text-xl font-bold text-zinc-900">Create New Administrator</DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs mt-1">
              Add credential profiles for admins and superadmins. They will be directed to change their password instantly upon first login.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateAdmin}>
            <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
              {/* Credentials & Role */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-primary">1. Essential Credentials</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-500">Full Name *</label>
                    <Input 
                      placeholder="e.g. Samuel Kiptoo" 
                      className="h-10 border-zinc-200 rounded-lg focus:ring-primary/20" 
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-500">Work Email *</label>
                    <Input 
                      type="email"
                      placeholder="s.kiptoo@autospare.com" 
                      className="h-10 border-zinc-200 rounded-lg" 
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Temp Password */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-500">Password *</label>
                    <div className="relative">
                      <Input 
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••" 
                        className="h-10 border-zinc-200 rounded-lg pr-10" 
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  {/* Confirm Pass */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-500">Confirm Password *</label>
                    <div className="relative">
                      <Input 
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="••••••••" 
                        className="h-10 border-zinc-200 rounded-lg pr-10" 
                        value={formData.password_confirmation}
                        onChange={(e) => setFormData({...formData, password_confirmation: e.target.value})}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-500">Access Privilege Level *</label>
                  <select 
                    className="w-full h-10 px-3 border border-zinc-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-primary/10"
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value})}
                    required
                  >
                    <option value="admin">Admin (Logistics, Orders, Stock Management)</option>
                    <option value="superadmin">Super Admin (Full privileges including Admin management and Audits)</option>
                  </select>
                </div>
              </div>

              {/* Extra Details Section */}
              <div className="space-y-4 pt-3 border-t border-zinc-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-primary">2. Additional Contact & Address Details</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-500">Phone Number</label>
                    <Input 
                      placeholder="+254 700 000 000" 
                      className="h-10 border-zinc-200 rounded-lg" 
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-500">Country</label>
                    <Input 
                      placeholder="e.g. Kenya" 
                      className="h-10 border-zinc-200 rounded-lg" 
                      value={formData.country}
                      onChange={(e) => setFormData({...formData, country: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-500">City</label>
                    <Input 
                      placeholder="e.g. Nairobi" 
                      className="h-10 border-zinc-200 rounded-lg" 
                      value={formData.city}
                      onChange={(e) => setFormData({...formData, city: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-500">Logistics Hub / Street Address</label>
                    <Input 
                      placeholder="e.g. Mombasa Rd Central Hub" 
                      className="h-10 border-zinc-200 rounded-lg" 
                      value={formData.address}
                      onChange={(e) => setFormData({...formData, address: e.target.value})}
                    />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className="p-4 border-t bg-zinc-50/50 flex items-center justify-end gap-3">
              <Button 
                type="button" 
                variant="outline" 
                className="h-10 rounded-lg px-6 font-bold text-sm text-zinc-600 bg-white border-zinc-200" 
                onClick={() => setIsCreateModalOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                className="h-10 bg-primary text-white hover:bg-primary/95 rounded-lg font-black px-8 text-[11px] tracking-widest uppercase shadow-sm" 
                disabled={isSaving}
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                PROVISION ACCOUNT
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT ADMINISTRATOR MODAL */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[650px] p-0 overflow-hidden bg-white rounded-xl shadow-2xl border border-zinc-200">
          <DialogHeader className="p-6 border-b bg-white">
            <DialogTitle className="text-xl font-bold text-zinc-900">Edit Administrator Details</DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs mt-1">
              Update spelling errors, edit roles, contact details, or logistics hub information.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateAdmin}>
            <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
              {/* Credentials & Role */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-primary">1. Essential Credentials</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-500">Full Name *</label>
                    <Input 
                      placeholder="e.g. Samuel Kiptoo" 
                      className="h-10 border-zinc-200 rounded-lg focus:ring-primary/20" 
                      value={editFormData.name}
                      onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-500">Work Email *</label>
                    <Input 
                      type="email"
                      placeholder="s.kiptoo@autospare.com" 
                      className="h-10 border-zinc-200 rounded-lg" 
                      value={editFormData.email}
                      onChange={(e) => setEditFormData({...editFormData, email: e.target.value})}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-500">Access Privilege Level *</label>
                  <select 
                    className="w-full h-10 px-3 border border-zinc-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-primary/10 font-medium"
                    value={editFormData.role}
                    onChange={(e) => setEditFormData({...editFormData, role: e.target.value})}
                    required
                  >
                    <option value="admin">Admin (Logistics, Orders, Stock Management)</option>
                    <option value="superadmin">Super Admin (Full privileges including Admin management and Audits)</option>
                  </select>
                </div>
              </div>

              {/* Extra Details Section */}
              <div className="space-y-4 pt-3 border-t border-zinc-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-primary">2. Additional Contact & Address Details</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-500">Phone Number</label>
                    <Input 
                      placeholder="+254 700 000 000" 
                      className="h-10 border-zinc-200 rounded-lg" 
                      value={editFormData.phone}
                      onChange={(e) => setEditFormData({...editFormData, phone: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-500">Country</label>
                    <Input 
                      placeholder="e.g. Kenya" 
                      className="h-10 border-zinc-200 rounded-lg" 
                      value={editFormData.country}
                      onChange={(e) => setEditFormData({...editFormData, country: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-500">City</label>
                    <Input 
                      placeholder="e.g. Nairobi" 
                      className="h-10 border-zinc-200 rounded-lg" 
                      value={editFormData.city}
                      onChange={(e) => setEditFormData({...editFormData, city: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-500">Logistics Hub / Street Address</label>
                    <Input 
                      placeholder="e.g. Mombasa Rd Central Hub" 
                      className="h-10 border-zinc-200 rounded-lg" 
                      value={editFormData.address}
                      onChange={(e) => setEditFormData({...editFormData, address: e.target.value})}
                    />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className="p-4 border-t bg-zinc-50/50 flex items-center justify-end gap-3">
              <Button 
                type="button" 
                variant="outline" 
                className="h-10 rounded-lg px-6 font-bold text-sm text-zinc-600 bg-white border-zinc-200" 
                onClick={() => setIsEditModalOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                className="h-10 bg-primary text-white hover:bg-primary/95 rounded-lg font-black px-8 text-[11px] tracking-widest uppercase shadow-sm" 
                disabled={isSaving}
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                SAVE CHANGES
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
