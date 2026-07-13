function formatResetTime(isoString) {
  if (!isoString) return '-';

  const resetDate = new Date(isoString);
  const now = new Date();
  const diff = resetDate - now;

  if (diff < 0) return 'Reset';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

// Calculate expected usage percentage based on time elapsed
function calculateExpectedPercentage(resetAt, group, totalPeriodMsOverride) {
  if (!resetAt) return 0;

  const resetDate = new Date(resetAt);
  const now = new Date();

  // Session limits reset every 5 hours; all other limits are weekly.
  // Codex windows pass their actual duration explicitly instead, since Codex's
  // window lengths aren't fixed to Claude's 5h/7d pattern.
  const totalPeriod = totalPeriodMsOverride ?? (group === 'session'
    ? 5 * 60 * 60 * 1000
    : 7 * 24 * 60 * 60 * 1000);

  // Calculate elapsed time
  const timeRemaining = resetDate - now;
  const timeElapsed = totalPeriod - timeRemaining;

  // If time remaining is negative or elapsed is negative, return 0
  if (timeRemaining < 0 || timeElapsed < 0) return 0;

  // Calculate expected percentage
  const expectedPercentage = (timeElapsed / totalPeriod) * 100;
  return Math.min(Math.max(expectedPercentage, 0), 100);
}

// Get card label from a limit entry (model display name, or a name derived from its kind)
function getLimitLabel(limit) {
  const modelName = limit.scope?.model?.display_name;
  if (modelName) return modelName;

  const labels = {
    'session': '5 Hour',
    'weekly_all': '7 Day'
  };
  return labels[limit.kind] || limit.kind;
}

// Label a Codex window by its actual duration (e.g. "5 Hour", "7 Day") rather than
// assuming a fixed meaning, since OpenAI has changed what primary/secondary represent.
function codexWindowLabel(windowSeconds) {
  if (typeof windowSeconds !== 'number' || windowSeconds <= 0) return 'Usage';
  const hours = windowSeconds / 3600;
  if (hours < 24) return `${Math.round(hours)} Hour`;
  return `${Math.round(windowSeconds / 86400)} Day`;
}

// Normalize one Codex rate-limit window (primary/secondary) into a limit entry
// matching Claude's shape, so it can reuse the same card rendering.
function normalizeCodexWindow(window) {
  if (!window) return null;

  const percent = window.used_percent ?? window.percent;
  if (typeof percent !== 'number') return null;

  let resetsAt = null;
  if (typeof window.reset_at === 'number') {
    // reset_at is a Unix timestamp in seconds
    resetsAt = new Date(window.reset_at * 1000).toISOString();
  } else if (typeof window.reset_after_seconds === 'number') {
    resetsAt = new Date(Date.now() + window.reset_after_seconds * 1000).toISOString();
  }

  const windowSeconds = window.limit_window_seconds;
  return {
    kind: codexWindowLabel(windowSeconds),
    group: typeof windowSeconds === 'number' && windowSeconds <= 24 * 60 * 60 ? 'session' : 'weekly',
    totalPeriodMs: typeof windowSeconds === 'number' ? windowSeconds * 1000 : undefined,
    percent,
    resets_at: resetsAt
  };
}

// Convert a /backend-api/wham/usage response into limit entries matching Claude's shape
// so they can reuse the same card rendering. primary_window/secondary_window are just
// slots - which one is the 5-hour vs weekly window (or whether both are even present)
// is determined per-window from limit_window_seconds, not from its slot.
function extractCodexLimits(data) {
  const rateLimit = data?.rate_limit || data || {};
  return [rateLimit.primary_window || rateLimit.primary, rateLimit.secondary_window || rateLimit.secondary]
    .map(normalizeCodexWindow)
    .filter(Boolean);
}

function createDonutChart(percentage, expectedPercentage, showPace) {
  const outerRadius = 27;
  const innerRadius = 20;
  const outerCircumference = 2 * Math.PI * outerRadius;
  const innerCircumference = 2 * Math.PI * innerRadius;
  const outerOffset = outerCircumference - (percentage / 100) * outerCircumference;
  const innerOffset = innerCircumference - (expectedPercentage / 100) * innerCircumference;

  const container = document.createElement('div');
  container.className = 'donut-container';

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'donut-chart');
  svg.setAttribute('width', '60');
  svg.setAttribute('height', '60');
  svg.setAttribute('viewBox', '0 0 60 60');

  const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  bgCircle.setAttribute('class', 'donut-bg');
  bgCircle.setAttribute('cx', '30');
  bgCircle.setAttribute('cy', '30');
  bgCircle.setAttribute('r', outerRadius);
  svg.appendChild(bgCircle);

  if (showPace) {
    const expectedBgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    expectedBgCircle.setAttribute('class', 'donut-expected-bg');
    expectedBgCircle.setAttribute('cx', '30');
    expectedBgCircle.setAttribute('cy', '30');
    expectedBgCircle.setAttribute('r', innerRadius);
    svg.appendChild(expectedBgCircle);

    const expectedCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    expectedCircle.setAttribute('class', 'donut-expected');
    expectedCircle.setAttribute('cx', '30');
    expectedCircle.setAttribute('cy', '30');
    expectedCircle.setAttribute('r', innerRadius);
    expectedCircle.setAttribute('stroke-dasharray', innerCircumference);
    expectedCircle.setAttribute('stroke-dashoffset', innerOffset);
    svg.appendChild(expectedCircle);
  }

  const fillCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  fillCircle.setAttribute('class', 'donut-fill');
  fillCircle.setAttribute('cx', '30');
  fillCircle.setAttribute('cy', '30');
  fillCircle.setAttribute('r', outerRadius);
  fillCircle.setAttribute('stroke-dasharray', outerCircumference);
  fillCircle.setAttribute('stroke-dashoffset', outerOffset);
  svg.appendChild(fillCircle);

  container.appendChild(svg);

  const text = document.createElement('div');
  text.className = 'donut-text';
  text.textContent = `${Math.round(percentage)}%`;
  container.appendChild(text);

  return container;
}

