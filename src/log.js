'use strict'

const Entry = require('./entry')
const mapSeries = require('./map-series')

const IpfsNotDefinedError = new Error('Ipfs instance not defined')
const LogNotDefinedError = new Error('Log instance not defined')

/** 
 * ipfs-log
 *
 * @example
 * // https://github.com/haadcode/ipfs-log/blob/master/examples/log.js
 * const IPFS = require('ipfs-daemon')
 * const Log  = require('ipfs-log')
 * const ipfs = new IPFS()
 *
 * ipfs.on('ready', () => {
 *   const log1 = Log.create(ipfs, ['one'])
 *   const log2 = Log.create(ipfs, [{ two: 'hello' }, { ok: true }])
 *   const out = Log.join(ipfs, log2, log2)
 *     .collect()
 *     .map((e) => e.payload)
 *     .join('\n')
 *   console.log(out)
 *   // ['one', '{ two: 'hello' }', '{ ok: true }']
 * })
 */
class Log {
  constructor(ipfs, entries, heads) {
    this._entries = entries || []
    this._heads = heads || []
  }

  /**
   * Returns the items in the log
   * @returns {Array<Entry>}
   */
  get items() {
    return this._entries
  }

  /**
   * Returns a list of heads as multihashes
   * @returns {Array<string>}
   */
  get heads() {
    return this._heads
  }

  /**
   * Find an entry
   * @param {string} [hash] The Multihash of the entry as Base58 encoded string
   * @returns {Entry|undefined}
   */
  get(hash) {
    return this.items.find((e) => e.hash === hash)
  }

  /**
   * Returns the log entries as a formatted string
   * @example
   * two
   * └─one
   *   └─three
   * @returns {string}
   */
  toString() {
    return this.items
      .slice()
      .reverse()
      .map((e, idx) => {
        const parents = LogUtils._findParents(this.items, e)
        const len = parents.length
        let padding = new Array(Math.max(len - 1, 0))
        padding = len > 1 ? padding.fill('  ') : padding
        padding = len > 0 ? padding.concat(['└─']) : padding
        return padding.join('') + e.payload
      })
      .join('\n')
  }

  /**
   * Get the log in JSON format
   * @returns {Object<{heads}>}
   */
  toJSON() {
    return { heads: this.heads.slice() }
  }

  /**
   * Get the log as a Buffer
   * @returns {Buffer}
   */
  toBuffer() {
    return new Buffer(JSON.stringify(this.toJSON()))
  }
}

class LogUtils {
  /**
   * Create a new log
   * @param {IPFS} ipfs An IPFS instance
   * @param {Array} [entries] - Entries for this log
   * @param {Array} [heads] - Heads for this log
   * @returns {Log}
   */
  static create(ipfs, entries, heads) {
    if (!ipfs) throw IpfsNotDefinedError

    // If entries were given but not the heads, find them
    if (Array.isArray(entries) && !heads) {
      heads = LogUtils._findHeads(entries)
    }

    return new Log(ipfs, entries, heads)
  }

  /**
   * Create a new log starting from an entry
   * @param {IPFS} ipfs An IPFS instance
   * @param {string} hash Multihash as Base58 encoded string of the entry to start from
   * @param {Number} [length=-1] How many entries to include. Default: infinite.
   * @param {function(hash, entry, parent, depth)} onProgressCallback 
   * @returns {Promise<Log>}
   */
  static fromEntry(ipfs, hash, length = -1, onProgressCallback) {
    if (!ipfs) throw IpfsNotDefinedError

    return LogUtils._fetchRecursive(ipfs, hash, {}, length, 0, null, onProgressCallback)
      .then((items) => {
        let log = LogUtils.create(ipfs)
        items.reverse().forEach((e) => LogUtils._insert(ipfs, log, e))
        log._heads = LogUtils._findHeads(log.items)
        return log
      })
  }

  /**
   * Create a log from multihash
   * @param {IPFS} ipfs - An IPFS instance
   * @param {string} hash - Multihash (as a Base58 encoded string) to create the log from
   * @param {Number} [length=-1] - How many items to include in the log
   * @param {function(hash, entry, parent, depth)} onProgressCallback 
   * @returns {Promise<Log>}
   */
  static fromMultihash(ipfs, hash, length = -1, onProgressCallback) {
    if (!ipfs) throw IpfsNotDefinedError
    if (!hash) throw new Error('Invalid hash: ' + hash)

    return ipfs.object.get(hash, { enc: 'base58' })
      .then((dagNode) => JSON.parse(dagNode.toJSON().data))
      .then((logData) => {
        if (!logData.heads) throw new Error('Not a Log instance')
        // Fetch logs starting from each head entry
        const allLogs = logData.heads
          .sort(LogUtils._compare)
          .map((f) => LogUtils.fromEntry(ipfs, f, length, onProgressCallback))
        // Join all logs together to one log
        const joinAll = (logs) => LogUtils.joinAll(ipfs, logs)
        return Promise.all(allLogs).then(joinAll)
      })
  }

  /**
   * Get the log's multihash
   * @param {IPFS} ipfs An IPFS instance
   * @param {Log} log Log to persist
   * @returns {Promise<string>}
   */
  static toMultihash(ipfs, log) {
    if (!ipfs) throw IpfsNotDefinedError
    if (!log) throw LogNotDefinedError

    if (log.items.length < 1) throw new Error(`Can't serialize an empty log`)
    return ipfs.object.put(log.toBuffer())
      .then((dagNode) => dagNode.toJSON().multihash)
  }

