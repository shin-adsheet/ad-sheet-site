/*! dc-lite | ad-sheet.com
 * x-dc テンプレート（{{穴}}・sc-for・sc-if・onClick）を静的サイトで動かす小さな実行環境。
 * 初回はサーバー側で描画済みのHTMLをそのまま使い（ハイドレーション）、
 * 状態が変わったときだけ差分を当てるので、動いているアニメーションは止まりません。
 */
(function () {
  'use strict';

  var HOLE = /\{\{\s*([^}]+?)\s*\}\}/g;
  var ONE = /^\{\{\s*([^}]+?)\s*\}\}$/;
  var HTML_NS = 'http://www.w3.org/1999/xhtml';
  var XLINK = 'http://www.w3.org/1999/xlink';

  function get(path, scope) {
    path = path.trim();
    if (path === 'true') return true;
    if (path === 'false') return false;
    if (path === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
    var parts = path.split('.');
    var o = scope;
    for (var i = 0; i < parts.length; i++) {
      if (o == null) return undefined;
      o = o[parts[i]];
    }
    return o;
  }

  function interp(text, scope) {
    return text.replace(HOLE, function (m, p) {
      var v = get(p, scope);
      return v == null ? '' : String(v);
    });
  }

  function keepsBool(name) { return /^(aria|data)-/.test(name); }

  // ---- テンプレート → 仮想ノード -------------------------------------------
  function pushText(out, s) {
    if (!s) return;
    var last = out.length ? out[out.length - 1] : null;
    if (typeof last === 'string') out[out.length - 1] = last + s;
    else out.push(s);
  }

  function renderKids(nodes, scope, out) {
    for (var i = 0; i < nodes.length; i++) renderNode(nodes[i], scope, out);
    return out;
  }

  function renderNode(n, scope, out) {
    if (n.nodeType === 3) { pushText(out, interp(n.nodeValue, scope)); return; }
    if (n.nodeType !== 1) return;
    var tag = n.localName;

    if (tag === 'sc-for') {
      var lm = ONE.exec((n.getAttribute('list') || '').trim());
      var list = lm ? get(lm[1], scope) : null;
      var as = n.getAttribute('as') || 'item';
      if (list && list.length) {
        for (var i = 0; i < list.length; i++) {
          var sc = Object.create(scope);
          sc[as] = list[i];
          sc.$index = i;
          renderKids(n.childNodes, sc, out);
        }
      }
      return;
    }
    if (tag === 'sc-if') {
      var vm = ONE.exec((n.getAttribute('value') || '').trim());
      if (vm && get(vm[1], scope)) renderKids(n.childNodes, scope, out);
      return;
    }

    var attrs = {};
    var on = null;
    for (var j = 0; j < n.attributes.length; j++) {
      var a = n.attributes[j];
      var name = a.name;
      if (name.indexOf('hint-') === 0) continue;
      if (/^on[a-z]+$/i.test(name)) {
        var hm = ONE.exec(a.value.trim());
        var fn = hm ? get(hm[1], scope) : null;
        if (typeof fn === 'function') (on || (on = {}))[name.slice(2).toLowerCase()] = fn;
        continue;
      }
      var whole = ONE.exec(a.value.trim());
      if (whole) {
        var v = get(whole[1], scope);
        if (v == null) continue;
        if (v === false && !keepsBool(name)) continue;
        attrs[name] = (v === true && !keepsBool(name)) ? '' : String(v);
      } else {
        attrs[name] = interp(a.value, scope);
      }
    }
    var src = n.content || n;
    out.push({ tag: tag, ns: n.namespaceURI || HTML_NS, attrs: attrs, on: on, kids: renderKids(src.childNodes, scope, []) });
  }

  // ---- 仮想ノード → 実DOM ---------------------------------------------------
  function setAttr(el, k, v) {
    if (k.indexOf('xlink:') === 0) el.setAttributeNS(XLINK, k, v);
    else el.setAttribute(k, v);
  }

  function create(v) {
    if (typeof v === 'string') return document.createTextNode(v);
    var el = v.ns === HTML_NS ? document.createElement(v.tag) : document.createElementNS(v.ns, v.tag);
    var cur = {};
    for (var k in v.attrs) { setAttr(el, k, v.attrs[k]); cur[k] = v.attrs[k]; }
    el.__dcv = cur;
    el.__dch = v.on;
    for (var i = 0; i < v.kids.length; i++) el.appendChild(create(v.kids[i]));
    return el;
  }

  function sameEl(real, v) {
    return real.nodeType === 1 && real.localName === v.tag && (real.namespaceURI || HTML_NS) === v.ns;
  }

  function patchEl(el, v) {
    var prev = el.__dcv;
    var k;
    if (!prev) {
      // サーバー描画済みの要素を引き継ぐ（最初の1回だけ）
      prev = {};
      for (k in v.attrs) prev[k] = el.getAttribute(k);
    }
    for (k in v.attrs) if (prev[k] !== v.attrs[k]) setAttr(el, k, v.attrs[k]);
    for (k in prev) if (!(k in v.attrs) && prev[k] != null) el.removeAttribute(k);
    var cur = {};
    for (k in v.attrs) cur[k] = v.attrs[k];
    el.__dcv = cur;
    el.__dch = v.on;
    morphKids(el, v.kids);
  }

  function morphKids(parent, kids) {
    var real = parent.firstChild;
    for (var i = 0; i < kids.length; i++) {
      var v = kids[i];
      while (real && real.nodeType !== 1 && real.nodeType !== 3) {
        var skip = real.nextSibling;
        parent.removeChild(real);
        real = skip;
      }
      if (!real) { parent.appendChild(create(v)); continue; }
      if (typeof v === 'string') {
        if (real.nodeType === 3) {
          if (real.nodeValue !== v) real.nodeValue = v;
          real = real.nextSibling;
        } else {
          parent.insertBefore(document.createTextNode(v), real);
        }
        continue;
      }
      if (sameEl(real, v)) {
        patchEl(real, v);
        real = real.nextSibling;
      } else {
        var fresh = create(v);
        parent.replaceChild(fresh, real);
        real = fresh.nextSibling;
      }
    }
    while (real) {
      var next = real.nextSibling;
      parent.removeChild(real);
      real = next;
    }
  }

  // ---- イベント（ルートでまとめて受ける） ----------------------------------
  function collectEvents(nodes, set) {
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.nodeType !== 1) continue;
      for (var j = 0; j < n.attributes.length; j++) {
        var name = n.attributes[j].name;
        if (/^on[a-z]+$/i.test(name)) set[name.slice(2).toLowerCase()] = 1;
      }
      collectEvents((n.content || n).childNodes, set);
    }
    return set;
  }

  function delegate(root, types) {
    Object.keys(types).forEach(function (type) {
      root.addEventListener(type, function (e) {
        var n = e.target;
        while (n && n !== root) {
          var h = n.__dch && n.__dch[type];
          if (h) {
            try { h(e); } catch (err) { console.error(err); }
            if (e.cancelBubble) return;
          }
          n = n.parentNode;
        }
      });
    });
  }

  // ---- コンポーネント -------------------------------------------------------
  function DCLogic(props) {
    this.props = props || {};
    this.state = {};
  }
  DCLogic.prototype.setState = function (patch, cb) {
    var p = typeof patch === 'function' ? patch(this.state, this.props) : patch;
    if (!p) return;
    if (!this.__prev) this.__prev = this.state;
    var next = {};
    var k;
    for (k in this.state) next[k] = this.state[k];
    for (k in p) next[k] = p[k];
    this.state = next;
    if (this.__dc) this.__dc.schedule(cb);
  };
  DCLogic.prototype.forceUpdate = function (cb) {
    if (this.__dc) this.__dc.schedule(cb);
  };
  window.DCLogic = DCLogic;

  window.dcMount = function (opts) {
    var root = document.getElementById(opts.root || 'dc-root');
    var tpl = document.createElement('template');
    tpl.innerHTML = opts.template;
    var nodes = tpl.content.childNodes;
    var props = opts.props || {};
    var comp = new opts.Component(props);
    var queued = false;
    var callbacks = [];

    function vnodes() {
      var vals = typeof comp.renderVals === 'function' ? comp.renderVals() : {};
      return renderKids(nodes, vals || {}, []);
    }
    function flush() {
      queued = false;
      var prevState = comp.__prev || comp.state;
      comp.__prev = null;
      morphKids(root, vnodes());
      if (typeof comp.componentDidUpdate === 'function') {
        try { comp.componentDidUpdate(props, prevState); } catch (err) { console.error(err); }
      }
      var list = callbacks;
      callbacks = [];
      list.forEach(function (f) { try { f(); } catch (err) { console.error(err); } });
    }
    comp.__dc = {
      schedule: function (cb) {
        if (typeof cb === 'function') callbacks.push(cb);
        if (queued) return;
        queued = true;
        Promise.resolve().then(flush);
      }
    };

    morphKids(root, vnodes());
    root.setAttribute('data-dc', window.__DC_SSR ? 'ssr' : 'live');
    if (!window.__DC_SSR) {
      delegate(root, collectEvents(nodes, {}));
      if (typeof comp.componentDidMount === 'function') {
        try { comp.componentDidMount(); } catch (err) { console.error(err); }
      }
    }
    return comp;
  };
})();
