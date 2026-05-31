import type jsPDF from "jspdf";

export interface PdfCompanySettings {
  storeName?: string;
  storeTagline?: string;
  storeLogo?: string;
  physicalAddress?: string;
  contactEmail?: string;
  contactPhone?: string;
  currency?: string;
}

function getImageFormat(base64: string): "JPEG" | "PNG" | "WEBP" {
  if (base64.startsWith("data:image/png")) return "PNG";
  if (base64.startsWith("data:image/webp")) return "WEBP";
  return "JPEG";
}

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
  storeName: string = "AUTOSPARE EAST AFRICA",
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
  const storeName = company.storeName || "AUTOSPARE EAST AFRICA";
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
const addFooter = (doc: jsPDF, data: any, storeName: string = "AutoSpare East Africa") => {
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

  const name = storeName || "AUTOSPARE EAST AFRICA";
  addHeader(doc, name, "Genuine Parts Catalog Report", name, logoBase64);

  const tableColumn = ["SKU", "Part Name", "Category", "Brand", "Weight", "Status", "Unit Price"];
  const tableRows = products.map((p) => [
    p.sku || "N/A",
    p.name || "N/A",
    p.category?.name || "N/A",
    p.brand?.name || "N/A",
    p.weight ? `${parseFloat(p.weight).toFixed(2)} KG` : "1.00 KG",
    p.status || "Active",
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
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [51, 65, 85], // Slate-700
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

  const name = storeName || "AUTOSPARE EAST AFRICA";
  addHeader(doc, name, "Inventory Stock Balance & Warehouse Distribution Report", name, logoBase64);

  const tableColumn = ["SKU", "Product Name", "Brand", "Warehouse Location", "Quantity", "Min Stock", "Status"];

  const getStatus = (item: any) => {
    if (item.warehouse_id === null) return "Unassigned";
    if (item.quantity <= 0) return "Out of Stock";
    if (item.quantity <= item.min_stock) return "Low Stock";
    return "In Stock";
  };

  const tableRows = inventory.map((item) => [
    item.product?.sku || "N/A",
    item.product?.name || "N/A",
    item.product?.brand?.name || "N/A",
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
  orders: any[],
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
  }
) => {
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

  const legalName    = storeName || "AUTOSPARE EAST AFRICA";
  const tagline      = companySettings?.tagline  || "Premium Automotive Parts & Logistics";
  const addressLine  = companySettings?.address  || "Mombasa Road, Nairobi Central Hub";
  const telNo        = companySettings?.phone    || "+254 711 223 344";
  const emailAddr    = companySettings?.email    || "billing@autospare.com";
  const websiteUrl   = companySettings?.website  || "www.autospare.com";
  const kraPin       = companySettings?.kraPin   || "";
  const businessReg  = companySettings?.regNumber || "";
  const activeBranch = companySettings?.branch   || "Main Warehouse";
  const reportType   = isWalkIn ? "WALK-IN POS" : "SHIPMENT";
  const today        = new Date().toISOString().split("T")[0];

  // ── 1. BRANDED LETTERHEAD ──────────────────────────────────────────────────
  // Left blue accent bar
  doc.setFillColor(0, 82, 204);
  doc.rect(marginL, 8, 3, 22, "F");

  // Abstract logo block
  doc.setFillColor(0, 82, 204);
  doc.roundedRect(21, 8, 12, 12, 2, 2, "F");
  doc.setFillColor(255, 255, 255);
  doc.triangle(27, 10, 25, 14, 29, 14, "F");
  doc.triangle(27, 18, 25, 14, 29, 14, "F");

  // Company name & tagline
  doc.setFont("helvetica", "bold").setFontSize(12.5).setTextColor(0, 82, 204);
  doc.text(legalName, 37, 15);
  doc.setFont("helvetica", "italic").setFontSize(7.5).setTextColor(120, 120, 120);
  doc.text(tagline, 37, 20);

  // Right-aligned contact strip
  const rightEdge = pageWidth - marginR;
  doc.setFont("helvetica", "normal").setFontSize(6.8).setTextColor(100, 100, 100);
  doc.text(`Tel: ${telNo}  |  Email: ${emailAddr}`, rightEdge, 12, { align: "right" });
  if (websiteUrl || kraPin) {
    doc.text(`${websiteUrl ? `Web: ${websiteUrl}` : ""}${kraPin ? `  |  PIN: ${kraPin}` : ""}`, rightEdge, 17, { align: "right" });
  }
  if (businessReg || addressLine) {
    doc.text(`${businessReg ? `Reg: ${businessReg}  |  ` : ""}Addr: ${addressLine}`, rightEdge, 22, { align: "right" });
  }

  // Header separator
  doc.setDrawColor(220, 220, 220).setLineWidth(0.5);
  doc.line(marginL, 32, pageWidth - marginR, 32);

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
  const totalGross = orders.reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const totalFees  = orders.reduce((s, o) => s + Number(o.shipping_fee  || 0), 0);
  const totalItems = orders.reduce((s, o) => s + (o.items?.length || 0), 0);

  doc.setFillColor(239, 246, 255);
  doc.roundedRect(marginL, statsY, infoW, 14, 2, 2, "F");
  doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(30, 41, 59);
  doc.text(`Total Orders: ${orders.length}`,                                    marginL + 6,            statsY + 9);
  doc.text(`Total Items: ${totalItems}`,                                         marginL + infoW * 0.25, statsY + 9);
  doc.text(`Shipping Fees: ${currency} ${totalFees.toLocaleString()}`,           marginL + infoW * 0.50, statsY + 9);
  doc.text(`Gross Revenue: ${currency} ${totalGross.toLocaleString()}`,          marginL + infoW * 0.75, statsY + 9);

  // ── 4. ORDERS TABLE ────────────────────────────────────────────────────────
  const tableStartY = statsY + 18;

  const tableColumn = [
    "Order Ref",
    "Customer / Phone",
    "Products",
    "Origin Warehouse",
    "Destination",
    "Date",
    "Subtotal",
    "Shipping",
    "Grand Total",
    "Status",
  ];

  const tableRows = orders.map((o) => {
    const productNames = (o.items || [])
      .map((item: any) => item.product?.name || "—")
      .filter(Boolean)
      .join(", ") || "—";

    const customerPhone = o.customer?.phone || "";
    const customerDisplay = customerPhone
      ? `${o.customer?.name || "Walk-In Guest"}\n${customerPhone}`
      : (o.customer?.name || "Walk-In Guest");

    return [
      o.tracking_number || `ORD-${o.id}`,
      customerDisplay,
      productNames,
      o.items?.[0]?.warehouse?.name || "N/A",
      o.shipping_city
        ? `${o.shipping_city}, ${o.shipping_country || "Kenya"}`
        : "In-Store Collection",
      new Date(o.created_at).toLocaleDateString("en-KE"),
      `${currency} ${Math.max(0, parseFloat(o.total_amount || 0) - parseFloat(o.shipping_fee || 0)).toLocaleString()}`,
      `${currency} ${parseFloat(o.shipping_fee || 0).toLocaleString()}`,
      `${currency} ${parseFloat(o.total_amount || 0).toLocaleString()}`,
      o.status || "Pending",
    ];
  });

  // Totals footer row
  tableRows.push([
    "TOTALS",
    `${orders.length} order(s)`,
    `${totalItems} item(s)`,
    "",
    "",
    "",
    `${currency} ${Math.max(0, totalGross - totalFees).toLocaleString()}`,
    `${currency} ${totalFees.toLocaleString()}`,
    `${currency} ${totalGross.toLocaleString()}`,
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
      0: { cellWidth: w * 0.10, fontStyle: "bold" },
      1: { cellWidth: w * 0.11, overflow: "linebreak" },
      2: { cellWidth: w * 0.18, overflow: "linebreak" },
      3: { cellWidth: w * 0.10, overflow: "linebreak" },
      4: { cellWidth: w * 0.10, overflow: "linebreak" },
      5: { cellWidth: w * 0.08, halign: "center" },
      6: { cellWidth: w * 0.09, halign: "right" },
      7: { cellWidth: w * 0.08, halign: "right" },
      8: { cellWidth: w * 0.10, halign: "right", fontStyle: "bold" },
      9: { cellWidth: w * 0.06, halign: "center" },
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

  doc.save(`${isWalkIn ? "walkin" : "shipment"}_orders_report_${today}.pdf`);
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

  const storeName = company.storeName || "AUTOSPARE EAST AFRICA";
  const currency = company.currency || "Ksh";
  const startY = addCompanyManifestHeader(doc, "WAYBILL PRODUCTS MANIFEST", company);
  const printableWidth = getPrintableWidth(doc);
  const margin = A4_PRINT_MARGINS;

  const shippedDate = shipment.shipped_at
    ? new Date(shipment.shipped_at).toLocaleDateString()
    : shipment.created_at
      ? new Date(shipment.created_at).toLocaleDateString()
      : "N/A";

  const orders = shipment.orders || [];
  const orderCount = orders.length;

  // Waybill summary block
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(51, 65, 85);

  const summaryLeft: [string, string][] = [
    ["Waybill ID", shipment.waybill || "N/A"],
    ["Carrier Partner", shipment.carrier || "N/A"],
    ["Shipment Status", shipment.status || "N/A"],
    ["ETA / Lead Time", shipment.eta || "N/A"],
  ];
  const summaryRight: [string, string][] = [
    ["Origin Warehouse", shipment.origin || "N/A"],
    ["Destination Hub", shipment.destination || "N/A"],
    ["Total Orders", `${orderCount}`],
    ["Shipped Date", shippedDate],
  ];

  const shipmentProductSubtotal = orders.reduce((sum: number, order: any) => {
    const itemsTotal = (order.items || []).reduce(
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

  let leftY = startY + 4;
  summaryLeft.forEach(([label, value]) => {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(`${label}:`, margin.left, leftY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    const used = drawWrappedValue(doc, margin.left + 34, leftY, value, 58);
    leftY += Math.max(5.5, used);
  });

  let rightY = startY + 4;
  summaryRight.forEach(([label, value]) => {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(`${label}:`, margin.left + printableWidth * 0.48, rightY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    const used = drawWrappedValue(
      doc,
      margin.left + printableWidth * 0.48 + 38,
      rightY,
      value,
      printableWidth * 0.48 - 42
    );
    rightY += Math.max(5.5, used);
  });

  const tableStartY = Math.max(leftY, rightY) + 6;

  // Single unified line-item table: every product row with order reference
  type ManifestRow = {
    orderRef: string;
    customer: string;
    sku: string;
    productName: string;
    qty: number;
    unitPrice: number;
    orderSubtotal: number;
    shippingFee: number;
    orderGrandTotal: number;
    shippingMethod: string;
    orderStatus: string;
    paymentStatus: string;
    paymentMethod: string;
    isFirstLineOfOrder: boolean;
  };

  const manifestRows: ManifestRow[] = [];
  orders.forEach((order: any) => {
    const orderRef = order.tracking_number || `ORD-${order.id}`;
    const customer = order.customer?.name || "Guest";
    const orderStatus = order.status || "N/A";
    const paymentStatus = order.payment_status || "N/A";
    const paymentMethod = order.payment_method || "N/A";
    const shippingMethod = order.shipping_method || "N/A";
    const shippingFee = parseFloat(order.shipping_fee || 0);
    const orderGrandTotal = parseFloat(order.total_amount || 0);

    const items = order.items || [];
    const orderSubtotal = items.reduce(
      (sum: number, item: any) =>
        sum + (Number(item.quantity) || 0) * parseFloat(item.price ?? item.product?.price ?? 0),
      0
    );

    items.forEach((item: any, index: number) => {
      const unitPrice = parseFloat(item.price ?? item.product?.price ?? 0);
      const qty = Number(item.quantity) || 0;
      manifestRows.push({
        orderRef,
        customer,
        sku: item.product?.sku || "N/A",
        productName: item.product?.name || "Unknown Product",
        qty,
        unitPrice,
        orderSubtotal,
        shippingFee,
        orderGrandTotal,
        shippingMethod,
        orderStatus,
        paymentStatus,
        paymentMethod,
        isFirstLineOfOrder: index === 0,
      });
    });
  });

  const totalQty = manifestRows.reduce((sum, r) => sum + r.qty, 0);
  const uniqueProducts = new Set(manifestRows.map((r) => r.sku)).size;

  const tableColumn = [
    "Order Ref",
    "Customer",
    "SKU / Part Ref",
    "Product Name",
    "Qty",
    "Unit Price",
    "Order Subtotal",
    "Shipping Fee",
    "Grand Total",
    "Ship Method",
    "Order Status",
    "Payment",
    "Pay Method",
  ];

  const fmt = (amount: number) => `${currency} ${amount.toLocaleString()}`;

  const tableRows = manifestRows.map((r) => [
    r.orderRef,
    r.customer,
    r.sku,
    r.productName,
    `${r.qty}`,
    fmt(r.unitPrice),
    r.isFirstLineOfOrder ? fmt(r.orderSubtotal) : "",
    r.isFirstLineOfOrder ? fmt(r.shippingFee) : "",
    r.isFirstLineOfOrder ? fmt(r.orderGrandTotal) : "",
    r.isFirstLineOfOrder ? r.shippingMethod : "",
    r.isFirstLineOfOrder ? r.orderStatus : "",
    r.isFirstLineOfOrder ? r.paymentStatus : "",
    r.isFirstLineOfOrder ? r.paymentMethod : "",
  ]);

  if (tableRows.length === 0) {
    tableRows.push([
      "—", "—", "—", "No products assigned to this shipment", "0",
      fmt(0), fmt(0), fmt(0), fmt(0), "—", "—", "—", "—",
    ]);
  }

  tableRows.push([
    "SHIPMENT TOTALS",
    `${orderCount} order(s)`,
    `${uniqueProducts} SKU(s)`,
    `${manifestRows.length} line item(s)`,
    `${totalQty}`,
    "",
    fmt(shipmentProductSubtotal),
    fmt(shipmentShippingTotal),
    fmt(shipmentGrandTotal),
    "",
    "",
    "",
    "",
  ]);

  // Column widths must fit inside printable A4 landscape width (~277mm)
  const col = {
    orderRef: printableWidth * 0.075,
    customer: printableWidth * 0.085,
    sku: printableWidth * 0.075,
    productName: printableWidth * 0.145,
    qty: printableWidth * 0.035,
    unitPrice: printableWidth * 0.075,
    orderSubtotal: printableWidth * 0.08,
    shippingFee: printableWidth * 0.075,
    grandTotal: printableWidth * 0.08,
    shipMethod: printableWidth * 0.065,
    orderStatus: printableWidth * 0.065,
    payment: printableWidth * 0.055,
    payMethod: printableWidth * 0.065,
  };

  autoTable(doc, {
    head: [tableColumn],
    body: tableRows,
    startY: tableStartY,
    tableWidth: printableWidth,
    showHead: "everyPage",
    horizontalPageBreak: false,
    theme: "striped",
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
    columnStyles: {
      0: { cellWidth: col.orderRef },
      1: { cellWidth: col.customer, overflow: "linebreak" },
      2: { cellWidth: col.sku, overflow: "linebreak" },
      3: { cellWidth: col.productName, overflow: "linebreak" },
      4: { cellWidth: col.qty, halign: "center" },
      5: { cellWidth: col.unitPrice, halign: "right", overflow: "linebreak" },
      6: { cellWidth: col.orderSubtotal, halign: "right", overflow: "linebreak" },
      7: { cellWidth: col.shippingFee, halign: "right", overflow: "linebreak" },
      8: { cellWidth: col.grandTotal, halign: "right", overflow: "linebreak" },
      9: { cellWidth: col.shipMethod, halign: "center", overflow: "linebreak" },
      10: { cellWidth: col.orderStatus, halign: "center", overflow: "linebreak" },
      11: { cellWidth: col.payment, halign: "center", overflow: "linebreak" },
      12: { cellWidth: col.payMethod, halign: "center", overflow: "linebreak" },
    },
    margin: { top: margin.top, right: margin.right, bottom: margin.bottom, left: margin.left },
    didDrawPage: (data: any) => addFooter(doc, data, storeName),
    didParseCell: (data: any) => {
      if (data.row.index === tableRows.length - 1) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [241, 245, 249];
        data.cell.styles.textColor = [15, 23, 42];
      }
    },
  });

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
  const storeName = company.storeName || "AUTOSPARE EAST AFRICA";
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margins = { top: 12, right: 10, bottom: 14, left: 10 };
  const printableWidth = pageWidth - margins.left - margins.right;

  // 1. Draw Company Header
  let leftX = margins.left;
  if (company.storeLogo) {
    try {
      const logoSize = 18;
      doc.addImage(
        company.storeLogo,
        getImageFormat(company.storeLogo),
        margins.left,
        margins.top,
        logoSize,
        logoSize
      );
      leftX = margins.left + logoSize + 4;
    } catch {
      leftX = margins.left;
    }
  }

  // Company Name
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59); // Slate-800
  doc.text(storeName.toUpperCase(), leftX, margins.top + 4);

  // Tagline
  if (company.storeTagline) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.text(company.storeTagline, leftX, margins.top + 8);
  }

  // Corporate Address & Details (Right Aligned)
  const companyDetails = [
    company.physicalAddress || "Automated Logistics Hub, Nairobi, Kenya",
    company.contactPhone ? `Tel: ${company.contactPhone}` : "Tel: +254 745 621 159",
    company.contactEmail ? `Email: ${company.contactEmail}` : "Email: sales@autospare.co.ke",
  ];

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105); // Slate-600
  companyDetails.forEach((line, index) => {
    doc.text(line, pageWidth - margins.right, margins.top + 3 + (index * 3.8), { align: "right" });
  });

  // Main Header separator line
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.setLineWidth(0.4);
  doc.line(margins.left, margins.top + 22, pageWidth - margins.right, margins.top + 22);

  let currentY = margins.top + 28;

  // Title: "B2B ACCOUNT STATEMENT"
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 82, 204); // Primary Blue
  doc.text("OFFICIAL B2B ACCOUNT STATEMENT", margins.left, currentY);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(`Statement Period: All-Time History`, margins.left, currentY + 4.5);
  doc.text(`Generated On: ${new Date().toLocaleString()}`, margins.left, currentY + 8.5);

  // Customer billing & rank info boxes side by side
  currentY += 12;
  
  // Draw light grey container for Statement Info
  doc.setFillColor(248, 250, 252); // Slate-50
  doc.setDrawColor(241, 245, 249); // Slate-100
  doc.setLineWidth(0.3);
  doc.rect(margins.left, currentY, printableWidth, 30, "DF");

  // Customer details (Left side of container)
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42); // Slate-900
  doc.text("CUSTOMER PROFILE / STATEMENT TO:", margins.left + 5, currentY + 6);

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.text(`Name: ${customer.name || "Guest Walk-In"}`, margins.left + 5, currentY + 12);
  doc.text(`Company: ${customer.company_name || "N/A"}`, margins.left + 5, currentY + 17);
  doc.text(`Tax PIN: ${customer.tax_id || "N/A"}`, margins.left + 5, currentY + 22);
  doc.text(`Address: ${customer.address || "No address on file"}`, margins.left + 5, currentY + 27);

  // B2B Rank details (Right side of container)
  const ltv = parseFloat(customer.orders_sum_total_amount || "0");
  
  // Rank threshold mapping
  let rankName = "Bronze";
  if (ltv >= 150000) rankName = "Platinum";
  else if (ltv >= 50000) rankName = "Gold";
  else if (ltv >= 10000) rankName = "Silver";

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.text("B2B MEMBERSHIP STATUS:", margins.left + 110, currentY + 6);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Customer Type: ${customer.type || "Retail"}`, margins.left + 110, currentY + 12);
  doc.text(`Current Tier: ${rankName}`, margins.left + 110, currentY + 17);
  doc.text(`Member Since: ${customer.created_at ? new Date(customer.created_at).toLocaleDateString() : "2026"}`, margins.left + 110, currentY + 22);
  doc.text(`Lifetime Value (LTV): ${currency} ${ltv.toLocaleString()}`, margins.left + 110, currentY + 27);

  currentY += 36;

  // Let's calculate totals for Statement summary stats cards
  const orders = customer.orders || [];
  const totalOrdersCount = orders.length;
  const totalFulfillmentFeesPaid = orders.reduce((sum: number, o: any) => sum + parseFloat(o.shipping_fee || 0), 0);
  
  // Draw summary cards
  doc.setFillColor(241, 245, 249); // Slate-100
  doc.rect(margins.left, currentY, printableWidth * 0.3, 14, "F");
  doc.rect(margins.left + (printableWidth * 0.35), currentY, printableWidth * 0.3, 14, "F");
  doc.rect(margins.left + (printableWidth * 0.7), currentY, printableWidth * 0.3, 14, "F");

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("TOTAL TRANSACTIONS", margins.left + 2, currentY + 5);
  doc.text("TOTAL LOGISTICS FEES", margins.left + (printableWidth * 0.35) + 2, currentY + 5);
  doc.text("NET ACCUMULATED LTV", margins.left + (printableWidth * 0.7) + 2, currentY + 5);

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(`${totalOrdersCount} Orders`, margins.left + 2, currentY + 11);
  doc.text(`${currency} ${totalFulfillmentFeesPaid.toLocaleString()}`, margins.left + (printableWidth * 0.35) + 2, currentY + 11);
  doc.text(`${currency} ${ltv.toLocaleString()}`, margins.left + (printableWidth * 0.7) + 2, currentY + 11);

  currentY += 20;

  // Detailed Transaction Table using autoTable
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("DETAILED TRANSACTION HISTORY", margins.left, currentY);

  currentY += 4;

  const tableHeaders = [
    "Date",
    "Reference",
    "Items Summary",
    "Fulfillment Route",
    "Payment / Ref",
    "Fee",
    "Total Paid",
    "Status"
  ];

  const tableRows = orders.map((order: any) => {
    const formattedDate = new Date(order.created_at).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
    const trackingRef = order.tracking_number || `#ORD-${order.id}`;
    
    // Summary of items
    const items = order.items || [];
    const itemsSummary = items.map((i: any) => `${i.product?.name || "Part"} (Qty: ${i.quantity})`).join(", ") || "No parts listed";

    // Fulfillment path
    const isPickup = order.shipping_method === "Pickup";
    const route = isPickup 
      ? "In-Store counter"
      : `${items?.[0]?.warehouse?.name || "Main Warehouse"} -> ${order.shipping_city || "Destination"}`;

    const pay = `${order.payment_method || "M-Pesa"}${order.payment_ref_code ? ` (Ref: ${order.payment_ref_code})` : ""}`;
    const fee = `${currency} ${parseFloat(order.shipping_fee || 0).toLocaleString()}`;
    const total = `${currency} ${parseFloat(order.total_amount || 0).toLocaleString()}`;
    const status = order.status || "Pending";

    return [
      formattedDate,
      trackingRef,
      itemsSummary,
      route,
      pay,
      fee,
      total,
      status
    ];
  });

  if (tableRows.length === 0) {
    tableRows.push(["—", "—", "No recorded transactions for this customer", "—", "—", `${currency} 0`, `${currency} 0`, "—"]);
  }

  autoTable(doc, {
    head: [tableHeaders],
    body: tableRows,
    startY: currentY,
    tableWidth: printableWidth,
    showHead: "everyPage",
    theme: "striped",
    headStyles: {
      fillColor: [0, 82, 204],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7.5,
      halign: "left"
    },
    styles: {
      fontSize: 7,
      cellPadding: 2,
      overflow: "linebreak",
      valign: "middle"
    },
    columnStyles: {
      0: { cellWidth: printableWidth * 0.10 },
      1: { cellWidth: printableWidth * 0.13, fontStyle: "bold" },
      2: { cellWidth: printableWidth * 0.27, overflow: "linebreak" },
      3: { cellWidth: printableWidth * 0.17, overflow: "linebreak" },
      4: { cellWidth: printableWidth * 0.12, overflow: "linebreak" },
      5: { cellWidth: printableWidth * 0.09, halign: "right" },
      6: { cellWidth: printableWidth * 0.08, halign: "right", fontStyle: "bold" },
      7: { cellWidth: printableWidth * 0.04, halign: "center" }
    },
    margin: { top: margins.top, right: margins.right, bottom: margins.bottom, left: margins.left },
    didDrawPage: (data: any) => {
      // Add Footer on each page
      const pageStr = `Page ${doc.getNumberOfPages()}`;
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(148, 163, 184); // Slate-400
      doc.text(pageStr, margins.left, pageHeight - margins.bottom + 5);
      doc.text(
        `© ${new Date().getFullYear()} ${storeName}. Secure B2B Logistics Platform.`,
        pageWidth - margins.right - 90,
        pageHeight - margins.bottom + 5
      );
    }
  });

  // Save the statement PDF
  doc.save(`b2b-statement-${customer.name?.toLowerCase().replace(/\s+/g, "-") || "customer"}.pdf`);
};

// ─── 6. Single Order Invoice PDF ─────────────────────────────────────────────
export const exportSingleOrderInvoicePDF = async (
  order: any,
  settings: Record<string, string> = {}
) => {
  const { default: jsPDFClass } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDFClass({ orientation: "portrait", unit: "mm", format: "a4" });

  const storeName   = settings.store_name    || "AUTOSPARE EAST AFRICA";
  const storeEmail  = settings.contact_email || "support@autospare.co.ke";
  const storePhone  = settings.contact_phone || "+254 700 000 000";
  const storeAddr   = settings.physical_address || "Nairobi, Kenya";
  const storeTag    = settings.store_tagline || "Premium OEM Spare Parts & Logistics";
  const currency    = settings.currency      || "Ksh";
  const logoBase64  = settings.store_logo    || undefined;

  const pageWidth  = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const marginL = 14;
  const marginR = 14;
  const w = pageWidth - marginL - marginR;

  // ── HEADER BLOCK ────────────────────────────────────────────────────────────
  // Left: Logo + Company name
  let logoEndX = marginL;
  if (logoBase64) {
    try {
      const fmt = logoBase64.startsWith("data:image/png") ? "PNG" : logoBase64.startsWith("data:image/webp") ? "WEBP" : "JPEG";
      doc.addImage(logoBase64, fmt, marginL, 8, 22, 22);
      logoEndX = marginL + 22 + 4;
    } catch { logoEndX = marginL; }
  }

  doc.setFontSize(16).setFont("helvetica", "bold").setTextColor(30, 41, 59);
  doc.text(storeName.toUpperCase(), logoEndX, 16);
  doc.setFontSize(8).setFont("helvetica", "normal").setTextColor(100, 116, 139);
  doc.text(storeTag, logoEndX, 21);

  // Right: Contact info
  const contactLines = [storeAddr, `Tel: ${storePhone}`, storeEmail];
  contactLines.forEach((line, i) => {
    doc.setFontSize(8).setFont("helvetica", "normal").setTextColor(100, 116, 139);
    doc.text(line, pageWidth - marginR, 10 + i * 4.5, { align: "right" });
  });

  // Thin blue banner bar
  doc.setFillColor(0, 82, 204);
  doc.rect(marginL, 32, w, 8, "F");
  doc.setFontSize(11).setFont("helvetica", "bold").setTextColor(255, 255, 255);
  doc.text("LOGISTICS INVOICE", marginL + 4, 37.5);

  const invoiceDate = new Date().toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" });
  const orderDate   = order?.created_at ? new Date(order.created_at).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" }) : "N/A";
  const orderRef    = order?.tracking_number || `ORD-${order?.id || "N/A"}`;

  doc.setFontSize(8).setFont("helvetica", "normal").setTextColor(220, 232, 255);
  doc.text(`Invoice Date: ${invoiceDate}`, pageWidth - marginR, 37.5, { align: "right" });

  // ── ORDER META BLOCK ────────────────────────────────────────────────────────
  let y = 46;

  // Two columns: Order Info (left) | Bill-To (right)
  const col1X = marginL;
  const col2X = pageWidth / 2 + 4;
  const colW  = w / 2 - 6;

  // Col1: Order details
  const orderMeta: [string, string][] = [
    ["Order Reference", orderRef],
    ["Order Date",      orderDate],
    ["Payment Method",  order?.payment_method || "N/A"],
    ["Payment Status",  order?.payment_status || "N/A"],
    ["Order Status",    order?.status || "N/A"],
  ];

  doc.setFontSize(8).setFont("helvetica", "bold").setTextColor(0, 82, 204);
  doc.text("ORDER DETAILS", col1X, y + 2);
  doc.setDrawColor(0, 82, 204).setLineWidth(0.3).line(col1X, y + 4, col1X + colW, y + 4);
  y += 7;
  orderMeta.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(100, 116, 139);
    doc.text(label, col1X, y);
    doc.setFont("helvetica", "normal").setTextColor(30, 41, 59);
    doc.text(String(value), col1X + 34, y);
    y += 5;
  });

  // Col2: Bill-To
  let y2 = 46;
  doc.setFontSize(8).setFont("helvetica", "bold").setTextColor(0, 82, 204);
  doc.text("BILL TO", col2X, y2 + 2);
  doc.setDrawColor(0, 82, 204).setLineWidth(0.3).line(col2X, y2 + 4, col2X + colW, y2 + 4);
  y2 += 7;
  const billLines: [string, string][] = [
    ["Customer",  order?.customer?.name  || "N/A"],
    ["Email",     order?.customer?.email || "N/A"],
    ["Company",   order?.customer?.company_name || "N/A"],
    ["Tax ID",    order?.customer?.tax_id || "N/A"],
  ];
  billLines.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(100, 116, 139);
    doc.text(label, col2X, y2);
    doc.setFont("helvetica", "normal").setTextColor(30, 41, 59);
    doc.text(String(value), col2X + 22, y2);
    y2 += 5;
  });

  y = Math.max(y, y2) + 4;

  // ── LOGISTICS INTELLIGENCE BLOCK ────────────────────────────────────────────
  doc.setFillColor(241, 245, 249); // slate-100
  doc.roundedRect(marginL, y, w, 14, 2, 2, "F");
  doc.setDrawColor(203, 213, 225).setLineWidth(0.3);
  doc.roundedRect(marginL, y, w, 14, 2, 2, "S");

  doc.setFontSize(7).setFont("helvetica", "bold").setTextColor(100, 116, 139);
  doc.text("LOGISTICS INTELLIGENCE", marginL + 3, y + 4.5);

  const origin = order?.items?.[0]?.warehouse?.name || "Origin Warehouse";
  const destCity    = order?.shipping_city    || "N/A";
  const destCountry = order?.shipping_country || "Kenya";
  const destAddr    = order?.shipping_address || "";
  const destFull = destAddr ? `${destCountry}, ${destCity}, ${destAddr}` : `${destCountry}, ${destCity}`;

  const midX = pageWidth / 2;
  doc.setFontSize(7).setFont("helvetica", "bold").setTextColor(100, 116, 139);
  doc.text("ORIGIN NODE", marginL + 3, y + 9);
  doc.setFont("helvetica", "bold").setTextColor(30, 41, 59).setFontSize(8.5);
  doc.text(origin, marginL + 3, y + 13.5);

  doc.setFontSize(8).setFont("helvetica", "bold").setTextColor(0, 82, 204);
  doc.text("- - - - - - - - - - - - -\u27A4", midX - 20, y + 9.5, { align: "center" });

  doc.setFontSize(7).setFont("helvetica", "bold").setTextColor(100, 116, 139);
  doc.text("FINAL DESTINATION", pageWidth - marginR - 3, y + 9, { align: "right" });
  doc.setFont("helvetica", "bold").setTextColor(30, 41, 59).setFontSize(8.5);
  doc.text(destFull.substring(0, 40), pageWidth - marginR - 3, y + 13.5, { align: "right" });

  y += 18;

  // ── LIVE CONTAINER TRACKING (if shipment) ────────────────────────────────────
  if (order?.shipment) {
    const s = order.shipment;
    doc.setFillColor(239, 246, 255); // blue-50
    doc.roundedRect(marginL, y, w, 14, 2, 2, "F");
    doc.setDrawColor(191, 219, 254).setLineWidth(0.3).roundedRect(marginL, y, w, 14, 2, 2, "S");
    doc.setFontSize(7).setFont("helvetica", "bold").setTextColor(29, 78, 216);
    doc.text("LIVE CONTAINER TRACKING", marginL + 3, y + 4.5);

    const trackCols = w / 4;
    const trackItems: [string, string][] = [
      ["Waybill / Container", s.waybill || "N/A"],
      ["Carrier",             s.carrier  || "N/A"],
      ["Container Status",    s.status   || "N/A"],
      ["ETA",                 s.eta      || "Pending"],
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

  // ── ITEM MANIFEST TABLE ──────────────────────────────────────────────────────
  const items = order?.items || [];
  const tableHead = [["#", "Product / Part Name", "Origin Warehouse", "SKU", "Qty", `Unit Price (${currency})`, `Line Total (${currency})`]];
  const tableBody = items.map((item: any, idx: number) => [
    idx + 1,
    item.product?.name || `Product ID: ${item.product_id}`,
    item.warehouse?.name || "N/A",
    item.product?.sku   || "N/A",
    item.quantity,
    `${currency} ${Number(item.price).toLocaleString()}`,
    `${currency} ${(Number(item.price) * item.quantity).toLocaleString()}`,
  ]);

  autoTable(doc, {
    head: tableHead,
    body: tableBody,
    startY: y + 2,
    theme: "striped",
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: [51, 65, 85] },
    columnStyles: { 0: { cellWidth: 8 }, 4: { cellWidth: 10, halign: "center" } },
    margin: { left: marginL, right: marginR },
    didDrawPage: () => {
      doc.setFontSize(7).setFont("helvetica", "normal").setTextColor(148, 163, 184);
      doc.text(`${storeName} | ${storeEmail} | ${storePhone}`, marginL, pageHeight - 8);
      doc.text(`Page ${doc.getNumberOfPages()}`, pageWidth - marginR, pageHeight - 8, { align: "right" });
    }
  });

  // ── TOTALS ────────────────────────────────────────────────────────────────────
  const finalY = (doc as any).lastAutoTable?.finalY ?? y + 40;
  const subtotal = Math.max(0, Number(order?.total_amount || 0) - Number(order?.shipping_fee || 0));
  const shippingFee = Number(order?.shipping_fee || 0);
  const grandTotal  = Number(order?.total_amount || 0);

  const totalsX = pageWidth - marginR - 70;
  const totalsW = 70;

  let ty = finalY + 6;
  doc.setFillColor(248, 250, 252).rect(totalsX, ty - 4, totalsW, 26, "F");
  doc.setDrawColor(226, 232, 240).setLineWidth(0.3).rect(totalsX, ty - 4, totalsW, 26, "S");

  const totalsRows: [string, string][] = [
    ["Product Subtotal",    `${currency} ${subtotal.toLocaleString()}`],
    [`Logistics Fee (${order?.shipping_method || "Standard"})`, `${currency} ${shippingFee.toLocaleString()}`],
  ];
  totalsRows.forEach(([label, value]) => {
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(100, 116, 139);
    doc.text(label, totalsX + 3, ty);
    doc.text(value, totalsX + totalsW - 3, ty, { align: "right" });
    ty += 5;
  });

  // Divider
  doc.setDrawColor(203, 213, 225).line(totalsX + 3, ty, totalsX + totalsW - 3, ty);
  ty += 4;

  doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(30, 41, 59);
  doc.text("GRAND TOTAL", totalsX + 3, ty);
  doc.setTextColor(0, 82, 204);
  doc.text(`${currency} ${grandTotal.toLocaleString()}`, totalsX + totalsW - 3, ty, { align: "right" });

  // ── FOOTER NOTE ────────────────────────────────────────────────────────────────
  ty += 10;
  doc.setFont("helvetica", "italic").setFontSize(7).setTextColor(148, 163, 184);
  doc.text("This is a computer-generated invoice and does not require a signature.", marginL, ty);
  doc.text(`Thank you for your business with ${storeName}.`, marginL, ty + 4);

  doc.save(`invoice-${orderRef.replace(/[^a-zA-Z0-9-]/g, "-")}.pdf`);
};

