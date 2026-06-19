Fases del Hito 2
Ingesta de Datos Base (instrument_mapper.py): Descarga asíncrona y procesamiento en memoria (usando Pandas) del catálogo oficial de Upstox para traducir los símbolos a IDs reales.

Motor Lógico (screener_logic.py): Creación de la clase base que recibirá la cadena de opciones y aplicará tus parámetros de filtrado dinámicos (ej. desajustes de volumen/precio).

Actualización del Flujo Principal (main.py): Integración del mapeo antes de iniciar el escaneo continuo.

Código del Proyecto para el Hito 2
1. Actualización de requirements.txt
Para procesar eficientemente el catálogo de miles de instrumentos de Upstox, agregaremos pandas.

Plaintext
fastapi
uvicorn
cryptography
python-dotenv
aiohttp
requests
pandas
(Recuerda ejecutar pip install pandas o reconstruir tu contenedor Docker).

2. src/data/instrument_mapper.py
Este módulo descarga el archivo maestro de Upstox (comprimido en .gz), lo lee directamente en memoria y permite buscar los instrument_keys reales para operar.

Python
import pandas as pd
import aiohttp
import io

class InstrumentMapper:
    def __init__(self):
        self.df = None
        # URL oficial del Instrument Master de Upstox
        self.url = "https://assets.upstox.com/market-quote/instruments/exchange/complete.csv.gz"

    async def fetch_instruments(self):
        print("Descargando Instrument Master oficial de Upstox...")
        async with aiohttp.ClientSession() as session:
            async with session.get(self.url) as response:
                if response.status == 200:
                    content = await response.read()
                    # Pandas lee el CSV comprimido en gzip directamente desde bytes
                    self.df = pd.read_csv(io.BytesIO(content), compression='gzip')
                    print(f"Catálogo cargado: {len(self.df)} instrumentos reales disponibles.")
                else:
                    raise Exception(f"Error descargando instrumentos: {response.status}")

    def get_instrument_key(self, tradingsymbol: str):
        """
        Busca el instrument_key exacto para hacer peticiones a la API.
        Ejemplo: get_instrument_key('NIFTY') o get_instrument_key('BANKNIFTY')
        """
        if self.df is None:
            raise ValueError("El catálogo no ha sido cargado. Ejecuta fetch_instruments() primero.")
        
        # Filtrar por el símbolo exacto
        result = self.df[self.df['tradingsymbol'] == tradingsymbol]
        if not result.empty:
            return result.iloc[0]['instrument_key']
        return None
        
    def get_options_for_underlying(self, underlying_symbol: str, expiry_date: str = None):
        """
        Filtra todos los contratos de opciones para un subyacente específico.
        """
        if self.df is None:
            raise ValueError("Catálogo no cargado.")
            
        options_df = self.df[(self.df['name'] == underlying_symbol) & 
                             (self.df['instrument_type'].isin(['CE', 'PE']))]
        
        if expiry_date:
            options_df = options_df[options_df['expiry'] == expiry_date]
            
        return options_df[['instrument_key', 'tradingsymbol', 'strike', 'instrument_type', 'expiry']]
3. src/engine/screener_logic.py
Aquí construiremos la estructura modular donde inyectaremos tus fórmulas matemáticas en el futuro. Por ahora, establece la base para procesar la data real que recibiremos.

Python
import pandas as pd

class OptionsScreenerEngine:
    def __init__(self, parameters: dict = None):
        # Parámetros editables en caliente (UI)
        self.parameters = parameters or {
            "min_volume": 1000,
            "vol_price_mismatch_threshold": 1.5 # Ejemplo de multiplicador
        }

    def update_parameters(self, new_params: dict):
        """Permite actualizar las reglas sin reiniciar la aplicación"""
        self.parameters.update(new_params)
        print(f"Parámetros actualizados: {self.parameters}")

    def analyze_chain(self, options_data: list) -> pd.DataFrame:
        """
        Recibe la data en vivo del broker y aplica los filtros.
        options_data debe ser una lista de diccionarios con operaciones reales.
        """
        if not options_data:
            return pd.DataFrame()

        df = pd.DataFrame(options_data)
        
        # Estructura base para el filtrado (se poblará con tus fórmulas exactas)
        # Ejemplo: Filtrar por volumen mínimo
        if 'volume' in df.columns:
            filtered_df = df[df['volume'] >= self.parameters['min_volume']]
        else:
            filtered_df = df

        # Lógica de desajuste Volumen/Precio iría aquí
        # ...

        # Retornar los contratos más atractivos
        return filtered_df
4. src/main.py (Actualizado)
Integramos el mapeo de instrumentos al flujo principal de arranque.

Python
import asyncio
from data.upstox_client import connect_upstox
from data.instrument_mapper import InstrumentMapper
from engine.screener_logic import OptionsScreenerEngine

async def main():
    print("Iniciando Options Screener (Upstox)...")
    
    try:
        # 1. Autenticación HTTP persistente
        session = await connect_upstox()
        print("Sesión iniciada.")
        
        # 2. Cargar el Instrument Master (Operaciones Reales)
        mapper = InstrumentMapper()
        await mapper.fetch_instruments()
        
        # Prueba de mapeo real: Obtener el ID interno del índice NIFTY
        nifty_key = mapper.get_instrument_key("NIFTY")
        banknifty_key = mapper.get_instrument_key("BANKNIFTY")
        
        print(f"Mapeo verificado -> NIFTY ID: {nifty_key}")
        print(f"Mapeo verificado -> BANKNIFTY ID: {banknifty_key}")
        
        # 3. Inicializar el motor lógico con parámetros dinámicos
        engine = OptionsScreenerEngine(parameters={"min_volume": 5000})
        
        # Siguiente paso: Iniciar el bucle de datos en vivo (WebSockets)
        # ...
        
        await session.close()
        
    except Exception as e:
        print(f"Error en la ejecución: {e}")

if __name__ == "__main__":
    asyncio.run(main())