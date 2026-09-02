/* Candidate widget loader v1 */
(function () {
  if (window.__talentFinderWidgetLoaded) return;
  window.__talentFinderWidgetLoaded = true;

  var script =
    document.currentScript ||
    (function () {
      var scripts = document.getElementsByTagName("script");
      return scripts[scripts.length - 1];
    })();

  if (!script) return;

  var dataset = script.dataset || {};
  var botId = dataset.botId || "";
  var embedToken = dataset.embedToken || "";
  var tenantSlug = dataset.tenantSlug || "";
  var apiBase = dataset.apiBase || window.location.origin;
  var widgetPath = dataset.widgetPath || "/widget";
  var position = dataset.position || "bottom-right";
  var primaryColor = dataset.primaryColor || "#4f46e5";
  var title = dataset.title || "Talent Finder";
  var zIndex = Number(dataset.zIndex || 999999);
  var openOnLoad = dataset.openOnLoad === "true";
  var width = Number(dataset.width || 380);
  var height = Number(dataset.height || 620);
  var minWidth = 280;
  var minHeight = 360;
  var viewportPadding = 24;
  var storageHeightKey = "talentfinder:widget-height:" + botId;
  var storageWidthKey = "talentfinder:widget-width:" + botId;

  if (!botId || !embedToken) {
    console.error(
      "[widget.v1] Missing required data attributes: data-bot-id and data-embed-token."
    );
    return;
  }

  var host = document.createElement("div");
  host.style.position = "fixed";
  host.style.zIndex = String(zIndex);
  host.style.fontFamily =
    "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif";
  host.style.pointerEvents = "none";
  host.setAttribute("aria-live", "polite");

  var offset = "20px";
  if (position === "bottom-left") {
    host.style.left = offset;
    host.style.bottom = offset;
  } else {
    host.style.right = offset;
    host.style.bottom = offset;
  }

  var launcher = document.createElement("button");
  launcher.type = "button";
  launcher.setAttribute("aria-label", "Open chat widget");
  launcher.style.pointerEvents = "auto";
  launcher.style.width = "56px";
  launcher.style.height = "56px";
  launcher.style.borderRadius = "9999px";
  launcher.style.border = "none";
  launcher.style.background = primaryColor;
  launcher.style.color = "#fff";
  launcher.style.cursor = "pointer";
  launcher.style.boxShadow = "0 8px 24px rgba(0,0,0,0.18)";
  launcher.style.display = "inline-flex";
  launcher.style.alignItems = "center";
  launcher.style.justifyContent = "center";
  launcher.style.fontSize = "22px";
  launcher.style.lineHeight = "1";
  launcher.textContent = "✦";

  var panel = document.createElement("div");
  panel.style.pointerEvents = "auto";
  panel.style.position = "fixed";
  panel.style.bottom = "92px";
  panel.style.width = String(width) + "px";
  panel.style.height = String(height) + "px";
  panel.style.maxWidth = "calc(100vw - " + String(viewportPadding) + "px)";
  panel.style.maxHeight = "calc(100vh - " + String(viewportPadding) + "px)";
  panel.style.background = "#fff";
  panel.style.border = "1px solid #e5e7eb";
  panel.style.borderRadius = "14px";
  panel.style.overflow = "hidden";
  panel.style.boxShadow = "0 20px 50px rgba(0,0,0,0.22)";
  panel.style.display = "none";
  panel.style.zIndex = String(zIndex);
  if (position === "bottom-left") {
    panel.style.left = offset;
  } else {
    panel.style.right = offset;
  }

  var header = document.createElement("div");
  header.style.height = "40px";
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.justifyContent = "space-between";
  header.style.padding = "0 10px";
  header.style.background = "#fafafa";
  header.style.borderBottom = "1px solid #e5e7eb";

  var headerTitle = document.createElement("div");
  headerTitle.textContent = title;
  headerTitle.style.fontSize = "13px";
  headerTitle.style.fontWeight = "600";
  headerTitle.style.color = "#111827";

  var closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Close chat widget");
  closeButton.style.border = "none";
  closeButton.style.background = "transparent";
  closeButton.style.cursor = "pointer";
  closeButton.style.color = "#6b7280";
  closeButton.style.fontSize = "18px";
  closeButton.style.lineHeight = "1";
  closeButton.textContent = "×";

  var iframe = document.createElement("iframe");
  iframe.title = "Embedded Talent Finder";
  iframe.style.width = "100%";
  iframe.style.height = "calc(100% - 40px)";
  iframe.style.border = "0";
  iframe.style.display = "block";
  iframe.allow = "clipboard-read; clipboard-write";

  var widgetUrl = new URL(widgetPath, apiBase);
  widgetUrl.searchParams.set("bot_id", botId);
  widgetUrl.searchParams.set("embed_token", embedToken);
  if (tenantSlug) {
    widgetUrl.searchParams.set("tenant_slug", tenantSlug);
  }
  widgetUrl.searchParams.set("primary_color", primaryColor);
  iframe.src = widgetUrl.toString();

  var isOpen = false;
  var currentWidth = width;
  var currentHeight = height;
  var resizeState = null;

  function loadStoredDimension(storageKey, fallbackValue) {
    try {
      var storedValue = window.localStorage.getItem(storageKey);
      if (!storedValue) return fallbackValue;
      var parsed = Number(storedValue);
      return Number.isFinite(parsed) ? parsed : fallbackValue;
    } catch (_) {
      return fallbackValue;
    }
  }

  function persistDimensions(nextWidth, nextHeight) {
    try {
      window.localStorage.setItem(storageWidthKey, String(nextWidth));
      window.localStorage.setItem(storageHeightKey, String(nextHeight));
    } catch (_) {
      // Ignore storage errors in restricted environments.
    }
  }

  function getMaxWidth() {
    return Math.max(minWidth, window.innerWidth - viewportPadding);
  }

  function getMaxHeight() {
    return Math.max(minHeight, window.innerHeight - viewportPadding);
  }

  function applySize(nextWidth, nextHeight) {
    currentWidth = Math.min(getMaxWidth(), Math.max(minWidth, Math.round(nextWidth)));
    currentHeight = Math.min(getMaxHeight(), Math.max(minHeight, Math.round(nextHeight)));
    panel.style.width = String(currentWidth) + "px";
    panel.style.height = String(currentHeight) + "px";
    panel.style.maxWidth = String(getMaxWidth()) + "px";
    panel.style.maxHeight = String(getMaxHeight()) + "px";
    persistDimensions(currentWidth, currentHeight);
  }

  function getPointerPosition(event) {
    var pointerX =
      event.touches && event.touches[0] ? event.touches[0].clientX : event.clientX;
    var pointerY =
      event.touches && event.touches[0] ? event.touches[0].clientY : event.clientY;
    if (typeof pointerX !== "number" || typeof pointerY !== "number") return null;
    return { x: pointerX, y: pointerY };
  }

  function applyResizeFromRect(rect) {
    var maxWidth = getMaxWidth();
    var maxHeight = getMaxHeight();
    var clampedWidth = Math.min(maxWidth, Math.max(minWidth, Math.round(rect.width)));
    var clampedHeight = Math.min(maxHeight, Math.max(minHeight, Math.round(rect.height)));
    var maxTop = Math.max(0, window.innerHeight - clampedHeight);
    var maxLeft = Math.max(0, window.innerWidth - clampedWidth);
    var top = Math.min(maxTop, Math.max(0, Math.round(rect.top)));
    var left = Math.min(maxLeft, Math.max(0, Math.round(rect.left)));

    currentWidth = clampedWidth;
    currentHeight = clampedHeight;
    panel.style.left = String(left) + "px";
    panel.style.top = String(top) + "px";
    panel.style.right = "auto";
    panel.style.bottom = "auto";
    panel.style.width = String(currentWidth) + "px";
    panel.style.height = String(currentHeight) + "px";
    panel.style.maxWidth = String(maxWidth) + "px";
    panel.style.maxHeight = String(maxHeight) + "px";
    persistDimensions(currentWidth, currentHeight);
  }

  function createResizeHandle(direction, cursor, styleProps) {
    var handle = document.createElement("div");
    handle.setAttribute("role", "separator");
    handle.setAttribute("aria-label", "Resize chat widget");
    handle.dataset.resizeDirection = direction;
    handle.style.position = "absolute";
    handle.style.zIndex = "3";
    handle.style.cursor = cursor;
    handle.style.touchAction = "none";
    handle.style.background = "transparent";
    var styleKeys = Object.keys(styleProps);
    for (var i = 0; i < styleKeys.length; i += 1) {
      var key = styleKeys[i];
      handle.style[key] = styleProps[key];
    }
    panel.appendChild(handle);
    return handle;
  }

  function stopResize() {
    if (!resizeState) return;
    resizeState = null;
    document.body.style.userSelect = "";
  }

  function handleResizeMove(event) {
    if (!resizeState) return;
    var pointer = getPointerPosition(event);
    if (!pointer) return;
    var dx = pointer.x - resizeState.startX;
    var dy = pointer.y - resizeState.startY;
    var direction = resizeState.direction;
    var nextRect = {
      top: resizeState.startTop,
      left: resizeState.startLeft,
      width: resizeState.startWidth,
      height: resizeState.startHeight,
    };

    if (direction.indexOf("n") !== -1) {
      nextRect.top += dy;
      nextRect.height -= dy;
    }
    if (direction.indexOf("s") !== -1) {
      nextRect.height += dy;
    }
    if (direction.indexOf("w") !== -1) {
      nextRect.left += dx;
      nextRect.width -= dx;
    }
    if (direction.indexOf("e") !== -1) {
      nextRect.width += dx;
    }
    applyResizeFromRect(nextRect);
    if (event.cancelable) event.preventDefault();
  }

  function startResize(event) {
    var pointer = getPointerPosition(event);
    if (!pointer) return;
    var handle = event.currentTarget;
    if (!handle || !handle.dataset || !handle.dataset.resizeDirection) return;
    var panelRect = panel.getBoundingClientRect();
    resizeState = {
      direction: handle.dataset.resizeDirection,
      startX: pointer.x,
      startY: pointer.y,
      startTop: panelRect.top,
      startLeft: panelRect.left,
      startWidth: panelRect.width,
      startHeight: panelRect.height,
    };
    document.body.style.userSelect = "none";
    if (event.cancelable) event.preventDefault();
  }

  function emit(eventName, detail) {
    try {
      window.dispatchEvent(
        new CustomEvent("talentfinder:" + eventName, { detail: detail || {} })
      );
    } catch (_) {
      // Ignore dispatch errors for strict environments.
    }
  }

  function setOpen(nextOpen) {
    isOpen = nextOpen;
    panel.style.display = nextOpen ? "block" : "none";
    launcher.setAttribute("aria-expanded", nextOpen ? "true" : "false");
    emit(nextOpen ? "opened" : "closed", {
      botId: botId,
      position: position,
    });
  }

  launcher.addEventListener("click", function () {
    setOpen(!isOpen);
  });
  closeButton.addEventListener("click", function () {
    setOpen(false);
  });

  var resizeHandles = [
    createResizeHandle("n", "ns-resize", { top: "0", left: "10px", right: "10px", height: "10px" }),
    createResizeHandle("s", "ns-resize", { bottom: "0", left: "10px", right: "10px", height: "10px" }),
    createResizeHandle("e", "ew-resize", { top: "10px", right: "0", bottom: "10px", width: "10px" }),
    createResizeHandle("w", "ew-resize", { top: "10px", left: "0", bottom: "10px", width: "10px" }),
    createResizeHandle("nw", "nwse-resize", { top: "0", left: "0", width: "14px", height: "14px" }),
    createResizeHandle("ne", "nesw-resize", { top: "0", right: "0", width: "14px", height: "14px" }),
    createResizeHandle("sw", "nesw-resize", { bottom: "0", left: "0", width: "14px", height: "14px" }),
    createResizeHandle("se", "nwse-resize", { bottom: "0", right: "0", width: "14px", height: "14px" }),
  ];
  for (var i = 0; i < resizeHandles.length; i += 1) {
    resizeHandles[i].addEventListener("mousedown", startResize);
    resizeHandles[i].addEventListener("touchstart", startResize, { passive: false });
  }
  window.addEventListener("mousemove", handleResizeMove);
  window.addEventListener("touchmove", handleResizeMove, { passive: false });
  window.addEventListener("mouseup", stopResize);
  window.addEventListener("touchend", stopResize);
  window.addEventListener("touchcancel", stopResize);
  window.addEventListener("resize", function () {
    applySize(currentWidth, currentHeight);
  });

  window.addEventListener("message", function (event) {
    if (!event.data || typeof event.data !== "object") return;
    if (event.data.source !== "talentfinder-widget") return;
    if (event.data.type === "close") setOpen(false);
    if (event.data.type === "open") setOpen(true);
    if (event.data.type === "resize") {
      if (typeof event.data.width === "number") {
        currentWidth = event.data.width;
      }
      if (typeof event.data.height === "number") {
        currentHeight = event.data.height;
      }
      applySize(currentWidth, currentHeight);
    }
    emit("message", event.data);
  });

  header.appendChild(headerTitle);
  header.appendChild(closeButton);
  panel.appendChild(header);
  panel.appendChild(iframe);
  host.appendChild(launcher);
  document.body.appendChild(panel);
  document.body.appendChild(host);

  applySize(
    loadStoredDimension(storageWidthKey, width),
    loadStoredDimension(storageHeightKey, height)
  );
  emit("ready", { botId: botId, position: position });
  setOpen(openOnLoad);
})();