// ─── 7. Customer Full Order Ledger Statement PDF ─────────────────────────────
export const exportCustomerLedgerPDF = async (
  orders: any[],
  customer: any,
  settings: Record<string, string> = {}
) => {
  const { default: jsPDFClass } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDFClass({ orientation: "landscape", unit: "mm", format: "a4" });

  const storeName  = settings.store_name    || "AUTOSPARE EAST AFRICA";
  const storeEmail = settings.contact_email || "support@autospare.co.ke";
  const storePhone = settings.contact_phone || "+254 700 000 000";
  const storeAddr  = settings.physical_address || "Nairobi, Kenya";
  const storeTag   = settings.store_tagline || "Premium OEM Spare Parts & Logistics";
  const currency   = settings.currency     || "Ksh";
  const logoBase64 = settings.store_logo   || undefined;

  const pageWidth  = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const marginL = 14;
  const marginR = 14;
  const w = pageWidth - marginL - marginR;

  // ── HEADER ───────────────────────────────────────────────────────────────────
  let logoEndX = marginL;
  if (logoBase64) {
    try {
      const fmt = logoBase64.startsWith("data:image/png") ? "PNG" : logoBase64.startsWith("data:image/webp") ? "WEBP" : "JPEG";
      doc.addImage(logoBase64, fmt, marginL, 8, 20, 20);
      logoEndX = marginL + 20 + 4;
    } catch { logoEndX = marginL; }
  }

  doc.setFontSize(15).setFont("helvetica", "bold").setTextColor(30, 41, 59);
  doc.text(storeName.toUpperCase(), logoEndX, 15);
  doc.setFontSize(8).setFont("helvetica", "normal").setTextColor(100, 116, 139);
  doc.text(storeTag, logoEndX, 20);

  const contactLines = [storeAddr, `Tel: ${storePhone}`, storeEmail];
  contactLines.forEach((line, i) => {
    doc.setFontSize(8).setFont("helvetica", "normal").setTextColor(100, 116, 139);
    doc.text(line, pageWidth - marginR, 10 + i * 4.5, { align: "right" });
  });

  // Banner
  doc.setFillColor(30, 41, 59);
  doc.rect(marginL, 28, w, 8, "F");
  doc.setFontSize(10).setFont("helvetica", "bold").setTextColor(255, 255, 255);
  doc.text("CUSTOMER ORDER STATEMENT", marginL + 4, 33.5);
  doc.setFontSize(8).setFont("helvetica", "normal").setTextColor(200, 210, 220);
  doc.text(`Generated: ${new Date().toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })}`, pageWidth - marginR, 33.5, { align: "right" });

  let y = 40;

  // Customer info band
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(marginL, y, w, 12, 2, 2, "F");
  doc.setFontSize(7.5).setFont("helvetica", "bold").setTextColor(100, 116, 139);
  doc.text("ACCOUNT HOLDER", marginL + 3, y + 4.5);
  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(30, 41, 59);
  doc.text(customer?.name || "N/A", marginL + 3, y + 9.5);

  const custItems: string[] = [];
  if (customer?.email) custItems.push(`Email: ${customer.email}`);
  if (customer?.phone) custItems.push(`Tel: ${customer.phone}`);
  if (customer?.company_name) custItems.push(`Company: ${customer.company_name}`);
  doc.setFontSize(7.5).setFont("helvetica", "normal").setTextColor(100, 116, 139);
  doc.text(custItems.join("   |   "), pageWidth - marginR, y + 9.5, { align: "right" });

  y += 16;

  // ── ORDERS TABLE ─────────────────────────────────────────────────────────────
  const tableHead = [[
    "Order Ref",
    "Order Date",
    "Main Product",
    "Items",
    "Origin Warehouse",
    "Destination",
    `Products Cost (${currency})`,
    `Shipping Fee (${currency})`,
    `Total (${currency})`,
    "Status",
    "Payment",
  ]];

  const tableBody = orders.map((o: any) => {
    const subtotal = Math.max(0, Number(o.total_amount || 0) - Number(o.shipping_fee || 0));
    return [
      o.tracking_number || `ORD-${o.id}`,
      new Date(o.created_at).toLocaleDateString("en-KE"),
      o.items?.[0]?.product?.name || "Genuine Spare Part",
      o.items?.length || 0,
      o.items?.[0]?.warehouse?.name || "N/A",
      o.shipping_city ? `${o.shipping_city}, ${o.shipping_country || "Kenya"}` : "In-Store Collection",
      `${currency} ${subtotal.toLocaleString()}`,
      `${currency} ${Number(o.shipping_fee || 0).toLocaleString()}`,
      `${currency} ${Number(o.total_amount || 0).toLocaleString()}`,
      o.status === "In Transit" ? "Shipped" : (o.status || "Pending"),
      o.payment_method || "Cash",
    ];
  });

  autoTable(doc, {
    head: tableHead,
    body: tableBody,
    startY: y,
    theme: "striped",
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.5 },
    bodyStyles:  { fontSize: 7.5, textColor: [51, 65, 85] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: marginL, right: marginR },
    columnStyles: {
      0: { cellWidth: 28 },
      3: { cellWidth: 10, halign: "center" },
      9: { cellWidth: 20 },
    },
    didDrawPage: () => {
      doc.setFontSize(7).setFont("helvetica", "normal").setTextColor(148, 163, 184);
      doc.text(`${storeName} | ${storeEmail} | ${storePhone}`, marginL, pageHeight - 8);
      doc.text(`Page ${doc.getNumberOfPages()}`, pageWidth - marginR, pageHeight - 8, { align: "right" });
    }
  });

  // ── SUMMARY TOTALS ────────────────────────────────────────────────────────────
  const finalY = (doc as any).lastAutoTable?.finalY ?? y + 50;
  const grandTotal  = orders.reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0);
  const totalFees   = orders.reduce((sum: number, o: any) => sum + Number(o.shipping_fee || 0), 0);
  const productsCost = Math.max(0, grandTotal - totalFees);

  let sy = finalY + 6;
  doc.setFillColor(30, 41, 59).rect(pageWidth - marginR - 90, sy - 4, 90, 24, "F");
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(200, 210, 220);
  doc.text("Total Products Cost:", pageWidth - marginR - 87, sy + 1);
  doc.text(`${currency} ${productsCost.toLocaleString()}`, pageWidth - marginR, sy + 1, { align: "right" });
  sy += 5;
  doc.text("Total Shipping Fees:", pageWidth - marginR - 87, sy + 1);
  doc.text(`${currency} ${totalFees.toLocaleString()}`, pageWidth - marginR, sy + 1, { align: "right" });
  sy += 5;
  doc.setDrawColor(100, 116, 139).line(pageWidth - marginR - 87, sy, pageWidth - marginR, sy);
  sy += 4;
  doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(255, 255, 255);
  doc.text("TOTAL SPENT:", pageWidth - marginR - 87, sy + 1);
  doc.text(`${currency} ${grandTotal.toLocaleString()}`, pageWidth - marginR, sy + 1, { align: "right" });

  doc.save(`statement-${(customer?.name || "customer").toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.pdf`);
};

