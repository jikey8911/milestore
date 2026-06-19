La integración del esquema Protobuf garantiza que el sistema opere exclusivamente con datos verídicos y crudos del exchange, eliminando cualquier capa de simulación o mock. Este paso traduce la transmisión binaria de alta frecuencia a parámetros de mercado estructurados para el motor lógico.

A continuación, la estructura completa para la implementación.

1. Esquema Oficial de Upstox (src/data/MarketDataFeed.proto)
Este archivo define la estructura binaria del flujo de datos. Guárdalo en la carpeta src/data/.

Protocol Buffers
syntax = "proto3";
package com.upstox.marketdatafeeder.rpc.proto;

message FeedResponse {
    enum Type {
        initial_feed = 0;
        live_feed = 1;
    }
    Type type = 1;
    map<string, Feed> feeds = 2;
}

message Feed {
    oneof FeedUnion {
        LTPC ltpc = 1;
        FullFeed fullFeed = 2;
        OptionGreekFeed optionGreekFeed = 3;
    }
}

message LTPC {
    double ltp = 1;
    int64 ltt = 2;
    int64 ltq = 3;
    double cp = 4;
}

message FullFeed {
    MarketFullFeed marketFF = 1;
}

message MarketFullFeed {
    LTPC ltpc = 1;
    MarketLevel marketLevel = 2;
    OptionGreeks optionGreeks = 3;
    MarketOHLC marketOHLC = 4;
    double atp = 5;
    double vtt = 6;
    double oi = 7;
    double close = 8;
}

message MarketLevel {
    repeated Quote bidAskQuote = 1;
}

message Quote {
    int32 bq = 1;
    double bp = 2;
    int32 bno = 3;
    int32 aq = 4;
    double ap = 5;
    int32 ano = 6;
}

message OptionGreeks {
    double op = 1;
    double up = 2;
    double iv = 3;
    double delta = 4;
    double theta = 5;
    double gamma = 6;
    double vega = 7;
    double rho = 8;
}

message MarketOHLC {
    repeated OHLC ohlc = 1;
}

message OHLC {
    string interval = 1;
    double open = 2;
    double high = 3;
    double low = 4;
    double close = 5;
    int32 volume = 6;
    int64 ts = 7;
}

message OptionGreekFeed {
    OptionGreeks optionGreeks = 1;
}
2. Automatización de Entorno (Dockerfile)
Se requiere el compilador protoc a nivel de sistema operativo para generar las clases Python automáticamente.

Dockerfile
FROM python:3.11-slim

# Desactiva el buffering para asegurar salida de logs en tiempo real
ENV PYTHONUNBUFFERED=1

# Instalación del compilador Protobuf
RUN apt-get update && apt-get install -y protobuf-compiler && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "src/main.py"]
3. Orquestación y Compilación Automática (docker-compose.yml)
El comando de arranque se actualiza para compilar el esquema binario dinámicamente antes de levantar el proceso principal.

YAML
services:
  screener:
    build: .
    develop:
      watch:
        - action: sync
          path: ./src
          target: /app/src
        - action: rebuild
          path: requirements.txt
    environment:
      - ENV=development
      - PYTHONUNBUFFERED=1
    ports:
      - "8000:8000"
    command: sh -c "protoc --python_out=./src/data --proto_path=./src/data ./src/data/MarketDataFeed.proto && python src/main.py"
4. Dependencias del Proyecto (requirements.txt)
Se añade el soporte nativo para la serialización de Google Protocol Buffers.

Plaintext
fastapi
uvicorn
cryptography
python-dotenv
aiohttp
requests
pandas
protobuf
5. Motor de Decodificación y Lógica (src/engine/screener_logic.py)
El motor ahora intercepta el flujo crudo, lo decodifica y expone el precio y volumen reales.

Python
import pandas as pd
import sys
import os

# Garantizar resolución del módulo compilado dinámicamente
sys.path.append(os.path.join(os.path.dirname(__file__), '../data'))

try:
    import MarketDataFeed_pb2
except ImportError:
    print("Aviso: MarketDataFeed_pb2 no encontrado. Se generará en el arranque del contenedor.")

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
        Interpreta la carga binaria de operaciones reales del broker.
        """
        if not raw_binary_data:
            return

        try:
            # Instanciar el objeto Protobuf
            feed_response = MarketDataFeed_pb2.FeedResponse()
            feed_response.ParseFromString(raw_binary_data)

            # Iterar sobre las transmisiones de los instrumentos
            for instrument_key, feed in feed_response.feeds.items():
                if feed.HasField('fullFeed'):
                    market_ff = feed.fullFeed.marketFF
                    
                    ltp = market_ff.ltpc.ltp
                    volumen = market_ff.vtt  # Volume Traded Today
                    
                    # Consumo directo de la fluctuación real del mercado
                    print(f"📈 [TICK] {instrument_key} | Precio: ₹{ltp:.2f} | Volumen: {volumen}")

        except Exception as e:
            print(f"⚠️ Error decodificando Protobuf: {e}")