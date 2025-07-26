import { createPool } from "mysql2/promise";
import { filterEndpointsByPath, getConfig, HttpServer, TaskManager } from "raraph84-lib";
import fs from "fs";
import path from "path";

const config = getConfig(__dirname);

require("dotenv").config({ path: [".env.local", ".env"] });

const tasks = new TaskManager();

const database = createPool({
    password: process.env.DATABASE_PASSWORD,
    charset: "utf8mb4_general_ci",
    ...config.database
});
tasks.addTask(
    (resolve, reject) => {
        console.log("Connecting to the database...");
        database
            .query("SELECT 1")
            .then(() => {
                console.log("Connected to the database.");
                resolve();
            })
            .catch((error) => {
                console.log("Unable to connect to the database - " + error);
                reject();
            });
    },
    (resolve) => database.end().then(() => resolve())
);

const endpointsFiles = fs
    .readdirSync(path.join(__dirname, "src", "endpoints"), { recursive: true })
    .map((file) => file as string)
    .filter((file) => file.endsWith(".js") || file.endsWith(".ts"))
    .filter((file, i, files) => file.endsWith(".js") || !files.includes(file.replace(".ts", ".js")))
    .map((endpoint) => require(path.join(__dirname, "src", "endpoints", endpoint)));

const api = new HttpServer();
api.on("request", async (request) => {
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

        request.metadata.authenticated = true;
    }

    request.urlParams = endpoint.params;

    endpoint.run(request, database);
});
tasks.addTask(
    (resolve, reject) => {
        console.log("Starting HTTP server...");
        api.listen(parseInt(process.env.PORT!) || 4000)
            .then(() => {
                console.log("HTTP server started on port " + (parseInt(process.env.PORT!) || 4000) + ".");
                resolve();
            })
            .catch((error) => {
                console.log("Unable to start HTTP server - " + error);
                reject();
            });
    },
    (resolve) => api.close().then(() => resolve())
);

tasks.run();
