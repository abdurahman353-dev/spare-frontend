"use client";

import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Search, Filter, Plus, Loader2, Navigation, Package, ArrowRight, RefreshCw, X, MoreHorizontal, Edit, Trash2, CheckSquare, Square, ArrowRightLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buttonVariants } from "@/components/ui/button";
import { toast } from "react-hot-toast";
import api from "@/lib/axios";
import { SearchableDropdown } from "@/components/ui/searchable-dropdown";
import { PaginationControls } from "@/components/ui/pagination-controls";

const EAST_AFRICAN_COUNTRIES = [
  { id: "Burundi", name: "Burundi", flagCode: "bi" },
  { id: "Comoros", name: "Comoros", flagCode: "km" },
  { id: "Djibouti", name: "Djibouti", flagCode: "dj" },
  { id: "Eritrea", name: "Eritrea", flagCode: "er" },
  { id: "Ethiopia", name: "Ethiopia", flagCode: "et" },
  { id: "Kenya", name: "Kenya", flagCode: "ke" },
  { id: "Madagascar", name: "Madagascar", flagCode: "mg" },
  { id: "Malawi", name: "Malawi", flagCode: "mw" },
  { id: "Mauritius", name: "Mauritius", flagCode: "mu" },
  { id: "Mozambique", name: "Mozambique", flagCode: "mz" },
  { id: "Rwanda", name: "Rwanda", flagCode: "rw" },
  { id: "Seychelles", name: "Seychelles", flagCode: "sc" },
  { id: "Somalia", name: "Somalia", flagCode: "so" },
  { id: "South Sudan", name: "South Sudan", flagCode: "ss" },
  { id: "Tanzania", name: "Tanzania", flagCode: "tz" },
  { id: "Uganda", name: "Uganda", flagCode: "ug" },
  { id: "Zambia", name: "Zambia", flagCode: "zm" },
  { id: "Zimbabwe", name: "Zimbabwe", flagCode: "zw" },
];

const PREDEFINED_CITIES: Record<string, string[]> = {
  "Burundi": ["Bujumbura", "Gitega", "Ngozi", "Rumonge", "Kayanza", "Muyinga", "Makamba", "Kirundo"],
  "Comoros": ["Moroni", "Mutsamudu", "Fomboni"],
  "Djibouti": ["Djibouti city", "Ali Sabieh", "Tadjoura", "Obock"],
  "Eritrea": ["Asmara", "Massawa", "Keren", "Assab", "Mendefera"],
  "Ethiopia": ["Addis Ababa", "Dire Dawa", "Bahir Dar", "Gondar", "Mek'ele", "Hawassa", "Jimma", "Adama"],
  "Kenya": ["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret", "Malindi", "Thika", "Naivasha", "Nyeri", "Machakos", "Kakamega", "Kisii", "Kitale", "Garissa", "Lodwar", "Lamu", "Kericho", "Embu"],
  "Madagascar": ["Antananarivo", "Toamasina", "Antsirabe", "Mahajanga", "Fianarantsoa", "Toliara"],
  "Malawi": ["Lilongwe", "Blantyre", "Mzuzu", "Zomba"],
  "Mauritius": ["Port Louis", "Beau Bassin-rose hill", "Vacoas-phoenix", "Curepipe", "Quatre Bornes"],
  "Mozambique": ["Maputo", "Beira", "Nampula", "Chimoio"],
  "Rwanda": ["Kigali", "Gisenyi", "Butare", "Musanze", "Gitarama", "Kibuye", "Cyangugu", "Rwamagana", "Byumba", "Kibungo"],
  "Seychelles": ["Victoria", "Anse Boileau", "Bel Ombre", "Beau Vallon"],
  "Somalia": ["Mogadishu", "Hargeisa", "Garowe", "Kismayo", "Bosaso", "Merca", "Baidoa", "Burao"],
  "South Sudan": ["Juba", "Malakal", "Wau", "Yei", "Yambio", "Bor", "Bentiu", "Torit", "Rumbek"],
  "Tanzania": ["Dar es Salaam", "Dodoma", "Arusha", "Mwanza", "Zanzibar City", "Mbeya", "Morogoro", "Tanga", "Tabora", "Moshi", "Kigoma", "Iringa", "Songea", "Musoma"],
  "Uganda": ["Kampala", "Entebbe", "Jinja", "Gulu", "Mbarara", "Mbale", "Masaka", "Lira", "Arua", "Mukono", "Fort Portal", "Soroti", "Kabale", "Hoima", "Tororo"],
  "Zambia": ["Lusaka", "Ndola", "Kitwe", "Kabwe", "Livingstone"],
  "Zimbabwe": ["Harare", "Bulawayo", "Mutare", "Gweru", "Masvingo"]
};

