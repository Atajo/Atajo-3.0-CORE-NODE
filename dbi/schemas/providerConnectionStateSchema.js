module.exports = {

    domain: { type: String, index: true },
    key: String,
    uuid: { type: String, index: true },
    connected: Boolean,
    ip: String,
    id: { type: String, index: true },
    nodes: { type: Number, default: 0 },
    device: { type: Object, default: {} }

};