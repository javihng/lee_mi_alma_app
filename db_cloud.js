// db_cloud.js — funciones con Supabase
import { supabase } from "./supabase";

export async function getProducts() {
  const { data, error } = await supabase.from("products").select("*").order("name");
  if (error) throw error;
  return data;
}

export async function addProduct({ name, sku, price, stock }) {
  const { error } = await supabase.from("products").insert([{ name, sku, price, stock: stock ?? 0 }]);
  if (error) throw error;
}

export async function getCustomers() {
  const { data, error } = await supabase.from("customers").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function addCustomer({ name, phone, email, interest }) {
  const { data, error } = await supabase
    .from('customers')
    .insert([{ name, phone, email, interest }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Crear venta (envía tipo de pago)
export async function createSale({ items, paymentType }) {
  const { data, error } = await supabase.rpc('create_sale', {
    items,
    payment_type: paymentType,
  });
  if (error) throw error;
  return data; // sale_id
}

// Lista de ventas (para la UI)
export async function getSales() {
  const { data, error } = await supabase
    .from("sales")
    .select("id, datetime, total, payment_type")
    .order("datetime", { ascending: false });
  if (error) throw error;
  return data || [];
}

// Ventas detalladas por ÍTEM para exportar (sin sale_id)
export async function getSalesDetailed() {
  const { data, error } = await supabase
    .from("sale_items")
    .select(`
      quantity,
      unit_price,
      subtotal,
      sales!inner(datetime, total, payment_type),
      products!inner(name)
    `)
    .order("datetime", { referencedTable: "sales", ascending: false });

  if (error) throw error;

  // Normaliza a un arreglo listo para CSV (SIN sale_id)
  return (data || []).map((row) => ({
    fecha: row.sales?.datetime ?? null,
    producto: row.products?.name ?? "",
    cantidad: row.quantity ?? 0,
    precio_unitario: row.unit_price ?? 0,
    subtotal: row.subtotal ?? 0,
    total_venta: row.sales?.total ?? 0,
    metodo_pago: row.sales?.payment_type ?? "", // <<-- incluido
  }));
}


export async function getSaleItemsBySaleId(saleId) {
  const { data, error } = await supabase
    .from("sale_items")
    .select("id, product_id, quantity, unit_price, subtotal, products(name)")
    .eq("sale_id", saleId);
  if (error) throw error;
  return (data || []).map(r => ({
    id: r.id,
    product_id: r.product_id,
    quantity: r.quantity,
    unit_price: r.unit_price,
    subtotal: r.subtotal,
    product_name: r.products?.name
  }));
}

// --- Costs ---
export async function addCost({ date, product_id, product_name, cost, note }) {
  const payload = { date, product_id, product_name, cost, note };
  const { data, error } = await supabase.from('costs').insert([payload]).select().single();
  if (error) throw error;
  return data;
}

export async function getCosts() {
  const { data, error } = await supabase
    .from('costs')
    .select(`
      id, date, product_id, product_name, cost, note,
      products:product_id ( id, name )
    `)
    .order('date', { ascending: false });
  if (error) throw error;
  return data;
}

export async function adjustStock(product_id, delta) {
  const { data, error } = await supabase.rpc('adjust_stock', { p_id: product_id, p_delta: delta });
  if (error) throw error;
  return data; // producto actualizado
}

// Actualiza campos del producto por id (name, sku, price, stock absoluto)
export async function updateProduct(id, fields) {
  const patch = { ...fields };
  if (patch.price !== undefined) patch.price = Number(patch.price);
  if (patch.stock !== undefined) patch.stock = parseInt(patch.stock, 10);

  const { data, error } = await supabase
    .from('products')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export function listenProducts(callback) {
  // Lectura inicial
  supabase.from("products").select("*").order("name", { ascending: true })
    .then(({ data, error }) => { if (!error) callback(data || []); });

  // Realtime (insert/update/delete)
  const channel = supabase
    .channel("products-ch")
    .on("postgres_changes", { event: "*", schema: "public", table: "products" }, async () => {
      const { data } = await supabase.from("products").select("*").order("name", { ascending: true });
      callback(data || []);
    })
    .subscribe();

  // devolver función para desuscribirse
  return () => supabase.removeChannel(channel);
}

// No-op para mantener compatibilidad con App.js
export async function init() {
  return; // en Supabase no necesitamos inicialización
}