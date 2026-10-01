# Probador Virtual de Corbatas Neón (3D AR)
**Proyecto de Legislación Empresarial (LEM)**

Plataforma web de Realidad Aumentada que detecta a una persona en tiempo real mediante la cámara web y le superpone corbatas 3D interactivas, simulando una experiencia de compra y modelaje virtual tipo filtro de Instagram o boutique inteligente.

---

## 🚀 Características Principales

1. **Detección Corporal en Tiempo Real:**
   - Utiliza **MediaPipe Pose** para rastrear hombros, clavícula y cuello de la persona sin necesidad de sensores externos ni aplicaciones móviles.
   - Algoritmo de suavizado cinemático (anti-jitter) para un movimiento natural y fluido.

2. **Renderizado 3D Interactivo:**
   - Impulsado por **Three.js** con soporte para modelos `.glb`.
   - Incluye tus **3 modelos 3D con luz Neón**.
   - Pivote inteligente en el nudo de la corbata para un calce perfecto sobre el pecho.
   - Opción para ver **Solo la corbata** o **Corbata + Camisa 3D**.

3. **Efectos de Iluminación Neón:**
   - Paleta de 6 colores intercambiables en vivo (Cyan, Verde, Magenta, Dorado, Púrpura, Blanco).
   - Control de intensidad de brillo LED.

4. **Calibración y Control de Talla:**
   - Sliders de ajuste fino de escala/grosor, altura vertical y profundidad.
   - Modo espejo (para verse como en un espejo real) o modo estándar.
   - Visualizador de puntos de tracking AR (ideal para exposiciones académicas).

5. **Captura de Fotos (Prueba Virtual):**
   - Botón para tomar fotografía con la corbata puesta y descargarla en alta resolución con marca del proyecto.

---

## 📂 Estructura del Proyecto

```text
Proyecto LEM/
│
├── models/                     # Modelos 3D de las corbatas
│   ├── corbata_neon1.glb       # Modelo 1 (Clásica Neón)
│   ├── corbata_neon2.glb       # Modelo 2 (Moderna Neón)
│   └── corbata_neon3.glb       # Modelo 3 (Élite Neón)
│
├── assets/                     # Miniaturas y fotos de muestra
│   ├── thumb1.jpg
│   ├── thumb2.jpg
│   └── thumb3.jpg
│
├── index.html                  # Interfaz de usuario
├── style.css                   # Estilos y diseño visual Neón
├── app.js                      # Lógica Three.js + MediaPipe Pose
├── server.py                   # Servidor HTTP local con soporte CORS y GLB
├── iniciar_proyecto.bat        # Acceso directo para ejecutar en 1 clic
└── README.md                   # Documentación
```

---

## ▶️ Cómo Ejecutar el Proyecto

### Opción 1: Con 1 solo Clic (Recomendada)
Haz doble clic en el archivo:
👉 **`iniciar_proyecto.bat`**

Esto levantará el servidor local y abrirá tu navegador automáticamente en `http://localhost:8080`.

### Opción 2: Desde la Terminal / PowerShell
```powershell
cd "C:\Users\USUARIO\Desktop\8vo sem\Legislacion empresarial proyecto\Proyecto LEM"
python server.py
```
Abre en tu navegador: **http://localhost:8080**
