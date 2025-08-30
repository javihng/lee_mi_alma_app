import React, { useEffect, useState } from "react";
import { SafeAreaView, View, Text, FlatList, TouchableOpacity, Modal, Button, Alert, StyleSheet } from "react-native";
import * as DB from "../db_cloud";
import { exportSalesToCSV } from "../utils/export";

export default function SalesScreen() {
  const [sales, setSales] = useState([]);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailItems, setDetailItems] = useState([]);
  const [detailSale, setDetailSale] = useState(null);

  async function load(){ setSales(await DB.getSales()); }
  useEffect(() => { load(); }, []);

  async function openDetail(sale) {
    const items = await DB.getSaleItemsBySaleId(sale.id);
    setDetailSale(sale);
    setDetailItems(items);
    setDetailVisible(true);
  }

  async function onExport() {
    try {
      const uri = await exportSalesToCSV();
      Alert.alert("Exportación lista", "Se generó el CSV y se abrió el diálogo de compartir.");
      console.log("CSV:", uri);
    } catch (e) {
      Alert.alert("Error exportando", e?.message || String(e));
    }
  }

  return (
    <SafeAreaView style={{ flex:1 }}>
      <View style={styles.header}>
        <Text style={styles.title}>Ventas</Text>
        <Button title="Exportar CSV" onPress={onExport} />
      </View>

      <FlatList
        data={sales}
        keyExtractor={(item)=>item.id}
        contentContainerStyle={{ padding:12 }}
        renderItem={({ item })=>(
          <TouchableOpacity onPress={()=>openDetail(item)}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.id}</Text>
              <Text>Fecha: {new Date(item.datetime).toLocaleString()}</Text>
              <Text>Total: {item.total}</Text>
              <Text style={{ color:"#007aff", marginTop:6 }}>Ver detalle</Text>
            </View>
          </TouchableOpacity>
        )}
      />

      <Modal visible={detailVisible} animationType="slide" onRequestClose={()=>setDetailVisible(false)}>
        <SafeAreaView style={{ flex:1, padding:16 }}>
          <Text style={styles.modalTitle}>Detalle de venta</Text>
          {detailSale && (
            <>
              <Text>ID: {detailSale.id}</Text>
              <Text>Fecha: {new Date(detailSale.datetime).toLocaleString()}</Text>
              <Text style={{ fontWeight:"600", marginTop:8 }}>Ítems</Text>
              <FlatList
                data={detailItems}
                keyExtractor={(it)=>it.id}
                renderItem={({item})=>(
                  <View style={{ paddingVertical:6, borderBottomWidth:1, borderBottomColor:"#eee" }}>
                    <Text style={{ fontWeight:"600" }}>{item.product_name}</Text>
                    <Text>Cant.: {item.quantity}  |  Precio: {item.unit_price}  |  Subtotal: {item.subtotal}</Text>
                  </View>
                )}
              />
              <Text style={{ fontSize:16, fontWeight:"bold", marginTop:12 }}>Total: {detailSale.total}</Text>
              <View style={{ marginTop:12 }}>
                <Button title="Cerrar" onPress={()=>setDetailVisible(false)} />
              </View>
            </>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header:{ flexDirection:"row", justifyContent:"space-between", alignItems:"center", padding:12 },
  title:{ fontSize:20, fontWeight:"bold" },
  card:{ backgroundColor:"#fff", padding:12, borderRadius:8, marginBottom:10, elevation:1, shadowOpacity:0.1 },
  cardTitle:{ fontSize:16, fontWeight:"600", marginBottom:4 },
  modalTitle:{ fontSize:18, fontWeight:"bold", marginBottom:12 },
});