import { Lipsync } from 'wawa-lipsync';

// Create lipsync manager
const lipsyncManager = new Lipsync();

// DOM elements
const audioFile = document.getElementById('audioFile');
const audioPlayer = document.getElementById('audioPlayer');
const playBtn = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const stopBtn = document.getElementById('stopBtn');
const visemeDisplay = document.getElementById('visemeDisplay');
const statusMessage = document.getElementById('statusMessage');
const mouthImage = document.getElementById('mouthImage');
const visemeChart = document.getElementById('visemeChart');

let isConnected = false;
let animationFrameId = null;

// Capture state for JSON export
let mouthCues = [];
let currentViseme = 'X';
let segmentStart = 0;
let uploadedFileName = '';
let audioDuration = 0;

// Utils
const round2 = (t) => Math.round(t * 100) / 100;

function showStatus(message, type = 'info') {
  statusMessage.textContent = message;
  statusMessage.className = `status ${type}`;
  statusMessage.classList.remove('hidden');
  setTimeout(() => statusMessage.classList.add('hidden'), 3000);
}

// Update mouth image based on viseme
function updateMouthImage(viseme) {
  const imagePath = `./mouths/${viseme}.png`;
  mouthImage.src = imagePath;
  mouthImage.onerror = () => {
    // Fallback to X (neutral) if image fails to load
    mouthImage.src = './mouths/X.png';
  };
}

// Build viseme chart UI
(function initVisemeChart() {
  const visemes = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'X'];
  visemes.forEach((viseme) => {
    const item = document.createElement('div');
    item.className = 'viseme-item';
    item.dataset.viseme = viseme;
    item.innerHTML = `
      <span class="viseme-char">${viseme}</span>
      <span>${viseme === 'X' ? 'Rest' : 'Viseme'}</span>
    `;
    if (viseme === 'X') item.classList.add('active');
    visemeChart.appendChild(item);
  });
  updateMouthImage('X');
  visemeDisplay.textContent = 'X';
})();

// Reset capture state (called when loading a new file or stopping)
function resetCapture() {
  mouthCues = [];
  currentViseme = 'X';
  segmentStart = 0;
  audioDuration = 0;
}

// Handle file selection
audioFile.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  uploadedFileName = file.name;

  // Reset state
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  resetCapture();

  const url = URL.createObjectURL(file);
  audioPlayer.src = url;

  // Connect after metadata for duration
  audioPlayer.addEventListener(
    'loadedmetadata',
    () => {
      audioDuration = audioPlayer.duration || 0;
      try {
        lipsyncManager.connectAudio(audioPlayer);
        isConnected = true;
        playBtn.disabled = false;
        pauseBtn.disabled = true;
        stopBtn.disabled = true;
        showStatus(`✅ Audio file loaded: ${uploadedFileName}`, 'success');
      } catch (error) {
        showStatus('❌ Error connecting audio: ' + error.message, 'error');
        console.error('Connection error:', error);
      }
    },
    { once: true }
  );
});

// Animation loop: analyze audio, update UI, capture viseme segments
function analyzeAudio() {
  if (audioPlayer.paused) return;

  lipsyncManager.processAudio();
  const now = audioPlayer.currentTime || 0;
  const viseme = lipsyncManager.viseme || 'X';

  // Initialize first segment on first frame of playback
  if (mouthCues.length === 0 && now === 0) {
    currentViseme = viseme;
    segmentStart = 0;
  }

  // If viseme changed, close previous segment and start a new one
  if (viseme !== currentViseme) {
    // Close previous
    mouthCues.push({
      start: round2(segmentStart),
      end: round2(now),
      value: currentViseme,
    });

    // Start new
    currentViseme = viseme;
    segmentStart = now;
  }

  // Update UI
  visemeDisplay.textContent = viseme;
  updateMouthImage(viseme);
  document.querySelectorAll('.viseme-item').forEach((item) => {
    if (item.dataset.viseme === viseme) item.classList.add('active');
    else item.classList.remove('active');
  });

  animationFrameId = requestAnimationFrame(analyzeAudio);
}

// Finalize segments and download JSON
function finalizeAndDownloadJSON() {
  const endTime = audioPlayer.duration || audioPlayer.currentTime || 0;

  // Close the last open segment, if any
  if (segmentStart <= endTime) {
    mouthCues.push({
      start: round2(segmentStart),
      end: round2(endTime),
      value: currentViseme,
    });
  }

  // Build JSON object
  const data = {
    metadata: {
      soundFile: uploadedFileName || 'unknown',
      duration: round2(endTime),
    },
    mouthCues,
  };

  // Create a download
  const base =
    (uploadedFileName && uploadedFileName.replace(/\.[^/.]+$/, '')) ||
    'audio';
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${base}.visemes.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);

  showStatus('📄 Viseme JSON downloaded', 'success');
}

// Play button
playBtn.addEventListener('click', () => {
  if (!isConnected) return;

  // Reset capture if we are starting from 0 again
  if (audioPlayer.currentTime === 0) {
    resetCapture();
    // Initialize first segment with current (likely X)
    lipsyncManager.processAudio();
    currentViseme = lipsyncManager.viseme || 'X';
    segmentStart = 0;
  }

  audioPlayer.play();
  playBtn.disabled = true;
  pauseBtn.disabled = false;
  stopBtn.disabled = false;
  analyzeAudio();
  showStatus('🎵 Playing audio...', 'info');
});

// Pause button
pauseBtn.addEventListener('click', () => {
  audioPlayer.pause();
  playBtn.disabled = false;
  pauseBtn.disabled = true;
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  showStatus('⏸️ Audio paused', 'info');
});

// Stop button
stopBtn.addEventListener('click', () => {
  // Stop playback
  audioPlayer.pause();
  audioPlayer.currentTime = 0;

  // Cancel loop
  if (animationFrameId) cancelAnimationFrame(animationFrameId);

  // Close any open segment up to current time (0)
  if (mouthCues.length === 0) {
    // If nothing captured, produce a single X segment [0, 0]
    mouthCues.push({ start: 0, end: 0, value: 'X' });
  } else {
    // If last segment is still open and starts > 0, close it at current time
    const endTime = audioPlayer.currentTime || 0;
    if (segmentStart < endTime) {
      mouthCues.push({
        start: round2(segmentStart),
        end: round2(endTime),
        value: currentViseme,
      });
    }
  }

  // Reset UI
  visemeDisplay.textContent = 'X';
  updateMouthImage('X');
  document.querySelectorAll('.viseme-item').forEach((i) =>
    i.classList.remove('active')
  );
  document
    .querySelector('.viseme-item[data-viseme="X"]')
    ?.classList.add('active');

  playBtn.disabled = false;
  pauseBtn.disabled = true;
  stopBtn.disabled = true;

  // Optional: also download partial JSON on stop
  finalizeAndDownloadJSON();

  // Prepare for next run
  resetCapture();
  showStatus('⏹️ Audio stopped and JSON exported', 'info');
});

// Handle audio ended
audioPlayer.addEventListener('ended', () => {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);

  // Finalize the last segment to the end of audio and download
  finalizeAndDownloadJSON();

  // Reset UI
  playBtn.disabled = false;
  pauseBtn.disabled = true;
  stopBtn.disabled = true;
  visemeDisplay.textContent = 'X';
  updateMouthImage('X');
  document.querySelectorAll('.viseme-item').forEach((i) =>
    i.classList.remove('active')
  );
  document
    .querySelector('.viseme-item[data-viseme="X"]')
    ?.classList.add('active');

  // Prepare for next playback
  resetCapture();
  showStatus('✅ Audio finished. JSON exported.', 'success');
});