"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, ShieldCheck, Eye, EyeOff, Loader2, AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useSettings } from "@/components/providers/SettingsProvider";
import api from "@/lib/axios";
import { API_ENDPOINTS } from "@/lib/apis";
import toast from "react-hot-toast";
import { toastErrors } from "@/lib/utils";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const token = searchParams.get("token") || "";
  const email = searchParams.get("email") || "";

  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token || !email) {
      setErrorMsg("This password reset link is missing a valid token or email parameter.");
    }
  }, [token, email]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (password !== passwordConfirmation) {
      toast.error("Passwords do not match.");
      return;
    }

    setLoading(true);
    
    try {
      await api.post(API_ENDPOINTS.auth.resetPassword, {
        email,
        token,
        password,
        password_confirmation: passwordConfirmation,
      });

      toast.success("Password reset successfully! Please log in.");
      router.push("/login");
    } catch (err: any) {
      // Collect all password field errors for the inline error block
      const firstMsg = err.response?.data?.errors?.password?.[0]
        || err.response?.data?.message
        || "Password reset failed. Please check the requirements and try again.";
      setErrorMsg(firstMsg);
      // Show every individual validation error as its own toast
      toastErrors(err, "Password reset failed. Please check the requirements and try again.");
    } finally {
      setLoading(false);
    }
  };

  if (errorMsg && (!token || !email)) {
    return (
      <>
        <CardHeader className="space-y-4 text-center pt-12 pb-8">
          <div className="mx-auto h-16 w-16 bg-red-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-3xl font-black tracking-tighter text-zinc-900 uppercase">Invalid Link</CardTitle>
            <CardDescription className="text-red-500 text-sm font-medium px-4">
              {errorMsg}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-10 pb-8">
          <Button 
            onClick={() => router.push("/forgot-password")}
            className="w-full h-14 font-black rounded-xl uppercase tracking-tighter"
          >
            Request new reset link
          </Button>
        </CardContent>
      </>
    );
  }

  return (
    <>
      <CardHeader className="space-y-4 text-center pt-12 pb-8">
        <div className="mx-auto h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center">
          <Lock className="h-8 w-8 text-primary" />
        </div>
        <div className="space-y-1">
          <CardTitle className="text-4xl font-black tracking-tighter text-zinc-900 uppercase">Reset Password</CardTitle>
          <CardDescription className="text-zinc-500 text-sm font-medium">
            Enter a secure new password for your account
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 px-10">
        {errorMsg && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-600 text-xs font-semibold rounded-xl">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleReset} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-bold text-zinc-700 ml-1">New Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
              <Input 
                type={showPassword ? "text" : "password"} 
                placeholder="••••••••" 
                className="h-14 pl-12 pr-12 bg-zinc-50 border-zinc-200 text-zinc-900 focus:ring-primary focus:border-primary transition-all rounded-xl font-medium"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            <p className="text-[10px] text-zinc-400 font-semibold ml-1 leading-relaxed">
              Must be at least 8 characters with letters, numbers, and symbols.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-zinc-700 ml-1">Confirm New Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
              <Input 
                type={showConfirmPassword ? "text" : "password"} 
                placeholder="••••••••" 
                className="h-14 pl-12 pr-12 bg-zinc-50 border-zinc-200 text-zinc-900 focus:ring-primary focus:border-primary transition-all rounded-xl font-medium"
                value={passwordConfirmation}
                onChange={(e) => setPasswordConfirmation(e.target.value)}
                required
              />
              <button 
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
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
              <>
                RESET PASSWORD
                <ArrowRight className="ml-2 h-6 w-6 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </>
  );
}

export default function ResetPasswordPage() {
  const { settings } = useSettings();
  const brandName = settings.store_name || "Portal";

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
          
          <Suspense fallback={
            <div className="flex flex-col items-center justify-center h-96 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-zinc-500 font-semibold text-sm">Loading recovery parameters...</p>
            </div>
          }>
            <ResetPasswordForm />
          </Suspense>

          <CardFooter className="flex flex-col space-y-6 pb-12 pt-6">
            <div className="text-sm text-zinc-500 text-center space-y-3 font-medium w-full">
              <div className="flex justify-center">
                <Link href="/login" className="text-primary hover:underline font-black uppercase tracking-tighter text-sm">
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
