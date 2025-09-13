// screens/NewSaleScreen.js
import React, { useEffect, useMemo, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  Alert,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  Switch,
} from "react-native";
import * as DB from "../db_cloud";

const fmtCOP = (n) =>
  `\$ ${Number(n || 0).toLocaleString("es-CO")}`;

export default function NewSaleScreen() {
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState("");
  const [onlyInStock, setOnlyInStock] = useState(true);

  const [cart, setCart] = useState([]); // [{product, quantity}]
  const [paymentType, setPaymentType] = useState("Efectivo");
  const [cartOpen, setCartOpen] = useState(false);

  async function load() {
    const p = await DB.getProducts();
    setProducts(p || []);
  }
  useEffect(() => { load(); }, []);

  // Filtrado rápido
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (products || [])
      .filter(p => (onlyInStock ? (p.stock ?? 0) > 0 : true))
      .filter(p => (q ? (p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)) : true));
  }, [products, query, onlyInStock]);

  // Carrito
  function addOne(p) {
    if ((p.stock ?? 0) <= 0) return Alert.alert("Sin stock");
    setCart(prev => {
      const i = prev.findIndex(x => x.product.id === p.id);
      if (i >= 0) {
        const item = prev[i];
        if (item.quantity + 1 > p.stock) { Alert.alert("Stock insuficiente"); return prev; }
        const copy = [...prev]; copy[i] = { ...item, quantity: item.quantity + 1 };
        return copy;
      }
      return [...prev, { product: p, quantity: 1 }];
    });
  }
  function removeOne(productId) {
    setCart(prev => {
      const i = prev.findIndex(x => x.product.id === productId);
      if (i < 0) return prev;
      const item = prev[i];
      if (item.quantity <= 1) return prev.filter(x => x.product.id !== productId);
      const copy = [...prev]; copy[i] = { ...item, quantity: item.quantity - 1 };
      return copy;
    });
  }
  function removeAll(productId) {
    setCart(prev => prev.filter(x => x.product.id !== productId));
  }

  const itemsCount = useMemo(() => cart.reduce((n, i) => n + i.quantity, 0), [cart]);
  const total = useMemo(() => cart.reduce((s, i) => s + i.quantity * (i.product.price || 0), 0), [cart]);

  async function doConfirmSale() {
    try {
      if (cart.length === 0) return Alert.alert("Carrito vacío");
      await DB.createSale({
        items: cart.map(i => ({ product_id: i.product.id, quantity: i.quantity })),
        paymentType,
      });
      Alert.alert("Venta registrada", `Método: ${paymentType}`);
      setCart([]);
      setPaymentType("Efectivo");
      setCartOpen(false);
      load(); // refresca inventario
    } catch (e) {
      Alert.alert("Error registrando venta", e?.message || String(e));
    }
  }

  /** Render producto (tarjeta compacta) */
  const renderItem = ({ item: p }) => (
    <View style={styles.card}>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle} numberOfLines={1}>{p.name}</Text>
        <Text style={styles.sub}>
          Precio: {fmtCOP(p.price)} | Stock: {p.stock}
        </Text>
      </View>
      <View style={styles.row}>
        <TouchableOpacity style={styles.addBtn} onPress={() => addOne(p)}>
          <Text style={styles.addBtnText}>+1</Text>
        </TouchableOpacity>
        {/* Botón “Más…” si quieres abrir un modal de cantidad en el futuro */}
        {/* <TouchableOpacity style={styles.linkBtn}><Text style={styles.linkTxt}>Más…</Text></TouchableOpacity> */}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1 }}>
      {/* Buscador + filtro como cabecera de la lista */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 12, paddingBottom: 120 }}
        ListHeaderComponent={
          <View style={{ marginBottom: 8 }}>
            <Text style={styles.title}>Nueva venta</Text>

            <TextInput
              placeholder="Buscar producto…"
              value={query}
              onChangeText={setQuery}
              style={styles.search}
              returnKeyType="search"
            />

            <View style={[styles.row, { justifyContent: "space-between", marginTop: 6, marginBottom: 8 }]}>
              <Text style={{ fontWeight: "600" }}>Productos</Text>
              <View style={styles.row}>
                <Text style={{ marginRight: 6 }}>Solo con stock</Text>
                <Switch value={onlyInStock} onValueChange={setOnlyInStock} />
              </View>
            </View>
          </View>
        }
      />

      {/* Botón flotante con resumen del carrito */}
      <TouchableOpacity
        activeOpacity={0.9}
        style={styles.fab}
        onPress={() => setCartOpen(true)}
      >
        <Text style={styles.fabTxt}>
          Carrito · {itemsCount} · {fmtCOP(total)}
        </Text>
      </TouchableOpacity>

      {/* Modal del carrito: ítems + método de pago + confirmar */}
      <Modal visible={cartOpen} animationType="slide" onRequestClose={() => setCartOpen(false)}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={{ padding: 16, paddingBottom: 8 }}>
            <Text style={styles.title}>Carrito</Text>
            <Text style={{ color: "#555" }}>
              Items: {itemsCount} · Total: <Text style={{ fontWeight: "700" }}>{fmtCOP(total)}</Text>
            </Text>
          </View>

          {cart.length === 0 ? (
            <View style={{ padding: 16 }}><Text>Sin productos.</Text></View>
          ) : (
            <FlatList
              data={cart}
              keyExtractor={(i) => i.product.id}
              contentContainerStyle={{ padding: 12, paddingBottom: 16 }}
              renderItem={({ item: i }) => (
                <View style={styles.cartRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "600" }} numberOfLines={1}>{i.product.name}</Text>
                    <Text style={{ color: "#555" }}>
                      {i.quantity} × {fmtCOP(i.product.price)} = {fmtCOP(i.quantity * i.product.price)}
                    </Text>
                  </View>
                  <View style={styles.row}>
                    <TouchableOpacity style={styles.qtyBtn} onPress={() => removeOne(i.product.id)}>
                      <Text style={styles.qtyTxt}>−</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.qtyBtn} onPress={() => addOne(i.product)}>
                      <Text style={styles.qtyTxt}>+</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.removeBtn} onPress={() => removeAll(i.product.id)}>
                      <Text style={styles.removeTxt}>Quitar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
          )}

          {/* Método de pago */}
          <View style={{ paddingHorizontal: 16 }}>
            <Text style={{ fontWeight: "600", marginBottom: 8 }}>Método de pago</Text>
            <View style={styles.payRow}>
              {["Efectivo", "Transferencia", "TC"].map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.payBtn, paymentType === m && styles.payBtnSel]}
                  onPress={() => setPaymentType(m)}
                >
                  <Text style={[styles.payTxt, paymentType === m && styles.payTxtSel]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Acciones */}
          <View style={{ padding: 16 }}>
            <TouchableOpacity
              disabled={cart.length === 0}
              style={[styles.primaryBtn, cart.length === 0 && { opacity: 0.5 }]}
              onPress={doConfirmSale}
            >
              <Text style={styles.primaryTxt}>Confirmar venta · {fmtCOP(total)}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.secondaryBtn]} onPress={() => setCartOpen(false)}>
              <Text style={styles.secondaryTxt}>Seguir agregando</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center" },

  search: {
    borderWidth: 1, borderColor: "#ccc", borderRadius: 10, padding: 10, marginBottom: 6,
    backgroundColor: "#fff",
  },

  card: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
    elevation: 1,
    shadowOpacity: 0.06,
    flexDirection: "row",
    alignItems: "center",
  },
  cardTitle: { fontSize: 16, fontWeight: "700", marginBottom: 2 },
  sub: { color: "#555" },

  addBtn: { backgroundColor: "#007AFF22", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginLeft: 10 },
  addBtnText: { color: "#007AFF", fontWeight: "700" },

  fab: {
    position: "absolute", left: 12, right: 12, bottom: 14,
    backgroundColor: "#007AFF", borderRadius: 14, paddingVertical: 14, alignItems: "center",
  },
  fabTxt: { color: "#fff", fontWeight: "700" },

  cartRow: {
    backgroundColor: "#fff", borderRadius: 10, padding: 12, marginBottom: 10,
    flexDirection: "row", alignItems: "center",
  },
  qtyBtn: {
    width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: "#ccc",
    alignItems: "center", justifyContent: "center", marginHorizontal: 4,
  },
  qtyTxt: { fontSize: 18, fontWeight: "700" },
  removeBtn: { marginLeft: 6, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: "#f5f5f5", borderRadius: 8 },
  removeTxt: { color: "#d00", fontWeight: "700" },

  payRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  payBtn: {
    flex: 1, marginHorizontal: 4, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1, borderColor: "#ccc", backgroundColor: "#f6f6f6", alignItems: "center",
  },
  payBtnSel: { backgroundColor: "#007AFF", borderColor: "#007AFF" },
  payTxt: { fontWeight: "700", color: "#333" },
  payTxtSel: { color: "#fff" },

  primaryBtn: { backgroundColor: "#007AFF", borderRadius: 12, alignItems: "center", paddingVertical: 14, marginBottom: 10 },
  primaryTxt: { color: "#fff", fontWeight: "800" },
  secondaryBtn: { backgroundColor: "#eee", borderRadius: 12, alignItems: "center", paddingVertical: 13 },
  secondaryTxt: { color: "#333", fontWeight: "700" },
});