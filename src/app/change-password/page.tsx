"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CarFront, Lock, Eye, EyeOff, Loader2, ShieldCheck, ArrowRight, KeyRound } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { toastErrors } from "@/lib/utils";

export default function ChangePasswordPage() {
  const { user, changePassword, logout, loading } = useAuth();
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // If user is already authed and doesn't need to change password, redirect away
  useEffect(() => {
    if (!loading && user && !user.must_change_password) {
      router.replace(user.role === "admin" ? "/dashboard" : "/account");
    }
    // If not logged in at all, redirect to login
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!currentPassword) errs.currentPassword = "Please enter your current password.";
    if (newPassword.length < 8) errs.newPassword = "New password must be at least 8 characters.";
    if (newPassword === currentPassword) errs.newPassword = "New password must be different from your current password.";
    if (newPassword !== confirmPassword) errs.confirmPassword = "Passwords do not match.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      await changePassword({
        current_password: currentPassword,
        password: newPassword,
        password_confirmation: confirmPassword,
      });
      toast.success("Password updated! Welcome to AutoSpare.");
      router.replace("/account");
    } catch (err: any) {
      // Show every individual validation error as its own toast (e.g. missing uppercase, missing symbol)
      toastErrors(err, "Something went wrong. Please try again.");
      // Also set inline field error for current_password if that's what failed
      if (err.response?.data?.errors?.current_password) {
        setErrors({ currentPassword: err.response.data.errors.current_password[0] });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Show nothing until we know the user state — zero flash guarantee
  if (loading || !user || !user.must_change_password) return null;

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background grid pattern */}
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

      {/* Logo */}
      <div className="absolute top-8 left-8">
        <div className="flex items-center gap-2 text-zinc-900">
          <div className="h-10 w-10 bg-[#0052cc] rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
            <CarFront className="h-6 w-6" />
          </div>
          <span className="text-xl font-black tracking-tight uppercase">AutoSpare<span className="text-[#0052cc] text-2xl">.</span></span>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-lg z-10"
      >
        <Card className="border-none shadow-[0_20px_60px_rgba(0,0,0,0.1)] bg-white overflow-hidden rounded-2xl">
          <div className="h-2 bg-[#0052cc] w-full" />
          <CardHeader className="space-y-4 text-center pt-12 pb-8">
            <div className="mx-auto h-16 w-16 bg-amber-50 border-2 border-amber-200 rounded-full flex items-center justify-center">
              <KeyRound className="h-8 w-8 text-amber-500" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-3xl font-black tracking-tighter text-zinc-900 uppercase">
                Set Your Password
              </CardTitle>
              <CardDescription className="text-zinc-500 font-medium text-base leading-relaxed max-w-xs mx-auto">
                For your security, you must create a personal password before accessing your portal.
              </CardDescription>
            </div>
            <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-4 py-1.5 mx-auto">
              <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-[11px] font-bold text-amber-700 uppercase tracking-widest">One-time security action</span>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 px-10 pb-10">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Current Password */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-700 ml-1">Current Password <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                  <Input
                    type={showCurrent ? "text" : "password"}
                    placeholder="Enter your current password"
                    className={`h-14 pl-12 pr-12 bg-zinc-50 border-zinc-200 text-zinc-900 focus:ring-[#0052cc] focus:border-[#0052cc] rounded-xl font-medium ${errors.currentPassword ? "border-red-400 ring-1 ring-red-400" : ""}`}
                    value={currentPassword}
                    onChange={(e) => { setCurrentPassword(e.target.value); setErrors({ ...errors, currentPassword: "" }); }}
                  />
                  <button type="button" onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors">
                    {showCurrent ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {errors.currentPassword && <p className="text-xs text-red-500 font-bold ml-1">{errors.currentPassword}</p>}
              </div>

              {/* New Password */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-700 ml-1">New Password <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                  <Input
                    type={showNew ? "text" : "password"}
                    placeholder="Minimum 8 characters"
                    className={`h-14 pl-12 pr-12 bg-zinc-50 border-zinc-200 text-zinc-900 focus:ring-[#0052cc] focus:border-[#0052cc] rounded-xl font-medium ${errors.newPassword ? "border-red-400 ring-1 ring-red-400" : ""}`}
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setErrors({ ...errors, newPassword: "" }); }}
                  />
                  <button type="button" onClick={() => setShowNew(!showNew)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors">
                    {showNew ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {errors.newPassword && <p className="text-xs text-red-500 font-bold ml-1">{errors.newPassword}</p>}
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-700 ml-1">Confirm New Password <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                  <Input
                    type={showConfirm ? "text" : "password"}
                    placeholder="Re-enter your new password"
                    className={`h-14 pl-12 pr-12 bg-zinc-50 border-zinc-200 text-zinc-900 focus:ring-[#0052cc] focus:border-[#0052cc] rounded-xl font-medium ${errors.confirmPassword ? "border-red-400 ring-1 ring-red-400" : ""}`}
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setErrors({ ...errors, confirmPassword: "" }); }}
                  />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors">
                    {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="text-xs text-red-500 font-bold ml-1">{errors.confirmPassword}</p>}
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-16 text-lg font-black rounded-xl shadow-xl shadow-blue-200 bg-[#0052cc] hover:bg-[#003d99] transition-all group mt-2"
              >
                {submitting ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <>
                    SECURE MY ACCOUNT
                    <ArrowRight className="ml-2 h-6 w-6 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>
            </form>

            <div className="flex items-center justify-center gap-2 pt-2">
              <ShieldCheck className="h-3.5 w-3.5 text-zinc-400" />
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
                256-bit Encrypted · Enterprise Secure
              </span>
            </div>

            <div className="text-center pt-2 border-t">
              <button
                type="button"
                onClick={() => logout()}
                className="text-xs text-zinc-400 hover:text-red-500 font-bold transition-colors uppercase tracking-wider"
              >
                Sign out instead
              </button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
