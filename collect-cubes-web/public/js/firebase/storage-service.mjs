import {
    getDownloadURL,
    ref,
    uploadString
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-storage.js';

import { storage } from './app.mjs';
import { getCurrentUser } from './auth-service.mjs';

/**
 * @param {string} levelId - Level identifier.
 * @param {object} levelData - Serializable level definition.
 * @returns {Promise<string>} Public download URL.
 */
export async function uploadLevelDefinition(levelId, levelData) {
    const user = getCurrentUser();
    if (!user) {
        throw new Error('Usuário não autenticado.');
    }

    const path = `collect-cubes/levels/${user.uid}/${levelId}.json`;
    const storageRef = ref(storage, path);
    await uploadString(storageRef, JSON.stringify(levelData, null, 2), 'raw', {
        contentType: 'application/json'
    });
    return getDownloadURL(storageRef);
}

/**
 * @param {string} levelId - Level identifier.
 * @param {Blob} imageBlob - Thumbnail image.
 * @returns {Promise<string>} Public download URL.
 */
export async function uploadLevelThumbnail(levelId, imageBlob) {
    const user = getCurrentUser();
    if (!user) {
        throw new Error('Usuário não autenticado.');
    }

    const path = `collect-cubes/thumbnails/${user.uid}/${levelId}.png`;
    const storageRef = ref(storage, path);
    const { uploadBytes } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-storage.js');
    await uploadBytes(storageRef, imageBlob, { contentType: 'image/png' });
    return getDownloadURL(storageRef);
}
