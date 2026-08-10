(() => {
  "use strict";

  const TV_DATA_URL =
    "https://script.google.com/macros/s/AKfycbxcmJ4_kBZKJe9Npa7lQ4kcQzRdEN_j6Xc11zq2T6ak628dgi4VYcGZv3VNVyGr8KLc/exec?export=tv";

  const DATA_REFRESH_MS = 5 * 60 * 1000;
  const PLAYBACK_SYNC_MS = 5000;
  const UI_TICK_MS = 250;
  const MAX_DRIFT_SECONDS = 3;
  const REQUEST_TIMEOUT_MS = 15000;

  const $ = id => document.getElementById(id);
  const debugEnabled = new URLSearchParams(location.search).get("debug") === "1";

  let tvData = null;
  let engine = null;
  let selectedChannel = null;

  let player = null;
  let playerReady = false;
  let currentVideoId = "";
  let currentBroadcast = null;
  let failedVideoIds = new Set();
  let soundEnabled = false;
  let fallbackMuteTimer = null;
  let currentEntityCardId = "";
  const continuityCards = new Map();

  let syncTimer = null;
  let uiTimer = null;
  let refreshTimer = null;

  function log(...parts) {
    if (!debugEnabled) return;
    const stamp = new Date().toISOString().slice(11, 19);
    $("debug").classList.add("visible");
    $("debug").textContent =
      `[${stamp}] ${parts.map(value => typeof value === "string" ? value : JSON.stringify(value)).join(" ")}\n` +
      $("debug").textContent.slice(0, 7000);
  }

  function setStatus(message, visible = true) {
    $("statusText").textContent = message;
    $("statusScreen").classList.toggle("hidden", !visible);
  }

  async function fetchJson(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        cache: "no-store",
        headers: { Accept: "application/json" }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  function resolveRequestedChannel() {
    const params = new URLSearchParams(location.search);
    const fromUrl = params.get("channel");
    const fromStorage = localStorage.getItem("avtv_channel");
    return fromUrl || fromStorage || null;
  }

  function updateUrlChannel(channel) {
    const url = new URL(location.href);
    url.searchParams.set("channel", channel.slug || channel.channel_id);
    history.replaceState({}, "", url);
    localStorage.setItem("avtv_channel", channel.slug || channel.channel_id);
  }

  function escapeText(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function renderChannelMenu() {
    if (!engine) return;
    const menu = $("channelMenu");
    menu.replaceChildren();

    [...engine.channels]
      .sort((a, b) => Number(a.channel_number || 999) - Number(b.channel_number || 999))
      .forEach(channel => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "channel-option";
        button.dataset.channel = channel.channel_id;
        button.innerHTML = `
          <span class="channel-option-number">${escapeText(channel.channel_number || "")}</span>
          <span class="channel-option-copy">
            <strong>${escapeText(channel.name)}</strong>
            <span>${escapeText(channel.description || "")}</span>
          </span>
        `;
        button.addEventListener("click", () => {
          selectChannel(channel.channel_id);
          closeChannelMenu();
        });
        menu.appendChild(button);
      });
  }

  function updateChannelHeader(broadcast) {
    const channel = broadcast && broadcast.channel;
    const program = broadcast && broadcast.program;

    if (channel) {
      $("channelNumber").textContent = channel.channel_number ? `CANAL ${channel.channel_number}` : "CANAL";
      $("channelName").textContent = channel.name || channel.channel_id;
    }

    $("currentProgram").textContent = program && program.name ? program.name : "Programación";
  }

  function selectChannel(channelValue) {
    if (!engine) return;
    const channel = engine.resolveChannel(channelValue);
    if (!channel) return;
    selectedChannel = channel;
    updateUrlChannel(channel);
    currentVideoId = "";
    syncPlayback(true);
  }

  function toggleChannelMenu() {
    const menu = $("channelMenu");
    const button = $("channelButton");
    const open = !menu.classList.contains("open");
    menu.classList.toggle("open", open);
    button.setAttribute("aria-expanded", String(open));
  }

  function closeChannelMenu() {
    $("channelMenu").classList.remove("open");
    $("channelButton").setAttribute("aria-expanded", "false");
  }

  function showStandby(broadcast) {
    const programName = broadcast && broadcast.program && broadcast.program.name;
    $("standbyProgram").textContent = programName || "Programación";
    $("standby").classList.add("visible");
  }

  function hideStandby() {
    $("standby").classList.remove("visible");
  }

  function qrImageUrl(target) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(target)}`;
  }

  function updateEntityCard(broadcast) {
    const card = $("entityCard");
    const media = broadcast && broadcast.media;
    if (!media || String(media.type || "").toLowerCase() !== "entity" || !media.entity_id) {
      currentEntityCardId = "";
      card.classList.remove("visible");
      return;
    }

    const entity = tvData && tvData.entities && tvData.entities[media.entity_id];
    if (!entity || !entity.map_url) {
      currentEntityCardId = "";
      card.classList.remove("visible");
      return;
    }

    if (currentEntityCardId !== media.entity_id) {
      currentEntityCardId = media.entity_id;
      $("entityQr").src = qrImageUrl(entity.map_url);
      $("entityName").textContent = entity.name || media.title || "Ver ficha";
      $("entityLink").href = entity.map_url;
    }

    card.classList.add("visible");
  }

  function clearContinuity() {
    continuityCards.forEach(card => card.remove());
    continuityCards.clear();
    $("continuityColumn").classList.remove("visible");
  }

  function renderContinuity() {
    if (!engine || !selectedChannel || !tvData) return;

    const config =
      tvData.presentation &&
      tvData.presentation.program_change_teasers
        ? tvData.presentation.program_change_teasers
        : {};

    const column = $("continuityColumn");

    if (config.enabled === false || (currentBroadcast && currentBroadcast.is_global_entity_block)) {
      clearContinuity();
      return;
    }

    const leadSeconds = Number(config.lead_seconds || 30);
    const changes = engine.nextProgramChanges(Date.now(), leadSeconds);

    if (!changes.length) {
      clearContinuity();
      return;
    }

    const activeKeys = new Set();

    changes.forEach(change => {
      const key = `${change.channel.channel_id}|${Math.round(change.change_at_ms)}`;
      activeKeys.add(key);

      let card = continuityCards.get(key);
      if (!card) {
        card = document.createElement("button");
        card.type = "button";
        card.className = "continuity-card";
        card.dataset.channel = change.channel.channel_id;

        const thumb = change.next_media && change.next_media.thumbnail
          ? change.next_media.thumbnail
          : "logo_archipielagotv.svg";

        card.innerHTML = `
          <div class="continuity-thumb-wrap">
            <img class="continuity-thumb" src="${escapeText(thumb)}" alt="" loading="eager">
            <span class="continuity-countdown"></span>
          </div>
          <div class="continuity-copy">
            <span class="continuity-channel">${change.channel.channel_number ? `${escapeText(change.channel.channel_number)} · ` : ""}${escapeText(change.channel.name)}</span>
            <strong>${escapeText(change.next_program.name)}</strong>
          </div>
        `;

        card.addEventListener("click", () => selectChannel(change.channel.channel_id));
        continuityCards.set(key, card);
      }

      const remaining = Math.max(0, Math.ceil((change.change_at_ms - Date.now()) / 1000));
      const countdown = card.querySelector(".continuity-countdown");
      if (countdown) countdown.textContent = `EN ${String(remaining).padStart(2, "0")} s`;

      // appendChild también mantiene el orden correcto sin recrear la tarjeta.
      column.appendChild(card);
    });

    [...continuityCards.entries()].forEach(([key, card]) => {
      if (!activeKeys.has(key)) {
        card.remove();
        continuityCards.delete(key);
      }
    });

    column.classList.toggle("visible", continuityCards.size > 0);
  }

  async function loadTvData({ quiet = false } = {}) {
    if (!quiet) setStatus("Cargando parrilla…", true);

    try {
      const data = await fetchJson(TV_DATA_URL);
      if (Number(data.schema_version || 0) < 2 || !Array.isArray(data.channels) || !Array.isArray(data.schedule)) {
        throw new Error("El endpoint TV todavía no está publicando schema_version 2.");
      }

      if (data.tv_config && data.tv_config.valid === false) {
        log("Errores de configuración", data.tv_config.errors || []);
      }

      tvData = data;
      engine = new window.AVTVEngine.TVEngine(data);
      selectedChannel = engine.resolveChannel(selectedChannel && selectedChannel.channel_id || resolveRequestedChannel());

      if (!selectedChannel) throw new Error("No hay canales activos.");

      renderChannelMenu();
      updateUrlChannel(selectedChannel);
      setStatus("", false);
      syncPlayback(true);
      log("TV cargada", {
        schema: data.schema_version,
        channels: engine.channels.length,
        media: engine.media.length,
        schedule: engine.schedule.length,
        channel: selectedChannel.channel_id
      });
    } catch (error) {
      log("Error cargando TV", String(error && error.message || error));
      if (!engine) setStatus(`No se pudo cargar la emisión: ${error.message || error}`, true);
    }
  }

  function expectedBroadcast() {
    if (!engine || !selectedChannel) return null;
    let broadcast = engine.resolve(selectedChannel.channel_id, Date.now());

    if (broadcast && broadcast.media && failedVideoIds.has(broadcast.media.youtube_id)) {
      // Error local de YouTube: dejamos la señal en reserva hasta el siguiente ítem.
      broadcast = { ...broadcast, kind: "standby", media: null };
    }
    return broadcast;
  }

  function ensureAutoplay() {
    if (!playerReady || !player) return;
    clearTimeout(fallbackMuteTimer);
    fallbackMuteTimer = setTimeout(() => {
      try {
        const state = player.getPlayerState();
        if (state !== window.YT.PlayerState.PLAYING && !soundEnabled) {
          player.mute();
          player.playVideo();
          $("soundButton").classList.add("visible");
        }
      } catch (_) {}
    }, 1400);
  }

  function syncPlayback(force = false) {
    if (!engine || !selectedChannel) return;

    const broadcast = expectedBroadcast();
    currentBroadcast = broadcast;
    updateChannelHeader(broadcast);
    updateEntityCard(broadcast);
    renderContinuity();

    if (!broadcast || broadcast.kind !== "media" || !broadcast.media || !broadcast.media.youtube_id) {
      showStandby(broadcast);
      if (playerReady && player) {
        try { player.pauseVideo(); } catch (_) {}
      }
      return;
    }

    hideStandby();
    const expectedId = broadcast.media.youtube_id;
    const expectedOffset = Math.max(0, Number(broadcast.media_offset_seconds || 0));

    if (!playerReady || !player) return;

    if (force || currentVideoId !== expectedId) {
      currentVideoId = expectedId;
      try {
        player.loadVideoById({
          videoId: expectedId,
          startSeconds: Math.max(0, Math.floor(expectedOffset))
        });
        if (soundEnabled) {
          player.unMute();
          player.setVolume(100);
        }
        ensureAutoplay();
        log("load", expectedId, "offset", expectedOffset.toFixed(1), "channel", selectedChannel.channel_id);
      } catch (error) {
        log("load error", String(error));
      }
      return;
    }

    try {
      const actual = Number(player.getCurrentTime() || 0);
      if (Math.abs(actual - expectedOffset) > MAX_DRIFT_SECONDS) {
        player.seekTo(expectedOffset, true);
        log("resync", expectedId, "actual", actual.toFixed(1), "expected", expectedOffset.toFixed(1));
      }
    } catch (_) {}
  }

  function activateSound() {
    soundEnabled = true;
    try {
      player.unMute();
      player.setVolume(100);
      player.playVideo();
    } catch (_) {}
    $("soundButton").classList.remove("visible");
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(error => log("fullscreen", String(error)));
    } else {
      document.exitFullscreen().catch(error => log("fullscreen", String(error)));
    }
  }

  function updateFullscreenLabel() {
    $("fullscreenButton").textContent = document.fullscreenElement ? "Salir de pantalla completa" : "Pantalla completa";
  }

  function startTimers() {
    clearInterval(syncTimer);
    clearInterval(uiTimer);
    clearInterval(refreshTimer);

    syncTimer = setInterval(() => syncPlayback(false), PLAYBACK_SYNC_MS);
    uiTimer = setInterval(() => {
      renderContinuity();
    }, UI_TICK_MS);
    refreshTimer = setInterval(() => loadTvData({ quiet: true }), DATA_REFRESH_MS);
  }

  window.onYouTubeIframeAPIReady = function onYouTubeIframeAPIReady() {
    player = new window.YT.Player("player", {
      width: "100%",
      height: "100%",
      playerVars: {
        autoplay: 1,
        controls: 0,
        disablekb: 1,
        fs: 0,
        playsinline: 1,
        rel: 0,
        iv_load_policy: 3,
        modestbranding: 1
      },
      events: {
        onReady() {
          playerReady = true;
          syncPlayback(true);
        },
        onStateChange(event) {
          if (event.data === window.YT.PlayerState.ENDED) {
            setTimeout(() => syncPlayback(true), 100);
          }
        },
        onError(event) {
          if (currentVideoId) failedVideoIds.add(currentVideoId);
          log("YouTube error", event.data, currentVideoId);
          currentVideoId = "";
          syncPlayback(true);
        }
      }
    });
  };

  function bindUi() {
    $("channelButton").addEventListener("click", event => {
      event.stopPropagation();
      toggleChannelMenu();
    });

    document.addEventListener("click", event => {
      if (!$("channelSwitcher").contains(event.target)) closeChannelMenu();
    });

    $("soundButton").addEventListener("click", activateSound);
    $("fullscreenButton").addEventListener("click", toggleFullscreen);
    document.addEventListener("fullscreenchange", updateFullscreenLabel);

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") closeChannelMenu();
      if (event.key.toLowerCase() === "f" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        toggleFullscreen();
      }
    });
  }

  async function init() {
    bindUi();
    startTimers();
    await loadTvData();
  }

  init();
})();
