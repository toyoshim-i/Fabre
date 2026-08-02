// Canvas Pan/Zoom Controls, Drag-and-Drop, Port Linkage, and Nodes Rendering
'use strict';

import { 
  state, 
  NODE_TYPES, 
  NODE_COLORS, 
  NODE_ICONS, 
  PORT_TEMPLATES, 
  TRANSLATIONS,
  getDefaultSystemPrompt,
  addNode as modelAddNode,
  deleteNode as modelDeleteNode,
  updateNodePosition,
  updateNodeSize,
  updateNodeData,
  setSelectedNode,
  addLink,
  deleteLink,
  clearCanvasState
} from './state.js';
import { log, showNodeProperties, openPromptEditor } from './ui.js';
import { triggerNodeEvent } from './runtime.js';

export function updateCanvasTransform() {
  const canvas = document.getElementById('node-canvas');
  if (!canvas) return;
  canvas.style.transform = `translate(${state.pan.x}px, ${state.pan.y}px) scale(${state.zoom})`;
}

export function initCanvasControls() {
  const viewport = document.getElementById('canvas-viewport');
  if (!viewport) return;
  
  // Panning Event Listeners
  viewport.addEventListener('mousedown', (e) => {
    // Start panning if clicking directly on canvas/viewport (or SVG overlay) or using space/middle-click/right-click
    const isBgClick = e.target === viewport || e.target.id === 'node-canvas' || e.target.id === 'connections-overlay';
    const isPanTrigger = isBgClick || e.button === 1 || e.button === 2 || e.spaceKey;
    
    if (isPanTrigger) {
      state.isPanning = true;
      viewport.style.cursor = 'grabbing';
      state.panStart = { x: e.clientX - state.pan.x, y: e.clientY - state.pan.y };
      e.preventDefault();
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (state.isPanning) {
      state.pan.x = e.clientX - state.panStart.x;
      state.pan.y = e.clientY - state.panStart.y;
      updateCanvasTransform();
    }
  });

  document.addEventListener('mouseup', () => {
    if (state.isPanning) {
      state.isPanning = false;
      viewport.style.cursor = 'grab';
    }
  });

  // Prevent browser context menu on canvas right-click so it can be used for panning
  viewport.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

  // Zooming Event (Mouse Wheel)
  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = 1.08;
    const rect = viewport.getBoundingClientRect();
    
    // Mouse coords relative to viewport
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Mouse coords relative to unscaled canvas
    const canvasX = (mouseX - state.pan.x) / state.zoom;
    const canvasY = (mouseY - state.pan.y) / state.zoom;
    
    const nextZoom = e.deltaY < 0 ? state.zoom * zoomFactor : state.zoom / zoomFactor;
    state.zoom = Math.min(2.0, Math.max(0.25, nextZoom));
    
    // Recalculate pan so zooming centers on mouse cursor
    state.pan.x = mouseX - canvasX * state.zoom;
    state.pan.y = mouseY - canvasY * state.zoom;
    
    updateCanvasTransform();
  });

  // Canvas Control Buttons
  document.getElementById('zoom-in-btn').addEventListener('click', () => {
    state.zoom = Math.min(2.0, state.zoom * 1.25);
    updateCanvasTransform();
  });
  
  document.getElementById('zoom-out-btn').addEventListener('click', () => {
    state.zoom = Math.max(0.25, state.zoom / 1.25);
    updateCanvasTransform();
  });
  
  document.getElementById('zoom-reset-btn').addEventListener('click', () => {
    state.zoom = 1.0;
    state.pan = { x: 0, y: 0 };
    updateCanvasTransform();
  });
  
  document.getElementById('clear-canvas-btn').addEventListener('click', () => {
    clearCanvas();
  });
}

/**
 * Initialize reactive listeners for Model updates
 */
