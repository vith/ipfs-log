'use strict'

const Entry = require('./entry')
const EntryCollection = require('./entry-collection')
const whilst = require('p-whilst')

const IpfsNotDefinedError = () => new Error('Ipfs instance not defined')
const LogNotDefinedError = () => new Error('Log instance not defined')

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
 *   const log1 = Log.create('A')
 *   const log2 = Log.create('B')
 *   const log3 = await Log.append(ipfs, log1, 'hello')
 *   const log4 = await Log.append(ipfs, log2, { two: 'hi' })
 *   const out = Log.join(log3, log4).map((e) => e.payload)
 *   console.log(out)
 *   // ['hello', '{ two: 'hi' }']
 * })
 */
class Log {
  constructor (id, entries, heads) {
    this._id = id || new Date().getTime()
    this._entries = entries || []
    this._heads = heads || []
  }

  get id () {
    return this._id
  }

  /**
   * Returns the items in the log
   * @returns {Array<Entry>}
   */
  get items () {
    return this._entries.slice()
  }

  /**
   * Returns an array of heads as multihashes
   * @returns {Array<string>}
   */
  get heads () {
    return this._heads.slice()
  }

  /**
   * Find an entry
   * @param {string} [hash] The Multihash of the entry as Base58 encoded string
   * @returns {Entry|undefined}
   */
  get (hash) {
    return this.items.find((e) => e.hash === hash) || null
  }

