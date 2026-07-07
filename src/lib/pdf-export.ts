import type jsPDF from "jspdf";

export interface PdfCompanySettings {
  storeName?: string;
  storeTagline?: string;
  storeLogo?: string;
  physicalAddress?: string;
  contactEmail?: string;
  contactPhone?: string;
  currency?: string;
  storeWebsite?: string;
  storeKraPin?: string;
  storeRegNumber?: string;
  store_name?: string;
  store_tagline?: string;
  store_logo?: string;
  physical_address?: string;
  contact_email?: string;
  contact_phone?: string;
  store_website?: string;
  store_kra_pin?: string;
  store_reg_number?: string;
  store_address?: string;
  store_phone?: string;
  store_email?: string;
  [key: string]: any;
}

export function getImageFormat(base64: string): "JPEG" | "PNG" | "WEBP" {
  if (base64.startsWith("data:image/png")) return "PNG";
  if (base64.startsWith("data:image/webp")) return "WEBP";
  return "JPEG";
}

export const loadImgAsBase64 = (url: string): Promise<string> => {
  return new Promise((resolve) => {
    if (!url) {
      resolve("");
      return;
    }
    if (url.startsWith("data:image/")) {
      resolve(url);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL("image/png"));
          return;
        }
      } catch (e) {
        console.error("Canvas conversion error", e);
      }
      resolve("");
    };
    img.onerror = () => resolve("");
    img.src = url;
  });
};

export const drawBrandedHeader = async (
  doc: jsPDF,
  companySettings: PdfCompanySettings
) => {
  const legalName  = companySettings?.storeName  || companySettings?.store_name  || "";
  const tagline    = companySettings?.storeTagline || companySettings?.store_tagline || "";
  const addressLine = companySettings?.storeAddress || companySettings?.physicalAddress || companySettings?.physical_address || companySettings?.store_address || "";
  const telNo      = companySettings?.storePhone   || companySettings?.contactPhone || companySettings?.contact_phone || companySettings?.store_phone || "";
  const emailAddr  = companySettings?.storeEmail   || companySettings?.contactEmail || companySettings?.contact_email || companySettings?.store_email || "";
  const websiteUrl = companySettings?.storeWebsite || companySettings?.store_website || "";
  const kraPin     = companySettings?.storeKraPin  || companySettings?.store_kra_pin || "";
  const businessReg = companySettings?.storeRegNumber || companySettings?.store_reg_number || "";
  const logoUrl    = companySettings?.storeLogo    || companySettings?.store_logo || "";

  const pageWidth = doc.internal.pageSize.width;
  const marginL = 14;
  const marginR = 14;
  const rightEdge = pageWidth - marginR;

  // 1. Draw Logo
  let leftX = 14;
  if (logoUrl) {
    const base64 = await loadImgAsBase64(logoUrl);
    if (base64) {
      try {
        const logoSize = 18;
        doc.addImage(base64, getImageFormat(base64), 14, 8, logoSize, logoSize);
        leftX = 14 + logoSize + 4;
      } catch (e) {
        console.error("Failed to render logo", e);
        drawFallbackLogo(doc);
        leftX = 35;
      }
    } else {
      drawFallbackLogo(doc);
      leftX = 35;
    }
  } else {
    drawFallbackLogo(doc);
    leftX = 35;
  }

  // 2. Draw Business Name and Tagline
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5);
  doc.setTextColor(0, 82, 204);
  
  // Wrap business name if it is too long (limit to 75mm width)
  const nameLines = doc.splitTextToSize(legalName, 75);
  doc.text(nameLines, leftX, 13);
  
  const nextY = 13 + (nameLines.length * 4.5);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(120, 120, 120);
  doc.text(tagline, leftX, nextY);

  // 3. Draw Stacked Contact Details on the right
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(100, 100, 100);
  
  let contactY = 11;
  doc.text(`Tel: ${telNo}`, rightEdge, contactY, { align: "right" });
  contactY += 4.2;
  doc.text(`Email: ${emailAddr}`, rightEdge, contactY, { align: "right" });
  
  if (websiteUrl || kraPin) {
    contactY += 4.2;
    doc.text(`${websiteUrl ? `Web: ${websiteUrl}` : ""}${kraPin ? `  |  PIN: ${kraPin}` : ""}`, rightEdge, contactY, { align: "right" });
  }
  if (businessReg || addressLine) {
    contactY += 4.2;
    doc.text(`${businessReg ? `Reg: ${businessReg}  |  ` : ""}Addr: ${addressLine}`, rightEdge, contactY, { align: "right" });
  }

  // Draw separator line at Y = 32
  doc.setDrawColor(220, 220, 220).setLineWidth(0.5);
  doc.line(marginL, 32, rightEdge, 32);
};

const drawFallbackLogo = (doc: jsPDF) => {
  // Left blue accent bar
  doc.setFillColor(0, 82, 204);
  doc.rect(14, 8, 3, 20, "F");

  // Abstract logo block
  doc.setFillColor(0, 82, 204);
  doc.roundedRect(21, 8, 10, 10, 2, 2, "F");
  doc.setFillColor(255, 255, 255);
  doc.triangle(26, 10, 24, 13, 28, 13, "F");
  doc.triangle(26, 16, 24, 13, 28, 13, "F");
};


/** Standard A4 print margins (mm) — fits home/office printers with safe area */
const A4_PRINT_MARGINS = { top: 12, right: 10, bottom: 14, left: 10 };

function getPrintableWidth(doc: jsPDF): number {
  return doc.internal.pageSize.width - A4_PRINT_MARGINS.left - A4_PRINT_MARGINS.right;
}

function drawWrappedValue(
  doc: jsPDF,
  x: number,
  y: number,
  value: string,
  maxWidth: number,
  lineHeight = 4.2
): number {
  const lines = doc.splitTextToSize(String(value || "N/A"), maxWidth);
  doc.text(lines, x, y);
  return Math.max(1, lines.length) * lineHeight;
}

// Helper to add header with optional logo
const addHeader = (
  doc: jsPDF,
  title: string,
  subtitle: string,
  storeName: string = "",
  logoBase64?: string
) => {
  let xOffset = 14;

  // Add circular-clipped logo if provided
  if (logoBase64) {
    try {
      // Draw a white circle background first
      const logoSize = 18;
      const logoX = 14;
      const logoY = 8;
      // Add the image (jsPDF doesn't support clip paths natively, so we use a square that looks circular via border)
      doc.addImage(logoBase64, getImageFormat(logoBase64), logoX, logoY, logoSize, logoSize);
      xOffset = 14 + logoSize + 4;
    } catch (e) {
      // Logo load failed, continue without it
      xOffset = 14;
    }
  }

  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59); // Slate-800
  doc.text(storeName.toUpperCase(), xOffset, 16);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139); // Slate-500
  doc.text(subtitle, xOffset, 21);
  doc.text(`Generated: ${new Date().toLocaleString()}`, xOffset, 26);

  // Draw separator line
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.setLineWidth(0.5);
  doc.line(14, 32, doc.internal.pageSize.width - 14, 32);
};

const addCompanyManifestHeader = (
  doc: jsPDF,
  documentTitle: string,
  company: PdfCompanySettings
) => {
  const storeName = company.storeName || "";
  const pageWidth = doc.internal.pageSize.width;
  let leftX = 14;

  if (company.storeLogo) {
    try {
      const logoSize = 22;
      doc.addImage(
        company.storeLogo,
        getImageFormat(company.storeLogo),
        14,
        8,
        logoSize,
        logoSize
      );
      leftX = 14 + logoSize + 5;
    } catch {
      leftX = 14;
    }
  }

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text(storeName.toUpperCase(), leftX, 16);

  if (company.storeTagline) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(company.storeTagline, leftX, 21);
  }

  const contactLines: string[] = [];
  if (company.physicalAddress) contactLines.push(company.physicalAddress);
  if (company.contactPhone) contactLines.push(`Tel: ${company.contactPhone}`);
  if (company.contactEmail) contactLines.push(company.contactEmail);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  contactLines.forEach((line, i) => {
    const wrapped = doc.splitTextToSize(line, 70);
    doc.text(wrapped, pageWidth - A4_PRINT_MARGINS.right, 12 + i * 4.5, { align: "right" });
  });

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 82, 204);
  doc.text(documentTitle, 14, 34);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 39);

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(A4_PRINT_MARGINS.left, 42, pageWidth - A4_PRINT_MARGINS.right, 42);

  return 46;
};

// Helper to add footer to pages
const addFooter = (doc: jsPDF, data: any, storeName: string = "") => {
  const str = `Page ${doc.getNumberOfPages()}`;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184); // Slate-400
  doc.text(
    str,
    data.settings.margin.left,
    doc.internal.pageSize.height - 10
  );
  doc.text(
    `© ${new Date().getFullYear()} ${storeName}. All rights reserved.`,
    doc.internal.pageSize.width - data.settings.margin.right - 75,
    doc.internal.pageSize.height - 10
  );
};

