const tcpSock = require('net')

/**
 * @class
 */
class ECUR {
    /**
     * @constructor
     *
     * @param {String} host - Host used for TCP connection
     * @param {Integer} port - Port used for TCP connection
     */
    constructor (host, port) {
        this.host = host
        this.port = port

        // TCP socket
        this.socket = null

        // ECU-R cmd's
        this.cmd_end = 'END\n'
        this.ecu_query = 'APS1100160001'
        this.ecu_id = undefined
        this.inverter_query_prefix = 'APS1100280002'
        this.inverter_signal_prefix = 'APS1100280030'
    }

    /**
     * Open TCP socket connection
     *
     * @param {Function} callback
     */
    connect (callback) {
        const self = this

        // Create a fresh socket for each request
        this.socket = new tcpSock.Socket()

        this.socket.connect(this.port, this.host, function () {
            callback(null)
        })

        this.socket.on('error', function (error) {
            if (self.socket) {
                try {
                    self.socket.destroy()
                } catch (e) {
                    // ignore
                }
            }

            self.socket = null
            callback(error)
        })
    }

    /**
     * Send CMD to tcp socket
     *
     * @param {String} cmd - Command to send
     * @param {Function} callback - function when data is written
     */
    write (cmd, callback) {
        const self = this

        this.connect(function (error) {
            if (error) return callback(error, null)

            self.socket.write(cmd, callback)
        })
    }

    /**
     * Get general ECU data
     *
     * @param {Function} callback - function when data is received and parsed
     */
    getECUdata (callback) {
        const cmd = this.ecu_query + this.cmd_end
        const self = this

        this.write(cmd, function (error) {
            if (error) return callback(error, null)

            const ecuDataEvent = (data) => {
                try {
                    const ecuData = self.parseECUData(data)

                    self.socket.prependOnceListener('close', function () {
                        self.socket.off('data', ecuDataEvent)
                        callback(null, ecuData)
                    })

                    self.socket.destroy()
                    self.socket.end()
                } catch (e) {
                    error = 'Failed to parse TCP data: ' + e
                    self.socket.end()

                    return callback(error)
                }
            }

            self.socket.on('data', ecuDataEvent)
        })
    }

    parseECUData (data) {
        let ecuData = {}

        if (this.apsStr(data, 9, 4) === '0001') {
            ecuData.ecu_id = this.apsStr(data, 13, 12)
            ecuData.lifetime_energy = this.apsDouble(data, 27) / 10
            ecuData.current_power = this.apsDouble(data, 31)
            ecuData.today_energy = this.apsDouble(data, 35) / 100

            if (this.apsStr(data, 25, 2) === '01') {
                ecuData.qty_of_inverters = this.apsInt(data, 46)
                ecuData.qty_of_online_inverters = this.apsInt(data, 48)
                ecuData.vsl = Number.parseInt(this.apsStr(data, 52, 3))
                ecuData.firmware = this.apsStr(data, 55, ecuData.vsl)
                ecuData.tsl = Number.parseInt(this.apsStr(data, 55 + ecuData.vsl, 3))
                ecuData.timezone = this.apsStr(data, 58 + ecuData.vsl, ecuData.tsl)
            } else if (this.apsStr(data, 25, 2) === '02') {
                ecuData.qty_of_inverters = this.apsInt(data, 39)
                ecuData.qty_of_online_inverters = this.apsInt(data, 41)
                ecuData.vsl = Number.parseInt(this.apsStr(data, 49, 3))
                ecuData.firmware = this.apsStr(data, 52, ecuData.vsl)
            }
        }

        return ecuData
    }

    queryInverters (id, callback) {
        this.getInvertersData(id, (err1, data) => {
            if (err1) return callback(err1, null)

            this.getInvertersSignal(id, (err2, signal) => {
                if (err2) return callback(err2, null)

                return callback(null, this.parseInvertersData(data, signal))
            })
        })
    }

    getInvertersData (id, callback) {
        const cmd = this.inverter_query_prefix + id + this.cmd_end
        const self = this

        this.write(cmd, function (error) {
            if (error) return callback(error, null)

            const invertersDataEvent = (data) => {
                try {
                    self.socket.prependOnceListener('close', function () {
                        self.socket.off('data', invertersDataEvent)
                        callback(null, data)
                    })

                    self.socket.destroy()
                    self.socket.end()
                } catch (e) {
                    error = 'Failed to parse TCP inverters query data: ' + e
                    self.socket.end()

                    return callback(error)
                }
            }

            self.socket.on('data', invertersDataEvent)
        })
    }

    getInvertersSignal (id, callback) {
        const cmd = this.inverter_signal_prefix + id + this.cmd_end
        const self = this

        this.write(cmd, function (error) {
            if (error) return callback(error, null)

            const invertersSignalEvent = (data) => {
                try {
                    self.socket.prependOnceListener('close', function () {
                        self.socket.off('data', invertersSignalEvent)
                        callback(null, data)
                    })

                    self.socket.destroy()
                    self.socket.end()
                } catch (e) {
                    error = 'Failed to parse TCP inverters signal data: ' + e
                    self.socket.end()

                    return callback(error)
                }
            }

            self.socket.on('data', invertersSignalEvent)
        })
    }

