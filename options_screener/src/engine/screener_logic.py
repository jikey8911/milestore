import sys
import os
import time

# Garantizar resolución del módulo compilado dinámicamente
sys.path.append(os.path.join(os.path.dirname(__file__), '../data'))

try:
    import MarketDataFeed_pb2
except ImportError:
    pass

class OptionsScreenerEngine:
    def __init__(self, parameters: dict = None, on_alert_callback=None):
        self.parameters = parameters or {
            "min_volume": 5000,
            "vol_price_mismatch_threshold": 2.0
        }
        self.market_state = {}
        self.on_alert_callback = on_alert_callback 

    def update_parameters(self, new_params: dict):
        """Actualiza parámetros en caliente sin detener el bot"""
        self.parameters.update(new_params)
        print(f"Parámetros actualizados: {self.parameters}")

    def evaluate_opportunity(self, instrument: str, ltp: float, volume: float, current_ts: float):
        """
        Núcleo matemático: Aplica fórmulas y detecta anomalías.
        """
        # 1. Filtro de liquidez: Si no hay volumen, descartar el análisis de inmediato
        if volume < self.parameters["min_volume"]:
            # Actualizamos estado silenciosamente
            self.market_state[instrument] = {'ltp': ltp, 'volume': volume, 'ts': current_ts}
            return

        # 2. Análisis Comparativo (Requiere un tick previo en memoria)
        if instrument in self.market_state:
            prev_data = self.market_state[instrument]
            prev_ltp = prev_data['ltp']
            prev_vol = prev_data['volume']
            
            # Solo evaluar si hubo algún movimiento real
            if prev_ltp > 0 and prev_vol > 0 and (ltp != prev_ltp or volume != prev_vol):
                
                # FÓRMULA 1: Calcular Deltas Porcentuales (Absolutos)
                price_change_pct = abs((ltp - prev_ltp) / prev_ltp) * 100
                vol_change_pct = abs((volume - prev_vol) / prev_vol) * 100
                
                # FÓRMULA 2: Ratio de Desajuste (Mismatch)
                # Evaluamos si el volumen se disparó desproporcionadamente respecto al precio
                if price_change_pct > 0:
                    mismatch_ratio = vol_change_pct / price_change_pct
                    
                    # DISPARADOR DE ALERTA
                    if mismatch_ratio >= self.parameters["vol_price_mismatch_threshold"]:
                        print(f"🚨 [OPORTUNIDAD DETECTADA] {instrument}")
                        print(f"    ├─ Ratio Anomalía : {mismatch_ratio:.2f}x (Umbral: {self.parameters['vol_price_mismatch_threshold']})")
                        print(f"    ├─ Precio         : ₹{ltp} (Δ {price_change_pct:.4f}%)")
                        print(f"    └─ Volumen        : {volume} (Δ {vol_change_pct:.4f}%)")
                        print("-" * 50)
                        
                        if self.on_alert_callback:
                            import asyncio
                            from datetime import datetime
                            # Crear el payload
                            payload = {
                                "time": datetime.now().strftime("%H:%M:%S"),
                                "instrument": instrument,
                                "ratio": f"{mismatch_ratio:.2f}x"
                            }
                            # Como on_alert_callback es async (broadcast_to_web), la creamos como task
                            try:
                                loop = asyncio.get_running_loop()
                                loop.create_task(self.on_alert_callback(payload))
                            except RuntimeError:
                                pass # Si no hay loop, no intentamos llamar al callback


        # 3. Guardar el estado actual para el siguiente tick
        self.market_state[instrument] = {
            'ltp': ltp,
            'volume': volume,
            'ts': current_ts
        }

    def analyze_chain(self, raw_binary_data) -> None:
        """
        Desempaqueta el flujo de Protobuf y alimenta el motor matemático.
        """
        if not raw_binary_data:
            return

        try:
            feed_response = MarketDataFeed_pb2.FeedResponse()
            feed_response.ParseFromString(raw_binary_data)
            current_time = time.time()

            for instrument_key, feed in feed_response.feeds.items():
                if feed.HasField('fullFeed'):
                    market_ff = feed.fullFeed.marketFF
                    
                    ltp = market_ff.ltpc.ltp
                    volumen = market_ff.vtt  # Volume Traded Today
                    
                    # Enviar datos estructurados al evaluador de fórmulas
                    self.evaluate_opportunity(instrument_key, ltp, volumen, current_time)

        except Exception as e:
            # En sistemas de alta frecuencia, es mejor ignorar un tick corrupto que colapsar
            pass
