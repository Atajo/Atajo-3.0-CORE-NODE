module.exports = {

    domain: String,
    key: String,
    uuid: { type: String, index: true },
    connected: Boolean,
    ip: String,
    id: String,
    device: { type: Object, default: {} },
    lastTxAt: Date

};