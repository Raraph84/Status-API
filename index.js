const { readdirSync } = require("fs");
const { join } = require("path");
const { createPool } = require("mysql2/promise");
const { getConfig, TaskManager, HttpServer, filterEndpointsByPath } = require("raraph84-lib");
const config = getConfig(__dirname);

require("dotenv").config({ path: [".env.local", ".env"] });

const tasks = new TaskManager();

const database = createPool({ password: process.env.DATABASE_PASSWORD, charset: "utf8mb4_general_ci", ...config.database });
tasks.addTask(async (resolve, reject) => {
    console.log("Connexion à la base de données...");
    try {
        await database.query("SELECT 1");
    } catch (error) {
        console.log("Impossible de se connecter à la base de données - " + error);
        reject();
        return;
    }
    console.log("Connecté à la base de données !");
    resolve();
}, (resolve) => database.end().then(() => resolve()));

const endpointsFiles = readdirSync(join(__dirname, "src", "endpoints"), { recursive: true })
    .filter((file) => file.endsWith(".js") || file.endsWith(".ts"))
    .filter((file, i, files) => file.endsWith(".js") || !files.includes(file.replace(".ts", ".js")))
    .map((endpoint) => require(join(__dirname, "src", "endpoints", endpoint)));

const api = new HttpServer();
api.on("request", async (/** @type {import("raraph84-lib/src/Request")} */ request) => {

    const endpoints = filterEndpointsByPath(endpointsFiles, request);

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

    if (endpoint.infos.requiresAuth && !request.headers.authorization) {
        request.end(401, "Missing authorization");
        return;
    }

    if (request.headers.authorization) {

        if (request.headers.authorization !== process.env.PANEL_KEY) {
            request.end(401, "Invalid token");
            return;
        }

        request.authenticated = true;
    }

    request.urlParams = endpoint.params;

    endpoint.run(request, database);
});
tasks.addTask((resolve, reject) => {
    console.log("Lancement du serveur HTTP...");
    api.listen(process.env.PORT || 4000).then(() => {
        console.log("Serveur HTTP lancé sur le port " + (process.env.PORT || 4000) + " !");
        resolve();
    }).catch((error) => {
        console.log("Impossible de lancer le serveur HTTP - " + error);
        reject();
    });
}, (resolve) => api.close().then(() => resolve()));

tasks.run();
