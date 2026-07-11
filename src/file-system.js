// File System Access API & Tree Viewer Panel
'use strict';

import { state } from './state.js';
import { log, showAlert, updateVariablesUI } from './ui.js';

/**
 * Request directory access permission and open folder
 */
export async function connectDirectory() {
  if (typeof window.showDirectoryPicker === 'undefined') {
    const msg = state.lang === 'en'
      ? 'Browser Directory Access API is not supported in this browser. Please use Chrome/Edge.'
      : 'ブラウザの Directory Access API がサポートされていません。Chrome または Edge をご使用ください。';
    log(msg, 'error');
    showAlert(state.lang === 'en' ? 'Browser Compatibility' : 'ブラウザの互換性', msg);
    return;
  }
  try {
    const dirHandle = await window.showDirectoryPicker();
    state.directoryHandle = dirHandle;
    
    const badgeText = document.getElementById('dir-badge-text');
    const badge = document.getElementById('dir-badge');
    if (badge && badgeText) {
      badge.className = 'status-badge success';
      badgeText.innerText = `Folder: ${dirHandle.name}`;
      badgeText.removeAttribute('data-i18n');
    }
    
    log(state.lang === 'en' ? `Connected to directory: ${dirHandle.name}` : `ディレクトリに接続しました: ${dirHandle.name}`, 'success');
    
    // Auto-focus the Files tab in the right sidebar
    const filesTabBtn = document.querySelector('.tab-btn[data-tab="tab-files"]');
    if (filesTabBtn) {
      filesTabBtn.click();
    }
    
    await refreshFileTree();
  } catch (e) {
    log(`Failed to connect directory: ${e.message}`, 'error');
  }
}

export async function refreshFileTree() {
  if (!state.directoryHandle) return;
  state.filesList = [];
  
  try {
    await scanDirectory(state.directoryHandle);
    renderFileTree();
  } catch (e) {
    log(`Error scanning directory: ${e.message}`, 'error');
  }
}

async function scanDirectory(dirHandle, path = '') {
  for await (const entry of dirHandle.values()) {
    // Exclude common build directories, hidden files, and git
    if (entry.name.startsWith('.') || 
        entry.name === 'node_modules' || 
        entry.name === 'dist' || 
        entry.name === 'build') {
      continue;
    }
    
    if (entry.kind === 'directory') {
      await scanDirectory(entry, path + entry.name + '/');
    } else if (entry.kind === 'file') {
      state.filesList.push({
        name: entry.name,
        path: path + entry.name,
        handle: entry
      });
    }
  }
}

function renderFileTree() {
  const container = document.getElementById('file-tree');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (state.filesList.length === 0) {
    container.innerHTML = `<span class="placeholder-text">${state.lang === 'en' ? 'No files found' : 'ファイルが見つかりません'}</span>`;
    return;
  }
  
  // Build nested folder/files structure
  const root = { files: [], subdirs: {} };
  
  state.filesList.forEach(file => {
    const parts = file.path.split('/');
    let current = root;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current.subdirs[part]) {
        current.subdirs[part] = { files: [], subdirs: {} };
      }
      current = current.subdirs[part];
    }
    
    current.files.push(file);
  });
  
  // Recursive render helper
  function renderSubtree(dir, name, depth = 0) {
    const ul = document.createElement('ul');
    ul.className = 'tree-subdir';
    ul.style.paddingLeft = name ? '10px' : '0px';
    ul.style.listStyle = 'none';
    
    if (name) {
      const liDir = document.createElement('li');
      liDir.className = 'tree-dir-header';
      liDir.style.fontWeight = '600';
      liDir.style.margin = '4px 0';
      liDir.style.cursor = 'default';
      liDir.innerHTML = `📁 <span style="opacity:0.95;">${name}</span>`;
      ul.appendChild(liDir);
    }
    
    // Sort and append subdirs
    Object.keys(dir.subdirs).sort().forEach(subdirName => {
      const subdirEl = renderSubtree(dir.subdirs[subdirName], subdirName, depth + 1);
      ul.appendChild(subdirEl);
    });
    
    // Sort and append files
    dir.files.sort((a, b) => a.name.localeCompare(b.name)).forEach(file => {
      const liFile = document.createElement('li');
      liFile.className = 'file-item';
      liFile.innerHTML = `<span class="file-icon">📄</span> <span class="file-name-text">${file.name}</span>`;
      liFile.addEventListener('click', () => {
        document.querySelectorAll('.file-item').forEach(el => el.classList.remove('active'));
        liFile.classList.add('active');
        previewFile(file);
      });
      ul.appendChild(liFile);
    });
    
    return ul;
  }
  
  const treeHTML = renderSubtree(root, '');
  container.appendChild(treeHTML);
}

async function previewFile(file) {
  try {
    const fileObj = await file.handle.getFile();
    const text = await fileObj.text();
    
    // Create preview modal dynamically
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'file-preview-modal';
    
    // Escape HTML contents
    const escapedText = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
      
    overlay.innerHTML = `
      <div class="modal-card" style="width: 760px; max-width: 90vw; border-color: rgba(56, 189, 248, 0.4); max-height: 80vh;">
        <div class="modal-header">
          <span style="font-weight:600; display:flex; align-items:center; gap:8px;">
            <span style="color:var(--primary); filter:none; font-size:16px;">📄</span>
            <span>${file.path}</span>
          </span>
          <button id="close-preview-modal-x" class="modal-close-x">&times;</button>
        </div>
        <div class="modal-body" style="padding: 0; overflow: auto; background-color: #05080f;">
          <pre style="margin: 0; padding: 16px; font-family: var(--font-mono); font-size: 11px; color: #f1f5f9; line-height: 1.5; white-space: pre-wrap; word-break: break-all;">${escapedText}</pre>
        </div>
        <div class="modal-footer" style="padding: 10px 20px;">
          <button id="modal-select-as-input-btn" class="btn btn-primary btn-sm">${state.lang === 'en' ? 'Load to Variables' : '変数メモリに読み込む'}</button>
          <button id="close-preview-modal-btn" class="btn btn-secondary btn-sm">${state.lang === 'en' ? 'Close' : '閉じる'}</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    const closeX = document.getElementById('close-preview-modal-x');
    const closeBtn = document.getElementById('close-preview-modal-btn');
    const loadBtn = document.getElementById('modal-select-as-input-btn');
    
    const closePreview = () => {
      overlay.remove();
    };
    
    closeX.addEventListener('click', closePreview);
    closeBtn.addEventListener('click', closePreview);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closePreview();
    });
    
    loadBtn.addEventListener('click', () => {
      state.variables['file_content'] = text;
      updateVariablesUI();
      log(state.lang === 'en' 
        ? `Loaded file content to variable: file_content` 
        : `ファイル内容を変数「file_content」に読み込みました。`, 'success');
      closePreview();
    });
  } catch (e) {
    log(`Failed to read file: ${e.message}`, 'error');
  }
}
