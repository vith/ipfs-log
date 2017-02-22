'use strict'

const IpfsNotDefinedError = new Error('Ipfs instance not defined')

class Entry {
  /**
   * Create an Entry
   * @param {IPFS} ipfs - An IPFS instance
   * @param {string|Buffer|Object|Array} data - Data of the entry to be added. Can be any JSON.stringifyable data.
   * @param {Array<Entry|string>} [next=[]] Parents of the entry
   * @example
   * const entry = await Entry.create(ipfs, 'hello')
   * console.log(entry)
   * // { hash: "Qm...Foo", payload: "hello", next: [] }
   * @returns {Promise<Entry>}
   */
  static create (ipfs, id, seq, data, next = []) {
    const isDefined = (arg) => arg !== undefined && arg !== null

    if (!isDefined(ipfs)) throw IpfsNotDefinedError
    if (!isDefined(id)) throw new Error('Entry requires an id')
    if (!isDefined(seq)) throw new Error('Entry requires a sequence number')
    if (!isDefined(data)) throw new Error('Entry requires data')
    if (!isDefined(next) || !Array.isArray(next)) throw new Error("'next' argument is not an array")

    // Clean the next objects and convert to hashes
    let nexts = next.filter((e) => e !== undefined && e !== null)
      .map((e) => e.hash ? e.hash : e)

    let entry = {
      hash: null, // "Qm...Foo", we'll set the hash after persisting the entry
      id: id, // For determining a unique chain
      seq: seq, // Sequence in this chain, for sorting
      payload: data, // Can be any JSON.stringifyable data
      next: nexts // Array of Multihashes
    }

    return Entry.toMultihash(ipfs, entry)
      .then((hash) => {
        entry.hash = hash
        return entry
      })
  }

  /**
   * Get the multihash of an Entry
   * @param {IPFS} [ipfs] An IPFS instance
   * @param {Entry} [entry] Entry to get a multihash for
   * @example
   * const hash = await Entry.toMultihash(ipfs, entry)
   * console.log(hash)
   * // "Qm...Foo"
   * @returns {Promise<string>}
   */
  static toMultihash (ipfs, entry) {
    if (!ipfs) throw IpfsNotDefinedError
    const data = new Buffer(JSON.stringify(entry))
    return ipfs.object.put(data)
      .then((res) => res.toJSON().multihash)
  }

  /**
   * Create an Entry from a multihash
   * @param {IPFS} [ipfs] An IPFS instance
   * @param {string} [hash] Multihash as Base58 encoded string to create an Entry from
   * @example
   * const hash = await Entry.fromMultihash(ipfs, "Qm...Foo")
   * console.log(hash)
   * // { hash: "Qm...Foo", payload: "hello", next: [] }
   * @returns {Promise<Entry>}
   */
  static fromMultihash (ipfs, hash) {
    if (!ipfs) throw IpfsNotDefinedError
    if (!hash) throw new Error(`Invalid hash: ${hash}`)
    return ipfs.object.get(hash, { enc: 'base58' })
      .then((obj) => JSON.parse(obj.toJSON().data))
      .then((data) => {
        const entry = {
          hash: hash,
          id: data.id,
          seq: data.seq,
          payload: data.payload,
          next: data.next
        }
        return entry
      })
  }

  /**
   * Check if an entry has another entry as its child
   * @param {Entry} [entry1] Entry to check
   * @param {Entry} [entry2] Child
   * @returns {boolean}
   */
  static hasChild (entry1, entry2) {
    return entry1.next.indexOf(entry2.hash) > -1
  }

  static hasParent (entry1, entry2) {
    return Entry.hasChild(entry1, entry2)
  }

  /**
   * Check if an object is an Entry
   * @param {Entry} obj
   * @returns {boolean}
   */
  static isEntry (obj) {
    return obj.id !== undefined &&
      obj.seq !== undefined &&
      obj.next !== undefined &&
      obj.hash !== undefined &&
      obj.payload !== undefined
  }

  /**
   * Check if an entry equals another entry
   * @param {Entry} a
   * @param {Entry} b
   * @returns {boolean}
   */
  static isEqual (a, b) {
    return a.hash === b.hash
  }

  /**
   * Find entry's parents from an Array of entries
   * @private
   * @description Returns entry's parents as an Array up to the root entry
   * @param {Log} [log] Log to search parents from
   * @param {Entry} [entry] Entry for which to find the parents
   * @returns {Array<Entry>}
   */
  // TODO: this should be findSiblings
  static findParents (entry, entries) {
    let stack = []
    let parent = entries.find((e) => Entry.hasChild(e, entry))
    let prev = entry
    while (parent) {
      stack.push(parent)
      prev = parent
      parent = entries.find((e) => Entry.hasChild(e, prev))
    }
    stack = stack.sort((a, b) => a.seq > b.seq)
    return stack
  }

  static findSiblings (entry, entries) {
    const siblings = entries.map(e => Entry.hasParent(e, entry) ? e : null)
      .filter(e => e !== undefined && e !== null)
      .sort((a, b) => a.id < b.id)
      .sort((a, b) => a.seq < b.seq)
    return siblings
  }

  static findNextSibling (entry, entries) {
    const siblings = entries.map(e => Entry.hasParent(e, entry) ? e : null)
      .filter(e => e !== undefined && e !== null)
      .sort((a, b) => a.seq > b.seq)
    return siblings[0]
  }
}

module.exports = Entry
