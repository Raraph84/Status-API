/**
 * @param {import("mysql2/promise").Pool} database 
 * @param {number[]} serviceId 
 * @param {string[]} includes 
 * @returns {Promise<[privateService[], publicService[]]>} 
 */
const getServices = async (database, serviceId = null, includes = []) => {

    const args = [];
    let sql = "SELECT * FROM services";
    if (serviceId) {
        sql += (sql.includes("WHERE") ? " ||" : " WHERE") + " service_id IN (?)";
        args.push(serviceId);
    }

    let services;
    try {
        [services] = await database.query(sql, args);
    } catch (error) {
        console.log(`SQL Error - ${__filename} - ${error}`);
        throw new Error("Database error");
    }

    if (services.length > 0 && includes.includes("online")) {
        await Promise.all(services.map(async (service) => {

            let lastEvent;
            try {
                [lastEvent] = await database.query("SELECT * FROM services_events WHERE service_id=? ORDER BY minute DESC LIMIT 1", [service.service_id]);
                lastEvent = lastEvent[0];
            } catch (error) {
                console.log(`SQL Error - ${__filename} - ${error}`);
                throw new Error("Database error");
            }

            service.online = !!lastEvent?.online;
        }));
    }

    return [services.map((service) => ({
        id: service.service_id,
        type: service.type,
        name: service.name,
        host: service.host,
        protocol: service.protocol,
        disabled: !!service.disabled,
        online: service?.online
    })), services.map((service) => ({
        id: service.service_id,
        name: service.name,
        disabled: !!service.disabled,
        online: service?.online
    }))];
};

/**
 * @param {import("mysql2/promise").Pool} database 
 * @param {number[]} pageId 
 * @param {string[]} shortName 
 * @param {string[]} domain 
 * @param {string[]} includes 
 * @returns {Promise<[privatePage[], publicPage[]]>} 
 */
const getPages = async (database, pageId = null, shortName = null, domain = null, includes = []) => {

    const args = [];
    let sql = "SELECT * FROM pages";
    if (pageId) {
        sql += (sql.includes("WHERE") ? " ||" : " WHERE") + " page_id IN (?)";
        args.push(pageId);
    }
    if (shortName) {
        sql += (sql.includes("WHERE") ? " ||" : " WHERE") + " short_name IN (?)";
        args.push(shortName);
    }
    if (domain) {
        sql += (sql.includes("WHERE") ? " ||" : " WHERE") + " domain IN (?)";
        args.push(domain);
    }

    let pages;
    try {
        [pages] = await database.query(sql, args);
    } catch (error) {
        console.log(`SQL Error - ${__filename} - ${error}`);
        throw new Error("Database error");
    }

    if (pages.length > 0 && includes.includes("services")) {
        const pagesServices = await getPagesServices(database, pages.map((page) => page.page_id), subIncludes(includes, "services"));
        for (const page of pages) {
            const servicesIndexes = pagesServices[0].map((s, i) => i).filter((i) => (pagesServices[0][i].page.id ?? pagesServices[0][i].page) === page.page_id);
            page.services = [servicesIndexes.map((i) => pagesServices[0][i]), servicesIndexes.map((i) => pagesServices[1][i])];
        }
    }

    if (pages.length > 0 && includes.includes("subpages")) {
        const pagesSubPages = await getPagesSubPages(database, pages.map((page) => page.page_id), subIncludes(includes, "subpages").concat(includes.includes("subpages.subpage") ? includes.map((include) => "subpage." + include) : []));
        for (const page of pages) {
            const subPagesIndexes = pagesSubPages[0].map((s, i) => i).filter((i) => (pagesSubPages[0][i].page.id ?? pagesSubPages[0][i].page) === page.page_id);
            page.subPages = [subPagesIndexes.map((i) => pagesSubPages[0][i]), subPagesIndexes.map((i) => pagesSubPages[1][i])];
        }
    }

    return [pages.map((page) => ({
        id: page.page_id,
        shortName: page.short_name,
        title: page.title,
        url: page.url,
        logoUrl: page.logo_url,
        domain: page.domain,
        subPages: page.subPages ? page.subPages[0] : undefined,
        services: page.services ? page.services[0] : undefined
    })), pages.map((page) => ({
        shortName: page.short_name,
        title: page.title,
        url: page.url,
        logoUrl: page.logo_url,
        subPages: page.subPages ? page.subPages[1] : undefined,
        services: page.services ? page.services[1] : undefined
    }))];
};

/**
 * @param {import("mysql2/promise").Pool} database 
 * @param {number[]} pageId 
 * @param {string[]} includes 
 * @returns {Promise<[privatePageSubPage[], publicPageSubPage[]]>} 
 */
