(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const el = {
    sweepValue: $("sweepValue"), handImage: $("handImage"), ascendBox: $("ascendBox"),
    descendBox: $("descendBox"), start: $("mainStartBtn"), pause: $("pauseBtn"),
    reset: $("resetBtn"), newPatient: $("newPatientBtn"), file: $("patientFile"),
    importStatus: $("importStatus"), patientName: $("patientName"), patientMeta: $("patientMeta"),
    patientTag: $("patientTag"), ear: $("targetEar"), frequency: $("targetFrequency"),
    startLevel: $("startLevel"), stepSize: $("stepSize"), slope: $("slope"),
    slopeValue: $("slopeValue"), levelFill: $("levelTrackFill"), levelMarker: $("levelTrackMarker"),
    handTitle: $("handStateTitle"), handCopy: $("handStateCopy"), sessionStatus: $("sessionStatus"),
    count: $("presentationCount"), reversals: $("reversalCount"), lastResponse: $("lastResponse")
  };

  const FREQUENCIES = ["250", "500", "1000", "2000", "4000", "8000"];
  const MIN_LEVEL = -10;
  const MAX_LEVEL = 120;
  const PRESENTATION_MS = 700;
  const DEFAULT_PATIENT = {
    name: "Random patient", age: 35, sex: "Not specified",
    chief_compliant: "Simulated hearing threshold profile",
    right_ear: { "250": 30, "500": 35, "1000": 40, "2000": 45, "4000": 50, "8000": 55 },
    left_ear: { "250": 25, "500": 30, "1000": 35, "2000": 40, "4000": 45, "8000": 50 }
  };

  let patient = structuredCloneSafe(DEFAULT_PATIENT);
  let importedPatient = false;
  let threshold = patient.right_ear["500"];
  let level = Number(el.startLevel.value);
  let direction = 1; // 1 ascending, -1 descending
  let running = false;
  let paused = false;
  let timer = null;
  let audioContext = null;
  let oscillator = null;
  let gainNode = null;
  let points = [];
  let reversals = [];
  let previousDirection = null;
  let presentationIndex = 0;
  let lastResponseText = "—";

  function structuredCloneSafe(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function setImportStatus(message, kind = "") {
    el.importStatus.textContent = message;
    el.importStatus.className = `helper-text ${kind}`.trim();
  }

  function patientThreshold() {
    return Number(patient[el.ear.value][el.frequency.value]);
  }

  function syncPatient() {
    threshold = patientThreshold();
    el.patientName.textContent = patient.name || "Unnamed patient";
    el.patientMeta.textContent = `${patient.age ?? "Age unknown"} · ${patient.sex || "Sex not specified"} · ${el.frequency.value} Hz`;
    el.patientTag.textContent = importedPatient ? "IMPORTED" : "SIMULATED";
    el.patientMeta.title = patient.chief_compliant || "";
    renderLevel();
  }

  function renderLevel() {
    el.sweepValue.textContent = String(level);
    const percent = Math.max(0, Math.min(100, ((level - MIN_LEVEL) / (MAX_LEVEL - MIN_LEVEL)) * 100));
    el.levelFill.style.width = `${percent}%`;
    el.levelMarker.style.left = `${percent}%`;
  }

  function setDirection(nextDirection) {
    direction = nextDirection;
    el.ascendBox.classList.toggle("active", direction === 1);
    el.descendBox.classList.toggle("active", direction === -1);
    if (direction === 1) {
      el.handImage.src = "./images/releasing.png";
      el.handImage.alt = "Hand releasing the response button";
      el.handTitle.textContent = "Releasing the button";
      el.handCopy.textContent = "The listener is not detecting the tone on this step.";
    } else {
      el.handImage.src = "./images/holding.png";
      el.handImage.alt = "Hand holding the response button";
      el.handTitle.textContent = "Holding the button";
      el.handCopy.textContent = "The listener detects the tone and keeps the button pressed.";
    }
  }

  function psychometricProbability(stimulusLevel) {
    // Logistic psychometric function. The hidden threshold is the 50% point.
    const spread = Math.max(0.1, Number(el.slope.value));
    const z = Math.max(-30, Math.min(30, (stimulusLevel - threshold) / spread));
    return 1 / (1 + Math.exp(-z));
  }

  function simulateResponse(stimulusLevel) {
    return Math.random() < psychometricProbability(stimulusLevel);
  }

  function ensureAudio() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      setImportStatus("Web Audio is not supported in this browser; the visual simulation can still run.", "error");
      return;
    }
    if (!audioContext || audioContext.state === "closed") {
      audioContext = new AudioContextClass();
      oscillator = audioContext.createOscillator();
      gainNode = audioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 500;
      gainNode.gain.value = 0;
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.start();
    }
    if (audioContext.state === "suspended") audioContext.resume();
    setSoundLevel(level);
  }

  function setSoundLevel(dbHL) {
    if (!gainNode || !audioContext || audioContext.state === "closed") return;
    // This is a demonstration mapping only, not calibrated dB HL output.
    const normalized = 0.2 * Math.pow(10, ((dbHL - 70) * 0.25) / 20);
    const gain = Math.max(0, Math.min(0.7, normalized));
    gainNode.gain.setTargetAtTime(gain, audioContext.currentTime, 0.025);
  }

  function silenceAudio() {
    if (gainNode && audioContext && audioContext.state !== "closed") {
      gainNode.gain.setTargetAtTime(0, audioContext.currentTime, 0.02);
    }
  }

  function closeAudio() {
    silenceAudio();
    if (audioContext && audioContext.state !== "closed") {
      const oldContext = audioContext;
      setTimeout(() => oldContext.close().catch(() => {}), 80);
    }
    audioContext = oscillator = gainNode = null;
  }

  function drawPlot() {
    if (!window.Plotly) return;
    const x = points.map((p) => p.time);
    const y = points.map((p) => p.level);
    const markers = points.map((p) => p.detected ? "#4f745a" : "#a35f54");
    Plotly.react("plot", [
      {
        x, y, type: "scatter", mode: "lines+markers", name: "Stimulus level",
        line: { color: "#77765e", width: 2.5, shape: "linear" },
        marker: { color: markers, size: 8, line: { color: "#fffefa", width: 1.5 } },
        hovertemplate: "Step %{x}<br>%{y} dB HL<extra></extra>"
      },
      {
        x: reversals.map((p) => p.time), y: reversals.map((p) => p.level),
        type: "scatter", mode: "markers", name: "Reversal",
        marker: { color: "#292b25", size: 10, symbol: "diamond" },
        hovertemplate: "Reversal<br>%{y} dB HL<extra></extra>"
      }
    ], {
      margin: { l: 48, r: 16, t: 15, b: 40 },
      paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
      font: { family: "Inter, system-ui, sans-serif", color: "#77786e", size: 10 },
      showlegend: false,
      xaxis: { title: { text: "Presentation", font: { size: 10 } }, rangemode: "tozero", dtick: 2, gridcolor: "#ebe9e1", zeroline: false },
      yaxis: { title: { text: "Intensity (dB HL)", font: { size: 10 } }, range: [MIN_LEVEL, MAX_LEVEL], dtick: 20, gridcolor: "#ebe9e1", zeroline: false },
      hoverlabel: { bgcolor: "#fffefa", bordercolor: "#e2dfd5", font: { color: "#292b25" } }
    }, { responsive: true, displaylogo: false, modeBarButtonsToRemove: ["lasso2d", "select2d"] });
  }

  function updateStats() {
    el.count.textContent = String(points.length);
    el.reversals.textContent = String(reversals.length);
    el.lastResponse.textContent = lastResponseText;
  }

  function resetSession({ keepLevel = true } = {}) {
    stopTimer();
    running = false;
    paused = false;
    if (!keepLevel) level = Number(el.startLevel.value);
    points = [];
    reversals = [];
    presentationIndex = 0;
    previousDirection = null;
    lastResponseText = "—";
    renderLevel();
    setDirection(1);
    el.sessionStatus.textContent = "READY";
    el.start.disabled = false;
    el.start.innerHTML = '<span aria-hidden="true">▶</span> Start sweep';
    el.pause.disabled = true;
    el.pause.textContent = "Pause";
    silenceAudio();
    drawPlot();
    updateStats();
  }

  function stopTimer() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }

  function presentStep() {
    if (!running || paused) return;
    const detected = simulateResponse(level);
    const nextDirection = detected ? -1 : 1;
    lastResponseText = detected ? "Detected" : "Not detected";
    setDirection(nextDirection);
    const point = { time: presentationIndex + 1, level, detected };
    points.push(point);
    if (previousDirection !== null && nextDirection !== previousDirection) {
      reversals.push({ time: point.time, level: point.level });
    }
    previousDirection = nextDirection;
    presentationIndex += 1;
    updateStats();
    drawPlot();

    level += nextDirection * Number(el.stepSize.value);
    level = Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, level));
    renderLevel();
    setSoundLevel(level);

    if (level === MIN_LEVEL || level === MAX_LEVEL) {
      stopTimer();
      running = false;
      paused = false;
      silenceAudio();
      el.sessionStatus.textContent = "LIMIT REACHED";
      el.start.disabled = false;
      el.start.innerHTML = '<span aria-hidden="true">▶</span> Start sweep';
      el.pause.disabled = true;
      return;
    }
    timer = setTimeout(presentStep, PRESENTATION_MS);
  }

  function startSweep() {
    if (running && paused) {
      paused = false;
      el.pause.textContent = "Pause";
      el.sessionStatus.textContent = "RUNNING";
      timer = setTimeout(presentStep, 250);
      setSoundLevel(level);
      return;
    }
    if (running) return;
    if (!points.length) {
      level = Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, Number(el.startLevel.value) || 70));
      renderLevel();
    }
    ensureAudio();
    running = true;
    paused = false;
    el.sessionStatus.textContent = "RUNNING";
    el.start.disabled = true;
    el.start.innerHTML = '<span aria-hidden="true">●</span> Sweep running';
    el.pause.disabled = false;
    timer = setTimeout(presentStep, 250);
  }

  function pauseSweep() {
    if (!running) return;
    if (!paused) {
      paused = true;
      stopTimer();
      silenceAudio();
      el.pause.textContent = "Resume";
      el.sessionStatus.textContent = "PAUSED";
    } else {
      paused = false;
      el.pause.textContent = "Pause";
      el.sessionStatus.textContent = "RUNNING";
      setSoundLevel(level);
      timer = setTimeout(presentStep, 250);
    }
  }

  function validatePatient(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("The JSON root must be a patient object.");
    if (typeof data.name !== "string" || !data.name.trim()) throw new Error('Patient field "name" must be a non-empty string.');
    for (const ear of ["right_ear", "left_ear"]) {
      if (!data[ear] || typeof data[ear] !== "object") throw new Error(`Missing "${ear}" threshold object.`);
      for (const freq of FREQUENCIES) {
        const value = data[ear][freq];
        if (typeof value !== "number" || !Number.isFinite(value) || value < MIN_LEVEL || value > MAX_LEVEL) {
          throw new Error(`"${ear}" must contain a numeric ${freq} Hz threshold between ${MIN_LEVEL} and ${MAX_LEVEL} dB HL.`);
        }
      }
    }
    if (data.age !== undefined && (!Number.isFinite(Number(data.age)) || Number(data.age) < 0)) {
      throw new Error('"age" must be a non-negative number when provided.');
    }
    return {
      name: data.name.trim(),
      age: data.age === undefined ? "Unknown age" : Number(data.age),
      sex: typeof data.sex === "string" ? data.sex : "Not specified",
      chief_compliant: typeof data.chief_compliant === "string" ? data.chief_compliant : "",
      right_ear: Object.fromEntries(FREQUENCIES.map((f) => [f, data.right_ear[f]])),
      left_ear: Object.fromEntries(FREQUENCIES.map((f) => [f, data.left_ear[f]]))
    };
  }

  async function importPatientFile(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      patient = validatePatient(parsed);
      importedPatient = true;
      syncPatient();
      resetSession({ keepLevel: false });
      setImportStatus(`Loaded ${patient.name}. Thresholds are ready for the selected ear and frequency.`, "success");
    } catch (error) {
      setImportStatus(`Could not import patient: ${error.message}`, "error");
    } finally {
      el.file.value = "";
    }
  }

  function generateRandomPatient() {
    const makeEar = () => Object.fromEntries(FREQUENCIES.map((f) => {
      const base = Math.round((Math.random() * 55) / 5) * 5;
      return [f, base];
    }));
    const newProfile = {
      name: `Random patient ${Math.floor(100 + Math.random() * 900)}`,
      age: Math.floor(18 + Math.random() * 60),
      sex: Math.random() < 0.5 ? "Female" : "Male",
      chief_compliant: "Simulated hearing threshold profile",
      right_ear: makeEar(), left_ear: makeEar()
    };
    patient = validatePatient(newProfile);
    importedPatient = false;
    syncPatient();
    resetSession({ keepLevel: false });
    setImportStatus("Generated a new random patient profile.", "success");
  }

  function initializePlot() {
    if (!window.Plotly) {
      $("plot").innerHTML = '<p class="helper-text">Plotly could not load. Check your internet connection and refresh.</p>';
      return;
    }
    drawPlot();
  }

  el.file.addEventListener("change", (event) => importPatientFile(event.target.files[0]));
  el.ear.addEventListener("change", () => { syncPatient(); resetSession({ keepLevel: false }); });
  el.frequency.addEventListener("change", () => { syncPatient(); resetSession({ keepLevel: false }); });
  el.stepSize.addEventListener("change", () => { if (running) pauseSweep(); });
  el.slope.addEventListener("input", () => { el.slopeValue.textContent = Number(el.slope.value).toFixed(1); });
  el.start.addEventListener("click", startSweep);
  el.pause.addEventListener("click", pauseSweep);
  el.reset.addEventListener("click", () => resetSession({ keepLevel: false }));
  el.newPatient.addEventListener("click", generateRandomPatient);
  el.startLevel.addEventListener("change", () => {
    if (!running && !points.length) {
      level = Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, Number(el.startLevel.value) || 70));
      el.startLevel.value = level;
      renderLevel();
      setSoundLevel(level);
    }
  });
  window.addEventListener("beforeunload", closeAudio);

  setDirection(1);
  syncPatient();
  initializePlot();
  updateStats();
})();