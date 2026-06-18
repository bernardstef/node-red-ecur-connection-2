module.exports = function (RED) {
    function configInverters (config) {
        RED.nodes.createNode(this, config)
        this.ip = config.ip
        this.port = config.port
        let node = this
        
        node.on('input', function (msg, send, done) {
            if(msg.payload === 'get') {
                send = send || function() { node.send.apply(node,arguments) }

                msg.payload = {
                    request: "get",
                    ip: node.ip,
                    port: node.port
                };
                send(msg);

                if (done) {
                    done();
                }
            }
            
        })
        
    }
    
    
    RED.nodes.registerType('inverters-config', configInverters)
}


