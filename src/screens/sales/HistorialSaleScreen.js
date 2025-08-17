import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  RefreshControl, TextInput, TouchableOpacity, Image, Modal, Pressable, Alert
} from "react-native";
import { Calendar } from "react-native-calendars";
import axios from "axios";
import Constants from "expo-constants";
import { MaterialIcons } from "@expo/vector-icons";

// --- BASE URL desde app.json ---
const RAW_BASE =
  (Constants.expoConfig?.extra?.apiBaseUrl) ||
  (Constants.manifest?.extra?.apiBaseUrl) ||
  "";
const API_BASE = String(RAW_BASE).replace(/\/+$/, "");

const API = axios.create({
  baseURL: API_BASE,
  timeout: 20000,
  headers: { Accept: "application/json" },
});

// --- Funciones Helper ---
const toId = (raw) => {
  if (!raw) return "";
  if (typeof raw === "string") return raw;
  if (raw?.oid) return raw.oid;
  if (raw?.$oid) return raw.$oid;
  return String(raw);
};

const normalizeDetails = (d) => {
  if (!d) return [];
  if (Array.isArray(d)) return d;
  if (typeof d === "string") { try { return JSON.parse(d); } catch { return []; } }
  return [];
};

const fdate = (s) => (s ? new Date(s).toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : "-");
const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;


