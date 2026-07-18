"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Search, Filter, ShoppingCart, ImageIcon, ChevronLeft, ChevronRight, LogOut, Plus, Minus, Tag, Zap, Compass, ChevronDown } from "lucide-react";
import api from "@/lib/axios";
import { API_ENDPOINTS } from "@/lib/apis";
import { useCart } from "@/context/CartContext";
import Image from "next/image";
import { cn, getCategoryColor } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { toast } from "react-hot-toast";
import { useSettings } from "@/components/providers/SettingsProvider";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { ProductViewModal } from "@/components/modals/ProductViewModal";
import { Joyride, Step } from "react-joyride";
const JoyrideComponent = Joyride as any;

interface Category {
  id: number;
  name: string;
}

interface Brand {
  id: number;
  name: string;
}

interface Inventory {
  warehouse_id: number;
  warehouse: { name: string; id: number };
  quantity: number;
}

interface Product {
  id: number;
  sku: string;
  part_number?: string;
  suitable_vehicle?: string;
  engine_model?: string;
  name: string;
  price: number;
  category: { name: string; id: number };
  brand: { name: string; id: number };
  images?: string[];
  status?: string;
  weight: number;
  inventories?: Inventory[];
  is_on_offer?: boolean;
  offer_price?: number;
  original_price?: number;
  variants?: any[];
}

const isVideo = (src: string) => {
  if (!src) return false;
  return src.startsWith("data:video/") || src.includes(".mp4") || src.includes(".webm") || src.includes(".ogg") || src.includes("/video/upload/");
};

