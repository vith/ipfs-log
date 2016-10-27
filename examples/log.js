'use strict'

const IPFS = require('ipfs')
const Log  = require('../src/log2')

const ipfs = new IPFS()
const log = new Log(ipfs, 'A')

log.add('one')
  .then((entry1) => {
    console.log('Entry1:', entry1.hash, entry1.payload)
    console.log('Entry1.next:', entry1.next) 
    console.log()
    return log.add('two')
  })
  .then((entry2) => {
    console.log('Entry2:', entry2.hash, entry2.payload)
    console.log('Entry2.next:', entry2.next) 
    console.log()
    return log.add('thee')
  })
  .then((entry3) => {
    console.log('Entry3:', entry3.hash, entry3.payload)
    console.log('Entry3.next:', entry3.next) 
    console.log()
    // == entry1.hash
  })
