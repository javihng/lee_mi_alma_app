// utils/export.js
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { supabase } from "../supabase";

export async function exportSalesToCSV() {
  // Ventas (incluye payment_type si existe en la tabla)
  const { data: sales, error: salesErr } = await supabase
    .from("sales")
    .select("*")
    .order("datetime", { ascending: true });
  if (salesErr) throw salesErr;

  // Ítems (con datos de producto)
  const { data: items, error: itemsErr } = await supabase
    .from("sale_items")
    .select(
      "id, sale_id, product_id, quantity, unit_price, subtotal, products(name, sku)"
    )
    .order("sale_id", { ascending: true });
  if (itemsErr) throw itemsErr;

  // Agrupar ítems por venta (no exportaremos sale_id, solo lo usamos para agrupar)
  const itemsBySale = {};
  for (const it of (items || [])) {
    if (!itemsBySale[it.sale_id]) itemsBySale[it.sale_id] = [];
    itemsBySale[it.sale_id].push(it);
  }

  // Encabezado SIN sale_id e INCLUYE payment_type
  const header = [
    "datetime",
    "total",
    "payment_type",
    "product_id",
    "product_name",
    "product_sku",
    "quantity",
    "unit_price",
    "subtotal",
  ];
  const rows = [header];

  for (const s of (sales || [])) {
    const its = itemsBySale[s.id] || [];

    // Si una venta no tiene ítems, escribimos fila “vacía” (sin sale_id)
    if (its.length === 0) {
      rows.push([
        s.datetime,
        s.total,
        s.payment_type ?? "",
        "", "", "", "", "", "",
      ]);
      continue;
    }

    // Fila por cada ítem (sin sale_id)
    for (const it of its) {
      rows.push([
        s.datetime,
        s.total,
        s.payment_type ?? "",
        it.product_id,
        it.products?.name ?? "",
        it.products?.sku ?? "",
        it.quantity,
        it.unit_price,
        it.subtotal,
      ]);
    }
  }

  // Serializar a CSV
  const csv = rows
    .map((r) =>
      r
        .map((v) => {
          const s = String(v ?? "");
          const needsQuote = /[",\n]/.test(s);
          const esc = s.replace(/"/g, '""');
          return needsQuote ? `"${esc}"` : esc;
        })
        .join(",")
    )
    .join("\n");

  // Guardar y compartir
  const filename = `ventas_${new Date().toISOString().slice(0, 10)}.csv`;
  const uri = FileSystem.cacheDirectory + filename;

  await FileSystem.writeAsStringAsync(uri, csv, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) return uri;

  await Sharing.shareAsync(uri, {
    mimeType: "text/csv",
    dialogTitle: "Exportar ventas",
  });

  return uri;
}