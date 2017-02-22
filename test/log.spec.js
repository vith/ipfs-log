'use strict'

const assert = require('assert')
const async = require('asyncawait/async')
const await = require('asyncawait/await')
const rmrf = require('rimraf')
const apis = require('./test-apis')
const Log = require('../src/log.js')
const Entry = require('../src/entry')
const EntryCollection = require('../src/entry-collection')
const LogCreator = require('./log-creator')
const bigLogString = require('./big-log.fixture.js')

const dataDir = './ipfs'

let ipfs, ipfsDaemon

const last = (arr) => {
  return arr[arr.length - 1]
}

apis.forEach((IpfsDaemon) => {

  describe('Log', function() {
    this.timeout(40000)

    before((done) => {
      rmrf.sync(dataDir)
      ipfs = new IpfsDaemon({ IpfsDataDir: dataDir })
      ipfs.on('error', done)
      ipfs.on('ready', () => done())
    })

    after(() => {
      ipfs.stop()
      rmrf.sync(dataDir)
    })

    describe('create', async(() => {
      it('creates an empty log', async(() => {
        const log = Log.create()
        assert.notEqual(log._entries, null)
        assert.notEqual(log._heads, null)
        assert.notEqual(log._id, null)
      }))

      it('creates an empty log and sets default params', async(() => {
        const log = Log.create()
        assert.notEqual(log.id, null)
        assert.deepEqual(log.items, [])
        assert.deepEqual(log.heads, [])
      }))

      it('sets id', async(() => {
        const log = Log.create('ABC')
        assert.equal(log.id, 'ABC')
      }))

      it('sets items if given as params', async(() => {
        const one = await(Entry.create(ipfs, 'A', 0, 'entryA'))
        const two = await(Entry.create(ipfs, 'B', 0, 'entryB'))
        const three = await(Entry.create(ipfs, 'C', 0, 'entryC'))
        const log = Log.create('A', [one, two, three])
        assert.equal(log.items.length, 3)
        assert.equal(log.items[0].payload, 'entryA')
        assert.equal(log.items[1].payload, 'entryB')
        assert.equal(log.items[2].payload, 'entryC')
      }))

      it('sets heads if given as params', async(() => {
        const one = await(Entry.create(ipfs, 'A', 0, 'entryA'))
        const two = await(Entry.create(ipfs, 'B', 0, 'entryB'))
        const three = await(Entry.create(ipfs, 'C', 0, 'entryC'))
        const log = Log.create('B', [one, two, three], [three.hash])
        assert.equal(log.heads.length, 1)
        assert.equal(log.heads[0], three.hash)
      }))

      it('finds heads if heads not given as params', async(() => {
        const one = await(Entry.create(ipfs, 'A', 0, 'entryA'))
        const two = await(Entry.create(ipfs, 'B', 0, 'entryB'))
        const three = await(Entry.create(ipfs, 'C', 0, 'entryC'))
        const log = Log.create('A', [one, two, three])
        assert.equal(log.heads.length, 3)
        assert.equal(log.heads[0], one.hash)
        assert.equal(log.heads[1], two.hash)
        assert.equal(log.heads[2], three.hash)
      }))

      it('throws an error if entries is not an array', async(() => {
        let err
        try {
          const log = Log.create('A', null)
        } catch(e) {
          err = e
        }
        assert.equal(err.message, 'entries argument must be an array')
      }))

      it('throws an error if heads is not an array', async(() => {
        let err
        try {
          const log = Log.create('A', [], null)
        } catch(e) {
          err = e
        }
        assert.equal(err.message, 'heads argument must be an array')
      }))
    }))

    describe('toString', async(() => {
      let log
      const expectedData = "five\n└─four\n  └─three\n    └─two\n      └─one"

      beforeEach(async(() => {
        log = Log.create()
        log = await(Log.append(ipfs, log, "one"))
        log = await(Log.append(ipfs, log, "two"))
        log = await(Log.append(ipfs, log, "three"))
        log = await(Log.append(ipfs, log, "four"))
        log = await(Log.append(ipfs, log, "five"))
      }))

      it('returns a nicely formatted string', () => {
        assert.equal(log.toString(), expectedData)
        console.log(log.toString())
      })
    }))

    describe('get', async(() => {
      let log

      const expectedData = { 
        hash: 'QmRL5SZ7zGjJfA8Qd7LF5aDw45aTz63XmMWb4ZEx9KPsZD',
        id: 'logi',
        seq: 0,
        payload: 'one',
        next: [] 
      }

      beforeEach(async(() => {
        log = Log.create('logi')
        log = await(Log.append(ipfs, log, "one"))
      }))

      it('returns an Entry', () => {
        const entry = log.get(log.items[0].hash)
        assert.deepEqual(entry, expectedData)
      })

      it('returns undefined when Entry is not in the log', () => {
        const entry = log.get('QmFoo')
        assert.deepEqual(entry, null)
      })
    }))

    describe('serialize', async(() => {
      let log
      const expectedData = {
        id: 'logi',
        heads: ['QmVo6f44AhmpLPzRaeponmnRVPBkPfmdPRPP6gQT5mXniB']
      }

      beforeEach(async(() => {
        log = Log.create('logi')
        log = await(Log.append(ipfs, log, "one"))
        log = await(Log.append(ipfs, log, "two"))
        log = await(Log.append(ipfs, log, "three"))
      }))

      describe('toJSON', () => {
        it('returns the log in JSON format', () => {
          assert.equal(JSON.stringify(log.toJSON()), JSON.stringify(expectedData))
        })
      })

      describe('toBuffer', () => {
        it('returns the log as a Buffer', () => {
          assert.deepEqual(log.toBuffer(), new Buffer(JSON.stringify(expectedData)))
        })
      })

      describe('toMultihash', async(() => {
        it('returns the log as ipfs hash', async(() => {
          const expectedHash = 'QmUtCtNBGWTggX7fVqJxsQBDaPC4himL3RS7FDSi7eR7is'
          let log = Log.create('A')
          log = await(Log.append(ipfs, log, 'one'))
          const hash = await(Log.toMultihash(ipfs, log))
          assert.equal(hash, expectedHash)
        }))

        it('log serialized to ipfs contains the correct data', async(() => {
          const expectedData = { 
            id: 'A',
            heads: ['QmXnr3hLPbunta91V1cpo6hvB8iDz4ikVe9KCEDm8Js3c3']
          }
          const expectedHash = 'QmUtCtNBGWTggX7fVqJxsQBDaPC4himL3RS7FDSi7eR7is'
          let log = Log.create('A')
          log = await(Log.append(ipfs, log, 'one'))
          const hash = await(Log.toMultihash(ipfs, log))
          assert.equal(hash, expectedHash)
          const res = await(ipfs.object.get(hash, { enc: 'base58' }))
          const result = JSON.parse(res.toJSON().data.toString())
          assert.deepEqual(result.heads, expectedData.heads)
        }))

        it('throws an error if ipfs is not defined', () => {
          let err
          try {
            Log.toMultihash()
          } catch (e) {
            err = e
          }
          assert.notEqual(err, null)
          assert.equal(err.message, 'Ipfs instance not defined')
        })

        it('throws an error if log is not defined', () => {
          let err
          try {
            Log.toMultihash(ipfs)
          } catch (e) {
            err = e
          }
          assert.notEqual(err, null)
          assert.equal(err.message, 'Log instance not defined')
        })

        it('throws an error if log items is empty', () => {
          let err
          try {
            Log.toMultihash(ipfs, {})
          } catch (e) {
            err = e
          }
          assert.notEqual(err, null)
          assert.equal(err.message, 'Can\'t serialize an empty log')
        })

        it('throws an error if log heads is empty', () => {
          let err
          try {
            Log.toMultihash(ipfs, { items: [1] })
          } catch (e) {
            err = e
          }
          assert.notEqual(err, null)
          assert.equal(err.message, 'Can\'t serialize a log without heads')
        })
      }))

      describe('fromMultihash', async(() => {
        it('creates an empty log from ipfs hash', async(() => {
          const expectedData = {
            id: 'X',
            heads: ['QmSp1vnMJRrEDWWnkLCzJEcTu6mNdpQdHiCndf6ZgqfXXF']
          }
          let log = Log.create('X')
          log = await(Log.append(ipfs, log, 'one'))
          const hash = await(Log.toMultihash(ipfs, log))
          const res = await(Log.fromMultihash(ipfs, hash))
          assert.equal(JSON.stringify(res.toJSON()), JSON.stringify(expectedData))
          assert.equal(res.items.length, 1)
          assert.equal(res.items[0].payload, 'one')
          assert.equal(res.items[0].seq, 0)
        }))

        it('creates a log from ipfs hash', async(() => {
          const hash = await(Log.toMultihash(ipfs, log))
          const res = await(Log.fromMultihash(ipfs, hash))
          assert.equal(res.items.length, 3)
          assert.equal(res.items[0].payload, 'one')
          assert.equal(res.items[0].seq, 0)
          assert.equal(res.items[1].payload, 'two')
          assert.equal(res.items[1].seq, 1)
          assert.equal(res.items[2].payload, 'three')
          assert.equal(res.items[2].seq, 2)
        }))

        it('has the right sequence number after creation and appending', async(() => {
          const hash = await(Log.toMultihash(ipfs, log))
          let res = await(Log.fromMultihash(ipfs, hash))
          res = await(Log.append(ipfs, res, 'four'))
          assert.equal(res.items[3].payload, 'four')
          assert.equal(res.items[3].seq, 3)
        }))

        it('creates a log from ipfs hash that has three heads', async(() => {
          let log1 = Log.create('A')
          let log2 = Log.create('B')
          let log3 = Log.create('C')
          log1 = await(Log.append(ipfs, log1, "one"))
          log2 = await(Log.append(ipfs, log2, "two"))
          log3 = await(Log.append(ipfs, log3, "three"))
          const log4 = Log.join(log1, log2)
          const log5 = Log.join(log4, log3)
          const hash = await(Log.toMultihash(ipfs, log5))
          const res = await(Log.fromMultihash(ipfs, hash))
          assert.equal(res.items.length, 3)
          assert.equal(res.heads.length, 3)
          assert.equal(res.items[0].payload, 'one')
          assert.equal(res.items[1].payload, 'two')
          assert.equal(res.items[2].payload, 'three')
        }))

        it('creates a log from ipfs hash up to a size limit', async(() => {
          const amount = 100
          const size = amount / 2
          let log = Log.create()
          for (let i = 0; i < amount; i ++) {
            log = await(Log.append(ipfs, log, i.toString()))
          }
          const hash = await(Log.toMultihash(ipfs, log))
          const res = await(Log.fromMultihash(ipfs, hash, size))
          assert.equal(res.items.length, size)
        }))

        it('creates a log from ipfs hash up without size limit', async(() => {
          const amount = 100
          let log = Log.create()
          for (let i = 0; i < amount; i ++) {
            log = await(Log.append(ipfs, log, i.toString()))
          }
          const hash = await(Log.toMultihash(ipfs, log))
          const res = await(Log.fromMultihash(ipfs, hash, -1))
          assert.equal(res.items.length, amount)
        }))

        it('throws an error if ipfs is not defined', () => {
          let err
          try {
            const log = Log.fromMultihash()
          } catch (e) {
            err = e
          }
          assert.notEqual(err, null)
          assert.equal(err.message, 'Ipfs instance not defined')
        })

        it('throws an error if hash is not defined', () => {
          let err
          try {
            const log = Log.fromMultihash(ipfs)
          } catch (e) {
            err = e
          }
          assert.notEqual(err, null)
          assert.equal(err.message, 'Invalid hash: undefined')
        })

        it('throws an error when data from hash is not instance of Log', async(() => {
          let err
          const res = await(ipfs.object.put(new Buffer('{}')))
          try {
            await(Log.fromMultihash(ipfs, res.toJSON().multihash))
          } catch(e) {
            err = e
          }
          assert.equal(err.message, 'Not a Log instance')
        }))

        it('throws an error if data from hash is not valid JSON', async(() => {
          let err
          const res = await(ipfs.object.put(new Buffer('hello')))
          try {
            await(Log.fromMultihash(ipfs, res.toJSON().multihash))
          } catch(e) {
            err = e
          }
          assert.equal(err.message, 'Unexpected token h in JSON at position 0')
        }))

        it('onProgress callback is fired for each entry', async(() => {
          const amount = 100
          let log = Log.create()
          for (let i = 0; i < amount; i ++) {
            log = await(Log.append(ipfs, log, i.toString()))
          }

          const items = log.items
          let i = 0
          let prevDepth = 0
          const callback = (hash, entry, parent, depth) => {
            assert.notEqual(entry, null)
            assert.equal(hash, items[items.length - i - 1].hash)
            assert.equal(entry.hash, items[items.length - i - 1].hash)
            assert.equal(entry.payload, items[items.length - i - 1].payload)
            assert.equal(depth, i)

            if (i > 0) {
              assert.equal(parent.payload, items[items.length - i].payload)
            }

            i ++
            prevDepth = depth
          }

          const hash = await(Log.toMultihash(ipfs, log))
          const res = await(Log.fromMultihash(ipfs, hash, -1, [], callback))
        }))

      }))
    }))

    describe('items', () => {
      it('returns all entrys in the log', async(() => {
        let log = Log.create()
        let items = log.items
        assert.equal(log.items instanceof Array, true)
        assert.equal(log.items.length, 0)
        log = await(Log.append(ipfs, log, "hello1"))
        log = await(Log.append(ipfs, log, "hello2"))
        log = await(Log.append(ipfs, log, "hello3"))
        assert.equal(log.items instanceof Array, true)
        assert.equal(log.items.length, 3)
        assert.equal(log.items[0].payload, 'hello1')
        assert.equal(log.items[1].payload, 'hello2')
        assert.equal(log.items[2].payload, 'hello3')
      }))
    })

    describe('append', () => {
      it('adds an item to an empty log', async(() => {
        let log1 = Log.create()
        const log2 = await(Log.append(ipfs, log1, "hello1"))
        assert.equal(log2.items.length, 1)
        assert.equal(log2.items[0].payload, 'hello1')
        assert.equal(log2.items[0].seq, 0)
      }))

      it('doesn\'t modify original log', async(() => {
        let log1 = Log.create()
        const log2 = await(Log.append(ipfs, log1, "hello1"))
        assert.equal(log1.items.length, 0)
      }))

      it('copies the previous entries', async(() => {
        let log1 = Log.create()
        const log2 = await(Log.append(ipfs, log1, "hello1"))
        const log3 = await(Log.append(ipfs, log2, "hello2"))
        assert.equal(log3.items[0].hash, log2.items[0].hash)
      }))

      it('has the right heads after append', async(() => {
        let log1 = Log.create()
        const log2 = await(Log.append(ipfs, log1, "hello1"))
        const log3 = await(Log.append(ipfs, log2, "hello2"))
        const last = log3.items[log3.items.length - 1]
        assert.equal(log2.heads.length, 1)
        assert.equal(log3.heads.length, 1)
        assert.equal(log2.heads[0], log2.items[0].hash)
        assert.equal(last.hash, log3.heads[0])
        assert.equal(last.payload, 'hello2')
      }))

      it('adds 100 items to a log', async(() => {
        const amount = 100
        let log = Log.create()

        for(let i = 1; i <= amount; i ++) {
          log = await(Log.append(ipfs, log, "hello" + i))
        }

        const entry = last(log.items)
        assert.equal(log.items.length, amount)
        assert.equal(entry.payload, 'hello' + amount)
        assert.notEqual(entry.next.length, 0)
        assert.equal(entry.seq, 99)
      }))

      it('throws an error if ipfs is not defined', () => {
        let err
        try {
          Log.append()
        } catch (e) {
          err = e
        }
        assert.notEqual(err, null)
        assert.equal(err.message, 'Ipfs instance not defined')
      })

      it('throws an error if log is not defined', () => {
        let err
        try {
          Log.append(ipfs)
        } catch (e) {
          err = e
        }
        assert.notEqual(err, null)
        assert.equal(err.message, 'Log instance not defined')
      })

      it('throws an error if given log is not a Log instance', () => {
        let err
        try {
          Log.append(ipfs, {})
        } catch (e) {
          err = e
        }
        assert.notEqual(err, null)
        assert.equal(err.message, 'Not a Log instance')
      })

      it('throws an error if given log is not a Log instance - heads', () => {
        let err
        try {
          Log.append(ipfs, { heads: [] })
        } catch (e) {
          err = e
        }
        assert.notEqual(err, null)
        assert.equal(err.message, 'Not a Log instance')
      })

      it('throws an error if given log is not a Log instance - items', () => {
        let err
        try {
          Log.append(ipfs, { heads: [], items: [] })
        } catch (e) {
          err = e
        }
        assert.notEqual(err, null)
        assert.equal(err.message, 'Not a Log instance')
      })
    })

    describe('join', () => {
      let log1, log2, log3, log4

      beforeEach(async(() => {
        log1 = Log.create('A')
        log2 = Log.create('B')
        log3 = Log.create('C')
        log4 = Log.create('D')
      }))

      it('joins logs', async(() => {
        let items1 = []
        let items2 = []
        let items3 = []
        const amount = 100
        for(let i = 1; i <= amount; i ++) {
          const prev1 = last(items1)
          const prev2 = last(items2)
          const prev3 = last(items3)
          const n1 = await(Entry.create(ipfs, 'A', i, 'entryA' + i, [prev1]))
          const n2 = await(Entry.create(ipfs, 'B', i, 'entryB' + i, [prev2, n1]))
          const n3 = await(Entry.create(ipfs, 'C', i, 'entryC' + i, [prev3, n1, n2]))
          items1.push(n1)
          items2.push(n2)
          items3.push(n3)
        }

        const logA = await(Log.fromEntry(ipfs, last(items2)))
        const logB = await(Log.fromEntry(ipfs, last(items3)))
        assert.equal(logA.items.length, items2.length + items1.length)
        assert.equal(logB.items.length, items3.length + items2.length + items1.length)

        const log = Log.join(logA, logB)

        assert.equal(log.items.length, items3.length + items2.length + items1.length)
        // The last entry, 'entryC100', should be the only head 
        // (it points to entryB100, entryB100 and entryC99)
        assert.equal(log.heads.length, 1)
      }))

      it('throws an error if first log is not defined', () => {
        let err
        try {
          Log.join()
        } catch (e) {
          err = e
        }
        assert.notEqual(err, null)
        assert.equal(err.message, 'Log instance not defined')
      })

      it('throws an error if second log is not defined', () => {
        let err
        try {
          Log.join(log1)
        } catch (e) {
          err = e
        }
        assert.notEqual(err, null)
        assert.equal(err.message, 'Log instance not defined')
      })

      it('throws an error if passed argument is not an instance of Log', () => {
        let err
        try {
          Log.join(log1, {})
        } catch(e) {
          err = e
        }
        assert.notEqual(err, null)
        assert.equal(err.message, 'Log to join must be an instance of Log')
      })

      it('joins only unique items', async(() => {
        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log1 = await(Log.append(ipfs, log1, "helloA2"))
        log2 = await(Log.append(ipfs, log2, "helloB1"))
        log2 = await(Log.append(ipfs, log2, "helloB2"))
        log1 = Log.join(log1, log2)
        log1 = Log.join(log1, log2)

        const expectedData = [ 
          'helloA1', 'helloB1', 'helloA2', 'helloB2',
        ]

        assert.equal(log1.items.length, 4)
        assert.deepEqual(log1.items.map((e) => e.payload), expectedData)

        const item = last(log1.items)
        assert.equal(item.next.length, 1)
      }))

      it('joins logs two ways', async(() => {
        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log1 = await(Log.append(ipfs, log1, "helloA2"))
        log2 = await(Log.append(ipfs, log2, "helloB1"))
        log2 = await(Log.append(ipfs, log2, "helloB2"))
        log1 = Log.join(log1, log2)
        log2 = Log.join(log2, log1)


        const expectedData = [ 
          'helloA1', 'helloB1', 'helloA2', 'helloB2',
        ]

        assert.deepEqual(log1.items.map((e) => e.hash), log2.items.map((e) => e.hash))
        assert.deepEqual(log1.items.map((e) => e.payload), expectedData)
        assert.deepEqual(log2.items.map((e) => e.payload), expectedData)
      }))

      it('doesn\'t change original logs on join', async(() => {
        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log2 = await(Log.append(ipfs, log2, "helloB1"))
        const log3 = Log.join(log1, log2)
        const log4 = Log.join(log2, log1)
        assert.equal(log1.items.length, 1)
        assert.equal(log2.items.length, 1)
        assert.equal(last(log1.items).payload, 'helloA1')
        assert.equal(last(log2.items).payload, 'helloB1')
      }))

      it('joins logs twice', async(() => {
        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log2 = await(Log.append(ipfs, log2, "helloB1"))
        log2 = Log.join(log2, log1, -1, log2.id)

        log1 = await(Log.append(ipfs, log1, "helloA2"))
        log2 = await(Log.append(ipfs, log2, "helloB2"))
        log2 = Log.join(log2, log1)

        const expectedData = [ 
          'helloA1', 'helloB1', 'helloB2', 'helloA2',
        ]

        assert.equal(log2.items.length, 4)
        assert.deepEqual(log2.items.map((e) => e.payload), expectedData)
      }))

      it('joins 2 logs two ways', async(() => {
        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log2 = await(Log.append(ipfs, log2, "helloB1"))
        log2 = Log.join(log2, log1)
        log1 = Log.join(log1, log2)

        log1 = await(Log.append(ipfs, log1, "helloA2"))
        log2 = await(Log.append(ipfs, log2, "helloB2"))
        log2 = Log.join(log2, log1)

        const expectedData = [
          'helloA1', 'helloB1', 'helloB2', 'helloA2',
        ]

        assert.equal(log2.items.length, 4)
        assert.deepEqual(log2.items.map((e) => e.payload), expectedData)
      }))


      it('joins 4 logs to one', async(() => {
        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log1 = await(Log.append(ipfs, log1, "helloA2"))
        log2 = await(Log.append(ipfs, log2, "helloB1"))
        log2 = await(Log.append(ipfs, log2, "helloB2"))
        log3 = await(Log.append(ipfs, log3, "helloC1"))
        log3 = await(Log.append(ipfs, log3, "helloC2"))
        log4 = await(Log.append(ipfs, log4, "helloD1"))
        log4 = await(Log.append(ipfs, log4, "helloD2"))
        log1 = Log.join(log1, log2)
        log1 = Log.join(log1, log3)
        log1 = Log.join(log1, log4)

        const expectedData = [ 
          'helloA1', 'helloB1', 'helloC1', 'helloD1',
          'helloA2', 'helloB2', 'helloC2', 'helloD2',
        ]

        assert.equal(log1.items.length, 8)
        assert.deepEqual(log1.items.map(e => e.payload), expectedData)
      }))

      it('joins 4 logs to one is commutative', async(() => {
        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log1 = await(Log.append(ipfs, log1, "helloA2"))
        log2 = await(Log.append(ipfs, log2, "helloB1"))
        log2 = await(Log.append(ipfs, log2, "helloB2"))
        log3 = await(Log.append(ipfs, log3, "helloC1"))
        log3 = await(Log.append(ipfs, log3, "helloC2"))
        log4 = await(Log.append(ipfs, log4, "helloD1"))
        log4 = await(Log.append(ipfs, log4, "helloD2"))
        log1 = Log.join(log1, log2)
        log1 = Log.join(log1, log3)
        log1 = Log.join(log1, log4)
        log2 = Log.join(log2, log1)
        log2 = Log.join(log2, log3)
        log2 = Log.join(log2, log4)

        assert.equal(log1.items.length, 8)
        assert.deepEqual(log1.items.map(e => e.payload), log2.items.map(e => e.payload))
      }))

      it('joins logs from 4 logs', async(() => {
        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log1 = Log.join(log1, log2)
        log2 = await(Log.append(ipfs, log2, "helloB1"))
        log2 = Log.join(log2, log1)
        log1 = await(Log.append(ipfs, log1, "helloA2"))
        log2 = await(Log.append(ipfs, log2, "helloB2"))
        log1 = Log.join(log1, log3)
        log3 = Log.join(log3, log1)
        log3 = await(Log.append(ipfs, log3, "helloC1"))
        log3 = await(Log.append(ipfs, log3, "helloC2"))
        log1 = Log.join(log1, log3)
        log1 = Log.join(log1, log2)
        log4 = await(Log.append(ipfs, log4, "helloD1"))
        log4 = await(Log.append(ipfs, log4, "helloD2"))
        log4 = Log.join(log4, log2)
        log4 = Log.join(log4, log1)
        log4 = Log.join(log4, log3)
        log4 = await(Log.append(ipfs, log4, "helloD3"))
        log4 = await(Log.append(ipfs, log4, "helloD4"))

        const expectedData = [ 
          'helloA1',
          'helloB1',
          'helloD1',
          'helloB2',
          'helloA2',
          'helloD2',
          'helloC1',
          'helloC2',
          'helloD3',
          'helloD4',
        ]

        console.log(log4.toString())
        assert.equal(log4.items.length, 10)
        assert.deepEqual(log4.items.map((e) => e.payload), expectedData)
      }))
    })

    describe('joinAll', () => {
      it('joins all logs', async(() => {
        let items1 = []
        let items2 = []
        let items3 = []
        const amount = 100
        for(let i = 1; i <= amount; i ++) {
          const prev1 = last(items1)
          const prev2 = last(items2)
          const prev3 = last(items3)
          const n1 = await(Entry.create(ipfs, 'A', i, 'entryA' + i, [prev1]))
          const n2 = await(Entry.create(ipfs, 'B', i, 'entryB' + i, [prev2, n1]))
          const n3 = await(Entry.create(ipfs, 'C', i, 'entryC' + i, [prev3, n1, n2]))
          items1.push(n1)
          items2.push(n2)
          items3.push(n3)
        }

        const logA = await(Log.fromEntry(ipfs, last(items2)))
        const logB = await(Log.fromEntry(ipfs, last(items3)))
        assert.equal(logA.items.length, items2.length + items1.length)
        assert.equal(logB.items.length, items3.length + items2.length + items1.length)

        const log = Log.joinAll([logA, logB])

        assert.equal(log.items.length, items3.length + items2.length + items1.length)
        assert.equal(log.heads.length, 1)
      }))
    })

    describe('expand', () => {
      it('expands the log', async(() => {
        const log1 = Log.create('A')
        const log2 = Log.create('B')
        const log3 = Log.create('C')
        let items1 = []
        let items2 = []
        let items3 = []
        const amount = 100
        for(let i = 1; i <= amount; i ++) {
          const prev1 = last(items1)
          const prev2 = last(items2)
          const prev3 = last(items3)
          const n1 = await(Entry.create(ipfs, 'A', i, 'entryA' + i, [prev1]))
          const n2 = await(Entry.create(ipfs, 'B', i, 'entryB' + i, [prev2]))
          const n3 = await(Entry.create(ipfs, 'C', i, 'entryC' + i, [prev3, n2, n1]))
          items1.push(n1)
          items2.push(n2)
          items3.push(n3)
        }

        let prev = null
        const onProgress = (hash, entry, parent, depth, have) => {
          let padding = []
          const isLast = parent ? parent.next.indexOf(hash) === parent.next.length - 1 : true
          prev = entry

          const amount = depth - 1
          for (let i = 0; i < amount; i ++) {
            padding.push("│ ")
          }
          const connectorChar = depth > 0 
            ? (isLast ? "└─" : "├─")
            : ""

          console.log(padding.join("") + connectorChar + hash + " \"" + entry.payload + "\"" + (have ? " ✓" : ""))
        }

        // Limit the log size to 10 entries
        const a = await(Log.fromEntry(ipfs, last(items3), 10))
        assert.equal(a.items.length, 10)

        // Expand to 20 entries
        const b = await(Log.expand(ipfs, a, 10, onProgress))
        assert.equal(b.items.length, 20)
        assert.deepEqual(b.items.slice(-10), a.items)

        // Expand to max
        const c = await(Log.expand(ipfs, b))
        assert.equal(c.items.length, amount * 3)
        assert.deepEqual(c.items.slice(-10), b.items.slice(-10))

        // Check for idempotency of expand()
        const d = await(Log.expand(ipfs, c))
        assert.equal(d.items.length, c.items.length)
        assert.deepEqual(c.items, d.items)
      }))

      it('throws an error if ipfs is not defined', () => {
        let err
        try {
          Log.expand()
        } catch (e) {
          err = e
        }
        assert.notEqual(err, null)
        assert.equal(err.message, 'Ipfs instance not defined')
      })

      it('throws an error if log is not defined', () => {
        let err
        try {
          Log.expand(ipfs)
        } catch (e) {
          err = e
        }
        assert.notEqual(err, null)
        assert.equal(err.message, 'Log instance not defined')
      })
    })

    describe('fromEntry', () => {
      let prev = null
      const onProgress = (hash, entry, parent, depth) => {
        let padding = []
        const isLast = parent ? parent.next.indexOf(hash) === parent.next.length - 1 : true
        prev = entry

        const amount = depth - 1
        for (let i = 0; i < amount; i ++) {
          padding.push("│ ")
        }
        const connectorChar = depth > 0 
          ? (isLast ? "└─" : "├─")
          : ""

        console.log(padding.join("") + connectorChar + hash + " \"" + entry.payload)
      }

      it('onProgress callback is fired for each entry', async(() => {
        const log1 = Log.create()
        let items1 = []
        const amount = 100
        for(let i = 1; i <= amount; i ++) {
          const prev1 = last(items1)
          const n1 = await(Entry.create(ipfs, 'A', i, 'entryA' + i, [prev1]))
          items1.push(n1)
        }

        let i = 0
        let prevDepth = 0
        const callback = (hash, entry, parent, depth) => {
          assert.notEqual(entry, null)
          assert.equal(hash, items1[items1.length - i - 1].hash)
          assert.equal(entry.hash, items1[items1.length - i - 1].hash)
          assert.equal(entry.payload, items1[items1.length - i - 1].payload)
          assert.equal(depth, i)

          if (i > 0) {
            assert.equal(parent.payload, items1[items1.length - i].payload)
          }

          i ++
          prevDepth = depth
        }

        const a = await(Log.fromEntry(ipfs, last(items1), -1, [], callback))
      }))

      it('retrieves partial log from an entry hash', async(() => {
        const log1 = Log.create()
        const log2 = Log.create()
        const log3 = Log.create()
        let items1 = []
        let items2 = []
        let items3 = []
        const amount = 100
        for(let i = 1; i <= amount; i ++) {
          const prev1 = last(items1)
          const prev2 = last(items2)
          const prev3 = last(items3)
          const n1 = await(Entry.create(ipfs, 'A', i, 'entryA' + i, [prev1]))
          const n2 = await(Entry.create(ipfs, 'B', i, 'entryB' + i, [prev2, n1]))
          const n3 = await(Entry.create(ipfs, 'C', i, 'entryC' + i, [prev3, n2]))
          items1.push(n1)
          items2.push(n2)
          items3.push(n3)
        }

        console.log("limit to 10 entries")
        const a = await(Log.fromEntry(ipfs, last(items1), 10))
        assert.equal(a.items.length, 10)

        const b = await(Log.fromEntry(ipfs, last(items1), 42))
        assert.equal(b.items.length, 42)
      }))

      it('throws an error if trying to create a log from a hash of an entry', async(() => {
        const log1 = Log.create()
        let items1 = []
        const amount = 5
        for(let i = 1; i <= amount; i ++) {
          const prev1 = last(items1)
          const n1 = await(Entry.create(ipfs, 'A', i, 'entryA' + i, [prev1]))
          items1.push(n1)
        }

        let err
        try {
          await(Log.fromEntry(ipfs, last(items1).hash, 1))
        } catch (e) {
          err = e
        }
        assert.equal(err.message, '\'entries\' need to be an array of Entry instances')
      }))

      describe('fetches a log', () => {
        const amount = 100

        let log1
        let log2
        let log3
        let items1 = []
        let items2 = []
        let items3 = []
        let result

        beforeEach(async(() => {
          log1 = Log.create('A')
          log2 = Log.create('B')
          log3 = Log.create('C')
          items1 = []
          items2 = []
          items3 = []
          for(let i = 1; i <= amount; i ++) {
            const prev1 = last(items1)
            const prev2 = last(items2)
            const prev3 = last(items3)
            const n1 = await(Entry.create(ipfs, log1.id, i, 'entryA' + i, [prev1]))
            const n2 = await(Entry.create(ipfs, log2.id, i, 'entryB' + i, [prev2, n1]))
            const n3 = await(Entry.create(ipfs, log3.id, i, 'entryC' + i, [prev3, n2]))
            items1.push(n1)
            items2.push(n2)
            items3.push(n3)
          }
        }))

        it('returns all entries - no excluded entries', async(() => {
          const a = await(Log.fromEntry(ipfs, last(items1)))
          assert.equal(a.items.length, amount)
          assert.equal(a.items[0].hash, items1[0].hash)
        }))

        it('returns all entries - including excluded entries', async(() => {
          // One entry
          const a = await(Log.fromEntry(ipfs, last(items1), -1, [items1[0]]))
          assert.equal(a.items.length, amount)
          assert.equal(a.items[0].hash, items1[0].hash)

          // All entries
          const b = await(Log.fromEntry(ipfs, last(items1), -1, items1.map(e => e.hash)))
          assert.equal(b.items.length, amount)
          assert.equal(b.items[0].hash, items1[0].hash)
        }))

        it('returns all entries - including excluded hashes', async(() => {
          // One hash
          const b = await(Log.fromEntry(ipfs, last(items1), -1, [items1[0].hash]))
          assert.equal(b.items.length, amount)
          assert.equal(b.items[0].hash, items1[0].hash)

          // All hashes
          const c = await(Log.fromEntry(ipfs, last(items1), -1, items1.map(e => e.hash)))
          assert.equal(c.items.length, amount)
          assert.equal(c.items[0].hash, items1[0].hash)
        }))
      })

      it('retrieves full log from an entry hash', async(() => {
        const log1 = Log.create()
        const log2 = Log.create()
        const log3 = Log.create()
        let items1 = []
        let items2 = []
        let items3 = []
        const amount = 10
        for(let i = 1; i <= amount; i ++) {
          const prev1 = last(items1)
          const prev2 = last(items2)
          const prev3 = last(items3)
          const n1 = await(Entry.create(ipfs, 'A', i, 'entryA' + i, [prev1]))
          const n2 = await(Entry.create(ipfs, 'B', i, 'entryB' + i, [prev2, n1]))
          const n3 = await(Entry.create(ipfs, 'C', i, 'entryC' + i, [prev3, n2]))
          items1.push(n1)
          items2.push(n2)
          items3.push(n3)
        }

        const a = await(Log.fromEntry(ipfs, [last(items1)], amount))
        assert.equal(a.items.length, amount)

        const b = await(Log.fromEntry(ipfs, [last(items2)], amount * 2))
        assert.equal(b.items.length, amount * 2)

        const c = await(Log.fromEntry(ipfs, [last(items3)], amount * 3))
        assert.equal(c.items.length, amount * 3)
      }))

      it('retrieves full log from an entry hash 2', async(() => {
        const log1 = Log.create()
        const log2 = Log.create()
        const log3 = Log.create()
        let items1 = []
        let items2 = []
        let items3 = []
        const amount = 10
        for(let i = 1; i <= amount; i ++) {
          const prev1 = last(items1)
          const prev2 = last(items2)
          const prev3 = last(items3)
          const n1 = await(Entry.create(ipfs, 'A', i, 'entryA' + i, [prev1]))
          const n2 = await(Entry.create(ipfs, 'B', i, 'entryB' + i, [prev2, n1]))
          const n3 = await(Entry.create(ipfs, 'C', i, 'entryC' + i, [prev3, n1, n2]))
          items1.push(n1)
          items2.push(n2)
          items3.push(n3)
        }

        const a = await(Log.fromEntry(ipfs, last(items1), amount))
        assert.equal(a.items.length, amount)

        const b = await(Log.fromEntry(ipfs, last(items2), amount * 2))
        assert.equal(b.items.length, amount * 2)

        const c = await(Log.fromEntry(ipfs, last(items3), amount * 3))
        assert.equal(c.items.length, amount * 3)
      }))

      it('retrieves full log from an entry hash 3', async(() => {
        const log1 = Log.create('A')
        const log2 = Log.create('B')
        const log3 = Log.create('C')
        let items1 = []
        let items2 = []
        let items3 = []
        const amount = 10
        for(let i = 1; i <= amount; i ++) {
          const prev1 = last(items1)
          const prev2 = last(items2)
          const prev3 = last(items3)
          const n1 = await(Entry.create(ipfs, 'A', i, 'entryA' + i, [prev1]))
          const n2 = await(Entry.create(ipfs, 'B', i, 'entryB' + i, [prev2, n1]))
          const n3 = await(Entry.create(ipfs, 'C', i, 'entryC' + i, [prev3, n1, n2]))
          items1.push(n1)
          items2.push(n2)
          items3.push(n3)
        }

        const a = await(Log.fromEntry(ipfs, last(items1), amount))
        assert.equal(a.items.length, amount)

        const itemsInB = [ 
          'entryA1',
          'entryB1',
          'entryA2',
          'entryB2',
          'entryA3',
          'entryB3',
          'entryA4',
          'entryB4',
          'entryA5',
          'entryB5',
          'entryA6',
          'entryB6',
          'entryA7',
          'entryB7',
          'entryA8',
          'entryB8',
          'entryA9',
          'entryB9',
          'entryA10',
          'entryB10' 
        ]

        const b = await(Log.fromEntry(ipfs, last(items2), amount * 2))
        assert.equal(b.items.length, amount * 2)
        assert.deepEqual(itemsInB, b.items.map((e) => e.payload))

        let c = await(Log.fromEntry(ipfs, last(items3), amount * 3))
        c = await(Log.append(ipfs, c, "EOF"))
        assert.equal(c.items.length, amount * 3 + 1)

        const tmp = [ 
          'entryA1',
          'entryB1',
          'entryC1',
          'entryA2',
          'entryB2',
          'entryC2',
          'entryA3',
          'entryB3',
          'entryC3',
          'entryA4',
          'entryB4',
          'entryC4',
          'entryA5',
          'entryB5',
          'entryC5',
          'entryA6',
          'entryB6',
          'entryC6',
          'entryA7',
          'entryB7',
          'entryC7',
          'entryA8',
          'entryB8',
          'entryC8',
          'entryA9',
          'entryB9',
          'entryC9',
          'entryA10',
          'entryB10',
          'entryC10',
          'EOF' 
        ]
        assert.deepEqual(tmp, c.items.map(e => e.payload))

        let logX = Log.create('0') // make sure logX comes before A, B and C
        logX = await(Log.append(ipfs, logX, "1"))
        logX = await(Log.append(ipfs, logX, "2"))
        logX = await(Log.append(ipfs, logX, "3"))
        const d = await(Log.fromEntry(ipfs, last(logX.items)))

        const e3 = Log.join(c, c) // idempotent
        const ee = Log.join(e3, e3) // idempotent
        const e4 = Log.join(d, d) // idempotent
        let e1 = Log.join(c, d) // associative
        let e2 = Log.join(d, c) // associative

        assert.equal(e1.toString(), e2.toString())
        assert.equal(e3.toString(), c.toString())
        assert.equal(e4.toString(), d.toString())
        assert.equal(ee.toString(), e3.toString())
        assert.equal(ee.toString(), c.toString())

        e1 = await(Log.append(ipfs, e1, "DONE"))
        e2 = await(Log.append(ipfs, e2, "DONE"))
        const f = await(Log.fromEntry(ipfs, last(e1.items), -1, [], onProgress))
        const g = await(Log.fromEntry(ipfs, last(e2.items), -1, [], onProgress))

        // console.log("res", f.items.map(e => e.payload))
        console.log(f.toString())
        assert.equal(f.toString(), bigLogString)
        assert.equal(g.toString(), bigLogString)
      }))

      it('retrieves full log of randomly joined log', async(() => {
        let log1 = Log.create('A')
        let log2 = Log.create('B')
        let log3 = Log.create('C')

        for(let i = 1; i <= 5; i ++) {
          log1 = await(Log.append(ipfs, log1, 'entryA' + i))
        }
        // console.log("1", log1.items.map(e => e.payload))
        /*
          [ 'entryA1', 'entryA2', 'entryA3', 'entryA4', 'entryA5' ]
         */

        for(let i = 1; i <= 5; i ++) {
          log2 = await(Log.append(ipfs, log2, 'entryB' + i))
        }
        // console.log("2", log2.items.map(e => e.payload))
        /* 
          [ 'entryB1', 'entryB2', 'entryB3', 'entryB4', 'entryB5' ]
         */
        log3 = Log.join(log1, log2)
        // console.log("33", log3.items.map(e => e.payload))
        /*
        [ 'entryB1',
          'entryB2',
          'entryB3',
          'entryB4',
          'entryB5',
          'entryA1',
          'entryA2',
          'entryA3',
          'entryA4',
          'entryA5' ]
         */
        for(let i = 6; i <= 10; i ++) {
          log1 = await(Log.append(ipfs, log1, 'entryA' + i))
        }
        // console.log("4", log1.items.map(e => e.payload))
        /*
          [ 'entryA1',
            'entryA2',
            'entryA3',
            'entryA4',
            'entryA5',
            'entryA6',
            'entryA7',
            'entryA8',
            'entryA9',
            'entryA10' ]
         */

        log1 = Log.join(log1, log3)
        // console.log("5", log1.items.map(e => e.payload))

        for(let i = 11; i <= 15; i ++) {
          log1 = await(Log.append(ipfs, log1, 'entryA' + i))
        }
        // console.log("6", log1.items.map(e => e.payload))

        const expectedData = [ 
          'entryA1', 'entryB1', 'entryA2', 'entryB2', 
          'entryA3', 'entryB3', 'entryA4', 'entryB4', 
          'entryA5', 'entryB5',
          'entryA6', 'entryA7', 'entryA8', 'entryA9', 'entryA10',
          'entryA11', 'entryA12', 'entryA13', 'entryA14', 'entryA15' 
        ]

        assert.deepEqual(log1.items.map(e => e.payload), expectedData)
      }))

      it('retrieves randomly joined log deterministically', async(() => {
        let logA = Log.create('A')
        let logB = Log.create('B')
        let log = Log.create('log')

        for(let i = 1; i <= 5; i ++) {
          logA = await(Log.append(ipfs, logA, 'entryA' + i))
        }
        // console.log("1", log1.items.map(e => e.payload))
        /*
          [ 'entryA1', 'entryA2', 'entryA3', 'entryA4', 'entryA5' ]
         */

        for(let i = 1; i <= 5; i ++) {
          logB = await(Log.append(ipfs, logB, 'entryB' + i))
        }
        // console.log("2", log2.items.map(e => e.payload))
        /* 
          [ 'entryB1', 'entryB2', 'entryB3', 'entryB4', 'entryB5' ]
         */
        let log3 = Log.join(logA, logB)
        // console.log("33", log3.items.map(e => e.payload))
        /*
        [ 'entryB1',
          'entryB2',
          'entryB3',
          'entryB4',
          'entryB5',
          'entryA1',
          'entryA2',
          'entryA3',
          'entryA4',
          'entryA5' ]
         */

        for(let i = 6; i <= 10; i ++) {
          logA = await(Log.append(ipfs, logA, 'entryA' + i))
        }

        // console.log("33", log2.items.map(e => e.payload))
        /*
        [ 'entryA1',
          'entryA2',
          'entryA3',
          'entryA4',
          'entryA5',
          'entryA6',
          'entryA7',
          'entryA8',
          'entryA9',
          'entryA10' ]
         */
        // console.log("4", log1.items.map(e => e.payload))
        // console.log("ID", log.id, log3.id)
        log = Log.join(log, log3)
        // console.log(log.items.map(e => e.payload))
        log = await(Log.append(ipfs, log, 'entryC0'))
        /*
        [ 'entryA1',
          'entryA2',
          'entryA3',
          'entryA4',
          'entryA5',
          'entryB1',
          'entryB2',
          'entryB3',
          'entryB4',
          'entryB5',
          'entryC0' ]
         */
        log = Log.join(logA, log, 16)
        // console.log(log.items.map(e => e.payload))
        /*
        [ 'entryA1',
          'entryA2',
          'entryA3',
          'entryA4',
          'entryA5',
          'entryB1',
          'entryB2',
          'entryB3',
          'entryB4',
          'entryB5',
          'entryC0',
          'entryA6',
          'entryA7',
          'entryA8',
          'entryA9',
          'entryA10' ]
         */

        const expectedData = [ 
          'entryA1', 'entryB1', 'entryA2', 'entryB2', 
          'entryA3', 'entryB3', 'entryA4', 'entryB4', 
          'entryA5', 'entryB5',
          'entryC0',
          'entryA6', 'entryA7', 'entryA8', 'entryA9', 'entryA10',
        ]

        assert.deepEqual(log.items.map(e => e.payload), expectedData)
      }))

      it('sorts', async(() => {
        let testLog = await(LogCreator.createLog1(ipfs))
        let log = testLog.log
        const expectedData = testLog.expectedData

        const expectedData2 = [ 
          'entryA1', 'entryB1', 'entryA2', 'entryB2',
          'entryA3', 'entryB3', 'entryA4', 'entryB4', 
          'entryA5', 'entryB5',
          'entryA6', 'entryA7', 'entryA8', 'entryA9', 'entryA10',            
        ]

        const expectedData3 = [ 
          'entryA1', 'entryB1', 'entryA2', 'entryB2', 
          'entryA3', 'entryB3', 'entryA4', 'entryB4', 
          'entryA5', 'entryB5', 
          'entryC0',
          'entryA6', 'entryA7', 'entryA8', 'entryA9',
        ]

        const expectedData4 = [ 
          'entryA1', 'entryB1', 'entryA2', 'entryB2', 
          'entryA3', 'entryB3', 'entryA4', 'entryB4',
          'entryA5',
          'entryC0',
          'entryA6', 'entryA7', 'entryA8', 'entryA9', 'entryA10',
        ]

        let fetchOrder = EntryCollection.sort(log.items.slice())
        assert.deepEqual(fetchOrder.map(e => e.payload), expectedData)
        let reverseOrder = EntryCollection.sort(log.items.slice().reverse())
        assert.deepEqual(fetchOrder, reverseOrder)
        let randomOrder = EntryCollection.sort(log.items.slice().sort((a, b) => a.hash > b.hash))

        // partial data
        let partialLog = EntryCollection.sort(log.items.filter(e => e.payload !== 'entryC0'))
        assert.deepEqual(partialLog.map(e => e.payload), expectedData2)

        let partialLog2 = EntryCollection.sort(log.items.filter(e => e.payload !== 'entryA10'))
        assert.deepEqual(partialLog2.map(e => e.payload), expectedData3)

        let partialLog3 = EntryCollection.sort(log.items.filter(e => e.payload !== 'entryB5'))
        assert.deepEqual(partialLog3.map(e => e.payload), expectedData4)
      }))

      it('sorts 2', async(() => {
        let testLog = await(LogCreator.createLog100_2(ipfs))
        let log = testLog.log
        const expectedData = testLog.expectedData
        assert.deepEqual(log.items.map(e => e.payload), expectedData)
      }))

      it('retrieves partially joined log deterministically', async(() => {
        let logA = Log.create('A')
        let logB = Log.create('B')
        let log = Log.create('log')

        for(let i = 1; i <= 5; i ++) {
          logA = await(Log.append(ipfs, logA, 'entryA' + i))
        }

        for(let i = 1; i <= 5; i ++) {
          logB = await(Log.append(ipfs, logB, 'entryB' + i))
        }

        let log3 = Log.join(logA, logB)
        // console.log(log3.items.map(e => e.payload))
        /*
        [ 'entryB1',
          'entryB2',
          'entryB3',
          'entryB4',
          'entryB5',
          'entryA1',
          'entryA2',
          'entryA3',
          'entryA4',
          'entryA5' ]
         */

        for(let i = 6; i <= 10; i ++) {
          logA = await(Log.append(ipfs, logA, 'entryA' + i))
        }
        // console.log(log2.items.map(e => e.payload))
        /*
        [ 'entryA1',
          'entryA2',
          'entryA3',
          'entryA4',
          'entryA5',
          'entryA6',
          'entryA7',
          'entryA8',
          'entryA9',
          'entryA10' ]
         */

        log = Log.join(log, log3)
        log = await(Log.append(ipfs, log, 'entryC0'))
        // console.log(log.items.map(e => e.payload))
        /*
        [ 'entryA1',
          'entryA2',
          'entryA3',
          'entryA4',
          'entryA5',
          'entryB1',
          'entryB2',
          'entryB3',
          'entryB4',
          'entryB5',
          'entryC0' ]
         */

        log = Log.join(logA, log, -1)
        // console.log(log.items.map(e => e.payload))
        /*
        [ 'entryA1',
          'entryA2',
          'entryA3',
          'entryA4',
          'entryA5',
          'entryB1',
          'entryB2',
          'entryB3',
          'entryB4',
          'entryB5',
          'entryC0',
          'entryA6',
          'entryA7',
          'entryA8',
          'entryA9',
          'entryA10' ]
         */

        const mh = await(Log.toMultihash(ipfs, log))

        // First 5
        let res = await(Log.fromMultihash(ipfs, mh, 5))

        const first5 = [ 
          'entryA5', 'entryB5', 'entryC0', 'entryA9', 'entryA10',
        ]

        assert.deepEqual(res.items.map(e => e.payload), first5)

        // First 11
        res = await(Log.fromMultihash(ipfs, mh, 11))

        const first11 = [ 
          'entryA3', 'entryB3', 'entryA4', 'entryB4', 
          'entryA5', 'entryB5', 
          'entryC0',
          'entryA7', 'entryA8', 'entryA9', 'entryA10',
        ]

        assert.deepEqual(res.items.map(e => e.payload), first11)

        // All but one
        res = await(Log.fromMultihash(ipfs, mh, 16 - 1))

        const all = [ 
          'entryA1', 'entryB2', 'entryA2', 'entryB3', 'entryA3', 
          'entryB4', 'entryA4', 'entryB5', 'entryA5',
          /* excl */  
          'entryC0',
          'entryA6', 'entryA7', 'entryA8', 'entryA9', 'entryA10',
        ]

        assert.deepEqual(res.items.map(e => e.payload), all)
      }))

      it('throws an error if ipfs is not defined', () => {
        let err
        try {
          Log.fromEntry()
        } catch (e) {
          err = e
        }
        assert.notEqual(err, null)
        assert.equal(err.message, 'Ipfs instance not defined')
      })

      it('throws an error if ipfs is not defined', () => {
        let err
        try {
          await(Log.fromEntry())
        } catch (e) {
          err = e
        }
        assert.notEqual(err, null)
        assert.equal(err.message, 'Ipfs instance not defined')
      })
    })

    describe('heads', () => {
      it('finds one head after one item', async(() => {
        let log1 = Log.create()
        log1 = await(Log.append(ipfs, log1, "helloA1"))
        assert.equal(log1.heads.length, 1)
        assert.equal(log1.items.find((e) => e.hash === log1.heads[0]).hash, log1.heads[0])
      }))

      it('finds one head after two items', async(() => {
        let log1 = Log.create('A')

        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log1 = await(Log.append(ipfs, log1, "helloA2"))

        const heads = log1.heads
        assert.equal(heads.length, 1)
        assert.equal(log1.items.find((e) => e.hash === heads[0]).hash, log1.heads[0])
      }))

      it('finds head after a join and append', async(() => {
        let log1 = Log.create('A')
        let log2 = Log.create('B')

        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log1 = await(Log.append(ipfs, log1, "helloA2"))
        log2 = await(Log.append(ipfs, log2, "helloB1"))

        log2 = Log.join(log1, log2)
        log2 = await(Log.append(ipfs, log2, "helloB2"))
        const expectedHead = last(log2.items)

        assert.equal(log2.heads.length, 1)
        assert.deepEqual(log2.heads[0], expectedHead.hash)
      }))

      it('finds two heads after a join', async(() => {
        let log1 = Log.create('A')
        let log2 = Log.create('B')

        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log1 = await(Log.append(ipfs, log1, "helloA2"))
        const expectedHead1 = last(log1.items)

        log2 = await(Log.append(ipfs, log2, "helloB1"))
        log2 = await(Log.append(ipfs, log2, "helloB2"))
        const expectedHead2 = last(log2.items)

        log1 = Log.join(log1, log2)

        const heads = log1._heads
        assert.equal(heads.length, 2)
        assert.equal(heads[0], expectedHead1.hash)
        assert.equal(heads[1], expectedHead2.hash)
      }))

      it('finds two heads after two joins', async(() => {
        let log1 = Log.create('A')
        let log2 = Log.create('B')

        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log1 = await(Log.append(ipfs, log1, "helloA2"))
        log2 = await(Log.append(ipfs, log2, "helloB1"))
        log2 = await(Log.append(ipfs, log2, "helloB2"))
        log1 = Log.join(log1, log2)
        log2 = await(Log.append(ipfs, log2, "helloB3"))
        log1 = await(Log.append(ipfs, log1, "helloA3"))
        log1 = await(Log.append(ipfs, log1, "helloA4"))
        const expectedHead1 = last(log1.items)
        const expectedHead2 = last(log2.items)
        log1 = Log.join(log1, log2)

        const heads = log1._heads
        assert.equal(heads.length, 2)
        assert.equal(heads[0], expectedHead1.hash)
        assert.equal(heads[1], expectedHead2.hash)
      }))

      it('finds two heads after three joins', async(() => {
        let log1 = Log.create('A')
        let log2 = Log.create('B')
        let log3 = Log.create('C')

        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log1 = await(Log.append(ipfs, log1, "helloA2"))
        log2 = await(Log.append(ipfs, log2, "helloB1"))
        log2 = await(Log.append(ipfs, log2, "helloB2"))
        log1 = Log.join(log1, log2)
        log1 = await(Log.append(ipfs, log1, "helloA3"))
        log1 = await(Log.append(ipfs, log1, "helloA4"))
        const expectedHead1 = last(log1.items)
        log3 = await(Log.append(ipfs, log3, "helloC1"))
        log3 = await(Log.append(ipfs, log3, "helloC2"))
        log2 = Log.join(log2, log3)
        log2 = await(Log.append(ipfs, log2, "helloB3"))
        const expectedHead2 = last(log2.items)
        log1 = Log.join(log1, log2)

        const heads = log1._heads
        assert.equal(heads.length, 2)
        assert.equal(heads[0], expectedHead1.hash)
        assert.equal(heads[1], expectedHead2.hash)
      }))

      it('finds three heads after three joins', async(() => {
        let log1 = Log.create('A')
        let log2 = Log.create('B')
        let log3 = Log.create('C')

        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log1 = await(Log.append(ipfs, log1, "helloA2"))
        log2 = await(Log.append(ipfs, log2, "helloB1"))
        log2 = await(Log.append(ipfs, log2, "helloB2"))
        log1 = Log.join(log1, log2)
        log1 = await(Log.append(ipfs, log1, "helloA3"))
        log1 = await(Log.append(ipfs, log1, "helloA4"))
        const expectedHead1 = last(log1.items)
        log3 = await(Log.append(ipfs, log3, "helloC1"))
        log2 = await(Log.append(ipfs, log2, "helloB3"))
        log3 = await(Log.append(ipfs, log3, "helloC2"))
        const expectedHead2 = last(log2.items)
        const expectedHead3 = last(log3.items)
        log1 = Log.join(log1, log2)
        log1 = Log.join(log1, log3)

        const heads = log1.heads
        assert.equal(heads.length, 3)
        assert.deepEqual(heads[0], expectedHead1.hash)
        assert.deepEqual(heads[1], expectedHead2.hash)
        assert.deepEqual(heads[2], expectedHead3.hash)
      }))
    })

    describe('is a CRDT', () => {
      let log1, log2, log3

      beforeEach(async(() => {
        log1 = Log.create('A')
        log2 = Log.create('B')
        log3 = Log.create('C')
      }))

      it('join is associative', async(() => {
        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log1 = await(Log.append(ipfs, log1, "helloA2"))
        log2 = await(Log.append(ipfs, log2, "helloB1"))
        log2 = await(Log.append(ipfs, log2, "helloB2"))
        log3 = await(Log.append(ipfs, log3, "helloC1"))
        log3 = await(Log.append(ipfs, log3, "helloC2"))

        // a + (b + c)
        const logA1 = Log.join(log2, log3)
        const logA2 = Log.join(log1, logA1)

        const res1 = logA2.items.map((e) => e.hash).join(",")

        log1 = Log.create('A')
        log2 = Log.create('B')
        log3 = Log.create('C')
        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log1 = await(Log.append(ipfs, log1, "helloA2"))
        log2 = await(Log.append(ipfs, log2, "helloB1"))
        log2 = await(Log.append(ipfs, log2, "helloB2"))
        log3 = await(Log.append(ipfs, log3, "helloC1"))
        log3 = await(Log.append(ipfs, log3, "helloC2"))

        // (a + b) + c
        const logB1 = Log.join(log1, log2)
        const logB2 = Log.join(logB1, log3)

        const res2 = logB2.items.map((e) => e.hash).join(",")

        // associativity: a + (b + c) == (a + b) + c
        const len = (46 + 1) * 6- 1 // 46 == ipfs hash, +1 == .join(","), * 4 == number of items, -1 == last item doesn't get a ',' from .join
        assert.equal(res1.length, len)
        assert.equal(res2.length, len)
        assert.equal(res1, res2)
      }))

      it('join is commutative', async(() => {
        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log1 = await(Log.append(ipfs, log1, "helloA2"))
        log2 = await(Log.append(ipfs, log2, "helloB1"))
        log2 = await(Log.append(ipfs, log2, "helloB2"))

        // b + a
        const log3 = Log.join(log2, log1)
        const res1 = log3.items.map((e) => e.hash).join(",")

        log1 = Log.create('A')
        log2 = Log.create('B')
        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log1 = await(Log.append(ipfs, log1, "helloA2"))

        log2 = await(Log.append(ipfs, log2, "helloB1"))
        log2 = await(Log.append(ipfs, log2, "helloB2"))

        // a + b
        const log4 = Log.join(log1, log2)
        const res2 = log4.items.map((e) => e.hash).join(",")

        // commutativity: a + b == b + a
        const len = (46 + 1) * 4 - 1 // 46 == ipfs hash length, +1 == .join(","), * 4 == number of items, -1 == last item doesn't get a ',' from .join
        assert.equal(res1.length, len)
        assert.equal(res2.length, len)
        assert.equal(res1, res2)
      }))

      it('multiple joins are commutative', async(() => {
        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log1 = await(Log.append(ipfs, log1, "helloA2"))
        log2 = await(Log.append(ipfs, log2, "helloB1"))
        log2 = await(Log.append(ipfs, log2, "helloB2"))
        log3 = await(Log.append(ipfs, log3, "helloC1"))
        log3 = await(Log.append(ipfs, log3, "helloC2"))

        // b + a == a + b
        const logA1 = Log.join(log2, log1)
        const logA2 = Log.join(log1, log2)
        assert.equal(logA1.toString(), logA2.toString())

        // a + b == b + a
        const logB1 = Log.join(log1, log2)
        const logB2 = Log.join(log2, log1)
        assert.equal(logB1.toString(), logB2.toString())

        // a + c == c + a
        const logC1 = Log.join(log1, log3)
        const logC2 = Log.join(log3, log1)
        assert.equal(logC1.toString(), logC2.toString())

        // c + b == b + c
        const logD1 = Log.join(log3, log2)
        const logD2 = Log.join(log2, log3)
        assert.equal(logD1.toString(), logD2.toString())

        // a + b + c == c + b + a
        const logX1 = Log.join(log1, log2)
        const logX2 = Log.join(logX1, log3)
        const logY1 = Log.join(log3, log2)
        const logY2 = Log.join(logY1, log1)
        assert.equal(logY2.toString(), logX2.toString())
      }))

      it('join is idempotent', async(() => {
        let logA = Log.create('A')
        let logB = Log.create('B')
        logA = await(Log.append(ipfs, logA, "helloA1"))
        logA = await(Log.append(ipfs, logA, "helloA2"))
        logA = await(Log.append(ipfs, logA, "helloA3"))
        logB = await(Log.append(ipfs, logB, "helloA1"))
        logB = await(Log.append(ipfs, logB, "helloA2"))
        logB = await(Log.append(ipfs, logB, "helloA3"))

        // idempotence: a + a = a
        const log = Log.join(logA, logA)

        assert.equal(log.items.length, 3)
      }))
    })
  })

})
