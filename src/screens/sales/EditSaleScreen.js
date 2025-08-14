// src/screens/Sales/EditSaleScreen.js
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, Image, TouchableOpacity, TextInput,
  FlatList, Modal, ActivityIndicator, Alert
} from "react-native";
import axios from "axios";
import Constants from "expo-constants";
import { MaterialIcons } from "@expo/vector-icons";

// API base desde app.json
const RAW_BASE =
  (Constants.expoConfig?.extra?.apiBaseUrl) ||
  (Constants.manifest?.extra?.apiBaseUrl) ||
  "";
const API_BASE = String(RAW_BASE).replace(/\/+$/, "");
const API = axios.create({ baseURL: API_BASE });

// helpers
const toId = (raw) => {
  if (!raw) return "";
  if (typeof raw === "string") return raw;
  if (raw.$oid) return raw.$oid;
  if (raw.oid) return raw.oid;
  return String(raw);
};
const normalizeDetails = (d) => {
  if (!d) return [];
  if (Array.isArray(d)) return d;
  if (typeof d === "string") { try { return JSON.parse(d); } catch { return []; } }
  return [];
};

const METHODS = [
  { id: "cash", label: "Efectivo" },
  { id: "card", label: "Tarjeta" },
  { id: "transfer", label: "Transferencia" },
];

