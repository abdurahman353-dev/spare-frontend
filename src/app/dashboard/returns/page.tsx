"use client";

import { useEffect, useState, useMemo } from "react";
import api from "@/lib/axios";
import { API_ENDPOINTS } from "@/lib/apis";
import { toast } from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  RotateCcw, CheckCircle2, XCircle, Loader2, Search,
  Filter, RefreshCw, Eye, AlertCircle, MoreHorizontal
} from "lucide-react";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { useSettings } from "@/components/providers/SettingsProvider";

interface ReturnRequest {
  id: number;
  order_id: number;
  reason: string;
  explanation?: string;
  status: "Pending" | "Approved" | "Rejected";
  admin_notes?: string;
  created_at: string;
  updated_at: string;
  return_items?: Array<{ order_item_id: number; quantity: number }> | null;
  return_items?: { order_item_id: number; quantity: number }[];
  return_items?: { order_item_id: number; quantity: number }[];
  order?: {
    tracking_number: string;
    total_amount: number;
    shipping_fee?: number;
    refunded_amount?: number;
    status: string;
    customer?: {
      name: string;
      email?: string;
      phone?: string;
    };
    items?: any[];
  };
  user?: {
    name: string;
    email: string;
  };
}

export default function ReturnsManagementPage() {
  const { settings } = useSettings();
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedReturn, setSelectedReturn] = useState<ReturnRequest | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [processingId, setProcessingId] = useState<number | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const fetchReturns = async () => {
    setLoading(true);
    try {
      const res = await api.get(API_ENDPOINTS.returns.allPages);
      setReturns(Array.isArray(res.data) ? res.data : res.data.data ?? []);
    } catch (err) {
      console.error("Failed to fetch returns:", err);
      toast.error("Failed to load return requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReturns();
  }, []);

  const filteredReturns = useMemo(() => {
    const sq = searchQuery.toLowerCase();
    return returns.filter(r => {
      const matchesSearch = !sq || (
        r.order?.tracking_number?.toLowerCase().includes(sq) ||
        r.order?.customer?.name?.toLowerCase().includes(sq) ||
        r.reason.toLowerCase().includes(sq) ||
        `ret-${r.id}`.includes(sq)
      );
      const matchesStatus = !statusFilter || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [returns, searchQuery, statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const totalPages = Math.ceil(filteredReturns.length / pageSize);
  const paginatedReturns = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredReturns.slice(start, start + pageSize);
  }, [filteredReturns, currentPage, pageSize]);

  const pendingCount = returns.filter(r => r.status === "Pending").length;

  const handleApprove = async () => {
    if (!selectedReturn) return;
    setProcessingId(selectedReturn.id);
    try {
      await api.post(API_ENDPOINTS.returns.approve(selectedReturn.id), { admin_notes: adminNotes });
      toast.success(`Return RET-${selectedReturn.id} approved — inventory restored & payment marked refunded.`, {
        duration: 5000, icon: "✅"
      });
      setIsActionModalOpen(false);
      setAdminNotes("");
      fetchReturns();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to approve return");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!selectedReturn) return;
    setProcessingId(selectedReturn.id);
    try {
      await api.post(API_ENDPOINTS.returns.reject(selectedReturn.id), { admin_notes: adminNotes });
      toast.success(`Return RET-${selectedReturn.id} rejected.`);
      setIsActionModalOpen(false);
      setAdminNotes("");
      fetchReturns();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to reject return");
    } finally {
      setProcessingId(null);
    }
  };

  const openAction = (ret: ReturnRequest, type: "approve" | "reject") => {
    setSelectedReturn(ret);
    setActionType(type);
    setAdminNotes("");
    setIsActionModalOpen(true);
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setStatusFilter("");
  };

  const currency = settings.currency || "Ksh";

  return (
    <div className="space-y-6 p-3 sm:p-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Returns & Refund Requests</h1>
          <p className="text-zinc-500 text-sm mt-1">Review and process customer return requests submitted post-delivery.</p>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-700 font-black text-xs px-3 py-1.5 rounded-full border border-amber-200 uppercase tracking-wider animate-pulse">
              <AlertCircle className="h-3.5 w-3.5" />
              {pendingCount} Pending
            </span>
          )}
          <Button
            onClick={fetchReturns}
            disabled={loading}
            className="bg-primary text-white hover:bg-primary/90 rounded-lg shadow-sm font-bold"
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
        <div className="relative w-full sm:flex-1 sm:min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input
            placeholder="Search by Ref, Customer, Reason..."
            className="pl-10 h-10 border-zinc-200 rounded-lg w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-[160px]">
          <select
            className="h-10 px-3 border border-zinc-200 rounded-lg text-sm font-medium bg-white outline-none focus:ring-2 focus:ring-primary/20 w-full text-zinc-600"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
        <Button variant="outline" className="w-full sm:w-auto rounded-lg h-10 px-3 border-zinc-200" onClick={handleClearFilters}>
          <Filter className="h-4 w-4 text-zinc-500 mr-2" /> Clear
        </Button>
      </div>

      {/* Returns Table */}
      <div className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-x-auto custom-scrollbar">
        <Table>
          <TableHeader className="bg-zinc-50/50">
            <TableRow>
              <TableHead className="px-6 font-semibold text-zinc-900">Return Ref</TableHead>
              <TableHead className="font-semibold text-zinc-900">Order Ref</TableHead>
              <TableHead className="font-semibold text-zinc-900">Customer</TableHead>
              <TableHead className="font-semibold text-zinc-900">Reason</TableHead>
              <TableHead className="font-semibold text-zinc-900">Date Filed</TableHead>
              <TableHead className="font-semibold text-zinc-900 text-center">Status</TableHead>
              <TableHead className="px-6 w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-zinc-500">Loading return requests...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredReturns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-48 text-center text-zinc-500">
                  No return requests found.
                </TableCell>
              </TableRow>
            ) : (
              paginatedReturns.map(ret => (
                <TableRow key={ret.id} className="hover:bg-zinc-50/50 animate-fade-in">
                  <TableCell className="px-6 font-bold text-[#0052cc]">
                    RET-{ret.id}
                  </TableCell>
                  <TableCell className="font-semibold text-zinc-800">
                    {ret.order?.tracking_number || `#${ret.order_id}`}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm text-zinc-900">{ret.order?.customer?.name || "—"}</p>
                      <p className="text-xs text-zinc-400">{ret.order?.customer?.phone || ret.order?.customer?.email || ""}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm text-zinc-700 max-w-[220px] leading-tight">{ret.reason}</p>
                      {ret.explanation && (
                        <p className="text-xs text-zinc-400 mt-0.5 line-clamp-1" title={ret.explanation}>
                          {ret.explanation}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-zinc-500">
                    {new Date(ret.created_at).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={cn(
                      "rounded-full px-3 text-[10px] border-none font-bold uppercase tracking-wider",
                      ret.status === "Approved" ? "bg-emerald-500 text-white hover:bg-emerald-600" :
                        ret.status === "Rejected" ? "bg-zinc-650 text-white hover:bg-zinc-750" :
                          "bg-amber-100 text-amber-700 border border-amber-200"
                    )}>
                      {ret.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-6">
                    <DropdownMenu>
                      <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost" }), "h-8 w-8 p-0")}>
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuGroup>
                          <DropdownMenuLabel>Return Actions</DropdownMenuLabel>
                          <DropdownMenuItem
                            className="cursor-pointer"
                            onClick={() => { setSelectedReturn(ret); setIsDetailModalOpen(true); }}
                          >
                            <Eye className="mr-2 h-4 w-4" /> View Details
                          </DropdownMenuItem>
                          {ret.status === "Pending" && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="cursor-pointer text-emerald-700 focus:text-emerald-700 focus:bg-emerald-50"
                                onClick={() => openAction(ret, "approve")}
                              >
                                <CheckCircle2 className="mr-2 h-4 w-4" /> Approve Return
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="cursor-pointer text-red-700 focus:text-red-700 focus:bg-red-50"
                                onClick={() => openAction(ret, "reject")}
                              >
                                <XCircle className="mr-2 h-4 w-4" /> Reject Return
                              </DropdownMenuItem>
                            </>
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
        <PaginationControls
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          pageSize={pageSize}
          setPageSize={setPageSize}
          totalItems={filteredReturns.length}
          itemName="returns"
          pageSizeOptions={[15, 30, 50, 100]}
        />
      </div>

      {/* Detail Modal */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="sm:max-w-[520px] p-0 rounded-2xl overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 bg-purple-50 border-b border-purple-100">
            <DialogTitle className="font-bold text-zinc-900 flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-purple-600" />
              Return Details — RET-{selectedReturn?.id}
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-500 font-medium">
              Filed on {selectedReturn ? new Date(selectedReturn.created_at).toLocaleString("en-KE") : ""}
            </DialogDescription>
          </DialogHeader>
          {selectedReturn && (
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-0.5">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Order Reference</p>
                  <p className="font-bold text-zinc-800">{selectedReturn.order?.tracking_number}</p>
                </div>
                <div className="space-y-0.5">
                  <Badge className={cn(
                    "rounded-full px-2 py-0.5 text-[9px] font-black border-none uppercase",
                    selectedReturn.order?.status === "Returned" ? "bg-red-600 text-white" :
                      selectedReturn.order?.status === "Cancelled" ? "bg-red-600 text-white" :
                        selectedReturn.order?.status === "Delivered" ? "bg-emerald-500 text-white" :
                          "bg-zinc-200 text-zinc-700"
                  )}>
                    {selectedReturn.order?.status}
                  </Badge>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Customer</p>
                  <p className="font-semibold text-zinc-800">{selectedReturn.order?.customer?.name}</p>
                  <p className="text-xs text-zinc-400">{selectedReturn.order?.customer?.phone || selectedReturn.order?.customer?.email}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Order Value</p>
                  <p className="font-bold text-zinc-800">{currency} {Number(selectedReturn.order?.total_amount || 0).toLocaleString()}</p>
                </div>
              </div>

              <div className="bg-zinc-50 p-4 rounded-lg border border-zinc-100 space-y-3">
                <div>
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Return Reason</p>
                  <p className="text-sm font-semibold text-zinc-800">{selectedReturn.reason}</p>
                </div>
                {selectedReturn.explanation && (
                  <div>
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Customer Explanation</p>
                    <p className="text-sm text-zinc-600 leading-relaxed">{selectedReturn.explanation}</p>
                  </div>
                )}
              </div>

              {selectedReturn.return_items && selectedReturn.return_items.length > 0 ? (
                <div>
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 text-purple-600">Items Requested for Return</p>
                  <div className="border border-purple-100 rounded-lg overflow-hidden">
                    {selectedReturn.return_items.map((ri: any, i: number) => {
                      const item = selectedReturn.order?.items?.find((it: any) => it.id === ri.order_item_id);
                      return (
                        <div key={i} className="flex justify-between text-xs px-3 py-2.5 border-b border-purple-50 last:border-0 bg-purple-50/30 hover:bg-purple-50/50">
                          <span className="font-bold text-zinc-800">{item?.product?.name || `Order Item #${ri.order_item_id}`}</span>
                          <span className="text-purple-700 font-bold">QTY {ri.quantity} × {currency} {Number(item?.price || 0).toLocaleString()}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : selectedReturn.order?.items && selectedReturn.order.items.length > 0 ? (
                <div>
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 text-purple-600">Items Requested for Return (Full Return)</p>
                  <div className="border border-purple-100 rounded-lg overflow-hidden">
                    {selectedReturn.return_items.map((ri: any, i: number) => {
                      const item = selectedReturn.order?.items?.find((it: any) => it.id === ri.order_item_id);
                      return (
                        <div key={i} className="flex justify-between text-xs px-3 py-2.5 border-b border-purple-50 last:border-0 bg-purple-50/30 hover:bg-purple-50/50">
                          <span className="font-bold text-zinc-800">{item?.product?.name || `Order Item #${ri.order_item_id}`}</span>
                          <span className="text-purple-700 font-bold">QTY {ri.quantity} × {currency} {Number(item?.price || 0).toLocaleString()}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {selectedReturn.admin_notes && (
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                  <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Admin Notes</p>
                  <p className="text-xs text-blue-800 font-medium">{selectedReturn.admin_notes}</p>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <Badge className={cn(
                  "rounded-full px-3 py-1 text-[10px] font-black uppercase border-none",
                  selectedReturn.status === "Approved" ? "bg-emerald-500 text-white" :
                    selectedReturn.status === "Rejected" ? "bg-zinc-600 text-white" :
                      "bg-amber-100 text-amber-700 border border-amber-200"
                )}>
                  {selectedReturn.status}
                </Badge>
                {selectedReturn.status === "Pending" && (
                  <div className="flex gap-2 ml-auto">
                    <Button
                      size="sm"
                      onClick={() => { setIsDetailModalOpen(false); openAction(selectedReturn, "approve"); }}
                      className="h-8 px-3 text-[11px] font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => { setIsDetailModalOpen(false); openAction(selectedReturn, "reject"); }}
                      className="h-8 px-3 text-[11px] font-black bg-red-600 hover:bg-red-700 text-white rounded-lg"
                    >
                      <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approve / Reject Confirmation Modal */}
      <Dialog open={isActionModalOpen} onOpenChange={setIsActionModalOpen}>
        <DialogContent className="sm:max-w-[440px] rounded-2xl border-none shadow-2xl p-0 overflow-hidden">
          <DialogHeader className={cn(
            "p-6 border-b",
            actionType === "approve" ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"
          )}>
            <DialogTitle className={cn(
              "font-bold flex items-center gap-2",
              actionType === "approve" ? "text-emerald-900" : "text-red-900"
            )}>
              {actionType === "approve"
                ? <><CheckCircle2 className="h-4 w-4" /> Approve Return — RET-{selectedReturn?.id}</>
                : <><XCircle className="h-4 w-4" /> Reject Return — RET-{selectedReturn?.id}</>
              }
            </DialogTitle>
            <DialogDescription className="text-xs font-medium mt-1 text-zinc-600">
              {actionType === "approve"
                ? "Approving this return will mark the order as Returned, restore inventory to stock, and mark the payment as Refunded."
                : "Rejecting this return will notify the customer that their request was not approved."
              }
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-zinc-500 uppercase tracking-widest block">
                Admin Notes (Optional)
              </label>
              <textarea
                className="w-full h-24 px-3 py-2 border border-zinc-200 rounded-lg text-sm bg-zinc-50 outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                placeholder={actionType === "approve"
                  ? "E.g. Return approved. Please drop off the part at our Nairobi branch."
                  : "E.g. Return rejected — part shows signs of use outside original condition."
                }
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
              />
            </div>
            {actionType === "approve" && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700 font-medium leading-relaxed">
                ⚡ This action will automatically: restore inventory quantities, update order status to "Returned", and mark payment status as "Refunded". These changes cannot be undone.
              </div>
            )}
          </div>
          <DialogFooter className="p-5 bg-zinc-50 border-t border-zinc-100 flex gap-3">
            <Button
              variant="outline"
              className="flex-1 font-bold"
              onClick={() => setIsActionModalOpen(false)}
              disabled={processingId !== null}
            >
              No, Cancel
            </Button>
            <Button
              className={cn(
                "flex-1 font-black",
                actionType === "approve"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-red-600 hover:bg-red-700 text-white"
              )}
              disabled={processingId !== null}
              onClick={actionType === "approve" ? handleApprove : handleReject}
            >
              {processingId ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {actionType === "approve" ? "Yes, Approve" : "Yes, Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
