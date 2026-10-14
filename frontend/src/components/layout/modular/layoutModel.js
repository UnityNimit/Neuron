// frontend/src/components/layout/modular/layoutModel.js

let idCounter = 1;

export function generatePaneId() {
  return `pane_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}_${idCounter++}`;
}

export function generateSplitId() {
  return `split_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}_${idCounter++}`;
}

export function createDefaultModularLayout(openFiles = [], activeFile = null, showTerminal = true, showStdin = true) {
  const fileTabs = [];

  (openFiles || []).forEach(file => {
    if (!file) return;
    const baseName = file.split('/').pop();
    fileTabs.push({
      id: `file:${file}`,
      type: 'file',
      path: file,
      title: baseName
    });
  });

  const paneMap = {
    type: 'pane',
    id: generatePaneId(),
    activeTabId: 'spatial',
    tabs: [{ id: 'spatial', type: 'spatial', title: 'Spatial Map' }]
  };

  let centerNode = paneMap;

  if (fileTabs.length > 0) {
    const activeTabId = activeFile ? `file:${activeFile}` : fileTabs[0].id;
    const paneCode = {
      type: 'pane',
      id: generatePaneId(),
      activeTabId,
      tabs: fileTabs
    };

    centerNode = {
      type: 'split',
      id: generateSplitId(),
      direction: 'horizontal',
      sizes: [50, 50],
      children: [paneMap, paneCode]
    };
  }

  const paneBottom = {
    type: 'pane',
    id: generatePaneId(),
    activeTabId: 'output',
    tabs: [
      { id: 'output', type: 'output', title: 'Output' },
      { id: 'terminal', type: 'terminal', title: 'Terminal' }
    ]
  };

  const paneRight = {
    type: 'pane',
    id: generatePaneId(),
    activeTabId: 'ai',
    tabs: [
      { id: 'ai', type: 'ai', title: 'AI Agent' },
      { id: 'stdin', type: 'stdin', title: 'Input' }
    ]
  };

  if (!showTerminal && !showStdin) {
    return centerNode;
  }

  if (showTerminal && !showStdin) {
    return {
      type: 'split',
      id: generateSplitId(),
      direction: 'vertical',
      sizes: [72, 28],
      children: [centerNode, paneBottom]
    };
  }

  if (!showTerminal && showStdin) {
    return {
      type: 'split',
      id: generateSplitId(),
      direction: 'horizontal',
      sizes: [75, 25],
      children: [centerNode, paneRight]
    };
  }

  return {
    type: 'split',
    id: generateSplitId(),
    direction: 'horizontal',
    sizes: [75, 25],
    children: [
      {
        type: 'split',
        id: generateSplitId(),
        direction: 'vertical',
        sizes: [72, 28],
        children: [centerNode, paneBottom]
      },
      paneRight
    ]
  };
}

function createStandardBottomPane() {
  return {
    type: 'pane',
    id: generatePaneId(),
    activeTabId: 'output',
    tabs: [
      { id: 'output', type: 'output', title: 'Output' },
      { id: 'terminal', type: 'terminal', title: 'Terminal' }
    ]
  };
}

function createStandardRightPane() {
  return {
    type: 'pane',
    id: generatePaneId(),
    activeTabId: 'ai',
    tabs: [
      { id: 'ai', type: 'ai', title: 'AI Agent' },
      { id: 'stdin', type: 'stdin', title: 'Input' }
    ]
  };
}

function assembleLayoutWithBottomAndRight(centerNode) {
  const paneBottom = createStandardBottomPane();
  const paneRight = createStandardRightPane();

  return {
    type: 'split',
    id: generateSplitId(),
    direction: 'horizontal',
    sizes: [75, 25],
    children: [
      {
        type: 'split',
        id: generateSplitId(),
        direction: 'vertical',
        sizes: [72, 28],
        children: [centerNode, paneBottom]
      },
      paneRight
    ]
  };
}

