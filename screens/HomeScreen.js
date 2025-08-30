import React from "react";
import { SafeAreaView, View, Text, Image, StyleSheet } from "react-native";

export default function HomeScreen() {
  return (
    <SafeAreaView style={{ flex:1 }}>
      <View style={styles.container}>
        {/* Si no tienes imagen aún, comenta la línea de abajo */}
        <Image source={require("../assets/logo.png")} style={styles.logo} />
        {/*<Text style={styles.title}>Lee mi alma</Text>*/}
        <Text style={styles.subtitle}>
          Un libro es un sueño que usted tiene en sus manos. (Neil Gaiman).
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:{ flex:1, alignItems:"center", justifyContent:"center", padding:24 },
  logo:{ width:220, height:220, resizeMode:"contain", marginBottom:16 },
  title:{ fontSize:24, fontWeight:"800" },
  subtitle:{ fontSize:16 ,marginTop:8, color:"#555", textAlign:"center" },
});