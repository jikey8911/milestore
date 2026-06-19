Para optimizar la memoria y asegurar que evaluamos contratos con liquidez real, el sistema calculará matemáticamente la fecha de vencimiento (expiry) más próxima y filtrará el Instrument Master para inyectar solo esos contratos en el WebSocket.

Fases de la Implementación
Extracción Completa: Obtener todos los contratos de NIFTY y BANKNIFTY del catálogo en memoria.

Cálculo de Expiración: Ordenar las fechas disponibles y seleccionar el vencimiento más cercano (Nearest Expiry).

Filtrado y Mapeo: Aislar los contratos de esa fecha específica y extraer sus instrument_key en una lista plana.

Inyección Masiva: Enviar la lista combinada (cientos de contratos + índices base) al túnel WebSocket para análisis en tiempo real.

A continuación, el código para actualizar tu orquestador principal. Reemplaza todo el contenido de tu archivo src/main.py:

Python
import asyncio
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__)))

from data.upstox_client import connect_upstox
from data.instrument_mapper import InstrumentMapper
from engine.screener_logic import OptionsScreenerEngine
from data.websocket_client import UpstoxWebSocketClient

async def main():
    print("Iniciando Options Screener (Upstox)...")
    
    try:
        session = await connect_upstox()
        print("Sesión HTTP iniciada.")
        
        mapper = InstrumentMapper()
        await mapper.fetch_instruments()
        
        print("Buscando cadena de opciones real en el Instrument Master...")
        
        # 1. Obtener absolutamente todas las opciones del NIFTY y BANKNIFTY
        nifty_opts = mapper.get_options_for_underlying("NIFTY")
        banknifty_opts = mapper.get_options_for_underlying("BANKNIFTY")
        
        # 2. Encontrar la fecha de expiración más cercana dinámicamente
        # Ordenamos las fechas únicas disponibles y tomamos la primera [0]
        nifty_nearest_expiry = sorted(nifty_opts['expiry'].dropna().unique())[0]
        banknifty_nearest_expiry = sorted(banknifty_opts['expiry'].dropna().unique())[0]
        
        print(f"Expiración más cercana detectada -> NIFTY: {nifty_nearest_expiry} | BANKNIFTY: {banknifty_nearest_expiry}")
        
        # 3. Filtrar los DataFrames para quedarnos SOLO con los contratos de esa semana/mes
        nifty_target_opts = nifty_opts[nifty_opts['expiry'] == nifty_nearest_expiry]
        banknifty_target_opts = banknifty_opts[banknifty_opts['expiry'] == banknifty_nearest_expiry]
        
        # 4. Extraer los identificadores únicos a una lista de Python
        nifty_keys = nifty_target_opts['instrument_key'].tolist()
        banknifty_keys = banknifty_target_opts['instrument_key'].tolist()
        
        # 5. Combinar todas las listas (Añadimos también los índices base como referencia)
        target_instruments = nifty_keys + banknifty_keys + [
            mapper.get_instrument_key("NIFTY"), 
            mapper.get_instrument_key("BANKNIFTY")
        ]
        
        print(f"🚀 Total de instrumentos inyectados al escáner: {len(target_instruments)} contratos.")
        
        # Inicializamos el motor con un filtro de liquidez
        engine = OptionsScreenerEngine(parameters={"min_volume": 5000})
        print("Motor lógico inicializado. A la espera de anomalías (Ratio >= 2.0x)...")
        
        # Lanzamos el túnel de WebSocket
        ws_client = UpstoxWebSocketClient(engine=engine)
        
        print("Iniciando streaming de alta frecuencia...")
        await ws_client.connect_and_listen(instrument_keys=target_instruments)
        
    except Exception as e:
        print(f"Error en la ejecución: {e}")
    finally:
        # Cierre seguro
        if 'session' in locals() and not session.closed:
            await session.close()

if __name__ == "__main__":
    asyncio.run(main())