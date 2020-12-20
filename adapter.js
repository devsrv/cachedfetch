import { endsWith, has } from 'lodash';

function _hasTTLExpired(ttl) {
    const currDate = new Date();

    return currDate.getTime() > Number(ttl);
}
function _setTTL(no, period = 'minute') {
    const supportedPeriods = ['day', 'hour', 'minute', 'second'];

    if(! supportedPeriods.includes(period)) {
        throw new Error('period not supported, use any of day /hour/ minute/ second');
    }

    const till = Number(no);

    const currDate = new Date();

    switch (period) {
        case 'day':
            currDate.setHours(currDate.getHours() + (till * 24));
            break;
    
        case 'hour':
            currDate.setHours(currDate.getHours() + till);
            break;
    
        case 'minute':
            currDate.setMinutes(currDate.getMinutes() + till);
            
            break;
    
        default:
            currDate.setSeconds(currDate.getSeconds() + till);
            break;
    }

    return currDate.getTime();
}
const _hashstr = s => {
    let hash = 0;
    if (s.length == 0) return hash;
    for (let i = 0; i < s.length; i++) {
        let char = s.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
}

const storageBox = (driver = 'localStorage', disk = undefined) => {
    let storage = window.localStorage;

    switch (driver) {
        case 'localStorage':
            storage = window.localStorage;
            return {
                get: (key) => storage.getItem(key),
                set: (key, val) => storage.setItem(key, val),
                remove: (key) => storage.removeItem(key),
                clear: () => storage.clear(),
            }

            break;

        case 'sessionStorage':
            storage = window.sessionStorage;
            return {
                get: (key) => storage.getItem(key),
                set: (key, val) => storage.setItem(key, val),
                remove: (key) => storage.removeItem(key),
                clear: () => storage.clear(),
            }

            break;

        case 'AsyncStorage':
            if (typeof disk === 'undefined') {
                throw new Error('required storage instance missing');
            }

            return {
                get: async (key) => {
                    try {
                        const value = await disk.getItem(key)
                        return value;
                    } catch(e) {
                        throw new Error('error reading value from '+ driver);
                    }
                },
                set: (key, val) => disk.setItem(key, val),
                remove: async (key) => {
                    try {
                        await disk.removeItem(key)
                    } catch(e) {
                        throw new Error('error removing data from '+ driver);
                    }
                },
                clear: () => disk.clear(),
            }

            break;

        default:
            storage = window.localStorage;
            return {
                get: (key) => storage.getItem(key),
                set: (key, val) => storage.setItem(key, val),
                remove: (key) => storage.removeItem(key),
                clear: () => storage.clear(),
            }
    }
}

const cacheManager = (config, key, url, overrideCachemode = null) => {
    if(! has(config, 'mode') || ! ['block', 'allow'].includes(config.mode)) throw new Error('accepted modes: block | allow');
    if(! has(config, 'matchIn') && ! has(config, 'endsWith')) throw new Error('malformed config');

    const storage = storageBox(config.driver, config.disk);
    const cacheKey = _hashstr(`${key}:${url}`);

    return {
        should: function() {
            if(overrideCachemode !== null) return overrideCachemode;

            let allowed = false;

            if(config.mode === 'block') {
                allowed = true;

                if(has(config, 'matchIn')) {
                    if(config.matchIn.includes(url)) allowed = false;
                }

                if(has(config, 'endsWith')) {
                    config.endsWith.forEach(partial => {
                        if(endsWith(url, partial)) allowed = false;
                    });
                }
            }
            else {
                allowed = false;

                if(has(config, 'matchIn')) {
                    if(config.matchIn.includes(url)) allowed = true;
                }

                if(has(config, 'endsWith')) {
                    config.endsWith.forEach(partial => {
                        if(endsWith(url, partial)) allowed = true;
                    });
                }
            }

            return allowed;
        },
        has: function(item) {
            if(item === null) return false;

            const payload = JSON.parse(item);

            if(_hasTTLExpired(payload.ttl)) {
                this.delete();

                return false;
            }

            return true;
        },
        store: function(data, ttlStr = config.defaultTTL) {
            // console.log('should store', this.should());

            if(! this.should()) return false;

            const ttlParts = ttlStr.split(' ');
            const ttl = _setTTL(ttlParts[0], ttlParts[1]);

            storage.set(cacheKey, JSON.stringify(Object.assign({
                data,
                ttl
            })));

            // console.log('stored for ', ttlStr);
        },
        get: function() {
            return storage.get(cacheKey);
        },
        select: function() {
            if(overrideCachemode !== null) {
                if(overrideCachemode === false) {
                    this.delete();

                    return false;
                }
            }

            const item = this.get();

            if(! this.has(item)) return false;

            return JSON.parse(item).data;
        },
        delete: () => {
            storage.remove(cacheKey);
        },
        flushAll: () => {
            storage.clear();
        },
    }
}

export default function _initCachedFetch(config, headers) {
    return function (key, url, userOptions) {
        let options = {
            headers: headers
        };

        options = Object.assign(options, userOptions);

        let overrideCachemode = null;
        if(has(options, 'keep-cache')) {
            overrideCachemode = options['keep-cache'];
        }

        const cacher = cacheManager(config, key, url, overrideCachemode);

        const cachedContent = cacher.select();

        // cached data exists, resturning cached
        if(cachedContent) {
            // console.log('fetching cached');

            const response = new Response(cachedContent)
            return Promise.resolve(response)
        }

        // console.log('no cached content');

        // nothing in cache store, fetch & cache, then response out
        return fetch(url, options).then(response => {
            // let's only store in cache if the content-type is
            // JSON or something non-binary
            if (response.status >= 200 && response.status < 300) {
                let ct = response.headers.get('Content-Type')
                if (ct && (ct.match(/application\/json/i) || ct.match(/text\//i))) {
                    // There is a .json() instead of .text() but
                    // we're going to store it in sessionStorage as
                    // string anyway.
                    // If we don't clone the response, it will be
                    // consumed by the time it's returned. This
                    // way we're being un-intrusive.
                    response.clone().text().then(content => {
                        let ttl = has(options, 'cacheTTL') ? options.cacheTTL : config.defaultTTL;

                        // console.log('attempt storing');
                        cacher.store(content, ttl);
                    })
                }
            }
            return response
        })
    }
}

window._initCachedFetch = _initCachedFetch;
