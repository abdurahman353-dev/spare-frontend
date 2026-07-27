import type { Metadata } from "next";
import { getApiUrl } from "@/lib/axios";
import { getSiteUrl } from "@/lib/site-url";
import { ProductsClient, type Product, type Category, type Brand } from "./ProductsClient";

interface PageProps {
  searchParams: Promise<{
    page?: string;
    per_page?: string;
    search?: string;
    category_id?: string;
    brand_id?: string;
  }>;
}

async function getCategories(): Promise<Category[]> {
  const apiUrl = getApiUrl();
  const targetUrl = `${apiUrl}/categories`;
  console.log(`[RSC DEBUG] getCategories fetching from: ${targetUrl}`);
  try {
    const res = await fetch(targetUrl, {
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      console.error(`[RSC ERROR] getCategories failed with HTTP ${res.status}: ${res.statusText} at ${targetUrl}`);
      return [];
    }
    const data = await res.json();
    console.log(`[RSC SUCCESS] getCategories fetched ${Array.isArray(data) ? data.length : 0} items`);
    return data;
  } catch (err: any) {
    console.error(`[RSC EXCEPTION] getCategories failed at ${targetUrl}:`, err?.message || err);
    return [];
  }
}

async function getBrands(): Promise<Brand[]> {
  const apiUrl = getApiUrl();
  const targetUrl = `${apiUrl}/brands`;
  console.log(`[RSC DEBUG] getBrands fetching from: ${targetUrl}`);
  try {
    const res = await fetch(targetUrl, {
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      console.error(`[RSC ERROR] getBrands failed with HTTP ${res.status}: ${res.statusText} at ${targetUrl}`);
      return [];
    }
    const data = await res.json();
    console.log(`[RSC SUCCESS] getBrands fetched ${Array.isArray(data) ? data.length : 0} items`);
    return data;
  } catch (err: any) {
    console.error(`[RSC EXCEPTION] getBrands failed at ${targetUrl}:`, err?.message || err);
    return [];
  }
}

async function getProducts(params: {
  page?: string;
  per_page?: string;
  search?: string;
  category_id?: string;
  brand_id?: string;
}): Promise<{ data: Product[]; total: number }> {
  const apiUrl = getApiUrl();
  const urlParams = new URLSearchParams();
  if (params.page) urlParams.set("page", params.page);
  if (params.per_page) urlParams.set("per_page", params.per_page);
  if (params.search) urlParams.set("search", params.search);
  if (params.category_id) urlParams.set("category_id", params.category_id);
  if (params.brand_id) urlParams.set("brand_id", params.brand_id);

  const targetUrl = `${apiUrl}/products?${urlParams.toString()}`;
  console.log(`[RSC DEBUG] getProducts fetching from: ${targetUrl}`);

  try {
    const res = await fetch(targetUrl, {
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      console.error(`[RSC ERROR] getProducts failed with HTTP ${res.status}: ${res.statusText} at ${targetUrl}`);
      return { data: [], total: 0 };
    }
    const json = await res.json();
    const count = json.data ? json.data.length : (Array.isArray(json) ? json.length : 0);
    console.log(`[RSC SUCCESS] getProducts fetched ${count} products`);
    if (json.data && typeof json.total === "number") {
      return { data: json.data, total: json.total };
    }
    return {
      data: Array.isArray(json) ? json : [],
      total: Array.isArray(json) ? json.length : 0,
    };
  } catch (err: any) {
    console.error(`[RSC EXCEPTION] getProducts failed at ${targetUrl}:`, err?.message || err);
    return { data: [], total: 0 };
  }
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  console.log(`[RSC DEBUG] generateMetadata invoked for /products`);
  const params = await searchParams;
  const siteUrl = getSiteUrl();

  const categoryId = params.category_id ? Number(params.category_id) : undefined;
  const brandId = params.brand_id ? Number(params.brand_id) : undefined;
  const search = typeof params.search === "string" ? params.search.trim() : "";

  let title = "TEST-METADATA-WORKING - Parts Catalog";
  let description =
    "Browse our extensive inventory of genuine Mercedes-Benz spare parts with fast delivery across East Africa.";
  let canonical = `${siteUrl}/products`;

  const [categories, brands] = await Promise.all([
    categoryId ? getCategories() : Promise.resolve([]),
    brandId ? getBrands() : Promise.resolve([]),
  ]);

  const matchedCategory = categories.find((c) => c.id === categoryId);
  const matchedBrand = brands.find((b) => b.id === brandId);

  if (matchedCategory && matchedBrand) {
    title = `TEST-METADATA-WORKING - ${matchedCategory.name} — ${matchedBrand.name} Parts`;
    description = `Buy genuine ${matchedCategory.name} parts manufactured by ${matchedBrand.name}. Fast delivery across Kenya, Uganda, Tanzania, Rwanda, and Burundi.`;
    canonical = `${siteUrl}/products?category_id=${categoryId}&brand_id=${brandId}`;
  } else if (matchedCategory) {
    title = `TEST-METADATA-WORKING - ${matchedCategory.name} Parts`;
    description = `Explore our collection of genuine ${matchedCategory.name} parts for Mercedes-Benz and commercial vehicles. Fast shipping in East Africa.`;
    canonical = `${siteUrl}/products?category_id=${categoryId}`;
  } else if (matchedBrand) {
    title = `TEST-METADATA-WORKING - ${matchedBrand.name} Automotive Parts`;
    description = `Genuine and certified aftermarket ${matchedBrand.name} spare parts. Sourced directly for East Africa distribution.`;
    canonical = `${siteUrl}/products?brand_id=${brandId}`;
  } else if (search) {
    title = `TEST-METADATA-WORKING - Search results for "${search}"`;
    description = `Search results for "${search}" in AutoSpare East Africa parts catalog.`;
    canonical = `${siteUrl}/products`;
  }

  return {
    title,
    description,
    alternates: {
      canonical,
    },
  };
}

export default async function PublicProductsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  console.log(`[RSC DEBUG] PublicProductsPage rendering with params:`, JSON.stringify(params));

  const [categories, brands, productsData] = await Promise.all([
    getCategories(),
    getBrands(),
    getProducts(params),
  ]);

  return (
    <ProductsClient
      initialProducts={productsData.data}
      initialTotal={productsData.total}
      categories={categories}
      brands={brands}
      currentQueryParams={params}
    />
  );
}
