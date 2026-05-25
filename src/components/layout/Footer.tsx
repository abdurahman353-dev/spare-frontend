"use client";

import Link from "next/link";
import { CarFront, Globe, MessageCircle, Camera, Share2, Mail, Phone, MapPin, Clock } from "lucide-react";
import { useSettings } from "@/components/providers/SettingsProvider";
import { useState, useEffect } from "react";
import api, { getActiveDestinationsCached, getCountriesCached } from "@/lib/axios";

export const formatWorkingHours = (hours: string) => {
  if (!hours) return "";
  if (hours.includes("\n")) return hours;
  return hours.replace(/\s+(SAT|SUN|MON|TUE|WED|THU|FRI)/g, "\n$1").trim();
};

export function Footer() {
  const { settings } = useSettings();
  const phone = settings.contact_phone || "";
  const email = settings.contact_email || "";
  const address = settings.physical_address || "";
  const whatsapp = settings.contact_whatsapp || phone;
  const workingHours = settings.working_hours || "";
  const brandName = settings.store_name || "";

  const getWhatsAppLink = (number: string) => {
    let clean = number.replace(/\D/g, "");
    if (clean.startsWith("0") && clean.length === 10) {
      clean = "254" + clean.slice(1);
    }
    return `https://wa.me/${clean}`;
  };

  const [hubs, setHubs] = useState<string[]>([]);

  useEffect(() => {
    const fetchHubs = async () => {
      try {
        const [activeDestinations, realLocations] = await Promise.all([
          getActiveDestinationsCached().catch(() => []),
          getCountriesCached().catch(() => [])
        ]);

        const uniquePairsMap = new Map<string, { city: string; country: string }>();
        activeDestinations.forEach((dest: any) => {
          if (dest.city && dest.country) {
            const key = `${dest.city.trim()}, ${dest.country.trim()}`;
            uniquePairsMap.set(key.toLowerCase(), { city: dest.city.trim(), country: dest.country.trim() });
          }
        });
        realLocations.forEach((loc: any) => {
          if (loc.name && loc.cities && loc.is_active !== false) {
            loc.cities.forEach((cityObj: any) => {
              if (cityObj.name && cityObj.is_active !== false) {
                const key = `${cityObj.name.trim()}, ${loc.name.trim()}`;
                uniquePairsMap.set(key.toLowerCase(), { city: cityObj.name.trim(), country: loc.name.trim() });
              }
            });
          }
        });

        const listObjs: { city: string; country: string; isHQ: boolean }[] = [];
        uniquePairsMap.forEach(({ city, country }) => {
          const isHQ = city.toLowerCase() === "nairobi" && country.toLowerCase() === "kenya";
          listObjs.push({ city, country, isHQ });
        });

        listObjs.sort((a, b) => {
          if (a.isHQ) return -1;
          if (b.isHQ) return 1;
          
          // First sort by country alphabetically
          const countryCompare = a.country.localeCompare(b.country);
          if (countryCompare !== 0) return countryCompare;
          
          // Then sort by city alphabetically
          return a.city.localeCompare(b.city);
        });

        const formattedList = listObjs.map(({ city, country, isHQ }) => {
          return `${city}, ${country}${isHQ ? " (HQ)" : ""}`;
        });
        setHubs(formattedList);
      } catch (e) {
        console.error("Failed to fetch hubs for footer:", e);
      }
    };
    fetchHubs();
  }, [settings]);

  return (
    <footer className="bg-secondary text-secondary-foreground pt-16 pb-8 border-t">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div className="space-y-4">
            {(settings.store_logo || brandName) ? (
              <Link href="/" className="flex items-center gap-2">
                {settings.store_logo ? (
                  <div className="h-9 w-9 rounded-full overflow-hidden shrink-0 border border-zinc-200/60">
                    <img src={settings.store_logo} alt={brandName || "Logo"} className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <CarFront className="h-8 w-8 text-primary" />
                )}
                {brandName && (
                  <span className="text-xl font-bold tracking-tight">{brandName}</span>
                )}
              </Link>
            ) : null}
            <p className="text-muted-foreground text-sm">
              Premium Mercedes-Benz spare parts distribution across East Africa. Quality parts, fast delivery, trusted service.
            </p>
            {(phone || whatsapp) && (
              <div className="flex gap-4 pt-2">
                {phone && (
                  <a
                    href={`tel:${phone}`}
                    className="h-12 w-12 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-600 rounded-lg flex items-center justify-center transition-all shadow-sm border border-blue-200"
                    title="Call Us"
                  >
                    <Phone className="h-6 w-6" />
                  </a>
                )}
                {whatsapp && (
                  <a
                    href={getWhatsAppLink(whatsapp)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-12 w-12 bg-[#25D366]/10 hover:bg-[#25D366] hover:text-white text-[#25D366] rounded-lg flex items-center justify-center transition-all shadow-sm border border-[#25D366]/20"
                    title="WhatsApp Chat"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 448 512"
                      fill="currentColor"
                      className="h-6 w-6"
                    >
                      <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L3 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7 .9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z" />
                    </svg>
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold text-lg mb-4">Quick Links</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link href="/about" className="hover:text-primary transition-colors">About Us</Link></li>
              <li><Link href="/products" className="hover:text-primary transition-colors">Products</Link></li>
              <li><Link href="/services" className="hover:text-primary transition-colors">Services</Link></li>
              <li><Link href="/brands" className="hover:text-primary transition-colors">Brands</Link></li>
              <li><Link href="/faq" className="hover:text-primary transition-colors">FAQ</Link></li>
            </ul>
          </div>

          {/* Distribution */}
          {hubs.length > 0 && (
            <div>
              <h3 className="font-semibold text-lg mb-4 text-zinc-900">Distribution points</h3>
              <ul className="space-y-3.5 text-sm text-muted-foreground max-h-[260px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-200 hover:scrollbar-thumb-zinc-300 scrollbar-track-transparent">
                {hubs.map((hub, idx) => {
                  const parts = hub.split(", ");
                  const city = parts[0];
                  const countryAndHq = parts[1] || "";
                  const isHq = countryAndHq.includes("(HQ)");
                  const country = countryAndHq.replace(" (HQ)", "");

                  return (
                    <li key={idx} className="flex items-center gap-2.5 group cursor-default">
                      <span className="h-1.5 w-1.5 rounded-full bg-zinc-300 group-hover:bg-primary transition-all duration-300 shrink-0" />
                      <span className="group-hover:translate-x-1 group-hover:text-zinc-900 transition-all duration-300 flex items-center gap-1.5 font-medium text-zinc-600">
                        <span>{city}</span>
                        <span className="text-zinc-400 text-xs font-normal">| {country}</span>
                        {isHq && (
                          <span className="text-[9px] bg-blue-50/80 text-blue-600 font-extrabold px-1.5 py-0.5 rounded border border-blue-100 uppercase tracking-wider">
                            HQ
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Contact */}
          {(address || phone || email || whatsapp || workingHours) && (
            <div>
              <h3 className="font-semibold text-lg mb-4">Contact Us</h3>
              <ul className="space-y-4 text-sm text-muted-foreground">
                {address && (
                  <li className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-primary shrink-0" />
                    <span className="whitespace-pre-line">{address}</span>
                  </li>
                )}
                {phone && (
                  <li className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-primary shrink-0" />
                    <a href={`tel:${phone}`} className="hover:text-primary transition-colors font-medium">
                      {phone}
                    </a>
                  </li>
                )}
                {email && (
                  <li className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-primary shrink-0" />
                    <span>{email}</span>
                  </li>
                )}
                {whatsapp && (
                  <li className="flex items-center gap-3">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 448 512"
                      fill="currentColor"
                      className="h-5 w-5 text-[#25D366] shrink-0"
                    >
                      <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L3 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7 .9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z" />
                    </svg>
                    <a href={getWhatsAppLink(whatsapp)} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors font-medium">
                      WhatsApp Us
                    </a>
                  </li>
                )}
                {workingHours && (
                  <li className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span className="whitespace-pre-line">{formatWorkingHours(workingHours)}</span>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        <div className="border-t border-border/50 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <p>
            {settings.store_copyright
              ? settings.store_copyright
              : brandName
              ? `© ${new Date().getFullYear()} ${brandName}. All rights reserved.`
              : `© ${new Date().getFullYear()}. All rights reserved.`}
          </p>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
