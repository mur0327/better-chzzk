/**
 * BetterChzzk Background Script
 * Content Script 요청 시 inject.js를 MAIN 월드에 주입
 */

/**
 * Content Script로부터 메시지 수신 및 처리
 * @param {Object} request - 요청 객체
 * @param {Object} sender - 발신자 정보
 * @param {Function} sendResponse - 응답 콜백
 * @returns {boolean} 비동기 응답 여부
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "scripting" && sender.tab?.id) {
    chrome.scripting.executeScript({
      target: { tabId: sender.tab.id },
      files: ["scripts/inject.js"],
      world: "MAIN",
    });
    sendResponse({
      type: request.type,
      status: "success",
      message: "Script injected successfully",
    });
  }
  return false;
});
