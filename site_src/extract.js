await new Promise(r=>setTimeout(r,1500));
(() => {
  const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const unwrap = h => { try { const u = new URL(h, location.href); if (u.hostname === 'www.google.com' && u.pathname === '/url') return u.searchParams.get('q') || h; return u.href; } catch(e) { return h; } };
  const isBold = el => { const w = getComputedStyle(el).fontWeight; return parseInt(w,10) >= 600; };
  function walk(n, inHead) {
    if (n.nodeType === 3) return esc(n.nodeValue);
    if (n.nodeType !== 1) return '';
    const t = n.tagName.toLowerCase();
    if (['script','style','svg','button','noscript','iframe'].includes(t)) {
      if (t === 'iframe') return `<p data-iframe="${esc(n.src||'')}"></p>`;
      return '';
    }
    const kids = () => [...n.childNodes].map(c => walk(c, inHead || /^h[1-6]$/.test(t))).join('');
    if (/^h[1-6]$/.test(t)) { const lv = Math.min(4, Math.max(2, parseInt(t[1],10)+1)); const c = kids().trim(); return c ? `<h${lv}>${c}</h${lv}>\n` : ''; }
    if (t === 'p') { const c = kids().replace(/^(\s|&nbsp;)+|(\s|&nbsp;)+$/g,''); return c ? `<p>${c}</p>\n` : ''; }
    if (t === 'ul' || t === 'ol') return `<${t}>\n${kids()}</${t}>\n`;
    if (t === 'li') { let c = kids().trim().replace(/^<p>([\s\S]*)<\/p>$/,'$1'); return `<li>${c}</li>\n`; }
    if (t === 'br') return '<br />';
    if (t === 'hr') return '<hr />\n';
    if (t === 'a') { const href = n.getAttribute('href') || ''; const c = kids(); if (!href || href.startsWith('#')) return c; return `<a href="${esc(unwrap(href))}">${c}</a>`; }
    if (t === 'img') { const src = n.currentSrc || n.src; return src ? `<img src="${esc(src)}" alt="${esc(n.alt||'')}" loading="lazy" />` : ''; }
    if (['table','thead','tbody','tr','td','th'].includes(t)) return `<${t}>${kids()}</${t}>${t==='tr'||t==='table'?'\n':''}`;
    if (t === 'span') { const c = kids(); if (!inHead && c.trim() && isBold(n)) return `<strong>${c}</strong>`; return c; }
    return kids();
  }
  const secs = [...document.querySelectorAll('section')];
  const content = secs.slice(1).filter(s => !s.classList.contains('qeLZfd'));
  let html = content.map(s => walk(s, false)).join('\n');
  html = html.replace(/<strong>(\s*)<\/strong>/g,'$1').replace(/<\/strong><strong>/g,'').replace(/\n{3,}/g,'\n\n');
  const title = (secs[0] && secs[0].innerText.trim()) || document.title;
  return { url: location.pathname, title, docTitle: document.title, html };
})()
