(() => {
  'use strict';

  const FREQUENCIES = ['250', '500', '1000', '2000', '4000', '8000'];
  const DEMO_PATIENT = {
    name: 'Demo Patient', age: 35, sex: 'Female',
    chief_compliant: 'Demonstration case for practicing the Method of Constant Stimuli.',
    right_ear: { '250': 0, '500': 2, '1000': 5, '2000': 6, '4000': 8, '8000': 10 },
    left_ear: { '250': 0, '500': 1, '1000': 3, '2000': 5, '4000': 7, '8000': 9 }
  };

  const $ = (id) => document.getElementById(id);
  const samples = Array.from({ length: 8 }, (_, i) => $(`slm${i + 1}`));
  const els = {
    patientName: $('patientName'), patientDetails: $('patientDetails'), chiefComplaint: $('chiefComplaint'),
    patientStatus: $('patientStatus'), patientFile: $('patientFile'), targetEar: $('targetEar'),
    targetFrequency: $('targetFrequency'), presentTimes: $('presentTimes'), presentBtn: $('presentBtn'),
    resetBtn: $('resetBtn'), loadDemoBtn: $('loadDemoBtn'), resultsBody: $('resultsBody'),
    message: $('message'), interpretation: $('interpretation')
  };

  let patient = structuredCloneSafe(DEMO_PATIENT);
  let isDemo = true;
  let results = [];
  const PSYCHOMETRIC_K = 0.7;
  const HARD_CUTOFF_DISTANCE = 5;

  function structuredCloneSafe(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function showMessage(text, type) {
    els.message.textContent = text;
    els.message.className = `message ${type || ''}`;
    els.message.hidden = false;
  }

  function clearMessage() {
    els.message.hidden = true;
    els.message.textContent = '';
    els.message.className = 'message';
  }

  function getThreshold() {
    const ear = els.targetEar.value;
    const frequency = els.targetFrequency.value;
    return Number(patient[ear][frequency]);
  }

  function renderPatient() {
    els.patientName.textContent = patient.name;
    els.patientDetails.textContent = `${patient.age} years · ${patient.sex}`;
    els.chiefComplaint.textContent = patient.chief_compliant || 'No chief complaint provided.';
    els.patientStatus.textContent = isDemo ? 'Demo mode' : 'JSON patient loaded';
    els.patientStatus.classList.toggle('loaded', !isDemo);
    clearMessage();
    resetResults();
  }

  function validatePatient(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('The JSON file must contain one patient object.');
    for (const field of ['name', 'age', 'sex', 'right_ear', 'left_ear']) {
      if (!(field in data)) throw new Error(`Missing required field: "${field}".`);
    }
    if (typeof data.name !== 'string' || !data.name.trim()) throw new Error('Patient "name" must be a non-empty string.');
    if (!Number.isFinite(Number(data.age)) || Number(data.age) < 0) throw new Error('Patient "age" must be a valid non-negative number.');
    if (typeof data.sex !== 'string' || !data.sex.trim()) throw new Error('Patient "sex" must be a non-empty string.');
    for (const ear of ['right_ear', 'left_ear']) {
      if (!data[ear] || typeof data[ear] !== 'object' || Array.isArray(data[ear])) throw new Error(`"${ear}" must be an object of frequency thresholds.`);
      for (const frequency of FREQUENCIES) {
        if (!(frequency in data[ear]) || data[ear][frequency] === '' || !Number.isFinite(Number(data[ear][frequency]))) {
          throw new Error(`Missing or invalid ${ear} threshold at ${frequency} Hz.`);
        }
      }
    }
    return {
      name: data.name.trim(), age: Number(data.age), sex: data.sex.trim(),
      chief_compliant: typeof data.chief_compliant === 'string' ? data.chief_compliant : '',
      right_ear: Object.fromEntries(FREQUENCIES.map(f => [f, Number(data.right_ear[f])])),
      left_ear: Object.fromEntries(FREQUENCIES.map(f => [f, Number(data.left_ear[f])]))
    };
  }

  function responseProbability(level, threshold) {
    if (level <= threshold - HARD_CUTOFF_DISTANCE) return 0;
    if (level >= threshold + HARD_CUTOFF_DISTANCE) return 1;
    return 1 / (1 + Math.exp(-PSYCHOMETRIC_K * (level - threshold)));
  }

  function checkResponse(level, threshold) {
    return Math.random() <= responseProbability(level, threshold) ? 1 : 0;
  }

  function getLevels() {
    const levels = samples.map((input, index) => {
      const value = Number(input.value);
      if (input.value.trim() === '' || !Number.isFinite(value)) throw new Error(`Enter a valid number for stimulus level ${index + 1}.`);
      return value;
    });
    return levels;
  }

  function getPresentations() {
    const value = Number(els.presentTimes.value);
    if (!Number.isInteger(value) || value < 1 || value > 100) throw new Error('Presentations per level must be a whole number from 1 to 100.');
    return value;
  }

  function renderTable(levels, n, counts) {
    els.resultsBody.replaceChildren();
    levels.forEach((level, i) => {
      const tr = document.createElement('tr');
      const values = [level, n, counts ? `${counts[i]} / ${n}` : `— / ${n}`, counts ? `${Math.round(counts[i] / n * 100)}%` : '—'];
      values.forEach(value => {
        const td = document.createElement('td');
        td.textContent = String(value);
        tr.appendChild(td);
      });
      els.resultsBody.appendChild(tr);
    });
  }

  function plotData(levels, percentages) {
    if (!window.Plotly) {
      $('plot').textContent = 'The chart library could not load. Check your internet connection to view the plot.';
      return;
    }
    const sorted = levels.map((level, i) => ({ level, percentage: percentages[i], index: i })).sort((a, b) => a.level - b.level || a.index - b.index);
    Plotly.react('plot', [{
      x: sorted.map(item => item.level), y: sorted.map(item => item.percentage),
      type: 'scatter', mode: 'lines+markers',
      line: { color: '#77735d', width: 2 },
      marker: { color: '#4f503f', size: 7 },
      hovertemplate: 'Level: %{x} dB HL<br>Positive: %{y:.0f}%<extra></extra>'
    }], {
      margin: { l: 48, r: 15, t: 10, b: 48 },
      paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
      font: { family: 'Inter, system-ui, sans-serif', size: 10, color: '#77786d' },
      xaxis: { title: { text: 'Stimulus level (dB HL)', font: { size: 11 } }, gridcolor: '#e5e3da', zeroline: false, automargin: true },
      yaxis: { title: { text: 'Positive responses (%)', font: { size: 11 } }, range: [0, 105], dtick: 25, gridcolor: '#e5e3da', zeroline: false, automargin: true },
      showlegend: false
    }, { displayModeBar: false, responsive: true });
  }

  function resetResults() {
    results = [];
    const levels = samples.map(input => Number(input.value));
    renderTable(levels, Math.max(1, Number(els.presentTimes.value) || 5), null);
    plotData(levels, levels.map(() => 0));
    els.interpretation.textContent = 'Present the stimulus set to populate the response table and plot.';
  }

  function runExperiment() {
    clearMessage();
    try {
      const levels = getLevels();
      const n = getPresentations();
      const threshold = getThreshold();
      const counts = levels.map(level => {
        let heard = 0;
        for (let trial = 0; trial < n; trial++) heard += checkResponse(level, threshold);
        return heard;
      });
      const percentages = counts.map(count => count / n * 100);
      results = levels.map((level, i) => ({ level, presentations: n, heard: counts[i], percentage: percentages[i] }));
      renderTable(levels, n, counts);
      plotData(levels, percentages);
      const total = counts.reduce((sum, count) => sum + count, 0);
      const totalTrials = n * levels.length;
      els.interpretation.textContent = `Across ${totalTrials} presentations, ${total} responses were positive (${Math.round(total / totalTrials * 100)}%). Compare the response percentages across levels to observe the transition from rarely heard to consistently heard.`;
    } catch (error) {
      showMessage(error.message, 'error');
    }
  }

  els.patientFile.addEventListener('change', async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      patient = validatePatient(parsed);
      isDemo = false;
      renderPatient();
      showMessage(`Loaded ${patient.name}. Select an ear and frequency to use that threshold in the simulation.`, 'success');
    } catch (error) {
      showMessage(`Could not load patient JSON: ${error instanceof SyntaxError ? 'the file is not valid JSON.' : error.message}`, 'error');
    } finally {
      event.target.value = '';
    }
  });

  els.targetEar.addEventListener('change', resetResults);
  els.targetFrequency.addEventListener('change', resetResults);
  samples.forEach(input => input.addEventListener('input', resetResults));
  els.presentTimes.addEventListener('change', resetResults);
  els.presentBtn.addEventListener('click', runExperiment);
  els.resetBtn.addEventListener('click', () => { clearMessage(); resetResults(); });
  els.loadDemoBtn.addEventListener('click', () => {
    patient = structuredCloneSafe(DEMO_PATIENT);
    isDemo = true;
    els.targetEar.value = 'right_ear';
    els.targetFrequency.value = '1000';
    renderPatient();
    showMessage('Returned to the built-in demonstration patient.', 'success');
  });

  renderPatient();
})();
