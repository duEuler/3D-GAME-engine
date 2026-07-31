/**
 * @template T
 * @param {Promise<T>} promise - Promise to wrap.
 * @param {number} ms - Timeout in milliseconds.
 * @param {string} label - Timeout error label.
 * @returns {Promise<T>}
 */
export function withTimeout(promise, ms, label) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`${label} (timeout ${Math.round(ms / 1000)}s)`));
        }, ms);

        promise
            .then((value) => {
                clearTimeout(timer);
                resolve(value);
            })
            .catch((error) => {
                clearTimeout(timer);
                reject(error);
            });
    });
}
