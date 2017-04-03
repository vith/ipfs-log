'use strict'

const IPFS = require('ipfs-daemon/src/ipfs-browser-daemon')
const Entry = require('../../src/entry')
const Log = require('../../src/log-utils')

const openButton = document.getElementById("open")
const publishButton = document.getElementById("publish")

let log

const ipfs = new IPFS({
  SignalServer: 'star-signal.cloud.ipfs.team', // IPFS dev server
  IpfsDataDir: '/ipfs-log/examples/index'
})

ipfs.on('error', (e) => console.error(e))

ipfs.on('ready', () => {
  console.log("IPFS ready")
  const outputElm = document.getElementById('output')

  ipfs.id().then((id) => console.log(id))

  ipfs.pubsub.subscribe('ipfs', {}, () => {
    console.log("Pubsub message")
  })

  const timer = setInterval(() => {
    // ipfs.swarm.peers()
    ipfs.pubsub.peers('ipfs')
      .then((peers) => {
        outputElm.innerHTML = peers.map(e => JSON.stringify(e, null, 2))
      })
  }, 1000)
 
  publishButton.addEventListener('click', () => {
    ipfs.pubsub.publish('ipfs', new Buffer(JSON.stringify(log.heads)))
  })

  openButton.addEventListener('click', () => {
    const onProgress = (hash, entry, progress) => {
      outputElm.innerHTML = 'Loaded ' + progress + ' entries'
    }
 
    clearInterval(timer)

    Entry.fromMultihash(ipfs, 'QmRUmzodJVVweMMT8bVXUpWo6dMZDBhVcsnxe6crKVhNGH')
    // Log.fromEntry(ipfs, 'QmRUmzodJVVweMMT8bVXUpWo6dMZDBhVcsnxe6crKVhNGH')
      .then((res) => {
        console.log(">>", res)
        Log.fromEntry(ipfs, res, 100, [], onProgress)
          .then((res) => {
            log = res
            console.log("log", log)
            // log = res
            const items = JSON.stringify(log.items, null, 2)
            // console.log('\n', items)
            outputElm.innerHTML = "Heads:<br>" + JSON.stringify(log.heads, null, 2) + "<br><br>"
            outputElm.innerHTML += "Values:<br>" + items + '<br><br>'
          })
      })
  })
})
