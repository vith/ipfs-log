'use strict'

const Entry = require('./entry')

class EntryCollection {
  /**
   * Sort entries
   *
   * @description
   * Sorts an array of Entry objects according to their partial
   * order in the merkle chain. This is, a linked list
   * 1 <-- 2 <-- 3, given as randomly ordered array [3, 1, 2],
   * the enrties will be sorted to [1, 2, 3]
   *
   * @param {Array<Entry>} entries Entries to sort
   * @returns {Array<Entry>}
   */
  static sort (entries) {
    // NOTE: using vars here instead of const and let due to how
    // V8 optimizes ES5 vs. ES6 code. In short, in this case vars
    // produce better performance throughput than let/const.
    var result = []
    var processed = []
    var cache = {}
    var stack = EntryCollection.findHeads(entries)
      .map((e) => entries.find((a) => a.hash === e))
      .sort((a, b) => a.id > b.id)

    var getMaxChildIndex = (res, entry, idx, arr) => {
      entry.next.forEach((h) => {
        res[h] = res[h] === undefined ? idx : res[h]
      })
      return res
    }

    while (stack.length > 0) {
      var e = stack.shift()

      if (!cache[e.hash]) {
        cache[e.hash] = e

        var parentIndices = e.next.map((next) => processed.indexOf(next))
        var childIndices = result.reduce(getMaxChildIndex, {})
        var maxParentIndex = parentIndices.reduce((acc, val) => acc > val ? acc : val, -1)
        var maxChildIndex = childIndices[e.hash] !== undefined ? childIndices[e.hash] : -1
        var maxIndex = 0

        if (maxChildIndex > -1) {
          maxIndex = Math.max(maxChildIndex, 0)
        }

        if (maxParentIndex > -1) {
          maxIndex = maxParentIndex + 1
        }

        if (maxParentIndex !== -1 && maxParentIndex < maxChildIndex) {
          maxIndex = maxChildIndex
        }

        result.splice(maxIndex, 0, e)
        processed.splice(maxIndex, 0, e.hash)

        var nexts = e.next
          .map((f) => entries.find((c) => c.hash === f))
          .filter((f) => f !== undefined)
          .sort((a, b) => a.id > b.id)

        nexts.forEach((f, i) => {
          var nextIdx = stack.map(e => e.hash).indexOf(f.hash)
          if (nextIdx > -1) stack.splice(nextIdx, 1)
          stack.unshift(f)
        })
      }
    }

    return result
  }

  /**
   * Find heads from a collection of entries
   * @private
   * @param {Array<Entry>} Entries to search heads from
   * @returns {Array<Entry>}
   */
  static findHeads (entries) {
    return entries.slice()
      .reverse()
      .filter((f) => !EntryCollection._isReferencedInChain(entries, f))
      .map((f) => f.hash)
      .sort((a, b) => a < b)
  }

  /**
   * Check if an entry is referenced by another entry in the log
   * @private
   * @param {log} [log] Log to search an entry from
   * @param {Entry} [entry] Entry to search for
   * @returns {boolean}
   */
  static _isReferencedInChain (entries, entry) {
    return entries.slice().reverse().find((e) => Entry.hasChild(e, entry)) !== undefined
  }
}

module.exports = EntryCollection
