import { Pool } from "mysql2/promise";
import { Request } from "raraph84-lib";
import { getPages, getServices, PrivatePage, PrivateService } from "../../../resources";

export const run = async (request: Request, database: Pool) => {
    let page;
    try {
        page = (
            await getPages(database, [parseInt(request.urlParams.pageId) || 0], null, null, ["services"])
        )[0][0] as PrivatePage & { services: PrivateService[] };
    } catch (error) {
        request.end(500, "Internal server error");
        return;
    }

    if (!page) {
        request.end(400, "This page does not exist");
        return;
    }

    let service;
    try {
        service = (await getServices(database, [parseInt(request.urlParams.serviceId) || 0]))[0][0];
    } catch (error) {
        request.end(500, "Internal server error");
        return;
    }

    if (!service) {
        request.end(400, "This service does not exist");
        return;
    }

    const pageService = page.services.find((pageService) => pageService.service === service.id);
    if (!pageService) {
        request.end(400, "This service is already not linked to this page");
        return;
    }

    try {
        await database.query("DELETE FROM pages_services WHERE page_id=? && service_id=?", [page.id, service.id]);
        await database.query("UPDATE pages_services SET position=position-1 WHERE page_id=? && position>?", [
            page.id,
            pageService.position
        ]);
    } catch (error) {
        console.log(`SQL Error - ${__filename} - ${error}`);
        request.end(500, "Internal server error");
        return;
    }

    request.end(204);
};

export const infos = {
    path: "/pages/:pageId/services/:serviceId",
    method: "DELETE",
    requiresAuth: true
};
