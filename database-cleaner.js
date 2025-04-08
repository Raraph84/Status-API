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

tasks.addTask(async (resolve, reject) => {

    let services;
    try {
        [services] = await database.query("SELECT * FROM services");
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
        const service = services.find((service) => service.service_id === servicesDailyStatus.service_id);
        if (!service) {
            console.log(`Service ${servicesDailyStatus.service_id} not found in services table, deleting...`);
            sqls.push(`DELETE FROM services_daily_statuses WHERE service_id = ${servicesDailyStatus.service_id};`);
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
        const service = services.find((service) => service.service_id === servicesEvent.service_id);
        if (!service) {
            console.log(`Service ${servicesEvent.service_id} not found in services table, deleting...`);
            sqls.push(`DELETE FROM services_events WHERE service_id = ${servicesEvent.service_id};`);
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
        const service = services.find((service) => service.service_id === servicesStatus.service_id);
        if (!service) {
            console.log(`Service ${servicesStatus.service_id} not found in services table, deleting...`);
            sqls.push(`DELETE FROM services_statuses WHERE service_id = ${servicesStatus.service_id};`);
        }
    }

    console.log("Cleaning services smokeping...");

    let servicesSmokeping;
    try {
        [servicesSmokeping] = await database.query("SELECT * FROM services_smokeping GROUP BY service_id");
    } catch (error) {
        console.log(`SQL Error - ${__filename} - ${error}`);
        reject();
        return;
    }

    for (const serviceSmokeping of servicesSmokeping) {
        const service = services.find((service) => service.service_id === serviceSmokeping.service_id);
        if (!service) {
            console.log(`Service ${serviceSmokeping.service_id} not found in services table, deleting...`);
            sqls.push(`DELETE FROM services_smokeping WHERE service_id = ${serviceSmokeping.service_id};`);
        }
    }

    let pages;
    try {
        [pages] = await database.query("SELECT * FROM pages");
    } catch (error) {
        console.log(`SQL Error - ${__filename} - ${error}`);
        reject();
        return;
    }

    console.log("Cleaning pages services...");

    let pagesServices;
    try {
        [pagesServices] = await database.query("SELECT * FROM pages_services");
    } catch (error) {
        console.log(`SQL Error - ${__filename} - ${error}`);
        reject();
        return;
    }

    for (const pagesService of pagesServices) {
        const page = pages.find((page) => page.page_id === pagesService.page_id);
        const service = services.find((service) => service.service_id === pagesService.service_id);
        if (!page || !service) {
            console.log(`Page ${pagesService.page_id} or service ${pagesService.service_id} not found, deleting...`);
            sqls.push(`DELETE FROM pages_services WHERE page_id = ${pagesService.page_id} && service_id = ${pagesService.service_id};`);
        }
    }

    console.log("Cleaning pages subpages...");

    let pagesSubpages;
    try {
        [pagesSubpages] = await database.query("SELECT * FROM pages_subpages");
    } catch (error) {
        console.log(`SQL Error - ${__filename} - ${error}`);
        reject();
        return;
    }

    for (const pagesSubpage of pagesSubpages) {
        const page = pages.find((page) => page.page_id === pagesSubpage.page_id);
        const subpage = pages.find((page) => page.page_id === pagesSubpage.subpage_id);
        if (!page || !subpage) {
            console.log(`Page ${pagesSubpage.page_id} or subpage ${pagesSubpage.subpage_id} not found, deleting...`);
            sqls.push(`DELETE FROM Pages_Subpages WHERE page_id = ${pagesSubpage.page_id} && subpage_id = ${pagesSubpage.subpage_id};`);
        }
    }

    console.log("Finished !");
    console.log(sqls.join("\n"));
    await database.end();
    resolve();

}, (resolve) => resolve());

tasks.run();