function extractCandidateFiles(openFiles = [], activeFile = null, workspaceFiles = []) {
  const seen = new Set();
  const list = [];
  if (activeFile) {
    seen.add(activeFile);
    list.push(activeFile);
  }
  (openFiles || []).forEach(f => {
    if (f && !seen.has(f)) {
      seen.add(f);
      list.push(f);
    }
  });
  (workspaceFiles || []).forEach(f => {
    if (f && !seen.has(f)) {
      seen.add(f);
      list.push(f);
    }
  });
  return list;
}

export function createMapAndCodeLayout(openFiles = [], activeFile = null, workspaceFiles = []) {
  const candidateFiles = extractCandidateFiles(openFiles, activeFile, workspaceFiles);
  const file1 = candidateFiles[0] || null;

  const paneMap = {
    type: 'pane',
    id: generatePaneId(),
    activeTabId: 'spatial',
    tabs: [{ id: 'spatial', type: 'spatial', title: 'Spatial Map' }]
  };

  const codeTabs = [];
  candidateFiles.forEach(f => {
    codeTabs.push({
      id: `file:${f}`,
      type: 'file',
      path: f,
      title: f.split('/').pop()
    });
  });

  const paneCode = {
    type: 'pane',
    id: generatePaneId(),
    activeTabId: file1 ? `file:${file1}` : (codeTabs[0]?.id || 'spatial'),
    tabs: codeTabs.length > 0 ? codeTabs : [{ id: 'spatial', type: 'spatial', title: 'Spatial Map' }]
  };

  const centerSplit = {
    type: 'split',
    id: generateSplitId(),
    direction: 'horizontal',
    sizes: [50, 50],
    children: [paneMap, paneCode]
  };

  return assembleLayoutWithBottomAndRight(centerSplit);
}

export function createTwoCodeFilesLayout(openFiles = [], activeFile = null, workspaceFiles = []) {
  const candidateFiles = extractCandidateFiles(openFiles, activeFile, workspaceFiles);
  const file1 = candidateFiles[0] || 'main.cpp';
  const file2 = candidateFiles[1] || file1;

  const paneCode1 = {
    type: 'pane',
    id: generatePaneId(),
    activeTabId: `file:${file1}`,
    tabs: [
      { id: `file:${file1}`, type: 'file', path: file1, title: file1.split('/').pop() }
    ]
  };

  const paneCode2 = {
    type: 'pane',
    id: generatePaneId(),
    activeTabId: file2 === file1 ? `file:${file2}:2` : `file:${file2}`,
    tabs: [
      {
        id: file2 === file1 ? `file:${file2}:2` : `file:${file2}`,
        type: 'file',
        path: file2,
        title: file2.split('/').pop()
      }
    ]
  };

  const centerSplit = {
    type: 'split',
    id: generateSplitId(),
    direction: 'horizontal',
    sizes: [50, 50],
    children: [paneCode1, paneCode2]
  };

  return assembleLayoutWithBottomAndRight(centerSplit);
}

export function createMapCodeCodeLayout(openFiles = [], activeFile = null, workspaceFiles = []) {
  const candidateFiles = extractCandidateFiles(openFiles, activeFile, workspaceFiles);
  const file1 = candidateFiles[0] || 'main.cpp';
  const file2 = candidateFiles[1] || file1;

  const paneMap = {
    type: 'pane',
    id: generatePaneId(),
    activeTabId: 'spatial',
    tabs: [{ id: 'spatial', type: 'spatial', title: 'Spatial Map' }]
  };

  const paneCode1 = {
    type: 'pane',
    id: generatePaneId(),
    activeTabId: `file:${file1}`,
    tabs: [
      { id: `file:${file1}`, type: 'file', path: file1, title: file1.split('/').pop() }
    ]
  };

  const paneCode2 = {
    type: 'pane',
    id: generatePaneId(),
    activeTabId: file2 === file1 ? `file:${file2}:2` : `file:${file2}`,
    tabs: [
      {
        id: file2 === file1 ? `file:${file2}:2` : `file:${file2}`,
        type: 'file',
        path: file2,
        title: file2.split('/').pop()
      }
    ]
  };

  const centerSplit = {
    type: 'split',
    id: generateSplitId(),
    direction: 'horizontal',
    sizes: [33, 33, 34],
    children: [paneMap, paneCode1, paneCode2]
  };

  return assembleLayoutWithBottomAndRight(centerSplit);
}

