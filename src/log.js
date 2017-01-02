'use strict'

const differenceWith = require('lodash.differencewith')
const take = require('lodash.take')
const Promise = require('bluebird')
const Entry = require('./entry')

/** 
 * ipfs-log
 *
 * @example
 * const IPFS = require('ipfs-daemon')
 * const Log  = require('ipfs-log')
 *
 * const ipfs = new IPFS()
 *
 * const log1 = Log.create(ipfs, 'A')
 * const log2 = Log.create(ipfs, 'B')
 *
 * ipfs.on('error', (err) => console.error(err))
 *
 * ipfs.on('ready', () => {
 *   // Add entry to the first log
 *   const entry1 = await Log.append(ipfs, log, 'one')
 *   console.log(entry1.hash, entry1.payload)
 *
 *   // Add entry to the second log
 *   const entry2 = await Log.append(ipfs, log, { two: 'hello' })
 *   console.log(entry2.hash, entry2.payload)
 *
 *   // Join the logs
 *   const log3 = Log.join(ipfs, log1, log2)
 *
 *   // Output the log as an array and as a graph
 *   console.log(log3.items.map((e) => e.payload).join()) 
 *   // ['one', '{ two: 'hello' }']
 *   log3.print()
 * })
 */
class Log {
  constructor(ipfs, id, opts) {
    this._id = id || 'default'
    this._ipfs = ipfs
    this._items = opts && opts.items ? opts.items : []
    this._heads = opts && opts.heads ? opts.heads : LogUtils._findHeads(this)
  }

  /**
   * Returns the id of the log
   * @returns {string}
   */
  get id() {
    return this._id
  }

  /**
   * Returns the items in the log
   * @returns {Array<Entry>}
   */
  get items() {
    return this._items
  }

  /**
   * Returns a list of heads as multihashes
   * @returns {Array<string>}
   */
  get heads() {
    return this._heads
  }

  /**
   * Find a log entry
   * @param {string} [hash] [The multihash of the entry]
   * @returns {Entry|undefined}
   */
  get(hash) {
    return this.items.find((e) => e.hash === hash)
  }

  /**
   * Get the log entries as a string
   * @returns {string}
   */
  toString() {
    return this.items.map((e) => e.payload).join("\n")
  }

  /**
   * Get the log in serialized format
   * @returns {Object<{id, heads}>}
   */
  serialize() {
    return {
      id: this.id,
      heads: this.heads,
    }
  }

  /**
   * Print the log as a graph
   * @param {boolean} [witHash] [Print entries with their multihash. Default: print payload only.]
   */
  print(withHash) {
    let items = [].concat(this.items).reverse()
    items.forEach((e, idx) => {      
      const parents = LogUtils._findParents(this, e)
      let padding = []

      for(let i = 0; i < parents.length - 1; i ++) {
        padding.push("  ")
      }

      if (parents.length > 0) {
        padding.push("└─")
      }

      console.log(padding.join("") + (withHash ? e.hash + " " : "") + e.payload)
    })
  }
}

class LogUtils {
  /**
   * Create a new log
   * @param {IPFS} ipfs An IPFS instance
   * @param {string} id - ID for the log
   * @param {Array} [entries] - Entries for this log
   * @param {Array} [heads] - Heads for this log
   * @returns {Log}
   */
  static create(ipfs, id, entries, heads) {
    if (!ipfs) throw new Error("Ipfs instance not defined")
    return new Log(ipfs, id, {
      items: entries,
      heads: heads,
    })
  }

  /**
   * Create a new log starting from an entry
   * @param {IPFS} [ipfs] An IPFS instance
   * @param {string} id
   * @param {string} [hash] [Multihash of the entry to start from]
   * @param {Number} length
   * @param {function(hash, entry, parent, depth)} onProgressCallback
   * @returns {Promise<Log>}
   */
  static fromEntry(ipfs, id, hash, length = -1, onProgressCallback) {
    return LogUtils._fetchRecursive(ipfs, hash, {}, length, 0, null, onProgressCallback)
      .then((items) => {
        let log = LogUtils.create(ipfs, id)
        items.reverse().forEach((e) => LogUtils._insert(ipfs, log, e))
        log._heads = LogUtils._findHeads(log)
        return log
      })
  }

