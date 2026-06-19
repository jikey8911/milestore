Aquí tienes el plan de implementación técnico y directo para cerrar el **Hito 5** y desarrollar el **Hito 6**. Está estructurado para que mantengas la velocidad de desarrollo y asegures una entrega impecable.

### 🏁 Fase 1: Cierre del Hito 5 (Dashboard Móvil Final)

Para completar el Hito 5, nos enfocaremos en las funcionalidades de interacción y exportación que pidió el cliente en el frontend de Expo.

#### 1. Exportación a CSV

* **Dependencias:** Ejecutar `npx expo install expo-file-system expo-sharing`.
* **Implementación:**
* Crear un botón "Export CSV" en la cabecera del `SafeAreaView`.
* Programar una función que tome el estado actual del arreglo `alerts`, lo itere construyendo un string con formato `Hora,Instrumento,Ratio\n`, y lo guarde en el directorio temporal usando `FileSystem.cacheDirectory`.
* Lanzar `Sharing.shareAsync()` para que el usuario pueda enviarlo por WhatsApp, correo o guardarlo en sus archivos.



#### 2. Motor de Ordenamiento (Sorting)

* **Implementación:**
* Modificar el componente `NeoTable.tsx`. Convertir los `<Text>` estáticos del encabezado en `<TouchableOpacity>`.
* Crear dos estados locales: `sortConfig = { key: 'ratio', direction: 'desc' }`.
* Aplicar un `.sort()` dinámico al arreglo `data` dentro de un `useMemo` antes de inyectarlo en el `FlatList`. Asegurar que los ratios numéricos se parseen correctamente para que un "5.2x" sea mayor que un "10.1x" (evitar el ordenamiento alfabético en números).



#### 3. Sistema de Presets (Filtros guardados)

* **Dependencias:** Instalar `@react-native-async-storage/async-storage`.
* **Implementación:**
* Añadir inputs para "Volumen Mínimo" y "Ratio Mínimo" en tu `connectionPanel`.
* Crear botones de "Guardar Preset" y "Cargar Preset".
* Al guardar, serializar los parámetros con `JSON.stringify` y almacenarlos en el AsyncStorage del dispositivo para que el cliente no tenga que volver a escribirlos cada vez que abre la app.



---

### 🚀 Fase 2: Hito 6 (Scripts de Despliegue 'One-Click')

El objetivo del Hito 6 es que el cliente reciba una carpeta, haga doble clic en un archivo y todo el sistema (Backend + Frontend) se levante sin que él tenga que saber programar.

#### 1. Despliegue del Backend (Contenedores)

Para asegurar que el backend de FastAPI, el motor matemático y cualquier base de datos (como Redis) corran de manera idéntica en la máquina del cliente sin problemas de dependencias, empaquetaremos los microservicios.

* **Implementación:**
* Crear un archivo `docker-compose.yml` en la raíz del proyecto backend que orqueste la API de FastAPI y la conexión con el broker.
* Crear un archivo `Dockerfile` optimizado que instale los requerimientos (`requirements.txt`).
* Crear un script `start-backend.bat` (para Windows) y `start-backend.sh` (para Mac/Linux) que simplemente ejecute `docker compose up --build -d`.



#### 2. Despliegue del Frontend (App Móvil)

Como el frontend está en Expo, no lo contenedorizamos, pero sí le facilitamos el inicio al cliente.

* **Implementación:**
* Crear un script `start-mobile.bat` y `start-mobile.sh` en la carpeta del frontend.
* El script debe contener los comandos de limpieza e inicio:
```bat

```





npm install
npx expo start -c

```

#### 3. Estructura de Entrega (Hand-over folder)
Tu archivo ZIP final para el cliente debería verse así:
```text
/O-Screener-Delivery
  /backend
    docker-compose.yml
    Dockerfile
    start-backend.bat
  /frontend
    start-mobile.bat
  Instrucciones_Previas.txt (Requisito de instalar Docker y Tailscale)

```