function createProgressBar(percentage, expectedPercentage, showPace) {
  const progressView = document.createElement('div');
  progressView.className = 'progress-view';

  if (showPace) {
    const dualWrapper = document.createElement('div');
    dualWrapper.className = 'progress-bar-dual-wrapper';

    const container = document.createElement('div');
    container.className = 'progress-bar-container';

    const mainRow = document.createElement('div');
    mainRow.className = 'progress-bar-row progress-bar-row-main';
    const mainWrapper = document.createElement('div');
    mainWrapper.className = 'progress-bar-wrapper';
    const mainFill = document.createElement('div');
    mainFill.className = 'progress-bar-fill';
    mainFill.style.width = `${percentage}%`;
    mainWrapper.appendChild(mainFill);
    mainRow.appendChild(mainWrapper);
    container.appendChild(mainRow);

    const expectedRow = document.createElement('div');
    expectedRow.className = 'progress-bar-row progress-bar-row-expected';
    const expectedWrapper = document.createElement('div');
    expectedWrapper.className = 'progress-bar-wrapper progress-bar-wrapper-thin';
    const expectedFill = document.createElement('div');
    expectedFill.className = 'progress-bar-expected';
    expectedFill.style.width = `${expectedPercentage}%`;
    expectedWrapper.appendChild(expectedFill);
    expectedRow.appendChild(expectedWrapper);
    container.appendChild(expectedRow);

    dualWrapper.appendChild(container);

    const percentageText = document.createElement('div');
    percentageText.className = 'progress-bar-percentage';
    percentageText.textContent = `${Math.round(percentage)}%`;
    dualWrapper.appendChild(percentageText);

    progressView.appendChild(dualWrapper);
  } else {
    const container = document.createElement('div');
    container.className = 'progress-bar-container';

    const fill = document.createElement('div');
    fill.className = 'progress-bar-fill';
    fill.style.width = `${percentage}%`;
    container.appendChild(fill);

    const percentageText = document.createElement('div');
    percentageText.className = 'progress-percentage';
    percentageText.textContent = `${Math.round(percentage)}%`;
    container.appendChild(percentageText);

    progressView.appendChild(container);
  }

  return progressView;
}

let currentViewMode = 'donut';
let cachedClaudeData = null;
let cachedClaudeError = null;
let cachedCodexData = null;
let cachedCodexError = null;
let currentColumnCount = 2;
let showPaceIndicator = false;
let currentPollInterval = 5;
let pollTimerId = null;

