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

active_web_clients = []

async def broadcast_to_web(data: dict):
    for client in active_web_clients:
        try:
            await client.send_json(data)
        except Exception:
            active_web_clients.remove(client)

engine = OptionsScreenerEngine(on_alert_callback=broadcast_to_web)

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
            ws_client = UpstoxWebSocketClient(engine=engine)
            await ws_client.connect_and_listen(instrument_keys=target_instruments)
        else:
            print("❌ Error: No se pudo inyectar ningún contrato al motor.")
            
    except Exception as e:
        print(f"Error crítico en el motor: {e}")

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(start_trading_engine())

@app.websocket("/ws/dashboard")
async def websocket_dashboard(websocket: WebSocket):
    await websocket.accept()
    active_web_clients.append(websocket)
    try:
        while True:
            new_params = await websocket.receive_json()
            engine.update_parameters(new_params)
    except WebSocketDisconnect:
        active_web_clients.remove(websocket)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)