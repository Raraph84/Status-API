/**
 * @param {import("raraph84-lib/src/Request")} request 
 * @param {import("mysql2/promise").Pool} database 
 */
module.exports.run = async (request, database) => {

    let rawPage;
    try {
        [rawPage] = await database.query("SELECT * FROM pages WHERE short_name=? || domain=?", [request.urlParams.shortName, request.urlParams.shortName]);
        rawPage = rawPage[0];
    } catch (error) {
        request.end(500, "Internal server error");
        console.log(`SQL Error - ${__filename} - ${error}`);
        return;
    }

    if (!rawPage) {
        request.end(400, "This page does not exist");
        return;
    }

    const getLastStatus = async (service) => {

        let [lastEvent] = await database.query("SELECT * FROM services_events WHERE service_id=? ORDER BY minute DESC LIMIT 1", [service.service_id]);
        lastEvent = lastEvent[0];

        return !!lastEvent?.online || false;
    };

    const getPage = async (page) => {

        let [subPages] = await database.query("SELECT * FROM pages_subpages INNER JOIN pages ON pages.page_id=pages_subpages.subpage_id WHERE pages_subpages.page_id=?", [page.page_id]);
        subPages = await Promise.all(subPages.map((subpage) => getPage(subpage)));

        let [services] = await database.query("SELECT services.*, pages_services.position, pages_services.display_name FROM pages_services INNER JOIN services ON pages_services.service_id=services.service_id WHERE page_id=?", [page.page_id]);
        services = await Promise.all(services.map(async (service) => ({
            id: service.service_id,
            name: service.name,
            online: await getLastStatus(service),
            position: service.Position,
            displayName: service.display_name,
            disabled: !!service.disabled
        })));

        const totalServices = services.filter((service) => !service.disabled).length + subPages.reduce((total, subPages) => total + subPages.totalServices, 0);
        const onlineServices = services.filter((service) => !service.disabled && service.online).length + subPages.reduce((total, subPages) => total + subPages.onlineServices, 0);
        const offlineServices = services.filter((service) => !service.disabled && !service.online).length + subPages.reduce((total, subPages) => total + subPages.offlineServices, 0);

        return {
            shortName: page.short_name,
            title: page.title,
            url: page.url,
            logoUrl: page.logo_url,
            subPages: subPages,
            services,
            totalServices: totalServices,
            onlineServices: onlineServices,
            offlineServices: offlineServices
        };
    };

    let page;
    try {
        page = await getPage(rawPage);
    } catch (error) {
        request.end(500, "Internal server error");
        console.log(`SQL Error - ${__filename} - ${error}`);
        return;
    }

    request.end(200, page);
}

module.exports.infos = {
    path: "/pages/:shortName",
    method: "GET"
}
