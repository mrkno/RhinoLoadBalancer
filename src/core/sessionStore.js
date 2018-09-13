const EventEmitter = require('events');

class SessionStore extends EventEmitter {
    constructor() {
        super();
        this._store = {};
    }

    store(key, value) {
        return this._store[key] = value;
    }

    getSession(key) {
        return this._store[key] || null;
    }

    keys(key) {
        const regex = new RegExp(key.replace('?', '.?').replace('*', '.*'));
        return Object.keys(this._store).filter(k => regex.test(k));
    }

    get(key){
        return this.getSession(key);
    }

    set(key, value) {
        this.store(key, value);
        return 'OK';
    }

    del(keys) {
        const before = Object.keys(this._store).length;
        for (const key of keys) {
            delete this._store[key];
        }
        return Object.keys(this._store).length - before;
    }
}

module.exports = SessionStore;
