"use client";

import { useEffect, useState, useMemo } from "react";
import api from "@/lib/axios";
import { toast } from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  RotateCcw, CheckCircle2, XCircle, Loader2, Search,
  Filter, RefreshCw, Eye, ChevronRight, AlertCircle
} from "lucide-react";

interface ReturnRequest {
  id: number;
  order_id: number;
  reason: string;
  explanation?: string;
  status: "Pending" | "Approved" | "Rejected";
  admin_notes?: string;
  created_at: string;
  updated_at: string;
  order?: {
    tracking_number: string;
    total_amount: number;
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
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedReturn, setSelectedReturn] = useState<ReturnRequest | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [processingId, setProcessingId] = useState<number | null>(null);

  const fetchReturns = async () => {
    setLoading(true);
    try {
      const res = await api.get("/returns");
      setReturns(res.data);
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
      const matchesStatus = statusFilter === "All" || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [returns, searchQuery, statusFilter]);

  const pendingCount = returns.filter(r => r.status === "Pending").length;

  const handleApprove = async () => {
    if (!selectedReturn) return;
    setProcessingId(selectedReturn.id);
    try {
      await api.post(`/returns/${selectedReturn.id}/approve`, { admin_notes: adminNotes });
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
      await api.post(`/returns/${selectedReturn.id}/reject`, { admin_notes: adminNotes });
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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 flex items-center gap-3">
            <RotateCcw className="h-7 w-7 text-purple-600" />
            Returns & Refund Requests
          </h1>
          <p className="text-zinc-500 text-sm mt-1">Review and process customer return requests submitted post-delivery.</p>
        </div>
        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-700 font-black text-xs px-3 py-1.5 rounded-full border border-amber-200 uppercase tracking-wider animate-pulse">
              <AlertCircle className="h-3.5 w-3.5" />
              {pendingCount} Pending Review
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchReturns}
            disabled={loading}
            className="font-bold gap-1.5"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-zinc-100 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input
            placeholder="Search by Ref, Customer, Reason..."
            className="pl-9 h-11 border-zinc-200 focus-visible:ring-purple-400 rounded-lg text-sm font-medium bg-zinc-50/50"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select
          className="h-11 px-3 border border-zinc-200 rounded-lg text-sm font-semibold bg-white outline-none focus:ring-2 focus:ring-purple-300 text-zinc-700 min-w-[160px]"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          {["All", "Pending", "Approved", "Rejected"].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {(searchQuery || statusFilter !== "All") && (
          <Button
            variant="outline"
            className="h-11 font-bold text-sm"
            onClick={() => { setSearchQuery(""); setStatusFilter("All"); }}
          >
            <Filter className="h-4 w-4 mr-1.5" /> Clear
          </Button>
        )}
      </div>

      {/* Returns Table */}
      <div className="bg-white rounded-xl shadow-sm border border-zinc-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-zinc-500">
            <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
            <span className="font-semibold text-sm">Loading return requests...</span>
          </div>
        ) : filteredReturns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-500 space-y-2">
            <RotateCcw className="h-10 w-10 text-zinc-300" />
            <p className="font-bold text-sm">No return requests found.</p>
            <p className="text-xs text-zinc-400">Customers can request returns for delivered orders within the return window.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-zinc-50 border-b border-zinc-100">
                  <TableHead className="font-black text-zinc-500 text-[11px] uppercase tracking-wider px-5">Return Ref</TableHead>
                  <TableHead className="font-black text-zinc-500 text-[11px] uppercase tracking-wider">Order Ref</TableHead>
                  <TableHead className="font-black text-zinc-500 text-[11px] uppercase tracking-wider">Customer</TableHead>
                  <TableHead className="font-black text-zinc-500 text-[11px] uppercase tracking-wider">Reason</TableHead>
                  <TableHead className="font-black text-zinc-500 text-[11px] uppercase tracking-wider">Date Filed</TableHead>
                  <TableHead className="font-black text-zinc-500 text-[11px] uppercase tracking-wider text-center">Status</TableHead>
                  <TableHead className="font-black text-zinc-500 text-[11px] uppercase tracking-wider text-right px-5">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReturns.map(ret => (
                  <TableRow key={ret.id} className="border-b border-zinc-50 hover:bg-zinc-50/50 transition-colors">
                    <TableCell className="px-5 py-4">
                      <span className="text-xs font-black text-purple-600">RET-{ret.id}</span>
                    </TableCell>
                    <TableCell className="py-4">
                      <span className="text-sm font-bold text-zinc-800">
                        {ret.order?.tracking_number || `#${ret.order_id}`}
                      </span>
                    </TableCell>
                    <TableCell className="py-4">
                      <div>
                        <p className="text-sm font-semibold text-zinc-800">{ret.order?.customer?.name || "—"}</p>
                        <p className="text-xs text-zinc-400 font-medium">{ret.order?.customer?.phone || ret.order?.customer?.email || ""}</p>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div>
                        <p className="text-sm font-semibold text-zinc-700 max-w-[200px] leading-tight">{ret.reason}</p>
                        {ret.explanation && (
                          <p className="text-xs text-zinc-400 mt-0.5 line-clamp-1" title={ret.explanation}>
                            {ret.explanation}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-4 text-xs font-medium text-zinc-500">
                      {new Date(ret.created_at).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                    </TableCell>
                    <TableCell className="py-4 text-center">
                      <Badge className={cn(
                        "rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase border-none tracking-wider",
                        ret.status === "Approved" ? "bg-emerald-500 text-white" :
                        ret.status === "Rejected" ? "bg-red-600 text-white" :
                        "bg-amber-400 text-amber-950"
                      )}>
                        {ret.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4 px-5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setSelectedReturn(ret); setIsDetailModalOpen(true); }}
                          className="h-8 w-8 p-0 rounded-lg hover:bg-zinc-100 text-zinc-500"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {ret.status === "Pending" && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => openAction(ret, "approve")}
                              className="h-8 px-3 text-[11px] font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => openAction(ret, "reject")}
                              className="h-8 px-3 text-[11px] font-black bg-red-600 hover:bg-red-700 text-white rounded-lg"
                            >
                              <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
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
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-0.5">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Order Reference</p>
                  <p className="font-bold text-zinc-800">{selectedReturn.order?.tracking_number}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Order Status</p>
                  <Badge className="rounded-full px-2 py-0.5 text-[9px] font-black border-none bg-emerald-100 text-emerald-800 uppercase">
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
                  <p className="font-bold text-zinc-800">Ksh {Number(selectedReturn.order?.total_amount || 0).toLocaleString()}</p>
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

              {selectedReturn.order?.items && (
                <div>
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Items in Order</p>
                  <div className="space-y-1">
                    {selectedReturn.order.items.map((item: any, i: number) => (
                      <div key={i} className="flex justify-between text-xs py-1.5 border-b border-zinc-100 last:border-0">
                        <span className="font-semibold text-zinc-700">{item.product?.name || "Part"}</span>
                        <span className="text-zinc-500 font-medium">QTY: {item.quantity} × Ksh {Number(item.price).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
                  selectedReturn.status === "Rejected" ? "bg-red-600 text-white" :
                  "bg-amber-400 text-amber-950"
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
                className="w-full h-24 px-3 py-2 border border-zinc-200 rounded-lg text-sm bg-zinc-50 outline-none focus:ring-2 focus:ring-blue-200 resize-none"
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
              Cancel
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
              {actionType === "approve" ? "Confirm Approval" : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
