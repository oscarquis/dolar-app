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

  try{

    const { data } = await axios.get(
      "https://deudaexternapublica.bcb.gob.bo/publico/tipos-cambio/ultimos-indicadores",
      {
        headers:{
          "User-Agent":"Mozilla/5.0"
        }
      }
    );

    const fecha =
      data.match(/FECHA DE LA COTIZACIÓN:[\s\S]*?<strong><u>(.*?)<\/u>/i)?.[1]
      ?.replace(/&eacute;/g,"é") || null;

    const compra =
      data.match(/ESTADOS UNIDOS[\s\S]*?DÓLAR COMPRA[\s\S]*?<td align="right">([\d,]+)<\/td>/i)?.[1]
      ?.replace(",", ".");

    const venta =
      data.match(/ESTADOS UNIDOS[\s\S]*?DÓLAR VENTA[\s\S]*?<td align="right">([\d,]+)<\/td>/i)?.[1]
      ?.replace(",", ".");

    return {
      compra,
      venta,
      fecha
    };

  }catch(e){

    console.log(e);

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