export function initCanvasListeners() {
  state.on('nodeAdded', (newNode) => {
    renderNode(newNode);
    selectNode(newNode.id);
    drawConnections();
    log(state.lang === 'en' ? `Added ${newNode.type} node.` : `${newNode.title}ノードを作成しました。`, 'info');
  });
  
  state.on('nodeDeleted', (nodeId) => {
    const el = document.getElementById(nodeId);
    if (el) el.remove();
    log(state.lang === 'en' ? `Deleted node ${nodeId}.` : `ノードを削除しました。`, 'warning');
  });
  
  state.on('nodeMoved', ({ id, x, y }) => {
    const card = document.getElementById(id);
    if (card) {
      card.style.left = `${x}px`;
      card.style.top = `${y}px`;
      drawConnections();
    }
  });
  
  state.on('nodeResized', ({ id, width, height }) => {
    const card = document.getElementById(id);
    if (card) {
      card.style.width = `${width}px`;
      card.style.minHeight = `${height}px`;
      card.style.height = 'auto';
      drawConnections();
    }
  });
  
  state.on('nodeDataChanged', ({ id, key, value, node }) => {
    const card = document.getElementById(id);
    if (!card) return;
    
    if (node.type === NODE_TYPES.START && key === 'inputValue') {
      const inlineInput = card.querySelector('.inline-edit[data-prop="inputValue"]');
      if (inlineInput) inlineInput.value = value;
    } else if (node.type === NODE_TYPES.PROMPT && key === 'promptTemplate') {
      const cardField = card.querySelector('.node-body div div');
      if (cardField) {
        const displayVal = value ? (value.substring(0, 30) + (value.length > 30 ? '...' : '')) : '';
        cardField.innerHTML = displayVal ? displayVal : '<i>Empty Template</i>';
      }
    } else if (node.type === NODE_TYPES.LLM && key === 'temperature') {
      const tempDiv = card.querySelector('.node-body div div');
      if (tempDiv) tempDiv.innerText = value;
    } else if (node.type === NODE_TYPES.SET_VAR && key === 'variableName') {
      const inlineInput = card.querySelector('.inline-edit[data-prop="variableName"]');
      if (inlineInput) inlineInput.value = value;
    } else if (node.type === NODE_TYPES.EXTRACTOR && key === 'extractorType') {
      const cardTypeDiv = card.querySelector('.node-body div div');
      if (cardTypeDiv) cardTypeDiv.innerText = value;
    } else if (node.type === NODE_TYPES.CONDITION) {
      const cardDiv = card.querySelector('.node-body div div');
      if (cardDiv) {
        cardDiv.innerText = `${node.data.conditionType || 'contains'} : "${node.data.conditionValue || ''}"`;
      }
    } else if (node.type === NODE_TYPES.TOOL && key === 'toolType') {
      const cardToolDiv = card.querySelector('.node-body div div');
      if (cardToolDiv) cardToolDiv.innerText = value;
    } else if (node.type === NODE_TYPES.OUTPUT && key === 'outputLabel') {
      const inlineInput = card.querySelector('.inline-edit[data-prop="outputLabel"]');
      if (inlineInput) inlineInput.value = value;
    }
  });
  
  state.on('nodeTitleChanged', ({ id, title }) => {
    const card = document.getElementById(id);
    if (card) {
      const cardTitleSpan = card.querySelector('.node-title span:last-child');
      if (cardTitleSpan) cardTitleSpan.innerText = title;
    }
  });
  
  state.on('selectedNodeChanged', (nodeId) => {
    document.querySelectorAll('.node-card').forEach(card => {
      if (card.id === nodeId) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });
    
    if (nodeId) {
      showNodeProperties(nodeId);
    } else {
      const propSection = document.getElementById('node-properties-section');
      if (propSection) propSection.classList.add('collapsed');
    }
  });
  
  state.on('linksChanged', () => {
    drawConnections();
  });
  
  state.on('canvasCleared', () => {
    document.getElementById('nodes-container').innerHTML = '';
  });
}

/**
 * Clear canvas elements
 */
export function clearCanvas() {
  clearCanvasState();
}

/**
 * Generate HTML representation of a node and add it to canvas
 * @param {object} node Node data definition
 */
