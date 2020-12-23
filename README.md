# cachedFetch
> A micro utility built around the [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) that allows caching network query results. 
> Support *`localStorage`, `sessionStorage`, `AsyncStorage` (React Native)*

## 📥 Installation

simply include the [adapter.min.js](https://github.com/devsrv/cachedfetch/blob/master/adapter.min.js) file in your project


## 🧪 The config file :

```javascript
const config = {
    mode: 'block',	//support block | allow
    matchIn: [
        'https://jsonplaceholder.typicode.com/posts/1'
    ],
    endsWith: [
        '?postId=1',
        // '/posts'
    ],
    defaultTTL: '5 day',	// day | hour | minute | second
    driver: 'sessionStorage', // localStorage (default) | sessionStorage | AsyncStorage
    disk: undefined			// undefined | AsyncStorage
};
```

## For `React Native`
```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';

const config = {
    mode: 'block',
    .
    .
    driver: 'AsyncStorage',
    disk: AsyncStorage
};
```

### Initialization with common headers & config

```javascript
const headers = new Headers();
headers.append('Accept', 'application/json');
headers.append('Content-Type', 'application/json');
headers.append('X-Requested-With', 'XMLHttpRequest');
// headers.append('X-CSRF-Token', document.querySelector('meta[name="csrf-token"]').content);
```

```javascript
const cachedFetch = _initCachedFetch(config, headers);
```

### EXAMPLES

____

__1. GET request with override cache mode__

```javascript
cachedFetch('fetch_posts', 'https://jsonplaceholder.typicode.com/posts', {
    'keep-cache' : true, // override mode
    cacheTTL: '1 minute'
    // any additional options goes here
})
.then(r => r.json())
.then(res => console.log('result', res));
```

__2. POST request (using global cache config)__

```javascript
cachedFetch('add_user', 'https://reqres.in/api/users', {
    method: 'POST',
    body: JSON.stringify({name: 'sourav', job: 'engineer'}),
})
.then(r => r.json())
.then(res => console.log('result', res));
```

__3. when content-type text/*__

```javascript
cachedFetch('fetch_posts', 'https://httpbin.org/html', {
    'keep-cache' : true,
    cacheTTL: '1 minute'
})
.then(r => r.text())
.then(res => console.log('result', res));
```


## 👋🏼 Say Hi! 
Leave a ⭐ if you find this package useful 👍🏼,

also don't forget to let me know in [Twitter](https://twitter.com/srvrksh)  