// Render every limit the API returns; inactive weekly limits (is_active: false)
// still have a reset time and are shown normally, matching the official usage page.
function buildLimitsGrid(limits, viewMode, columnCount, showPace) {
  const grid = document.createElement('div');
  grid.className = 'usage-grid';
  grid.style.gridTemplateColumns = `repeat(${columnCount}, 1fr)`;

  for (const limit of limits) {
    const resets_at = limit.resets_at;
    const isDisabled = !resets_at;

    const percentage = Math.min(Math.max(limit.percent || 0, 0), 100);
    const expectedPercentage = calculateExpectedPercentage(resets_at, limit.group, limit.totalPeriodMs);
    const resetTime = formatResetTime(resets_at);

    const visualElement = viewMode === 'donut'
      ? createDonutChart(percentage, expectedPercentage, showPace)
      : createProgressBar(percentage, expectedPercentage, showPace);

    const usageItem = document.createElement('div');
    usageItem.className = 'usage-item';
    if (isDisabled) {
      usageItem.classList.add('disabled');
    }

    const infoRow = document.createElement('div');
    infoRow.className = 'usage-info-row';

    const label = document.createElement('div');
    label.className = 'usage-label';
    label.textContent = getLimitLabel(limit);
    infoRow.appendChild(label);

    const resetTimeDiv = document.createElement('div');
    resetTimeDiv.className = 'reset-time';
    resetTimeDiv.textContent = resetTime;
    infoRow.appendChild(resetTimeDiv);

    usageItem.appendChild(infoRow);
    usageItem.appendChild(visualElement);

    grid.appendChild(usageItem);
  }

  return grid;
}

// One provider's block within the popup: a header (only shown when multiple
// providers are active) plus either its usage grid or an inline error.
function buildProviderSection(title, limits, error, showHeader) {
  const section = document.createElement('div');
  section.className = 'provider-section';

  // Grow each section in proportion to its own row count so that, when multiple
  // providers are shown, every row ends up the same height instead of each section
  // independently stretching to fill half the available space.
  const rowCount = error ? 1 : Math.max(Math.ceil(limits.length / currentColumnCount), 1);
  section.style.flexGrow = String(rowCount);
  section.style.flexBasis = '0';

  if (showHeader) {
    const header = document.createElement('div');
    header.className = 'provider-title';
    header.textContent = title;
    section.appendChild(header);
  }

  if (error) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error';
    errorDiv.textContent = error;
    section.appendChild(errorDiv);
  } else {
    section.appendChild(buildLimitsGrid(limits, currentViewMode, currentColumnCount, showPaceIndicator));
  }

  return section;
}

async function renderUsageData() {
  const contentDiv = document.getElementById('content');

  const storage = await chrome.storage.local.get(['viewMode', 'columnCount', 'showPace', 'organizationId', 'codexEnabled']);
  currentViewMode = storage.viewMode || 'donut';
  currentColumnCount = storage.columnCount || 2;
  showPaceIndicator = storage.showPace || false;

  const showClaudeSection = !!storage.organizationId;
  const showCodexSection = !!storage.codexEnabled;
  const showProviderHeaders = showClaudeSection && showCodexSection;

  contentDiv.textContent = '';

  const sectionsWrapper = document.createElement('div');
  sectionsWrapper.className = 'provider-sections';

  if (showClaudeSection) {
    const limits = cachedClaudeData && Array.isArray(cachedClaudeData.limits) ? cachedClaudeData.limits : [];
    sectionsWrapper.appendChild(buildProviderSection('Claude', limits, cachedClaudeError, showProviderHeaders));
  }

  if (showCodexSection) {
    let codexError = cachedCodexError;
    let limits = [];
    if (!codexError && cachedCodexData) {
      limits = extractCodexLimits(cachedCodexData);
      if (limits.length === 0) {
        codexError = 'Unexpected response format from Codex usage API';
      }
    }
    sectionsWrapper.appendChild(buildProviderSection('Codex', limits, codexError, showProviderHeaders));
  }

  contentDiv.appendChild(sectionsWrapper);
  updateViewSelectUI();
  updateColumnsUI();
  updatePaceToggleUI();

  const viewSelect = document.getElementById('viewSelect');
  if (viewSelect) {
    viewSelect.style.display = 'block';
  }

  const paceToggle = document.getElementById('paceToggle');
  if (paceToggle) {
    paceToggle.style.display = 'flex';
  }

  const columnsSelect = document.getElementById('columnsSelect');
  if (columnsSelect) {
    columnsSelect.style.display = 'block';
  }

  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    refreshBtn.style.display = 'block';
  }

  const lastUpdated = document.getElementById('lastUpdated');
  if (lastUpdated) {
    lastUpdated.style.display = 'block';
  }
}