const getPagesSubPages = async (database, pageId = null, includes = []) => {

    const args = [];
    let sql = "SELECT * FROM pages_subpages";
    if (pageId) {
        sql += (sql.includes("WHERE") ? " ||" : " WHERE") + " page_id IN (?)";
        args.push(pageId);
    }

    let pagesSubPages;
    try {
        [pagesSubPages] = await database.query(sql, args);
    } catch (error) {
        console.log(`SQL Error - ${__filename} - ${error}`);
        throw new Error("Database error");
    }

    const pages = pagesSubPages.length > 0 && includes.includes("page") ? await getPages(database, pagesSubPages.map((pagesSubPage) => pagesSubPage.page_id), null, null, subIncludes(includes, "page")) : [];
    const subPages = pagesSubPages.length > 0 && includes.includes("subpage") ? await getPages(database, pagesSubPages.map((pagesSubPage) => pagesSubPage.subpage_id), null, null, subIncludes(includes, "subpage")) : [];

    return [pagesSubPages.map((pagesSubPage) => ({
        page: pages[0]?.find((page) => page.id === pagesSubPage.page_id) ?? pagesSubPage.page_id,
        subPage: subPages[0]?.find((subPage) => subPage.id === pagesSubPage.subpage_id) ?? pagesSubPage.subpage_id
    })), pagesSubPages.map((pagesSubPage) => ({
        page: includes.includes("page") ? pages[1][pages[0].findIndex((page) => page.id === pagesSubPage.page_id)] : null,
        subPage: includes.includes("subpage") ? subPages[1][subPages[0].findIndex((page) => page.id === pagesSubPage.subpage_id)] : null
    }))];
};

/**
 * @param {import("mysql2/promise").Pool} database 
 * @param {number[]} pageId 
 * @param {string[]} includes 
 * @returns {Promise<[privatePageService[], publicPageService[]]>} 
 */
const getPagesServices = async (database, pageId = null, includes = []) => {

    const args = [];
    let sql = "SELECT * FROM pages_services";
    if (pageId) {
        sql += (sql.includes("WHERE") ? " ||" : " WHERE") + " page_id IN (?)";
        args.push(pageId);
    }

    let pagesServices;
    try {
        [pagesServices] = await database.query(sql, args);
    } catch (error) {
        console.log(`SQL Error - ${__filename} - ${error}`);
        throw new Error("Database error");
    }

    const pages = pagesServices.length > 0 && includes.includes("page") ? await getPages(database, pagesServices.map((pageService) => pageService.page_id), null, null, subIncludes(includes, "page")) : [];
    const services = pagesServices.length > 0 && includes.includes("service") ? await getServices(database, pagesServices.map((pageService) => pageService.service_id), subIncludes(includes, "service")) : [];

    return [pagesServices.map((pageService) => ({
        page: pages[0]?.find((page) => page.id === pageService.page_id) ?? pageService.page_id,
        service: services[0]?.find((service) => service.id === pageService.service_id) ?? pageService.service_id,
        position: pageService.position,
        displayName: pageService.display_name
    })), pagesServices.map((pageService) => ({
        page: includes.includes("page") ? pages[1][pages[0].findIndex((page) => page.id === pageService.page_id)] : null,
        service: services[1]?.find((service) => service.id === pageService.service_id) ?? pageService.service_id,
        position: pageService.position,
        displayName: pageService.display_name
    }))];
};

/**
 * @param {import("mysql2/promise").Pool} database 
 * @param {number[]} checkerId 
 * @param {string[]} includes 
 * @returns {Promise<[privateChecker[], publicChecker[]]>} 
 */
const getCheckers = async (database, checkerId = null, includes = []) => {

    const args = [];
    let sql = "SELECT * FROM checkers";
    if (checkerId) {
        sql += (sql.includes("WHERE") ? " ||" : " WHERE") + " checker_id IN (?)";
        args.push(checkerId);
    }

    let checkers;
    try {
        [checkers] = await database.query(sql, args);
    } catch (error) {
        console.log(`SQL Error - ${__filename} - ${error}`);
        throw new Error("Database error");
    }

    if (checkers.length > 0 && includes.includes("services")) {
        const checkersServices = await getCheckersServices(database, checkers.map((checker) => checker.checker_id), subIncludes(includes, "services"));
        for (const checker of checkers) {
            const servicesIndexes = checkersServices[0].map((s, i) => i).filter((i) => (checkersServices[0][i].checker.id ?? checkersServices[0][i].checker) === checker.checker_id);
            checker.services = [servicesIndexes.map((i) => checkersServices[0][i]), servicesIndexes.map((i) => checkersServices[1][i])];
        }
    }

    return [checkers.map((checker) => ({
        id: checker.checker_id,
        name: checker.name,
        description: checker.description,
        location: checker.location,
        checkSecond: checker.check_second,
        hidden: !!checker.hidden,
        services: checker.services ? checker.services[0] : undefined
    })), checkers.map((checker) => ({
        id: checker.checker_id,
        name: checker.name,
        location: checker.location,
        services: checker.services ? checker.services[1] : undefined
    }))];
};