export function renderNode(node) {
  const container = document.getElementById('nodes-container');
  if (!container) return;

  const card = document.createElement('div');
  card.className = `node-card ${state.selectedNodeId === node.id ? 'selected' : ''}`;
  card.id = node.id;
  card.style.left = `${node.x}px`;
  card.style.top = `${node.y}px`;
  card.style.width = `${node.width || 280}px`;
  if (node.height) {
    card.style.minHeight = `${node.height}px`;
  }
  
  const template = PORT_TEMPLATES[node.type];

  // Compose Node UI Card markup
  let html = `
    <div class="node-header" style="background-color: ${NODE_COLORS[node.type]}">
      <div class="node-title">
        <span class="node-header-icon">${NODE_ICONS[node.type]}</span>
        <span>${node.title}</span>
      </div>
      <button class="node-delete-btn" title="Delete Node">&times;</button>
    </div>
    <div class="node-body">
  `;

  if (node.type === NODE_TYPES.START) {
    html += `<div class="node-field-group"><label data-i18n="prop_start_val">Input Value</label><input type="text" class="node-input-text inline-edit" data-prop="inputValue" value="${node.data.inputValue || ''}" placeholder="Initial input text..."></div>`;
  } else if (node.type === NODE_TYPES.EVENT_WAIT) {
    html += `
      <div class="node-field-group">
        <label data-i18n="node_event_wait">Event Wait</label>
        <input type="text" class="node-input-text inline-edit" data-prop="eventInput" value="${node.data.lastEventValue || ''}" data-i18n-placeholder="event_wait_placeholder" placeholder="Type event payload...">
        <button class="btn btn-primary btn-xs send-event-btn" style="margin-top: 6px; width: 100%; font-size: 10px;" data-i18n="btn_send_event">Send Event</button>
      </div>
    `;
  } else if (node.type === NODE_TYPES.PROMPT) {
    const displayVal = node.data.promptTemplate ? (node.data.promptTemplate.substring(0, 30) + (node.data.promptTemplate.length > 30 ? '...' : '')) : '';
    html += `<div class="node-field-group"><label data-i18n="prop_prompt_tmpl">Prompt Template</label><div style="font-family: var(--font-mono); font-size:10px; color:var(--text-muted); min-height:16px;">${displayVal || '<i>Empty Template</i>'}</div></div>`;
  } else if (node.type === NODE_TYPES.LLM) {
    html += `<div class="node-field-group"><label data-i18n="prop_llm_temp">Temperature</label><div>${node.data.temperature !== undefined ? node.data.temperature : 0.7}</div></div>`;
  } else if (node.type === NODE_TYPES.SET_VAR) {
    html += `<div class="node-field-group"><label data-i18n="prop_var_name">Var Name</label><input type="text" class="node-input-text inline-edit" data-prop="variableName" value="${node.data.variableName || ''}" placeholder="e.g. current_code"></div>`;
  } else if (node.type === NODE_TYPES.EXTRACTOR) {
    html += `<div class="node-field-group"><label data-i18n="prop_extractor_type">Target</label><div>${node.data.extractorType || 'code_block'}</div></div>`;
  } else if (node.type === NODE_TYPES.CONDITION) {
    html += `<div class="node-field-group"><label data-i18n="prop_cond_type">Rule</label><div>${node.data.conditionType || 'contains'} : "${node.data.conditionValue || ''}"</div></div>`;
  } else if (node.type === NODE_TYPES.TOOL) {
    html += `<div class="node-field-group"><label data-i18n="prop_tool_type">Tool</label><div>${node.data.toolType || 'mock_test'}</div></div>`;
  } else if (node.type === NODE_TYPES.STREAM_VIEW) {
    const logs = node.data.streamLogs || [];
    let streamHtml = '';
    if (logs.length === 0) {
      streamHtml = `<p class="placeholder-text" style="font-size:10px;" data-i18n="stream_empty_placeholder">Stream timeline output will appear here...</p>`;
    } else {
      logs.forEach(msg => {
        const isUser = msg.role === 'user';
        streamHtml += `
          <div style="font-size:10px; margin-bottom:4px; padding:4px 6px; border-radius:6px; background:${isUser ? 'rgba(56,189,248,0.15)' : 'rgba(139,92,246,0.15)'}; border:1px solid ${isUser ? 'rgba(56,189,248,0.3)' : 'rgba(139,92,246,0.3)'}">
            <strong style="color:${isUser ? '#38bdf8' : '#a855f7'}">${isUser ? 'User' : 'Assistant'}:</strong> ${msg.text}
          </div>
        `;
      });
    }
    html += `
      <div class="node-field-group">
        <label data-i18n="node_stream_view">Stream View</label>
        <div class="stream-logs-box" style="max-height: 140px; overflow-y: auto; background: rgba(0,0,0,0.3); padding: 6px; border-radius: 6px; border: 1px solid var(--border-color);">
          ${streamHtml}
        </div>
      </div>
    `;
  } else if (node.type === NODE_TYPES.OUTPUT) {
    const valDisplay = node.data.lastOutputValue ? escapeHtml(String(node.data.lastOutputValue)) : '<i style="color: var(--text-muted);" data-i18n="output_empty_placeholder">(No output result yet)</i>';
    html += `
      <div class="node-field-group">
        <label data-i18n="node_output_result">Final Output Result</label>
        <div class="output-result-box" style="max-height: 140px; overflow-y: auto; background: rgba(0,0,0,0.3); padding: 8px; border-radius: 6px; border: 1px solid var(--border-color); font-size: 11px; line-height: 1.4; white-space: pre-wrap; word-break: break-word;">
          ${valDisplay}
        </div>
      </div>
    `;
  }

  html += `</div>`; // End of body

  // Render ports
  html += `<div class="node-ports-wrapper">`;
  
  // Left Column: Inputs
  html += `<div class="ports-column inputs">`;
  template.inputs.forEach(port => {
    html += `
      <div class="port-item ${port.type}-color" data-port-id="${port.id}">
        <div class="port-dot ${port.type}-port" data-port-id="${port.id}" data-port-type="${port.type}" data-is-input="true" style="color: ${port.type === 'flow' ? 'var(--primary)' : 'var(--accent-purple)'}"></div>
        <span>${port.name}</span>
      </div>
    `;
  });
  html += `</div>`;
  
  // Right Column: Outputs
  html += `<div class="ports-column outputs">`;
  template.outputs.forEach(port => {
    html += `
      <div class="port-item ${port.type}-color" data-port-id="${port.id}">
        <span>${port.name}</span>
        <div class="port-dot ${port.type}-port" data-port-id="${port.id}" data-port-type="${port.type}" data-is-input="false" style="color: ${port.type === 'flow' ? 'var(--primary)' : 'var(--accent-purple)'}"></div>
      </div>
    `;
  });
  html += `</div>`;

  html += `</div>`; // End of ports wrapper
  html += `<div class="node-resize-handle"></div>`; // Resize handle

  card.innerHTML = html;
  container.appendChild(card);

  // Apply localization to node card content
  applyLanguageToNodeCard(card);

  // Setup Event Listeners for dragging, deleting, selecting
  setupNodeEvents(card, node);
}