// ==================== Componente Optimizado para la Tarjeta de Venta ====================
const SaleCard = React.memo(({ item, onEdit, onCancel }) => {
  const details = normalizeDetails(item.details);
  const isCancelled = item.status === 'cancelled';

  return (
    <View style={[styles.saleCard, isCancelled && styles.cancelledCard]}>
      <View style={styles.cardHeader}>
        <Text style={styles.saleDate}>{fdate(item.date)}</Text>
        <View style={[styles.statusBadge, { backgroundColor: isCancelled ? '#fee2e2' : '#dcfce7' }]}>
          <MaterialIcons name={isCancelled ? 'cancel' : 'check-circle'} size={14} color={isCancelled ? '#991b1b' : '#166534'} />
          <Text style={[styles.statusText, { color: isCancelled ? '#991b1b' : '#166534' }]}>
            {isCancelled ? 'Cancelada' : 'Completada'}
          </Text>
        </View>
      </View>
      <View style={styles.divider} />
      <View style={styles.detailsContainer}>
        {details.map((detail, index) => {
          const price = Number(detail.unitPrice || detail.price || 0);
          const name = detail.name || 'Producto desconocido';
          const quantity = Number(detail.quantity || 0);
          const subtotal = (price * quantity).toFixed(2);

          return (
            <View key={`${toId(item._id)}-${index}`} style={styles.detailRow}>
              <View style={styles.productInfo}>
                <Text style={styles.productName} numberOfLines={1}>
                  <Text style={styles.productQty}>{quantity}x</Text> {name}
                </Text>
                <Text style={styles.productUnitPrice}>@ ${price.toFixed(2)} c/u</Text>
              </View>
              <Text style={styles.productSubtotal}>${subtotal}</Text>
            </View>
          );
        })}
      </View>
      <View style={styles.divider} />
      <View style={styles.cardFooter}>
        <Text style={styles.totalLabel}>Total: <Text style={styles.totalValue}>${item.total?.toFixed(2) ?? "0.00"}</Text></Text>
        {!isCancelled && (
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.iconButton} onPress={() => onEdit(toId(item._id))}><MaterialIcons name="edit" size={18} color="#4b5563" /></TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={() => onCancel(item)}><MaterialIcons name="delete" size={18} color="#ef4444" /></TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
});

// ==================== Componente Principal de la Pantalla ====================
export default function HistorialSaleScreen({ onRegister, onEdit }) {
  // Estados para la data y UI
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Estados para los filtros
  const [products, setProducts] = useState([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [productId, setProductId] = useState("");
  const [productLabel, setProductLabel] = useState("Filtrar por producto");
  
  // Estados para los modales
  const [showCal, setShowCal] = useState(false);
  const [tmpStart, setTmpStart] = useState("");
  const [tmpEnd, setTmpEnd] = useState("");
  const [showProducts, setShowProducts] = useState(false);
  const [prodSearch, setProdSearch] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [saleToCancel, setSaleToCancel] = useState(null);

  const loadProducts = useCallback(async () => {
    try {
      const res = await API.get(`/products/names`);
      const raw = Array.isArray(res.data) ? res.data : [];
      setProducts(raw.map((p) => ({ 
        _id: toId(p.id || p._id), 
        name: String(p.name || "Unnamed"),
      })));
    } catch (e) {
      console.log("loadProducts error:", e?.message);
    }
  }, []);

  const fetchPage = useCallback(async (p = 1, replace = false) => {
    const endpointLoading = p === 1;
    if (endpointLoading) setLoading(true);

    try {
      const qs = new URLSearchParams({
        per_page: "10",
        page: String(p),
        ...(dateFrom ? { date_from: dateFrom } : {}),
        ...(dateTo ? { date_to: dateTo } : {}),
        ...(productId ? { product_id: productId } : {}),
      }).toString();
      const res = await API.get(`/sales?${qs}`);
      const list = res.data?.data || [];
      const sorted = (list || []).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      setItems((prev) => (replace ? sorted : [...prev, ...sorted]));
      setPage(res.data?.current_page || 1);
      setLastPage(res.data?.last_page || 1);
    } catch (e) {
      console.log("fetchPage error:", e?.message);
      if (p === 1) setItems([]);
    } finally {
        if (endpointLoading) setLoading(false);
    }
  }, [dateFrom, dateTo, productId]);
  
  // Carga inicial de productos
  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Carga las ventas cuando cambian los filtros
  useEffect(() => {
    fetchPage(1, true);
  }, [dateFrom, dateTo, productId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPage(1, true);
    setRefreshing(false);
  }, [fetchPage]); // fetchPage ya depende de los filtros, así que esto es correcto

  const loadMore = async () => { if (!loading && !refreshing && page < lastPage) await fetchPage(page + 1); };

  const openCancelModal = (sale) => { setSaleToCancel(sale); setShowCancelModal(true); };

  const confirmCancel = async () => {
    if (!saleToCancel) return;
    const saleId = toId(saleToCancel._id);
    const originalSale = items.find(item => toId(item._id) === saleId);
    if (!originalSale) return;

    setShowCancelModal(false);
    setItems(currentItems => 
      currentItems.map(item => {
        if (toId(item._id) === saleId) return { ...item, status: 'cancelled' };
        return item;
      })
    );
    
    try {
      await API.delete(`/sales/${saleId}`);
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.message || "No se pudo cancelar la venta");
      setItems(currentItems => 
        currentItems.map(item => {
          if (toId(item._id) === saleId) return originalSale;
          return item;
        })
      );
      console.log("Cancel sale error:", e?.response?.data || e?.message);
    } finally {
      setSaleToCancel(null);
    }
  };

  const marked = useMemo(() => {
    const m = {};
    if (tmpStart) m[tmpStart] = { startingDay: true, color: "#111", textColor: "white" };
    if (tmpEnd) m[tmpEnd] = { endingDay: true, color: "#111", textColor: "white" };
    return m;
  }, [tmpStart, tmpEnd]);

  const onDayPress = (d) => {
    if (!tmpStart || (tmpStart && tmpEnd)) { setTmpStart(d.dateString); setTmpEnd(""); } 
    else { setTmpEnd(d.dateString); }
  };
  const confirmDates = () => {
    let a = tmpStart, b = tmpEnd || tmpStart;
    if (new Date(a) > new Date(b)) { const t = a; a = b; b = t; }
    setDateFrom(a); setDateTo(b);
    setShowCal(false);
  };
  
  const listForModal = useMemo(() => {
    const base = [{ _id: "", name: "Todos los productos" }];
    const q = prodSearch.trim().toLowerCase();
    return q ? [...base, ...products].filter((p) => (p.name || "").toLowerCase().includes(q)) : [...base, ...products];
  }, [products, prodSearch]);

  const chooseProduct = (p) => {
    setProductId(p._id || "");
    setProductLabel(p.name || "Filtrar por producto");
    setShowProducts(false);
  };
  
  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setProductId("");
    setProductLabel("Filtrar por producto");
  };

  return (
    <View style={styles.screen}>
      <View style={styles.appbar}><Text style={styles.appbarTitle}>Historial de Ventas</Text><Image source={require("../../../assets/logo.png")} style={styles.appbarLogo} /></View>
      <View style={styles.filtersCard}>
        <View style={styles.filtersHeader}><Text style={styles.filtersTitle}>Filtros</Text><TouchableOpacity onPress={clearFilters}><Text style={styles.resetLink}>Restablecer</Text></TouchableOpacity></View>
        <View style={styles.filtersRow}>
          <Pressable style={styles.filterPill} onPress={() => { setTmpStart(dateFrom); setTmpEnd(dateTo); setShowCal(true); }}><MaterialIcons name="date-range" size={16} color="#4b5563" /><Text style={styles.filterPillTxt}>{dateFrom && dateTo ? `${dateFrom} → ${dateTo}` : "Fecha"}</Text></Pressable>
          <Pressable style={styles.filterPill} onPress={() => setShowProducts(true)}><MaterialIcons name="inventory-2" size={16} color="#4b5563" /><Text style={styles.filterPillTxt} numberOfLines={1}>{productLabel}</Text></Pressable>
        </View>
      </View>
      
      {loading && <ActivityIndicator style={styles.mainLoader} size="large" />}
      
      <FlatList
        data={items}
        keyExtractor={(item) => toId(item?._id)}
        renderItem={({ item }) => <SaleCard item={item} onEdit={onEdit} onCancel={openCancelModal} />}
        contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: 100 }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#111827"]} />}
        ListEmptyComponent={!loading ? <View style={styles.emptyContainer}><Text style={styles.emptyText}>No se encontraron ventas.</Text></View> : null}
      />
      <TouchableOpacity style={styles.fab} onPress={onRegister}><MaterialIcons name="add" size={24} color="#fff" /></TouchableOpacity>
      
      {/* Modales */}
      <Modal visible={showCal} animationType="fade" transparent>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowCal(false)}>
              <Pressable style={styles.modalCard}>
                  <Text style={styles.modalTitle}>Selecciona un rango de fechas</Text>
                  <Calendar markingType="period" markedDates={marked} onDayPress={onDayPress} />
                  <View style={styles.modalFooter}>
                      <TouchableOpacity onPress={() => setShowCal(false)} style={[styles.modalBtn, styles.modalBtnSecondary]}><Text>Cancelar</Text></TouchableOpacity>
                      <TouchableOpacity onPress={confirmDates} style={[styles.modalBtn, styles.modalBtnPrimary]}><Text style={{ color: "#fff" }}>Aplicar</Text></TouchableOpacity>
                  </View>
              </Pressable>
          </Pressable>
      </Modal>

      <Modal visible={showProducts} animationType="fade" transparent>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowProducts(false)}>
              <Pressable style={[styles.modalCard, { height: '60%' }]}>
                  <Text style={styles.modalTitle}>Filtrar por producto</Text>
                  <View style={styles.searchBox}><TextInput placeholder="Buscar..." value={prodSearch} onChangeText={setProdSearch} autoFocus style={{ flex: 1 }} /></View>
                  <FlatList
                      data={listForModal}
                      keyExtractor={(item, index) => item._id || `p-${index}`}
                      renderItem={({ item }) => (
                          <TouchableOpacity style={styles.itemRow} onPress={() => chooseProduct(item)}>
                              <Text>{item.name}</Text>
                          </TouchableOpacity>
                      )}
                  />
              </Pressable>
          </Pressable>
      </Modal>

      <Modal visible={showCancelModal} animationType="fade" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirmar Cancelación</Text>
            <Text style={styles.confirmText}>Esta acción marcará la venta como <Text style={{ fontWeight: 'bold' }}>Cancelada</Text>. ¿Deseas continuar?</Text>
            <View style={styles.modalFooter}>
              <TouchableOpacity onPress={() => setShowCancelModal(false)} style={[styles.modalBtn, styles.modalBtnSecondary]}><Text>No, volver</Text></TouchableOpacity>
              <TouchableOpacity onPress={confirmCancel} style={[styles.modalBtn, styles.modalBtnDanger]}><Text style={{ color: "#fff" }}>Sí, cancelar</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f3f4f6" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  mainLoader: { marginVertical: 20 },
  appbar: { height: 56, backgroundColor: "#fff", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  appbarTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  appbarLogo: { width: 28, height: 28, resizeMode: "contain" },
  filtersCard: { padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  filtersHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  filtersTitle: { fontSize: 16, fontWeight: "bold", color: "#111827" },
  resetLink: { color: "#6b7280", fontSize: 13, fontWeight: '500' },
  filtersRow: { flexDirection: "row", gap: 10 },
  filterPill: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#f3f4f6", borderRadius: 8, paddingHorizontal: 10, height: 40, gap: 6 },
  filterPillTxt: { flex: 1, color: "#374151", fontSize: 13 },
  fab: { position: 'absolute', right: 20, bottom: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: '#000', shadowRadius: 4, shadowOpacity: 0.3 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 50 },
  emptyText: { color: "#6b7280", fontSize: 16 },
  saleCard: { backgroundColor: "#fff", borderRadius: 12, marginVertical: 6, borderWidth: 1, borderColor: '#e5e7eb', elevation: 1 },
  cancelledCard: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12 },
  saleDate: { fontSize: 13, color: '#4b5563', fontWeight: '500' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12, gap: 4 },
  statusText: { fontSize: 12, fontWeight: 'bold' },
  divider: { height: 1, backgroundColor: '#e5e7eb' },
  detailsContainer: { padding: 12, gap: 8 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  productInfo: { flex: 1, marginRight: 8 },
  productName: { color: '#111827', fontWeight: '600' },
  productQty: { color: '#6b7280', fontWeight: 'normal' },
  productUnitPrice: { fontSize: 12, color: '#6b7280' },
  productSubtotal: { fontWeight: 'bold', color: '#1f2937' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#f9fafb', borderBottomLeftRadius: 12, borderBottomRightRadius: 12 },
  totalLabel: { fontSize: 16, color: '#374151' },
  totalValue: { fontWeight: 'bold', color: '#111827' },
  actionButtons: { flexDirection: 'row', gap: 8 },
  iconButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 500, backgroundColor: "#fff", borderRadius: 12, padding: 16, elevation: 10 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 16 },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: 10 },
  modalBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  modalBtnPrimary: { backgroundColor: '#111827' },
  modalBtnSecondary: { backgroundColor: '#e5e7eb' },
  modalBtnDanger: { backgroundColor: '#dc2626' },
  searchBox: { flexDirection: "row", borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, marginBottom: 10, paddingHorizontal: 8, height: 44, alignItems: 'center' },
  itemRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  confirmText: { fontSize: 15, color: '#374151', lineHeight: 22 },
});