function showError(message) {
  const contentDiv = document.getElementById('content');
  contentDiv.textContent = '';

  const errorDiv = document.createElement('div');
  errorDiv.className = 'error';
  errorDiv.textContent = message;
  contentDiv.appendChild(errorDiv);
}

function showSetup() {
  const contentDiv = document.getElementById('content');
  contentDiv.textContent = '';

  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'loading';

  const messageDiv = document.createElement('div');
  messageDiv.className = 'setup-message';
  messageDiv.appendChild(document.createTextNode('Please configure Organization ID or enable Codex monitoring'));
  messageDiv.appendChild(document.createElement('br'));

  const hintSpan = document.createElement('span');
  hintSpan.className = 'setup-hint';
  hintSpan.textContent = 'Click the settings icon ⚙️';
  messageDiv.appendChild(hintSpan);

  loadingDiv.appendChild(messageDiv);
  contentDiv.appendChild(loadingDiv);

  const viewSelect = document.getElementById('viewSelect');
  if (viewSelect) {
    viewSelect.style.display = 'none';
  }

  const paceToggle = document.getElementById('paceToggle');
  if (paceToggle) {
    paceToggle.style.display = 'none';
  }

  const columnsSelect = document.getElementById('columnsSelect');
  if (columnsSelect) {
    columnsSelect.style.display = 'none';
  }

  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    refreshBtn.style.display = 'none';
  }

  const lastUpdated = document.getElementById('lastUpdated');
  if (lastUpdated) {
    lastUpdated.style.display = 'none';
  }
}

let modalCodexEnabled = false;

async function openSettingsModal() {
  const modal = document.getElementById('settingsModal');
  const input = document.getElementById('modalOrgIdInput');
  const intervalSelect = document.getElementById('modalIntervalSelect');
  const accountIdInput = document.getElementById('modalChatgptAccountIdInput');

  const storage = await chrome.storage.local.get(['organizationId', 'pollInterval', 'codexEnabled', 'chatgptAccountId']);
  input.value = storage.organizationId || '';
  intervalSelect.value = String(storage.pollInterval !== undefined ? storage.pollInterval : 5);
  accountIdInput.value = storage.chatgptAccountId || '';
  modalCodexEnabled = storage.codexEnabled || false;
  updateModalCodexToggleUI();

  modal.classList.add('active');
  input.focus();
}

function closeSettingsModal() {
  const modal = document.getElementById('settingsModal');
  modal.classList.remove('active');
}

function updateModalCodexToggleUI() {
  const toggle = document.getElementById('modalCodexToggle');
  if (toggle) {
    toggle.classList.toggle('active', modalCodexEnabled);
  }
}

function toggleModalCodex() {
  modalCodexEnabled = !modalCodexEnabled;
  updateModalCodexToggleUI();
}

async function saveSettings() {
  const input = document.getElementById('modalOrgIdInput');
  const orgId = input.value.trim();
  const intervalSelect = document.getElementById('modalIntervalSelect');
  const pollInterval = Number(intervalSelect.value);
  const accountIdInput = document.getElementById('modalChatgptAccountIdInput');
  const chatgptAccountId = accountIdInput.value.trim();

  const updates = { pollInterval, codexEnabled: modalCodexEnabled, chatgptAccountId };
  if (orgId) {
    updates.organizationId = orgId;
  }
  await chrome.storage.local.set(updates);

  currentPollInterval = pollInterval;
  startPolling();

  closeSettingsModal();
  loadUsageData();
}

function setRefreshSpinning(spinning) {
  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    if (spinning) {
      refreshBtn.classList.add('spinning');
    } else {
      refreshBtn.classList.remove('spinning');
    }
  }
}