// 1. Export Products PDF
export const exportProductsPDF = async (
  products: any[],
  currency: string = "Ksh",
  logoBase64?: string,
  storeName?: string
) => {
  const { default: jsPDFClass } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDFClass({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const name = storeName || "";
  addHeader(doc, name, "Genuine Parts Catalog Report", name, logoBase64);

  const tableColumn = ["SKU", "Part No", "Part Name", "Suitable Vehicle", "Engine", "Brand", "Unit Price"];
  const tableRows = products.map((p) => [
    p.sku || "N/A",
    p.part_number || "—",
    p.name || "N/A",
    p.suitable_vehicle || "—",
    p.engine_model || "—",
    p.brand?.name || "N/A",
    `${currency} ${Number(p.price).toLocaleString()}`,
  ]);

  autoTable(doc, {
    head: [tableColumn],
    body: tableRows,
    startY: 37,
    theme: "striped",
    headStyles: {
      fillColor: [0, 82, 204], // AutoSpare Primary Blue
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [51, 65, 85], // Slate-700
    },
    columnStyles: {
      0: { cellWidth: 22 }, // SKU
      1: { cellWidth: 24 }, // Part No
      2: { cellWidth: 42, overflow: "linebreak" }, // Part Name
      3: { cellWidth: 32, overflow: "linebreak" }, // Suitable Vehicle
      4: { cellWidth: 20 }, // Engine Model
      5: { cellWidth: 22 }, // Brand
      6: { cellWidth: 20, halign: "right" } // Unit Price
    },
    margin: { top: 37, left: 14, right: 14 },
    didDrawPage: (data: any) => addFooter(doc, data, name),
  });

  doc.save(`products_report_${new Date().toISOString().split("T")[0]}.pdf`);
};

// 2. Export Inventory PDF
export const exportInventoryPDF = async (
  inventory: any[],
  currency: string = "Ksh",
  logoBase64?: string,
  storeName?: string
) => {
  const { default: jsPDFClass } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDFClass({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const name = storeName || "";
  addHeader(doc, name, "Inventory Stock Balance & Warehouse Distribution Report", name, logoBase64);

  const tableColumn = ["SKU", "Part No", "Product Name", "Brand", "Suitable Vehicle", "Engine", "Warehouse Location", "Quantity", "Min Stock", "Status"];

  const getStatus = (item: any) => {
    if (item.warehouse_id === null) return "Unassigned";
    if (item.quantity <= 0) return "Out of Stock";
    if (item.quantity <= item.min_stock) return "Low Stock";
    return "In Stock";
  };

  const tableRows = inventory.map((item) => [
    item.product?.sku || "N/A",
    item.product?.part_number || "—",
    item.product?.name || "N/A",
    item.product?.brand?.name || "N/A",
    item.product?.suitable_vehicle || "—",
    item.product?.engine_model || "—",
    item.warehouse?.name || "Pending Assignment",
    `${item.quantity} PCS`,
    `${item.min_stock || 5} PCS`,
    getStatus(item),
  ]);

  autoTable(doc, {
    head: [tableColumn],
    body: tableRows,
    startY: 37,
    theme: "striped",
    headStyles: {
      fillColor: [13, 148, 136], // Emerald/Teal Theme
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [51, 65, 85],
    },
    margin: { top: 37, left: 14, right: 14 },
    didDrawPage: (data: any) => addFooter(doc, data, name),
  });

  doc.save(`inventory_report_${new Date().toISOString().split("T")[0]}.pdf`);
};

// 3. Export Orders PDF
export const exportOrdersPDF = async (
  rawOrders: any[],
  currency: string = "Ksh",
  logoBase64?: string,
  storeName?: string,
  isWalkIn: boolean = false,
  companySettings?: {
    tagline?: string;
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
    kraPin?: string;
    regNumber?: string;
    branch?: string;
  },
  isFilterActive: boolean = false
) => {
  // When a specific pay-status filter is active, export the pre-filtered list as-is.
  // When showing "All" (default), only include Paid orders for Walk-In; exclude
  // Cancelled/Refunded for both Walk-In and Shipment.
  const orders = isFilterActive
    ? rawOrders
    : rawOrders.filter((o) => {
        const isCancelled =
          o.status?.toLowerCase() === "cancelled" ||
          o.payment_status?.toLowerCase() === "refunded" ||
          o.payment_status?.toLowerCase() === "cancelled / refunded";
        if (isCancelled) return false;
        if (isWalkIn) {
          const isPending =
            o.payment_status?.toLowerCase() === "pending" ||
            o.status?.toLowerCase() === "pending";
          if (isPending) return false;
        }
        return true;
      });

  const { default: jsPDFClass } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDFClass({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth  = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const marginL = 14;
  const marginR = 14;

  const legalName    = storeName || "";
  const tagline      = companySettings?.tagline  || "";
  const addressLine  = companySettings?.address  || "";
  const telNo        = companySettings?.phone    || "";
  const emailAddr    = companySettings?.email    || "";
  const websiteUrl   = companySettings?.website  || "";
  const kraPin       = companySettings?.kraPin   || "";
  const businessReg  = companySettings?.regNumber || "";
  const activeBranch = companySettings?.branch   || "";
  const reportType   = isWalkIn ? "WALK-IN POS" : "SHIPMENT";

  const settingsObj: PdfCompanySettings = {
    storeName: legalName,
    storeTagline: tagline,
    storeAddress: addressLine,
    storePhone: telNo,
    storeEmail: emailAddr,
    storeWebsite: websiteUrl,
    storeKraPin: kraPin,
    storeRegNumber: businessReg,
    storeLogo: logoBase64
  };
  await drawBrandedHeader(doc, settingsObj);

  // ── 2. REPORT INFO BLOCK ───────────────────────────────────────────────────
  const infoY = 36;
  const infoW = pageWidth - marginL - marginR;
  const dateStamp = new Date().toISOString().slice(0, 7).replace("-", "");
  const randomSeq = Math.floor(100 + Math.random() * 900);
  const docId = `${reportType.replace(/\s+/g, "-")}-${dateStamp}-${randomSeq}`;

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(marginL, infoY, infoW, 22, 2, 2, "F");

  doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(30, 41, 59);
  doc.text("Report ID:",       marginL + 6, infoY + 7);
  doc.text("Generated On:",    marginL + 6, infoY + 13);
  doc.text("Report Type:",     marginL + 6, infoY + 19);

  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(30, 41, 59);
  doc.text(docId,                                         marginL + 32, infoY + 7);
  doc.text(new Date().toLocaleString("en-KE", { hour12: false }), marginL + 32, infoY + 13);
  doc.text(`${reportType} ORDERS REPORT`,                 marginL + 32, infoY + 19);

  // Right column of info block
  doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(30, 41, 59);
  doc.text("Branch:",   marginL + infoW * 0.55, infoY + 7);
  doc.text("Currency:", marginL + infoW * 0.55, infoY + 13);
  doc.text("Records:",  marginL + infoW * 0.55, infoY + 19);

  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(30, 41, 59);
  doc.text(activeBranch,       marginL + infoW * 0.55 + 22, infoY + 7);
  doc.text(`${currency} (Kenyan Shilling)`, marginL + infoW * 0.55 + 22, infoY + 13);
  doc.text(`${orders.length} order(s)`,     marginL + infoW * 0.55 + 22, infoY + 19);

  // ── 3. SUMMARY STATS CARD ──────────────────────────────────────────────────
  const statsY = infoY + 26;
  const getActiveItems = (o: any) => (o.items || []).filter((item: any) => item.cancellation_status?.toLowerCase() !== "cancelled");

  const totalGross = orders.reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const totalFees  = orders.reduce((s, o) => s + Number(o.shipping_fee  || 0), 0);
  const totalItems = orders.reduce((s, o) => s + getActiveItems(o).length, 0);
  const totalUnits = orders.reduce((s, o) => s + getActiveItems(o).reduce((sum: number, item: any) => sum + (item.quantity || 0), 0), 0);

  doc.setFillColor(239, 246, 255);
  doc.roundedRect(marginL, statsY, infoW, 14, 2, 2, "F");
  doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(30, 41, 59);
  doc.text(`Total Orders: ${orders.length}`,                                    marginL + 6,            statsY + 9);
  doc.text(`Total Items: ${totalItems} (${totalUnits} Unit${totalUnits !== 1 ? 's' : ''})`, marginL + infoW * 0.25, statsY + 9);
  doc.text(`Shipping Fees: ${currency} ${totalFees.toLocaleString()}`,           marginL + infoW * 0.50, statsY + 9);
  doc.text(`Gross Revenue: ${currency} ${totalGross.toLocaleString()}`,          marginL + infoW * 0.75, statsY + 9);

  // ── 4. ORDERS TABLE ────────────────────────────────────────────────────────
  const tableStartY = statsY + 18;

  const tableColumn = [
    "Order Ref",
    "Customer / Phone",
    "Products",
    "Part No",
    "Engine",
    "Suitable",
    "Items / Units",
    "Origin Warehouse",
    isWalkIn ? "Destination / Address" : "Destination",
    "Date",
    "Subtotal",
    "Shipping",
    "Grand Total",
    "Pay Status",
    "Dispatch Status",
  ];

  const tableRows = orders.map((o) => {
    const activeItems = getActiveItems(o);
    const productNames = activeItems
      .map((item: any) => {
        const qty = item.quantity || 1;
        const partNo = item.product?.part_number ? ` [${item.product.part_number}]` : "";
        return `${item.product?.name || "—"}${partNo} (Qty: ${qty})`;
      })
      .filter(Boolean)
      .join(", ") || "—";

    const partNumbers = activeItems
      .map((item: any) => item.product?.part_number || "—")
      .filter(Boolean)
      .join(", ") || "—";

    const engines = activeItems
      .map((item: any) => item.product?.engine_model || "—")
      .filter(Boolean)
      .join(", ") || "—";

    const suitableVehicles = activeItems
      .map((item: any) => item.product?.suitable_vehicle || "—")
      .filter(Boolean)
      .join(", ") || "—";

    const itemsCount = activeItems.length;
    const unitsCount = activeItems.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
    const itemsUnitsDisplay = `${itemsCount} Item${itemsCount !== 1 ? 's' : ''} (${unitsCount} Unit${unitsCount !== 1 ? 's' : ''})`;

    const customerPhone = o.customer?.phone || "";
    const customerName = o.customer?.name || "";
    const cleanPhone = customerPhone.replace(/\s+/g, "");
    const isMockOrWalkIn = customerName.toLowerCase().includes("walk-in") || 
                           customerName.toLowerCase().includes("guest") ||
                           cleanPhone === "0700000000" || 
                           cleanPhone === "+254700000000" || 
                           cleanPhone === "254700000000" ||
                           cleanPhone.includes("700000000");
    const customerDisplay = isMockOrWalkIn || !customerPhone
      ? (customerName || "Walk-In Guest")
      : `${customerName}\n${customerPhone}`;

    const destDisplay = isWalkIn
      ? (o.shipping_method === "Pickup"
          ? "In-Store · Walk-In Counter"
          : `${o.shipping_city || ""} · ${o.shipping_address || ""}`.trim().replace(/^ · | · $/g, "") || "—")
      : (o.shipping_city
          ? (o.shipping_country ? `${o.shipping_city}, ${o.shipping_country}` : o.shipping_city)
          : "In-Store Collection");

    return [
      o.tracking_number || `ORD-${o.id}`,
      customerDisplay,
      productNames,
      partNumbers,
      engines,
      suitableVehicles,
      itemsUnitsDisplay,
      activeItems[0]?.warehouse?.name || "N/A",
      destDisplay,
      new Date(o.created_at).toLocaleDateString("en-KE"),
      `${currency} ${Math.max(0, parseFloat(o.total_amount || 0) - parseFloat(o.shipping_fee || 0)).toLocaleString()}`,
      `${currency} ${parseFloat(o.shipping_fee || 0).toLocaleString()}`,
      `${currency} ${parseFloat(o.total_amount || 0).toLocaleString()}`,
      o.payment_status || "Pending",
      o.status || "Pending",
    ];
  });

  // Totals footer row
  tableRows.push([
    "TOTALS",
    `${orders.length} order(s)`,
    "",
    "",
    "",
    "",
    `${totalItems} item(s) (${totalUnits} unit${totalUnits !== 1 ? 's' : ''})`,
    "",
    "",
    "",
    `${currency} ${Math.max(0, totalGross - totalFees).toLocaleString()}`,
    `${currency} ${totalFees.toLocaleString()}`,
    `${currency} ${totalGross.toLocaleString()}`,
    "",
    "",
  ]);

  const w = pageWidth - marginL - marginR;

  autoTable(doc, {
    head: [tableColumn],
    body: tableRows,
    startY: tableStartY,
    theme: "grid",
    headStyles: {
      fillColor: [0, 82, 204],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7.5,
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [51, 65, 85],
      overflow: "linebreak",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0:  { cellWidth: w * 0.07, fontStyle: "bold" },
      1:  { cellWidth: w * 0.07, overflow: "linebreak" },
      2:  { cellWidth: w * 0.11, overflow: "linebreak" },
      3:  { cellWidth: w * 0.07, overflow: "linebreak" },
      4:  { cellWidth: w * 0.05, overflow: "linebreak" },
      5:  { cellWidth: w * 0.07, overflow: "linebreak" },
      6:  { cellWidth: w * 0.07, overflow: "linebreak" },
      7:  { cellWidth: w * 0.07, overflow: "linebreak" },
      8:  { cellWidth: w * 0.07, overflow: "linebreak" },
      9:  { cellWidth: w * 0.05, halign: "center" },
      10: { cellWidth: w * 0.07, halign: "right" },
      11: { cellWidth: w * 0.05, halign: "right" },
      12: { cellWidth: w * 0.07, halign: "right", fontStyle: "bold" },
      13: { cellWidth: w * 0.06, halign: "center" },
      14: { cellWidth: w * 0.05, halign: "center" },
    },
    margin: { top: 37, left: marginL, right: marginR },
    didParseCell: (data: any) => {
      // Bold + highlight totals row
      if (data.row.index === tableRows.length - 1) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [241, 245, 249];
        data.cell.styles.textColor = [15, 23, 42];
      }
    },
    didDrawPage: (data: any) => {
      // Page footer
      const pageStr = `Page ${doc.getNumberOfPages()}`;
      doc.setFontSize(7.5).setFont("helvetica", "bold").setTextColor(148, 163, 184);
      doc.text("This report is system-generated and confidential.", marginL, pageHeight - 8);
      doc.setFont("helvetica", "normal");
      doc.text(pageStr, pageWidth - marginR, pageHeight - 8, { align: "right" });

      // Bottom rule
      doc.setDrawColor(220, 220, 220).setLineWidth(0.3);
      doc.line(marginL, pageHeight - 12, pageWidth - marginR, pageHeight - 12);
    },
  });

  // ── 5. SIGNATURE BLOCK ─────────────────────────────────────────────────────
  const finalY: number = (doc as any).lastAutoTable?.finalY ?? tableStartY + 40;
  let sigY = finalY + 14;
  if (sigY + 30 > pageHeight - 20) {
    doc.addPage();
    sigY = 25;
  }

  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(30, 41, 59);
  doc.text("Prepared By: __________________", marginL, sigY);
  doc.text("Reviewed By: __________________", pageWidth / 3 + 8, sigY);
  doc.text("Approved By: __________________", (pageWidth / 3) * 2 + 2, sigY);

  const _today = new Date().toISOString().split("T")[0];
  doc.save(`${isWalkIn ? "walkin" : "shipment"}_orders_report_${_today}.pdf`);
};

// 4. Export Waybill / Shipment Products Manifest PDF
export const exportWaybillManifestPDF = async (
  shipment: any,
  company: PdfCompanySettings = {}
) => {
  const { default: jsPDFClass } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDFClass({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const marginL = 14;
  const marginR = 14;
  const rightEdge = pageWidth - marginR;
  const printableWidth = pageWidth - marginL - marginR;

  const legalName = company.storeName || company.store_name || "";
  const tagline = company.storeTagline || company.store_tagline || "";
  const addressLine = company.store_address || company.physicalAddress || company.physical_address || "";
  const telNo = company.store_phone || company.contactPhone || company.contact_phone || "";
  const emailAddr = company.store_email || company.contactEmail || company.contact_email || "";
  const websiteUrl = company.storeWebsite || company.store_website || "";
  const kraPin = company.storeKraPin || company.store_kra_pin || "";
  const businessReg = company.storeRegNumber || company.store_reg_number || "";
  const currency = company.currency || "Ksh";

  const shippedDate = shipment.shipped_at
    ? new Date(shipment.shipped_at).toLocaleDateString()
    : shipment.created_at
      ? new Date(shipment.created_at).toLocaleDateString()
      : "N/A";

  const orders = shipment.orders || [];
  const orderCount = orders.length;

  // ── 1. BRANDED LETTERHEAD ──────────────────────────────────────────────────
  await drawBrandedHeader(doc, company);

  // ── 2. REPORT INFO BLOCK ───────────────────────────────────────────────────
  const infoY = 36;
  const infoW = printableWidth;

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(marginL, infoY, infoW, 22, 2, 2, "F");

  doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(30, 41, 59);
  doc.text("Report ID:",       marginL + 6, infoY + 7);
  doc.text("Generated On:",    marginL + 6, infoY + 13);
  doc.text("Report Type:",     marginL + 6, infoY + 19);

  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(30, 41, 59);
  doc.text(`WAYBILL-MANIFEST-${shipment.waybill || "N/A"}`, marginL + 32, infoY + 7);
  doc.text(new Date().toLocaleString("en-KE", { hour12: false }), marginL + 32, infoY + 13);
  doc.text("WAYBILL PRODUCTS MANIFEST", marginL + 32, infoY + 19);

  // Right column of info block
  doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(30, 41, 59);
  doc.text("Origin Warehouse:",   marginL + infoW * 0.52, infoY + 7);
  doc.text("Destination Hub:",    marginL + infoW * 0.52, infoY + 13);
  doc.text("Shipped Date:",       marginL + infoW * 0.52, infoY + 19);

  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(30, 41, 59);
  doc.text(shipment.origin || "N/A",       marginL + infoW * 0.52 + 32, infoY + 7);
  doc.text(shipment.destination || "N/A",  marginL + infoW * 0.52 + 32, infoY + 13);
  doc.text(shippedDate,                    marginL + infoW * 0.52 + 32, infoY + 19);

  const getActiveItems = (o: any) => (o.items || []).filter((item: any) => item.cancellation_status?.toLowerCase() !== "cancelled");

  // Calculate totals
  const totalItems = orders.reduce((s: number, o: any) => s + getActiveItems(o).length, 0);
  const totalUnits = orders.reduce((s: number, o: any) =>
    s + getActiveItems(o).reduce((us: number, i: any) => us + (i.quantity || 0), 0), 0);

  const shipmentProductSubtotal = orders.reduce((sum: number, order: any) => {
    const itemsTotal = getActiveItems(order).reduce(
      (itemSum: number, item: any) =>
        itemSum + (Number(item.quantity) || 0) * parseFloat(item.price ?? item.product?.price ?? 0),
      0
    );
    return sum + itemsTotal;
  }, 0);

  const shipmentShippingTotal = orders.reduce(
    (sum: number, order: any) => sum + parseFloat(order.shipping_fee || 0),
    0
  );

  const shipmentGrandTotal = orders.reduce(
    (sum: number, order: any) => sum + parseFloat(order.total_amount || 0),
    0
  );

  // ── 3. SUMMARY STATS CARD ──────────────────────────────────────────────────
  const statsY = infoY + 26;
  const fmt = (amount: number) => `${currency} ${amount.toLocaleString()}`;

  doc.setFillColor(239, 246, 255);
  doc.roundedRect(marginL, statsY, infoW, 14, 2, 2, "F");
  doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(30, 41, 59);
  doc.text(`Total Orders: ${orderCount}`,                                    marginL + 6,            statsY + 9);
  doc.text(`Total Items: ${totalItems} (${totalUnits} Unit${totalUnits !== 1 ? 's' : ''})`, marginL + infoW * 0.25, statsY + 9);
  doc.text(`Shipping Fees: ${fmt(shipmentShippingTotal)}`,                   marginL + infoW * 0.50, statsY + 9);
  doc.text(`Gross Revenue: ${fmt(shipmentGrandTotal)}`,                      marginL + infoW * 0.75, statsY + 9);

  // ── 4. TABLE: one row per ORDER ────────────────────────────────────────────
  const tableStartY = statsY + 18;

  const tableColumn = [
    "Order Ref",
    "Customer / Phone",
    "Products",
    "Part No",
    "Engine",
    "Suitable",
    "Items / Units",
    "Subtotal",
    "Shipping",
    "Grand Total",
    "Ship Method",
    "Order Status",
    "Payment",
    "Pay Method",
  ];

  // Build one row per ORDER (not per item)
  const tableRows = orders.map((order: any) => {
    const orderRef = order.tracking_number || `ORD-${order.id}`;
    const customerName = order.customer?.name || "Guest";
    const customerPhone = order.customer?.phone || "";
    const customerDisplay = customerPhone ? `${customerName}\n${customerPhone}` : customerName;

    const items = getActiveItems(order);
    const productNames = items
      .map((item: any) => {
        const qty = item.quantity || 1;
        const partNo = item.product?.part_number ? ` [${item.product.part_number}]` : "";
        return `${item.product?.name || "—"}${partNo} (Qty: ${qty})`;
      })
      .join(", ") || "—";

    const partNumbers = items
      .map((item: any) => item.product?.part_number || "—")
      .join(", ") || "—";

    const engines = items
      .map((item: any) => item.product?.engine_model || "—")
      .join(", ") || "—";

    const suitableVehicles = items
      .map((item: any) => item.product?.suitable_vehicle || "—")
      .join(", ") || "—";

    const itemsCount = items.length;
    const unitsCount = items.reduce((s: number, i: any) => s + (i.quantity || 0), 0);
    const itemsUnitsDisplay = `${itemsCount} Item${itemsCount !== 1 ? "s" : ""} (${unitsCount} Unit${unitsCount !== 1 ? "s" : ""})`;

    const subtotal = items.reduce(
      (s: number, i: any) => s + (Number(i.quantity) || 0) * parseFloat(i.price ?? i.product?.price ?? 0),
      0
    );
    const shippingFee = parseFloat(order.shipping_fee || 0);
    const grandTotal = parseFloat(order.total_amount || 0);
    const shippingMethod = order.shipping_method || "N/A";
    const orderStatus = order.status || "N/A";
    const paymentStatus = order.payment_status || "N/A";
    const paymentMethod = order.payment_method || "N/A";

    return [
      orderRef,
      customerDisplay,
      productNames,
      partNumbers,
      engines,
      suitableVehicles,
      itemsUnitsDisplay,
      fmt(subtotal),
      fmt(shippingFee),
      fmt(grandTotal),
      shippingMethod,
      orderStatus,
      paymentStatus,
      paymentMethod,
    ];
  });

  if (tableRows.length === 0) {
    tableRows.push([
      "—", "—", "No products assigned to this shipment", "—", "—", "—", "—",
      fmt(0), fmt(0), fmt(0), "—", "—", "—", "—",
    ]);
  }

  // Totals footer row
  tableRows.push([
    "SHIPMENT TOTALS",
    `${orderCount} order(s)`,
    "",
    "",
    "",
    "",
    `${totalItems} item(s) (${totalUnits} unit${totalUnits !== 1 ? "s" : ""})`,
    fmt(shipmentProductSubtotal),
    fmt(shipmentShippingTotal),
    fmt(shipmentGrandTotal),
    "",
    "",
    "",
    "",
  ]);

  const col = {
    orderRef:    printableWidth * 0.07,
    customer:    printableWidth * 0.08,
    products:    printableWidth * 0.13,
    partNo:      printableWidth * 0.07,
    engine:      printableWidth * 0.05,
    suitable:    printableWidth * 0.07,
    itemsUnits:  printableWidth * 0.07,
    subtotal:    printableWidth * 0.07,
    shipping:    printableWidth * 0.06,
    grandTotal:  printableWidth * 0.08,
    shipMethod:  printableWidth * 0.07,
    orderStatus: printableWidth * 0.06,
    payment:     printableWidth * 0.06,
    payMethod:   printableWidth * 0.06,
  };

  autoTable(doc, {
    head: [tableColumn],
    body: tableRows,
    startY: tableStartY,
    tableWidth: printableWidth,
    showHead: "everyPage",
    horizontalPageBreak: false,
    theme: "grid",
    headStyles: {
      fillColor: [0, 82, 204],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7,
      overflow: "linebreak",
      halign: "center",
    },
    styles: {
      fontSize: 7,
      cellPadding: 1.8,
      overflow: "linebreak",
      valign: "middle",
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [51, 65, 85],
      overflow: "linebreak",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0:  { cellWidth: col.orderRef,    fontStyle: "bold" },
      1:  { cellWidth: col.customer,    overflow: "linebreak" },
      2:  { cellWidth: col.products,    overflow: "linebreak" },
      3:  { cellWidth: col.itemsUnits,  overflow: "linebreak" },
      4:  { cellWidth: col.subtotal,    halign: "right" },
      5:  { cellWidth: col.shipping,    halign: "right" },
      6:  { cellWidth: col.grandTotal,  halign: "right", fontStyle: "bold" },
      7:  { cellWidth: col.shipMethod,  halign: "center", overflow: "linebreak" },
      8:  { cellWidth: col.orderStatus, halign: "center" },
      9:  { cellWidth: col.payment,     halign: "center" },
      10: { cellWidth: col.payMethod,   halign: "center" },
    },
    margin: { top: 37, right: marginR, bottom: 14, left: marginL },
    didParseCell: (data: any) => {
      if (data.row.index === tableRows.length - 1) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [241, 245, 249];
        data.cell.styles.textColor = [15, 23, 42];
      }
    },
    didDrawPage: (data: any) => {
      // Page footer
      const pageStr = `Page ${doc.getNumberOfPages()}`;
      doc.setFontSize(7.5).setFont("helvetica", "bold").setTextColor(148, 163, 184);
      doc.text("This report is system-generated and confidential.", marginL, pageHeight - 8);
      doc.setFont("helvetica", "normal");
      doc.text(pageStr, pageWidth - marginR, pageHeight - 8, { align: "right" });

      // Bottom rule
      doc.setDrawColor(220, 220, 220).setLineWidth(0.3);
      doc.line(marginL, pageHeight - 12, pageWidth - marginR, pageHeight - 12);
    },
  });

  // ── 5. SIGNATURE BLOCK ─────────────────────────────────────────────────────
  const finalY: number = (doc as any).lastAutoTable?.finalY ?? tableStartY + 40;
  let sigY = finalY + 14;
  if (sigY + 30 > pageHeight - 20) {
    doc.addPage();
    sigY = 25;
  }

  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(30, 41, 59);
  doc.text("Prepared By: __________________", marginL, sigY);
  doc.text("Reviewed By: __________________", pageWidth / 3 + 8, sigY);
  doc.text("Approved By: __________________", (pageWidth / 3) * 2 + 2, sigY);

  doc.save(`waybill-manifest-${shipment.waybill || "shipment"}.pdf`);
};


export const exportCustomerStatementPDF = async (
  customer: any,
  company: PdfCompanySettings
) => {
  const { default: jsPDFClass } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDFClass({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const currency = company.currency || "Ksh";
  const storeName = company.storeName || company.store_name || "";
  const tagline = company.storeTagline || company.store_tagline || "";
  const addressLine = company.store_address || company.physicalAddress || company.physical_address || "";
  const telNo = company.store_phone || company.contactPhone || company.contact_phone || "";
  const emailAddr = company.store_email || company.contactEmail || company.contact_email || "";
  const websiteUrl = company.storeWebsite || company.store_website || "";
  const kraPin = company.storeKraPin || company.store_kra_pin || "";
  const businessReg = company.storeRegNumber || company.store_reg_number || "";

  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const marginL = 14;
  const marginR = 14;
  const rightEdge = pageWidth - marginR;
  const printableWidth = pageWidth - marginL - marginR;

  // ── 1. BRANDED LETTERHEAD ──────────────────────────────────────────────────
  await drawBrandedHeader(doc, company);

  let currentY = 36;

  const rawOrders = customer.orders || [];
  const orders = rawOrders.filter((o: any) => {
    const isCancelled = o.status?.toLowerCase() === "cancelled" || o.payment_status?.toLowerCase() === "refunded" || o.payment_status?.toLowerCase() === "cancelled / refunded";
    if (isCancelled) return false;
    const isWalkIn = (o.tracking_number || "").startsWith("WK-");
    if (isWalkIn) {
      const isPending = o.payment_status?.toLowerCase() === "pending" || o.status?.toLowerCase() === "pending";
      if (isPending) return false;
    }
    return true;
  });
  const ltv = orders.reduce((sum: number, o: any) => sum + parseFloat(o.total_amount || 0), 0);
  const totalOrdersCount = orders.length;
  const totalFulfillmentFeesPaid = orders.reduce((sum: number, o: any) => sum + parseFloat(o.shipping_fee || 0), 0);

  // ── 2. DOCUMENT TITLE ──────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(0, 82, 204);
  doc.text("OFFICIAL B2B ACCOUNT STATEMENT", marginL, currentY);
  
  doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(100, 100, 100);
  doc.text(`Statement Period: All-Time History`, marginL, currentY + 4.5);
  doc.text(`Generated On: ${new Date().toLocaleString("en-KE", { hour12: false })}`, marginL, currentY + 8);

  currentY += 12;

  // ── 3. CUSTOMER DETAILS & MEMBERSHIP BOX (Side by Side) ────────────────────
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(marginL, currentY, printableWidth, 28, 2, 2, "F");
  doc.setDrawColor(241, 245, 249).setLineWidth(0.3);
  doc.roundedRect(marginL, currentY, printableWidth, 28, 2, 2, "S");

  // Left column: Profile details
  doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(15, 23, 42);
  doc.text("CUSTOMER PROFILE / STATEMENT TO:", marginL + 5, currentY + 6);
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(51, 65, 85);
  doc.text(`Name: ${customer.name || "Guest Walk-In"}`, marginL + 5, currentY + 11);
  doc.text(`Company: ${customer.company_name || "N/A"}`, marginL + 5, currentY + 16);
  doc.text(`Tax PIN: ${customer.tax_id || "N/A"}`, marginL + 5, currentY + 21);
  doc.text(`Address: ${customer.address || "No address on file"}`, marginL + 5, currentY + 26);

  // Right column: Rank / Status details
  let rankName = "Bronze";
  if (ltv >= 150000) rankName = "Platinum";
  else if (ltv >= 50000) rankName = "Gold";
  else if (ltv >= 10000) rankName = "Silver";

  doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(15, 23, 42);
  doc.text("B2B MEMBERSHIP STATUS:", marginL + printableWidth * 0.55, currentY + 6);
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(51, 65, 85);
  doc.text(`Customer Type: ${customer.type || "Retail"}`, marginL + printableWidth * 0.55, currentY + 11);
  doc.text(`Current Tier: ${rankName}`, marginL + printableWidth * 0.55, currentY + 16);
  doc.text(`Lifetime Value (LTV): ${currency} ${ltv.toLocaleString()}`, marginL + printableWidth * 0.55, currentY + 21);
  doc.text(`Member Since: ${customer.created_at ? new Date(customer.created_at).toLocaleDateString("en-KE") : "N/A"}`, marginL + printableWidth * 0.55, currentY + 26);

  currentY += 34;

  // ── 4. SUMMARY STATS CARD ──────────────────────────────────────────────────
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(marginL, currentY, printableWidth, 14, 2, 2, "F");
  
  doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(30, 41, 59);
  doc.text(`Total Transactions: ${totalOrdersCount} Orders`, marginL + 5, currentY + 9);
  doc.text(`Total Logistics Fees: ${currency} ${totalFulfillmentFeesPaid.toLocaleString()}`, marginL + printableWidth * 0.36, currentY + 9);
  doc.text(`Lifetime Value (LTV): ${currency} ${ltv.toLocaleString()}`, marginL + printableWidth * 0.70, currentY + 9);

  currentY += 20;

  // ── 5. DETAILED TRANSACTION HISTORY TABLE ──────────────────────────────────
  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(30, 41, 59);
  doc.text("DETAILED TRANSACTION HISTORY", marginL, currentY);

  currentY += 4;

  const tableHeaders = [
    "Date",
    "Reference",
    "Items Summary",
    "Part No",
    "Engine",
    "Suitable",
    "Fulfillment Route",
    "Payment / Ref",
    "Fee",
    "Total Paid",
    "Status"
  ];

  const tableRows = orders.map((order: any) => {
    const formattedDate = new Date(order.created_at).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
    const trackingRef = order.tracking_number || `#ORD-${order.id}`;
    
    const items = (order.items || []).filter((i: any) => i.cancellation_status?.toLowerCase() !== "cancelled");
    const itemsSummary = items.map((i: any) => `${i.product?.name || "Part"} (Qty: ${i.quantity})`).join(", ") || "No parts listed";

    const partNumbers = items
      .map((i: any) => i.product?.part_number || "—")
      .join(", ") || "—";

    const engines = items
      .map((i: any) => i.product?.engine_model || "—")
      .join(", ") || "—";

    const suitableVehicles = items
      .map((i: any) => i.product?.suitable_vehicle || "—")
      .join(", ") || "—";

    const isPickup = order.shipping_method === "Pickup";
    const route = isPickup 
      ? "In-Store counter"
      : `${items?.[0]?.warehouse?.name || "Main Warehouse"} -> ${order.shipping_city || "Destination"}`;

    const pay = `${order.payment_method || "M-Pesa"}${order.payment_ref_code ? ` (${order.payment_ref_code})` : ""}`;
    const fee = `${currency} ${parseFloat(order.shipping_fee || 0).toLocaleString()}`;
    const total = `${currency} ${parseFloat(order.total_amount || 0).toLocaleString()}`;
    const status = order.status || "Pending";

    return [
      formattedDate,
      trackingRef,
      itemsSummary,
      partNumbers,
      engines,
      suitableVehicles,
      route,
      pay,
      fee,
      total,
      status
    ];
  });

  if (tableRows.length === 0) {
    tableRows.push(["—", "—", "No recorded transactions for this customer", "—", "—", "—", "—", "—", `${currency} 0`, `${currency} 0`, "—"]);
  }

  // Grand totals row
  tableRows.push([
    "TOTALS",
    `${totalOrdersCount} order(s)`,
    "",
    "",
    "",
    "",
    "",
    "",
    `${currency} ${totalFulfillmentFeesPaid.toLocaleString()}`,
    `${currency} ${ltv.toLocaleString()}`,
    ""
  ]);

  autoTable(doc, {
    head: [tableHeaders],
    body: tableRows,
    startY: currentY,
    tableWidth: printableWidth,
    showHead: "everyPage",
    theme: "grid",
    headStyles: {
      fillColor: [0, 82, 204],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7.5,
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [51, 65, 85],
      overflow: "linebreak",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: printableWidth * 0.08 },
      1: { cellWidth: printableWidth * 0.10, fontStyle: "bold" },
      2: { cellWidth: printableWidth * 0.15, overflow: "linebreak" },
      3: { cellWidth: printableWidth * 0.08, overflow: "linebreak" },
      4: { cellWidth: printableWidth * 0.06, overflow: "linebreak" },
      5: { cellWidth: printableWidth * 0.08, overflow: "linebreak" },
      6: { cellWidth: printableWidth * 0.13, overflow: "linebreak" },
      7: { cellWidth: printableWidth * 0.10, overflow: "linebreak" },
      8: { cellWidth: printableWidth * 0.08, halign: "right" },
      9: { cellWidth: printableWidth * 0.09, halign: "right", fontStyle: "bold" },
      10: { cellWidth: printableWidth * 0.05, halign: "center" }
    },
    margin: { top: 32, right: marginR, bottom: 18, left: marginL },
    didParseCell: (data: any) => {
      // Bold + highlight totals row
      if (data.row.index === tableRows.length - 1) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [241, 245, 249];
        data.cell.styles.textColor = [15, 23, 42];
      }
    },
    didDrawPage: (data: any) => {
      // Footer block
      const pageStr = `Page ${doc.getNumberOfPages()}`;
      doc.setFontSize(7.5).setFont("helvetica", "bold").setTextColor(148, 163, 184);
      doc.text("This statement is system-generated and confidential.", marginL, pageHeight - 8);
      doc.setFont("helvetica", "normal");
      doc.text(pageStr, rightEdge, pageHeight - 8, { align: "right" });

      doc.setDrawColor(220, 220, 220).setLineWidth(0.3);
      doc.line(marginL, pageHeight - 12, rightEdge, pageHeight - 12);
    }
  });

  doc.save(`b2b-statement-${customer.name?.toLowerCase().replace(/\s+/g, "-") || "customer"}.pdf`);
};

// ─── 6. Single Order Invoice PDF ─────────────────────────────────────────────
export const exportSingleOrderInvoicePDF = async (
  order: any,
  settings: Record<string, string> = {},
  customerObj?: any
) => {
  const { default: jsPDFClass } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDFClass({ orientation: "portrait", unit: "mm", format: "a4" });

  const storeName   = settings.store_name    || "";
  const storeEmail  = settings.store_email    || settings.contact_email || "";
  const storePhone  = settings.store_phone    || settings.contact_phone || "";
  const storeAddr   = settings.store_address  || settings.physical_address || "";
  const storeTag    = settings.store_tagline  || "";
  const currency    = settings.currency      || "Ksh";
  const storePin    = settings.store_kra_pin  || "";
  const storeReg    = settings.store_reg_number || "";
  const storeWeb    = settings.store_website  || "";

  const pageWidth  = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const marginL = 14;
  const marginR = 14;
  const rightEdge = pageWidth - marginR;
  const w = pageWidth - marginL - marginR;

  // ── 1. BRANDED LETTERHEAD ──────────────────────────────────────────────────
  await drawBrandedHeader(doc, {
    storeName,
    storeTagline: storeTag,
    storeAddress: storeAddr,
    storePhone,
    storeEmail,
    storeWebsite: storeWeb,
    storeKraPin: storePin,
    storeRegNumber: storeReg,
    storeLogo: settings.store_logo || ""
  });

  // ── 2. DOCUMENT TITLE / BLUE BANNER ─────────────────────────────────────────
  doc.setFillColor(0, 82, 204);
  doc.rect(marginL, 34, w, 8, "F");
  doc.setFontSize(10).setFont("helvetica", "bold").setTextColor(255, 255, 255);
  doc.text("TAX INVOICE", marginL + 4, 39.5);

  const invoiceDate = new Date().toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" });
  const orderDate   = order?.created_at ? new Date(order.created_at).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" }) : "N/A";
  const orderRef    = order?.tracking_number || `ORD-${order?.id || "N/A"}`;

  doc.setFontSize(8).setFont("helvetica", "normal").setTextColor(220, 232, 255);
  doc.text(`Invoice Date: ${invoiceDate}`, rightEdge - 4, 39.5, { align: "right" });

  // ── 3. ORDER META & BILL-TO DETAILS (Side-by-Side) ────────────────────────
  let y = 47;
  const col1X = marginL;
  const col2X = pageWidth / 2 + 4;
  const colW  = w / 2 - 6;

  // Col1: Order details
  const orderMeta: [string, string][] = [
    ["Invoice Reference", orderRef],
    ["Order Date",      orderDate],
    ["Payment Method",  order?.payment_method ? (order.payment_ref_code ? `${order.payment_method} (${order.payment_ref_code})` : order.payment_method) : "N/A"],
    ["Payment Status",  order?.payment_status || "N/A"],
    ["Fulfillment Status", order?.status || "N/A"],
  ];

  doc.setFontSize(8).setFont("helvetica", "bold").setTextColor(0, 82, 204);
  doc.text("INVOICE SUMMARY", col1X, y + 2);
  doc.setDrawColor(0, 82, 204).setLineWidth(0.3).line(col1X, y + 4, col1X + colW, y + 4);
  y += 7;
  orderMeta.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(100, 116, 139);
    doc.text(label, col1X, y);
    doc.setFont("helvetica", "normal").setTextColor(30, 41, 59);
    doc.text(String(value), col1X + 34, y);
    y += 4.8;
  });

  // Col2: Bill-To
  let y2 = 47;
  doc.setFontSize(8).setFont("helvetica", "bold").setTextColor(0, 82, 204);
  doc.text("BILL TO (CUSTOMER DETAILS)", col2X, y2 + 2);
  doc.setDrawColor(0, 82, 204).setLineWidth(0.3).line(col2X, y2 + 4, col2X + colW, y2 + 4);
  y2 += 7;

  const custName = customerObj?.name || order?.customer?.name || "Guest Walk-In";
  const custEmailRaw = customerObj?.email || order?.customer?.email || "";
  const custPhoneRaw = customerObj?.phone || order?.customer?.phone || "";
  const cleanPhone = custPhoneRaw.replace(/\s+/g, "");
  const isMockPhone = cleanPhone === "0700000000" || 
                      cleanPhone === "+254700000000" || 
                      cleanPhone === "254700000000" ||
                      cleanPhone.includes("700000000");
  const isWalkInCust = custName.toLowerCase().includes("walk-in") || custName.toLowerCase().includes("guest");
  
  const custPhone = (isMockPhone || isWalkInCust || !custPhoneRaw) ? "—" : custPhoneRaw;
  const custEmail = (isWalkInCust || !custEmailRaw || custEmailRaw.includes("walkin") || custEmailRaw.includes("guest")) ? "—" : custEmailRaw;
  const custCompany = customerObj?.company_name || order?.customer?.company_name || "—";
  const custTax = customerObj?.tax_id || order?.customer?.tax_id || "—";

  const billLines: [string, string][] = [
    ["Customer Name",  custName],
    ["Email Address",  custEmail],
    ["Phone Number",   custPhone],
    ["Company Name",   custCompany],
    ["Tax PIN / ID",   custTax],
  ];
  billLines.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(100, 116, 139);
    doc.text(label, col2X, y2);
    doc.setFont("helvetica", "normal").setTextColor(30, 41, 59);
    doc.text(String(value), col2X + 26, y2);
    y2 += 4.8;
  });

  y = Math.max(y, y2) + 4;

  // ── 4. LOGISTICS INTELLIGENCE BLOCK ────────────────────────────────────────
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(marginL, y, w, 22, 2, 2, "F");
  doc.setDrawColor(226, 232, 240).setLineWidth(0.3);
  doc.roundedRect(marginL, y, w, 22, 2, 2, "S");

  doc.setFontSize(7).setFont("helvetica", "bold").setTextColor(0, 82, 204);
  doc.text("AUTOMATED LOGISTICS ROUTING INTEL", marginL + 5, y + 4.5);

  const origin = order?.items?.[0]?.warehouse?.name || "Main Warehouse Hub";
  const destCity    = order?.shipping_city    || "N/A";
  const destCountry = order?.shipping_country || "Kenya";
  const destAddr    = order?.shipping_address || "";
  const destFull = destAddr ? `${destCountry}, ${destCity}, ${destAddr}` : `${destCountry}, ${destCity}`;

  // Draw progress track line
  const trackY = y + 12;
  doc.setDrawColor(191, 219, 254).setLineWidth(0.8).line(marginL + 25, trackY, rightEdge - 25, trackY);
  // Draw Nodes
  doc.setFillColor(0, 82, 204);
  doc.circle(marginL + 25, trackY, 1.8, "FD");
  doc.circle(rightEdge - 25, trackY, 1.8, "FD");

  // Draw central arrow
  const midX = pageWidth / 2;
  doc.triangle(midX - 2.5, trackY - 1.5, midX + 2.5, trackY, midX - 2.5, trackY + 1.5, "F");

  // Left label
  doc.setFontSize(6.5).setFont("helvetica", "bold").setTextColor(148, 163, 184);
  doc.text("ORIGIN HUB", marginL + 5, y + 10);
  doc.setFont("helvetica", "bold").setTextColor(30, 41, 59).setFontSize(8);
  doc.text(origin, marginL + 5, y + 16);

  // Right label
  doc.setFontSize(6.5).setFont("helvetica", "bold").setTextColor(148, 163, 184);
  doc.text("DELIVERY NODE", rightEdge - 5, y + 10, { align: "right" });
  doc.setFont("helvetica", "bold").setTextColor(30, 41, 59).setFontSize(8);

  const destLines = doc.splitTextToSize(destFull, 65);
  destLines.forEach((line: string, i: number) => {
    doc.text(line, rightEdge - 5, y + 16 + (i * 3.5), { align: "right" });
  });

  y += 26;

  // ── 5. LIVE CONTAINER TRACKING (if shipment) ────────────────────────────────
  if (order?.shipment) {
    const s = order.shipment;
    doc.setFillColor(239, 246, 255);
    doc.roundedRect(marginL, y, w, 14, 2, 2, "F");
    doc.setDrawColor(191, 219, 254).setLineWidth(0.3).roundedRect(marginL, y, w, 14, 2, 2, "S");
    doc.setFontSize(7).setFont("helvetica", "bold").setTextColor(29, 78, 216);
    doc.text("LIVE CARRIER WAYBILL TRACKING", marginL + 3, y + 4.5);

    const trackCols = w / 4;
    const trackItems: [string, string][] = [
      ["Waybill / Tracking", s.waybill || "N/A"],
      ["Carrier Partner",   s.carrier  || "N/A"],
      ["Transit Status",    s.status   || "N/A"],
      ["Est. Arrival (ETA)", s.eta      || "Pending"],
    ];
    trackItems.forEach(([label, value], i) => {
      const tx = marginL + 3 + i * trackCols;
      doc.setFont("helvetica", "bold").setFontSize(6.5).setTextColor(100, 116, 139);
      doc.text(label, tx, y + 9);
      doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(30, 41, 59);
      doc.text(String(value), tx, y + 13.5);
    });
    y += 18;
  }

  // ── 6. ITEM MANIFEST TABLE ──────────────────────────────────────────────────
  // Only show ACTIVE items — returned/cancelled items are excluded from the invoice
  const allItems = order?.items || [];
  const items = allItems.filter((item: any) => item.cancellation_status?.toLowerCase() !== "cancelled");
  const tableHead = [[
    "#",
    "Product Description",
    "Origin Warehouse",
    "SKU / Part Code",
    "Part No (OEM)",
    "Engine",
    "Suitable Vehicle",
    "Qty",
    `Unit Price (${currency})`,
    `Line Total (${currency})`
  ]];
  const tableBody = items.map((item: any, idx: number) => {
    const productDesc = item.product?.name || `Product ID: ${item.product_id}`;
    return [
      idx + 1,
      productDesc,
      item.warehouse?.name || "Main Warehouse",
      item.product?.sku || "N/A",
      item.product?.part_number || "—",
      item.product?.engine_model || "—",
      item.product?.suitable_vehicle || "—",
      item.quantity,
      `${currency} ${Number(item.price).toLocaleString()}`,
      `${currency} ${(Number(item.price) * item.quantity).toLocaleString()}`,
    ];
  });

  autoTable(doc, {
    head: tableHead,
    body: tableBody,
    startY: y + 2,
    theme: "grid",
    headStyles: { 
      fillColor: [0, 82, 204], 
      textColor: [255, 255, 255], 
      fontStyle: "bold", 
      fontSize: 8 
    },
    bodyStyles: { 
      fontSize: 7.8, 
      textColor: [51, 65, 85] 
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 
      0: { cellWidth: 8, halign: "center" }, 
      1: { cellWidth: 30, overflow: "linebreak" }, 
      2: { cellWidth: 20, overflow: "linebreak" }, 
      3: { cellWidth: 20, overflow: "linebreak" }, 
      4: { cellWidth: 22, overflow: "linebreak" }, 
      5: { cellWidth: 15, overflow: "linebreak" }, 
      6: { cellWidth: 25, overflow: "linebreak" }, 
      7: { cellWidth: 8, halign: "center" },
      8: { cellWidth: 17, halign: "right" },
      9: { cellWidth: 17, halign: "right", fontStyle: "bold" }
    },
    margin: { left: marginL, right: marginR },
    didDrawPage: () => {
      // Clean footer
      const pageStr = `Page ${doc.getNumberOfPages()}`;
      doc.setFontSize(7.5).setFont("helvetica", "bold").setTextColor(148, 163, 184);
      doc.text("This invoice is system-generated and legally valid without physical signature.", marginL, pageHeight - 8);
      doc.setFont("helvetica", "normal");
      doc.text(pageStr, rightEdge, pageHeight - 8, { align: "right" });

      doc.setDrawColor(220, 220, 220).setLineWidth(0.3);
      doc.line(marginL, pageHeight - 12, rightEdge, pageHeight - 12);
    }
  });

  // ── 7. TOTALS CARD ─────────────────────────────────────────────────────────
  const finalY = (doc as any).lastAutoTable?.finalY ?? y + 40;
  const subtotal = Math.max(0, Number(order?.total_amount || 0) - Number(order?.shipping_fee || 0));
  const shippingFee = Number(order?.shipping_fee || 0);
  const grandTotal  = Number(order?.total_amount || 0);
  // If a partial/full return was applied, show the original paid vs refunded
  const refundedAmount = Number(order?.refunded_amount || 0);

  const totalsX = pageWidth - marginR - 75;
  const totalsW = 75;

  let ty = finalY + 6;
  const extraRows = refundedAmount > 0 ? 1 : 0;
  const totalsBoxHeight = 26 + (extraRows * 6);
  doc.setFillColor(248, 250, 252).rect(totalsX, ty - 4, totalsW, totalsBoxHeight, "F");
  doc.setDrawColor(226, 232, 240).setLineWidth(0.3).rect(totalsX, ty - 4, totalsW, totalsBoxHeight, "S");

  const totalsRows: [string, string][] = [
    ["Items Subtotal",    `${currency} ${subtotal.toLocaleString()}`],
    [`Logistics Fee (${order?.shipping_method || "Standard"})`, `${currency} ${shippingFee.toLocaleString()}`],
  ];
  totalsRows.forEach(([label, value]) => {
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(100, 116, 139);
    doc.text(label, totalsX + 3, ty);
    doc.text(value, totalsX + totalsW - 3, ty, { align: "right" });
    ty += 5;
  });

  // Show refund line if a return was applied
  if (refundedAmount > 0) {
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(185, 28, 28);
    doc.text("Amount Refunded", totalsX + 3, ty);
    doc.text(`- ${currency} ${refundedAmount.toLocaleString()}`, totalsX + totalsW - 3, ty, { align: "right" });
    ty += 5;
  }

  // Divider line
  doc.setDrawColor(203, 213, 225).line(totalsX + 3, ty, totalsX + totalsW - 3, ty);
  ty += 4;

  doc.setFont("helvetica", "bold").setFontSize(9.5).setTextColor(30, 41, 59);
  doc.text("TOTAL AMOUNT PAID", totalsX + 3, ty);
  doc.setTextColor(0, 82, 204);
  doc.text(`${currency} ${grandTotal.toLocaleString()}`, totalsX + totalsW - 3, ty, { align: "right" });

  // Add Proof of Delivery Signature on the left side of the Totals card
  if (order?.delivery_signature_url) {
    const base64Sig = await loadImgAsBase64(order.delivery_signature_url);
    if (base64Sig) {
      doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(100, 116, 139);
      doc.text("CUSTOMER DIGITAL SIGNATURE (PROOF OF DELIVERY)", marginL, finalY + 4);
      doc.addImage(base64Sig, "PNG", marginL, finalY + 6, 45, 18);
    }
  }

  doc.save(`invoice-${orderRef.replace(/[^a-zA-Z0-9-]/g, "-")}.pdf`);
};

// ─── 7. Customer Full Order Ledger Statement PDF ─────────────────────────────
export const exportCustomerLedgerPDF = async (
  rawOrders: any[],
  customer: any,
  settings: Record<string, string> = {}
) => {
  const orders = rawOrders.filter((o: any) => {
    const isCancelled = o.status?.toLowerCase() === "cancelled" || o.payment_status?.toLowerCase() === "refunded" || o.payment_status?.toLowerCase() === "cancelled / refunded";
    if (isCancelled) return false;
    const isWalkIn = (o.tracking_number || "").startsWith("WK-");
    if (isWalkIn) {
      const isPending = o.payment_status?.toLowerCase() === "pending" || o.status?.toLowerCase() === "pending";
      if (isPending) return false;
    }
    return true;
  });

  const { default: jsPDFClass } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDFClass({ orientation: "landscape", unit: "mm", format: "a4" });

  const storeName  = settings.store_name    || "";
  const storeEmail = settings.store_email    || settings.contact_email || "";
  const storePhone = settings.store_phone    || settings.contact_phone || "";
  const storeAddr  = settings.store_address  || settings.physical_address || "";
  const storeTag   = settings.store_tagline  || "";
  const currency   = settings.currency     || "Ksh";
  const storePin   = settings.store_kra_pin  || "";
  const storeReg   = settings.store_reg_number || "";
  const storeWeb   = settings.store_website  || "";

  const pageWidth  = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const marginL = 14;
  const marginR = 14;
  const rightEdge = pageWidth - marginR;
  const w = pageWidth - marginL - marginR;

  // ── 1. BRANDED LETTERHEAD ──────────────────────────────────────────────────
  await drawBrandedHeader(doc, {
    storeName,
    storeTagline: storeTag,
    storeAddress: storeAddr,
    storePhone,
    storeEmail,
    storeWebsite: storeWeb,
    storeKraPin: storePin,
    storeRegNumber: storeReg,
    storeLogo: settings.store_logo || ""
  });

  let y = 36;

  // ── 2. DOCUMENT TITLE ──────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(0, 82, 204);
  doc.text("CUSTOMER ACCOUNT STATEMENT & LEDGER", marginL, y);
  doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(100, 100, 100);
  doc.text(`Generated: ${new Date().toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })}`, rightEdge, y, { align: "right" });

  y += 5;

  // ── 3. ACCOUNT HOLDER INFORMATION CARD ─────────────────────────────────────
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(marginL, y, w, 14, 2, 2, "F");
  doc.setDrawColor(241, 245, 249).setLineWidth(0.3);
  doc.roundedRect(marginL, y, w, 14, 2, 2, "S");

  doc.setFontSize(7.5).setFont("helvetica", "bold").setTextColor(100, 116, 139);
  doc.text("ACCOUNT HOLDER PROFILE", marginL + 4, y + 4.5);
  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(30, 41, 59);
  doc.text(customer?.name || "N/A", marginL + 4, y + 9.5);

  const custItems: string[] = [];
  if (customer?.email) custItems.push(`Email: ${customer.email}`);
  if (customer?.phone) custItems.push(`Tel: ${customer.phone}`);
  if (customer?.company_name) custItems.push(`Company: ${customer.company_name}`);
  doc.setFontSize(7.5).setFont("helvetica", "normal").setTextColor(100, 116, 139);
  doc.text(custItems.join("   |   "), rightEdge - 4, y + 9.5, { align: "right" });

  y += 18;

  // ── 4. SUMMARY STATS CARD ──────────────────────────────────────────────────
  const grandTotal  = orders.reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0);
  const totalFees   = orders.reduce((sum: number, o: any) => sum + Number(o.shipping_fee || 0), 0);
  const productsCost = Math.max(0, grandTotal - totalFees);

  doc.setFillColor(239, 246, 255);
  doc.roundedRect(marginL, y, w, 12, 2, 2, "F");

  doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(30, 41, 59);
  doc.text(`Total Transactions: ${orders.length} Order(s)`, marginL + 5, y + 7.5);
  doc.text(`Product Cost: ${currency} ${productsCost.toLocaleString()}`, marginL + w * 0.28, y + 7.5);
  doc.text(`Logistics Fees: ${currency} ${totalFees.toLocaleString()}`, marginL + w * 0.54, y + 7.5);
  doc.text(`Total Spent: ${currency} ${grandTotal.toLocaleString()}`, marginL + w * 0.78, y + 7.5);

  y += 18;

  // ── 5. DETAILED ORDERS TABLE ───────────────────────────────────────────────
  const tableHead = [[
    "Order Ref",
    "Order Date",
    "Main Product Reference",
    "Part No",
    "Engine",
    "Suitable",
    "Items Count",
    "Origin Warehouse",
    "Fulfillment Destination",
    `Products Cost (${currency})`,
    `Shipping Fee (${currency})`,
    `Total Paid (${currency})`,
    "Order Status",
    "Payment Mode",
  ]];

  const getActiveItems = (o: any) => (o.items || []).filter((item: any) => item.cancellation_status?.toLowerCase() !== "cancelled");

  const grandTotalItemsCount = orders.reduce((sum: number, o: any) => sum + getActiveItems(o).length, 0);
  const grandTotalUnitsCount = orders.reduce((sum: number, o: any) => sum + getActiveItems(o).reduce((s: number, item: any) => s + (item.quantity || 0), 0), 0);

  const tableBody = orders.map((o: any) => {
    const subtotal = Math.max(0, Number(o.total_amount || 0) - Number(o.shipping_fee || 0));
    const activeItems = getActiveItems(o);
    const productNames = activeItems
      .map((item: any) => {
        const name = item.product?.name || "Genuine Spare Part";
        const partNo = item.product?.part_number ? ` [${item.product.part_number}]` : "";
        return `${name}${partNo} (Qty: ${item.quantity || 1})`;
      })
      .filter(Boolean)
      .join(", ") || "Genuine Spare Part";

    const partNumbers = activeItems
      .map((item: any) => item.product?.part_number || "—")
      .filter(Boolean)
      .join(", ") || "—";

    const engines = activeItems
      .map((item: any) => item.product?.engine_model || "—")
      .filter(Boolean)
      .join(", ") || "—";

    const suitableVehicles = activeItems
      .map((item: any) => item.product?.suitable_vehicle || "—")
      .filter(Boolean)
      .join(", ") || "—";

    const totalQty = activeItems.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
    return [
      o.tracking_number || `ORD-${o.id}`,
      new Date(o.created_at).toLocaleDateString("en-KE"),
      productNames,
      partNumbers,
      engines,
      suitableVehicles,
      `${activeItems.length} Item(s) (${totalQty} Unit${totalQty !== 1 ? 's' : ''})`,
      activeItems[0]?.warehouse?.name || "Main Warehouse Hub",
      o.shipping_city ? `${o.shipping_city}, ${o.shipping_country || "Kenya"}` : "In-Store Collection",
      `${currency} ${subtotal.toLocaleString()}`,
      `${currency} ${Number(o.shipping_fee || 0).toLocaleString()}`,
      `${currency} ${Number(o.total_amount || 0).toLocaleString()}`,
      o.status === "In Transit" ? "Shipped" : (o.status || "Pending"),
      o.payment_method ? (o.payment_ref_code ? `${o.payment_method} (${o.payment_ref_code})` : o.payment_method) : "M-Pesa",
    ];
  });

  // Grand totals table row
  tableBody.push([
    "TOTALS",
    `${orders.length} order(s)`,
    "",
    "",
    "",
    "",
    `${grandTotalItemsCount} item(s) (${grandTotalUnitsCount} unit${grandTotalUnitsCount !== 1 ? 's' : ''})`,
    "",
    "",
    `${currency} ${productsCost.toLocaleString()}`,
    `${currency} ${totalFees.toLocaleString()}`,
    `${currency} ${grandTotal.toLocaleString()}`,
    "",
    ""
  ]);

  autoTable(doc, {
    head: tableHead,
    body: tableBody,
    startY: y,
    theme: "grid",
    headStyles: { 
      fillColor: [0, 82, 204], 
      textColor: [255, 255, 255], 
      fontStyle: "bold", 
      fontSize: 7.5 
    },
    bodyStyles:  { 
      fontSize: 7.5, 
      textColor: [51, 65, 85] 
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: marginL, right: marginR, top: 32, bottom: 18 },
    columnStyles: {
      0: { cellWidth: 22, fontStyle: "bold" },
      1: { cellWidth: 15 },
      2: { cellWidth: 35, overflow: "linebreak" },
      3: { cellWidth: 20, overflow: "linebreak" },
      4: { cellWidth: 15, overflow: "linebreak" },
      5: { cellWidth: 20, overflow: "linebreak" },
      6: { cellWidth: 15, halign: "center" },
      7: { cellWidth: 20, overflow: "linebreak" },
      8: { cellWidth: 25, overflow: "linebreak" },
      9: { halign: "right" },
      10: { halign: "right" },
      11: { halign: "right", fontStyle: "bold" },
      12: { cellWidth: 16, halign: "center" },
      13: { cellWidth: 15, halign: "center" },
    },
    didParseCell: (data: any) => {
      // Bold + highlight totals row
      if (data.row.index === tableBody.length - 1) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [241, 245, 249];
        data.cell.styles.textColor = [15, 23, 42];
      }
    },
    didDrawPage: () => {
      // Footer page marking
      const pageStr = `Page ${doc.getNumberOfPages()}`;
      doc.setFontSize(7.5).setFont("helvetica", "bold").setTextColor(148, 163, 184);
      doc.text("This ledger statement is system-generated and confidential.", marginL, pageHeight - 8);
      doc.setFont("helvetica", "normal");
      doc.text(pageStr, rightEdge, pageHeight - 8, { align: "right" });

      doc.setDrawColor(220, 220, 220).setLineWidth(0.3);
      doc.line(marginL, pageHeight - 12, rightEdge, pageHeight - 12);
    }
  });

  doc.save(`statement-${(customer?.name || "customer").toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.pdf`);
};

