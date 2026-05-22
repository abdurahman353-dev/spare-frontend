import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
      doc.addImage(logoBase64, "JPEG", logoX, logoY, logoSize, logoSize);
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
export const exportProductsPDF = (
  products: any[],
  currency: string = "Ksh",
  logoBase64?: string,
  storeName?: string
) => {
  const doc = new jsPDF({
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
export const exportInventoryPDF = (
  inventory: any[],
  currency: string = "Ksh",
  logoBase64?: string,
  storeName?: string
) => {
  const doc = new jsPDF({
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
export const exportOrdersPDF = (
  orders: any[],
  currency: string = "Ksh",
  logoBase64?: string,
  storeName?: string
) => {
  const doc = new jsPDF({
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
