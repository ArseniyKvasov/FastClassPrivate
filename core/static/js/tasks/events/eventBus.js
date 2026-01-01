/**
 * Простая шина событий (Event Bus) для фронтенда
 * Позволяет подписываться, отписываться и эмитить события
 */
export const eventBus = {
    _events: Object.create(null),

    /**
     * Подписка на событие
     * @param {string} eventName
     * @param {Function} callback
     */
    on(eventName, callback) {
        if (!this._events[eventName]) {
            this._events[eventName] = [];
        }
        this._events[eventName].push(callback);
    },

    /**
     * Отписка от события
     * @param {string} eventName
     * @param {Function} callback
     */
    off(eventName, callback) {
        if (!this._events[eventName]) return;
        this._events[eventName] = this._events[eventName].filter(cb => cb !== callback);
    },

    /**
     * Эмит события с данными
     * @param {string} eventName
     * @param {*} payload
     */
    emit(eventName, payload) {
        if (!this._events[eventName]) return;
        [...this._events[eventName]].forEach(cb => {
            try {
                cb(payload);
            } catch (err) {
                console.error(`Ошибка в обработчике события "${eventName}":`, err);
            }
        });
    }
};
