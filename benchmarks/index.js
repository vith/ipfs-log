'use strict'

const Benchmark = require('benchmark')
// const IPFS = require('ipfs-daemon')
const IPFS = require('ipfs-daemon/src/ipfs-node-daemon')
const Log = require('../src/log')

const suite = new Benchmark.Suite('ipfs-log')

let ipfs = new IPFS({
  Flags: [],
  Bootstrap: []
})

ipfs.on('error', (err) => {
  console.error(err)
  process.exit(1)
})

let log1
let log2
let i = 0

suite.add('append', (d) => {
  Log.append(ipfs, log1, (i++).toString())
    .then((res) => d.resolve())
    .catch((e) => console.error(e))
}, {
  minSamples: 100,
  defer: true
})

suite.add('join', (d) => {
  i++

  Promise.all([
    Log.append(ipfs, log1, 'a' + i),
    Log.append(ipfs, log2, 'b' + i)
  ])
    .then((res) => {
      log1 = Log.join(ipfs, res[0], res[1], 60)
      log2 = Log.join(ipfs, res[1], res[0], 60)
      d.resolve()
    })
    .catch((e) => console.error(e))
}, {
  minSamples: 100,
  defer: true
})

ipfs.on('ready', () => {
  log1 = Log.create(ipfs)
  log2 = Log.create(ipfs)

  suite
    .on('cycle', (event) => {
      log1 = Log.create(ipfs)
      log2 = Log.create(ipfs)
      i = 0
      console.log(String(event.target))
    })
    .on('complete', () => {
      ipfs.stop()
      process.exit(0)
    })
    .run({
      async: true
    })
})