export default function AdminLogisticsPage() {
  const [activeTab, setActiveTab] = useState("Active Shipments");
  const [loading, setLoading] = useState(false);
  const [shipments, setShipments] = useState<any[]>([]);
  const [unassignedOrders, setUnassignedOrders] = useState<any[]>([]);
  const [destinations, setDestinations] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [warehousesData, setWarehousesData] = useState<any[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<number[]>([]);
  
  // Locations Data (Actual Shipping Zones)
  const [countriesData, setCountriesData] = useState<any[]>([]);
  const [isCountryModalOpen, setIsCountryModalOpen] = useState(false);
  const [countryFormData, setCountryFormData] = useState({ id: null as number | null, name: "", is_active: true });
  const [isCityModalOpen, setIsCityModalOpen] = useState(false);
  const [cityFormData, setCityFormData] = useState({ countryId: null as number | null, cities: "" });
  
  // Filtering States (Matches Orders Page)
  const [searchQuery, setSearchQuery] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("All Origins");
  const [cityFilter, setCityFilter] = useState("All Destinations");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [zoneToDelete, setZoneToDelete] = useState<number | null>(null);
  
  const [isDeleteCountryModalOpen, setIsDeleteCountryModalOpen] = useState(false);
  const [countryToDelete, setCountryToDelete] = useState<number | null>(null);
  
  const [isDeleteCityModalOpen, setIsDeleteCityModalOpen] = useState(false);
  const [cityToDelete, setCityToDelete] = useState<number | null>(null);

  const [isSaving, setIsSaving] = useState(false);

  // Shipping Fee Filters
  const [feeSearchQuery, setFeeSearchQuery] = useState("");
  const [feeCountryFilter, setFeeCountryFilter] = useState("All");
  const [feeCityFilter, setFeeCityFilter] = useState("All");
  const [feeProductFilter, setFeeProductFilter] = useState("All");
  const [feeStatusFilter, setFeeStatusFilter] = useState("All");

  // Bulk Import
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkCsvText, setBulkCsvText] = useState("");

  // Derive unique options for filters
  const warehouses = Array.from(new Set(unassignedOrders.map(o => o.items?.[0]?.warehouse).filter(Boolean).map(w => JSON.stringify(w))))
    .map(w => JSON.parse(w));
  
  const dynamicCityOptions = Array.from(new Set(unassignedOrders
    .filter(o => warehouseFilter === "All Origins" || o.items?.[0]?.warehouse_id.toString() === warehouseFilter)
    .map(o => o.shipping_city)
    .filter(Boolean)));

  const filteredUnassignedOrders = useMemo(() => {
    return unassignedOrders.filter(order => {
      // REQUIREMENT: Only Shipped products recorded here
      if (order.status !== "Shipped") return false;

      const matchesSearch = !searchQuery || 
        (order.tracking_number?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (order.customer?.name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (order.shipping_city?.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesWarehouse = warehouseFilter === "All Origins" || order.items?.[0]?.warehouse_id.toString() === warehouseFilter;
      const matchesCity = cityFilter === "All Destinations" || order.shipping_city === cityFilter;
      
      const orderDate = new Date(order.created_at).setHours(0,0,0,0);
      const matchesDateFrom = !dateFrom || orderDate >= new Date(dateFrom).setHours(0,0,0,0);
      const matchesDateTo = !dateTo || orderDate <= new Date(dateTo).setHours(0,0,0,0);

      return matchesSearch && matchesWarehouse && matchesCity && matchesDateFrom && matchesDateTo;
    });
  }, [unassignedOrders, searchQuery, warehouseFilter, cityFilter, dateFrom, dateTo]);

  const handleClearFilters = () => {
    setSearchQuery("");
    setWarehouseFilter("All Origins");
    setCityFilter("All Destinations");
    setDateFrom("");
    setDateTo("");
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery, warehouseFilter, cityFilter, dateFrom, dateTo]);

  const paginatedShipments = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return shipments.slice(startIndex, startIndex + pageSize);
  }, [shipments, currentPage, pageSize]);

  const paginatedUnassignedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredUnassignedOrders.slice(startIndex, startIndex + pageSize);
  }, [filteredUnassignedOrders, currentPage, pageSize]);

  const paginatedDestinations = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return destinations.slice(startIndex, startIndex + pageSize);
  }, [destinations, currentPage, pageSize]);

  const filteredDestinations = useMemo(() => {
    return destinations.filter(dest => {
      const q = feeSearchQuery.toLowerCase();
      const matchesSearch = !q ||
        dest.country?.toLowerCase().includes(q) ||
        dest.city?.toLowerCase().includes(q) ||
        dest.product?.name?.toLowerCase().includes(q) ||
        dest.warehouse?.name?.toLowerCase().includes(q);
      const matchesCountry = feeCountryFilter === "All" || dest.country === feeCountryFilter;
      const matchesCity = feeCityFilter === "All" || dest.city === feeCityFilter;
      const matchesProduct = feeProductFilter === "All" ||
        (feeProductFilter === "global" ? !dest.product_id : dest.product_id?.toString() === feeProductFilter);
      const matchesStatus = feeStatusFilter === "All" ||
        (feeStatusFilter === "active" ? dest.is_active : !dest.is_active);
      return matchesSearch && matchesCountry && matchesCity && matchesProduct && matchesStatus;
    });
  }, [destinations, feeSearchQuery, feeCountryFilter, feeCityFilter, feeProductFilter, feeStatusFilter]);

  const paginatedFilteredDestinations = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredDestinations.slice(startIndex, startIndex + pageSize);
  }, [filteredDestinations, currentPage, pageSize]);

  const [formData, setFormData] = useState({
    waybill: "",
    carrier: "DHL Global",
    origin: "",
    destination: "",
    status: "Processing",
    eta: ""
  });

  const [zoneFormData, setZoneFormData] = useState({
    id: null as number | null,
    product_id: "" as string | number,
    warehouse_id: "" as string | number,
    country: "",
    city: "",
    address_line: "",
    postal_code: "",
    weight: 0,
    distance: 0,
    standard_fee: 0,
    express_fee: 0,
    weight_rate: 0,
    distance_rate: 0,
    is_active: true
  });



  const fetchShipments = async () => {
    setLoading(true);
    try {
      const res = await api.get("/shipments");
      setShipments(res.data);
    } catch (err) {
      toast.error("Failed to fetch shipments");
    } finally {
      setLoading(false);
    }
  };

  const fetchUnassignedOrders = async () => {
    setLoading(true);
    try {
      const res = await api.get("/shipments/unassigned-orders");
      setUnassignedOrders(res.data);
    } catch (err) {
      toast.error("Failed to fetch unassigned orders");
    } finally {
      setLoading(false);
    }
  };
  const fetchDestinations = async () => {
    setLoading(true);
    try {
      const res = await api.get("/shipping-destinations");
      setDestinations(res.data);
    } catch (err) {
      toast.error("Failed to fetch shipping zones");
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await api.get("/products");
      setProducts(res.data);
    } catch (err) {
      console.error("Failed to fetch products");
    }
  };

  const fetchWarehouses = async () => {
    try {
      const res = await api.get("/warehouses");
      setWarehousesData(res.data);
    } catch (err) {
      console.error("Failed to fetch warehouses");
    }
  };

  const fetchLocations = async () => {
    try {
      const res = await api.get("/locations/unique");
      setCountries(res.data.countries);
      setCities(res.data.cities);
    } catch (err) {
      console.error("Failed to fetch locations");
    }
  };

  const fetchCountriesData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/locations/countries");
      setCountriesData(res.data);
    } catch (err) {
      toast.error("Failed to fetch shipping zones");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "Active Shipments") {
      fetchShipments();
    } else if (activeTab === "Unassigned Orders") {
      fetchUnassignedOrders();
    } else if (activeTab === "Shipping Fee") {
      fetchDestinations();
      fetchProducts();
      fetchWarehouses();
      fetchLocations();
      fetchCountriesData();
    } else if (activeTab === "Shipping Zones") {
      fetchCountriesData();
    }
  }, [activeTab]);

  const handleToggleOrderSelection = (orderId: number) => {
    setSelectedOrders(prev => 
      prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
    );
  };

  const [editingShipmentId, setEditingShipmentId] = useState<number | null>(null);

  const handleOpenContainerModal = () => {
    if (selectedOrders.length === 0) {
      return toast.error("Please select at least one order to create a container.");
    }

    const selectedOrderObjects = unassignedOrders.filter(o => selectedOrders.includes(o.id));
    
    const firstOrigin = selectedOrderObjects[0]?.items?.[0]?.warehouse?.name || selectedOrderObjects[0]?.origin;
    const firstDest = `${selectedOrderObjects[0]?.shipping_city}, ${selectedOrderObjects[0]?.shipping_country}`;

    const allMatch = selectedOrderObjects.every(o => {
      const currentOrigin = o.items?.[0]?.warehouse?.name || o.origin;
      const currentDest = `${o.shipping_city}, ${o.shipping_country}`;
      return currentOrigin === firstOrigin && currentDest === firstDest;
    });

    if (!allMatch) {
      return toast.error("Logistics Violation: All selected orders must share the same Origin and Destination to be containerized together.", {
        duration: 5000,
        icon: '⚠️',
        style: {
          background: '#e11d48',
          color: '#fff',
          fontWeight: 'bold',
          fontSize: '12px',
          borderRadius: '10px',
          border: '1px solid #9f1239'
        }
      });
    }

    setEditingShipmentId(null);
    setFormData({
      waybill: "",
      carrier: "",
      origin: firstOrigin || "Warehouse",
      destination: firstDest || "",
      status: "In Transit",
      eta: ""
    });
    setIsModalOpen(true);
  };

  const handleEditShipment = (shipment: any) => {
    setEditingShipmentId(shipment.id);
    setFormData({
      waybill: shipment.waybill,
      carrier: shipment.carrier,
      origin: shipment.origin,
      destination: shipment.destination,
      status: shipment.status,
      eta: shipment.eta || ""
    });
    setIsModalOpen(true);
  };

  const handleSaveShipment = async () => {
    if (!formData.waybill || !formData.origin || !formData.destination) {
      return toast.error("Please fill in all required fields.");
    }

    setIsSaving(true);
    try {
      if (editingShipmentId) {
        await api.put(`/shipments/${editingShipmentId}`, formData);
        toast.success("Shipment updated successfully!");
      } else {
        await api.post("/shipments", {
          ...formData,
          order_ids: selectedOrders
        });
        toast.success("Shipment registered and orders assigned!");
      }
      
      setIsModalOpen(false);
      setEditingShipmentId(null);
      setSelectedOrders([]);
      fetchShipments();
      if (!editingShipmentId) setActiveTab("Active Shipments");
    } catch (err) {
      toast.error(editingShipmentId ? "Failed to update shipment" : "Failed to register shipment");
    } finally {
      setIsSaving(false);
    }
  };

  const updateShipmentStatus = async (shipmentId: number, status: string) => {
    try {
      await api.put(`/shipments/${shipmentId}`, { status });
      toast.success("Shipment status updated!");
      fetchShipments();
    } catch (err) {
      toast.error("Failed to update status");
    }
  };

  const handleSaveZone = async (shouldClose = true) => {
    if (!zoneFormData.city || !zoneFormData.country) {
      return toast.error("Please fill in Country and City.");
    }
    setIsSaving(true);
    // Sanitize data payload
    const payload = {
      product_id: zoneFormData.product_id || null,
      warehouse_id: zoneFormData.warehouse_id || null,
      weight: currentWeight,
      distance: zoneFormData.distance || 0,
      country: zoneFormData.country,
      city: zoneFormData.city,
      standard_fee: calculatedStandardFee,
      express_fee: calculatedExpressFee,
      weight_rate: zoneFormData.weight_rate || 0,
      distance_rate: zoneFormData.distance_rate || 0,
      is_active: zoneFormData.is_active
    };

    try {
      if (zoneFormData.id) {
        await api.put(`/shipping-destinations/${zoneFormData.id}`, payload);
        toast.success("Zone updated successfully!");
      } else {
        await api.post("/shipping-destinations", payload);
        toast.success("Zone created successfully!");
      }
      
      if (shouldClose) {
        setIsZoneModalOpen(false);
      } else {
        setZoneFormData(prev => ({
          ...prev,
          id: null,
          country: "",
          city: "",
          distance: 0,
          standard_fee: 0,
          express_fee: 0
        }));
      }
      fetchDestinations();
    } catch (err: any) {
      console.error(err);
      const message = err.response?.data?.message || "Failed to save shipping zone";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteZone = async () => {
    if (!zoneToDelete) return;
    try {
      await api.delete(`/shipping-destinations/${zoneToDelete}`);
      toast.success("Zone deleted");
      setIsDeleteModalOpen(false);
      setZoneToDelete(null);
      fetchDestinations();
    } catch (err) {
      toast.error("Failed to delete zone");
    }
  };

  const handleSaveCountry = async () => {
    if (!countryFormData.name) return toast.error("Country name is required");
    setIsSaving(true);
    try {
      if (countryFormData.id) {
        await api.put(`/locations/countries/${countryFormData.id}`, countryFormData);
        toast.success("Country updated");
      } else {
        await api.post("/locations/countries", countryFormData);
        toast.success("Country added");
      }
      setIsCountryModalOpen(false);
      fetchCountriesData();
    } catch (err) {
      toast.error("Failed to save country");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveCities = async () => {
    if (!cityFormData.cities) return toast.error("Cities are required");
    setIsSaving(true);
    try {
      await api.post(`/locations/countries/${cityFormData.countryId}/cities/bulk`, { cities: cityFormData.cities });
      toast.success("Cities added successfully");
      setIsCityModalOpen(false);
      fetchCountriesData();
    } catch (err) {
      toast.error("Failed to save cities");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCountry = async () => {
    if (!countryToDelete) return;
    try {
      await api.delete(`/locations/countries/${countryToDelete}`);
      toast.success("Country deleted");
      setIsDeleteCountryModalOpen(false);
      setCountryToDelete(null);
      fetchCountriesData();
    } catch (err) {
      toast.error("Failed to delete country");
    }
  };

  const handleDeleteCity = async () => {
    if (!cityToDelete) return;
    try {
      await api.delete(`/locations/cities/${cityToDelete}`);
      toast.success("City deleted");
      setIsDeleteCityModalOpen(false);
      setCityToDelete(null);
      fetchCountriesData();
    } catch (err) {
      toast.error("Failed to delete city");
    }
  };

  
  // Dynamic weight and calculated fees for the currently selected product/route
  const currentWeight = useMemo(() => {
    if (!zoneFormData.product_id) return 0;
    const prod = products.find(p => p.id.toString() === zoneFormData.product_id.toString());
    return prod ? parseFloat(prod.weight || 0) : 0;
  }, [zoneFormData.product_id, products]);



  const calculatedStandardFee = useMemo(() => {
    // Standard Fee = Weight Rate * Weight * Distance Rate
    return (zoneFormData.weight_rate || 0) * currentWeight * (zoneFormData.distance_rate || 0);
  }, [zoneFormData.weight_rate, currentWeight, zoneFormData.distance_rate]);

  const calculatedExpressFee = useMemo(() => {
    return calculatedStandardFee * 1.5;
  }, [calculatedStandardFee]);

  // Dynamic searchable and scrollable options for country and city
  const modalCountryOptions = useMemo(() => {
    return countriesData.map(c => ({ id: c.name, name: c.name }));
  }, [countriesData]);

  const modalCityOptions = useMemo(() => {
    if (!zoneFormData.country) return [];
    const selectedCountry = countriesData.find(c => c.name === zoneFormData.country);
    if (!selectedCountry) return [];
    return (selectedCountry.cities || [])
      .map((ct: any) => ({ id: ct.name, name: ct.name }))
      .filter((ct: any) => {
        // If editing, allow the current city
        if (zoneFormData.id) {
          const currentDest = destinations.find(d => d.id === zoneFormData.id);
          if (currentDest && currentDest.city === ct.id && currentDest.country === zoneFormData.country) {
            return true;
          }
        }
        const exists = destinations.some(d => 
          (d.product_id?.toString() || "") === (zoneFormData.product_id?.toString() || "") &&
          (d.warehouse_id?.toString() || "") === (zoneFormData.warehouse_id?.toString() || "") &&
          d.country === zoneFormData.country &&
          d.city === ct.id
        );
        return !exists;
      });
  }, [zoneFormData.country, zoneFormData.product_id, zoneFormData.warehouse_id, zoneFormData.id, countriesData, destinations]);

  const selectedCountryName = useMemo(() => {
    if (!cityFormData.countryId) return "";
    const country = countriesData.find(c => c.id === cityFormData.countryId);
    return country ? country.name : "";
  }, [cityFormData.countryId, countriesData]);

  const predefinedCitiesForSelectedCountry = useMemo(() => {
    return PREDEFINED_CITIES[selectedCountryName] || [];
  }, [selectedCountryName]);

  return (
    <div className="space-y-6 p-8 bg-white min-h-screen font-sans">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Logistics Containerization</h1>
          <p className="text-zinc-500 text-sm mt-1 font-medium italic">Group orders by Origin-Destination and assign Waybills.</p>
        </div>
        {activeTab === "Unassigned Orders" && (
          <Button 
            className="bg-[#0052cc] text-white hover:bg-[#0052cc]/90 rounded-lg shadow-sm font-bold"
            onClick={handleOpenContainerModal}
          >
            <Package className="mr-2 h-4 w-4" /> Group Selected Orders ({selectedOrders.length})
          </Button>
        )}
        {activeTab === "Shipping Fee" && (
          <Button 
            className="bg-[#0052cc] text-white hover:bg-[#0052cc]/90 rounded-lg shadow-sm font-bold"
            onClick={() => {
               setZoneFormData({ 
                id: null, 
                product_id: products[0]?.id || "", 
                warehouse_id: warehousesData[0]?.id || "",
                country: "", 
                city: "", 
                address_line: "",
                postal_code: "",
                weight: 0,
                distance: 0,
                standard_fee: 0, 
                express_fee: 0, 
                weight_rate: 0, 
                distance_rate: 0,
                is_active: true 
               });
               setIsZoneModalOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Add New Fee
          </Button>
        )}
        {activeTab === "Shipping Zones" && (
          <Button 
            className="bg-[#0052cc] text-white hover:bg-[#0052cc]/90 rounded-lg shadow-sm font-bold"
            onClick={() => {
              setCountryFormData({ id: null, name: "", is_active: true });
              setIsCountryModalOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Add Country
          </Button>
        )}
      </div>

      <div className="flex border-b border-zinc-200">
        <button 
          onClick={() => setActiveTab("Active Shipments")}
          className={cn("px-6 py-3 font-bold text-sm border-b-2 transition-colors", activeTab === "Active Shipments" ? "border-[#0052cc] text-[#0052cc]" : "border-transparent text-zinc-500 hover:text-zinc-700")}
        >
          Active Shipments
        </button>
        <button 
          onClick={() => { setActiveTab("Unassigned Orders"); setSelectedOrders([]); }}
          className={cn("px-6 py-3 font-bold text-sm border-b-2 transition-colors", activeTab === "Unassigned Orders" ? "border-[#0052cc] text-[#0052cc]" : "border-transparent text-zinc-500 hover:text-zinc-700")}
        >
          Unassigned Orders
        </button>
        <button 
          onClick={() => setActiveTab("Shipping Fee")}
          className={cn("px-6 py-3 font-bold text-sm border-b-2 transition-colors", activeTab === "Shipping Fee" ? "border-[#0052cc] text-[#0052cc]" : "border-transparent text-zinc-500 hover:text-zinc-700")}
        >
          Shipping Fee
        </button>
        <button 
          onClick={() => setActiveTab("Shipping Zones")}
          className={cn("px-6 py-3 font-bold text-sm border-b-2 transition-colors", activeTab === "Shipping Zones" ? "border-[#0052cc] text-[#0052cc]" : "border-transparent text-zinc-500 hover:text-zinc-700")}
        >
          Shipping Zones
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-[#0052cc]" /></div>
      ) : activeTab === "Active Shipments" ? (
        <div className="bg-white rounded-xl shadow-sm border border-zinc-100 overflow-hidden">
          <Table>
            <TableHeader className="bg-zinc-50/50 border-b border-zinc-100">
              <TableRow>
                <TableHead className="px-6 h-12 font-bold text-zinc-900 text-[13px]">Waybill ID</TableHead>
                <TableHead className="h-12 font-bold text-zinc-900 text-[13px]">Carrier</TableHead>
                <TableHead className="h-12 font-bold text-zinc-900 text-[13px]">Route</TableHead>
                <TableHead className="h-12 font-bold text-zinc-900 text-[13px]">ETA</TableHead>
                <TableHead className="h-12 font-bold text-zinc-900 text-[13px]">Total Orders</TableHead>
                <TableHead className="h-12 font-bold text-zinc-900 text-[13px]">Status</TableHead>
                <TableHead className="px-6 h-12 font-bold text-zinc-900 text-[13px] text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-48 text-center text-zinc-500 font-medium">No active shipments.</TableCell>
                </TableRow>
              ) : (
                paginatedShipments.map((shipment) => (
                  <TableRow key={shipment.id} className="hover:bg-zinc-50/50 transition-colors">
                    <TableCell className="px-6 font-black text-zinc-900 text-sm">{shipment.waybill}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={cn(
                        "border-none px-2 py-0.5 text-[10px] font-bold uppercase",
                        shipment.carrier?.toLowerCase().includes("dhl") ? "bg-blue-100 text-blue-700" :
                        shipment.carrier?.toLowerCase().includes("fedex") ? "bg-amber-100 text-amber-700" :
                        shipment.carrier?.toLowerCase().includes("maersk") ? "bg-cyan-100 text-cyan-700" :
                        shipment.carrier?.toLowerCase().includes("local") ? "bg-violet-100 text-violet-700" :
                        "bg-zinc-100 text-zinc-600"
                      )}>
                        {shipment.carrier}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 uppercase">
                          {shipment.origin?.split(' ').shift() || "Origin"}
                        </div>
                        <ArrowRightLeft className="h-3 w-3 text-zinc-300" />
                        <div className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 uppercase">
                          {shipment.destination || "Dest"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-bold text-[#0052cc]">{shipment.eta || "N/A"}</TableCell>
                    <TableCell className="text-xs font-bold text-zinc-700">{shipment.orders_count || 0} Orders</TableCell>
                    <TableCell>
                      <Badge className={cn("rounded-full px-3 text-[10px] font-bold uppercase border-none tracking-wider",
                        shipment.status === "Delivered" ? "bg-emerald-100 text-emerald-700" : 
                        shipment.status === "In Transit" ? "bg-blue-100 text-[#0052cc]" : "bg-zinc-100 text-zinc-500"
                      )}>{shipment.status}</Badge>
                    </TableCell>
                    <TableCell className="px-6 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost" }), "h-8 w-8 p-0 rounded-full")}>
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44 rounded-xl border-zinc-200 shadow-xl p-1">
                          <DropdownMenuGroup>
                            <DropdownMenuLabel className="text-[10px] font-black text-zinc-400 uppercase px-2 py-1.5">Shipment Actions</DropdownMenuLabel>
                            <DropdownMenuItem className="cursor-pointer font-bold text-xs" onClick={() => handleEditShipment(shipment)}>
                              <Edit className="mr-2 h-3.5 w-3.5 text-[#0052cc]" /> Edit Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-[10px] font-black text-zinc-400 uppercase px-2 py-1.5">Change Status</DropdownMenuLabel>
                            <DropdownMenuItem className="cursor-pointer" onClick={() => updateShipmentStatus(shipment.id, "In Transit")}>In Transit</DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer" onClick={() => updateShipmentStatus(shipment.id, "Delivered")}>Delivered</DropdownMenuItem>
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <PaginationControls
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            pageSize={pageSize}
            setPageSize={setPageSize}
            totalItems={shipments.length}
            itemName="shipments"
            pageSizeOptions={[15, 30, 50, 100]}
          />
        </div>
      ) : activeTab === "Unassigned Orders" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
            <div className="relative w-full sm:flex-1 sm:min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input 
                placeholder="Search Ref, Customer, Route..." 
                className="pl-10 h-10 border-zinc-200 rounded-lg bg-white w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="w-full sm:w-[180px]">
              <select 
                className="h-10 px-3 border border-zinc-200 rounded-lg text-sm font-medium bg-white outline-none focus:ring-2 focus:ring-primary/20 w-full text-zinc-600"
                value={warehouseFilter}
                onChange={(e) => setWarehouseFilter(e.target.value)}
              >
                <option value="All Origins">All Origins</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            <div className="w-full sm:w-[180px]">
              <select 
                className="h-10 px-3 border border-zinc-200 rounded-lg text-sm font-medium bg-white outline-none focus:ring-2 focus:ring-primary/20 w-full text-zinc-600"
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
              >
                <option value="All Destinations">All Destinations</option>
                {dynamicCityOptions.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <Input 
                type="date"
                className="h-10 border-zinc-200 rounded-lg text-xs font-medium bg-white w-[130px]"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
              <Input 
                type="date"
                className="h-10 border-zinc-200 rounded-lg text-xs font-medium bg-white w-[130px]"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>

            <Button variant="outline" className="w-full sm:w-auto rounded-lg h-10 px-3 border-zinc-200" onClick={handleClearFilters}>
              <Filter className="h-4 w-4 text-zinc-500 mr-2" /> Clear
            </Button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-zinc-100 overflow-hidden">
            <Table>
              <TableHeader className="bg-zinc-50/50 border-b border-zinc-100">
                <TableRow>
                  <TableHead className="px-6 w-12 text-center">
                    <button 
                      onClick={() => {
                        if (selectedOrders.length === filteredUnassignedOrders.length) setSelectedOrders([]);
                        else setSelectedOrders(filteredUnassignedOrders.map(o => o.id));
                      }}
                      className="text-zinc-400 hover:text-zinc-900 transition-colors"
                    >
                      {selectedOrders.length === filteredUnassignedOrders.length && filteredUnassignedOrders.length > 0 ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                    </button>
                  </TableHead>
                  <TableHead className="px-4 font-semibold text-zinc-900">Order Ref</TableHead>
                  <TableHead className="font-semibold text-zinc-900">Customer</TableHead>
                  <TableHead className="font-semibold text-zinc-900">Route (Origin → Dest)</TableHead>
                  <TableHead className="font-semibold text-zinc-900">Order Date</TableHead>
                  <TableHead className="font-semibold text-zinc-900">Main Product</TableHead>
                  <TableHead className="font-semibold text-zinc-900 text-center">Items</TableHead>
                  <TableHead className="font-semibold text-zinc-900">Product Cost</TableHead>
                  <TableHead className="font-semibold text-zinc-900">Shipment Fee</TableHead>
                  <TableHead className="font-semibold text-zinc-900 text-right">Total</TableHead>
                  <TableHead className="font-semibold text-zinc-900 text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUnassignedOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-48 text-center text-zinc-500 font-medium">No unassigned orders found matching filters.</TableCell>
                  </TableRow>
                ) : (
                  paginatedUnassignedOrders.map((order) => (
                    <TableRow key={order.id} className={cn(
                      "hover:bg-zinc-50/50 transition-colors group",
                      selectedOrders.includes(order.id) && "bg-zinc-50/50"
                    )}>
                      <TableCell className="px-6 text-center">
                        <button 
                          onClick={() => handleToggleOrderSelection(order.id)}
                          className={cn(
                            "transition-colors",
                            selectedOrders.includes(order.id) ? "text-[#0052cc]" : "text-zinc-200 group-hover:text-zinc-400"
                          )}
                        >
                          {selectedOrders.includes(order.id) ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                        </button>
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        <p className="text-sm font-bold text-zinc-900">{order.tracking_number || `ORD-${order.id}`}</p>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="text-sm font-semibold text-zinc-700">{order.customer?.name || "Guest"}</p>
                          <p className="text-[11px] text-zinc-500 font-medium">{order.customer?.email}</p>
                        </div>
                      </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 uppercase">
                          {order.items?.[0]?.warehouse?.name?.split(' ').shift() || "Origin"}
                        </div>
                        <ArrowRightLeft className="h-3 w-3 text-zinc-300" />
                        <div className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 uppercase">
                          {order.shipping_city}, {order.shipping_country}
                        </div>
                      </div>
                    </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-zinc-700">{new Date(order.created_at).toLocaleDateString()}</p>
                          <p className="text-[10px] text-zinc-400 font-medium uppercase">{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5 max-w-[150px]">
                          <p className="text-xs font-bold text-zinc-800 truncate">
                            {order.items?.[0]?.product?.name || "Genuine Spare Part"}
                          </p>
                          {order.items && order.items.length > 1 && (
                            <p className="text-[10px] text-zinc-400 font-bold uppercase">+{order.items.length - 1} more items</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Package className="h-3 w-3 text-zinc-400" />
                          <span className="text-xs font-bold text-zinc-700">{order.items?.length || 0}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-bold text-zinc-600">
                        Ksh {Math.max(0, (parseFloat(order.total_amount || 0) - parseFloat(order.shipping_fee || 0))).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs font-bold text-zinc-600">
                        Ksh {parseFloat(order.shipping_fee || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <p className="text-xs font-black text-zinc-900">Ksh {parseFloat(order.total_amount || 0).toLocaleString()}</p>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="rounded-full px-3 text-[10px] font-bold uppercase border-none tracking-wider bg-blue-600 text-white">
                          {order.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <PaginationControls
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              pageSize={pageSize}
              setPageSize={setPageSize}
              totalItems={filteredUnassignedOrders.length}
              itemName="orders"
              pageSizeOptions={[15, 30, 50, 100]}
            />
          </div>
        </div>
      ) : activeTab === "Shipping Fee" ? (
        <div className="space-y-4">
          {/* Expose Premium Filters & Search controls */}
          <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
            <div className="relative w-full sm:flex-1 sm:min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input 
                placeholder="Search Product, Country, City or Origin..." 
                className="pl-10 h-10 border-zinc-200 rounded-lg bg-white w-full"
                value={feeSearchQuery}
                onChange={(e) => setFeeSearchQuery(e.target.value)}
              />
            </div>

            <div className="w-full sm:w-[160px]">
              <select 
                className="h-10 px-3 border border-zinc-200 rounded-lg text-sm font-medium bg-white outline-none focus:ring-2 focus:ring-primary/20 w-full text-zinc-600"
                value={feeCountryFilter}
                onChange={(e) => setFeeCountryFilter(e.target.value)}
              >
                <option value="All">All Countries</option>
                {Array.from(new Set(destinations.map(d => d.country).filter(Boolean))).sort().map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="w-full sm:w-[160px]">
              <select 
                className="h-10 px-3 border border-zinc-200 rounded-lg text-sm font-medium bg-white outline-none focus:ring-2 focus:ring-primary/20 w-full text-zinc-600"
                value={feeCityFilter}
                onChange={(e) => setFeeCityFilter(e.target.value)}
              >
                <option value="All">All Cities</option>
                {Array.from(new Set(destinations.map(d => d.city).filter(Boolean))).sort().map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="w-full sm:w-[180px]">
              <select 
                className="h-10 px-3 border border-zinc-200 rounded-lg text-sm font-medium bg-white outline-none focus:ring-2 focus:ring-primary/20 w-full text-zinc-600"
                value={feeProductFilter}
                onChange={(e) => setFeeProductFilter(e.target.value)}
              >
                <option value="All">All Products Scope</option>
                <option value="global">Global Rules Only</option>
                {products.map(p => (
                  <option key={p.id} value={p.id.toString()}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="w-full sm:w-[140px]">
              <select 
                className="h-10 px-3 border border-zinc-200 rounded-lg text-sm font-medium bg-white outline-none focus:ring-2 focus:ring-primary/20 w-full text-zinc-600"
                value={feeStatusFilter}
                onChange={(e) => setFeeStatusFilter(e.target.value)}
              >
                <option value="All">All Statuses</option>
                <option value="active">Active Zones</option>
                <option value="inactive">Inactive Zones</option>
              </select>
            </div>

            <Button 
              variant="outline" 
              className="w-full sm:w-auto rounded-lg h-10 px-3 border-zinc-200" 
              onClick={() => {
                setFeeSearchQuery("");
                setFeeCountryFilter("All");
                setFeeCityFilter("All");
                setFeeProductFilter("All");
                setFeeStatusFilter("All");
              }}
            >
              <Filter className="h-4 w-4 text-zinc-500 mr-2" /> Clear
            </Button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-zinc-100 overflow-hidden">
            <Table>
              <TableHeader className="bg-zinc-50/50 border-b border-zinc-100">
                <TableRow>
                  <TableHead className="px-6 h-12 font-bold text-zinc-900 text-[13px]">Product Application</TableHead>
                  <TableHead className="h-12 font-bold text-zinc-900 text-[13px]">Route (Origin → Destination)</TableHead>
                  <TableHead className="h-12 font-bold text-zinc-900 text-[13px]">Weight (KG)</TableHead>
                  <TableHead className="h-12 font-bold text-zinc-900 text-[13px]">Weight Rate (Ksh/KG)</TableHead>
                  <TableHead className="h-12 font-bold text-zinc-900 text-[13px]">Distance (KM)</TableHead>
                  <TableHead className="h-12 font-bold text-zinc-900 text-[13px]">Distance Rate (Ksh/KM)</TableHead>
                  <TableHead className="h-12 font-bold text-zinc-900 text-[13px]">Standard (3-5d)</TableHead>
                  <TableHead className="h-12 font-bold text-zinc-900 text-[13px]">Express (1-2d)</TableHead>
                  <TableHead className="h-12 font-bold text-zinc-900 text-[13px]">Country</TableHead>
                  <TableHead className="h-12 font-bold text-zinc-900 text-[13px]">City</TableHead>
                  <TableHead className="h-12 font-bold text-zinc-900 text-[13px]">Status</TableHead>
                  <TableHead className="px-6 h-12 font-bold text-zinc-900 text-[13px] text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDestinations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="h-48 text-center text-zinc-500 font-medium">No shipping zones defined matching the filter parameters.</TableCell>
                  </TableRow>
                ) : (
                  paginatedFilteredDestinations.map((dest) => (
                    <TableRow key={dest.id} className="hover:bg-zinc-50/50 transition-colors">
                      <TableCell className="px-6">
                        {dest.product ? (
                          <div className="flex flex-col">
                            <span className="font-bold text-zinc-900 text-xs">{dest.product.name}</span>
                            <span className="text-[10px] text-zinc-500 font-medium uppercase">SKU: {dest.product.sku}</span>
                          </div>
                        ) : (
                          <Badge variant="outline" className="bg-zinc-50 text-zinc-500 border-zinc-200 text-[10px] font-bold uppercase tracking-wider">All Products</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 uppercase">
                            {dest.warehouse?.name?.split(' ').shift() || "Any"}
                          </div>
                          <ArrowRightLeft className="h-3 w-3 text-zinc-300" />
                          <div className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 uppercase">
                            {dest.city}, {dest.country}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-bold text-zinc-700 text-sm">
                        {parseFloat(dest.weight || 0).toFixed(2)} KG
                      </TableCell>
                      <TableCell className="font-bold text-indigo-600 text-sm">
                        Ksh {parseFloat(dest.weight_rate || 0).toLocaleString()}/KG
                      </TableCell>
                      <TableCell className="font-bold text-zinc-700 text-sm">
                        {parseFloat(dest.distance || 0).toLocaleString()} KM
                      </TableCell>
                      <TableCell className="font-bold text-emerald-600 text-sm">
                        Ksh {parseFloat(dest.distance_rate || 0).toLocaleString()}/KM
                      </TableCell>
                      <TableCell className="font-black text-[#0052cc]">Ksh {parseFloat(dest.standard_fee).toLocaleString()}</TableCell>
                      <TableCell className="font-black text-amber-600">Ksh {parseFloat(dest.express_fee).toLocaleString()}</TableCell>
                      <TableCell className="text-xs font-semibold text-zinc-700">{dest.country}</TableCell>
                      <TableCell className="text-xs font-semibold text-zinc-700">{dest.city}</TableCell>
                      <TableCell>
                        <Badge className={cn("rounded-full px-3 text-[10px] font-bold uppercase border-none tracking-wider",
                          dest.is_active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                        )}>{dest.is_active ? "Active" : "Inactive"}</Badge>
                      </TableCell>
                      <TableCell className="px-6 text-right space-x-2">
                        <Button variant="ghost" size="icon" onClick={() => { setZoneFormData(dest); setIsZoneModalOpen(true); }} className="h-8 w-8 text-zinc-400 hover:text-[#0052cc] rounded-full">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => { setZoneToDelete(dest.id); setIsDeleteModalOpen(true); }} className="h-8 w-8 text-zinc-400 hover:text-red-600 rounded-full">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <PaginationControls
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              pageSize={pageSize}
              setPageSize={setPageSize}
              totalItems={filteredDestinations.length}
              itemName="fees"
              pageSizeOptions={[15, 30, 50, 100]}
            />
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-zinc-100 overflow-hidden">
          <Table>
            <TableHeader className="bg-zinc-50/50 border-b border-zinc-100">
              <TableRow>
                <TableHead className="px-6 h-12 font-bold text-zinc-900 text-[13px]">Country</TableHead>
                <TableHead className="h-12 font-bold text-zinc-900 text-[13px]">Cities</TableHead>
                <TableHead className="h-12 font-bold text-zinc-900 text-[13px]">Status</TableHead>
                <TableHead className="px-6 h-12 font-bold text-zinc-900 text-[13px] text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {countriesData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-48 text-center text-zinc-500 font-medium">No countries defined.</TableCell>
                </TableRow>
              ) : (
                countriesData.map((country) => (
                  <TableRow key={country.id} className="hover:bg-zinc-50/50 transition-colors">
                    <TableCell className="px-6 font-bold text-zinc-900">{country.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {country.cities?.map((city: any) => (
                          <Badge key={city.id} variant="secondary" className="bg-blue-50 text-blue-700 border-none px-2 py-0.5 text-xs font-semibold flex items-center gap-1">
                            {city.name}
                            <button onClick={() => { setCityToDelete(city.id); setIsDeleteCityModalOpen(true); }} className="ml-1 text-blue-400 hover:text-red-500"><X className="h-3 w-3" /></button>
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("rounded-full px-3 text-[10px] font-bold uppercase border-none tracking-wider",
                        country.is_active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                      )}>{country.is_active ? "Active" : "Inactive"}</Badge>
                    </TableCell>
                    <TableCell className="px-6 text-right space-x-2">
                      <Button variant="ghost" size="sm" onClick={() => { setCityFormData({ countryId: country.id, cities: "" }); setIsCityModalOpen(true); }} className="h-8 text-[#0052cc] hover:bg-blue-50 rounded-lg text-xs font-bold">
                        <Plus className="mr-1 h-3 w-3" /> Add Cities
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { setCountryFormData({ id: country.id, name: country.name, is_active: country.is_active }); setIsCountryModalOpen(true); }} className="h-8 w-8 text-zinc-400 hover:text-[#0052cc] rounded-full">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { setCountryToDelete(country.id); setIsDeleteCountryModalOpen(true); }} className="h-8 w-8 text-zinc-400 hover:text-red-600 rounded-full">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Country Modal */}
      <Dialog open={isCountryModalOpen} onOpenChange={setIsCountryModalOpen}>
        <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden bg-white rounded-xl shadow-2xl border border-zinc-200">
          <DialogHeader className="p-6 border-b bg-white">
            <DialogTitle className="text-xl font-bold text-zinc-900">{countryFormData.id ? "Edit Country" : "Add Country"}</DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-500">Country Name *</label>
              <SearchableDropdown 
                items={EAST_AFRICAN_COUNTRIES}
                value={countryFormData.name}
                onChange={(val) => setCountryFormData({...countryFormData, name: val})}
                placeholder="Search country..."
              />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="countryActive" checked={countryFormData.is_active} onChange={(e) => setCountryFormData({...countryFormData, is_active: e.target.checked})} className="rounded border-zinc-300" />
              <label htmlFor="countryActive" className="text-sm font-medium text-zinc-700">Active</label>
            </div>
          </div>
          <DialogFooter className="p-4 border-t bg-zinc-50/50 flex items-center justify-end gap-3">
            <Button variant="outline" className="h-10 rounded-lg px-6 font-bold text-sm" onClick={() => setIsCountryModalOpen(false)}>Cancel</Button>
            <Button className="h-10 bg-[#0052cc] text-white hover:bg-[#0747a6] rounded-lg font-black px-8 text-[11px] tracking-widest uppercase shadow-sm" onClick={handleSaveCountry} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} SAVE
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cities Modal */}
      <Dialog open={isCityModalOpen} onOpenChange={setIsCityModalOpen}>
        <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden bg-white rounded-xl shadow-2xl border border-zinc-200">
          <DialogHeader className="p-6 border-b bg-white">
            <DialogTitle className="text-xl font-bold text-zinc-900">Add Cities (Bulk)</DialogTitle>
            <p className="text-xs text-zinc-500">Enter multiple cities separated by commas.</p>
          </DialogHeader>
          <div className="p-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-500">Cities *</label>
              <Input 
                placeholder="e.g. Nairobi, Mombasa, Kisumu" 
                className="h-10 border-zinc-200 rounded-lg" 
                value={cityFormData.cities}
                onChange={(e) => setCityFormData({...cityFormData, cities: e.target.value})}
              />
            </div>
            {predefinedCitiesForSelectedCountry.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500">Predefined Cities of {selectedCountryName} (Click to toggle)</label>
                <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto p-2 border border-zinc-200 rounded-lg bg-zinc-50/50">
                  {predefinedCitiesForSelectedCountry.map((city) => {
                    const currentCities = cityFormData.cities.split(",").map(c => c.trim()).filter(Boolean);
                    const active = currentCities.some(c => c.toLowerCase() === city.toLowerCase());
                    return (
                      <Badge
                        key={city}
                        variant={active ? "default" : "secondary"}
                        className={cn(
                          "cursor-pointer select-none px-2.5 py-1 text-xs font-semibold rounded-md transition-all",
                          active 
                            ? "bg-[#0052cc] text-white hover:bg-[#0052cc]/90" 
                            : "bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-100"
                        )}
                        onClick={() => {
                          const isPresent = currentCities.some(c => c.toLowerCase() === city.toLowerCase());
                          let updated;
                          if (isPresent) {
                            updated = currentCities.filter(c => c.toLowerCase() !== city.toLowerCase());
                          } else {
                            updated = [...currentCities, city];
                          }
                          setCityFormData({
                            ...cityFormData,
                            cities: updated.join(", ")
                          });
                        }}
                      >
                        {city}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="p-4 border-t bg-zinc-50/50 flex items-center justify-end gap-3">
            <Button variant="outline" className="h-10 rounded-lg px-6 font-bold text-sm" onClick={() => setIsCityModalOpen(false)}>Cancel</Button>
            <Button className="h-10 bg-[#0052cc] text-white hover:bg-[#0747a6] rounded-lg font-black px-8 text-[11px] tracking-widest uppercase shadow-sm" onClick={handleSaveCities} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} ADD CITIES
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Shipment Modal */}
      <Dialog open={isModalOpen} onOpenChange={(open) => { setIsModalOpen(open); if(!open) setEditingShipmentId(null); }}>
          <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden bg-white rounded-xl shadow-2xl border border-zinc-200">
            <DialogHeader className="p-6 border-b bg-white">
              <DialogTitle className="text-xl font-bold text-zinc-900">{editingShipmentId ? "Edit Container Details" : "Create Container"}</DialogTitle>
              <p className="text-sm text-zinc-500 mt-1">
                {editingShipmentId ? `Modifying Waybill: ${formData.waybill}` : `Grouping ${selectedOrders.length} orders into a single shipment.`}
              </p>
            </DialogHeader>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-500">Waybill ID *</label>
                  <Input 
                    placeholder="Enter Waybill Number..." 
                    className="h-10 border-zinc-200 rounded-lg focus:ring-[#0052cc]/20" 
                    value={formData.waybill}
                    onChange={(e) => setFormData({...formData, waybill: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-500">Carrier Partner *</label>
                  <select 
                    className="w-full h-10 px-3 border border-zinc-200 rounded-lg text-sm bg-white outline-none"
                    value={formData.carrier}
                    onChange={(e) => setFormData({...formData, carrier: e.target.value})}
                  >
                    <option value="">Select Carrier...</option>
                    <option>DHL Global</option>
                    <option>Maersk Logistics</option>
                    <option>FedEx Express</option>
                    <option>Local Courier</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-500">Origin Node *</label>
                  <Input 
                    placeholder="e.g. Nairobi Hub" 
                    className="h-10 border-zinc-200 rounded-lg bg-zinc-50" 
                    readOnly
                    value={formData.origin}
                    onChange={(e) => setFormData({...formData, origin: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-500">Final Destination *</label>
                  <Input 
                    placeholder="e.g. Mombasa Port" 
                    className="h-10 border-zinc-200 rounded-lg bg-zinc-50" 
                    readOnly
                    value={formData.destination}
                    onChange={(e) => setFormData({...formData, destination: e.target.value})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-500">ETA</label>
                  <Input 
                    placeholder="e.g. 2 Days" 
                    className="h-10 border-zinc-200 rounded-lg" 
                    value={formData.eta}
                    onChange={(e) => setFormData({...formData, eta: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-500">Initial Status</label>
                  <select 
                    className="w-full h-10 px-3 border border-zinc-200 rounded-lg text-sm bg-white outline-none"
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                  >
                    <option value="In Transit">In Transit</option>
                    <option value="Delivered">Delivered</option>
                  </select>
                </div>
              </div>
            </div>
            <DialogFooter className="p-4 border-t bg-zinc-50/50 flex items-center justify-end gap-3">
              <Button variant="outline" className="h-10 rounded-lg px-6 font-bold text-sm text-zinc-600 bg-white border-zinc-200" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button 
                className="h-10 bg-[#0052cc] text-white hover:bg-[#0747a6] rounded-lg font-black px-8 text-[11px] tracking-widest uppercase shadow-sm" 
                onClick={handleSaveShipment}
                disabled={isSaving}
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {editingShipmentId ? "SAVE CHANGES" : "CREATE CONTAINER"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Shipping Zone Modal */}
        <Dialog open={isZoneModalOpen} onOpenChange={setIsZoneModalOpen}>
          <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-white rounded-xl shadow-2xl border border-zinc-200">
            <DialogHeader className="p-6 border-b bg-white">
              <DialogTitle className="text-xl font-bold text-zinc-900">{zoneFormData.id ? "Edit Shipping Zone" : "Add New Shipping Zone"}</DialogTitle>
              <p className="text-sm text-zinc-500 mt-1">Define shipping rates for Standard and Express delivery.</p>
            </DialogHeader>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-500">Applicable Product *</label>
                  <SearchableDropdown 
                    items={zoneFormData.id ? [{id: "", name: "All Products"}, ...products.map(p => ({id: p.id, name: `${p.name} (${p.sku})`}))] : products.map(p => ({id: p.id, name: `${p.name} (${p.sku})`}))}
                    value={zoneFormData.product_id?.toString() || ""}
                    onChange={(val) => setZoneFormData({...zoneFormData, product_id: val})}
                    placeholder="Select product..."
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-500">Origin (Warehouse) *</label>
                  <SearchableDropdown 
                    items={zoneFormData.id ? [{id: "", name: "Any Warehouse"}, ...warehousesData.map(w => ({id: w.id, name: w.name}))] : warehousesData.map(w => ({id: w.id, name: w.name}))}
                    value={zoneFormData.warehouse_id?.toString() || ""}
                    onChange={(val) => setZoneFormData({...zoneFormData, warehouse_id: val})}
                    placeholder="Select origin..."
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-500">Destination Country *</label>
                  <SearchableDropdown 
                    items={modalCountryOptions}
                    value={zoneFormData.country}
                    onChange={(val) => setZoneFormData({...zoneFormData, country: val, city: ""})}
                    placeholder="Search country..."
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-500">Destination City *</label>
                  <SearchableDropdown 
                    items={modalCityOptions}
                    value={zoneFormData.city}
                    onChange={(val) => setZoneFormData({...zoneFormData, city: val})}
                    placeholder="Search city..."
                    disabled={!zoneFormData.country}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-500">Weight (KG) [Read-Only] *</label>
                  <Input 
                    type="text"
                    readOnly
                    className="h-10 border-zinc-200 rounded-lg font-bold bg-zinc-50" 
                    value={`${currentWeight} KG`}
                  />
                </div>
                <div className="space-y-1.5">
                   <label className="text-xs font-semibold text-zinc-500">Weight Rate (Ksh/KG) *</label>
                   <Input 
                     type="number"
                     placeholder="e.g. 50.00" 
                     className="h-10 border-zinc-200 rounded-lg font-bold text-indigo-600" 
                     value={zoneFormData.weight_rate || ""}
                     onChange={(e) => setZoneFormData({...zoneFormData, weight_rate: parseFloat(e.target.value) || 0})}
                   />
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-500">Distance (KM) *</label>
                  <Input 
                    type="number"
                    placeholder="e.g. 120" 
                    className="h-10 border-zinc-200 rounded-lg font-bold text-zinc-800" 
                    value={zoneFormData.distance || ""}
                    onChange={(e) => setZoneFormData({...zoneFormData, distance: parseFloat(e.target.value) || 0})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-500">Distance Rate (Ksh/KM) *</label>
                  <Input 
                    type="number"
                    placeholder="e.g. 2.50" 
                    className="h-10 border-zinc-200 rounded-lg font-bold text-emerald-600" 
                    value={zoneFormData.distance_rate || ""}
                    onChange={(e) => setZoneFormData({...zoneFormData, distance_rate: parseFloat(e.target.value) || 0})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-500">Zone Status</label>
                  <select 
                    className="w-full h-10 px-3 border border-zinc-200 rounded-lg text-sm bg-white outline-none"
                    value={zoneFormData.is_active ? "true" : "false"}
                    onChange={(e) => setZoneFormData({...zoneFormData, is_active: e.target.value === "true"})}
                  >
                    <option value="true">Active (Visible to customers)</option>
                    <option value="false">Inactive (Hidden from checkout)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-500">Standard Fee (Ksh) [Read-Only]</label>
                  <Input 
                    type="text"
                    readOnly
                    className="h-10 border-zinc-200 rounded-lg font-bold bg-zinc-50 text-blue-700" 
                    value={`Ksh ${calculatedStandardFee.toLocaleString()}`}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-500">Express Fee (Ksh) [Read-Only]</label>
                  <Input 
                    type="text"
                    readOnly
                    className="h-10 border-zinc-200 rounded-lg font-bold text-amber-600 bg-zinc-50" 
                    value={`Ksh ${calculatedExpressFee.toLocaleString()}`}
                  />
                </div>
              </div>
            </div>
            <DialogFooter className="p-4 border-t bg-zinc-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
              <Button variant="outline" className="w-full sm:w-auto h-10 rounded-lg px-6 font-bold text-sm text-zinc-600 bg-white border-zinc-200" onClick={() => setIsZoneModalOpen(false)}>Cancel</Button>
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                {!zoneFormData.id && (
                  <Button 
                    variant="outline"
                    className="w-full sm:w-auto h-10 border-[#0052cc] text-[#0052cc] hover:bg-blue-50/50 rounded-lg font-black px-6 text-[11px] tracking-widest uppercase shadow-sm" 
                    onClick={() => handleSaveZone(false)}
                    disabled={isSaving}
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Save & Add Another
                  </Button>
                )}
                <Button 
                  className="w-full sm:w-auto h-10 bg-[#0052cc] text-white hover:bg-[#0747a6] rounded-lg font-black px-8 text-[11px] tracking-widest uppercase shadow-sm" 
                  onClick={() => handleSaveZone(true)}
                  disabled={isSaving}
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {zoneFormData.id ? "Save Changes" : "Save & Close"}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Custom Delete Confirmation Modal */}
        <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
          <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden bg-white rounded-xl shadow-2xl border border-zinc-200">
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
                <Trash2 className="h-8 w-8 text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-zinc-900">Confirm Deletion</h3>
                <p className="text-sm text-zinc-500 mt-1">Are you sure you want to delete this shipping zone? This action cannot be undone.</p>
              </div>
            </div>
            <DialogFooter className="p-4 bg-zinc-50/50 flex items-center justify-center gap-3 border-t">
              <Button variant="outline" className="flex-1 h-11 rounded-lg font-bold" onClick={() => setIsDeleteModalOpen(false)}>Keep Zone</Button>
              <Button className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold" onClick={handleDeleteZone}>Delete Permanently</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Country Delete Confirmation Modal */}
        <Dialog open={isDeleteCountryModalOpen} onOpenChange={setIsDeleteCountryModalOpen}>
          <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden bg-white rounded-xl shadow-2xl border border-zinc-200">
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
                <Trash2 className="h-8 w-8 text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-zinc-900">Delete Country</h3>
                <p className="text-sm text-zinc-500 mt-1">Are you sure you want to delete this country and all its cities? This action cannot be undone.</p>
              </div>
            </div>
            <DialogFooter className="p-4 bg-zinc-50/50 flex items-center justify-center gap-3 border-t">
              <Button variant="outline" className="flex-1 h-11 rounded-lg font-bold" onClick={() => setIsDeleteCountryModalOpen(false)}>Cancel</Button>
              <Button className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold" onClick={handleDeleteCountry}>Delete Permanently</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* City Delete Confirmation Modal */}
        <Dialog open={isDeleteCityModalOpen} onOpenChange={setIsDeleteCityModalOpen}>
          <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden bg-white rounded-xl shadow-2xl border border-zinc-200">
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
                <Trash2 className="h-8 w-8 text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-zinc-900">Delete City</h3>
                <p className="text-sm text-zinc-500 mt-1">Are you sure you want to delete this city? This action cannot be undone.</p>
              </div>
            </div>
            <DialogFooter className="p-4 bg-zinc-50/50 flex items-center justify-center gap-3 border-t">
              <Button variant="outline" className="flex-1 h-11 rounded-lg font-bold" onClick={() => setIsDeleteCityModalOpen(false)}>Cancel</Button>
              <Button className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold" onClick={handleDeleteCity}>Delete Permanently</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
}
