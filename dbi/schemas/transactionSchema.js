module.exports = {

    domain: String,
    destinationDomain: String,
    uuid: { type: String, index: true },
    status: String,
    pid: String,
    lambda: String,
    request: { type: Object, default: {} },
    responses: { type: Array, default: [] },
    latency: { type: Object, default: {} },
    version: String,
    lastDeviceResponse: { type: Object, default: {} }

};