  /**
   * Add an entry to a log
   * @description Adds an entry to the Log and returns a new Log. Doesn't modify the original Log.
   * @memberof Log
   * @static
   * @param {IPFS} ipfs An IPFS instance
   * @param {Log} log - The Log to add the entry to
   * @param {string|Buffer|Object|Array} data - Data of the entry to be added
   *
   * @example
   * const log2 = Log.append(ipfs, log1, 'hello again')
   *
   * @returns {Promise<Log>}
   */
  static append(ipfs, log, data) {
    if (!ipfs) throw IpfsNotDefinedError
    if (!log) throw LogNotDefinedError

    // Create the entry
    return Entry.create(ipfs, data, log.heads)
      .then((entry) => {
        // Add the entry to the previous log entries
        const items = log.items.concat([entry])
        // Set the heads of this log to the latest entry
        const heads = [entry.hash]
        // Create a new log instance
        return new Log(ipfs, items, heads)
      })
  }

  /**
   * Join two logs
   * 
   * @description Joins two logs returning a new log. Doesn't mutate the original logs.
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
    if (!ipfs) throw IpfsNotDefinedError
    if (!a || !b) throw LogNotDefinedError
    if (!a.items || !b.items) throw new Error('Log to join must be an instance of Log')

    // If size is not specified, join all entries by default
    size = size ? size : a.items.length + b.items.length

    // Get the heads from both logs and sort them by their IDs
    const getHeadEntries = (log) => {
      return log.heads
      .map((e) => log.get(e))
      .filter((e) => e !== undefined)
    }

    const headsA = getHeadEntries(a)
    const headsB = getHeadEntries(b)
    const heads = headsA.concat(headsB)
      .map((e) => e.hash)
      .sort()

    // Sort which log should come first based on heads' IDs
    const aa = headsA[0] ? headsA[0].hash : null
    const bb = headsB[0] ? headsB[0].hash : null
    const isFirst = aa < bb
    const log1 = isFirst ? a : b
    const log2 = isFirst ? b : a

    // Cap the size of the entries
    const newEntries = log2.items.slice(0, size)
    const oldEntries = log1.items.slice(0, size)

    // Create a new log instance
    let result = LogUtils.create(ipfs, oldEntries, heads)

    // Insert each entry to the log
    newEntries.forEach((e) => LogUtils._insert(ipfs, result, e))

    return result
  }

  /**
   * Join multiple logs
   * @param {IPFS} [ipfs] An IPFS instance
   * @param {Array<Log>} logs
   * @returns {Log}
   */
  static joinAll(ipfs, logs) {
    if (!ipfs) throw IpfsNotDefinedError

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
    if (!ipfs) throw IpfsNotDefinedError
    if (!log) throw LogNotDefinedError

    // TODO: Find tails (entries that point to an entry that is not in the log)
    const tails = log.items.slice()[0].next.sort(LogUtils._compare)
    // Fetch a log starting from each tail entry
    const getLog = tails.map((f) => LogUtils.fromEntry(ipfs, f, length, onProgressCallback))
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
    if (!ipfs) throw IpfsNotDefinedError
    if (!log) throw LogNotDefinedError

    const hashes = log.items.map((f) => f.hash)
    // If entry is already in the log, don't insert
    if (hashes.includes(entry.hash)) return entry
    // Find the item's parents' indices
    const indices = entry.next.map((next) => hashes.indexOf(next))
    // Find the largest index (latest parent)
    const index = indices.length > 0 ? Math.max(Math.max.apply(null, indices) + 1, 0) : 0
    // Insert
    log.items.splice(index, 0, entry)
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
    if (!ipfs) throw IpfsNotDefinedError

    // If the given hash is already fetched
    // or if we're at maximum depth, return
    if (all[hash] || (depth >= amount && amount > 0)) {
      return Promise.resolve([])
    }
    // Create the entry and add it to the result
    return Entry.fromMultihash(ipfs, hash)
      .then((entry) => {
        all[hash] = entry
        onProgressCallback(hash, entry, parent, depth)
        const fetch = (hash) => LogUtils._fetchRecursive(ipfs, hash, all, amount, depth + 1, entry, onProgressCallback)
        return mapSeries(entry.next, fetch)
          .then((res) => res.concat([entry]))
          .then((res) => res.reduce((a, b) => a.concat(b), [])) // flatten the array
      })
  }

  /**
   * Find heads of a log
   * @private
   * @param {Log} log
   * @returns {Array<Entry>}
   */
  static _findHeads(entries) {
    return entries.slice()
      .reverse()
      .filter((f) => !LogUtils._isReferencedInChain(entries, f))
      .map((f) => f.hash)
      .sort(LogUtils._compare)
  }

  /**
   * Check if an entry is referenced by another entry in the log
   * @private
   * @param {log} [log] Log to search an entry from
   * @param {Entry} [entry] Entry to search for
   * @returns {boolean}
   */
  static _isReferencedInChain(entries, entry) {
    return entries.slice().reverse().find((e) => Entry.hasChild(e, entry)) !== undefined
  }

  /**
   * Find entry's parents
   * @private
   * @description Returns entry's parents as an Array up to the root entry
   * @param {Log} [log] Log to search parents from
   * @param {Entry} [entry] Entry for which to find the parents
   * @returns {Array<Entry>}
   */
  static _findParents(entries, entry) {
    let stack = []
    let parent = entries.find((e) => Entry.hasChild(e, entry))
    let prev = entry
    while (parent) {
      stack.push(parent)
      prev = parent
      parent = entries.find((e) => Entry.hasChild(e, prev))
    }
    return stack
  }

  /**
   * Internal compare function
   * @private
   * @returns {boolean}
   */
  static _compare(a, b) {
    return a < b
  }
}

module.exports = LogUtils
