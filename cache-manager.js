// Cache Manager for interacting with the SQLite worker

class TranslationCacheManager {
  constructor() {
    this.worker = null;
    this.isInitialized = false;
    this.pendingRequests = new Map();
    this.requestIdCounter = 0;
    this.initializeWorker();
  }

  initializeWorker() {
    try {
      console.log("Initializing SQLite worker");
      this.worker = new Worker("sqlite-worker.js");

      // Set up message handler
      this.worker.onmessage = (e) => this.handleWorkerMessage(e);

      // Handle errors
      this.worker.onerror = (error) => {
        console.error("SQLite worker error:", error);
        this.isInitialized = false;
      };

      // Initialize the database
      this.worker.postMessage({ type: "INIT" });
    } catch (error) {
      console.error("Failed to initialize SQLite worker:", error);
      this.isInitialized = false;
    }
  }

  handleWorkerMessage(e) {
    const message = e.data;

    switch (message.type) {
      case "INIT_COMPLETE":
        this.isInitialized = message.success;
        console.log(
          `SQLite initialization ${message.success ? "successful" : "failed"}`
        );
        if (!message.success) {
          console.error("SQLite initialization error:", message.error);
        }
        break;

      case "QUERY_RESULT":
      case "UPDATE_RESULT":
      case "CLEAR_RESULT":
        // Resolve the pending promise
        const requestId = message.requestId;
        if (this.pendingRequests.has(requestId)) {
          const { resolve } = this.pendingRequests.get(requestId);
          resolve(message);
          this.pendingRequests.delete(requestId);
        }
        break;

      case "PERSIST_DB":
        // Handle database persistence
        try {
          const buffer = message.buffer;
          const blob = new Blob([new Uint8Array(buffer)], {
            type: "application/octet-stream",
          });

          // Store in IndexedDB
          this.storeInIndexedDB(blob);
        } catch (error) {
          console.error("Error handling database persistence:", error);
        }
        break;

      default:
        console.log("Unknown worker message type:", message.type);
    }
  }

  storeInIndexedDB(blob) {
    // Save the SQLite database file to IndexedDB
    const request = indexedDB.open("TranslationCacheDB", 1);

    request.onupgradeneeded = function (event) {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("sqliteFiles")) {
        db.createObjectStore("sqliteFiles");
      }
    };

    request.onsuccess = function (event) {
      const db = event.target.result;
      const transaction = db.transaction(["sqliteFiles"], "readwrite");
      const store = transaction.objectStore("sqliteFiles");

      store.put(blob, "translation-cache.sqlite");

      transaction.oncomplete = function () {
        db.close();
      };
    };

    request.onerror = function (event) {
      console.error("IndexedDB error:", event.target.error);
    };
  }

  // Check if a translation is in the cache
  async checkCache(text, targetLang) {
    if (!this.isInitialized || !this.worker) {
      return { found: false, error: "Cache not initialized" };
    }

    const requestId = this._getNextRequestId();

    return new Promise((resolve) => {
      // Store the promise callbacks to resolve when the worker responds
      this.pendingRequests.set(requestId, { resolve });

      // Query the cache
      this.worker.postMessage({
        type: "QUERY_CACHE",
        requestId,
        text,
        targetLang,
      });
    });
  }

  // Update the cache with a new translation
  async updateCache(text, translatedText, targetLang, modelUsed) {
    if (!this.isInitialized || !this.worker) {
      return { success: false, error: "Cache not initialized" };
    }

    const requestId = this._getNextRequestId();

    return new Promise((resolve) => {
      // Store the promise callbacks
      this.pendingRequests.set(requestId, { resolve });

      // Update the cache
      this.worker.postMessage({
        type: "UPDATE_CACHE",
        requestId,
        text,
        translatedText,
        targetLang,
        modelUsed,
      });
    });
  }

  // Clear the cache for a specific language
  async clearLanguageCache(targetLang) {
    if (!this.isInitialized || !this.worker) {
      return { success: false, error: "Cache not initialized" };
    }

    const requestId = this._getNextRequestId();

    return new Promise((resolve) => {
      this.pendingRequests.set(requestId, { resolve });

      this.worker.postMessage({
        type: "CLEAR_LANGUAGE_CACHE",
        requestId,
        targetLang,
      });
    });
  }

  // Run cache cleanup
  cleanupCache() {
    if (this.isInitialized && this.worker) {
      this.worker.postMessage({ type: "CLEANUP_CACHE" });
    }
  }

  // Force a database save
  saveDatabase() {
    if (this.isInitialized && this.worker) {
      this.worker.postMessage({ type: "SAVE_DB" });
    }
  }

  // Get a unique request ID for tracking promises
  _getNextRequestId() {
    return `req_${++this.requestIdCounter}`;
  }
}

// Create a singleton instance
const translationCache = new TranslationCacheManager();

// Export the singleton
export default translationCache;
