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
    const gaugeBg = document.getElementById("gauge-bg");
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
    const refreshAgeText = document.getElementById("refresh-age");
    const modeButtons = document.querySelectorAll(".mode-btn");
    const panelHandle = document.getElementById("panel-handle");
    const musicPlayer = document.getElementById("music-player");
    const musicPlayerHead = document.getElementById("music-player-head");
    const musicCloseBtn = document.getElementById("music-close-btn");
    const musicLoadBtn = document.getElementById("music-load");
    const musicReloadBtn = document.getElementById("music-reload");
    const musicFileInput = document.getElementById("music-file-input");
    const musicAudio = document.getElementById("music-audio");
    const musicCover = document.getElementById("music-cover");
    const musicCoverImage = document.getElementById("music-cover-image");
    const musicCoverFallback = document.getElementById("music-cover-fallback");
    const musicTrackName = document.getElementById("music-track-name");
    const musicTrackArtist = document.getElementById("music-track-artist");
    const musicTrackAlbum = document.getElementById("music-track-album");
    const musicSeek = document.getElementById("music-seek");
    const musicTimeCurrent = document.getElementById("music-time-current");
    const musicTimeTotal = document.getElementById("music-time-total");
    const musicPrevBtn = document.getElementById("music-prev");
    const musicPlayBtn = document.getElementById("music-play");
    const musicNextBtn = document.getElementById("music-next");
    const musicShuffleBtn = document.getElementById("music-shuffle");
    const musicRepeatBtn = document.getElementById("music-repeat");
    const musicPlaylist = document.getElementById("music-playlist");
    const musicFab = document.getElementById("music-fab");
    
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
    const gaugePathLength = 500; // Path SVG normalizado (pathLength="500").
    const arcLeadFactor = 1.001; // Ajuste mínimo: arco y aguja van parejos.
    const arcLeadOffset = 0;     // Sin offset: sincronización perfecta desde el inicio.

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
    const arcLength = gaugePathLength;
    let visualMode = "sport";
    let pipWindow = null;
    let pipSpeedText = null;
    let pipLimitText = null;
    let pipTitleText = null;
    let deferredInstallPrompt = null;
    let wakeLock = null;
    let previousClockParts = null;
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
    let gpsRefreshTimer = null;
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
    const normalSystemColor = "#050608";
    const warningSystemColor = "#050608";

    let musicTracks = [];
    let musicTrackIndex = -1;
    let musicShuffleEnabled = false;
    let musicRepeatMode = "all";
    let musicObjectUrl = null;
    let musicCoverObjectUrl = null;
    let musicDragging = false;
    let musicDragOffsetX = 0;
    let musicDragOffsetY = 0;
    let musicDragPointerId = null;
    let musicHoldTimer = null;
    let playlistReorderActive = false;
    let playlistReorderPointerId = null;
    let playlistReorderFromIndex = -1;
    let playlistReorderToIndex = -1;
    let playlistReorderHoldTimer = null;
    let playlistReorderStartY = 0;
    let suppressPlaylistClickUntil = 0;
    let musicDbPromise = null;

    const MUSIC_DB_NAME = "speedometer_music_db";
    const MUSIC_DB_VERSION = 1;
    const MUSIC_TRACKS_STORE = "tracks";

    if (maxSpeed < minAllowedMax || maxSpeed > maxAllowedMax) {
        maxSpeed = defaultMaxSpeed;
    }

    if (orientationBtn) {
        orientationBtn.hidden = true;
        orientationBtn.setAttribute("aria-hidden", "true");
    }

    // Mantener en sincronía CSS (arco/aguja/animaciones) y JS (cálculo de ángulos).
    appContainer.style.setProperty("--gauge-arc-length", String(arcLength));
    appContainer.style.setProperty("--gauge-start-angle", `${startAngle}deg`);
    appContainer.style.setProperty("--gauge-end-angle", `${endAngle}deg`);

    function toGaugePoint(angleDegrees, radius = 80, cx = 100, cy = 100) {
        const angleRadians = (angleDegrees - 90) * (Math.PI / 180);
        return {
            x: cx + radius * Math.cos(angleRadians),
            y: cy + radius * Math.sin(angleRadians),
        };
    }

    function drawGaugeArcPath() {
        if (!gaugeBg || !gaugeProgress) return;

        const start = toGaugePoint(startAngle);
        const end = toGaugePoint(endAngle);
        const largeArc = totalAngle > 180 ? 1 : 0;
        const sweep = 1;
        const arcPath = `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A 80 80 0 ${largeArc} ${sweep} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;

        gaugeBg.setAttribute("d", arcPath);
        gaugeProgress.setAttribute("d", arcPath);
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

        drawGaugeArcPath();
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

    function getMapThemeColors() {
        if (visualMode === "street") {
            return {
                markerStroke: "#22f2d3",
                markerFill: "#2ab7ff",
            };
        }

        if (visualMode === "track") {
            return {
                markerStroke: "#d94bff",
                markerFill: "#ff7bd3",
            };
        }

        return {
            markerStroke: "#ff2a2a",
            markerFill: "#ff5a1f",
        };
    }

    function applyMapThemeStyles() {
        const { markerStroke, markerFill } = getMapThemeColors();

        if (mapMarker) {
            mapMarker.setStyle({
                color: markerStroke,
                fillColor: markerFill,
            });
        }

        if (mapAccuracyCircle) {
            mapAccuracyCircle.setStyle({
                color: markerStroke,
                fillColor: markerFill,
            });
        }
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

        applyMapThemeStyles();

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
        simulatedLandscape = false;
        appContainer.classList.remove("force-landscape");
        syncPanelMode();
        if (musicPlayer && !musicPlayer.hidden) {
            resetMusicPlayerPosition();
            keepMusicPlayerInBounds();
        }
    }

    function isStandaloneMode() {
        return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    }

    function setInstallButtonVisibility(visible) {
        if (!installBtn) return;
        installBtn.hidden = !visible;
    }

    function formatElapsedAge(timestamp) {
        if (!timestamp || timestamp <= 0) return "--";
        const elapsedSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
        if (elapsedSeconds < 60) return `${elapsedSeconds}s`;
        const minutes = Math.floor(elapsedSeconds / 60);
        const seconds = elapsedSeconds % 60;
        if (minutes < 60) return `${minutes}m ${seconds}s`;
        const hours = Math.floor(minutes / 60);
        const remMinutes = minutes % 60;
        return `${hours}h ${remMinutes}m`;
    }

    function updateRefreshAgeLabel() {
        if (!refreshAgeText) return;
        const weatherAge = formatElapsedAge(lastWeatherTime);
        const locationAge = formatElapsedAge(lastGeocodeTime);
        refreshAgeText.textContent = `Clima ${weatherAge} · Ubicación ${locationAge}`;
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

    // ---- ICONOS + DESCRIPCION WMO (Open-Meteo) ----
    function getWmoWeatherInfo(code, isDay = true, cloudCover = null) {
        // Iconos base para distinguir claramente dia y noche en estados despejados/parcialmente nublados.
        const clearIcon = isDay ? "\u2600\ufe0f" : "\uD83C\uDF19";
        const mostlyClearIcon = isDay ? "\uD83C\uDF24\uFE0F" : "\uD83C\uDF19";
        const partlyCloudyIcon = isDay ? "\u26C5" : "\u2601\ufe0f";
        const rainIcon = "\uD83C\uDF27\uFE0F";
        const cloud = Number.isFinite(Number(cloudCover)) ? Number(cloudCover) : null;

        // Afinar condiciones despejadas/parcialmente nubladas con nubosidad real para evitar nube fija durante dias soleados.
        if ((code === 1 || code === 2) && isDay && cloud !== null) {
            if (cloud <= 18) return { icon: "\u2600\ufe0f", label: "Soleado" };
            if (cloud <= 45) return { icon: "\uD83C\uDF24\uFE0F", label: "Mayormente soleado" };
            if (cloud <= 70) return { icon: "\u26C5", label: "Parcialmente nublado" };
        }

        const definitions = {
            0: { icon: clearIcon, label: isDay ? "Despejado" : "Despejado (noche)" },
            1: { icon: mostlyClearIcon, label: isDay ? "Mayormente despejado" : "Mayormente despejado (noche)" },
            2: { icon: partlyCloudyIcon, label: "Parcialmente nublado" },
            3: { icon: "\u2601\ufe0f", label: "Nublado" },
            45: { icon: "\uD83C\uDF2B\uFE0F", label: "Niebla" },
            48: { icon: "\uD83C\uDF2B\uFE0F", label: "Niebla con escarcha" },
            51: { icon: rainIcon, label: "Llovizna ligera" },
            53: { icon: rainIcon, label: "Llovizna moderada" },
            55: { icon: rainIcon, label: "Llovizna intensa" },
            56: { icon: "\uD83C\uDF27\uFE0F", label: "Llovizna helada ligera" },
            57: { icon: "\uD83C\uDF27\uFE0F", label: "Llovizna helada intensa" },
            61: { icon: "\uD83C\uDF27\uFE0F", label: "Lluvia ligera" },
            63: { icon: "\uD83C\uDF27\uFE0F", label: "Lluvia moderada" },
            65: { icon: "\uD83C\uDF27\uFE0F", label: "Lluvia intensa" },
            66: { icon: "\uD83C\uDF27\uFE0F", label: "Lluvia helada ligera" },
            67: { icon: "\uD83C\uDF27\uFE0F", label: "Lluvia helada intensa" },
            71: { icon: "\u2744\ufe0f", label: "Nieve ligera" },
            73: { icon: "\u2744\ufe0f", label: "Nieve moderada" },
            75: { icon: "\u2744\ufe0f", label: "Nieve intensa" },
            77: { icon: "\uD83C\uDF28\uFE0F", label: "Granizo suave" },
            80: { icon: rainIcon, label: "Chubascos ligeros" },
            81: { icon: rainIcon, label: "Chubascos moderados" },
            82: { icon: "\u26C8\ufe0f", label: "Chubascos intensos" },
            85: { icon: "\uD83C\uDF28\uFE0F", label: "Chubascos de nieve ligeros" },
            86: { icon: "\uD83C\uDF28\uFE0F", label: "Chubascos de nieve intensos" },
            95: { icon: "\u26C8\ufe0f", label: "Tormenta" },
            96: { icon: "\u26C8\ufe0f", label: "Tormenta con granizo leve" },
            99: { icon: "\u26C8\ufe0f", label: "Tormenta con granizo fuerte" },
        };

        return definitions[code] ?? { icon: isDay ? "\u2600\ufe0f" : "\uD83C\uDF19", label: isDay ? "Condicion desconocida" : "Condicion desconocida (noche)" };
    }

    // ---- CLIMA: Open-Meteo (sin API key) ----
    async function fetchWeather(lat, lon) {
        if (!navigator.onLine) return;
        const now = Date.now();
        if (lastWeatherLatLng) {
            const dist = calculateDistanceMeters(lastWeatherLatLng[0], lastWeatherLatLng[1], lat, lon);
            if (dist < 250 && (now - lastWeatherTime) < 35 * 1000) return;
        }
        try {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(5)}&longitude=${lon.toFixed(5)}&current=temperature_2m,apparent_temperature,weather_code,is_day,cloud_cover,precipitation&timezone=auto&forecast_days=1`;
            const res = await fetch(url);
            if (!res.ok) return;
            const data = await res.json();
            const temp = data.current?.temperature_2m;
            const apparentTemp = data.current?.apparent_temperature;
            const code = data.current?.weather_code;
            const isDayValue = data.current?.is_day;
            const cloudCover = data.current?.cloud_cover;
            const precipitation = data.current?.precipitation;
            const isDay = typeof isDayValue === "number"
                ? isDayValue === 1
                : (new Date().getHours() >= 6 && new Date().getHours() < 18);
            if (temp !== undefined && code !== undefined) {
                const iconEl = document.getElementById('weather-icon');
                const tempEl = document.getElementById('weather-temp');
                const weatherInfo = getWmoWeatherInfo(code, isDay, cloudCover);
                if (iconEl) {
                    iconEl.textContent = weatherInfo.icon;
                    iconEl.title = weatherInfo.label;
                }
                if (tempEl) tempEl.textContent = `${Math.round(temp)}\u00b0C`;
                if (tempEl) {
                    const cloudText = Number.isFinite(Number(cloudCover)) ? `, nubosidad ${Math.round(Number(cloudCover))}%` : "";
                    const rainText = Number.isFinite(Number(precipitation)) ? `, lluvia ${Number(precipitation).toFixed(1)} mm` : "";
                    const feelText = Number.isFinite(Number(apparentTemp)) ? `, sensacion ${Math.round(Number(apparentTemp))}\u00b0C` : "";
                    tempEl.title = `${weatherInfo.label}${feelText}${cloudText}${rainText}`;
                }
                lastWeatherLatLng = [lat, lon];
                lastWeatherTime = now;
                updateRefreshAgeLabel();
            }
        } catch (_) { /* sin conexi\u00f3n */ }
    }

    // ---- GEOCODING: Nominatim (OpenStreetMap, sin API key) ----
    async function fetchLocationName(lat, lon) {
        const locationTextEl = document.getElementById('location-text');
        const mapLocationTag = document.getElementById('map-location-tag');
        const existingLocation = (locationTextEl?.textContent || "").trim();
        const fallbackLocation = existingLocation && existingLocation !== "Buscando ubicación..."
            ? existingLocation
            : "Ubicación no disponible";

        if (!navigator.onLine) {
            if (locationTextEl) locationTextEl.textContent = fallbackLocation;
            if (mapLocationTag) mapLocationTag.textContent = fallbackLocation;
            return;
        }

        const now = Date.now();
        if (lastGeocodedLatLng) {
            const dist = calculateDistanceMeters(lastGeocodedLatLng[0], lastGeocodedLatLng[1], lat, lon);
            if (dist < 45 && (now - lastGeocodeTime) < 10 * 1000) return;
        }
        try {
            const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}&format=jsonv2&zoom=17&addressdetails=1&namedetails=1&accept-language=es`;
            const res = await fetch(url);
            if (!res.ok) return;
            const data = await res.json();
            const a = data.address || {};
            const roadName = [a.road, a.house_number].filter(Boolean).join(" ").trim();
            const barrio = a.neighbourhood ?? a.suburb ?? a.quarter;
            const zona = a.city_district ?? a.borough ?? a.county ?? a.state_district;
            const lugar = roadName || data.name || a.amenity || a.building || a.shop || a.tourism || a.hamlet || a.village;
            const ciudad = a.city ?? a.town ?? a.municipality;

            const parts = [barrio, zona, lugar, ciudad]
                .filter(Boolean)
                .map((part) => String(part).trim())
                .filter((part, index, arr) => part.length > 0 && arr.indexOf(part) === index);

            const name = parts.length
                ? parts.slice(0, 3).join(", ")
                : (data.display_name?.split(',').slice(0, 3).join(',').trim() || fallbackLocation);

            const trimmed = name.trim() || fallbackLocation;
            if (locationTextEl) locationTextEl.textContent = trimmed;
            if (mapLocationTag) mapLocationTag.textContent = trimmed;
            lastGeocodedLatLng = [lat, lon];
            lastGeocodeTime = now;
            updateRefreshAgeLabel();
        } catch (_) {
            if (locationTextEl) locationTextEl.textContent = fallbackLocation;
            if (mapLocationTag) mapLocationTag.textContent = fallbackLocation;
        }
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
        applySimulatedLandscape(false);
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
            const { markerStroke, markerFill } = getMapThemeColors();
            mapMarker = L.circleMarker(point, {
                radius: 7,
                color: markerStroke,
                weight: 2,
                fillColor: markerFill,
                fillOpacity: 0.9,
                className: "map-speed-marker"
            }).addTo(mapInstance);
        } else {
            mapMarker.setLatLng(point);
        }

        if (!mapAccuracyCircle) {
            const { markerStroke, markerFill } = getMapThemeColors();
            mapAccuracyCircle = L.circle(point, {
                radius: Math.max(8, accuracy || 8),
                color: markerStroke,
                weight: 1,
                fillColor: markerFill,
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
        if (gpsRefreshTimer) {
            clearInterval(gpsRefreshTimer);
            gpsRefreshTimer = null;
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
            maximumAge: 0,
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

        gpsRefreshTimer = setInterval(() => {
            if (!isTracking || !latestLatLng) return;

            fetchLocationName(latestLatLng[0], latestLatLng[1]);
            fetchWeather(latestLatLng[0], latestLatLng[1]);
        }, 15000);
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

    function formatMediaTime(seconds) {
        if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
        const total = Math.floor(seconds);
        const mins = Math.floor(total / 60);
        const secs = total % 60;
        return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }

    function syncMusicUiState() {
        if (!musicPlayer || !floatingBtn || !musicAudio) return;
        const isOpen = !musicPlayer.hidden;
        const isPlaying = !musicAudio.paused;
        musicPlayer.classList.toggle("playing", isPlaying);
        floatingBtn.classList.toggle("active", isOpen || isPlaying);
        floatingBtn.textContent = isOpen ? "Cerrar musica" : "Musica";
        if (musicFab) {
            musicFab.classList.toggle("active", isOpen || isPlaying);
            const musicFabLabel = musicFab.querySelector("span");
            if (musicFabLabel) {
                musicFabLabel.textContent = isOpen ? "Cerrar" : "Musica";
            } else {
                musicFab.textContent = isOpen ? "Cerrar" : "Musica";
            }
        }
        if (musicPlayBtn) {
            musicPlayBtn.title = isPlaying ? "Pausar" : "Reproducir";
        }
    }

    function syncMusicOptionButtons() {
        if (musicShuffleBtn) {
            musicShuffleBtn.classList.toggle("active", musicShuffleEnabled);
            musicShuffleBtn.title = `Aleatorio: ${musicShuffleEnabled ? "On" : "Off"}`;
        }

        if (musicRepeatBtn) {
            const label = musicRepeatMode === "one" ? "Una" : "Lista";
            musicRepeatBtn.classList.toggle("active", musicRepeatMode === "one");
            musicRepeatBtn.title = `Repetir: ${label}`;
        }
    }

    function openMusicDatabase() {
        if (!window.indexedDB) {
            return Promise.resolve(null);
        }

        if (!musicDbPromise) {
            musicDbPromise = new Promise((resolve) => {
                const request = window.indexedDB.open(MUSIC_DB_NAME, MUSIC_DB_VERSION);

                request.onupgradeneeded = () => {
                    const db = request.result;
                    if (!db.objectStoreNames.contains(MUSIC_TRACKS_STORE)) {
                        db.createObjectStore(MUSIC_TRACKS_STORE, { keyPath: "id" });
                    }
                };

                request.onsuccess = () => {
                    const db = request.result;
                    db.onversionchange = () => db.close();
                    resolve(db);
                };

                request.onerror = () => {
                    console.warn("No se pudo abrir la base de musica", request.error);
                    resolve(null);
                };
            });
        }

        return musicDbPromise;
    }

    async function saveTracksToMusicLibrary(tracks) {
        if (!tracks.length) return;
        const db = await openMusicDatabase();
        if (!db) return;

        await new Promise((resolve) => {
            const transaction = db.transaction(MUSIC_TRACKS_STORE, "readwrite");
            const store = transaction.objectStore(MUSIC_TRACKS_STORE);

            tracks.forEach((track, index) => {
                store.put({
                    id: track.id,
                    name: track.name,
                    title: track.title,
                    artist: track.artist,
                    album: track.album,
                    coverBlob: track.coverBlob || null,
                    audioBlob: track.file,
                    type: track.file?.type || "",
                    fileName: track.file?.name || `${track.name || "track"}.mp3`,
                    lastModified: track.file?.lastModified || Date.now(),
                    savedAt: Date.now() + index,
                });
            });

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => {
                console.warn("No se pudo guardar la musica localmente", transaction.error);
                resolve();
            };
        });
    }

    async function clearMusicLibraryStorage() {
        const db = await openMusicDatabase();
        if (!db) return;

        await new Promise((resolve) => {
            const transaction = db.transaction(MUSIC_TRACKS_STORE, "readwrite");
            const store = transaction.objectStore(MUSIC_TRACKS_STORE);
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => {
                console.warn("No se pudo limpiar la musica guardada", request.error);
                resolve();
            };
        });
    }

    async function loadTracksFromMusicLibrary() {
        const db = await openMusicDatabase();
        if (!db) return [];

        return new Promise((resolve) => {
            const transaction = db.transaction(MUSIC_TRACKS_STORE, "readonly");
            const store = transaction.objectStore(MUSIC_TRACKS_STORE);
            const request = store.getAll();

            request.onsuccess = () => {
                const stored = Array.isArray(request.result) ? request.result : [];
                const tracks = stored
                    .sort((a, b) => (a.savedAt || 0) - (b.savedAt || 0))
                    .map((entry) => {
                        const file = new File(
                            [entry.audioBlob],
                            entry.fileName || `${entry.name || "track"}.mp3`,
                            {
                                type: entry.type || "audio/mpeg",
                                lastModified: entry.lastModified || Date.now(),
                            }
                        );

                        return {
                            id: entry.id,
                            name: entry.name || file.name.replace(/\.[^.]+$/, ""),
                            title: entry.title || entry.name || file.name.replace(/\.[^.]+$/, ""),
                            artist: entry.artist || "Artista desconocido",
                            album: entry.album || "Album desconocido",
                            coverBlob: entry.coverBlob || null,
                            file,
                        };
                    });

                resolve(tracks);
            };

            request.onerror = () => {
                console.warn("No se pudo restaurar la musica guardada", request.error);
                resolve([]);
            };
        });
    }

    function resetMusicUi() {
        clearCurrentMusicObjectUrl();
        clearCurrentMusicCoverObjectUrl();

        musicTracks = [];
        musicTrackIndex = -1;

        if (musicAudio) {
            musicAudio.pause();
            musicAudio.removeAttribute("src");
            musicAudio.load();
        }

        if (musicTrackName) {
            musicTrackName.textContent = "Sin canciones cargadas";
        }

        if (musicTrackArtist) {
            musicTrackArtist.textContent = "Artista desconocido";
        }

        if (musicTrackAlbum) {
            musicTrackAlbum.textContent = "Album desconocido";
        }

        if (musicTimeCurrent) musicTimeCurrent.textContent = "00:00";
        if (musicTimeTotal) musicTimeTotal.textContent = "00:00";
        if (musicSeek) musicSeek.value = "0";

        setMusicCover(null, "");
        renderMusicPlaylist();
        syncMusicUiState();
    }

    async function restorePersistedMusic() {
        const restoredTracks = await loadTracksFromMusicLibrary();
        if (!restoredTracks.length) return;

        musicTracks = await Promise.all(restoredTracks.map(async (track) => {
            if (!shouldRefreshTrackMetadata(track)) {
                return sanitizeTrackMetadata(track);
            }

            const metadata = await extractId3Metadata(track.file);
            return sanitizeTrackMetadata({
                ...track,
                title: metadata.title,
                artist: metadata.artist,
                album: metadata.album,
                coverBlob: metadata.coverBlob || track.coverBlob || null,
            });
        }));

        await saveTracksToMusicLibrary(musicTracks);
        setMusicTrack(0, false);
    }

    function normalizeMetadataText(text) {
        return String(text || "")
            .replace(/^\uFEFF+/u, "")
            .replace(/\u0000/g, "")
            .replace(/[\u200B-\u200D\u2060]/g, "")
            .replace(/\s+/g, " ")
            .trim();
    }

    function metadataTextScore(text) {
        if (!text) return -999;
        let score = 0;

        for (const char of text) {
            const code = char.charCodeAt(0);

            if (char === "\ufffd") score -= 6;
            if (/[_\-\sA-Za-z0-9]/.test(char)) score += 2;
            if (/[ -]/.test(char)) score += 1;
            if (/[ -]/.test(char)) score -= 5;
            if (/[ -\u007F]/.test(char)) score -= 3;
            if (/[ -]/.test(char) === false) score += 0.2;

            if (code >= 0x4e00 && code <= 0x9fff) score -= 1.8;
            if ("ÃÂÐÑ".includes(char)) score -= 2;
        }

        if (text.length <= 2) score -= 2;
        return score;
    }

    function sanitizeMetadataValue(text, fallback = "") {
        const fallbackClean = normalizeMetadataText(fallback);
        const normalized = normalizeMetadataText(text)
            .replace(/^(?:ï»¿|Ã¯Â»Â¿)+/i, "")
            .replace(/^[\ufffd]+/u, "")
            .replace(/^[\s\-_.:|]+/, "")
            .replace(/^[^\p{L}\p{N}]+/u, "")
            .trim();

        if (!normalized) return fallbackClean;

        const looksMojibake = /(Ã.|Â.|Ð.|Ñ.|þ|ÿ|\ufffd)/u.test(normalized);
        if (looksMojibake && metadataTextScore(normalized) < 6 && fallbackClean && normalized !== fallbackClean) {
            return fallbackClean;
        }

        return normalized;
    }

    function hasSuspiciousMetadataPrefix(text) {
        const normalized = normalizeMetadataText(text);
        if (!normalized) return true;
        if (/^(?:ï»¿|Ã¯Â»Â¿|\ufffd+)/iu.test(normalized)) return true;
        if (/^[ÃÂÐÑÏïþÿ]/u.test(normalized) && metadataTextScore(normalized.slice(0, 2)) < 0) return true;
        return false;
    }

    function sanitizeTrackMetadata(track) {
        const fallbackTitle = track?.name || track?.file?.name?.replace(/\.[^.]+$/, "") || "Cancion";
        return {
            ...track,
            title: sanitizeMetadataValue(track?.title, fallbackTitle) || fallbackTitle,
            artist: sanitizeMetadataValue(track?.artist, "Artista desconocido") || "Artista desconocido",
            album: sanitizeMetadataValue(track?.album, "Album desconocido") || "Album desconocido",
        };
    }

    function shouldRefreshTrackMetadata(track) {
        return hasSuspiciousMetadataPrefix(track?.title)
            || hasSuspiciousMetadataPrefix(track?.artist)
            || hasSuspiciousMetadataPrefix(track?.album)
            || /(Ã.|Â.|Ð.|Ñ.|þ|ÿ|\ufffd)/u.test(normalizeMetadataText(track?.title || ""))
            || /(Ã.|Â.|Ð.|Ñ.|þ|ÿ|\ufffd)/u.test(normalizeMetadataText(track?.artist || ""))
            || /(Ã.|Â.|Ð.|Ñ.|þ|ÿ|\ufffd)/u.test(normalizeMetadataText(track?.album || ""));
    }

    function decodeMetadataBestEffort(data, encodingByte, fallback = "") {
        if (!data || !data.length) return fallback;

        const decoderSet = [];
        if (encodingByte === 1 || encodingByte === 2) {
            decoderSet.push("utf-16", "utf-16le", "utf-8", "windows-1252");
        } else if (encodingByte === 3) {
            decoderSet.push("utf-8", "utf-16", "windows-1252");
        } else {
            decoderSet.push("iso-8859-1", "windows-1252", "utf-8", "utf-16");
        }

        let best = "";
        let bestScore = -Infinity;

        for (const enc of decoderSet) {
            try {
                const candidate = normalizeMetadataText(new TextDecoder(enc).decode(data));
                const score = metadataTextScore(candidate);
                if (score > bestScore) {
                    bestScore = score;
                    best = candidate;
                }
            } catch (_) {
                // ignore unsupported decoders
            }
        }

        const cleanedFallback = sanitizeMetadataValue(fallback);
        if (!best) return cleanedFallback;

        best = sanitizeMetadataValue(best, cleanedFallback);

        // Si la cadena se ve claramente corrupta, volvemos al nombre de archivo.
        if (metadataTextScore(best) < 0 && cleanedFallback) {
            return cleanedFallback;
        }

        return best;
    }

    function renderMusicPlaylist() {
        if (!musicPlaylist) return;
        musicPlaylist.innerHTML = "";

        if (!musicTracks.length) {
            musicPlaylist.innerHTML = '<button type="button" class="music-playlist-item empty" disabled>No hay canciones cargadas</button>';
            return;
        }

        musicTracks.forEach((track, index) => {
            const safeTitle = sanitizeMetadataValue(track.title, track.name) || track.name;
            const safeArtist = sanitizeMetadataValue(track.artist, "Artista desconocido") || "Artista desconocido";
            const item = document.createElement("button");
            item.type = "button";
            item.className = "music-playlist-item";
            item.dataset.index = String(index);
            if (index === musicTrackIndex) {
                item.classList.add("active");
            }
            item.innerHTML = `
                <strong>${safeTitle}</strong>
                <span>${safeArtist}</span>
            `;
            item.addEventListener("click", () => {
                if (Date.now() < suppressPlaylistClickUntil) return;
                setMusicTrack(index, true);
            });
            musicPlaylist.appendChild(item);
        });
    }

    function clearPlaylistDropMarkers() {
        if (!musicPlaylist) return;
        musicPlaylist.querySelectorAll(".music-playlist-item.drop-target, .music-playlist-item.reorder-source")
            .forEach((item) => item.classList.remove("drop-target", "reorder-source"));
    }

    function setPlaylistDropTarget(index) {
        if (!musicPlaylist) return;
        clearPlaylistDropMarkers();

        const source = musicPlaylist.querySelector(`.music-playlist-item[data-index="${playlistReorderFromIndex}"]`);
        const target = musicPlaylist.querySelector(`.music-playlist-item[data-index="${index}"]`);
        if (source) source.classList.add("reorder-source");
        if (target) target.classList.add("drop-target");
    }

    function reorderMusicTracks(fromIndex, toIndex) {
        if (!musicTracks.length) return;
        if (fromIndex < 0 || toIndex < 0 || fromIndex >= musicTracks.length || toIndex >= musicTracks.length) return;
        if (fromIndex === toIndex) return;

        const activeTrackId = musicTrackIndex >= 0 && musicTrackIndex < musicTracks.length
            ? musicTracks[musicTrackIndex].id
            : null;

        const [movedTrack] = musicTracks.splice(fromIndex, 1);
        musicTracks.splice(toIndex, 0, movedTrack);

        if (activeTrackId) {
            musicTrackIndex = musicTracks.findIndex((track) => track.id === activeTrackId);
        }

        renderMusicPlaylist();
    }

    function decodeId3SyncSafeInt(bytes, start) {
        return ((bytes[start] & 0x7f) << 21)
            | ((bytes[start + 1] & 0x7f) << 14)
            | ((bytes[start + 2] & 0x7f) << 7)
            | (bytes[start + 3] & 0x7f);
    }

    function decodeId3Text(data, encodingByte, fallback = "") {
        return decodeMetadataBestEffort(data, encodingByte, fallback);
    }

    function readApicFrame(frameData) {
        if (!frameData || frameData.length < 8) return null;

        const encoding = frameData[0];
        let cursor = 1;

        const mimeEnd = frameData.indexOf(0x00, cursor);
        if (mimeEnd === -1) return null;

        const mime = new TextDecoder("iso-8859-1").decode(frameData.slice(cursor, mimeEnd)).trim();
        cursor = mimeEnd + 1;
        if (cursor >= frameData.length) return null;

        cursor += 1; // picture type

        if (encoding === 1 || encoding === 2) {
            while (cursor + 1 < frameData.length) {
                if (frameData[cursor] === 0x00 && frameData[cursor + 1] === 0x00) {
                    cursor += 2;
                    break;
                }
                cursor += 2;
            }
        } else {
            const descEnd = frameData.indexOf(0x00, cursor);
            cursor = descEnd === -1 ? frameData.length : descEnd + 1;
        }

        if (cursor >= frameData.length) return null;
        const imageBytes = frameData.slice(cursor);
        const safeMime = mime.startsWith("image/") ? mime : "image/jpeg";
        return new Blob([imageBytes], { type: safeMime });
    }

    async function extractId3Metadata(file) {
        const fallbackTitle = file.name.replace(/\.[^.]+$/, "");
        const metadata = {
            title: fallbackTitle,
            artist: "Artista desconocido",
            album: "Album desconocido",
            coverBlob: null,
        };

        try {
            const probe = await file.slice(0, 512 * 1024).arrayBuffer();
            const bytes = new Uint8Array(probe);
            if (bytes.length < 10) return metadata;

            if (String.fromCharCode(bytes[0], bytes[1], bytes[2]) !== "ID3") {
                return metadata;
            }

            const version = bytes[3];
            const tagSize = decodeId3SyncSafeInt(bytes, 6);
            const tagEnd = Math.min(bytes.length, 10 + tagSize);
            let offset = 10;

            while (offset + 10 <= tagEnd) {
                const frameId = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
                if (!frameId.trim()) break;

                const frameSize = version === 4
                    ? decodeId3SyncSafeInt(bytes, offset + 4)
                    : ((bytes[offset + 4] << 24) | (bytes[offset + 5] << 16) | (bytes[offset + 6] << 8) | bytes[offset + 7]);

                if (!frameSize || frameSize < 0) break;

                const frameStart = offset + 10;
                const frameEnd = Math.min(frameStart + frameSize, tagEnd);
                if (frameEnd <= frameStart) break;

                const frameData = bytes.slice(frameStart, frameEnd);
                if (frameId === "TIT2" && frameData.length > 1) {
                    metadata.title = decodeId3Text(frameData.slice(1), frameData[0], fallbackTitle) || metadata.title;
                } else if (frameId === "TPE1" && frameData.length > 1) {
                    metadata.artist = decodeId3Text(frameData.slice(1), frameData[0], "Artista desconocido") || metadata.artist;
                } else if (frameId === "TALB" && frameData.length > 1) {
                    metadata.album = decodeId3Text(frameData.slice(1), frameData[0], "Album desconocido") || metadata.album;
                } else if (frameId === "APIC" && !metadata.coverBlob) {
                    metadata.coverBlob = readApicFrame(frameData);
                }

                offset = frameEnd;
            }
        } catch (_) {
            return metadata;
        }

        return metadata;
    }

    function clearCurrentMusicObjectUrl() {
        if (musicObjectUrl) {
            URL.revokeObjectURL(musicObjectUrl);
            musicObjectUrl = null;
        }
    }

    function clearCurrentMusicCoverObjectUrl() {
        if (musicCoverObjectUrl) {
            URL.revokeObjectURL(musicCoverObjectUrl);
            musicCoverObjectUrl = null;
        }
    }

    function getTrackFileKey(file) {
        return `${file.name}__${file.size}__${file.lastModified || 0}`;
    }

    function isLikelyAudioFile(fileOrName) {
        const fileName = typeof fileOrName === "string" ? fileOrName : (fileOrName?.name || "");
        const fileType = typeof fileOrName === "string" ? "" : (fileOrName?.type || "");
        if (fileType.startsWith("audio/")) return true;
        return /\.(mp3|m4a|aac|flac|wav|ogg|opus|webm)$/i.test(fileName);
    }

    async function collectAudioFilesFromDirectory(directoryHandle) {
        const discovered = [];

        async function walk(handle) {
            for await (const entry of handle.values()) {
                if (entry.kind === "directory") {
                    await walk(entry);
                    continue;
                }

                if (entry.kind === "file" && isLikelyAudioFile(entry.name)) {
                    const file = await entry.getFile();
                    if (isLikelyAudioFile(file)) {
                        discovered.push(file);
                    }
                }
            }
        }

        await walk(directoryHandle);
        return discovered;
    }

    async function appendMusicFiles(files) {
        const sourceFiles = Array.from(files || []).filter((file) => isLikelyAudioFile(file));
        if (!sourceFiles.length) {
            if (musicTrackName) {
                musicTrackName.textContent = "No se encontraron archivos de audio";
            }
            return;
        }

        const existingKeys = new Set(musicTracks.map((track) => getTrackFileKey(track.file)));
        const uniqueFiles = sourceFiles.filter((file) => !existingKeys.has(getTrackFileKey(file)));

        if (!uniqueFiles.length) {
            if (musicTrackName) {
                musicTrackName.textContent = "Esas canciones ya estaban cargadas";
            }
            return;
        }

        if (musicTrackName) {
            musicTrackName.textContent = `Cargando ${uniqueFiles.length} canciones...`;
        }

        const parsed = await Promise.all(uniqueFiles.map(async (file, index) => {
            const metadata = await extractId3Metadata(file);
            const fileKey = getTrackFileKey(file);
            return sanitizeTrackMetadata({
                id: `${fileKey}-${index}`,
                name: file.name.replace(/\.[^.]+$/, ""),
                title: metadata.title,
                artist: metadata.artist,
                album: metadata.album,
                coverBlob: metadata.coverBlob,
                file,
            });
        }));

        const hadTracks = musicTracks.length > 0;
        musicTracks = [...musicTracks, ...parsed];
        await saveTracksToMusicLibrary(parsed);

        if (!hadTracks) {
            setMusicTrack(0, true);
        } else {
            renderMusicPlaylist();
            syncMusicUiState();
        }

        if (musicPlayer) {
            musicPlayer.hidden = false;
        }
    }

    function setMusicCover(coverBlob, trackTitle) {
        if (!musicCoverImage || !musicCoverFallback) return;

        clearCurrentMusicCoverObjectUrl();

        if (coverBlob) {
            musicCoverObjectUrl = URL.createObjectURL(coverBlob);
            musicCoverImage.src = musicCoverObjectUrl;
            musicCoverImage.hidden = false;
            musicCoverFallback.hidden = true;
            return;
        }

        const initial = (trackTitle || "").trim().charAt(0).toUpperCase() || "♪";
        musicCoverFallback.textContent = initial;
        musicCoverFallback.hidden = false;
        musicCoverImage.hidden = true;
        musicCoverImage.removeAttribute("src");
    }

    function setMusicTrack(index, autoPlay = true) {
        if (!musicAudio || !musicTrackName || !musicTimeCurrent || !musicTimeTotal || !musicSeek) return;
        if (!musicTracks.length || index < 0 || index >= musicTracks.length) return;

        musicTrackIndex = index;
        const track = sanitizeTrackMetadata(musicTracks[musicTrackIndex]);
        musicTracks[musicTrackIndex] = track;
        clearCurrentMusicObjectUrl();
        musicObjectUrl = URL.createObjectURL(track.file);
        musicAudio.src = musicObjectUrl;
        musicAudio.load();

        const trackTitle = track.title || track.name;
        musicTrackName.textContent = trackTitle;
        if (musicTrackArtist) {
            musicTrackArtist.textContent = track.artist || "Artista desconocido";
        }
        if (musicTrackAlbum) {
            musicTrackAlbum.textContent = track.album || "Album desconocido";
        }
        setMusicCover(track.coverBlob || null, trackTitle);
        renderMusicPlaylist();
        musicTimeCurrent.textContent = "00:00";
        musicTimeTotal.textContent = "00:00";
        musicSeek.value = "0";

        if (autoPlay) {
            musicAudio.play().catch(() => {
                syncMusicUiState();
            });
        }

        syncMusicUiState();
    }

    function selectNextTrackIndex(direction = 1) {
        if (!musicTracks.length) return -1;
        if (musicShuffleEnabled && musicTracks.length > 1) {
            let next = musicTrackIndex;
            while (next === musicTrackIndex) {
                next = Math.floor(Math.random() * musicTracks.length);
            }
            return next;
        }

        if (direction < 0) {
            return (musicTrackIndex - 1 + musicTracks.length) % musicTracks.length;
        }

        return (musicTrackIndex + 1) % musicTracks.length;
    }

    function playNextTrack(direction = 1, autoPlay = true) {
        if (!musicTracks.length) return;
        const nextIndex = selectNextTrackIndex(direction);
        if (nextIndex >= 0) {
            setMusicTrack(nextIndex, autoPlay);
        }
    }

    function toggleMusicPlayer() {
        if (!musicPlayer) return;
        const willOpen = musicPlayer.hidden;
        musicPlayer.hidden = !willOpen;
        if (willOpen) {
            musicPlayer.style.removeProperty("left");
            musicPlayer.style.removeProperty("top");
            musicPlayer.style.removeProperty("right");
            musicPlayer.style.removeProperty("bottom");
            requestAnimationFrame(() => {
                resetMusicPlayerPosition();
                keepMusicPlayerInBounds();
            });
        }
        syncMusicUiState();
    }

    function isLandscapePlayerMode() {
        return window.matchMedia("(orientation: landscape) and (pointer: coarse)").matches
            || appContainer?.classList.contains("force-landscape");
    }

    function resetMusicPlayerPosition() {
        if (!musicPlayer) return;

        musicPlayer.style.removeProperty("left");
        musicPlayer.style.removeProperty("top");

        if (isLandscapePlayerMode()) {
            musicPlayer.style.right = "8px";
            musicPlayer.style.top = "calc(46px + env(safe-area-inset-top))";
            musicPlayer.style.bottom = "auto";
            return;
        }

        musicPlayer.style.removeProperty("top");
        musicPlayer.style.right = "14px";
        musicPlayer.style.bottom = "calc(14px + env(safe-area-inset-bottom))";
    }

    function clampMusicPosition(left, top) {
        if (!musicPlayer || !appContainer) return { left, top };
        const playerRect = musicPlayer.getBoundingClientRect();
        const containerRect = appContainer.getBoundingClientRect();
        const maxLeft = containerRect.width - playerRect.width - 4;
        const maxTop = containerRect.height - playerRect.height - 4;
        return {
            left: Math.min(Math.max(4, left), Math.max(4, maxLeft)),
            top: Math.min(Math.max(4, top), Math.max(4, maxTop)),
        };
    }

    function beginMusicDrag(pointerEvent) {
        if (!musicPlayer || !appContainer) return;

        const containerRect = appContainer.getBoundingClientRect();
        const playerRect = musicPlayer.getBoundingClientRect();
        musicDragOffsetX = pointerEvent.clientX - playerRect.left;
        musicDragOffsetY = pointerEvent.clientY - playerRect.top;
        musicDragging = true;
        musicPlayer.classList.add("dragging");
        musicPlayer.style.left = `${playerRect.left - containerRect.left}px`;
        musicPlayer.style.top = `${playerRect.top - containerRect.top}px`;
        musicPlayer.style.right = "auto";
        musicPlayer.style.bottom = "auto";
    }

    function endMusicDrag() {
        if (!musicPlayer) return;
        musicDragging = false;
        musicPlayer.classList.remove("dragging");
        if (musicHoldTimer) {
            clearTimeout(musicHoldTimer);
            musicHoldTimer = null;
        }
        musicDragPointerId = null;
    }

    function updateMusicProgress() {
        if (!musicAudio || !musicSeek || !musicTimeCurrent || !musicTimeTotal) return;
        const duration = Number.isFinite(musicAudio.duration) ? musicAudio.duration : 0;
        const current = Number.isFinite(musicAudio.currentTime) ? musicAudio.currentTime : 0;
        musicTimeCurrent.textContent = formatMediaTime(current);
        musicTimeTotal.textContent = formatMediaTime(duration);
        musicSeek.value = duration > 0 ? String((current / duration) * 100) : "0";
    }

    function keepMusicPlayerInBounds() {
        if (!musicPlayer || musicPlayer.hidden || !appContainer) return;
        if (!musicPlayer.style.left || !musicPlayer.style.top) return;
        const currentLeft = Number.parseFloat(musicPlayer.style.left) || 0;
        const currentTop = Number.parseFloat(musicPlayer.style.top) || 0;
        const clamped = clampMusicPosition(currentLeft, currentTop);
        musicPlayer.style.left = `${clamped.left}px`;
        musicPlayer.style.top = `${clamped.top}px`;
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
        const visibleArcRaw = (percentage * arcLength * arcLeadFactor) + (percentage > 0 ? arcLeadOffset : 0);
        const visibleArc = Math.min(arcLength, Math.max(0, visibleArcRaw));
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
        floatingBtn.addEventListener("click", toggleMusicPlayer);
    }

    if (musicFab) {
        musicFab.addEventListener("click", toggleMusicPlayer);
    }

    if (musicCloseBtn && musicPlayer) {
        musicCloseBtn.addEventListener("click", () => {
            musicPlayer.hidden = true;
            syncMusicUiState();
        });
    }

    if (musicLoadBtn && musicFileInput) {
        const promptMusicImport = async () => {
            // En navegadores compatibles, permitimos seleccionar carpeta para importar toda la musica de una vez.
            if (typeof window.showDirectoryPicker === "function") {
                try {
                    const directoryHandle = await window.showDirectoryPicker({ mode: "read" });
                    const discoveredFiles = await collectAudioFilesFromDirectory(directoryHandle);
                    await appendMusicFiles(discoveredFiles);
                    return;
                } catch (error) {
                    if (error?.name !== "AbortError") {
                        console.warn("No se pudo leer la carpeta completa", error);
                    }
                }
            }

            musicFileInput.click();
        };

        musicLoadBtn.addEventListener("click", async () => {
            await promptMusicImport();
        });

        musicFileInput.addEventListener("change", async (event) => {
            const files = Array.from(event.target.files || []);
            await appendMusicFiles(files);
            musicFileInput.value = "";
        });

        if (musicReloadBtn) {
            musicReloadBtn.addEventListener("click", async () => {
                const confirmed = window.confirm("Se limpiara la musica guardada para volver a cargarla. Deseas continuar?");
                if (!confirmed) return;

                resetMusicUi();
                await clearMusicLibraryStorage();
                await promptMusicImport();
            });
        }
    }

    if (musicPlayBtn && musicAudio) {
        musicPlayBtn.addEventListener("click", () => {
            if (!musicTracks.length) {
                if (musicTrackName) {
                    musicTrackName.textContent = "Carga musica del dispositivo";
                }
                if (musicTrackArtist) musicTrackArtist.textContent = "Artista desconocido";
                if (musicTrackAlbum) musicTrackAlbum.textContent = "Album desconocido";
                setMusicCover(null, "");
                return;
            }

            if (musicAudio.paused) {
                musicAudio.play().catch(() => {
                    if (musicTrackName) {
                        musicTrackName.textContent = "Toca Play de nuevo para iniciar";
                    }
                });
            } else {
                musicAudio.pause();
            }
            syncMusicUiState();
        });
    }

    if (musicPrevBtn) {
        musicPrevBtn.addEventListener("click", () => {
            if (!musicTracks.length) return;
            playNextTrack(-1, true);
        });
    }

    if (musicNextBtn) {
        musicNextBtn.addEventListener("click", () => {
            if (!musicTracks.length) return;
            playNextTrack(1, true);
        });
    }

    if (musicShuffleBtn) {
        musicShuffleBtn.addEventListener("click", () => {
            musicShuffleEnabled = !musicShuffleEnabled;
            syncMusicOptionButtons();
        });
    }

    if (musicRepeatBtn) {
        musicRepeatBtn.addEventListener("click", () => {
            musicRepeatMode = musicRepeatMode === "all" ? "one" : "all";
            syncMusicOptionButtons();
        });
    }

    if (musicSeek && musicAudio) {
        musicSeek.addEventListener("input", () => {
            const duration = Number.isFinite(musicAudio.duration) ? musicAudio.duration : 0;
            if (!duration) return;
            const target = (Number(musicSeek.value) / 100) * duration;
            musicAudio.currentTime = target;
            updateMusicProgress();
        });
    }

    if (musicAudio) {
        musicAudio.addEventListener("timeupdate", updateMusicProgress);
        musicAudio.addEventListener("loadedmetadata", updateMusicProgress);
        musicAudio.addEventListener("play", syncMusicUiState);
        musicAudio.addEventListener("pause", syncMusicUiState);
        musicAudio.addEventListener("ended", () => {
            if (!musicTracks.length) return;

            if (musicRepeatMode === "one") {
                musicAudio.currentTime = 0;
                musicAudio.play().catch(() => {
                    syncMusicUiState();
                });
                return;
            }

            playNextTrack(1, true);
        });
    }

    if (musicPlayerHead && musicPlayer) {
        musicPlayerHead.addEventListener("pointerdown", (event) => {
            if (event.target.closest("#music-close-btn")) return;
            if (musicPlayer.hidden) return;

            musicDragPointerId = event.pointerId;
            try { musicPlayerHead.setPointerCapture(event.pointerId); } catch (_) { /* no-op */ }

            if (musicHoldTimer) clearTimeout(musicHoldTimer);
            musicHoldTimer = setTimeout(() => {
                beginMusicDrag(event);
            }, 210);
        });

        musicPlayerHead.addEventListener("pointermove", (event) => {
            if (musicDragPointerId !== event.pointerId || !musicDragging || !appContainer) return;
            const containerRect = appContainer.getBoundingClientRect();
            const left = event.clientX - containerRect.left - musicDragOffsetX;
            const top = event.clientY - containerRect.top - musicDragOffsetY;
            const clamped = clampMusicPosition(left, top);
            musicPlayer.style.left = `${clamped.left}px`;
            musicPlayer.style.top = `${clamped.top}px`;
        });

        const stopDrag = (event) => {
            if (musicDragPointerId !== null && event.pointerId !== musicDragPointerId) return;
            endMusicDrag();
        };

        musicPlayerHead.addEventListener("pointerup", stopDrag);
        musicPlayerHead.addEventListener("pointercancel", stopDrag);
        musicPlayerHead.addEventListener("pointerleave", (event) => {
            if (!musicDragging) {
                stopDrag(event);
            }
        });
    }

    if (musicPlaylist) {
        const resetPlaylistReorder = () => {
            if (playlistReorderHoldTimer) {
                clearTimeout(playlistReorderHoldTimer);
                playlistReorderHoldTimer = null;
            }
            playlistReorderActive = false;
            playlistReorderPointerId = null;
            playlistReorderFromIndex = -1;
            playlistReorderToIndex = -1;
            playlistReorderStartY = 0;
            musicPlaylist.classList.remove("reordering");
            clearPlaylistDropMarkers();
        };

        musicPlaylist.addEventListener("pointerdown", (event) => {
            const item = event.target.closest(".music-playlist-item[data-index]");
            if (!item) return;

            playlistReorderPointerId = event.pointerId;
            playlistReorderFromIndex = Number.parseInt(item.dataset.index || "-1", 10);
            playlistReorderToIndex = playlistReorderFromIndex;
            playlistReorderStartY = event.clientY;

            if (playlistReorderFromIndex < 0) {
                resetPlaylistReorder();
                return;
            }

            if (playlistReorderHoldTimer) clearTimeout(playlistReorderHoldTimer);
            playlistReorderHoldTimer = setTimeout(() => {
                playlistReorderActive = true;
                musicPlaylist.classList.add("reordering");
                setPlaylistDropTarget(playlistReorderFromIndex);
            }, 180);
        });

        musicPlaylist.addEventListener("pointermove", (event) => {
            if (playlistReorderPointerId !== event.pointerId) return;

            if (!playlistReorderActive) {
                const delta = Math.abs(event.clientY - playlistReorderStartY);
                if (delta > 10 && playlistReorderHoldTimer) {
                    clearTimeout(playlistReorderHoldTimer);
                    playlistReorderHoldTimer = null;
                    playlistReorderPointerId = null;
                }
                return;
            }

            event.preventDefault();
            const hoveredItem = document.elementFromPoint(event.clientX, event.clientY)?.closest(".music-playlist-item[data-index]");
            if (!hoveredItem) return;

            const hoveredIndex = Number.parseInt(hoveredItem.dataset.index || "-1", 10);
            if (hoveredIndex < 0 || hoveredIndex === playlistReorderToIndex) return;

            playlistReorderToIndex = hoveredIndex;
            setPlaylistDropTarget(hoveredIndex);
        });

        const handlePlaylistDrop = (event) => {
            if (playlistReorderPointerId !== null && event.pointerId !== playlistReorderPointerId) return;
            const shouldReorder = playlistReorderActive
                && playlistReorderFromIndex >= 0
                && playlistReorderToIndex >= 0
                && playlistReorderFromIndex !== playlistReorderToIndex;

            if (shouldReorder) {
                reorderMusicTracks(playlistReorderFromIndex, playlistReorderToIndex);
                suppressPlaylistClickUntil = Date.now() + 260;
            }

            resetPlaylistReorder();
        };

        musicPlaylist.addEventListener("pointerup", handlePlaylistDrop);
        musicPlaylist.addEventListener("pointercancel", handlePlaylistDrop);
        musicPlaylist.addEventListener("pointerleave", (event) => {
            if (!playlistReorderActive) {
                handlePlaylistDrop(event);
            }
        });
    }

    if (orientationBtn) {
        orientationBtn.style.display = "none";
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

    window.addEventListener("resize", () => {
        syncPanelMode();
        if (musicPlayer && !musicPlayer.hidden) {
            resetMusicPlayerPosition();
        }
        keepMusicPlayerInBounds();
    });

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
        const parts = {
            hours: String(now.getHours()).padStart(2, "0"),
            minutes: String(now.getMinutes()).padStart(2, "0"),
            seconds: String(now.getSeconds()).padStart(2, "0"),
        };

        const getChangeClass = (key) => {
            if (!previousClockParts) return "";

            const current = Number(parts[key]);
            const previous = Number(previousClockParts[key]);
            if (current === previous) return "";

            return current > previous ? "clock-part-up" : "clock-part-down";
        };

        const isMinuteHot = Number(parts.minutes) >= 50;
        const isSecondHot = Number(parts.seconds) >= 50;

        clockText.innerHTML = `
            <span class="clock-part ${getChangeClass("hours")}">${parts.hours}</span>
            <span class="clock-separator ${getChangeClass("minutes")} ${isMinuteHot ? "clock-part-hot" : ""}">:</span>
            <span class="clock-part ${getChangeClass("minutes")} ${isMinuteHot ? "clock-part-hot" : ""}">${parts.minutes}</span>
            <span class="clock-separator ${getChangeClass("seconds")} ${isSecondHot ? "clock-part-hot" : ""}">:</span>
            <span class="clock-part ${getChangeClass("seconds")} ${isSecondHot ? "clock-part-hot" : ""}">${parts.seconds}</span>
        `;

        previousClockParts = parts;
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
    setVisualMode(localStorage.getItem("speedometer_visual_mode") || "sport");
    runStartupAnimation();
    limitValue.textContent = speedLimit;
    updateInterface(0);
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
    window.addEventListener("beforeunload", () => {
        clearCurrentMusicObjectUrl();
        clearCurrentMusicCoverObjectUrl();
    });
    restorePersistedMusic().finally(() => {
        renderMusicPlaylist();
        syncMusicUiState();
    });
    syncMusicOptionButtons();
    setInterval(updateClock, 1000);
    setInterval(updateRefreshAgeLabel, 1000);
    updateClock();
    updateRefreshAgeLabel();
});
