// SQLite Worker for handling database operations without blocking the main thread

// Import sql.js (this must be available in your extension)
importScripts("sql-wasm.js");

let db = null;
let isInitialized = false;

// Initialize SQLite database
async function initDatabase() {
  try {
    console.log("Initializing SQLite database in worker");

    // Load the SQL.js WASM module
    const SQL = await initSqlJs({
      locateFile: (file) => `${file}`,
    });

    // Create a new database or open existing
    const response = await fetch("translation-cache.sqlite");

    // Try to open existing database file
    try {
      const buf = await response.arrayBuffer();
      db = new SQL.Database(new Uint8Array(buf));
      console.log("Opened existing database");
    } catch (error) {
      // If no database exists yet, create a new one
      console.log("Creating new database");
      db = new SQL.Database();

      // Create the translations table with indices
      db.exec(`
        CREATE TABLE IF NOT EXISTS translations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source_text TEXT NOT NULL,
          translated_text TEXT NOT NULL,
          target_language TEXT NOT NULL,
          source_language TEXT,
          timestamp INTEGER NOT NULL,
          model_used TEXT
        );
        
        CREATE INDEX IF NOT EXISTS idx_source_target ON translations(source_text, target_language);
        CREATE INDEX IF NOT EXISTS idx_timestamp ON translations(timestamp);
      `);
    }

    // Set up a periodic task to persist the database
    setInterval(persistDatabase, 5 * 60 * 1000); // Save every 5 minutes

    isInitialized = true;
    self.postMessage({ type: "INIT_COMPLETE", success: true });
  } catch (error) {
    console.error("Failed to initialize SQLite database:", error);
    self.postMessage({
      type: "INIT_COMPLETE",
      success: false,
      error: error.message,
    });
  }
}

// Save the database to persistent storage
function persistDatabase() {
  if (!db) return;

  try {
    const data = db.export();
    const buffer = new Uint8Array(data).buffer;

    self.postMessage(
      {
        type: "PERSIST_DB",
        buffer: buffer,
      },
      [buffer]
    );
  } catch (error) {
    console.error("Error persisting database:", error);
  }
}

// Query the cache for a translation
function queryCache(sourceText, targetLanguage) {
  if (!db || !isInitialized) {
    return { found: false, error: "Database not initialized" };
  }

  try {
    // Prepare query with parameter binding for security
    const stmt = db.prepare(`
      SELECT translated_text, timestamp 
      FROM translations 
      WHERE source_text = :text AND target_language = :lang
      ORDER BY timestamp DESC
      LIMIT 1
    `);

    // Bind parameters
    stmt.bind({
      ":text": sourceText,
      ":lang": targetLanguage,
    });

    // Execute the query
    if (stmt.step()) {
      const result = stmt.getAsObject();
      stmt.free();

      // Check if the cache entry is not too old (30 days max)
      const now = Date.now();
      const timestamp = result.timestamp || 0;
      const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

      if (now - timestamp > maxAge) {
        return { found: false, reason: "cache_expired" };
      }

      return {
        found: true,
        translatedText: result.translated_text,
        timestamp: result.timestamp,
      };
    } else {
      stmt.free();
      return { found: false };
    }
  } catch (error) {
    console.error("Error querying cache:", error);
    return { found: false, error: error.message };
  }
}

// Store a translation in the cache
function updateCache(sourceText, translatedText, targetLanguage, modelUsed) {
  if (!db || !isInitialized) {
    return { success: false, error: "Database not initialized" };
  }

  try {
    // Check if we already have this exact translation
    const checkStmt = db.prepare(`
      SELECT id FROM translations 
      WHERE source_text = :text 
      AND target_language = :lang
      AND translated_text = :translated
    `);

    checkStmt.bind({
      ":text": sourceText,
      ":lang": targetLanguage,
      ":translated": translatedText,
    });

    let needsInsert = true;

    if (checkStmt.step()) {
      // We have this exact translation, just update the timestamp
      const id = checkStmt.get()[0];
      checkStmt.free();

      const updateStmt = db.prepare(`
        UPDATE translations 
        SET timestamp = :time
        WHERE id = :id
      `);

      updateStmt.run({
        ":time": Date.now(),
        ":id": id,
      });

      updateStmt.free();
      needsInsert = false;
    } else {
      checkStmt.free();
    }

    if (needsInsert) {
      // Insert the new translation
      const stmt = db.prepare(`
        INSERT INTO translations (
          source_text, translated_text, target_language, 
          timestamp, model_used
        ) VALUES (
          :text, :translated, :lang, 
          :time, :model
        )
      `);

      stmt.run({
        ":text": sourceText,
        ":translated": translatedText,
        ":lang": targetLanguage,
        ":time": Date.now(),
        ":model": modelUsed || "unknown",
      });

      stmt.free();
    }

    return { success: true };
  } catch (error) {
    console.error("Error updating cache:", error);
    return { success: false, error: error.message };
  }
}

// Clear old entries to manage cache size
function cleanupCache() {
  if (!db || !isInitialized) return;

  try {
    // Keep the database size manageable by removing old entries
    // Keep only the last 100,000 translations
    db.exec(`
      DELETE FROM translations 
      WHERE id NOT IN (
        SELECT id FROM translations 
        ORDER BY timestamp DESC 
        LIMIT 100000
      )
    `);

    // Vacuum to reclaim space
    db.exec("VACUUM");
  } catch (error) {
    console.error("Error cleaning up cache:", error);
  }
}

// Delete all translations for a specific language
function clearLanguageCache(targetLanguage) {
  if (!db || !isInitialized) {
    return { success: false, error: "Database not initialized" };
  }

  try {
    const stmt = db.prepare(
      "DELETE FROM translations WHERE target_language = :lang"
    );
    stmt.run({ ":lang": targetLanguage });
    stmt.free();

    return { success: true };
  } catch (error) {
    console.error(
      `Error clearing cache for language ${targetLanguage}:`,
      error
    );
    return { success: false, error: error.message };
  }
}

// Handle messages from the main thread
self.onmessage = function (e) {
  const message = e.data;

  switch (message.type) {
    case "INIT":
      initDatabase();
      break;

    case "QUERY_CACHE":
      const queryResult = queryCache(message.text, message.targetLang);
      self.postMessage({
        type: "QUERY_RESULT",
        requestId: message.requestId,
        ...queryResult,
      });
      break;

    case "UPDATE_CACHE":
      const updateResult = updateCache(
        message.text,
        message.translatedText,
        message.targetLang,
        message.modelUsed
      );
      self.postMessage({
        type: "UPDATE_RESULT",
        requestId: message.requestId,
        ...updateResult,
      });
      break;

    case "CLEANUP_CACHE":
      cleanupCache();
      self.postMessage({
        type: "CLEANUP_COMPLETE",
      });
      break;

    case "CLEAR_LANGUAGE_CACHE":
      const clearResult = clearLanguageCache(message.targetLang);
      self.postMessage({
        type: "CLEAR_RESULT",
        requestId: message.requestId,
        ...clearResult,
      });
      break;

    case "SAVE_DB":
      persistDatabase();
      break;

    default:
      console.error("Unknown message type:", message.type);
  }
};

// Initialize the database when the worker starts
initDatabase();
