'use strict'

const Promise = require('bluebird')
const IPFS = require('ipfs')
const Log  = require('../src/log2')

const ipfs = new IPFS()
const log1 = new Log(ipfs, 'A')
const log2 = new Log(ipfs, 'B')
const log3 = new Log(ipfs, 'C')

const numbers = []
const OPS = 5000

for(let i = 0; i < OPS; i ++) {
  numbers.push(i)
}

Promise.map(numbers, (e) => log1.add("a" + e))
  .then((res1) => {
    Promise.map(numbers, (e) => log2.add("b" + e))
      .then((res2) => {
        console.log("-- Join logs --")
        log1.join(log2)
          .then((e) => log2.join(log1))
          .then((e) => {
            console.log("ITEMS1", log1.items.length)
            console.log("ITEMS2", log2.items.length)
            // console.log("ITEMS2", log2._prev)
          })
      })
      .catch((e) => console.error(e))
  })
  .catch((e) => console.error(e))