export function createThreeCodeFilesLayout(openFiles = [], activeFile = null, workspaceFiles = []) {
  const candidateFiles = extractCandidateFiles(openFiles, activeFile, workspaceFiles);
  const file1 = candidateFiles[0] || 'main.cpp';
  const file2 = candidateFiles[1] || file1;
  const file3 = candidateFiles[2] || file2;

  const paneCode1 = {
    type: 'pane',
    id: generatePaneId(),
    activeTabId: `file:${file1}`,
    tabs: [
      { id: `file:${file1}`, type: 'file', path: file1, title: file1.split('/').pop() }
    ]
  };

  const paneCode2 = {
    type: 'pane',
    id: generatePaneId(),
    activeTabId: file2 === file1 ? `file:${file2}:2` : `file:${file2}`,
    tabs: [
      {
        id: file2 === file1 ? `file:${file2}:2` : `file:${file2}`,
        type: 'file',
        path: file2,
        title: file2.split('/').pop()
      }
    ]
  };

  const paneCode3 = {
    type: 'pane',
    id: generatePaneId(),
    activeTabId: (file3 === file1 || file3 === file2) ? `file:${file3}:3` : `file:${file3}`,
    tabs: [
      {
        id: (file3 === file1 || file3 === file2) ? `file:${file3}:3` : `file:${file3}`,
        type: 'file',
        path: file3,
        title: file3.split('/').pop()
      }
    ]
  };

  const centerSplit = {
    type: 'split',
    id: generateSplitId(),
    direction: 'horizontal',
    sizes: [33, 33, 34],
    children: [paneCode1, paneCode2, paneCode3]
  };

  return assembleLayoutWithBottomAndRight(centerSplit);
}

export function createCompetitiveProgrammingLayout(openFiles = [], activeFile = null, workspaceFiles = []) {
  const candidateFiles = extractCandidateFiles(openFiles, activeFile, workspaceFiles);
  const file1 = candidateFiles[0] || null;

  const codeTabs = [];
  candidateFiles.forEach(f => {
    codeTabs.push({
      id: `file:${f}`,
      type: 'file',
      path: f,
      title: f.split('/').pop()
    });
  });

  if (codeTabs.length === 0) {
    codeTabs.push({ id: 'spatial', type: 'spatial', title: 'Spatial Map' });
  }

  const paneCode = {
    type: 'pane',
    id: generatePaneId(),
    activeTabId: file1 ? `file:${file1}` : codeTabs[0].id,
    tabs: codeTabs
  };

  const paneInput = {
    type: 'pane',
    id: generatePaneId(),
    activeTabId: 'stdin',
    tabs: [
      { id: 'stdin', type: 'stdin', title: 'Input' }
    ]
  };

  const paneOutput = {
    type: 'pane',
    id: generatePaneId(),
    activeTabId: 'output',
    tabs: [
      { id: 'output', type: 'output', title: 'Output' },
      { id: 'terminal', type: 'terminal', title: 'Terminal' }
    ]
  };

  const rightVerticalSplit = {
    type: 'split',
    id: generateSplitId(),
    direction: 'vertical',
    sizes: [50, 50],
    children: [paneInput, paneOutput]
  };

  return {
    type: 'split',
    id: generateSplitId(),
    direction: 'horizontal',
    sizes: [68, 32],
    children: [paneCode, rightVerticalSplit]
  };
}

export function getAllPanes(node) {
  if (!node) return [];
  if (node.type === 'pane') return [node];
  if (node.type === 'split' && Array.isArray(node.children)) {
    return node.children.flatMap(child => getAllPanes(child));
  }
  return [];
}

export function getAllTabs(node) {
  const panes = getAllPanes(node);
  return panes.flatMap(p => p.tabs || []);
}

export function findPaneById(node, paneId) {
  if (!node) return null;
  if (node.type === 'pane' && node.id === paneId) return node;
  if (node.type === 'split' && Array.isArray(node.children)) {
    for (const child of node.children) {
      const found = findPaneById(child, paneId);
      if (found) return found;
    }
  }
  return null;
}

