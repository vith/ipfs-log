'use strict'

const Promise = require('bluebird')
const Entry = require('./entry')
const flatten = require('lodash.flatten')

const MaxHistory   = 256 // How many items to fetch on join

class Log {
  constructor(ipfs, id, opts) {
    this.id = id
    this._ipfs = ipfs // TODO: change to immutabledb
    this._items = opts && opts.items ? opts.items : []

    this.options = { maxHistory: MaxHistory }
    Object.assign(this.options, opts)
    delete this.options.items

    this._next = {}
    this._prev = {}
    this._heads = [null]
    this.entries = {}
  }

  add(data) {
    return Entry.create(this._ipfs, data, this._heads)
      .then((entry) => {
        // Update "index"
        entry.next.forEach((hash) => {
          if (!this._next[hash])
            this._next[hash] = []
          this._next[hash].push(entry)

          if (!this._prev[entry.hash])
            this._prev[entry.hash] = []
          this._prev[entry.hash].push(hash)
        })

        // Update heads
        this._heads = [entry.hash]
        this.entries[entry.hash] = entry

        return entry
      })    
  }

  get all() {
    return flatten(Object.keys(this._next).map((e) => this._next[e]))
  }

  contains(hash) {
    return this.all.map((e) => e.hash).includes(hash)
  }

  join(other) {
    console.log("join " + this.id + " with " + other.id)
    let st = new Date().getTime()
    let newHeads = []

    console.log(this.all.length)
    console.log("----------------------------", other.id)
    console.log(Object.keys(other._next))

    const others = flatten(Object.keys(other._next)
      .map((e) => other._next[e]))

    const newEntries = others
      .filter((e) => e && !this.contains(e.hash))
      .reduce((handled, item) => {
        if (!handled.map((e) => e.hash).includes(item.hash))
          handled.push(item)
        return handled
      }, [])

    let mt = new Date().getTime()
    console.log("Join part 1 took", (mt - st) + "ms")

    return Promise.map(newEntries, (e) => Entry.fromIpfsHash(this._ipfs, e.hash))
      .then((entries) => {
        let st2 = new Date().getTime()
        entries.forEach((entry) => {
          this.entries[entry.hash] = entry

          this._heads.forEach((h) => {
            if (other._heads.includes(h)
              && !newHeads.includes(h)) {
              newHeads.push(h)
              return
            }

            if (!other.contains(h)
              && !newHeads.includes(h)) {
              newHeads.push(h)
              return              
            }
          })

          other._heads.forEach((h) => {
            if (this._heads.includes(h))
              return

            if (!this.contains(h)) {
              newHeads.push(h)
              return              
            }
          })

          // Re-calculate index
          entry.next.forEach((hash) => {
            if (!this._next[hash])
              this._next[hash] = []
            this._next[hash].push(entry)

            if (!this._prev[entry.hash])
              this._prev[entry.hash] = []
            this._prev[entry.hash].push(hash)
          })

          this._heads = newHeads
        })
        let et = new Date().getTime()
        console.log("Join took", (et - st2) + "ms")
      })
  }

  get items() {
    let st = new Date().getTime()

    let out = []
    let addedPrevs = {}
    let stack = []

    const all = flatten(Object.keys(this._next)
      .map((e) => this._next[e]))

    const nulls = this._next[null]
      .sort((a, b) => a.hash > b.hash)

    const rest = Object.keys(this._next)
      .filter((e) => e !== "null") // lol, need to convert to string!
      .map((e) => this._next[e])

    stack = [].concat(rest).concat(nulls)

    while(stack.length > 0) {
      let entry = stack.pop()
      let hash = entry.hash

      if(hash) {
        out.push(entry)

        // mark that an Entry was added in all next hashes
        Object.keys(this._next).filter((e) => e === hash)
          .map((e) => this._next[e])
          .forEach((e) => {
            e.forEach((e) => {
              if (!addedPrevs[e.hash])
                addedPrevs[e.hash] = 0
              addedPrevs[e.hash] += 1
            })
          })

        // push next hashes, but only if all past hashes have been added
        Object.keys(this._next).filter((e) => e === hash)
          .map((e) => this._next[e])
          .forEach((e) => {
            e.sort((a, b) => a.hash > b.hash)
              .forEach((e) => {
                if (addedPrevs[e.hash] === this._prev[e.hash].length) {
                  stack.push(e)
                }                
              })
          })          
      }
    }

    let et = new Date().getTime()
    console.log("get Items took", (et - st) + "ms")

    return out
  }

}

module.exports = Log
