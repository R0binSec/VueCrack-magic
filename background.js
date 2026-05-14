const LEGACY_ALL_IN_STORAGE_KEY = 'vuecrack_all_in_enabled';
const ALL_IN_SITES_STORAGE_KEY = 'vuecrack_all_in_sites';
const ALL_IN_SCRIPT_ID = 'vuecrack-all-in-script';
let syncQueue = Promise.resolve();

function normalizeAllInSites(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }

    return Object.keys(value).reduce((accumulator, key) => {
        const normalizedKey = normalizeSiteKey(key);
        if (normalizedKey && value[key] === true) {
            accumulator[normalizedKey] = true;
        }
        return accumulator;
    }, {});
}

function normalizeSiteKey(siteKey) {
    if (!siteKey || typeof siteKey !== 'string') {
        return '';
    }

    const trimmed = siteKey.trim().toLowerCase();
    if (!trimmed) {
        return '';
    }

    try {
        if (/^https?:\/\//i.test(trimmed)) {
            const parsed = new URL(trimmed);
            return parsed.hostname.toLowerCase();
        }
    } catch (error) {
        return '';
    }

    if (trimmed.includes('/') || trimmed.includes('#') || trimmed.includes('?') || trimmed.includes('*')) {
        return '';
    }

    return trimmed;
}

function toMatchPattern(siteKey) {
    const normalizedKey = normalizeSiteKey(siteKey);
    if (!normalizedKey) {
        return '';
    }

    return `*://${normalizedKey}/*`;
}

async function getRegisteredAllInScript() {
    const scripts = await chrome.scripting.getRegisteredContentScripts({
        ids: [ALL_IN_SCRIPT_ID]
    });
    return scripts[0] || null;
}

async function unregisterAllInScript() {
    if (!(await getRegisteredAllInScript())) {
        return;
    }

    await chrome.scripting.unregisterContentScripts({
        ids: [ALL_IN_SCRIPT_ID]
    });
}

async function registerAllInScript(matches) {
    if (!matches.length) {
        return;
    }

    await chrome.scripting.registerContentScripts([{
        id: ALL_IN_SCRIPT_ID,
        js: ['all-in.js'],
        matches,
        runAt: 'document_start',
        world: 'MAIN',
        allFrames: true
    }]);
}

async function syncAllInScript() {
    const result = await chrome.storage.local.get([ALL_IN_SITES_STORAGE_KEY]);
    const sites = normalizeAllInSites(result[ALL_IN_SITES_STORAGE_KEY]);
    const matches = Object.keys(sites)
        .map(toMatchPattern)
        .filter(Boolean)
        .sort();

    await unregisterAllInScript();

    if (matches.length) {
        await registerAllInScript(matches);
    }

    await chrome.storage.local.set({
        [LEGACY_ALL_IN_STORAGE_KEY]: false
    });
}

function queueSyncAllInScript() {
    syncQueue = syncQueue
        .catch(() => {})
        .then(syncAllInScript);
    return syncQueue;
}

queueSyncAllInScript().catch(error => {
    console.warn('[VueCrack] Failed to sync all-in script on service worker load:', error);
});

chrome.runtime.onInstalled.addListener(() => {
    queueSyncAllInScript().catch(error => {
        console.warn('[VueCrack] Failed to sync all-in script on install:', error);
    });
});

chrome.runtime.onStartup.addListener(() => {
    queueSyncAllInScript().catch(error => {
        console.warn('[VueCrack] Failed to sync all-in script on startup:', error);
    });
});

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !Object.prototype.hasOwnProperty.call(changes, ALL_IN_SITES_STORAGE_KEY)) {
        return;
    }

    queueSyncAllInScript().catch(error => {
        console.warn('[VueCrack] Failed to sync all-in script after storage change:', error);
    });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.action !== 'syncAllInMode') {
        return false;
    }

    queueSyncAllInScript()
        .then(() => sendResponse({ok: true}))
        .catch(error => sendResponse({ok: false, error: error.message}));

    return true;
});


// my add code
// 存储每个标签页的Vue检测状态
const tabStates = new Map();

// 监听标签页状态变化
chrome.tabs.onRemoved.addListener((tabId) => {
    // 标签页关闭时清除状态
    tabStates.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    // 标签页导航或刷新时清除状态
    if (changeInfo.status === 'loading') {
        tabStates.delete(tabId);
        // 清除该标签页的徽章
        chrome.action.setBadgeText({ tabId, text: '' });
    }
});

// 监听来自内容脚本或弹出页面的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const tabId = sender.tab?.id;
    
    if (!tabId) return; // 没有标签页ID则忽略

    if (request.action === 'setBadgeBackgroundColor') {
        // 更新标签页状态
        tabStates.set(tabId, {
            vueDetected: true,
            color: request.color || '#42b883'
        });

        // 只为当前标签页设置徽章
        chrome.action.setBadgeBackgroundColor({
            tabId: tabId,
            color: request.color || '#42b883'
        });

        // 设置徽章文本为"Vue"
        chrome.action.setBadgeText({
            tabId: tabId,
            text: 'Vue'
        });

        console.log(`✅ 标签页 ${tabId} 徽章背景颜色已设置为:`, request.color);
    }
    else if (request.action === 'clearBadge') {
        // 清除当前标签页的徽章
        tabStates.set(tabId, {
            vueDetected: false,
            color: null
        });

        chrome.action.setBadgeText({
            tabId: tabId,
            text: ''
        });

        console.log(`✅ 标签页 ${tabId} 徽章已清除`);
    }
});
