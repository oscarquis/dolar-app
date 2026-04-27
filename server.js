const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

// 🔹 BINANCE P2P BOLIVIA
async function getP2P_BOB() {
  try {
    // 🟢 COMPRA (tú compras USDT)
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

    // 🔴 VENTA (tú vendes USDT)
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
    console.log("Error P2P:", e);
    return null;
  }
}

// 🔹 RUTA PRINCIPAL
app.get("/dolar", async (req, res) => {
  try {
    // 🇦🇷 ARGENTINA
    const r1 = await fetch("https://api.bluelytics.com.ar/v2/latest");
    const d1 = await r1.json();

    // 🪙 CRIPTO USDT/ARS
    let cripto = null;
    try {
      const r2 = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=USDTARS");
      const d2 = await r2.json();
      cripto = parseFloat(d2.price);
    } catch {}

    // 🇧🇴 BOLIVIA P2P
    const p2p = await getP2P_BOB();

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
      p2p_bob: p2p
    });

  } catch (e) {
    console.log("Error general:", e);
    res.status(500).json({ error: "fallo servidor" });
  }
});

// 🔥 PUERTO PARA RENDER
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Servidor corriendo en puerto", PORT);
});
