'use strict'

//const Libp2pNode = require('./libp2p-bundle.js')

const libp2p = require('libp2p')
const TCP = require('libp2p-tcp')
const Mplex = require('libp2p-mplex')
const SECIO = require('libp2p-secio')
const Bootstrap = require('libp2p-bootstrap')
const Gossipsub = require('libp2p-gossipsub')
const defaultsDeep = require('@nodeutils/defaults-deep')

const PeerInfo = require('peer-info')
const PeerId   = require('peer-id')
const pull = require('pull-stream')
const Pushable = require('pull-pushable')
const p = Pushable()

const bootstrapers = [
//  '/ip4/192.168.1.12/tcp/10333/ipfs/QmZiicp2DZuf9Xc9mNiMkc3hiDz4KipoiNzFZbhxLK9Do1',
  '/ip4/10.0.0.10/tcp/10333/ipfs/QmZiicp2DZuf9Xc9mNiMkc3hiDz4KipoiNzFZbhxLK9Do1'
]


class Libp2pNode extends libp2p {
  constructor (_options) {
    const defaults = {
      modules: {
        transport: [ TCP ],
        streamMuxer: [ Mplex ],
        connEncryption: [ SECIO ],
        peerDiscovery: [ Bootstrap ],
        pubsub: Gossipsub
      },
      config: {
        peerDiscovery: {
          autoDial: true,
          bootstrap: {
            interval: 20e3,
            enabled: true,
            list: bootstrapers
          }
        },
        pubsub: {
          enabled: true,
          emitSelf: true
        }
      }
    }

    super(defaultsDeep(_options, defaults))
  }
}


const nodeId = require('./peer-id-dialer.json')

let node

PeerId.createFromJSON(nodeId,(err,nodeId) => {
//PeerId.create((err,nodeId) => {
//const nodeId = PeerId.create((err,nodeId) => {
  if(err) console.log(err)
  else {
    const nodeInfo = new PeerInfo(nodeId)
    nodeInfo.multiaddrs.add('/ip4/0.0.0.0/tcp/0')

    node = new Libp2pNode({
      peerInfo: nodeInfo
    })

    node.handle('/eh7/cmd/0.0.1', (protocol, conn) => {
      console.log("handled /eh7/cmd/0.0.1")
      pull(
        conn,
        pull.map((data) => {
          return data.toString('utf8').replace('\n', '')
        }),
        pull.drain((cmd) => {
	  console.log("cmd sent to me: " + cmd)
          var exec = require('child_process').exec;
          exec(cmd, function callback(error, stdout, stderr){
            console.log("exec stdout-> ", error, stdout, stderr)
            pull(
              pull.values([stdout]),
              conn
            )
          })
        })
      )

    })
 
    node.start((err) => {
      if(err) console.log(err)
      else {
        console.log("Node Started, listening on:")
        nodeInfo.multiaddrs.forEach((ma) => {
          console.log(ma.toString())
        })
        node.pubsub.subscribe('info',(msg) => {
          console.log(`PUBSUB) -> recieved:  ${msg.data.toString()}`)
        })
        console.log("Node listening on 'info' pubsub channel.")
      }
    })

    node.on('peer:discovery', (peer) => {
      // No need to dial, autoDial is on
//      console.log('Discovered:', peer.id.toB58String())
//      node.pubsub.publish('info', Buffer.from('discovered ' +  peer.id.toB58String() + ' here!!!'), (err) => {if(err)console.log(err)})
    })

    node.on('peer:connect', (peer) => {
      console.log('Connection established to:', peer.id.toB58String())

      node.dialProtocol(peer.id,'/eh7/chat',(err,conn) => {
        if(err) console.log(err)
        else {
/*
          pull(
            pull.values(["hello big"]),
            conn
          )
*/
          console.log("(node) dialed to bootNode '/eh7/chat' -> hello")
         console.log('node dialed to bootNode on protocol: /eh7/chat')
          console.log('Type a message and see what happens')
          // Write operation. Data sent as a buffer
          pull(
            p,
            conn
          )
          // Sink, data converted from buffer to utf8 string
          pull(
            conn,
            pull.map((data) => {
              return data.toString('utf8').replace('\n', '')
            }),
            pull.drain(console.log)
          )

          process.stdin.setEncoding('utf8')
          process.openStdin().on('data', (chunk) => {
            var data = chunk.toString()
            p.push(data)
          })
        }
      })

/*
      var exec = require('child_process').exec;
      exec('ls', function callback(error, stdout, stderr){
        // result
        console.log("exec stdout-> ", error, stdout, stderr)
      })
*/

    })

    node.on('peer:disconnect', (peer) => {
      console.log("peer:disconnect: ", peer.id.toB58String())
//      node.pubsub.publish('info', Buffer.from('by boot server from ' +  peer.id.toB58String() + ' here!!!'), (err) => {if(err)console.log(err)})
    })

  }
})

