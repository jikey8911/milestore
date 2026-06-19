
Upstox ha actualizado su endpoint de WebSockets de v2 a v3. La buena noticia es que el cambio es minúsculo, solo tenemos que actualizar la URL en nuestro archivo src/data/websocket_client.py.

Vamos a generar el archivo actualizado. Solo necesitas reemplazar el contenido de tu src/data/websocket_client.py con este nuevo código.

Código actualizado para src/data/websocket_client.py
Python  
```python
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
        # --- CORRECCIÓN APLICADA AQUÍ: Endpoint V3 ---
        url = 'https://api.upstox.com/v3/feed/market-data-feed/authorize'
        
        headers = {
            'accept': 'application/json',
            'Api-Version': '3.0', # También actualizamos el header de la versión por precaución
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
            print("URL de WebSocket autorizada obtenida (API v3).")

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
                    # Aquí recibimos la data binaria real (Protobuf en Upstox)
                    # El motor de lógica la decodificará y procesará
                    self.engine.analyze_chain(msg.data)
                elif msg.type == aiohttp.WSMsgType.ERROR:
                    print(f"Error en WebSocket: {self.ws.exception()}")
                    break
                elif msg.type == aiohttp.WSMsgType.CLOSED:
                    print("WebSocket cerrado por el servidor.")
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
```