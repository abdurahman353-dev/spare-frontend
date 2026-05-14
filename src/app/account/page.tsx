"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Package, Clock, Settings, ShoppingBag, MapPin, CreditCard, 
  ChevronRight, LogOut, Loader2, User, Lock, ShieldCheck,
  Eye, EyeOff, CheckCircle2, AlertCircle, Plus, Home, Smartphone,
  Search, Printer, Download, ArrowRightLeft
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/lib/axios";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useSearchParams, useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "react-hot-toast";

import { Suspense } from "react";

function AccountPortalInner() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Dashboard");

  // Modals state
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [isDeleteAddressModalOpen, setIsDeleteAddressModalOpen] = useState(false);
  const [hiddenAddresses, setHiddenAddresses] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("spare_hidden_addresses");
    if (saved) setHiddenAddresses(JSON.parse(saved));
  }, []);

  // Password Change State
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    current_password: "",
    password: "",
    password_confirmation: ""
  });
  const [passwordStatus, setPasswordStatus] = useState({ loading: false, success: false, error: "" });

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "orders") setActiveTab("My Orders");
    if (tab === "settings") setActiveTab("Account Settings");
    if (tab === "address") setActiveTab("Delivery Addresses");
    if (tab === "payment") setActiveTab("Payment Methods");
  }, [searchParams]);

  useEffect(() => {
    api.get("/my-orders")
      .then(res => {
        setOrders(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.password !== passwordData.password_confirmation) {
      setPasswordStatus({ loading: false, success: false, error: "New passwords do not match." });
      return;
    }

    setPasswordStatus({ loading: true, success: false, error: "" });

    try {
      await api.post("/change-password", passwordData);
      setPasswordStatus({ loading: false, success: true, error: "" });
      
      setTimeout(async () => {
        await logout();
        router.push("/login");
      }, 2000);
    } catch (err: any) {
      setPasswordStatus({ 
        loading: false, 
        success: false, 
        error: err.response?.data?.message || "Verification failed. Please check your current password." 
      });
    }
  };

  const downloadStatement = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Order ID,Date,Items,Status,Settlement\n";
    orders.forEach((order: any) => {
      const date = new Date(order.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
      const items = order.items?.length || 0;
      csvContent += `#ORD-${order.id},${date},${items},${order.status},Ksh ${order.total_amount}\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "AutoSpare_Orders_Statement.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalSpent = orders.reduce((sum: number, order: any) => sum + Number(order.total_amount), 0);
  const activeOrders = orders.filter((o: any) => o.status !== "Delivered").length;

  const tabs = [
    { name: "Dashboard", icon: Package },
    { name: "My Orders", icon: ShoppingBag },
    { name: "Delivery Addresses", icon: MapPin },
    { name: "Account Settings", icon: Settings },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-white font-sans text-slate-900">
      <Navbar />
      
      <main className="flex-1 py-10">
        <div className="container mx-auto px-6 max-w-7xl">
          
          {/* Header Section - Matching Image 1 Style */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-[#1e293b]">
                Welcome Back, {user?.name.split(' ')[0]}
              </h1>
              <p className="text-[#64748b] text-[15px] mt-1">Manage your orders and account preferences.</p>
            </div>
            <div className="flex items-center gap-3">
               <div className="bg-[#0052cc] text-white px-4 py-2 rounded-md font-semibold text-xs uppercase tracking-wider flex items-center gap-2 shadow-sm">
                Platinum Customer
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Sidebar - Clean Style */}
            <div className="lg:col-span-3 space-y-1">
              <p className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-widest mb-4 ml-2">Account Portal</p>
              {tabs.map((item) => (
                <button 
                  key={item.name}
                  onClick={() => setActiveTab(item.name)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-200 group text-[14px] font-medium",
                    activeTab === item.name 
                    ? "bg-[#f1f5f9] text-[#0052cc]" 
                    : "text-[#64748b] hover:bg-[#f8fafc] hover:text-[#1e293b]"
                  )}
                >
                  <item.icon className={cn("h-4 w-4", activeTab === item.name ? "text-[#0052cc]" : "text-[#94a3b8]")} />
                  <span>{item.name}</span>
                </button>
              ))}
              
              <div className="pt-6 mt-6 border-t border-[#f1f5f9]">
                 <button 
                  onClick={logout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-md text-[#ef4444] hover:bg-red-50 text-[14px] font-medium transition-all"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="lg:col-span-9">
              <AnimatePresence mode="wait">
                {activeTab === "Dashboard" && (
                  <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="space-y-8"
                  >
                    {/* Stats Grid - Matching Image 1 Cleanliness */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {[
                        { label: "Active Orders", value: activeOrders.toString(), color: "text-blue-600" },
                        { label: "Total Spent", value: `Ksh ${totalSpent.toLocaleString()}`, color: "text-slate-900" },
                        { label: "Parts Purchased", value: orders.length.toString(), color: "text-slate-900" },
                      ].map((stat, idx) => (
                        <div key={idx} className="bg-white p-6 rounded-lg border border-[#e2e8f0] shadow-sm">
                          <p className="text-[12px] font-semibold text-[#64748b] uppercase tracking-wider mb-2">{stat.label}</p>
                          <p className={cn("text-2xl font-bold", stat.color)}>{stat.value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Content Table Area */}
                    <div className="bg-white rounded-lg border border-[#e2e8f0] shadow-sm overflow-hidden">
                      <div className="px-6 py-5 border-b border-[#e2e8f0] flex items-center justify-between">
                        <h2 className="text-[16px] font-bold text-[#1e293b]">Recent Logistics History</h2>
                        <button onClick={() => setActiveTab("My Orders")} className="text-[12px] font-bold text-[#0052cc] hover:underline uppercase tracking-wider">Explore All</button>
                      </div>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead className="bg-[#f8fafc] text-[11px] uppercase tracking-wider font-bold text-[#64748b] border-b border-[#e2e8f0]">
                            <tr>
                              <th className="px-6 py-4">Order ID</th>
                              <th className="px-6 py-4">Date</th>
                              <th className="px-6 py-4">Items</th>
                              <th className="px-6 py-4">Status</th>
                              <th className="px-6 py-4">Total Amount</th>
                              <th className="px-6 py-4 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#f1f5f9]">
                            {loading ? (
                              <tr><td colSpan={6} className="p-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#64748b]" /></td></tr>
                            ) : orders.length === 0 ? (
                              <tr><td colSpan={6} className="p-10 text-center text-[#64748b]">No order history found.</td></tr>
                            ) : (
                              orders.slice(0, 5).map((order: any) => (
                                <tr key={order.id} className="hover:bg-[#f8fafc] transition-colors">
                                  <td className="px-6 py-4 text-[14px] font-medium text-[#1e293b]">#ORD-{order.id}</td>
                                  <td className="px-6 py-4 text-[13px] text-[#64748b]">
                                    {new Date(order.created_at).toLocaleDateString()}
                                  </td>
                                  <td className="px-6 py-4 text-[13px] text-[#64748b]">
                                    {order.items?.length || 0} PCS
                                  </td>
                                  <td className="px-6 py-4">
                                    <span className={cn(
                                      "text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider",
                                      order.status === "Pending" ? "bg-[#fffbeb] text-[#92400e]" : 
                                      (order.status === "Processing" || order.status === "Shipped") ? "bg-[#eff6ff] text-[#1e40af]" : 
                                      "bg-[#f0fdf4] text-[#166534]"
                                    )}>
                                      {order.status}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-[14px] font-semibold text-[#1e293b]">Ksh {Number(order.total_amount).toLocaleString()}</td>
                                  <td className="px-6 py-4 text-right">
                                    <button 
                                      onClick={() => { setSelectedOrder(order); setIsOrderModalOpen(true); }}
                                      className="text-[#0052cc] hover:text-[#0747a6] font-bold text-[13px] hover:underline"
                                    >
                                      Inspect
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === "Account Settings" && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                    <Card className="border-[#e2e8f0] shadow-sm rounded-lg overflow-hidden">
                      <CardHeader className="px-6 py-5 border-b border-[#e2e8f0]">
                        <CardTitle className="text-lg font-bold text-[#1e293b]">Profile Information</CardTitle>
                      </CardHeader>
                      <CardContent className="p-6 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-1.5">
                            <label className="text-[12px] font-bold text-[#64748b] uppercase tracking-wider">Full Name</label>
                            <Input value={user?.name || ""} readOnly className="bg-[#f8fafc] border-[#e2e8f0] text-[#1e293b]" />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[12px] font-bold text-[#64748b] uppercase tracking-wider">Email Address</label>
                            <Input value={user?.email || ""} readOnly className="bg-[#f8fafc] border-[#e2e8f0] text-[#1e293b]" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-[#e2e8f0] shadow-sm rounded-lg overflow-hidden">
                      <CardHeader className="px-6 py-5 border-b border-[#e2e8f0]">
                        <CardTitle className="text-lg font-bold text-[#1e293b]">Security Settings</CardTitle>
                      </CardHeader>
                      <CardContent className="p-6">
                        <form onSubmit={handlePasswordChange} className="space-y-6">
                          {passwordStatus.error && (
                            <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-md flex items-center gap-2">
                              <AlertCircle className="h-4 w-4" /> {passwordStatus.error}
                            </div>
                          )}
                          {passwordStatus.success && (
                            <div className="p-3 bg-green-50 text-green-600 text-xs font-bold rounded-md flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4" /> Password synchronized. Redirecting to login...
                            </div>
                          )}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-1.5">
                              <label className="text-[12px] font-bold text-[#64748b] uppercase tracking-wider">Current Password</label>
                              <div className="relative">
                                <Input type={showCurrentPassword ? "text" : "password"} required className="border-[#e2e8f0] pr-10" value={passwordData.current_password} onChange={(e) => setPasswordData({...passwordData, current_password: e.target.value})} />
                                <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)} className="absolute right-3 top-2.5 text-[#94a3b8] hover:text-[#64748b]">
                                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[12px] font-bold text-[#64748b] uppercase tracking-wider">New Password</label>
                              <div className="relative">
                                <Input type={showNewPassword ? "text" : "password"} required className="border-[#e2e8f0] pr-10" value={passwordData.password} onChange={(e) => setPasswordData({...passwordData, password: e.target.value})} />
                                <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-2.5 text-[#94a3b8] hover:text-[#64748b]">
                                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[12px] font-bold text-[#64748b] uppercase tracking-wider">Confirm New Password</label>
                              <div className="relative">
                                <Input type={showConfirmPassword ? "text" : "password"} required className="border-[#e2e8f0] pr-10" value={passwordData.password_confirmation} onChange={(e) => setPasswordData({...passwordData, password_confirmation: e.target.value})} />
                                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-2.5 text-[#94a3b8] hover:text-[#64748b]">
                                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                              </div>
                            </div>
                          </div>
                          <div className="flex justify-end">
                            <Button type="submit" disabled={passwordStatus.loading} className="bg-[#0052cc] hover:bg-[#0747a6] text-white px-6 font-bold text-[13px] rounded-md">
                              {passwordStatus.loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Update Password"}
                            </Button>
                          </div>
                        </form>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {activeTab === "My Orders" && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                    <div className="bg-white rounded-lg border border-[#e2e8f0] shadow-sm overflow-hidden">
                      <div className="px-6 py-5 border-b border-[#e2e8f0] flex items-center justify-between">
                        <h2 className="text-[16px] font-bold text-[#1e293b]">Full Order Ledger</h2>
                        <div className="flex gap-2">
                           <Button variant="outline" size="sm" onClick={() => window.print()} className="border-[#e2e8f0] text-[12px] font-bold text-[#64748b] uppercase tracking-wider h-9 px-4">
                            <Printer className="h-4 w-4 mr-2" /> Print
                          </Button>
                          <Button onClick={downloadStatement} size="sm" className="bg-[#0052cc] hover:bg-[#0747a6] text-[12px] font-bold text-white uppercase tracking-wider h-9 px-4">
                            <Download className="h-4 w-4 mr-2" /> Export
                          </Button>
                        </div>
                      </div>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead className="bg-[#f8fafc] text-[11px] uppercase tracking-wider font-bold text-[#64748b] border-b border-[#e2e8f0]">
                            <tr>
                              <th className="px-6 py-4">Order ID</th>
                              <th className="px-6 py-4">Date</th>
                              <th className="px-6 py-4">Items</th>
                              <th className="px-6 py-4">Status</th>
                              <th className="px-6 py-4">Total Amount</th>
                              <th className="px-6 py-4 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#f1f5f9]">
                            {loading ? (
                              <tr><td colSpan={6} className="p-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#64748b]" /></td></tr>
                            ) : orders.map((order: any) => (
                                <tr key={order.id} className="hover:bg-[#f8fafc] transition-colors">
                                  <td className="px-6 py-4 text-[14px] font-medium text-[#1e293b]">#ORD-{order.id}</td>
                                  <td className="px-6 py-4 text-[13px] text-[#64748b]">
                                    {new Date(order.created_at).toLocaleDateString()}
                                  </td>
                                  <td className="px-6 py-4 text-[13px] text-[#64748b]">
                                    {order.items?.length || 0} PCS
                                  </td>
                                  <td className="px-6 py-4">
                                    <span className={cn(
                                      "text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider",
                                      order.status === "Pending" ? "bg-[#fffbeb] text-[#92400e]" : 
                                      (order.status === "Processing" || order.status === "Shipped") ? "bg-[#eff6ff] text-[#1e40af]" : 
                                      "bg-[#f0fdf4] text-[#166534]"
                                    )}>
                                      {order.status}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-[14px] font-semibold text-[#1e293b]">Ksh {Number(order.total_amount).toLocaleString()}</td>
                                  <td className="px-6 py-4 text-right">
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      onClick={() => { setSelectedOrder(order); setIsOrderModalOpen(true); }}
                                      className="text-[#0052cc] hover:text-[#0747a6] font-bold text-[13px] hover:underline"
                                    >
                                      Inspect
                                    </Button>
                                  </td>
                                </tr>
                              ))
                            }
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === "Delivery Addresses" && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                    <Card className="border-[#e2e8f0] shadow-sm rounded-lg overflow-hidden">
                      <CardHeader className="px-6 py-5 border-b border-[#e2e8f0]">
                        <CardTitle className="text-lg font-bold text-[#1e293b]">Verified Shipping Destinations</CardTitle>
                      </CardHeader>
                      <CardContent className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {orders.length === 0 ? (
                            <div className="col-span-2 text-center py-10 text-[#64748b] bg-[#f8fafc] rounded-lg border border-dashed">
                              No shipping destinations recorded yet.
                            </div>
                          ) : (
                            // Extract unique locations from orders
                            Array.from(new Set(orders.map((o: any) => `${o.shipping_city}|${o.shipping_address}`)))
                              .filter(loc => !hiddenAddresses.includes(loc))
                              .slice(0, 4) // Show top 4 unique locations
                              .map((locString: string, idx: number) => {
                                const [city, address] = locString.split('|');
                                return (
                                  <div key={idx} className="border border-[#e2e8f0] rounded-lg p-5 bg-[#f8fafc] relative">
                                     {idx === 0 && <div className="absolute top-3 right-3 text-[#166534] bg-[#f0fdf4] text-[10px] font-bold px-2 py-0.5 rounded uppercase">Latest</div>}
                                     <h3 className="font-bold text-[#1e293b] mb-1">{city}</h3>
                                     <p className="text-[#64748b] text-[13px] mb-4">
                                        {address}<br/>
                                        {city}, Kenya
                                     </p>
                                     <div className="flex gap-2">
                                       <button 
                                         onClick={() => {
                                           localStorage.setItem("spare_prefill_shipping", JSON.stringify({ city, address }));
                                           toast.success(`Shipping to ${city} selected!`, {
                                             style: { background: '#0052cc', color: '#fff', fontWeight: 'bold' }
                                           });
                                         }}
                                         className="text-[12px] font-bold text-[#0052cc] hover:underline"
                                       >
                                         Select for Order
                                       </button>
                                       <button 
                                         onClick={() => {
                                           const updated = [...hiddenAddresses, locString];
                                           setHiddenAddresses(updated);
                                           localStorage.setItem("spare_hidden_addresses", JSON.stringify(updated));
                                           toast.error(`Destination removed`, {
                                             style: { background: '#ef4444', color: '#fff', fontWeight: 'bold' }
                                           });
                                         }}
                                         className="text-[12px] font-bold text-red-600 hover:underline"
                                       >
                                         Remove
                                       </button>
                                     </div>
                                  </div>
                                );
                              })
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}



              </AnimatePresence>

              {/* Support Banner - Blue as requested */}
              <div className="bg-[#0052cc] p-10 rounded-lg relative overflow-hidden mt-8 shadow-md">
                <div className="relative z-10">
                  <h3 className="text-2xl font-bold text-white mb-2 tracking-tight">Need assistance with your parts?</h3>
                  <p className="text-white/80 text-[15px] max-w-md mb-6 font-medium">Our expert team is available 24/7 to help you find the exact genuine part for your Mercedes-Benz.</p>
                  <Button className="bg-white text-[#0052cc] hover:bg-slate-50 font-bold px-6 py-2 rounded-md transition-all shadow-sm">
                    Contact Support
                  </Button>
                </div>
                <div className="absolute -right-10 -bottom-10 opacity-10 rotate-12">
                   <Package className="h-60 w-60 text-white" />
                </div>
              </div>

            </div>
          </div>
        </div>
      </main>

      <Footer />

      {/* Reusable Modals - Matching Clean Style */}
      <Dialog open={isOrderModalOpen} onOpenChange={setIsOrderModalOpen}>
        <DialogContent className="sm:max-w-[550px] p-0 rounded-lg overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 bg-white border-b border-[#e2e8f0]">
             <DialogTitle className="text-xl font-bold text-[#1e293b]">Order Details #{selectedOrder?.id}</DialogTitle>
             <DialogDescription className="text-[#64748b] font-medium text-sm">
               Placed on {selectedOrder ? new Date(selectedOrder.created_at).toLocaleDateString() : ''}
             </DialogDescription>
          </DialogHeader>
          <div className="p-6 max-h-[60vh] overflow-y-auto space-y-6">
             <div className="bg-[#f8fafc] p-4 rounded-lg border border-[#e2e8f0]">
               <h4 className="text-[11px] font-bold text-[#64748b] uppercase tracking-widest mb-3">Logistics Intelligence</h4>
               <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-[#94a3b8] uppercase">Origin Node</p>
                    <p className="text-[13px] font-bold text-[#1e293b]">
                      {selectedOrder?.items?.[0]?.warehouse?.location?.includes(',') 
                        ? selectedOrder.items[0].warehouse.location.split(',').pop()?.trim() 
                        : selectedOrder?.items?.[0]?.warehouse?.name?.split(' ').shift() || 
                          selectedOrder?.items?.[0]?.warehouse?.code?.split('-').shift() || "Warehouse"}
                    </p>
                  </div>
                  <div className="flex-1 px-4 flex items-center">
                    <div className="h-px flex-1 bg-dashed border-t border-[#cbd5e1]"></div>
                    <ArrowRightLeft className="h-4 w-4 text-[#0052cc] mx-2" />
                    <div className="h-px flex-1 bg-dashed border-t border-[#cbd5e1]"></div>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-[10px] font-bold text-[#94a3b8] uppercase">Final Destination</p>
                    <p className="text-[13px] font-bold text-[#1e293b]">
                      {selectedOrder?.shipping_city 
                        ? `${selectedOrder.shipping_city}, ${selectedOrder.shipping_address}` 
                        : (selectedOrder?.customer?.address || "Shipping Details")}
                    </p>
                  </div>
               </div>
               <div className="mt-3 flex items-center gap-2 text-[11px] font-medium text-[#64748b]">
                 <MapPin className="h-3 w-3" />
                 <span>Automated Logistics Tracking Active</span>
               </div>
             </div>

             <div>
               <h4 className="text-[11px] font-bold text-[#64748b] uppercase tracking-widest mb-3">Manifest Summary</h4>
               {selectedOrder?.items?.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center pb-4 border-b border-[#f1f5f9] last:border-0 last:pb-0">
                    <div className="space-y-1">
                      <p className="font-semibold text-[#1e293b] text-[14px]">{item.product?.name || `Product ID: ${item.product_id}`}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold bg-[#f1f5f9] text-[#64748b] px-2 py-0.5 rounded uppercase">From: {item.warehouse?.name || "Processing Hub"}</span>
                        <span className="text-[10px] text-[#94a3b8]">Quantity: {item.quantity} × Ksh {Number(item.price).toLocaleString()}</span>
                      </div>
                    </div>
                    <p className="font-bold text-[#1e293b] text-[14px]">Ksh {(Number(item.price) * item.quantity).toLocaleString()}</p>
                  </div>
               ))}
             </div>
             <div className="pt-4 flex justify-between items-center">
               <span className="font-semibold text-[#64748b] text-[13px] uppercase tracking-wider">Total Settlement</span>
               <span className="text-xl font-bold text-[#1e293b]">Ksh {selectedOrder ? Number(selectedOrder.total_amount).toLocaleString() : 0}</span>
             </div>
          </div>
          <DialogFooter className="p-4 bg-[#f8fafc] border-t border-[#e2e8f0]">
            <Button variant="outline" className="text-[12px] font-bold border-[#e2e8f0] h-9" onClick={() => setIsOrderModalOpen(false)}>Close</Button>
            <Button className="bg-[#0052cc] hover:bg-[#0747a6] text-white text-[12px] font-bold h-9" onClick={downloadStatement}>Download Invoice</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Address & Payment Modals - Simplified for the Clean UI */}
      <Dialog open={isAddressModalOpen} onOpenChange={setIsAddressModalOpen}><DialogContent className="rounded-lg border-[#e2e8f0] shadow-xl"><DialogHeader><DialogTitle className="font-bold text-[#1e293b]">Update Delivery Address</DialogTitle></DialogHeader><div className="space-y-4 py-4"><div className="space-y-1"><label className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Location Name</label><Input className="border-[#e2e8f0]" placeholder="e.g. Home" /></div><div className="space-y-1"><label className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Street Address</label><Input className="border-[#e2e8f0]" /></div></div><DialogFooter><Button className="bg-[#0052cc] hover:bg-[#0747a6] w-full font-bold" onClick={() => setIsAddressModalOpen(false)}>Save Changes</Button></DialogFooter></DialogContent></Dialog>    </div>
  );
}

export default function AccountPortal() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><div className="h-8 w-8 border-4 border-[#0052cc] border-t-transparent rounded-full animate-spin" /></div>}>
      <AccountPortalInner />
    </Suspense>
  );
}