  /**
   * Create a log from multihash
   * @param {IPFS} [ipfs] An IPFS instance
   * @param {string} [hash] Multihash to create the log from
   * @param {Number} [length=-1] How many items to include in the log
   * @returns {Promise<Log>}
   */
  static fromIpfsHash(ipfs, hash, length = -1, onProgressCallback) {
    if (!ipfs) throw new Error("Ipfs instance not defined")
    if (!hash) throw new Error("Invalid hash: " + hash)
    let logData
    return ipfs.object.get(hash, { enc: 'base58' })
      .then((res) => logData = JSON.parse(res.toJSON().data))
      .then((res) => {
        if (!logData.heads) throw new Error("Not a Log instance")
        // Get one log
        const getLog = (f) => LogUtils.fromEntry(ipfs, logData.id, f, length, onProgressCallback)
        // Fetch a log starting from each head entry
        const allLogs = logData.heads
          .sort((a, b) => a > b)
          .map((f) => getLog(f))
        // Join all logs together to one log
        const joinAll = (logs) => LogUtils.joinAll(ipfs, logs)
        return Promise.all(allLogs).then(joinAll)
      })
  }

  /**
   * @alias fromIpfsHash
   */
  static fromMultihash(ipfs, log, length = -1, onProgressCallback) {
    return LogUtils.fromIpfsHash(ipfs, log, length, onProgressCallback)
  }

  /**
   * Get the log's multihash
   * @param {IPFS} [ipfs] An IPFS instance
   * @param {Log} log
   * @returns {Promise<string>}
   */
  static getIpfsHash(ipfs, log) {
    if (!ipfs) throw new Error("Ipfs instance not defined")
    if (!log) throw new Error("Log instance not defined")
    if (log.items.length < 1) throw new Error("Can't serialize an empty log")
    const data = new Buffer(JSON.stringify(log.serialize()))
    return ipfs.object.put(data)
      .then((res) => res.toJSON().multihash)
  }

  /**
   * @alias getIpfsHash
   */
  static toMultihash(ipfs, log) {
    return LogUtils.getIpfsHash(ipfs, log)
  }

  /**
   * Add an entry to a log
   * @description Adds an entry to the Log and returns a new Log. Doesn't modify the original Log.
   * @memberof Log
   * @static
   * @param {IPFS} ipfs An IPFS instance
   * @param {Log} log - The Log to add the entry to
   * @param {string|Buffer|Object|Array} data - Data of the entry to be added
   * @returns {Log}
   */
  static append(ipfs, log, data) {
    if (!ipfs) throw new Error("Ipfs instance not defined")
    if (!log) throw new Error("Log instance not defined")
    // Create the entry
    return Entry.create(ipfs, log.id, data, log.heads)
      .then((entry) => {
        // Add the entry to the previous log entries
        const items = log.items.slice().concat([entry])
        // Set the heads of this log to the latest entry
        const heads = [entry.hash]
        // Create a new log instance
        return new Log(ipfs, log.id, {
          items: items,
          heads: heads,
        })
      })
  }

  /**
   * Join two logs
   * 
   * @description Joins two logs returning a new log. Doesn't change the original logs.
   *
   * @param {IPFS} [ipfs] An IPFS instance
   * @param {Log} a
   * @param {Log} b
   *
   * @example
   * const log = Log.join(ipfs, log1, log2)
   * 
   * @returns {Log}
   */
  static join(ipfs, a, b, size) {
    // const st = new Date().getTime()
    if (!ipfs) throw new Error("Ipfs instance not defined")
    if (!a || !b) throw new Error("Log instance not defined")
    if (!a.items || !b.items) throw new Error("Log to join must be an instance of Log")

    // If size is not specified, join all entries by default
    size = size ? size : a.items.length + b.items.length

    // Get the heads from both logs and sort them by their IDs
    const headsA = a._heads.map((e) => a.get(e)).filter((e) => e !== undefined).slice()
    const headsB = b._heads.map((e) => b.get(e)).filter((e) => e !== undefined).slice()
    const heads = headsA.concat(headsB)
      .filter((e) => e !== undefined)
      .sort((a, b) => a.id > b.id)
      .map((e) => e.hash)

    // Sort which log should come first based on heads' IDs
    const aa = headsA[0] ? headsA[0].id : null
    const bb = headsB[0] ? headsB[0].id : null
    const isFirst = aa > bb
    const log1 = isFirst ? a : b
    const log2 = isFirst ? b : a

    // Cap the size of the entries
    const newEntries = take(log2.items.slice().reverse(), size)
    const oldEntries = take(log1.items.slice(), size)

    // Create a new log instance
    let result = LogUtils.create(ipfs, log1.id, oldEntries, heads)

    // Insert each entry into the log
    newEntries.forEach((e) => LogUtils._insert(ipfs, result, e))

    // const et = new Date().getTime()
    // console.log("join() took " + (et - st) + "ms", diff.length, result.items.length)
    return result
  }

