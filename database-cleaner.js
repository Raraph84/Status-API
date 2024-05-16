const { createPool } = require("mysql2/promise");
const { getConfig, TaskManager } = require("raraph84-lib");
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

const sqls = [];

tasks.addTask(async (resolve) => {

    let nodes;
    try {
        [nodes] = await database.query("SELECT * FROM Nodes");
    } catch (error) {
        console.log(`SQL Error - ${__filename} - ${error}`);
        reject();
        return;
    }

    console.log("Cleaning services daily statuses...");

    let servicesDailyStatuses;
    try {
        [servicesDailyStatuses] = await database.query("SELECT * FROM services_daily_statuses GROUP BY service_id");
    } catch (error) {
        console.log(`SQL Error - ${__filename} - ${error}`);
        reject();
        return;
    }

    for (const servicesDailyStatus of servicesDailyStatuses) {
        const node = nodes.find((node) => node.Node_ID === servicesDailyStatus.service_id);
        if (!node) {
            console.log(`Service ${servicesDailyStatus.service_id} not found in nodes table, deleting...`);
            sqls.push(`DELETE FROM services_daily_statuses WHERE service_id = ${servicesDailyStatus.service_id}`);
        }
    }

    console.log("Cleaning services events...");

    let servicesEvents;
    try {
        [servicesEvents] = await database.query("SELECT * FROM services_events GROUP BY service_id");
    } catch (error) {
        console.log(`SQL Error - ${__filename} - ${error}`);
        reject();
        return;
    }

    for (const servicesEvent of servicesEvents) {
        const node = nodes.find((node) => node.Node_ID === servicesEvent.service_id);
        if (!node) {
            console.log(`Service ${servicesEvent.service_id} not found in nodes table, deleting...`);
            sqls.push(`DELETE FROM services_events WHERE service_id = ${servicesEvent.service_id}`);
        }
    }

    console.log("Cleaning services statuses...");

    let servicesStatuses;
    try {
        [servicesStatuses] = await database.query("SELECT * FROM services_statuses GROUP BY service_id");
    } catch (error) {
        console.log(`SQL Error - ${__filename} - ${error}`);
        reject();
        return;
    }

    for (const servicesStatus of servicesStatuses) {
        const node = nodes.find((node) => node.Node_ID === servicesStatus.service_id);
        if (!node) {
            console.log(`Service ${servicesStatus.service_id} not found in nodes table, deleting...`);
            sqls.push(`DELETE FROM services_statuses WHERE service_id = ${servicesStatus.service_id}`);
        }
    }

    let pages;
    try {
        [pages] = await database.query("SELECT * FROM Pages");
    } catch (error) {
        console.log(`SQL Error - ${__filename} - ${error}`);
        reject();
        return;
    }

    console.log("Cleaning pages nodes...");

    let pagesNodes;
    try {
        [pagesNodes] = await database.query("SELECT * FROM Pages_Nodes");
    } catch (error) {
        console.log(`SQL Error - ${__filename} - ${error}`);
        reject();
        return;
    }

    for (const pagesNode of pagesNodes) {
        const page = pages.find((page) => page.Page_ID === pagesNode.Page_ID);
        const node = nodes.find((node) => node.Node_ID === pagesNode.Node_ID);
        if (!page || !node) {
            console.log(`Page ${pagesNode.Page_ID} or node ${pagesNode.Node_ID} not found, deleting...`);
            sqls.push(`DELETE FROM Pages_Nodes WHERE Page_ID = ${pagesNode.Page_ID} && Node_ID = ${pagesNode.Node_ID}`);
        }
    }

    console.log("Cleaning pages subpages...");

    let pagesSubpages;
    try {
        [pagesSubpages] = await database.query("SELECT * FROM Pages_Subpages");
    } catch (error) {
        console.log(`SQL Error - ${__filename} - ${error}`);
        reject();
        return;
    }

    for (const pagesSubpage of pagesSubpages) {
        const page = pages.find((page) => page.Page_ID === pagesSubpage.Page_ID);
        const subpage = pages.find((page) => page.Page_ID === pagesSubpage.Subpage_ID);
        if (!page || !subpage) {
            console.log(`Page ${pagesSubpage.Page_ID} or subpage ${pagesSubpage.Subpage_ID} not found, deleting...`);
            sqls.push(`DELETE FROM Pages_Subpages WHERE Page_ID = ${pagesSubpage.Page_ID} && Subpage_ID = ${pagesSubpage.Subpage_ID}`);
        }
    }

    console.log("Finished !");
    console.log(sqls.join("\n"));
    await database.end();
    resolve();

}, (resolve) => resolve());

tasks.run();
