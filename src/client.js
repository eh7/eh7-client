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

/*
      node.dialProtocol(peer.id,'/eh7/chat',(err,conn) => {
        if(err) console.log(err)
        else {
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
*/

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

