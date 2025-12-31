/**
 * BetterChzzk Content Script
 * chrome.storage에서 설정을 읽어 MAIN 월드로 전달 (postMessage)
 */

// 기본 설정값
const DEFAULT_SETTINGS = {
  enabled: true,
  threshold: 3,
  rate: 2,
};

/**
 * 설정을 postMessage로 MAIN 월드에 전달
 */
async function sendSettings() {
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  window.postMessage({ type: "BETTERCHZZK_SETTINGS", data: settings }, "*");
}

/**
 * 설정 변경 감지 및 전달
 */
chrome.storage.onChanged.addListener(() => {
  sendSettings();
});

// 설정 전달 후 inject.js 로드 요청
sendSettings().then(() => {
  chrome.runtime.sendMessage({ type: "scripting" }, (response) => {
    console.log(
      `%c BetterChzzk %c ${response.type} %c ${response.status} %c `,
      "background: #3bc460; padding: 2px 4px; border-radius: 4px 0px 0px 4px; color: white;",
      "background: #192226; padding: 2px 4px; color: white;",
      "background: #427d53; padding: 2px 4px; border-radius: 0px 4px 4px 0px; color: white;",
      "",
      response.message
    );
  });
});