/**
 * Update node title and labels inside the card on language switch
 */
export function applyLanguageToNodeCard(cardEl) {
  const t = TRANSLATIONS[state.lang];
  if (!t) return;
  cardEl.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key]) el.innerText = t[key];
  });
}

/**
 * Bind pointer and mouse events to rendered Node Card
 */
function setupNodeEvents(cardEl, node) {
  const header = cardEl.querySelector('.node-header');
  
  // Selection
  cardEl.addEventListener('click', (e) => {
    // Avoid double trigger if clicking delete button
    if (e.target.classList.contains('node-delete-btn')) return;
    
    selectNode(node.id);
    e.stopPropagation(); // Prevent canvas background click deselecting
  });
  
  // Dragging Logic
  header.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('node-delete-btn')) return;
    
    state.activeDraggingNodeId = node.id;
    selectNode(node.id);
    
    // Start offset calculations
    state.dragOffset = {
      x: e.clientX - node.x * state.zoom,
      y: e.clientY - node.y * state.zoom
    };
    
    header.style.cursor = 'grabbing';
    e.preventDefault();
    e.stopPropagation();
  });
  
  // Inline Inputs updates
  cardEl.querySelectorAll('.inline-edit').forEach(input => {
    input.addEventListener('change', (e) => {
      const propName = e.target.getAttribute('data-prop');
      updateNodeData(node.id, propName, e.target.value);
    });
    
    // Prevent dragging node when typing inside inputs
    input.addEventListener('mousedown', (e) => e.stopPropagation());
  });

  // Delete Node button click
  cardEl.querySelector('.node-delete-btn').addEventListener('click', (e) => {
    modelDeleteNode(node.id);
    e.stopPropagation();
  });

  // Send Event Button and Enter key listener for event_wait node
  const sendEventBtn = cardEl.querySelector('.send-event-btn');
  const eventInputEl = cardEl.querySelector('[data-prop="eventInput"]');

  const triggerEventFromCard = () => {
    const val = eventInputEl ? eventInputEl.value.trim() : '';
    const payload = val || node.data.lastEventValue || 'Event Triggered';
    triggerNodeEvent(node.id, payload);
  };

  if (sendEventBtn) {
    sendEventBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      triggerEventFromCard();
    });
  }

  if (eventInputEl) {
    eventInputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.stopPropagation();
        triggerEventFromCard();
      }
    });
  }

  // Wire up port mouse events for connector lines dragging
  cardEl.querySelectorAll('.port-dot').forEach(dot => {
    dot.addEventListener('mousedown', (e) => {
      const portId = dot.getAttribute('data-port-id');
      const portType = dot.getAttribute('data-port-type');
      const isInput = dot.getAttribute('data-is-input') === 'true';
      
      const portCoords = getPortCenter(node.id, portId);
      
      state.activeLinkDrag = {
        fromNodeId: node.id,
        fromPortId: portId,
        type: portType,
        startX: portCoords.x,
        startY: portCoords.y,
        isInput: isInput
      };
      
      // Show temporary svg link dashed line
      const tempPath = document.getElementById('temp-link');
      if (tempPath) {
        tempPath.style.display = 'block';
        tempPath.setAttribute('stroke', portType === 'flow' ? 'var(--primary)' : 'var(--accent-purple)');
        tempPath.setAttribute('d', `M ${portCoords.x} ${portCoords.y} L ${portCoords.x} ${portCoords.y}`);
      }
      
      e.preventDefault();
      e.stopPropagation();
    });
  });

  // Double click node to open prompt editor
  cardEl.addEventListener('dblclick', (e) => {
    if (e.target.closest('input') || e.target.closest('button') || e.target.closest('.port-dot')) return;
    if (node.type === NODE_TYPES.PROMPT) {
      openPromptEditor(node);
    }
  });

  // Drag Resizing Logic
  const resizeHandle = cardEl.querySelector('.node-resize-handle');
  if (resizeHandle) {
    resizeHandle.addEventListener('mousedown', (e) => {
      state.activeResizingNodeId = node.id;
      state.resizeStartSize = {
        width: cardEl.offsetWidth,
        height: cardEl.offsetHeight
      };
      state.resizeStartMouse = {
        x: e.clientX,
        y: e.clientY
      };
      e.preventDefault();
      e.stopPropagation();
    });
  }
}

