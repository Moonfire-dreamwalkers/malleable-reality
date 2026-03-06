chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'DOWNLOAD_DATA') {
        const data = message.data; // array of usernames
        const fileContent = data.join('\n');
        const blobUrl = 'data:text/plain;charset=utf-8,' + encodeURIComponent(fileContent);

        chrome.downloads.download({
            url: blobUrl,
            filename: 'ig_likes_' + new Date().getTime() + '.txt',
            saveAs: true
        }, () => {
            sendResponse({ success: true });
        });
        return true; // keep channel open for async response
    }
});
