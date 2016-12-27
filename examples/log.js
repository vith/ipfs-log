'use strict'

const IPFS = require('ipfs-daemon/src/ipfs-node-daemon')
const Log  = require('../src/log')

const ipfs = new IPFS()


ipfs.on('error', (err) => console.error(err))

ipfs.on('ready', () => {
  // When IPFS is ready, add some log entries
  let log = Log.create(ipfs)
  Log.append(ipfs, log, 'one')
    .then((res) => {
      log = res
      console.log('\n', log.items)
      return Log.append(ipfs, log, { two: 'hello' })
    })
    .then((res) => {
      log = res
      console.log('\n', log.items)
      process.exit(0)
    })
})
