// Script for handling cache management in the options page

import translationCache from "./cache-manager.js";

document.addEventListener("DOMContentLoaded", async () => {
  const clearCacheButton = document.getElementById("clearCache");
  const exportCacheButton = document.getElementById("exportCache");
  const cacheStatsDiv = document.getElementById("cacheStats");

  if (!clearCacheButton || !exportCacheButton || !cacheStatsDiv) {
    console.error("Cache management elements not found in the options page");
    return;
  }

  // Load cache statistics
  loadCacheStats();

  // Set up event handlers
  clearCacheButton.addEventListener("click", clearCache);
  exportCacheButton.addEventListener("click", exportCache);

  // Update stats periodically
  setInterval(loadCacheStats, 30000); // Update every 30 seconds

  // Function to load and display cache statistics
  async function loadCacheStats() {
    try {
      // Request cache statistics from the worker
      const stats = await getCacheStats();

      if (stats.success) {
        let statsHtml = `
          <div class="grid grid-cols-2 gap-2 text-sm">
            <div>Total translations:</div>
            <div>${stats.totalEntries}</div>
            
            <div>Cache size:</div>
            <div>${formatBytes(stats.sizeBytes)}</div>
            
            <div>Languages:</div>
            <div>${stats.languages.join(", ")}</div>
            
            <div>Hit rate:</div>
            <div>${stats.hitRate}%</div>
          </div>
        `;

        cacheStatsDiv.innerHTML = statsHtml;
      } else {
        cacheStatsDiv.textContent = "Failed to load cache statistics";
      }
    } catch (error) {
      console.error("Error loading cache stats:", error);
      cacheStatsDiv.textContent = "Error: " + error.message;
    }
  }

  // Function to clear the translation cache
  async function clearCache() {
    const confirm = window.confirm(
      "Are you sure you want to clear the entire translation cache?"
    );
    if (!confirm) return;

    clearCacheButton.disabled = true;
    clearCacheButton.textContent = "Clearing...";

    try {
      // Get current target language
      const { targetLanguage } = await new Promise((resolve) => {
        chrome.storage.local.get(["targetLanguage"], resolve);
      });

      // Clear the cache for all languages
      await translationCache.clearLanguageCache(targetLanguage || "en");

      // Update stats
      await loadCacheStats();

      // Show success message
      clearCacheButton.textContent = "Cache Cleared!";
      setTimeout(() => {
        clearCacheButton.textContent = "Clear Translation Cache";
        clearCacheButton.disabled = false;
      }, 2000);
    } catch (error) {
      console.error("Error clearing cache:", error);
      clearCacheButton.textContent = "Error: " + error.message;
      setTimeout(() => {
        clearCacheButton.textContent = "Clear Translation Cache";
        clearCacheButton.disabled = false;
      }, 3000);
    }
  }

  // Function to export the cache database
  async function exportCache() {
    exportCacheButton.disabled = true;
    exportCacheButton.textContent = "Exporting...";

    try {
      // Request database export
      translationCache.saveDatabase();

      // Wait a moment for the database to be saved
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Open IndexedDB to get the SQLite file
      const dbRequest = indexedDB.open("TranslationCacheDB", 1);

      dbRequest.onsuccess = function (event) {
        const db = event.target.result;
        const transaction = db.transaction(["sqliteFiles"], "readonly");
        const store = transaction.objectStore("sqliteFiles");

        const getRequest = store.get("translation-cache.sqlite");

        getRequest.onsuccess = function () {
          const blob = getRequest.result;

          if (blob) {
            // Create a download link
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "whats-translate-cache.sqlite";
            a.style.display = "none";

            document.body.appendChild(a);
            a.click();

            setTimeout(() => {
              document.body.removeChild(a);
              URL.revokeObjectURL(url);

              exportCacheButton.textContent = "Downloaded!";
              setTimeout(() => {
                exportCacheButton.textContent = "Export Cache";
                exportCacheButton.disabled = false;
              }, 2000);
            }, 100);
          } else {
            throw new Error("No cache database found");
          }
        };

        getRequest.onerror = function (event) {
          throw new Error(
            "Failed to read cache database: " + event.target.error
          );
        };
      };

      dbRequest.onerror = function (event) {
        throw new Error("Failed to open database: " + event.target.error);
      };
    } catch (error) {
      console.error("Error exporting cache:", error);
      exportCacheButton.textContent = "Error!";
      setTimeout(() => {
        exportCacheButton.textContent = "Export Cache";
        exportCacheButton.disabled = false;
      }, 2000);
    }
  }

  // Function to get cache statistics
  async function getCacheStats() {
    return new Promise((resolve) => {
      // Create a temporary message channel to communicate with the worker
      const channel = new MessageChannel();

      channel.port1.onmessage = (event) => {
        resolve(event.data);
      };

      // The worker handles the stats calculation
      translationCache.worker.postMessage({ type: "GET_STATS" }, [
        channel.port2,
      ]);

      // In case of timeout, resolve with error
      setTimeout(() => {
        resolve({
          success: false,
          error: "Timeout getting cache statistics",
        });
      }, 3000);
    });
  }

  // Utility function to format bytes
  function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB"];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  }
});
