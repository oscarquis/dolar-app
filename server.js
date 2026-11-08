// =====================================
// SERVER.JS
// =====================================

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");

// FIX fetch node
const fetch = (...args) =>
  import("node-fetch")
  .then(({default: fetch}) => fetch(...args));

const app = express();

app.use(cors());
app.use(express.json());
// =====================================
// WEBHOOK WHATSAPP - META
// =====================================

const META_VERIFY_TOKEN = "DolarVivoWebhook2026";

// Verificación inicial de Meta
app.get("/webhook", (req, res) => {

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (
    mode === "subscribe" &&
    token === META_VERIFY_TOKEN
  ) {

    console.log("✅ Webhook de WhatsApp verificado");

    return res.status(200).send(challenge);

  }

  console.log("❌ Token de verificación incorrecto");

  res.sendStatus(403);

});

// Recibir eventos de WhatsApp
app.post("/webhook", (req, res) => {

  console.log(
    "📩 Webhook WhatsApp:",
    JSON.stringify(req.body, null, 2)
  );

  res.sendStatus(200);

});


// =====================================
// CONEXIÓN SUPABASE
// =====================================

const SUPABASE_URL =
  "https://tjqlwmtxzwqdjziqukcc.supabase.co";

const SUPABASE_SERVICE_ROLE_KEY =
   "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqcWx3bXR4endxZGp6aXF1a2NjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2OTM3NTMsImV4cCI6MjA5NDI2OTc1M30.8cojvxD4NzULayU5VvhQCfrehiXWeji05UdtCFnIgSA";
const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);


// ==========================
// BINANCE
// =====================================
// MOSTRAR HTML
// =====================================

app.use(express.static(__dirname));
// =====================================
// PRUEBA SUPABASE
// =====================================

app.get("/prueba-supabase", async (req, res) => {

  try {

    const { data, error } = await supabase
      .from("suscriptores_whatsapp")
      .select("id, telefono, variacion_alerta, activo")
      .limit(5);

    if (error) {

      console.log("Error Supabase:", error);

      return res.status(500).json({
        ok: false,
        error: error.message
      });

    }

    res.json({
      ok: true,
      mensaje: "Conexión con Supabase correcta",
      suscriptores: data
    });

  } catch (e) {

    console.log("Error:", e);

    res.status(500).json({
      ok: false,
      error: e.message
    });

  }

});
// =====================================
// SUSCRIBIR WHATSAPP
// =====================================

app.post("/suscribirse-whatsapp", async (req, res) => {

  try {

    const { telefono, variacion_alerta } = req.body;

    if (!telefono) {
      return res.status(400).json({
        ok: false,
        error: "Falta el teléfono"
      });
    }

    const variacion =
      Number(variacion_alerta) || 2.00;

    const { data, error } = await supabase
      .from("suscriptores_whatsapp")
      .upsert(
        {
          telefono: telefono,
          variacion_alerta: variacion,
          activo: true
        },
        {
          onConflict: "telefono"
        }
      )
      .select()
      .single();

    if (error) {

      console.log(
        "Error guardando suscriptor:",
        error
      );

      return res.status(500).json({
        ok: false,
        error: error.message
      });

    }

    res.json({
      ok: true,
      mensaje: "Número suscrito correctamente",
      suscriptor: data
    });

  } catch (e) {

    console.log("Error:", e);

    res.status(500).json({
      ok: false,
      error: e.message
    });

  }

});

// =====================================
// DETECTAR VARIACIÓN ARS → BOB
// =====================================

async function detectarVariacionARSBOB(
  valorAnterior,
  valorNuevo
) {

  try {

    if (
      !valorAnterior ||
      !valorNuevo ||
      valorAnterior <= 0
    ) {
      return;
    }

    const porcentaje =
      Math.abs(
        ((valorNuevo - valorAnterior) /
          valorAnterior) * 100
      );

    console.log(
      "ARS → BOB:",
      valorAnterior,
      "→",
      valorNuevo,
      "Variación:",
      porcentaje.toFixed(2) + "%"
    );

    // Obtener suscriptores activos

    const { data, error } = await supabase
      .from("suscriptores_whatsapp")
      .select(
        "id, telefono, variacion_alerta, activo, ultima_alerta"
      )
      .eq("activo", true);

    if (error) {

      console.log(
        "Error obteniendo suscriptores:",
        error
      );

      return;
    }

    if (!data || data.length === 0) {
      return;
    }

    for (const usuario of data) {

      const limite =
        Number(usuario.variacion_alerta);

      if (
        porcentaje >= limite
      ) {

        console.log(
          "🚨 ALERTA:",
          usuario.telefono,
          "Variación:",
          porcentaje.toFixed(2) + "%"
        );

      }

    }

  } catch (e) {

    console.log(
      "Error detectando variación:",
      e
    );

  }

}
// =====================================
// VALORES
// =====================================