function ProductImageCarousel({ product, priority = false }: { product: Product, priority?: boolean }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!product.images || product.images.length === 0) {
    return (
      <div className="w-full h-full border-2 border-dashed border-zinc-200 rounded-lg flex flex-col items-center justify-center text-zinc-400 space-y-2">
        <ImageIcon className="h-8 w-8 text-zinc-300" />
        <span className="italic text-xs font-medium">No Image</span>
      </div>
    );
  }

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setCurrentIndex((prev) => (prev + 1) % (product.images?.length || 1));
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setCurrentIndex((prev) => (prev === 0 ? (product.images?.length || 1) - 1 : prev - 1));
  };

  return (
    <>
      {isVideo(product.images[currentIndex]) ? (
        <video
          src={product.images[currentIndex]}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          muted
          playsInline
          autoPlay
          loop
        />
      ) : (
        <Image
          src={product.images[currentIndex]}
          alt={product.name}
          fill
          priority={priority}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-cover group-hover:scale-105 transition-transform duration-500"
        />
      )}
      {product.images.length > 1 && (
        <>
          <button
            onClick={prevImage}
            className="absolute left-2 top-1/2 -translate-y-1/2 h-7 w-7 bg-white/90 text-zinc-900 rounded-full flex items-center justify-center hover:bg-white shadow-sm opacity-80 hover:opacity-100 transition-opacity z-20"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={nextImage}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 bg-white/90 text-zinc-900 rounded-full flex items-center justify-center hover:bg-white shadow-sm opacity-80 hover:opacity-100 transition-opacity z-20"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-20">
            {product.images.map((_, i) => (
              <div key={i} className={cn("h-1.5 w-1.5 rounded-full transition-colors", i === currentIndex ? "bg-primary" : "bg-white/60")} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function ProductCard({ product, priority = false }: { product: Product, priority?: boolean }) {
  const { settings } = useSettings();
  const currency = settings.currency || "Ksh";
  const { cart, addToCart, removeFromCart } = useCart();
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | "">("");
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const selectRef = useRef<HTMLSelectElement>(null);

  // Compile brand options: parent product + child variants
  const brandOptions = useMemo(() => {
    const list: any[] = [];
    if (product.brand) {
      list.push({
        id: product.id,
        brandName: product.brand.name,
        price: product.price,
        sku: product.sku,
        part_number: product.part_number,
        is_on_offer: product.is_on_offer,
        offer_price: product.offer_price,
        inventories: product.inventories || [],
        status: product.status,
        weight: product.weight
      });
    }
    if (product.variants && (product.variants as any).length > 0) {
      (product.variants as any).forEach((v: any) => {
        list.push({
          id: v.id,
          brandName: v.brand?.name || "Alternative Brand",
          price: v.price,
          sku: v.sku,
          part_number: v.part_number,
          is_on_offer: v.is_on_offer,
          offer_price: v.offer_price,
          inventories: v.inventories || [],
          status: v.status,
          weight: v.weight
        });
      });
    }
    return list;
  }, [product]);

  // Selected option state (default to parent product ID, or first option if parent has no brand)
  const [selectedOptionId, setSelectedOptionId] = useState<number>(() => {
    return brandOptions[0]?.id || product.id;
  });

  const activeProduct = useMemo(() => {
    return brandOptions.find(o => o.id === selectedOptionId) || brandOptions[0] || {
      id: product.id,
      brandName: product.brand?.name || "Unknown Brand",
      price: product.price,
      sku: product.sku,
      part_number: product.part_number,
      is_on_offer: product.is_on_offer,
      offer_price: product.offer_price,
      inventories: product.inventories || [],
      status: product.status,
      weight: product.weight
    };
  }, [brandOptions, selectedOptionId, product]);

  const availableInventories = activeProduct.inventories?.filter((i: any) => i.quantity > 0) || [];
  const isInCart = cart.some(item => item.id === activeProduct.id && item.warehouse_id === selectedWarehouseId);

  const mergedProductForModal = useMemo(() => {
    return {
      ...product,
      id: activeProduct.id,
      sku: activeProduct.sku,
      part_number: activeProduct.part_number,
      price: activeProduct.price,
      is_on_offer: activeProduct.is_on_offer,
      offer_price: activeProduct.offer_price,
      weight: activeProduct.weight,
      brand: { name: activeProduct.brandName },
      inventories: activeProduct.inventories
    };
  }, [product, activeProduct]);

  return (
    <Card
      className={cn(
        "overflow-hidden group border-zinc-100 shadow-sm hover:shadow-xl transition-all duration-300",
        activeProduct.status === "Inactive" && "opacity-75 grayscale-[0.5]"
      )}
    >
      <div
        onClick={() => setIsViewModalOpen(true)}
        className="h-48 bg-zinc-50 flex items-center justify-center p-6 relative cursor-pointer"
      >
        {activeProduct.status === "Inactive" ? (
          <div className="absolute top-3 left-3 z-10">
            <Badge className="bg-red-600 text-white border-none font-bold text-[10px] px-2 py-0.5">INACTIVE</Badge>
          </div>
        ) : availableInventories.length === 0 ? (
          <div className="absolute top-3 left-3 z-10">
            <Badge className="bg-zinc-800 text-white border-none font-bold text-[10px] px-2 py-0.5">OUT OF STOCK</Badge>
          </div>
        ) : availableInventories.reduce((acc: number, inv: any) => acc + inv.quantity, 0) <= 5 ? (
          <div className="absolute top-3 left-3 z-10">
            <Badge className="bg-orange-500 text-white border-none font-bold text-[10px] px-2 py-0.5 animate-pulse">LOW STOCK</Badge>
          </div>
        ) : null}
        {activeProduct.is_on_offer && (
          <div className="absolute top-3 right-3 z-10">
            <Badge className="bg-rose-600 hover:bg-rose-700 text-white border-none font-black text-[10px] px-2.5 py-0.5 uppercase tracking-wider shadow-sm flex items-center gap-1 animate-pulse">
              <Zap className="h-3 w-3 fill-current" /> Save Big
            </Badge>
          </div>
        )}
        <ProductImageCarousel product={product} priority={priority} />
      </div>
      <CardContent className="p-6 pb-2">
        <div className="text-xs font-bold text-[#0052cc] mb-2 uppercase tracking-tighter line-clamp-1">
          {activeProduct.brandName}
        </div>
        <h3 className="text-lg font-bold line-clamp-1 group-hover:text-[#0052cc] transition-colors">
          {product.name}
        </h3>
        <p className="text-sm text-[#64748b] mt-1 font-medium">SKU: {activeProduct.sku}</p>

        <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs border-t border-[#f1f5f9] pt-2">
          <div>
            <span className="text-[#94a3b8] font-bold block uppercase tracking-wider text-[9px]">Part No (OEM)</span>
            <span className="font-semibold text-zinc-700">{activeProduct.part_number || "—"}</span>
          </div>
          <div>
            <span className="text-[#94a3b8] font-bold block uppercase tracking-wider text-[9px]">Engine</span>
            <span className="font-semibold text-zinc-700">{product.engine_model || "—"}</span>
          </div>
          <div className="col-span-2">
            <span className="text-[#94a3b8] font-bold block uppercase tracking-wider text-[9px]">Suitable Vehicle</span>
            <span className="font-semibold text-zinc-700 line-clamp-1" title={product.suitable_vehicle}>{product.suitable_vehicle || "—"}</span>
          </div>
        </div>

        {/* Dynamic Brand Dropdown Selector */}
        {brandOptions.length > 1 && (
          <div className="mt-4 pt-3 border-t border-[#f1f5f9]">
            <label className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-widest mb-1.5 block">Select Brand Option</label>
            <select
              className="w-full h-10 px-3 border border-[#cbd5e1] rounded-md text-[12px] font-bold bg-white outline-none focus:ring-2 focus:ring-blue-50"
              value={selectedOptionId}
              onChange={(e) => {
                setSelectedOptionId(Number(e.target.value));
                setSelectedWarehouseId(""); // reset selected warehouse when brand changes
              }}
            >
              {brandOptions.map(opt => (
                <option key={opt.id} value={opt.id}>
                  {opt.brandName} - {currency} {Number(opt.is_on_offer ? opt.offer_price : opt.price).toLocaleString()} {opt.is_on_offer ? "(On Offer)" : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          {activeProduct.is_on_offer ? (
            <div className="flex flex-col">
              <span className="line-through text-xs font-bold text-zinc-400">
                {currency} {Number(activeProduct.price).toLocaleString()}
              </span>
              <span className="text-xl font-black text-rose-600 tracking-tight flex items-center gap-1 animate-pulse">
                {currency} {Number(activeProduct.offer_price).toLocaleString()}
              </span>
            </div>
          ) : (
            <span className="text-xl font-bold text-[#1e293b] tracking-tight">
              {currency} {Number(activeProduct.price).toLocaleString()}
            </span>
          )}
          <div className="flex gap-1.5">
            <span className="text-[10px] font-bold bg-[#eff6ff] text-[#0052cc] px-2 py-1 rounded uppercase tracking-wider">
              {activeProduct.weight ? `${Number(activeProduct.weight).toFixed(2)} KG` : "1.00 KG"}
            </span>
            <span className={cn("text-[10px] font-black border px-2.5 py-1 rounded uppercase tracking-wider", getCategoryColor(product.category?.name || "N/A"))}>
              {product.category?.name || "Uncategorized"}
            </span>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-[#f1f5f9]">
          <label className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-widest mb-2 block">Ship From Hub</label>
          <select
            ref={selectRef}
            className={cn(
              "w-full h-10 px-3 border rounded-md text-[12px] font-bold bg-white outline-none transition-all",
              !selectedWarehouseId && availableInventories.length > 0
                ? "border-[#0052cc] ring-2 ring-blue-50 animate-pulse shadow-sm"
                : "border-[#e2e8f0] focus:ring-2 focus:ring-blue-50"
            )}
            value={selectedWarehouseId}
            onChange={(e) => setSelectedWarehouseId(Number(e.target.value))}
            disabled={activeProduct.status === "Inactive" || availableInventories.length === 0}
          >
            {availableInventories.length === 0 ? (
              <option>Out of Stock Globally</option>
            ) : (
              <>
                <option value="">Select Warehouse...</option>
                {availableInventories.map((inv: any) => (
                  <option key={inv.warehouse_id} value={inv.warehouse_id}>
                    {inv.warehouse.name} ({inv.quantity} PCS)
                  </option>
                ))}
              </>
            )}
          </select>
        </div>
      </CardContent>
      <CardFooter className="p-6 pt-2">
        <Button
          className={cn(
            "w-full group font-bold uppercase text-[11px] tracking-wider h-12 transition-all duration-300 rounded-md shadow-sm",
            activeProduct.status === "Inactive" || availableInventories.length === 0
              ? "bg-[#f1f5f9] text-[#94a3b8] cursor-not-allowed"
              : !selectedWarehouseId
                ? "bg-white text-[#0052cc] border border-[#e2e8f0] hover:border-[#0052cc] cursor-default"
                : isInCart
                  ? "bg-[#ef4444] text-white hover:bg-[#dc2626] shadow-red-100" // Red for Remove
                  : "bg-[#22c55e] text-white hover:bg-[#16a34a] shadow-green-100" // Green for Add
          )}
          disabled={activeProduct.status === "Inactive" || availableInventories.length === 0}
          onClick={() => {
            if (!selectedWarehouseId) {
              selectRef.current?.focus();
              if ('showPicker' in (selectRef.current || {})) {
                (selectRef.current as any).showPicker();
              }
              return;
            }

            if (isInCart) {
              removeFromCart(activeProduct.id, Number(selectedWarehouseId));
              toast.error(`${product.name} removed from cart`, {
                style: { background: '#ef4444', color: '#fff', fontWeight: 'bold', fontSize: '12px' }
              });
            } else {
              const inv = availableInventories.find((i: any) => i.warehouse_id === selectedWarehouseId);
              if (inv) {
                const cartProduct = {
                  ...product,
                  id: activeProduct.id,
                  sku: activeProduct.sku,
                  price: activeProduct.price,
                  is_on_offer: activeProduct.is_on_offer,
                  offer_price: activeProduct.offer_price,
                  brand: { name: activeProduct.brandName }
                };
                addToCart(cartProduct, inv.warehouse_id, inv.warehouse.name);
                toast.success(`${product.name} (${activeProduct.brandName}) added to cart!`, {
                  style: {
                    background: '#22c55e',
                    color: '#fff',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    fontSize: '12px',
                    textTransform: 'uppercase',
                  },
                  icon: '🛒'
                });
              }
            }
          }}
        >
          {activeProduct.status === "Inactive"
            ? "Unavailable"
            : availableInventories.length === 0
              ? "Out of Stock"
              : !selectedWarehouseId
                ? "Choose Hub First"
                : isInCart ? "Remove from Cart" : "Add to Cart"}
          {selectedWarehouseId && (
            isInCart ? <LogOut className="ml-2 h-4 w-4" /> : <ShoppingCart className="ml-2 h-4 w-4" />
          )}
        </Button>
      </CardFooter>
      <ProductViewModal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        product={mergedProductForModal}
      />
    </Card>
  );
}

export default function PublicProductsPage() {
  const { settings } = useSettings();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Products-page Joyride tour
  const [mounted, setMounted] = useState(false);
  const [runTour, setRunTour] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Only show if the account-page tour has already been completed AND products tour not done
    const tourDone = localStorage.getItem("spare_tour_done");
    const productsTourDone = localStorage.getItem("spare_products_tour_done");
    if (tourDone && !productsTourDone) {
      localStorage.setItem("spare_products_tour_done", "true");
      const t = setTimeout(() => setRunTour(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  const bizName = settings.store_name || "our store";
  const bizTagline = settings.store_tagline || "";
  const bizCurrency = settings.currency || "Ksh";
  const bizPhone = settings.contact_phone || "";
  const bizWA = settings.contact_whatsapp || "";
  const bizBranch = settings.store_branch || "";
  const bizWebsite = settings.store_website || "";
  const bizHours = settings.working_hours || "";

  const productTourSteps: Step[] = [
    {
      target: "body",
      placement: "center" as const,
      title: `${bizName} — Parts Catalog`,
      content: `${bizTagline ? `"${bizTagline}" — ` : ""}Browse and order genuine Mercedes-Benz spare parts. We will walk you through how to find a part, pick a warehouse hub, and add it to your cart.${bizWebsite ? ` Learn more at ${bizWebsite}.` : ""}`,
      skipBeacon: true,
    },
    {
      target: "#tour-search-bar",
      placement: "bottom" as const,
      title: "Search Parts Catalog",
      content: `Use this search box in the middle to find parts by Part number, SKU, name, or brand. All prices are displayed in ${bizCurrency}.`,
    },
    {
      target: "#tour-categories-sidebar",
      placement: "right" as const,
      title: "Filter by Category",
      content: `Select one or more categories in this sidebar to narrow down search results instantly.`,
    },
    {
      target: "#tour-product-grid",
      placement: "top" as const,
      title: "Parts Catalog Grid",
      content: `Each card shows the part image, brand, SKU, weight, price in ${bizCurrency}, and any active discount. Click the image to open a full details view with all product specifications.`,
    },
    {
      target: "#tour-product-card",
      placement: "top" as const,
      title: "Select a Warehouse Hub First",
      content: `Before adding a part to your cart you must select a Warehouse Hub from the pulsing dropdown on the card. Each hub shows live stock (e.g. '${bizBranch || "Nairobi Hub"} — 12 PCS'). Parts from different hubs are tracked separately.${bizHours ? ` Dispatch hours: ${bizHours}.` : ""}`,
    },
    {
      target: "#tour-cart-btn",
      placement: "bottom" as const,
      title: "Your Shopping Cart",
      content: `Once you select a hub and click 'Add to Cart', the cart icon updates with your item count. Click it to review quantities, remove items, or proceed to ${bizName} checkout.${bizPhone ? ` Need help? Call ${bizPhone}.` : ""}${bizWA ? ` WhatsApp: ${bizWA}.` : ""}`,
    },
    {
      target: "#tour-profile-menu",
      placement: "bottom" as const,
      title: "Access Your Account Dashboard",
      content: `Click your name in the top-right corner to open the quick-access menu. Jump to your ${bizName} Account Dashboard, view My Orders, manage Delivery Addresses, change your password, or log out.`,
    },
  ];

  const handleProductTourCallback = (data: any) => {
    const { status } = data;
    if (["finished", "skipped"].includes(status)) {
      setRunTour(false);
      localStorage.setItem("spare_products_tour_done", "true");
    }
  };

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [brandSearch, setBrandSearch] = useState("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandIds, setSelectedBrandIds] = useState<number[]>([]);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(9);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await api.get(API_ENDPOINTS.products.base, {
        params: {
          page: currentPage,
          per_page: pageSize,
          search: searchQuery,
          category_id: selectedCategoryIds.length === 1 ? selectedCategoryIds[0] : undefined,
          brand_id: selectedBrandIds.length === 1 ? selectedBrandIds[0] : undefined,
          // If multiple categories are selected, we still fetch by search/pagination
          // but we'll apply the multi-category filter client-side on the current page
        }
      });

      if (res.data.data) {
        setProducts(res.data.data);
        setTotalItems(res.data.total);
      } else {
        setProducts(res.data);
        setTotalItems(res.data.length);
      }
    } catch (err) {
      console.error("Failed to fetch the product:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api.get(API_ENDPOINTS.categories.base)
      .then((res) => setCategories(res.data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    api.get(API_ENDPOINTS.brands.base)
      .then((res) => setBrands(res.data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [currentPage, pageSize, searchQuery, selectedCategoryIds, selectedBrandIds]);

  const toggleCategory = (categoryId: number) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const toggleBrand = (brandId: number) => {
    setSelectedBrandIds((prev) =>
      prev.includes(brandId)
        ? prev.filter((id) => id !== brandId)
        : [...prev, brandId]
    );
  };

  // We still use a small memo for the current page if multiple categories are selected
  const filteredProducts = useMemo(() => {
    if (!Array.isArray(products)) return [];
    return products.filter((product) => {
      const matchesCategory =
        selectedCategoryIds.length <= 1 || // Already filtered by server if 1 or 0
        (product.category && selectedCategoryIds.includes(product.category.id));

      const matchesBrand =
        selectedBrandIds.length <= 1 || // Already filtered by server if 1 or 0
        (product.brand && selectedBrandIds.includes(product.brand.id));

      return matchesCategory && matchesBrand;
    });
  }, [products, selectedCategoryIds, selectedBrandIds]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategoryIds, selectedBrandIds]);

  const paginatedProducts = filteredProducts; // Already limited by server pageSize

  return (
    <div className="flex flex-col min-h-screen">
      {mounted && (
        <JoyrideComponent
          callback={handleProductTourCallback}
          continuous
          run={runTour}
          scrollToFirstStep
          showProgress
          showSkipButton
          steps={productTourSteps as any}
          styles={{
            options: {
              arrowColor: "#ffffff",
              backgroundColor: "#ffffff",
              overlayColor: "rgba(0,0,0,0.45)",
              primaryColor: "#0052cc",
              textColor: "#1e293b",
              zIndex: 10000,
            },
            tooltip: {
              borderRadius: "12px",
              padding: "20px",
              boxShadow: "0 20px 25px -5px rgb(0 0 0/0.1),0 8px 10px -6px rgb(0 0 0/0.1)",
              fontFamily: "sans-serif",
            },
            tooltipTitle: { fontWeight: 800, fontSize: "16px", color: "#1e293b", marginBottom: "10px" },
            tooltipContent: { fontSize: "13px", lineHeight: 1.6, color: "#64748b" },
            buttonNext: { backgroundColor: "#0052cc", color: "#ffffff", fontWeight: "bold", borderRadius: "6px", padding: "8px 16px", fontSize: "12px" },
            buttonBack: { marginRight: "12px", color: "#64748b", fontWeight: "bold", fontSize: "12px" },
            buttonSkip: { color: "#ef4444", fontWeight: "bold", fontSize: "12px" },
          } as any}
        />
      )}
      <Navbar />
      <main className="flex-1 bg-secondary/30">
        <div className="bg-[#1e293b] text-white py-12">
          <div className="container mx-auto px-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold">Parts Catalog</h1>
              <p className="text-slate-400 mt-2">
                Browse our extensive inventory of genuine Mercedes-Benz parts.
              </p>
            </div>
            <Button
              onClick={() => { setRunTour(true); }}
              className="bg-[#0052cc] hover:bg-[#004bb3] text-white font-bold text-xs h-9 px-4 rounded-md transition-all shadow-sm border-none flex items-center gap-2"
            >
              <Compass className="h-4 w-4" /> Start Tour
            </Button>
          </div>
        </div>

        <div className="container mx-auto px-4 py-12">
          <div className="flex flex-col md:flex-row gap-8">
            {/* Filters Sidebar */}
            <aside id="tour-categories-sidebar" className="w-full md:w-64 shrink-0">
              <div className="bg-white rounded-xl border border-zinc-200/80 shadow-sm overflow-hidden">

                {/* ── Sticky Sidebar Header (toggle on mobile) ── */}
                <div
                  className="flex justify-between items-center px-5 py-4 border-b border-zinc-100 cursor-pointer md:cursor-default select-none sticky top-0 bg-white z-10"
                  onClick={() => setShowMobileFilters(!showMobileFilters)}
                >
                  <h3 className="font-black text-[11px] text-zinc-800 flex items-center gap-2 uppercase tracking-widest">
                    <Filter className="h-3.5 w-3.5 text-[#0052cc]" />
                    Filters
                  </h3>
                  <ChevronDown className={cn("h-4 w-4 text-zinc-400 transition-transform duration-200", showMobileFilters ? "rotate-180" : "")} />
                </div>

                {/* ── Collapsible body — scrollable on mobile ── */}
                <div
                  className={cn(
                    "transition-all duration-300 md:block",
                    showMobileFilters ? "block" : "hidden"
                  )}
                >
                  {/* Inner scroll container — max 70vh on mobile so it never swamps the screen */}
                  <div
                    className="overflow-y-auto max-h-[70vh] md:max-h-none px-5 pb-5 pt-4 space-y-5"
                    style={{ WebkitOverflowScrolling: "touch" }}
                  >

                    {/* ── CATEGORIES ── */}
                    <div className="space-y-3">
                      <p className="font-black text-[10px] text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                        <Filter className="h-3 w-3 text-[#0052cc]" /> Categories
                      </p>

                      {/* Category Search */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                        <Input
                          className="pl-9 h-9 text-xs border-[#cbd5e1] placeholder:text-zinc-400 rounded-lg font-semibold"
                          placeholder="Search categories..."
                          value={categorySearch}
                          onChange={(e) => setCategorySearch(e.target.value)}
                        />
                      </div>

                      {/* Category List — scrollable, shows ~4 items then scrolls */}
                      <div className="relative">
                        <div
                          className="space-y-1 max-h-[168px] overflow-y-auto pr-1 touch-pan-y"
                          style={{
                            WebkitOverflowScrolling: "touch",
                            scrollbarWidth: "thin",
                            scrollbarColor: "#e2e8f0 transparent",
                          }}
                        >
                          {categories.filter(cat => cat.name.toLowerCase().includes(categorySearch.toLowerCase())).length === 0 ? (
                            <p className="text-xs text-zinc-400 font-medium py-2 italic text-center">No categories found</p>
                          ) : (
                            categories
                              .filter(cat => cat.name.toLowerCase().includes(categorySearch.toLowerCase()))
                              .map((cat) => {
                                const isSelected = selectedCategoryIds.includes(cat.id);
                                return (
                                  <label
                                    key={cat.id}
                                    className={cn(
                                      "flex items-center gap-3 cursor-pointer px-2.5 py-2 rounded-lg transition-all select-none border font-semibold text-xs",
                                      isSelected
                                        ? "bg-blue-50/60 border-blue-200 text-[#0052cc]"
                                        : "bg-white border-transparent text-[#475569] hover:bg-zinc-50 hover:text-zinc-900"
                                    )}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => toggleCategory(cat.id)}
                                      className="rounded border-[#cbd5e1] text-[#0052cc] focus:ring-[#0052cc] w-4 h-4 cursor-pointer shrink-0"
                                    />
                                    <span className="truncate">{cat.name}</span>
                                  </label>
                                );
                              })
                          )}
                        </div>
                        {/* Fade hint — shows more items below */}
                        {categories.filter(cat => cat.name.toLowerCase().includes(categorySearch.toLowerCase())).length > 4 && (
                          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent rounded-b-lg" />
                        )}
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-zinc-100" />

                    {/* ── BRANDS ── */}
                    <div className="space-y-3">
                      <p className="font-black text-[10px] text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                        <Tag className="h-3 w-3 text-[#0052cc]" /> Brands
                      </p>

                      {/* Brand Search */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                        <Input
                          className="pl-9 h-9 text-xs border-[#cbd5e1] placeholder:text-zinc-400 rounded-lg font-semibold"
                          placeholder="Search brands..."
                          value={brandSearch}
                          onChange={(e) => setBrandSearch(e.target.value)}
                        />
                      </div>

                      {/* Brand List — scrollable, shows ~4 items then scrolls */}
                      <div className="relative">
                        <div
                          className="space-y-1 max-h-[168px] overflow-y-auto pr-1 touch-pan-y"
                          style={{
                            WebkitOverflowScrolling: "touch",
                            scrollbarWidth: "thin",
                            scrollbarColor: "#e2e8f0 transparent",
                          }}
                        >
                          {brands.filter(b => b.name.toLowerCase().includes(brandSearch.toLowerCase())).length === 0 ? (
                            <p className="text-xs text-zinc-400 font-medium py-2 italic text-center">No brands found</p>
                          ) : (
                            brands
                              .filter(b => b.name.toLowerCase().includes(brandSearch.toLowerCase()))
                              .map((brand) => {
                                const isSelected = selectedBrandIds.includes(brand.id);
                                return (
                                  <label
                                    key={brand.id}
                                    className={cn(
                                      "flex items-center gap-3 cursor-pointer px-2.5 py-2 rounded-lg transition-all select-none border font-semibold text-xs",
                                      isSelected
                                        ? "bg-blue-50/60 border-blue-200 text-[#0052cc]"
                                        : "bg-white border-transparent text-[#475569] hover:bg-zinc-50 hover:text-zinc-900"
                                    )}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => toggleBrand(brand.id)}
                                      className="rounded border-[#cbd5e1] text-[#0052cc] focus:ring-[#0052cc] w-4 h-4 cursor-pointer shrink-0"
                                    />
                                    <span className="truncate">{brand.name}</span>
                                  </label>
                                );
                              })
                          )}
                        </div>
                        {/* Fade hint */}
                        {brands.filter(b => b.name.toLowerCase().includes(brandSearch.toLowerCase())).length > 4 && (
                          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent rounded-b-lg" />
                        )}
                      </div>
                    </div>

                  </div>{/* end inner scroll */}
                </div>{/* end collapsible body */}

              </div>
            </aside>

            {/* Products Grid */}
            <div id="tour-product-grid" className="flex-1">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8 border-b border-[#f1f5f9] pb-6">
                <p className="text-[#64748b] text-[14px] font-medium w-full sm:w-auto text-left">
                  Showing <span className="text-[#1e293b] font-bold">{totalItems}</span> parts available
                </p>
                <div id="tour-search-bar" className="relative w-full max-w-md mx-auto sm:mx-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#475569] font-bold" />
                  <Input
                    className="pl-10 h-11 border-[#cbd5e1] text-[14px] font-semibold text-zinc-900 bg-white placeholder:text-zinc-500 rounded-lg shadow-sm focus-visible:ring-1 focus-visible:ring-primary/20 w-full"
                    placeholder="Part number, SKU, Name or Brand..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="w-full sm:w-auto text-right">
                  <Button variant="ghost" className="text-[13px] font-bold text-[#64748b] hover:bg-zinc-100/50 rounded-lg">
                    <Filter className="mr-2 h-4 w-4 text-zinc-500" /> Sort by: Featured
                  </Button>
                </div>
              </div>

              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="bg-white rounded-xl border border-zinc-100 shadow-sm overflow-hidden animate-pulse">
                      {/* Image area */}
                      <div className="h-48 bg-gradient-to-br from-zinc-100 to-zinc-200" />
                      {/* Card body */}
                      <div className="p-6 pb-3 space-y-3">
                        {/* Brand */}
                        <div className="h-3 w-20 bg-zinc-200 rounded" />
                        {/* Name */}
                        <div className="h-5 w-3/4 bg-zinc-200 rounded" />
                        {/* SKU */}
                        <div className="h-3 w-32 bg-zinc-100 rounded" />
                        {/* Details grid */}
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div className="h-3 bg-zinc-100 rounded" />
                          <div className="h-3 bg-zinc-100 rounded" />
                        </div>
                        {/* Price + badges */}
                        <div className="flex items-center justify-between pt-2">
                          <div className="h-6 w-24 bg-zinc-200 rounded-md" />
                          <div className="flex gap-1.5">
                            <div className="h-5 w-12 bg-zinc-100 rounded" />
                            <div className="h-5 w-16 bg-zinc-100 rounded" />
                          </div>
                        </div>
                        {/* Warehouse picker */}
                        <div className="h-10 w-full bg-zinc-100 rounded-md mt-2" />
                      </div>
                      {/* Button */}
                      <div className="px-6 pb-6">
                        <div className="h-12 w-full bg-zinc-200 rounded-md" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-lg border border-[#e2e8f0] shadow-sm">
                  <Search className="h-12 w-12 text-[#cbd5e1] mb-4" />
                  <h3 className="text-xl font-bold text-[#1e293b]">No results found</h3>
                  <p className="text-[#64748b] mt-2 text-center max-w-md text-[14px]">
                    Try adjusting your filters or search keywords.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-6 border-[#e2e8f0] font-bold"
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedCategoryIds([]);
                      setSelectedBrandIds([]);
                    }}
                  >
                    Clear all filters
                  </Button>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {paginatedProducts.map((product, index) => (
                      <div key={product.id} id={index === 0 ? "tour-product-card" : undefined}>
                        <ProductCard
                          product={product}
                          priority={index < 6}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Pagination Controls */}
                  <PaginationControls
                    currentPage={currentPage}
                    setCurrentPage={setCurrentPage}
                    pageSize={pageSize}
                    setPageSize={setPageSize}
                    totalItems={totalItems}
                    itemName="parts"
                    pageSizeOptions={[9, 18, 36, 72]}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