    parseInvertersData (data, signal) {
        if (this.apsStr(data, 9, 4) === '0002' && this.apsStr(data, 14, 2) === '00') {
            const timestamp = this.apsTimestamp(data, 19, 14)
            const inverterQty = this.apsInt(data, 17)

            let signalData = {}
            let inverters = {}
            let cnt1 = 0
            let cnt2 = 26

            if (this.apsStr(signal, 9, 4) === '0030') {
                let location = 15

                for (let i = 0; i < inverterQty; i++) {
                    const uid = this.apsUid(signal, location)

                    location += 6

                    let strength = signal[location]

                    location += 1

                    strength = Number.parseInt((strength / 255) * 100)
                    signalData[uid] = strength
                }
            }

            while (cnt1 < inverterQty) {
                let inv = {}

                if (this.apsStr(data, 15, 2) === '01') {
                    let inverterUid = this.apsUid(data, cnt2)

                    inv['uid'] = inverterUid
                    inv['online'] = Boolean(this.apsShort(data, cnt2 + 6))

                    let istr = this.apsStr(data, cnt2 + 7, 2)

                    inv['signal'] = signalData[inverterUid]

                    if (istr === '01' || istr === '04') {
                        let power = []
                        let voltages = []

                        inv['frequency'] = this.apsInt(data, cnt2 + 9) / 10

                        if (inv['online']) {
                            inv['temperature'] = this.apsInt(data, cnt2 + 11) - 100
                        }

                        power.push(this.apsInt(data, cnt2 + 13))
                        voltages.push(this.apsInt(data, cnt2 + 15))

                        power.push(this.apsInt(data, cnt2 + 17))
                        voltages.push(this.apsInt(data, cnt2 + 19))

                        let output = {
                            'model': 'YC600/DS3/DS3D-L',
                            'channel_qty': 2,
                            'power': power,
                            'voltage': voltages
                        }

                        inv = {
                            ...inv,
                            ...output
                        }

                        cnt2 += 21
                    } else if (istr === '02') {
                        let power = []
                        let voltages = []

                        inv['frequency'] = this.apsInt(data, cnt2 + 9) / 10

                        if (inv['online']) {
                            inv['temperature'] = this.apsInt(data, cnt2 + 11) - 100
                        }

                        power.push(this.apsInt(data, cnt2 + 13))
                        voltages.push(this.apsInt(data, cnt2 + 15))

                        power.push(this.apsInt(data, cnt2 + 17))
                        voltages.push(this.apsInt(data, cnt2 + 19))

                        power.push(this.apsInt(data, cnt2 + 21))
                        voltages.push(this.apsInt(data, cnt2 + 23))

                        power.push(this.apsInt(data, cnt2 + 25))

                        let output = {
                            'model': 'YC1000/QT2',
                            'channel_qty': 4,
                            'power': power,
                            'voltage': voltages
                        }

                        inv = {
                            ...inv,
                            ...output
                        }

                        cnt2 += 27
                    } else if (istr === '03') {
                        let power = []
                        let voltages = []

                        inv['frequency'] = this.apsInt(data, cnt2 + 9) / 10

                        if (inv['online']) {
                            inv['temperature'] = this.apsInt(data, cnt2 + 11) - 100
                        }

                        power.push(this.apsInt(data, cnt2 + 13))
                        voltages.push(this.apsInt(data, cnt2 + 15))

                        power.push(this.apsInt(data, cnt2 + 17))
                        power.push(this.apsInt(data, cnt2 + 19))
                        power.push(this.apsInt(data, cnt2 + 21))

                        let output = {
                            'model': 'QS1',
                            'channel_qty': 4,
                            'power': power,
                            'voltage': voltages
                        }

                        inv = {
                            ...inv,
                            ...output
                        }

                        cnt2 += 23
                    } else {
                        cnt2 += 9
                    }

                    inverters[inverterUid] = inv
                }

                cnt1 += 1
            }

            return inverters
        }
    }

    /**
     * Read APS UID.
     * UID is 6 raw bytes, displayed as 12 hexadecimal characters.
     */
    apsUid (codec, start) {
        if (!Buffer.isBuffer(codec)) {
            codec = Buffer.from(codec)
        }

        return codec.slice(start, start + 6).toString('hex')
    }

    /**
     * Read unsigned 16-bit big-endian integer.
     *
     * Important:
     * The previous version converted raw bytes to string before hex conversion.
     * That breaks when one byte is >= 0x80, which happens at 384 W: 0x0180.
     */
    apsInt (codec, start) {
        if (!Buffer.isBuffer(codec)) {
            codec = Buffer.from(codec)
        }

        if (codec.length < start + 2) {
            return 0
        }

        return codec.readUInt16BE(start)
    }

    /**
     * Read unsigned 8-bit integer.
     */
    apsShort (codec, start) {
        if (!Buffer.isBuffer(codec)) {
            codec = Buffer.from(codec)
        }

        if (codec.length < start + 1) {
            return 0
        }

        return codec.readUInt8(start)
    }

    /**
     * Read ASCII string.
     */
    apsStr (codec, start, amount) {
        if (!Buffer.isBuffer(codec)) {
            codec = Buffer.from(codec)
        }

        return codec.slice(start, start + amount).toString()
    }

    /**
     * Read timestamp encoded as BCD-like raw bytes.
     */
    apsTimestamp (codec, start, amount) {
        if (!Buffer.isBuffer(codec)) {
            codec = Buffer.from(codec)
        }

        const timestr = codec.slice(start, start + amount).toString('hex')

        return timestr.substring(0, 4) + '-' +
            timestr.substring(4, 6) + '-' +
            timestr.substring(6, 8) + ' ' +
            timestr.substring(8, 10) + ':' +
            timestr.substring(10, 12) + ':' +
            timestr.substring(12, 14)
    }

    /**
     * Read unsigned 32-bit big-endian integer.
     */
    apsDouble (codec, start) {
        if (!Buffer.isBuffer(codec)) {
            codec = Buffer.from(codec)
        }

        if (codec.length < start + 4) {
            return 0
        }

        return codec.readUInt32BE(start)
    }
}

module.exports = ECUR