let anterior = null;

let actualGuardado = null;
// =====================================
// BINANCE
// =====================================

async function getBinance(
  fiat = "ARS",
  tradeType = "BUY",
  rows = 3
){

  try{

    const response = await fetch(
      "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search",
      {
        method:"POST",

        headers:{
          "Content-Type":"application/json",
          "User-Agent":"Mozilla/5.0"
        },

        body: JSON.stringify({
          asset:"USDT",
          fiat,
          tradeType,
          page:1,
          rows
        })
      }
    );

    const data =
      await response.json();

    if(
      !data.data ||
      data.data.length === 0
    ){
      return [];
    }

    let precios =
      data.data.map(
        x => parseFloat(x.adv.price)
      );

    return precios;

  }catch(e){

    console.log(e);

    return [];
  }
}

// =====================================
// P2P BOLIVIA
// =====================================

async function getP2P_BOB(){

  try{

    const compraData =
      await getBinance(
        "BOB",
        "SELL",
        3
      );

    const ventaData =
      await getBinance(
        "BOB",
        "BUY",
        3
      );

    let compra =
      Math.min(...compraData);

    let venta =
      Math.max(...ventaData);

    return {
      compra,
      venta
    };

  }catch(e){

    return {
      compra:null,
      venta:null
    };

  }

}

// =====================================
// DOLAR ARGENTINA
// =====================================

async function getDolarArgentina(){

  try{

    const response =
      await axios.get(
        "https://api.bluelytics.com.ar/v2/latest"
      );

    return response.data;

  }catch(e){

    console.log(e);

    return null;

  }

}

// =====================================
// P2P ARGENTINA
// =====================================

async function getP2P_ARS(){

  try{

    const compraData =
      await getBinance(
        "ARS",
        "SELL",
        3
      );

    const ventaData =
      await getBinance(
        "ARS",
        "BUY",
        3
      );

    let compra =
      Math.min(...compraData);

    let venta =
      Math.max(...ventaData);

    return {
      compra,
      venta
    };

  }catch(e){

    return {
      compra:null,
      venta:null
    };

  }

}

// =====================================
// CALCULAR ARS → BOB
// =====================================

function calcularARS_BOB(
  dolarARS,
  dolarBOB
){

  if(
    !dolarARS ||
    !dolarBOB
  ){
    return {
      compra:null,
      venta:null
    };
  }

  let compra =
    dolarARS.compra / dolarBOB.venta;

  let venta =
    dolarARS.venta / dolarBOB.compra;

  return {
    compra,
    venta
  };

}

// =====================================
// OBTENER TODOS LOS VALORES
// =====================================

async function obtenerValores(){

  const argentina =
    await getDolarArgentina();

  const p2pARS =
    await getP2P_ARS();

  const p2pBOB =
    await getP2P_BOB();

  let arsbob =
    calcularARS_BOB(
      p2pARS,
      p2pBOB
    );

  return {

    argentina,

    p2pARS,

    p2pBOB,

    arsbob

  };

}


// =====================================
// P2P ARGENTINA
// =====================================

async function getP2P_ARS(){

  try{

    const compraData =
      await getBinance(
        "ARS",
        "SELL",
        3
      );

    const ventaData =
      await getBinance(
        "ARS",
        "BUY",
        3
      );

    let compra =
      Math.min(...compraData);

    let venta =
      Math.max(...ventaData);

    return {

      compra:
      Number(compra.toFixed(2)),

      venta:
      Number(venta.toFixed(2))

    };

  }catch(e){

    console.log(e);

    return null;

  }

}

