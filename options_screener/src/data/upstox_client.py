import aiohttp
from auth.security import get_credentials

async def connect_upstox():
    """
    Inicializa una sesión de aiohttp con las credenciales de Upstox.
    """
    try:
        creds = get_credentials()
        print(f"Credenciales de Upstox cargadas: {list(creds.keys())}")
    except Exception as e:
        print(f"Aviso: No se pudieron cargar credenciales cifradas: {e}")
        creds = {}

    token = creds.get("TOKEN")
    if not token:
        print("Advertencia: No se encontró el TOKEN en las credenciales.")
        # Retornamos sesión vacía para no bloquear el flujo si solo se quiere probar el mapper
        return aiohttp.ClientSession()

    headers = {
        'accept': 'application/json',
        'Api-Version': '2.0',
        'Authorization': f'Bearer {token}'
    }

    url = 'https://api.upstox.com/v2/user/profile'
    session = aiohttp.ClientSession(headers=headers)
    
    try:
        async with session.get(url) as response:
            if response.status == 200:
                print("Conectado exitosamente a Upstox API")
                return session 
            else:
                print(f"Error HTTP {response.status} al conectar con Upstox.")
                return session
    except Exception as e:
        print(f"Excepción durante la conexión: {e}")
        return session
