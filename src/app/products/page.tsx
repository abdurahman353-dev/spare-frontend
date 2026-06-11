"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Search, Filter, ShoppingCart, ImageIcon, ChevronLeft, ChevronRight, LogOut, Plus, Minus, Tag, Zap, Compass } from "lucide-react";
import api from "@/lib/axios";
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
  brand: { name: string };
  images?: string[];
  status?: string;
  weight: number;
  inventories?: Inventory[];
  is_on_offer?: boolean;
  offer_price?: number;
  original_price?: number;
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
  const availableInventories = product.inventories?.filter(i => i.quantity > 0) || [];

  const isInCart = cart.some(item => item.id === product.id && item.warehouse_id === selectedWarehouseId);

  return (
    <Card
      className={cn(
        "overflow-hidden group border-zinc-100 shadow-sm hover:shadow-xl transition-all duration-300",
        product.status === "Inactive" && "opacity-75 grayscale-[0.5]"
      )}
    >
      <div
        onClick={() => setIsViewModalOpen(true)}
        className="h-48 bg-zinc-50 flex items-center justify-center p-6 relative cursor-pointer"
      >
        {product.status === "Inactive" ? (
          <div className="absolute top-3 left-3 z-10">
            <Badge className="bg-red-600 text-white border-none font-bold text-[10px] px-2 py-0.5">INACTIVE</Badge>
          </div>
        ) : availableInventories.length === 0 ? (
          <div className="absolute top-3 left-3 z-10">
            <Badge className="bg-zinc-800 text-white border-none font-bold text-[10px] px-2 py-0.5">OUT OF STOCK</Badge>
          </div>
        ) : availableInventories.reduce((acc, inv) => acc + inv.quantity, 0) <= 5 ? (
          <div className="absolute top-3 left-3 z-10">
            <Badge className="bg-orange-500 text-white border-none font-bold text-[10px] px-2 py-0.5 animate-pulse">LOW STOCK</Badge>
          </div>
        ) : null}
        {product.is_on_offer && (
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
          {product.brand?.name || "Unknown Brand"}
        </div>
        <h3 className="text-lg font-bold line-clamp-1 group-hover:text-[#0052cc] transition-colors">
          {product.name}
        </h3>
        <p className="text-sm text-[#64748b] mt-1 font-medium">SKU: {product.sku}</p>

        <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs border-t border-[#f1f5f9] pt-2">
          <div>
            <span className="text-[#94a3b8] font-bold block uppercase tracking-wider text-[9px]">Part No (OEM)</span>
            <span className="font-semibold text-zinc-700">{product.part_number || "—"}</span>
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

        <div className="mt-4 flex items-center justify-between">
          {product.is_on_offer ? (
            <div className="flex flex-col">
              <span className="line-through text-xs font-bold text-zinc-400">
                {currency} {Number(product.original_price).toLocaleString()}
              </span>
              <span className="text-xl font-black text-rose-600 tracking-tight flex items-center gap-1 animate-pulse">
                {currency} {Number(product.price).toLocaleString()}
              </span>
            </div>
          ) : (
            <span className="text-xl font-bold text-[#1e293b] tracking-tight">
              {currency} {Number(product.price).toLocaleString()}
            </span>
          )}
          <div className="flex gap-1.5">
            <span className="text-[10px] font-bold bg-[#eff6ff] text-[#0052cc] px-2 py-1 rounded uppercase tracking-wider">
              {product.weight ? `${Number(product.weight).toFixed(2)} KG` : "1.00 KG"}
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
            disabled={product.status === "Inactive" || availableInventories.length === 0}
          >
            {availableInventories.length === 0 ? (
              <option>Out of Stock Globally</option>
            ) : (
              <>
                <option value="">Select Warehouse...</option>
                {availableInventories.map(inv => (
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
            product.status === "Inactive" || availableInventories.length === 0
              ? "bg-[#f1f5f9] text-[#94a3b8] cursor-not-allowed"
              : !selectedWarehouseId
                ? "bg-white text-[#0052cc] border border-[#e2e8f0] hover:border-[#0052cc] cursor-default"
                : isInCart
                  ? "bg-[#ef4444] text-white hover:bg-[#dc2626] shadow-red-100" // Red for Remove
                  : "bg-[#22c55e] text-white hover:bg-[#16a34a] shadow-green-100" // Green for Add
          )}
          disabled={product.status === "Inactive" || availableInventories.length === 0}
          onClick={() => {
            if (!selectedWarehouseId) {
              selectRef.current?.focus();
              if ('showPicker' in (selectRef.current || {})) {
                (selectRef.current as any).showPicker();
              }
              return;
            }

            if (isInCart) {
              removeFromCart(product.id, Number(selectedWarehouseId));
              toast.error(`${product.name} removed from cart`, {
                style: { background: '#ef4444', color: '#fff', fontWeight: 'bold', fontSize: '12px' }
              });
            } else {
              const inv = availableInventories.find(i => i.warehouse_id === selectedWarehouseId);
              if (inv) {
                addToCart(product, inv.warehouse_id, inv.warehouse.name);
                toast.success(`${product.name} added to cart!`, {
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
          {product.status === "Inactive"
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
        product={product}
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
      target: "#tour-search-filter",
      placement: "right" as const,
      title: "Search & Filter Parts",
      content: `Use the search box to find ${bizName} parts by SKU, name, or brand. Tick one or more categories to narrow results instantly. All prices are displayed in ${bizCurrency}.`,
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
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);

  useEffect(() => {
    Promise.all([
      api.get("/products"),
      api.get("/categories")
    ])
      .then(([productsRes, categoriesRes]) => {
        setProducts(productsRes.data);
        setCategories(categoriesRes.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const toggleCategory = (categoryId: number) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        !query ||
        product.name.toLowerCase().includes(query) ||
        product.sku.toLowerCase().includes(query) ||
        (product.part_number || "").toLowerCase().includes(query) ||
        (product.suitable_vehicle || "").toLowerCase().includes(query) ||
        (product.engine_model || "").toLowerCase().includes(query) ||
        (product.brand?.name || "").toLowerCase().includes(query);

      const matchesCategory =
        selectedCategoryIds.length === 0 ||
        (product.category && selectedCategoryIds.includes(product.category.id));

      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategoryIds]);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(9);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategoryIds]);

  const totalPages = Math.ceil(filteredProducts.length / pageSize);
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredProducts.slice(startIndex, startIndex + pageSize);
  }, [filteredProducts, currentPage, pageSize]);

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
            <aside id="tour-search-filter" className="w-full md:w-64 space-y-8">
              <div>
                <h3 className="font-bold mb-4 uppercase text-[11px] tracking-widest text-[#64748b]">Search</h3>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-[#94a3b8]" />
                  <Input
                    className="pl-10 h-11 border-[#e2e8f0] text-[14px]"
                    placeholder="SKU, Name or Brand..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <h3 className="font-bold mb-4 uppercase text-[11px] tracking-widest text-[#64748b]">Categories</h3>
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#94a3b8]" />
                  <Input
                    className="pl-9 h-9 text-xs border-[#e2e8f0]"
                    placeholder="Search categories..."
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                  />
                </div>
                <div
                  className="space-y-2 max-h-[220px] overflow-y-auto pr-2 touch-pan-y scrollbar-thin scrollbar-thumb-zinc-200 scrollbar-track-transparent"
                  style={{ WebkitOverflowScrolling: "touch" }}
                >
                  {categories.filter(cat => cat.name.toLowerCase().includes(categorySearch.toLowerCase())).length === 0 ? (
                    <p className="text-xs text-zinc-400 font-medium py-2 italic">No categories found</p>
                  ) : (
                    categories
                      .filter(cat => cat.name.toLowerCase().includes(categorySearch.toLowerCase()))
                      .map((cat) => (
                        <label
                          key={cat.id}
                          className="flex items-center gap-2 cursor-pointer hover:text-[#0052cc] transition-colors py-1 group"
                        >
                          <input
                            type="checkbox"
                            checked={selectedCategoryIds.includes(cat.id)}
                            onChange={() => toggleCategory(cat.id)}
                            className="rounded border-[#cbd5e1] text-[#0052cc] focus:ring-[#0052cc] w-4 h-4 cursor-pointer"
                          />
                          <span className="text-[13px] font-medium text-[#475569] group-hover:text-[#1e293b] select-none">
                            {cat.name}
                          </span>
                        </label>
                      ))
                  )}
                </div>
              </div>
            </aside>

            {/* Products Grid */}
            <div id="tour-product-grid" className="flex-1">
              <div className="flex justify-between items-center mb-8 border-b border-[#f1f5f9] pb-4">
                <p className="text-[#64748b] text-[14px] font-medium">
                  Showing <span className="text-[#1e293b] font-bold">{filteredProducts.length}</span> parts available
                </p>
                <Button variant="ghost" className="text-[13px] font-bold text-[#64748b]">
                  <Filter className="mr-2 h-4 w-4" /> Sort by: Featured
                </Button>
              </div>

              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="h-80 bg-zinc-100 animate-pulse rounded-lg" />
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
                    totalItems={filteredProducts.length}
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