  /**
   * Returns the log entries as a formatted string
   * @example
   * two
   * └─one
   *   └─three
   * @returns {string}
   */
  toString () {
    return this.items
      .slice()
      .reverse()
      .map((e, idx) => {
        const parents = Entry.findParents(e, this.items)
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
  toJSON () {
    return { id: this.id, heads: this.heads }
  }

  /**
   * Get the log as a Buffer
   * @returns {Buffer}
   */
  toBuffer () {
    return new Buffer(JSON.stringify(this.toJSON()))
  }
}

class LogUtils {
  /**
   * Create a new log
   * @param {string} [id] Unique ID for the log
   * @param {Array} [entries] - Entries for this log
   * @param {Array} [heads] - Heads for this log
   * @returns {Log}
   */
  static create (id, entries, heads) {
    if (entries !== undefined && !Array.isArray(entries)) throw new Error('entries argument must be an array')
    if (heads !== undefined && !Array.isArray(heads)) throw new Error('heads argument must be an array')

    // If entries were given but not the heads, find them
    if (Array.isArray(entries) && !heads) {
      heads = EntryCollection.findHeads(entries).map((e) => e.hash)
    }

    return new Log(id, entries, heads)
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
  static append (ipfs, log, data) {
    if (!ipfs) throw IpfsNotDefinedError()
    if (!log) throw LogNotDefinedError()
    if (!log.heads || !log.id || !log.items) throw new Error('Not a Log instance')

    // Create the entry
    const seq = EntryCollection.getLatestSeqNumber(log.items) + 1
    return Entry.create(ipfs, log.id, seq, data, log.heads)
      .then((entry) => {
        // Add the entry to the previous log entries
        const items = log.items.concat([entry])
        // Set the heads of this log to the latest entry
        const heads = [entry.hash]
        // Create a new log instance
        return LogUtils.create(log.id, items, heads)
      })
  }

  /**
   * Join two logs
   *
   * @description Joins two logs returning a new log. Doesn't mutate the original logs.
   *
   * @param {IPFS} [ipfs] An IPFS instance
   * @param {Log} a First log to join
   * @param {Log} b Second log to join
   * @param {Number} [size] Max size of the joined log
   * @param {string} [id] ID to use for the new log
   *
   * @example
   * const log = Log.join(log1, log2)
   *
   * @returns {Log}
   */
  static join (a, b, size, id) {
    if (!a || !b) throw LogNotDefinedError()
    if (!a.items || !b.items) throw new Error('Log to join must be an instance of Log')

    // If size is not specified, join all entries by default
    size = size && size > -1 ? size : a.items.length + b.items.length

    const sortedById = [a, b].sort((a, b) => a.id > b.id)

    // If id was not provided, use the id of the first head entry
    id = id || sortedById[0].id

    // Combine the entries from the two logs, take only unique entries
    // and sort the entries by sequence and id
    let entries = sortedById[0].items.concat(sortedById[1].items)
      .reduce((res, e) => {
        if (res.findIndex(a => a.hash === e.hash) === -1) {
          res.push(e)
        }
        return res
      }, [])
      .sort((a, b) => a.seq < b.seq && a.id <= b.id)

    // Sort the entries
    const sorted = EntryCollection.sort(entries)
    // Create a new log, cap the size at given length
    const log = LogUtils.create(id, sorted.slice(-size))
    return log
  }

  /**
   * Join multiple logs
   * @param {Array<Log>} logs Logs to join together
   * @param {Number} length Maximum lenght of the log after join
   * @returns {Log}
   */
  static joinAll (logs, length) {
    return logs.reduce((log, val, i) => {
      if (!log) return val
      return LogUtils.join(log, val, length)
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
  static expand (ipfs, log, length = -1, onProgressCallback) {
    if (!ipfs) throw IpfsNotDefinedError()
    if (!log) throw LogNotDefinedError()

    const tails = EntryCollection.findTailHashes(log.items)

    if (tails.length === 0) {
      return Promise.resolve(LogUtils.create(log.id, log.items, log.heads))
    }

    // Fetch entries starting from all tail entries
    // return LogUtils.fetchAll(ipfs, tails[0], Math.max(length, -1), log.items)
    const prevLength = log.items.length
    return LogUtils.fetchAll(ipfs, tails, Math.max(length * tails.length, -1), log.items)
      .then((entries) => {
        let sorted = EntryCollection.sort(log.items.concat(entries))
        const finalArr = length > -1 
          ? sorted.slice(-(prevLength + length))
          : sorted
        const result = LogUtils.create(log.id, finalArr)
        return result
      })
  }

  /**
   * Create a new log starting from an entry
   * @param {IPFS} ipfs An IPFS instance
   * @param {Array<Entry>} entries An entry or an array of entries to fetch a log from
   * @param {Number} [length=-1] How many entries to include. Default: infinite.
   * @param {Array<Entry|string>} [exclude] Entries to not fetch (cached)
   * @param {function(hash, entry, parent, depth)} [onProgressCallback]
   * @returns {Promise<Log>}
   */
  static fromEntry (ipfs, entries, length = -1, exclude, onProgressCallback) {
    if (!ipfs) throw IpfsNotDefinedError()

    if (entries && !Array.isArray(entries)) {
      entries = [entries]
    }

    // Make sure we only have Entry objects as input
    entries.forEach((e) => {
      if (!Entry.isEntry(e)) throw new Error('\'entries\' need to be an array of Entry instances')
    })

    // Make sure we pass hashes instead of objects to the fetcher function
    exclude = exclude ? exclude.map((e) => e.hash ? e.hash : e) : exclude

    // Fetch given length
    const amount = length - entries.length
    const hashes = entries.map((e) => e.hash)
    const nexts = entries.reduce((res, e) => {
      e.next.forEach((n) => res.push(n))
      return res
    }, [])

    return LogUtils.fetchAll(ipfs, nexts, amount, exclude)
      .then((items) => {
        const all = items.concat(entries)
        const sorted = EntryCollection.sort(all)
        const entry = all.find((e) => hashes.includes(e.hash))
        const log = LogUtils.create(entry.id, sorted)
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
  static fromMultihash (ipfs, hash, length = -1, exclude, onProgressCallback) {
    if (!ipfs) throw IpfsNotDefinedError()
    if (!hash) throw new Error('Invalid hash: ' + hash)

    return ipfs.object.get(hash, { enc: 'base58' })
      .then((dagNode) => JSON.parse(dagNode.toJSON().data))
      .then((logData) => {
        if (!logData.heads || !logData.id) throw new Error('Not a Log instance')
        return LogUtils.fetchAll(ipfs, logData.heads, length, exclude)
          .then((entries) => {
            const sorted = EntryCollection.sort(entries)
            const log = LogUtils.create(logData.id, sorted, logData.heads)
            return log
          })
      })
  }

  /**
   * Get the log's multihash
   * @param {IPFS} ipfs An IPFS instance
   * @param {Log} log Log to persist
   * @returns {Promise<string>}
   */
  static toMultihash (ipfs, log) {
    if (!ipfs) throw IpfsNotDefinedError()
    if (!log) throw LogNotDefinedError()
    if (!log.items || log.items.length < 1) throw new Error(`Can't serialize an empty log`)
    if (!log.heads || log.heads.length < 1) throw new Error(`Can't serialize a log without heads`)

    return ipfs.object.put(log.toBuffer())
      .then((dagNode) => dagNode.toJSON().multihash)
  }

  /**
   * @todo : Not correct atm. Need to update.
   * Fetch log entries sequentially
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
  static fetchAll (ipfs, hashes, amount, exclude = [], timeout = 30000) {
    let result = []
    let cache = {}
    let loadingQueue = Array.isArray(hashes) 
      ? hashes.slice() 
      : [hashes]

    // Add entries that we don't need to fetch to the "cache"
    exclude.forEach((e) => {
      cache[e.hash] = e
    })

    const shouldFetchMore = () => {
      return loadingQueue.length > 0 &&
        (result.length < amount || amount < 0)
    }

    const fetchEntry = () => {
      const hash = loadingQueue.shift()

      if (cache[hash]) {
        return Promise.resolve(result)
      }

      return new Promise((resolve, reject) => {
        // Resolve the promise after a timeout in order to
        // not get stuck loading a block that is unreachable
        setTimeout(() => resolve(result), timeout)

        // Load the entry
        Entry.fromMultihash(ipfs, hash)
          .then((entry) => {
            entry.next.forEach((f) => loadingQueue.push(f))
            result.push(entry)
            cache[hash] = entry
            resolve(result)
          })
      })
    }

    return whilst(shouldFetchMore, fetchEntry)
      .then(() => result)
  }
}

module.exports = LogUtils