// =====================================
// bcb
// =====================================

async function getBCB(){
  try {
    const { data } = await axios.get(
      "https://www.bcb.gob.bo/",
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "text/html"
        },
        timeout: 15000
      }
    );

    const valorTexto = data.match(
      /<span[^>]*class=["'][^"']*\bbcb-tco-num\b[^"']*["'][^>]*>\s*([\d.,]+)\s*<\/span>/i
    )?.[1];

    const fechaMatch = data.match(
      /<div[^>]*class=["'][^"']*\bbcb-kpi2-asof\b[^"']*["'][^>]*>[\s\S]*?<time[^>]*datetime=["']([^"']+)["'][^>]*>([\s\S]*?)<\/time>/i
    );

    const valor = valorTexto
      ? Number(valorTexto.replace(/\./g, "").replace(",", "."))
      : NaN;

    const vigencia = fechaMatch?.[2]
      ?.replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim() || null;

    if (!Number.isFinite(valor) || valor <= 0) {
      console.error("BCB: no se encontró el tipo de cambio oficial.");
      return null;
    }

    return {
      tipo_cambio_oficial: valor,
      fecha: fechaMatch?.[1] || null,
      vigencia
    };

  } catch (e) {
    console.error("Error consultando BCB:", e.message);
    return null;
  }
}

// =====================================
// ACTUALIZAR VALORES
// =====================================

async function actualizarAnterior(){

  try{

    console.log(
      "Verificando cambios..."
    );

    // =================================
    // API ARGENTINA
    // =================================

    const r1 = await fetch(
      "https://api.bluelytics.com.ar/v2/latest"
    );

    const d1 = await r1.json();

    // =================================
    // CRIPTO
    // =================================

    const cripto =
      await getP2P_ARS();

    // =================================
    // BOLIVIA
    // =================================

    const p2p =
      await getP2P_BOB();

/////   
    // =================================
    // ARS → BOB
    // =================================

    let arsbob_compra = null;

    let arsbob_venta = null;

    if(
      cripto &&
      p2p
    ){

      arsbob_compra =

        Number(

          (
            p2p.compra /
            cripto.venta
          ).toFixed(5)

        );

      arsbob_venta =

        Number(

          (
            p2p.venta /
            cripto.compra
          ).toFixed(5)

        );

    }

    
    // =================================
    // NUEVOS VALORES
    // =================================

    let nuevoActual = {

      blue:{

        compra:
          d1.blue.value_buy,

        venta:
          d1.blue.value_sell

      },

      oficial:{

        compra:
          d1.oficial.value_buy,

        venta:
          d1.oficial.value_sell

      },

      cripto:{

        compra:
          cripto?.compra || null,

        venta:
          cripto?.venta || null

      },

      bob:{

        compra:
          p2p?.compra || null,

        venta:
          p2p?.venta || null

      },

      arsbob:{

        compra:
          arsbob_compra,

        venta:
          arsbob_venta

      }

    };

    // =================================
    // PRIMERA VEZ
    // =================================

    if(!actualGuardado){
if (
  actualGuardado &&
  actualGuardado.arsbob &&
  nuevoActual.arsbob
) {

  await detectarVariacionARSBOB(
    actualGuardado.arsbob.venta,
    nuevoActual.arsbob.venta
  );

}
      actualGuardado =
        nuevoActual;

      anterior = {

        blue:
          nuevoActual.blue,

        oficial:
          nuevoActual.oficial,

        cripto:
          nuevoActual.cripto,

        bob:
          nuevoActual.bob,

        arsbob:
          nuevoActual.arsbob

      };

    }

    // =================================
    // CAMBIOS
    // =================================

    else{

      // BLUE

      if(

        actualGuardado.blue.venta !==
        nuevoActual.blue.venta

      ){

        anterior.blue =
          actualGuardado.blue;

        console.log(
          "Cambio BLUE"
        );

      }

      // OFICIAL

      if(

        actualGuardado.oficial.venta !==
        nuevoActual.oficial.venta

      ){

        anterior.oficial =
          actualGuardado.oficial;

        console.log(
          "Cambio OFICIAL"
        );

      }

      // CRIPTO

      if(

        actualGuardado.cripto.venta !==
        nuevoActual.cripto.venta

      ){

        anterior.cripto =
          actualGuardado.cripto;

        console.log(
          "Cambio CRIPTO"
        );

      }

      // BOB

      if(

        actualGuardado.bob.venta !==
        nuevoActual.bob.venta

      ){

        anterior.bob =
          actualGuardado.bob;

        console.log(
          "Cambio BOB"
        );

      }


// ARSBOB

if(

  actualGuardado.arsbob.venta !==
  nuevoActual.arsbob.venta

){

  anterior.arsbob =
    actualGuardado.arsbob;

  console.log(
    "Cambio ARSBOB"
  );

}

// guardar actual

actualGuardado =
  nuevoActual;

}

}catch(e){

  console.log(
    "Error:",
    e
  );

}
}

