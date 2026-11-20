// www.ad-sheet.com を静的サイトとして書き出す
//   node build.js            → dist/ に全ページ（SSR済み）を出力
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const W = process.env.W || path.resolve(__dirname, '..');
const B = path.join(W, 'site_build');
const SRC = path.join(B, 'src');
const DIST = path.join(B, 'dist');
const ORIGIN = 'https://www.ad-sheet.com';

const LINKEDIN = 'https://www.linkedin.com/in/%E6%85%8E-%E6%9D%BE%E5%B4%8E-8b23803ba/';
const FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSdswC5UjuD4xbpkot6UeyFmtm77O5Uh14fyrtG80Y8fx3Pjcw/viewform';
const BILLING = 'https://billing.stripe.com/p/login/bIY15B23Qe9lf04eUU';

// アップロード画像ID → 公開パス（同じ画像は1つにまとめる）
const BLOB = {
  // セカンドオピニオンLP
  '3c846d0d4f378e42b91b887e37142bf2': 'chars/auto.webp',
  '57ae9add0a8c7f5b18ed39e3952e8d79': 'chars/point_r.webp',
  '6f4c399d8bbd12c7a5f299875d481492': 'chars/tired.webp',
  '9e99daa89bd9b584cdc0f0b84a27d01f': 'chars/point_l.webp',
  'a4ec0ea43cbb84e44281187bad1be94a': 'chars/thumbs.webp',
  'b3d66591b4c5e2c1ff3aeaaccd6c177f': 'chars/typing.webp',
  'd009faf0f2363bdce882360048468aa5': 'chars/present.webp',
  'e4bb0ab360f9562ffbfd5649ead73fae': 'chars/magnify.webp',
  'fc377c8e75ee4f8dd6f56fea7ae316e2': 'chars/alert.webp',
  // アドシートのページ
  '38ca95f3f9a210ea4e85face5c0c6d1b': 'chars/auto.webp',
  'af06ca3af39cf5def27d4cd075011e1e': 'chars/tired.webp',
  'e75bf4817e3ee91217b26f9e29df6ebd': 'chars/thumbs.webp',
  '9735d181bd74249e3a7dd510f323b16d': 'adsheet/hero3d.webp',
  '97dc525440af3ec2fd561a4e3986db0d': 'adsheet/logo_full.png',
  'b0ca86a2f529e86f51eab2b60f3a4d89': 'adsheet/logo_mark.png'
};
// 新車ディーラー版（/lp/car/）の画像・動画
const CAR_BLOBS = JSON.parse(fs.readFileSync(path.join(W, 'carlp', 'blobs.json'), 'utf8'));
for (const [, [id, file, rel]] of Object.entries(CAR_BLOBS)) BLOB[id] = rel;
const IMG_FILES = {
  'chars/auto.webp': W + '/mob/chars/auto.webp',
  'chars/point_r.webp': W + '/mob/chars/point_r.webp',
  'chars/tired.webp': W + '/mob/chars/tired.webp',
  'chars/point_l.webp': W + '/mob/chars/point_l.webp',
  'chars/thumbs.webp': W + '/mob/chars/thumbs.webp',
  'chars/typing.webp': W + '/mob/chars/typing.webp',
  'chars/present.webp': W + '/mob/chars/present.webp',
  'chars/magnify.webp': W + '/mob/chars/magnify.webp',
  'chars/alert.webp': W + '/mob/chars/alert.webp',
  'adsheet/hero3d.webp': W + '/adsheet/sheet.webp',
  'adsheet/logo_full.png': W + '/adsheet/logo_full.png',
  'adsheet/logo_mark.png': W + '/adsheet/logo_mark.png'
};
for (const [, [id, file, rel]] of Object.entries(CAR_BLOBS)) IMG_FILES[rel] = path.join(W, file);
const assetUrl = (rel) => (rel.endsWith('.mp4') ? '/assets/media/' : '/assets/img/') + rel;

// ---- 小道具 -----------------------------------------------------------------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);
function write(rel, content) {
  const p = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}