export function findPaneByTabId(node, tabId) {
  if (!node) return null;
  if (node.type === 'pane') {
    if ((node.tabs || []).some(t => t.id === tabId)) {
      return node;
    }
    return null;
  }
  if (node.type === 'split' && Array.isArray(node.children)) {
    for (const child of node.children) {
      const found = findPaneByTabId(child, tabId);
      if (found) return found;
    }
  }
  return null;
}

export function cleanTree(node) {
  if (!node) return null;

  if (node.type === 'pane') {
    const rawTabs = Array.isArray(node.tabs) ? node.tabs : [];
    const seen = new Set();
    const uniqueTabs = [];
    for (const t of rawTabs) {
      if (t && t.id && !seen.has(t.id)) {
        seen.add(t.id);
        let title = t.title;
        if (t.type === 'spatial' || title === 'Map' || title === 'Spatial Map') title = 'Spatial Map';
        else if (t.type === 'ai' || title === 'AI Studio') title = 'AI Agent';
        else if (t.type === 'stdin') title = 'Input';
        else if (t.type === 'output') title = 'Output';
        else if (t.type === 'terminal') title = 'Terminal';
        uniqueTabs.push({ ...t, title });
      }
    }

    if (uniqueTabs.length === 0) {
      return null;
    }

    // 1. Role 1: Dedicated Map Pane (strictly spatial)
    const hasSpatial = uniqueTabs.some(t => t.id === 'spatial' || t.type === 'spatial');
    if (hasSpatial && uniqueTabs.length > 1) {
      const mapTab = uniqueTabs.find(t => t.id === 'spatial' || t.type === 'spatial');
      const otherTabs = uniqueTabs.filter(t => t.id !== 'spatial' && t.type !== 'spatial');

      const isMapActive = node.activeTabId === 'spatial';
      const paneMap = {
        type: 'pane',
        id: isMapActive ? node.id : generatePaneId(),
        activeTabId: 'spatial',
        tabs: [mapTab]
      };
      const paneOther = {
        type: 'pane',
        id: isMapActive ? generatePaneId() : node.id,
        activeTabId: isMapActive ? otherTabs[0].id : node.activeTabId,
        tabs: otherTabs
      };
      return {
        type: 'split',
        id: generateSplitId(),
        direction: 'horizontal',
        sizes: [50, 50],
        children: [paneMap, paneOther]
      };
    }

    // 2. Role 2: Dedicated Bottom Console (strictly output and terminal)
    const hasConsole = uniqueTabs.some(t => t.id === 'output' || t.type === 'output' || t.id === 'terminal' || t.type === 'terminal');
    const hasNonConsoleInConsole = hasConsole && uniqueTabs.some(t => t.id !== 'output' && t.type !== 'output' && t.id !== 'terminal' && t.type !== 'terminal');
    if (hasNonConsoleInConsole) {
      const consoleTabs = uniqueTabs.filter(t => t.id === 'output' || t.type === 'output' || t.id === 'terminal' || t.type === 'terminal');
      const otherTabs = uniqueTabs.filter(t => t.id !== 'output' && t.type !== 'output' && t.id !== 'terminal' && t.type !== 'terminal');

      const isConsoleActive = consoleTabs.some(t => t.id === node.activeTabId);
      const paneConsole = {
        type: 'pane',
        id: isConsoleActive ? node.id : generatePaneId(),
        activeTabId: isConsoleActive ? node.activeTabId : consoleTabs[0].id,
        tabs: consoleTabs
      };
      const paneOther = {
        type: 'pane',
        id: isConsoleActive ? generatePaneId() : node.id,
        activeTabId: isConsoleActive ? otherTabs[0].id : node.activeTabId,
        tabs: otherTabs
      };
      return {
        type: 'split',
        id: generateSplitId(),
        direction: 'vertical',
        sizes: [72, 28],
        children: [paneOther, paneConsole]
      };
    }

    // 3. Role 3: Dedicated Right Panel (strictly ai and stdin)
    const hasRight = uniqueTabs.some(t => t.id === 'ai' || t.type === 'ai' || t.id === 'stdin' || t.type === 'stdin');
    const hasNonRightInRight = hasRight && uniqueTabs.some(t => t.id !== 'ai' && t.type !== 'ai' && t.id !== 'stdin' && t.type !== 'stdin');
    if (hasNonRightInRight) {
      const rightTabs = uniqueTabs.filter(t => t.id === 'ai' || t.type === 'ai' || t.id === 'stdin' || t.type === 'stdin');
      const otherTabs = uniqueTabs.filter(t => t.id !== 'ai' && t.type !== 'ai' && t.id !== 'stdin' && t.type !== 'stdin');

      const isRightActive = rightTabs.some(t => t.id === node.activeTabId);
      const paneRight = {
        type: 'pane',
        id: isRightActive ? node.id : generatePaneId(),
        activeTabId: isRightActive ? node.activeTabId : rightTabs[0].id,
        tabs: rightTabs
      };
      const paneOther = {
        type: 'pane',
        id: isRightActive ? generatePaneId() : node.id,
        activeTabId: isRightActive ? otherTabs[0].id : node.activeTabId,
        tabs: otherTabs
      };
      return {
        type: 'split',
        id: generateSplitId(),
        direction: 'horizontal',
        sizes: [75, 25],
        children: [paneOther, paneRight]
      };
    }

    let activeTabId = node.activeTabId;
    if (!uniqueTabs.some(t => t.id === activeTabId)) {
      activeTabId = uniqueTabs[0].id;
    }

    return {
      ...node,
      tabs: uniqueTabs,
      activeTabId
    };
  }

  if (node.type === 'split') {
    const cleanedChildren = (node.children || [])
      .map(cleanTree)
      .filter(Boolean);

    if (cleanedChildren.length === 0) {
      return null;
    }

    if (cleanedChildren.length === 1) {
      return cleanedChildren[0];
    }

    let sizes = node.sizes;
    if (!Array.isArray(sizes) || sizes.length !== cleanedChildren.length) {
      const eq = Math.floor(100 / cleanedChildren.length);
      sizes = cleanedChildren.map((_, i) => (i === cleanedChildren.length - 1 ? 100 - eq * (cleanedChildren.length - 1) : eq));
    }

    return {
      ...node,
      direction: node.direction || 'horizontal',
      children: cleanedChildren,
      sizes
    };
  }

  return null;
}