/**
 * Handle document pointermove and pointerup globally for node dragging and link connection
 */
export function initGlobalDragAndDrop() {
  document.addEventListener('mousemove', (e) => {
    // 1. Handle Active Node Dragging
    if (state.activeDraggingNodeId) {
      const node = state.nodes.find(n => n.id === state.activeDraggingNodeId);
      if (node) {
        // Calculate new X,Y corrected by the viewport zoom scale!
        const newX = (e.clientX - state.dragOffset.x) / state.zoom;
        const newY = (e.clientY - state.dragOffset.y) / state.zoom;
        updateNodePosition(node.id, newX, newY);
      }
    }
    
    // 2. Handle Port Link Connection Dragging
    if (state.activeLinkDrag) {
      const canvas = document.getElementById('node-canvas');
      const canvasRect = canvas.getBoundingClientRect();
      
      // Calculate cursor relative to unscaled canvas
      const mouseX = (e.clientX - canvasRect.left) / state.zoom;
      const mouseY = (e.clientY - canvasRect.top) / state.zoom;
      
      const tempPath = document.getElementById('temp-link');
      if (tempPath) {
        // Beautify current temporary path drawing
        const x1 = state.activeLinkDrag.startX;
        const y1 = state.activeLinkDrag.startY;
        const x2 = mouseX;
        const y2 = mouseY;
        
        // Curved line dynamically bent based on direction
        const dx = Math.abs(x2 - x1);
        const offset = Math.max(50, dx * 0.4);
        const ctrlX1 = state.activeLinkDrag.isInput ? x1 - offset : x1 + offset;
        const ctrlX2 = state.activeLinkDrag.isInput ? x2 + offset : x2 - offset;
        
        tempPath.setAttribute('d', `M ${x1} ${y1} C ${ctrlX1} ${y1}, ${ctrlX2} ${y2}, ${x2} ${y2}`);
      }
    }

    // 3. Handle Active Node Resizing
    if (state.activeResizingNodeId) {
      const node = state.nodes.find(n => n.id === state.activeResizingNodeId);
      if (node) {
        const dx = (e.clientX - state.resizeStartMouse.x) / state.zoom;
        const dy = (e.clientY - state.resizeStartMouse.y) / state.zoom;
        
        const minH = node.type === NODE_TYPES.START ? 140 : 160;
        const newWidth = Math.max(200, state.resizeStartSize.width + dx);
        const newHeight = Math.max(minH, state.resizeStartSize.height + dy);
        
        updateNodeSize(node.id, newWidth, newHeight);
      }
    }
  });

  document.addEventListener('mouseup', (e) => {
    // 1. Release Node Dragging
    if (state.activeDraggingNodeId) {
      const card = document.getElementById(state.activeDraggingNodeId);
      if (card) {
        card.querySelector('.node-header').style.cursor = 'move';
      }
      state.activeDraggingNodeId = null;
    }
    
    // 2. Release Link Dragging (Establish Connection)
    if (state.activeLinkDrag) {
      const tempPath = document.getElementById('temp-link');
      if (tempPath) tempPath.style.display = 'none';
      
      // Check if released mouse cursor over an opposite port-dot
      const targetDot = document.elementFromPoint(e.clientX, e.clientY);
      const isPortDot = targetDot && targetDot.classList.contains('port-dot');
      
      if (isPortDot) {
        const targetPortId = targetDot.getAttribute('data-port-id');
        const targetPortType = targetDot.getAttribute('data-port-type');
        const targetIsInput = targetDot.getAttribute('data-is-input') === 'true';
        
        // Find parent Node Card ID
        const targetCard = targetDot.closest('.node-card');
        const targetNodeId = targetCard ? targetCard.id : null;
        
        const sourceNodeId = state.activeLinkDrag.fromNodeId;
        const sourcePortId = state.activeLinkDrag.fromPortId;
        const sourceIsInput = state.activeLinkDrag.isInput;
        const sourceType = state.activeLinkDrag.type;
        
        // Validation constraints:
        // - Different nodes
        // - Connect flow to flow, data to data only
        // - Input connects to output or vice-versa
        const isValidLink = targetNodeId && 
                            targetNodeId !== sourceNodeId &&
                            targetPortType === sourceType &&
                            targetIsInput !== sourceIsInput;
                            
        if (isValidLink) {
          // Identify source and destination port correctly
          const fromNode = sourceIsInput ? targetNodeId : sourceNodeId;
          const fromPort = sourceIsInput ? targetPortId : sourcePortId;
          const toNode = sourceIsInput ? sourceNodeId : targetNodeId;
          const toPort = sourceIsInput ? sourcePortId : targetPortId;
          
          // Prevent duplicates
          const exists = state.links.some(l => 
            l.fromNode === fromNode && l.fromPort === fromPort &&
            l.toNode === toNode && l.toPort === toPort
          );
          
          if (!exists) {
            const linkId = `link_${Date.now()}`;
            addLink({
              id: linkId,
              fromNode,
              fromPort,
              toNode,
              toPort,
              type: sourceType
            });
            log(state.lang === 'en' ? `Connected port ${fromPort} ➔ ${toPort}.` : `ポート接続を確立しました: ${fromPort} ➔ ${toPort}`, 'success');
          }
        }
      }
      state.activeLinkDrag = null;
    }

    // 3. Release Resizing
    if (state.activeResizingNodeId) {
      state.activeResizingNodeId = null;
    }
  });

  // Handle deselecting nodes when clicking canvas viewport background
  const viewport = document.getElementById('canvas-viewport');
  if (viewport) {
    viewport.addEventListener('click', (e) => {
      if (e.target === viewport || 
          e.target.id === 'node-canvas' || 
          e.target.id === 'connections-overlay') {
        deselectNodes();
      }
    });
  }
}