export default function EditSaleScreen({ saleId, setCurrentScreen }) {
  const [loading, setLoading] = useState(true);
  const [editAllowed, setEditAllowed] = useState(true);
  const [sale, setSale] = useState(null);
  const [products, setProducts] = useState([]);
  const [showProducts, setShowProducts] = useState(false);
  const [prodSearch, setProdSearch] = useState("");
  const [product, setProduct] = useState(null);
  const [qty, setQty] = useState(1);
  const [showMethods, setShowMethods] = useState(false);
  const [method, setMethod] = useState(null);

  const loadProducts = useCallback(async () => {
    const res = await API.get(`/products`);
    const rows = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
    setProducts(rows.map((p) => ({
      _id: toId(p._id ?? p.id),
      name: String(p.name ?? "Unnamed"),
      price: Number(p.price ?? 0),
      sale_price: Number(p.sale_price ?? 0),
    })));
  }, []);

  const loadSale = useCallback(async (id) => {
    if (!id) return;
    const res = await API.get(`/sales/${id}`);
    const doc = res.data?.data ?? res.data;
    setSale(doc);

    const det = normalizeDetails(doc.details)[0] || {};
    const m = METHODS.find((x) => x.id === doc.payment_method) || null;
    setMethod(m);
    setQty(Number(det.quantity || 1));

    return String(det.product_id || "");
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await loadProducts();
        const pid = await loadSale(saleId);
        if (pid) {
          const found = products.find((p) => p._id === pid);
          if (found) setProduct(found);
        }
      } catch {
        Alert.alert("Error", "No se pudo cargar la venta/productos.");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadProducts, loadSale, saleId]);

  useEffect(() => {
    if (!sale) return;
    const rawDate = sale.date || sale.created_at;
    const ts = new Date(rawDate).getTime();
    if (!isNaN(ts)) {
      const diffMinutes = Math.floor((Date.now() - ts) / 60000);
      const allowed = diffMinutes <= 10;
      setEditAllowed(allowed);
      if (!allowed) {
        Alert.alert(
          "Tiempo vencido",
          "Solo puedes modificar una venta durante los primeros 10 minutos.",
          [{ text: "OK", onPress: () => setCurrentScreen("ventas") }],
          { cancelable: false }
        );
      }
    }
  }, [sale, setCurrentScreen]);

  const unitPrice = useMemo(() => Number((product?.sale_price || product?.price) || 0), [product]);
  const subtotal = useMemo(() => +(unitPrice * qty).toFixed(2), [unitPrice, qty]);
  const tax = useMemo(() => +(subtotal * 0.16).toFixed(2), [subtotal]);
  const total = useMemo(() => +(subtotal + tax).toFixed(2), [subtotal, tax]);

  const listForModal = useMemo(() => {
    const q = prodSearch.trim().toLowerCase();
    return q ? products.filter((p) => (p.name || "").toLowerCase().includes(q)) : products;
  }, [products, prodSearch]);

  const onSave = async () => {
    if (!sale) return;
    if (!product) return Alert.alert("Falta", "Selecciona un producto.");
    if (!method) return Alert.alert("Falta", "Selecciona un método de pago.");

    try {
      setLoading(true);
      const data = {
        payment_method: method.id,
        details: [{ product_id: product._id, quantity: qty }],
      };
      await API.post(`/sales/${toId(sale._id)}`, data, {
        headers: { "Content-Type": "application/json" },
      });
      Alert.alert("Guardado", "Venta actualizada.");
      setCurrentScreen("ventas");
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.message || "No se pudo actualizar la venta");
    } finally {
      setLoading(false);
    }
  };

  const onCancel = () => setCurrentScreen("ventas");

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.appbar}>
        <Text style={styles.appbarTitle}>Modificar Venta</Text>
        <Image source={require("../../../assets/logo.png")} style={styles.appbarLogo} />
      </View>

      <View style={styles.idBox}>
        <Text style={styles.idLabel}>ID Venta</Text>
        <Text style={styles.idValue}>{sale ? (sale.code ?? toId(sale._id)) : ""}</Text>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.fieldLabel}>Producto</Text>
        <TouchableOpacity style={styles.select} onPress={() => setShowProducts(true)}>
          <Text style={styles.selectText}>{(product && product.name) || "Selecciona producto"}</Text>
          <MaterialIcons name="keyboard-arrow-down" size={22} color="#111827" />
        </TouchableOpacity>

        <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Cantidad</Text>
        <View style={styles.qtyBox}>
          <TextInput
            keyboardType="number-pad"
            value={String(qty)}
            onChangeText={(v) => setQty(Number(v) || 1)}
            style={styles.qtyInput}
          />
        </View>

        <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Método de Pago</Text>
        <TouchableOpacity style={styles.select} onPress={() => setShowMethods(true)}>
          <Text style={styles.selectText}>{(method && method.label) || "Selecciona método"}</Text>
          <MaterialIcons name="keyboard-arrow-down" size={22} color="#111827" />
        </TouchableOpacity>
      </View>

      <View style={styles.totalsCard}>
        <View style={styles.totRow}>
          <Text style={styles.totLabel}>Subtotal</Text>
          <Text style={styles.totValue}>${subtotal.toFixed(2)}</Text>
        </View>
        <View style={styles.totRow}>
          <Text style={styles.totLabel}>IVA</Text>
          <Text style={styles.totValue}>{tax.toFixed(2)}</Text>
        </View>
        <View style={styles.totRow}>
          <Text style={[styles.totLabel, { fontWeight: "700" }]}>Total</Text>
          <Text style={[styles.totValue, { fontWeight: "700" }]}>${total.toFixed(2)}</Text>
        </View>
      </View>

      <View style={styles.btnRow}>
        <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={onSave}>
          <Text style={styles.btnPrimaryTxt}>Guardar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={onCancel}>
          <Text style={styles.btnGhostTxt}>Cancelar</Text>
        </TouchableOpacity>
      </View>

      {/* Modal productos */}
      <Modal visible={showProducts} animationType="slide" transparent>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Selecciona producto</Text>
            <TextInput
              placeholder="Buscar producto..."
              value={prodSearch}
              onChangeText={setProdSearch}
              style={styles.searchBox}
            />
            <FlatList
              data={listForModal}
              keyExtractor={(p, i) => p._id || `x-${i}`}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.itemRow} onPress={() => { setProduct(item); setShowProducts(false); }}>
                  <Text>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.modalBtn} onPress={() => setShowProducts(false)}>
              <Text style={{ color: "#fff" }}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal métodos */}
      <Modal visible={showMethods} animationType="slide" transparent>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Método de pago</Text>
            {METHODS.map((m) => (
              <TouchableOpacity key={m.id} style={styles.itemRow} onPress={() => { setMethod(m); setShowMethods(false); }}>
                <Text>{m.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalBtn} onPress={() => setShowMethods(false)}>
              <Text style={{ color: "#fff" }}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  appbar: { height: 56, backgroundColor: "#e5e7eb", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 },
  appbarTitle: { fontSize: 18, fontWeight: "700" },
  appbarLogo: { width: 28, height: 28, resizeMode: "contain" },
  idBox: { marginHorizontal: 16, marginTop: 10, marginBottom: 8, backgroundColor: "#fff", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#d1d5db", flexDirection: "row", justifyContent: "space-between" },
  idLabel: { fontWeight: "700" },
  idValue: { fontWeight: "700" },
  formCard: { margin: 16, padding: 14, borderRadius: 14, backgroundColor: "#fff", borderWidth: 1, borderColor: "#d1d5db" },
  fieldLabel: { fontWeight: "700", marginBottom: 8 },
  select: { backgroundColor: "#eef2f5", height: 44, borderRadius: 12, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#e5e7eb" },
  selectText: { flex: 1 },
  qtyBox: { backgroundColor: "#eef2f5", height: 44, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: "#e5e7eb" },
  qtyInput: { flex: 1, paddingVertical: 0 },
  totalsCard: { marginHorizontal: 16, marginTop: 6, marginBottom: 8, backgroundColor: "#fff", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#d1d5db" },
  totRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  btnRow: { flexDirection: "row", gap: 8, marginHorizontal: 16, marginTop: 6 },
  btn: { flex: 1, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  btnPrimary: { backgroundColor: "#111" },
  btnPrimaryTxt: { color: "#fff", fontWeight: "700" },
  btnGhost: { backgroundColor: "#9ca3af" },
  btnGhostTxt: { color: "#fff", fontWeight: "700" },
  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "center", padding: 18 },
  modalCard: { backgroundColor: "#fff", borderRadius: 14, padding: 14 },
  modalTitle: { fontWeight: "700", fontSize: 16, marginBottom: 10 },
  modalBtn: { padding: 10, backgroundColor: "#111", borderRadius: 8, alignSelf: "flex-end" },
  searchBox: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, paddingHorizontal: 10, marginBottom: 10, height: 42, justifyContent: "center" },
  itemRow: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#e5e7eb" },
});
