'use strict'

class Entry {
  /**
   * Create an Entry
   * @param {IPFS} ipfs - An IPFS instance
   * @param {string|Buffer|Object|Array} data - Data of the entry to be added
   * @param {Array<Entry>} [next=[]] Parents of the entry
   * @example
   * const entry = await Entry.create(ipfs, 'hello')
   * console.log(entry)
   * // { hash: "Qm...Foo", payload: "hello", next: [] }
   * @returns {Promise<Entry>}
   */
  static create(ipfs, data = null, next = []) {
    if (!ipfs) throw new Error("Entry requires ipfs instance")

    // convert single objects to an array and entry objects to single hashes
    let nexts = next !== null && Array.isArray(next)
      ? next.filter((e) => e !== undefined).map((e) => e.hash ? e.hash : e) 
      : [(next !== null && next.hash ? next.hash : next)]

    let entry = {
      hash: null, // "Qm...Foo", we'll set the hash after ipfsfying the data structure, 
      payload: data, // Can be any JSON.stringifyable data
      next: nexts // Array of IPFS hashes
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
   * @param {string|Buffer|Object|Array} [data] Data of the entry to be added
   * @param {Array<Entry>} [next=[]] Parents of the entry
   * @example
   * const hash = await Entry.toMultihash(ipfs, entry)
   * console.log(hash)
   * // "Qm...Foo"
   * @returns {Promise<string>}
   */
  static toMultihash(ipfs, entry) {
    if (!ipfs) throw new Error("Entry requires ipfs instance")
    const data = new Buffer(JSON.stringify(entry))
    return ipfs.object.put(data)
      .then((res) => res.toJSON().multihash)
  }

  /**
   * Create an Entry from a multihash
   * @param {IPFS} [ipfs] An IPFS instance
   * @param {string} [hash] Multihash to create an Entry from
   * @example
   * const hash = await Entry.fromMultihash(ipfs, "Qm...Foo")
   * console.log(hash)
   * // { hash: "Qm...Foo", payload: "hello", next: [] }
   * @returns {Promise<Entry>}
   */
  static fromMultihash(ipfs, hash) {
    if (!ipfs) throw new Error("Entry requires ipfs instance")
    if (!hash) throw new Error("Invalid hash: " + hash)
    return ipfs.object.get(hash, { enc: 'base58' })
      .then((obj) => JSON.parse(obj.toJSON().data))
      .then((data) => {
        const entry = {
          hash: hash,
          payload: data.payload,
          next: data.next
        }
        return entry
      })
  }

  /**
   * Check if an entry has another entry as its child
   * @param {Entry} [entry1] Entry to check from
   * @param {Entry} [entry2] Child
   * @returns {boolean}
   */
  static hasChild(entry1, entry2) {
    return entry1.next.includes(entry2.hash)
  }

  /**
   * Check if an entry equals another entry
   * @param {Entry} a
   * @param {Entry} b
   * @returns {boolean}
   */
  static compare(a, b) {
    return a.hash === b.hash
  }

  /**
   * @alias compare
   */
  static isEqual(a, b) {
    return compare(a, b)
  }
}

module.exports = Entry
