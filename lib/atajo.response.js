class Response {

    constructor() {


    }

    success(pid, data) {

        return { error: false, pid: pid, response: { data: data } };
    }

    error(pid, data) {

        return { error: true, pid: pid, response: { data: data } };

    }


}

module.exports = Response;