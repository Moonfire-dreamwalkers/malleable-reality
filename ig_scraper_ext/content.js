(function () {
    if (window.igScraperInjected) return;
    window.igScraperInjected = true;

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'START_SCRAPING') {
            sendResponse({ message: "Started content script" });
            startScraping(message.settings);
        }
    });

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const randomDelay = (min, max) => {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    };

    const updateStatus = (text) => {
        chrome.runtime.sendMessage({ action: "STATUS_UPDATE", text }).catch(() => { });
        console.log("[IG Scraper]", text);
    }

    const findScrollableModal = () => {
        // IG modals often have role="dialog"
        const dialogs = document.querySelectorAll('div[role="dialog"]');
        for (let dialog of dialogs) {
            // Find a scrollable wrapper inside
            // A common class or tag is a div with a specific style or overflow
            // In modern IG, the list container often has flex-direction column and overflow-y auto
            const scrollables = dialog.querySelectorAll('div');
            for (let div of scrollables) {
                if (div.scrollHeight > div.clientHeight) {
                    // It might be the main wrapper
                    // Let's check if it contains user links
                    if (div.querySelector('a')) {
                        return div;
                    }
                }
            }
        }
        return null;
    };

    const extractUsersFromNode = (node) => {
        const users = new Set();
        const links = node.querySelectorAll('a');
        links.forEach(link => {
            const href = link.getAttribute('href');
            if (href && href.startsWith('/') && href.endsWith('/')) {
                const parts = href.split('/');
                if (parts.length === 3 && parts[1].length > 0) {
                    // Probably a username
                    // Exclude common non-user links
                    const exclude = ['explore', 'reels', 'p', 'direct', 'stories', 'your_activity', 'saved', 'settings'];
                    if (!exclude.includes(parts[1])) {
                        users.add(parts[1]);
                    }
                }
            }
        });

        return Array.from(users);
    };

    const startScraping = async (settings) => {
        const { minDelay, maxDelay, maxUsers } = settings;
        updateStatus("Looking for Likes modal...");

        const modalContainer = findScrollableModal();
        if (!modalContainer) {
            updateStatus("Error: Could not find a scrollable likes modal. Make sure you opened the likes list.");
            alert("Please open the Likes list of a post first.");
            return;
        }

        updateStatus("Modal found. Starting extraction.");

        let allUsers = new Set();
        let lastScrollHeight = 0;
        let retries = 0;

        while (allUsers.size < maxUsers) {
            // Extract users visible currently
            const currentUsers = extractUsersFromNode(modalContainer);
            currentUsers.forEach(u => allUsers.add(u));

            updateStatus(`Extracted ${allUsers.size} / ${maxUsers}`);

            if (allUsers.size >= maxUsers) break;

            // Scroll down
            modalContainer.scrollTop = modalContainer.scrollHeight;

            const delay = randomDelay(minDelay, maxDelay);
            updateStatus(`Waiting ${delay}ms...`);
            await sleep(delay);

            if (modalContainer.scrollHeight === lastScrollHeight) {
                retries++;
                if (retries > 3) {
                    updateStatus("Reached bottom or no more users loading.");
                    break;
                }
            } else {
                retries = 0;
            }
            lastScrollHeight = modalContainer.scrollHeight;
        }

        const finalUsers = Array.from(allUsers).slice(0, maxUsers);
        updateStatus(`Done! Extracted ${finalUsers.length} users. Triggering download...`);

        chrome.runtime.sendMessage({
            action: 'DOWNLOAD_DATA',
            data: finalUsers
        }, (response) => {
            if (response && response.success) {
                updateStatus("Download triggered successfully.");
            }
        });
    };
})();
