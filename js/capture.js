/* Snapshots (PNG, up to 4x supersampled, optional transparent background)
 * and video recording (MediaRecorder on the WebGL canvas).
 */
(function () {
  'use strict';

  function timestamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  }

  function download(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    }, 500);
  }

  class Capture {
    /**
     * @param {THREE.WebGLRenderer} renderer
     * @param {function} renderFrame  re-renders the scene once
     */
    constructor(renderer, renderFrame) {
      this.renderer = renderer;
      this.renderFrame = renderFrame;
      this.recorder = null;
      this.chunks = [];
      this.recStart = 0;
      this.onRecordState = null; // (recording:boolean)
    }

    /** PNG snapshot at `scale`× the current canvas resolution. */
    snapshot(scale) {
      scale = scale || 2;
      const r = this.renderer;
      const prevRatio = r.getPixelRatio();
      const size = new THREE.Vector2();
      r.getSize(size);
      try {
        r.setPixelRatio(prevRatio * scale);
        this.renderFrame();
        const url = r.domElement.toDataURL('image/png');
        download(url, 'soldier-' + timestamp() + '.png');
      } finally {
        r.setPixelRatio(prevRatio);
        r.setSize(size.x, size.y, false);
        this.renderFrame();
      }
    }

    get recording() {
      return !!(this.recorder && this.recorder.state === 'recording');
    }

    static pickMime() {
      if (typeof MediaRecorder === 'undefined') return null;
      const candidates = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
        'video/mp4',
      ];
      for (const m of candidates) {
        if (MediaRecorder.isTypeSupported(m)) return m;
      }
      return null;
    }

    startRecording() {
      if (this.recording) return false;
      const mime = Capture.pickMime();
      if (!mime) {
        alert('Video recording is not supported in this browser. Use Chrome, Edge or Firefox.');
        return false;
      }
      const stream = this.renderer.domElement.captureStream(60);
      this.chunks = [];
      this.recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12_000_000 });
      this.recorder.ondataavailable = (e) => { if (e.data && e.data.size) this.chunks.push(e.data); };
      this.recorder.onstop = () => {
        const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
        const blob = new Blob(this.chunks, { type: mime.split(';')[0] });
        this.chunks = [];
        download(URL.createObjectURL(blob), 'soldier-drill-' + timestamp() + '.' + ext);
        if (this.onRecordState) this.onRecordState(false);
      };
      this.recorder.start(100);
      this.recStart = performance.now();
      if (this.onRecordState) this.onRecordState(true);
      return true;
    }

    stopRecording() {
      if (!this.recording) return;
      this.recorder.stop();
    }

    elapsed() {
      return this.recording ? (performance.now() - this.recStart) / 1000 : 0;
    }
  }

  window.SoldierCapture = { Capture, download, timestamp };
})();
