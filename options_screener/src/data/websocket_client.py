import aiohttp
import asyncio
import json
import logging
from auth.security import get_credentials

logger = logging.getLogger(__name__)
# Configuración básica de logging para que salga en consola si no está configurado a nivel global
if not logger.handlers:
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

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
                    logger.error(f"Fallo al obtener URL del WebSocket: {error}")
                    raise Exception(f"Fallo al obtener URL del WebSocket: {error}")

    async def connect_and_listen(self, instrument_keys: list):
        """Conecta al WebSocket con mecanismo de Auto-Reconexión y Heartbeat."""
        while True:
            try:
                creds = get_credentials()
                token = creds.get("TOKEN")
                
                ws_url = await self.get_authorized_ws_url(token)
                logger.info("URL de WebSocket autorizada obtenida (API v3).")

                self.session = aiohttp.ClientSession()
                # AÑADIDO: heartbeat=30.0 mantiene la conexión viva enviando Pings automáticos
                self.ws = await self.session.ws_connect(ws_url, heartbeat=30.0)
                logger.info("Conexión WebSocket establecida. Operando con conectividad real.")

                # Enviar solicitud de suscripción para los instrumentos mapeados
                subscription_payload = {
                    "guid": "screener_sub_1",
                    "method": "sub",
                    "data": {
                        "mode": "full", 
                        "instrumentKeys": instrument_keys
                    }
                }
                
                await self.ws.send_bytes(json.dumps(subscription_payload).encode('utf-8'))
                logger.info(f"Suscripción enviada para: {instrument_keys}")

                # Bucle de escucha infinita
                async for msg in self.ws:
                    if msg.type == aiohttp.WSMsgType.BINARY:
                        self.engine.analyze_chain(msg.data)
                    elif msg.type == aiohttp.WSMsgType.ERROR:
                        logger.error(f"Error en WebSocket: {self.ws.exception()}")
                        break # Rompe el ciclo 'for' para forzar la reconexión
                    elif msg.type == aiohttp.WSMsgType.CLOSED:
                        logger.info("WebSocket cerrado por el servidor. Preparando reconexión...")
                        break # Rompe el ciclo 'for' para forzar la reconexión
                        
            except Exception as e:
                logger.error(f"Caída del cliente WebSocket: {e}. Reintentando en 5 segundos...")
            finally:
                # Limpieza segura de la memoria antes de reconectar
                if self.ws:
                    await self.ws.close()
                if self.session:
                    await self.session.close()
            
            # Pausa de seguridad antes de martillar la API de Upstox nuevamente
            logger.info("Iniciando secuencia de reconexión automática...")
            await asyncio.sleep(5)

    async def close(self):
        """Cierra conexiones limpiamente."""
        if self.ws:
            await self.ws.close()
        if self.session:
            await self.session.close()
        logger.info("Conexión WebSocket cerrada.")
