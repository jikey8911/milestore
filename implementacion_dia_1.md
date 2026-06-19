REFACTORIACION DE DIA 1


docker-compose.yml (Sin cambios funcionales)El orquestador se mantiene igual, ejecutando la instalación de requerimientos y lanzando el script principal.  YAMLservices:
  screener:
    build: .
    volumes:
      - .:/app
    environment:
      - ENV=development
    command: sh -c "pip install -r requirements.txt && python src/main.py"
2. requirements.txtSe elimina la dependencia ib_insync y se agrega aiohttp y requests para manejar las conexiones HTTP asíncronas con Upstox.  Plaintextfastapi
uvicorn
cryptography
python-dotenv
aiohttp
requests
3. src/auth/security.py (Se mantiene igual)La lógica de cifrado con Fernet funciona perfectamente para Upstox. Tu cadena de credenciales actual (API_KEY=...,SECRET_KEY=...,TOKEN=...) se cifrará y descifrará correctamente.  Pythonfrom cryptography.fernet import Fernet
import os

# Generar llave de cifrado (guarda este archivo secret.key en un lugar seguro)
def generate_key():
    key = Fernet.generate_key()
    with open("secret.key", "wb") as key_file:
        key_file.write(key)
    print("Llave secret.key generada.")

def encrypt_credentials(data: str):
    if not os.path.exists("secret.key"):
        generate_key()
        
    with open("secret.key", "rb") as key_file:
        key = key_file.read()
    f = Fernet(key)
    encrypted_data = f.encrypt(data.encode())
    with open("credentials.enc", "wb") as file:
        file.write(encrypted_data)
    print("Credenciales cifradas en credentials.enc.")

if __name__ == "__main__":
    # La cadena de prueba actual ya contiene tus formatos de Upstox
    generate_key()
    encrypt_credentials("API_KEY=01cdf43d-dae4-414e-bd8c-ebf621eaf3ab,SECRET_KEY=8te76q8el1,TOKEN=eyJ0eXAiOiJKV1QiLCJrZXlfaWQiOiJza192MS4wIiwiYWxnIjoiSFMyNTYifQ.eyJzdWIiOiJBVjMwNjgiLCJqdGkiOiI2YTMyMjY1YmY3NjFiMzUwMTU5ZmQ4MjkiLCJpc011bHRpQ2xpZW50IjpmYWxzZSwiaXNQbHVzUGxhbiI6dHJ1ZSwiaWF0IjoxNzgxNjcxNTE1LCJpc3MiOiJ1ZGFwaS1nYXRld2F5LXNlcnZpY2UiLCJleHAiOjE3ODE3MzM2MDB9.BV5BTGxHvCiK3hThHQtfzQTHSUUoOAIVLDXCHB5MgWk")
4. src/data/upstox_client.py (Reemplaza a ibkr_client.py)Este nuevo archivo lee las credenciales descifradas (usando get_credentials() tal como lo tenías) y establece una conexión asíncrona enviando el TOKEN a la API V2 de Upstox para validar la sesión.  Pythonimport os
import aiohttp
from cryptography.fernet import Fernet

def get_credentials():
    if not os.path.exists("secret.key") or not os.path.exists("credentials.enc"):
        raise FileNotFoundError("Faltan archivos de seguridad (secret.key o credentials.enc)")
        
    with open("secret.key", "rb") as key_file:
        key = key_file.read()
    with open("credentials.enc", "rb") as file:
        encrypted_data = file.read()
    
    f = Fernet(key)
    decrypted_data = f.decrypt(encrypted_data).decode()
    return dict(item.split("=") for item in decrypted_data.split(","))

async def connect_upstox():
    try:
        creds = get_credentials()
        print(f"Credenciales cargadas para: {list(creds.keys())}")
    except Exception as e:
        print(f"Aviso: No se pudieron cargar credenciales cifradas: {e}")
        creds = {}

    token = creds.get("TOKEN")
    if not token:
        raise ValueError("No se encontró el TOKEN en las credenciales. Ejecuta security.py primero.")

    # Upstox API V2 requiere el Token en el Header de Autorización
    headers = {
        'accept': 'application/json',
        'Api-Version': '2.0',
        'Authorization': f'Bearer {token}'
    }

    # Endpoint para validar que la conexión y el token funcionan (User Profile)
    url = 'https://api.upstox.com/v2/user/profile'
    
    # Iniciamos sesión asíncrona HTTP
    session = aiohttp.ClientSession(headers=headers)
    
    try:
        async with session.get(url) as response:
            if response.status == 200:
                print("Conectado exitosamente a Upstox API")
                # Retornamos la sesión para poder seguir usándola en el main
                return session 
            else:
                error_msg = await response.text()
                print(f"Error HTTP {response.status} al conectar con Upstox: {error_msg}")
                await session.close()
                raise Exception("Fallo de autenticación con Upstox. Verifica tu TOKEN.")
    except Exception as e:
        print(f"Excepción durante la conexión: {e}")
        await session.close()
        raise
5. src/main.pySe actualiza para invocar el cliente de Upstox en lugar del cliente de Interactive Brokers y para manejar correctamente el cierre de la sesión web.  Pythonimport asyncio
from data.upstox_client import connect_upstox

async def main():
    print("Iniciando Options Screener (Upstox)...")
    
    # La conexión fallará si no hay credenciales cifradas válidas
    try:
        # Obtenemos la sesión web persistente
        session = await connect_upstox()
        print("Sesión iniciada.")
        
        # Aquí irá la lógica principal (consultas a endpoints de Upstox, WebSockets, etc.)
        
        # Cierre limpio de la sesión al finalizar
        await session.close()
        
    except Exception as e:
        print(f"Error en la ejecución: {e}")

if __name__ == "__main__":
    asyncio.run(main())