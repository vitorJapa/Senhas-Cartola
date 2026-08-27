// ==UserScript==
// @name         Cartoleiros Senhas — Autofill Huntera
// @namespace    cartoleiros-senhas
// @version      1.0
// @description  Coloca um seletor de personagem na tela de login da Huntera e preenche e-mail e senha a partir do seu cofre local (Cartoleiros Senhas).
// @match        https://huntera.com.br/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @connect      127.0.0.1
// @connect      localhost
// ==/UserScript==

(function () {
  'use strict';

  // Onde o cofre local (cofre.py) esta rodando:
  const COFRE = 'http://127.0.0.1:8787';

  // ---------- CRIPTOGRAFIA (mesma do cofre) ----------
  const enc = new TextEncoder(), dec = new TextDecoder();
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

  async function deriveKey(pw, salt) {
    const base = await crypto.subtle.importKey(
      'raw', enc.encode(pw), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  }

  async function decryptVault(blob, pw) {
    const [ver, s, i, c] = blob.split('.');
    if (ver !== 'v1') throw new Error('formato desconhecido');
    const key = await deriveKey(pw, unb64(s));
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: unb64(i) }, key, unb64(c));
    return JSON.parse(dec.decode(pt));
  }

  // ---------- BUSCA O COFRE (via extensao, sem CORS) ----------
  function getVault() {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET', url: COFRE + '/vault', timeout: 4000,
        onload: r => { try { resolve(JSON.parse(r.responseText)); } catch (e) { reject(e); } },
        onerror: () => reject(new Error('cofre offline')),
        ontimeout: () => reject(new Error('timeout')),
      });
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
    set(e, email); set(p, password); p.focus();
    return true;
  }

  // ---------- UI ----------
  function esc(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function injectStyle() {
    if (document.getElementById('cs-style')) return;
    const st = document.createElement('style');
    st.id = 'cs-style';
    st.textContent = `
      #cs-autofill{position:fixed;top:14px;right:14px;z-index:2147483647;
        width:260px;background:#161b22;color:#e6edf3;border:1px solid #2a323d;
        border-radius:12px;padding:12px 14px;
        font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
        box-shadow:0 8px 30px rgba(0,0,0,.5)}
      #cs-autofill .cs-h{font-weight:700;font-size:14px;margin-bottom:8px}
      #cs-autofill select{width:100%;background:#1c232d;color:#e6edf3;
        border:1px solid #2a323d;border-radius:8px;padding:9px 10px;font:inherit;outline:none}
      #cs-autofill select:focus{border-color:#4f8cff}
      #cs-autofill .cs-hint{color:#8b98a5;font-size:11px;margin-top:8px;line-height:1.4}
      #cs-autofill .cs-x{position:absolute;top:8px;right:10px;cursor:pointer;
        color:#8b98a5;font-size:15px;line-height:1}
      #cs-autofill .cs-x:hover{color:#e6edf3}`;
    document.head.appendChild(st);
  }

  function buildPanel(entries) {
    injectStyle();
    const old = document.getElementById('cs-autofill');
    if (old) old.remove();
    const box = document.createElement('div');
    box.id = 'cs-autofill';
    const opts = entries.map((e, i) =>
      `<option value="${i}">${esc(e.label || e.email || ('conta ' + (i + 1)))}` +
      `${e.vocation ? ' · ' + esc(e.vocation) : ''}</option>`).join('');
    box.innerHTML =
      '<span class="cs-x" title="Fechar">✕</span>' +
      '<div class="cs-h">🔐 Cartoleiros Senhas</div>' +
      '<select><option value="">Escolha o personagem…</option>' + opts + '</select>' +
      '<div class="cs-hint">Preenche e-mail e senha. Você ainda resolve o “não sou robô” e clica em Entrar.</div>';
    document.body.appendChild(box);
    box.querySelector('.cs-x').addEventListener('click', () => box.remove());
    box.querySelector('select').addEventListener('change', function () {
      const e = entries[this.value];
      if (!e) return;
      if (!fill(e.email || '', e.password || ''))
        alert('Cartoleiros: não encontrei os campos de login nesta página.');
    });
  }

  // ---------- BOOT ----------
  async function start() {
    let tries = 0;
    const timer = setInterval(async () => {
      const temCampos = q('input[name="password"]');
      if (!temCampos && tries++ < 40) return;   // espera o formulario carregar
      clearInterval(timer);
      if (!temCampos) return;                    // nao e uma pagina de login
      try {
        const v = await getVault();
        if (!v.blob) return;                     // cofre vazio
        const vault = await decryptVault(v.blob, v.master);
        if (vault.entries && vault.entries.length) buildPanel(vault.entries);
      } catch (err) {
        console.warn('[Cartoleiros Senhas] cofre indisponível — abra o cofre.py.', err);
      }
    }, 500);
  }

  start();
})();
