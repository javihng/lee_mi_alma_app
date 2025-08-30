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

export async function getSales() {
  const { data, error } = await supabase.from("sales").select("*").order("datetime", { ascending: false });
  if (error) throw error;
  return data;
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

// Llama a la función SQL create_sale que definimos en Supabase
export async function createSale({ items }) {
  const payload = items.map(i => ({ product_id: i.product_id, quantity: i.quantity }));
  const { data, error } = await supabase.rpc("create_sale", { items: payload });
  if (error) throw error;
  return data; // devuelve el sale_id
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