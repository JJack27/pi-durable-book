/* Personal Book Forger — shared book JS.
   Handles: localStorage scoring, TOC/dashboard, per-chapter tests,
   the light/dark theme toggle, and a small registry of interactive
   demos used across chapters.
   Loaded from each chapter via <script src="assets/book.js" defer>.

   CONFIG: every page sets window.BOOK_CONFIG inline (in a <script> block
   on the page itself, before this file loads) to override the defaults
   below — at minimum: slug (kebab-case book id), lang ("en"/"zh"/...),
   and chapters (ordered list of {n, slug}). The slug + lang form the
   localStorage key prefix so scores namespace per language. */

(function () {
  "use strict";

  // ---- Config (overridable per book via window.BOOK_CONFIG) ----
  // Replace these defaults with your book's values, OR (preferred) set
  // window.BOOK_CONFIG inline on every page just before <script src="assets/book.js">.
  var CFG = Object.assign({
    slug: "my-book",
    lang: "en",
    passThreshold: 80,
    chapters: [
      { n: 1, slug: "01-example-chapter" }
    ]
  }, window.BOOK_CONFIG || {});

  // ---- Utilities ----
  function normalize(s) {
    return String(s).trim().toLowerCase().replace(/\s+/g, " ");
  }
  function storageKey(chapter) { return "book:" + CFG.slug + ":" + CFG.lang + ":ch:" + chapter; }
  function loadScore(chapter) {
    try { var v = localStorage.getItem(storageKey(chapter)); return v ? JSON.parse(v) : null; }
    catch (e) { return null; }
  }
  function saveScore(chapter, score, total, percent) {
    try {
      localStorage.setItem(storageKey(chapter), JSON.stringify({
        score: score, total: total, percent: percent,
        pass: percent >= CFG.passThreshold, ts: Date.now()
      }));
    } catch (e) { /* localStorage unavailable (private mode) */ }
  }

  // ============================================================
  // CHAPTER PAGE: tests
  // ============================================================
  function scoreQuestion(q) {
    var type = q.getAttribute("data-type");
    if (type === "mcq") {
      var correct = JSON.parse(q.getAttribute("data-correct") || "[]");
      var multiselect = q.getAttribute("data-multiselect") === "true";
      if (multiselect) {
        var inputs = q.querySelectorAll('input[type="checkbox"]');
        var selected = Array.prototype.filter.call(inputs, function (i) { return i.checked; })
                                       .map(function (i) { return i.value; });
        var allRight = correct.every(function (c) { return selected.indexOf(c) >= 0; });
        var noWrong = selected.every(function (s) { return correct.indexOf(s) >= 0; });
        return (allRight && noWrong) ? 1 : 0;
      }
      var input = q.querySelector('input[type="radio"]:checked');
      return (input && correct.indexOf(input.value) >= 0) ? 1 : 0;
    }
    if (type === "fill") {
      var accepted = JSON.parse(q.getAttribute("data-accepted") || "[]").map(normalize);
      var fills = q.querySelectorAll("input.fill");
      if (fills.length === 1) {
        return (accepted.indexOf(normalize(fills[0].value)) >= 0) ? 1 : 0;
      }
      // multi-blank: each value in accepted, no duplicates
      var vals = Array.prototype.map.call(fills, function (f) { return normalize(f.value); });
      var allFilled = vals.every(function (v) { return v.length > 0; });
      var noDup = vals.length === new Set(vals).size;
      var matched = accepted.filter(function (a) { return vals.indexOf(a) >= 0; });
      return (allFilled && noDup && matched.length === vals.length) ? 1 : 0;
    }
    return 0;
  }

  function showFeedback(q, earned) {
    var fb = q.querySelector(".feedback");
    if (!fb) return;
    var correct = (earned >= 1), partial = (earned > 0 && earned < 1);
    fb.className = "feedback shown " + (correct ? "correct" : (partial ? "partial" : "wrong"));
    var verdict = correct ? "✓ Correct" : (partial ? "△ Partial credit" : "✗ Revisit this");
    var answer = q.getAttribute("data-answer") || "";
    var rationale = q.getAttribute("data-rationale") || "";
    var review = q.getAttribute("data-review");
    var html = "<strong>" + verdict + "</strong>";
    if (answer) html += "<div>" + answer + "</div>";
    if (rationale) html += "<div class='rationale'>" + rationale + "</div>";
    if (review) html += "<div class='review-link'>→ <a href='#" + review + "'>review this section</a></div>";
    fb.innerHTML = html;
  }

  function lockQuestion(q) {
    Array.prototype.forEach.call(q.querySelectorAll("input, textarea"), function (el) { el.disabled = true; });
  }

  function scoreTest(form) {
    var chNum = form.getAttribute("data-chapter");
    var questions = form.querySelectorAll(".q");
    var total = questions.length, earned = 0;
    Array.prototype.forEach.call(questions, function (q) {
      var e = scoreQuestion(q);
      earned += e;
      showFeedback(q, e);
      lockQuestion(q);
    });
    var percent = total ? Math.round(100 * earned / total) : 0;
    saveScore(chNum, earned, total, percent);

    var pass = percent >= CFG.passThreshold;
    var resultEl = form.querySelector(".test-result");
    if (resultEl) {
      resultEl.className = "test-result shown " + (pass ? "pass" : "fail");
      var verdict = pass
        ? "Learned enough to move forward. ✓"
        : "Below " + CFG.passThreshold + "%. Re-read the highlighted sections, then retake. (Nothing is locked — you can still read the next chapter.)";
      resultEl.innerHTML =
        "<div class='score'>" + percent + "%</div>" +
        "<div class='verdict'>" + verdict + "</div>";
    }
    var submitBtn = form.querySelector(".submit-test");
    if (submitBtn) submitBtn.disabled = true;
    var retakeBtn = form.querySelector(".retake-btn");
    if (retakeBtn) retakeBtn.hidden = false;
  }

  function resetTest(form) {
    Array.prototype.forEach.call(form.querySelectorAll(".q"), function (q) {
      Array.prototype.forEach.call(q.querySelectorAll("input, textarea"), function (el) {
        el.disabled = false;
        if (el.type === "checkbox" || el.type === "radio") el.checked = false;
        else el.value = "";
      });
      var fb = q.querySelector(".feedback");
      if (fb) { fb.className = "feedback"; fb.innerHTML = ""; }
    });
    var resultEl = form.querySelector(".test-result");
    if (resultEl) { resultEl.className = "test-result"; resultEl.innerHTML = ""; }
    var submitBtn = form.querySelector(".submit-test");
    if (submitBtn) submitBtn.disabled = false;
    var retakeBtn = form.querySelector(".retake-btn");
    if (retakeBtn) retakeBtn.hidden = true;
  }

  document.addEventListener("submit", function (e) {
    if (e.target.classList && e.target.classList.contains("test")) {
      e.preventDefault();
      scoreTest(e.target);
    }
  });
  document.addEventListener("click", function (e) {
    if (e.target.classList && e.target.classList.contains("retake-btn")) {
      var form = e.target.closest("form.test");
      if (form) resetTest(form);
    }
  });

  // ============================================================
  // CHAPTER PAGE: top nav (prev/next) + lang toggle
  // ============================================================
  function buildChapterNav(currentN) {
    var nav = document.querySelector(".topbar nav.chapter-nav");
    if (!nav) return;
    var ordered = CFG.chapters.slice().sort(function (a, b) { return a.n - b.n; });
    var prev = null, next = null;
    for (var i = 0; i < ordered.length; i++) {
      if (ordered[i].n === currentN) {
        prev = ordered[i - 1] || null;
        next = ordered[i + 1] || null;
      }
    }
    var html = "";
    if (prev) html += '<a href="' + prev.slug + '.html">← ' + prev.n + '</a>';
    else html += '<a class="disabled">←</a>';
    html += '<a href="index.html"> Contents</a>';
    if (next) html += '<a href="' + next.slug + '.html">' + next.n + ' →</a>';
    else html += '<a class="disabled">→</a>';
    nav.innerHTML = html;
  }

  // ============================================================
  // THEME (light/dark) — toggle button auto-injected into the topbar
  // ============================================================
  // The initial theme is applied BEFORE first paint by the tiny inline
  // snippet in each page's <head> (stored choice, else prefers-color-scheme,
  // else dark) so there is no flash of the wrong theme. Here we only inject
  // the toggle button and flip the attribute on click. The choice persists
  // in localStorage under a single book-agnostic key ("pbf:theme"), shared
  // across chapters AND languages (a reader's theme preference is not
  // per-language).
  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  }

  function initThemeToggle() {
    var topbar = document.querySelector(".topbar");
    if (!topbar || topbar.querySelector(".theme-toggle")) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "theme-toggle";
    btn.setAttribute("aria-label", "Toggle light/dark theme");
    function render() {
      var light = currentTheme() === "light";
      btn.textContent = light ? "☾" : "☀";
      btn.title = light ? "Switch to dark theme" : "Switch to light theme";
    }
    btn.addEventListener("click", function () {
      var next = currentTheme() === "light" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("pbf:theme", next); } catch (e) { /* private mode */ }
      render();
    });
    render();
    // Sit before the lang-toggle when there is one, else at the bar's end.
    var lang = topbar.querySelector(".lang-toggle");
    topbar.insertBefore(btn, lang || null);
  }

  // ============================================================
  // TOC PAGE: build cards + dashboard
  // ============================================================
  function buildTocPage() {
    var grid = document.querySelector(".chapter-grid");
    if (!grid) return;
    var descs = window.CHAPTER_DESCS || {};
    var passed = 0;
    grid.innerHTML = "";
    CFG.chapters.forEach(function (ch) {
      var rec = loadScore(ch.n);
      if (rec && rec.pass) passed++;
      var statusClass = rec ? (rec.pass ? "pass" : "fail") : "";
      var statusText = rec
        ? (rec.pass ? "✓ passed (" + rec.percent + "%)" : "● taken (" + rec.percent + "%)")
        : "○ not started";
      var card = document.createElement("a");
      card.className = "chapter-card";
      card.href = ch.slug + ".html";
      card.innerHTML =
        '<div class="ch-num">CHAPTER ' + ch.n + '</div>' +
        '<div class="ch-title">' + (descs[ch.n] ? descs[ch.n].title : ("Chapter " + ch.n)) + '</div>' +
        '<div class="ch-desc">' + (descs[ch.n] ? descs[ch.n].desc : "") + '</div>' +
        '<div class="ch-status"><span class="dot ' + statusClass + '"></span>' + statusText + '</div>';
      grid.appendChild(card);
    });
    var pct = Math.round(100 * passed / CFG.chapters.length);
    var pb = document.getElementById("overall-progress");
    if (pb) pb.style.width = pct + "%";
    var pctLabel = document.getElementById("progress-pct");
    if (pctLabel) pctLabel.textContent = pct + "%";
    var passedLabel = document.getElementById("progress-passed");
    if (passedLabel) passedLabel.textContent = passed + " / " + CFG.chapters.length;
  }

  // ============================================================
  // DEMOS — registry of interactive widgets.
  // Each chapter can include <div class="demo" data-demo="NAME">…</div>
  // blocks. NAME looks up a handler here, which receives the demo's
  // root element. The handler is bound to any <button data-run> inside
  // the demo (click), plus range/text inputs (input event) and radios
  // (change event) for live demos.
  //
  // This template ships an EMPTY registry — each book authors its own
  // demos below. Pattern:
  //
  //   var demos = {
  //     myDemo: function (root) {
  //       var out = root.querySelector(".demo-output");
  //       out.classList.remove("empty");
  //       out.textContent = "…result…";
  //     }
  //   };
  //
  // Then in a chapter: <div class="demo" data-demo="myDemo">
  //   <button data-run>Run</button>
  //   <div class="demo-output empty">Click to run.</div>
  // </div>
  // ============================================================
  var demos = {
    // 第 6 章：一次 commit 的原子性 —— 全成功落盘 / 中途抛异常整体回滚。
    commitDemo: function (root) {
      var out = root.querySelector(".demo-output");
      var mode = root.querySelector('input[name="commit-mode"]:checked');
      var fail = !!(mode && mode.value === "fail");
      out.classList.remove("empty");
      var lines = [];
      var push = function (s) { lines.push(s); out.textContent = lines.join("\n"); };
      out.textContent = "";
      push("await root.commit(async (tx) => {");
      push("  1. tx.appendEntry(pi.user …)          → 暂存写入#1");
      window.setTimeout(function () {
        push("  2. tx.doc(Todos).items.push('写文档')  → 暂存写入#2");
        if (fail) {
          window.setTimeout(function () {
            push("     💥 TypeError: cannot read undefined");
            push("  });");
            push("");
            push("✕ 回调抛异常 → storage.commit() 从未被调用");
            push("✕ 暂存写入#1、#2 全部作废 —— 存储零变化（原子回滚）");
            push("✕ 异常原样抛给 commit() 的调用者");
          }, 350);
          return;
        }
        window.setTimeout(function () {
          push("  3. tx.createTask(Cleanup …)           → 暂存写入#3");
          push("  4. return todos.items.length;");
          push("});");
          push("");
          window.setTimeout(function () {
            push("→ storage.commit([写入#1, 写入#2, 写入#3])  原子落盘 ✓");
            push("→ 返回 Seq 41；观察者收到一次完整的提交广播");
            push("→ commit() 的返回值 = 回调返回值 (3)");
          }, 350);
        }, 350);
      }, 350);
    },

    // 第 7 章：任务状态机 —— 检查点推进与崩溃后续跑。
    taskDemo: function (root) {
      var out = root.querySelector(".demo-output");
      var mode = root.querySelector('input[name="task-mode"]:checked');
      var crash = !!(mode && mode.value === "crash");
      var st = root._taskState;
      if (!st || st.mode !== crash) {
        st = root._taskState = {
          mode: crash,
          step: 0,
          seq: 100,
          log: [
            "任务 #7  app.payment（输入: { card: '4242…' }）",
          ],
        };
      }
      out.classList.remove("empty");
      var line = function (s) { st.log.push(s); };
      var draw = function () {
        out.textContent = st.log.join("\n") +
          "\n\n状态: " + st.status + "   检查点: " + st.checkpoint +
          (st.step >= 4 ? "" : "\n（再点一次「推进调度」继续）");
      };
      switch (st.step) {
        case 0:
          st.status = "pending"; st.checkpoint = "{ phase: 'charge' }";
          line("调度: pending → running（占用本进程调用）");
          line("相位 charge: 调支付接口 chargeCard('4242…') → txId 'tx_9f'");
          break;
        case 1:
          if (crash) {
            st.status = "— 进程死亡 —"; st.checkpoint = "{ phase: 'capture', txId: 'tx_9f' } 已落盘";
            line("runtime.commit: 检查点 → { phase: 'capture', txId: 'tx_9f' }   seq " + (++st.seq) + " ✓");
            line("");
            line("✕✕ 进程在 capture 相位执行前崩溃 ✕✕");
            line("重开存储 → 对账: running → pending（检查点无损）");
            line("resume() → 调度器从检查点继续:");
          } else {
            st.status = "running"; st.checkpoint = "{ phase: 'capture', txId: 'tx_9f' }";
            line("runtime.commit: 检查点 → { phase: 'capture', txId: 'tx_9f' }   seq " + (++st.seq) + " ✓");
            line("相位 capture: 用 txId 'tx_9f' 请款 → receiptId 'rc_21'");
          }
          break;
        case 2:
          if (crash) {
            st.status = "running"; st.checkpoint = "{ phase: 'capture', txId: 'tx_9f' }";
            line("相位 capture（续）: 用 txId 'tx_9f' 请款 → receiptId 'rc_21'");
            line("  ※ charge 没有重跑 —— 检查点已越过它");
          } else {
            st.status = "terminal"; st.checkpoint = "—";
            line("runtime.commit: 终局 { status: 'terminal', outcome: completed({ receiptId: 'rc_21' }) }  seq " + (++st.seq) + " ✓");
            line("任务 #7 terminal: completed");
          }
          break;
        case 3:
          if (crash) {
            st.status = "terminal"; st.checkpoint = "—";
            line("runtime.commit: 终局 { status: 'terminal', outcome: completed({ receiptId: 'rc_21' }) }  seq " + (++st.seq) + " ✓");
            line("任务 #7 terminal: completed（全程只扣了一次款）");
          }
          break;
        default:
          line("");
          line("（已终态。切换模式后重跑可看另一种命运）");
      }
      st.step++;
      draw();
    },

    // 第 10 章：忙碌会话的 inbox —— steer / followUp / reject / 纯 write 的落点。
    inboxDemo: function (root) {
      var out = root.querySelector(".demo-output");
      var mode = root.querySelector('input[name="inbox-mode"]:checked');
      var m = mode ? mode.value : "steer";
      out.classList.remove("empty");
      var bar = function (label, mark) {
        var cells = ["模型轮(工具调用)", "工具轮(bash 执行)", "模型轮(组织答案)", "回答完成"];
        var idx = cells.indexOf(label);
        var s = cells.map(function (c, i) {
          return i === idx ? ("[" + (mark || "◆") + " " + c + "]") : c;
        }).join(" → ");
        return "run: " + s;
      };
      var head = "此刻 run 正在进行:\n" + bar("模型轮(工具调用)");
      var text;
      if (m === "steer") {
        text = head + "\n\nsubmit({ type: 'input', content: '用 pnpm', whenBusy: 'steer' })\n" +
          "→ 立即接纳并排入 pi.inbox（落盘，不怕崩溃）\n" +
          "→ 落点: 当前工具轮之后\n" +
          bar("工具轮(bash 执行)") + "\n" +
          "→ 下一轮模型请求就带上这条新用户消息 —— 现在的 run 被它转向";
      } else if (m === "followUp") {
        text = head + "\n\nsubmit({ type: 'input', content: '顺便跑测试' })   // 默认 followUp\n" +
          "→ 立即接纳并排入 pi.inbox\n" +
          "→ 落点: 本 run 回答完成之后\n" +
          bar("回答完成") + "\n" +
          "→ 放置为 pi.user，开启下一个 run（此前模型看不见它）";
      } else if (m === "reject") {
        text = head + "\n\nsubmit({ type: 'input', content: '…', whenBusy: 'reject' })\n" +
          "→ 抛出 ConversationBusy\n" +
          "→ 什么都不写：没有条目、没有 inbox 项、没有提交记录";
      } else {
        text = head + "\n\nsubmit({ type: 'write', entry: { kind: 'chat.mention', data: { … } } })\n" +
          "→ 纯展示写入（只有 kind+data，模型所见不变）\n" +
          "→ 不排队，立即追加进转录 —— 聊天界面随发随显\n" +
          "（若带 model/head/edits，则像 steer 一样等边界）";
      }
      out.textContent = text + "\n\n配套: submission.abort() 可撤回还在排队的 input；" +
        "settings.steeringMode/followUpMode 决定边界一次放一条还是一批。";
    },
  };

  function initDemos() {
    var roots = document.querySelectorAll(".demo[data-demo]");
    Array.prototype.forEach.call(roots, function (root) {
      var name = root.getAttribute("data-demo");
      var handler = demos[name];
      if (!handler) return;
      var runBtns = root.querySelectorAll("button[data-run]");
      Array.prototype.forEach.call(runBtns, function (btn) {
        btn.addEventListener("click", function () { handler(root); });
      });
      // also auto-run on input change for range/text inputs
      var inputs = root.querySelectorAll('input[type="range"], input[type="text"]');
      Array.prototype.forEach.call(inputs, function (inp) {
        inp.addEventListener("input", function () { handler(root); });
      });
      // radio changes
      var radios = root.querySelectorAll('input[type="radio"]');
      Array.prototype.forEach.call(radios, function (r) {
        r.addEventListener("change", function () { handler(root); });
      });
    });
  }

  // ============================================================
  // BOOT
  // ============================================================
  function boot() {
    initDemos();
    initThemeToggle();
    buildTocPage(); // no-op if not on TOC page
    var chapterEl = document.querySelector("main.chapter");
    if (chapterEl) {
      var n = parseInt(chapterEl.getAttribute("data-chapter-n"), 10);
      if (n) buildChapterNav(n);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