export function isMapPane(pane) {
  return Boolean(pane && (pane.tabs || []).some(t => t.id === 'spatial' || t.type === 'spatial'));
}

export function isBottomConsolePane(pane) {
  if (!pane || isMapPane(pane)) return false;
  return (pane.tabs || []).some(t => t.id === 'output' || t.type === 'output' || t.id === 'terminal' || t.type === 'terminal');
}

export function isRightPanelPane(pane) {
  if (!pane || isMapPane(pane)) return false;
  return (pane.tabs || []).some(t => t.id === 'stdin' || t.type === 'stdin' || t.id === 'ai' || t.type === 'ai');
}

export function isSpecializedPane(pane) {
  return isMapPane(pane) || isBottomConsolePane(pane) || isRightPanelPane(pane);
}

export function isEditorPane(pane) {
  if (!pane) return false;
  return !isSpecializedPane(pane);
}

export function getCandidateEditorPane(tree, activePaneId = null, lastActiveEditorPaneId = null) {
  const all = getAllPanes(tree);
  if (all.length === 0) return null;

  // 1. If activePaneId is a valid non-specialized editor pane, use it
  if (activePaneId) {
    const active = findPaneById(tree, activePaneId);
    if (active && isEditorPane(active)) {
      return active;
    }
  }

  // 2. If lastActiveEditorPaneId exists and is an editor pane still in tree, use it
  if (lastActiveEditorPaneId) {
    const lastActive = findPaneById(tree, lastActiveEditorPaneId);
    if (lastActive && isEditorPane(lastActive)) {
      return lastActive;
    }
  }

  // 3. Any pane currently containing file tabs
  const panesWithFiles = all.filter(p => isEditorPane(p) && (p.tabs || []).some(t => t.type === 'file'));
  if (panesWithFiles.length > 0) {
    return panesWithFiles[0];
  }

  // 4. Any dedicated editor pane in tree
  const editorPanes = all.filter(p => isEditorPane(p));
  if (editorPanes.length > 0) {
    return editorPanes[0];
  }

  // 5. No editor pane exists! Return null so caller can auto-split the Map to create one
  return null;
}

