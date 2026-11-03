// AgentLens site: header state, score calculator, copy buttons.
// No dependencies.

(function () {
  "use strict";

  // ── Header border once the page scrolls ─────────────────────────────────
  var header = document.querySelector(".site-header");
  if (header) {
    var onScroll = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  // ── Copy buttons ────────────────────────────────────────────────────────
  document.querySelectorAll("[data-copy]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var pre = document.getElementById(btn.getAttribute("data-copy"));
      if (!pre) return;
      var text = pre.textContent
        .split("\n")
        .map(function (l) { return l.replace(/^\$\s?/, "").replace(/\s+#.*$/, ""); })
        .join("\n")
        .trim();
      var done = function () {
        var prev = btn.textContent;
        btn.textContent = "Copied";
        setTimeout(function () { btn.textContent = prev; }, 1600);
      };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(done, function () {});
      } else {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "absolute";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); done(); } catch (e) { /* ignore */ }
        document.body.removeChild(ta);
      }
    });
  });

  // ── Score calculator ────────────────────────────────────────────────────
  // Mirrors computeScore() in src/scoring/score.ts and detectRegressions()
  // in src/scoring/regressions.ts, using DEFAULT_CONFIG weights.
  var root = document.querySelector("[data-calc]");
  if (!root) return;

  var W = {
    base: 100,
    testRegression: 15,
    newFailure: 8,
    buildBreak: 40,
    coverage: 0.5,
    typeError: 3,
    lintError: 1,
    minScore: 70
  };

  var PRESETS = {
    session: { regressed: 3, newfail: 0, coverage: -2, types: 2, lint: -2, brk: false },
    clean:   { regressed: 0, newfail: 0, coverage: 1.5, types: -1, lint: -4, brk: false },
    brk:     { regressed: 0, newfail: 0, coverage: 0, types: 0, lint: 0, brk: true }
  };
  PRESETS["break"] = PRESETS.brk;

  var el = {
    regressed: root.querySelector("#f-regressed"),
    newfail: root.querySelector("#f-newfail"),
    coverage: root.querySelector("#f-coverage"),
    types: root.querySelector("#f-types"),
    lint: root.querySelector("#f-lint"),
    brk: root.querySelector("#f-break"),
    out: root.querySelector("[data-out]"),
    gate: root.querySelector("[data-gate]"),
    chips: root.querySelectorAll("[data-preset]")
  };

  var LIMITS = {
    regressed: [0, 99, 0],
    newfail: [0, 99, 0],
    coverage: [-100, 100, 1],
    types: [-99, 99, 0],
    lint: [-99, 99, 0]
  };

  function clampNum(name, raw) {
    var lim = LIMITS[name];
    var n = parseFloat(raw);
    if (!isFinite(n)) n = 0;
    n = Math.min(lim[1], Math.max(lim[0], n));
    var f = Math.pow(10, lim[2]);
    return Math.round(n * f) / f;
  }

  function read() {
    return {
      regressed: clampNum("regressed", el.regressed.value),
      newfail: clampNum("newfail", el.newfail.value),
      coverage: clampNum("coverage", el.coverage.value),
      types: clampNum("types", el.types.value),
      lint: clampNum("lint", el.lint.value),
      brk: el.brk.checked
    };
  }

  function compute(v) {
    var items = [];
    var regs = [];
    var push = function (reason, delta) { if (delta !== 0) items.push({ reason: reason, delta: delta }); };

    if (v.brk) {
      push("build break (test suite failed to run)", -W.buildBreak);
      regs.push({ sev: "critical", text: "Test suite failed to run (build break)" });
    } else {
      if (v.regressed > 0) {
        push("test regressions (" + v.regressed + ")", -(v.regressed * W.testRegression));
        regs.push({ sev: "high", text: v.regressed + " test(s) regressed (were passing, now failing)" });
      }
      if (v.newfail > 0) {
        push("new test failures (" + v.newfail + ")", -(v.newfail * W.newFailure));
        regs.push({ sev: "high", text: v.newfail + " new test failure(s) introduced" });
      }
      // Coverage needs a report from both runs; a suite that can't run has none.
      var sign = v.coverage >= 0 ? "+" : "";
      push("coverage delta (" + sign + v.coverage.toFixed(1) + "pp)", v.coverage * W.coverage);
    }

    if (v.types > 0) {
      push("type errors added (" + v.types + ")", -v.types * W.typeError);
      regs.push({ sev: "medium", text: v.types + " type error(s) introduced" });
    } else if (v.types < 0) {
      push("type errors removed (" + -v.types + ")", -v.types * W.typeError);
    }

    if (v.lint > 0) {
      push("lint errors added (" + v.lint + ")", -v.lint * W.lintError);
      regs.push({ sev: "low", text: v.lint + " lint error(s) introduced" });
    } else if (v.lint < 0) {
      push("lint errors removed (" + -v.lint + ")", -v.lint * W.lintError);
    }

    var adj = items.reduce(function (s, i) { return s + i.delta; }, 0);
    var score = Math.round(Math.min(100, Math.max(0, W.base + adj)));

    items.sort(function (a, b) { return a.reason.localeCompare(b.reason); });
    var order = { critical: 0, high: 1, medium: 2, low: 3 };
    regs.sort(function (a, b) {
      return (order[a.sev] - order[b.sev]) || a.text.localeCompare(b.text);
    });

    return { score: score, items: items, regs: regs, raw: W.base + adj };
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function span(cls, s) { return '<span class="' + cls + '">' + esc(s) + "</span>"; }
  function pad(s, n) { while (s.length < n) s += " "; return s; }

  var SEP = "─".repeat ? "─".repeat(48) : new Array(49).join("─");
  var SEV = {
    critical: ["r", "[critical]"],
    high: ["r", "[high]    "],
    medium: ["y", "[medium]  "],
    low: ["d", "[low]     "]
  };

  function render() {
    var v = read();
    var r = compute(v);

    var sc = r.score >= 80 ? "g" : r.score >= 60 ? "y" : "r";
    var lines = [];
    lines.push(span("b", "Score: ") + span(sc, String(r.score)) + span("d", " / 100"));
    lines.push(span("d", SEP));
    if (r.items.length === 0) {
      lines.push(span("d", "  (no adjustments — baseline unchanged)"));
    } else {
      r.items.forEach(function (i) {
        var d = i.delta >= 0 ? "+" + i.delta.toFixed(2) : i.delta.toFixed(2);
        lines.push("  " + esc(pad(i.reason, 36)) + " " + span(i.delta >= 0 ? "g" : "r", d));
      });
    }
    lines.push(span("d", SEP));
    if (r.regs.length === 0) {
      lines.push(span("d", "  No regressions detected."));
    } else {
      lines.push(span("b", "Regressions (" + r.regs.length + "):"));
      r.regs.forEach(function (g) {
        lines.push("  " + span(SEV[g.sev][0], SEV[g.sev][1]) + " " + esc(g.text));
      });
    }
    if (r.raw > 100 || r.raw < 0) {
      lines.push("");
      lines.push(span("d", "  raw " + r.raw.toFixed(2) + ", clamped to " + r.score));
    }
    el.out.innerHTML = lines.join("\n");

    var critical = r.regs.some(function (g) { return g.sev === "critical"; });
    var pass = r.score >= W.minScore && !critical;
    var why = critical
      ? "(critical regression: build break)"
      : pass
        ? "(score " + r.score + " ≥ min " + W.minScore + ")"
        : "(score " + r.score + " < min " + W.minScore + ")";
    el.gate.innerHTML =
      '<span class="b" style="color:#d7d8d3">CI gate, default --min-score ' + W.minScore + ":</span> " +
      (pass ? '<b style="color:var(--term-green)">✓ PASS</b> ' : '<b style="color:var(--term-red)">✗ FAIL</b> ') +
      esc(why);

    // Disable test inputs that can't apply when the suite doesn't run.
    ["regressed", "newfail", "coverage"].forEach(function (k) {
      var input = el[k];
      input.disabled = v.brk;
      input.closest(".field").classList.toggle("is-disabled", v.brk);
      input.parentNode.querySelectorAll("button").forEach(function (b) { b.disabled = v.brk; });
    });

    // Reflect which preset (if any) matches.
    el.chips.forEach(function (chip) {
      var p = PRESETS[chip.getAttribute("data-preset")];
      var match = p && p.brk === v.brk && (v.brk
        ? p.types === v.types && p.lint === v.lint
        : p.regressed === v.regressed && p.newfail === v.newfail &&
          p.coverage === v.coverage && p.types === v.types && p.lint === v.lint);
      chip.setAttribute("aria-pressed", match ? "true" : "false");
    });
  }

  function apply(p) {
    el.regressed.value = p.regressed;
    el.newfail.value = p.newfail;
    el.coverage.value = p.coverage;
    el.types.value = p.types;
    el.lint.value = p.lint;
    el.brk.checked = p.brk;
    render();
  }

  ["regressed", "newfail", "coverage", "types", "lint"].forEach(function (k) {
    var input = el[k];
    input.addEventListener("input", render);
    input.addEventListener("change", function () {
      input.value = clampNum(k, input.value);
      render();
    });
    input.parentNode.querySelectorAll("[data-step]").forEach(function (b) {
      b.addEventListener("click", function () {
        var step = parseFloat(b.getAttribute("data-step"));
        input.value = clampNum(k, clampNum(k, input.value) + step);
        render();
      });
    });
  });
  el.brk.addEventListener("change", render);
  el.chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      var p = PRESETS[chip.getAttribute("data-preset")];
      if (p) apply(p);
    });
  });

  render();
})();
