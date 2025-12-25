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