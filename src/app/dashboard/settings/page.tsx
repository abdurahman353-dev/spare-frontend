"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, Store, Settings, Bell, Shield, Loader2 } from "lucide-react";
import api from "@/lib/axios";

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Record<string, any>>({
    store_name: "",
    store_tagline: "",
    contact_email: "",
    contact_phone: "",
    contact_whatsapp: "",
    physical_address: "",
    tax_pin: "",
    currency: "Ksh",
    vat_rate: "16",
    shipping_fee: "500",
    low_stock_threshold: "5",
    mpesa_shortcode: "",
    mpesa_passkey: "",
    mpesa_consumer_key: "",
    mpesa_consumer_secret: "",
    bank_account_name: "",
    bank_account_number: "",
    bank_name: "",
    notify_new_order: "true",
    notify_low_stock: "true",
    notify_daily_report: "false",
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await api.get("/settings");
      setSettings(prev => ({ ...prev, ...response.data }));
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.post("/settings", settings);
      alert("Settings saved successfully!");
    } catch (error) {
      console.error("Failed to save settings:", error);
      alert("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setSettings((prev) => ({ ...prev, [name]: checked ? "true" : "false" }));
    } else {
      setSettings((prev) => ({ ...prev, [name]: value }));
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-zinc-500 font-semibold text-sm">Loading settings...</p>
      </div>
    );
  }

  // Shared input class matching products/inventory pages
  const inputCls = "h-10 border-zinc-200 rounded-lg bg-white";
  const labelCls = "text-xs font-semibold text-zinc-500";

  return (
    <div className="space-y-6 p-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Settings</h1>
          <p className="text-zinc-500 text-sm mt-1">Configure your enterprise dashboard and system preferences.</p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-primary text-white hover:bg-primary/90 rounded-lg shadow-sm font-bold"
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {/* ── Vertical Tabs Panel ── */}
      <div className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden">
        <Tabs orientation="vertical" defaultValue="general" className="flex flex-col md:flex-row w-full min-h-[600px]">

          {/* Sidebar Nav */}
          <div className="w-full md:w-56 shrink-0 bg-zinc-50/50 border-b md:border-b-0 md:border-r border-zinc-200 p-3">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-3 pt-2 pb-3">Configuration</p>
            <TabsList className="flex flex-col h-auto w-full bg-transparent p-0 gap-0.5">
              {[
                { value: "general",       icon: Store,    label: "General Profile" },
                { value: "preferences",   icon: Settings, label: "E-Commerce Rules" },
                { value: "notifications", icon: Bell,     label: "Notifications" },
                { value: "security",      icon: Shield,   label: "Security" },
              ].map(({ value, icon: Icon, label }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="w-full justify-start gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold text-zinc-500
                    data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-zinc-900 data-[state=active]:font-bold
                    hover:bg-white/70 hover:text-zinc-700 transition-all"
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* Content Area */}
          <div className="flex-1 p-6 md:p-8 overflow-y-auto">

            {/* ── 1. General Profile ── */}
            <TabsContent value="general" className="mt-0 space-y-6">
              <div>
                <h2 className="text-lg font-bold text-zinc-900">General Profile</h2>
                <p className="text-zinc-500 text-sm mt-0.5">Business details displayed to customers on the storefront.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <Label className={labelCls}>Business Name</Label>
                  <Input name="store_name" value={settings.store_name || ""} onChange={handleChange} placeholder="AutoSpare East Africa" className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <Label className={labelCls}>Tagline</Label>
                  <Input name="store_tagline" value={settings.store_tagline || ""} onChange={handleChange} placeholder="Premium OEM Parts" className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <Label className={labelCls}>Support Email</Label>
                  <Input type="email" name="contact_email" value={settings.contact_email || ""} onChange={handleChange} placeholder="support@autospare.co.ke" className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <Label className={labelCls}>Phone Number</Label>
                  <Input name="contact_phone" value={settings.contact_phone || ""} onChange={handleChange} placeholder="+254..." className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <Label className={labelCls}>WhatsApp Contact</Label>
                  <Input name="contact_whatsapp" value={settings.contact_whatsapp || ""} onChange={handleChange} placeholder="+254..." className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <Label className={labelCls}>KRA PIN / Tax ID</Label>
                  <Input name="tax_pin" value={settings.tax_pin || ""} onChange={handleChange} placeholder="P00..." className={inputCls} />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label className={labelCls}>Physical Address</Label>
                  <Textarea name="physical_address" value={settings.physical_address || ""} onChange={handleChange} placeholder="Nairobi, Kenya" className="border-zinc-200 rounded-lg resize-none bg-white" />
                </div>
              </div>
            </TabsContent>

            {/* ── 2. E-Commerce Rules ── */}
            <TabsContent value="preferences" className="mt-0 space-y-6">
              <div>
                <h2 className="text-lg font-bold text-zinc-900">E-Commerce Rules</h2>
                <p className="text-zinc-500 text-sm mt-0.5">Global preferences for shopping, shipping, and inventory.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <Label className={labelCls}>Default Currency</Label>
                  <select
                    name="currency"
                    value={settings.currency || "Ksh"}
                    onChange={(e) => setSettings(prev => ({ ...prev, currency: e.target.value }))}
                    className="h-10 w-full px-3 border border-zinc-200 rounded-lg text-sm font-medium bg-white outline-none focus:ring-2 focus:ring-primary/20 text-zinc-700"
                  >
                    <option value="Ksh">Ksh — Kenyan Shilling</option>
                    <option value="USD">USD — US Dollar</option>
                    <option value="EUR">EUR — Euro</option>
                    <option value="GBP">GBP — British Pound</option>
                    <option value="TZS">TZS — Tanzanian Shilling</option>
                    <option value="UGX">UGX — Ugandan Shilling</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className={labelCls}>VAT / Tax Rate (%)</Label>
                  <Input type="number" name="vat_rate" value={settings.vat_rate || "16"} onChange={handleChange} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <Label className={labelCls}>Standard Shipping Fee (Ksh)</Label>
                  <Input type="number" name="shipping_fee" value={settings.shipping_fee || "500"} onChange={handleChange} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <Label className={labelCls}>Global Low Stock Threshold (units)</Label>
                  <Input type="number" name="low_stock_threshold" value={settings.low_stock_threshold || "5"} onChange={handleChange} className={inputCls} />
                </div>
              </div>
            </TabsContent>

            {/* ── 3. Notifications ── */}
            <TabsContent value="notifications" className="mt-0 space-y-6">
              <div>
                <h2 className="text-lg font-bold text-zinc-900">Notifications</h2>
                <p className="text-zinc-500 text-sm mt-0.5">Manage system alerts sent via email and SMS.</p>
              </div>
              <div className="space-y-3 max-w-xl">
                {[
                  { name: "notify_new_order",    label: "New Order Alerts",      desc: "Receive an alert when a customer places a new order." },
                  { name: "notify_low_stock",    label: "Low Stock Warnings",    desc: "Get notified when items fall below the threshold." },
                  { name: "notify_daily_report", label: "Daily Financial Report", desc: "Receive a daily summary of sales and revenue." },
                ].map((item) => (
                  <label key={item.name} className="flex items-center justify-between p-4 border border-zinc-200 rounded-xl bg-zinc-50/50 cursor-pointer hover:bg-zinc-50 transition-colors">
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-zinc-900">{item.label}</p>
                      <p className="text-xs text-zinc-500">{item.desc}</p>
                    </div>
                    <input
                      type="checkbox"
                      name={item.name}
                      className="h-4 w-4 accent-primary rounded border-zinc-300"
                      checked={settings[item.name] === "true"}
                      onChange={handleChange}
                    />
                  </label>
                ))}
              </div>
            </TabsContent>

            {/* ── 5. Security / Admin Profile ── */}
            <TabsContent value="security" className="mt-0 space-y-8">
              {/* Admin Profile Section */}
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-zinc-900">Administrative Profile</h2>
                  <p className="text-zinc-500 text-sm mt-0.5">Your admin account details and role information.</p>
                </div>
                <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-5 border-b border-zinc-100 bg-zinc-50/50">
                    <p className="text-xs font-black text-zinc-400 uppercase tracking-widest">Account Details</p>
                  </div>
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-zinc-500">Full Name</Label>
                      <Input name="admin_name" value={settings.admin_name || ""} onChange={handleChange} placeholder="e.g. Jane Mwangi" className="h-10 border-zinc-200 rounded-lg bg-white" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-zinc-500">Email Address</Label>
                      <Input type="email" name="admin_email" value={settings.admin_email || ""} onChange={handleChange} placeholder="admin@autospare.co.ke" className="h-10 border-zinc-200 rounded-lg bg-white" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-zinc-500">Phone Number</Label>
                      <Input name="admin_phone" value={settings.admin_phone || ""} onChange={handleChange} placeholder="+254..." className="h-10 border-zinc-200 rounded-lg bg-white" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-zinc-500">Organization Role</Label>
                      <Input name="admin_role" value={settings.admin_role || ""} onChange={handleChange} placeholder="e.g. Chief Operations Officer" className="h-10 border-zinc-200 rounded-lg bg-white" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Change Password Section */}
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-zinc-900">Change Password</h2>
                  <p className="text-zinc-500 text-sm mt-0.5">We recommend updating your password every 90 days.</p>
                </div>
                <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-5 border-b border-zinc-100 bg-zinc-50/50">
                    <p className="text-xs font-black text-zinc-400 uppercase tracking-widest">Security Credentials</p>
                  </div>
                  <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-zinc-500">Current Password</Label>
                      <Input type="password" placeholder="••••••••" className="h-10 border-zinc-200 rounded-lg bg-white" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-zinc-500">New Password</Label>
                      <Input type="password" placeholder="••••••••" className="h-10 border-zinc-200 rounded-lg bg-white" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-zinc-500">Confirm New Password</Label>
                      <Input type="password" placeholder="••••••••" className="h-10 border-zinc-200 rounded-lg bg-white" />
                    </div>
                  </div>
                  <div className="px-6 pb-6 flex justify-end">
                    <Button className="bg-primary text-white hover:bg-primary/90 rounded-lg shadow-sm font-bold h-10 px-6">
                      Update Password
                    </Button>
                  </div>
                </div>
              </div>

              {/* Sessions Section */}
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-zinc-900">Active Sessions</h2>
                  <p className="text-zinc-500 text-sm mt-0.5">Manage devices currently logged into your account.</p>
                </div>
                <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-5 border-b border-zinc-100 bg-zinc-50/50 flex items-center justify-between">
                    <p className="text-xs font-black text-zinc-400 uppercase tracking-widest">Current Device</p>
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wide">Active</span>
                  </div>
                  <div className="p-6 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-zinc-900 text-sm">This browser session</p>
                      <p className="text-xs text-zinc-400 mt-0.5">Logged in now · Nairobi, Kenya</p>
                    </div>
                    <Button variant="outline" className="rounded-lg border-zinc-200 font-bold h-10 text-red-600 border-red-200 hover:bg-red-50">
                      Logout All Devices
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>

          </div>
        </Tabs>
      </div>
    </div>
  );
}
