// plugins/vantuz/platforms/_request.js
import { setTimeout as sleep } from 'timers/promises';

export async function requestWithRetry(axiosInstance, config, options = {}) {
    const {
        retries = 3,
        baseDelayMs = 500,
        maxDelayMs = 5000,
        retryOnStatuses = [429, 500, 502, 503, 504],
        retryOnNetworkError = true
    } = options;

    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        try {
            return await axiosInstance(config);
        } catch (error) {
            const status = error.response?.status;
            const isNetworkError = !error.response;
            const shouldRetry =
                attempt < retries &&
                ((retryOnNetworkError && isNetworkError) || retryOnStatuses.includes(status));

            if (!shouldRetry) {
                throw error;
            }

            const delay = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt));
            await sleep(delay);
            attempt += 1;
        }
    }
}
