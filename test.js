'use strict'

var test = require('tape').test
var persistence = require('./')
var abs = require('aedes-persistence/abstract')
var level = require('level')
var tempy = require('tempy')

function leveldb () {
  return level(tempy.directory())
}

abs({
  test: test,
  persistence: function () {
    return persistence(leveldb())
  }
})

test('restore', function (t) {
  var db = leveldb()
  var instance = persistence(db)
  var client = {
    id: 'abcde'
  }

  var subs = [{
    topic: 'hello',
    qos: 1
  }, {
    topic: 'hello/#',
    qos: 1
  }, {
    topic: 'matteo',
    qos: 1
  }]

  instance.addSubscriptions(client, subs, function (err) {
    t.notOk(err, 'no error')
    var instance2 = persistence(db)
    instance2.subscriptionsByTopic('hello', function (err, resubs) {
      t.notOk(err, 'no error')
      t.deepEqual(resubs, [{
        clientId: client.id,
        topic: 'hello/#',
        qos: 1
      }, {
        clientId: client.id,
        topic: 'hello',
        qos: 1
      }])
      instance.destroy(t.end.bind(t))
    })
  })
})

test('outgoing update after enqueuing a possible offline message', function (t) {
  var db = leveldb()
  var instance = persistence(db)
  var client = {
    clientId: 'abcde'
  }

  var client1 = {
    id: 'abcde'
  }

  var packet = {
    cmd: 'publish',
    brokerId: 'adasdasd',
    brokerCounter: 0,
    topic: 'test',
    payload: 'Return of the Jedi',
    messageId: 7
  }

  var updatePacket = {
    cmd: 'pubrel',
    messageId: 7
  }
  // Enqueue an offline packet
  instance.outgoingEnqueue(client, packet, function (err, packet1) {
    t.error(err)
    // When the client comes back online, aedes calls emptyQueue which calls outgoingUpdate
    instance.outgoingUpdate(client1, packet, function (err, client, packet) {
      t.notOk(err, 'no error')
      // When pubrel is published, outgoingUpdate is called again without the broker Id
      instance.outgoingUpdate(client, updatePacket, function (err, client, packet) {
        t.notOk(err, 'no error')
        instance.destroy(t.end.bind(t))
      })
    })
  })
})

test('Dont replace subscriptions with different QoS if client id is different', function (t) {
  var db = leveldb()
  var instance = persistence(db)
  var client = {
    id: 'test'
  }

  var client1 = {
    id: 'test.1'
  }

  var sub1 = [{
    topic: 'test/+/dev/#',
    qos: 2
  }]

  var sub2 = [{
    topic: 'test/television/dev/about',
    qos: 1
  }]

  instance.addSubscriptions(client, sub1, function (err) {
    t.notOk(err, 'no error')
    instance.addSubscriptions(client1, sub2, function (err) {
      t.notOk(err, 'no error')
      instance.subscriptionsByTopic('test/television/dev/about', function (err, resubs) {
        t.notOk(err, 'no error')
        t.deepEqual(resubs, [{
          topic: 'test/television/dev/about',
          clientId: 'test.1',
          qos: 1
        }, {
          topic: 'test/+/dev/#',
          clientId: 'test',
          qos: 2
        }])
        instance.destroy(t.end.bind(t))
      })
    })
  })
})

test('Replace subscriptions with different QoS if client id is same', function (t) {
  var db = leveldb()
  var instance = persistence(db)
  var client = {
    id: 'test'
  }

  var sub1 = [{
    topic: 'test/+/dev/#',
    qos: 2
  }]

  var sub2 = [{
    topic: 'test/television/dev/about',
    qos: 1
  }]

  instance.addSubscriptions(client, sub1, function (err) {
    t.notOk(err, 'no error')
    instance.addSubscriptions(client, sub2, function (err) {
      t.notOk(err, 'no error')
      instance.subscriptionsByTopic('test/television/dev/about', function (err, resubs) {
        t.notOk(err, 'no error')
        t.deepEqual(resubs, [{
          topic: 'test/television/dev/about',
          clientId: 'test',
          qos: 1
        }])
        instance.destroy(t.end.bind(t))
      })
    })
  })
})
