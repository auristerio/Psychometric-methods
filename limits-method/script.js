(() => {
  "use strict";

  const MIN_LEVEL = -10;
  const MAX_LEVEL = 120;
  const FREQUENCIES = ["250", "500", "1000", "2000", "4000", "8000"];
  const LOGISTIC_SCALE = 0.9;

  const state = {
    patient: null,
    patientSource: null,
    selectedEar: "right_ear",
    selectedFrequency: "1000",
    stepSize: 5,
    stimulusLevel: 0,
    direction: "ascending",
    currentRun: null,
    runs: [],
    nextRunId: 1,
    estimates: Array(5).fill(""),
    lastResponse: null,
    presenting: false
  };

  const $ = (id) => document.getElementById(id);
  const els = {
    patientName: $("patientName"), patientAge: $("patientAge"), patientSex: $("patientSex"),
    patientComplaint: $("patientComplaint"), patientBadge: $("patientBadge"), patientMessage: $("patientMessage"),
    importButton: $("importButton"), randomButton: $("randomButton"), patientFile: $("patientFile"),
    targetEar: $("targetEar"), targetFrequency: $("targetFrequency"), stepSize: $("stepSize"),
    runDirection: $("runDirection"), startLevel: $("startLevel"), startRunButton: $("startRunButton"),
    currentRunNumber: $("currentRunNumber"), currentRunDirection: $("currentRunDirection"),
    presentationCount: $("presentationCount"), runStatus: $("runStatus"), runStatusDot: $("runStatusDot"),
    historyCount: $("historyCount"), historyBody: $("historyBody"), previousRuns: $("previousRuns"),
    stimulusEar: $("stimulusEar"), stimulusFrequency: $("stimulusFrequency"), stimulusLevel: $("stimulusLevel"),
    minusButton: $("minusButton"), plusButton: $("plusButton"), presentButton: $("presentButton"),
    positiveIndicator: $("positiveIndicator"), negativeIndicator: $("negativeIndicator"),
    responseMessage: $("responseMessage"), estimateBody: $("estimateBody"), completedCount: $("completedCount"),
    meanValue: $("meanValue"), resetTableButton: $("resetTableButton"), estimateMessage: $("estimateMessage")
  };

  function validatePatient(patient) {
    if (!patient || typeof patient !== "object" || Array.isArray(patient)) {
      throw new Error("The JSON root must be a patient object.");
    }
    for (const field of ["name", "age", "sex", "chief_compliant"]) {
      if (!(field in patient) || patient[field] === null || String(patient[field]).trim() === "") {
        throw new Error(`Missing or empty required field: "${field}".`);
      }
    }
    if (typeof patient.name !== "string" || typeof patient.sex !== "string" ||
      typeof patient.chief_compliant !== "string" ||
      typeof patient.age !== "number" || !Number.isFinite(patient.age) || patient.age < 0) {
      throw new Error("Demographics must use a string name, numeric age, string sex, and string chief_compliant.");
    }
    for (const ear of ["right_ear", "left_ear"]) {
      if (!patient[ear] || typeof patient[ear] !== "object" || Array.isArray(patient[ear])) {
        throw new Error(`Missing or invalid "${ear}" object.`);
      }
      for (const frequency of FREQUENCIES) {
        const value = patient[ear][frequency];
        if (typeof value !== "number" || !Number.isFinite(value) || value < MIN_LEVEL) {
          throw new Error(`"${ear}.${frequency}" must be a numeric threshold more than ${MIN_LEVEL} dB HL.`);
        }
      }
    }
    return patient;
  }

  function simulateResponse(stimulusLevel, threshold) {
    const probability = 1 / (1 + Math.exp(-(stimulusLevel - threshold) / LOGISTIC_SCALE));
    return Math.random() < probability;
  }

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function smoothProfile(base, slope, notch = null) {
    return FREQUENCIES.map((frequency, index) => {
      let value = base + slope * index + randomInt(-5, 5);
      if (notch && frequency === notch.frequency) value += notch.amount;
      return clamp(Math.round(value / 5) * 5, -10, 120);
    });
  }

  function generateRandomPatient() {
    const profiles = ["normal", "conductive", "sensorineural", "mixed"];
    const profile = profiles[randomInt(0, profiles.length - 1)];
    const firstNames = ["Alice", "Jordan", "Sam", "Morgan", "Taylor", "Riley", "Casey", "Alex", "Jamie", "Robin"];
    const surnames = ["Morgan", "Reed", "Hayes", "Brooks", "Patel", "Carter", "Kim", "Bennett", "Rivera", "Shaw"];
    const name = `${firstNames[randomInt(0, firstNames.length - 1)]} ${surnames[randomInt(0, surnames.length - 1)]}`;
    const age = randomInt(18, 76);
    const sex = ["Female", "Male"][randomInt(0, 1)];
    let right, left, complaint;

    if (profile === "normal") {
      const base = randomInt(-5, 10);
      right = smoothProfile(base, randomInt(0, 2));
      left = smoothProfile(base + randomInt(-5, 5), randomInt(0, 2));
      complaint = "Routine hearing assessment; no specific hearing concern reported.";
    } else if (profile === "conductive") {
      const base = randomInt(25, 40);
      right = smoothProfile(base, randomInt(-1, 2));
      left = smoothProfile(base + randomInt(-10, 10), randomInt(-1, 2));
      complaint = "Reports muffled hearing and difficulty hearing softer sounds.";
    } else if (profile === "sensorineural") {
      const base = randomInt(15, 35);
      right = smoothProfile(base, randomInt(4, 8), Math.random() < 0.3 ? { frequency: "4000", amount: 15 } : null);
      left = smoothProfile(base + randomInt(-10, 10), randomInt(3, 7), Math.random() < 0.3 ? { frequency: "4000", amount: 15 } : null);
      complaint = "Reports difficulty understanding speech, especially in noisy environments.";
    } else {
      const base = randomInt(30, 45);
      right = smoothProfile(base, randomInt(3, 6));
      left = smoothProfile(base + randomInt(-10, 10), randomInt(3, 6));
      complaint = "Reports reduced hearing clarity and difficulty following conversation.";
    }

    const makeEar = (values) => Object.fromEntries(FREQUENCIES.map((f, i) => [f, values[i]]));
    return validatePatient({
      name, age, sex, chief_compliant: complaint,
      right_ear: makeEar(right),
      left_ear: makeEar(left)
    });
  }

  function confirmSessionChange(message) {
    if (state.runs.length === 0 && !state.currentRun) return true;
    return window.confirm(`${message}\n\nExisting run histories and estimates will be preserved. Continue?`);
  }

  function setPatient(patient, source) {
    if (!confirmSessionChange("Changing the patient will end the current run and start a new patient session.")) return false;
    state.patient = patient;
    state.patientSource = source;
    state.currentRun = null;
    state.lastResponse = null;
    state.stimulusLevel = 0;
    state.runs = [];
    state.nextRunId = 1;
    state.estimates = Array(5).fill("");
    renderAll();
    showPatientMessage(source === "random" ? "Synthetic patient generated." : "Patient imported successfully.", true);
    return true;
  }

  function showPatientMessage(message, success = false) {
    els.patientMessage.textContent = message;
    els.patientMessage.classList.toggle("success", success);
  }

  function renderPatient() {
    const p = state.patient;
    els.patientName.textContent = p ? p.name : "No patient loaded";
    els.patientAge.textContent = p ? `${p.age} years` : "—";
    els.patientSex.textContent = p ? p.sex : "—";
    els.patientComplaint.textContent = p ? p.chief_compliant : "Import a JSON patient or generate a synthetic patient to begin.";
    els.patientBadge.textContent = p ? (state.patientSource === "random" ? "Synthetic" : "Loaded") : "Awaiting patient";
    els.patientBadge.className = `badge ${p ? "loaded" : "muted"}`;
  }

  function renderStimulus() {
    els.stimulusLevel.textContent = state.stimulusLevel;
    els.stimulusEar.textContent = state.selectedEar === "right_ear" ? "Right ear" : "Left ear";
    els.stimulusFrequency.textContent = `${state.selectedFrequency} Hz`;
    els.minusButton.disabled = state.stimulusLevel <= MIN_LEVEL;
    els.plusButton.disabled = state.stimulusLevel >= MAX_LEVEL;
    els.presentButton.disabled = !state.patient || !state.currentRun || state.currentRun.status !== "active" || state.presenting;
  }

  function renderRun() {
    const run = state.currentRun;
    els.currentRunNumber.textContent = run ? `#${run.id}` : "—";
    els.currentRunDirection.textContent = run ? capitalize(run.direction) : "—";
    els.presentationCount.textContent = run ? run.presentations.length : "0";
    els.runStatus.textContent = run ? (run.status === "active" ? "Active — ready for presentation" : "Completed") : "No active run";
    els.runStatusDot.classList.toggle("active", Boolean(run && run.status === "active"));
    els.historyCount.textContent = `${run ? run.presentations.length : 0} entries`;
    els.historyBody.replaceChildren();
    if (!run || run.presentations.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 5;
      td.className = "empty-cell";
      td.textContent = run ? "No presentations in this run yet." : "Start a run and present a stimulus to populate history.";
      tr.append(td);
      els.historyBody.append(tr);
    } else {
      [...run.presentations].reverse().forEach((entry) => {
        const tr = document.createElement("tr");
        const values = [entry.number, entry.stimulusLevel, entry.ear === "right_ear" ? "Right" : "Left", entry.frequency, null];
        values.slice(0, 4).forEach((value) => {
          const td = document.createElement("td"); td.textContent = value; tr.append(td);
        });
        const responseCell = document.createElement("td");
        const tag = document.createElement("span");
        tag.className = `response-tag ${entry.positive ? "yes" : "no"}`;
        tag.textContent = entry.positive ? "Positive" : "Negative";
        responseCell.append(tag); tr.append(responseCell); els.historyBody.append(tr);
      });
    }
    renderPreviousRuns();
  }

  function renderPreviousRuns() {
    els.previousRuns.replaceChildren();
    const previous = state.runs.filter((run) => run !== state.currentRun);
    if (!previous.length) {
      const p = document.createElement("p"); p.className = "empty-note"; p.textContent = "No previous runs.";
      els.previousRuns.append(p); return;
    }
    previous.slice().reverse().forEach((run) => {
      const details = document.createElement("details"); details.className = "previous-run-item";
      const summary = document.createElement("summary");
      summary.textContent = `Run #${run.id} · ${capitalize(run.direction)} · ${run.ear === "right_ear" ? "Right" : "Left"} ${run.frequency} Hz · ${run.presentations.length} presentations`;
      const p = document.createElement("p");
      p.textContent = run.presentations.length
        ? run.presentations.map((entry) => `${entry.stimulusLevel} dB HL: ${entry.positive ? "Positive" : "Negative"}`).join("  ·  ")
        : "No presentations recorded.";
      details.append(summary, p); els.previousRuns.append(details);
    });
  }

  function renderResponse() {
    els.positiveIndicator.classList.toggle("active", state.lastResponse === true);
    els.negativeIndicator.classList.toggle("active", state.lastResponse === false);
    if (state.lastResponse === true) els.responseMessage.textContent = "Positive response — the patient detected the tone.";
    else if (state.lastResponse === false) els.responseMessage.textContent = "Negative response — the patient did not detect the tone.";
    else els.responseMessage.textContent = "No presentation yet.";
  }

  function renderEstimates() {
    els.estimateBody.replaceChildren();
    state.estimates.forEach((value, index) => {
      const tr = document.createElement("tr");
      const label = document.createElement("td"); label.textContent = `Run #${index + 1}`;
      const cell = document.createElement("td");
      const input = document.createElement("input");
      input.type = "number"; input.min = String(MIN_LEVEL); input.max = String(MAX_LEVEL);
      input.step = "any"; input.inputMode = "decimal"; input.value = value;
      input.setAttribute("aria-label", `Estimated threshold for run ${index + 1} in dB HL`);
      input.dataset.estimateIndex = String(index);
      input.addEventListener("input", () => {
        const raw = input.value;
        if (raw === "") {
          state.estimates[index] = "";
          input.removeAttribute("aria-invalid");
          els.estimateMessage.textContent = "";
        } else {
          const number = Number(raw);
          if (!Number.isFinite(number) || number < MIN_LEVEL || number > MAX_LEVEL) {
            input.setAttribute("aria-invalid", "true");
            els.estimateMessage.textContent = `Enter a numeric value from ${MIN_LEVEL} to ${MAX_LEVEL} dB HL, or leave the field empty.`;
            state.estimates[index] = raw;
            updateEstimateSummary();
            return;
          }
          state.estimates[index] = String(number);
          input.removeAttribute("aria-invalid");
          els.estimateMessage.textContent = "";
        }
        updateEstimateSummary();
      });
      cell.append(input); tr.append(label, cell); els.estimateBody.append(tr);
    });
    updateEstimateSummary();
  }

  function updateEstimateSummary() {
    const valid = state.estimates
      .filter((value) => value !== "" && value.trim() !== "")
      .map(Number)
      .filter((value) => Number.isFinite(value) && value >= MIN_LEVEL && value <= MAX_LEVEL);
    els.completedCount.textContent = `${valid.length}/5`;
    if (!valid.length) {
      els.meanValue.innerHTML = `— <small>dB HL</small>`;
    } else {
      const mean = valid.reduce((sum, value) => sum + value, 0) / valid.length;
      els.meanValue.innerHTML = `${Number(mean.toFixed(2))} <small>dB HL</small>`;
    }
  }

  function renderAll() {
    renderPatient();
    renderStimulus();
    renderRun();
    renderResponse();
    renderEstimates();
  }

  function startRun() {
    if (!state.patient) {
      showPatientMessage("Import or generate a patient before starting a run.");
      return;
    }
    const rawLevel = els.startLevel.value;
    const level = Number(rawLevel);
    if (rawLevel.trim() === "" || !Number.isFinite(level) || level < MIN_LEVEL || level > MAX_LEVEL) {
      showPatientMessage(`Starting stimulus must be between ${MIN_LEVEL} and ${MAX_LEVEL} dB HL.`);
      els.startLevel.focus();
      return;
    }
    if (state.currentRun && state.currentRun.status === "active" && state.currentRun.presentations.length > 0) {
      const ok = window.confirm("Starting a new run will close the active run. Its history will be retained. Continue?");
      if (!ok) return;
      state.currentRun.status = "completed";
    }
    const run = {
      id: state.nextRunId++,
      direction: els.runDirection.value,
      ear: state.selectedEar,
      frequency: state.selectedFrequency,
      status: "active",
      presentations: []
    };
    state.currentRun = run;
    state.runs.push(run);
    state.direction = run.direction;
    state.stimulusLevel = level;
    state.lastResponse = null;
    showPatientMessage("");
    renderStimulus(); renderRun(); renderResponse();
  }

  function adjustStimulus(delta) {
    state.stimulusLevel = clamp(state.stimulusLevel + delta, MIN_LEVEL, MAX_LEVEL);
    renderStimulus();
  }

  function presentStimulus() {
    if (state.presenting || !state.patient || !state.currentRun || state.currentRun.status !== "active") return;
    const run = state.currentRun;
    if (run.ear !== state.selectedEar || run.frequency !== state.selectedFrequency) {
      window.alert("The selected ear or frequency does not match this run. Start a new run for the new configuration.");
      return;
    }
    state.presenting = true;
    els.presentButton.disabled = true;
    try {
      const threshold = state.patient[state.selectedEar][state.selectedFrequency];
      const positive = simulateResponse(state.stimulusLevel, threshold);
      const entry = {
        number: run.presentations.length + 1,
        stimulusLevel: state.stimulusLevel,
        ear: state.selectedEar,
        frequency: state.selectedFrequency,
        direction: run.direction,
        positive
      };
      run.presentations.push(entry);
      state.lastResponse = positive;
    } finally {
      state.presenting = false;
    }
    renderRun(); renderResponse(); renderStimulus();
  }

  function changeConfiguration() {
    const newEar = els.targetEar.value;
    const newFrequency = els.targetFrequency.value;
    if (state.currentRun && state.currentRun.status === "active" &&
      (newEar !== state.currentRun.ear || newFrequency !== state.currentRun.frequency)) {
      const accepted = window.confirm("Changing ear or frequency will close the active run. Its history will be retained. Continue?");
      if (!accepted) {
        els.targetEar.value = state.currentRun.ear;
        els.targetFrequency.value = state.currentRun.frequency;
        return;
      }
      state.currentRun.status = "completed";
      state.currentRun = null;
      state.lastResponse = null;
    }
    state.selectedEar = newEar;
    state.selectedFrequency = newFrequency;
    renderStimulus(); renderRun(); renderResponse();
  }

  function resetEstimateTable() {
    if (!window.confirm("Clear all 5 student threshold estimates? Patient data and run histories will be preserved.")) return;
    state.estimates = Array(5).fill("");
    els.estimateMessage.textContent = "";
    renderEstimates();
  }

  async function importPatientFile(file) {
    if (!file) return;
    try {
      const text = await file.text();
      let parsed;
      try { parsed = JSON.parse(text); }
      catch { throw new Error("The selected file is not valid JSON. Check its syntax and try again."); }
      const patient = validatePatient(parsed);
      setPatient(patient, "import");
    } catch (error) {
      showPatientMessage(error instanceof Error ? error.message : "Could not import this patient file.");
    } finally {
      els.patientFile.value = "";
    }
  }

  function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function attachEvents() {
    els.importButton.addEventListener("click", () => els.patientFile.click());
    els.patientFile.addEventListener("change", (event) => importPatientFile(event.target.files[0]));
    els.randomButton.addEventListener("click", () => {
      try {
        const patient = generateRandomPatient();
        setPatient(patient, "random");
      } catch {
        showPatientMessage("Unable to generate a synthetic patient. Please try again.");
      }
    });
    els.targetEar.addEventListener("change", changeConfiguration);
    els.targetFrequency.addEventListener("change", changeConfiguration);
    els.stepSize.addEventListener("change", () => {
      state.stepSize = Number(els.stepSize.value);
    });
    els.startRunButton.addEventListener("click", startRun);
    els.minusButton.addEventListener("click", () => adjustStimulus(-state.stepSize));
    els.plusButton.addEventListener("click", () => adjustStimulus(state.stepSize));
    els.presentButton.addEventListener("click", presentStimulus);
    els.resetTableButton.addEventListener("click", resetEstimateTable);
  }

  attachEvents();
  renderAll();
})();
