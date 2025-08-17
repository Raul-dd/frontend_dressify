// src/screens/Sales/EditSaleScreen.js
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, Image, TouchableOpacity, TextInput,
  FlatList, Modal, ActivityIndicator, Alert
} from "react-native";
import axios from "axios";
import Constants from "expo-constants";
import { MaterialIcons } from "@expo/vector-icons";

// API base
const RAW_BASE = (Constants.expoConfig?.extra?.apiBaseUrl) || (Constants.manifest?.extra?.apiBaseUrl) || "";
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
  
  // Lista de todos los productos disponibles
  const [products, setProducts] = useState([]);
  const [showProducts, setShowProducts] = useState(false);
  const [prodSearch, setProdSearch] = useState("");

  // ==================== CAMBIO PRINCIPAL ====================
  // AHORA: Usamos un array 'cart' para guardar los productos de la venta a editar
  const [cart, setCart] = useState([]);
  // ==========================================================
  
  const [showMethods, setShowMethods] = useState(false);
  const [method, setMethod] = useState(null);

  // Carga la lista completa de productos
  const loadProducts = useCallback(async () => {
    try {
      const res = await API.get(`/products`);
      const rows = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
      const productList = rows.map((p) => ({
        _id: toId(p._id ?? p.id),
        name: String(p.name ?? "Unnamed"),
        price: Number(p.price ?? 0),
        sale_price: Number(p.sale_price ?? 0),
      }));
      setProducts(productList);
      return productList; // Devuelve la lista para usarla inmediatamente
    } catch (error) {
      console.error("Error loading products:", error);
      return [];
    }
  }, []);

  // Carga los datos de la venta y llena el carrito
  const loadSale = useCallback(async (id, allProducts) => {
    if (!id || allProducts.length === 0) return;
    try {
      const res = await API.get(`/sales/${id}`);
      const doc = res.data?.data ?? res.data;
      setSale(doc);
      setMethod(METHODS.find((x) => x.id === doc.payment_method) || null);
      
      // AHORA: Procesa TODOS los detalles para construir el carrito inicial
      const detailsFromApi = normalizeDetails(doc.details);
      const initialCart = detailsFromApi.map(detail => {
        const productInfo = allProducts.find(p => toId(p._id) === toId(detail.product_id));
        // Si el producto aún existe en nuestro catálogo, lo agregamos
        if (productInfo) {
          return { product: productInfo, quantity: Number(detail.quantity || 1) };
        }
        return null; // Si no existe (ej. fue borrado), lo ignoramos
      }).filter(Boolean); // Filtramos los nulos
      
      setCart(initialCart);

    } catch (error) {
      console.error("Error loading sale:", error);
      Alert.alert("Error", "No se pudieron cargar los datos de la venta.");
      setCurrentScreen("ventas");
    }
  }, [setCurrentScreen]);

  // Efecto para cargar toda la información inicial
  useEffect(() => {
    (async () => {
      setLoading(true);
      const allProducts = await loadProducts();
      await loadSale(saleId, allProducts);
      setLoading(false);
    })();
  }, [loadProducts, loadSale, saleId]);

  // Lógica para el límite de tiempo de edición
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

  // ==================== CAMBIO EN CÁLCULOS ====================
  // AHORA: Los totales se calculan iterando sobre el 'cart'
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const price = item.product.sale_price > 0 ? item.product.sale_price : item.product.price;
      return sum + (price * item.quantity);
    }, 0);
  }, [cart]);
  const tax = useMemo(() => subtotal * 0.16, [subtotal]);
  const total = useMemo(() => subtotal + tax, [subtotal]);
  // ============================================================

  // Filtro para el modal de productos
  const listForModal = useMemo(() => {
    const q = prodSearch.trim().toLowerCase();
    return q ? products.filter((p) => (p.name || "").toLowerCase().includes(q)) : products;
  }, [products, prodSearch]);

  // ==================== NUEVAS FUNCIONES PARA EL CARRITO ====================
  const addProductToCart = (productToAdd) => {
    setCart(currentCart => {
      const isProductInCart = currentCart.find(item => item.product._id === productToAdd._id);
      if (isProductInCart) {
        return currentCart.map(item =>
          item.product._id === productToAdd._id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [...currentCart, { product: productToAdd, quantity: 1 }];
      }
    });
    setShowProducts(false);
    setProdSearch("");
  };

  const updateQuantity = (productId, newQuantity) => {
    const qty = Math.max(1, Number(newQuantity)); // No permitir cantidades menores a 1
    if (isNaN(qty)) return;
    setCart(currentCart =>
      currentCart.map(item =>
        item.product._id === productId ? { ...item, quantity: qty } : item
      )
    );
  };
  
  const removeFromCart = (productId) => {
    setCart(currentCart => currentCart.filter(item => item.product._id !== productId));
  };
  // ======================================================================

  const onSave = async () => {
    if (!sale || !editAllowed) return;
    if (cart.length === 0) return Alert.alert("Falta", "La venta debe tener al menos un producto.");
    if (!method) return Alert.alert("Falta", "Selecciona un método de pago.");
    
    setLoading(true);
    try {
      // AHORA: Mapeamos el 'cart' para enviar los detalles actualizados
      const updatedDetails = cart.map(item => ({
        product_id: item.product._id,
        quantity: item.quantity,
      }));
      
      const data = {
        payment_method: method.id,
        details: updatedDetails,
      };

      // Se usa POST según el código original, pero PUT/PATCH sería más común para editar
      await API.post(`/sales/${toId(sale._id)}`, data);

      Alert.alert("Guardado", "Venta actualizada correctamente.");
      setCurrentScreen("ventas");
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.message || "No se pudo actualizar la venta");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#111827" /></View>;
  }

  return (
    <View style={styles.screen}>
      <View style={styles.appbar}>
        <Text style={styles.appbarTitle}>Modificar Venta</Text>
        <Image source={require("../../../assets/logo.png")} style={styles.appbarLogo} />
      </View>

      {/* ==================== CAMBIO EN LA INTERFAZ ==================== */}
      <View style={styles.mainContent}>
        <FlatList
          data={cart}
          keyExtractor={(item) => item.product._id}
          ListHeaderComponent={
            <TouchableOpacity style={styles.addProductBtn} onPress={() => setShowProducts(true)}>
              <MaterialIcons name="add-shopping-cart" size={20} color="#fff" />
              <Text style={styles.addProductBtnText}>Agregar Producto</Text>
            </TouchableOpacity>
          }
          renderItem={({ item }) => (
            <View style={styles.cartItem}>
              <View style={styles.cartItemInfo}>
                 <Text style={styles.cartItemName} numberOfLines={1}>{item.product.name}</Text>
                 <Text style={styles.cartItemPrice}>${(item.product.sale_price > 0 ? item.product.sale_price : item.product.price).toFixed(2)} c/u</Text>
              </View>
              <View style={styles.qtyBox}>
                <TouchableOpacity onPress={() => updateQuantity(item.product._id, item.quantity - 1)} style={styles.qtyBtn}><Text style={styles.qtyBtnText}>-</Text></TouchableOpacity>
                <TextInput
                  keyboardType="number-pad"
                  value={String(item.quantity)}
                  onChangeText={(text) => updateQuantity(item.product._id, text)}
                  style={styles.qtyInput}
                  maxLength={4}
                />
                <TouchableOpacity onPress={() => updateQuantity(item.product._id, item.quantity + 1)} style={styles.qtyBtn}><Text style={styles.qtyBtnText}>＋</Text></TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => removeFromCart(item.product._id)} style={styles.deleteBtn}><MaterialIcons name="delete-outline" size={24} color="#ef4444" /></TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyCart}><Text style={styles.emptyCartText}>No hay productos en esta venta.</Text></View>
          }
          contentContainerStyle={{ flexGrow: 1, padding: 16 }}
        />
      </View>
      {/* ============================================================== */}
      
      <View style={styles.footer}>
        <TouchableOpacity style={styles.select} onPress={() => setShowMethods(true)}>
          <Text style={styles.selectText}>{method?.label || "Selecciona método de pago"}</Text>
          <MaterialIcons name="keyboard-arrow-down" size={22} color="#111827" />
        </TouchableOpacity>

        <View style={styles.totalsCard}>
            <View style={styles.totRow}><Text style={styles.totLabel}>Subtotal</Text><Text style={styles.totValue}>${subtotal.toFixed(2)}</Text></View>
            <View style={styles.totRow}><Text style={styles.totLabel}>IVA (16%)</Text><Text style={styles.totValue}>${tax.toFixed(2)}</Text></View>
            <View style={[styles.totRow, { marginTop: 8, borderTopWidth: 1, paddingTop: 8, borderColor: "#e5e7eb" }]}>
              <Text style={[styles.totLabel, { fontWeight: "bold", fontSize: 16 }]}>Total</Text>
              <Text style={[styles.totValue, { fontWeight: "bold", fontSize: 16 }]}>${total.toFixed(2)}</Text>
            </View>
        </View>

        <View style={styles.btnRow}>
          <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={() => setCurrentScreen("ventas")}><Text style={styles.btnGhostTxt}>Cancelar</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnPrimary, !editAllowed && styles.btnDisabled]} onPress={onSave} disabled={!editAllowed}><Text style={styles.btnPrimaryTxt}>Guardar Cambios</Text></TouchableOpacity>
        </View>
      </View>

      {/* Modals (Productos y Métodos) - Prácticamente sin cambios */}
      <Modal visible={showProducts} animationType="slide" transparent>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Selecciona un producto</Text>
            <View style={styles.searchBox}><TextInput placeholder="Buscar..." value={prodSearch} onChangeText={setProdSearch} style={{ flex: 1 }} autoFocus /></View>
            <FlatList
              data={listForModal}
              keyExtractor={(p) => p._id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.itemRow} onPress={() => addProductToCart(item)}><Text>{item.name}</Text></TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={{ textAlign: "center", color: "#666" }}>Sin productos</Text>}
              style={{ maxHeight: 300 }}
            />
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: "#6b7280", alignSelf: "flex-end" }]} onPress={() => setShowProducts(false)}><Text style={{ color: "#fff" }}>Cerrar</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showMethods} animationType="slide" transparent>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Método de pago</Text>
            {METHODS.map((m) => (
              <TouchableOpacity key={m.id} style={styles.itemRow} onPress={() => { setMethod(m); setShowMethods(false); }}><Text>{m.label}</Text></TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: "#6b7280", alignSelf: "flex-end" }]} onPress={() => setShowMethods(false)}><Text style={{ color: "#fff" }}>Cerrar</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Usamos los mismos estilos mejorados de la pantalla de Registrar Venta
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  appbar: { height: 56, backgroundColor: "#fff", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  appbarTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  appbarLogo: { width: 28, height: 28, resizeMode: "contain" },
  mainContent: { flex: 1 },
  addProductBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#111827', paddingVertical: 12, borderRadius: 12, marginBottom: 16, gap: 8 },
  addProductBtnText: { color: '#fff', fontWeight: 'bold' },
  emptyCart: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyCartText: { marginTop: 16, fontSize: 16, color: '#6b7280' },
  cartItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 12, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  cartItemInfo: { flex: 1, marginRight: 10 },
  cartItemName: { fontWeight: '600', color: '#1f2937' },
  cartItemPrice: { color: '#6b7280', fontSize: 12, marginTop: 2 },
  qtyBox: { flexDirection: "row", alignItems: "center", backgroundColor: '#f3f4f6', borderRadius: 8 },
  qtyInput: { paddingVertical: 4, paddingHorizontal: 12, textAlign: 'center', minWidth: 40, color: '#111827' },
  qtyBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  qtyBtnText: { fontSize: 18, color: '#374151' },
  deleteBtn: { marginLeft: 10, padding: 4 },
  footer: { backgroundColor: '#fff', padding: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  select: { backgroundColor: "#f3f4f6", height: 44, borderRadius: 12, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#e5e7eb", marginBottom: 12 },
  selectText: { flex: 1, color: "#111827" },
  totalsCard: { padding: 14, borderRadius: 12, backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb' },
  totRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
  totLabel: { color: "#374151" },
  totValue: { color: "#111827", fontWeight: '500' },
  btnRow: { flexDirection: "row", gap: 12, marginTop: 16 },
  btn: { flex: 1, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  btnPrimary: { backgroundColor: "#111827" },
  btnPrimaryTxt: { color: "#fff", fontWeight: "700" },
  btnGhost: { backgroundColor: "#d1d5db" },
  btnGhostTxt: { color: "#1f2937", fontWeight: "700" },
  btnDisabled: { backgroundColor: "#9ca3af" },
  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 18 },
  modalCard: { backgroundColor: "#fff", borderRadius: 14, padding: 16 },
  modalTitle: { fontWeight: "700", fontSize: 18, marginBottom: 16, color: '#111827' },
  modalBtn: { marginTop: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  searchBox: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, paddingHorizontal: 10, marginBottom: 10, height: 42, flexDirection: 'row', alignItems: 'center' },
  itemRow: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#e5e7eb" },
});