async function fetchUsageData(organizationId) {
  try {
    const url = `https://claude.ai/api/organizations/${organizationId}/usage`;
    const response = await fetch(url, {
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch usage data:', error);
    throw error;
  }
}

const CODEX_SESSION_CORS_RULE_ID = 1;
const CODEX_USAGE_CORS_RULE_ID = 2;
let codexCorsRulesReady = null;

// Neither chatgpt.com endpoint below sends Access-Control-Allow-Origin, so direct
// fetches from the extension's origin are blocked by CORS. This registers declarativeNetRequest
// rules that stamp the extension's own origin (and the headers wham/usage needs) onto
// those responses so the browser's CORS check passes, without any separate login/token.
function ensureCodexCorsRules() {
  if (!codexCorsRulesReady) {
    const responseHeaders = [
      { header: 'Access-Control-Allow-Origin', operation: 'set', value: `chrome-extension://${chrome.runtime.id}` },
      { header: 'Access-Control-Allow-Credentials', operation: 'set', value: 'true' },
      { header: 'Access-Control-Allow-Headers', operation: 'set', value: 'authorization, chatgpt-account-id, content-type' },
      { header: 'Access-Control-Allow-Methods', operation: 'set', value: 'GET, OPTIONS' }
    ];

    codexCorsRulesReady = chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [CODEX_SESSION_CORS_RULE_ID, CODEX_USAGE_CORS_RULE_ID],
      addRules: [
        {
          id: CODEX_SESSION_CORS_RULE_ID,
          priority: 1,
          condition: { urlFilter: '||chatgpt.com/api/auth/session', resourceTypes: ['xmlhttprequest'] },
          action: { type: 'modifyHeaders', responseHeaders }
        },
        {
          id: CODEX_USAGE_CORS_RULE_ID,
          priority: 1,
          condition: { urlFilter: '||chatgpt.com/backend-api/wham/usage', resourceTypes: ['xmlhttprequest'] },
          action: { type: 'modifyHeaders', responseHeaders }
        }
      ]
    });
  }
  return codexCorsRulesReady;
}

