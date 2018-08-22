module.exports = {

    domain: { type: String, index: true },
    destinationDomain: String,
    uuid: { type: String, index: true },
    status: String,
    pid: { type: String, index: true},
    lambda: String,
    request: { type: Object, default: {} },
    responses: { type: Array, default: [] },
    latency: { type: Object, default: {} },
    version: String,
    lastDeviceResponse: { type: Object, default: {} }
    createdAt: { type: Date, expires: 90, default: Date.now }

};
