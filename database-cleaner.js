const { createPool } = require("mysql2/promise");
const { getConfig } = require("raraph84-lib");
const dotenv = require("dotenv");
const config = getConfig(__dirname);

dotenv.config({ path: [".env.local", ".env"], quiet: true });

(async () => {
    const database = createPool({
        password: process.env.DATABASE_PASSWORD,
        charset: "utf8mb4_general_ci",
        ...config.database
    });

    console.log("Connecting to the database...");
    try {
        await database.query("SELECT 1");
    } catch (error) {
        console.log("Unable to connect to the database - " + error);
        return;
    }
    console.log("Connected to the database.");

    const sqls = [];

    const [services] = await database.query("SELECT * FROM services");
    const [pages] = await database.query("SELECT * FROM pages");

    console.log("Cleaning services daily statuses...");
    const [servicesDailyStatuses] = await database.query("SELECT DISTINCT service_id FROM services_daily_statuses");
    for (const servicesDailyStatus of servicesDailyStatuses) {
        const service = services.find((service) => service.service_id === servicesDailyStatus.service_id);
        if (!service) {
            console.log(`Service ${servicesDailyStatus.service_id} not found in services table, deleting...`);
            sqls.push(`DELETE FROM services_daily_statuses WHERE service_id = ${servicesDailyStatus.service_id};`);
        }
    }

    console.log("Cleaning services events...");
    const [servicesEvents] = await database.query("SELECT DISTINCT service_id FROM services_events");
    for (const servicesEvent of servicesEvents) {
        const service = services.find((service) => service.service_id === servicesEvent.service_id);
        if (!service) {
            console.log(`Service ${servicesEvent.service_id} not found in services table, deleting...`);
            sqls.push(`DELETE FROM services_events WHERE service_id = ${servicesEvent.service_id};`);
        }
    }

    console.log("Cleaning services statuses...");
    const [servicesStatuses] = await database.query("SELECT DISTINCT service_id FROM services_statuses");
    for (const servicesStatus of servicesStatuses) {
        const service = services.find((service) => service.service_id === servicesStatus.service_id);
        if (!service) {
            console.log(`Service ${servicesStatus.service_id} not found in services table, deleting...`);
            sqls.push(`DELETE FROM services_statuses WHERE service_id = ${servicesStatus.service_id};`);
        }
    }

    console.log("Cleaning services smokeping...");
    const [servicesSmokeping] = await database.query("SELECT DISTINCT service_id FROM services_smokeping");
    for (const serviceSmokeping of servicesSmokeping) {
        const service = services.find((service) => service.service_id === serviceSmokeping.service_id);
        if (!service) {
            console.log(`Service ${serviceSmokeping.service_id} not found in services table, deleting...`);
            sqls.push(`DELETE FROM services_smokeping WHERE service_id = ${serviceSmokeping.service_id};`);
        }
    }

    console.log("Cleaning pages services...");
    const [pagesServices] = await database.query("SELECT * FROM pages_services");
    for (const pagesService of pagesServices) {
        const page = pages.find((page) => page.page_id === pagesService.page_id);
        const service = services.find((service) => service.service_id === pagesService.service_id);
        if (!page || !service) {
            console.log(`Page ${pagesService.page_id} or service ${pagesService.service_id} not found, deleting...`);
            sqls.push(
                `DELETE FROM pages_services WHERE page_id = ${pagesService.page_id} && service_id = ${pagesService.service_id};`
            );
        }
    }

    console.log("Cleaning pages subpages...");
    const [pagesSubpages] = await database.query("SELECT * FROM pages_subpages");
    for (const pagesSubpage of pagesSubpages) {
        const page = pages.find((page) => page.page_id === pagesSubpage.page_id);
        const subpage = pages.find((page) => page.page_id === pagesSubpage.subpage_id);
        if (!page || !subpage) {
            console.log(`Page ${pagesSubpage.page_id} or subpage ${pagesSubpage.subpage_id} not found, deleting...`);
            sqls.push(
                `DELETE FROM Pages_Subpages WHERE page_id = ${pagesSubpage.page_id} && subpage_id = ${pagesSubpage.subpage_id};`
            );
        }
    }

    console.log("Finished !");
    console.log(sqls.join("\n"));
    await database.end();
})();
