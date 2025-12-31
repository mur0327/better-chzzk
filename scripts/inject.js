/**
 * BetterChzzk - Chzzk 사용자 경험 개선 스크립트
 * MAIN 월드에서 실행되어 window.__getLiveInfo 등에 접근 가능
 */

// 전역 네임스페이스로 래핑하여 다른 스크립트와 충돌 방지
(function BetterChzzk() {
  "use strict";

  // ======================================
  // 설정 (Configuration)
  // ======================================
  const CONFIG = {
    LATENCY_INTERVAL: 500, // 레이턴시 업데이트 주기 (ms)
    VOLUME_STEP: 0.01, // 볼륨 조절 단위 (1%)
    VOLUME_OVERLAY_TIMEOUT: 1000, // 볼륨 오버레이 표시 시간 (ms)
    POINT_CLICK_INTERVAL: 1000, // 포인트 버튼 감지 주기 (ms)
    CATCHUP_CHECK_INTERVAL: 1000, // 빨리감기 상태 체크 주기 (ms)
    CATCHUP_BUFFER_TOLERANCE: 0.5, // 버퍼 끝과의 허용 오차 (초)
  };

  // ======================================
  // 셀렉터 (Selectors)
  // ======================================
  const SELECTORS = {
    DONATION_DIV: 'div[class^="live_chatting_input_donation"]',
    VIDEO_WRAPPER: ".webplayer-internal-source-wrapper",
    POINT_BUTTON: 'button[class^="live_chatting_power_button"]',
  };

  // ======================================
  // 유틸리티 함수 (Utilities)
  // ======================================

  /**
   * 스타일이 적용된 콘솔 로그 출력
   * @param {string} type - 로그 타입 (e.g., 'init', 'point')
   * @param {string} status - 상태 (e.g., 'success', 'info')
   * @param {string} message - 출력할 메시지
   */
  function log(type, status, message) {
    console.log(
      `%c BetterChzzk %c ${type} %c ${status} %c `,
      "background: #3bc460; padding: 2px 4px; border-radius: 4px 0px 0px 4px; color: white;",
      "background: #192226; padding: 2px 4px; color: white;",
      "background: #427d53; padding: 2px 4px; border-radius: 0px 4px 4px 0px; color: white;",
      "",
      message
    );
  }

  /**
   * 안전하게 DOM 요소를 선택하고 콜백 실행
   * @param {string} selector - CSS 셀렉터
   * @param {function} callback - 요소가 존재할 때 실행할 콜백
   * @returns {boolean} 요소를 찾았는지 여부
   */
  function safeQuery(selector, callback) {
    const element = document.querySelector(selector);
    if (element) {
      callback(element);
      return true;
    }
    return false;
  }

  /**
   * 값을 지정된 범위 내로 제한
   * @param {number} value - 제한할 값
   * @param {number} min - 최소값
   * @param {number} max - 최대값
   * @returns {number} 제한된 값
   */
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  // ======================================
  // 내부 상태 (Internal State)
  // ======================================
  let volumeTimeout = null;
  let volumeOverlay = null;
  let latencyElement = null;

  // ======================================
  // 레이턴시 표시 (Latency Display)
  // ======================================

  /**
   * 레이턴시 표시 요소 생성
   * @returns {HTMLElement} 레이턴시 표시 span 요소
   */
  function createLatencyElement() {
    const span = document.createElement("span");
    span.id = "betterchzzk-latency";
    Object.assign(span.style, {
      color: "#afafaf",
      fontSize: "13px",
      padding: "0 8px",
      display: "flex",
      alignItems: "center",
      order: "1", // CSS order로 항상 donation div 다음에 표시
    });
    return span;
  }

  /**
   * 레이턴시 정보 업데이트
   * donation div 다음에 레이턴시 요소 삽입 (CSS order로 위치 고정)
   */
  function updateLatency() {
    const latencyMs = window.__getLiveInfo?.()?.latency;
    if (typeof latencyMs === "undefined") return;

    // 레이턴시 요소가 없으면 생성 및 삽입
    if (!latencyElement || !latencyElement.parentElement) {
      const donationDiv = document.querySelector(SELECTORS.DONATION_DIV);
      if (!donationDiv) return;

      latencyElement = createLatencyElement();
      donationDiv.after(latencyElement);

      // CSS order로 위치 고정: donation(0) → latency(1) → button(99)
      donationDiv.style.order = "0";

      const sendButton = document.querySelector("#send_chat_or_donate");
      if (sendButton) {
        sendButton.style.order = "99";
      }
    }

    // 레이턴시 값 업데이트
    if (isNaN(latencyMs)) {
      latencyElement.textContent = "레이턴시: 오류";
    } else {
      const latencySec = (latencyMs / 1000).toFixed(2);
      latencyElement.textContent = `${latencySec}s`;
    }
  }

  // ======================================
  // 마우스 휠 볼륨 조절 (Wheel Volume Control)
  // ======================================

  /**
   * 볼륨 오버레이 요소 생성
   * @returns {HTMLElement} 볼륨 표시 오버레이 요소
   */
  function createVolumeOverlay() {
    const overlay = document.createElement("div");
    overlay.id = "betterchzzk-volume-overlay";
    Object.assign(overlay.style, {
      position: "absolute",
      top: "10%",
      left: "50%",
      transform: "translateX(-50%)",
      padding: "10px 20px",
      borderRadius: "3px",
      color: "white",
      background: "rgba(0,0,0,0.5)",
      fontSize: "175%",
      textAlign: "center",
      zIndex: "9999",
      transition: "opacity 0.5s",
      opacity: "0",
      pointerEvents: "none",
    });
    return overlay;
  }

  /**
   * 볼륨 오버레이 표시
   * @param {HTMLVideoElement} video - 비디오 요소
   * @param {number} volume - 현재 볼륨 (0~1)
   */
  function showVolumeOverlay(video, volume) {
    // video 요소의 부모 체인에서 wrapper 찾기 (SPA 네비게이션 후에도 정확한 wrapper를 찾기 위함)
    const wrapper = video.closest(SELECTORS.VIDEO_WRAPPER);
    if (!wrapper) return;

    // SPA 네비게이션으로 wrapper가 교체되면 기존 overlay가 DOM에서 분리됨
    // 이 경우 기존 overlay를 재사용하면 문제가 발생하므로 새로 생성
    if (volumeOverlay && !volumeOverlay.parentElement) {
      volumeOverlay = null;
    }

    if (!volumeOverlay) {
      volumeOverlay = createVolumeOverlay();
    }

    // wrapper에 오버레이 추가 (아직 추가되지 않은 경우 또는 다른 wrapper에 있는 경우)
    if (volumeOverlay.parentElement !== wrapper) {
      wrapper.appendChild(volumeOverlay);
    }

    volumeOverlay.innerText = `${(volume * 100).toFixed(0)}`;
    volumeOverlay.style.opacity = "1";

    clearTimeout(volumeTimeout);
    volumeTimeout = setTimeout(() => {
      if (volumeOverlay) {
        volumeOverlay.style.opacity = "0";
      }
    }, CONFIG.VOLUME_OVERLAY_TIMEOUT);
  }

  /**
   * 마우스 휠 볼륨 조절 핸들러
   * @param {WheelEvent} event - 휠 이벤트
   */
  function handleWheelVolume(event) {
    const video = event.target.closest("video");
    if (!video) return;

    event.preventDefault();

    const volumeChange = event.deltaY < 0 ? CONFIG.VOLUME_STEP : -CONFIG.VOLUME_STEP;
    video.volume = clamp(video.volume + volumeChange, 0, 1);

    showVolumeOverlay(video, video.volume);
  }

  // ======================================
  // 포인트 자동 클릭 (Auto Point Click)
  // ======================================

  /**
   * 포인트 획득 버튼 자동 클릭 시작
   * @param {number} interval - 버튼 감지 주기 (밀리초)
   */
  function startAutoClickPoint(interval = CONFIG.POINT_CLICK_INTERVAL) {
    setInterval(() => {
      safeQuery(SELECTORS.POINT_BUTTON, (button) => {
        button.click();
        log("point", "click", "point button clicked");
      });
    }, interval);
  }

  // ======================================
  // 지연시간 자동 따라잡기 (Latency Catch-up)
  // ======================================
  let isCatchingUp = false;
  let catchupSettings = { enabled: true, threshold: 3, rate: 2 }; // 기본값

  // postMessage로 설정 수신
  window.addEventListener("message", (event) => {
    if (event.data?.type === "BETTERCHZZK_SETTINGS") {
      catchupSettings = event.data.data;
      log(
        "settings",
        "update",
        `enabled=${catchupSettings.enabled}, threshold=${catchupSettings.threshold}s, rate=${catchupSettings.rate}x`
      );
    }
  });

  /**
   * 팝업에서 설정한 값 가져오기
   * @returns {{enabled: boolean, threshold: number, rate: number}}
   */
  function getCatchupSettings() {
    return {
      enabled: catchupSettings.enabled !== false,
      threshold: (catchupSettings.threshold || 3) * 1000, // 초 → ms
      rate: catchupSettings.rate || 2,
    };
  }

  /**
   * 버퍼 끝(live edge)까지의 거리 계산
   * @param {HTMLVideoElement} video
   * @returns {number|null} 버퍼 끝 위치 (초), 버퍼가 없으면 null
   */
  function getBufferEnd(video) {
    if (!video.buffered || video.buffered.length === 0) return null;
    return video.buffered.end(video.buffered.length - 1);
  }

  /**
   * 지연시간 체크 및 재생속도 조절 (버퍼 끝까지 따라잡기)
   */
  function checkLatencyAndCatchUp() {
    const settings = getCatchupSettings();
    if (!settings.enabled) return;

    const latencyMs = window.__getLiveInfo?.()?.latency;
    if (typeof latencyMs !== "number" || isNaN(latencyMs)) return;

    const video = document.querySelector("video");
    if (!video) return;

    const bufferEnd = getBufferEnd(video);
    if (bufferEnd === null) return;

    const distanceToLive = bufferEnd - video.currentTime;

    if (latencyMs > settings.threshold && !isCatchingUp) {
      // 지연 시간 초과 → 빨리감기 시작
      isCatchingUp = true;
      video.playbackRate = settings.rate;
      log(
        "catchup",
        "start",
        `latency ${(latencyMs / 1000).toFixed(1)}s > ${settings.threshold / 1000}s, speeding up to ${settings.rate}x`
      );
    } else if (isCatchingUp && distanceToLive <= CONFIG.CATCHUP_BUFFER_TOLERANCE) {
      // 버퍼 끝 도달 → 정상 속도 복귀
      isCatchingUp = false;
      video.playbackRate = 1.0;
      log("catchup", "done", `reached buffer end (${distanceToLive.toFixed(2)}s away), back to 1.0x`);
    }
  }

  /**
   * 지연시간 따라잡기 시작
   */
  function startLatencyCatchUp() {
    setInterval(checkLatencyAndCatchUp, CONFIG.CATCHUP_CHECK_INTERVAL);
  }

  // ======================================
  // 초기화 (Initialization)
  // ======================================
  function init() {
    // 레이턴시 표시 시작
    setInterval(updateLatency, CONFIG.LATENCY_INTERVAL);

    // 마우스 휠 볼륨 조절 이벤트 등록
    document.addEventListener("wheel", handleWheelVolume, { passive: false });

    // 포인트 자동 클릭
    startAutoClickPoint();

    // 지연시간 따라잡기 시작
    startLatencyCatchUp();

    log("init", "success", "initializing completed");
  }

  // 스크립트 실행
  init();
})();