// _options.bootstrapList

/*
PeerId.createFromJSON(bootNode0Id,(err,bootNodeId) => {
  if(err) console.log(err)
  else {

    const bootNodeInfo = new PeerInfo(bootNodeId)
    bootNodeInfo.multiaddrs.add('/ip4/0.0.0.0/tcp/10333')
    var bootNode = new Libp2pNode({
      peerInfo: bootNodeInfo
    })

    bootNode.handle('/eh7/chat', (protocol, conn) => {
      console.log("chat request to listener")
    })

    bootNode.on('peer:discovery', (peer) => {
//      console.log("peer:discovery: ", peer)
    })

    bootNode.on('peer:connect', (peer) => {
      console.log("peer:connect: ", peer)
    })

    bootNode.on('peer:disconnect', (peer) => {
      console.log("peer:disconnect: ", peer)
    })

    bootNode.start((err) => {
      if(err) {
        console.log(err.message)
        process.exit(1)
      } else {
        console.log('Boot Node ready, listening on:')
        bootNodeInfo.multiaddrs.forEach((ma) => {
          console.log(ma.toString())
        })
      }
    })
  }
})
*/

/*
PeerId.createFromJSON(require('./peer-id-dialer'),(err,dialerPeerId) => {

  PeerId.createFromJSON(require('./peer-id-listener'),(err,listenerPeerId) => {

    const listenerPeerInfo = new PeerInfo(listenerPeerId)
    listenerPeerInfo.multiaddrs.add('/ip4/0.0.0.0/tcp/10333')
    var listenerNode = new Libp2pNode({
      peerInfo: listenerPeerInfo
    })

    listenerNode.handle('/eh7/chat', (protocol, conn) => {
      console.log("chat request to listener")
    })

    listenerNode.start((err) => {
//      console.log(err)

      console.log('Listener ready, listening on:')

      listenerPeerInfo.multiaddrs.forEach((ma) => {
        console.log(ma.toString())
      })

      const dialerPeerInfo = new PeerInfo(dialerPeerId)
      dialerPeerInfo.multiaddrs.add('/ip4/0.0.0.0/tcp/0')
      var dialerNode = new Libp2pNode({
        peerInfo: dialerPeerInfo
      })

      dialerNode.start((err) => {
        if(err) {
          console.log(err.message)
          process.exit(1)
        } else {
          console.log('Dialer ready.')
          dialerPeerInfo.multiaddrs.forEach((ma) => {
            console.log(ma.toString())
          })

          console.log('Dialing Listener...')

          dialerNode.dialProtocol(listenerNode.peerInfo,'/eh7/chat',(err,conn) => {
             if(err) console.log(err)
             else {
               console.log("sending tx return")
               pull(
                 pull.values(["hello big"]),
                 conn
               )
              console.log("(dialerNode) dialed to listener '/eh7/chat' -> hello")
            }
          })

        }
      })
    })
  })

})
*/
