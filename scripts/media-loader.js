(() => {
  const MEDIA_INDEX_FILE = 'data/media-index.json';
  const EAGER_LIMIT = 4 * 1024 * 1024; // 4MB

  function openMediaDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        console.warn('IndexedDB not supported; media cache disabled');
        resolve(null);
        return;
      }
      const req = window.indexedDB.open('media-cache', 1);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        const store = db.createObjectStore('media', { keyPath: 'sha256' });
        store.createIndex('by-id', 'id', { unique: false });
      };
      req.onsuccess = e => resolve(e.target.result);
      req.onerror = e => reject(e.target.error);
    });
  }

  function idbRequest(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function storeBlob(db, item, blob, hash) {
    const tx = db.transaction('media', 'readwrite');
    const store = tx.objectStore('media');
    const existing = await idbRequest(store.get(hash));
    if (!existing) {
      await idbRequest(store.put({
        id: item.id,
        blob,
        sha256: hash,
        mime: item.mime || blob.type || 'application/octet-stream',
        bytes: item.bytes || blob.size,
        source: 'dropbox'
      }));
    }
    tx.commit && tx.commit();
    await new Promise((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }

  async function sha256(blob) {
    const buffer = await blob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function fetchWithRetry(url, options = {}, retries = 3, delay = 500) {
    for (let i = 0; i <= retries; i++) {
      try {
        const res = await fetch(url, options);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.blob();
      } catch (err) {
        if (i === retries) throw err;
        await new Promise(r => setTimeout(r, delay * Math.pow(2, i)));
      }
    }
  }

  function planDownloads(index) {
    const eager = [], lazy = [];
    for (const item of index) {
      if ((item.bytes || 0) < EAGER_LIMIT) {
        eager.push(item);
      } else {
        lazy.push(item);
      }
    }
    return { eager, lazy };
  }

  async function loadMedia() {
    try {
      const res = await fetch(MEDIA_INDEX_FILE);
      if (!res.ok) {
        throw new Error(`Failed to fetch media index: HTTP ${res.status} ${res.statusText}`);
      }
      const contentType = res.headers.get('content-type');
      if (contentType && !contentType.startsWith('application/json')) {
        throw new Error(`Unexpected content-type: ${contentType}`);
      }
      let index;
      try {
        index = await res.json();
      } catch (err) {
        throw new Error('Invalid JSON in media index');
      }
      const { eager, lazy } = planDownloads(index);
      window.lazyMedia = lazy; // placeholders

      const db = await openMediaDB();
      if (!db) {
        return;
      }
      const missing = [];
      for (const item of eager) {
        try {
          const blob = await fetchWithRetry(item.path, {}, 4);
          const hash = item.sha256 || await sha256(blob);
          await storeBlob(db, item, blob, hash);
        } catch (err) {
          console.warn('Failed to fetch media', item, err);
          missing.push(item.id);
        }
      }
      window.missingMediaReport = missing;
      if (missing.length) {
        console.table(missing);
      }
    } catch (err) {
      console.error('Failed to load media index', err);
    }
  }

  document.addEventListener('DOMContentLoaded', loadMedia);
  window.mediaLoader = { openMediaDB, loadMedia, planDownloads };
})();
