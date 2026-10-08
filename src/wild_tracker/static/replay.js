// 2D Replay tab (match page): steps through a round's kill / plant / defuse
// events, drawing every alive player's position at that instant on the
// map's minimap. The API only records positions at these events (no
// continuous movement), so this is event-to-event, not smooth playback.
// Data shape: queries.py::match_replay, enriched by webapp.py::replay_json.
// Mirrored by web/components/ReplayTab.tsx — keep the two in sync.
(function () {
  var SVG_NS = "http://www.w3.org/2000/svg";
  var VIEW = 1000; // SVG viewBox is VIEW x VIEW; minimap image fills it
  var MARKER_R = 22;
  var uid = 0;

  function el(tag, attrs, parent) {
    var node = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(node);
    return node;
  }

  function h(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function fmtTime(ms) {
    var s = Math.round((ms || 0) / 1000);
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }

  function init(root) {
    var data = JSON.parse(root.querySelector(".replay-data").textContent);
    var cal = data.cal;
    var roundsEl = root.querySelector(".replay-rounds");
    var eventsEl = root.querySelector(".replay-events");
    var roundLabelEl = root.querySelector(".replay-round-label");
    var svg = root.querySelector(".replay-svg");
    root.querySelector(".replay-minimap").src = data.minimap;

    var state = { r: 0, e: 0 };

    // Game (x, y) -> SVG coords. Per valorant-api.com's map calibration the
    // image's horizontal axis follows the game's y and vertical follows x.
    function toPx(x, y) {
      return [(y * cal.xMultiplier + cal.xScalarToAdd) * VIEW, (x * cal.yMultiplier + cal.yScalarToAdd) * VIEW];
    }

    function teamOf(pid) { return (data.players[pid] || {}).team || "enemy"; }
    function nameOf(pid) { return (data.players[pid] || {}).name || "?"; }

    function playerChip(pid) {
      var p = data.players[pid] || {};
      var chip = h("span", "replay-chip replay-" + (p.team || "enemy"));
      if (p.icon) {
        var img = h("img");
        img.src = p.icon;
        img.alt = "";
        chip.appendChild(img);
      }
      chip.appendChild(document.createTextNode(p.name || "?"));
      return chip;
    }

    function buildRounds() {
      roundsEl.innerHTML = "";
      data.rounds.forEach(function (rnd, i) {
        var b = h("button", "replay-round-btn" + (rnd.winner === "wild" ? " win" : rnd.winner === "enemy" ? " loss" : ""), String(rnd.label));
        b.type = "button";
        b.dataset.idx = i;
        b.addEventListener("click", function () { select(i, 0); });
        roundsEl.appendChild(b);
        if (rnd.label === 12 || rnd.label === 24) roundsEl.appendChild(h("span", "replay-round-gap"));
      });
    }

    function buildEvents() {
      var rnd = data.rounds[state.r];
      roundLabelEl.textContent = "Round " + rnd.label + " / " + data.rounds[data.rounds.length - 1].label;
      eventsEl.innerHTML = "";
      rnd.events.forEach(function (ev, i) {
        var row = h("button", "replay-event");
        row.type = "button";
        row.dataset.idx = i;
        row.appendChild(h("span", "replay-event-time", fmtTime(ev.t)));
        var body = h("span", "replay-event-body");
        if (ev.kind === "kill") {
          body.appendChild(playerChip(ev.actor));
          var icon = data.weaponIcons[ev.weapon];
          if (icon) {
            var w = h("img", "replay-weapon");
            w.src = icon;
            w.alt = ev.weapon || "";
            body.appendChild(w);
          } else {
            body.appendChild(h("span", "replay-weapon-text", ev.weapon || "—"));
          }
          body.appendChild(playerChip(ev.target));
        } else {
          body.appendChild(h("span", "replay-spike-text", ev.kind === "plant" ? "Spike planted" + (ev.site ? " (" + ev.site + ")" : "") + " by" : "Spike defused by"));
          body.appendChild(playerChip(ev.actor));
        }
        row.appendChild(body);
        row.addEventListener("click", function () { select(state.r, i); });
        eventsEl.appendChild(row);
      });
    }

    function marker(parent, pid, x, y, view, opts) {
      var team = teamOf(pid);
      var pt = toPx(x, y);
      var g = el("g", { "class": "replay-marker replay-" + team + (opts && opts.dead ? " dead" : "") }, parent);
      el("title", {}, g).textContent = nameOf(pid);
      if (view !== null && view !== undefined && !(opts && opts.dead)) {
        // view_radians is atan2(dy, dx) in game coords (verified against
        // killer->victim directions); in image space that's (sin, -cos).
        var L = 46;
        el("line", {
          "class": "replay-view", x1: pt[0], y1: pt[1],
          x2: pt[0] + Math.sin(view) * L, y2: pt[1] - Math.cos(view) * L,
        }, g);
      }
      var p = data.players[pid] || {};
      var clipId = "rpclip" + (++uid);
      var clip = el("clipPath", { id: clipId }, g);
      el("circle", { cx: pt[0], cy: pt[1], r: MARKER_R - 2 }, clip);
      el("circle", { "class": "replay-marker-bg", cx: pt[0], cy: pt[1], r: MARKER_R }, g);
      if (p.icon) {
        var img = el("image", {
          x: pt[0] - MARKER_R, y: pt[1] - MARKER_R, width: MARKER_R * 2, height: MARKER_R * 2,
          "clip-path": "url(#" + clipId + ")",
        }, g);
        img.setAttributeNS("http://www.w3.org/1999/xlink", "href", p.icon);
        img.setAttribute("href", p.icon);
      }
      el("circle", { "class": "replay-marker-ring", cx: pt[0], cy: pt[1], r: MARKER_R }, g);
      if (opts && opts.dead) {
        var d = 12;
        el("line", { "class": "replay-x", x1: pt[0] - d, y1: pt[1] - d, x2: pt[0] + d, y2: pt[1] + d }, g);
        el("line", { "class": "replay-x", x1: pt[0] - d, y1: pt[1] + d, x2: pt[0] + d, y2: pt[1] - d }, g);
      }
      return pt;
    }

    function spike(parent, x, y) {
      var pt = toPx(x, y);
      var g = el("g", { "class": "replay-spike" }, parent);
      el("title", {}, g).textContent = "Spike";
      el("rect", { x: pt[0] - 10, y: pt[1] - 10, width: 20, height: 20, rx: 4, transform: "rotate(45 " + pt[0] + " " + pt[1] + ")" }, g);
    }

    function drawMap() {
      var rnd = data.rounds[state.r];
      var ev = rnd.events[state.e];
      svg.innerHTML = "";

      // Spike stays on the map for every event from the plant onward.
      var plantIdx = -1;
      rnd.events.forEach(function (e, i) { if (e.kind === "plant" && plantIdx < 0) plantIdx = i; });
      if (plantIdx >= 0 && state.e >= plantIdx) spike(svg, rnd.events[plantIdx].x, rnd.events[plantIdx].y);

      var positions = {};
      ev.players.forEach(function (p) { positions[p[0]] = toPx(p[1], p[2]); });

      if (ev.kind === "kill") {
        var a = positions[ev.actor];
        var v = toPx(ev.x, ev.y);
        if (a) el("line", { "class": "replay-kill-line replay-" + teamOf(ev.actor), x1: a[0], y1: a[1], x2: v[0], y2: v[1] }, svg);
      }

      ev.players.forEach(function (p) { marker(svg, p[0], p[1], p[2], p[3]); });
      // The kill's victim isn't in the snapshot (already dead by then) —
      // drawn from the event's own location with an X.
      if (ev.kind === "kill" && ev.target) marker(svg, ev.target, ev.x, ev.y, null, { dead: true });
    }

    function select(r, e) {
      state.r = r;
      state.e = e;
      buildEvents();
      roundsEl.querySelectorAll(".replay-round-btn").forEach(function (b) {
        b.classList.toggle("active", Number(b.dataset.idx) === r);
      });
      eventsEl.querySelectorAll(".replay-event").forEach(function (b) {
        b.classList.toggle("active", Number(b.dataset.idx) === e);
      });
      drawMap();
    }

    function step(delta) {
      var rnd = data.rounds[state.r];
      var e = state.e + delta;
      if (e >= 0 && e < rnd.events.length) return select(state.r, e);
      var r = state.r + (delta > 0 ? 1 : -1);
      if (r < 0 || r >= data.rounds.length) return;
      select(r, delta > 0 ? 0 : data.rounds[r].events.length - 1);
    }

    root.querySelector(".replay-prev").addEventListener("click", function () { step(-1); });
    root.querySelector(".replay-next").addEventListener("click", function () { step(1); });
    root.addEventListener("keydown", function (evt) {
      if (evt.key === "ArrowRight" || evt.key === "ArrowDown") { evt.preventDefault(); step(1); }
      else if (evt.key === "ArrowLeft" || evt.key === "ArrowUp") { evt.preventDefault(); step(-1); }
    });

    buildRounds();
    select(0, 0);
  }

  document.querySelectorAll(".replay").forEach(init);
})();
