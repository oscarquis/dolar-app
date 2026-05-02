const express = require("express");
const cors = require("cors");

// 🔥 FIX para fetch en Node
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
app.use(cors());

// 🔹 BINANCE P2P BOLIVIA
async function getP2P_BOB() {
  try {
    // 🟢 COMPRA
    const buyRes = await fetch("https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0"
      },
      body: JSON.stringify({
        asset: "USDT",
        fiat: "BOB",
        tradeType: "SELL",
        page: 1,
        rows: 3
      })
    });

    const buyData = await buyRes.json();
    if (!buyData.data || buyData.data.length === 0) return null;

    let compra = buyData.data.map(x => parseFloat(x.adv.price));
    compra = Math.min(...compra);

    // 🔴 VENTA
    const sellRes = await fetch("https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0"
      },
      body: JSON.stringify({
        asset: "USDT",
        fiat: "BOB",
        tradeType: "BUY",
        page: 1,
        rows: 3
      })
    });

    const sellData = await sellRes.json();
    if (!sellData.data || sellData.data.length === 0) return null;

    let venta = sellData.data.map(x => parseFloat(x.adv.price));
    venta = Math.max(...venta);

    return { compra, venta };

  } catch (e) {
    console.log("Error BOB:", e);
    return null;
  }
}

// 🔹 BINANCE P2P ARGENTINA
async function getP2P_ARS() {
  try {
    // 🟢 COMPRA
    const buyRes = await fetch("https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0"
      },
      body: JSON.stringify({
        asset: "USDT",
        fiat: "ARS",
        tradeType: "SELL",
        page: 1,
        rows: 3
      })
    });

    const buyData = await buyRes.json();
    if (!buyData.data || buyData.data.length === 0) return null;

    let compra = buyData.data.map(x => parseFloat(x.adv.price));
    compra = Math.min(...compra);

    // 🔴 VENTA
    const sellRes = await fetch("https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0"
      },
      body: JSON.stringify({
        asset: "USDT",
        fiat: "ARS",
        tradeType: "BUY",
        page: 1,
        rows: 3
      })
    });

    const sellData = await sellRes.json();
    if (!sellData.data || sellData.data.length === 0) return null;

    let venta = sellData.data.map(x => parseFloat(x.adv.price));
    venta = Math.max(...venta);

    return { compra, venta };

  } catch (e) {
    console.log("Error ARS:", e);
    return null;
  }
}

// 🔹 REFERENCIAL PRO (PROMEDIO)
function getReferencial(p2p) {
  if (!p2p) return null;

  let promedio = (p2p.compra + p2p.venta) / 2;

  return {
    compra: promedio * 0.98,
    venta: promedio * 1.00
  };
}

// 🔹 RUTA PRINCIPAL
app.get("/dolar", async (req, res) => {
  try {
    // 🇦🇷 API Argentina
    const r1 = await fetch("https://api.bluelytics.com.ar/v2/latest");
    const d1 = await r1.json();

    // 🪙 CRIPTO ARS (P2P)
    const cripto = await getP2P_ARS();

    // 🇧🇴 BOLIVIA P2P
    const p2p = await getP2P_BOB();

    // 🔥 REFERENCIAL AUTOMÁTICO
    let ref = getReferencial(p2p);

    // fallback por si falla
    if (!ref) {
      ref = { compra: 9.7, venta: 9.9 };
    }

    // 🔥 RESPUESTA FINAL
    res.json({
      azul: {
        valor_compra: d1.blue.value_buy,
        valor_venta: d1.blue.value_sell
      },
      oficial: {
        valor_compra: d1.oficial.value_buy,
        valor_venta: d1.oficial.value_sell
      },
      cripto_ars: cripto,
      p2p_bob: p2p,

      // 🔥 NUEVO
      bcb_referencial: ref
    });

  } catch (e) {
    console.log("Error general:", e);
    res.status(500).json({ error: "fallo servidor" });
  }
});

// 🔥 PUERTO
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Servidor corriendo en puerto", PORT);
});