// =====================================
// INICIAR
// =====================================

actualizarAnterior();

// cada 5 segundos

setInterval(

  actualizarAnterior,

  5000

);

// =====================================
// API
// =====================================

app.get("/dolar", async(req,res)=>{

  try{

    // =================================
    // API ARGENTINA
    // =================================

    const r1 =
      await fetch(
        "https://api.bluelytics.com.ar/v2/latest"
      );

    const d1 =
      await r1.json();

    // =================================
    // bcb
    // =================================

    const bcb = await getBCB();

    // =================================
    // CRIPTO
    // =================================

    const cripto =
      await getP2P_ARS();

    // =================================
    // BOLIVIA
    // =================================

    const p2p =
      await getP2P_BOB();

    // =================================
    // ARS → BOB
    // =================================

    let ars_bob = {

      compra:null,

      venta:null

    };

    if(

      cripto &&
      p2p &&

      cripto.compra &&
      cripto.venta &&

      p2p.compra &&
      p2p.venta

    ){

      ars_bob.compra =

        Number(

          (
            p2p.compra /
            cripto.venta
          ).toFixed(5)

        );

      ars_bob.venta =

        Number(

          (
            p2p.venta /
            cripto.compra
          ).toFixed(5)

        );

    }

    // =================================
    // RESPUESTA
    // =================================

    res.json({

      azul:{

        valor_compra:
        d1.blue.value_buy,

        valor_venta:
        d1.blue.value_sell

      },

      oficial:{

        valor_compra:
        d1.oficial.value_buy,

        valor_venta:
        d1.oficial.value_sell

      },

      cripto_ars: cripto,

      p2p_bob: p2p,

      ars_bob: ars_bob,

      bcb: bcb,

      anterior: anterior

    });

  }catch(e){

    console.log(
      "Error general:",
      e
    );

    res.status(500).json({

      error:"fallo servidor"

    });

  }

});


// =====================================
// BINANCE P2P: anuncios Merchant para la página arbitraje-p2p.html
// Endpoint consumido por la calculadora desde el mismo servidor.
// =====================================
const BINANCE_P2P_BASE = "https://www.binance.com";
const BINANCE_P2P_ENDPOINT = "/bapi/c2c/v1/public/c2c/agent/ad-list";
const BINANCE_P2P_CACHE_MS = 20000;
const binanceP2pCache = new Map();

function binanceNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function binanceUnwrap(payload) {
  const candidates = [
    payload?.data, payload?.data?.list, payload?.data?.ads,
    payload?.data?.items, payload?.data?.data, payload?.data?.data?.list,
    payload?.list, payload?.ads
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return Array.isArray(payload) ? payload : [];
}

function binanceNormalize(raw) {
  const adv = raw.adv || raw.ad || raw.advertisement || raw;
  const advertiser = raw.advertiser || adv.advertiser || raw.user || adv.user || {};
  const userType = String(advertiser.userType || raw.userType || adv.userType || "").toLowerCase();
  const classify = String(adv.classify || raw.classify || "").toLowerCase();

  // No mostrar usuarios comunes: solo Merchant explícitamente identificado.
  const isMerchant =
    userType === "merchant" ||
    userType === "pro_merchant" ||
    classify === "profession";

  const methods = adv.tradeMethods || adv.payTypes || raw.tradeMethods || raw.payTypes || [];
  return {
    merchant: String(advertiser.nickName || advertiser.nickname || raw.nickName || adv.nickName || "Merchant Binance"),
    userType,
    classify,
    isMerchant,
    price: binanceNumber(adv.price ?? raw.price),
    min: binanceNumber(adv.minSingleTransAmount ?? adv.minAmount ?? raw.minSingleTransAmount ?? raw.minAmount),
    max: binanceNumber(adv.maxSingleTransAmount ?? adv.maxAmount ?? raw.maxSingleTransAmount ?? raw.maxAmount),
    orders30d: binanceNumber(advertiser.monthOrderCount ?? raw.monthOrderCount),
    completion30d: binanceNumber(advertiser.monthFinishRate ?? raw.monthFinishRate),
    totalOrders: binanceNumber(advertiser.orderCount ?? raw.orderCount),
    methods: Array.isArray(methods)
      ? methods.map(x => typeof x === "string" ? x : (x.tradeMethodName || x.identifier || x.payType || "")).filter(Boolean)
      : [],
    available: binanceNumber(adv.surplusAmount ?? adv.availableAmount ?? raw.surplusAmount),
    advNo: adv.advNo || raw.advNo || raw.id || null
  };
}

async function fetchBinanceP2PAds(fiat, tradeType) {
  const cacheKey = `${fiat}:${tradeType}`;
  const cached = binanceP2pCache.get(cacheKey);
  if (cached && Date.now() - cached.at < BINANCE_P2P_CACHE_MS) return cached.value;

  const url = new URL(BINANCE_P2P_ENDPOINT, BINANCE_P2P_BASE);
  url.searchParams.set("fiat", fiat);
  url.searchParams.set("asset", "USDT");
  url.searchParams.set("tradeType", tradeType);
  url.searchParams.set("limit", "20");
  url.searchParams.set("order", tradeType === "BUY" ? "price_asc" : "price_desc");

  const response = await fetch(url.toString(), {
    headers: {
      "accept": "application/json, text/plain, */*",
      "content-type": "application/json",
      "user-agent": "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36",
      "origin": BINANCE_P2P_BASE,
      "referer": "https://www.binance.com/"
    },
    signal: AbortSignal.timeout(12000)
  });

  if (!response.ok) throw new Error(`Binance respondió HTTP ${response.status} para ${fiat}/${tradeType}`);
  const payload = await response.json();

  if (payload.success === false || (payload.code && payload.code !== "000000" && payload.code !== "0")) {
    throw new Error(payload.message || payload.msg || `Respuesta Binance: ${payload.code}`);
  }

  const all = binanceUnwrap(payload).map(binanceNormalize);
  const merchants = all.filter(x => x.isMerchant && x.price !== null);
  const result = {
    fiat, tradeType,
    countReceived: all.length,
    countMerchants: merchants.length,
    ads: merchants
  };
  binanceP2pCache.set(cacheKey, { at: Date.now(), value: result });
  return result;
}

async function getBinanceP2PMarket() {
  const pairs = await Promise.all([
    fetchBinanceP2PAds("ARS", "BUY"),
    fetchBinanceP2PAds("ARS", "SELL"),
    fetchBinanceP2PAds("BOB", "BUY"),
    fetchBinanceP2PAds("BOB", "SELL")
  ]);
  const markets = Object.fromEntries(pairs.map(x => [`${x.fiat}_${x.tradeType}`, x]));
  return {
    ok: true,
    source: "Binance public P2P ads",
    fetchedAt: new Date().toISOString(),
    filter: "Solo Merchant identificados explícitamente; usuarios comunes excluidos",
    markets
  };
}

app.get("/api/ads", async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    res.json(await getBinanceP2PMarket());
  } catch (e) {
    console.error("Error consultando Binance P2P:", e.message);
    res.status(502).json({
      ok: false,
      error: e.message,
      hint: "Binance pudo cambiar o limitar la consulta pública. No se muestran usuarios comunes como sustituto."
    });
  }
});


// =====================================
// PUERTO
// =====================================

const PORT =
  process.env.PORT || 3000;

app.listen(PORT, ()=>{

  console.log(
    "Servidor iniciado"
  );

  console.log(
    "http://127.0.0.1:" + PORT
  );

});

