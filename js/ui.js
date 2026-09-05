/* Builds the control panel DOM and wires it to the app.
 * Expects an `app` object from main.js:
 * { soldier, tweener, timeline, capture, controls, camera, setBackground,
 *   setGround, backgroundMode, requestRender }
 */
(function () {
  'use strict';

  const { JOINT_DEFS, SKIN_TONES, UNIFORM_PRESETS, HEADGEAR_TYPES } = window.SoldierData;

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function section(title, open) {
    const details = el('details', 'section');
    if (open) details.open = true;
    const summary = el('summary', null, title);
    details.appendChild(summary);
    const body = el('div', 'section-body');
    details.appendChild(body);
    return { details, body };
  }

  function build(app) {
    const panel = document.getElementById('panel');
    const soldier = app.soldier;
    const sliderRefs = {};   // key -> {input, valueEl}

    /* ---------------- Presets ---------------- */
    {
      const { details, body } = section('Drill positions', true);
      const grid = el('div', 'btn-grid');
      for (const name of Object.keys(window.SoldierPoses)) {
        const b = el('button', 'btn', name);
        b.addEventListener('click', () => {
          app.timeline.stop();
          app.gait.stop();
          app.tweener.to(window.SoldierPoses[name], 0.45);
        });
        grid.appendChild(b);
      }
      body.appendChild(grid);

      // live marching (procedural gait)
      body.appendChild(el('div', 'joint-group-title', 'March on the spot'));
      const marchRow = el('div', 'row gap');
      const qmBtn = el('button', 'btn', '▶ Quick march');
      const dmBtn = el('button', 'btn', '▶ Double');
      const haltBtn = el('button', 'btn', '■ Halt');
      qmBtn.addEventListener('click', () => { app.timeline.stop(); app.tweener.cancel(); app.gait.start('quick'); });
      dmBtn.addEventListener('click', () => { app.timeline.stop(); app.tweener.cancel(); app.gait.start('double'); });
      haltBtn.addEventListener('click', () => app.gait.stop());
      marchRow.appendChild(qmBtn); marchRow.appendChild(dmBtn); marchRow.appendChild(haltBtn);
      body.appendChild(marchRow);
      const tempoRow = el('div', 'slider-row');
      tempoRow.appendChild(el('label', null, 'Tempo (steps/min)'));
      const tempoInput = el('input');
      tempoInput.type = 'range'; tempoInput.min = 80; tempoInput.max = 220; tempoInput.step = 2; tempoInput.value = 116;
      const tempoVal = el('span', 'slider-val', '116');
      tempoInput.addEventListener('input', () => {
        app.gait.tempo = parseInt(tempoInput.value, 10);
        tempoVal.textContent = tempoInput.value;
      });
      tempoRow.appendChild(tempoInput); tempoRow.appendChild(tempoVal);
      body.appendChild(tempoRow);
      app.gait.onModeChange = (mode, tempo) => {
        tempoInput.value = tempo;
        tempoVal.textContent = String(tempo);
        qmBtn.classList.toggle('primary', mode === 'quick');
        dmBtn.classList.toggle('primary', mode === 'double');
      };
      body.appendChild(el('div', 'hint', 'Marching runs live — record it with ⏺ Record, or Halt and fine-tune with the sliders.'));
      panel.appendChild(details);
    }

    /* ---------------- Pose sliders ---------------- */
    {
      const { details, body } = section('Pose — joints');
      const note = el('div', 'hint', 'Drag sliders to move limbs. Values are degrees (metres for slides).');
      body.appendChild(note);

      const groups = {};
      for (const d of JOINT_DEFS) {
        if (!groups[d.group]) groups[d.group] = [];
        groups[d.group].push(d);
      }

      const mirrorRow = el('div', 'row gap');
      for (const [label, mode] of [['Copy R→L', 'R2L'], ['Copy L→R', 'L2R'], ['Mirror', 'swap']]) {
        const b = el('button', 'btn small', label);
        b.addEventListener('click', () => { app.timeline.stop(); app.gait.stop(); app.tweener.cancel(); soldier.mirrorPose(mode); });
        mirrorRow.appendChild(b);
      }
      const resetBtn = el('button', 'btn small warn', 'Reset pose');
      resetBtn.addEventListener('click', () => { app.timeline.stop(); app.gait.stop(); app.tweener.to({}, 0.35); });
      mirrorRow.appendChild(resetBtn);
      body.appendChild(mirrorRow);

      for (const groupName of Object.keys(groups)) {
        const g = el('div', 'joint-group');
        g.appendChild(el('div', 'joint-group-title', groupName));
        for (const d of groups[groupName]) {
          const row = el('div', 'slider-row');
          const label = el('label', null, d.label);
          label.title = d.key;
          const input = el('input');
          input.type = 'range';
          input.min = d.min; input.max = d.max;
          input.step = d.step || 1;
          input.value = 0;
          const val = el('span', 'slider-val', '0');
          input.addEventListener('input', () => {
            app.timeline.stop();
            app.gait.stop();
            app.tweener.cancel();
            const v = parseFloat(input.value);
            soldier.setJoint(d.key, v);
            val.textContent = d.kind === 'pos' ? v.toFixed(2) : Math.round(v) + '°';
          });
          label.addEventListener('dblclick', () => {
            app.timeline.stop();
            app.gait.stop();
            app.tweener.cancel();
            soldier.setJoint(d.key, 0);
            refreshSliders();
          });
          row.appendChild(label); row.appendChild(input); row.appendChild(val);
          g.appendChild(row);
          sliderRefs[d.key] = { input, val, def: d };
        }
        body.appendChild(g);
      }
      panel.appendChild(details);
    }

    function refreshSliders() {
      const pose = soldier.getPose();
      for (const key of Object.keys(sliderRefs)) {
        const { input, val, def } = sliderRefs[key];
        const v = pose[key] || 0;
        input.value = v;
        val.textContent = def.kind === 'pos' ? v.toFixed(2) : Math.round(v) + '°';
      }
    }
    // Refresh sliders (throttled) whenever a pose is applied programmatically.
    let refreshQueued = false;
    soldier.onPoseApplied = () => {
      if (refreshQueued) return;
      refreshQueued = true;
      requestAnimationFrame(() => { refreshQueued = false; refreshSliders(); });
    };

    /* ---------------- Appearance ---------------- */
    {
      const { details, body } = section('Appearance');
      const colorInputs = {};

      // Figure choice: rigged human vs customizable stylized
      body.appendChild(el('div', 'joint-group-title', 'Figure'));
      const figRow = el('div', 'row gap');
      const humanBtn = el('button', 'btn', 'Realistic (loading…)');
      humanBtn.disabled = true;
      const stylBtn = el('button', 'btn primary', 'Stylized');
      humanBtn.addEventListener('click', () => app.setFigure('human'));
      stylBtn.addEventListener('click', () => app.setFigure('stylized'));
      figRow.appendChild(humanBtn); figRow.appendChild(stylBtn);
      body.appendChild(figRow);
      app.onHumanReady = (ok) => {
        humanBtn.textContent = ok ? 'Realistic' : 'Realistic (unavailable)';
        humanBtn.disabled = !ok;
      };
      app.onFigureChanged = (name) => {
        humanBtn.classList.toggle('primary', name === 'human');
        stylBtn.classList.toggle('primary', name !== 'human');
        document.getElementById('panel').classList.toggle('human-mode', name === 'human');
        syncAppearanceUI();
      };

      // Human-only: overall uniform tint (the scanned model has fixed textures)
      const hOnly = el('div', 'human-only');
      const tintRow = el('div', 'row');
      tintRow.appendChild(el('label', null, 'Uniform tint'));
      const tintInput = el('input');
      tintInput.type = 'color'; tintInput.value = '#ffffff';
      tintInput.addEventListener('input', () => soldier.setAppearance({ tint: tintInput.value }));
      tintRow.appendChild(tintInput);
      const tintReset = el('button', 'btn tiny', 'Reset');
      tintReset.addEventListener('click', () => { tintInput.value = '#ffffff'; soldier.setAppearance({ tint: '#ffffff' }); });
      tintRow.appendChild(tintReset);
      hOnly.appendChild(tintRow);
      hOnly.appendChild(el('div', 'hint', 'The realistic figure wears its own scanned uniform — tint it here. Full colour, camouflage and headgear options apply to the Stylized figure.'));
      body.appendChild(hOnly);

      const sOnly = el('div', 'stylized-only');

      // Uniform presets
      sOnly.appendChild(el('div', 'joint-group-title', 'Uniform'));
      const ugrid = el('div', 'btn-grid');
      for (const name of Object.keys(UNIFORM_PRESETS)) {
        const b = el('button', 'btn', name);
        b.addEventListener('click', () => {
          soldier.setAppearance(Object.assign({ hatCamo: false }, UNIFORM_PRESETS[name]));
          syncAppearanceUI();
        });
        ugrid.appendChild(b);
      }
      sOnly.appendChild(ugrid);

      // Pattern select
      const patRow = el('div', 'row');
      patRow.appendChild(el('label', null, 'Pattern'));
      const patSel = el('select');
      for (const p of ['solid', 'woodland', 'desert', 'digital', 'jungle']) {
        const o = el('option', null, p); o.value = p; patSel.appendChild(o);
      }
      patSel.addEventListener('change', () => { soldier.setAppearance({ pattern: patSel.value }); });
      patRow.appendChild(patSel);
      sOnly.appendChild(patRow);

      // Colour pickers
      const colorDefs = [
        ['jacket', 'Jacket'], ['trousers', 'Trousers'], ['hat', 'Headgear'],
        ['boots', 'Boots'], ['belt', 'Belt'], ['hair', 'Hair'],
      ];
      for (const [key, label] of colorDefs) {
        const row = el('div', 'row');
        row.appendChild(el('label', null, label));
        const input = el('input');
        input.type = 'color';
        input.value = soldier.appearance[key];
        input.addEventListener('input', () => {
          const patch = {}; patch[key] = input.value;
          if (key === 'jacket' || key === 'trousers') patch.pattern = 'solid';
          if (key === 'hat') patch.hatCamo = false;
          soldier.setAppearance(patch);
          syncAppearanceUI();
        });
        row.appendChild(input);
        sOnly.appendChild(row);
        colorInputs[key] = input;
      }

      // Skin tone swatches
      sOnly.appendChild(el('div', 'joint-group-title', 'Skin tone'));
      const swRow = el('div', 'row gap wrap');
      for (const tone of SKIN_TONES) {
        const sw = el('button', 'swatch');
        sw.style.background = tone;
        sw.title = tone;
        sw.addEventListener('click', () => { soldier.setAppearance({ skin: tone }); });
        swRow.appendChild(sw);
      }
      sOnly.appendChild(swRow);

      // Headgear + gloves
      const hgRow = el('div', 'row');
      hgRow.appendChild(el('label', null, 'Headgear'));
      const hgSel = el('select');
      for (const h of HEADGEAR_TYPES) { const o = el('option', null, h); o.value = h; hgSel.appendChild(o); }
      hgSel.addEventListener('change', () => { soldier.setAppearance({ headgear: hgSel.value }); });
      hgRow.appendChild(hgSel);
      sOnly.appendChild(hgRow);

      const glRow = el('div', 'row');
      glRow.appendChild(el('label', null, 'Gloves'));
      const glSel = el('select');
      for (const gname of ['skin', 'white', 'black']) { const o = el('option', null, gname === 'skin' ? 'none' : gname); o.value = gname; glSel.appendChild(o); }
      glSel.addEventListener('change', () => { soldier.setAppearance({ gloves: glSel.value }); });
      glRow.appendChild(glSel);
      sOnly.appendChild(glRow);
      body.appendChild(sOnly);

      // Height / build
      const scaleVals = {};
      for (const [key, label, min, max] of [['height', 'Height', 0.9, 1.1], ['build', 'Build', 0.85, 1.15]]) {
        const row = el('div', 'slider-row');
        row.appendChild(el('label', null, label));
        const input = el('input');
        input.type = 'range'; input.min = min; input.max = max; input.step = 0.01; input.value = 1;
        const val = el('span', 'slider-val', '1.00');
        input.addEventListener('input', () => {
          const patch = {}; patch[key] = parseFloat(input.value);
          soldier.setAppearance(patch);
          val.textContent = parseFloat(input.value).toFixed(2);
        });
        row.appendChild(input); row.appendChild(val);
        body.appendChild(row);
        colorInputs[key] = input;
        scaleVals[key] = val;
      }

      function syncAppearanceUI() {
        const a = soldier.getAppearance();
        if (a.tint && /^#[0-9a-f]{6}$/i.test(a.tint)) tintInput.value = a.tint;
        patSel.value = a.pattern;
        hgSel.value = a.headgear;
        glSel.value = a.gloves;
        for (const [key] of colorDefs) {
          if (/^#[0-9a-f]{6}$/i.test(a[key])) colorInputs[key].value = a[key];
        }
        for (const key of ['height', 'build']) {
          const v = Number(a[key]) || 1;
          colorInputs[key].value = v;
          scaleVals[key].textContent = v.toFixed(2);
        }
      }
      syncAppearanceUI();
      panel.appendChild(details);
      app.syncAppearanceUI = syncAppearanceUI;
    }

    /* ---------------- Scene ---------------- */
    {
      const { details, body } = section('Scene & camera');
      const bgRow = el('div', 'row');
      bgRow.appendChild(el('label', null, 'Background'));
      const bgSel = el('select');
      for (const [v, label] of [['sky', 'Parade ground'], ['studio', 'Studio dark'], ['white', 'White'], ['green', 'Green screen'], ['transparent', 'Transparent (PNG)']]) {
        const o = el('option', null, label); o.value = v; bgSel.appendChild(o);
      }
      bgSel.addEventListener('change', () => app.setBackground(bgSel.value));
      bgRow.appendChild(bgSel);
      body.appendChild(bgRow);
      app.bgSelect = bgSel;

      const groundRow = el('div', 'row');
      groundRow.appendChild(el('label', null, 'Ground'));
      const groundChk = el('input'); groundChk.type = 'checkbox'; groundChk.checked = true;
      groundChk.addEventListener('change', () => app.setGround(groundChk.checked));
      groundRow.appendChild(groundChk);
      body.appendChild(groundRow);
      app.groundCheckbox = groundChk;

      const spinRow = el('div', 'row');
      spinRow.appendChild(el('label', null, 'Turntable spin'));
      const spinChk = el('input'); spinChk.type = 'checkbox';
      spinChk.addEventListener('change', () => { app.controls.autoRotate = spinChk.checked; });
      spinRow.appendChild(spinChk);
      body.appendChild(spinRow);

      const lifeRow = el('div', 'row');
      const lifeLabel = el('label', null, 'Idle life');
      lifeLabel.title = 'Breathing, blinking and subtle sway';
      lifeRow.appendChild(lifeLabel);
      const lifeChk = el('input'); lifeChk.type = 'checkbox'; lifeChk.checked = true;
      lifeChk.addEventListener('change', () => { app.life.enabled = lifeChk.checked; });
      lifeRow.appendChild(lifeChk);
      body.appendChild(lifeRow);

      body.appendChild(el('div', 'joint-group-title', 'Camera view'));
      const camGrid = el('div', 'btn-grid');
      const views = {
        'Front': [0, 1.35, 3.4], 'Back': [0, 1.35, -3.4],
        'Left': [3.4, 1.35, 0], 'Right': [-3.4, 1.35, 0],
        '3/4': [2.3, 1.7, 2.6], 'Top': [0.01, 4.5, 0.01],
      };
      for (const name of Object.keys(views)) {
        const b = el('button', 'btn', name);
        b.addEventListener('click', () => {
          const [x, y, z] = views[name];
          app.camera.position.set(x, y, z);
          app.controls.target.set(0, 1.0, 0);
          app.controls.update();
        });
        camGrid.appendChild(b);
      }
      body.appendChild(camGrid);
      body.appendChild(el('div', 'hint', 'Drag to orbit · scroll to zoom · right-drag to pan'));
      panel.appendChild(details);
    }

    /* ---------------- Animation ---------------- */
    {
      const { details, body } = section('Animation (keyframes)');
      body.appendChild(el('div', 'hint', 'Pose the soldier, then add keyframes. Play tweens through them in order — record it to make a video.'));

      const addBtn = el('button', 'btn primary', '+ Add current pose as keyframe');
      addBtn.addEventListener('click', () => {
        app.gait.stop(); // bakes the on-screen stride so marching poses capture correctly
        app.timeline.addKeyframe(soldier.getPose());
      });
      body.appendChild(addBtn);

      const list = el('div', 'kf-list');
      body.appendChild(list);

      const playRow = el('div', 'row gap');
      const playBtn = el('button', 'btn primary', '▶ Play');
      const loopBtn = el('button', 'btn', '⟳ Loop');
      const stopBtn = el('button', 'btn', '■ Stop');
      const clearBtn = el('button', 'btn warn', 'Clear');
      playBtn.addEventListener('click', () => { app.tweener.cancel(); app.gait.stop(); app.timeline.play(false); });
      loopBtn.addEventListener('click', () => { app.tweener.cancel(); app.gait.stop(); app.timeline.play(true); });
      stopBtn.addEventListener('click', () => app.timeline.stop());
      clearBtn.addEventListener('click', () => { if (confirm('Remove all keyframes?')) app.timeline.clear(); });
      playRow.appendChild(playBtn); playRow.appendChild(loopBtn); playRow.appendChild(stopBtn); playRow.appendChild(clearBtn);
      body.appendChild(playRow);

      const durEl = el('div', 'hint', '');
      body.appendChild(durEl);

      function renderList() {
        list.innerHTML = '';
        app.timeline.keyframes.forEach((kf, i) => {
          const row = el('div', 'kf');
          const title = el('div', 'kf-title');
          const nameInput = el('input', 'kf-name');
          nameInput.value = kf.name;
          nameInput.addEventListener('change', () => { kf.name = nameInput.value; });
          title.appendChild(el('span', 'kf-num', String(i + 1)));
          title.appendChild(nameInput);

          const btns = el('div', 'kf-btns');
          const goBtn = el('button', 'btn tiny', 'Go');
          goBtn.title = 'Apply this keyframe pose';
          goBtn.addEventListener('click', () => { app.timeline.stop(); app.gait.stop(); app.tweener.to(kf.pose, 0.35); });
          const updBtn = el('button', 'btn tiny', 'Set');
          updBtn.title = 'Overwrite with current pose';
          updBtn.addEventListener('click', () => { app.gait.stop(); kf.pose = soldier.getPose(); });
          const upBtn = el('button', 'btn tiny', '↑');
          upBtn.addEventListener('click', () => app.timeline.moveKeyframe(i, -1));
          const dnBtn = el('button', 'btn tiny', '↓');
          dnBtn.addEventListener('click', () => app.timeline.moveKeyframe(i, 1));
          const delBtn = el('button', 'btn tiny warn', '✕');
          delBtn.addEventListener('click', () => app.timeline.removeKeyframe(i));
          for (const b of [goBtn, updBtn, upBtn, dnBtn, delBtn]) btns.appendChild(b);
          title.appendChild(btns);
          row.appendChild(title);

          const timing = el('div', 'kf-timing');
          for (const [prop, label] of [['transition', 'Move (s)'], ['hold', 'Hold (s)']]) {
            const wrap = el('label', 'kf-time');
            wrap.appendChild(document.createTextNode(label + ' '));
            const inp = el('input');
            inp.type = 'number'; inp.min = prop === 'hold' ? 0 : 0.1; inp.max = 30; inp.step = 0.1;
            inp.value = kf[prop];
            inp.addEventListener('change', () => {
              const v = parseFloat(inp.value);
              if (isNaN(v)) return;
              // Mutate in place: a full list rebuild here would destroy the
              // element under the cursor and swallow the user's next click.
              kf[prop] = Math.max(prop === 'hold' ? 0 : 0.1, v);
              inp.value = kf[prop];
              durEl.textContent = 'Sequence length: ' + app.timeline.duration().toFixed(1) + 's';
            });
            wrap.appendChild(inp);
            timing.appendChild(wrap);
          }
          row.appendChild(timing);
          list.appendChild(row);
        });
        durEl.textContent = app.timeline.keyframes.length
          ? 'Sequence length: ' + app.timeline.duration().toFixed(1) + 's'
          : 'No keyframes yet.';
      }
      app.timeline.onChange = renderList;
      renderList();
      panel.appendChild(details);
    }

    /* ---------------- Capture ---------------- */
    {
      const { details, body } = section('Snapshots & video', true);

      const snapRow = el('div', 'row gap');
      const snapBtn = el('button', 'btn primary', '📷 Snapshot PNG');
      const scaleSel = el('select');
      for (const [v, label] of [['1', '1× size'], ['2', '2× size'], ['4', '4× size']]) {
        const o = el('option', null, label); o.value = v; scaleSel.appendChild(o);
      }
      scaleSel.value = '2';
      snapBtn.addEventListener('click', () => app.capture.snapshot(parseInt(scaleSel.value, 10)));
      snapRow.appendChild(snapBtn); snapRow.appendChild(scaleSel);
      body.appendChild(snapRow);
      body.appendChild(el('div', 'hint', 'Tip: set Background to “Transparent (PNG)” for cut-out snapshots, or “Green screen” for video compositing.'));

      const recRow = el('div', 'row gap');
      const recBtn = el('button', 'btn record', '⏺ Record');
      const recSeqBtn = el('button', 'btn record', '⏺ Record sequence');
      recRow.appendChild(recBtn); recRow.appendChild(recSeqBtn);
      body.appendChild(recRow);
      body.appendChild(el('div', 'hint', 'Record = capture the viewport live (move sliders, play, orbit — all captured). Record sequence = plays your keyframes once and saves the video automatically. Saves .webm (import into any editor, or convert to .mp4). Keep the tab visible while recording — switching away stops and saves the take.'));

      let seqRecording = false;
      let restoreBg = null;

      // A transparent background encodes as solid black in video — switch to
      // green screen for the take and restore afterwards.
      const recordableBackground = () => {
        if (app.backgroundMode === 'transparent') {
          alert('A transparent background records as black — switching to Green screen for this video.');
          restoreBg = 'transparent';
          app.setBackground('green');
          if (app.bgSelect) app.bgSelect.value = 'green';
        }
      };
      app.recordableBackground = recordableBackground;

      recBtn.addEventListener('click', () => {
        if (app.capture.recording) { app.capture.stopRecording(); }
        else { recordableBackground(); app.capture.startRecording(); }
      });
      recSeqBtn.addEventListener('click', () => {
        if (app.capture.recording) return;
        if (!app.timeline.keyframes.length) { alert('Add at least one keyframe first (Animation section).'); return; }
        app.tweener.cancel();
        app.gait.stop();
        recordableBackground();
        if (app.capture.startRecording()) {
          seqRecording = true;
          app.timeline.play(false);
        }
      });
      // Auto-stop the sequence recording when playback ends — whether it
      // finished naturally or was aborted by Stop, a preset or a slider.
      app.timeline.onPlayState = (playing) => {
        if (!playing && seqRecording) {
          seqRecording = false;
          // small tail so the final pose is visible in the video
          setTimeout(() => app.capture.stopRecording(), 400);
        }
      };

      const recState = (rec) => {
        if (!rec) {
          seqRecording = false;
          if (restoreBg) {
            app.setBackground(restoreBg);
            if (app.bgSelect) app.bgSelect.value = restoreBg;
            restoreBg = null;
          }
        }
        recBtn.textContent = rec ? '■ Stop & save' : '⏺ Record';
        recBtn.classList.toggle('recording', rec);
        recSeqBtn.disabled = rec;
        document.getElementById('rec-dot').style.display = rec ? 'flex' : 'none';
      };
      app.capture.onRecordState = recState;

      /* ---- Save / load project ---- */
      body.appendChild(el('div', 'joint-group-title', 'Save / load'));
      const projRow = el('div', 'row gap');
      const saveBtn = el('button', 'btn', '💾 Save project');
      saveBtn.title = 'Downloads a .json with pose, appearance and keyframes';
      saveBtn.addEventListener('click', () => {
        const data = {
          app: 'digital-soldier', version: 1,
          pose: soldier.getPose(),
          appearance: soldier.getAppearance(),
          keyframes: app.timeline.serialize(),
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        window.SoldierCapture.download(URL.createObjectURL(blob), 'soldier-project-' + window.SoldierCapture.timestamp() + '.json');
      });
      const loadBtn = el('button', 'btn', '📂 Load project');
      const fileInput = el('input');
      fileInput.type = 'file'; fileInput.accept = '.json,application/json'; fileInput.style.display = 'none';
      loadBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', () => {
        const f = fileInput.files[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = () => {
          app.timeline.stop();
          app.gait.stop();
          app.tweener.cancel();
          try {
            const data = JSON.parse(reader.result);
            if (data.appearance) { soldier.setAppearance(data.appearance); if (app.syncAppearanceUI) app.syncAppearanceUI(); }
            if (data.pose) soldier.applyPose(data.pose);
            if (data.keyframes) app.timeline.load(data.keyframes);
          } catch (err) {
            alert('Could not read that file: ' + err.message);
          }
          fileInput.value = '';
        };
        reader.readAsText(f);
      });
      projRow.appendChild(saveBtn); projRow.appendChild(loadBtn); projRow.appendChild(fileInput);
      body.appendChild(projRow);

      panel.appendChild(details);
    }

    /* ---------------- Toolbar ---------------- */
    {
      const snapQuick = document.getElementById('tb-snapshot');
      snapQuick.addEventListener('click', () => app.capture.snapshot(2));
      const recQuick = document.getElementById('tb-record');
      recQuick.addEventListener('click', () => {
        if (app.capture.recording) app.capture.stopRecording();
        else { app.recordableBackground(); app.capture.startRecording(); }
      });
      const prevState = app.capture.onRecordState;
      app.capture.onRecordState = (rec) => {
        if (prevState) prevState(rec);
        recQuick.textContent = rec ? '■' : '⏺';
        recQuick.title = rec ? 'Stop & save video' : 'Record video';
      };
      // recording timer
      const dot = document.getElementById('rec-dot');
      setInterval(() => {
        if (app.capture.recording) {
          dot.querySelector('span').textContent = app.capture.elapsed().toFixed(0) + 's';
        }
      }, 250);
    }

    refreshSliders();
  }

  window.SoldierUI = { build };
})();
