/* Snapshots (PNG, supersampled up to the GPU's limits, optional transparent
 * background) and video recording (MediaRecorder on the WebGL canvas).
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
      this.recStart = 0;
      this.onRecordState = null; // (recording:boolean)
    }

    /** Largest pixel ratio the GPU can actually render at this canvas size. */
    _maxSafeRatio() {
      const gl = this.renderer.getContext();
      const limit = Math.min(
        gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) || 4096,
        gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096
      );
      const size = new THREE.Vector2();
      this.renderer.getSize(size);
      return limit / Math.max(size.x, size.y, 1);
    }

    /** PNG snapshot at `scale`× the current canvas resolution. */
    snapshot(scale) {
      scale = scale || 2;
      const r = this.renderer;
      // While recording, resizing the buffer would stall/glitch the video —
      // capture at the current resolution instead.
      if (this.recording) {
        this.renderFrame();
        download(r.domElement.toDataURL('image/png'), 'soldier-' + timestamp() + '.png');
        return;
      }
      const prevRatio = r.getPixelRatio();
      const ratio = Math.min(prevRatio * scale, this._maxSafeRatio());
      try {
        r.setPixelRatio(ratio);
        this.renderFrame();
        const url = r.domElement.toDataURL('image/png');
        download(url, 'soldier-' + timestamp() + '.png');
      } finally {
        r.setPixelRatio(prevRatio);
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
      if (this.recorder && this.recorder.state !== 'inactive') return false;
      const mime = Capture.pickMime();
      if (!mime) {
        alert('Video recording is not supported in this browser. Use Chrome, Edge or Firefox.');
        return false;
      }
      const stream = this.renderer.domElement.captureStream(60);
      const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12000000 });
      // Chunks are local to this take: a new recording started while this
      // one is still flushing can never corrupt or steal its data.
      const chunks = [];
      recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      recorder.onstop = () => {
        const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
        const blob = new Blob(chunks, { type: mime.split(';')[0] });
        download(URL.createObjectURL(blob), 'soldier-drill-' + timestamp() + '.' + ext);
        if (this.recorder === recorder) {
          this.recorder = null;
          if (this.onRecordState) this.onRecordState(false);
        }
      };
      this.recorder = recorder;
      recorder.start(100);
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