/**
 * Select a specific Node and highlight it
 * @param {string} nodeId Target Node ID
 */
export function selectNode(nodeId) {
  setSelectedNode(nodeId);
}

/**
 * Clear Node selections
 */
export function deselectNodes() {
  setSelectedNode(null);
}

/**
 * Add a node to the canvas based on selected type
 * @param {string} type Node type
 * @param {number} x Canvas relative X coordinate
 * @param {number} y Canvas relative Y coordinate
 */
export function createNode(type, x, y) {
  const nodeId = `node_${Date.now()}`;
  const template = PORT_TEMPLATES[type];
  if (!template) return;
  
  const defaultTitle = TRANSLATIONS[state.lang][`node_${type}`] || type;
  
  const newNode = {
    id: nodeId,
    type: type,
    title: defaultTitle,
    x: x,
    y: y,
    width: type === NODE_TYPES.START ? 240 : (type === NODE_TYPES.PROMPT ? 300 : 280),
    height: type === NODE_TYPES.START ? 140 : 170,
    data: {
      promptTemplate: type === NODE_TYPES.PROMPT ? 'Review the following code:\n{{file_content}}\n\nIs it secure?' : '',
      systemPrompt: type === NODE_TYPES.LLM || type === NODE_TYPES.SESSION
        ? 'You are a professional software engineer assistant.' 
        : (type === NODE_TYPES.PROMPT ? getDefaultSystemPrompt() : ''),
      temperature: 0.7,
      modelOverride: '',
      endpointOverride: '',
      apiKeyOverride: '',
      maxHistoryTurns: 10,
      messages: [],
      conditionType: 'contains',
      conditionValue: 'PASS',
      variableName: type === NODE_TYPES.SET_VAR ? 'current_code' : '',
      toolType: 'mock_test',
      outputLabel: type === NODE_TYPES.OUTPUT ? 'Verification Report' : '',
      inputValue: type === NODE_TYPES.START ? 'Initial source code here' : '',
      extractorType: 'code_block',
      extractorPattern: ''
    }
  };
  
  modelAddNode(newNode);
  return newNode;
}

