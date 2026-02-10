// core/vector-db.js
import { log } from './ai-provider.js';

class VectorDB {
    constructor() {
        this.collections = new Map(); // collectionName -> { vectors: [], metadatas: [] }
        log('INFO', 'In-memory VectorDB initialized');
    }

    /**
     * Kosinüs benzerliğini hesaplar.
     * @param {number[]} vec1
     * @param {number[]} vec2
     * @returns {number} Kosinüs benzerliği.
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
            return 0; // Avoid division by zero
        }
        return dotProduct / (magnitude1 * magnitude2);
    }

    /**
     * Vektör koleksiyonu oluşturur veya alır.
     * @param {string} collectionName
     * @returns {{vectors: Array<number[]>, metadatas: Array<Object>}}
     */
    getCollection(collectionName) {
        if (!this.collections.has(collectionName)) {
            this.collections.set(collectionName, { vectors: [], metadatas: [] });
            log('INFO', `Vector collection "${collectionName}" created.`);
        }
        return this.collections.get(collectionName);
    }

    /**
     * Koleksiyona vektör ve metadata ekler.
     * @param {string} collectionName
     * @param {number[]} vector
     * @param {Object} metadata
     */
    add(collectionName, vector, metadata) {
        const collection = this.getCollection(collectionName);
        collection.vectors.push(vector);
        collection.metadatas.push(metadata);
        log('INFO', `Vector added to collection "${collectionName}"`);
    }

    /**
     * Bir sorgu vektörüne en benzer vektörleri bulur.
     * @param {string} collectionName
     * @param {number[]} queryVector
     * @param {number} topK En çok kaç sonuç döndürülecek.
     * @returns {Array<{metadata: Object, similarity: number}>} Sıralanmış sonuçlar.
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

        results.sort((a, b) => b.similarity - a.similarity); // Yüksek benzerlik önde
        log('INFO', `Search performed on collection "${collectionName}", found ${results.length} results.`);
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