function must(s, from, to, n = 1) {
  const c = s.split(from).length - 1;
  if (c !== n) throw new Error(`置換対象の数が違います（期待${n}・実際${c}）: ${from.slice(0, 90)}`);
  return s.split(from).join(to);
}
function cutLine(s, marker) {
  const i = s.indexOf(marker);
  if (i < 0) throw new Error('見つかりません: ' + marker);
  const a = s.lastIndexOf('\n', i) + 1;
  const b = s.indexOf('\n', i);
  return s.slice(0, a) + s.slice(b + 1);
}
function cutDiv(s, marker) {
  const i = s.indexOf(marker);
  if (i < 0) throw new Error('見つかりません: ' + marker);
  const re = /<\/?div\b[^>]*>/g;
  re.lastIndex = i;
  let depth = 0;
  let m;
  while ((m = re.exec(s))) {
    depth += m[0][1] === '/' ? -1 : 1;
    if (depth === 0) {
      let end = re.lastIndex;
      if (s[end] === '\n') end++;
      return s.slice(0, i) + s.slice(end);
    }
  }
  throw new Error('divの閉じが見つかりません: ' + marker);
}
function blobs(s) {
  return s.replace(/\/_blob\/([0-9a-f]{32})/g, (m, id) => {
    if (!BLOB[id]) throw new Error('未登録の画像ID: ' + id);
    return assetUrl(BLOB[id]);
  });
}
function parseDC(src) {
  const xdc = src.match(/<x-dc>([\s\S]*?)<\/x-dc>/)[1];
  const helmet = xdc.match(/<helmet>([\s\S]*?)<\/helmet>/)[1].trim();
  const body = xdc.replace(/<helmet>[\s\S]*?<\/helmet>/, '').trim();
  const sm = src.match(/<script type="text\/x-dc"([^>]*)>([\s\S]*?)<\/script>/);
  const pm = sm[1].match(/data-props='([^']*)'/);
  const schema = pm ? JSON.parse(pm[1]) : {};
  const props = {};
  for (const [k, v] of Object.entries(schema)) {
    if (k.startsWith('$')) continue;
    props[k] = v && typeof v === 'object' && 'default' in v ? v.default : v;
  }
  return { helmet, body, code: sm[2].trim(), props };
}

const FONT_DOC = '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@500;700;900&display=swap">';

function headCommon({ title, desc, url, og, site, robots }) {
  return [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${esc(title)}</title>`,
    desc ? `<meta name="description" content="${esc(desc)}">` : '',
    robots ? `<meta name="robots" content="${robots}">` : '',
    url ? `<link rel="canonical" href="${url}">` : '',
    '<meta property="og:type" content="website">',
    `<meta property="og:site_name" content="${esc(site || 'アドシート')}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    desc ? `<meta property="og:description" content="${esc(desc)}">` : '',
    url ? `<meta property="og:url" content="${url}">` : '',
    `<meta property="og:image" content="${ORIGIN}/assets/img/${og || 'og-tool.png'}">`,
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    '<meta property="og:locale" content="ja_JP">',
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="twitter:site" content="@Shin_Adg">',
    '<link rel="icon" href="/favicon.ico" sizes="any">',
    '<link rel="icon" href="/assets/img/favicon.png" type="image/png">',
    '<link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">',
    '<meta name="theme-color" content="#ffffff">'
  ].filter(Boolean).join('\n');
}

