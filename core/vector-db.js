// core/vector-db.js
// Persistent Vector Database for Vantuz AI
// Uses JSON file persistence instead of in-memory-only storage.

import fs from 'fs';
import path from 'path';
import os from 'os';
import { log } from './ai-provider.js';

const VECTOR_DIR = path.join(os.homedir(), '.vantuz', 'memory');
const VECTOR_FILE = path.join(VECTOR_DIR, 'vectors.json');

function ensureDir() {
    if (!fs.existsSync(VECTOR_DIR)) {
        fs.mkdirSync(VECTOR_DIR, { recursive: true });
    }
}

function loadFromDisk() {
    try {
        if (fs.existsSync(VECTOR_FILE)) {
            const raw = fs.readFileSync(VECTOR_FILE, 'utf-8');
            const data = JSON.parse(raw);
            // Convert plain object back to Map
            const map = new Map();
            for (const [name, collection] of Object.entries(data)) {
                map.set(name, collection);
            }
            log('INFO', `VectorDB loaded from disk`, { collections: map.size });
            return map;
        }
    } catch (e) {
        log('WARN', 'VectorDB disk load failed, starting fresh', { error: e.message });
    }
    return new Map();
}

function saveToDisk(collections) {
    ensureDir();
    const obj = {};
    for (const [name, collection] of collections) {
        obj[name] = collection;
    }
    const tmp = VECTOR_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(obj), 'utf-8');
    fs.renameSync(tmp, VECTOR_FILE);
}

class VectorDB {
    constructor() {
        ensureDir();
        this.collections = loadFromDisk();
        this._dirty = false;
        this._saveTimer = null;
        log('INFO', 'Persistent VectorDB initialized', { collections: this.collections.size });
    }

    /**
     * Debounced save — writes to disk at most every 2 seconds.
     */
    _scheduleSave() {
        this._dirty = true;
        if (this._saveTimer) return;
        this._saveTimer = setTimeout(() => {
            if (this._dirty) {
                saveToDisk(this.collections);
                this._dirty = false;
                log('INFO', 'VectorDB persisted to disk');
            }
            this._saveTimer = null;
        }, 2000);
    }

    /**
     * Force immediate save.
     */
    flush() {
        if (this._saveTimer) {
            clearTimeout(this._saveTimer);
            this._saveTimer = null;
        }
        saveToDisk(this.collections);
        this._dirty = false;
    }

    /**
     * Kosinüs benzerliğini hesaplar.
     */
    _cosineSimilarity(vec1, vec2) {
        if (vec1.length !== vec2.length) {
            throw new Error('Vectors must be of the same dimension');
        }
        let dotProduct = 0;
        let magnitude1 = 0;
        let magnitude2 = 0;
        for (let i = 0; i < vec1.length; i++) {
            dotProduct += vec1[i] * vec2[i];
            magnitude1 += vec1[i] * vec1[i];
            magnitude2 += vec2[i] * vec2[i];
        }
        magnitude1 = Math.sqrt(magnitude1);
        magnitude2 = Math.sqrt(magnitude2);

        if (magnitude1 === 0 || magnitude2 === 0) {
            return 0;
        }
        return dotProduct / (magnitude1 * magnitude2);
    }

    /**
     * Vektör koleksiyonu oluşturur veya alır.
     */
    getCollection(collectionName) {
        if (!this.collections.has(collectionName)) {
            this.collections.set(collectionName, { vectors: [], metadatas: [] });
            this._scheduleSave();
            log('INFO', `Vector collection "${collectionName}" created.`);
        }
        return this.collections.get(collectionName);
    }

    /**
     * Koleksiyona vektör ve metadata ekler.
     */
    add(collectionName, vector, metadata) {
        const collection = this.getCollection(collectionName);
        collection.vectors.push(vector);
        collection.metadatas.push(metadata);
        this._scheduleSave();
        log('INFO', `Vector added to collection "${collectionName}"`);
    }

    /**
     * Bir sorgu vektörüne en benzer vektörleri bulur.
     */
    search(collectionName, queryVector, topK = 5) {
        const collection = this.collections.get(collectionName);
        if (!collection || collection.vectors.length === 0) {
            return [];
        }

        const results = collection.vectors.map((vector, index) => {
            const similarity = this._cosineSimilarity(queryVector, vector);
            return {
                metadata: collection.metadatas[index],
                similarity: similarity
            };
        });

        results.sort((a, b) => b.similarity - a.similarity);
        log('INFO', `Search on "${collectionName}", found ${results.length} results.`);
        return results.slice(0, topK);
    }
}

let vectorDbInstance = null;

export function getVectorDB() {
    if (!vectorDbInstance) {
        vectorDbInstance = new VectorDB();
    }
    return vectorDbInstance;
}