// chatgpt.com's session cookie alone isn't enough to authenticate against wham/usage;
// it expects the same OAuth-style bearer token the Codex CLI/web app use, which the
// logged-in browser session can hand out via its own NextAuth session endpoint.
async function fetchCodexAccessToken() {
  const response = await fetch('https://chatgpt.com/api/auth/session', {
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  if (!data?.accessToken) {
    throw new Error('Not logged into chatgpt.com');
  }
  return data.accessToken;
}

async function fetchCodexUsageData(accountId) {
  try {
    await ensureCodexCorsRules();

    const accessToken = await fetchCodexAccessToken();

    const headers = { Authorization: `Bearer ${accessToken}` };
    if (accountId) {
      headers['ChatGPT-Account-Id'] = accountId;
    }

    const response = await fetch('https://chatgpt.com/backend-api/wham/usage', {
      credentials: 'include',
      headers
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to fetch Codex usage data:', error);
    throw error;
  }
}

async function loadUsageData() {
  try {
    const storage = await chrome.storage.local.get(['organizationId', 'codexEnabled', 'chatgptAccountId']);
    const codexEnabled = !!storage.codexEnabled;

    if (!storage.organizationId && !codexEnabled) {
      showSetup();
      return;
    }

    setRefreshSpinning(true);

    // Don't show loading screen if we have cached data
    // Just show the spinning icon in the header
    if (!cachedClaudeData && !cachedCodexData) {
      const contentDiv = document.getElementById('content');
      contentDiv.textContent = '';

      const loadingDiv = document.createElement('div');
      loadingDiv.className = 'loading';

      const spinner = document.createElement('div');
      spinner.className = 'spinner';
      loadingDiv.appendChild(spinner);

      const text = document.createElement('div');
      text.textContent = 'Loading...';
      loadingDiv.appendChild(text);

      contentDiv.appendChild(loadingDiv);
    }

    // Fetch each configured provider independently so a failure on one
    // (e.g. Codex's undocumented API changing) doesn't blank out the other.
    const tasks = [];

    if (storage.organizationId) {
      tasks.push(
        fetchUsageData(storage.organizationId)
          .then(data => { cachedClaudeData = data; cachedClaudeError = null; })
          .catch(error => { cachedClaudeError = error.message; })
      );
    } else {
      cachedClaudeData = null;
      cachedClaudeError = null;
    }

    if (codexEnabled) {
      tasks.push(
        fetchCodexUsageData(storage.chatgptAccountId)
          .then(data => { cachedCodexData = data; cachedCodexError = null; })
          .catch(error => { cachedCodexError = error.message; })
      );
    } else {
      cachedCodexData = null;
      cachedCodexError = null;
    }

    await Promise.all(tasks);

    setRefreshSpinning(false);
    await renderUsageData();
    updateLastUpdatedTime();

  } catch (error) {
    setRefreshSpinning(false);
    showError(error.message);
  }
}

function updateLastUpdatedTime() {
  const now = new Date();
  const timeString = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  document.getElementById('lastUpdated').textContent = timeString;
}

function updateViewSelectUI() {
  const viewSelect = document.getElementById('viewSelect');
  if (viewSelect) {
    viewSelect.value = currentViewMode;
  }
}

function updateColumnsUI() {
  const columnsSelect = document.getElementById('columnsSelect');
  if (columnsSelect) {
    columnsSelect.value = currentColumnCount.toString();
  }
}

function updatePaceToggleUI() {
  const paceToggleSwitch = document.getElementById('paceToggleSwitch');

  if (paceToggleSwitch) {
    if (showPaceIndicator) {
      paceToggleSwitch.classList.add('active');
    } else {
      paceToggleSwitch.classList.remove('active');
    }
  }
}

async function changeViewMode(viewMode) {
  currentViewMode = viewMode;
  await chrome.storage.local.set({ viewMode: currentViewMode });

  if (cachedClaudeData || cachedCodexData) {
    renderUsageData();
  }
}

async function changeColumnCount(columnCount) {
  currentColumnCount = parseInt(columnCount);
  await chrome.storage.local.set({ columnCount: currentColumnCount });

  if (cachedClaudeData || cachedCodexData) {
    renderUsageData();
  }
}

async function togglePaceIndicator() {
  showPaceIndicator = !showPaceIndicator;
  await chrome.storage.local.set({ showPace: showPaceIndicator });

  if (cachedClaudeData || cachedCodexData) {
    renderUsageData();
  }
}

function startPolling() {
  if (pollTimerId !== null) {
    clearInterval(pollTimerId);
    pollTimerId = null;
  }
  if (currentPollInterval > 0) {
    pollTimerId = setInterval(loadUsageData, currentPollInterval * 60 * 1000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadUsageData);
  }

  const viewSelect = document.getElementById('viewSelect');
  if (viewSelect) {
    viewSelect.addEventListener('change', (e) => {
      changeViewMode(e.target.value);
    });
  }

  const paceToggleSwitch = document.getElementById('paceToggleSwitch');
  if (paceToggleSwitch) {
    paceToggleSwitch.addEventListener('click', togglePaceIndicator);
  }

  const columnsSelect = document.getElementById('columnsSelect');
  if (columnsSelect) {
    columnsSelect.addEventListener('change', (e) => {
      changeColumnCount(e.target.value);
    });
  }

  const settingsBtn = document.getElementById('settingsBtn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', openSettingsModal);
  }

  const modalCancelBtn = document.getElementById('modalCancelBtn');
  if (modalCancelBtn) {
    modalCancelBtn.addEventListener('click', closeSettingsModal);
  }

  const modalSaveBtn = document.getElementById('modalSaveBtn');
  if (modalSaveBtn) {
    modalSaveBtn.addEventListener('click', saveSettings);
  }

  const modalCodexToggle = document.getElementById('modalCodexToggle');
  if (modalCodexToggle) {
    modalCodexToggle.addEventListener('click', toggleModalCodex);
  }

  const modalOverlay = document.getElementById('settingsModal');
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) {
        closeSettingsModal();
      }
    });
  }

  const modalInput = document.getElementById('modalOrgIdInput');
  if (modalInput) {
    modalInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        saveSettings();
      }
    });
  }
});

(async () => {
  const storage = await chrome.storage.local.get(['pollInterval']);
  currentPollInterval = storage.pollInterval !== undefined ? storage.pollInterval : 5;
  loadUsageData();
  startPolling();
})();