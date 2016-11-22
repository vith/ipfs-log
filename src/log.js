'use strict'

const unionWith = require('lodash.unionwith')
const differenceWith = require('lodash.differencewith')
const flatten = require('lodash.flatten')
const take = require('lodash.take')
const Promise = require('bluebird')
const Crypto = require('orbit-crypto')
const Entry = require('./entry')

const MaxBatchSize = 10  // How many items to keep per local batch
const MaxHistory   = 256 // How many items to fetch on join

class Log {
  constructor(ipfs, id, opts) {
    this.id = id
    this._ipfs = ipfs
    this._items = opts && opts.items ? opts.items : []

    this.options = { maxHistory: MaxHistory }
    Object.assign(this.options, opts)
    delete this.options.items

    this._currentBatch = []
    this._heads = []
  }

  get items() {
    return this._items.concat(this._currentBatch)
  }

  get snapshot() {
    return {
      id: this.id,
      items: this._currentBatch.map((f) => f.hash)
    }
  }

  get keys() {
    return this.options.keys.map((k) => k.publicKey)
  }

  add(data) {
    if (this._currentBatch.length >= MaxBatchSize)
      this._commit()

    // return Crypto.getKey(this.id)
    //   .then((key) => Crypto.sign(key.privateKey, new Buffer(JSON.stringify(data))))
    //   .then((signed) => {
    return Entry.createSignedEntry(this._ipfs, data, this.id, this.options.keys[0], this._heads)
      .then((entry) => {
        this._heads = [entry.hash]
        this._currentBatch.push(entry)
        return entry
      })
      // })
  }

  join(other) {
    console.log()
    console.log("--- join ---")
    if (!other.items) 
      throw new Error("The log to join must be an instance of Log")

    // console.log("SIGN", this.keys)
    // console.log("OTHERSIG", other.keys)

    if (other.keys.map((k) => this.keys.includes(k)).filter((e) => e === true).length === 0)
      throw new Error("Not allowed to join")

    const newItems = other.items.slice(-Math.max(this.options.maxHistory, 1))
    // console.log("OTHER", other)
    // const newItems = take(other.items.reverse(), Math.max(this.options.maxHistory, 1))
    const diff     = differenceWith(newItems, this.items, Entry.compare)
    // TODO: need deterministic sorting for the union
    const final    = unionWith(this._currentBatch, diff, Entry.compare)
    this._items    = this._items.concat(final)
    this._currentBatch = []

    const nexts = take(flatten(diff.map((f) => f.next)), this.options.maxHistory)

    // Fetch history
    return Promise.map(nexts, (f) => {
      let all = this.items.map((a) => a.hash)
      console.log(all)
      return this._fetchRecursive(this._ipfs, f, all, this.options.maxHistory - nexts.length, 0)
        .then((history) => {
          history.forEach((b) => this._insert(b))
          return history
        })
    }, { concurrency: 1 }).then((res) => {
      this._heads = Log.findHeads(this)
      return flatten(res).concat(diff)
    })
  }

  _insert(entry) {
    let indices = entry.next.map((next) => this._items.map((f) => f.hash).indexOf(next)) // Find the item's parent's indices
    const index = indices.length > 0 ? Math.max(Math.max.apply(null, indices) + 1, 0) : 0 // find the largest index (latest parent)
    this._items.splice(index, 0, entry)
    return entry
  }

  _commit() {
    this._items = this._items.concat(this._currentBatch)
    this._currentBatch = []
  }

  _fetchRecursive(ipfs, hash, all, amount, depth) {
    const isReferenced = (list, item) => list.reverse().find((f) => f === item) !== undefined
    let result = []

    // If the given hash is in the given log (all) or if we're at maximum depth, return
    if (isReferenced(all, hash) || depth >= amount)
      return Promise.resolve(result)

    // Create the entry and add it to the result
    return Entry.fromIpfsHash(ipfs, hash)
      .then((entry) => {
        result.push(entry)
        all.push(hash)
        depth ++

        return Promise.map(entry.next, (f) => this._fetchRecursive(ipfs, f, all, amount, depth), { concurrency: 1 })
          .then((res) => flatten(res.concat(result)))
      })
  }

  static getIpfsHash(ipfs, log) {
    if (!ipfs) throw new Error("Ipfs instance not defined")
    let snapshot = log.snapshot
    let signature, key
    return Crypto.getKey(log.id)
      .then((keyPair) => key = keyPair)
      .then(() => Crypto.sign(key.privateKey, new Buffer(JSON.stringify(snapshot))))
      .then((sig) => signature = sig)
      .then(() => Crypto.exportKeyToIpfs(ipfs, key.publicKey))
      .then((pubKeyHash) => {
        snapshot.sig = signature
        snapshot.keys = log.keys
        const data = new Buffer(JSON.stringify(snapshot))
        return ipfs.object.put(data)
          .then((res) => res.toJSON().Hash)
      })
  }

  static fromIpfsHash(ipfs, hash, options) {
    if (!ipfs) throw new Error("Ipfs instance not defined")
    if (!hash) throw new Error("Invalid hash: " + hash)
    if (!options) options = {}
    let logData
    return ipfs.object.get(hash, { enc: 'base58' })
      .then((res) => logData = JSON.parse(res.toJSON().Data))
      .then((res) => {
        console.log()
        console.log(logData)

        const allowedKeys = options.keys.map((k) => k.publicKey)

        const verifySignature = () => {
          const d = {
            id: logData.id,
            items: logData.items
          }

          const promises = allowedKeys.map((k) => {
            return Crypto.importPublicKey(k)
              .then((key) => Crypto.verify(logData.sig, k, new Buffer(JSON.stringify(d))))
          })

          Promise.all(promises).then((res) => {
            console.log("VERIFICATION:")
            console.log(res)
          })
        }

        verifySignature()
        
        // console.log("ALLOWED:", allowedKeys)
        // console.log("OTHER:", logData.keys)
        // console.log("RES", logData.keys.map((k) => allowedKeys.includes(k)))
        if (logData.keys.map((k) => allowedKeys.includes(k)).filter((e) => e === true).length === 0)
          throw new Error("Signing keys don't match")    

        // TODO: verify signature
 
        // if (logData.keys !== options.key.publicKey) throw new Error("Wrong signing key")
        if (!logData.items) throw new Error("Not a Log instance")
        return Promise.all(logData.items.map((f) => Entry.fromIpfsHash(ipfs, f)))
      })
      .then((items) => Object.assign(options, { items: items }))
      .then((items) => new Log(ipfs, logData.id, options))
  }

  static findHeads(log) {
    return log.items
      .reverse()
      .filter((f) => !Log.isReferencedInChain(log, f))
      .map((f) => f.hash)
  }

  static isReferencedInChain(log, item) {
    return log.items.reverse().find((e) => Entry.hasChild(e, item)) !== undefined
  }

  static get batchSize() {
    return MaxBatchSize
  }
}

module.exports = Log
