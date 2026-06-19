"use client";
 
import { useState, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Mail, ArrowRight, ShieldCheck, Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/components/providers/SettingsProvider";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
 
function LoginPageInner() {
  const { login } = useAuth();
  const { settings } = useSettings();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "";
 
  const brandName = settings.store_name || "Portal";
 
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await login({ email, password, remember: rememberMe }, redirect);
      toast.success("Welcome back!");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Invalid credentials. Please try again.");
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
          <CardHeader className="space-y-4 text-center pt-8 sm:pt-12 pb-6 sm:pb-8">
            {/* Clickable brand badge — navigates back to landing page */}
            <Link href="/" className="mx-auto flex flex-col items-center gap-2 group">
              {settings.store_logo ? (
                <img
                  src={settings.store_logo}
                  alt={brandName}
                  className="h-16 w-auto max-w-[160px] object-contain rounded-lg group-hover:opacity-80 transition-opacity"
                />
              ) : (
                <div className="h-16 w-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30 group-hover:shadow-primary/50 transition-all group-hover:scale-105">
                  <span className="text-white text-2xl font-black">
                    {brandName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 group-hover:text-primary transition-colors">
                ← Back to {brandName}
              </span>
            </Link>
            <div className="space-y-1">
              <CardTitle className="text-4xl font-black tracking-tighter text-zinc-900 uppercase">Secure Login</CardTitle>
              <CardDescription className="text-zinc-500 text-lg font-medium">
                Access your personalized {brandName} portal
              </CardDescription>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6 px-6 sm:px-10">
            <form onSubmit={handleLogin} className="space-y-5">
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
 
              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-sm font-bold text-zinc-700">Password</label>
                  <Link href="/forgot-password" className="text-xs text-primary hover:underline font-bold uppercase tracking-tighter">Forgot Password?</Link>
                </div>
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
              </div>
 
              <div className="flex items-center space-x-2 ml-1">
                <input 
                  type="checkbox" 
                  id="remember" 
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-primary focus:ring-primary" 
                />
                <label htmlFor="remember" className="text-sm font-medium text-zinc-600 cursor-pointer">
                  Remember me for 30 days
                </label>
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
                    SIGN IN TO PORTAL
                    <ArrowRight className="ml-2 h-6 w-6 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
 
          <CardFooter className="flex flex-col space-y-6 pb-8 sm:pb-12 pt-6">
            <div className="text-sm text-zinc-500 text-center space-y-3 font-medium">
              <div>
                Don't have an account?{" "}
                <Link href={redirect ? `/register?redirect=${encodeURIComponent(redirect)}` : "/register"} className="text-primary hover:underline font-black uppercase tracking-tighter">
                  Create Account
                </Link>
              </div>
              <div className="text-xs uppercase tracking-widest text-zinc-400 font-bold border-t pt-6 w-full max-w-[200px] mx-auto flex items-center justify-center gap-2">
                <ShieldCheck className="h-3 w-3" />
                Enterprise Secure
              </div>
            </div>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-[#0052cc]" />
      </div>
    }>
      <LoginPageInner />
    </Suspense>
  );
}
