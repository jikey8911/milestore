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
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
        async with aiohttp.ClientSession(headers=headers) as session:
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
            
        # CORRECCIÓN APLICADA: CE y PE se encuentran en la columna 'option_type'
        options_df = self.df[
            (self.df['name'] == underlying_symbol) & 
            (self.df['option_type'].isin(['CE', 'PE']))
        ]
        
        if expiry_date:
            options_df = options_df[options_df['expiry'] == expiry_date]
            
        return options_df[['instrument_key', 'tradingsymbol', 'strike', 'option_type', 'expiry']]
