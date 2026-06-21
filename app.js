// ==========================================================================
// 1. REGISTRO DEL SERVICE WORKER (Para que la PWA funcione Sin Internet)
// ==========================================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker registrado con éxito', reg))
            .catch(err => console.warn('Error al registrar el Service Worker', err));
    });
}

// ==========================================================================
// 2. LÓGICA PRINCIPAL DE LA APLICACIÓN (Se ejecuta al cargar la estructura)
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
    
    // --- ELEMENTOS DEL DOM ---
    const labelsContainer = document.getElementById("gauge-labels");
    const needle = document.getElementById("needle");
    const speedText = document.getElementById("speed-text");
    const limitValue = document.getElementById("limit-value");
    const limitInput = document.getElementById("limit-input");
    const appContainer = document.querySelector(".app-container");
    const btnAction = document.getElementById("btn-action");
    
    // Elementos de Estadísticas secundarios
    const maxSpeedText = document.getElementById("max-speed");
    const avgSpeedText = document.getElementById("avg-speed");
    const clockText = document.getElementById("clock");

    // --- CONFIGURACIÓN DEL VELOCÍMETRO ---
    const minSpeed = 0;
    const maxSpeed = 120;
    const step = 15;        // Números de 15 en 15 (0, 15, 30, 45... hasta 120)
    const startAngle = -120; // Grados de rotación CSS para 0 km/h
    const endAngle = 120;   // Grados de rotación CSS para 120 km/h
    const totalAngle = endAngle - startAngle; // Arco total de 240 grados

    // Variables de control de datos
    let speedLimit = parseInt(limitInput.value) || 40;
    let maxSpeedRecorded = 0;
    let speedHistory = [];
    let isTracking = false;
    let watchId = null;

    // --- FUNCIÓN PARA DIBUJAR LOS NÚMEROS EN EL CÍRCULO ---
    function drawGaugeLabels() {
        const cx = 100; // Centro X dentro del viewBox del SVG
        const cy = 100; // Centro Y dentro del viewBox del SVG
        const r = 62;   // Radio intermedio donde se pintarán los textos
        
        labelsContainer.innerHTML = ""; // Limpiar el contenedor por seguridad

        for (let speed = minSpeed; speed <= maxSpeed; speed += step) {
            // Calcular el ángulo en grados para cada velocidad
            const percentage = (speed - minSpeed) / (maxSpeed - minSpeed);
            const angleDegrees = startAngle + (percentage * totalAngle);
            
            // Convertir los grados a radianes para las funciones trigonométricas
            const angleRadians = (angleDegrees - 90) * (Math.PI / 180);

            // Calcular las coordenadas exactas X e Y en la pantalla
            const x = cx + r * Math.cos(angleRadians);
            const y = cy + r * Math.sin(angleRadians);

            // Crear una etiqueta de texto nativa para el SVG
            const textNode = document.createElementNS("http://www.w3.org/2000/svg", "text");
            textNode.setAttribute("x", x.toFixed(2));
            textNode.setAttribute("y", y.toFixed(2));
            textNode.textContent = speed;

            // Inyectar el número en el grupo del SVG
            labelsContainer.appendChild(textNode);
        }
    }

    // --- FUNCIÓN PARA ACTUALIZAR LA AGUJA Y EL DISPLAY ---
    function updateInterface(currentSpeed) {
        // Evitar que la aguja se salga físicamente de los límites visuales (0 - 120)
        const boundedSpeed = Math.max(minSpeed, Math.min(maxSpeed, currentSpeed));
        
        // Calcular la rotación de la aguja basándose en la velocidad actual
        const percentage = (boundedSpeed - minSpeed) / (maxSpeed - minSpeed);
        const targetAngle = startAngle + (percentage * totalAngle);
        
        // Mover la aguja con CSS y cambiar el texto central
        needle.style.transform = `rotate(${targetAngle}deg)`;
        speedText.textContent = currentSpeed;

        // COMPROBACIÓN DEL LÍMITE: Si te pasas, se activa la alerta roja
        if (currentSpeed > speedLimit) {
            appContainer.classList.add("speed-warning");
        } else {
            appContainer.classList.remove("speed-warning");
        }

        // Registrar estadísticas sólo si el viaje está iniciado y vas avanzando
        if (isTracking && currentSpeed > 0) {
            // Registrar Velocidad Máxima
            if (currentSpeed > maxSpeedRecorded) {
                maxSpeedRecorded = currentSpeed;
                maxSpeedText.textContent = `${maxSpeedRecorded} km/h`;
            }
            // Calcular Velocidad Promedio
            speedHistory.push(currentSpeed);
            const sum = speedHistory.reduce((a, b) => a + b, 0);
            const avg = Math.round(sum / speedHistory.length);
            avgSpeedText.textContent = `${avg} km/h`;
        }
    }

    // --- GESTIÓN DEL CHIP GPS DEL TELÉFONO ---
    function startTracking() {
        if (!("geolocation" in navigator)) {
            alert("Tu dispositivo o navegador no soporta o tiene bloqueado el GPS.");
            return;
        }

        const geoOptions = {
            enableHighAccuracy: true, // Fuerza al celular a encender el GPS de alta precisión
            maximumAge: 0,            // Ignora posiciones viejas guardadas en caché
            timeout: 10000            // Tiempo de espera máximo de respuesta del satélite
        };

        // Escucha activa de movimiento en tiempo real
        watchId = navigator.geolocation.watchPosition(
            (position) => {
                const speedMs = position.coords.speed; // El GPS devuelve metros por segundo

                if (speedMs !== null && speedMs !== undefined && speedMs >= 0) {
                    // Convertir de m/s a Kilómetros por hora (m/s * 3.6)
                    let speedKmh = Math.round(speedMs * 3.6);
                    
                    // FILTRO DE UMBRAL: Si marca 1 o 2 km/h por el ruido estando quieto, lo fuerza a 0
                    if (speedKmh < 3) { 
                        speedKmh = 0; 
                    }
                    
                    updateInterface(speedKmh);
                } else {
                    updateInterface(0);
                }
            },
            (error) => {
                console.warn("Señal GPS baja o buscando satélites...", error.message);
            },
            geoOptions
        );

        isTracking = true;
        btnAction.textContent = "DETENER";
        btnAction.style.backgroundColor = "#8e8e93"; // Cambia el botón a gris mientras corre
    }

    // Detener la lectura del GPS para ahorrar batería
    function stopTracking() {
        if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
        }
        isTracking = false;
        updateInterface(0);
        btnAction.textContent = "INICIAR";
        btnAction.style.backgroundColor = "var(--accent-red)";
    }

    // --- MANEJO DE ENTRADAS Y EVENTOS ---

    // Escuchar cuando cambias el límite en el recuadro numérico inferior
    limitInput.addEventListener("input", (e) => {
        let value = parseInt(e.target.value);
        if (isNaN(value) || value < 0) value = 0;
        
        speedLimit = value;
        limitValue.textContent = speedLimit;
    });

    // Escuchar el clic del botón principal (Iniciar/Detener)
    btnAction.addEventListener("click", () => {
        if (!isTracking) {
            startTracking();
        } else {
            stopTracking();
        }
    });

    // Reloj interno de la esquina superior derecha
    function updateClock() {
        const now = new Date();
        clockText.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    }

    // --- EJECUCIÓN INICIAL AUTOMÁTICA ---
    drawGaugeLabels(); // Esto pintará los números 0, 15, 30... al cargar
    limitValue.textContent = speedLimit;
    setInterval(updateClock, 1000);
    updateClock();
});
