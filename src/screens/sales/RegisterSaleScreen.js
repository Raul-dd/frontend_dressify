// src/screens/Sales/RegisterSale.js
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, Image, TouchableOpacity, TextInput,
  FlatList, Modal, Pressable, ActivityIndicator, Alert
} from "react-native";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import axios from "axios";
import Constants from "expo-constants";

// --- API base desde app.json ---
const RAW_BASE =
  (Constants.expoConfig && Constants.expoConfig.extra && Constants.expoConfig.extra.apiBaseUrl) ||
  (Constants.manifest && Constants.manifest.extra && Constants.manifest.extra.apiBaseUrl) ||
  "";
const API_BASE = String(RAW_BASE).replace(/\/+$/, "");
const API = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { Accept: "application/json" },
});

// Métodos de pago
const METHODS = [
  { id: "cash",     label: "Efectivo" },
  { id: "card",     label: "Tarjeta" },
  { id: "transfer", label: "Transferencia" },
];

export default function RegisterSaleScreen({ setCurrentScreen }) {
  const [loading, setLoading] = useState(true);

  // Lista de todos los productos disponibles
  const [products, setProducts] = useState([]);
  const [prodSearch, setProdSearch] = useState("");
  const [showProducts, setShowProducts] = useState(false);
  
  // ==================== CAMBIO PRINCIPAL ====================
  // AHORA: Usamos un array 'cart' para guardar los productos de la venta
  // Cada item tendrá: { product: {...}, quantity: N }
  const [cart, setCart] = useState([]);
  // ==========================================================

  // Método de pago
  const [showMethods, setShowMethods] = useState(false);
  const [method, setMethod] = useState(null);

  // ===== Cargar productos =====
  const loadProducts = useCallback(async () => {
    try {
      const res = await API.get(`/products`);
      const rows = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);

      const seen = new Set();
      const list = [];
      rows.forEach((p) => {
        const id = String(p?._id ?? p?.id ?? "");
        if (!id || seen.has(id)) return;
        seen.add(id);
        list.push({
          _id: id,
          name: String(p?.name ?? "Unnamed"),
          price: Number(p?.price ?? 0),
          sale_price: Number(p?.sale_price ?? 0),
        });
      });
      setProducts(list);
    } catch (e) {
      console.log("loadProducts error:", e?.message);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  // ==================== CAMBIO EN CÁLCULOS ====================
  // AHORA: Los totales se calculan iterando sobre el 'cart'
  const subtotal = useMemo(() => {
    const totalValue = cart.reduce((sum, item) => {
      const price = item.product.sale_price > 0 ? item.product.sale_price : item.product.price;
      return sum + (price * item.quantity);
    }, 0);
    return +totalValue.toFixed(2);
  }, [cart]);

  const tax = useMemo(() => +(subtotal * 0.16).toFixed(2), [subtotal]); // IVA 16%
  const total = useMemo(() => +(subtotal + tax).toFixed(2), [subtotal, tax]);
  // ============================================================

  // Lista de productos filtrada para el modal
  const listForModal = useMemo(() => {
    const base = products;
    const q = prodSearch.trim().toLowerCase();
    return q ? base.filter(p => (p.name || "").toLowerCase().includes(q)) : base;
  }, [products, prodSearch]);

  const chooseMethod = (m) => { setMethod(m); setShowMethods(false); };

  // ==================== NUEVAS FUNCIONES PARA EL CARRITO ====================
  const addProductToCart = (productToAdd) => {
    setCart(currentCart => {
      const isProductInCart = currentCart.find(item => item.product._id === productToAdd._id);
      if (isProductInCart) {
        // Si ya está, solo incrementa la cantidad
        return currentCart.map(item =>
          item.product._id === productToAdd._id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        // Si no está, lo agrega con cantidad 1
        return [...currentCart, { product: productToAdd, quantity: 1 }];
      }
    });
    setShowProducts(false); // Cierra el modal
    setProdSearch("");     // Limpia la búsqueda
  };

  const updateQuantity = (productId, newQuantity) => {
    const qty = Number(newQuantity);
    if (isNaN(qty) || qty < 1) return; // No permitir cantidades menores a 1

    setCart(currentCart =>
      currentCart.map(item =>
        item.product._id === productId
          ? { ...item, quantity: Math.min(9999, qty) } // Limita la cantidad máxima
          : item
      )
    );
  };
  
  const removeFromCart = (productId) => {
    setCart(currentCart => currentCart.filter(item => item.product._id !== productId));
  };
  // ======================================================================

  const onConfirm = async () => {
    if (cart.length === 0) return Alert.alert("Falta", "Agrega al menos un producto a la venta.");
    if (!method) return Alert.alert("Falta", "Selecciona un método de pago.");

    try {
      setLoading(true);
      // AHORA: Mapeamos el 'cart' para enviar los detalles a la API
      const details = cart.map(item => ({
        product_id: item.product._id,
        quantity: item.quantity,
      }));

      await API.post(`/sales`, {
        payment_method: method.id,
        details: details,
      });

      Alert.alert("Éxito", "Venta creada correctamente.");
      setCart([]); setMethod(null);
      setCurrentScreen("ventas"); // 👈 volver al historial
    } catch (e) {
      console.log("create sale error:", e?.response?.data || e?.message);
      Alert.alert("Error", e?.response?.data?.message || "No se pudo crear la venta");
    } finally {
      setLoading(false);
    }
  };

  const onCancel = () => {
    setCart([]); setMethod(null);
    setCurrentScreen("ventas");
  };
  
  if (loading && products.length === 0) {
    return <View style={styles.center}><ActivityIndicator /></View>;
  }

  return (
    <View style={styles.screen}>
      {/* AppBar */}
      <View style={styles.appbar}>
        <Text style={styles.appbarTitle}>Registrar Venta</Text>
        <Image source={require("../../../assets/logo.png")} style={styles.appbarLogo} />
      </View>

      {/* ==================== CAMBIO EN LA INTERFAZ ==================== */}
      <View style={styles.mainContent}>
        {/* Lista de productos en el carrito */}
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
                 <Text style={styles.cartItemPrice}>
                    ${(item.product.sale_price > 0 ? item.product.sale_price : item.product.price).toFixed(2)} c/u
                 </Text>
              </View>
              <View style={styles.qtyBox}>
                <TouchableOpacity onPress={() => updateQuantity(item.product._id, item.quantity - 1)} style={styles.qtyBtn}>
                  <Text style={styles.qtyBtnText}>-</Text>
                </TouchableOpacity>
                <TextInput
                  keyboardType="number-pad"
                  value={String(item.quantity)}
                  onChangeText={(text) => updateQuantity(item.product._id, text)}
                  style={styles.qtyInput}
                  maxLength={4}
                />
                <TouchableOpacity onPress={() => updateQuantity(item.product._id, item.quantity + 1)} style={styles.qtyBtn}>
                  <Text style={styles.qtyBtnText}>＋</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => removeFromCart(item.product._id)} style={styles.deleteBtn}>
                <MaterialIcons name="delete-outline" size={24} color="#ef4444" />
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyCart}>
              <MaterialIcons name="shopping-cart-checkout" size={60} color="#9ca3af" />
              <Text style={styles.emptyCartText}>El carrito está vacío</Text>
              <Text style={styles.emptyCartSubText}>Agrega productos para comenzar una venta.</Text>
            </View>
          }
          contentContainerStyle={{ flexGrow: 1, padding: 16 }}
        />
      </View>
      {/* ============================================================== */}
      
      {/* Totales y Acciones (se muestran solo si hay algo en el carrito) */}
      {cart.length > 0 && (
        <View style={styles.footer}>
          {/* Método de pago */}
          <Pressable style={styles.select} onPress={() => setShowMethods(true)}>
            <Text style={styles.selectText}>{method?.label || "Selecciona método de pago"}</Text>
            <MaterialIcons name="keyboard-arrow-down" size={22} color="#111827" />
          </Pressable>

          {/* Totales */}
          <View style={styles.totalsCard}>
            <View style={styles.totRow}><Text style={styles.totLabel}>Subtotal</Text><Text style={styles.totValue}>${subtotal.toFixed(2)}</Text></View>
            <View style={styles.totRow}><Text style={styles.totLabel}>IVA (16%)</Text><Text style={styles.totValue}>${tax.toFixed(2)}</Text></View>
            <View style={[styles.totRow, { marginTop: 8, borderTopWidth: 1, paddingTop: 8, borderColor: "#e5e7eb" }]}>
              <Text style={[styles.totLabel, { fontWeight: "bold", fontSize: 16 }]}>Total</Text>
              <Text style={[styles.totValue, { fontWeight: "bold", fontSize: 16 }]}>${total.toFixed(2)}</Text>
            </View>
          </View>

          {/* Botones */}
          <View style={styles.btnRow}>
            <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={onCancel}>
              <Text style={styles.btnGhostTxt}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={onConfirm}>
              <Text style={styles.btnPrimaryTxt}>Confirmar Venta</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Modal Productos */}
      <Modal visible={showProducts} animationType="slide" transparent>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Selecciona un producto</Text>
            <View style={styles.searchBox}>
              <TextInput placeholder="Buscar..." value={prodSearch} onChangeText={setProdSearch} style={{ flex: 1 }} autoFocus />
            </View>
            <FlatList
              data={listForModal}
              keyExtractor={(p, i) => p._id || String(i)}
              renderItem={({ item }) => (
                // AHORA: Llama a addProductToCart en lugar de chooseProduct
                <TouchableOpacity style={styles.itemRow} onPress={() => addProductToCart(item)}>
                  <Text>{item.name}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={{ textAlign: "center", color: "#666" }}>Sin productos</Text>}
              style={{ maxHeight: 300 }} // Limita la altura de la lista
            />
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: "#6b7280", alignSelf: "flex-end", marginTop: 10 }]} onPress={() => setShowProducts(false)}>
              <Text style={{ color: "#fff" }}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Métodos */}
      <Modal visible={showMethods} animationType="slide" transparent>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Método de pago</Text>
            {METHODS.map((m) => (
              <TouchableOpacity key={m.id} style={styles.itemRow} onPress={() => chooseMethod(m)}>
                <Text>{m.label}</Text>
              </TouchableOpacity>
            ))}
             <TouchableOpacity style={[styles.modalBtn, { backgroundColor: "#6b7280", alignSelf: "flex-end", marginTop: 10 }]} onPress={() => setShowMethods(false)}>
              <Text style={{ color: "#fff" }}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Pantalla de carga global */}
      {loading && products.length > 0 && (
         <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#111"/>
         </View>
      )}

    </View>
  );
}


// ==================== ESTILOS ACTUALIZADOS ====================
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' },
  appbar: { height: 56, backgroundColor: "#fff", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  appbarTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  appbarLogo: { width: 28, height: 28, resizeMode: "contain" },
  mainContent: { flex: 1 },
  addProductBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#111827', paddingVertical: 12, borderRadius: 12, marginBottom: 16, gap: 8 },
  addProductBtnText: { color: '#fff', fontWeight: 'bold' },
  emptyCart: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40, paddingBottom: 60 },
  emptyCartText: { marginTop: 16, fontSize: 18, fontWeight: '600', color: '#374151' },
  emptyCartSubText: { marginTop: 4, color: '#6b7280' },
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
  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 18 },
  modalCard: { backgroundColor: "#fff", borderRadius: 14, padding: 16, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  modalTitle: { fontWeight: "700", fontSize: 18, marginBottom: 16, color: '#111827' },
  modalBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  searchBox: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, paddingHorizontal: 10, marginBottom: 10, height: 42, flexDirection: 'row', alignItems: 'center' },
  itemRow: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#e5e7eb" },
});