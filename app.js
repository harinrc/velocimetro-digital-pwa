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
    const installBtn = document.getElementById("install-btn");
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
    const startAngle = -128; // Arco más abierto para liberar espacio en la zona inferior del display
    const endAngle = 98;
    const totalAngle = endAngle - startAngle; // Arco total de 226 grados

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
    const arcLength = Number(((totalAngle / 360) * 500).toFixed(2));
    let visualMode = "sport";
    let pipWindow = null;
    let pipSpeedText = null;
    let pipLimitText = null;
    let pipTitleText = null;
    let deferredInstallPrompt = null;
    let wakeLock = null;
    let lastGeocodedLatLng = null;
    let lastWeatherLatLng = null;
    let lastWeatherTime = 0;
    let lastGeocodeTime = 0;
    let simulatedLandscape = false;
    let gaugeStep = 15;
    let lastPositionAt = 0;
    let startupTimer = null;
    let demoTimer = null;
    let sequenceMode = "none";
    let reloadPressTimer = null;
    let reloadLongPressTriggered = false;
    let gpsHealthTimer = null;
    let gpsRetryTimer = null;
    let mapInstance = null;
    let mapMarker = null;
    let mapAccuracyCircle = null;
    let latestLatLng = null;
    let smoothedMapPoint = null;
    let lastMapCenterAt = 0;
    let followMap = true;
    const isCompactPanelModeNow = () => window.matchMedia("(max-width: 430px)").matches;

    let panelCollapsed = isCompactPanelModeNow()
        ? true
        : localStorage.getItem("speedometer_panel_collapsed") === "1";
    let panelSwipeStartY = null;
    let panelSwipePointerId = null;
    const isPhoneLike = window.matchMedia("(pointer: coarse), (max-width: 899px)").matches;
    const normalSystemColor = "#050608";
    const warningSystemColor = "#250808";

    if (maxSpeed < minAllowedMax || maxSpeed > maxAllowedMax) {
        maxSpeed = defaultMaxSpeed;
    }

    // Mantener en sincronía CSS (arco/aguja/animaciones) y JS (cálculo de ángulos).
    appContainer.style.setProperty("--gauge-arc-length", String(arcLength));
    appContainer.style.setProperty("--gauge-arc-rotation", `${Math.abs(startAngle)}deg`);
    appContainer.style.setProperty("--gauge-start-angle", `${startAngle}deg`);
    appContainer.style.setProperty("--gauge-end-angle", `${endAngle}deg`);

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

        const nearestLabel = gaugeLabels.reduce((best, label) => {
            const value = parseInt(label.getAttribute("data-speed"), 10);
            const bestValue = parseInt(best.getAttribute("data-speed"), 10);
            return Math.abs(value - currentSpeed) < Math.abs(bestValue - currentSpeed) ? label : best;
        }, gaugeLabels[0]);

        const nearest = parseInt(nearestLabel.getAttribute("data-speed"), 10);

        gaugeLabels.forEach((label) => {
            const value = parseInt(label.getAttribute("data-speed"), 10);
            label.classList.toggle("active-label", value === nearest);
            label.classList.toggle("over-limit-label", currentSpeed > speedLimit && value >= speedLimit);
        });
    }

    function formatSpeedDisplay(speed) {
        return String(Math.max(0, Math.round(Number(speed) || 0))).padStart(3, "0");
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
        if (startupTimer) {
            clearInterval(startupTimer);
            startupTimer = null;
        }

        if (demoTimer) {
            clearInterval(demoTimer);
            demoTimer = null;
        }

        appContainer.classList.remove("app-demoing");
        sequenceMode = "startup";
        appContainer.classList.add("sequence-synced");
        appContainer.classList.add("app-booting");
        previousSpeed = 0;

        const duration = 3000;
        const tickMs = 50;
        const startedAt = performance.now();
        let lastBootDisplayed = "";
        const peakSpeed = maxSpeed;
        const upperSweepSpeed = Math.max(Math.round(maxSpeed * 0.78), speedLimit + 10, maxSpeed >= 75 ? 76 : speedLimit + 6);
        const easeInOutCubic = (value) => (
            value < 0.5
                ? 4 * value * value * value
                : 1 - Math.pow(-2 * value + 2, 3) / 2
        );

        startupTimer = setInterval(() => {
            const elapsed = performance.now() - startedAt;
            const progress = Math.min(1, elapsed / duration);
            let speed;

            // Secuencia: subida rápida, barrido al tope real, sostén corto y caída limpia.
            if (progress < 0.42) {
                speed = upperSweepSpeed * easeInOutCubic(progress / 0.42);
            } else if (progress < 0.62) {
                const phaseProgress = easeInOutCubic((progress - 0.42) / 0.20);
                speed = upperSweepSpeed + ((peakSpeed - upperSweepSpeed) * phaseProgress);
            } else if (progress < 0.74) {
                speed = peakSpeed;
            } else {
                const phaseProgress = easeInOutCubic((progress - 0.74) / 0.26);
                speed = peakSpeed * (1 - phaseProgress);
            }

            const rounded = Math.max(0, Math.round(speed));
            updateInterface(rounded);

            if (speedText) {
                const padded = formatSpeedDisplay(rounded);
                if (padded !== lastBootDisplayed) {
                    speedText.classList.remove("boot-count-tick");
                    void speedText.offsetWidth;
                    speedText.classList.add("boot-count-tick");
                    lastBootDisplayed = padded;
                }

                speedText.textContent = padded;
                speedText.classList.add("triple-digits", "boot-digital");
            }

            if (progress >= 1) {
                clearInterval(startupTimer);
                startupTimer = null;
                sequenceMode = "none";
                appContainer.classList.remove("app-booting");
                appContainer.classList.remove("sequence-synced");
                updateInterface(0);
                if (speedText) {
                    speedText.classList.remove("boot-digital", "boot-count-tick");
                }
            }
        }, tickMs);
    }

    function runDemoSequence() {
        if (isTracking) {
            alert("Detén el rastreo para ejecutar la demo visual.");
            return;
        }

        if (startupTimer) {
            clearInterval(startupTimer);
            startupTimer = null;
        }

        if (demoTimer) {
            clearInterval(demoTimer);
            demoTimer = null;
        }

        sequenceMode = "demo";
        appContainer.classList.add("sequence-synced");
        appContainer.classList.remove("app-booting");
        appContainer.classList.add("app-demoing");
        previousSpeed = 0;
        setGpsState("searching", "GPS: DEMO visual");

        const baseCruise = Math.round(maxSpeed * 0.24);
        const cruiseSpeed = Math.max(20, Math.min(baseCruise, speedLimit - 14, maxSpeed - 45));
        const limitLeadSpeed = Math.max(cruiseSpeed + 8, Math.min(speedLimit - 3, Math.round(maxSpeed * 0.48)));
        const thresholdSpeed = Math.min(maxSpeed, Math.max(speedLimit + 8, 76));
        const highSpeed = Math.min(maxSpeed, Math.max(Math.round(maxSpeed * 0.94), thresholdSpeed + 12, 92));
        const lowSpeed = Math.max(0, Math.min(cruiseSpeed, 12));
        const demoPhases = [
            { from: 0, to: cruiseSpeed, duration: 720 },
            { from: cruiseSpeed, to: limitLeadSpeed, duration: 620 },
            { from: limitLeadSpeed, to: thresholdSpeed, duration: 620 },
            { from: thresholdSpeed, to: highSpeed, duration: 540 },
            { from: highSpeed, to: thresholdSpeed, duration: 520 },
            { from: thresholdSpeed, to: limitLeadSpeed, duration: 620 },
            { from: limitLeadSpeed, to: lowSpeed, duration: 780 },
        ];
        const tickMs = 40;
        const totalDuration = demoPhases.reduce((sum, phase) => sum + phase.duration, 0);
        const startedAt = performance.now();

        const easeInOutCubic = (value) => (
            value < 0.5
                ? 4 * value * value * value
                : 1 - Math.pow(-2 * value + 2, 3) / 2
        );

        const getDemoSpeed = (elapsed) => {
            let cursor = 0;
            for (const phase of demoPhases) {
                const phaseEnd = cursor + phase.duration;
                if (elapsed <= phaseEnd) {
                    const phaseProgress = Math.min(1, Math.max(0, (elapsed - cursor) / phase.duration));
                    return phase.from + ((phase.to - phase.from) * easeInOutCubic(phaseProgress));
                }
                cursor = phaseEnd;
            }

            return demoPhases[demoPhases.length - 1].to;
        };

        demoTimer = setInterval(() => {
            const elapsed = performance.now() - startedAt;
            const progress = Math.min(1, elapsed / totalDuration);
            const rounded = Math.max(0, Math.round(getDemoSpeed(elapsed)));
            updateInterface(rounded);

            if (speedText) {
                speedText.textContent = String(rounded).padStart(3, "0");
                speedText.classList.add("triple-digits", "boot-digital");
            }

            if (progress >= 1) {
                clearInterval(demoTimer);
                demoTimer = null;
                sequenceMode = "none";
                appContainer.classList.remove("app-demoing");
                appContainer.classList.remove("sequence-synced");
                setGpsState("ready", "GPS: Listo");
                updateInterface(0);
                if (speedText) {
                    speedText.classList.remove("boot-digital", "boot-count-tick");
                }
            }
        }, tickMs);
    }

    function applySimulatedLandscape(enabled) {
        simulatedLandscape = enabled;
        appContainer.classList.toggle("force-landscape", enabled);
        if (orientationBtn) {
            orientationBtn.classList.toggle("active", enabled);
            orientationBtn.textContent = enabled ? "Vertical" : "Horizontal";
        }
    }

    function isStandaloneMode() {
        return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    }

    function setInstallButtonVisibility(visible) {
        if (!installBtn) return;
        installBtn.hidden = !visible;
    }

    // ---- WAKE LOCK: mantener pantalla encendida mientras se rastrea ----
    async function requestWakeLock() {
        if (!('wakeLock' in navigator)) return;
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => { wakeLock = null; });
        } catch (_) { /* Ignorar si el navegador lo rechaza */ }
    }

    function releaseWakeLock() {
        if (wakeLock) {
            wakeLock.release();
            wakeLock = null;
        }
    }

    // ---- ICONOS WMO (Open-Meteo) ----
    const WMO_ICONS = {
        0: '\u2600\ufe0f',
        1: '\uD83C\uDF24\uFE0F',
        2: '\u26C5',
        3: '\u2601\ufe0f',
        45: '\uD83C\uDF2B\uFE0F', 48: '\uD83C\uDF2B\uFE0F',
        51: '\uD83C\uDF26\uFE0F', 53: '\uD83C\uDF26\uFE0F', 55: '\uD83C\uDF26\uFE0F',
        56: '\uD83C\uDF27\uFE0F', 57: '\uD83C\uDF27\uFE0F',
        61: '\uD83C\uDF27\uFE0F', 63: '\uD83C\uDF27\uFE0F', 65: '\uD83C\uDF27\uFE0F',
        66: '\uD83C\uDF27\uFE0F', 67: '\uD83C\uDF27\uFE0F',
        71: '\u2744\ufe0f', 73: '\u2744\ufe0f', 75: '\u2744\ufe0f', 77: '\uD83C\uDF28\uFE0F',
        80: '\uD83C\uDF26\uFE0F', 81: '\uD83C\uDF26\uFE0F', 82: '\u26C8\ufe0f',
        85: '\uD83C\uDF28\uFE0F', 86: '\uD83C\uDF28\uFE0F',
        95: '\u26C8\ufe0f', 96: '\u26C8\ufe0f', 99: '\u26C8\ufe0f'
    };

    function getWmoIcon(code) {
        return WMO_ICONS[code] ?? '\uD83C\uDF21\uFE0F';
    }

    // ---- CLIMA: Open-Meteo (sin API key) ----
    async function fetchWeather(lat, lon) {
        if (!navigator.onLine) return;
        const now = Date.now();
        if (lastWeatherLatLng) {
            const dist = calculateDistanceMeters(lastWeatherLatLng[0], lastWeatherLatLng[1], lat, lon);
            if (dist < 2000 && (now - lastWeatherTime) < 10 * 60 * 1000) return;
        }
        try {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=temperature_2m,weather_code&timezone=auto&forecast_days=1`;
            const res = await fetch(url);
            if (!res.ok) return;
            const data = await res.json();
            const temp = data.current?.temperature_2m;
            const code = data.current?.weather_code;
            if (temp !== undefined && code !== undefined) {
                const iconEl = document.getElementById('weather-icon');
                const tempEl = document.getElementById('weather-temp');
                if (iconEl) iconEl.textContent = getWmoIcon(code);
                if (tempEl) tempEl.textContent = `${Math.round(temp)}\u00b0C`;
                lastWeatherLatLng = [lat, lon];
                lastWeatherTime = now;
            }
        } catch (_) { /* sin conexi\u00f3n */ }
    }

    // ---- GEOCODING: Nominatim (OpenStreetMap, sin API key) ----
    async function fetchLocationName(lat, lon) {
        if (!navigator.onLine) return;
        const now = Date.now();
        if (lastGeocodedLatLng) {
            const dist = calculateDistanceMeters(lastGeocodedLatLng[0], lastGeocodedLatLng[1], lat, lon);
            if (dist < 300 && (now - lastGeocodeTime) < 30 * 1000) return;
        }
        try {
            const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=14&accept-language=es`;
            const res = await fetch(url, { headers: { 'User-Agent': 'VelocimetroPWA/1.0' } });
            if (!res.ok) return;
            const data = await res.json();
            const a = data.address || {};
            const name = a.suburb ?? a.neighbourhood ?? a.village ?? a.town ?? a.city ?? a.county ?? data.display_name?.split(',')[0] ?? '';
            const trimmed = name.trim();
            const locationTextEl = document.getElementById('location-text');
            const mapLocationTag = document.getElementById('map-location-tag');
            if (locationTextEl && trimmed) locationTextEl.textContent = trimmed;
            if (mapLocationTag && trimmed) mapLocationTag.textContent = trimmed;
            lastGeocodedLatLng = [lat, lon];
            lastGeocodeTime = now;
        } catch (_) { /* sin conexi\u00f3n */ }
    }

    function applyPanelState(collapsed, persist = true) {
        if (!isCompactPanelModeNow()) {
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
        if (isCompactPanelModeNow()) {
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
        if (mapInstance || !miniMapContainer) return;

        if (typeof L === "undefined") {
            miniMapContainer.innerHTML = '<div class="mini-map-fallback">Mapa no disponible sin internet.</div>';
            const controlsPanel = document.querySelector(".controls-panel");
            if (controlsPanel) {
                controlsPanel.classList.add("map-offline");
            }
            return;
        }

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

        let point = [lat, lon];

        // Suavizar pequeños saltos del GPS para que el punto no "baile" en el mapa.
        if (smoothedMapPoint) {
            const jitterMeters = calculateDistanceMeters(smoothedMapPoint[0], smoothedMapPoint[1], lat, lon);
            const mapAlpha = jitterMeters < 7 ? 0.12 : (jitterMeters < 25 ? 0.3 : 0.55);
            smoothedMapPoint = [
                smoothedMapPoint[0] + (lat - smoothedMapPoint[0]) * mapAlpha,
                smoothedMapPoint[1] + (lon - smoothedMapPoint[1]) * mapAlpha
            ];
            point = smoothedMapPoint;
        } else {
            smoothedMapPoint = point;
        }

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
            const now = Date.now();
            const shouldRecenter = !lastMapCenterAt || (now - lastMapCenterAt) > 750;
            if (shouldRecenter) {
                mapInstance.setView(point, mapInstance.getZoom() || 16, { animate: false });
                lastMapCenterAt = now;
            }
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
                const { latitude, longitude, accuracy } = position.coords;
                updateMapPosition(latitude, longitude, accuracy);
                fetchLocationName(latitude, longitude);
                fetchWeather(latitude, longitude);
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

        const alpha = rawKmh < 8 ? 0.58 : (rawKmh < 60 ? 0.38 : 0.68);
        smoothedSpeed = alpha * rawKmh + (1 - alpha) * smoothedSpeed;
        return Math.max(0, Math.round(smoothedSpeed));
    }

    // --- FUNCIÓN PARA ACTUALIZAR LA AGUJA Y EL DISPLAY ---
    function updateInterface(currentSpeed) {
        const displaySpeed = Math.max(0, Math.round(Number(currentSpeed) || 0));
        // Evitar que la aguja se salga físicamente de los límites visuales (0 - 120)
        const boundedSpeed = Math.max(minSpeed, Math.min(maxSpeed, displaySpeed));
        
        // Calcular la rotación de la aguja basándose en la velocidad actual
        const percentage = (boundedSpeed - minSpeed) / (maxSpeed - minSpeed);
        const targetAngle = startAngle + (percentage * totalAngle);
        const visibleArc = percentage * arcLength;
        const formattedSpeed = formatSpeedDisplay(displaySpeed);
        
        // Mover la aguja con CSS y cambiar el texto central
        needle.style.transform = `rotate(${targetAngle}deg)`;
        speedText.textContent = formattedSpeed;
        speedText.classList.add("triple-digits");
        if (gaugeProgress) gaugeProgress.style.strokeDasharray = `${visibleArc.toFixed(2)} 500`;

        speedText.classList.remove("speed-up", "speed-down");
        appContainer.classList.remove("accelerating", "decelerating");

        if (displaySpeed > previousSpeed) {
            speedText.classList.add("speed-up");
            appContainer.classList.add("accelerating");
        } else if (displaySpeed < previousSpeed) {
            speedText.classList.add("speed-down");
            appContainer.classList.add("decelerating");
        }

        previousSpeed = displaySpeed;
        markActiveLabel(displaySpeed);

        // COMPROBACIÓN DEL LÍMITE: alerta normal y alerta agresiva deportiva.
        // En arranque usamos una versión focalizada del warning para no oscurecer toda la pantalla.
        const isOverLimitRaw = displaySpeed > speedLimit;
        const isAggressiveWarningRaw = isOverLimitRaw && (speedLimit >= 75 || displaySpeed >= 75);
        const isStartupWarning = sequenceMode === "startup" && isOverLimitRaw;
        const isStartupAggressiveWarning = sequenceMode === "startup" && isAggressiveWarningRaw;
        const isOverLimit = sequenceMode !== "startup" && isOverLimitRaw;
        const isAggressiveWarning = sequenceMode !== "startup" && isAggressiveWarningRaw;

        appContainer.classList.toggle("speed-warning-startup", isStartupWarning);
        appContainer.classList.toggle("speed-warning-aggressive-startup", isStartupAggressiveWarning);

        if (isOverLimit) {
            appContainer.classList.add("speed-warning");
        } else {
            appContainer.classList.remove("speed-warning");
        }

        appContainer.classList.toggle("speed-warning-aggressive", isAggressiveWarning);

        updateSystemBarColors(isOverLimit || isStartupWarning);

        updateFloatingHud(displaySpeed, isOverLimit || isStartupWarning);

        // Registrar estadísticas sólo si el viaje está iniciado y vas avanzando
        if (isTracking && displaySpeed > 0) {
            // Registrar Velocidad Máxima
            if (displaySpeed > maxSpeedRecorded) {
                maxSpeedRecorded = displaySpeed;
                maxSpeedText.textContent = `${maxSpeedRecorded} km/h`;
            }
            // Calcular Velocidad Promedio
            speedHistory.push(displaySpeed);
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
        requestWakeLock();
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
        sequenceMode = "none";
        appContainer.classList.remove("app-booting", "app-demoing", "sequence-synced");
        lastPositionAt = 0;
        smoothedSpeed = 0;
        lastCoords = null;
        previousSpeed = 0;
        smoothedMapPoint = null;
        lastMapCenterAt = 0;
        setGpsState("off", "GPS: Detenido");
        releaseWakeLock();
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
        const holdMs = 1100;
        const clearReloadPressTimer = () => {
            if (reloadPressTimer) {
                clearTimeout(reloadPressTimer);
                reloadPressTimer = null;
            }
        };

        reloadBtn.addEventListener("contextmenu", (event) => {
            event.preventDefault();
        });

        reloadBtn.addEventListener("pointerdown", (event) => {
            event.preventDefault();
            reloadLongPressTriggered = false;
            clearReloadPressTimer();
            reloadPressTimer = setTimeout(() => {
                reloadLongPressTriggered = true;
                runDemoSequence();
            }, holdMs);
        });

        reloadBtn.addEventListener("pointerup", clearReloadPressTimer);
        reloadBtn.addEventListener("pointerleave", clearReloadPressTimer);
        reloadBtn.addEventListener("pointercancel", clearReloadPressTimer);

        reloadBtn.addEventListener("click", (event) => {
            if (reloadLongPressTriggered) {
                event.preventDefault();
                reloadLongPressTriggered = false;
                return;
            }
            window.location.reload();
        });
    }

    if (installBtn) {
        installBtn.addEventListener("click", async () => {
            if (deferredInstallPrompt) {
                deferredInstallPrompt.prompt();
                const result = await deferredInstallPrompt.userChoice;
                if (result && result.outcome === "accepted") {
                    setInstallButtonVisibility(false);
                }
                deferredInstallPrompt = null;
                return;
            }

            // Fallback útil cuando no existe beforeinstallprompt (ej. iOS)
            alert("Para instalar, abre el menú del navegador y elige 'Agregar a pantalla de inicio'.");
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
        if (!isCompactPanelModeNow()) {
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

    window.addEventListener("beforeinstallprompt", (event) => {
        event.preventDefault();
        deferredInstallPrompt = event;
        if (!isStandaloneMode()) {
            setInstallButtonVisibility(true);
        }
    });

    window.addEventListener("appinstalled", () => {
        deferredInstallPrompt = null;
        setInstallButtonVisibility(false);
    });

    document.addEventListener("visibilitychange", () => {
        if (!isTracking) return;
        if (document.visibilityState === "visible") {
            if (watchId === null) attachGeolocationWatch();
            requestWakeLock();
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
    applyPanelState(isCompactPanelModeNow() ? panelCollapsed : false, false);
    syncPanelMode();
    runStartupAnimation();
    limitValue.textContent = speedLimit;
    updateInterface(0);
    setVisualMode(localStorage.getItem("speedometer_visual_mode") || "sport");
    markActiveLabel(0);
    setGpsState("ready", "GPS: Listo");
    updateSystemBarColors(false);
    updateConnectivityState();
    setInstallButtonVisibility(false);
    if (!isStandaloneMode()) {
        // Si el navegador no emite beforeinstallprompt, dejamos el botón visible como ayuda.
        setInstallButtonVisibility(true);
    }
    window.addEventListener("online", updateConnectivityState);
    window.addEventListener("offline", updateConnectivityState);
    setInterval(updateClock, 1000);
    updateClock();
});
