import { createServer } from 'node:http';
import { existsSync, readFile, statSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';

const port = Number(process.env.PORT ?? 8083);
const host = process.env.HOST ?? '127.0.0.1';
const root = resolve('dist');

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function sendFile(response, filePath) {
  readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }

    response.writeHead(200, {
      'Content-Type': contentTypes[extname(filePath)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store, max-age=0',
    });
    response.end(data);
  });
}

function sendMobileDemo(response, appPath = '/') {
  const safeAppPath = appPath.startsWith('/') && !appPath.startsWith('//') ? appPath : '/';
  const frameBust = `previewBust=${Date.now()}`;
  const frameSrc = `${safeAppPath}${safeAppPath.includes('?') ? '&' : '?'}mobilePreview=1&${frameBust}`;
  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0',
  });
  response.end(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Fluency Mobile Demo</title>
    <style>
      :root {
        color-scheme: light;
        --cream: #f4ecdf;
        --ink: #2a2520;
        --red: #c94d3a;
        --rim: #1f1f22;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background:
          radial-gradient(circle at 18% 8%, rgba(201, 77, 58, 0.12), transparent 28rem),
          linear-gradient(135deg, #221f20 0%, #3b332d 45%, #161618 100%);
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: var(--ink);
        padding: 24px;
      }
      .stage {
        display: grid;
        gap: 14px;
        justify-items: center;
      }
      .label {
        color: #fff8ed;
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        opacity: 0.86;
      }
      .phone {
        width: min(393px, calc(100vw - 28px));
        aspect-ratio: 393 / 852;
        max-height: calc(100vh - 74px);
        border: 12px solid var(--rim);
        border-radius: 46px;
        background: var(--rim);
        box-shadow: 0 28px 80px rgba(0, 0, 0, 0.45), inset 0 0 0 1px rgba(255,255,255,0.12);
        overflow: hidden;
        position: relative;
      }
      .screen {
        width: 100%;
        height: 100%;
        padding-top: 0;
        padding-bottom: 0;
        background: var(--cream);
      }
      .speaker {
        position: absolute;
        z-index: 4;
        top: 10px;
        left: 50%;
        width: 92px;
        height: 23px;
        transform: translateX(-50%);
        border-radius: 999px;
        background: #171719;
        box-shadow: inset 0 -1px 0 rgba(255,255,255,0.08);
        pointer-events: none;
      }
      iframe {
        width: 100%;
        height: 100%;
        border: 0;
        background: var(--cream);
        display: block;
      }
      @media (max-height: 760px) {
        body { padding: 12px; }
        .label { display: none; }
        .phone { max-height: calc(100vh - 24px); }
      }
    </style>
  </head>
  <body>
    <main class="stage">
      <div class="label">Mobile app preview · 393 x 852</div>
      <div class="phone">
        <div class="speaker"></div>
        <div class="screen">
          <iframe id="mobile-frame" src="${frameSrc}" title=""></iframe>
        </div>
      </div>
    </main>
  </body>
</html>`);
}

function sendResetPage(response) {
  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0',
  });
  response.end(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Reset Fluency Preview</title>
  </head>
  <body>
    <script>
      (async function resetPreview() {
        try {
          localStorage.clear();
          sessionStorage.clear();
          document.cookie.split(";").forEach(function(cookie) {
            document.cookie = cookie
              .replace(/^ +/, "")
              .replace(/=.*/, "=;expires=" + new Date(0).toUTCString() + ";path=/");
          });
          if (indexedDB.databases) {
            const databases = await indexedDB.databases();
            await Promise.all(databases.map(function(database) {
              return database.name
                ? new Promise(function(resolve) {
                    const request = indexedDB.deleteDatabase(database.name);
                    request.onsuccess = request.onerror = request.onblocked = resolve;
                  })
                : Promise.resolve();
            }));
          }
        } finally {
          location.replace("/");
        }
      })();
    </script>
  </body>
</html>`);
}