/**
 * Remove node and all connected link wires from canvas
 * @param {string} nodeId Target Node ID
 */
export function deleteNode(nodeId) {
  modelDeleteNode(nodeId);
}

/**
 * Retrieve absolute coordinates of a port dot center relative to unscaled canvas
 */
export function getPortCenter(nodeId, portId) {
  const nodeEl = document.getElementById(nodeId);
  if (!nodeEl) return null;
  
  const portEl = nodeEl.querySelector(`[data-port-id="${portId}"]`);
  if (!portEl) return null;
  
  const canvasEl = document.getElementById('node-canvas');
  const portRect = portEl.getBoundingClientRect();
  const canvasRect = canvasEl.getBoundingClientRect();
  
  // Remove viewport transform zoom factor to get exact pixel coordinate representation
  return {
    x: (portRect.left + portRect.width / 2 - canvasRect.left) / state.zoom,
    y: (portRect.top + portRect.height / 2 - canvasRect.top) / state.zoom
  };
}

/**
 * Render all lines in SVG connections overlay
 */
export function drawConnections() {
  const linksGroup = document.getElementById('links-group');
  if (!linksGroup) return;
  
  linksGroup.innerHTML = '';
  
  state.links.forEach(link => {
    const start = getPortCenter(link.fromNode, link.fromPort);
    const end = getPortCenter(link.toNode, link.toPort);
    if (!start || !end) return;
    
    // Draw smooth cubic bezier
    const dx = Math.abs(end.x - start.x);
    const offset = Math.max(80, dx * 0.4); // Bending offset
    
    const x1 = start.x;
    const y1 = start.y;
    const x2 = end.x;
    const y2 = end.y;
    
    const d = `M ${x1} ${y1} C ${x1 + offset} ${y1}, ${x2 - offset} ${y2}, ${x2} ${y2}`;
    
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('data-link-id', link.id);
    path.className.baseVal = `${link.type}-connection`;
    
    // Highlight if active step running (pulse signal animation class)
    if (state.currentNodeId === link.fromNode && state.runnerState === 'running') {
      path.className.baseVal += ' active-signal';
    }
    
    // Delete link on double click
    path.addEventListener('dblclick', () => {
      deleteLink(link.id);
    });
    
    // Give cursor indication
    path.addEventListener('mouseover', () => {
      path.setAttribute('stroke-width', '4');
    });
    path.addEventListener('mouseout', () => {
      path.setAttribute('stroke-width', '2.5');
    });
    
    linksGroup.appendChild(path);
  });
}

