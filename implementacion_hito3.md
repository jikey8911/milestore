La API v2 de Upstox requiere un proceso de dos pasos para los WebSockets de datos de mercado:

Autorización: Consultar un endpoint REST para obtener una URL de WebSocket (wss://) autorizada y temporal.

Suscripción: Conectarse a esa URL y enviar un mensaje con los instrument_keys reales para recibir el flujo continuo (ticks).

Código del Proyecto
1. src/data/websocket_client.py
Este nuevo módulo maneja la obtención de la URL segura y mantiene el ciclo de vida de la conexión WebSocket para recibir la data pura del mercado.

Python
import aiohttp
import asyncio
import json
from auth.security import get_credentials

class UpstoxWebSocketClient:
    def __init__(self, engine):
        self.engine = engine
        self.ws = None
        self.session = None

    async def get_authorized_ws_url(self, token: str) -> str:
        """Obtiene la URL temporal autorizada para conectarse al WebSocket de Upstox."""
        url = 'https://api.upstox.com/v2/feed/market-data-feed/authorize'
        headers = {
            'accept': 'application/json',
            'Api-Version': '2.0',
            'Authorization': f'Bearer {token}'
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    return data['data']['authorized_redirect_uri']
                else:
                    error = await response.text()
                    raise Exception(f"Fallo al obtener URL del WebSocket: {error}")

    async def connect_and_listen(self, instrument_keys: list):
        """Conecta al WebSocket y procesa el flujo real de datos."""
        try:
            creds = get_credentials()
            token = creds.get("TOKEN")
            
            ws_url = await self.get_authorized_ws_url(token)
            print("URL de WebSocket autorizada obtenida.")

            self.session = aiohttp.ClientSession()
            self.ws = await self.session.ws_connect(ws_url)
            print("Conexión WebSocket establecida. Operando con conectividad real.")

            # Enviar solicitud de suscripción para los instrumentos mapeados
            subscription_payload = {
                "guid": "screener_sub_1",
                "method": "sub",
                "data": {
                    "mode": "full", # 'full' para order book, bid/ask y volumen
                    "instrumentKeys": instrument_keys
                }
            }
            
            # Upstox requiere el payload en formato binario para Market Data
            await self.ws.send_bytes(json.dumps(subscription_payload).encode('utf-8'))
            print(f"Suscripción enviada para: {instrument_keys}")

            # Bucle de escucha infinita para inyectar datos reales al motor
            async for msg in self.ws:
                if msg.type == aiohttp.WSMsgType.BINARY:
                    # Aquí recibimos la data binaria real (Protobuf en Upstox V2)
                    # El motor de lógica la decodificará y procesará
                    self.engine.analyze_chain(msg.data)
                elif msg.type == aiohttp.WSMsgType.ERROR:
                    print(f"Error en WebSocket: {self.ws.exception()}")
                    break
                    
        except Exception as e:
            print(f"Error en el cliente WebSocket: {e}")
        finally:
            await self.close()

    async def close(self):
        """Cierra conexiones limpiamente."""
        if self.ws:
            await self.ws.close()
        if self.session:
            await self.session.close()
        print("Conexión WebSocket cerrada.")
2. Actualización de src/engine/screener_logic.py
Ajustamos el motor para que reconozca que ahora recibirá una transmisión de datos reales continuos. En Upstox V2, los datos del feed de mercado llegan en formato binario (Protobuf).

Python
import pandas as pd

class OptionsScreenerEngine:
    def __init__(self, parameters: dict = None):
        self.parameters = parameters or {
            "min_volume": 1000,
            "vol_price_mismatch_threshold": 1.5
        }

    def update_parameters(self, new_params: dict):
        self.parameters.update(new_params)
        print(f"Parámetros actualizados: {self.parameters}")

    def analyze_chain(self, raw_binary_data) -> None:
        """
        Recibe el bloque de datos binarios en tiempo real del WebSocket.
        Aquí se implementará la decodificación Protobuf exacta del broker.
        """
        if not raw_binary_data:
            return

        # Para esta fase, confirmamos la recepción de bytes reales.
        # En la siguiente iteración implementaremos el schema Protobuf de Upstox 
        # para extraer el bid, ask, last price y volumen de estos bytes.
        size = len(raw_binary_data)
        
        # Simulación de impresión para verificar el flujo (borrar en prod)
        # print(f"Tick real recibido: {size} bytes") 
        pass
3. Integración en src/main.py
Conectamos todo el flujo: HTTP -> Mapeo -> WebSockets -> Motor Lógico.

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
        
        # Mapeamos los IDs reales
        nifty_key = mapper.get_instrument_key("NIFTY")
        banknifty_key = mapper.get_instrument_key("BANKNIFTY")
        
        engine = OptionsScreenerEngine(parameters={"min_volume": 5000})
        print("Motor lógico inicializado.")
        
        # Iniciar conexión WebSocket con operaciones reales
        target_instruments = [nifty_key, banknifty_key]
        ws_client = UpstoxWebSocketClient(engine=engine)
        
        print("Iniciando streaming de mercado en vivo...")
        # El programa se mantendrá ejecutando dentro de esta función escuchando datos
        await ws_client.connect_and_listen(instrument_keys=target_instruments)
        
        await session.close()
        
    except Exception as e:
        print(f"Error en la ejecución: {e}")

if __name__ == "__main__":
    asyncio.run(main())