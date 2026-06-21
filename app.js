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
    const gaugeProgress = document.getElementById("gauge-progress");
    const needle = document.getElementById("needle");
    const speedText = document.getElementById("speed-text");
    const limitValue = document.getElementById("limit-value");
    const limitInput = document.getElementById("limit-input");
    const appContainer = document.querySelector(".app-container");
    const btnAction = document.getElementById("btn-action");
    const floatingBtn = document.getElementById("floating-btn");
    const orientationBtn = document.getElementById("orientation-btn");
    const reloadBtn = document.getElementById("reload-btn");
    const gpsStatus = document.getElementById("gps-status");
    const netStatus = document.getElementById("net-status");
    const modeButtons = document.querySelectorAll(".mode-btn");
    
    // Elementos de Estadísticas secundarios
    const maxSpeedText = document.getElementById("max-speed");
    const avgSpeedText = document.getElementById("avg-speed");
    const clockText = document.getElementById("clock");

    // --- CONFIGURACIÓN DEL VELOCÍMETRO ---
    const minSpeed = 0;
    const maxSpeed = 120;
    const step = 15;        // Números de 15 en 15 (0, 15, 30, 45... hasta 120)
    const startAngle = -135; // Sincronizado con el inicio del arco SVG
    const endAngle = 105;    // Sincronizado con el final del arco SVG
    const totalAngle = endAngle - startAngle; // Arco total de 240 grados

    // Variables de control de datos
    let speedLimit = parseInt(limitInput.value) || 40;
    let maxSpeedRecorded = 0;
    let speedHistory = [];
    let isTracking = false;
    let watchId = null;
    let lastCoords = null;
    let smoothedSpeed = 0;
    let gaugeLabels = [];
    let previousSpeed = 0;
    const arcLength = 335;
    let visualMode = "sport";
    let pipWindow = null;
    let pipSpeedText = null;
    let pipLimitText = null;
    let pipTitleText = null;
    let simulatedLandscape = false;

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
            textNode.setAttribute("data-speed", String(speed));
            textNode.textContent = speed;

            // Inyectar el número en el grupo del SVG
            labelsContainer.appendChild(textNode);
        }

        gaugeLabels = Array.from(labelsContainer.querySelectorAll("text"));
    }

    function markActiveLabel(currentSpeed) {
        if (!gaugeLabels.length) return;

        const nearest = Math.round(currentSpeed / step) * step;

        gaugeLabels.forEach((label) => {
            const value = parseInt(label.getAttribute("data-speed"), 10);
            label.classList.toggle("active-label", value === nearest);
            label.classList.toggle("over-limit-label", currentSpeed > speedLimit && value >= speedLimit);
        });
    }

    function setGpsState(mode, text) {
        if (!gpsStatus) return;

        gpsStatus.classList.remove("searching", "off");
        if (mode === "searching") gpsStatus.classList.add("searching");
        if (mode === "off") gpsStatus.classList.add("off");
        gpsStatus.innerHTML = `<span class="dot"></span> ${text}`;
    }

    function setVisualMode(mode) {
        const modes = ["street", "sport", "track"];
        if (!modes.includes(mode)) {
            mode = "sport";
        }

        visualMode = mode;
        appContainer.classList.remove("mode-street", "mode-sport", "mode-track");
        appContainer.classList.add(`mode-${mode}`);

        modeButtons.forEach((button) => {
            button.classList.toggle("active", button.dataset.mode === mode);
        });

        localStorage.setItem("speedometer_visual_mode", mode);

        if (pipWindow && !pipWindow.closed) {
            pipWindow.document.body.className = `mode-${mode}`;
        }
    }

    function runStartupAnimation() {
        appContainer.classList.add("app-booting");
        setTimeout(() => {
            appContainer.classList.remove("app-booting");
        }, 3000);
    }

    function applySimulatedLandscape(enabled) {
        simulatedLandscape = enabled;
        appContainer.classList.toggle("force-landscape", enabled);
        if (orientationBtn) {
            orientationBtn.classList.toggle("active", enabled);
            orientationBtn.textContent = enabled ? "Vertical" : "Horizontal";
        }
    }

    async function toggleOrientationMode() {
        const isLandscapeNow = screen.orientation && typeof screen.orientation.type === "string"
            ? screen.orientation.type.startsWith("landscape")
            : false;

        const wantsLandscape = simulatedLandscape ? false : !isLandscapeNow;

        if (screen.orientation && typeof screen.orientation.lock === "function") {
            try {
                if (wantsLandscape && !document.fullscreenElement && document.documentElement.requestFullscreen) {
                    await document.documentElement.requestFullscreen();
                }

                await screen.orientation.lock(wantsLandscape ? "landscape" : "portrait");

                if (!wantsLandscape && document.fullscreenElement && document.exitFullscreen) {
                    await document.exitFullscreen();
                }

                applySimulatedLandscape(false);
                if (orientationBtn) {
                    orientationBtn.classList.toggle("active", wantsLandscape);
                    orientationBtn.textContent = wantsLandscape ? "Vertical" : "Horizontal";
                }
                return;
            } catch (error) {
                console.warn("No se pudo bloquear orientación nativa", error);
            }
        }

        applySimulatedLandscape(!simulatedLandscape);
    }

    function updateFloatingHud(currentSpeed, isOverLimit) {
        if (!pipWindow || pipWindow.closed || !pipSpeedText || !pipLimitText || !pipTitleText) return;

        pipSpeedText.textContent = String(currentSpeed);
        pipLimitText.textContent = `Límite ${speedLimit} km/h`;
        pipTitleText.textContent = isOverLimit ? "ALERTA" : "Velocidad";
        pipWindow.document.body.classList.toggle("warning", isOverLimit);
    }

    async function toggleFloatingWindow() {
        if (!floatingBtn) return;

        if (!("documentPictureInPicture" in window)) {
            alert("Tu navegador o teléfono no soporta ventana flotante PWA real. En muchos móviles este permiso no existe todavía.");
            return;
        }

        try {
            if (pipWindow && !pipWindow.closed) {
                pipWindow.close();
                return;
            }

            pipWindow = await window.documentPictureInPicture.requestWindow({
                width: 250,
                height: 170
            });

            pipWindow.document.body.innerHTML = "";
            pipWindow.document.body.className = `mode-${visualMode}`;

            const style = pipWindow.document.createElement("style");
            style.textContent = `
                body {
                    margin: 0;
                    height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-family: Bahnschrift, Segoe UI, sans-serif;
                    background: #050608;
                    color: #f8f9ff;
                }
                .hud {
                    width: calc(100% - 14px);
                    border-radius: 16px;
                    border: 1px solid #2a2f3a;
                    background: linear-gradient(165deg, #11131a, #0a0b10);
                    padding: 10px 12px;
                    text-align: center;
                }
                .title {
                    font-size: 12px;
                    font-weight: 800;
                    color: #aeb5c3;
                    letter-spacing: 0.4px;
                    margin-bottom: 2px;
                }
                .speed {
                    font-family: Orbitron, Bahnschrift, sans-serif;
                    font-size: 52px;
                    font-weight: 700;
                    line-height: 0.95;
                    letter-spacing: -1px;
                }
                .unit {
                    font-size: 12px;
                    color: #c4cada;
                    letter-spacing: 1px;
                    margin-top: 1px;
                }
                .limit {
                    font-size: 12px;
                    margin-top: 5px;
                    color: #aeb5c3;
                }
                body.warning .speed,
                body.warning .title {
                    color: #ff3b30;
                    text-shadow: 0 0 14px rgba(255, 59, 48, 0.55);
                }
                body.mode-track .speed {
                    transform: scale(1.03);
                }
                body.mode-street .speed {
                    transform: scale(0.97);
                }
            `;

            const hud = pipWindow.document.createElement("div");
            hud.className = "hud";
            hud.innerHTML = `
                <div class="title" id="pip-title">Velocidad</div>
                <div class="speed" id="pip-speed">${speedText.textContent || "0"}</div>
                <div class="unit">km/h</div>
                <div class="limit" id="pip-limit">Límite ${speedLimit} km/h</div>
            `;

            pipWindow.document.head.appendChild(style);
            pipWindow.document.body.appendChild(hud);

            pipSpeedText = pipWindow.document.getElementById("pip-speed");
            pipLimitText = pipWindow.document.getElementById("pip-limit");
            pipTitleText = pipWindow.document.getElementById("pip-title");

            updateFloatingHud(parseInt(speedText.textContent, 10) || 0, (parseInt(speedText.textContent, 10) || 0) > speedLimit);
            floatingBtn.classList.add("active");

            pipWindow.addEventListener("pagehide", () => {
                pipWindow = null;
                pipSpeedText = null;
                pipLimitText = null;
                pipTitleText = null;
                floatingBtn.classList.remove("active");
            });
        } catch (error) {
            console.warn("No se pudo abrir ventana flotante", error);
            alert("No fue posible abrir la ventana flotante en este dispositivo.");
        }
    }

    function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
        const toRadians = (deg) => (deg * Math.PI) / 180;
        const earthRadius = 6371000;
        const dLat = toRadians(lat2 - lat1);
        const dLon = toRadians(lon2 - lon1);

        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return earthRadius * c;
    }

    function computeSpeedKmh(position) {
        const { latitude, longitude, speed } = position.coords;
        const timestamp = position.timestamp;
        let rawKmh = null;

        if (typeof speed === "number" && speed >= 0) {
            rawKmh = speed * 3.6;
        } else if (lastCoords) {
            const elapsedSeconds = (timestamp - lastCoords.timestamp) / 1000;
            if (elapsedSeconds > 0.4) {
                const distance = calculateDistanceMeters(
                    lastCoords.latitude,
                    lastCoords.longitude,
                    latitude,
                    longitude
                );
                rawKmh = (distance / elapsedSeconds) * 3.6;
            }
        }

        lastCoords = { latitude, longitude, timestamp };

        if (rawKmh === null || Number.isNaN(rawKmh)) {
            return 0;
        }

        if (rawKmh < 0.9) {
            rawKmh = 0;
        }

        const alpha = rawKmh < 8 ? 0.58 : 0.38;
        smoothedSpeed = alpha * rawKmh + (1 - alpha) * smoothedSpeed;
        return Math.max(0, Math.round(smoothedSpeed));
    }

    // --- FUNCIÓN PARA ACTUALIZAR LA AGUJA Y EL DISPLAY ---
    function updateInterface(currentSpeed) {
        // Evitar que la aguja se salga físicamente de los límites visuales (0 - 120)
        const boundedSpeed = Math.max(minSpeed, Math.min(maxSpeed, currentSpeed));
        
        // Calcular la rotación de la aguja basándose en la velocidad actual
        const percentage = (boundedSpeed - minSpeed) / (maxSpeed - minSpeed);
        const targetAngle = startAngle + (percentage * totalAngle);
        const visibleArc = percentage * arcLength;
        
        // Mover la aguja con CSS y cambiar el texto central
        needle.style.transform = `rotate(${targetAngle}deg)`;
        speedText.textContent = currentSpeed;
        if (gaugeProgress) gaugeProgress.style.strokeDasharray = `${visibleArc.toFixed(2)} 500`;

        speedText.classList.remove("speed-up", "speed-down");
        appContainer.classList.remove("accelerating", "decelerating");

        if (currentSpeed > previousSpeed) {
            speedText.classList.add("speed-up");
            appContainer.classList.add("accelerating");
        } else if (currentSpeed < previousSpeed) {
            speedText.classList.add("speed-down");
            appContainer.classList.add("decelerating");
        }

        previousSpeed = currentSpeed;
        markActiveLabel(currentSpeed);

        // COMPROBACIÓN DEL LÍMITE: Si te pasas, se activa la alerta roja
        if (currentSpeed > speedLimit) {
            appContainer.classList.add("speed-warning");
        } else {
            appContainer.classList.remove("speed-warning");
        }

        updateFloatingHud(currentSpeed, currentSpeed > speedLimit);

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
            maximumAge: 500,          // Permite actualizaciones recientes para respuesta fluida
            timeout: 10000            // Tiempo de espera máximo de respuesta del satélite
        };

        setGpsState("searching", "GPS: Buscando");

        // Escucha activa de movimiento en tiempo real
        watchId = navigator.geolocation.watchPosition(
            (position) => {
                setGpsState("ready", "GPS: Activo");
                const speedKmh = computeSpeedKmh(position);
                updateInterface(speedKmh);
            },
            (error) => {
                console.warn("Señal GPS baja o buscando satélites...", error.message);
                if (error.code === error.PERMISSION_DENIED) {
                    setGpsState("off", "GPS: Sin permiso");
                } else {
                    setGpsState("searching", "GPS: Señal baja");
                }
            },
            geoOptions
        );

        isTracking = true;
        btnAction.textContent = "DETENER";
        btnAction.classList.add("is-tracking");
    }

    // Detener la lectura del GPS para ahorrar batería
    function stopTracking() {
        if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
        }
        isTracking = false;
        smoothedSpeed = 0;
        lastCoords = null;
        previousSpeed = 0;
        setGpsState("off", "GPS: Detenido");
        updateInterface(0);
        btnAction.textContent = "INICIAR";
        btnAction.classList.remove("is-tracking");
    }

    // --- MANEJO DE ENTRADAS Y EVENTOS ---

    // Escuchar cuando cambias el límite en el recuadro numérico inferior
    limitInput.addEventListener("input", (e) => {
        let value = parseInt(e.target.value);
        if (isNaN(value) || value < 0) value = 0;
        if (value > maxSpeed) value = maxSpeed;
        
        speedLimit = value;
        limitValue.textContent = speedLimit;
        markActiveLabel(parseInt(speedText.textContent, 10) || 0);
    });

    // Escuchar el clic del botón principal (Iniciar/Detener)
    btnAction.addEventListener("click", () => {
        if (!isTracking) {
            startTracking();
        } else {
            stopTracking();
        }
    });

    modeButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const nextMode = button.dataset.mode;
            if (nextMode && nextMode !== visualMode) {
                setVisualMode(nextMode);
            }
        });
    });

    if (reloadBtn) {
        reloadBtn.addEventListener("click", () => {
            window.location.reload();
        });
    }

    if (floatingBtn) {
        floatingBtn.addEventListener("click", toggleFloatingWindow);
    }

    if (orientationBtn) {
        orientationBtn.addEventListener("click", toggleOrientationMode);
    }

    // Reloj interno de la esquina superior derecha
    function updateClock() {
        const now = new Date();
        clockText.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    }

    function updateConnectivityState() {
        if (!netStatus) return;
        netStatus.textContent = navigator.onLine ? "Online" : "Offline";
    }

    // --- EJECUCIÓN INICIAL AUTOMÁTICA ---
    drawGaugeLabels(); // Esto pintará los números 0, 15, 30... al cargar
    runStartupAnimation();
    limitValue.textContent = speedLimit;
    updateInterface(0);
    setVisualMode(localStorage.getItem("speedometer_visual_mode") || "sport");
    markActiveLabel(0);
    setGpsState("ready", "GPS: Listo");
    updateConnectivityState();
    window.addEventListener("online", updateConnectivityState);
    window.addEventListener("offline", updateConnectivityState);
    setInterval(updateClock, 1000);
    updateClock();
});