/**
 * Update stream logs box inner HTML reactively without recreating card element
 */
export function updateStreamViewContent(node) {
  if (typeof document === 'undefined') return;
  const card = document.getElementById(node.id);
  if (!card) return;

  const box = card.querySelector('.stream-logs-box');
  if (!box) return;

  const logs = node.data.streamLogs || [];
  let streamHtml = '';
  if (logs.length === 0) {
    streamHtml = `<p class="placeholder-text" style="font-size:10px;" data-i18n="stream_empty_placeholder">Stream timeline output will appear here...</p>`;
  } else {
    logs.forEach(msg => {
      const isUser = msg.role === 'user';
      streamHtml += `
        <div style="font-size:10px; margin-bottom:4px; padding:4px 6px; border-radius:6px; background:${isUser ? 'rgba(56,189,248,0.15)' : 'rgba(139,92,246,0.15)'}; border:1px solid ${isUser ? 'rgba(56,189,248,0.3)' : 'rgba(139,92,246,0.3)'}">
          <strong style="color:${isUser ? '#38bdf8' : '#a855f7'}">${isUser ? 'User' : 'Assistant'}:</strong> ${msg.text}
        </div>
      `;
    });
  }
  box.innerHTML = streamHtml;
  box.scrollTop = box.scrollHeight;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Update Output node result box inner HTML reactively without recreating card element
 */
export function updateOutputNodeContent(node) {
  if (typeof document === 'undefined') return;
  const card = document.getElementById(node.id);
  if (!card) return;

  const box = card.querySelector('.output-result-box');
  if (!box) return;

  box.innerHTML = node.data.lastOutputValue 
    ? escapeHtml(String(node.data.lastOutputValue)) 
    : '<i style="color: var(--text-muted);" data-i18n="output_empty_placeholder">(No output result yet)</i>';
  box.scrollTop = box.scrollHeight;
}
