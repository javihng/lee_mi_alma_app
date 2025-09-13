// screens/InventoryScreen.js
import React, { useEffect, useMemo, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  Button,
  FlatList,
  Modal,
  Alert,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import XLSX from "xlsx";
import * as DB from "../db_cloud";

// Formateador de precios en COP
function formatCOP(value) {
  try {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(value) || 0);
  } catch {
    const n = Math.round(Number(value) || 0).toString();
    return "$ " + n.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }
}

export default function InventoryScreen() {
  const [products, setProducts] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState({ name: "", sku: "", price: "", stock: "" });

  // búsqueda
  const [search, setSearch] = useState("");

  // Modal de ajuste de stock (+/-)
  const [stockModal, setStockModal] = useState({ visible: false, product: null });
  const [delta, setDelta] = useState("");

  // Modal de edición (name/sku/price/stock absolutos)
  const [editModal, setEditModal] = useState({ visible: false, product: null });
  const [editForm, setEditForm] = useState({ name: "", sku: "", price: "", stock: "" });

  async function load() {
    const rows = await DB.getProducts();
    setProducts(rows || []);
  }
  useEffect(() => { load(); }, []);

  const filteredProducts = useMemo(() => {
    const term = (search || "").trim().toLowerCase();
    if (!term) return products;
    return products.filter((p) => (p.name || "").toLowerCase().includes(term));
  }, [products, search]);

  async function addProduct() {
    if (!form.name || !form.price) return Alert.alert("Nombre y precio son obligatorios");
    const price = parseFloat(String(form.price).replace(",", "."));
    const stock = parseInt(form.stock || "0", 10);
    if (Number.isNaN(price) || price < 0) return Alert.alert("Precio inválido");
    if (Number.isNaN(stock) || stock < 0) return Alert.alert("Stock inválido");
    try {
      await DB.addProduct({ name: form.name, sku: form.sku, price, stock });
      setForm({ name: "", sku: "", price: "", stock: "" });
      setModalVisible(false);
      await load();
      Alert.alert("Producto agregado");
    } catch (e) {
      Alert.alert("Error al agregar", e?.message || String(e));
    }
  }

  // --- CSV helper: detecta ; o , y maneja BOM y saltos de línea ---
  function parseCSV(text) {
    if (text && text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
    if (lines.length === 0) return [];
    const sep = lines[0].includes(";") ? ";" : ",";
    const headers = lines[0].split(sep).map((h) => h.trim());
    const out = [];
    for (let i = 1; i < lines.length; i++) {
      const raw = lines[i].trim();
      if (!raw) continue;
      const cols = raw.split(sep);
      const row = {};
      headers.forEach((h, idx) => { row[h] = (cols[idx] ?? "").trim(); });
      out.push(row);
    }
    return out;
  }

  async function importFromFile() {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        type: [
          "text/csv",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
          "*/*",
        ],
      });
      if (res.canceled) return;
      const file = res.assets?.[0]; if (!file) return;

      const ext = (file.name || "").toLowerCase().split(".").pop();
      let rows = [];
      if (ext === "csv") {
        const content = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.UTF8 });
        rows = parseCSV(content);
      } else if (ext === "xlsx" || ext === "xls") {
        const b64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
        const wb = XLSX.read(b64, { type: "base64" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(ws);
      } else {
        return Alert.alert("Formato no soportado", "Usa .csv o .xlsx");
      }

      let added = 0;
      for (const r of rows) {
        const name = (r.name ?? r.Nombre ?? r.nombre ?? "").toString().trim();
        const sku  = (r.sku ?? r.SKU ?? r.codigo ?? r.código ?? r["codigo interno"] ?? r["código interno"] ?? "")?.toString().trim() || null;
        const priceRaw = (r.price ?? r.Precio ?? r.precio ?? "").toString().trim();
        const price = Number(priceRaw.replace(",", "."));
        const stockRaw = (r.stock ?? r.Stock ?? r.existencias ?? r.cantidad ?? "0").toString().trim();
        const stockNum = Number(stockRaw.replace(",", "."));
        const stock = Number.isNaN(stockNum) ? 0 : Math.floor(stockNum);
        if (!name || Number.isNaN(price)) continue;
        await DB.addProduct({ name, sku, price, stock });
        added++;
      }
      await load();
      Alert.alert("Importación", `Se agregaron ${added} productos.`);
    } catch (e) {
      Alert.alert("Error importando", e?.message || String(e));
    }
  }

  async function applyAdjust() {
    const d = parseInt(delta || "0", 10);
    if (Number.isNaN(d)) return Alert.alert("Cantidad inválida");
    if (!stockModal.product) return;
    try {
      await DB.adjustStock(stockModal.product.id, d); // +5 suma, -2 resta
      await load();
      setStockModal({ visible: false, product: null });
      setDelta("");
      Alert.alert("OK", "Stock actualizado");
    } catch (e) {
      Alert.alert("Error", e?.message || String(e));
    }
  }

  function openEdit(product) {
    setEditForm({
      name: product.name ?? "",
      sku: product.sku ?? "",
      price: String(product.price ?? ""),
      stock: String(product.stock ?? ""),
    });
    setEditModal({ visible: true, product });
  }

  async function saveEdit() {
    const p = editModal.product;
    if (!p) return;
    if (!editForm.name || !editForm.price) return Alert.alert("Nombre y precio son obligatorios");
    const price = parseFloat(String(editForm.price).replace(",", "."));
    const stock = parseInt(editForm.stock || "0", 10);
    if (Number.isNaN(price) || price < 0) return Alert.alert("Precio inválido");
    if (Number.isNaN(stock) || stock < 0) return Alert.alert("Stock inválido");

    try {
      await DB.updateProduct(p.id, {
        name: editForm.name,
        sku: editForm.sku || null,
        price,
        stock,
      });
      await load();
      setEditModal({ visible: false, product: null });
      Alert.alert("Producto actualizado");
    } catch (e) {
      Alert.alert("Error al actualizar", e?.message || String(e));
    }
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={styles.header}>
        <Text style={styles.title}>Inventario</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button title="Importar" onPress={importFromFile} />
          <Button title="Añadir" onPress={() => setModalVisible(true)} />
        </View>
      </View>

      {/* Buscador */}
      <TextInput
        placeholder="Buscar producto..."
        value={search}
        onChangeText={setSearch}
        style={[styles.input, { marginHorizontal: 12, marginBottom: 6 }]}
        returnKeyType="search"
      />

      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 12 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text>SKU: {item.sku || "-"}</Text>
            <Text>Precio: {formatCOP(item.price)}</Text>
            <Text>Stock: {item.stock}</Text>

            <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
              <Button title="Editar" onPress={() => openEdit(item)} />
              <Button
                title="Ajustar stock"
                onPress={() => {
                  setStockModal({ visible: true, product: item });
                  setDelta("");
                }}
              />
            </View>
          </View>
        )}
      />

      {/* Modal: nuevo producto */}
      <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <SafeAreaView style={{ flex: 1, padding: 16 }}>
          <Text style={styles.modalTitle}>Nuevo producto</Text>

          <Text style={styles.label}>Nombre *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: Libro de cuentos"
            value={form.name}
            onChangeText={(v) => setForm({ ...form, name: v })}
            returnKeyType="done"
            blurOnSubmit
          />

          <Text style={styles.label}>SKU</Text>
          <TextInput
            style={styles.input}
            placeholder="Opcional (código interno)"
            value={form.sku}
            onChangeText={(v) => setForm({ ...form, sku: v })}
            returnKeyType="done"
            blurOnSubmit
          />

          <Text style={styles.label}>Precio *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: 35000"
            keyboardType="numeric"
            value={form.price}
            onChangeText={(v) => setForm({ ...form, price: v })}
            returnKeyType="done"
            blurOnSubmit
          />

          <Text style={styles.label}>Stock inicial</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: 10"
            keyboardType="numeric"
            value={form.stock}
            onChangeText={(v) => setForm({ ...form, stock: v })}
            returnKeyType="done"
            blurOnSubmit
          />

          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            <Button title="Cancelar" onPress={() => setModalVisible(false)} />
            <View style={{ width: 8 }} />
            <Button title="Guardar" onPress={addProduct} />
          </View>
        </SafeAreaView>
      </Modal>

      {/* Modal: ajustar stock */}
      <Modal
        visible={stockModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setStockModal({ visible: false, product: null })}
      >
        <TouchableWithoutFeedback onPress={() => setStockModal({ visible: false, product: null })}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.adjustCard}>
                <Text style={{ fontSize: 16, fontWeight: "600", marginBottom: 8 }}>
                  Ajustar stock: {stockModal.product?.name}
                </Text>
                <Text style={{ color: "#555", marginBottom: 4 }}>
                  Ingresa una cantidad a <Text style={{ fontWeight: "600" }}>añadir</Text> (ej. 5) o a <Text style={{ fontWeight: "600" }}>restar</Text> (ej. -2).
                </Text>
                <TextInput
                  placeholder="Cantidad (p. ej. 5 o -2)"
                  keyboardType="numeric"
                  style={styles.input}
                  value={delta}
                  onChangeText={setDelta}
                  returnKeyType="done"
                  blurOnSubmit
                />
                <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 12 }}>
                  <Button title="Cancelar" onPress={() => setStockModal({ visible: false, product: null })} />
                  <Button title="Aplicar" onPress={applyAdjust} />
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Modal: editar producto */}
      <Modal
        visible={editModal.visible}
        animationType="slide"
        onRequestClose={() => setEditModal({ visible: false, product: null })}
      >
        <SafeAreaView style={{ flex: 1, padding: 16 }}>
          <Text style={styles.modalTitle}>Editar producto</Text>

          <Text style={styles.label}>Nombre *</Text>
          <TextInput
            style={styles.input}
            value={editForm.name}
            onChangeText={(v) => setEditForm({ ...editForm, name: v })}
            returnKeyType="done"
            blurOnSubmit
          />

          <Text style={styles.label}>SKU</Text>
          <TextInput
            style={styles.input}
            value={editForm.sku}
            onChangeText={(v) => setEditForm({ ...editForm, sku: v })}
            returnKeyType="done"
            blurOnSubmit
            placeholder="Opcional"
          />

          <Text style={styles.label}>Precio *</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={editForm.price}
            onChangeText={(v) => setEditForm({ ...editForm, price: v })}
            returnKeyType="done"
            blurOnSubmit
            placeholder="Ej: 35000"
          />

          <Text style={styles.label}>Stock (valor absoluto)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={editForm.stock}
            onChangeText={(v) => setEditForm({ ...editForm, stock: v })}
            returnKeyType="done"
            blurOnSubmit
            placeholder="Ej: 10"
          />

          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            <Button title="Cancelar" onPress={() => setEditModal({ visible: false, product: null })} />
            <View style={{ width: 8 }} />
            <Button title="Guardar cambios" onPress={saveEdit} />
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 12 },
  title: { fontSize: 20, fontWeight: "bold" },
  card: { backgroundColor: "#fff", padding: 12, borderRadius: 8, marginBottom: 10, elevation: 1, shadowOpacity: 0.1 },
  cardTitle: { fontSize: 16, fontWeight: "600", marginBottom: 4 },
  label: { fontWeight: "600", marginTop: 8, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 6, padding: 8, marginBottom: 8 },
  modalTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 12 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "center", padding: 16 },
  adjustCard: { backgroundColor: "#fff", borderRadius: 12, padding: 16 },
});