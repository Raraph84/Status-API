const Fs = require("fs");
const MySQL = require("mysql");
const { getConfig, HttpServer, filterEndpointsByPath } = require("raraph84-lib");
const Config = getConfig(__dirname);

const database = MySQL.createPool(Config.database);
database.query("SELECT 0", (error) => {
    if (error) console.log(`Impossible de se connecter à la base de donnée - ${error}`);
    else api.listen(process.env.PORT || 8080);
});

const api = new HttpServer();
api.on("request", async (/** @type {import("raraph84-lib/src/Request")} */ request) => {

    const endpoints = filterEndpointsByPath(Fs.readdirSync(__dirname + "/src/endpoints")
        .map((endpointFile) => require(__dirname + "/src/endpoints/" + endpointFile)), request);

    request.setHeader("Access-Control-Allow-Origin", "*");

    if (!endpoints[0]) {
        request.end(404, "Not found");
        return;
    }

    if (request.method === "OPTIONS") {
        request.setHeader("Access-Control-Allow-Methods", endpoints.map((endpoint) => endpoint.infos.method).join(","));
        if (request.headers["access-control-request-headers"])
            request.setHeader("Access-Control-Allow-Headers", request.headers["access-control-request-headers"]);
        request.setHeader("Vary", "Access-Control-Request-Headers");
        request.end(204);
        return;
    }

    const endpoint = endpoints.find((endpoint) => endpoint.infos.method === request.method);
    if (!endpoint) {
        request.end(405, "Method not allowed");
        return;
    }

    request.urlParams = endpoint.params;

    endpoint.run(request, database);
});