// ---- 2つのメインページ（x-dc から変換） ---------------------------------------
const MAIN = [
  {
    key: 'top',
    out: 'index.html',
    src: W + '/lp2/project/Main.dc.html',
    url: ORIGIN + '/',
    site: 'しんのWeb広告セカンドオピニオン',
    title: 'しんのWeb広告セカンドオピニオン｜代理店のレポートを第三者が無料診断',
    desc: '大手代理店に広告を任せている会社へ。代理店は替えずに、運用の現場を知る第三者がレポートと広告アカウントをチェックして、ムダと伸びしろを見つけます。診断は無料、オンラインで60分。',
    og: 'og-top.png',
    fix(s) {
      s = cutLine(s, '<a class="fv2" href="#s-dl">'); // 無料資料ボタン（資料の準備ができるまで隠す）
      s = cutDiv(s, '<div id="s-dl" '); // 無料資料ブロック
      s = must(s, 'href="https://www.linkedin.com/"', `href="${LINKEDIN}"`, 2);
      s = must(s, 'href="https://workspace.google.com/marketplace/app/%F0%9F%9F%A9%E3%82%A2%E3%83%89%E3%82%B7%E3%83%BC%E3%83%88%E5%BA%83%E5%91%8A%E8%87%AA%E5%8B%95%E6%9B%B8%E3%81%8D%E5%87%BA%E3%81%97%E3%83%84%E3%83%BC%E3%83%AB/761670620603" target="_blank" rel="noopener"', 'href="/tool/"');
      s = must(s, '<a class="cta" href="#s-booking" style="margin-top: 36px;', '<a class="cta" href="/inquiry/?type=shindan" style="margin-top: 36px;');
      s = must(s,
        '<a href="#s-top" style="color: #e6eeec">特定商取引法に基づく表記</a><a href="#s-top" style="color: #e6eeec">プライバシーポリシー</a><a href="#s-booking" style="color: #e6eeec">お問い合わせ</a>',
        '<a href="/tokusho/" style="color: #e6eeec">特定商取引法に基づく表記</a><a href="/privacy/" style="color: #e6eeec">プライバシーポリシー</a><a href="/inquiry/?type=shindan" style="color: #e6eeec">お問い合わせ</a><a href="/tool/" style="color: #e6eeec">広告レポート自動化ツール「アドシート」</a>');
      // 顧問の解約条件は未確定のため、仮置きの文字を出さない
      s = s.replace(/\u200b?\[更新・解約の条件\]/, () => '');
      if (s.includes('更新・解約の条件]')) throw new Error('仮置きの文字が残っています');
      // アドシートの対応媒体を最新に（/tool/ と合わせる）
      s = must(s, '公開版の対象は、<wbr />Google広告です。', 'Google・LINEヤフー・Meta・<wbr />Microsoft・TikTokの広告に対応しています。');
      if (s.includes('#s-dl')) throw new Error('#s-dl への参照が残っています');
      return s;
    }
  },
  {
    key: 'tool',
    out: 'tool/index.html',
    src: W + '/adsheet/project/Main.dc.html',
    url: ORIGIN + '/tool/',
    site: 'アドシート',
    title: 'アドシート｜広告レポートを、スプレッドシートに自動で。',
    desc: 'アドシートは、Google広告・LINEヤフー広告・Meta広告・Microsoft広告・TikTok広告の数字を、Googleスプレッドシートに自動で書き出すアドオンです。無料プランあり。画面も設定もぜんぶ日本語です。',
    og: 'og-tool.png',
    fix(s) {
      s = must(s, 'href="https://www.ad-sheet.com/how-to-use" target="_blank" rel="noopener"', 'href="/how-to-use/"', 2);
      s = must(s, 'href="https://www.ad-sheet.com/faq" target="_blank" rel="noopener"', 'href="/faq/"', 2);
      s = must(s, 'href="https://www.ad-sheet.com/inquiry" target="_blank" rel="noopener"', 'href="/inquiry/"', 1);
      s = must(s, 'href="https://www.ad-sheet.com/tos"', 'href="/tos/"');
      s = must(s, 'href="https://www.ad-sheet.com/privacy"', 'href="/privacy/"');
      s = must(s, 'href="https://www.ad-sheet.com/tokusho"', 'href="/tokusho/"');
      s = must(s, 'href="https://www.ad-sheet.com/inquiry"', 'href="/inquiry/"');
      s = must(s, '<a href="{{so}}" target="_blank" rel="noopener">', '<a href="{{so}}">');
      s = must(s, "so: 'https://claude.ai/artifact/2LWyDGDEwQvFM3YHB33TFR',", "so: '/',");
      s = must(s, "const url = 'https://www.ad-sheet.com/';", "const url = 'https://www.ad-sheet.com/tool/';");
      s = must(s, "'PCで www.ad-sheet.com を開いてください。'", "'PCで www.ad-sheet.com/tool を開いてください。'");
      if (/ad-sheet\.com\/(tos|privacy|tokusho|inquiry|faq|how-to-use)/.test(s)) throw new Error('旧URLが残っています');
      return s;
    }
  },
  {
    key: 'car',
    out: 'lp/car/index.html',
    src: W + '/carlp/project/Main.dc.html',
    url: ORIGIN + '/lp/car/',
    site: 'しんのWeb広告セカンドオピニオン',
    title: '新車ディーラーのWeb広告セカンドオピニオン｜代理店の広告を、来店につながる数字で無料点検',
    desc: '新車ディーラーの広告を5年以上運用している担当者が、代理店のレポートと広告アカウントを点検します。配信面・計測・自動の設定など8か所をチェック。代理店はそのままで、まずは無料点検から。',
    og: 'og-car.png',
    fix(s) { return s; }
  }
];

