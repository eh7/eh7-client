'use strict'

if(!process.argv[2]){
  console.log("USAGE: node src/client.js ", "<path to swarm.key>")
  process.exit(1)
}

//const Libp2pNode = require('./libp2p-bundle.js')

const libp2p = require('libp2p')
const Ping = require('libp2p/src/ping')
const TCP = require('libp2p-tcp')
const Mplex = require('libp2p-mplex')
const SECIO = require('libp2p-secio')
const Bootstrap = require('libp2p-bootstrap')
const Gossipsub = require('libp2p-gossipsub')
const defaultsDeep = require('@nodeutils/defaults-deep')

const fs = require('fs')
const Protector = require('libp2p/src/pnet')
const swarmKey = fs.readFileSync(process.argv[2])
//console.log(swarmKey)
const protector = new Protector(swarmKey)
//console.log(protector)
//process.exit()

const PeerInfo = require('peer-info')
const PeerId   = require('peer-id')
const pull = require('pull-stream')
const Pushable = require('pull-pushable')
const p = Pushable()

const gpioConfig = require("../conf/gpioConfig")

const bootstrapers = [
//  '/ip4/192.168.1.12/tcp/10333/ipfs/QmZiicp2DZuf9Xc9mNiMkc3hiDz4KipoiNzFZbhxLK9Do1',
//  '/ip4/10.0.0.10/tcp/10333/ipfs/QmZiicp2DZuf9Xc9mNiMkc3hiDz4KipoiNzFZbhxLK9Do1'
  '/ip4/10.0.0.4/tcp/10333/ipfs/QmZiicp2DZuf9Xc9mNiMkc3hiDz4KipoiNzFZbhxLK9Do1'
]


class Libp2pNode extends libp2p {
  constructor (_options) {
    const defaults = {
      switch: {
        denyTTL: 5000,
        denyAttempts: 10
      },
      modules: {
        transport: [ TCP ],
        streamMuxer: [ Mplex ],
        connEncryption: [ SECIO ],
        peerDiscovery: [ Bootstrap ],
        pubsub: Gossipsub,
        connProtector: protector
      },
      config: {
        peerDiscovery: {
          autoDial: true,
          bootstrap: {
//            interval: 20e3,
            interval: 30000,
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

  ping (remotePeerInfo, callback) {
    const p = new Ping(this._switch, remotePeerInfo)
    p.on('ping', time => {
      p.stop() // stop sending pings
      callback(null, time)
    })
    p.on('error', callback)
    p.start()
  }
}


function pingRemotePeer(localPeer, remotePeerInfo) {
  console.log("ping remote host local: ", localPeer.peerInfo.id.toB58String())
  console.log("ping remote host remote: ", remotePeerInfo.id.toB58String())
//console.log(remotePeerInfo.multiaddrs)
//  const remoteAddr = multiaddr(process.argv[2])
//  console.log('pinging remote peer at ', .toString())
  
/*
  // Convert the multiaddress into a PeerInfo object
  const peerId = PeerId.createFromB58String(remoteAddr.getPeerId())
  const remotePeerInfo = new PeerInfo(peerId)
  remotePeerInfo.multiaddrs.add(remoteAddr)
*/


  console.log('pinging remote peer at ')//, remoteAddr.toString())
  localPeer.ping(remotePeerInfo, (err, time) => {
    if (err) {
      return console.error('error pinging: ', err)
    }
//    console.log(`pinged ${remoteAddr.toString()} in ${time}ms`)
    console.log(`pinged ${remotePeerInfo.id.toB58String()} in ${time}ms`)
  })
}


const nodeId = require('./peer-id-dialer.json')

let node

//PeerId.createFromJSON(nodeId,(err,nodeId) => {
PeerId.create((err,nodeId) => {
  if(err) console.log(err)
  else {
    const nodeInfo = new PeerInfo(nodeId)
    nodeInfo.multiaddrs.add('/ip4/0.0.0.0/tcp/0')

    node = new Libp2pNode({
      peerInfo: nodeInfo
    })

    node.handle('/eh7/getConfig/0.0.1', (protocol, conn) => {
      console.log("handled /eh7/getConfig/0.0.1")
      pull(
        conn,
        pull.map((data) => {
          return data.toString('utf8').replace('\n', '')
        }),
        pull.drain((cmd) => {
	  console.log("sending config")
          pull(
            pull.values([JSON.stringify(gpioConfig)]),
            conn
          )
//          var exec = require('child_process').exec;

//          exec(cmd, function callback(error, stdout, stderr){
//            console.log("exec stdout-> ", error, stdout, stderr)
//            pull(
//              pull.values([stdout]),
//              conn
//            )
//          })
        })
      )
/*
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
*/
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
console.log(node)
      }
    })

    node.on('connection:start', (peer) => {console.log('Connection started:', peer.id.toB58String())})
    node.on('connection:end', (peer) => {console.log('Connection ended:', peer.id.toB58String())})

    node.on('error', (err) => {
      console.log('Error: ', err)
    })

    node.on('peer:discovery', (peer) => {
      console.log('Connection discovered to:', peer.id.toB58String())
//      console.log(node.stats.peers())
//      console.log(node.peerBook)
      pingRemotePeer(node, peer)
/*
      node.ping(peer, (err,ping) => {
        if(err)
          console.log(err)
        console.log("ping: ", ping)
      })
*/

//      node.hangUp(peer, (err) => {
//        console.log("hu: ", err)

//        node.dial(peer, (err, conn) => {
//          console.log(err)
//        })

//      })
//      node.dial(peer.id, (err, conn) => {
//        if(err)
//          console.log("Dialed to peer err " + err)
//        console.log("Dialed to peer " + peer.id.toB58String())
//      })
      // No need to dial, autoDial is on
//      console.log('Discovered:', peer.id.toB58String())
//      node.pubsub.publish('info', Buffer.from('discovered ' +  peer.id.toB58String() + ' here!!!'), (err) => {if(err)console.log(err)})
    })

    node.on('peer:connect', (peer) => {
      console.log('Connection established to:', peer.id.toB58String())

/*
      node.dialProtocol(peer.id,'/eh7/bootHello/0.0.1',(err,conn) => {
        if(err) console.log(err)
        else {
          console.log("dial to '/eh7/bootHello/0.0.1' :: "  + gpioConfig)
          pull(
            pull.values([JSON.stringify(gpioConfig)]),
            conn,
            pull.collect((err, data) => {
              if (err) { throw err }
              console.log('data received: ', data.toString())
            })
          )
        }
      })
*/

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

