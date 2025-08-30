import React, { useEffect, useState } from "react";
import { SafeAreaView, ScrollView, View, Text, TextInput, Button, Alert, StyleSheet } from "react-native";
import * as DB from "../db_cloud";

export default function NewSaleScreen() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [qtyMap, setQtyMap] = useState({});
  const [search, setSearch] = useState("");

  useEffect(() => {
    let unsubscribe = null;
    (async () => {
      if (DB.listenProducts) {
        unsubscribe = DB.listenProducts(setProducts);
      } else {
        const rows = await DB.getProducts();
        setProducts(rows);
      }
    })();
    return () => { if (typeof unsubscribe === "function") unsubscribe(); };
  }, []);

  const filteredProducts = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p =>
      (p.name || "").toLowerCase().includes(q) ||
      (p.sku  || "").toLowerCase().includes(q)
    );
  }, [products, search]);

  function addToCart(p) {
    const qty = parseInt(qtyMap[p.id] || "1", 10);
    if (Number.isNaN(qty) || qty <= 0) { Alert.alert("Cantidad inválida"); return; }
    if (qty > p.stock) { Alert.alert("Stock insuficiente"); return; }

    setCart(prev => {
      const idx = prev.findIndex(i => i.product.id === p.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + qty };
        return copy;
      }
      return [...prev, { product: p, quantity: qty }];
    });
    setQtyMap({ ...qtyMap, [p.id]: "" });
  }

  function removeFromCart(productId) {
    setCart(prev => prev.filter(i => i.product.id !== productId));
  }

  function changeQty(productId, delta) {
    setCart(prev =>
      prev
        .map(i => i.product.id === productId ? { ...i, quantity: i.quantity + delta } : i)
        .filter(i => i.quantity > 0)
    );
  }

  const total = cart.reduce((acc, i) => acc + (i.quantity * Number(i.product.price || 0)), 0);

  async function confirmSale() {
    if (cart.length === 0) return Alert.alert("Carrito vacío");
    try {
      await DB.createSale({ items: cart.map(i => ({ product_id: i.product.id, quantity: i.quantity })) });
      Alert.alert("Venta registrada", "Se descontó el stock.");
      setCart([]);
    } catch (e) {
      const msg = e?.message || e?.error_description || JSON.stringify(e);
      Alert.alert("Error registrando venta", msg);
    }
  }

  return (
    <SafeAreaView style={{ flex:1 }}>
      <ScrollView contentContainerStyle={{ padding:12 }}>
        <Text style={styles.title}>Nueva venta</Text>

        <TextInput
          placeholder="Buscar por nombre o SKU…"
          value={search}
          onChangeText={setSearch}
          style={[styles.input, { marginTop:10 }]}
        />

        <Text style={{ marginTop:8, fontWeight:"600" }}>Productos</Text>
        {filteredProducts.length === 0 ? (
          <Text>Sin resultados.</Text>
        ) : (
          filteredProducts.map((p) => (
            <View key={p.id} style={[styles.card, { padding:8 }]}>
              <Text style={styles.cardTitle}>{p.name}</Text>
              <Text>SKU: {p.sku || "-"} | Precio: {p.price} | Stock: {p.stock}</Text>
              <View style={{ flexDirection:"row", alignItems:"center", marginTop:6 }}>
                <Text style={{ marginRight:6 }}>Cant.:</Text>
                <TextInput
                  placeholder="1"
                  keyboardType="numeric"
                  value={qtyMap[p.id] ?? ""}
                  onChangeText={(v)=>setQtyMap({ ...qtyMap, [p.id]: v })}
                  style={[styles.input, { width:80, marginRight:8 }]}
                />
                <Button title="Agregar" onPress={()=>addToCart(p)} />
              </View>
            </View>
          ))
        )}

        <Text style={{ marginTop:8, fontWeight:"600" }}>Carrito</Text>
        {cart.length === 0 ? (
          <Text>Sin productos.</Text>
        ) : (
          cart.map((i) => (
            <View key={i.product.id} style={{ flexDirection:"row", alignItems:"center", justifyContent:"space-between", paddingVertical:6 }}>
              <View style={{ flex:1, paddingRight:8 }}>
                <Text style={{ fontWeight:"600" }}>{i.product.name}</Text>
                <Text>Cant.: {i.quantity}  ·  Subtotal: {i.quantity * Number(i.product.price || 0)}</Text>
              </View>
              <View style={{ flexDirection:"row", alignItems:"center", marginRight:8 }}>
                <Button title="−" onPress={()=>changeQty(i.product.id, -1)} />
                <View style={{ width:8 }} />
                <Button title="+" onPress={()=>changeQty(i.product.id, 1)} />
              </View>
              <Button title="Quitar" onPress={()=>removeFromCart(i.product.id)} />
            </View>
          ))
        )}

        <Text style={{ fontSize:18, fontWeight:"bold", marginTop:8 }}>Total: {total}</Text>

        <View style={{ flexDirection:"row", justifyContent:"space-between", marginTop:8 }}>
          <Button title="Vaciar carrito" onPress={()=>setCart([])} />
          <Button title="Confirmar venta" onPress={confirmSale} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title:{ fontSize:20, fontWeight:"bold" },
  input:{ borderWidth:1, borderColor:"#ccc", borderRadius:6, padding:8, marginVertical:8 },
  card:{ backgroundColor:"#fff", padding:12, borderRadius:8, marginBottom:10, elevation:1, shadowOpacity:0.1 },
  cardTitle:{ fontSize:16, fontWeight:"600", marginBottom:4 },
});