document.addEventListener('DOMContentLoaded', () => {
  const minDelayInput = document.getElementById('minDelay');
  const maxDelayInput = document.getElementById('maxDelay');
  const maxUsersInput = document.getElementById('maxUsers');
  const startBtn = document.getElementById('startBtn');
  const statusDiv = document.getElementById('status');

  // Load saved settings
  chrome.storage.local.get(['minDelay', 'maxDelay', 'maxUsers'], (result) => {
    if (result.minDelay) minDelayInput.value = result.minDelay;
    if (result.maxDelay) maxDelayInput.value = result.maxDelay;
    if (result.maxUsers) maxUsersInput.value = result.maxUsers;
  });

  startBtn.addEventListener('click', async () => {
    const minDelay = parseInt(minDelayInput.value, 10);
    const maxDelay = parseInt(maxDelayInput.value, 10);
    const maxUsers = parseInt(maxUsersInput.value, 10);

    if (minDelay > maxDelay) {
      statusDiv.innerText = "Min delay cannot be > Max delay.";
      return;
    }

    // Save settings
    chrome.storage.local.set({ minDelay, maxDelay, maxUsers });

    statusDiv.innerText = "Starting...";

    // Inject content script into active tab
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
          statusDiv.innerText = "No active tab found.";
          return;
      }
      if (!tab.url.includes("instagram.com")) {
        statusDiv.innerText = "Please open an Instagram post.";
        return;
      }

      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      }, () => {
        // After injection, send message
        setTimeout(() => {
          chrome.tabs.sendMessage(tab.id, {
            action: 'START_SCRAPING',
            settings: { minDelay, maxDelay, maxUsers }
          }, (response) => {
              if (chrome.runtime.lastError) {
                  statusDiv.innerText = "Error checking script status: " + chrome.runtime.lastError.message;
              } else {
                  statusDiv.innerText = response?.message || "Scraping started...";
              }
          });
        }, 500); // short delay to ensure injection
      });
    } catch (err) {
      statusDiv.innerText = "Error: " + err.message;
    }
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "STATUS_UPDATE") {
        statusDiv.innerText = message.text;
    }
  });
});
