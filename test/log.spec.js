'use strict'

const _        = require('lodash')
const assert   = require('assert')
const async    = require('asyncawait/async')
const await    = require('asyncawait/await')
const IpfsApis = require('ipfs-test-apis')
const Log      = require('../src/log')
const Entry    = require('../src/entry')

let ipfs, ipfsDaemon

IpfsApis.forEach(function(ipfsApi) {

  describe('Log with ' + ipfsApi.name, function() {
    this.timeout(20000)
    before(async(() => {
      try {
        ipfs = await(ipfsApi.start())
      } catch(e) {
        console.log(e)
        assert.equal(e, null)
      }
    }))

    after(async(() => {
      await(ipfsApi.stop())
    }))

    describe('create', async(() => {
      it('creates an empty log', () => {
        const log = new Log(ipfs, 'A')
        assert.equal(log.id, 'A')
        assert.equal(log._items instanceof Array, true)
        assert.equal(log._items.length, 0)
        assert.equal(log._currentBatch instanceof Array, true)
        assert.equal(log._currentBatch.length, 0)
        assert.equal(log._ipfs, ipfs)
        assert.equal(log.hash, null)
      })

      it('throws an error if ipfs is not defined', async(() => {
        try {
          const log = new Log()
        } catch(e) {
          assert.equal(e.message, 'Ipfs instance not defined')
        }
      }))

      it('throws an error if id is not defined', async(() => {
        try {
          const log = new Log(ipfs)
        } catch(e) {
          assert.equal(e.message, 'id is not defined')
        }
      }))

      it('default maxHistory is 256', async(() => {
        const log = new Log(ipfs, 'A')
        assert.equal(log.options.maxHistory, 256)
      }))

      it('takes maxHistory as an option', async(() => {
        const log = new Log(ipfs, 'A', { maxHistory: 100 })
        assert.equal(log.options.maxHistory, 100)
      }))

      it('sets maxHistory if not provided in options', async(() => {
        const log = new Log(ipfs, 'A')
        assert.equal(log.options.maxHistory, 256)
      }))

      it('sets maxHistory if other options are provided', async(() => {
        const log = new Log(ipfs, 'A', { hello: "world" })
        assert.equal(log.options.maxHistory, 256)
      }))

    }))

    describe('serialize', async(() => {
      let log
      const expectedData = {
        id: "A",
        items: [
          'QmUrqiypsLPAWN24Y3gHarmDTgvW97bTUiXnqN53ySXM9V',
          'QmTRF2oGMG7L5yP6LU1bpy2DEdLTzkRByS9nshRkMAFhBy',
          'QmQG1rPMjt1RQPQTu6cJfSMSS8GddcSw9GxLkVtRB32pMD'
        ]
      }

      beforeEach(async(() => {
        log = new Log(ipfs, 'A')
        await(log.add("one"))
        await(log.add("two"))
        await(log.add("three"))
      }))

      describe('snapshot', async(() => {
        it('returns the current batch of items', async(() => {
          assert.equal(JSON.stringify(log.snapshot), JSON.stringify(expectedData))
        }))
      }))

      describe('getIpfsHash', async(() => {
        it('returns the log as ipfs hash', async(() => {
          const expectedHash = 'QmaRz4njJX2W8QYwWLa1jhEbYUdJhhqibsBbnRYuWgr1r7'
          const log = new Log(ipfs, 'A')
          const hash = await(Log.getIpfsHash(ipfs, log))
          assert.equal(hash, expectedHash)
        }))

        it('log serialized to ipfs contains the correct data', async(() => {
          const expectedData = { id: "A", items: [] }
          const log = new Log(ipfs, 'A')
          const hash = await(Log.getIpfsHash(ipfs, log))
          const res = await(ipfs.object.get(hash, { enc: 'base58' }))
          const result = JSON.parse(res.toJSON().Data)
          assert.equal(result.id, expectedData.id)
          assert.equal(result.items.length, expectedData.items.length)
        }))

        it('throws an error if ipfs is not defined', async(() => {
          try {
            const log = new Log(ipfs, 'A')
            const hash = await(Log.getIpfsHash(null, log))
          } catch(e) {
            assert.equal(e.message, 'Ipfs instance not defined')
          }
        }))
      }))

      describe('fromIpfsHash', async(() => {
        it('creates an empty log from ipfs hash', async(() => {
          const expectedData = { id: "A", items: [] }
          const log = new Log(ipfs, 'A')
          const hash = await(Log.getIpfsHash(ipfs, log))
          const res = await(Log.fromIpfsHash(ipfs, hash))
          assert.equal(JSON.stringify(res.snapshot), JSON.stringify(expectedData))
        }))

        it('creates a log from ipfs hash', async(() => {
          const hash = await(Log.getIpfsHash(ipfs, log))
          const res = await(Log.fromIpfsHash(ipfs, hash))
          assert.equal(res.items.length, 3)
          assert.equal(res.items[0].hash, expectedData.items[0])
          assert.equal(res.items[1].hash, expectedData.items[1])
          assert.equal(res.items[2].hash, expectedData.items[2])
        }))

        it('throws an error when data from hash is not instance of Log', async(() => {
          try {
            await(Log.fromIpfsHash(ipfs, 'QmUrqiypsLPAWN24Y3gHarmDTgvW97bTUiXnqN53ySXM9V'))
          } catch(e) {
            assert.equal(e.message, 'Not a Log instance')
          }
        }))

      }))
    }))

    describe('items', () => {
      it('returns all entrys in the log', async(() => {
        const log = new Log(ipfs, 'A')
        let items = log.items
        assert.equal(log.items instanceof Array, true)
        assert.equal(log.items.length, 0)
        await(log.add("hello1"))
        await(log.add("hello2"))
        await(log.add("hello3"))
        assert.equal(log.items instanceof Array, true)
        assert.equal(log.items.length, 3)
        assert.equal(log.items[0].payload, 'hello1')
        assert.equal(log.items[1].payload, 'hello2')
        assert.equal(log.items[2].payload, 'hello3')
        assert.equal(log._items.length, 0)
        assert.equal(log._currentBatch.length, 3)
      }))

      it('returns all entrys from current batch and all known entrys', async(() => {
        const log = new Log(ipfs, 'A')
        let items = log.items
        assert.equal(log.items instanceof Array, true)
        assert.equal(log.items.length, 0)
        await(log.add("hello1"))
        await(log.add("hello2"))
        log._commit()
        await(log.add("hello3"))

        assert.equal(log.items instanceof Array, true)
        assert.equal(log.items.length, 3)
        assert.equal(log.items[0].payload, 'hello1')
        assert.equal(log.items[1].payload, 'hello2')
        assert.equal(log.items[2].payload, 'hello3')
        assert.equal(log._items.length, 2)
        assert.equal(log._currentBatch.length, 1)
      }))
    })

    describe('add', () => {
      it('adds an item to an empty log', async(() => {
        const log = new Log(ipfs, 'A')
        await(log.add("hello1"))
        const item = log.items[0]
        assert.equal(log.items.length, 1)
        assert.equal(log._currentBatch.length, 1)
        assert.equal(log._items.length, 0)
        assert.equal(item, log._currentBatch[0])
        assert.equal(item.payload, 'hello1')
      }))

      it('adds 100 items to a log', async(() => {
        const log = new Log(ipfs, 'A')
        const amount = 100

        for(let i = 1; i <= amount; i ++) {
          await(log.add("hello" + i))
        }

        const last = _.last(log.items)
        assert.equal(log.items.length, amount)
        assert.equal(last.payload, 'hello' + amount)
        assert.notEqual(last.next.length, 0)
      }))

      it('commits the log after batch size was reached', async(() => {
        const log = new Log(ipfs, 'A')

        for(let i = 1; i <= Log.batchSize; i ++) {
          await(log.add("hello" + i))
        }

        assert.equal(log.items.length, Log.batchSize)
        assert.equal(log._currentBatch.length, Log.batchSize)
        assert.equal(log._items.length, 0)

        const item = _.last(log.items)
        assert.equal(log.items.length, Log.batchSize)
        assert.equal(item.payload, 'hello' + Log.batchSize)
        assert.notEqual(item.next.length, 0)
      }))
    })

    describe('join', () => {
      let log1, log2, log3, log4

      beforeEach(async(() => {
        log1 = new Log(ipfs, 'A')
        log2 = new Log(ipfs, 'B')
        log3 = new Log(ipfs, 'C')
        log4 = new Log(ipfs, 'D')
      }))

      it('throws an error if passed argument is not an instance of Log', async(() => {
        try {
          await(log1.join({}))
        } catch(e) {
          assert.equal(e.message, 'The log to join must be an instance of Log')
        }
      }))

      it('joins only unique items', async(() => {
        await(log1.add("helloA1"))
        await(log1.add("helloA2"))
        await(log2.add("helloB1"))
        await(log2.add("helloB2"))
        await(log1.join(log2))
        await(log1.join(log2))

        assert.equal(log1.items.length, 4)
        assert.equal(log1.items[0].hash, 'QmQjjAwSt8qQQTQ52Kt3qMvS5squGiiEvrSRrkxYYMY3k2')
        assert.equal(log1.items[1].hash, 'QmYFAWWAPXkyQuND7P8Fm2aLgTH7eAA44wYX8EeaYVGom9')
        assert.equal(log1.items[2].hash, 'QmZDQ6FGJ1dAUogJK73Hm9TZmTe9GYx6VJYNgnh7C3cTD1')
        assert.equal(log1.items[3].hash, 'Qmcn8T7WfjLd73tUpRRwYGtKc2UwdAD5sCfWYRepsbWUo3')

        const last = _.last(log1.items)
        assert.equal(last.next.length, 1)
        assert.equal(last.next[0], 'QmZDQ6FGJ1dAUogJK73Hm9TZmTe9GYx6VJYNgnh7C3cTD1')
      }))

      it('joins logs two ways', async(() => {
        await(log1.add("helloA1"))
        await(log1.add("helloA2"))
        await(log2.add("helloB1"))
        await(log2.add("helloB2"))
        await(log1.join(log2))
        await(log2.join(log1))

        const lastItem1 = _.last(log1.items)
        assert.equal(log1._currentBatch.length, 0)
        assert.equal(log1._items.length, 4)
        assert.equal(lastItem1.payload, 'helloB2')

        const lastItem2 = _.last(log2.items)
        assert.equal(log2._currentBatch.length, 0)
        assert.equal(log2._items.length, 4)
        assert.equal(lastItem2.payload, 'helloA2')
      }))

      it('joins logs twice', async(() => {
        await(log1.add("helloA1"))
        await(log2.add("helloB1"))
        await(log2.join(log1))
        await(log1.add("helloA2"))
        await(log2.add("helloB2"))
        await(log2.join(log1))

        const secondItem = log2.items[1]
        const lastItem = _.last(log2.items)

        assert.equal(log2._currentBatch.length, 0)
        assert.equal(log2._items.length, 4)
        assert.equal(secondItem.payload, 'helloA1')
        assert.equal(lastItem.payload, 'helloA2')
      }))

      it('joins 4 logs to one', async(() => {
        await(log1.add("helloA1"))
        await(log1.add("helloA2"))
        await(log2.add("helloB1"))
        await(log2.add("helloB2"))
        await(log3.add("helloC1"))
        await(log3.add("helloC2"))
        await(log4.add("helloD1"))
        await(log4.add("helloD2"))
        await(log1.join(log2))
        await(log1.join(log3))
        await(log1.join(log4))

        const secondItem = log1.items[1]
        const lastItem = _.last(log1.items)

        assert.equal(log1._currentBatch.length, 0)
        assert.equal(log1._items.length, 8)
        assert.equal(secondItem.payload, 'helloA2')
        assert.equal(lastItem.payload, 'helloD2')
      }))

      it.only('joins logs from 4 logs', async(() => {
        await(log1.add("helloA1"))
        await(log1.join(log2))
        await(log2.add("helloB1"))
        await(log2.join(log1))
        await(log1.add("helloA2"))
        await(log2.add("helloB2"))
        await(log1.join(log3))
        await(log3.join(log1))
        await(log3.add("helloC1"))
        await(log4.add("helloD1"))
        await(log3.add("helloC2"))
        await(log4.add("helloD2"))
        await(log1.join(log3))
        await(log1.join(log2))
        await(log4.join(log2))
        await(log4.join(log1))
        await(log4.join(log3))
        await(log4.add("helloD3"))
        await(log4.add("helloD4"))
        const secondItem = log4.items[1]
        const lastItem1 = _.last(log4.items)
        const lastItem2 = log4.items[log4.items.length - 5]
        // assert.equal(log4._currentBatch.length, 2)
        // console.log(log4.items)
        assert.equal(log4.items.length, 10)
        assert.equal(secondItem.payload, 'helloC2')
        assert.equal(lastItem1.payload, 'helloD4')
        assert.equal(lastItem2.payload, 'helloB2')
      }))

      it('fetches items from history on join', async(() => {
        const count = 32
        for(let i = 1; i < count + 1; i ++) {
          await(log1.add("first " + i))
          await(log2.add("second " + i))
        }

        const hash1 = await(Log.getIpfsHash(ipfs, log1))
        const hash2 = await(Log.getIpfsHash(ipfs, log2))

        const other1 = await(Log.fromIpfsHash(ipfs, hash1))
        const other2 = await(Log.fromIpfsHash(ipfs, hash2))
        await(log3.join(other1))

        assert.equal(_.includes(log3.items.map((a) => a.hash), undefined), false)
        assert.equal(log3.items.length, count)
        assert.equal(log3.items[0].payload, "first 1")
        assert.equal(_.last(log3.items).payload, "first " + count)

        await(log3.join(other2))
        assert.equal(log3.items.length, count * 2)
        assert.equal(log3.items[0].payload, "second 1")
        assert.equal(_.last(log3.items).payload, "second " + count)
      }))

      it('orders fetched items correctly', async(() => {
        const count = Log.batchSize * 3
        for(let i = 1; i < (count * 2) + 1; i ++)
          await(log1.add("first " + i))

        const hash1 = await(Log.getIpfsHash(ipfs, log1))
        const other1 = await(Log.fromIpfsHash(ipfs, hash1))
        await(log3.join(other1))

        assert.equal(log3.items[0].payload, "first 1")
        assert.equal(log3.items[log3.items.length - 1].payload, "first " + count * 2)
        assert.equal(log3.items.length, count * 2)

        // Second batch
        for(let i = 1; i < count + 1; i ++)
          await(log2.add("second " + i))

        const hash2 = await(Log.getIpfsHash(ipfs, log2))
        const other2 = await(Log.fromIpfsHash(ipfs, hash2))
        await(log3.join(other2))

        assert.equal(log3.items.length, count + count * 2)
        assert.equal(log3.items[0].payload, "second 1")
        assert.equal(log3.items[1].payload, "second 2")
        assert.equal(_.last(log3.items).payload, "second " + count)
      }))
    })

    describe('_fetchRecursive', () => {
      it('returns two items when neither are in the log', async(() => {
        const log1 = new Log(ipfs, 'A')
        const entry1 = await(Entry.create(ipfs, 'one'))
        const entry2 = await(Entry.create(ipfs, 'two', entry1))
        const items = await(log1._fetchRecursive(ipfs, entry2.hash, [], 1000, 0))
        assert.equal(items.length, 2)
        assert.equal(items[0].hash, 'QmUrqiypsLPAWN24Y3gHarmDTgvW97bTUiXnqN53ySXM9V')
        assert.equal(items[1].hash, 'QmTRF2oGMG7L5yP6LU1bpy2DEdLTzkRByS9nshRkMAFhBy')
      }))

      it('returns three items when none are in the log', async(() => {
        const log1 = new Log(ipfs, 'A')
        const entry1 = await(Entry.create(ipfs, 'one'))
        const entry2 = await(Entry.create(ipfs, 'two', entry1))
        const entry3 = await(Entry.create(ipfs, 'three', entry2))
        const items = await(log1._fetchRecursive(ipfs, entry3.hash, [], 1000, 0))
        assert.equal(items.length, 3)
        assert.equal(items[0].hash, 'QmUrqiypsLPAWN24Y3gHarmDTgvW97bTUiXnqN53ySXM9V')
        assert.equal(items[1].hash, 'QmTRF2oGMG7L5yP6LU1bpy2DEdLTzkRByS9nshRkMAFhBy')
        assert.equal(items[2].hash, 'QmQG1rPMjt1RQPQTu6cJfSMSS8GddcSw9GxLkVtRB32pMD')
      }))

      it('returns all items when none are in the log', async(() => {
        const log1 = new Log(ipfs, 'A')
        let entrys = []
        const amount = Log.batchSize * 4
        for(let i = 1; i <= amount; i ++) {
          const prev = _.last(entrys)
          const n = await(Entry.create(ipfs, 'entry' + i, prev))
          entrys.push(n)
        }

        const items = await(log1._fetchRecursive(ipfs, _.last(entrys).hash, [], 1000, 0))
        assert.equal(items.length, amount)
        assert.equal(items[0].hash, entrys[0].hash)
        assert.equal(_.last(items).hash, _.last(entrys).hash)
      }))

      it('returns only the items that are not in the log', async(() => {
        const log1 = new Log(ipfs, 'A')
        const entry1 = await(log1.add('one'))
        const entry2 = await(Entry.create(ipfs, 'two', entry1))
        const entry3 = await(Entry.create(ipfs, 'three', entry2))
        const allHashes = log1.items.map((a) => a.hash)
        const items = await(log1._fetchRecursive(ipfs, entry3.hash, allHashes, 1000, 0))
        assert.equal(items.length, 2)
        assert.equal(items[0].hash, 'QmTRF2oGMG7L5yP6LU1bpy2DEdLTzkRByS9nshRkMAFhBy')
        assert.equal(items[1].hash, 'QmQG1rPMjt1RQPQTu6cJfSMSS8GddcSw9GxLkVtRB32pMD')
      }))
    })

    describe('findHeads', () => {
      it('finds one head after one item', async(() => {
        const log1 = new Log(ipfs, 'A')
        const log2 = new Log(ipfs, 'B')
        const log3 = new Log(ipfs, 'C')

        await(log1.add("helloA1"))

        const heads = log1._heads
        assert.equal(heads.length, 1)
        assert.equal(heads[0], 'QmQjjAwSt8qQQTQ52Kt3qMvS5squGiiEvrSRrkxYYMY3k2')
      }))

      it('finds one head after two items', async(() => {
        const log1 = new Log(ipfs, 'A')
        const log2 = new Log(ipfs, 'B')
        const log3 = new Log(ipfs, 'C')

        await(log1.add("helloA1"))
        await(log1.add("helloA2"))

        const heads = log1._heads
        assert.equal(heads.length, 1)
        assert.equal(heads[0], 'QmYFAWWAPXkyQuND7P8Fm2aLgTH7eAA44wYX8EeaYVGom9')
      }))

      it('finds two heads after a join', async(() => {
        const log1 = new Log(ipfs, 'A')
        const log2 = new Log(ipfs, 'B')

        await(log1.add("helloA1"))
        const expectedHead1 = await(log1.add("helloA2"))

        await(log2.add("helloB1"))
        const expectedHead2 = await(log2.add("helloB2"))

        await(log1.join(log2))

        const heads = log1._heads
        assert.equal(heads.length, 2)
        assert.equal(heads[0], expectedHead2.hash)
        assert.equal(heads[1], expectedHead1.hash)
      }))

      it('finds one head after two joins', async(() => {
        const log1 = new Log(ipfs, 'A')
        const log2 = new Log(ipfs, 'B')

        await(log1.add("helloA1"))
        await(log1.add("helloA2"))
        await(log2.add("helloB1"))
        await(log2.add("helloB2"))
        await(log1.join(log2))
        await(log1.add("helloA3"))
        const expectedHead = await(log1.add("helloA4"))
        await(log1.join(log2))

        const heads = log1._heads
        assert.equal(heads.length, 1)
        assert.equal(heads[0], expectedHead.hash)
      }))

      it('finds two heads after three joins', async(() => {
        const log1 = new Log(ipfs, 'A')
        const log2 = new Log(ipfs, 'B')
        const log3 = new Log(ipfs, 'C')

        await(log1.add("helloA1"))
        await(log1.add("helloA2"))
        await(log2.add("helloB1"))
        await(log2.add("helloB2"))
        await(log1.join(log2))
        await(log1.add("helloA3"))
        const expectedHead1 = await(log1.add("helloA4"))
        await(log3.add("helloC1"))
        await(log3.add("helloC2"))
        await(log2.join(log3))
        const expectedHead2 = await(log2.add("helloB3"))
        await(log1.join(log2))

        const heads = log1._heads
        assert.equal(heads.length, 2)
        assert.equal(heads[0], expectedHead2.hash)
        assert.equal(heads[1], expectedHead1.hash)
      }))

      it('finds three heads after three joins', async(() => {
        const log1 = new Log(ipfs, 'A')
        const log2 = new Log(ipfs, 'B')
        const log3 = new Log(ipfs, 'C')

        await(log1.add("helloA1"))
        await(log1.add("helloA2"))
        await(log2.add("helloB1"))
        await(log2.add("helloB2"))
        await(log1.join(log2))
        await(log1.add("helloA3"))
        const expectedHead1 = await(log1.add("helloA4"))
        await(log3.add("helloC1"))
        const expectedHead2 = await(log2.add("helloB3"))
        const expectedHead3 = await(log3.add("helloC2"))
        await(log1.join(log2))
        await(log1.join(log3))

        const heads = log1._heads
        assert.equal(heads.length, 3)
        assert.equal(heads[0], expectedHead3.hash)
        assert.equal(heads[1], expectedHead2.hash)
        assert.equal(heads[2], expectedHead1.hash)
      }))
    })

    describe('isReferencedInChain', () => {
      it('returns true if another entry in the log references the given entry', async(() => {
        const log = new Log(ipfs, 'A')
        const entry1 = await(log.add('one'))
        const entry2 = await(log.add('two'))
        const res = Log.isReferencedInChain(log, entry1)
        assert.equal(res, true)
      }))

      it('returns false if no other entry in the log references the given entry', async(() => {
        const log = new Log(ipfs, 'A')
        const entry1 = await(log.add('one'))
        const entry2 = await(log.add('two'))
        const res = Log.isReferencedInChain(log, entry2)
        assert.equal(res, false)
      }))
    })

    describe('_commit', () => {
      it('moves entrys from current batch to all known entrys', async(() => {
        const log = new Log(ipfs, 'A')
        const entry1 = await(log.add('one'))
        const entry2 = await(log.add('two'))

        assert.equal(log._items.length, 0)
        assert.equal(log._currentBatch.length, 2)

        log._commit()

        assert.equal(log._items.length, 2)
        assert.equal(log._currentBatch.length, 0)
      }))
    })

    describe('_insert', () => {
      it('insert entry to the log before current batch if parent is in current bathc', async(() => {
        const log = new Log(ipfs, 'A')
        const entry1 = await(log.add('one'))
        const entry2 = await(log.add('two'))
        const entry3 = await(Entry.create(ipfs, 'three', entry1))
        log._insert(entry3)
        assert.equal(log.items.length, 3)
        assert.equal(log.items[0].payload, 'three')
        assert.equal(log._items.length, 1)
        assert.equal(log._items[0].payload, 'three')
      }))

      it('insert to the log after the parent when parent is not in the current batch', async(() => {
        const log = new Log(ipfs, 'A')
        const entry1 = await(log.add('one'))
        const entry2 = await(log.add('two'))
        const entry3 = await(Entry.create(ipfs, 'three', entry1))
        log._commit()
        log._insert(entry3)
        assert.equal(log.items.length, 3)
        assert.equal(log.items[1].payload, 'three')
      }))
    })

    describe('is a CRDT', () => {
      let log1, log2, log3

      beforeEach(async(() => {
        log1 = new Log(ipfs, 'A')
        log2 = new Log(ipfs, 'B')
        log3 = new Log(ipfs, 'C')
      }))

      it('join is associative', async(() => {
        await(log1.add("helloA1"))
        await(log1.add("helloA2"))
        await(log2.add("helloB1"))
        await(log2.add("helloB2"))
        await(log3.add("helloC1"))
        await(log3.add("helloC2"))

        // a + (b + c)
        await(log2.join(log3))
        await(log1.join(log2))

        const res1 = log1.items.map((e) => e.hash).join(",")

        log1 = new Log(ipfs, 'A')
        log2 = new Log(ipfs, 'B')
        log3 = new Log(ipfs, 'C')
        await(log1.add("helloA1"))
        await(log1.add("helloA2"))
        await(log2.add("helloB1"))
        await(log2.add("helloB2"))
        await(log3.add("helloC1"))
        await(log3.add("helloC2"))

        // (a + b) + c
        await(log1.join(log2))
        await(log1.join(log3))

        const res2 = log1.items.map((e) => e.hash).join(",")

        // associativity: a + (b + c) == (a + b) + c
        const len = (46 + 1) * 6- 1 // 46 == ipfs hash, +1 == .join(","), * 4 == number of items, -1 == last item doesn't get a ',' from .join
        assert.equal(res1.length, len)
        assert.equal(res2.length, len)
        assert.equal(res1, res2)
      }))

      it('join is commutative', async(() => {
        await(log1.add("helloA1"))
        await(log1.add("helloA2"))
        await(log2.join(log1))
        await(log2.add("helloB1"))
        await(log2.add("helloB2"))

        // b + a
        await(log2.join(log1))

        const res1 = log2.items.map((e) => e.hash).join(",")

        log1 = new Log(ipfs, 'A')
        log2 = new Log(ipfs, 'B')
        await(log1.add("helloA1"))
        await(log1.add("helloA2"))
        await(log2.join(log1))
        await(log2.add("helloB1"))
        await(log2.add("helloB2"))

        // a + b
        await(log1.join(log2))

        const res2 = log1.items.map((e) => e.hash).join(",")

        // commutativity: a + b + c == b + a + c
        const len = (46 + 1) * 4 - 1 // 46 == ipfs hash length, +1 == .join(","), * 4 == number of items, -1 == last item doesn't get a ',' from .join
        assert.equal(res1.length, len)
        assert.equal(res2.length, len)
        assert.equal(res1, res2)
      }))


      it('join is idempotent', async(() => {
        await(log1.add("helloA1"))
        await(log1.add("helloA2"))
        await(log1.add("helloA3"))
        await(log2.add("helloA1"))
        await(log2.add("helloA2"))
        await(log2.add("helloA3"))

        // idempotence: a + a = a
        await(log1.join(log2))

        assert.equal(log1.id, 'A')
        assert.equal(log1.items.length, 3)
      }))
    })
  })

})
