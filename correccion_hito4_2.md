Actualiza tu src/data/instrument_mapper.py
Vamos a hacer el motor de búsqueda mucho más robusto. Reemplaza el método get_options_for_underlying con este:

Python
    def get_options_for_underlying(self, underlying_symbol: str, expiry_date: str = None):
        """
        Filtra todos los contratos de opciones para un subyacente específico.
        """
        if self.df is None:
            raise ValueError("Catálogo no cargado.")
            
        # Filtro robusto: Buscamos que el símbolo empiece exactamente con NIFTY o BANKNIFTY
        # y que el tipo de instrumento sea CE o PE
        options_df = self.df[
            (self.df['tradingsymbol'].str.startswith(underlying_symbol)) & 
            (self.df['instrument_type'].isin(['CE', 'PE']))
        ]
        
        if expiry_date:
            options_df = options_df[options_df['expiry'] == expiry_date]
            
        return options_df[['instrument_key', 'tradingsymbol', 'strike', 'instrument_type', 'expiry']]
2. Actualiza tu src/main.py
Añadiremos una red de seguridad (if not ...) para que, si el broker algún día envía un catálogo vacío, el bot te avise de forma elegante en lugar de colapsar.

Reemplaza la sección del "Buscando cadena de opciones..." con esto:

Python
        print("Buscando cadena de opciones real en el Instrument Master...")
        
        # 1. Obtener absolutamente todas las opciones
        nifty_opts = mapper.get_options_for_underlying("NIFTY")
        banknifty_opts = mapper.get_options_for_underlying("BANKNIFTY")
        
        # Extraemos las listas de expiración únicas
        nifty_expiries = sorted(nifty_opts['expiry'].dropna().unique())
        banknifty_expiries = sorted(banknifty_opts['expiry'].dropna().unique())
        
        # RED DE SEGURIDAD: Previene el "list index out of range"
        if not nifty_expiries or not banknifty_expiries:
            print("⚠️ Error Crítico: No se detectaron contratos de opciones en el catálogo.")
            print(f"NIFTY encontrados: {len(nifty_opts)} | BANKNIFTY encontrados: {len(banknifty_opts)}")
            return # Detenemos la ejecución limpiamente

        # 2. Encontrar la fecha de expiración más cercana dinámicamente
        nifty_nearest_expiry = nifty_expiries[0]
        banknifty_nearest_expiry = banknifty_expiries[0]
        
        print(f"Expiración más cercana detectada -> NIFTY: {nifty_nearest_expiry} | BANKNIFTY: {banknifty_nearest_expiry}")
        
        # 3. Filtrar los DataFrames para quedarnos SOLO con los contratos de esa semana/mes
        nifty_target_opts = nifty_opts[nifty_opts['expiry'] == nifty_nearest_expiry]
        banknifty_target_opts = banknifty_opts[banknifty_opts['expiry'] == banknifty_nearest_