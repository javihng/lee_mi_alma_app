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
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
  ScrollView,
} from "react-native";
import * as DB from "../db_cloud"; // getCustomers, addCustomer

export default function CustomersScreen() {
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ name: "", phone: "", email: "", interest: "" });

  function isEmailValid(e) {
    if (!e) return true; // opcional
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  }
  function isPhoneValid(p) {
    if (!p) return true; // opcional
    return /^\+?[0-9]{7,15}$/.test(p);
  }

  async function load() {
    const rows = await DB.getCustomers();
    setCustomers(rows || []);
  }
  useEffect(() => { load(); }, []);

  async function addCustomer() {
    if (!form.name) return Alert.alert("Nombre requerido");
    if (!isEmailValid(form.email)) return Alert.alert("Email inválido");
    if (!isPhoneValid(form.phone)) return Alert.alert("Teléfono inválido");

    try {
      await DB.addCustomer(form); // {name, phone, email, interest}
      setForm({ name: "", phone: "", email: "", interest: "" });
      await load();
      Alert.alert("Cliente agregado");
      Keyboard.dismiss();
    } catch (e) {
      Alert.alert("Error al agregar", e?.message || String(e));
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
              <Text style={styles.title}>Clientes</Text>

              <TextInput
                placeholder="Nombre *"
                style={styles.input}
                value={form.name}
                onChangeText={(v) => setForm({ ...form, name: v })}
                returnKeyType="done"
                blurOnSubmit
              />
              <TextInput
                placeholder="Email"
                style={styles.input}
                autoCapitalize="none"
                keyboardType="email-address"
                value={form.email}
                onChangeText={(v) => setForm({ ...form, email: v.trim() })}
                returnKeyType="done"
                blurOnSubmit
              />
              <TextInput
                placeholder="Celular"
                style={styles.input}
                keyboardType="phone-pad"
                value={form.phone}
                onChangeText={(v) => setForm({ ...form, phone: v.replace(/\s/g, "") })}
                returnKeyType="done"
                blurOnSubmit
              />
              {/* Textarea interés */}
              <TextInput
                placeholder="Interés del cliente (varias líneas)"
                style={[styles.input, { height: 100, textAlignVertical: "top" }]}
                value={form.interest}
                onChangeText={(v) => setForm({ ...form, interest: v })}
                multiline
                numberOfLines={5}
                returnKeyType="done"
                blurOnSubmit
              />
              <Button title="Agregar cliente" onPress={addCustomer} />
            </ScrollView>

            {/* Lista */}
            <FlatList
              data={customers}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 12 }}
              renderItem={({ item }) => (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  <Text>Tel: {item.phone || "-"}</Text>
                  <Text>Email: {item.email || "-"}</Text>
                  {!!item.interest && <Text>Interés: {item.interest}</Text>}
                </View>
              )}
              keyboardShouldPersistTaps="handled"
            />
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 8 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 6, padding: 8, marginVertical: 8 },
  card: { backgroundColor: "#fff", padding: 12, borderRadius: 8, marginBottom: 10, elevation: 1, shadowOpacity: 0.1 },
  cardTitle: { fontSize: 16, fontWeight: "600", marginBottom: 4 },
});