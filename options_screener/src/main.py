import asyncio
import sys
import os
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

sys.path.append(os.path.join(os.path.dirname(__file__)))

from data.upstox_client import connect_upstox
from data.instrument_mapper import InstrumentMapper
from engine.screener_logic import OptionsScreenerEngine
from data.websocket_client import UpstoxWebSocketClient

app = FastAPI()

app.add_middleware(
    CORSMiddleware, 
    allow_origins=["*"], 
    allow_methods=["*"], 
    allow_headers=["*"]
)

# ==========================================
# 1. VARIABLES GLOBALES Y CACHÉ
# ==========================================
# Cambiamos la lista por un diccionario para guardar los parámetros de CADA cliente
active_web_clients = {} # Formato: {websocket_obj: dict_parametros}

# CACHÉ INICIAL: Guardamos las últimas 100 alertas globales del mercado
recent_alerts_cache = []

# ¡AQUÍ ESTÁ LA CORRECCIÓN!: Instanciamos el motor a nivel global
engine = OptionsScreenerEngine()

# ==========================================
# 2. FUNCIÓN DE DISTRIBUCIÓN (ROUTER WS)
# ==========================================
async def broadcast_to_web(data: dict):
    # 1. Guardar en el historial global
    recent_alerts_cache.insert(0, data)
    if len(recent_alerts_cache) > 100:
        recent_alerts_cache.pop()

    # 2. Distribuir a los clientes conectados según SUS PROPIOS parámetros
    for ws, params in list(active_web_clients.items()):
        # Aplicamos el filtro en la capa de distribución
        if data["volume"] >= params.get("min_volume", 5000) and \
           data["ratio_value"] >= params.get("vol_price_mismatch_threshold", 2.0):
            try:
                await ws.send_json(data)
            except Exception:
                del active_web_clients[ws]

# Conectamos la salida del motor a nuestra función distribuidora
engine.on_alert_callback = broadcast_to_web

# ==========================================
# 3. INICIO DEL BACKEND Y MOTOR DE TRADING
# ==========================================
async def start_trading_engine():
    try:
        session = await connect_upstox()
        mapper = InstrumentMapper()
        await mapper.fetch_instruments()
        
        # LOS 4 ÍNDICES SOLICITADOS POR EL CLIENTE
        target_underlyings = ["NIFTY", "BANKNIFTY", "FINNIFTY", "SENSEX"]
        target_instruments = []
        
        print("\nBuscando cadenas de opciones para los índices objetivo...")
        
        for symbol in target_underlyings:
            opts_df = mapper.get_options_for_underlying(symbol)
            
            if not opts_df.empty:
                # Buscar la expiración más cercana para este índice específico
                nearest_expiry = sorted(opts_df['expiry'].dropna().unique())[0]
                
                # Extraer las llaves de los contratos
                keys = opts_df[opts_df['expiry'] == nearest_expiry]['instrument_key'].tolist()
                target_instruments.extend(keys)
                
                print(f"✅ {symbol} -> Expiración: {nearest_expiry} | Contratos inyectados: {len(keys)}")
            else:
                print(f"⚠️ No se encontraron contratos para: {symbol}")
        
        if target_instruments:
            print(f"\n🚀 Motor Backend iniciando escaneo masivo de {len(target_instruments)} contratos totales.")
            # Como engine ya es global, el websocket_client puede consumirlo sin error
            ws_client = UpstoxWebSocketClient(engine=engine)
            await ws_client.connect_and_listen(instrument_keys=target_instruments)
        else:
            print("❌ Error: No se pudo inyectar ningún contrato al motor.")
            
    except Exception as e:
        print(f"Error crítico en el motor: {e}")

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(start_trading_engine())

# ==========================================
# 4. WEBSOCKET ENDPOINT (CONEXIÓN APP MÓVIL)
# ==========================================
@app.websocket("/ws/dashboard")
async def websocket_dashboard(websocket: WebSocket):
    await websocket.accept()
    
    # 1. Asignar parámetros por defecto a este cliente específico
    active_web_clients[websocket] = {
        "min_volume": 5000, 
        "vol_price_mismatch_threshold": 2.0
    }
    
    # 2. CARGA DE DATOS INICIALES: Al conectarse, le enviamos el historial que cumpla sus parámetros
    for alert in reversed(recent_alerts_cache):
        if alert["volume"] >= active_web_clients[websocket]["min_volume"] and \
           alert["ratio_value"] >= active_web_clients[websocket]["vol_price_mismatch_threshold"]:
            await websocket.send_json(alert)

    try:
        while True:
            # 3. Actualizar parámetros EN CALIENTE solo para este cliente
            new_params = await websocket.receive_json()
            active_web_clients[websocket].update(new_params)
            print(f"Parámetros actualizados para cliente: {active_web_clients[websocket]}")
            
    except WebSocketDisconnect:
        if websocket in active_web_clients:
            del active_web_clients[websocket]

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)