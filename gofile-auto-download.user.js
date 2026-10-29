// ==UserScript==
// @name         Gofile Bulk Downloader
// @namespace    https://github.com/xmtaha
// @version      2.3
// @description  Download all files from Gofile automatically by clicking download buttons
// @author       xmtaha
// @match        https://gofile.io/*
// @match        https://*.gofile.io/*
// @match        http://gofile.io/*
// @match        http://*.gofile.io/*
// @run-at       document-idle
// @grant        none
// @downloadURL https://update.greasyfork.org/scripts/552110/Gofile%20Bulk%20Downloader.user.js
// @updateURL https://update.greasyfork.org/scripts/552110/Gofile%20Bulk%20Downloader.meta.js
// ==/UserScript==

(function () {
  'use strict';

  /* =========================================================
   *  AYARLAR (CONFIG)
   * ========================================================= */
  const CONFIG = {
    // İki indirme arasındaki bekleme süresi (milisaniye).
    // Spam korumasına takılmamak için 1500 - 2000 ms aralığı önerilir.
    delayBetweenClicks: 1800,

    // Butona basıldıktan sonra tarama öncesindeki kısa bekleme (ms)
    initialDelay: 400,

   
    selectors: [
      'button[data-type="download"]',          
      'a[data-type="download"]',               
      '[data-testid*="download" i]',           
      'button[title*="Download" i]',           
      'button[title*="İndir" i]',              
      'button[aria-label*="Download" i]',      
      'a[download]',                           
      '.content-row button[class*="download" i]',  
      '.item button[class*="download" i]',         
      '[class*="action"] button[class*="download" i]',
    ],

    fallbackKeywords: ['download', 'indir'],

    doneMessageDuration: 2500,
  };

  const BTN_ID = 'gm-auto-dl-btn';
  let isRunning = false;

    
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  
  function isVisible(el) {
    if (!el || isOurUi(el)) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  
  function isOurUi(el) {
    return el.closest('#' + BTN_ID) !== null;
  }

 
  
  function findDownloadButtons() {
    const found = new Set();

    
    for (const selector of CONFIG.selectors) {
      try {
        document.querySelectorAll(selector).forEach((el) => {
          if (isVisible(el)) found.add(el);
        });
      } catch (_) {
        
      }
    }

    
    if (found.size === 0) {
      const candidates = document.querySelectorAll('button, a, [role="button"]');
      candidates.forEach((el) => {
        if (!isVisible(el) || isOurUi(el)) return;

        const haystack = [
          el.getAttribute('title'),
          el.getAttribute('aria-label'),
          el.getAttribute('data-tooltip'),
          el.textContent || '',
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (CONFIG.fallbackKeywords.some((kw) => haystack.includes(kw))) {
          found.add(el);
        }
      });
    }

    
    return Array.from(found).sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return ra.top - rb.top || ra.left - rb.left;
    });
  }

  
  function humanLikeClick(el) {
    
    el.scrollIntoView({ block: 'center', behavior: 'instant' });

    const rect = el.getBoundingClientRect();
    const eventInit = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    };

    try {
      el.dispatchEvent(new PointerEvent('pointerdown', eventInit));
      el.dispatchEvent(new MouseEvent('mousedown', eventInit));
      el.dispatchEvent(new PointerEvent('pointerup', eventInit));
      el.dispatchEvent(new MouseEvent('mouseup', eventInit));
    } catch (_) {
      
    }

    el.click();
  }

  
  async function startSequentialDownload() {
    if (isRunning) return;
    isRunning = true;

    const btn = document.getElementById(BTN_ID);
    const label = btn ? btn.querySelector('span') : null;
    const setLabel = (text) => { if (label) label.textContent = text; };
    const originalText = 'Sırayla Otomatik İndir';

    setLabel('Dosyalar taranıyor...');
    await sleep(CONFIG.initialDelay);

    const buttons = findDownloadButtons();

    if (buttons.length === 0) {
      setLabel('Buton bulunamadı! (seçicileri güncelle)');
      await sleep(CONFIG.doneMessageDuration);
      setLabel(originalText);
      isRunning = false;
      return;
    }

    const total = buttons.length;
    let success = 0;

    for (let i = 0; i < total; i++) {
      
      setLabel(`İndiriliyor... (${i + 1}/${total})`);

      try {
        humanLikeClick(buttons[i]);
        success++;
      } catch (err) {
        console.warn('[Gofile Auto-DL] Tıklama başarısız:', buttons[i], err);
      }

      
      if (i < total - 1) {
        await sleep(CONFIG.delayBetweenClicks);
      }
    }

    
    setLabel(`Tamamlandı! (${success}/${total})`);
    await sleep(CONFIG.doneMessageDuration);
    setLabel(originalText);
    isRunning = false;
  }

  
  function createButton() {
    if (document.getElementById(BTN_ID)) return;

    const btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.setAttribute('data-gm-ui', 'true');

    
    Object.assign(btn.style, {
      position: 'fixed',
      top: '16px',
      right: '16px',
      zIndex: '99999',
      padding: '12px 20px',
      background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
      color: '#ffffff',
      border: 'none',
      borderRadius: '10px',
      fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
      boxShadow: '0 4px 14px rgba(34, 197, 94, 0.4)',
      transition: 'transform .15s ease, box-shadow .15s ease, filter .15s ease',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      userSelect: 'none',
    });

    btn.innerHTML = '<span>Sırayla Otomatik İndir</span>';

    
    btn.addEventListener('mouseenter', () => {
      btn.style.filter = 'brightness(1.08)';
      btn.style.transform = 'translateY(-1px)';
      btn.style.boxShadow = '0 6px 18px rgba(34, 197, 94, 0.5)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.filter = '';
      btn.style.transform = '';
      btn.style.boxShadow = '0 4px 14px rgba(34, 197, 94, 0.4)';
    });
    btn.addEventListener('mousedown', () => { btn.style.transform = 'scale(0.97)'; });
    btn.addEventListener('mouseup', () => { btn.style.transform = ''; });

    btn.addEventListener('click', startSequentialDownload);

    document.body.appendChild(btn);
  }

  
  const observer = new MutationObserver(() => {
    createButton();
  });

  function init() {
    createButton();
    observer.observe(document.body, { childList: true, subtree: true });
  }

  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
