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
  storeName?: string
) => {
  const { default: jsPDFClass } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDFClass({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const name = storeName || "AUTOSPARE EAST AFRICA";
  addHeader(doc, name, "Customer & POS Dispatch Transactions Report", name, logoBase64);

  const tableColumn = ["Order Ref", "Customer", "Origin Warehouse", "Destination", "Order Date", "Items", "Subtotal", "Shipping", "Grand Total", "Status"];
  const tableRows = orders.map((o) => [
    o.tracking_number || `ORD-${o.id}`,
    o.customer?.name || "Walk-In Guest",
    o.items?.[0]?.warehouse?.name || "N/A",
    o.shipping_city ? `${o.shipping_city}, ${o.shipping_country || "Kenya"}` : "In-Store Collection",
    new Date(o.created_at).toLocaleDateString(),
    `${o.items?.length || 0} items`,
    `${currency} ${Math.max(0, (parseFloat(o.total_amount || 0) - parseFloat(o.shipping_fee || 0))).toLocaleString()}`,
    `${currency} ${parseFloat(o.shipping_fee || 0).toLocaleString()}`,
    `${currency} ${parseFloat(o.total_amount || 0).toLocaleString()}`,
    o.status || "Pending",
  ]);

  autoTable(doc, {
    head: [tableColumn],
    body: tableRows,
    startY: 37,
    theme: "striped",
    headStyles: {
      fillColor: [30, 41, 59], // Slate/Zinc Dark Theme
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

  doc.save(`orders_report_${new Date().toISOString().split("T")[0]}.pdf`);
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
    "Website: www.autospare.co.ke",
    "PIN: P051528643W" // B2B Corporate PIN fallback
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
      0: { cellWidth: printableWidth * 0.1 },
      1: { cellWidth: printableWidth * 0.12, fontStyle: "bold" },
      2: { cellWidth: printableWidth * 0.28, overflow: "linebreak" },
      3: { cellWidth: printableWidth * 0.18, overflow: "linebreak" },
      4: { cellWidth: printableWidth * 0.12, overflow: "linebreak" },
      5: { cellWidth: printableWidth * 0.08, halign: "right" },
      6: { cellWidth: printableWidth * 0.08, halign: "right", fontStyle: "bold" },
      7: { cellWidth: printableWidth * 0.06, halign: "center" }
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
