import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { supabase } from "../supabase";

export async function exportSalesToCSV() {
  const { data: sales, error: salesErr } = await supabase
    .from("sales").select("*").order("datetime", { ascending: true });
  if (salesErr) throw salesErr;

  const { data: items, error: itemsErr } = await supabase
    .from("sale_items")
    .select("id, sale_id, product_id, quantity, unit_price, subtotal, products(name, sku)")
    .order("sale_id", { ascending: true });
  if (itemsErr) throw itemsErr;

  const itemsBySale = {};
  for (const it of (items || [])) {
    if (!itemsBySale[it.sale_id]) itemsBySale[it.sale_id] = [];
    itemsBySale[it.sale_id].push(it);
  }

  const header = ["sale_id","datetime","total","product_id","product_name","product_sku","quantity","unit_price","subtotal"];
  const rows = [header];

  for (const s of (sales || [])) {
    const its = itemsBySale[s.id] || [];
    if (its.length === 0) {
      rows.push([s.id, s.datetime, s.total, "", "", "", "", "", ""]);
      continue;
    }
    for (const it of its) {
      rows.push([
        s.id, s.datetime, s.total,
        it.product_id,
        it.products?.name ?? "",
        it.products?.sku ?? "",
        it.quantity, it.unit_price, it.subtotal
      ]);
    }
  }

  const csv = rows.map(r =>
    r.map(v => {
      const s = String(v ?? "");
      const needsQuote = /[",\n]/.test(s);
      const esc = s.replace(/"/g, '""');
      return needsQuote ? `"${esc}"` : esc;
    }).join(",")
  ).join("\n");

  const filename = `ventas_${new Date().toISOString().slice(0,10)}.csv`;
  const uri = FileSystem.cacheDirectory + filename;
  await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) return uri;
  await Sharing.shareAsync(uri, { mimeType: "text/csv", dialogTitle: "Exportar ventas" });
  return uri;
}