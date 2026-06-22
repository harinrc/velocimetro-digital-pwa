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
    const maxSpeedBtn = document.getElementById("max-speed-btn");
    const maxSpeedScale = document.getElementById("max-speed-scale");
    const miniMapContainer = document.getElementById("mini-map");
    const mapCenterBtn = document.getElementById("map-center-btn");
    const themeMeta = document.getElementById("meta-theme-color");
    const navMeta = document.getElementById("meta-nav-color");
    const appContainer = document.querySelector(".app-container");
    const btnAction = document.getElementById("btn-action");
    const floatingBtn = document.getElementById("floating-btn");
    const orientationBtn = document.getElementById("orientation-btn");
    const reloadBtn = document.getElementById("reload-btn");
    const gpsStatus = document.getElementById("gps-status");
    const netStatus = document.getElementById("net-status");
    const modeButtons = document.querySelectorAll(".mode-btn");
    const panelHandle = document.getElementById("panel-handle");
    
    // Elementos de Estadísticas secundarios
    const maxSpeedText = document.getElementById("max-speed");
    const avgSpeedText = document.getElementById("avg-speed");
    const clockText = document.getElementById("clock");

    // --- CONFIGURACIÓN DEL VELOCÍMETRO ---
    const minSpeed = 0;
    const defaultMaxSpeed = 120;
    const minAllowedMax = 60;
    const maxAllowedMax = 240;
    const startAngle = -135; // Sincronizado con el inicio del arco SVG
    const endAngle = 105;    // Sincronizado con el final del arco SVG
    const totalAngle = endAngle - startAngle; // Arco total de 240 grados

    // Variables de control de datos
    let speedLimit = parseInt(limitInput.value) || 40;
    let maxSpeed = Number.parseInt(localStorage.getItem("speedometer_max_scale"), 10) || defaultMaxSpeed;
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
    let gaugeStep = 15;
    let lastPositionAt = 0;
    let gpsHealthTimer = null;
    let gpsRetryTimer = null;
    let mapInstance = null;
    let mapMarker = null;
    let mapAccuracyCircle = null;
    let latestLatLng = null;
    let followMap = true;
    let panelCollapsed = window.matchMedia("(max-width: 379px)").matches
        ? true
        : localStorage.getItem("speedometer_panel_collapsed") === "1";
    let panelSwipeStartY = null;
    let panelSwipePointerId = null;
    const isCompactPanelMode = window.matchMedia("(max-width: 379px)").matches;
    const isPhoneLike = window.matchMedia("(pointer: coarse), (max-width: 899px)").matches;
    const normalSystemColor = "#050608";
    const warningSystemColor = "#250808";

    if (maxSpeed < minAllowedMax || maxSpeed > maxAllowedMax) {
        maxSpeed = defaultMaxSpeed;
    }

    function getGaugeStep(scaleMax) {
        const candidates = [5, 10, 15, 20, 25, 30, 40, 50];
        const raw = scaleMax / 8;
        return candidates.reduce((best, value) =>
            Math.abs(value - raw) < Math.abs(best - raw) ? value : best
        , candidates[0]);
    }

    function applyMaxSpeed(newMax, persist = true) {
        const parsed = Number.parseInt(newMax, 10);
        if (Number.isNaN(parsed)) return;

        maxSpeed = Math.max(minAllowedMax, Math.min(maxAllowedMax, parsed));
        gaugeStep = getGaugeStep(maxSpeed);

        if (limitInput) {
            limitInput.max = String(maxSpeed);
        }

        if (speedLimit > maxSpeed) {
            speedLimit = maxSpeed;
            limitInput.value = String(speedLimit);
            limitValue.textContent = String(speedLimit);
        }

        if (maxSpeedScale) {
            maxSpeedScale.textContent = `${maxSpeed} km/h`;
        }

        drawGaugeLabels();
        updateInterface(Number.parseInt(speedText.textContent, 10) || 0);

        if (persist) {
            localStorage.setItem("speedometer_max_scale", String(maxSpeed));
        }
    }

    // --- FUNCIÓN PARA DIBUJAR LOS NÚMEROS EN EL CÍRCULO ---
    function drawGaugeLabels() {
        const cx = 100; // Centro X dentro del viewBox del SVG
        const cy = 100; // Centro Y dentro del viewBox del SVG
        const r = 62;   // Radio intermedio donde se pintarán los textos
        
        labelsContainer.innerHTML = ""; // Limpiar el contenedor por seguridad

        for (let speed = minSpeed; speed <= maxSpeed; speed += gaugeStep) {
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

        const lastValue = Number.parseInt(labelsContainer.lastChild?.getAttribute("data-speed") || "0", 10);
        if (lastValue !== maxSpeed) {
            const percentage = (maxSpeed - minSpeed) / (maxSpeed - minSpeed);
            const angleDegrees = startAngle + (percentage * totalAngle);
            const angleRadians = (angleDegrees - 90) * (Math.PI / 180);
            const cx = 100;
            const cy = 100;
            const r = 62;
            const x = cx + r * Math.cos(angleRadians);
            const y = cy + r * Math.sin(angleRadians);
            const maxTextNode = document.createElementNS("http://www.w3.org/2000/svg", "text");
            maxTextNode.setAttribute("x", x.toFixed(2));
            maxTextNode.setAttribute("y", y.toFixed(2));
            maxTextNode.setAttribute("data-speed", String(maxSpeed));
            maxTextNode.textContent = maxSpeed;
            labelsContainer.appendChild(maxTextNode);
        }

        gaugeLabels = Array.from(labelsContainer.querySelectorAll("text"));
    }

    function markActiveLabel(currentSpeed) {
        if (!gaugeLabels.length) return;

        const nearest = Math.round(currentSpeed / gaugeStep) * gaugeStep;

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

    function applyPanelState(collapsed, persist = true) {
        if (!isCompactPanelMode) {
            panelCollapsed = false;
            appContainer.classList.remove("panel-collapsed");
            if (panelHandle) {
                panelHandle.setAttribute("aria-expanded", "true");
                panelHandle.style.display = "none";
            }
            if (persist) {
                localStorage.setItem("speedometer_panel_collapsed", "0");
            }
            return;
        }

        panelCollapsed = Boolean(collapsed);
        appContainer.classList.toggle("panel-collapsed", panelCollapsed);

        if (panelHandle) {
            panelHandle.setAttribute("aria-expanded", String(!panelCollapsed));
        }

        if (persist) {
            localStorage.setItem("speedometer_panel_collapsed", panelCollapsed ? "1" : "0");
        }

        if (mapInstance) {
            setTimeout(() => {
                mapInstance.invalidateSize();
                if (followMap && latestLatLng) {
                    mapInstance.setView(latestLatLng, 16, { animate: false });
                }
            }, 220);
        }
    }

    function setPanelFromSwipe(deltaY) {
        const threshold = 28;
        if (deltaY > threshold) {
            applyPanelState(true, true);
            return;
        }

        if (deltaY < -threshold) {
            applyPanelState(false, true);
            return;
        }

        applyPanelState(!panelCollapsed, true);
    }

    function syncPanelMode() {
        if (window.matchMedia("(max-width: 379px)").matches) {
            if (panelHandle) {
                panelHandle.style.display = "flex";
            }
            applyPanelState(panelCollapsed, false);
            return;
        }

        if (panelHandle) {
            panelHandle.style.display = "none";
        }

        applyPanelState(false, false);
    }

    async function toggleOrientationMode() {
        if (isPhoneLike) {
            return;
        }

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

    function ensureMap() {
        if (mapInstance || !miniMapContainer || typeof L === "undefined") return;

        mapInstance = L.map(miniMapContainer, {
            zoomControl: false,
            attributionControl: true,
            dragging: true,
            tap: true
        }).setView([13.7, -89.2], 14);

        L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
            maxZoom: 20,
            attribution: "&copy; OpenStreetMap &copy; CARTO"
        }).addTo(mapInstance);
    }

    function updateMapPosition(lat, lon, accuracy = 0) {
        ensureMap();
        if (!mapInstance) return;

        const point = [lat, lon];
        latestLatLng = point;

        if (!mapMarker) {
            mapMarker = L.circleMarker(point, {
                radius: 7,
                color: "#ff2a2a",
                weight: 2,
                fillColor: "#ff5a1f",
                fillOpacity: 0.9,
                className: "map-speed-marker"
            }).addTo(mapInstance);
        } else {
            mapMarker.setLatLng(point);
        }

        if (!mapAccuracyCircle) {
            mapAccuracyCircle = L.circle(point, {
                radius: Math.max(8, accuracy || 8),
                color: "#ff2a2a",
                weight: 1,
                fillColor: "#ff2a2a",
                fillOpacity: 0.12
            }).addTo(mapInstance);
        } else {
            mapAccuracyCircle.setLatLng(point);
            mapAccuracyCircle.setRadius(Math.max(8, accuracy || 8));
        }

        if (followMap) {
            mapInstance.setView(point, 16, { animate: false });
        }
    }

    function updateSystemBarColors(isWarning) {
        const color = isWarning ? warningSystemColor : normalSystemColor;
        if (themeMeta) {
            themeMeta.setAttribute("content", color);
        }
        if (navMeta) {
            navMeta.setAttribute("content", color);
        }
        document.documentElement.style.backgroundColor = color;
        document.body.style.backgroundColor = color;
    }

    function clearGpsTimers() {
        if (gpsHealthTimer) {
            clearInterval(gpsHealthTimer);
            gpsHealthTimer = null;
        }
        if (gpsRetryTimer) {
            clearTimeout(gpsRetryTimer);
            gpsRetryTimer = null;
        }
    }

    function attachGeolocationWatch() {
        if (!isTracking) return;

        if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
        }

        const geoOptions = {
            enableHighAccuracy: true,
            maximumAge: 300,
            timeout: 9000
        };

        setGpsState("searching", "GPS: Buscando");

        watchId = navigator.geolocation.watchPosition(
            (position) => {
                lastPositionAt = Date.now();
                setGpsState("ready", "GPS: Activo");
                const speedKmh = computeSpeedKmh(position);
                updateInterface(speedKmh);
                updateMapPosition(position.coords.latitude, position.coords.longitude, position.coords.accuracy);
            },
            (error) => {
                console.warn("Señal GPS baja o buscando satélites...", error.message);
                if (error.code === error.PERMISSION_DENIED) {
                    setGpsState("off", "GPS: Sin permiso");
                    stopTracking();
                    return;
                }

                setGpsState("searching", "GPS: Reintentando");
                if (!gpsRetryTimer && isTracking) {
                    gpsRetryTimer = setTimeout(() => {
                        gpsRetryTimer = null;
                        attachGeolocationWatch();
                    }, 2500);
                }
            },
            geoOptions
        );
    }

    function startGpsHealthMonitor() {
        clearGpsTimers();
        gpsHealthTimer = setInterval(() => {
            if (!isTracking) return;

            const elapsed = Date.now() - lastPositionAt;
            if (lastPositionAt > 0 && elapsed > 12000) {
                setGpsState("searching", "GPS: Señal baja");
            }

            if (lastPositionAt > 0 && elapsed > 22000) {
                attachGeolocationWatch();
            }
        }, 4000);
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
        speedText.classList.toggle("triple-digits", currentSpeed >= 100);
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

        updateSystemBarColors(currentSpeed > speedLimit);

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

        isTracking = true;
        lastPositionAt = 0;
        attachGeolocationWatch();
        startGpsHealthMonitor();
        btnAction.textContent = "DETENER";
        btnAction.classList.add("is-tracking");
    }

    // Detener la lectura del GPS para ahorrar batería
    function stopTracking() {
        if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
        }
        clearGpsTimers();
        isTracking = false;
        lastPositionAt = 0;
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

    if (maxSpeedBtn) {
        maxSpeedBtn.addEventListener("click", () => {
            const input = window.prompt(`Define la escala máxima del velocímetro (${minAllowedMax}-${maxAllowedMax})`, String(maxSpeed));
            if (input === null) return;
            applyMaxSpeed(input, true);
        });
    }

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
        if (isPhoneLike) {
            orientationBtn.style.display = "none";
        }
    }

    if (mapCenterBtn) {
        mapCenterBtn.addEventListener("click", () => {
            followMap = true;
            if (mapInstance && latestLatLng) {
                mapInstance.setView(latestLatLng, 16, { animate: true });
            }
        });
    }

    if (miniMapContainer) {
        ensureMap();
        miniMapContainer.addEventListener("pointerdown", () => {
            followMap = false;
        });
    }

    if (panelHandle) {
        if (!isCompactPanelMode) {
            panelHandle.style.display = "none";
        }

        // Seguimiento del gesto — funciona con Pointer Events y con Touch Events como fallback
        function handleStart(y) {
            panelSwipeStartY = y;
        }

        function handleEnd(y) {
            if (panelSwipeStartY === null) return;
            const deltaY = y - panelSwipeStartY;
            panelSwipeStartY = null;
            panelSwipePointerId = null;
            setPanelFromSwipe(deltaY);
        }

        function handleCancel() {
            panelSwipeStartY = null;
            panelSwipePointerId = null;
        }

        // Pointer Events (escritorio + móvil moderno)
        panelHandle.addEventListener("pointerdown", (e) => {
            panelSwipePointerId = e.pointerId;
            try { panelHandle.setPointerCapture(e.pointerId); } catch (_) { /* no-op */ }
            handleStart(e.clientY);
        });

        panelHandle.addEventListener("pointerup", (e) => {
            if (panelSwipePointerId !== e.pointerId) return;
            handleEnd(e.clientY);
        });

        panelHandle.addEventListener("pointercancel", handleCancel);

        // Touch Events — fallback para WebView/browsers que no disparan pointerup bien
        panelHandle.addEventListener("touchstart", (e) => {
            if (panelSwipeStartY !== null) return; // ya manejado por pointer events
            handleStart(e.touches[0].clientY);
        }, { passive: true });

        panelHandle.addEventListener("touchend", (e) => {
            if (panelSwipePointerId !== null) return; // ya manejado por pointer events
            handleEnd(e.changedTouches[0].clientY);
        }, { passive: true });

        panelHandle.addEventListener("touchcancel", () => {
            if (panelSwipePointerId !== null) return;
            handleCancel();
        }, { passive: true });
    }

    window.addEventListener("resize", syncPanelMode);

    document.addEventListener("visibilitychange", () => {
        if (!isTracking) return;
        if (document.visibilityState === "visible" && watchId === null) {
            attachGeolocationWatch();
        }
    });

    // Reloj interno de la esquina superior derecha
    function updateClock() {
        const now = new Date();
        clockText.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    }

    function updateConnectivityState() {
        if (!netStatus) return;
        netStatus.textContent = navigator.onLine ? "Online" : "Offline";
        const controlsPanel = document.querySelector(".controls-panel");
        if (controlsPanel) {
            controlsPanel.classList.toggle("map-offline", !navigator.onLine);
        }
    }

    // --- EJECUCIÓN INICIAL AUTOMÁTICA ---
    applyMaxSpeed(maxSpeed, false);
    // Aplicar estado del panel ANTES de la animación para evitar salto visual al recargar
    applyPanelState(isCompactPanelMode ? panelCollapsed : false, false);
    syncPanelMode();
    runStartupAnimation();
    limitValue.textContent = speedLimit;
    updateInterface(0);
    setVisualMode(localStorage.getItem("speedometer_visual_mode") || "sport");
    markActiveLabel(0);
    setGpsState("ready", "GPS: Listo");
    updateSystemBarColors(false);
    updateConnectivityState();
    window.addEventListener("online", updateConnectivityState);
    window.addEventListener("offline", updateConnectivityState);
    setInterval(updateClock, 1000);
    updateClock();
});
