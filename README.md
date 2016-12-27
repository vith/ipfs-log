# ipfs-log

[![npm version](https://badge.fury.io/js/ipfs-log.svg)](https://badge.fury.io/js/ipfs-log)
[![CircleCI Status](https://circleci.com/gh/haadcode/ipfs-log.svg?style=shield)](https://circleci.com/gh/haadcode/ipfs-log)
[![](https://img.shields.io/badge/made%20by-Protocol%20Labs-blue.svg?style=flat-square)](http://ipn.io)

> An append-only log on IPFS.

`ipfs-log` is a *partially ordered, append-only linked list* of [IPFS](https://github.com/ipfs/ipfs) objects. 

## Table of Contents

- [Background](#background)
- [Install](#install)
- [Usage](#usage)
- [API](#api)
- [Tests](#tests)
- [Build](#build)
- [Contribute](#contribute)
- [License](#license)

## Background

This module provides a data-agnostic transport mechanism using IPFS with the ability to traverse the history. Every entry in the log is saved in IPFS and each points to a hash of previous entry(ies). Logs can be forked and joined back together.

```
entry0 <-- entry1 <-- entry2 ...
```

The module works in **Node.js** and **Browsers**.

IPFS Log has a few use cases:

- CRDTs
- Database operations log
- Feed of data
- Track a version of a file
- Messaging

It was originally created for, and currently used in, [orbit-db](https://github.com/haadcode/orbit-db) - a distributed peer-to-peer database on [IPFS](https://github.com/ipfs/ipfs).

## Requirements

- Node.js v6.0.0 or newer

## Install

```
npm install ipfs-log
```

## Usage

See [examples](https://github.com/haadcode/ipfs-log/tree/master/examples) for more details.

### Quick Start

Install dependencies:

```
npm install ipfs-log ipfs
```

Run a simple program:

```javascript
const IPFS = require('ipfs')
const Log  = require('ipfs-log')

const ipfs = new IPFS()
const log  = new Log(ipfs, 'A')

log.add({ some: 'data' })
  .then(() => log.add('text'))
  .then(() => console.log(log.items))

// [
//   {
//     payload: { some: 'data' },
//     hash: 'QmYiefTHzCLNroCfKw7YTUy9Yo53sCfwzyU5p7SBBxTcmD',
//     next: [] 
//   },
//   {
//     payload: 'text',
//     hash: 'QmdNFpoyXLNdR8Wx5LYZBLcXH8aAEopSMnnubWLn4AciCZ',
//     next: [ 'QmYiefTHzCLNroCfKw7YTUy9Yo53sCfwzyU5p7SBBxTcmD' ] 
//   }
// ]
```

### Node.js

See [examples](https://github.com/haadcode/ipfs-log/tree/master/examples) for details.

#### Run

```
node examples/log.js
```

#### Code

```javascript
const IPFS = require('ipfs')
const Log  = require('ipfs-log')

const log = new Log(new IPFS(), 'A', { maxHistory: 1000 })

log.add('one')
  .then((entry1) => {
    console.log('Entry1:', entry1.hash, entry1.payload)
    return log.add('two')
  })
  .then((entry2) => {
    console.log('Entry2:', entry2.hash, entry2.payload)
    console.log('Entry2.next:', entry2.next[0]) // == entry1.hash
  })
```

### Browser

*The distribution package for browsers is located in [dist/ipfslog.min.js](https://github.com/haadcode/ipfs-log/tree/master/dist)*

See [examples/browser](https://github.com/haadcode/ipfs-log/tree/master/examples/browser) for details.

#### Run

Open [examples/browser/index.html](https://github.com/haadcode/ipfs-log/tree/master/examples/browser/index.html) or [examples/browser/browser.html](https://github.com/haadcode/ipfs-log/tree/master/examples/browser/browser.html) in your browser.

#### Code

```html
<html>
  <head>
    <meta charset="utf-8">
  </head>
  <body>
    <script type="text/javascript" src="../../dist/ipfslog.min.js" charset="utf-8"></script>
    <script type="text/javascript" src="../../node_modules/ipfs/dist/index.js" charset="utf-8"></script>
    <script type="text/javascript">
      const ipfs = new window.Ipfs()
      const log = new Log(ipfs, 'A')
      log.add('one')
        .then((entry1) => {
          console.log('Entry1:', entry1.hash, entry1.payload, entry1)
          return log.add('two')
        })
        .then((entry2) => {
          console.log('Entry2:', entry2.hash, entry2.payload, entry2)
          console.log("Entry2.next:", entry2.next[0])
        });
    </script>
  </body>
</html>
```

#### Building the browser examples

```
npm install
npm run build
```

## API

### Log

```javascript
const Log = require('ipfs-log')
```

#### Instance Methods

##### constructor(ipfs, id, [options])

Create a log. The first argument is an `ipfs` instance which can be of type `js-ipfs` or `js-ipfs-api`. See https://github.com/ipfs/js-ipfs-api for IPFS api documentation.

```javascript
const ipfs = require('ipfs')() // ipfs javascript implementation
// Or
const ipfs = require('ipfs-api')() // local ipfs daemon (go-ipfs)

const log = new Log(ipfs, 'logid') // 'logid' is a unique identifier for the log, this can usually be a user id
```

`ipfs` is an instance of IPFS (`ipfs` or `ipfs-api`)

`id` is a unique log identifier. Usually this should be a user id or similar.

`options` are the following:
```javscript
{
  maxHistory: 1000 // number of item to fetch at sync
}
```

##### add(data)

Add a log entry. The new entry gets the references to previous entries automatically. Returns a *Promise* that resolves to the added `Entry`.

`data` can be any type of data: Number, String, Object, etc. It can also be an instance of [Entry](https://github.com/haadcode/ipfs-log/blob/master/examples/entry.js).

```javascript
log.add({ some: 'data' })
  .then(() => log.add('text'))
  .then(() => console.log(log.items))

//[
//  {
//    payload: { some: 'data' },
//    hash: 'QmYiefTHzCLNroCfKw7YTUy9Yo53sCfwzyU5p7SBBxTcmD',
//    next: [] 
//  },
//  {
//    payload: 'text',
//    hash: 'QmdNFpoyXLNdR8Wx5LYZBLcXH8aAEopSMnnubWLn4AciCZ',
//    next: [ 'QmYiefTHzCLNroCfKw7YTUy9Yo53sCfwzyU5p7SBBxTcmD' ] 
//  }
//]
```

##### join(other)

Joins the log with `other` log. Fetches history up to `options.maxHistory` items, ie. items that are not in this log but referred to in items in `other`. Returns a *Promise* that resolves to an `Array` of items that were added.

```javascript
// log1.items ==> ['A', 'B', 'C']
// log2.items ==> ['C', 'D', 'E']

log1.join(log2).then((added) => console.log(added)) // ==> ['D', 'E']

// log1.items ==> ['A', 'B', 'C', 'D', 'E']
```

##### items

Returns an `Array` of all items in the log.

```javascript
const items = log.items;
// items ==> ['A', 'B', 'C']
```

##### snapshot

Returns a *snapshot* of the log with items in the current batch. Current batch are the items in the log that have been added locally after the latest join with another log.

```javascript
const snapshot = log.snapshot
// snapshot ==> { id: 'log id', items: ['A', 'B', 'C']}
```

#### Static Methods

All static methods take an `ipfs` instance as the first parameter. The ipfs can be of `js-ipfs` or `js-ipfs-api`. See https://github.com/ipfs/js-ipfs-api for IPFS api documentation.

```javascript
const ipfs = require('ipfs')() // js-ipfs
// Or
const ipfs = require('ipfs-api')() // local ipfs daemon
```

*See [Instance methods](https://github.com/haadcode/ipfs-log#instance-methods) on how to use the log instance*

##### getIpfsHash(ipfs, log)

Get the IPFS hash of this log. Returns a `Promise` that resolves to an IPFS `hash`.

```javascript
Log.getIpfsHash(ipfs, log).then((hash) => console.log(hash))
// ==> 'Qm...abc123'
```

##### fromIpfsHash(ipfs, hash)

Create a log from an IPFS hash. Returns a `Promise` that resolves to a `Log` instance.

```javascript
Log.fromIpfsHash(ipfs, hash).then((log) => console.log(log))
// ==> instance of Log
```

## Tests

```
npm install
npm test
```

## Build

The build script will build the distribution file for browsers.
```
npm run build
```

## Benchmark

There's a simple [benchmark program](https://github.com/haadcode/ipfs-log/blob/master/examples/benchmark.js) that can be used to compare performance between two version of `ipfs-log`. It measures write ops / second.

```
npm install
node examples/benchmark.js
```

This will output:
```
Starting benchmark...
131 queries per second, 131 queries in 1 seconds
50 queries per second, 181 queries in 2 seconds
44 queries per second, 225 queries in 3 seconds
84 queries per second, 309 queries in 4 seconds
111 queries per second, 420 queries in 5 seconds
142 queries per second, 562 queries in 6 seconds
157 queries per second, 719 queries in 7 seconds
195 queries per second, 914 queries in 8 seconds
171 queries per second, 1085 queries in 9 seconds
--> Average of 125 q/s in the last 10 seconds
...
```


## Contribute

PRs and [issues](https://github.com/haadcode/ipfs-log/issues) are gladly accepted! Take a look at the open issues, too, to see if there is anything that you could do or someone else has already done. Here are some things I know I need:

### Notes

- Immutable
- O(1) writes, O(1) reads, O(n) joins
- Joins can be made constant-time by limiting the join (eg. { limit: 1000 })

### TODO

- Node.js Stream API
- Support for encrypting the hashes
- Support for payload encryption

## License

[MIT](LICENSE) © 2016 Haadcode