  /**
   * Join multiple logs
   * @param {IPFS} [ipfs] An IPFS instance
   * @param {Array<Log>} logs
   * @returns {Log}
   */
  static joinAll(ipfs, logs) {
    return logs.reduce((log, val, i) => {
      if (!log) return val
      return LogUtils.join(ipfs, log, val)
    }, null)
  }

  /**
   * Expand the size of the log
   * @param {IPFS} [ipfs] An IPFS instance
   * @param {Log} log
   * @param {Number} length
   * @param {function(hash, entry, parent, depth)} onProgressCallback
   * @returns {Promise<Log>}
   */
  static expand(ipfs, log, length = -1, onProgressCallback) {
    // TODO: Find tails (entries that point to an entry that is not in the log)
    const tails = log.items.slice()[0].next.sort((a, b) => a > b)
    // Fetch a log starting from each tail entry
    const getLog = tails.map((f) => LogUtils.fromEntry(ipfs, log.id, f, length, onProgressCallback))
    // Join all logs together to one log
    const joinAll = (logs) => LogUtils.joinAll(ipfs, logs.concat([log]))
    // Create all logs and join them
    return Promise.all(getLog).then(joinAll)
  }

  /**
   * Insert an entry to the log
   * @private
   * @param {Entry} entry Entry to be inserted
   * @returns {Entry}
   */
  static _insert(ipfs, log, entry) {
    const hashes = log.items.map((f) => f.hash)
    // If entry is already in the log, don't insert
    if(hashes.includes(entry.hash)) return entry
    // Find the item's parents' indices
    let indices = entry.next.map((next) => hashes.indexOf(next))
    // Find the largest index (latest parent)
    const index = indices.length > 0 ? Math.max(Math.max.apply(null, indices) + 1, 0) : 0
    // Insert
    log._items.splice(index, 0, entry)
    return entry
  }

  /**
   * Fetch log entries recursively
   * @private
   * @param {IPFS} [ipfs] An IPFS instance
   * @param {string} [hash] Multihash of the entry to fetch
   * @param {string} [parent] Parent of the node to be fetched
   * @param {Object} [all] Entries to skip
   * @param {Number} [amount=-1] How many entries to fetch.
   * @param {Number} [depth=0] Current depth of the recursion
   * @param {function(hash, entry, parent, depth)} onProgressCallback
   * @returns {Promise<Array<Entry>>}
   */
  static _fetchRecursive(ipfs, hash, all = {}, amount = -1, depth = 0, parent = null, onProgressCallback = () => {}) {
    // console.log("GET", hash)
    let result = []
    // If the given hash is in the given log (all) 
    // or if we're at maximum depth, return
    if (all[hash] || (depth >= amount && amount > 0)) {
      return Promise.resolve(result)
    }
    // Create the entry and add it to the result
    return Entry.fromIpfsHash(ipfs, hash)
      .then((entry) => {
        result.push(entry)
        all[hash] = entry
        onProgressCallback(hash, entry, parent, depth)
        depth ++
        const fetch = (hash) => LogUtils._fetchRecursive(ipfs, hash, all, amount, depth, entry, onProgressCallback)
        return Promise.mapSeries(entry.next, fetch, { concurrency: 1 })
          .then((res) => res.concat(result))
          .then((res) => res.reduce((a, b) => a.concat(b), [])) // flatten the array
      })
  }

  /**
   * Find heads of a log
   * @private
   * @param {Log} log
   * @returns {Array<Entry>}
   */
  static _findHeads(log) {
    return log.items.slice()
      .reverse()
      .filter((f) => !LogUtils._isReferencedInChain(log, f))
      .map((f) => f.hash)
      .sort((a, b) => a > b)
  }

  /**
   * Check if an entry is referenced by another entry in the log
   * @private
   * @param {log} [log] Log to search an entry from
   * @param {Entry} [entry] Entry to search for
   * @returns {boolean}
   */
  static _isReferencedInChain(log, entry) {
    return log.items.slice().reverse().find((e) => Entry.hasChild(e, entry)) !== undefined
  }

  /**
   * Find entry's parents
   * @private
   * @description Returns entry's parents as an Array up to the root entry
   * @param {Log} [log] Log to search parents from
   * @param {Entry} [entry] Entry for which to find the parents
   * @returns {Array<Entry>}
   */
  static _findParents(log, entry) {
    let stack = []
    let parent = log.items.find((e) => Entry.hasChild(e, entry))
    let prev = entry
    while (parent) {
      stack.push(parent)
      prev = parent
      parent = log.items.find((e) => Entry.hasChild(e, prev))
    }
    return stack
  }
}

module.exports = LogUtils
