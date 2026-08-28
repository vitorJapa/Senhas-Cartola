// ==UserScript==
// @name         Cartoleiros Senhas — Autofill Huntera
// @namespace    cartoleiros-senhas
// @version      2.1
// @description  Abre a Huntera já preenchida: lê o cofre Cartoleiros Senhas e preenche e-mail e senha na tela de login.
// @match        https://huntera.com.br/*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @connect      github.io
// @connect      127.0.0.1
// @connect      localhost
// ==/UserScript==

(function () {
  'use strict';
  const LOG = (...a) => console.log('%c[Cartoleiros]', 'color:#4f8cff', ...a);

  // Captura o hint de conta (#csid=...) cedo — o SPA da Huntera pode limpar a hash.
  let CSID = null;
  const m = (location.hash || '').match(/csid=([A-Za-z0-9]+)/);
  if (m) CSID = m[1];
  LOG('script carregado. csid =', CSID, 'url =', location.href);

  // ---------- SELO DE STATUS (visível, pra diagnosticar) ----------
  let badgeEl = null;
  function badge(text, color) {
    if (!badgeEl) {
      badgeEl = document.createElement('div');
      badgeEl.id = 'cs-badge';
      badgeEl.style.cssText = 'position:fixed;top:12px;right:12px;z-index:2147483647;' +
        'background:#161b22;color:#e6edf3;border:1px solid #2a323d;border-radius:20px;' +
        'padding:7px 12px;font:600 12px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;' +
        'box-shadow:0 6px 20px rgba(0,0,0,.5);max-width:300px;cursor:default';
      (document.body || document.documentElement).appendChild(badgeEl);
    }
    badgeEl.textContent = '🔐 ' + text;
    if (color) badgeEl.style.borderColor = color;
    LOG(text);
  }

  // ---------- CRIPTOGRAFIA (idêntica ao cofre) ----------
  const enc = new TextEncoder(), dec = new TextDecoder();
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  async function deriveKey(pw, salt) {
    const base = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  }
  async function decryptVault(blob, pw) {
    const [ver, s, i, c] = blob.trim().split('.');
    if (ver !== 'v1') throw new Error('formato desconhecido');
    const key = await deriveKey(pw, unb64(s));
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(i) }, key, unb64(c));
    return JSON.parse(dec.decode(pt));
  }

  // ---------- REDE (via extensão, sem CORS) ----------
  function fetchText(url) {
    return new Promise((res, rej) => {
      GM_xmlhttpRequest({
        method: 'GET', url, timeout: 8000,
        onload: r => res(r.responseText || ''),
        onerror: () => rej(new Error('sem conexão (@connect / URL?)')),
        ontimeout: () => rej(new Error('timeout')),
      });
    });
  }

  // ---------- CONFIG (cacheada pelo Tampermonkey) ----------
  const getCfg = (k, def) => { try { return GM_getValue(k, def); } catch { return def; } };
  const setCfg = (k, v) => { try { GM_setValue(k, v); } catch {} };
  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('Cartoleiros: redefinir URL/senha do cofre', () => {
      setCfg('vaultUrl', ''); setCfg('pass', '');
      alert('Config do Cartoleiros limpa. Recarregue a tela de login pra configurar de novo.');
    });
  }

  // ---------- PREENCHIMENTO ----------
  const q = s => document.querySelector(s);
  function fill(email, password) {
    const e = q('input[name="email"]'), p = q('input[name="password"]');
    if (!e || !p) return false;
    const S = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    const set = (el, v) => {
      S.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    set(e, email || ''); set(p, password || ''); p.focus();
    return true;
  }

  // ---------- SELETOR (quando não veio #csid) ----------
  const esc = s => String(s).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function picker(entries) {
    document.getElementById('cs-af')?.remove();
    const st = document.createElement('style');
    st.textContent = `#cs-af{position:fixed;top:52px;right:12px;z-index:2147483647;width:260px;
      background:#161b22;color:#e6edf3;border:1px solid #2a323d;border-radius:12px;padding:12px 14px;
      font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.5)}
      #cs-af .h{font-weight:700;font-size:14px;margin-bottom:8px}
      #cs-af select{width:100%;background:#1c232d;color:#e6edf3;border:1px solid #2a323d;
      border-radius:8px;padding:9px;font:inherit;outline:none}`;
    document.head.appendChild(st);
    const box = document.createElement('div');
    box.id = 'cs-af';
    box.innerHTML = '<div class="h">Escolha o personagem</div>' +
      '<select><option value="">—</option>' +
      entries.map((e, i) => `<option value="${i}">${esc(e.label || e.email || ('conta ' + (i + 1)))}` +
        `${e.vocation ? ' · ' + esc(e.vocation) : ''}</option>`).join('') + '</select>';
    document.body.appendChild(box);
    box.querySelector('select').onchange = function () {
      const e = entries[this.value]; if (e && fill(e.email, e.password)) badge('preenchido ✓', '#2ea043');
    };
  }

  // ---------- CARREGA O COFRE ----------
  async function loadVault() {
    let url = getCfg('vaultUrl', '');
    if (!url) {
      url = prompt('Cartoleiros Senhas — cole a URL do cofre (vault.enc):',
        'http://127.0.0.1:8787/vault.enc');
      if (!url) { badge('configuração cancelada', '#d29922'); return null; }
      setCfg('vaultUrl', url.trim());
    }
    badge('buscando o cofre…');
    let raw;
    try { raw = await fetchText(getCfg('vaultUrl', '')); }
    catch (e) {
      badge('erro ao buscar o cofre: ' + e.message, '#e5534b');
      alert('Cartoleiros: não consegui buscar o cofre (' + e.message + ').\n\nURL: ' +
        getCfg('vaultUrl', '') + '\n\nAbra essa URL no navegador — tem que aparecer um texto começando com "v1.".\nPra trocar a URL: menu do Tampermonkey → Cartoleiros: redefinir…');
      return null;
    }
    const line = (raw || '').split(/\r?\n/).find(l => l.trim().startsWith('v1.'));
    if (!line) { badge('cofre inválido/vazio', '#e5534b');
      alert('Cartoleiros: o conteúdo do cofre não parece válido (não achei "v1." na URL ' +
        getCfg('vaultUrl', '') + ').'); return null; }

    for (let attempt = 0; attempt < 3; attempt++) {
      let pass = getCfg('pass', '');
      if (!pass) { pass = prompt('Cartoleiros Senhas — senha-mestra:'); if (pass === null) { badge('senha não informada', '#d29922'); return null; } }
      try { const v = await decryptVault(line, pass); setCfg('pass', pass); return v; }
      catch { setCfg('pass', ''); badge('senha-mestra incorreta', '#e5534b'); alert('Senha-mestra incorreta. Tente de novo.'); }
    }
    return null;
  }

  function waitFields(cb) {
    let n = 0;
    const t = setInterval(() => {
      if (q('input[name="password"]')) { clearInterval(t); cb(true); }
      else if (n++ > 60) { clearInterval(t); cb(false); }   // ~18s
    }, 300);
  }

  // ---------- BOOT (roda já, sem depender de DOMContentLoaded) ----------
  async function boot() {
    badge('ativo — procurando o login…');
    waitFields(async ok => {
      if (!ok) { badge('sem tela de login aqui', '#d29922'); return; }
      const vault = await loadVault();
      if (!vault) return;
      if (!vault.entries || !vault.entries.length) { badge('cofre sem contas', '#d29922'); return; }
      if (CSID) {
        const e = vault.entries.find(x => x.id === CSID);
        if (e) {
          if (fill(e.email, e.password)) badge('preenchido: ' + (e.label || e.email) + ' ✓', '#2ea043');
          else badge('não achei os campos de login', '#e5534b');
          return;
        }
        badge('conta do link não encontrada (mostrando seletor)', '#d29922');
      }
      picker(vault.entries);
      badge('escolha o personagem →');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
