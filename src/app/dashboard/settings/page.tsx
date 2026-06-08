"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, Store, Settings, Bell, Shield, Loader2, Eye, EyeOff, Globe, Plus, Trash2, Image as ImageIcon, Upload, Star, X } from "lucide-react";
import api from "@/lib/axios";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { PaginationControls } from "@/components/ui/pagination-controls";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function AdminSettingsPage() {
  const { logout, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hubsList, setHubsList] = useState<Array<{ name: string; lat: number; lng: number; desc: string }>>([]);
  const [hubsPage, setHubsPage] = useState(1);
  const [hubsPageSize, setHubsPageSize] = useState(10);
  const [hubCountryFilter, setHubCountryFilter] = useState("all");
  const [hubCityFilter, setHubCityFilter] = useState("all");
  const [hubCountrySearch, setHubCountrySearch] = useState("");
  const [hubCitySearch, setHubCitySearch] = useState("");
  const [hubCountryOpen, setHubCountryOpen] = useState(false);
  const [hubCityOpen, setHubCityOpen] = useState(false);
  const countryDropdownRef = useRef<HTMLDivElement>(null);
  const cityDropdownRef = useRef<HTMLDivElement>(null);
  const [passwordState, setPasswordState] = useState({
    current_password: "",
    password: "",
    password_confirmation: ""
  });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    type: "info" | "confirm_logout" | "success" | "error";
    onConfirm?: () => void;
  }>({
    isOpen: false,
    title: "",
    description: "",
    type: "info"
  });

  const showAlert = (title: string, description: string, type: "success" | "error" | "info" = "info") => {
    setModal({
      isOpen: true,
      title,
      description,
      type
    });
  };
  const [settings, setSettings] = useState<Record<string, any>>({
    store_name: "",
    store_tagline: "",
    store_description: "",
    store_logo: "",
    contact_email: "",
    contact_phone: "",
    contact_whatsapp: "",
    physical_address: "",
    working_hours: "",
    currency: "Ksh",
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
    map_hubs: "[]",
    store_country: "Kenya",
    store_address: "",
    store_phone: "",
    store_email: "",
    store_website: "",
    store_kra_pin: "",
    store_reg_number: "",
    store_branch: "",
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(e.target as Node)) {
        setHubCountryOpen(false);
      }
      if (cityDropdownRef.current && !cityDropdownRef.current.contains(e.target as Node)) {
        setHubCityOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Derived hub filter options
  const hubCountryOptions = useMemo(() => {
    const countries = Array.from(new Set(
      hubsList.map(h => h.name.includes(", ") ? h.name.split(", ").slice(-1)[0] : "")
        .filter(Boolean)
    )).sort();
    return countries;
  }, [hubsList]);

  const hubCityOptions = useMemo(() => {
    const filtered = hubCountryFilter === "all"
      ? hubsList
      : hubsList.filter(h => h.name.endsWith(", " + hubCountryFilter));
    const cities = Array.from(new Set(
      filtered.map(h => h.name.includes(", ") ? h.name.split(", ")[0] : h.name)
        .filter(Boolean)
    )).sort();
    return cities;
  }, [hubsList, hubCountryFilter]);

  const filteredHubs = useMemo(() => {
    return hubsList.filter(h => {
      const parts = h.name.split(", ");
      const city = parts[0] || "";
      const country = parts.slice(1).join(", ") || "";
      const matchCountry = hubCountryFilter === "all" || country === hubCountryFilter;
      const matchCity = hubCityFilter === "all" || city === hubCityFilter;
      return matchCountry && matchCity;
    });
  }, [hubsList, hubCountryFilter, hubCityFilter]);

  // Sync phone prefixes with selected Business Country
  useEffect(() => {
    if (settings.store_country) {
      const countryDialCodes: Record<string, string> = {
        "Kenya": "+254",
        "Uganda": "+256",
        "Tanzania": "+255",
        "Rwanda": "+250",
        "Burundi": "+257",
        "Nigeria": "+234",
        "South Africa": "+27",
        "United States": "+1",
        "United Kingdom": "+44"
      };
      const prefix = countryDialCodes[settings.store_country];
      if (prefix) {
        const currentPhone = settings.contact_phone || "";
        const prefixes = Object.values(countryDialCodes);
        if (currentPhone === "" || prefixes.includes(currentPhone)) {
          setSettings(prev => ({ ...prev, contact_phone: prefix }));
        }
        const currentWA = settings.contact_whatsapp || "";
        if (currentWA === "" || prefixes.includes(currentWA)) {
          setSettings(prev => ({ ...prev, contact_whatsapp: prefix }));
        }
      }
    }
  }, [settings.store_country]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await api.get("/settings");
      
      // Fetch Shipping Zones (defined countries & cities)
      const locationsResponse = await api.get("/locations/countries");
      const countriesList = locationsResponse.data || [];

      const retrievedHubs = response.data.map_hubs 
        ? JSON.parse(response.data.map_hubs) 
        : [];
      
      // Derived hubs auto-populated based on Shipping Zones
      const derivedHubs: Array<{ name: string; lat: number; lng: number; desc: string }> = [];

      const PREDEFINED_COORDINATES: Record<string, { lat: number; lng: number; desc: string }> = {
        // Kenya
        "nairobi": { lat: -1.2921, lng: 36.8219, desc: "Main Distribution Center & Headquarters" },
        "mombasa": { lat: -4.0435, lng: 39.6682, desc: "Coastal Distribution Hub" },
        "kisumu": { lat: -0.1022, lng: 34.7617, desc: "Western Lake Basin Hub" },
        "nakuru": { lat: -0.3031, lng: 36.0800, desc: "Rift Valley Distribution Node" },
        "eldoret": { lat: 0.5143, lng: 35.2698, desc: "North Rift Logistics Center" },
        "naivasha": { lat: -0.7171, lng: 36.4399, desc: "Rift Valley Logistics Point" },
        "nyeri": { lat: -0.4215, lng: 36.9515, desc: "Central Highlands Logistics Hub" },
        "thika": { lat: -1.0333, lng: 37.0692, desc: "Industrial Zone Distribution Point" },
        "machakos": { lat: -1.5177, lng: 37.2634, desc: "Eastern Region Hub" },
        "malindi": { lat: -3.2230, lng: 40.1169, desc: "Coastal Transit Point" },
        "kakamega": { lat: 0.2842, lng: 34.7523, desc: "Western Transit Center" },
        "kisii": { lat: -0.6817, lng: 34.7717, desc: "Nyanza Highlands Transit Point" },
        "kitale": { lat: 1.0152, lng: 35.0062, desc: "Trans-Nzoia Distribution Center" },
        "garissa": { lat: -0.4569, lng: 39.6401, desc: "North-Eastern Transit Point" },
        "lodwar": { lat: 3.1191, lng: 35.5973, desc: "Turkana Transit Hub" },
        "lamu": { lat: -2.2694, lng: 40.9022, desc: "Northern Coast Logistics Center" },
        "kericho": { lat: -0.3677, lng: 35.2825, desc: "South Rift Distribution Point" },
        "embu": { lat: -0.5311, lng: 37.4506, desc: "Eastern Highlands Transit Center" },
        // Uganda
        "kampala": { lat: 0.3476, lng: 32.5825, desc: "Uganda Central Distribution Hub" },
        "entebbe": { lat: 0.0512, lng: 32.4637, desc: "Entebbe International Logistics Node" },
        "jinja": { lat: 0.4244, lng: 33.2042, desc: "Eastern Uganda Industrial Hub" },
        "mbale": { lat: 1.0785, lng: 34.1758, desc: "Mount Elgon Logistics Point" },
        "mbarara": { lat: -0.6074, lng: 30.6545, desc: "Western Region Transit Hub" },
        "gulu": { lat: 2.7724, lng: 32.2990, desc: "Northern Uganda Logistics Center" },
        "lira": { lat: 2.2473, lng: 32.9000, desc: "Lango Sub-Region Transit Point" },
        "masaka": { lat: -0.3416, lng: 31.7371, desc: "South-Western Transit Node" },
        "arua": { lat: 3.0303, lng: 30.9111, desc: "West Nile Region Logistics Point" },
        "mukono": { lat: 0.3547, lng: 32.7522, desc: "Central Region Logistics Center" },
        "fort portal": { lat: 0.6931, lng: 30.2727, desc: "Tourism & Transit Hub" },
        "soroti": { lat: 1.7146, lng: 33.6111, desc: "Eastern Region Transit Node" },
        "kabale": { lat: -1.2486, lng: 29.9892, desc: "Kigezi Sub-Region Transit Point" },
        "hoima": { lat: 1.4331, lng: 31.3524, desc: "Albertine Region Transit Hub" },
        "tororo": { lat: 0.6925, lng: 34.1808, desc: "Eastern Border Transit Point" },
        // Tanzania
        "dar es salaam": { lat: -6.7924, lng: 39.2083, desc: "Coastal Entry & Distribution Center" },
        "dodoma": { lat: -6.1630, lng: 35.7516, desc: "Tanzania Capital Hub" },
        "arusha": { lat: -3.3731, lng: 36.6853, desc: "Northern Tanzania Logistics Center" },
        "mwanza": { lat: -2.5164, lng: 32.8987, desc: "Lake Victoria Region Hub" },
        "zanzibar city": { lat: -6.1634, lng: 39.1979, desc: "Zanzibar Archipelago Transit Point" },
        "tanga": { lat: -5.0689, lng: 39.0988, desc: "Coastal Port Logistics Point" },
        "mbeya": { lat: -8.9094, lng: 33.4608, desc: "Southern Highlands Transit Center" },
        "morogoro": { lat: -6.8219, lng: 37.6612, desc: "Eastern Transit Node" },
        "tabora": { lat: -5.0162, lng: 32.8267, desc: "Central Transit Hub" },
        "moshi": { lat: -3.3349, lng: 37.3402, desc: "Kilimanjaro Logistics Node" },
        "kigoma": { lat: -4.8769, lng: 29.6267, desc: "Lake Tanganyika Port Point" },
        "iringa": { lat: -7.7854, lng: 35.6862, desc: "Southern Highlands Logistics Node" },
        "songea": { lat: -10.6800, lng: 35.6500, desc: "Ruvuma Transit Hub" },
        "musoma": { lat: -1.5000, lng: 33.8000, desc: "Mara Region Logistics Point" },
        // Rwanda
        "kigali": { lat: -1.9403, lng: 30.0619, desc: "West-Regional Hub" },
        "gisenyi": { lat: -1.6992, lng: 29.2588, desc: "Lake Kivu Logistics Node" },
        "butare": { lat: -2.5967, lng: 29.7394, desc: "Southern Region Transit Center" },
        "musanze": { lat: -1.4998, lng: 29.6350, desc: "Northern Region Logistics Hub" },
        "gitarama": { lat: -2.0739, lng: 29.7567, desc: "Central Transit Hub" },
        "kibuye": { lat: -2.0603, lng: 29.3478, desc: "Western Region Logistics Point" },
        "cyangugu": { lat: -2.4846, lng: 28.8970, desc: "South-Western Border Node" },
        "rwamagana": { lat: -1.9487, lng: 30.4347, desc: "Eastern Region Transit Center" },
        "byumba": { lat: -1.5764, lng: 30.0675, desc: "Northern Province Transit Point" },
        "kibungo": { lat: -2.1597, lng: 30.5422, desc: "Eastern Province Logistics Node" },
        // Burundi
        "bujumbura": { lat: -3.3822, lng: 29.3644, desc: "Burundi Transit & Logistics Point" },
        "gitega": { lat: -3.4271, lng: 29.9246, desc: "Burundi Central Capital Hub" },
        "ngozi": { lat: -2.9075, lng: 29.8306, desc: "Northern Burundi Transit Node" },
        "rumonge": { lat: -3.9739, lng: 29.4386, desc: "Lake Tanganyika Southern Transit Point" },
        "kayanza": { lat: -2.9239, lng: 29.6267, desc: "North-Western Logistics Center" },
        "muyinga": { lat: -2.8489, lng: 30.3414, desc: "North-Eastern Transit Point" },
        "makamba": { lat: -4.1350, lng: 29.8000, desc: "Southern Burundi Transit Point" },
        "kirundo": { lat: -2.5833, lng: 30.1000, desc: "Lake Cohoha Logistics Node" },
        // South Sudan
        "juba": { lat: 4.8517, lng: 31.5822, desc: "South Sudan Distribution Center" },
        "malakal": { lat: 9.5333, lng: 31.6500, desc: "Upper Nile Region Transit Center" },
        "wau": { lat: 7.7000, lng: 27.9833, desc: "Western Bahr el Ghazal Logistics Hub" },
        "yei": { lat: 4.0950, lng: 30.6778, desc: "Southern Border Transit Point" },
        "yambio": { lat: 4.5667, lng: 28.3833, desc: "Western Equatoria Transit Center" },
        "bor": { lat: 6.2081, lng: 31.5594, desc: "Jonglei Region Logistics Point" },
        "bentiu": { lat: 9.2333, lng: 29.8333, desc: "Unity State Logistics Node" },
        "torit": { lat: 4.4133, lng: 32.5678, desc: "Eastern Equatoria Transit Point" },
        "rumbek": { lat: 6.8000, lng: 29.6833, desc: "Lakes State Logistics Hub" },
        // Somalia
        "mogadishu": { lat: 2.0439, lng: 45.3438, desc: "Somalia Port & Primary Logistics Center" },
        "hargeisa": { lat: 9.5624, lng: 44.0652, desc: "Somaliland Logistics Center" },
        "bosaso": { lat: 11.2842, lng: 49.1816, desc: "Northern Port Logistics Point" },
        "galkacyo": { lat: 6.7697, lng: 47.4308, desc: "Central Somalia Transit Node" },
        "kismayo": { lat: -0.3582, lng: 42.5454, desc: "Southern Port Logistics Center" },
        "merca": { lat: 1.7159, lng: 44.7707, desc: "Lower Shabelle Transit Point" },
        "baidoa": { lat: 3.1138, lng: 43.6498, desc: "Bay Region Logistics Node" },
        "burao": { lat: 9.5222, lng: 45.5333, desc: "Togdheer Region Transit Hub" },
        // DRC / Democratic Republic of the Congo
        "kinshasa": { lat: -4.4419, lng: 15.2663, desc: "DRC Central Port Hub" },
        "lubumbashi": { lat: -11.6873, lng: 27.5026, desc: "Katanga Copperbelt Transit Hub" },
        "mbuji-mayi": { lat: -6.1360, lng: 23.5898, desc: "Kasai Region Distribution Point" },
        "kisangani": { lat: 0.5153, lng: 25.1909, desc: "Congo River Logistics Hub" },
        "goma": { lat: -1.6741, lng: 29.2285, desc: "East-Kivu Regional Hub" },
        "bukavu": { lat: -2.5074, lng: 28.8608, desc: "South-Kivu Transit Center" },
        "kananga": { lat: -5.8962, lng: 22.4166, desc: "Lulua Region Logistics Center" },
        "likasi": { lat: -10.9821, lng: 26.7329, desc: "Mining Region Logistics Point" },
        "kolwezi": { lat: -10.7186, lng: 25.4729, desc: "Lualaba Logistics Node" },
        "kikwit": { lat: -5.0410, lng: 18.8162, desc: "Kwilu Province Transit Hub" },
        // Ethiopia
        "addis ababa": { lat: 9.0300, lng: 38.7400, desc: "Ethiopian Central Logistics Hub" },
        "dire dawa": { lat: 9.6000, lng: 41.8667, desc: "Chartered City Transit Point" },
        "mek'ele": { lat: 13.4967, lng: 39.4678, desc: "Tigray Region Logistics Node" },
        "gondar": { lat: 12.6000, lng: 37.4667, desc: "Amhara Province Logistics Hub" },
        "adama": { lat: 8.5414, lng: 39.2689, desc: "Oromia Region Logistics Center" },
        "hawassa": { lat: 7.0500, lng: 38.4833, desc: "Sidama Region Logistics Node" },
        "bahir dar": { lat: 11.5900, lng: 37.3900, desc: "Lake Tana Transit Point" },
        "jimma": { lat: 7.6667, lng: 36.8333, desc: "Oromia Province Transit Point" },
        // Eritrea
        "asmara": { lat: 15.3381, lng: 38.9312, desc: "Eritrean Capital Distribution Hub" },
        "keren": { lat: 15.7778, lng: 38.4500, desc: "Anseba Region Logistics Point" },
        "massawa": { lat: 15.6097, lng: 39.4447, desc: "Red Sea Port Logistics Center" },
        "assab": { lat: 13.0100, lng: 42.7400, desc: "Southern Red Sea Port Node" },
        "mendefera": { lat: 14.8889, lng: 38.8167, desc: "Debub Region Transit Point" },
        // Djibouti
        "djibouti city": { lat: 11.5880, lng: 43.1450, desc: "Horn of Africa Free Trade Port Hub" },
        "ali sabieh": { lat: 11.1514, lng: 42.7125, desc: "Border Transit Logistics Hub" },
        "tadjoura": { lat: 11.7853, lng: 42.8831, desc: "Gulf of Tadjoura Port Point" },
        "obock": { lat: 11.9667, lng: 43.2833, desc: "Northern Port Logistics Node" },
        // Madagascar
        "antananarivo": { lat: -18.8792, lng: 47.5079, desc: "Madagascar Central Logistics Center" },
        "toamasina": { lat: -18.1492, lng: 49.4023, desc: "East Coast Port Logistics Hub" },
        "antsirabe": { lat: -19.8659, lng: 47.0333, desc: "Vakinankaratra Logistics Hub" },
        "mahajanga": { lat: -15.7167, lng: 46.3167, desc: "North-West Coast Port Point" },
        "fianarantsoa": { lat: -21.4500, lng: 47.0833, desc: "Haute Matsiatra Logistics Point" },
        "toliara": { lat: -23.3500, lng: 43.6667, desc: "South-West Coast Port Node" },
        // Mauritius
        "port louis": { lat: -20.1608, lng: 57.5012, desc: "Mauritius Port Logistics Hub" },
        "beau bassin-rose hill": { lat: -20.2294, lng: 57.4697, desc: "Plaines Wilhems Distribution Node" },
        "vacoas-phoenix": { lat: -20.2981, lng: 57.4947, desc: "Central Plaines Wilhems Logistics Center" },
        "curepipe": { lat: -20.3167, lng: 57.5167, desc: "Plaines Wilhems Logistics Point" },
        "quatre bornes": { lat: -20.2667, lng: 57.4833, desc: "Central Mauritius Transit Point" },
        // Seychelles
        "victoria": { lat: -4.6167, lng: 55.4500, desc: "Seychelles Port & Primary Logistics Center" },
        "anse boileau": { lat: -4.7167, lng: 55.4833, desc: "Mahe Island Logistics Point" },
        "bel ombre": { lat: -4.6167, lng: 55.4167, desc: "Mahe Island North Logistics Node" },
        "beau vallon": { lat: -4.6167, lng: 55.4333, desc: "Beau Vallon Logistics Point" },
        // Comoros
        "moroni": { lat: -11.7022, lng: 43.2551, desc: "Grande Comore Logistics Hub" },
        "mutsamudu": { lat: -12.1667, lng: 44.4000, desc: "Anjouan Island Port Logistics Hub" },
        "fomboni": { lat: -12.2833, lng: 43.7333, desc: "Moheli Island Transit Node" },
        // Sudan
        "khartoum": { lat: 15.5007, lng: 32.5599, desc: "Sudan Primary Logistics Hub" },
        "omdurman": { lat: 15.6500, lng: 32.4833, desc: "Khartoum State Transit Center" },
        "port sudan": { lat: 19.6158, lng: 37.2164, desc: "Red Sea Port Logistics Hub" },
        "kassala": { lat: 15.4510, lng: 36.4000, desc: "Eastern Border Transit Hub" },
        "el obeid": { lat: 13.1849, lng: 30.2201, desc: "North Kordofan Logistics Node" },
        "nyala": { lat: 12.0500, lng: 24.8833, desc: "South Darfur Logistics Hub" }
      };

      const COUNTRY_FALLBACKS: Record<string, { lat: number; lng: number; desc: string }> = {
        "kenya": { lat: -1.2921, lng: 36.8219, desc: "Kenya Transit Hub" },
        "uganda": { lat: 0.3476, lng: 32.5825, desc: "Uganda Transit Hub" },
        "tanzania": { lat: -6.7924, lng: 39.2083, desc: "Tanzania Transit Hub" },
        "rwanda": { lat: -1.9403, lng: 30.0619, desc: "Rwanda Transit Hub" },
        "burundi": { lat: -3.3822, lng: 29.3644, desc: "Burundi Transit Hub" },
        "south sudan": { lat: 4.8517, lng: 31.5822, desc: "South Sudan Transit Hub" },
        "somalia": { lat: 2.0439, lng: 45.3438, desc: "Somalia Transit Hub" },
        "democratic republic of the congo": { lat: -4.4419, lng: 15.2663, desc: "DRC Transit Hub" },
        "drc": { lat: -4.4419, lng: 15.2663, desc: "DRC Transit Hub" },
        "ethiopia": { lat: 9.0300, lng: 38.7400, desc: "Ethiopia Transit Hub" },
        "eritrea": { lat: 15.3381, lng: 38.9312, desc: "Eritrea Transit Hub" },
        "djibouti": { lat: 11.5880, lng: 43.1450, desc: "Djibouti Transit Hub" },
        "madagascar": { lat: -18.8792, lng: 47.5079, desc: "Madagascar Transit Hub" },
        "mauritius": { lat: -20.1608, lng: 57.5012, desc: "Mauritius Transit Hub" },
        "seychelles": { lat: -4.6167, lng: 55.4500, desc: "Seychelles Transit Hub" },
        "comoros": { lat: -11.7022, lng: 43.2551, desc: "Comoros Transit Hub" },
        "sudan": { lat: 15.5007, lng: 32.5599, desc: "Sudan Transit Hub" }
      };

      countriesList.forEach((country: any) => {
        if (country.cities && Array.isArray(country.cities)) {
          country.cities.forEach((city: any) => {
            const hubName = `${city.name}, ${country.name}`;
            const existing = retrievedHubs.find((h: any) => h.name.toLowerCase() === hubName.toLowerCase() || h.name.toLowerCase() === city.name.toLowerCase());
            
            if (existing) {
              derivedHubs.push({
                name: hubName,
                lat: parseFloat(existing.lat) || 0,
                lng: parseFloat(existing.lng) || 0,
                desc: existing.desc || ""
              });
            } else {
              const cleanCity = city.name.trim().toLowerCase();
              const cleanCountry = country.name.trim().toLowerCase();
              const coords = PREDEFINED_COORDINATES[cleanCity] || PREDEFINED_COORDINATES[cleanCountry] || COUNTRY_FALLBACKS[cleanCountry];
              
              if (coords) {
                derivedHubs.push({
                  name: hubName,
                  lat: coords.lat,
                  lng: coords.lng,
                  desc: ""
                });
              } else {
                derivedHubs.push({
                  name: hubName,
                  lat: -1.2921,
                  lng: 36.8219,
                  desc: ""
                });
              }
            }
          });
        }
      });

      setSettings(prev => ({ ...prev, ...response.data }));
      setHubsList(derivedHubs);
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Validate Kenyan phone/whatsapp format
    const phoneRegex = /^(?:\+254|0)?([71])\d{8}$/;
    if (settings.contact_phone) {
      const cleanPhone = settings.contact_phone.replace(/\s+/g, "");
      if (!phoneRegex.test(cleanPhone)) {
        showAlert("Invalid Phone Number", "The support phone number must be a valid Kenyan number (e.g. +254 7XXXXXXXX or 07XXXXXXXX).", "error");
        return;
      }
    }
    if (settings.contact_whatsapp) {
      const cleanPhone = settings.contact_whatsapp.replace(/\s+/g, "");
      if (!phoneRegex.test(cleanPhone)) {
        showAlert("Invalid WhatsApp Number", "The WhatsApp contact must be a valid Kenyan number (e.g. +254 7XXXXXXXX or 07XXXXXXXX).", "error");
        return;
      }
    }

    try {
      setSaving(true);
      const payload = {
        ...settings,
        map_hubs: JSON.stringify(hubsList)
      };
      await api.post("/settings", payload);
      showAlert("Changes Saved", "Your enterprise platform settings have been successfully updated.", "success");
    } catch (error) {
      console.error("Failed to save settings:", error);
      showAlert("Save Failed", "There was an error saving your preferences. Please try again.", "error");
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

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordState.current_password || !passwordState.password || !passwordState.password_confirmation) {
      showAlert("Validation Error", "Please fill in all the required password fields.", "info");
      return;
    }
    if (passwordState.password !== passwordState.password_confirmation) {
      showAlert("Mismatch Error", "Your new password and confirmation password do not match.", "info");
      return;
    }
    if (passwordState.password === passwordState.current_password) {
      showAlert("Invalid Password", "Your new password must be different from your current password.", "info");
      return;
    }
    try {
      setUpdatingPassword(true);
      await api.post("/change-password", {
        current_password: passwordState.current_password,
        password: passwordState.password,
        password_confirmation: passwordState.password_confirmation
      });
      showAlert("Security Updated", "Your administrator account password was changed successfully.", "success");
      setPasswordState({
        current_password: "",
        password: "",
        password_confirmation: ""
      });
    } catch (error: any) {
      console.error("Failed to update password:", error);
      const errMsg = error.response?.data?.message || error.response?.data?.errors?.current_password?.[0] || error.response?.data?.errors?.password?.[0] || "Failed to update password.";
      showAlert("Update Failed", errMsg, "error");
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleLogoutAllDevices = async () => {
    setModal({
      isOpen: true,
      title: "Logout All Devices?",
      description: "Are you sure you want to terminate all active sessions? This will log out every other device currently signed in, as well as your current browser session.",
      type: "confirm_logout",
      onConfirm: async () => {
        try {
          await api.post("/logout-all");
          logout();
        } catch (error) {
          console.error("Failed to log out of all devices:", error);
          showAlert("Operation Failed", "Could not sign out of other active sessions at this time.", "error");
        }
      }
    });
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
    <div className="space-y-6 p-3 sm:p-6">
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
                { value: "general",        icon: Store,    label: "General Profile" },
                { value: "notifications",  icon: Bell,     label: "Notifications" },
                { value: "map_hubs",       icon: Globe,    label: "Map Hubs / Regions" },
                { value: "customer_ranks", icon: Star,     label: "Customer Ranks" },
                { value: "security",       icon: Shield,   label: "Security" },
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

              {/* Logo Upload */}
              <div className="space-y-4 border-b pb-6">
                <Label className={labelCls}>Store Logo</Label>
                <div className="flex flex-wrap items-center gap-6 mt-1.5">
                  {settings.store_logo ? (
                    <div className="relative shrink-0">
                      <div className="h-20 w-20 rounded-full overflow-hidden border-2 border-zinc-200 bg-zinc-50 flex items-center justify-center">
                        <img src={settings.store_logo} alt="Store Logo Preview" className="h-full w-full object-cover" />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSettings(prev => ({ ...prev, store_logo: "" }));
                        }}
                        className="absolute -top-1.5 -right-1.5 h-6 w-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-md transition-all border border-white"
                        title="Remove Logo"
                      >
                        <X className="h-3.5 w-3.5 font-bold" />
                      </button>
                    </div>
                  ) : (
                    <div className="h-20 w-20 rounded-full border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center text-zinc-400 bg-zinc-50 shrink-0">
                      <ImageIcon className="h-6 w-6 text-zinc-300" />
                    </div>
                  )}
                  <div className="space-y-2">
                    <input
                      type="file"
                      id="logo-upload"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 2 * 1024 * 1024) {
                            alert("Image size should be less than 2MB");
                            return;
                          }
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setSettings(prev => ({ ...prev, store_logo: reader.result as string }));
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById("logo-upload")?.click()}
                      className="h-10 px-4 font-bold border-zinc-300 rounded-lg hover:bg-zinc-50"
                    >
                      <Upload className="h-4 w-4 mr-2" /> Upload Logo
                    </Button>
                    <p className="text-[10px] text-zinc-400 font-medium">PNG, JPG or WebP (max. 2MB). Fits on dark/light headers.</p>
                  </div>
                </div>
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
                <div className="space-y-1.5 md:col-span-2">
                  <Label className={labelCls}>Store Description</Label>
                  <Textarea
                    name="store_description"
                    value={settings.store_description || ""}
                    onChange={handleChange}
                    placeholder="Brief description displayed on the landing page below the tagline."
                    className={cn(inputCls, "h-20 resize-none")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className={labelCls}>Business Country</Label>
                  <select
                    name="store_country"
                    value={settings.store_country || "Kenya"}
                    onChange={(e) => {
                      setSettings(prev => ({ ...prev, store_country: e.target.value }));
                    }}
                    className="h-10 w-full px-3 border border-zinc-200 rounded-lg text-sm font-semibold bg-white outline-none focus:ring-2 focus:ring-primary/20 text-zinc-700"
                  >
                    <option value="Kenya">Kenya</option>
                    <option value="Uganda">Uganda</option>
                    <option value="Tanzania">Tanzania</option>
                    <option value="Rwanda">Rwanda</option>
                    <option value="Burundi">Burundi</option>
                    <option value="Nigeria">Nigeria</option>
                    <option value="South Africa">South Africa</option>
                    <option value="United Kingdom">United Kingdom</option>
                    <option value="United States">United States</option>
                  </select>
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
                <div className="space-y-1.5 md:col-span-2">
                  <Label className={labelCls}>Physical Address</Label>
                  <Textarea name="physical_address" value={settings.physical_address || ""} onChange={handleChange} placeholder="Nairobi, Kenya" className="border-zinc-200 rounded-lg bg-white min-h-[80px]" />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label className={labelCls}>Working Hours</Label>
                  <Textarea name="working_hours" value={settings.working_hours || ""} onChange={handleChange} placeholder="Mon - Fri: 8:00 AM - 5:00 PM&#10;Sat: 9:00 AM - 2:00 PM" className="border-zinc-200 rounded-lg bg-white min-h-[80px]" />
                </div>

                {/* ── Official Company Header & Compliance (For PDF Reports) ── */}
                <div className="md:col-span-2 pt-6 border-t border-zinc-150">
                  <h3 className="text-sm font-bold text-zinc-900 mb-4">Official Company Header & Compliance Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <Label className={labelCls}>Legal Company Address (PDF Header)</Label>
                      <Input name="store_address" value={settings.store_address || ""} onChange={handleChange} placeholder="Mombasa Road, Nairobi Central Hub, Suite 4B" className={inputCls} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className={labelCls}>Official Phone Number (PDF Header)</Label>
                      <Input name="store_phone" value={settings.store_phone || ""} onChange={handleChange} placeholder="+254 711 223 344" className={inputCls} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className={labelCls}>Official Email Address (PDF Header)</Label>
                      <Input name="store_email" value={settings.store_email || ""} onChange={handleChange} placeholder="billing@autospare.com" className={inputCls} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className={labelCls}>Official Website Url</Label>
                      <Input name="store_website" value={settings.store_website || ""} onChange={handleChange} placeholder="www.autospare.com" className={inputCls} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className={labelCls}>Tax Registration / KRA PIN</Label>
                      <Input name="store_kra_pin" value={settings.store_kra_pin || ""} onChange={handleChange} placeholder="A001234567Z" className={inputCls} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className={labelCls}>Business Registration Number</Label>
                      <Input name="store_reg_number" value={settings.store_reg_number || ""} onChange={handleChange} placeholder="PVT-79A8B6C" className={inputCls} />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <Label className={labelCls}>Default Primary Warehouse / Branch Name</Label>
                      <Input name="store_branch" value={settings.store_branch || ""} onChange={handleChange} placeholder="Nairobi Main Warehouse" className={inputCls} />
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ── Map Hubs / Regions Tab Content ── */}
            <TabsContent value="map_hubs" className="mt-0 space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold text-zinc-900">Map Hubs / Regions</h2>
                  <p className="text-zinc-500 text-sm mt-0.5">Set the overlay description for each hub pin, synced automatically from your active shipping zones.</p>
                </div>
              </div>

              {/* Automatic Sync Banner */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 text-xs text-blue-800 font-semibold leading-relaxed shadow-sm">
                <Globe className="h-5 w-5 text-blue-500 shrink-0 mt-0.5 animate-pulse" />
                <div>
                  <p className="font-black text-blue-900 uppercase tracking-wider text-[10px]">Automatic Shipping Zone Sync Active</p>
                  <p className="mt-0.5 text-blue-700/90 font-medium">All map hub names and coordinates are generated automatically from your active Shipping Zones. Use the filters below to find a specific city or country and set its overlay description.</p>
                </div>
              </div>

              {/* ── Filters ── */}
              {hubsList.length > 0 && (
                <div className="flex flex-wrap gap-3 items-center">

                  {/* Country Filter */}
                  <div className="relative" ref={countryDropdownRef}>
                    <button
                      type="button"
                      onClick={() => { setHubCountryOpen(o => !o); setHubCityOpen(false); }}
                      className="h-9 min-w-[160px] px-3 flex items-center justify-between gap-2 border border-zinc-200 rounded-lg bg-white text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors shadow-xs"
                    >
                      <span className="truncate">{hubCountryFilter === "all" ? "All Countries" : hubCountryFilter}</span>
                      <svg className="h-3.5 w-3.5 text-zinc-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {hubCountryOpen && (
                      <div className="absolute z-50 top-full mt-1 left-0 w-56 bg-white border border-zinc-200 rounded-xl shadow-xl overflow-hidden">
                        <div className="p-2 border-b border-zinc-100">
                          <div className="relative">
                            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            <input
                              autoFocus
                              value={hubCountrySearch}
                              onChange={e => setHubCountrySearch(e.target.value)}
                              placeholder="Search country..."
                              className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-zinc-200 focus:outline-none focus:ring-1 focus:ring-primary/30"
                            />
                          </div>
                        </div>
                        <div className="overflow-y-auto max-h-52">
                          {["all", ...hubCountryOptions]
                            .filter(c => c === "all" || c.toLowerCase().includes(hubCountrySearch.toLowerCase()))
                            .map(country => (
                              <button
                                key={country}
                                type="button"
                                onClick={() => {
                                  setHubCountryFilter(country);
                                  setHubCityFilter("all");
                                  setHubCitySearch("");
                                  setHubCountrySearch("");
                                  setHubCountryOpen(false);
                                  setHubsPage(1);
                                }}
                                className={cn(
                                  "w-full text-left px-3 py-2 text-xs font-semibold hover:bg-zinc-50 transition-colors",
                                  hubCountryFilter === country ? "text-primary bg-primary/5 font-bold" : "text-zinc-700"
                                )}
                              >
                                {country === "all" ? "All Countries" : country}
                              </button>
                            ))
                          }
                          {hubCountryOptions.filter(c => c.toLowerCase().includes(hubCountrySearch.toLowerCase())).length === 0 && hubCountrySearch && (
                            <p className="text-xs text-zinc-400 text-center py-3">No countries found</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* City Filter */}
                  <div className="relative" ref={cityDropdownRef}>
                    <button
                      type="button"
                      onClick={() => { setHubCityOpen(o => !o); setHubCountryOpen(false); }}
                      className="h-9 min-w-[160px] px-3 flex items-center justify-between gap-2 border border-zinc-200 rounded-lg bg-white text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors shadow-xs"
                    >
                      <span className="truncate">{hubCityFilter === "all" ? "All Cities" : hubCityFilter}</span>
                      <svg className="h-3.5 w-3.5 text-zinc-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {hubCityOpen && (
                      <div className="absolute z-50 top-full mt-1 left-0 w-56 bg-white border border-zinc-200 rounded-xl shadow-xl overflow-hidden">
                        <div className="p-2 border-b border-zinc-100">
                          <div className="relative">
                            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            <input
                              autoFocus
                              value={hubCitySearch}
                              onChange={e => setHubCitySearch(e.target.value)}
                              placeholder="Search city..."
                              className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-zinc-200 focus:outline-none focus:ring-1 focus:ring-primary/30"
                            />
                          </div>
                        </div>
                        <div className="overflow-y-auto max-h-52">
                          {["all", ...hubCityOptions]
                            .filter(c => c === "all" || c.toLowerCase().includes(hubCitySearch.toLowerCase()))
                            .map(city => (
                              <button
                                key={city}
                                type="button"
                                onClick={() => {
                                  setHubCityFilter(city);
                                  setHubCitySearch("");
                                  setHubCityOpen(false);
                                  setHubsPage(1);
                                }}
                                className={cn(
                                  "w-full text-left px-3 py-2 text-xs font-semibold hover:bg-zinc-50 transition-colors",
                                  hubCityFilter === city ? "text-primary bg-primary/5 font-bold" : "text-zinc-700"
                                )}
                              >
                                {city === "all" ? "All Cities" : city}
                              </button>
                            ))
                          }
                          {hubCityOptions.filter(c => c.toLowerCase().includes(hubCitySearch.toLowerCase())).length === 0 && hubCitySearch && (
                            <p className="text-xs text-zinc-400 text-center py-3">No cities found</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Active filter chip + clear */}
                  {(hubCountryFilter !== "all" || hubCityFilter !== "all") && (
                    <button
                      type="button"
                      onClick={() => { setHubCountryFilter("all"); setHubCityFilter("all"); setHubsPage(1); }}
                      className="h-9 px-3 flex items-center gap-1.5 text-xs font-bold text-zinc-500 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
                    >
                      <X className="h-3 w-3" /> Clear Filters
                    </button>
                  )}

                  <span className="ml-auto text-xs font-semibold text-zinc-400">
                    {filteredHubs.length} hub{filteredHubs.length !== 1 ? "s" : ""} shown
                  </span>
                </div>
              )}

              <div className="space-y-3">
                {hubsList.length === 0 ? (
                  <div className="text-center p-12 bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
                    <Globe className="h-10 w-10 text-zinc-300 mx-auto mb-2 animate-bounce" />
                    <p className="font-bold text-zinc-500 text-sm">No Active Shipping Zones Defined</p>
                    <p className="text-zinc-400 text-xs mt-1">Add countries and cities in the <strong className="font-bold text-primary">Logistics &rarr; Shipping Zones</strong> tab to automatically generate map pins!</p>
                  </div>
                ) : filteredHubs.length === 0 ? (
                  <div className="text-center p-10 bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
                    <Globe className="h-8 w-8 text-zinc-300 mx-auto mb-2" />
                    <p className="font-bold text-zinc-500 text-sm">No hubs match your filters</p>
                    <p className="text-zinc-400 text-xs mt-1">Try selecting a different country or city.</p>
                  </div>
                ) : (
                  <>
                    {filteredHubs
                      .slice((hubsPage - 1) * hubsPageSize, hubsPage * hubsPageSize)
                      .map((hub) => {
                        // Find the true index in hubsList to update correctly
                        const absoluteIdx = hubsList.findIndex(h => h.name === hub.name);
                        const parts = hub.name.split(", ");
                        const city = parts[0] || hub.name;
                        const country = parts.slice(1).join(", ") || "";
                        return (
                          <Card key={hub.name} className="border-zinc-200 shadow-sm relative overflow-hidden bg-white hover:shadow-md transition-shadow">
                            <CardContent className="p-5 flex flex-col md:flex-row md:items-center gap-4">
                              {/* Location badge */}
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="h-9 w-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                                  <Globe className="h-4 w-4 text-blue-500" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-zinc-900 truncate">{city}</p>
                                  {country && <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">{country}</p>}
                                </div>
                              </div>
                              {/* Description input */}
                              <div className="flex-[2] space-y-1">
                                <Label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Overlay / Description</Label>
                                <Input
                                  value={hub.desc}
                                  onChange={(e) => {
                                    const updated = [...hubsList];
                                    if (absoluteIdx !== -1) updated[absoluteIdx].desc = e.target.value;
                                    setHubsList(updated);
                                  }}
                                  placeholder="e.g. Main Distribution Center & HQ, Mombasa Road..."
                                  className="bg-white border-zinc-200 font-medium text-zinc-700 h-9 text-sm"
                                />
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })
                    }
                    <PaginationControls
                      currentPage={hubsPage}
                      setCurrentPage={setHubsPage}
                      pageSize={hubsPageSize}
                      setPageSize={(size: number) => { setHubsPageSize(size); setHubsPage(1); }}
                      totalItems={filteredHubs.length}
                      itemName="hubs"
                      pageSizeOptions={[5, 10, 20, 50]}
                    />
                  </>
                )}
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
                  <div key={item.name} className="flex items-center justify-between p-4 border border-zinc-200 rounded-xl bg-zinc-50/50 hover:bg-zinc-50 transition-colors">
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-zinc-900">{item.label}</p>
                      <p className="text-xs text-zinc-500">{item.desc}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={settings[item.name] === "true"}
                      onClick={() => {
                        setSettings(prev => ({
                          ...prev,
                          [item.name]: prev[item.name] === "true" ? "false" : "true"
                        }));
                      }}
                      className={cn(
                        "w-11 h-6 rounded-full relative transition-colors shrink-0 outline-none cursor-pointer focus:ring-2 focus:ring-primary/20",
                        settings[item.name] === "true" ? "bg-emerald-500" : "bg-zinc-300"
                      )}
                    >
                      <span className={cn(
                        "block w-4 h-4 bg-white rounded-full absolute top-1 left-1 transition-transform shadow-sm",
                        settings[item.name] === "true" ? "translate-x-5" : "translate-x-0"
                      )} />
                    </button>
                  </div>
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
                      <Input name="admin_name" value={user?.name || ""} readOnly className="h-10 border-zinc-200 rounded-lg bg-zinc-50 text-zinc-500 cursor-not-allowed" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-zinc-500">Email Address</Label>
                      <Input type="email" name="admin_email" value={user?.email || ""} readOnly className="h-10 border-zinc-200 rounded-lg bg-zinc-50 text-zinc-500 cursor-not-allowed" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-zinc-500">Phone Number</Label>
                      <Input name="admin_phone" value={user?.phone || ""} readOnly className="h-10 border-zinc-200 rounded-lg bg-zinc-50 text-zinc-500 cursor-not-allowed" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-zinc-500">Organization Role</Label>
                      <Input name="admin_role" value={user?.role === "superadmin" ? "Super Admin" : user?.role === "admin" ? "Admin" : user?.role || ""} readOnly className="h-10 border-zinc-200 rounded-lg bg-zinc-50 text-zinc-500 cursor-not-allowed" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Change Password Section */}
              <form onSubmit={handleUpdatePassword} className="space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-zinc-900">Change Password</h2>
                  <p className="text-zinc-500 text-sm mt-0.5">We recommend updating your password every 90 days.</p>
                </div>
                <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-5 border-b border-zinc-100 bg-zinc-50/50">
                    <p className="text-xs font-black text-zinc-400 uppercase tracking-widest">Security Credentials</p>
                  </div>
                  <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div className="space-y-1.5 relative">
                      <Label className="text-xs font-semibold text-zinc-500">Current Password</Label>
                      <div className="relative">
                        <Input 
                          type={showCurrent ? "text" : "password"} 
                          value={passwordState.current_password}
                          onChange={(e) => setPasswordState(prev => ({ ...prev, current_password: e.target.value }))}
                          placeholder="••••••••" 
                          className="h-10 border-zinc-200 rounded-lg bg-white pr-10 w-full" 
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrent(!showCurrent)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors outline-none cursor-pointer"
                        >
                          {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5 relative">
                      <Label className="text-xs font-semibold text-zinc-500">New Password</Label>
                      <div className="relative">
                        <Input 
                          type={showNew ? "text" : "password"} 
                          value={passwordState.password}
                          onChange={(e) => setPasswordState(prev => ({ ...prev, password: e.target.value }))}
                          placeholder="••••••••" 
                          className="h-10 border-zinc-200 rounded-lg bg-white pr-10 w-full" 
                        />
                        <button
                          type="button"
                          onClick={() => setShowNew(!showNew)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors outline-none cursor-pointer"
                        >
                          {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5 relative">
                      <Label className="text-xs font-semibold text-zinc-500">Confirm New Password</Label>
                      <div className="relative">
                        <Input 
                          type={showConfirm ? "text" : "password"} 
                          value={passwordState.password_confirmation}
                          onChange={(e) => setPasswordState(prev => ({ ...prev, password_confirmation: e.target.value }))}
                          placeholder="••••••••" 
                          className="h-10 border-zinc-200 rounded-lg bg-white pr-10 w-full" 
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirm(!showConfirm)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors outline-none cursor-pointer"
                        >
                          {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="px-6 pb-6 flex justify-end">
                    <Button 
                      type="submit" 
                      disabled={updatingPassword}
                      className="bg-primary text-white hover:bg-primary/90 rounded-lg shadow-sm font-bold h-10 px-6"
                    >
                      {updatingPassword ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Update Password
                    </Button>
                  </div>
                </div>
              </form>

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
                      <p className="text-xs text-zinc-400 mt-0.5">Logged in now · {[(user as any)?.city, (user as any)?.country].filter(Boolean).join(", ") || "Location not set"}</p>
                    </div>
                    <Button 
                      onClick={handleLogoutAllDevices}
                      variant="outline" 
                      className="rounded-lg border-zinc-200 font-bold h-10 text-red-600 border-red-200 hover:bg-red-50 cursor-pointer"
                    >
                      Logout All Devices
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ── Customer Ranks ── */}
            <TabsContent value="customer_ranks" className="mt-0 space-y-6">
              <div>
                <h2 className="text-lg font-bold text-zinc-900">Customer Ranks</h2>
                <p className="text-zinc-500 text-sm mt-0.5">Configure minimum lifetime spending (LTV) thresholds to determine each customer rank. These values are used across the customer portal and admin dashboard.</p>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 text-xs text-blue-800 font-semibold leading-relaxed">
                <Star className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-black text-blue-900 uppercase tracking-wider text-[10px]">Dynamic Rank System</p>
                  <p className="mt-0.5 text-blue-700/90 font-medium">Rank badges on the customer portal and admin insights will automatically update based on each customer's total spend versus these thresholds. Bronze always starts at Ksh 0.</p>
                </div>
              </div>

              <div className="space-y-4 max-w-lg">
                {[
                  {
                    key: "rank_silver_threshold",
                    label: "Silver Tier Minimum Spend",
                    desc: "Customers who spend at or above this amount will be promoted to Silver rank.",
                    default: "10000",
                    color: "text-slate-500",
                    icon: "🥈"
                  },
                  {
                    key: "rank_gold_threshold",
                    label: "Gold Tier Minimum Spend",
                    desc: "Customers who spend at or above this amount will be promoted to Gold rank.",
                    default: "50000",
                    color: "text-yellow-600",
                    icon: "🥇"
                  },
                  {
                    key: "rank_platinum_threshold",
                    label: "Platinum Tier Minimum Spend",
                    desc: "The highest rank — awarded to your most valuable customers.",
                    default: "150000",
                    color: "text-blue-600",
                    icon: "💎"
                  },
                ].map((tier) => (
                  <div key={tier.key} className="border border-zinc-200 rounded-xl p-5 bg-white shadow-sm space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{tier.icon}</span>
                      <Label className={cn("text-sm font-bold", tier.color)}>{tier.label}</Label>
                    </div>
                    <p className="text-xs text-zinc-500">{tier.desc}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-bold text-zinc-400">Ksh</span>
                      <Input
                        type="number"
                        min="0"
                        name={tier.key}
                        value={settings[tier.key] ?? tier.default}
                        onChange={handleChange}
                        placeholder={tier.default}
                        className={cn(inputCls, "font-bold max-w-[200px]")}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="border border-zinc-100 rounded-xl p-4 bg-zinc-50 text-xs text-zinc-500 space-y-1">
                <p className="font-bold text-zinc-700">Rank Tiers Summary:</p>
                <ul className="space-y-1">
                  <li>🥉 <strong>Bronze</strong> — Ksh 0 to Silver threshold (default entry rank)</li>
                  <li>🥈 <strong>Silver</strong> — From Silver threshold to Gold threshold</li>
                  <li>🥇 <strong>Gold</strong> — From Gold threshold to Platinum threshold</li>
                  <li>💎 <strong>Platinum</strong> — Above Platinum threshold (top-tier B2B clients)</li>
                </ul>
              </div>
            </TabsContent>

          </div>
        </Tabs>
      </div>
      <Dialog open={modal.isOpen} onOpenChange={(open) => setModal(prev => ({ ...prev, isOpen: open }))}>
        <DialogContent className="max-w-md p-6 rounded-xl border border-zinc-200 bg-white shadow-2xl">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-lg font-bold text-zinc-900 flex items-center gap-2">
              {modal.type === "confirm_logout" && <Shield className="h-5 w-5 text-red-500 animate-pulse" />}
              {modal.type === "success" && <div className="h-5 w-5 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-xs">✓</div>}
              {modal.type === "error" && <div className="h-5 w-5 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-xs">✗</div>}
              {modal.type === "info" && <div className="h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">i</div>}
              {modal.title}
            </DialogTitle>
            <DialogDescription className="text-zinc-500 text-sm leading-relaxed mt-1">
              {modal.description}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6 flex flex-col-reverse sm:flex-row justify-end gap-2 bg-zinc-50/50 p-4 -mx-6 -mb-6 border-t border-zinc-100">
            {modal.type === "confirm_logout" ? (
              <>
                <Button 
                  variant="outline" 
                  onClick={() => setModal(prev => ({ ...prev, isOpen: false }))}
                  className="rounded-lg font-bold h-10 border-zinc-200 cursor-pointer"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={() => {
                    setModal(prev => ({ ...prev, isOpen: false }));
                    if (modal.onConfirm) modal.onConfirm();
                  }}
                  className="rounded-lg bg-red-600 text-white hover:bg-red-700 font-bold h-10 px-5 cursor-pointer"
                >
                  Logout Devices
                </Button>
              </>
            ) : (
              <Button 
                onClick={() => setModal(prev => ({ ...prev, isOpen: false }))}
                className="rounded-lg bg-primary text-white hover:bg-primary/90 font-bold h-10 px-6 w-full sm:w-auto cursor-pointer"
              >
                Okay
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