/**
 * @param {import("mysql2/promise").Pool} database 
 * @param {number[]} checkerId 
 * @param {string[]} includes 
 * @returns {Promise<[privateCheckerService[], publicCheckerService[]]>} 
 */
const getCheckersServices = async (database, checkerId = null, includes = []) => {

    const args = [];
    let sql = "SELECT * FROM checkers_services";
    if (checkerId) {
        sql += (sql.includes("WHERE") ? " ||" : " WHERE") + " checker_id IN (?)";
        args.push(checkerId);
    }

    let checkersServices;
    try {
        [checkersServices] = await database.query(sql, args);
    } catch (error) {
        console.log(`SQL Error - ${__filename} - ${error}`);
        throw new Error("Database error");
    }

    const checkers = checkersServices.length > 0 && includes.includes("checker") ? await getCheckers(database, checkersServices.map((checkerService) => checkerService.checker_id), subIncludes(includes, "checker")) : [];
    const services = checkersServices.length > 0 && includes.includes("service") ? await getServices(database, checkersServices.map((checkerService) => checkerService.service_id), subIncludes(includes, "service")) : [];

    return [checkersServices.map((checkerService) => ({
        checker: checkers[0]?.find((checker) => checker.id === checkerService.checker_id) ?? checkerService.checker_id,
        service: services[0]?.find((service) => service.id === checkerService.service_id) ?? checkerService.service_id
    })), checkersServices.map((checkerService) => ({
        checker: checkers[1]?.find((checker) => checker.id === checkerService.checker_id) ?? checkerService.checker_id,
        service: services[1]?.find((service) => service.id === checkerService.service_id) ?? checkerService.service_id
    }))];
};

const subIncludes = (includes, name) => includes.filter((include) => include.startsWith(name + ".")).map((include) => include.replace(name + ".", ""));

module.exports = { getServices, getPages, getPagesSubPages, getPagesServices, getCheckers, getCheckersServices };

/**
 * @typedef {{
 *     id: number;
 *     name: string;
 *     disabled: boolean;
 *     online?: boolean;
 * }} privateService 
 * 
 * @typedef {{
 *     id: number;
 *     name: string;
 *     disabled: boolean;
 *     online?: boolean;
 * }} publicService 
 * 
 * 
 * @typedef {{
 *     id: number;
 *     shortName: string;
 *     title: string;
 *     url: string;
 *     logoUrl: string;
 *     domain: string|null;
 *     subPages?: privatePageSubPage[];
 *     services?: privatePageService[];
 * }} privatePage 
 * 
 * @typedef {{
 *     shortName: string;
 *     title: string;
 *     url: string;
 *     logoUrl: string;
 *     subPages?: publicPageSubPage[];
 *     services?: publicPageService[];
 * }} publicPage 
 * 
 * 
 * @typedef {{
 *     page: privatePage|number;
 *     subPage: privatePage|number;
 * }} privatePageSubPage 
 * 
 * @typedef {{
 *     page: publicPage|null;
 *     subPage: publicPage|null;
 * }} publicPageSubPage 
 * 
 * 
 * @typedef {{
 *     page: privatePage|number;
 *     service: privateService|number;
 *     position: number;
 *     displayName: string;
 * }} privatePageService 
 * 
 * @typedef {{
 *     page: publicPage|null;
 *     service: publicService|number;
 *     position: number;
 *     displayName: string;
 * }} publicPageService 
 * 
 * 
 * @typedef {{
 *     id: number;
 *     name: string;
 *     description: string;
 *     location: string;
 *     checkSecond: number;
 *     hidden: boolean;
 * }} privateChecker 
 * 
 * @typedef {{
 *     id: number;
 *     name: string;
 *     location: string;
 * }} publicChecker 
 * 
 * 
 * @typedef {{
 *     checker: privateChecker|number;
 *     service: privateService|number;
 * }} privateCheckerService 
 * 
 * @typedef {{
 *     checker: publicChecker|null;
 *     service: publicService|null;
 * }} publicCheckerService 
 */