export function normalizeTree(tree) {
  const cleaned = cleanTree(tree);
  if (!cleaned) {
    return {
      type: 'pane',
      id: generatePaneId(),
      activeTabId: 'spatial',
      tabs: [{ id: 'spatial', type: 'spatial', title: 'Spatial Map' }]
    };
  }
  return cleaned;
}

export function addTabToPane(tree, paneId, tab, targetIndex = -1) {
  const isTabMap = tab.id === 'spatial' || tab.type === 'spatial';
  const isTabConsole = tab.id === 'output' || tab.type === 'output' || tab.id === 'terminal' || tab.type === 'terminal';
  const isTabRight = tab.id === 'ai' || tab.type === 'ai' || tab.id === 'stdin' || tab.type === 'stdin';
  const isTabFile = tab.type === 'file';

  // 1. If trying to add Map tab
  if (isTabMap) {
    const existingMapPane = getAllPanes(tree).find(isMapPane);
    if (existingMapPane) {
      return setActiveTabInPane(tree, existingMapPane.id, 'spatial');
    }
    const targetPane = findPaneById(tree, paneId);
    if (targetPane && (targetPane.tabs || []).length > 0) {
      return splitPane(tree, paneId, 'horizontal', tab, true).tree;
    }
  }

  // 2. If trying to add a file tab
  if (isTabFile) {
    const targetPane = findPaneById(tree, paneId);
    if (targetPane && isSpecializedPane(targetPane)) {
      const candidate = getCandidateEditorPane(tree, null, null);
      if (candidate) {
        return addTabToPane(tree, candidate.id, tab, targetIndex);
      }
      // No editor pane exists: split the Map pane horizontally!
      const mapPane = getAllPanes(tree).find(isMapPane) || targetPane;
      return splitPane(tree, mapPane.id, 'horizontal', tab, false).tree;
    }
  }

  // 3. If trying to add a console tab (output, terminal)
  if (isTabConsole) {
    const targetPane = findPaneById(tree, paneId);
    if (targetPane && !isBottomConsolePane(targetPane)) {
      const existingConsolePane = getAllPanes(tree).find(isBottomConsolePane);
      if (existingConsolePane) {
        if ((existingConsolePane.tabs || []).some(t => t.id === tab.id)) {
          return setActiveTabInPane(tree, existingConsolePane.id, tab.id);
        }
        return addTabToPane(tree, existingConsolePane.id, tab, targetIndex);
      }
    }
  }

  // 4. If trying to add a right panel tab (ai, stdin)
  if (isTabRight) {
    const targetPane = findPaneById(tree, paneId);
    if (targetPane && !isRightPanelPane(targetPane)) {
      const existingRightPane = getAllPanes(tree).find(isRightPanelPane);
      if (existingRightPane) {
        if ((existingRightPane.tabs || []).some(t => t.id === tab.id)) {
          return setActiveTabInPane(tree, existingRightPane.id, tab.id);
        }
        return addTabToPane(tree, existingRightPane.id, tab, targetIndex);
      }
    }
  }

  function walk(node) {
    if (!node) return null;
    if (node.type === 'pane') {
      if (node.id === paneId) {
        const existingIdx = (node.tabs || []).findIndex(t => t.id === tab.id);
        let nextTabs;
        if (existingIdx !== -1) {
          nextTabs = [...node.tabs];
        } else {
          nextTabs = [...(node.tabs || [])];
          if (targetIndex >= 0 && targetIndex < nextTabs.length) {
            nextTabs.splice(targetIndex, 0, tab);
          } else {
            nextTabs.push(tab);
          }
        }
        return {
          ...node,
          tabs: nextTabs,
          activeTabId: tab.id
        };
      }
      return node;
    }
    if (node.type === 'split') {
      return {
        ...node,
        children: (node.children || []).map(walk)
      };
    }
    return node;
  }

  return normalizeTree(walk(tree));
}

