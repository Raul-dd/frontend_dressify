import React, { useEffect, useState, useRef } from 'react';
import API from '../../api/axios';
import { SafeAreaView, View, Text, StyleSheet, Image, ScrollView, TouchableOpacity } from 'react-native';
import FilterBoxSales from '../../components/FilterBoxSales';
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import * as Print from "expo-print";

export default function SalesReportScreen() {
  const [sales, setSales] = useState([]);
  const [filteredSales, setFilteredSales] = useState([]);
  const [filters, setFilters] = useState({
    today: false,
    month: null,
    year: null
  });
  const scrollViewRef = useRef();

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
  };

  useEffect(() => {
    API.get('/sales')
      .then(res => setSales(res.data.data))
      .catch(err => console.error(err));
  }, []);

  useEffect(() => {
    let result = sales;

    if (filters.today) {
      const today = new Date();
      result = result.filter(sale => {
        const saleDate = new Date(sale.date);
        return (
          saleDate.getDate() === today.getDate() &&
          saleDate.getMonth() === today.getMonth() &&
          saleDate.getFullYear() === today.getFullYear()
        );
      });
    } else if (filters.month && !filters.year) {
      const currentYear = new Date().getFullYear();
      result = result.filter(sale => {
        const saleDate = new Date(sale.date);
        return (saleDate.getMonth() + 1) === filters.month.id && saleDate.getFullYear() === currentYear;
      });
    } else if (filters.month && filters.year) {
      result = result.filter(sale => {
        const saleDate = new Date(sale.date);
        return (saleDate.getMonth() + 1) === filters.month.id && saleDate.getFullYear() === filters.year.id;
      });
    } else if (!filters.month && filters.year) {
      result = result.filter(sale => new Date(sale.date).getFullYear() === filters.year.id);
    }

    setFilteredSales(result);
  }, [filters, sales]);

  const productSales = {};
  sales.forEach(sale => {
    sale.details.forEach(detail => {
      if (!productSales[detail.product_id]) {
        productSales[detail.product_id] = {
          product_id: detail.product_id,
          name: detail.name,
          quantity: 0,
        };
      }
      productSales[detail.product_id].quantity += detail.quantity;
    });
  });

  const topProducts = Object.values(productSales)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 3);

  const totalMonetario = sales.reduce((sum, sale) => sum + Number(sale.total), 0);

  // 🚀 Nueva función para exportar a PDF
  const exportToPDF = async () => {
    try {
      let html = `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              h1 { text-align: center; }
              .summary { display: flex; justify-content: space-between; margin-bottom: 20px; }
              .box { border: 1px solid #ccc; padding: 10px; border-radius: 6px; width: 48%; text-align: center; }
              .sale { border: 1px solid #ccc; padding: 10px; margin-bottom: 10px; border-radius: 6px; }
              .total { font-size: 16px; font-weight: bold; text-align: right; }
              .subtitle { margin-top: 20px; font-weight: bold; font-size: 18px; }
            </style>
          </head>
          <body>
            <h1>Reporte de ventas</h1>

            <div class="summary">
              <div class="box">
                <h2>${sales.length}</h2>
                <p>No. total de ventas</p>
              </div>
              <div class="box">
                <h2>$${totalMonetario.toFixed(2)}</h2>
                <p>Total monetario</p>
              </div>
            </div>

            <h2 class="subtitle">Productos más vendidos</h2>
            <ul>
              ${topProducts.map(p => `<li>${p.name} - ${p.quantity} pz</li>`).join("")}
            </ul>

            <h2 class="subtitle">Historial de ventas</h2>
            ${filteredSales.map(sale => `
              <div class="sale">
                <p><b>${new Date(sale.date).toLocaleDateString("es-MX")}</b></p>
                <p>Método de pago: ${
                  sale.payment_method === 'card' ? 'Tarjeta de crédito' : 
                  sale.payment_method === 'transfer' ? 'Transferencia' : 
                  sale.payment_method
                }</p>
                <p>Estado: ${sale.status === 'completed' ? 'Completado' : sale.status}</p>
                <ul>
                  ${sale.details.map(d => `<li>${d.name} x${d.quantity} - $${Number(d.unitPrice).toFixed(2)}</li>`).join("")}
                </ul>
                <p class="total">Total: $${Number(sale.total).toFixed(2)}</p>
              </div>
            `).join("")}
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      const pdfPath = FileSystem.cacheDirectory + "reporte_ventas.pdf";
      await FileSystem.moveAsync({ from: uri, to: pdfPath });
      await Sharing.shareAsync(pdfPath, { mimeType: "application/pdf" });
    } catch (error) {
      console.error("Error al exportar PDF:", error);
      alert("Error al generar el PDF: " + error.message);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerText}>Reporte de ventas</Text>
          <Image
            source={require('../../../assets/logo.png')}
            style={styles.headerIcon}
          />
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 80 }}
      >
        <FilterBoxSales onFilterChange={handleFilterChange} />
        <View style={styles.horizontalContainer}>
          <View style={[styles.equalContainer, styles.totalContainer]}>
            <Text style={styles.totalNumber}>{sales.length}</Text>
            <Text style={styles.totalText}>No. total de ventas</Text>
          </View>
          <View style={[styles.equalContainer, styles.productsContainer]}>
            <Text style={styles.productName}>${totalMonetario.toFixed(2)}</Text>
            <Text style={styles.productTag}>Total monetario</Text>
          </View>
        </View>

        <View style={styles.categoriasContainer}>
          <Text style={styles.subtitle}>Productos mas vendidos</Text>
          <View style={styles.categoriasHorizontalContainer}>
            {topProducts.map(product => (
              <View key={product.product_id} style={[styles.equalContainer2, styles.unitContainer]}>
                <Text style={styles.categoryNumber}>{product.quantity} pz</Text>
                <Text style={styles.categoryName}>{product.name}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.productsDetailContainer}>
          <Text style={styles.subtitle}>Historial de ventas</Text>

          {filteredSales.length > 0 ? (
            filteredSales.map(sale => (
              <View key={sale.id} style={[styles.equalContainer3, styles.unitContainerProduct]}>
                <View style={styles.textLeft}>
                  <Text style={styles.productNameDetail}>
                    {new Date(sale.date).toLocaleDateString('es-MX', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </Text>

                  <Text style={styles.stockNameDetail}>
                    Método de pago: {
                      sale.payment_method === 'card' ? 'Tarjeta de crédito' :
                      sale.payment_method === 'transfer' ? 'Transferencia' :
                      sale.payment_method
                    }
                  </Text>

                  <Text style={styles.stockNameDetail}>
                    Estado: {sale.status === 'completed' ? 'Completado' : sale.status}
                  </Text>

                  <View style={{ marginTop: 8 }}>
                    {sale.details && sale.details.length > 0 && (
                      <Text style={{ fontWeight: 'bold', fontSize: 11, marginBottom: 2 }}>
                        Productos:
                      </Text>
                    )}

                    {sale.details?.map(detail => (
                      <Text key={detail.product_id} style={{ fontSize: 11, marginBottom: 1 }}>
                        {detail.name} x{detail.quantity} - ${Number(detail.unitPrice).toFixed(2)}
                      </Text>
                    ))}
                  </View>
                </View>

                <View style={styles.textRight}>
                  <Text style={styles.codDetail}>
                    Subtotal: ${Number(sale.subtotal).toFixed(2)}
                  </Text>
                  <Text style={styles.priceDetail}>
                    ${Number(sale.total).toFixed(2)}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.noResultsContainer}>
              <Text style={styles.noResultsText}>
                {filters.today ?
                  "No hay ventas registradas hoy" :
                  "No se encontraron ventas con los filtros seleccionados"
                }
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <TouchableOpacity
        style={styles.floatingButton}
        onPress={exportToPDF}   // 👈 ahora usa la nueva función
      >
        <Text style={styles.floatingButtonText}>Exportar</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: '#fff' 
  },
  header: { 
    backgroundColor: '#D9D9D9', 
    padding: 10, 
    paddingStart: 25,
    borderBottomWidth: 1,
    borderBottomColor: '#000000'
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerIcon: {
    width: 55,
    height: 55,
    resizeMode: 'contain',
    marginRight: 8,
  },
  headerText: { 
    color: '#070707', 
    fontSize: 23,  
    fontFamily: 'Inter',
    textAlign: 'left',
    fontWeight: '100',
  },
  content: { 
    flex: 1, 
    paddingHorizontal: 20,
    paddingVertical: 30,
  },
  horizontalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    marginBottom: 6,
    width: '100%',
  },
  equalContainer: {
    flex: 1,      
    maxWidth: '45%',
    marginHorizontal: 5,
    minHeight: 120,
    borderRadius: 10,
    padding: 20,
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  totalContainer: {
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#000000',
    padding: 20,
    borderRadius: 10,
  },
  totalNumber: {
    fontSize: 17,
    fontWeight: 'bold',
    color:'#111111',
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  totalText: {
    fontSize: 13,
    color: '#4B4B4B',
    fontWeight: 'light',
    fontFamily: 'Inter',
  },
  productContainer: {
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#000000',
    padding: 20,
    borderRadius: 10,
  },
  productName: {
    fontSize: 17,
    fontWeight: 'bold',
    color:'#111111',
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  productTag: {
    fontSize: 13,
    color: '#4B4B4B',
    fontWeight: 'light',
    fontFamily: 'Inter',
  },
  categoriasContainer: {
    flexDirection: 'column',
    marginBottom: 25,
    marginHorizontal: 5,
    borderWidth: 1,
    borderColor: '#000000',
    padding: 15,
    borderRadius: 10,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: 'regular',
    marginStart: 5,
    marginBottom: 10,
    color: '#4B4B4B',
    fontFamily: 'Inter',
  },
  categoriasHorizontalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  equalContainer2: {
    flex: 1,
    marginHorizontal: 8,
    minWidth: '20%',
    maxHeight: 90,
  },
  unitContainer: {
    backgroundColor: '#eeeeeeff',
    borderRadius: 8,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
    aspectRatio: 1,
    height: 80,  
  },
  categoryNumber: {
    fontSize: 12,
    fontWeight: 'medium',
    color:'#313131ff',
    marginBottom: 3,
    fontFamily: 'Inter',
    textAlign: 'center',
  },
  categoryName: {
    fontSize: 12,
    color: '#4B4B4B',
    fontWeight: 'regular',
    fontFamily: 'Inter',
    textAlign: 'center',
  },
  productsContainer: {
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#000000',
    padding: 20,
    borderRadius: 10,
  },
  productsDetailContainer: {
    flexDirection: 'column',
    marginBottom: 25,
    margin: 5,
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: 10,
    padding: 10,
  },
  equalContainer3: {
    marginHorizontal: 10,
  },
  unitContainerProduct: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#eeeeeeff',
    borderRadius: 8,
    padding: 15,
    minHeight: 150,  
    marginBottom: 15,
  },
  textLeft: {
    alignItems: 'flex-start',
  },  
  textRight: {
    alignItems: 'flex-end',
  },
  productNameDetail: {
    fontSize: 15,
    fontWeight: 'regular',
    fontFamily: 'Inter',
    color: '#111111',
    marginBottom: 7,
  },
  categoryNameDetail: {
    fontSize: 12,
    color: '#222222ff',
    fontWeight: 'regular',
    marginBottom: 4,
    fontFamily: 'Inter',
  },
  stockNameDetail: {
    fontSize: 10,
    color: '#222222ff', 
    fontFamily: 'Inter',
  },
  codDetail:{
    fontSize: 10,
    color: '#222222ff', 
    textAlign: 'right',
    fontFamily: 'Inter',
    marginBottom: 5,
  },
  priceDetail: {
    fontSize: 16,
    color: '#282828',
    textAlign: 'right',
    fontFamily: 'Inter',
    fontWeight: 'medium',
  },
  floatingButton: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    backgroundColor: '#007AFF',
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    zIndex: 1000,
  },
  floatingButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  noResultsContainer: {
    padding: 20,
    alignItems: 'center',
  },
  noResultsText: {
    color: '#666',
    fontSize: 14,
  },
});