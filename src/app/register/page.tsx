"use client";

import { useState, useEffect, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, Mail, Lock, User, ArrowRight, Eye, EyeOff, Loader2, Phone } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/components/providers/SettingsProvider";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { getPasswordStrength, isValidEmail } from "@/lib/validation";
import { toastErrors } from "@/lib/utils";

function RegisterPageInner() {
  const { register } = useAuth();
  const { settings } = useSettings();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "";
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    password_confirmation: ""
  });
  const [phoneVal, setPhoneVal] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Searchable dropdown states
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showWarning, setShowWarning] = useState(false);

  const countries = [
    { code: "KE", name: "Kenya", prefix: "+254", flag: "🇰🇪", pattern: /^(?:\+254|0)?([71])\d{8}$/, placeholder: "712345678", digits: "9 digits" },
    { code: "UG", name: "Uganda", prefix: "+256", flag: "🇺🇬", pattern: /^(?:\+256|0)?(7)\d{8}$/, placeholder: "712345678", digits: "9 digits" },
    { code: "TZ", name: "Tanzania", prefix: "+255", flag: "🇹🇿", pattern: /^(?:\+255|0)?([67])\d{8}$/, placeholder: "712345678", digits: "9 digits" },
    { code: "RW", name: "Rwanda", prefix: "+250", flag: "🇷🇼", pattern: /^(?:\+250|0)?(7)\d{8}$/, placeholder: "712345678", digits: "9 digits" },
    { code: "BI", name: "Burundi", prefix: "+257", flag: "🇧🇮", pattern: /^(?:\+257|0)?([67])\d{7}$/, placeholder: "71234567", digits: "8 digits" },
    { code: "SS", name: "South Sudan", prefix: "+211", flag: "🇸🇸", pattern: /^(?:\+211|0)?(9)\d{8}$/, placeholder: "912345678", digits: "9 digits" },
    { code: "SO", name: "Somalia", prefix: "+252", flag: "🇸🇴", pattern: /^(?:\+252|0)?([679])\d{8}$/, placeholder: "612345678", digits: "9 digits" },
    { code: "CD", name: "DR Congo", prefix: "+243", flag: "🇨🇩", pattern: /^(?:\+243|0)?([89])\d{8}$/, placeholder: "812345678", digits: "9 digits" },
    { code: "ET", name: "Ethiopia", prefix: "+251", flag: "🇪🇹", pattern: /^(?:\+251|0)?([97])\d{8}$/, placeholder: "912345678", digits: "9 digits" },
    { code: "SD", name: "Sudan", prefix: "+249", flag: "🇸🇩", pattern: /^(?:\+249|0)?([91])\d{8}$/, placeholder: "912345678", digits: "9 digits" },
    { code: "ER", name: "Eritrea", prefix: "+291", flag: "🇪🇷", pattern: /^(?:\+291|0)?([17])\d{6}$/, placeholder: "7123456", digits: "7 digits" },
    { code: "DJ", name: "Djibouti", prefix: "+253", flag: "🇩🇯", pattern: /^(?:\+253|0)?(7)\d{5}$/, placeholder: "771234", digits: "6 digits" },
    { code: "MG", name: "Madagascar", prefix: "+261", flag: "🇲🇬", pattern: /^(?:\+261|0)?(3)\d{8}$/, placeholder: "321234567", digits: "9 digits" },
    { code: "MU", name: "Mauritius", prefix: "+230", flag: "🇲🇺", pattern: /^(?:\+230|0)?(5)\d{7}$/, placeholder: "51234567", digits: "8 digits" },
    { code: "SC", name: "Seychelles", prefix: "+248", flag: "🇸🇨", pattern: /^(?:\+248|0)?(2)\d{6}$/, placeholder: "2123456", digits: "7 digits" },
    { code: "KM", name: "Comoros", prefix: "+269", flag: "🇰🇲", pattern: /^(?:\+269|0)?([34])\d{6}$/, placeholder: "3123456", digits: "7 digits" }
  ];

  const [selectedCountry, setSelectedCountry] = useState(countries[0]);

  // Sync selected phone country with global settings business country
  useEffect(() => {
    if (settings && settings.store_country) {
      const match = countries.find(c =>
        c.name.toLowerCase() === settings.store_country.toLowerCase() ||
        c.code.toLowerCase() === settings.store_country.toLowerCase()
      );
      if (match) {
        setSelectedCountry(match);
      }
    }
  }, [settings]);

  // Real-time phone format validation
  const cleanedPhone = phoneVal.replace(/\s+/g, "");
  const isValidPhone = selectedCountry.pattern.test(cleanedPhone);

  const brandName = settings.store_name || "AutoSpare East Africa";

  const filteredCountries = countries.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.prefix.includes(searchQuery) ||
    c.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValidEmail(formData.email)) {
      toast.error("Please enter a valid email address.");
      return;
    }

    if (!isValidPhone) {
      setShowWarning(true);
      toast.error(`Please enter a valid ${selectedCountry.name} phone number format.`);
      return;
    }

    if (formData.password !== formData.password_confirmation) {
      toast.error("Passwords do not match.");
      return;
    }

    setLoading(true);

    // Format phone to include prefix
    let formattedPhone = cleanedPhone;
    if (formattedPhone.startsWith(selectedCountry.prefix)) {
      // already contains prefix
    } else if (formattedPhone.startsWith("0")) {
      formattedPhone = selectedCountry.prefix + formattedPhone.slice(1);
    } else {
      formattedPhone = selectedCountry.prefix + formattedPhone;
    }

    try {
      await register({
        ...formData,
        phone: formattedPhone,
        country: selectedCountry.name,
      }, redirect);
      toast.success("Account created successfully!");
    } catch (err: any) {
      toastErrors(err, "Registration failed. Please check your details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="black" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <div className="absolute top-8 left-8">
        <Link href="/" className="flex items-center gap-2 text-zinc-900 group">
          <div className="h-10 w-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
            <UserPlus className="h-6 w-6" />
          </div>
          <span className="text-xl font-black tracking-tight uppercase">{brandName}<span className="text-primary text-2xl">.</span></span>
        </Link>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg z-10"
      >
        <Card className="border-none shadow-[0_20px_60px_rgba(0,0,0,0.1)] bg-white overflow-hidden rounded-2xl">
          <div className="h-2 bg-primary w-full" />
          <CardHeader className="space-y-4 text-center pt-12 pb-8">
            <CardTitle className="text-4xl font-black tracking-tighter text-zinc-900 uppercase">JOIN THE NETWORK</CardTitle>
            <CardDescription className="text-zinc-500 text-lg font-medium">
              Create a customer account to start purchasing genuine parts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 px-10">
            <form onSubmit={handleRegister} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-700 ml-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                  <Input
                    placeholder="Enter your name"
                    className="h-14 pl-12 bg-zinc-50 border-zinc-200 rounded-xl font-medium"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-700 ml-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    className="h-14 pl-12 bg-zinc-50 border-zinc-200 rounded-xl font-medium"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-sm font-bold text-zinc-700">Phone Number</label>
                  <span className="text-[10px] text-zinc-400 font-black uppercase tracking-widest bg-zinc-50 px-2 py-0.5 rounded border border-zinc-200">
                    {selectedCountry.digits} required
                  </span>
                </div>
                <div className="flex gap-2 relative">
                  {/* Searchable, scrollable country picker dropdown */}
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setDropdownOpen(!dropdownOpen)}
                      className="h-14 px-4 bg-zinc-50 border border-zinc-200 rounded-xl font-black text-zinc-800 text-sm hover:bg-zinc-100 transition-all flex items-center gap-2 cursor-pointer outline-none min-w-[110px] justify-between shadow-sm"
                    >
                      <img
                        src={`https://flagcdn.com/w40/${selectedCountry.code.toLowerCase()}.png`}
                        className="w-5 h-3.5 object-cover rounded-xs border border-zinc-200 shrink-0"
                        alt={selectedCountry.name}
                      />
                      <span>{selectedCountry.prefix}</span>
                      <svg className="fill-current h-4 w-4 text-zinc-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                        <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                      </svg>
                    </button>

                    {dropdownOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-20"
                          onClick={() => { setDropdownOpen(false); setSearchQuery(""); }}
                        />
                        <div className="absolute left-0 mt-2 w-64 bg-white border border-zinc-200 rounded-xl shadow-xl z-30 flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                          <div className="p-2 border-b border-zinc-100">
                            <input
                              type="text"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              placeholder="Search country..."
                              className="w-full h-10 px-3 bg-zinc-50 border border-zinc-200 rounded-lg text-sm text-zinc-800 placeholder-zinc-400 outline-none focus:border-primary transition-all font-semibold"
                              autoFocus
                            />
                          </div>
                          <div className="max-h-48 overflow-y-auto py-1">
                            {filteredCountries.length === 0 ? (
                              <div className="p-3 text-center text-xs text-zinc-400 font-bold">
                                No countries found
                              </div>
                            ) : (
                              filteredCountries.map(c => (
                                <button
                                  key={c.code}
                                  type="button"
                                  onClick={() => {
                                    setSelectedCountry(c);
                                    setDropdownOpen(false);
                                    setSearchQuery("");
                                  }}
                                  className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2.5 hover:bg-zinc-50 transition-colors font-semibold ${selectedCountry.code === c.code ? 'bg-primary/5 text-primary font-bold' : 'text-zinc-700'}`}
                                >
                                  <img
                                    src={`https://flagcdn.com/w40/${c.code.toLowerCase()}.png`}
                                    className="w-5 h-3.5 object-cover rounded-xs border border-zinc-200 shrink-0"
                                    alt={c.name}
                                  />
                                  <span className="truncate flex-1">{c.name}</span>
                                  <span className="text-zinc-400 font-bold text-xs shrink-0">{c.prefix}</span>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="relative flex-1">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                    <Input
                      type="number"
                      placeholder={selectedCountry.placeholder}
                      className="h-14 pl-12 bg-zinc-50 border-zinc-200 rounded-xl font-medium"
                      value={phoneVal}
                      onChange={(e) => {
                        setPhoneVal(e.target.value);
                        setShowWarning(false); // Clear warning while typing
                      }}
                      onBlur={() => setShowWarning(true)} // Show warning only when they finish/click away
                      required
                    />
                  </div>
                </div>
                {phoneVal && showWarning && !isValidPhone && (
                  <p className="text-xs text-red-500 font-bold ml-1 transition-all animate-pulse">
                    ⚠️ Invalid {selectedCountry.name} phone number format. Expected {selectedCountry.digits} (e.g. {selectedCountry.placeholder})
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 ml-1">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="h-14 pl-12 pr-12 bg-zinc-50 border-zinc-200 rounded-xl font-medium"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-300 hover:text-zinc-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {/* Password strength indicator */}
                  {formData.password && (() => {
                    const strength = getPasswordStrength(formData.password);
                    return (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="h-1.5 flex-1 rounded-full transition-all"
                              style={{ backgroundColor: i <= strength.score ? strength.color : '#e4e4e7' }} />
                          ))}
                        </div>
                        <p className="text-xs font-bold" style={{ color: strength.color }}>
                          {strength.label}{strength.score < 5 && ' — Add uppercase, numbers & symbols'}
                        </p>
                      </div>
                    );
                  })()}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 ml-1">Confirm</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="h-14 pl-12 pr-12 bg-zinc-50 border-zinc-200 rounded-xl font-medium"
                      value={formData.password_confirmation}
                      onChange={(e) => setFormData({ ...formData, password_confirmation: e.target.value })}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-300 hover:text-zinc-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-16 text-lg font-black rounded-xl shadow-xl shadow-primary/20 hover:shadow-primary/40 transition-all group mt-4 cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <>
                    CREATE ACCOUNT
                    <ArrowRight className="ml-2 h-6 w-6 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col space-y-6 pb-12 pt-8">
            <div className="text-sm text-zinc-500 text-center font-medium">
              Already have an account?{" "}
              <Link href={redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : "/login"} className="text-primary hover:underline font-black uppercase tracking-tighter">
                SIGN IN
              </Link>
            </div>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-[#0052cc]" />
      </div>
    }>
      <RegisterPageInner />
    </Suspense>
  );
}
