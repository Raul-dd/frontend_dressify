// src/screens/sales/HistorialSaleScreen.js
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  RefreshControl, TextInput, TouchableOpacity, Image, Modal, Pressable, Alert
} from "react-native";
import { Calendar } from "react-native-calendars";
import axios from "axios";
import Constants from "expo-constants";

// --- BASE URL desde app.json ---
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

const fmt = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const toId = (raw) => {
  if (!raw) return "";
  if (typeof raw === "string") return raw;
  if (raw && raw.$oid) return raw.$oid;
  if (raw && raw.oid) return raw.oid;
  if (raw && raw.toString) {
    const s = raw.toString();
    const m = s.match(/ObjectId\(["']?([a-f\d]{24})["']?\)/i);
    return m ? m[1] : s;
  }
  return String(raw);
};

export default function HistorialSaleScreen({ onRegister, onEdit }) {
  // filtros
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [productId, setProductId] = useState("");
  const [productLabel, setProductLabel] = useState("Seleccionar producto");

  // modals
  const [showCal, setShowCal] = useState(false);
  const [tmpStart, setTmpStart] = useState("");
  const [tmpEnd, setTmpEnd] = useState("");
  const [showProducts, setShowProducts] = useState(false);
  const [prodSearch, setProdSearch] = useState("");

  // modal cancelar
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [saleToCancel, setSaleToCancel] = useState(null);

  // data
  const [products, setProducts] = useState([]);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // helpers
  const normalizeDetails = (d) => {
    if (!d) return [];
    if (Array.isArray(d)) return d;
    if (typeof d === "string") { try { return JSON.parse(d); } catch { return []; } }
    return [];
  };
  const qty = (d) => normalizeDetails(d).reduce((s, r) => s + (r.quantity || 0), 0);
  const fdate = (s) => (s ? new Date(s).toLocaleDateString() : "-");

  // productos (para filtro)
  const loadProducts = useCallback(async () => {
    try {
      const res = await API.get(`/products/names`);
      const raw = Array.isArray(res.data) ? res.data : (res.data?.data) || [];
      setProducts(raw.map((p) => ({ _id: toId(p.id), name: String(p.name || "Unnamed") })));
    } catch (e) {
      console.log("loadProducts error:", e?.message);
      setProducts([]);
    }
  }, []);

  // ventas (paginado y filtros)
  const fetchPage = useCallback(
    async (p = 1, replace = false) => {
      try {
        const qs = new URLSearchParams({
          per_page: "10",
          page: String(p),
          ...(dateFrom ? { date_from: dateFrom } : {}),
          ...(dateTo ? { date_to: dateTo } : {}),
          ...(productId ? { product_id: productId } : {}),
        }).toString();

        const res = await API.get(`/sales?${qs}`);
        const list = Array.isArray(res.data) ? res.data : (res.data?.data) || [];
        const current = res.data?.current_page || 1;
        const last = res.data?.last_page || 1;

        const sorted = (list || []).sort(
          (a, b) => new Date(b.date || 0) - new Date(a.date || 0)
        );

        setItems((prev) => (replace ? sorted : [...prev, ...sorted]));
        setPage(current);
        setLastPage(last);
      } catch (e) {
        console.log("fetchPage error:", e?.message);
        setItems([]);
        setPage(1);
        setLastPage(1);
      }
    },
    [dateFrom, dateTo, productId]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await fetchPage(1, true); } finally { setRefreshing(false); }
  }, [fetchPage]);

  useEffect(() => { loadProducts(); }, [loadProducts]);
  useEffect(() => {
    (async () => {
      setLoading(true);
      try { await fetchPage(1, true); } finally { setLoading(false); }
    })();
  }, [fetchPage]);

  const loadMore = async () => { if (!loading && page < lastPage) await fetchPage(page + 1); };

  // calendario
  const marked = useMemo(() => {
    const m = {};
    if (tmpStart) m[tmpStart] = { startingDay: true, color: "#111", textColor: "white" };
    if (tmpEnd) m[tmpEnd] = { endingDay: true, color: "#111", textColor: "white" };
    if (tmpStart && tmpEnd && tmpStart !== tmpEnd) {
      const a = new Date(tmpStart), b = new Date(tmpEnd);
      const start = a < b ? a : b;
      const end = a < b ? b : a;
      const cur = new Date(start); cur.setDate(cur.getDate() + 1);
      while (cur <= end) {
        const k = fmt(cur);
        if (k !== fmt(start) && k !== fmt(end)) m[k] = { color: "#111", textColor: "white" };
        cur.setDate(cur.getDate() + 1);
      }
    }
    return m;
  }, [tmpStart, tmpEnd]);

  const onDayPress = (d) => {
    if (!tmpStart || (tmpStart && tmpEnd)) { setTmpStart(d.dateString); setTmpEnd(""); }
    else { setTmpEnd(d.dateString); }
  };
  const confirmDates = () => {
    let a = tmpStart, b = tmpEnd || tmpStart;
    if (a && b) {
      if (new Date(a) > new Date(b)) { const t = a; a = b; b = t; }
      setDateFrom(a); setDateTo(b);
    }
    setShowCal(false);
  };

  // lista productos (modal)
  const listForModal = useMemo(() => {
    const base = [{ _id: "", name: "Todos los productos" }, ...products];
    const q = prodSearch.trim().toLowerCase();
    return q ? base.filter((p) => (p.name || "").toLowerCase().includes(q)) : base;
  }, [products, prodSearch]);

  const chooseProduct = (p) => {
    setProductId(p._id || "");
    setProductLabel(p.name || "Seleccionar producto");
    setShowProducts(false);
  };

  const openCancelModal = (sale) => { 
  setSaleToCancel(sale); 
  setShowCancelModal(true); 
};

const confirmCancel = async () => {
  if (!saleToCancel) return;
  try {
    const id = toId(saleToCancel._id);
    // Si quieres usar la ruta dedicada a cancelar:
    await API.post(`/sales/${id}/cancel`);
    
    setShowCancelModal(false);
    setSaleToCancel(null);
    await fetchPage(1, true);
  } catch (e) {
    Alert.alert("Error", e?.response?.data?.message || "No se pudo cancelar la venta");
  }
};



  const renderSale = ({ item }) => {
    const lines = normalizeDetails(item.details);
    const firstName = lines?.[0]?.name || "-";
    const totalQty = qty(item.details);

    return (
      <View style={styles.innerCard}>
        <View style={styles.cardHeadRow}>
          <Text style={styles.muted}>ID: {toId(item._id)}</Text>
          <Text style={styles.muted}>Fecha de registro: {fdate(item.date)}</Text>
        </View>

        <View style={styles.dashed} />

        <Text style={styles.infoRow}><Text style={styles.label}>Producto: </Text>{firstName}</Text>
        <Text style={styles.infoRow}><Text style={styles.label}>Cantidad: </Text>{totalQty}</Text>
        <Text style={styles.infoRow}><Text style={styles.label}>Estado: </Text>{item.status || "-"}</Text>
        <Text style={styles.infoRow}><Text style={styles.label}>Método: </Text>{item.payment_method || "-"}</Text>

        <View style={styles.dashed} />

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total:</Text>
          <Text style={styles.totalValue}>${item.total?.toFixed(2) ?? "0.00"}</Text>

          <View style={{ flexDirection: "row", marginLeft: "auto" }}>
            <TouchableOpacity
              style={styles.smallIconBtn}
              onPress={() => onEdit(toId(item._id))}
            >
              <Text style={styles.smallIconTxt}>✎</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.smallIconBtn}
              onPress={() => openCancelModal(item)} // 👈 antes estaba onDelete(item)
            >
              <Text style={styles.smallIconTxt}>🗑️</Text>
            </TouchableOpacity>



          </View>
        </View>
      </View>
    );
  };

  if (loading) return <View style={styles.center}><ActivityIndicator /></View>;

  return (
    <View style={styles.screen}>
      {/* AppBar */}
      <View style={styles.appbar}>
        <Text style={styles.appbarTitle}>Historial de Ventas</Text>
        <Image source={require("../../../assets/logo.png")} style={styles.appbarLogo} />
      </View>

      {/* Filtros */}
      <View style={styles.filtersCard}>
        <View style={styles.filtersHeader}>
          <Text style={styles.filtersTitle}>Filtros</Text>
          <TouchableOpacity onPress={() => { setDateFrom(""); setDateTo(""); setProductId(""); setProductLabel("Seleccionar producto"); setProdSearch(""); fetchPage(1, true); }}>
            <Text style={styles.resetLink}>Restablecer</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.filtersRow}>
          <Pressable style={styles.filterPill}
            onPress={() => { setTmpStart(dateFrom); setTmpEnd(dateTo); setShowCal(true); }}>
            <Text style={styles.filterPillTxt}>
              {dateFrom && dateTo ? `${dateFrom} → ${dateTo}` : "Fecha"}
            </Text>
          </Pressable>

          <Pressable style={styles.filterPill} onPress={() => setShowProducts(true)}>
            <Text style={styles.filterPillTxt}>{productLabel}</Text>
            <Text style={styles.chev}>▾</Text>
          </Pressable>
        </View>
      </View>

      {/* Panel: botón + lista */}
      <View style={styles.panelCard}>
        <View style={styles.panelHeader}>
          <TouchableOpacity style={styles.newSaleBtn} onPress={onRegister}>
            <Text style={styles.newSaleTxt}>Nueva Venta</Text>
            <Text style={styles.newSalePlus}>+</Text>
          </TouchableOpacity>

        </View>

        <FlatList
          data={items}
          keyExtractor={(it, idx) => toId(it?._id) || String(idx)}
          renderItem={renderSale}
          contentContainerStyle={{ paddingBottom: 12, paddingHorizontal: 4 }}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<Text style={styles.empty}>No hay ventas</Text>}
        />
      </View>

      {/* Modal calendario */}
      <Modal visible={showCal} animationType="slide" transparent>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Selecciona rango de fechas</Text>
            <Calendar markingType="period" markedDates={marked} onDayPress={onDayPress} />
            <View style={styles.modalRow}>
              <TouchableOpacity onPress={() => setShowCal(false)} style={[styles.modalBtn, { backgroundColor: "#e5e7eb" }]}>
                <Text>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmDates} style={[styles.modalBtn, { backgroundColor: "#111" }]}>
                <Text style={{ color: "#fff" }}>Aplicar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal productos */}
      <Modal visible={showProducts} animationType="slide" transparent>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Selecciona producto</Text>
            <View style={styles.searchBox}>
              <TextInput
                placeholder="Buscar producto..."
                value={prodSearch}
                onChangeText={setProdSearch}
                style={{ flex: 1 }}
                autoFocus
              />
            </View>
            <FlatList
              data={listForModal}
              keyExtractor={(p, i) => p._id || `all-${i}`}
              style={{ maxHeight: 300 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.itemRow} onPress={() => chooseProduct(item)}>
                  <Text>{item.name || "Todos los productos"}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity onPress={() => setShowProducts(false)} style={[styles.modalBtn, { backgroundColor: "#111", alignSelf: "flex-end" }]}>
              <Text style={{ color: "#fff" }}>Listo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal cancelar venta */}
      <Modal visible={showCancelModal} animationType="fade" transparent>
        <View style={styles.modalWrap}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmHeader}>
              <TouchableOpacity onPress={() => setShowCancelModal(false)} style={styles.closeX}>
                <Text style={{ fontSize: 16 }}>×</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.confirmMsg}>
              Esta acción marcará la venta como <Text style={{ fontWeight: "700" }}>Cancelada</Text>.
            </Text>
            <Text style={styles.confirmMsg}>¿Deseas continuar?</Text>
            <View style={styles.confirmRow}>
              <TouchableOpacity onPress={confirmCancel} style={[styles.modalBtn, { backgroundColor: "#111" }]}>
                <Text style={{ color: "#fff", fontWeight: "700" }}>Aceptar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// --- estilos ---
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  appbar: {
    height: 56, backgroundColor: "#e5e7eb",
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#d1d5db"
  },
  appbarTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  appbarLogo: { width: 28, height: 28, resizeMode: "contain" },
  filtersCard: {
    margin: 10, padding: 14, borderRadius: 12, backgroundColor: "#fff",
    borderWidth: 1, borderColor: "#d1d5db",
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  filtersHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  filtersTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  resetLink: { color: "#6b7280", fontSize: 13 },
  filtersRow: { flexDirection: "row", gap: 12 },
  filterPill: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderColor: "#d1d5db", backgroundColor: "#fff",
    borderRadius: 10, paddingHorizontal: 12, height: 40, minWidth: 150,
  },
  filterPillTxt: { flex: 1, color: "#111827" },
  chev: { fontSize: 14, marginLeft: 4 },
  panelCard: {
    flex: 1, margin: 10, borderRadius: 12, backgroundColor: "#fff",
    borderWidth: 1, borderColor: "#d1d5db",
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  panelHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#d1d5db"
  },
  newSaleBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#111", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  newSaleTxt: { color: "#fff", fontWeight: "700" },
  newSalePlus: { color: "#fff", fontSize: 18, marginLeft: 6 },
  innerCard: {
    backgroundColor: "#f9fafb", borderRadius: 8, padding: 10, marginTop: 8,
    borderWidth: 1, borderColor: "#e5e7eb"
  },
  cardHeadRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  dashed: { borderWidth: 0.5, borderColor: "#d1d5db", borderStyle: "dashed", marginVertical: 6 },
  infoRow: { marginBottom: 4 },
  label: { fontWeight: "700" },
  muted: { fontSize: 12, color: "#6b7280" },
  totalRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  totalLabel: { fontWeight: "700" },
  totalValue: { fontWeight: "700", marginLeft: 4 },
  smallIconBtn: {
    width: 30, height: 30, borderRadius: 6, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "#e5e7eb", backgroundColor: "#111"
  },
  smallIconTxt: { color: "#fff", fontSize: 12 },
  empty: { textAlign: "center", padding: 20, color: "#6b7280" },
  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "center", alignItems: "center" },
  modalCard: { backgroundColor: "#fff", borderRadius: 12, padding: 16, width: "85%", maxWidth: 400 },
  modalTitle: { fontSize: 16, fontWeight: "700", marginBottom: 10 },
  modalRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 10 },
  modalBtn: { borderRadius: 6, paddingVertical: 8, paddingHorizontal: 14 },
  searchBox: { flexDirection: "row", borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, marginBottom: 10, paddingHorizontal: 8 },
  itemRow: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#e5e7eb" },
  confirmCard: { backgroundColor: "#fff", borderRadius: 12, padding: 16, width: "85%", maxWidth: 400 },
  confirmHeader: { flexDirection: "row", justifyContent: "flex-end" },
  closeX: { padding: 4 },
  confirmMsg: { marginBottom: 10 },
  confirmRow: { flexDirection: "row", justifyContent: "flex-end" },
});
