module.exports = function (RED) {
    const apsystems = require('./index.js')
    
    function getInverters (ecur, id, callback) {
        ecur.queryInverters(id, function (err, result) {
            if (err) {
                callback(console.error('Error occurred: ' + err))
            } else {
                callback(result)
            }
        })
    }

    function queryInverters (config) {
        RED.nodes.createNode(this, config)
        let node = this
        node.on('input', function (msg, send, done) {
            if(msg.payload.request && msg.payload.request === 'get') {
                const ecur = new apsystems.ECUR(msg.payload.ip, msg.payload.port)

                ecur.getECUdata(function (err, result) {
                    if (err) {
                        return console.error('Error occurred: ' + err)
                    } else {
                        const id = result.ecu_id
                        getInverters(ecur, id, function (results) {
                            msg.payload = {info: result, inverters: results}
                            send(msg)
                            if (done) {
                                done()
                            }
                        })
                    }
                })
            }
            
        })
        
    }
    
    
    RED.nodes.registerType('inverters-query', queryInverters)
}


