'use strict'

const Entry = require('./entry')
const sortBy = require('lodash.sortby')

class EntryCollection {
  static getLatestSeqNumber (entries) {
    return entries.reduce((res, entry) => {
      if (entry.seq > res) res = entry.seq
      return res
    }, -1)
  }

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
    // console.log("-- sort --")
    var result = []
    var tails = []
    var cache = {} // result cache for quick lookups

    // Create a sorting index (Entry1 and Entry2 have the same id)
    // {
    //   '<Entry1.hash>': <Entry1>,
    //   '<Entry2.hash>': <Entry2>,
    //   ...
    //   '<Entry1.id>': {
    //     '<Entry1.seq1>': '<Entry1.seq1>',
    //     '<Entry2.seq2>': '<Entry2.seq2>',
    //   },
    // }
    var index = {}
    const addToIndex = (entry) => {
      index[entry.hash] = entry
      if (!index[entry.id2]) index[entry.id2] = {}
      index[entry.id2][entry.seq] = entry.hash
    }
    const removeFromIndex = (entry) => {
      delete index[entry.hash]
      delete index[entry.id2][entry.seq]
    }

    // Helper functions
    var isInTails = (e, idx, arr) => tails.findIndex(a => Entry.isEqual(a, e)) === -1
    var hasBeenProcessed = (entry) => cache[entry.hash] !== undefined
    var hasOlderSiblingInQueue = (entry) => {
      // Find all entries that have the same id (ie. in the same chain)
      // TODO: index these somehow so that we don't need to 
      // re-create the array here on every cycle
      return Object.keys(index[entry.id2])
        .sort((a, b) => a > b)
        .findIndex(seq => entry.seq > seq)
    }

    var isInIndex = (e, idx, arr) => index[e] !== undefined
    var hasParentsInQueue = (entry) => {
      return entry.next.findIndex(isInIndex)
    }

    // Create our sorting index
    const processEntry = (e, idx, arr) => {
      e.id2 = e.id
      addToIndex(e)
    }
    entries.forEach(processEntry)

    // Get tails (entries that point entries not in the input array)
    tails = EntryCollection.findTails(entries, true)
      .sort((a, b) => index[a.hash].id > index[b.hash].id)
      .sort((a, b) => index[a.hash].seq > index[b.hash].seq)
    // console.log("TAILS", tails, tails.map(e => e.payload))
    var withoutTails = entries.filter(isInTails)
      .sort((a, b) => a.seq > b.seq)
    // Enqueue tails first, then rest of the entries
    var queue = tails//.concat(withoutTails)
    // console.log("QUEUE")
    // console.log(queue.map(e => e.payload))

    // tails.forEach(processEntry)

    while (queue.length > 0) {
      var entry = queue.shift() // dequeue
      if (!hasBeenProcessed(entry)) {
        if (hasParentsInQueue(entry) !== -1) {
          const abc = entry.next.map(e => index[e]).filter(e => e !== undefined)
          // console.log(">>>>", entry.payload, abc)
          const parentIdx = Math.max.apply(null, abc.map(a => queue.findIndex(e => a.hash === e.hash)).concat([-1]))
          // If entry's parent(s) is coming later in the queue,
          // queue the entry AFTER the parent
          if (parentIdx > -1) {
            queue.splice(parentIdx + 1, 0, entry)
            addToIndex(entry)
          } else {
            abc.forEach(e => {
              // console.log("       |--", e.payload, e.seq, e.id)
              queue.push(e)
              addToIndex(e)
            })
          }
          // console.log("Pushed to queue:", entry.payload, entry.id, parentIdx)
          // console.log("QUEUE")
          // console.log(queue.map(e => e.payload))
        } else if (hasOlderSiblingInQueue(entry) !== -1) {
          // console.log("had siblings", entry.payload)
          const idx = hasOlderSiblingInQueue(entry)
          const abc = Object.keys(index[entry.id2])
            .sort((a, b) => a > b)
            .map(a => index[entry.id2][a])
            // console.log("ABC", abc[idx], index[abc[idx]])
          const olderSiblingIdx = queue.findIndex(e => abc[idx] === e.hash)
          // If entry's parent(s) is coming later in the queue,
          // queue the entry AFTER the parent
          queue.push(entry) // enqueue
          addToIndex(entry)
          const next = Entry.findNextSibling(entry, entries)
    // console.log("QUEUE")
    // console.log(queue.map(e => e.payload))
        } else if (!cache[entry.hash]) {
          // If no parent(s) found, we have the tail of this chain,
          // add it to the results
          result.push(entry)
          cache[entry.hash] = true
          removeFromIndex(entry)
          // console.log("Added:", entry.payload)
          Entry.findSiblings(entry, entries)
            .sort((a, b) => a.id < b.id)
            .forEach(e => {
              // console.log("       |--", e.payload, e.seq, e.id)
              queue.push(e)
              addToIndex(e)
            })
        }
      }
    }
    // console.log("RESULT:")
    // console.log(result.map(e => e.payload))
    return result
  }

  /**
   * Findheads from a collection of entries
   * @private
   * @param {Array<Entry>} Entries to search heads from
   * @returns {Array<Entry>}
   */
  static findHeads (entries) {
    var items = entries.reduce((res, entry, idx) => {
      entry.next.forEach((h) => res[h] = entry.hash)
      return res
    }, {})

    return entries
      .filter((f) => items[f.hash] === undefined)
      .sort((a, b) => a.id > b.id)
  }

  static findTailHashes (entries) {
    let hashes = {}
    let nexts = []
    entries.forEach((e) => {
      // Get all next references
      nexts = e.next.concat(nexts)
      // Get the hashes of input entries
      hashes[e.hash] = true
    })

    // Drop hashes that are not in the input entries
    return nexts.filter((e) => hashes[e] === undefined)
      .reduce((res, val) => {
        // Uniques
        if (!res.includes(val))
          res.push(val)
        return res
      }, [])
  }

  // Find entries that point to another entry that is not in the
  // input array
  static findTails (entries) {
    // Reverse index { next -> entry }
    let reverseIndex = {}
    let hashes = {}
    let nexts = []
    entries.forEach((e) => {
      e.next.forEach(a => {
        if (!reverseIndex[a]) reverseIndex[a] = []
        reverseIndex[a].push(e)
      })
      // Get all next references
      nexts = nexts.concat(e.next)
      // Get the hashes of input entries
      hashes[e.hash] = true
    })

    // Drop hashes that are not in the input entries
    return nexts.filter((e) => hashes[e] === undefined)
      .reduce((res, val) => {
        // Get all entries that point to this entry fro the reverse index
        const entries = reverseIndex[val]
        // Add each unique entry to the result
        entries.forEach(e => {
          // Uniques
          if (res.findIndex(a => a.hash === e.hash) === -1)
            res.push(e)
        })
        return res
      }, [])
      .concat(entries.filter((e) => e.next.length === 0))
  }
}

module.exports = EntryCollection
