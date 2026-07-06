// =====================================
// SERVER.JS
// =====================================

const express = require("express");
const cors = require("cors");
const axios = require("axios");
// FIX fetch node
const fetch = (...args) =>
  import("node-fetch")
  .then(({default: fetch}) => fetch(...args));

const app = express();

app.use(cors());

// mostrar html
app.use(express.static(__dirname));

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

      // ARSB0B

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
