// db.js — Expo SDK 51+ / expo-sqlite v15+: usar openDatabaseAsync
import * as SQLite from "expo-sqlite";

let db = null;

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

// Helpers basados en la nueva API
async function run(sql, params = []) {
  return db.runAsync(sql, params);
}
async function all(sql, params = []) {
  // Devuelve array de objetos {col:value}
  return db.getAllAsync(sql, params);
}
async function exec(sql) {
  // Ejecuta múltiples statements separados por ';'
  return db.execAsync(sql);
}

export async function init() {
  if (!db) {
    db = await SQLite.openDatabaseAsync("ventas.db");
  }

  await exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      sku TEXT,
      price REAL NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY NOT NULL,
      datetime TEXT DEFAULT (datetime('now')),
      total REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id TEXT PRIMARY KEY NOT NULL,
      sale_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      subtotal REAL NOT NULL
    );
  `);
}

/** -------- Productos -------- */
export async function getProducts() {
  return all("SELECT * FROM products ORDER BY created_at DESC");
}

export async function addProduct({ name, sku, price, stock }) {
  const id = uid("P");
  await run(
    "INSERT INTO products (id, name, sku, price, stock) VALUES (?, ?, ?, ?, ?)",
    [id, name, sku || null, Number(price), Number(stock ?? 0)]
  );
  return id;
}

/** -------- Clientes -------- */
export async function getCustomers() {
  return all("SELECT * FROM customers ORDER BY created_at DESC");
}

export async function addCustomer({ name, phone, email }) {
  const id = uid("C");
  await run(
    "INSERT INTO customers (id, name, phone, email) VALUES (?, ?, ?, ?)",
    [id, name, phone || null, email || null]
  );
  return id;
}

/** -------- Ventas -------- */
export async function getSales() {
  // items y datetime ya desde tabla sales
  return all("SELECT * FROM sales ORDER BY datetime DESC");
}

/**
 * createSale({ items: [{ product_id, quantity }] })
 * - Descuenta stock por cada item
 * - Inserta sale y sale_items
 * - Calcula total
 * - Usa transacción
 */

export async function getSaleItemsBySaleId(saleId) {
  return all(
    `SELECT 
        si.id,
        si.product_id,
        p.name AS product_name,
        si.quantity,
        si.unit_price,
        si.subtotal
     FROM sale_items si
     JOIN products p ON p.id = si.product_id
     WHERE si.sale_id = ?
     ORDER BY si.id ASC`,
    [saleId]
  );
}

export async function createSale({ items }) {
  if (!items || items.length === 0) throw new Error("No hay items en la venta");

  const saleId = uid("S");
  const now = new Date().toISOString();

  await exec("BEGIN");
  try {
    await run(
      "INSERT INTO sales (id, datetime, total) VALUES (?, ?, 0)",
      [saleId, now]
    );

    let total = 0;

    for (const it of items) {
      const prodRows = await all(
        "SELECT price, stock FROM products WHERE id = ?",
        [it.product_id]
      );
      if (prodRows.length === 0) throw new Error("Producto no encontrado");

      const { price, stock } = prodRows[0];
      const qty = Number(it.quantity || 0);
      if (qty <= 0) throw new Error("Cantidad inválida");
      if (stock < qty) throw new Error("Stock insuficiente");

      const unit_price = Number(price);
      const subtotal = unit_price * qty;

      await run(
        "INSERT INTO sale_items (id, sale_id, product_id, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?, ?)",
        [uid("SI"), saleId, it.product_id, qty, unit_price, subtotal]
      );
      await run(
        "UPDATE products SET stock = stock - ? WHERE id = ?",
        [qty, it.product_id]
      );

      total += subtotal;
    }

    await run("UPDATE sales SET total = ? WHERE id = ?", [total, saleId]);

    await exec("COMMIT");
    return saleId;
  } catch (e) {
    await exec("ROLLBACK");
    throw e;
  }
}
