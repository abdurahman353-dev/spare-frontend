"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Bell, Shield, Globe, User, Save, Database, Mail, Loader2 } from "lucide-react";

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Settings</h1>
          <p className="text-zinc-500 text-sm mt-1">Configure your enterprise dashboard and system preferences.</p>
        </div>
        <Button className="bg-primary text-white hover:bg-primary/90 rounded-lg shadow-sm h-10 px-4 font-semibold">
          <Save className="mr-2 h-4 w-4" /> Save Changes
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border border-zinc-200 shadow-sm rounded-xl overflow-hidden bg-white">
            <CardHeader className="px-6 py-6 border-b">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 bg-primary/5 rounded-lg flex items-center justify-center text-primary">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold text-zinc-900">Administrative Profile</CardTitle>
                  <CardDescription className="text-sm">Manage your account details and contact information.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-zinc-500">Full Name</Label>
                  <Input defaultValue="Admin User" className="h-10 border-zinc-200 rounded-lg" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-zinc-500">Email Address</Label>
                  <Input defaultValue="admin@autospare.com" className="h-10 border-zinc-200 rounded-lg" />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs font-semibold text-zinc-500">Organization Role</Label>
                  <Input defaultValue="Chief Operations Officer" className="h-10 border-zinc-200 rounded-lg" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-zinc-200 shadow-sm rounded-xl overflow-hidden bg-white">
            <CardHeader className="px-6 py-6 border-b">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 bg-zinc-50 rounded-lg flex items-center justify-center text-zinc-400">
                  <Bell className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold text-zinc-900">Notifications</CardTitle>
                  <CardDescription className="text-sm">Configure how you receive system alerts and reports.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {[
                { title: "Inventory Alerts", desc: "Notify when stock levels fall below minimum threshold.", enabled: true },
                { title: "Order Placement", desc: "Receive real-time alerts for new customer orders.", enabled: true },
                { title: "Financial Reports", desc: "Email monthly business intelligence summaries.", enabled: false },
                { title: "Security Alerts", desc: "Notify on unauthorized login attempts.", enabled: true },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-zinc-900">{item.title}</p>
                    <p className="text-xs text-zinc-500">{item.desc}</p>
                  </div>
                  <Badge variant={item.enabled ? "default" : "outline"} className="rounded-full text-[10px] font-bold">
                    {item.enabled ? "Active" : "Disabled"}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <Card className="border border-zinc-200 shadow-sm rounded-xl overflow-hidden bg-white">
            <CardHeader className="px-6 py-6 border-b">
              <CardTitle className="text-lg font-bold text-zinc-900">System Security</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <Button variant="outline" className="w-full justify-start rounded-lg border-zinc-200 h-10 px-3">
                <Shield className="mr-2 h-4 w-4 text-zinc-400" /> Change Password
              </Button>
              <Button variant="outline" className="w-full justify-start rounded-lg border-zinc-200 h-10 px-3">
                <Globe className="mr-2 h-4 w-4 text-zinc-400" /> API Credentials
              </Button>
              <Button variant="outline" className="w-full justify-start rounded-lg border-zinc-200 h-10 px-3">
                <Database className="mr-2 h-4 w-4 text-zinc-400" /> Backup Database
              </Button>
            </CardContent>
          </Card>

          <Card className="border border-zinc-200 shadow-sm rounded-xl overflow-hidden bg-zinc-900 text-white">
            <CardContent className="p-6 text-center space-y-4">
              <div className="h-12 w-12 bg-white/10 rounded-full flex items-center justify-center mx-auto text-primary">
                <Mail className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-bold">Support Center</p>
                <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider mt-1">Need assistance?</p>
              </div>
              <Button className="w-full bg-white text-zinc-900 hover:bg-zinc-100 rounded-lg h-10 font-bold">
                Contact Technical Team
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
