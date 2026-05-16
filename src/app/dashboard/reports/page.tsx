"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  FileText, Download, Package, Users, Receipt, Printer,
  Loader2, ClipboardList
} from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/lib/axios";

const STATUS_STYLES: Record<string, string> = {
  Pending:    "bg-amber-50 text-amber-700 border-amber-200",
  Processing: "bg-blue-50 text-blue-700 border-blue-200",
  Delivered:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  Cancelled:  "bg-red-50 text-red-700 border-red-200",
};

function DocumentHeader({ title, subtitle, period }: { title: string; subtitle: string; period: string }) {
  const now = new Date().toLocaleDateString("en-KE", { year: "numeric", month: "long", day: "numeric" });
  return (
    <div className="flex flex-col md:flex-row justify-between items-start gap-4 pb-5 border-b-2 border-zinc-900 mb-6 print:mb-4">
      <div>
        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">AutoSpare East Africa</p>
        <h2 className="text-2xl font-black text-zinc-900 tracking-tight">{title}</h2>
        <p className="text-sm text-zinc-500 mt-0.5">{subtitle}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Report Period</p>
        <p className="text-sm font-bold text-zinc-900 mt-0.5">{period}</p>
        <p className="text-[10px] text-zinc-400 mt-1">Generated: {now}</p>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4">
      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{label}</p>
      <p className="text-xl font-black text-zinc-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-zinc-500 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function AdminReportsPage() {
  const [orders, setOrders]       = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);

  const today = new Date().toISOString().split("T")[0];
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];

  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate]     = useState(today);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");

  useEffect(() => {
    Promise.all([
      api.get("/orders"),
      api.get("/inventory"),
      api.get("/customers"),
    ]).then(([o, i, c]) => {
      setOrders(o.data);
      setInventory(i.data);
      setCustomers(c.data);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filteredOrders = orders.filter(o => {
    if (!o.created_at) return true;
    const d = o.created_at.split("T")[0];
    return d >= startDate && d <= endDate;
  });

  const totalRevenue  = filteredOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const totalVAT      = totalRevenue * 0.16;
  const netRevenue    = totalRevenue - totalVAT;
  const periodLabel   = `${new Date(startDate).toLocaleDateString("en-KE", { day:"numeric", month:"short", year:"numeric" })} – ${new Date(endDate).toLocaleDateString("en-KE", { day:"numeric", month:"short", year:"numeric" })}`;

  const customerOrders = selectedCustomerId
    ? orders.filter(o => String(o.customer_id) === selectedCustomerId || String(o.customer?.id) === selectedCustomerId)
    : [];
  const selectedCustomer = customers.find(c => String(c.id) === selectedCustomerId);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-zinc-500 font-semibold text-sm">Compiling reports...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Reports</h1>
          <p className="text-zinc-500 text-sm mt-1">Professional business intelligence documents.</p>
        </div>
        <Button onClick={() => window.print()} className="bg-primary text-white hover:bg-primary/90 rounded-lg shadow-sm font-bold">
          <Printer className="mr-2 h-4 w-4" /> Print / Export PDF
        </Button>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden">
        <Tabs orientation="vertical" defaultValue="sales" className="flex flex-col md:flex-row w-full min-h-[700px]">

          {/* Sidebar */}
          <div className="w-full md:w-56 shrink-0 bg-zinc-50/50 border-b md:border-b-0 md:border-r border-zinc-200 p-3">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-3 pt-2 pb-3">Report Type</p>
            <TabsList className="flex flex-col h-auto w-full bg-transparent p-0 gap-0.5">
              {[
                { value: "sales",     icon: ClipboardList, label: "Sales Summary"       },
                { value: "inventory", icon: Package,       label: "Inventory Report"    },
                { value: "statement", icon: Users,         label: "Customer Statement"  },
                { value: "vat",       icon: Receipt,       label: "VAT / Tax Report"    },
              ].map(({ value, icon: Icon, label }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="w-full justify-start gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold text-zinc-500
                    data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-zinc-900 data-[state=active]:font-bold
                    hover:bg-white/70 hover:text-zinc-700 transition-all"
                >
                  <Icon className="h-4 w-4 shrink-0" /> {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* Content */}
          <div className="flex-1 p-6 md:p-8 overflow-y-auto">

            {/* ── Date Range Filter (shared) ── */}
            <div className="flex flex-wrap items-end gap-4 mb-8 p-4 bg-zinc-50 rounded-xl border border-zinc-200 print:hidden">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-zinc-500">From</Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-10 border-zinc-200 rounded-lg bg-white text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-zinc-500">To</Label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-10 border-zinc-200 rounded-lg bg-white text-sm" />
              </div>
              <div className="flex gap-2">
                {[
                  { label: "Today", fn: () => { setStartDate(today); setEndDate(today); } },
                  { label: "This Month", fn: () => { setStartDate(firstOfMonth); setEndDate(today); } },
                ].map(b => (
                  <Button key={b.label} variant="outline" onClick={b.fn} className="h-10 rounded-lg border-zinc-200 font-bold text-xs">
                    {b.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* ── TAB 1: Sales Summary ── */}
            <TabsContent value="sales" className="mt-0 space-y-6">
              <DocumentHeader title="Sales Summary Report" subtitle="All confirmed orders within the selected period" period={periodLabel} />

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SummaryCard label="Total Orders"   value={String(filteredOrders.length)} />
                <SummaryCard label="Gross Revenue"  value={`Ksh ${totalRevenue.toLocaleString()}`} />
                <SummaryCard label="VAT Collected"  value={`Ksh ${totalVAT.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} sub="16% standard rate" />
                <SummaryCard label="Net Revenue"    value={`Ksh ${netRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
              </div>

              <div className="rounded-xl border border-zinc-200 overflow-hidden">
                <Table>
                  <TableHeader className="bg-zinc-50/50">
                    <TableRow>
                      <TableHead className="px-6 font-bold text-zinc-900">Order Ref</TableHead>
                      <TableHead className="font-bold text-zinc-900">Client</TableHead>
                      <TableHead className="font-bold text-zinc-900">Date</TableHead>
                      <TableHead className="font-bold text-zinc-900">Status</TableHead>
                      <TableHead className="font-bold text-zinc-900 text-right">Amount (Ksh)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="h-32 text-center text-zinc-400 text-sm">No orders in this period.</TableCell></TableRow>
                    ) : filteredOrders.map((o, i) => (
                      <TableRow key={i} className="hover:bg-zinc-50/50">
                        <TableCell className="px-6 font-bold text-zinc-800 font-mono text-xs">
                          {o.tracking_number || `#ORD-${String(o.id).padStart(4, "0")}`}
                        </TableCell>
                        <TableCell className="font-semibold text-zinc-700">{o.customer?.name || "—"}</TableCell>
                        <TableCell className="text-zinc-500 text-sm">
                          {o.created_at ? new Date(o.created_at).toLocaleDateString("en-KE") : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("text-[10px] font-bold px-2.5 rounded-full uppercase border", STATUS_STYLES[o.status] || "bg-zinc-50 text-zinc-600 border-zinc-200")}>
                            {o.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-black text-zinc-900">
                          {Number(o.total_amount).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredOrders.length > 0 && (
                      <TableRow className="bg-zinc-100">
                        <TableCell colSpan={4} className="px-6 font-black text-zinc-900 text-sm">TOTAL</TableCell>
                        <TableCell className="text-right font-black text-zinc-900">Ksh {totalRevenue.toLocaleString()}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* ── TAB 2: Inventory Report ── */}
            <TabsContent value="inventory" className="mt-0 space-y-6">
              <DocumentHeader title="Inventory Status Report" subtitle="Current stock levels across all warehouses" period={`As of ${new Date().toLocaleDateString("en-KE")}`} />

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <SummaryCard label="Total SKUs"    value={String(inventory.length)} />
                <SummaryCard label="Low Stock"     value={String(inventory.filter(i => i.quantity <= 5 && i.quantity > 0).length)} sub="≤ 5 units" />
                <SummaryCard label="Out of Stock"  value={String(inventory.filter(i => i.quantity === 0).length)} />
              </div>

              <div className="rounded-xl border border-zinc-200 overflow-hidden">
                <Table>
                  <TableHeader className="bg-zinc-50/50">
                    <TableRow>
                      <TableHead className="px-6 font-bold text-zinc-900">SKU</TableHead>
                      <TableHead className="font-bold text-zinc-900">Product</TableHead>
                      <TableHead className="font-bold text-zinc-900">Warehouse</TableHead>
                      <TableHead className="font-bold text-zinc-900 text-right">Qty</TableHead>
                      <TableHead className="font-bold text-zinc-900 text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventory.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="h-32 text-center text-zinc-400 text-sm">No inventory data.</TableCell></TableRow>
                    ) : inventory.map((item, i) => {
                      const qty = Number(item.quantity);
                      const status = qty === 0 ? "Out of Stock" : qty <= 5 ? "Low Stock" : "In Stock";
                      const statusCls = qty === 0
                        ? "bg-red-50 text-red-700 border-red-200"
                        : qty <= 5
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200";
                      return (
                        <TableRow key={i} className="hover:bg-zinc-50/50">
                          <TableCell className="px-6 font-bold text-zinc-800 font-mono text-xs">{item.product?.sku || "—"}</TableCell>
                          <TableCell className="font-semibold text-zinc-700">{item.product?.name || "—"}</TableCell>
                          <TableCell className="text-zinc-500 text-sm">{item.warehouse?.name || "—"}</TableCell>
                          <TableCell className="text-right font-black text-zinc-900">{qty}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={cn("text-[10px] font-bold px-2.5 rounded-full uppercase border", statusCls)}>
                              {status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* ── TAB 3: Customer Statement ── */}
            <TabsContent value="statement" className="mt-0 space-y-6">
              <DocumentHeader
                title="Customer Account Statement"
                subtitle={selectedCustomer ? `Account: ${selectedCustomer.name}` : "Select a customer to generate statement"}
                period={periodLabel}
              />

              <div className="flex items-end gap-4 print:hidden">
                <div className="space-y-1.5 w-72">
                  <Label className="text-xs font-semibold text-zinc-500">Select Customer</Label>
                  <select
                    value={selectedCustomerId}
                    onChange={e => setSelectedCustomerId(e.target.value)}
                    className="h-10 w-full px-3 border border-zinc-200 rounded-lg text-sm font-medium bg-white outline-none focus:ring-2 focus:ring-primary/20 text-zinc-700"
                  >
                    <option value="">— Choose a customer —</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedCustomer && (
                <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div><p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Account Name</p><p className="font-bold text-zinc-900 mt-0.5">{selectedCustomer.name}</p></div>
                  <div><p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Account No.</p><p className="font-bold text-zinc-900 mt-0.5">ACC-{String(selectedCustomer.id).padStart(4, "0")}</p></div>
                  <div><p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Contact</p><p className="font-bold text-zinc-900 mt-0.5">{selectedCustomer.phone || selectedCustomer.email || "—"}</p></div>
                </div>
              )}

              {selectedCustomerId ? (
                <div className="rounded-xl border border-zinc-200 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-zinc-50/50">
                      <TableRow>
                        <TableHead className="px-6 font-bold text-zinc-900">Invoice #</TableHead>
                        <TableHead className="font-bold text-zinc-900">Date</TableHead>
                        <TableHead className="font-bold text-zinc-900">Description</TableHead>
                        <TableHead className="font-bold text-zinc-900 text-center">Status</TableHead>
                        <TableHead className="font-bold text-zinc-900 text-right">Amount (Ksh)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customerOrders.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="h-32 text-center text-zinc-400 text-sm">No orders found for this customer.</TableCell></TableRow>
                      ) : customerOrders.map((o, i) => (
                        <TableRow key={i} className="hover:bg-zinc-50/50">
                          <TableCell className="px-6 font-bold text-zinc-800 font-mono text-xs">{o.tracking_number || `#ORD-${String(o.id).padStart(4, "0")}`}</TableCell>
                          <TableCell className="text-zinc-500 text-sm">{o.created_at ? new Date(o.created_at).toLocaleDateString("en-KE") : "—"}</TableCell>
                          <TableCell className="text-zinc-600 text-sm">Parts Order — {o.items?.length || 0} line item(s)</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={cn("text-[10px] font-bold px-2.5 rounded-full uppercase border", STATUS_STYLES[o.status] || "bg-zinc-50 text-zinc-600 border-zinc-200")}>
                              {o.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-black text-zinc-900">{Number(o.total_amount).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                      {customerOrders.length > 0 && (
                        <TableRow className="bg-zinc-100">
                          <TableCell colSpan={4} className="px-6 font-black text-zinc-900 text-sm">ACCOUNT TOTAL</TableCell>
                          <TableCell className="text-right font-black text-zinc-900">
                            Ksh {customerOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center border border-dashed border-zinc-300 rounded-xl">
                  <div className="text-center space-y-2">
                    <Users className="h-8 w-8 text-zinc-300 mx-auto" />
                    <p className="text-zinc-400 text-sm font-medium">Select a customer above to load their statement</p>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ── TAB 4: VAT / Tax Report ── */}
            <TabsContent value="vat" className="mt-0 space-y-6">
              <DocumentHeader title="VAT / Tax Summary Report" subtitle="Breakdown of taxable sales for KRA filing" period={periodLabel} />

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SummaryCard label="Gross Sales"     value={`Ksh ${totalRevenue.toLocaleString()}`} />
                <SummaryCard label="Taxable Amount"  value={`Ksh ${totalRevenue.toLocaleString()}`} sub="All sales are taxable" />
                <SummaryCard label="VAT @ 16%"       value={`Ksh ${totalVAT.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
                <SummaryCard label="Net (ex-VAT)"    value={`Ksh ${netRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
              </div>

              <div className="rounded-xl border border-zinc-200 overflow-hidden">
                <Table>
                  <TableHeader className="bg-zinc-50/50">
                    <TableRow>
                      <TableHead className="px-6 font-bold text-zinc-900">Invoice #</TableHead>
                      <TableHead className="font-bold text-zinc-900">Date</TableHead>
                      <TableHead className="font-bold text-zinc-900">Client</TableHead>
                      <TableHead className="font-bold text-zinc-900 text-right">Gross (Ksh)</TableHead>
                      <TableHead className="font-bold text-zinc-900 text-right">VAT 16% (Ksh)</TableHead>
                      <TableHead className="font-bold text-zinc-900 text-right">Net (Ksh)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="h-32 text-center text-zinc-400 text-sm">No taxable transactions in this period.</TableCell></TableRow>
                    ) : filteredOrders.map((o, i) => {
                      const gross = Number(o.total_amount || 0);
                      const vat   = gross * 0.16;
                      const net   = gross - vat;
                      return (
                        <TableRow key={i} className="hover:bg-zinc-50/50">
                          <TableCell className="px-6 font-bold text-zinc-800 font-mono text-xs">{o.tracking_number || `#ORD-${String(o.id).padStart(4, "0")}`}</TableCell>
                          <TableCell className="text-zinc-500 text-sm">{o.created_at ? new Date(o.created_at).toLocaleDateString("en-KE") : "—"}</TableCell>
                          <TableCell className="font-semibold text-zinc-700">{o.customer?.name || "—"}</TableCell>
                          <TableCell className="text-right font-semibold text-zinc-800">{gross.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-semibold text-amber-700">{vat.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                          <TableCell className="text-right font-semibold text-emerald-700">{net.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredOrders.length > 0 && (
                      <TableRow className="bg-zinc-100">
                        <TableCell colSpan={3} className="px-6 font-black text-zinc-900 text-sm">TOTALS</TableCell>
                        <TableCell className="text-right font-black text-zinc-900">{totalRevenue.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-black text-amber-700">{totalVAT.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                        <TableCell className="text-right font-black text-emerald-700">{netRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <p className="text-xs text-zinc-400 border-t border-zinc-200 pt-4">
                VAT is calculated at the standard rate of 16% as per the Kenya Revenue Authority (KRA) guidelines.
                KRA PIN on file via System Settings.
              </p>
            </TabsContent>

          </div>
        </Tabs>
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          .print\\:hidden { display: none !important; }
          body { background: white; }
          header, nav, aside { display: none !important; }
        }
      `}</style>
    </div>
  );
}
