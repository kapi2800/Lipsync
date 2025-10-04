import { Lipsync } from "wawa-lipsync";

// Create lipsync manager
const lipsyncManager = new Lipsync();

// DOM elements
const audioFile = document.getElementById("audioFile");
const audioPlayer = document.getElementById("audioPlayer");
const playBtn = document.getElementById("playBtn");
const pauseBtn = document.getElementById("pauseBtn");
const stopBtn = document.getElementById("stopBtn");
const visemeDisplay = document.getElementById("visemeText");
const statusMessage = document.getElementById("statusMessage");
const mouthImage = document.getElementById("mouthImage");

let isConnected = false;
let animationFrameId = null;

// Show status message
function showStatus(message, type = "info") {
  statusMessage.textContent = message;
  statusMessage.className = `status ${type}`;
  statusMessage.classList.remove("hidden");

  setTimeout(() => {
    statusMessage.classList.add("hidden");
  }, 3000);
}

// Preload all mouth images
const mouthImages = {};
const visemeLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'X'];
visemeLetters.forEach(letter => {
  const img = new Image();
  img.src = `/mouths/${letter}.png`;
  mouthImages[letter] = img;
  img.onload = () => console.log(`Preloaded: /mouths/${letter}.png`);
  img.onerror = () => console.error(`Failed to preload: /mouths/${letter}.png`);
});

// Update mouth image based on viseme
function updateMouthImage(viseme) {
  // Make sure it's uppercase
  const visemeUpper = String(viseme).toUpperCase().trim();
  const imagePath = `/mouths/${visemeUpper}.png`;

  console.log("Viseme:", visemeUpper, "Path:", imagePath);

  // Direct update without error handlers to avoid conflicts
  mouthImage.src = imagePath;
}

// Handle file selection
audioFile.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    const url = URL.createObjectURL(file);
    audioPlayer.src = url;

    // Wait for audio to be ready before connecting
    audioPlayer.addEventListener(
      "loadedmetadata",
      () => {
        try {
          lipsyncManager.connectAudio(audioPlayer);
          isConnected = true;
          playBtn.disabled = false;
          showStatus("✅ Audio file loaded successfully!", "success");
        } catch (error) {
          showStatus("❌ Error connecting audio: " + error.message, "error");
          console.error("Connection error:", error);
        }
      },
      { once: true }
    );
  }
});

// Animation loop
function analyzeAudio() {
  if (!audioPlayer.paused) {
    lipsyncManager.processAudio();
    const viseme = lipsyncManager.viseme;

    console.log("Raw viseme from library:", viseme, "Type:", typeof viseme);

    // Update the text display
    visemeDisplay.textContent = viseme;

    // Update the mouth image
    updateMouthImage(viseme);

    // Highlight active viseme in chart
    const visemeUpper = String(viseme).toUpperCase();
    document.querySelectorAll(".viseme-item").forEach((item) => {
      if (item.dataset.viseme === visemeUpper) {
        item.classList.add("active");
      } else {
        item.classList.remove("active");
      }
    });

    animationFrameId = requestAnimationFrame(analyzeAudio);
  }
}

// Play button
playBtn.addEventListener("click", () => {
  if (isConnected) {
    audioPlayer.play();
    playBtn.disabled = true;
    pauseBtn.disabled = false;
    stopBtn.disabled = false;
    analyzeAudio();
    showStatus("🎵 Playing audio...", "info");
  }
});

// Pause button
pauseBtn.addEventListener("click", () => {
  audioPlayer.pause();
  playBtn.disabled = false;
  pauseBtn.disabled = true;
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  showStatus("⏸️ Audio paused", "info");
});

// Stop button
stopBtn.addEventListener("click", () => {
  audioPlayer.pause();
  audioPlayer.currentTime = 0;
  playBtn.disabled = false;
  pauseBtn.disabled = true;
  stopBtn.disabled = true;
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  visemeDisplay.textContent = "X";
  updateMouthImage("X");
  document.querySelectorAll(".viseme-item").forEach((item) => {
    item.classList.remove("active");
  });
  document
    .querySelector('.viseme-item[data-viseme="X"]')
    .classList.add("active");
  showStatus("⏹️ Audio stopped", "info");
});

// Handle audio end
audioPlayer.addEventListener("ended", () => {
  playBtn.disabled = false;
  pauseBtn.disabled = true;
  stopBtn.disabled = true;
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  visemeDisplay.textContent = "X";
  updateMouthImage("X");
  document.querySelectorAll(".viseme-item").forEach((item) => {
    item.classList.remove("active");
  });
  document
    .querySelector('.viseme-item[data-viseme="X"]')
    .classList.add("active");
  showStatus("✅ Audio finished playing", "success");
});

// Create viseme chart
const visemes = ["A", "B", "C", "D", "E", "F", "G", "H", "X"];
const visemeChart = document.getElementById("visemeChart");

visemes.forEach((viseme) => {
  const item = document.createElement("div");
  item.className = "viseme-item";
  item.dataset.viseme = viseme;
  item.innerHTML = `
        <span class="viseme-char">${viseme}</span>
        <span>${viseme === "X" ? "Rest" : "Viseme"}</span>
    `;
  if (viseme === "X") {
    item.classList.add("active");
  }
  visemeChart.appendChild(item);
});

// Initialize with neutral mouth
updateMouthImage("X");

console.log("Lipsync test platform initialized!");