export function removeTabFromPane(tree, paneId, tabId) {
  function walk(node) {
    if (!node) return null;
    if (node.type === 'pane') {
      if (node.id === paneId) {
        const filtered = (node.tabs || []).filter(t => t.id !== tabId);
        let nextActive = node.activeTabId;
        if (nextActive === tabId) {
          nextActive = filtered.length > 0 ? filtered[filtered.length - 1].id : null;
        }
        return {
          ...node,
          tabs: filtered,
          activeTabId: nextActive
        };
      }
      return node;
    }
    if (node.type === 'split') {
      return {
        ...node,
        children: (node.children || []).map(walk)
      };
    }
    return node;
  }

  return normalizeTree(walk(tree));
}

export function setActiveTabInPane(tree, paneId, tabId) {
  function walk(node) {
    if (!node) return null;
    if (node.type === 'pane') {
      if (node.id === paneId) {
        if ((node.tabs || []).some(t => t.id === tabId)) {
          return { ...node, activeTabId: tabId };
        }
      }
      return node;
    }
    if (node.type === 'split') {
      return {
        ...node,
        children: (node.children || []).map(walk)
      };
    }
    return node;
  }

  return walk(tree);
}

export function splitPane(tree, targetPaneId, direction, tab, insertBefore = false) {
  const newPaneId = generatePaneId();
  const newPane = {
    type: 'pane',
    id: newPaneId,
    activeTabId: tab.id,
    tabs: [tab]
  };

  function walk(node) {
    if (!node) return null;
    if (node.type === 'pane') {
      if (node.id === targetPaneId) {
        return {
          type: 'split',
          id: generateSplitId(),
          direction,
          sizes: [50, 50],
          children: insertBefore ? [newPane, node] : [node, newPane]
        };
      }
      return node;
    }
    if (node.type === 'split') {
      return {
        ...node,
        children: (node.children || []).map(walk)
      };
    }
    return node;
  }

  return {
    tree: normalizeTree(walk(tree)),
    newPaneId
  };
}

