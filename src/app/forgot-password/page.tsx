"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, ArrowLeft, ShieldCheck, Loader2 } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useSettings } from "@/components/providers/SettingsProvider";
import api from "@/lib/axios";
import { API_ENDPOINTS } from "@/lib/apis";
import toast from "react-hot-toast";

export default function ForgotPasswordPage() {
  const { settings } = useSettings();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const brandName = settings.store_name || "AutoSpare East Africa";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await api.post(API_ENDPOINTS.auth.forgotPassword, { email });
      toast.success("Reset link sent to your email!");
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to send reset link. Please check the email address.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background patterns */}
      <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="black" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg z-10"
      >
        <Card className="border-none shadow-[0_20px_60px_rgba(0,0,0,0.1)] bg-white overflow-hidden rounded-2xl">
          <div className="h-2 bg-primary w-full" />
          
          <AnimatePresence mode="wait">
            {!submitted ? (
              <motion.div
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <CardHeader className="space-y-4 text-center pt-12 pb-8">
                  <div className="mx-auto h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center">
                    <Mail className="h-8 w-8 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-4xl font-black tracking-tighter text-zinc-900 uppercase">Forgot Password</CardTitle>
                    <CardDescription className="text-zinc-500 text-sm font-medium">
                      Enter your email address to receive a recovery link
                    </CardDescription>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-6 px-10">
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-zinc-700 ml-1">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                        <Input 
                          type="email" 
                          placeholder="name@example.com" 
                          className="h-14 pl-12 bg-zinc-50 border-zinc-200 text-zinc-900 focus:ring-primary focus:border-primary transition-all rounded-xl font-medium"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <Button 
                      type="submit" 
                      disabled={loading}
                      className="w-full h-16 text-lg font-black rounded-xl shadow-xl shadow-primary/20 hover:shadow-primary/40 transition-all group"
                    >
                      {loading ? (
                        <Loader2 className="h-6 w-6 animate-spin" />
                      ) : (
                        "SEND RESET LINK"
                      )}
                    </Button>
                  </form>
                </CardContent>
              </motion.div>
            ) : (
              <motion.div
                key="success"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <CardHeader className="space-y-4 text-center pt-12 pb-8">
                  <div className="mx-auto h-16 w-16 bg-emerald-100 rounded-full flex items-center justify-center">
                    <ShieldCheck className="h-8 w-8 text-emerald-600" />
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-3xl font-black tracking-tighter text-zinc-900 uppercase">Check Your Email</CardTitle>
                    <CardDescription className="text-zinc-500 text-sm font-medium px-4">
                      We have sent a secure password reset link to <strong className="text-zinc-800 font-bold">{email}</strong>. Please check your inbox and spam folders.
                    </CardDescription>
                  </div>
                </CardHeader>
              </motion.div>
            )}
          </AnimatePresence>

          <CardFooter className="flex flex-col space-y-6 pb-12 pt-6">
            <div className="text-sm text-zinc-500 text-center space-y-3 font-medium w-full">
              <div className="flex justify-center">
                <Link href="/login" className="flex items-center text-primary hover:underline font-black uppercase tracking-tighter gap-2 text-sm">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Login
                </Link>
              </div>
              <div className="text-xs uppercase tracking-widest text-zinc-400 font-bold border-t pt-6 w-full max-w-[200px] mx-auto flex items-center justify-center gap-2">
                <ShieldCheck className="h-3 w-3" />
                {brandName} Secure
              </div>
            </div>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}