function sendVisualPrototype(response) {
  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0',
  });
  response.end(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Fluency Visual Prototype</title>
    <style>
      :root {
        --cream: #f6ecdc;
        --paper: #fff9ee;
        --ink: #1f1b18;
        --muted: #776e60;
        --line: #dfcfb6;
        --red: #d7422e;
        --red-dark: #a92c1d;
        --gold: #f2c94c;
        --blue: #2934e8;
        --teal: #258e78;
        --black: #111113;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        color: var(--ink);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background:
          radial-gradient(circle at 14% 12%, rgba(215, 66, 46, 0.18), transparent 28rem),
          radial-gradient(circle at 82% 12%, rgba(242, 201, 76, 0.18), transparent 26rem),
          linear-gradient(135deg, #1e1b1c 0%, #392d28 50%, #161619 100%);
        padding: 20px;
      }
      button { font: inherit; }
      .prototype {
        display: grid;
        grid-template-columns: minmax(320px, 393px) minmax(380px, 1fr);
        gap: 24px;
        align-items: start;
        max-width: 1280px;
        margin: 0 auto;
      }
      .phone {
        position: sticky;
        top: 20px;
        width: min(393px, calc(100vw - 40px));
        aspect-ratio: 393 / 852;
        border: 12px solid #18181b;
        border-radius: 46px;
        background: #18181b;
        box-shadow: 0 34px 90px rgba(0, 0, 0, 0.48);
        overflow: hidden;
      }
      .speaker {
        position: absolute;
        z-index: 8;
        top: 12px;
        left: 50%;
        width: 92px;
        height: 23px;
        transform: translateX(-50%);
        border-radius: 999px;
        background: #101014;
      }
      .screen {
        position: relative;
        height: 100%;
        overflow: hidden;
        background:
          radial-gradient(circle at 78% 16%, rgba(242, 201, 76, 0.12), transparent 12rem),
          radial-gradient(circle at 18% 72%, rgba(215, 66, 46, 0.08), transparent 16rem),
          linear-gradient(180deg, #fff6e7 0%, var(--cream) 62%, #f3e6d3 100%);
      }
      .screen::before,
      .screen::after {
        content: attr(data-glyph);
        position: absolute;
        z-index: 0;
        right: -118px;
        top: 190px;
        color: rgba(215, 66, 46, 0.07);
        font: 900 330px/1 Georgia, serif;
        transform: rotate(-12deg);
        pointer-events: none;
      }
      .screen::after {
        content: attr(data-glyph-alt);
        left: -88px;
        right: auto;
        top: 590px;
        color: rgba(169, 113, 36, 0.07);
        font-size: 230px;
        transform: rotate(14deg);
      }
      .view {
        position: relative;
        z-index: 1;
        display: none;
        height: 100%;
        padding: 66px 24px 118px;
        overflow: auto;
      }
      .view.active { display: block; }
      .top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 16px;
      }
      .brand {
        font: italic 28px/1 Georgia, serif;
        letter-spacing: -0.04em;
      }
      .brand b { color: var(--red); }
      .pills { display: flex; gap: 8px; align-items: center; }
      .pill {
        min-height: 40px;
        border: 2px solid #d9c8ad;
        border-radius: 999px;
        background: rgba(255, 249, 238, 0.72);
        padding: 0 14px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        font-weight: 900;
        box-shadow: 0 8px 18px rgba(78, 55, 31, 0.06);
      }
      .black-pill { background: #111113; color: #fff8ed; border-color: #111113; }
      .kicker {
        color: var(--red);
        font-weight: 900;
        letter-spacing: 0.28em;
        text-transform: uppercase;
        font-size: 12px;
      }
      h1, h2, h3, p { margin: 0; }
      h1 {
        font: 400 54px/0.96 Georgia, serif;
        letter-spacing: -0.055em;
      }
      h1 em, .script {
        color: var(--red);
        font-style: italic;
      }
      .hero-copy {
        margin-top: 12px;
        color: var(--muted);
        font-size: 15px;
        line-height: 1.45;
        font-weight: 760;
      }
      .lesson-card {
        margin-top: 18px;
        min-height: 154px;
        border: 1px solid rgba(169, 44, 29, 0.22);
        border-radius: 26px;
        color: #fff9ee;
        background:
          radial-gradient(circle at 92% 18%, rgba(255, 255, 255, 0.22), transparent 7rem),
          linear-gradient(135deg, #db3e2b 0%, #ee7058 100%);
        box-shadow: 0 18px 34px rgba(131, 40, 28, 0.22);
        padding: 20px;
        position: relative;
        overflow: hidden;
      }
      .lesson-card::after {
        content: "聴";
        position: absolute;
        right: -34px;
        bottom: -42px;
        font: 900 175px/1 Georgia, serif;
        color: rgba(255, 255, 255, 0.13);
      }
      .lesson-card h2 {
        width: 68%;
        font-size: 32px;
        line-height: 1;
        text-transform: uppercase;
        letter-spacing: -0.05em;
      }
      .play {
        position: absolute;
        right: 22px;
        top: 54px;
        width: 58px;
        height: 58px;
        border: 3px solid #111113;
        border-radius: 50%;
        background: var(--gold);
        display: grid;
        place-items: center;
        color: #111113;
        font-size: 22px;
        font-weight: 900;
      }
      .level-row {
        margin-top: 22px;
        display: flex;
        align-items: end;
        justify-content: space-between;
        font-weight: 900;
      }
      .progress {
        height: 14px;
        margin-top: 8px;
        border: 3px solid #111113;
        border-radius: 999px;
        overflow: hidden;
        background: #fff8ed;
      }
      .progress span { display: block; height: 100%; background: linear-gradient(90deg, var(--blue), #6474ff); width: 34%; }
      .grid {
        margin-top: 16px;
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
      }
      .skill {
        min-height: 96px;
        border: 2px solid rgba(17, 17, 19, 0.84);
        border-radius: 20px;
        padding: 13px;
        position: relative;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        justify-content: end;
        font-weight: 900;
      }
      .skill::before {
        content: attr(data-mark);
        position: absolute;
        right: -4px;
        top: -24px;
        font: 900 94px/1 Georgia, serif;
        opacity: 0.14;
      }
      .skill small { display: block; margin-top: 8px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
      .red { background: #ff4938; color: white; }
      .gold { background: var(--gold); color: #111; }
      .blue { background: var(--blue); color: white; }
      .cream { background: #fff7e8; }
      .black { background: #111113; color: var(--gold); }
      .teal { background: #2ba889; color: white; }
      .nav {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 6;
        height: 108px;
        background: rgba(255, 249, 238, 0.95);
        border-top: 1px solid var(--line);
        display: flex;
        justify-content: space-around;
        align-items: center;
        padding: 4px 14px 18px;
      }
      .nav button {
        border: 0;
        background: transparent;
        color: var(--muted);
        font-weight: 900;
        letter-spacing: 0.16em;
        font-size: 10px;
        display: grid;
        gap: 5px;
        place-items: center;
        cursor: pointer;
      }
      .nav button span {
        font-size: 28px;
        line-height: 1;
      }
      .nav button.active { color: var(--red); }
      .drill-head {
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 0 0 18px;
      }
      .x {
        width: 44px; height: 44px; border: 2px solid #d7c7ad; border-radius: 50%;
        display: grid; place-items: center; background: rgba(255,249,238,0.8); font-weight: 900;
      }
      .bars { flex: 1; display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; }
      .bars i { height: 9px; background: #dfd3bf; border-radius: 99px; }
      .bars i.done { background: var(--red); }
      .passage {
        border: 2px solid var(--line);
        border-radius: 25px;
        background: rgba(255, 249, 238, 0.82);
        padding: 22px;
        min-height: 216px;
        box-shadow: 0 16px 32px rgba(58, 42, 25, 0.08);
      }
      .passage .titleline { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
      .stamp {
        transform: rotate(-7deg);
        border: 2px dashed rgba(169, 44, 29, 0.45);
        background: var(--red-dark);
        color: #fff7e8;
        border-radius: 10px;
        padding: 9px 12px;
        font: 900 26px/1 Georgia, serif;
        box-shadow: 0 8px 0 rgba(169, 44, 29, 0.15);
      }
      .jp {
        margin-top: 18px;
        font-size: 22px;
        line-height: 1.7;
        font-weight: 570;
      }
      .question {
        margin-top: 20px;
        font: 400 34px/1.06 Georgia, serif;
        letter-spacing: -0.04em;
      }
      .choice {
        margin-top: 10px;
        min-height: 58px;
        border: 2px solid var(--line);
        border-radius: 19px;
        background: rgba(255, 249, 238, 0.9);
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 0 16px;
        font-weight: 860;
      }
      .choice b {
        width: 34px;
        height: 34px;
        border-radius: 12px;
        background: #efe4d1;
        display: grid;
        place-items: center;
      }
      .choice.correct { border-color: #35a65a; background: #e7f7df; }
      .result-num { font: 400 82px/0.95 Georgia, serif; letter-spacing: -0.07em; }
      .breakdown { margin-top: 24px; border-top: 1px solid var(--line); padding-top: 16px; }
      .metric { margin-top: 14px; }
      .metric .row { display: flex; justify-content: space-between; font: italic 22px/1 Georgia, serif; }
      .barline { height: 4px; background: #e5d8c3; margin-top: 8px; }
      .barline span { display: block; height: 100%; background: var(--red-dark); }
      .mock-grid, .report-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
        margin-top: 20px;
      }
      .tile {
        min-height: 126px;
        border: 2px solid var(--line);
        border-radius: 24px;
        background: rgba(255,249,238,0.8);
        padding: 16px;
        position: relative;
        overflow: hidden;
      }
      .tile::after {
        content: attr(data-mark);
        position: absolute;
        right: -14px;
        bottom: -26px;
        font: 900 105px/1 Georgia, serif;
        opacity: 0.12;
      }
      .tile h3 { font: 400 28px/1 Georgia, serif; }
      .tile small { color: var(--red); font-weight: 900; letter-spacing: 0.16em; text-transform: uppercase; }
      .week {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 7px;
        margin-top: 20px;
      }
      .day {
        aspect-ratio: 1;
        border: 2px solid #cdbb9d;
        background: var(--red-dark);
        color: #fff8ed;
        display: grid;
        place-items: center;
        font: 900 22px/1 Georgia, serif;
      }
      .collection { display: flex; gap: 12px; margin-top: 18px; }
      .coin {
        width: 62px; height: 62px; border-radius: 50%; background: #111113; color: var(--red);
        display: grid; place-items: center; font: 900 28px/1 Georgia, serif;
      }
      .lib-item {
        display: grid;
        grid-template-columns: 74px 1fr 44px;
        align-items: center;
        gap: 14px;
        border-bottom: 1px solid var(--line);
        padding: 18px 0;
      }
      .big-kanji { font: 400 48px/1 Georgia, serif; }
      .side {
        color: #fff8ed;
        display: grid;
        gap: 18px;
      }
      .side-card {
        background: rgba(255, 249, 238, 0.12);
        border: 1px solid rgba(255, 249, 238, 0.2);
        border-radius: 24px;
        padding: 22px;
        backdrop-filter: blur(14px);
      }
      .side h2 { font: 400 42px/1.02 Georgia, serif; letter-spacing: -0.045em; }
      .side p, .side li { color: rgba(255,248,237,0.82); line-height: 1.55; font-weight: 650; }
      .desktop-preview {
        position: relative;
        min-height: 420px;
        overflow: hidden;
        color: var(--ink);
        background:
          radial-gradient(circle at 92% 30%, rgba(215, 66, 46, 0.1), transparent 16rem),
          linear-gradient(180deg, #fff8eb 0%, #f3e7d4 100%);
      }
      .desktop-preview::after {
        content: "達";
        position: absolute;
        right: -52px;
        bottom: -96px;
        color: rgba(215, 66, 46, 0.06);
        font: 900 320px/1 Georgia, serif;
        transform: rotate(-11deg);
      }
      .desktop-shell {
        position: relative;
        z-index: 1;
        display: grid;
        gap: 20px;
      }
      .desktop-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
      }
      .desktop-header .brand {
        font-size: 32px;
      }
      .desktop-actions {
        display: flex;
        gap: 10px;
        align-items: center;
      }
      .desktop-hero {
        display: grid;
        grid-template-columns: minmax(0, 0.9fr) minmax(280px, 1.1fr);
        gap: 22px;
        align-items: end;
      }
      .desktop-title {
        font: 400 72px/0.9 Georgia, serif;
        letter-spacing: -0.065em;
      }
      .desktop-plan {
        min-height: 220px;
        border-radius: 30px;
        padding: 26px;
        color: #fff9ee;
        background:
          radial-gradient(circle at 88% 20%, rgba(255,255,255,0.2), transparent 10rem),
          linear-gradient(135deg, #d63c29, #ee765e);
        box-shadow: 0 18px 36px rgba(92, 40, 26, 0.18);
        position: relative;
        overflow: hidden;
      }
      .desktop-plan::after {
        content: "聴";
        position: absolute;
        right: -26px;
        bottom: -66px;
        font: 900 210px/1 Georgia, serif;
        color: rgba(255,255,255,0.14);
      }
      .desktop-plan h3 {
        max-width: 460px;
        font: 400 42px/1.02 Georgia, serif;
        letter-spacing: -0.035em;
      }
      .desktop-primary {
        width: fit-content;
        min-height: 50px;
        margin-top: 22px;
        border: 0;
        border-radius: 999px;
        background: #fff8ed;
        color: var(--red);
        padding: 0 22px;
        font-weight: 950;
      }
      .desktop-card-row {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 14px;
      }
      .desktop-card {
        min-height: 110px;
        border: 1px solid var(--line);
        border-radius: 22px;
        background: rgba(255,249,238,0.72);
        padding: 18px;
        box-shadow: 0 10px 24px rgba(58,42,25,0.06);
      }
      .desktop-card strong {
        display: block;
        margin-top: 10px;
        font: 400 34px/1 Georgia, serif;
      }
      .desktop-footer {
        display: flex;
        align-items: center;
        justify-content: space-around;
        min-height: 76px;
        border-top: 1px solid var(--line);
        color: var(--muted);
        font-size: 12px;
        font-weight: 900;
        letter-spacing: 0.18em;
      }
      .desktop-footer span {
        display: block;
        margin-bottom: 4px;
        text-align: center;
        font-size: 24px;
        letter-spacing: 0;
      }
      .tabs { display: flex; flex-wrap: wrap; gap: 8px; }
      .tabs button {
        border: 1px solid rgba(255,249,238,0.22);
        border-radius: 999px;
        background: rgba(255,249,238,0.1);
        color: #fff8ed;
        padding: 10px 13px;
        font-weight: 850;
        cursor: pointer;
      }
      .tabs button.active { background: #fff8ed; color: #1f1b18; }
      @media (max-width: 880px) {
        body { padding: 12px; }
        .prototype { grid-template-columns: 1fr; justify-items: center; }
        .phone { position: relative; top: auto; }
        .desktop-hero { grid-template-columns: 1fr; }
        .desktop-title { font-size: 50px; }
        .desktop-card-row { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <main class="prototype">
      <section class="phone">
        <div class="speaker"></div>
        <div class="screen" data-glyph="習" data-glyph-alt="達">
          <section class="view active" data-view="home">
            <div class="top">
              <div class="brand">Kibbo<b>.</b></div>
              <div class="pills"><div class="pill black-pill">🔥 7</div><div class="pill">K</div></div>
            </div>
            <div class="kicker">AP Japanese · LV 01</div>
            <h1>Ace AP<br><em>Japanese.</em></h1>
            <p class="hero-copy">One focused set at a time. Start with the skill most likely to raise your AP score.</p>
            <div class="lesson-card">
              <div class="kicker" style="color:#fff9ee">Next lesson · 3 Qs · +18 XP</div>
              <h2>Listening Set</h2>
              <div class="play">▶</div>
            </div>
            <div class="level-row"><div>LEVEL <span style="color:var(--blue)">01</span></div><div style="font-family:ui-monospace">008 / 070 XP</div></div>
            <div class="progress"><span></span></div>
            <div class="kicker" style="margin-top:18px;color:var(--ink);letter-spacing:.08em">Practice.</div>
            <div class="grid">
              <div class="skill red" data-mark="聴">LISTEN<small>12/40</small></div>
              <div class="skill gold" data-mark="読">READ<small>08/22</small></div>
              <div class="skill blue" data-mark="話">SPEAK<small>04/18</small></div>
              <div class="skill cream" data-mark="会">CHAT<small>02/24</small></div>
              <div class="skill black" data-mark="単">VOCAB<small>90/1200</small></div>
              <div class="skill cream" data-mark="文">GRAMMAR<small>06/30</small></div>
            </div>
          </section>

          <section class="view" data-view="drill">
            <div class="drill-head"><div class="x">×</div><div class="bars"><i class="done"></i><i class="done"></i><i></i><i></i><i></i><i></i><i></i></div><div class="pill">★ 12</div></div>
            <div class="kicker">Reading · level 01</div>
            <div class="passage">
              <div class="titleline"><h2 style="font:400 32px/1 Georgia,serif">Library note</h2><div class="pill">4:52</div></div>
              <div class="jp">今日は図書館で日本語の宿題をします。六時ごろ家に帰ります。</div>
            </div>
            <div class="question">What will the writer do first?</div>
            <div class="choice"><b>A</b>Go home</div>
            <div class="choice correct"><b>B</b>Do homework at the library</div>
            <div class="choice"><b>C</b>Call later</div>
          </section>

          <section class="view" data-view="result">
            <div class="kicker" style="text-align:center;margin-top:8px;color:var(--muted)">Set 04 · Summary</div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:36px">
              <div><div class="kicker">Result · Approved</div><h1 style="font-size:48px">Set complete,<br><em>nicely done.</em></h1></div>
              <div class="stamp">合格</div>
            </div>
            <div style="display:flex;align-items:end;gap:12px;margin-top:28px"><div class="result-num">89</div><div style="font:italic 34px Georgia;color:var(--muted)">/100</div><div style="margin-left:auto;color:var(--red);font-weight:900">+18 XP<br><em>Top 12%</em></div></div>
            <div class="breakdown">
              <div class="kicker" style="color:var(--muted)">Rubric breakdown</div>
              <div class="metric"><div class="row"><span>Listening</span><b>92 / 100</b></div><div class="barline"><span style="width:92%"></span></div></div>
              <div class="metric"><div class="row"><span>Comprehension</span><b>85 / 100</b></div><div class="barline"><span style="width:85%"></span></div></div>
              <div class="metric"><div class="row"><span>Vocabulary</span><b>91 / 100</b></div><div class="barline"><span style="width:91%"></span></div></div>
              <div class="metric"><div class="row"><span>Speed</span><b>78 / 100</b></div><div class="barline"><span style="width:78%"></span></div></div>
            </div>
          </section>

          <section class="view" data-view="mock">
            <div class="top"><div><div class="kicker">AP Japanese</div><h1 style="font-size:50px"><em>Mini Mock</em></h1></div><div class="stamp">試</div></div>
            <p class="hero-copy">A focused AP-shaped run: listening, reading, text chat, and live conversation.</p>
            <div class="report-grid">
              <div class="tile" data-mark="合"><small>Readiness</small><h3 style="font-size:40px;margin-top:18px">2/4</h3><p>In progress</p></div>
              <div class="tile" data-mark="点"><small>Estimate</small><h3 style="font-size:40px;margin-top:18px">AP 3</h3><p>Reading next</p></div>
            </div>
            <div class="mock-grid">
              <div class="tile red" data-mark="聴"><small style="color:#fff">Done</small><h3>Listening</h3></div>
              <div class="tile gold" data-mark="読"><small>Up next</small><h3>Reading</h3></div>
              <div class="tile cream" data-mark="返"><small>Part 3</small><h3>Text Chat</h3></div>
              <div class="tile cream" data-mark="話"><small>Part 4</small><h3>Convo</h3></div>
            </div>
          </section>

          <section class="view" data-view="growth">
            <div class="top"><div><div class="kicker">Progress · Week 03</div><h1 style="font-size:50px">7 <em>days</em></h1></div><div class="stamp">続</div></div>
            <div class="week"><div class="day">月</div><div class="day">火</div><div class="day">水</div><div class="day">木</div><div class="day">金</div><div class="day">土</div><div class="day" style="outline:4px solid #111">日</div></div>
            <div class="report-grid">
              <div class="tile" data-mark="経"><small>Total XP</small><h3>1,284</h3><p style="color:var(--red)">+18 today</p></div>
              <div class="tile" data-mark="語"><small>Words</small><h3>342</h3><p>of 1,200</p></div>
            </div>
            <div style="margin-top:24px;font:italic 34px Georgia">The Collection <span style="float:right;font:700 16px sans-serif;color:var(--muted)">04 / 12</span></div>
            <div class="collection"><div class="coin">初</div><div class="coin">週</div><div class="coin">百</div><div class="coin" style="opacity:.25">夜</div></div>
          </section>

          <section class="view" data-view="library">
            <div class="top"><div><div class="kicker">Library</div><h1 style="font-size:48px">Saved <em>& review</em></h1></div><div class="stamp">保</div></div>
            <div class="lib-item"><div class="big-kanji">本日</div><div><div class="kicker">AP keyword</div><h3>today (formal)</h3></div><div style="color:var(--red);font-size:38px">★</div></div>
            <div class="lib-item"><div class="big-kanji">中止</div><div><div class="kicker">Notice word</div><h3>cancellation</h3></div><div style="color:var(--red);font-size:38px">★</div></div>
            <div class="lib-item"><div class="big-kanji">返事</div><div><div class="kicker">Text chat result</div><h3>AP 4/5 · 4 saved turns</h3></div><div style="color:var(--red);font-size:38px">★</div></div>
          </section>

          <nav class="nav">
            <button class="active" data-go="home"><span>⌂</span>HOME</button>
            <button data-go="drill"><span>読</span>DRILL</button>
            <button data-go="mock"><span>◎</span>MOCK</button>
            <button data-go="growth"><span>続</span>GOALS</button>
          </nav>
        </div>
      </section>

      <aside class="side">
        <div class="side-card desktop-preview">
          <div class="desktop-shell">
            <div class="desktop-header">
              <div style="display:flex;align-items:center;gap:16px">
                <div class="brand">Kibbo<b>.</b></div>
                <div class="pill">● AP Edition</div>
              </div>
              <div class="desktop-actions">
                <div class="pill">🔥 7 day</div>
                <div class="pill">↔ Switch</div>
              </div>
            </div>
            <div class="desktop-hero">
              <div>
                <div class="kicker">AP Japanese · Level 01</div>
                <div class="desktop-title">Ace AP<br><em>Japanese.</em></div>
                <p class="hero-copy">Desktop keeps the same system, just wider: centered content, clean tabs, stronger skill color, and room for reading-heavy AP work.</p>
              </div>
              <div class="desktop-plan">
                <div class="kicker" style="color:#fff9ee">Today's plan · 18 min</div>
                <h3>Your listening accuracy is the weakest signal. Start there.</h3>
                <button class="desktop-primary">Start listening set →</button>
              </div>
            </div>
            <div class="desktop-card-row">
              <div class="desktop-card">
                <div class="kicker">Level</div>
                <strong>01</strong>
                <p style="color:var(--muted)">8 / 70 XP</p>
              </div>
              <div class="desktop-card">
                <div class="kicker">Development</div>
                <strong>0.14</strong>
                <p style="color:var(--muted)">steady climb</p>
              </div>
              <div class="desktop-card">
                <div class="kicker">Mini Mock</div>
                <strong>AP 3</strong>
                <p style="color:var(--muted)">reading next</p>
              </div>
            </div>
            <div class="desktop-footer">
              <div style="color:var(--red)"><span>⌂</span>Home</div>
              <div><span>□</span>Library</div>
              <div><span>◎</span>Mock</div>
            </div>
          </div>
        </div>
        <div class="side-card">
          <div class="kicker">Kibbo AP Edition</div>
          <h2>Cleaned visual prototype</h2>
          <p>This is still only a clickable style sketch. The phone mock is interactive; the desktop mock above shows how the same design language scales without becoming sparse or mismatched.</p>
        </div>
        <div class="side-card">
          <div class="tabs">
            <button class="active" data-go="home">Home</button>
            <button data-go="drill">Reading Drill</button>
            <button data-go="result">Result</button>
            <button data-go="mock">Mini Mock</button>
            <button data-go="growth">Development</button>
            <button data-go="library">Library</button>
          </div>
        </div>
        <div class="side-card">
          <h2 style="font-size:34px">What this tests</h2>
          <ul>
            <li>More color while keeping the cream and red AP identity.</li>
            <li>Skill-specific colors without fighting the main brand palette.</li>
            <li>Japanese seal moments for completion, streaks, saves, and scores.</li>
            <li>Background kanji that support the screen instead of covering it.</li>
            <li>Clearer mobile-first navigation and direction.</li>
          </ul>
        </div>
      </aside>
    </main>

    <script>
      const glyphs = {
        home: ['習', '達'],
        drill: ['読', '文'],
        result: ['合', '点'],
        mock: ['試', '合'],
        growth: ['続', '伸'],
        library: ['保', '復']
      };
      const screen = document.querySelector('.screen');
      const views = [...document.querySelectorAll('.view')];
      const buttons = [...document.querySelectorAll('[data-go]')];
      function show(name) {
        views.forEach(view => view.classList.toggle('active', view.dataset.view === name));
        buttons.forEach(button => button.classList.toggle('active', button.dataset.go === name));
        const nextGlyphs = glyphs[name] || glyphs.home;
        screen.dataset.glyph = nextGlyphs[0];
        screen.dataset.glyphAlt = nextGlyphs[1];
      }
      buttons.forEach(button => button.addEventListener('click', () => show(button.dataset.go)));
    </script>
  </body>
</html>`);
}

function sendVisualPrototypeNewsroom(response) {
  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0',
  });
  response.end(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Fluency Newsroom Prototype</title>
    <style>
      :root { --cream:#f7eddd; --paper:#fffaf0; --ink:#201b17; --muted:#766d60; --line:#d9c8ad; --red:#d84230; --plum:#572f3e; --sage:#59725c; --gold:#b87928; }
      * { box-sizing:border-box; }
      body { margin:0; min-height:100vh; font-family:Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color:var(--ink); background:linear-gradient(135deg,#211819,#392b25); padding:22px; }
      .wrap { max-width:1280px; margin:0 auto; display:grid; grid-template-columns:minmax(330px,410px) 1fr; gap:24px; align-items:start; }
      .phone { position:sticky; top:22px; aspect-ratio:393/852; border:12px solid #171719; border-radius:46px; background:#171719; overflow:hidden; box-shadow:0 34px 92px rgba(0,0,0,.48); }
      .speaker { position:absolute; z-index:5; top:12px; left:50%; width:96px; height:24px; transform:translateX(-50%); border-radius:999px; background:#111114; }
      .screen { position:relative; height:100%; overflow:hidden; background:radial-gradient(circle at 85% 16%,rgba(216,66,48,.09),transparent 13rem),linear-gradient(180deg,#fff8eb,#f2e5d2); }
      .screen:before { content:"聞"; position:absolute; right:-94px; top:154px; font:900 330px/1 Georgia,serif; color:rgba(87,47,62,.055); transform:rotate(-8deg); }
      .view { position:relative; z-index:1; height:100%; padding:66px 25px 116px; overflow:auto; }
      .top { display:flex; justify-content:space-between; align-items:center; gap:12px; }
      .brand { font:italic 29px/1 Georgia,serif; letter-spacing:-.04em; }
      .pill { min-height:38px; display:inline-flex; align-items:center; justify-content:center; border:1px solid var(--line); border-radius:999px; padding:0 13px; background:rgba(255,250,240,.76); font-weight:850; }
      .deck { margin-top:22px; border-top:1px solid var(--ink); border-bottom:1px solid var(--ink); padding:12px 0; display:flex; justify-content:space-between; color:var(--red); font-weight:950; letter-spacing:.2em; text-transform:uppercase; font-size:11px; }
      h1,h2,h3,p { margin:0; }
      h1 { margin-top:26px; font:400 58px/.92 Georgia,serif; letter-spacing:-.06em; }
      h1 em { color:var(--red); }
      .lede { margin-top:13px; color:var(--muted); font-size:16px; line-height:1.45; font-weight:720; }
      .lead-card { margin-top:24px; border-radius:24px; border:1px solid var(--line); background:rgba(255,250,240,.86); padding:20px; box-shadow:0 16px 32px rgba(73,50,25,.08); }
      .lead-card .label { color:var(--red); font-size:12px; letter-spacing:.24em; font-weight:950; text-transform:uppercase; }
      .lead-card h2 { margin-top:8px; font:400 36px/1 Georgia,serif; letter-spacing:-.04em; }
      .read-line { margin-top:18px; display:grid; grid-template-columns:1fr auto; gap:12px; align-items:center; }
      .start { min-height:50px; border:0; border-radius:999px; background:var(--red); color:#fffaf0; padding:0 18px; font-weight:950; }
      .index { margin-top:20px; display:grid; grid-template-columns:1fr 1fr; gap:12px; }
      .tile { min-height:112px; border:1px solid var(--line); border-radius:22px; background:rgba(255,250,240,.72); padding:16px; position:relative; overflow:hidden; }
      .tile:after { content:attr(data-mark); position:absolute; right:-12px; bottom:-26px; font:900 100px/1 Georgia,serif; color:rgba(216,66,48,.08); }
      .tile b { display:block; font:400 34px/1 Georgia,serif; }
      .tile span { color:var(--muted); font-weight:800; }
      .nav { position:absolute; left:0; right:0; bottom:0; height:108px; display:flex; justify-content:space-around; align-items:center; padding:4px 16px 18px; background:rgba(255,250,240,.96); border-top:1px solid var(--line); color:var(--muted); font-weight:900; letter-spacing:.16em; font-size:10px; text-transform:uppercase; }
      .nav div { display:grid; place-items:center; gap:5px; }
      .nav span { color:var(--red); font-size:30px; letter-spacing:0; }
      .desk { min-height:650px; border-radius:34px; padding:28px; background:linear-gradient(180deg,#fff9ef,#f3e7d4); color:var(--ink); overflow:hidden; position:relative; }
      .desk:after { content:"誌"; position:absolute; right:-46px; top:86px; font:900 430px/1 Georgia,serif; color:rgba(216,66,48,.045); transform:rotate(-9deg); }
      .desk-inner { position:relative; z-index:1; display:grid; gap:24px; }
      .desk-top { display:flex; justify-content:space-between; align-items:center; gap:18px; }
      .desk-hero { display:grid; grid-template-columns:.86fr 1.14fr; gap:24px; align-items:end; border-top:1px solid var(--line); padding-top:26px; }
      .desk-title { font:400 80px/.88 Georgia,serif; letter-spacing:-.065em; }
      .edition-card { min-height:246px; border-radius:28px; padding:28px; background:#251b1a; color:#fff9ef; position:relative; overflow:hidden; box-shadow:0 18px 36px rgba(30,20,14,.18); }
      .edition-card:after { content:"読"; position:absolute; right:-20px; bottom:-70px; font:900 230px/1 Georgia,serif; color:rgba(255,255,255,.1); }
      .edition-card h2 { max-width:560px; font:400 46px/1.02 Georgia,serif; }
      .columns { display:grid; grid-template-columns:1.2fr .8fr; gap:18px; }
      .panel { border:1px solid var(--line); border-radius:24px; background:rgba(255,250,240,.72); padding:20px; }
      .paper-row { display:grid; grid-template-columns:80px 1fr auto; gap:16px; align-items:center; padding:14px 0; border-bottom:1px solid var(--line); }
      .kanji { font:400 48px/1 Georgia,serif; }
      .side-note { color:#fff9ef; display:grid; gap:16px; }
      .side-note .card { border:1px solid rgba(255,250,240,.2); border-radius:24px; background:rgba(255,250,240,.1); padding:22px; }
      .side-note h2 { font:400 38px/1.02 Georgia,serif; letter-spacing:-.04em; }
      .side-note p { color:rgba(255,250,240,.82); line-height:1.55; font-weight:650; }
      @media (max-width:920px){ body{padding:12px}.wrap{grid-template-columns:1fr;justify-items:center}.phone{position:relative;top:auto;width:min(393px,calc(100vw - 24px))}.desk-hero,.columns{grid-template-columns:1fr}.desk-title{font-size:54px} }
    </style>
  </head>
  <body>
    <main class="wrap">
      <section class="phone">
        <div class="speaker"></div>
        <div class="screen">
          <div class="view">
            <div class="top"><div class="brand">Kibbo.</div><div class="pill">AP Edition</div></div>
            <div class="deck"><span>Morning Brief</span><span>Lv 01</span></div>
            <h1>The AP language paper,<br><em>made playable.</em></h1>
            <p class="lede">A quieter, editorial version with newspaper rhythm: headlines, briefs, issue cards, and score reports.</p>
            <div class="lead-card">
              <div class="label">Lead drill · Listening</div>
              <h2>Station announcement</h2>
              <p class="lede">3 questions · 7 minutes · instant AP-style notes</p>
              <div class="read-line"><button class="start">Start set →</button><div class="pill">+18 XP</div></div>
            </div>
            <div class="index">
              <div class="tile" data-mark="読"><b>Read</b><span>brief passages</span></div>
              <div class="tile" data-mark="話"><b>Speak</b><span>clear replies</span></div>
              <div class="tile" data-mark="返"><b>Chat</b><span>written turns</span></div>
              <div class="tile" data-mark="点"><b>Score</b><span>AP rubric</span></div>
            </div>
          </div>
          <nav class="nav"><div><span>⌂</span>Home</div><div><span>□</span>Library</div><div><span>◎</span>Mock</div></nav>
        </div>
      </section>
      <section class="desk">
        <div class="desk-inner">
          <div class="desk-top"><div style="display:flex;align-items:center;gap:16px"><div class="brand">Kibbo.</div><div class="pill">● AP Edition</div></div><div style="display:flex;gap:10px"><div class="pill">7 day</div><div class="pill">Switch</div></div></div>
          <div class="desk-hero">
            <div><div class="deck"><span>AP Japanese</span><span>Issue 01</span></div><div class="desk-title">Ace the exam<br><em style="color:var(--red)">like a daily paper.</em></div></div>
            <div class="edition-card"><div class="deck" style="border-color:rgba(255,255,255,.3);color:#fff9ef"><span>Today’s lead</span><span>18 min</span></div><h2>Your listening accuracy is dragging the score. Start with a clean mini set.</h2><button class="start" style="background:#fff9ef;color:var(--red);margin-top:24px">Start listening set →</button></div>
          </div>
          <div class="columns">
            <div class="panel"><div class="deck"><span>Saved & Review</span><span>3 items</span></div><div class="paper-row"><div class="kanji">本日</div><div><b>today (formal)</b><p class="lede">AP keyword</p></div><div style="color:var(--red);font-size:32px">★</div></div><div class="paper-row"><div class="kanji">返事</div><div><b>Text chat result</b><p class="lede">AP 4/5 · 4 saved turns</p></div><div style="color:var(--red);font-size:32px">★</div></div></div>
            <div class="panel"><div class="deck"><span>Development</span><span>Week 03</span></div><div style="font:400 72px/1 Georgia,serif">0.14</div><p class="lede">Recent work is slightly above your baseline. Keep listening sets warm.</p></div>
          </div>
        </div>
      </section>
      <aside class="side-note">
        <div class="card"><h2>Version 2 · Newsroom</h2><p>An alternate take on the newspaper-modern direction: more editorial, calmer, more AP-serious, but still tactile with stamps, issue cards, and collectible language.</p></div>
      </aside>
    </main>
  </body>
</html>`);
}

function sendVisualPrototypePlaybook(response) {
  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0',
  });
  response.end(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Fluency Playbook Prototype</title>
    <style>
      :root { --cream:#fff1d8; --paper:#fffaf0; --ink:#141414; --muted:#6f6558; --red:#ff4737; --yellow:#ffd64a; --blue:#2a36e8; --green:#2ea66f; --line:#171717; }
      *{box-sizing:border-box} body{margin:0;min-height:100vh;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:linear-gradient(135deg,#131313,#30231f);padding:22px;color:var(--ink)} button{font:inherit}
      .wrap{max-width:1280px;margin:0 auto;display:grid;grid-template-columns:minmax(330px,410px) 1fr;gap:24px;align-items:start}.phone{position:sticky;top:22px;aspect-ratio:393/852;border:12px solid #141414;border-radius:46px;background:#141414;overflow:hidden;box-shadow:0 34px 92px rgba(0,0,0,.5)}.speaker{position:absolute;z-index:5;top:12px;left:50%;width:96px;height:24px;transform:translateX(-50%);border-radius:999px;background:#050505}
      .screen{position:relative;height:100%;overflow:hidden;background:linear-gradient(180deg,#fff3dc,#f8e7ce)}.screen:before{content:"語";position:absolute;right:-70px;top:210px;font:900 330px/1 Georgia,serif;color:rgba(255,71,55,.08);transform:rotate(-8deg)}.view{position:relative;z-index:1;height:100%;padding:66px 24px 118px;overflow:auto}
      .top{display:flex;justify-content:space-between;align-items:center}.brand{font-weight:1000;font-style:italic;font-size:26px;letter-spacing:-.06em}.bubble{min-height:42px;border:3px solid var(--line);border-radius:999px;background:#fffaf0;padding:0 14px;display:inline-flex;align-items:center;gap:6px;font-weight:1000;box-shadow:0 5px 0 #141414}
      .tiny{color:var(--red);font-size:11px;font-weight:1000;letter-spacing:.18em;text-transform:uppercase}h1,h2,h3,p{margin:0}h1{margin-top:30px;font-size:58px;line-height:.88;font-weight:1000;letter-spacing:-.08em;text-transform:uppercase}.slash{display:inline;background:var(--yellow);box-decoration-break:clone;-webkit-box-decoration-break:clone;padding:0 6px}.sub{margin-top:12px;color:var(--muted);font-weight:800;line-height:1.4}
      .mission{margin-top:22px;min-height:170px;border:4px solid var(--line);border-radius:28px;background:var(--red);color:white;padding:20px;position:relative;box-shadow:0 9px 0 #141414;overflow:hidden}.mission:after{content:"聴";position:absolute;right:-20px;bottom:-50px;font:900 180px/1 Georgia,serif;color:rgba(255,255,255,.14)}.mission h2{font-size:38px;line-height:.92;text-transform:uppercase;max-width:210px}.go{position:absolute;right:22px;top:58px;width:62px;height:62px;border:4px solid #141414;border-radius:50%;background:var(--yellow);display:grid;place-items:center;color:#141414;font-weight:1000}
      .meter{margin-top:22px;display:flex;justify-content:space-between;font-weight:1000}.track{height:18px;border:3px solid #141414;border-radius:999px;margin-top:8px;background:#fffaf0;overflow:hidden}.track span{display:block;width:38%;height:100%;background:var(--blue)}
      .cards{margin-top:18px;display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.card{min-height:112px;border:4px solid #141414;border-radius:20px;padding:14px;position:relative;overflow:hidden;display:flex;flex-direction:column;justify-content:end;font-weight:1000;box-shadow:0 5px 0 #141414}.card:after{content:attr(data-mark);position:absolute;right:-6px;top:-22px;font:900 94px/1 Georgia,serif;opacity:.14}.red{background:var(--red);color:white}.yellow{background:var(--yellow)}.blue{background:var(--blue);color:white}.white{background:#fffaf0}.black{background:#141414;color:var(--yellow)}
      .nav{position:absolute;left:0;right:0;bottom:0;height:108px;background:#fffaf0;border-top:3px solid #141414;display:flex;justify-content:space-around;align-items:center;padding:4px 16px 18px;font-size:10px;font-weight:1000;letter-spacing:.12em;text-transform:uppercase}.nav div{display:grid;place-items:center;gap:4px}.nav span{font-size:30px;color:var(--red);letter-spacing:0}
      .desk{min-height:650px;border-radius:34px;background:#fff1d8;border:4px solid #141414;box-shadow:0 10px 0 #141414;padding:28px;position:relative;overflow:hidden}.desk:after{content:"練";position:absolute;right:-58px;bottom:-80px;font:900 390px/1 Georgia,serif;color:rgba(255,71,55,.08);transform:rotate(-8deg)}.desk-inner{position:relative;z-index:1;display:grid;gap:24px}.desk-top{display:flex;justify-content:space-between;align-items:center}.hero{display:grid;grid-template-columns:.9fr 1.1fr;gap:24px;align-items:end}.desk-title{font-size:84px;line-height:.84;font-weight:1000;letter-spacing:-.08em;text-transform:uppercase}.big-mission{min-height:260px;border:4px solid #141414;border-radius:30px;background:var(--red);color:white;padding:28px;box-shadow:0 9px 0 #141414;position:relative;overflow:hidden}.big-mission:after{content:"読";position:absolute;right:-18px;bottom:-76px;font:900 240px/1 Georgia,serif;color:rgba(255,255,255,.15)}.big-mission h2{font-size:48px;line-height:.92;text-transform:uppercase;max-width:520px}.desk-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.desk-card{min-height:150px;border:4px solid #141414;border-radius:22px;background:#fffaf0;padding:18px;box-shadow:0 6px 0 #141414;position:relative;overflow:hidden}.desk-card:after{content:attr(data-mark);position:absolute;right:-12px;bottom:-36px;font:900 120px/1 Georgia,serif;color:rgba(20,20,20,.08)}.desk-card strong{font-size:30px}.note{color:#fffaf0;display:grid;gap:16px}.note .panel{border:1px solid rgba(255,250,240,.2);border-radius:24px;background:rgba(255,250,240,.1);padding:22px}.note h2{font-size:38px;line-height:1;letter-spacing:-.04em}.note p{color:rgba(255,250,240,.82);line-height:1.55;font-weight:650}
      @media(max-width:920px){body{padding:12px}.wrap{grid-template-columns:1fr;justify-items:center}.phone{position:relative;top:auto;width:min(393px,calc(100vw - 24px))}.hero{grid-template-columns:1fr}.desk-title{font-size:54px}.desk-grid{grid-template-columns:1fr 1fr}}
    </style>
  </head>
  <body>
    <main class="wrap">
      <section class="phone"><div class="speaker"></div><div class="screen"><div class="view">
        <div class="top"><div class="brand">Kibbo.</div><div class="bubble">🔥 7</div></div>
        <div class="tiny" style="margin-top:26px">AP Japanese · Level 01</div><h1><span class="slash">Konnichiwa,</span><br>let’s drill.</h1><p class="sub">A louder, more game-like AP trainer: punchy colors, chunky cards, quick starts, and clear progress.</p>
        <div class="mission"><div class="tiny" style="color:white">Next · 3 questions · +18 XP</div><h2>Listening Set</h2><div class="go">▶</div></div>
        <div class="meter"><span>LEVEL 01</span><span>008 / 070 XP</span></div><div class="track"><span></span></div>
        <div class="cards"><div class="card red" data-mark="聴">LISTEN<br><small>12/40</small></div><div class="card yellow" data-mark="読">READ<br><small>08/22</small></div><div class="card blue" data-mark="話">SPEAK<br><small>04/18</small></div><div class="card white" data-mark="返">CHAT<br><small>02/24</small></div><div class="card black" data-mark="単">VOCAB<br><small>90/1200</small></div><div class="card white" data-mark="文">GRAMMAR<br><small>06/30</small></div></div>
      </div><nav class="nav"><div><span>⌂</span>Home</div><div><span>□</span>Library</div><div><span>◎</span>Mock</div></nav></div></section>
      <section class="desk"><div class="desk-inner"><div class="desk-top"><div class="brand" style="font-size:34px">Kibbo.</div><div style="display:flex;gap:12px"><div class="bubble">AP Edition</div><div class="bubble">Switch</div></div></div><div class="hero"><div><div class="tiny">AP Japanese · LV 01</div><div class="desk-title"><span class="slash">Konnichiwa,</span><br>let’s drill.</div><p class="sub">Desktop becomes a focused command center: bold mission, compact cards, consistent nav.</p></div><div class="big-mission"><div class="tiny" style="color:white">Today’s mission · 18 min</div><h2>Raise listening before the mini mock.</h2><button class="bubble" style="margin-top:24px">Start listening set →</button></div></div><div class="desk-grid"><div class="desk-card" data-mark="聴"><div class="tiny">Listen</div><strong>12/40</strong></div><div class="desk-card" data-mark="読"><div class="tiny">Read</div><strong>08/22</strong></div><div class="desk-card" data-mark="点"><div class="tiny">Score</div><strong>AP 3</strong></div><div class="desk-card" data-mark="続"><div class="tiny">Streak</div><strong>7 days</strong></div></div></div></section>
      <aside class="note"><div class="panel"><h2>Version 3 · Playbook</h2><p>A brighter, chunkier app direction. It borrows the confidence and immediacy of game UIs while keeping AP structure visible.</p></div></aside>
    </main>
  </body>
</html>`);
}

function sendVisualPrototypeDojo(response) {
  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0',
  });
  response.end(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Fluency Dojo Prototype</title>
    <style>
      :root{--ink:#18120f;--cream:#f7ead3;--paper:#fff8e8;--red:#c93424;--vermilion:#ef5d42;--jade:#2f8068;--indigo:#24356b;--gold:#dba84b;--line:#d7bea0}
      *{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 20% 10%,rgba(239,93,66,.22),transparent 28rem),linear-gradient(135deg,#120f13,#35221d 62%,#171316);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--ink);padding:22px}button{font:inherit}
      .stage{max-width:1280px;margin:0 auto;display:grid;grid-template-columns:minmax(330px,410px) 1fr;gap:24px;align-items:start}.phone{position:sticky;top:22px;aspect-ratio:393/852;border:12px solid #151518;border-radius:46px;background:#151518;overflow:hidden;box-shadow:0 34px 92px rgba(0,0,0,.52)}.speaker{position:absolute;z-index:5;top:12px;left:50%;width:96px;height:24px;transform:translateX(-50%);border-radius:999px;background:#050506}
      .screen{height:100%;position:relative;overflow:hidden;background:linear-gradient(180deg,#fff5df,#f1dfc5)}.screen:before{content:"道";position:absolute;left:-82px;top:172px;color:rgba(201,52,36,.075);font:900 360px/1 Georgia,serif;transform:rotate(12deg)}.screen:after{content:"勝";position:absolute;right:-80px;bottom:36px;color:rgba(36,53,107,.06);font:900 280px/1 Georgia,serif;transform:rotate(-9deg)}
      .view{position:relative;z-index:1;height:100%;padding:66px 24px 118px;overflow:auto}.top{display:flex;justify-content:space-between;align-items:center}.brand{font:italic 29px/1 Georgia,serif;letter-spacing:-.04em}.crest{width:48px;height:48px;border-radius:16px;background:var(--red);display:grid;place-items:center;color:white;font:400 30px/1 Georgia,serif;box-shadow:0 12px 24px rgba(201,52,36,.24)}
      .rank{margin-top:24px;display:flex;align-items:center;gap:10px;color:var(--red);font-size:12px;font-weight:950;letter-spacing:.22em;text-transform:uppercase}.rank:before{content:"";width:42px;height:2px;background:var(--red)}
      h1,h2,h3,p{margin:0}h1{margin-top:16px;font:400 62px/.92 Georgia,serif;letter-spacing:-.06em}.brush{font-style:italic;color:var(--red)}.sub{margin-top:12px;color:#756955;font-weight:750;line-height:1.45}
      .tatami{margin-top:22px;border-radius:30px;padding:20px;background:linear-gradient(135deg,#2b1f19,#5a2b22);color:#fff8e8;position:relative;overflow:hidden;box-shadow:0 22px 42px rgba(40,22,14,.22)}.tatami:after{content:"聴";position:absolute;right:-20px;bottom:-58px;font:900 190px/1 Georgia,serif;color:rgba(255,255,255,.12)}.tatami small{letter-spacing:.22em;text-transform:uppercase;font-weight:950;color:#ffd9c4}.tatami h2{margin-top:8px;font:400 40px/.96 Georgia,serif}.start{margin-top:20px;min-height:54px;border:0;border-radius:999px;background:#fff8e8;color:var(--red);padding:0 22px;font-weight:950}
      .belt{margin-top:22px;display:grid;grid-template-columns:1fr auto;gap:14px;align-items:end;font-weight:950}.bar{grid-column:1/-1;height:12px;border-radius:99px;background:#dfccb0;overflow:hidden}.bar span{display:block;height:100%;width:42%;background:linear-gradient(90deg,var(--red),var(--gold))}
      .kata{margin-top:18px;display:grid;grid-template-columns:1fr 1fr;gap:12px}.kata-card{min-height:112px;border:1px solid var(--line);border-radius:24px;background:rgba(255,248,232,.78);padding:16px;position:relative;overflow:hidden;box-shadow:0 12px 24px rgba(62,40,19,.08)}.kata-card:after{content:attr(data-mark);position:absolute;right:-10px;bottom:-26px;color:rgba(201,52,36,.08);font:900 104px/1 Georgia,serif}.kata-card b{display:block;font:400 31px/1 Georgia,serif}.kata-card span{color:#756955;font-weight:800}
      .nav{position:absolute;left:0;right:0;bottom:0;height:108px;display:flex;justify-content:space-around;align-items:center;padding:4px 16px 18px;background:rgba(255,248,232,.96);border-top:1px solid var(--line);color:#756955;font-size:10px;font-weight:950;letter-spacing:.15em;text-transform:uppercase}.nav div{display:grid;place-items:center;gap:5px}.nav span{font-size:30px;color:var(--red);letter-spacing:0}
      .desktop{min-height:650px;border-radius:36px;padding:30px;background:linear-gradient(135deg,#fff7e5,#ead5b5);position:relative;overflow:hidden}.desktop:before{content:"稽";position:absolute;right:-46px;top:40px;font:900 420px/1 Georgia,serif;color:rgba(201,52,36,.055);transform:rotate(-8deg)}.desktop-inner{position:relative;z-index:1;display:grid;gap:24px}.desktop-top{display:flex;justify-content:space-between;align-items:center}.pill{min-height:44px;border:1px solid var(--line);border-radius:999px;background:rgba(255,248,232,.78);display:inline-flex;align-items:center;padding:0 16px;font-weight:900}.desktop-hero{display:grid;grid-template-columns:.85fr 1.15fr;gap:24px;align-items:end}.desktop-title{font:400 82px/.88 Georgia,serif;letter-spacing:-.06em}.dojo-panel{min-height:260px;border-radius:32px;padding:28px;background:linear-gradient(135deg,#241b18,#7f3024);color:#fff8e8;box-shadow:0 22px 42px rgba(64,30,20,.24);position:relative;overflow:hidden}.dojo-panel:after{content:"勝";position:absolute;right:-18px;bottom:-80px;font:900 250px/1 Georgia,serif;color:rgba(255,255,255,.12)}.dojo-panel h2{font:400 48px/.98 Georgia,serif;max-width:560px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.desk-card{min-height:142px;border:1px solid var(--line);border-radius:24px;background:rgba(255,248,232,.72);padding:18px}.desk-card b{font:400 36px/1 Georgia,serif}.note{color:#fff8e8;display:grid;gap:16px}.note .panel{border:1px solid rgba(255,248,232,.2);background:rgba(255,248,232,.1);border-radius:24px;padding:22px}.note h2{font:400 38px/1 Georgia,serif}.note p{color:rgba(255,248,232,.82);line-height:1.55;font-weight:650}
      @media(max-width:920px){body{padding:12px}.stage{grid-template-columns:1fr;justify-items:center}.phone{position:relative;top:auto;width:min(393px,calc(100vw - 24px))}.desktop-hero{grid-template-columns:1fr}.desktop-title{font-size:56px}.grid{grid-template-columns:1fr 1fr}}
    </style>
  </head>
  <body>
    <main class="stage">
      <section class="phone"><div class="speaker"></div><div class="screen"><div class="view"><div class="top"><div class="brand">Kibbo.</div><div class="crest">日</div></div><div class="rank">AP Dojo · Level 01</div><h1>Train with<br><span class="brush">purpose.</span></h1><p class="sub">A cinematic mastery path: each drill is a kata, each mock is a belt test, each result becomes a stamp.</p><div class="tatami"><small>Today’s kata · Listening</small><h2>Station announcement</h2><button class="start">Begin kata →</button></div><div class="belt"><div>White belt</div><div>8 / 70 XP</div><div class="bar"><span></span></div></div><div class="kata"><div class="kata-card" data-mark="聴"><b>Listen</b><span>ear training</span></div><div class="kata-card" data-mark="読"><b>Read</b><span>passages</span></div><div class="kata-card" data-mark="話"><b>Speak</b><span>response form</span></div><div class="kata-card" data-mark="点"><b>Score</b><span>AP rubric</span></div></div></div><nav class="nav"><div><span>⌂</span>Home</div><div><span>□</span>Library</div><div><span>◎</span>Mock</div></nav></div></section>
      <section class="desktop"><div class="desktop-inner"><div class="desktop-top"><div style="display:flex;align-items:center;gap:16px"><div class="brand" style="font-size:34px">Kibbo.</div><div class="pill">AP Dojo</div></div><div style="display:flex;gap:12px"><div class="pill">White belt</div><div class="pill">Switch</div></div></div><div class="desktop-hero"><div><div class="rank">AP Japanese</div><div class="desktop-title">Train with<br><span class="brush">purpose.</span></div><p class="sub">Desktop becomes a quiet training hall: clear routines, strong progress rituals, and AP readiness as the north star.</p></div><div class="dojo-panel"><div class="rank" style="color:#ffd8c8">Today’s kata · 18 min</div><h2>Build listening stamina before the next belt test.</h2><button class="start">Begin listening kata →</button></div></div><div class="grid"><div class="desk-card"><span class="rank">Listen</span><b>12/40</b></div><div class="desk-card"><span class="rank">Read</span><b>08/22</b></div><div class="desk-card"><span class="rank">Mock</span><b>AP 3</b></div><div class="desk-card"><span class="rank">Streak</span><b>7</b></div></div></div></section>
      <aside class="note"><div class="panel"><h2>Version 4 · AP Dojo</h2><p>A totally different, cinematic mastery style. It frames AP prep as disciplined training with belts, kata, stamps, and quiet confidence.</p></div></aside>
    </main>
  </body>
</html>`);
}

function sendVisualPrototypeOrbit(response) {
  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0',
  });
  response.end(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Fluency Orbit Prototype</title>
    <style>
      :root{--bg:#101216;--panel:#171b22;--paper:#f8efe1;--ink:#171717;--muted:#7b756d;--red:#e24735;--cyan:#47c6b6;--violet:#6e66ff;--lime:#aee35e;--line:rgba(248,239,225,.14)}
      *{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 20% 12%,rgba(110,102,255,.22),transparent 26rem),radial-gradient(circle at 78% 20%,rgba(226,71,53,.18),transparent 28rem),#0f1115;color:var(--paper);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:22px}button{font:inherit}
      .wrap{max-width:1280px;margin:0 auto;display:grid;grid-template-columns:minmax(330px,410px) 1fr;gap:24px;align-items:start}.phone{position:sticky;top:22px;aspect-ratio:393/852;border:12px solid #050608;border-radius:46px;background:#050608;overflow:hidden;box-shadow:0 34px 92px rgba(0,0,0,.54)}.speaker{position:absolute;z-index:5;top:12px;left:50%;width:96px;height:24px;transform:translateX(-50%);border-radius:999px;background:#000}
      .screen{height:100%;position:relative;overflow:hidden;background:linear-gradient(180deg,#141923,#0f1115)}.screen:before{content:"日本語";position:absolute;right:-110px;top:150px;color:rgba(255,255,255,.035);font:900 150px/1 Georgia,serif;writing-mode:vertical-rl}.view{position:relative;z-index:1;height:100%;padding:66px 24px 118px;overflow:auto}.top{display:flex;justify-content:space-between;align-items:center}.brand{font-weight:950;font-size:25px;letter-spacing:-.05em}.chip{min-height:40px;border:1px solid var(--line);border-radius:999px;background:rgba(248,239,225,.08);display:inline-flex;align-items:center;padding:0 14px;font-weight:900;color:var(--paper);backdrop-filter:blur(14px)}
      .tag{margin-top:28px;color:var(--cyan);font-size:11px;letter-spacing:.22em;text-transform:uppercase;font-weight:950}h1,h2,h3,p{margin:0}h1{margin-top:12px;font-size:58px;line-height:.9;letter-spacing:-.075em}.accent{color:var(--red)}.sub{margin-top:12px;color:rgba(248,239,225,.68);font-weight:720;line-height:1.45}
      .mission{margin-top:24px;border:1px solid var(--line);border-radius:30px;padding:20px;background:linear-gradient(135deg,rgba(226,71,53,.95),rgba(110,102,255,.72));position:relative;overflow:hidden;box-shadow:0 22px 42px rgba(0,0,0,.25)}.mission:after{content:"聴";position:absolute;right:-20px;bottom:-56px;font:900 180px/1 Georgia,serif;color:rgba(255,255,255,.11)}.mission h2{max-width:220px;font-size:38px;line-height:.95;letter-spacing:-.055em}.launch{margin-top:20px;min-height:52px;border:0;border-radius:16px;background:var(--paper);color:var(--red);padding:0 18px;font-weight:950}
      .orbit{margin-top:22px;height:142px;border:1px solid var(--line);border-radius:26px;background:rgba(248,239,225,.06);position:relative;overflow:hidden}.ring{position:absolute;border:1px solid rgba(248,239,225,.16);border-radius:50%;inset:20px 70px}.planet{position:absolute;width:54px;height:54px;border-radius:50%;display:grid;place-items:center;font-weight:950}.p1{left:28px;top:44px;background:var(--red)}.p2{left:138px;top:16px;background:var(--cyan);color:#07100f}.p3{right:34px;top:54px;background:var(--lime);color:#111}.center{position:absolute;left:50%;top:52%;transform:translate(-50%,-50%);font-weight:950;color:rgba(248,239,225,.72)}
      .grid{margin-top:18px;display:grid;grid-template-columns:1fr 1fr;gap:12px}.card{min-height:104px;border:1px solid var(--line);border-radius:24px;background:rgba(248,239,225,.08);padding:16px;position:relative;overflow:hidden}.card b{display:block;font-size:28px}.card span{color:rgba(248,239,225,.62);font-weight:750}.nav{position:absolute;left:0;right:0;bottom:0;height:108px;background:rgba(15,17,21,.92);border-top:1px solid var(--line);display:flex;justify-content:space-around;align-items:center;padding:4px 16px 18px;font-size:10px;font-weight:950;letter-spacing:.15em;text-transform:uppercase;color:rgba(248,239,225,.62)}.nav div{display:grid;place-items:center;gap:5px}.nav span{font-size:30px;color:var(--cyan);letter-spacing:0}
      .desk{min-height:650px;border:1px solid var(--line);border-radius:34px;background:linear-gradient(180deg,#171b22,#101216);padding:28px;overflow:hidden;position:relative}.desk:before{content:"成長";position:absolute;right:-90px;top:40px;color:rgba(248,239,225,.035);font:900 190px/1 Georgia,serif;writing-mode:vertical-rl}.desk-inner{position:relative;z-index:1;display:grid;gap:24px}.desk-top{display:flex;justify-content:space-between;align-items:center}.hero{display:grid;grid-template-columns:.9fr 1.1fr;gap:24px;align-items:center}.desk-title{font-size:82px;line-height:.86;letter-spacing:-.08em}.control{min-height:260px;border:1px solid var(--line);border-radius:30px;background:radial-gradient(circle at 78% 22%,rgba(71,198,182,.28),transparent 13rem),linear-gradient(135deg,rgba(226,71,53,.92),rgba(110,102,255,.72));padding:28px;position:relative;overflow:hidden}.control h2{font-size:48px;line-height:.95;letter-spacing:-.06em;max-width:560px}.dash{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.dash-card{min-height:142px;border:1px solid var(--line);border-radius:24px;background:rgba(248,239,225,.07);padding:18px}.dash-card b{font-size:34px}.note{display:grid;gap:16px}.note .panel{border:1px solid var(--line);background:rgba(248,239,225,.08);border-radius:24px;padding:22px}.note h2{font-size:38px;line-height:1;letter-spacing:-.04em}.note p{color:rgba(248,239,225,.72);line-height:1.55;font-weight:650}
      @media(max-width:920px){body{padding:12px}.wrap{grid-template-columns:1fr;justify-items:center}.phone{position:relative;top:auto;width:min(393px,calc(100vw - 24px))}.hero{grid-template-columns:1fr}.desk-title{font-size:56px}.dash{grid-template-columns:1fr 1fr}}
    </style>
  </head>
  <body>
    <main class="wrap">
      <section class="phone"><div class="speaker"></div><div class="screen"><div class="view"><div class="top"><div class="brand">Kibbo.</div><div class="chip">AP Orbit</div></div><div class="tag">Japanese · Mission 01</div><h1>Lock onto<br><span class="accent">AP fluency.</span></h1><p class="sub">A sleek mission-control direction: skills become planets, progress is telemetry, and every lesson has one clear launch.</p><div class="mission"><div class="tag" style="margin-top:0;color:white">Next launch · Listening</div><h2>Audio signal set</h2><button class="launch">Launch drill →</button></div><div class="orbit"><div class="ring"></div><div class="planet p1">聴</div><div class="planet p2">読</div><div class="planet p3">話</div><div class="center">LV 01</div></div><div class="grid"><div class="card"><b>8 XP</b><span>to orbit</span></div><div class="card"><b>AP 3</b><span>estimate</span></div><div class="card"><b>7</b><span>day streak</span></div><div class="card"><b>342</b><span>words</span></div></div></div><nav class="nav"><div><span>⌂</span>Home</div><div><span>□</span>Library</div><div><span>◎</span>Mock</div></nav></div></section>
      <section class="desk"><div class="desk-inner"><div class="desk-top"><div class="brand" style="font-size:34px">Kibbo.</div><div style="display:flex;gap:12px"><div class="chip">AP Orbit</div><div class="chip">Switch</div></div></div><div class="hero"><div><div class="tag">AP Japanese · Mission Control</div><div class="desk-title">Lock onto<br><span class="accent">AP fluency.</span></div><p class="sub">Desktop becomes a command center for progress, weak signals, and exam readiness.</p></div><div class="control"><div class="tag" style="margin-top:0;color:white">Priority signal · 18 min</div><h2>Listening accuracy is below orbit. Launch a focused set.</h2><button class="launch">Launch listening drill →</button></div></div><div class="dash"><div class="dash-card"><span class="tag">Signal</span><b>Listen</b></div><div class="dash-card"><span class="tag">Readiness</span><b>AP 3</b></div><div class="dash-card"><span class="tag">Trend</span><b>+0.14</b></div><div class="dash-card"><span class="tag">Streak</span><b>7</b></div></div></div></section>
      <aside class="note"><div class="panel"><h2>Version 5 · Orbit</h2><p>A totally different sleek, dark mission-control direction. It makes AP mastery feel like tracking signals and launching focused drills.</p></div></aside>
    </main>
  </body>
</html>`);
}

function sendVisualPrototypePath(response) {
  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0',
  });
  response.end(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Fluency Path Prototype</title>
    <style>
      :root{--cream:#f7efe1;--paper:#fffaf1;--ink:#1d1914;--muted:#746b5e;--red:#d94331;--green:#2f9f69;--gold:#e2a940;--blue:#3157b7;--line:#ddcdb4}
      *{box-sizing:border-box}body{margin:0;min-height:100vh;padding:22px;background:linear-gradient(135deg,#211b18,#33261f);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--ink)}button{font:inherit}
      .wrap{max-width:1280px;margin:0 auto;display:grid;grid-template-columns:minmax(330px,410px) 1fr;gap:24px;align-items:start}.phone{position:sticky;top:22px;aspect-ratio:393/852;border:12px solid #171719;border-radius:46px;background:#171719;overflow:hidden;box-shadow:0 34px 92px rgba(0,0,0,.5)}.speaker{position:absolute;z-index:6;top:12px;left:50%;width:96px;height:24px;transform:translateX(-50%);border-radius:999px;background:#09090a}
      .screen{height:100%;overflow:hidden;position:relative;background:linear-gradient(180deg,#fff8ea,#f2e4cf)}.screen:before{content:"道";position:absolute;right:-120px;top:120px;font:900 360px/1 Georgia,serif;color:rgba(217,67,49,.06);transform:rotate(-14deg)}.view{position:relative;z-index:1;height:100%;padding:66px 24px 118px;overflow:auto}
      .top{display:flex;justify-content:space-between;align-items:center}.brand{font:italic 28px/1 Georgia,serif;letter-spacing:-.04em}.chip{min-height:40px;border:1px solid var(--line);border-radius:999px;background:rgba(255,250,241,.8);display:inline-flex;align-items:center;padding:0 14px;font-weight:900}.eyebrow{color:var(--red);font-size:12px;letter-spacing:.22em;text-transform:uppercase;font-weight:950}
      h1,h2,h3,p{margin:0}h1{margin-top:20px;font:400 48px/.96 Georgia,serif;letter-spacing:-.05em}.sub{margin-top:8px;color:var(--muted);font-size:15px;line-height:1.4;font-weight:740}
      .map{position:relative;margin-top:26px;min-height:520px}.path-line{position:absolute;left:50%;top:20px;bottom:30px;width:8px;transform:translateX(-50%);border-radius:99px;background:linear-gradient(180deg,var(--green),var(--gold),var(--red));opacity:.28}.node{position:relative;width:176px;min-height:104px;border:1px solid var(--line);border-radius:26px;background:rgba(255,250,241,.88);box-shadow:0 14px 28px rgba(66,43,20,.1);padding:14px;margin-bottom:18px}.node:nth-child(even){margin-left:auto}.node.active{background:var(--red);color:#fffaf1;border-color:transparent;box-shadow:0 18px 34px rgba(217,67,49,.24)}.node.done{background:#eff7e9}.node .badge{width:44px;height:44px;border-radius:16px;display:grid;place-items:center;background:#f0dfc6;color:var(--red);font:400 28px/1 Georgia,serif;margin-bottom:10px}.node.active .badge{background:#fffaf1}.node b{display:block;font-size:18px}.node span{display:block;margin-top:3px;color:inherit;opacity:.72;font-size:12px;font-weight:800}
      .dock{position:absolute;left:20px;right:20px;bottom:118px;border-radius:26px;background:#201917;color:#fffaf1;padding:16px;display:flex;align-items:center;justify-content:space-between;gap:12px;box-shadow:0 16px 34px rgba(0,0,0,.22)}.dock b{font-size:18px}.dock button{border:0;border-radius:999px;background:var(--gold);min-height:44px;padding:0 16px;font-weight:950;color:#1d1914}.nav{position:absolute;left:0;right:0;bottom:0;height:108px;background:rgba(255,250,241,.96);border-top:1px solid var(--line);display:flex;justify-content:space-around;align-items:center;padding:4px 16px 18px;color:var(--muted);font-size:10px;font-weight:950;letter-spacing:.16em;text-transform:uppercase}.nav div{display:grid;place-items:center;gap:5px}.nav span{font-size:30px;color:var(--red);letter-spacing:0}
      .desk{min-height:650px;border-radius:34px;background:linear-gradient(180deg,#fff8ea,#f0dfc7);padding:30px;position:relative;overflow:hidden}.desk:after{content:"旅";position:absolute;right:-62px;bottom:-96px;color:rgba(217,67,49,.055);font:900 430px/1 Georgia,serif;transform:rotate(-10deg)}.desk-inner{position:relative;z-index:1;display:grid;grid-template-columns:360px 1fr;gap:26px}.panel{border:1px solid var(--line);border-radius:28px;background:rgba(255,250,241,.74);padding:22px;box-shadow:0 12px 28px rgba(66,43,20,.08)}.desk-title{font:400 62px/.93 Georgia,serif;letter-spacing:-.055em}.route{position:relative;display:grid;gap:16px}.route:before{content:"";position:absolute;left:38px;top:20px;bottom:20px;width:8px;border-radius:99px;background:linear-gradient(180deg,var(--green),var(--gold),var(--red));opacity:.24}.route-item{position:relative;display:grid;grid-template-columns:78px 1fr auto;align-items:center;gap:16px;border:1px solid var(--line);border-radius:24px;background:rgba(255,250,241,.86);padding:14px}.route-icon{width:64px;height:64px;border-radius:20px;display:grid;place-items:center;background:#f1dfc6;color:var(--red);font:400 34px/1 Georgia,serif}.route-item.active{background:var(--red);color:white}.route-item.active .route-icon{background:white}.note{color:#fffaf1;display:grid;gap:16px}.note .box{border:1px solid rgba(255,250,241,.2);border-radius:24px;background:rgba(255,250,241,.1);padding:22px}.note h2{font:400 38px/1 Georgia,serif}.note p{color:rgba(255,250,241,.82);line-height:1.55;font-weight:650}
      @media(max-width:920px){body{padding:12px}.wrap{grid-template-columns:1fr;justify-items:center}.phone{position:relative;top:auto;width:min(393px,calc(100vw - 24px))}.desk-inner{grid-template-columns:1fr}}
    </style>
  </head>
  <body>
    <main class="wrap">
      <section class="phone"><div class="speaker"></div><div class="screen"><div class="view"><div class="top"><div class="brand">Kibbo.</div><div class="chip">Lv 01</div></div><div class="eyebrow" style="margin-top:24px">AP Japanese Path</div><h1>Follow the route to AP readiness.</h1><p class="sub">A skill-map concept: no dashboard grid. Students move node by node through listening, reading, chat, and mock gates.</p><div class="map"><div class="path-line"></div><div class="node done"><div class="badge">日</div><b>First step</b><span>quick placement</span></div><div class="node active"><div class="badge">聴</div><b>Listening gate</b><span>3 audio questions</span></div><div class="node"><div class="badge">読</div><b>Reading trail</b><span>AP passages</span></div><div class="node"><div class="badge">返</div><b>Reply sprint</b><span>text chat turns</span></div><div class="node"><div class="badge">試</div><b>Mini Mock</b><span>prove readiness</span></div></div></div><div class="dock"><div><b>Next: Listening gate</b><p style="margin:3px 0 0;color:rgba(255,250,241,.7);font-size:12px;font-weight:750">+18 XP · 7 min</p></div><button>Start</button></div><nav class="nav"><div><span>⌂</span>Path</div><div><span>□</span>Library</div><div><span>◎</span>Mock</div></nav></div></section>
      <section class="desk"><div class="desk-inner"><aside class="panel"><div class="brand">Kibbo.</div><div class="eyebrow" style="margin-top:26px">AP Japanese</div><div class="desk-title">The readiness route.</div><p class="sub">Desktop becomes a map of mastery instead of cards. The next action is always pinned, while the full AP path stays visible.</p><button style="margin-top:22px;border:0;border-radius:999px;background:var(--red);color:white;min-height:52px;padding:0 22px;font-weight:950">Start listening gate →</button></aside><section class="route"><div class="route-item"><div class="route-icon">日</div><div><b>First step</b><p class="sub">placement and warmup</p></div><div class="chip">Done</div></div><div class="route-item active"><div class="route-icon">聴</div><div><b>Listening gate</b><p style="color:rgba(255,255,255,.72);font-weight:750">audio prompts + review</p></div><div class="chip">Now</div></div><div class="route-item"><div class="route-icon">読</div><div><b>Reading trail</b><p class="sub">passages and inference</p></div><div class="chip">Next</div></div><div class="route-item"><div class="route-icon">返</div><div><b>Reply sprint</b><p class="sub">timed written replies</p></div><div class="chip">Soon</div></div><div class="route-item"><div class="route-icon">試</div><div><b>Mini Mock summit</b><p class="sub">AP score estimate</p></div><div class="chip">Gate</div></div></section></div></section>
      <aside class="note"><div class="box"><h2>Version 6 · Skill Path</h2><p>This is structurally different: the app is a progression map, not a home dashboard. It makes the next action obvious and gives students a visible AP journey.</p></div></aside>
    </main>
  </body>
</html>`);
}

function sendVisualPrototypeCoach(response) {
  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0',
  });
  response.end(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Fluency Coach Prototype</title>
    <style>
      :root{--cream:#f5ead9;--paper:#fffaf1;--ink:#1f1b18;--muted:#71685c;--red:#cf3f2e;--rose:#f5d9cf;--mint:#dceedd;--blue:#dfe6fb;--line:#dac8ae}
      *{box-sizing:border-box}body{margin:0;min-height:100vh;padding:22px;background:linear-gradient(135deg,#1e1918,#3c2c27);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--ink)}button{font:inherit}
      .wrap{max-width:1280px;margin:0 auto;display:grid;grid-template-columns:minmax(330px,410px) 1fr;gap:24px;align-items:start}.phone{position:sticky;top:22px;aspect-ratio:393/852;border:12px solid #171719;border-radius:46px;background:#171719;overflow:hidden;box-shadow:0 34px 92px rgba(0,0,0,.5)}.speaker{position:absolute;z-index:6;top:12px;left:50%;width:96px;height:24px;transform:translateX(-50%);border-radius:999px;background:#09090a}
      .screen{height:100%;position:relative;overflow:hidden;background:linear-gradient(180deg,#fff8ea,#f4e6d2)}.view{height:100%;overflow:auto;padding:66px 22px 118px;position:relative}.top{display:flex;justify-content:space-between;align-items:center}.brand{font:italic 28px/1 Georgia,serif;letter-spacing:-.04em}.avatar{width:48px;height:48px;border-radius:50%;background:var(--red);color:white;display:grid;place-items:center;font:400 28px/1 Georgia,serif}.label{color:var(--red);font-size:12px;letter-spacing:.22em;text-transform:uppercase;font-weight:950}
      h1,h2,h3,p{margin:0}h1{margin-top:20px;font:400 44px/1 Georgia,serif;letter-spacing:-.04em}.coach{margin-top:18px;border-radius:30px;background:#211a18;color:#fffaf1;padding:20px;display:grid;grid-template-columns:56px 1fr;gap:14px;box-shadow:0 18px 36px rgba(35,22,15,.22)}.coach-face{width:56px;height:56px;border-radius:20px;background:#fffaf1;color:var(--red);display:grid;place-items:center;font:400 34px/1 Georgia,serif}.coach b{display:block;font-size:20px}.coach p{margin-top:5px;color:rgba(255,250,241,.74);line-height:1.35;font-weight:700}
      .reply{margin-top:14px;margin-left:42px;border:1px solid var(--line);border-radius:24px 24px 24px 8px;background:rgba(255,250,241,.82);padding:16px}.reply b{display:block}.reply p{margin-top:4px;color:var(--muted);font-weight:720;line-height:1.35}
      .stack{margin-top:18px;display:grid;gap:12px}.action{border:1px solid var(--line);border-radius:24px;background:rgba(255,250,241,.82);padding:16px;display:grid;grid-template-columns:56px 1fr auto;align-items:center;gap:14px}.action-icon{width:56px;height:56px;border-radius:20px;display:grid;place-items:center;font:400 32px/1 Georgia,serif;color:var(--red);background:var(--rose)}.action:nth-child(2) .action-icon{background:var(--mint)}.action:nth-child(3) .action-icon{background:var(--blue)}.action h3{font-size:19px}.action p{color:var(--muted);font-size:13px;font-weight:730}.arrow{color:var(--red);font-size:28px}.input{position:absolute;left:18px;right:18px;bottom:118px;min-height:64px;border-radius:999px;background:#fffaf1;border:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;padding:0 10px 0 20px;color:var(--muted);font-weight:800;box-shadow:0 14px 28px rgba(63,42,20,.08)}.send{width:46px;height:46px;border-radius:50%;border:0;background:var(--red);color:white;font-weight:950}
      .nav{position:absolute;left:0;right:0;bottom:0;height:108px;background:rgba(255,250,241,.96);border-top:1px solid var(--line);display:flex;justify-content:space-around;align-items:center;padding:4px 16px 18px;color:var(--muted);font-size:10px;font-weight:950;letter-spacing:.16em;text-transform:uppercase}.nav div{display:grid;place-items:center;gap:5px}.nav span{font-size:30px;color:var(--red);letter-spacing:0}
      .desk{min-height:650px;border-radius:34px;background:linear-gradient(180deg,#fff8ea,#f1e0c9);padding:30px;position:relative;overflow:hidden}.desk-inner{display:grid;grid-template-columns:1fr 380px;gap:24px}.conversation{border:1px solid var(--line);border-radius:30px;background:rgba(255,250,241,.68);padding:24px;display:grid;gap:16px}.desk-title{font:400 58px/.96 Georgia,serif;letter-spacing:-.05em}.coach-row{display:grid;grid-template-columns:64px 1fr;gap:16px;align-items:start}.bubble{border-radius:24px;background:#211a18;color:#fffaf1;padding:18px}.bubble.light{background:#fffaf1;color:var(--ink);border:1px solid var(--line)}.side{display:grid;gap:14px}.metric{border:1px solid var(--line);border-radius:26px;background:rgba(255,250,241,.74);padding:20px}.metric b{font:400 42px/1 Georgia,serif}.note{color:#fffaf1;display:grid;gap:16px}.note .box{border:1px solid rgba(255,250,241,.2);border-radius:24px;background:rgba(255,250,241,.1);padding:22px}.note h2{font:400 38px/1 Georgia,serif}.note p{color:rgba(255,250,241,.82);line-height:1.55;font-weight:650}
      @media(max-width:920px){body{padding:12px}.wrap{grid-template-columns:1fr;justify-items:center}.phone{position:relative;top:auto;width:min(393px,calc(100vw - 24px))}.desk-inner{grid-template-columns:1fr}}
    </style>
  </head>
  <body>
    <main class="wrap">
      <section class="phone"><div class="speaker"></div><div class="screen"><div class="view"><div class="top"><div class="brand">Kibbo.</div><div class="avatar">先</div></div><div class="label" style="margin-top:24px">AP Coach</div><h1>Your AP Japanese coach is ready.</h1><div class="coach"><div class="coach-face">聞</div><div><b>Start with listening.</b><p>Your recent answers lose detail after the first sentence. I built a short set for that.</p></div></div><div class="reply"><b>Today’s plan</b><p>3 audio prompts, one reading warmup, then a mini score note.</p></div><div class="stack"><div class="action"><div class="action-icon">聴</div><div><h3>Listening set</h3><p>7 min · +18 XP</p></div><div class="arrow">›</div></div><div class="action"><div class="action-icon">読</div><div><h3>Reading warmup</h3><p>2 short passages</p></div><div class="arrow">›</div></div><div class="action"><div class="action-icon">点</div><div><h3>Score review</h3><p>AP rubric notes</p></div><div class="arrow">›</div></div></div></div><div class="input">Ask your coach… <button class="send">↗</button></div><nav class="nav"><div><span>⌂</span>Coach</div><div><span>□</span>Library</div><div><span>◎</span>Mock</div></nav></div></section>
      <section class="desk"><div class="desk-inner"><main class="conversation"><div class="label">AP Japanese Coach</div><div class="desk-title">Guided practice, not a menu.</div><div class="coach-row"><div class="avatar">先</div><div class="bubble"><b>Start with listening.</b><p style="color:rgba(255,250,241,.75);line-height:1.45;font-weight:700">Your weakest signal is understanding announcements. I prepared a 7-minute set with instant feedback.</p></div></div><div class="coach-row"><div></div><div class="bubble light"><b>Today’s route</b><p style="color:var(--muted);line-height:1.45;font-weight:720">Listening set → reading warmup → score note → save two review cards.</p></div></div><div class="action"><div class="action-icon">聴</div><div><h3>Begin listening set</h3><p>3 AP-style prompts · +18 XP</p></div><div class="arrow">›</div></div></main><aside class="side"><div class="metric"><div class="label">Readiness</div><b>AP 3</b><p style="color:var(--muted);font-weight:720">Listening holds you back.</p></div><div class="metric"><div class="label">Development</div><b>+0.14</b><p style="color:var(--muted);font-weight:720">Slight upward trend.</p></div><div class="metric"><div class="label">Library</div><b>12</b><p style="color:var(--muted);font-weight:720">saved coach notes.</p></div></aside></div></section>
      <aside class="note"><div class="box"><h2>Version 7 · Coach Studio</h2><p>This is structurally different: the app behaves like a personal AP coach conversation. The “home page” is guidance plus recommended tasks, not a dashboard or grid.</p></div></aside>
    </main>
  </body>
</html>`);
}

createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://${host}:${port}`);
  const pathname = decodeURIComponent(url.pathname);

  if (pathname === '/__visual-prototype') {
    sendVisualPrototype(response);
    return;
  }

  if (pathname === '/__visual-prototype-newsroom') {
    sendVisualPrototypeNewsroom(response);
    return;
  }

  if (pathname === '/__visual-prototype-playbook') {
    sendVisualPrototypePlaybook(response);
    return;
  }

  if (pathname === '/__visual-prototype-dojo') {
    sendVisualPrototypeDojo(response);
    return;
  }

  if (pathname === '/__visual-prototype-orbit') {
    sendVisualPrototypeOrbit(response);
    return;
  }

  if (pathname === '/__visual-prototype-path') {
    sendVisualPrototypePath(response);
    return;
  }

  if (pathname === '/__visual-prototype-coach') {
    sendVisualPrototypeCoach(response);
    return;
  }

  if (pathname === '/__mobile-demo') {
    sendMobileDemo(response, url.searchParams.get('path') ?? '/');
    return;
  }

  if (pathname === '/__reset.html') {
    sendResetPage(response);
    return;
  }

  let filePath = join(root, pathname);

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, 'index.html');
  }

  if (existsSync(filePath)) {
    sendFile(response, filePath);
    return;
  }

  if (extname(pathname)) {
    response.writeHead(404, {
      'Cache-Control': 'no-store, max-age=0',
      'Content-Type': 'text/plain; charset=utf-8',
    });
    response.end('Not found');
    return;
  }

  const routeFilePath = join(root, pathname.replace(/\/$/, '')) + '.html';
  if (routeFilePath.startsWith(root) && existsSync(routeFilePath)) {
    sendFile(response, routeFilePath);
    return;
  }

  sendFile(response, join(root, 'index.html'));
}).listen(port, host, () => {
  console.log(`Preview server ready at http://${host}:${port}`);
});
