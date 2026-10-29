// ==UserScript==
// @name         Gofile Bulk Downloader
// @namespace    https://github.com/xmtaha
// @version      2.2
// @description  Download all files from Gofile automatically by clicking download buttons
// @author       xmtaha
// @match        https://gofile.io/*
// @match        https://*.gofile.io/*
// @match        http://gofile.io/*
// @match        http://*.gofile.io/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG = {
        clickDelay: 1500,
        autoCloseDelay: 5000
    };

    let isDownloading = false;

    const styles = `
        .gofile-bulk-container {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        .bulk-download-btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 15px 25px;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            display: flex;
            align-items: center;
            gap: 8px;
            position: relative;
            overflow: hidden;
        }
        
        .bulk-download-btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 12px 35px rgba(102, 126, 234, 0.4);
        }
        
        .bulk-download-btn:active {
            transform: translateY(-1px);
        }
        
        .bulk-download-btn:disabled {
            opacity: 0.7;
            cursor: not-allowed;
            transform: none;
        }
    `;

    function injectStyles() {
        if (document.getElementById('gofile-bulk-styles')) return;
        const styleSheet = document.createElement('style');
        styleSheet.id = 'gofile-bulk-styles';
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);
    }

    function createMainContainer() {
        const container = document.createElement('div');
        container.className = 'gofile-bulk-container';
        container.style.cssText = `
            position: fixed !important;
            top: 20px !important;
            right: 20px !important;
            z-index: 999999 !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        `;
        
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'bulk-download-btn';
        downloadBtn.style.cssText = `
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
            color: white !important;
            border: none !important;
            padding: 15px 25px !important;
            border-radius: 12px !important;
            font-size: 16px !important;
            font-weight: 600 !important;
            cursor: pointer !important;
            box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3) !important;
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
            transition: all 0.3s ease !important;
        `;
        downloadBtn.innerHTML = `
            <span>📥</span>
            <span>Download All</span>
            <span id="fileCount"></span>
        `;
        downloadBtn.onclick = startBulkDownload;
        
        container.appendChild(downloadBtn);
        return container;
    }

    function findDownloadItems() {
        const items = [];

        // 1. Modern Gofile UI: search by file rows (.fm-row)
        const rows = document.querySelectorAll('.fm-row');
        if (rows.length > 0) {
            rows.forEach((row, index) => {
                // Skip sub-folders to prevent "Download as ZIP / Premium required" prompts
                if (row.getAttribute('data-type') === 'folder') return;

                const nameEl = row.querySelector('p.truncate') || 
                               row.querySelector('[data-action="open-file"] p') || 
                               row.querySelector('[data-action="open-file"]') ||
                               row.querySelector('p');
                const fileName = nameEl?.textContent?.trim() || `file_${index + 1}`;
                
                const btn = row.querySelector('button[data-action="download"]');
                
                items.push({
                    row: row,
                    element: btn,
                    name: fileName.replace(/[<>:"/\\|?*]/g, '_').trim(),
                    download: function() {
                        const targetBtn = this.element || this.row.querySelector('button[data-action="download"]');
                        if (targetBtn) {
                            targetBtn.click();
                        } else if (this.row) {
                            // If Gofile hid or didn't render the inline button, trigger download via row event delegation
                            const tempBtn = document.createElement('button');
                            tempBtn.setAttribute('data-action', 'download');
                            tempBtn.style.display = 'none';
                            this.row.appendChild(tempBtn);
                            tempBtn.click();
                            tempBtn.remove();
                        }
                    }
                });
            });

            if (items.length > 0) {
                console.log(`[Gofile Bulk Downloader] Found ${items.length} files via .fm-row`);
                return items;
            }
        }

        // 2. Modern Gofile UI: search direct download buttons on page (Single file or other layout)
        const actionBtns = document.querySelectorAll('button[data-action="download"], a[data-action="download"]');
        if (actionBtns.length > 0) {
            actionBtns.forEach((btn, index) => {
                if (btn.getAttribute('title')?.includes('ZIP')) return;
                const fileName = getFileNameFromContext(btn) || `file_${index + 1}`;
                items.push({
                    element: btn,
                    name: fileName.replace(/[<>:"/\\|?*]/g, '_').trim(),
                    download: function() { this.element.click(); }
                });
            });
            if (items.length > 0) {
                console.log(`[Gofile Bulk Downloader] Found ${items.length} files via data-action="download"`);
                return items;
            }
        }

        // 3. Fallback: Legacy Gofile UI (FontAwesome or .item_download)
        const legacyBtns = document.querySelectorAll('button.item_download, a.item_download');
        if (legacyBtns.length > 0) {
            legacyBtns.forEach((btn, index) => {
                const fileName = getFileNameFromContext(btn) || `file_${index + 1}`;
                items.push({
                    element: btn,
                    name: fileName.replace(/[<>:"/\\|?*]/g, '_').trim(),
                    download: function() { this.element.click(); }
                });
            });
            if (items.length > 0) {
                console.log(`[Gofile Bulk Downloader] Found ${items.length} files via .item_download`);
                return items;
            }
        }

        return items;
    }

    function getFileNameFromContext(element) {
        const sources = [
            () => element.getAttribute('data-filename'),
            () => element.getAttribute('title'),
            () => element.getAttribute('alt'),
            () => {
                const parent = element.closest('.fm-row, tr, .file-row, .file-item, .content-item');
                if (parent) {
                    const firstCell = parent.querySelector('p.truncate, td:first-child, .file-name, .filename, .name');
                    if (firstCell) return firstCell.textContent?.trim();
                }
                return null;
            },
            () => {
                const text = element.textContent?.trim();
                if (text && text !== 'Download' && text.length > 2) return text;
                return null;
            }
        ];

        for (let i = 0; i < sources.length; i++) {
            try {
                const result = sources[i]();
                if (result && result.length > 2) return result;
            } catch (e) {
                continue;
            }
        }

        return null;
    }

    async function startBulkDownload() {
        if (isDownloading) return;
        
        const downloadItems = findDownloadItems();
        
        if (downloadItems.length === 0) {
            alert('No downloadable files found on this page!\n\nPlease wait for the page to fully load.');
            return;
        }

        const message = `${downloadItems.length} files found.\n\n` +
                       `⚠️ IMPORTANT: This script will download each file automatically.\n` +
                       `Your browser may request confirmation for multiple downloads.\n\n` +
                       `Do you want to continue?`;

        if (!confirm(message)) {
            return;
        }

        isDownloading = true;
        
        const progressDiv = document.createElement('div');
        progressDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0,0,0,0.9);
            color: white;
            padding: 30px;
            border-radius: 15px;
            z-index: 999999;
            text-align: center;
            font-family: Arial, sans-serif;
            box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        `;
        progressDiv.innerHTML = `
            <h3 style="margin: 0 0 15px 0;">🔄 Downloading Files</h3>
            <p id="clickProgress" style="margin: 5px 0; font-size: 15px;">0 / ${downloadItems.length} files started</p>
            <p style="color: #aaa; font-size: 12px; margin-top: 10px;">Browser confirmation may be required for multiple downloads</p>
            <button onclick="this.parentElement.remove(); window.cancelBulkDownload = true;" 
                    style="background: #ff4444; color: white; border: none; padding: 10px 20px; border-radius: 5px; margin-top: 15px; cursor: pointer; font-weight: bold;">
                Cancel
            </button>
        `;
        document.body.appendChild(progressDiv);
        
        window.cancelBulkDownload = false;
        let clickedCount = 0;
        
        try {
            for (let i = 0; i < downloadItems.length; i++) {
                if (window.cancelBulkDownload) break;
                
                const item = downloadItems[i];
                
                const progressText = document.getElementById('clickProgress');
                if (progressText) {
                    progressText.textContent = `${i + 1} / ${downloadItems.length} files started - ${item.name}`;
                }
                
                try {
                    item.download();
                    clickedCount++;
                } catch (error) {
                    console.error('Error triggering download for:', item.name, error);
                    continue;
                }
                
                await new Promise(resolve => setTimeout(resolve, CONFIG.clickDelay));
            }
            
            if (progressDiv && progressDiv.parentElement) {
                const finalMessage = document.createElement('div');
                finalMessage.style.cssText = progressDiv.style.cssText;
                finalMessage.innerHTML = `
                    <h3 style="margin: 0 0 10px 0;">✅ Process Completed!</h3>
                    <p style="font-size: 15px;">${clickedCount} files triggered for download</p>
                    <p style="color: #aaa; font-size: 12px;">Check your browser's Downloads folder</p>
                    <button onclick="this.parentElement.remove()" 
                            style="background: #4CAF50; color: white; border: none; padding: 10px 20px; border-radius: 5px; margin-top: 15px; cursor: pointer; font-weight: bold;">
                        Close
                    </button>
                `;
                
                document.body.replaceChild(finalMessage, progressDiv);
                
                setTimeout(() => {
                    if (finalMessage.parentElement) {
                        finalMessage.remove();
                    }
                }, CONFIG.autoCloseDelay);
            }
            
        } catch (error) {
            alert('An error occurred during download: ' + error.message);
        } finally {
            isDownloading = false;
            if (progressDiv && progressDiv.parentElement) {
                progressDiv.remove();
            }
        }
    }

    function updateFileCount() {
        const items = findDownloadItems();
        const countElement = document.getElementById('fileCount');
        if (countElement) {
            countElement.textContent = items.length > 0 ? ` (${items.length})` : '';
        }
    }

    function initialize() {
        injectStyles();
        
        const attachButton = () => {
            if (!document.querySelector('.gofile-bulk-container')) {
                const isGofilePage = window.location.hostname.includes('gofile.io');
                if (isGofilePage) {
                    const container = createMainContainer();
                    document.body.appendChild(container);
                }
            }
            updateFileCount();
        };

        const observer = new MutationObserver(() => {
            updateFileCount();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        attachButton();
        setTimeout(attachButton, 1000);
        setTimeout(attachButton, 2000);
        setTimeout(attachButton, 4000);
        setInterval(updateFileCount, 3000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();
