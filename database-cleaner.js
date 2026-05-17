const { createPool } = require("mysql2/promise");
const dotenv = require("dotenv");

dotenv.config({ path: [".env.local", ".env"], quiet: true });

(async () => {
    const database = createPool({
        host: process.env.DATABASE_HOST,
        user: process.env.DATABASE_USER,
        password: process.env.DATABASE_PASSWORD,
        database: process.env.DATABASE_NAME,
        charset: "utf8mb4_general_ci"
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

    const [checkers] = await database.query("SELECT * FROM checkers");
    const [groups] = await database.query("SELECT * FROM groups");
    const [pages] = await database.query("SELECT * FROM pages");
    const [services] = await database.query("SELECT * FROM services");

    console.log("Cleaning services daily statuses...");
    const [servicesDailyStatusesServices] = await database.query(
        "SELECT DISTINCT service_id FROM services_daily_statuses"
    );
    const [servicesDailyStatusesCheckers] = await database.query(
        "SELECT DISTINCT checker_id FROM services_daily_statuses"
    );
    for (const servicesDailyStatus of servicesDailyStatusesServices) {
        const service = services.find((service) => service.service_id === servicesDailyStatus.service_id);
        if (!service) {
            console.log(`Service ${servicesDailyStatus.service_id} not found in services table, deleting...`);
            sqls.push(`DELETE FROM services_daily_statuses WHERE service_id = ${servicesDailyStatus.service_id};`);
        }
    }
    for (const servicesDailyStatus of servicesDailyStatusesCheckers) {
        const checker = checkers.find((checker) => checker.checker_id === servicesDailyStatus.checker_id);
        if (!checker) {
            console.log(`Checker ${servicesDailyStatus.checker_id} not found in checkers table, deleting...`);
            sqls.push(`DELETE FROM services_daily_statuses WHERE checker_id = ${servicesDailyStatus.checker_id};`);
        }
    }

    console.log("Cleaning services events...");
    const [servicesEventsServices] = await database.query("SELECT DISTINCT service_id FROM services_events");
    const [servicesEventsCheckers] = await database.query("SELECT DISTINCT checker_id FROM services_events");
    for (const servicesEvent of servicesEventsServices) {
        const service = services.find((service) => service.service_id === servicesEvent.service_id);
        if (!service) {
            console.log(`Service ${servicesEvent.service_id} not found in services table, deleting...`);
            sqls.push(`DELETE FROM services_events WHERE service_id = ${servicesEvent.service_id};`);
        }
    }
    for (const servicesEvent of servicesEventsCheckers) {
        const checker = checkers.find((checker) => checker.checker_id === servicesEvent.checker_id);
        if (!checker) {
            console.log(`Checker ${servicesEvent.checker_id} not found in checkers table, deleting...`);
            sqls.push(`DELETE FROM services_events WHERE checker_id = ${servicesEvent.checker_id};`);
        }
    }

    console.log("Cleaning services statuses...");
    const [servicesStatusesServices] = await database.query("SELECT DISTINCT service_id FROM services_statuses");
    const [servicesStatusesCheckers] = await database.query("SELECT DISTINCT checker_id FROM services_statuses");
    for (const servicesStatus of servicesStatusesServices) {
        const service = services.find((service) => service.service_id === servicesStatus.service_id);
        if (!service) {
            console.log(`Service ${servicesStatus.service_id} not found in services table, deleting...`);
            sqls.push(`DELETE FROM services_statuses WHERE service_id = ${servicesStatus.service_id};`);
        }
    }
    for (const servicesStatus of servicesStatusesCheckers) {
        const checker = checkers.find((checker) => checker.checker_id === servicesStatus.checker_id);
        if (!checker) {
            console.log(`Checker ${servicesStatus.checker_id} not found in checkers table, deleting...`);
            sqls.push(`DELETE FROM services_statuses WHERE checker_id = ${servicesStatus.checker_id};`);
        }
    }

    console.log("Cleaning services smokeping...");
    const [servicesSmokepingServices] = await database.query("SELECT DISTINCT service_id FROM services_smokeping");
    const [servicesSmokepingCheckers] = await database.query("SELECT DISTINCT checker_id FROM services_smokeping");
    for (const serviceSmokeping of servicesSmokepingServices) {
        const service = services.find((service) => service.service_id === serviceSmokeping.service_id);
        if (!service) {
            console.log(`Service ${serviceSmokeping.service_id} not found in services table, deleting...`);
            sqls.push(`DELETE FROM services_smokeping WHERE service_id = ${serviceSmokeping.service_id};`);
        }
    }
    for (const serviceSmokeping of servicesSmokepingCheckers) {
        const checker = checkers.find((checker) => checker.checker_id === serviceSmokeping.checker_id);
        if (!checker) {
            console.log(`Checker ${serviceSmokeping.checker_id} not found in checkers table, deleting...`);
            sqls.push(`DELETE FROM services_smokeping WHERE checker_id = ${serviceSmokeping.checker_id};`);
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

    console.log("Cleaning groups checkers...");
    const [groupsCheckers] = await database.query("SELECT * FROM groups_checkers");
    for (const groupsChecker of groupsCheckers) {
        const group = groups.find((group) => group.group_id === groupsChecker.group_id);
        const checker = checkers.find((checker) => checker.checker_id === groupsChecker.checker_id);
        if (!group || !checker) {
            console.log(
                `Group ${groupsChecker.group_id} or checker ${groupsChecker.checker_id} not found, deleting...`
            );
            sqls.push(
                `DELETE FROM groups_checkers WHERE group_id = ${groupsChecker.group_id} && checker_id = ${groupsChecker.checker_id};`
            );
        }
    }

    console.log("Cleaning groups services...");
    const [groupsServices] = await database.query("SELECT * FROM groups_services");
    for (const groupsService of groupsServices) {
        const group = groups.find((group) => group.group_id === groupsService.group_id);
        const service = services.find((service) => service.service_id === groupsService.service_id);
        if (!group || !service) {
            console.log(
                `Group ${groupsService.group_id} or service ${groupsService.service_id} not found, deleting...`
            );
            sqls.push(
                `DELETE FROM groups_services WHERE group_id = ${groupsService.group_id} && service_id = ${groupsService.service_id};`
            );
        }
    }

    console.log("Finished !");
    console.log(sqls.join("\n"));
    await database.end();
})();