export function moveTab(tree, sourcePaneId, targetPaneId, tabId, dropZone, targetIndex = -1) {
  const sourcePane = findPaneById(tree, sourcePaneId);
  if (!sourcePane) return { tree, activePaneId: targetPaneId };

  const tab = (sourcePane.tabs || []).find(t => t.id === tabId);
  if (!tab) return { tree, activePaneId: targetPaneId };

  if (sourcePaneId === targetPaneId && dropZone === 'center') {
    const currentTabs = [...(sourcePane.tabs || [])];
    const currentIndex = currentTabs.findIndex(t => t.id === tabId);
    if (currentIndex !== -1 && targetIndex >= 0 && targetIndex !== currentIndex) {
      const [moved] = currentTabs.splice(currentIndex, 1);
      const insertAt = targetIndex > currentIndex ? targetIndex - 1 : targetIndex;
      currentTabs.splice(insertAt, 0, moved);

      function updateReorder(node) {
        if (!node) return null;
        if (node.type === 'pane' && node.id === sourcePaneId) {
          return { ...node, tabs: currentTabs, activeTabId: tabId };
        }
        if (node.type === 'split') {
          return { ...node, children: (node.children || []).map(updateReorder) };
        }
        return node;
      }

      return {
        tree: normalizeTree(updateReorder(tree)),
        activePaneId: targetPaneId
      };
    }
    return { tree, activePaneId: targetPaneId };
  }

  // If user splits a single-tab pane against itself, duplicate the tab into the new split
  if (sourcePaneId === targetPaneId && dropZone !== 'center' && (sourcePane.tabs || []).length <= 1) {
    const duplicateTab = {
      ...tab,
      id: tab.type === 'file' ? tab.id : `${tab.id}_split_${Date.now()}`
    };
    const direction = (dropZone === 'left' || dropZone === 'right') ? 'horizontal' : 'vertical';
    const insertBefore = (dropZone === 'left' || dropZone === 'top');
    const splitResult = splitPane(tree, targetPaneId, direction, duplicateTab, insertBefore);
    return {
      tree: splitResult.tree,
      activePaneId: splitResult.newPaneId
    };
  }

  const targetPane = findPaneById(tree, targetPaneId);
  const isMovingMap = tabId === 'spatial' || tab?.type === 'spatial';
  const isMovingConsole = tabId === 'output' || tab?.type === 'output' || tabId === 'terminal' || tab?.type === 'terminal';
  const isMovingRight = tabId === 'ai' || tab?.type === 'ai' || tabId === 'stdin' || tab?.type === 'stdin';

  // Specialized panes (Map, Bottom Console, Right Panel) are strictly non-stackable with foreign tabs
  if (targetPane && dropZone === 'center') {
    if (isMapPane(targetPane) && !isMovingMap) {
      dropZone = 'right';
    } else if (!isMapPane(targetPane) && isMovingMap) {
      dropZone = 'left';
    } else if (isBottomConsolePane(targetPane) && !isMovingConsole) {
      dropZone = 'top';
    } else if (isRightPanelPane(targetPane) && !isMovingRight) {
      dropZone = 'left';
    } else if (isEditorPane(targetPane) && (isMovingConsole || isMovingRight)) {
      dropZone = isMovingConsole ? 'bottom' : 'right';
    }
  }

  function removeTabWithoutClean(node) {
    if (!node) return null;
    if (node.type === 'pane') {
      if (node.id === sourcePaneId) {
        const nextTabs = (node.tabs || []).filter(t => t.id !== tabId);
        let nextActive = node.activeTabId;
        if (nextActive === tabId) {
          nextActive = nextTabs.length > 0 ? nextTabs[nextTabs.length - 1].id : null;
        }
        return {
          ...node,
          tabs: nextTabs,
          activeTabId: nextActive
        };
      }
      return node;
    }
    if (node.type === 'split') {
      return {
        ...node,
        children: (node.children || []).map(removeTabWithoutClean)
      };
    }
    return node;
  }

  const treeWithoutTab = removeTabWithoutClean(tree);

  if (dropZone === 'center') {
    const updated = addTabToPane(treeWithoutTab, targetPaneId, tab, targetIndex);
    return {
      tree: updated,
      activePaneId: targetPaneId
    };
  }

  let direction = 'horizontal';
  let insertBefore = false;

  if (dropZone === 'left') {
    direction = 'horizontal';
    insertBefore = true;
  } else if (dropZone === 'right') {
    direction = 'horizontal';
    insertBefore = false;
  } else if (dropZone === 'top') {
    direction = 'vertical';
    insertBefore = true;
  } else if (dropZone === 'bottom') {
    direction = 'vertical';
    insertBefore = false;
  }

  const splitResult = splitPane(treeWithoutTab, targetPaneId, direction, tab, insertBefore);
  return {
    tree: splitResult.tree,
    activePaneId: splitResult.newPaneId
  };
}

export function closePane(tree, paneId) {
  const all = getAllPanes(tree);
  if (all.length <= 1) return tree;

  function walk(node) {
    if (!node) return null;
    if (node.type === 'pane') {
      if (node.id === paneId) {
        return null;
      }
      return node;
    }
    if (node.type === 'split') {
      return {
        ...node,
        children: (node.children || []).map(walk).filter(Boolean)
      };
    }
    return node;
  }

  return normalizeTree(walk(tree));
}

const STORAGE_KEY = 'neuron-modular-layout-v3';

export function saveLayoutToStorage(tree) {
  try {
    if (!tree) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tree));
  } catch {}
}

export function loadLayoutFromStorage(fallbackOpenFiles = [], fallbackActiveFile = null) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const normalized = normalizeTree(parsed);
      if (normalized && getAllPanes(normalized).length > 0) {
        return normalized;
      }
    }
  } catch {}

  return createDefaultModularLayout(fallbackOpenFiles, fallbackActiveFile, true, true);
}
