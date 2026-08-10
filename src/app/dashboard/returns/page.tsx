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
  status: "Pending" | "Approved" | "Completed" | "Rejected";
  refund_payment_method?: string;
  refund_reference?: string;
  custom_reason?: string;
  admin_notes?: string;
  created_at: string;
  updated_at: string;
  return_items?: Array<{ order_item_id: number; quantity: number }> | null;
  order?: {
    tracking_number: string;
    total_amount: number;
    shipping_fee?: number;
    refunded_amount?: number;
    status: string;
    notes?: string;
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

// Helper to parse recipient info from walk-in order notes
function parseRecipientNotes(notes?: string): { name: string; phone: string; email: string } | null {
  if (!notes) return null;
  const nameMatch = notes.match(/Recipient:\s*([^|]+)/i);
  const phoneMatch = notes.match(/Phone:\s*([^|]+)/i);
  const emailMatch = notes.match(/Email:\s*([^|\s]+)/i);
  if (!nameMatch) return null;
  return {
    name: nameMatch[1].trim(),
    phone: phoneMatch ? phoneMatch[1].trim() : "",
    email: emailMatch ? emailMatch[1].trim() : "",
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
  const [actionType, setActionType] = useState<"approve" | "reject" | "confirm_receipt" | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [processingId, setProcessingId] = useState<number | null>(null);

  // Payment methods that require a transaction reference code
  const METHODS_NEEDING_REF = ["M-Pesa", "Bank Transfer", "Card Refund"];

  // Refund Payment Method State (action modal)
  const [refundPaymentMethod, setRefundPaymentMethod] = useState("M-Pesa");
  const [refundReference, setRefundReference] = useState("");

  // Edit Return Details States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editNotes, setEditNotes] = useState("");
  const [editPaymentMethod, setEditPaymentMethod] = useState("");
  const [editRefundReference, setEditRefundReference] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editExplanation, setEditExplanation] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const fetchReturns = async () => {
    setLoading(true);
    try {
      let res;
      try {
        res = await api.get(API_ENDPOINTS.returns.allPages);
      } catch (firstErr) {
        // Fallback to base /returns endpoint if per_page query parameter encounters network issue
        res = await api.get(API_ENDPOINTS.returns.base);
      }
      const data = Array.isArray(res.data) ? res.data : res.data?.data ?? [];
      setReturns(data);
    } catch (err: any) {
      console.error("Failed to fetch returns:", err);
      toast.error(err?.response?.data?.message || "Failed to load return requests. Please check network connection.");
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
    // Validate reference required for certain methods
    if (selectedReturn.order?.status !== "Delivered" && METHODS_NEEDING_REF.includes(refundPaymentMethod) && !refundReference.trim()) {
      toast.error("Please enter the transaction reference code for this payment method.");
      return;
    }
    setProcessingId(selectedReturn.id);
    try {
      const payload: any = { admin_notes: adminNotes };
      if (selectedReturn.order?.status !== "Delivered") {
        payload.refund_payment_method = refundPaymentMethod;
        payload.refund_reference = METHODS_NEEDING_REF.includes(refundPaymentMethod) ? refundReference.trim() : null;
      }
      const res = await api.post(API_ENDPOINTS.returns.approve(selectedReturn.id), payload);
      toast.success(res.data?.message || `Return RET-${selectedReturn.id} approved successfully.`, {
        duration: 5000, icon: "✅"
      });
      setIsActionModalOpen(false);
      setAdminNotes("");
      setRefundPaymentMethod("M-Pesa");
      setRefundReference("");
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

  const handleConfirmReceipt = async () => {
    if (!selectedReturn) return;
    // Validate reference required for certain methods
    if (METHODS_NEEDING_REF.includes(refundPaymentMethod) && !refundReference.trim()) {
      toast.error("Please enter the transaction reference code for this payment method.");
      return;
    }
    setProcessingId(selectedReturn.id);
    try {
      const res = await api.post(`/returns/${selectedReturn.id}/confirm-receipt`, {
        refund_payment_method: refundPaymentMethod,
        refund_reference: METHODS_NEEDING_REF.includes(refundPaymentMethod) ? refundReference.trim() : null,
        admin_notes: adminNotes
      });
      toast.success(res.data?.message || `Return RET-${selectedReturn.id} receipt confirmed and refund processed.`, {
        duration: 5000, icon: "✅"
      });
      setIsActionModalOpen(false);
      setAdminNotes("");
      setRefundPaymentMethod("M-Pesa");
      setRefundReference("");
      fetchReturns();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to confirm item receipt");
    } finally {
      setProcessingId(null);
    }
  };

  const handleEditUpdate = async () => {
    if (!selectedReturn) return;
    // Validate reference required for certain methods
    if (editPaymentMethod && METHODS_NEEDING_REF.includes(editPaymentMethod) && !editRefundReference.trim()) {
      toast.error("Please enter the transaction reference code for this payment method.");
      return;
    }
    setProcessingId(selectedReturn.id);
    try {
      const res = await api.put(`/returns/${selectedReturn.id}`, {
        reason: editReason,
        custom_reason: editExplanation,
        admin_notes: editNotes,
        refund_payment_method: editPaymentMethod,
        refund_reference: (editPaymentMethod && METHODS_NEEDING_REF.includes(editPaymentMethod)) ? editRefundReference.trim() : null,
      });
      toast.success(res.data?.message || "Return request updated successfully.");
      setIsEditModalOpen(false);
      fetchReturns();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update return request");
    } finally {
      setProcessingId(null);
    }
  };

  const openAction = (ret: ReturnRequest, type: "approve" | "reject" | "confirm_receipt") => {
    setSelectedReturn(ret);
    setActionType(type);
    setAdminNotes("");
    setRefundPaymentMethod("M-Pesa");
    setRefundReference("");
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
            <option value="Approved">Awaiting Return</option>
            <option value="Completed">Refunded / Returned</option>
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
                    {(() => {
                      const recipient = parseRecipientNotes(ret.order?.notes);
                      const name = recipient?.name || ret.order?.customer?.name || "—";
                      const contact = recipient?.phone || recipient?.email || ret.order?.customer?.phone || ret.order?.customer?.email || "";
                      return (
                        <div>
                          <p className="font-medium text-sm text-zinc-900">{name}</p>
                          <p className="text-xs text-zinc-400">{contact}</p>
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm text-zinc-700 max-w-[180px] truncate leading-tight" title={ret.reason}>{ret.reason}</p>
                      {ret.explanation && (
                        <p className="text-xs text-zinc-400 mt-0.5 truncate max-w-[180px]" title={ret.explanation}>
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
                      ret.status === "Approved" ? "bg-blue-100 text-blue-700 border border-blue-200" :
                      ret.status === "Completed" ? "bg-emerald-500 text-white hover:bg-emerald-600" :
                      ret.status === "Rejected" ? "bg-red-600 text-white hover:bg-red-700" :
                      "bg-amber-100 text-amber-700 border border-amber-200"
                    )}>
                      {ret.status === "Approved" ? "Awaiting Return" : ret.status === "Completed" ? "Refunded" : ret.status}
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
                          <DropdownMenuItem
                            className="cursor-pointer text-zinc-700 focus:text-zinc-700"
                            onClick={() => {
                              setSelectedReturn(ret);
                              setEditNotes(ret.admin_notes || "");
                              setEditPaymentMethod(ret.refund_payment_method || "");
                              setEditRefundReference(ret.refund_reference || "");
                              setEditReason(ret.reason || "");
                              setEditExplanation(ret.custom_reason || "");
                              setIsEditModalOpen(true);
                            }}
                          >
                            <RotateCcw className="mr-2 h-4 w-4 text-zinc-500" /> Edit Details
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
                          {ret.status === "Approved" && ret.order?.status === "Delivered" && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="cursor-pointer text-blue-700 focus:text-blue-700 focus:bg-blue-50"
                                onClick={() => openAction(ret, "confirm_receipt")}
                              >
                                <CheckCircle2 className="mr-2 h-4 w-4" /> Confirm Receipt & Refund
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
                   <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Order Status</p>
                   <Badge className={cn(
                     "rounded-full px-2 py-0.5 text-[9px] font-black border-none uppercase",
                     selectedReturn.order?.status === "Delivered" ? "bg-emerald-100 text-emerald-800" :
                     selectedReturn.order?.status === "Cancelled" || selectedReturn.order?.status === "Returned" ? "bg-red-100 text-red-800" :
                     "bg-blue-100 text-blue-800"
                   )}>
                     {selectedReturn.order?.status || "Pending"}
                   </Badge>
                 </div>
                 <div className="space-y-0.5">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Customer</p>
                    {(() => {
                      const recipient = parseRecipientNotes(selectedReturn.order?.notes);
                      const name = recipient?.name || selectedReturn.order?.customer?.name || "—";
                      const phone = recipient?.phone || selectedReturn.order?.customer?.phone || "";
                      const email = recipient?.email || selectedReturn.order?.customer?.email || "";
                      return (
                        <>
                          <p className="font-semibold text-zinc-800">{name}</p>
                          <p className="text-xs text-zinc-400">{phone || email}</p>
                          {recipient?.email && <p className="text-xs text-zinc-400">{recipient.email}</p>}
                        </>
                      );
                    })()}
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
                    {selectedReturn.order.items.map((item: any, i: number) => {
                      return (
                        <div key={i} className="flex justify-between text-xs px-3 py-2.5 border-b border-purple-50 last:border-0 bg-purple-50/30 hover:bg-purple-50/50">
                          <span className="font-bold text-zinc-800">{item?.product?.name || `Product #${item.product_id}`}</span>
                          <span className="text-purple-700 font-bold">QTY {item.quantity} × {currency} {Number(item?.price || 0).toLocaleString()}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {/* Calculate Refund Breakdown for Admin */}
              {(() => {
                const items = selectedReturn.order?.items ?? [];
                let rawReturnItems = selectedReturn.return_items;
                if (typeof rawReturnItems === "string") {
                  try { rawReturnItems = JSON.parse(rawReturnItems); } catch (e) { rawReturnItems = []; }
                }
                const returnItemIds = (rawReturnItems ?? []).map((ri: any) => Number(ri.order_item_id));
                let returnedItems = items;
                if (returnItemIds.length > 0) {
                  returnedItems = items.filter((i: any) => returnItemIds.includes(Number(i.id)));
                } else {
                  const cancelledItems = items.filter((i: any) => i.cancellation_status === "Cancelled");
                  if (cancelledItems.length > 0 && cancelledItems.length < items.length) {
                    returnedItems = cancelledItems;
                  }
                }

                let productCostTotal = 0;
                let shippingShareTotal = 0;
                returnedItems.forEach((i: any) => {
                  const qty = (Array.isArray(rawReturnItems) ? rawReturnItems : [])?.find((ri: any) => Number(ri.order_item_id) === Number(i.id))?.quantity ?? i.quantity;
                  const pPrice = parseFloat(i.price ?? 0);
                  let feePerUnit = parseFloat(i.shipping_fee_per_unit ?? 0);

                  // Fallback: If feePerUnit is 0, calculate per-unit share from order shipping fee
                  if (feePerUnit === 0 && selectedReturn.order) {
                    const totalUnits = (selectedReturn.order.items || []).reduce((sum: number, it: any) => sum + (it.quantity || 1), 0);
                    const origShipping = Number(selectedReturn.order.shipping_fee || 0);
                    if (origShipping > 0 && totalUnits > 0) {
                      feePerUnit = origShipping / totalUnits;
                    } else if (i.product?.part_number && !i.product?.name?.toLowerCase().includes("headlight")) {
                      // Fallback for shock absorbers/items with unit shipping fee
                      feePerUnit = 1.0;
                    }
                  }

                  productCostTotal += pPrice * qty;
                  shippingShareTotal += feePerUnit * qty;
                });
                const refundTotal = productCostTotal + shippingShareTotal;

                if (refundTotal <= 0) return null;

                return (
                  <div className="rounded-xl border border-purple-100 overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2.5 text-xs font-extrabold uppercase tracking-widest bg-purple-50 text-purple-700">
                      <span>💸</span> Refund Breakdown
                    </div>
                    <div className="px-4 py-3 bg-white space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500 font-medium">Product cost</span>
                        <span className="font-bold text-[#1e293b]">{currency} {productCostTotal.toLocaleString("en-KE", { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500 font-medium">Shipping fee share</span>
                        <span className="font-bold text-[#1e293b]">{currency} {shippingShareTotal.toLocaleString("en-KE", { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="border-t border-zinc-100 pt-1.5 flex items-center justify-between font-extrabold">
                        <span className="text-[#1e293b]">Total Refund Amount</span>
                        <span className="text-purple-600 text-sm">
                          {currency} {refundTotal.toLocaleString("en-KE", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {selectedReturn.admin_notes && (
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                  <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Admin Notes</p>
                  <p className="text-xs text-blue-800 font-medium">{selectedReturn.admin_notes}</p>
                </div>
              )}

              {selectedReturn.refund_payment_method && (
                <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200 space-y-2">
                  <div>
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Refund Payment Method</p>
                    <p className="text-xs text-zinc-800 font-bold">{selectedReturn.refund_payment_method}</p>
                  </div>
                  {selectedReturn.refund_reference && (
                    <div className="border-t border-zinc-100 pt-2">
                      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Transaction Reference Code</p>
                      <p className="text-purple-700 font-mono font-black tracking-wide bg-purple-50/50 px-2 py-1 rounded border border-purple-100 inline-block text-[11px]">
                        {selectedReturn.refund_reference}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <Badge className={cn(
                  "rounded-full px-3 py-1 text-[10px] font-black uppercase border-none",
                  selectedReturn.status === "Approved" ? "bg-blue-100 text-blue-700 border border-blue-200" :
                  selectedReturn.status === "Completed" ? "bg-emerald-500 text-white" :
                  selectedReturn.status === "Rejected" ? "bg-red-600 text-white" :
                  "bg-amber-100 text-amber-700 border border-amber-200"
                )}>
                  {selectedReturn.status === "Approved" ? "Awaiting Return" : selectedReturn.status === "Completed" ? "Refunded" : selectedReturn.status}
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
                {selectedReturn.status === "Approved" && selectedReturn.order?.status === "Delivered" && (
                  <div className="flex gap-2 ml-auto">
                    <Button
                      size="sm"
                      onClick={() => { setIsDetailModalOpen(false); openAction(selectedReturn, "confirm_receipt"); }}
                      className="h-8 px-3 text-[11px] font-black bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Confirm Receipt
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
            actionType === "approve" ? "bg-emerald-50 border-emerald-100" :
            actionType === "confirm_receipt" ? "bg-blue-50 border-blue-100" :
            "bg-red-50 border-red-100"
          )}>
            <DialogTitle className={cn(
              "font-bold flex items-center gap-2",
              actionType === "approve" ? "text-emerald-900" :
              actionType === "confirm_receipt" ? "text-blue-900" :
              "text-red-900"
            )}>
              {actionType === "approve" ? <><CheckCircle2 className="h-4 w-4" /> Approve Return — RET-{selectedReturn?.id}</> :
               actionType === "confirm_receipt" ? <><CheckCircle2 className="h-4 w-4" /> Confirm Return Receipt — RET-{selectedReturn?.id}</> :
               <><XCircle className="h-4 w-4" /> Reject Return — RET-{selectedReturn?.id}</>
              }
            </DialogTitle>
            <DialogDescription className="text-xs font-medium mt-1 text-zinc-600">
              {actionType === "approve"
                ? (selectedReturn?.order?.status === "Delivered"
                  ? "Approving this return request will authorize the customer to ship the parts back to us. No inventory is restored yet."
                  : "Approving this return will mark the order as Returned, restore inventory to stock, and mark the payment as Refunded.")
                : actionType === "confirm_receipt"
                ? "Confirming receipt will record the items as physically returned, restore inventory to stock, and finalize the refund totals."
                : "Rejecting this return will notify the customer that their request was not approved."
              }
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-zinc-500 uppercase tracking-widest block">
                Admin Notes {actionType === "reject" ? <span className="text-red-500">*</span> : "(Optional)"}
              </label>
              <textarea
                className="w-full h-24 px-3 py-2 border border-zinc-200 rounded-lg text-sm bg-zinc-50 outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                placeholder={actionType === "approve"
                  ? "E.g. Return approved. Please drop off the part at our Nairobi branch."
                  : actionType === "confirm_receipt"
                  ? "E.g. Received parts back. Item condition verified."
                  : "E.g. Return rejected — part shows signs of use outside original condition."
                }
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                required={actionType === "reject"}
              />
            </div>
            
            {(actionType === "confirm_receipt" || (actionType === "approve" && selectedReturn?.order?.status !== "Delivered")) && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-zinc-500 uppercase tracking-widest block">
                  Refund Payment Method <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full h-10 px-3 border border-zinc-200 rounded-lg text-sm bg-zinc-50 outline-none focus:ring-2 focus:ring-primary/20 text-zinc-800 font-medium"
                  value={refundPaymentMethod}
                  onChange={(e) => { setRefundPaymentMethod(e.target.value); setRefundReference(""); }}
                  required
                >
                  <option value="M-Pesa">M-Pesa</option>
                  <option value="Cash">Cash Transfer / Handover</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Card Refund">Credit/Debit Card Refund</option>
                </select>
              </div>
            )}

            {(actionType === "confirm_receipt" || (actionType === "approve" && selectedReturn?.order?.status !== "Delivered")) && METHODS_NEEDING_REF.includes(refundPaymentMethod) && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-zinc-500 uppercase tracking-widest block">
                  Transaction Reference Code <span className="text-red-500">*</span>
                </label>
                <Input
                  className="h-10 border-zinc-200 rounded-lg text-sm bg-zinc-50 outline-none focus:ring-2 focus:ring-primary/20 text-zinc-800 font-medium"
                  placeholder={
                    refundPaymentMethod === "M-Pesa" ? "e.g. QJK2X8Y1P3" :
                    refundPaymentMethod === "Bank Transfer" ? "e.g. TXN-2026071800123" :
                    "e.g. AUTH-4912-XXXX"
                  }
                  value={refundReference}
                  onChange={(e) => setRefundReference(e.target.value)}
                />
                <p className="text-[10px] text-zinc-400 font-medium">
                  {refundPaymentMethod === "M-Pesa" && "Enter the M-Pesa confirmation code (e.g. QJK2X8Y1P3) from the transaction message."}
                  {refundPaymentMethod === "Bank Transfer" && "Enter the bank transaction/reference number from the transfer confirmation."}
                  {refundPaymentMethod === "Card Refund" && "Enter the card authorization or refund confirmation code from your payment processor."}
                </p>
              </div>
            )}

            {/* ── Refund Breakdown ── same calculation as the detail panel */}
            {selectedReturn?.order && (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 overflow-hidden text-xs">
                <div className="px-3 py-2 bg-zinc-100 border-b border-zinc-200 flex items-center justify-between">
                  <span className="font-black text-zinc-500 uppercase tracking-widest text-[10px]">Refund Breakdown</span>
                  <span className="font-bold text-zinc-700">{selectedReturn.order.tracking_number || `#ORD-${selectedReturn.order_id}`}</span>
                </div>
                <div className="px-3 py-2 space-y-1.5">
                  {(() => {
                    const allItems     = selectedReturn.order?.items ?? [];
                    const returnItemIds = (selectedReturn.return_items ?? []).map((ri: any) => ri.order_item_id);
                    // If no specific items listed → full order return
                    const returnedItems = returnItemIds.length > 0
                      ? allItems.filter((i: any) => returnItemIds.includes(i.id))
                      : allItems;

                    let productCost = 0;
                    let shippingShare = 0;
                    returnedItems.forEach((i: any) => {
                      const qty = selectedReturn.return_items?.find((ri: any) => ri.order_item_id === i.id)?.quantity ?? i.quantity;
                      productCost   += parseFloat(i.price ?? 0) * qty;
                      shippingShare += parseFloat(i.shipping_fee_per_unit ?? 0) * qty;
                    });
                    const refundTotal = productCost + shippingShare;

                    return (
                      <>
                        <div className="flex justify-between text-zinc-600">
                          <span>Product cost</span>
                          <span className="font-semibold">Ksh {productCost.toLocaleString("en-KE", { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-zinc-600">
                          <span>Shipping fee share</span>
                          <span className="font-semibold">Ksh {shippingShare.toLocaleString("en-KE", { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between border-t border-zinc-200 pt-1.5 mt-1">
                          <span className="font-black text-zinc-800">Total Refund Amount</span>
                          <span className={`font-black text-sm ${actionType === 'reject' ? 'text-red-500 line-through opacity-60' : 'text-emerald-600'}`}>
                            Ksh {refundTotal.toLocaleString("en-KE", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        {actionType === 'reject' && (
                          <p className="text-[10px] text-red-400 font-medium text-right">No refund will be issued</p>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {actionType === "approve" && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700 font-medium leading-relaxed">
                ⚡ {selectedReturn?.order?.status === "Delivered"
                  ? "This action authorizes the return request. The customer will be prompted to return the items to the origin warehouse."
                  : "This action will automatically: restore inventory quantities, update order status to 'Returned', and mark payment status as 'Refunded'."}
              </div>
            )}
            {actionType === "confirm_receipt" && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700 font-medium leading-relaxed">
                ⚡ This action confirms you have physically received the returned items back. It will automatically: restore inventory stock, deduct refund amounts, and update financial dashboards/reports.
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
                actionType === "approve" ? "bg-emerald-600 hover:bg-emerald-700 text-white" :
                actionType === "confirm_receipt" ? "bg-blue-600 hover:bg-blue-700 text-white" :
                "bg-red-600 hover:bg-red-700 text-white"
              )}
              disabled={processingId !== null}
              onClick={
                actionType === "approve" ? handleApprove :
                actionType === "confirm_receipt" ? handleConfirmReceipt :
                handleReject
              }
            >
              {processingId ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {actionType === "approve" ? "Yes, Approve" :
               actionType === "confirm_receipt" ? "Yes, Confirm & Refund" :
               "Yes, Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Return Details Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-2xl border-none shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="p-6 bg-zinc-50 border-b border-zinc-100">
            <DialogTitle className="font-bold text-zinc-900 flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-purple-600" />
              Edit Return Request — RET-{selectedReturn?.id}
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-500 font-medium">
              Update return details for evidence or correct human error.
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-4">
            {/* Read-only: customer-supplied fields */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-zinc-400 uppercase tracking-widest block flex items-center gap-1.5">
                Return Reason <span className="text-[9px] font-semibold text-zinc-300 normal-case tracking-normal">(customer-provided, read-only)</span>
              </label>
              <Input
                readOnly
                disabled
                className="h-10 border-zinc-100 rounded-lg text-sm bg-zinc-100 text-zinc-400 font-medium cursor-not-allowed opacity-70"
                value={editReason}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-zinc-400 uppercase tracking-widest block flex items-center gap-1.5">
                Explanation Details <span className="text-[9px] font-semibold text-zinc-300 normal-case tracking-normal">(customer-provided, read-only)</span>
              </label>
              <textarea
                readOnly
                disabled
                className="w-full h-20 px-3 py-2 border border-zinc-100 rounded-lg text-sm bg-zinc-100 text-zinc-400 resize-none cursor-not-allowed opacity-70"
                value={editExplanation}
              />
            </div>

            {/* Editable admin fields */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-zinc-500 uppercase tracking-widest block">Admin Notes</label>
              <textarea
                className="w-full h-20 px-3 py-2 border border-zinc-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-primary/20 resize-none text-zinc-800"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-zinc-500 uppercase tracking-widest block">
                Refund Payment Method
              </label>
              <select
                className="w-full h-10 px-3 border border-zinc-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-primary/20 text-zinc-800 font-medium"
                value={editPaymentMethod}
                onChange={(e) => { setEditPaymentMethod(e.target.value); setEditRefundReference(""); }}
              >
                <option value="">— Select payment method —</option>
                <option value="M-Pesa">M-Pesa</option>
                <option value="Cash">Cash Transfer / Handover</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Card Refund">Credit/Debit Card Refund</option>
              </select>
            </div>

            {editPaymentMethod && METHODS_NEEDING_REF.includes(editPaymentMethod) && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-zinc-500 uppercase tracking-widest block">
                  Transaction Reference Code <span className="text-red-500">*</span>
                </label>
                <Input
                  className="h-10 border-zinc-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-primary/20 text-zinc-800 font-medium"
                  placeholder={
                    editPaymentMethod === "M-Pesa" ? "e.g. QJK2X8Y1P3" :
                    editPaymentMethod === "Bank Transfer" ? "e.g. TXN-2026071800123" :
                    "e.g. AUTH-4912-XXXX"
                  }
                  value={editRefundReference}
                  onChange={(e) => setEditRefundReference(e.target.value)}
                />
                <p className="text-[10px] text-zinc-400 font-medium">
                  {editPaymentMethod === "M-Pesa" && "Enter the M-Pesa confirmation code from the transaction message."}
                  {editPaymentMethod === "Bank Transfer" && "Enter the bank transaction/reference number from the transfer confirmation."}
                  {editPaymentMethod === "Card Refund" && "Enter the card authorization or refund confirmation code."}
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="p-5 bg-zinc-50 border-t border-zinc-100 flex gap-3">
            <Button variant="outline" className="flex-1 font-bold" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
            <Button className="flex-1 font-black bg-primary text-white hover:bg-primary/90" onClick={handleEditUpdate} disabled={processingId !== null}>
              {processingId ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
