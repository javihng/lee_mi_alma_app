// App.js
import 'react-native-gesture-handler';
import React, { useEffect, useState } from "react";
import { SafeAreaView, Text } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

// Capa de datos (Supabase)
import * as DB from "./db_cloud";

// Screens separadas
import HomeScreen from "./screens/HomeScreen";
import InventoryScreen from "./screens/InventoryScreen";
import CustomersScreen from "./screens/CustomersScreen";
import SalesScreen from "./screens/SalesScreen";
import NewSaleScreen from "./screens/NewSaleScreen";
import CostsScreen from "./screens/CostsScreen";

const Tab = createBottomTabNavigator();

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await DB.init?.(); // no-op en db_cloud, mantiene compatibilidad
        setReady(true);
      } catch (e) {
        console.log("DB init error:", e);
        alert(e?.message || String(e));
      }
    })();
  }, []);

  if (!ready) {
    return (
      <SafeAreaView style={{ flex:1, alignItems:"center", justifyContent:"center" }}>
        <Text>Inicializando base de datos…</Text>
      </SafeAreaView>
    );
  }

  return (
    <NavigationContainer>
      <Tab.Navigator
        initialRouteName="Inicio"
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ focused, color, size }) => {
            let name = "ellipse";
            if (route.name === "Inicio") name = focused ? "home" : "home-outline";
            if (route.name === "Nueva venta") name = focused ? "cart" : "cart-outline";
            if (route.name === "Inventario") name = focused ? "cube" : "cube-outline";
            if (route.name === "Clientes") name = focused ? "people" : "people-outline";
            if (route.name === "Ventas") name = focused ? "receipt" : "receipt-outline";
            if (route.name === "Costos") name = focused ? "cash" : "cash-outline";
            return <Ionicons name={name} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Inicio" component={HomeScreen} />
        <Tab.Screen name="Nueva venta" component={NewSaleScreen} />
        <Tab.Screen name="Inventario" component={InventoryScreen} />
        <Tab.Screen name="Clientes" component={CustomersScreen} />
        <Tab.Screen name="Ventas" component={SalesScreen} />
        <Tab.Screen name="Costos" component={CostsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}