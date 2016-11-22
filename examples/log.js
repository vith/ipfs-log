'use strict'

const IPFS = require('ipfs')
const Keystore = require('../src/keystore')
const Log = require('../src/log')

const ipfs = new IPFS()

const keystore = new Keystore('./keystore')

const key1 = keystore.createKey('A')
const key2 = keystore.createKey('B')
const key3 = keystore.createKey('C')

// console.log("Key1:", key1)
// console.log()
// console.log("Key2:", key2)
// console.log()

const keyA = keystore.getKey('A')
const keyB = keystore.getKey('B')
const keyC = keystore.getKey('C')

// console.log("KeyA:", keyA)
// console.log()
// console.log("KeyB:", keyB)
// console.log()

const log1 = new Log(ipfs, 'A', { keys: [keyA] })
const log2 = new Log(ipfs, 'B', { keys: [keyB] })

log1.add('one')
  .then((entry1) => {
    console.log('Entry1:', entry1)
    return log2.add('two')
  })
  .then((entry2) => {
    console.log('Entry2:', entry2)

    return Log.getIpfsHash(ipfs, log2)
      .then((hash) => {
        console.log()
        console.log("HASH", hash)
        return Log.fromIpfsHash(ipfs, hash, { keys: [keyA, keyB] })
          .then((log) => {
            log1.join(log)
            console.log()
            log1.items.forEach((e) => console.log(JSON.stringify(e, null, 2) + "\n"))          
          })
      })
  })
  .catch((e) => console.log(e))


/* Immutable Log */
// const logA = new Log(ipfs, 'A', { key: keyA })
// const logAA = logA.add('one')
// const logAAA = logA.add('two')

// const logB = new Log(ipfs, 'B', { key: keyA })
// const logBB = logB.add('1')
// const logBBB = logB.add('2')
// const hashB = Log.getIpfsHash(ipfs, logBBB)

// const logNew = Log.fromIpfsHash(ipfs, hashB, { key: keyA }) // ['1','2']
// const logX = logAAA.join(logNew) // ['one','two','1','2']
