/**
 * BetterChzzk Popup - 설정 UI
 */

// 기본 설정값
const DEFAULT_SETTINGS = {
  enabled: true,
  threshold: 3, // 초
  rate: 2,
};

// DOM 요소
const elements = {
  enabled: document.getElementById("enabled"),
  threshold: document.getElementById("threshold"),
  rate: document.getElementById("rate"),
};

/**
 * 저장된 설정 로드
 */
async function loadSettings() {
  const result = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  elements.enabled.checked = result.enabled;
  elements.threshold.value = result.threshold;
  elements.rate.value = result.rate;
}

/**
 * 설정 저장
 */
async function saveSettings() {
  await chrome.storage.sync.set({
    enabled: elements.enabled.checked,
    threshold: parseFloat(elements.threshold.value),
    rate: parseFloat(elements.rate.value),
  });
}

// 이벤트 바인딩
elements.enabled.addEventListener("change", saveSettings);
elements.threshold.addEventListener("change", saveSettings);
elements.rate.addEventListener("change", saveSettings);

// 초기화
loadSettings();
