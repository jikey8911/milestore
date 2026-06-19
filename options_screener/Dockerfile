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
