import React, { useEffect, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  Button,
  FlatList,
  Alert,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
  ScrollView,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as DB from "../db_cloud"; // getProducts, getCosts, addCost

export default function CostsScreen() {
  const [products, setProducts] = useState([]);
  const [costs, setCosts] = useState([]);
  const [form, setForm] = useState({
    date: "",            // ISO
    product_id: "",      // si eliges del inventario
    product_name: "",    // o escribir manual
    cost: "",
    note: "",            // textarea
  });
  const [showDate, setShowDate] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const [p, c] = await Promise.all([DB.getProducts(), DB.getCosts()]);
      setProducts(p || []);
      setCosts(c || []);
    })();
  }, []);

  const filtered = products.filter((p) =>
    (p.name || "").toLowerCase().includes(search.toLowerCase())
  );

  function pickProduct(p) {
    setForm({ ...form, product_id: p.id, product_name: p.name });
    setSearch("");
    Keyboard.dismiss();
  }

  async function saveCost() {
    const money = Number(form.cost);
    if (Number.isNaN(money) || money < 0) {
      return Alert.alert("Costo inválido");
    }
    if (!form.product_id && !form.product_name) {
      return Alert.alert("Indica un producto (elige del inventario o escribe el nombre).");
    }

    try {
      await DB.addCost({
        date: form.date || new Date().toISOString(),
        product_id: form.product_id || null,
        product_name: form.product_id ? null : (form.product_name || null),
        cost: money,
        note: form.note || null,
      });
      setForm({ date: "", product_id: "", product_name: "", cost: "", note: "" });
      const c = await DB.getCosts();
      setCosts(c || []);
      Alert.alert("Guardado", "Costo registrado.");
      Keyboard.dismiss();
    } catch (e) {
      Alert.alert("Error guardando", e?.message || String(e));
    }
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ flex: 1 }}>
            <ScrollView
              contentContainerStyle={{ padding: 12 }}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.title}>Costos</Text>

              {/* Fecha */}
              <Text style={styles.label}>Fecha</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Button
                  title={form.date ? new Date(form.date).toLocaleString() : "Elegir fecha"}
                  onPress={() => setShowDate(true)}
                />
                {!!form.date && (
                  <TouchableOpacity onPress={() => setForm({ ...form, date: "" })}>
                    <Text style={{ color: "#007AFF", marginLeft: 8 }}>Limpiar</Text>
                  </TouchableOpacity>
                )}
              </View>
              {showDate && (
                <DateTimePicker
                  value={form.date ? new Date(form.date) : new Date()}
                  mode="date" // usa "datetime" si quieres fecha+hora
                  display="default"
                  onChange={(event, selected) => {
                    setShowDate(false);
                    if (selected) setForm({ ...form, date: selected.toISOString() });
                  }}
                />
              )}

              {/* Producto: buscar y seleccionar o escribir manual */}
              <Text style={styles.label}>Producto</Text>
              <TextInput
                placeholder="Buscar en inventario…"
                style={styles.input}
                value={search}
                onChangeText={setSearch}
                returnKeyType="done"
                blurOnSubmit
              />
              {search.length > 0 && (
                <View style={styles.selectBox}>
                  {filtered.slice(0, 8).map((p) => (
                    <TouchableOpacity key={p.id} style={styles.selectItem} onPress={() => pickProduct(p)}>
                      <Text>{p.name}</Text>
                      <Text style={{ color: "#666" }}>SKU: {p.sku || "-"}</Text>
                    </TouchableOpacity>
                  ))}
                  {filtered.length === 0 && <Text style={{ color: "#666" }}>Sin coincidencias</Text>}
                </View>
              )}

              <TextInput
                placeholder="(o escribe el nombre del producto)"
                style={styles.input}
                value={form.product_name}
                onChangeText={(v) => setForm({ ...form, product_name: v, product_id: "" })}
                returnKeyType="done"
                blurOnSubmit
              />

              {/* Costo */}
              <Text style={styles.label}>Costo *</Text>
              <TextInput
                placeholder="0"
                keyboardType="numeric"
                style={styles.input}
                value={form.cost}
                onChangeText={(v) => setForm({ ...form, cost: v.replace(/[^0-9.]/g, "") })}
                returnKeyType="done"
                blurOnSubmit
              />

              {/* Observación (textarea) */}
              <Text style={styles.label}>Observación</Text>
              <TextInput
                placeholder="(opcional) escribe detalles"
                style={[styles.input, { height: 100, textAlignVertical: "top" }]}
                multiline
                numberOfLines={5}
                value={form.note}
                onChangeText={(v) => setForm({ ...form, note: v })}
                returnKeyType="done"
                blurOnSubmit
              />

              <Button title="Guardar costo" onPress={saveCost} />
            </ScrollView>

            {/* Lista */}
            <FlatList
              data={costs}
              keyExtractor={(i) => i.id}
              contentContainerStyle={{ padding: 12 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>
                    {item.products?.name || item.product_name || "(sin nombre)"}
                  </Text>
                  <Text>Fecha: {new Date(item.date).toLocaleString()}</Text>
                  <Text>Costo: {item.cost}</Text>
                  {!!item.note && <Text>Obs.: {item.note}</Text>}
                </View>
              )}
            />
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 8 },
  label: { marginTop: 8, fontWeight: "600" },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 6, padding: 8, marginVertical: 8 },
  card: { backgroundColor: "#fff", padding: 12, borderRadius: 8, marginBottom: 10, elevation: 1, shadowOpacity: 0.1 },
  cardTitle: { fontSize: 16, fontWeight: "600", marginBottom: 4 },
  selectBox: { borderWidth: 1, borderColor: "#ddd", borderRadius: 6, padding: 6, marginBottom: 8, backgroundColor: "#fafafa" },
  selectItem: { paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#eee" },
});