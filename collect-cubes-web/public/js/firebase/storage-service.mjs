import { getApp } from './core.mjs';
import { getCurrentUser } from './auth-service.mjs';

/** @type {import('firebase/storage').FirebaseStorage | null} */
let storage = null;

/**
 * @returns {Promise<import('firebase/storage').FirebaseStorage>}
 */
async function getStorageClient() {
    if (!storage) {
        const { getStorage } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-storage.js');
        storage = getStorage(await getApp());
    }
    return storage;
}

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

    const { getDownloadURL, ref, uploadString } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-storage.js');
    const storageClient = await getStorageClient();
    const path = `collect-cubes/levels/${user.uid}/${levelId}.json`;
    const storageRef = ref(storageClient, path);
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

    const { getDownloadURL, ref, uploadBytes } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-storage.js');
    const storageClient = await getStorageClient();
    const path = `collect-cubes/thumbnails/${user.uid}/${levelId}.png`;
    const storageRef = ref(storageClient, path);
    await uploadBytes(storageRef, imageBlob, { contentType: 'image/png' });
    return getDownloadURL(storageRef);
}