function mainShell(p, helmet, ssr, v) {
  return `<!doctype html>
<html lang="ja">
<head>
${headCommon(p)}
${helmet}
</head>
<body>
<div id="dc-root">${ssr}</div>
<script src="/assets/js/dc-lite.js?v=${v.rt}" defer></script>
<script src="/assets/js/${p.key}.js?v=${v.page}" defer></script>
</body>
</html>
`;
}

// ---- 移した各ページ（旧Googleサイト） ------------------------------------------
const NAV = [
  ['/how-to-use/', '使い方'],
  ['/faq/', 'よくある質問'],
  ['/inquiry/', 'お問い合わせ']
];
function docShell({ path: p, title, desc, h1, body, robots, extra }) {
  const nav = NAV.map(([href, label]) => `<a href="${href}"${href === p ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  return `<!doctype html>
<html lang="ja">
<head>
${headCommon({ title, desc, url: p ? ORIGIN + p : '', og: 'og-tool.png', site: 'アドシート', robots })}
${FONT_DOC}
<link rel="stylesheet" href="/assets/css/doc.css?v=${DOC_CSS_V}">
</head>
<body>
<header class="hd"><div class="wrap">
<a class="logo" href="/tool/"><img src="/assets/img/adsheet/logo_full.png" alt="アドシート" width="101" height="30"></a>
<nav aria-label="サイト内リンク">${nav}</nav>
<a class="cta" href="/tool/">アドシートとは</a>
</div></header>
${h1 ? `<div class="ttl"><div class="wrap"><p class="eb"><a href="/tool/">アドシート</a></p><h1>${esc(h1)}</h1></div></div>` : ''}
<main class="${h1 ? 'doc' : 'nf'}">
${body}
</main>
<footer class="ft"><div class="wrap">
<p class="nm">アドシート</p>
<p class="lk"><a href="/tos/">利用規約</a><a href="/privacy/">プライバシーポリシー</a><a href="/tokusho/">特定商取引法に基づく表記</a><a href="/inquiry/">お問い合わせ</a><a href="/">広告のセカンドオピニオン</a></p>
<p class="tm">Google 広告、Google スプレッドシートは Google LLC の商標です。その他の会社名・サービス名は、各社の商標または登録商標です。　© アドシート</p>
</div></footer>
${extra || ''}
</body>
</html>
`;
}

function docify(html) {
  let h = html;
  h = h.replace(/https:\/\/www\.ad-sheet\.com\/%E3%83%9B%E3%83%BC%E3%83%A0/g, '/tool/');
  h = h.replace(/https:\/\/www\.ad-sheet\.com\/(inquiry|how-to-use|faq|tos|privacy|tokusho)(?![\w-])/g, '/$1/');
  // Googleサイトのボタン（リンクの中に段落）
  h = h.replace(/<a href="([^"]+)"><p>([\s\S]*?)<\/p>\s*<\/a>/g, (m, href, text) => `<p class="bt"><a class="btn" href="${href}">${text.trim()}</a></p>`);
  h = h.replace(/<a [^>]*><\/a>/g, '');
  // 外部リンクは新しいタブ
  h = h.replace(/<a (class="[^"]*" )?href="(https?:\/\/[^"]+)"/g, (m, cls, href) => `<a ${cls || ''}href="${href}" target="_blank" rel="noopener"`);
  // 余分な改行タグ
  h = h.replace(/(?:<br \/>)+<\/a>/g, '</a><br />');
  h = h.replace(/(?:<br \/>)+<\/li>/g, '</li>');
  h = h.replace(/(?:<br \/>)+<\/strong>/g, '</strong><br />');
  h = h.replace(/<br \/><\/p>/g, '</p>');
  h = h.replace(/^(?:<br \/>)+/gm, '');
  h = h.replace(/(?:<br \/>)+$/gm, '');
  h = h.replace(/<p><strong><br \/>/g, '<p><strong>');
  // よくある質問の見出し
  h = h.replace(/<h4>💬\s*/g, '<h4 class="q">');
  // 画像
  h = h.replace(/<img /g, '<img decoding="async" ');
  h = h.replace(/\n{3,}/g, '\n\n').trim();
  return h;
}

function tokushoDl(html) {
  const chunks = html.split(/<br \/>/).map((c) => c.trim()).filter(Boolean);
  const rows = chunks.map((c) => {
    const m = c.match(/^<p><strong>([\s\S]*?)<\/strong><\/p>\s*([\s\S]*)$/);
    if (!m) throw new Error('特商法の形が想定と違います: ' + c.slice(0, 60));
    return `<div><dt>${m[1]}</dt><dd>${m[2].trim()}</dd></div>`;
  });
  return `<dl class="tk">\n${rows.join('\n')}\n</dl>`;
}

const DOCS = {
  tos: { title: '利用規約｜アドシート', h1: '利用規約', desc: 'アドシート（Googleスプレッドシート用アドオン）の利用規約です。' },
  privacy: { title: 'プライバシーポリシー｜アドシート', h1: 'プライバシーポリシー', desc: 'アドシートのプライバシーポリシーです。収集する情報、利用目的、第三者への提供、データの削除について説明しています。' },
  tokusho: { title: '特定商取引法に基づく表記｜アドシート', h1: '特定商取引法に基づく表記', desc: 'アドシートの特定商取引法に基づく表記です。' },
  faq: { title: 'よくあるご質問｜アドシート', h1: 'よくあるご質問', desc: 'アドシートの料金、プラン変更、対応している広告媒体、自動更新、導入方法、解約についてのよくあるご質問です。' },
  'how-to-use': { title: 'アドシートの使い方｜アドシート', h1: 'アドシートの使い方', desc: 'アドシートのインストール方法、起動のしかた、レポートの書き出し方、保存と自動更新の設定方法を画像つきで説明します。' }
};

function docBody(key) {
  let raw = fs.readFileSync(path.join(B, '..', 'site_src', 'pages', key + '.html'), 'utf8');
  if (key === 'tokusho') {
    raw = must(raw, '<p>https://www.ad-sheet.com/</p>', '<p><a href="https://www.ad-sheet.com/tool/">https://www.ad-sheet.com/tool/</a></p>');
    raw = tokushoDl(raw);
    return raw.replace('<a href="https://www.ad-sheet.com/tool/">', '<a href="/tool/">');
  }
  if (key === 'faq') {
    // 対応媒体の回答だけ最新にする（ベータ版の記述が残っていたため）
    raw = must(raw,
      '<p><strong>ベータ版ではGoogle広告のみ連携可能</strong>です。リリース後Yahoo広告、Meta広告、Microsoft広告等対応予定です。</p>',
      '<p><strong>Google広告・LINEヤフー広告（旧Yahoo!広告）・Meta広告・Microsoft広告・TikTok広告</strong>に対応しています。</p>');
    raw = must(raw, '詳細は<a href="https://www.ad-sheet.com/%E3%83%9B%E3%83%BC%E3%83%A0">ホームページ</a>を参照ください。', '詳細は<a href="/tool/#price">料金プラン</a>を参照ください。');
    raw = must(raw, 'ホームページのプラン一覧の『利用開始する』', '<a href="/tool/#price">料金プラン</a>の『利用開始する』');
  }
  if (key === 'privacy') {
    raw = must(raw, '<li>お問い合わせ</li>', '<li><a href="/inquiry/">お問い合わせ</a></li>');
  }
  if (key === 'tos') {
    raw = must(raw, 'お問い合わせフォームよりご連絡ください。', '<a href="/inquiry/">お問い合わせフォーム</a>よりご連絡ください。');
  }
  return docify(raw);
}

function inquiryPage() {
  const prefillCar = new URLSearchParams({
    embedded: 'true',
    usp: 'pp_url',
    'entry.1674989680': '__other_option__',
    'entry.1674989680.other_option_response': '無料診断（セカンドオピニオン）の予約',
    'entry.1665734970': '【無料診断の予約（新車ディーラー）】\n見てほしい広告媒体：\n月の広告費（だいたい）：\n店舗の数：\n気になっていること：\nご都合のよい日時（候補を2〜3つ）：'
  }).toString();
  const prefill = new URLSearchParams({
    embedded: 'true',
    usp: 'pp_url',
    'entry.1674989680': '__other_option__',
    'entry.1674989680.other_option_response': '無料診断（セカンドオピニオン）の予約',
    'entry.1665734970': '【無料診断の予約】\n見てほしい広告媒体：\n月の広告費（だいたい）：\n気になっていること：\nご都合のよい日時（候補を2〜3つ）：'
  }).toString();
  const body = `<div class="callout" id="shindan" hidden>
<h2>ご予約の流れ</h2>
<p>下のフォームから、広告の無料診断（セカンドオピニオン）の予約を受け付けています。</p>
<ol>
<li>メールアドレスを入れる</li>
<li>「お問い合わせ項目」は、そのままでOK（予約用の内容が入っています）</li>
<li>「お問い合わせ内容」に、見てほしい媒体や月の広告費、ご都合のよい日時を書いて送信</li>
</ol>
<p class="small">日程は、折り返しメールでご連絡します。</p>
<a class="back" href="/">セカンドオピニオンのページに戻る</a>
</div>
<div id="tool-info">
<p>お問い合わせはフォームにてよろしくお願いいたします。<br />お問い合わせ前に、まずは<a href="/faq/">よくある質問</a>をご確認いただけますと幸いです。</p>
<p class="bt"><a class="btn ghost" href="/faq/">よくある質問はこちら</a></p>
<p>請求関連(請求書、明細書のダウンロード・キャンセル・プランの変更等)はまず、お客様の<a href="${BILLING}" target="_blank" rel="noopener">請求書ページ</a>から登録中のメールアドレスをご記入し、ご確認ください</p>
<p class="bt"><a class="btn ghost" href="${BILLING}" target="_blank" rel="noopener">請求書ページはこちら</a></p>
</div>
<div class="form"><iframe id="gform" src="${FORM}?embedded=true" title="お問い合わせフォーム" loading="lazy">読み込んでいます…</iframe></div>
<p class="small">フォームが表示されない場合は、<a id="gform-open" href="${FORM}" target="_blank" rel="noopener">こちらから開いてください</a>。</p>`;
  const extra = `<script>
(function () {
  var q = new URLSearchParams(location.search);
  if (q.get('type') !== 'shindan') return;
  var c = document.getElementById('shindan');
  c.hidden = false;
  document.getElementById('tool-info').hidden = true;
  var h = document.querySelector('.ttl h1');
  if (h) h.textContent = '無料診断のご予約';
  var eb = document.querySelector('.ttl .eb a');
  if (eb) { eb.textContent = 'しんのWeb広告セカンドオピニオン'; eb.setAttribute('href', '/'); }
  var car = q.get('from') === 'car';
  var f = document.getElementById('gform');
  var pre = car ? ${JSON.stringify(prefillCar)} : ${JSON.stringify(prefill)};
  f.src = ${JSON.stringify(FORM + '?')} + pre;
  document.getElementById('gform-open').href = ${JSON.stringify(FORM + '?')} + pre.replace('embedded=true&', '');
  if (car) { var back = c.querySelector('.back'); if (back) { back.setAttribute('href', '/lp/car/'); back.textContent = '新車ディーラー版のページに戻る'; } }
  document.title = '無料診断のご予約｜しんのWeb広告セカンドオピニオン';
})();
</script>`;
  return docShell({ path: '/inquiry/', title: 'お問い合わせ｜アドシート', desc: 'アドシートと、Web広告のセカンドオピニオン（無料診断）へのお問い合わせはこちらのフォームからどうぞ。', h1: 'お問い合わせ', body, extra });
}

// ---- 配信用のローカルサーバー（SSRと撮影に使う） -------------------------------
function serve() {
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon', '.xml': 'application/xml', '.txt': 'text/plain' };
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(DIST, p);
    if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('404'); return; }
    res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv)));
}

const LOCAL_FONTS = `@font-face{font-family:'Noto Sans JP';font-weight:400;src:local('Noto Sans CJK JP')}
@font-face{font-family:'Noto Sans JP';font-weight:500;src:local('Noto Sans CJK JP Medium')}
@font-face{font-family:'Noto Sans JP';font-weight:700;src:local('Noto Sans CJK JP Bold')}
@font-face{font-family:'Noto Sans JP';font-weight:900;src:local('Noto Sans CJK JP Black')}
@font-face{font-family:'Zen Kaku Gothic New';font-weight:400;src:local('Noto Sans CJK JP')}
@font-face{font-family:'Zen Kaku Gothic New';font-weight:500;src:local('Noto Sans CJK JP Medium')}
@font-face{font-family:'Zen Kaku Gothic New';font-weight:700;src:local('Noto Sans CJK JP Bold')}
@font-face{font-family:'Zen Kaku Gothic New';font-weight:900;src:local('Noto Sans CJK JP Black')}`;

async function newPage(browser, base, opts) {
  const page = await browser.newPage(opts);
  await page.route('**/*', (route) => (route.request().url().startsWith(base) ? route.continue() : route.abort()));
  return page;
}

// ---- 本体 -------------------------------------------------------------------
let DOC_CSS_V = '';
(async () => {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  // 画像
  for (const [rel, file] of Object.entries(IMG_FILES)) {
    const dest = path.join(DIST, assetUrl(rel).slice(1));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(file, dest);
  }
  execFileSync('python3', ['-c', `
from PIL import Image
m = Image.open('${W}/adsheet/logo_mark.png').convert('RGBA')
d = '${DIST}'
m.resize((64, 64), Image.LANCZOS).save(d + '/assets/img/favicon.png', optimize=True)
bg = Image.new('RGBA', (180, 180), (255, 255, 255, 255))
s = m.resize((150, 150), Image.LANCZOS)
bg.alpha_composite(s, (15, 15))
bg.convert('RGB').save(d + '/assets/img/apple-touch-icon.png', optimize=True)
m.save(d + '/favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
`]);

  // 実行環境とCSS
  const rt = fs.readFileSync(path.join(SRC, 'dc-lite.js'), 'utf8');
  write('assets/js/dc-lite.js', rt);
  const docCss = fs.readFileSync(path.join(SRC, 'doc.css'), 'utf8');
  DOC_CSS_V = hash(docCss);
  write('assets/css/doc.css', docCss);

  // メイン2ページ：まずは空のルートで書き出す
  const built = [];
  for (const p of MAIN) {
    const src = blobs(p.fix(fs.readFileSync(p.src, 'utf8')));
    const dc = parseDC(src);
    const js = `/*! ${p.key} | ad-sheet.com */\n(function () {\n${dc.code}\nwindow.dcMount({ template: ${JSON.stringify(dc.body)}, props: ${JSON.stringify(dc.props)}, Component: Component });\n})();\n`;
    write(`assets/js/${p.key}.js`, js);
    const v = { rt: hash(rt), page: hash(js) };
    write(p.out, mainShell(p, dc.helmet, '', v));
    built.push({ p, dc, v });
  }

  // 移したページ
  for (const [key, meta] of Object.entries(DOCS)) {
    write(`${key}/index.html`, docShell({ path: `/${key}/`, title: meta.title, desc: meta.desc, h1: meta.h1, body: docBody(key) }));
  }
  write('inquiry/index.html', inquiryPage());
  write('ホーム/index.html', `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><title>アドシート</title><meta name="robots" content="noindex"><link rel="canonical" href="${ORIGIN}/tool/"><meta http-equiv="refresh" content="0; url=/tool/"></head>
<body><p><a href="/tool/">アドシートのページへ移動します</a></p><script>location.replace('/tool/' + location.hash);</script></body></html>
`);
  write('404.html', docShell({ path: '', title: 'ページが見つかりません｜アドシート', robots: 'noindex', h1: '', body: `<h1>ページが見つかりませんでした</h1>
<p>URLが変わったか、ページが移動した可能性があります。</p>
<div class="bt"><a class="btn" href="/">トップページへ</a><a class="btn ghost" href="/tool/">アドシートのページへ</a></div>` }));
  write('CNAME', 'www.ad-sheet.com\n');
  write('.nojekyll', '');
  write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`);
  const today = new Date().toISOString().slice(0, 10);
  const urls = ['/', '/lp/car/', '/tool/', '/how-to-use/', '/faq/', '/inquiry/', '/tos/', '/privacy/', '/tokusho/'];
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${ORIGIN}${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`);

  // SSR：ブラウザで初回描画した結果をHTMLに焼き込む
  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch();
  for (const b of built) {
    const page = await newPage(browser, base, { viewport: { width: 1440, height: 900 } });
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    await page.addInitScript(() => { window.__DC_SSR = true; });
    await page.goto(base + '/' + b.p.out.replace('index.html', ''), { waitUntil: 'load' });
    await page.waitForSelector('#dc-root[data-dc="ssr"]', { timeout: 15000 });
    const html = await page.evaluate(() => document.getElementById('dc-root').innerHTML);
    if (errs.length) throw new Error(b.p.key + ' SSRでエラー: ' + errs.join(' / '));
    write(b.p.out, mainShell(b.p, b.dc.helmet, html, b.v));
    console.log('SSR', b.p.key, Math.round(html.length / 1024) + 'KB');
    await page.close();
  }

  // OGP画像（og/*.html を撮影した専用カード）
  execFileSync('node', [path.join(B, 'og', 'render.js')]);
  for (const f of ['og-top.png', 'og-tool.png', 'og-car.png']) fs.copyFileSync(path.join(B, 'og', f), path.join(DIST, 'assets/img', f));

  await browser.close();
  srv.close();

  // リンク切れチェック（サイト内）
  const missing = [];
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  for (const f of walk(DIST).filter((x) => /\.(html|css|js)$/.test(x))) {
    const s = fs.readFileSync(f, 'utf8');
    for (const m of s.matchAll(/(?:href|src)="(\/[^"#?]*)|url\((\/[^)#?]*)\)|'(\/assets\/[^'#?]*)'/g)) {
      const u = decodeURIComponent(m[1] || m[2] || m[3]);
      let t = path.join(DIST, u);
      if (u.endsWith('/')) t = path.join(t, 'index.html');
      if (!fs.existsSync(t)) missing.push(path.relative(DIST, f) + ' → ' + u);
    }
  }
  if (missing.length) { console.log('リンク切れ:\n' + [...new Set(missing)].join('\n')); process.exitCode = 1; }
  else console.log('サイト内リンク: すべてOK');
})().catch((e) => { console.error(e); process.exit(1); });
