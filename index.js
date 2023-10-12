const { readdirSync } = require("fs");
const { createPool } = require("mysql");
const { getConfig, TaskManager, query, HttpServer, filterEndpointsByPath } = require("raraph84-lib");
const Config = getConfig(__dirname);

const tasks = new TaskManager();

const database = createPool(Config.database);
tasks.addTask((resolve, reject) => {
    console.log("Connexion à la base de données...");
    query(database, "SELECT 1").then(() => {
        console.log("Connecté à la base de données !");
        resolve();
    }).catch((error) => {
        console.log("Impossible de se connecter à la base de données - " + error);
        reject();
    });
}, (resolve) => database.end(() => resolve()));

const api = new HttpServer();
api.on("request", async (/** @type {import("raraph84-lib/src/Request")} */ request) => {

    const endpoints = filterEndpointsByPath(readdirSync(__dirname + "/src/endpoints")
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
tasks.addTask((resolve, reject) => {
    console.log("Lancement du serveur HTTP...");
    api.listen(process.env.PORT || 8080).then(() => {
        console.log("Serveur HTTP lancé sur le port " + (process.env.PORT || 8080) + " !");
        resolve();
    }).catch((error) => {
        console.log("Impossible de lancer le serveur HTTP - " + error);
        reject();
    });
}, (resolve) => database.end(() => resolve()));

tasks.run();
