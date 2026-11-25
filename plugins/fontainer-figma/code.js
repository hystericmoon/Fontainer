// Fontainer Companion — Figma Plugin Main Controller
figma.showUI(__html__, { width: 340, height: 480, themeColors: true });

function scanCurrentPageFonts() {
  const textNodes = figma.currentPage.findAllWithCriteria({ types: ['TEXT'] });
  const missingSet = new Set();
  const usedSet = new Set();

  for (const node of textNodes) {
    const len = node.characters.length;
    if (len === 0) continue;
    const fn = node.fontName;
    if (fn !== figma.mixed && fn && fn.family) {
      usedSet.add(fn.family);
      if (node.hasMissingFont) missingSet.add(fn.family);
    } else {
      const fonts = node.getRangeAllFontNames(0, len);
      for (const f of fonts) {
        if (f && f.family) {
          usedSet.add(f.family);
          if (node.hasMissingFont) missingSet.add(f.family);
        }
      }
    }
  }

  figma.ui.postMessage({
    type: 'scan-result',
    missing: Array.from(missingSet).sort(),
    used: Array.from(usedSet).sort(),
    selectedTextCount: figma.currentPage.selection.filter((n) => n.type === 'TEXT').length,
  });
}

async function applyFontToSelection(family, style) {
  const selectedText = figma.currentPage.selection.filter((n) => n.type === 'TEXT');
  if (selectedText.length === 0) {
    figma.notify('Select one or more text layers in Figma first.');
    return;
  }

  const targetStyle = style || 'Regular';
  try {
    await figma.loadFontAsync({ family, style: targetStyle });
    for (const node of selectedText) {
      node.fontName = { family, style: targetStyle };
    }
    figma.notify(`Applied ${family} (${targetStyle}) to ${selectedText.length} layer(s)`);
    figma.ui.postMessage({ type: 'apply-ok', family, style: targetStyle });
  } catch (err) {
    figma.notify(
      `Activate "${family}" in Fontainer Desktop first, then click again.`,
      { error: true },
    );
    figma.ui.postMessage({
      type: 'apply-error',
      family,
      message: `Font "${family}" is not active in macOS/Windows yet. Activate it in Fontainer Desktop first.`,
    });
  }
}

figma.on('selectionchange', () => {
  const count = figma.currentPage.selection.filter((n) => n.type === 'TEXT').length;
  figma.ui.postMessage({ type: 'selection-count', count });
});

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'scan') {
    scanCurrentPageFonts();
  } else if (msg.type === 'apply-font') {
    await applyFontToSelection(msg.family, msg.style);
  }
};

// Auto-scan on plugin launch
scanCurrentPageFonts();
