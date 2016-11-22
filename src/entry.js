'use strict'

const Crypto = require('orbit-crypto')

module.exports = class Entry {
  // Returns a Promise<Entry>
  // Example:
  //   Entry.create(ipfs, "hello")
  //     .then((entry) => console.log(entry)) // { hash: "Qm...Foo", payload: "hello", next: null }  
  static create(ipfs, data, next = []) {
    if (!ipfs) throw new Error("Entry requires ipfs instance")

    // convert single objects to an array and entry objects to single hashes
    let nexts = next !== null && next instanceof Array 
      ? next.map((e) => e.hash ? e.hash : e) 
      : [(next !== null && next.hash ? next.hash : next)]

    let entry = {
      hash: null, // "Qm...Foo", we'll set the hash after ipfsfying the data structure, 
      payload: data, // Can be any JSON.stringifyable data
      next: nexts // Array of IPFS hashes
    }

    return Entry.toIpfsHash(ipfs, entry)
      .then((hash) => {
        entry.hash = hash
        return entry
      })
  }

  static createSignedEntry(ipfs, data, id, key, next = []) {
    if (!ipfs) throw new Error("Entry requires ipfs instance")

    // convert single objects to an array and entry objects to single hashes
    let nexts = next !== null && next instanceof Array 
      ? next.map((e) => e.hash ? e.hash : e) 
      : [(next !== null && next.hash ? next.hash : next)]

    let signature

    // console.log("SIGN KEY", key)
    // console.log()

    return Crypto.sign(key.privateKey, new Buffer(JSON.stringify(data)))
      .then((sig) => {
        // console.log(sig)
        signature = sig
      })
      // .then(() => Crypto.exportKeyToIpfs(ipfs, key.publicKey))
      .then((pubKeyHash) => {
        // if (pubKeyHash !== id)
        //   return Promise.reject("Wrong signing key! " + pubKeyHash + " <--> " + id)

        let entry = {
          hash: null, // "Qm...Foo", we'll set the hash after ipfsfying the data structure, 
          payload: data, // Can be any JSON.stringifyable data
          sig: signature,
          key: key.publicKey,
          id: id,
          next: nexts // Array of IPFS hashes
        }

        // Crypto.importKeyFromIpfs(ipfs, pubKeyHash)
        //   .then((k) => Crypto.verify(signature, k, new Buffer(JSON.stringify(data))))
        //   .then((v) => console.log("VERIFIED!", v))

        // return Entry.createSignedEntry(this._ipfs, data, signed, this._heads)
        //   .then((entry) => {
        //     this._heads = [entry.hash]
        //     this._currentBatch.push(entry)
        //     return entry
        //   })
        return Entry.toIpfsHash(ipfs, entry)
          .then((hash) => {
            entry.hash = hash
            return entry
          })
      })

  }

  // Returns a Promise<String>
  // Example:
  //   Entry.toIpfsHash(ipfs, entry)
  //     .then((hash) => console.log(hash)) // "Qm...Foo"
  static toIpfsHash(ipfs, entry) {
    if (!ipfs) throw new Error("Entry requires ipfs instance")
    const data = new Buffer(JSON.stringify(entry))
    return ipfs.object.put(data)
      .then((res) => res.toJSON().Hash)
  }

  // Returns a Promise<Entry>
  // Example:
  //   Entry.fromIpfsHash(ipfs, "Qm...Foo")
  //     .then((entry) => console.log(entry)) // { hash: "Qm...Foo", payload: "hello", next: null }  
  static fromIpfsHash(ipfs, hash, options) {
    if (!ipfs) throw new Error("Entry requires ipfs instance")
    if (!hash) throw new Error("Invalid hash: " + hash)
    return ipfs.object.get(hash, { enc: 'base58' })
      .then((obj) => {
        const data = JSON.parse(obj.toJSON().Data)
        // console.log("---")
        // console.log(data)
        return Crypto.importPublicKey(data.key)
          .then((k) => Crypto.verify(data.sig, k, new Buffer(JSON.stringify(data.payload))))
        //   // .then((keyPair) => key = keyPair)
        // // return Crypto.importKeyFromIpfs(ipfs, data.key)
        //   .then((key) => {
        //     // console.log(">>", key)
        //     return 
        //   })
          .then((verified) => {
            // console.log("VERIFIED", verified)
            if (!verified)
              return Promise.reject("Entry signature couldn't be verified!")

            const entry = {
              hash: hash,
              payload: data.payload,
              sig: data.sig,
              key: data.key,
              id: data.id,
              next: data.next
            }
            return entry            
          })
      })
  }

  // Returns a boolean
  // Example:
  //   const hasChild = Entry.hasChild(entry1, entry2)
  //   true|false
  static hasChild(entry1, entry2) {
    return entry1.next.includes(entry2.hash)
  }

  // Returns a boolean
  // Example:
  //   const equal = Entry.compare(entry1, entry2)
  //   true|false
  static compare(a, b) {
    return a.hash === b.hash
  }
}
