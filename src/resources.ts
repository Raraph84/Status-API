import { Pool, RowDataPacket } from "mysql2/promise";
import { getConfig } from "raraph84-lib";
const config = getConfig(__dirname + "/..");

export const getServices = async (
    database: Pool,
    serviceId: number[] | null = null,
    includes: string[] = []
): Promise<[PrivateService[], PublicService[]]> => {
    const args = [];
    let sql = "SELECT * FROM services";
    if (serviceId) {
        sql += (sql.includes("WHERE") ? " ||" : " WHERE") + " service_id IN (?)";
        args.push(serviceId);
    }

    let services: any[];
    try {
        [services] = await database.query<RowDataPacket[][]>(sql, args);
    } catch (error) {
        console.log(`SQL Error - ${__filename} - ${error}`);
        throw new Error("Database error");
    }

    if (services.length > 0 && includes.includes("online")) {
        await Promise.all(
            services.map(async (service) => {
                let lastEvent: any;
                try {
                    [lastEvent] = await database.query<RowDataPacket[][]>(
                        "SELECT * FROM services_events WHERE service_id=? && checker_id=? ORDER BY minute DESC LIMIT 1",
                        [service.service_id, config.dataCheckerId]
                    );
                    lastEvent = lastEvent[0];
                } catch (error) {
                    console.log(`SQL Error - ${__filename} - ${error}`);
                    throw new Error("Database error");
                }

                service.online = !!lastEvent?.online;
            })
        );
    }

    return [
        services.map((service) => ({
            id: service.service_id,
            type: service.type,
            name: service.name,
            host: service.host,
            protocol: service.protocol,
            alert: !!service.alert,
            disabled: !!service.disabled,
            online: service?.online
        })),
        services.map((service) => ({
            id: service.service_id,
            name: service.name,
            disabled: !!service.disabled,
            online: service?.online
        }))
    ];
};

export const getPages = async (
    database: Pool,
    pageId: number[] | null = null,
    shortName: string[] | null = null,
    domain: string[] | null = null,
    includes: string[] = []
): Promise<[PrivatePage[], PublicPage[]]> => {
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

    let pages: any[];
    try {
        [pages] = await database.query<RowDataPacket[][]>(sql, args);
    } catch (error) {
        console.log(`SQL Error - ${__filename} - ${error}`);
        throw new Error("Database error");
    }

    if (pages.length > 0 && includes.includes("services")) {
        const pagesServices = await getPagesServices(
            database,
            pages.map((page) => page.page_id),
            subIncludes(includes, "services")
        );
        for (const page of pages) {
            const servicesIndexes = pagesServices[0]
                .map((s, i) => i)
                .filter(
                    (i) => ((pagesServices[0][i].page as PrivatePage).id ?? pagesServices[0][i].page) === page.page_id
                );
            page.services = [
                servicesIndexes.map((i) => pagesServices[0][i]),
                servicesIndexes.map((i) => pagesServices[1][i])
            ];
        }
    }

    if (pages.length > 0 && includes.includes("subpages")) {
        const pagesSubPages = await getPagesSubPages(
            database,
            pages.map((page) => page.page_id),
            subIncludes(includes, "subpages").concat(
                includes.includes("subpages.subpage") ? includes.map((include) => "subpage." + include) : []
            )
        );
        for (const page of pages) {
            const subPagesIndexes = pagesSubPages[0]
                .map((s, i) => i)
                .filter(
                    (i) => ((pagesSubPages[0][i].page as PrivatePage).id ?? pagesSubPages[0][i].page) === page.page_id
                );
            page.subPages = [
                subPagesIndexes.map((i) => pagesSubPages[0][i]),
                subPagesIndexes.map((i) => pagesSubPages[1][i])
            ];
        }
    }

    return [
        pages.map((page) => ({
            id: page.page_id,
            shortName: page.short_name,
            title: page.title,
            url: page.url,
            logoUrl: page.logo_url,
            domain: page.domain,
            subPages: page.subPages ? page.subPages[0] : undefined,
            services: page.services ? page.services[0] : undefined
        })),
        pages.map((page) => ({
            shortName: page.short_name,
            title: page.title,
            url: page.url,
            logoUrl: page.logo_url,
            subPages: page.subPages ? page.subPages[1] : undefined,
            services: page.services ? page.services[1] : undefined
        }))
    ];
};

export const getPagesSubPages = async (
    database: Pool,
    pageId: number[] | null = null,
    includes: string[] = []
): Promise<[PrivatePageSubPage[], PublicPageSubPage[]]> => {
    const args = [];
    let sql = "SELECT * FROM pages_subpages";
    if (pageId) {
        sql += (sql.includes("WHERE") ? " ||" : " WHERE") + " page_id IN (?)";
        args.push(pageId);
    }

    let pagesSubPages: any[];
    try {
        [pagesSubPages] = await database.query<RowDataPacket[][]>(sql, args);
    } catch (error) {
        console.log(`SQL Error - ${__filename} - ${error}`);
        throw new Error("Database error");
    }

    const pages =
        pagesSubPages.length > 0 && includes.includes("page")
            ? await getPages(
                  database,
                  pagesSubPages.map((pagesSubPage) => pagesSubPage.page_id),
                  null,
                  null,
                  subIncludes(includes, "page")
              )
            : [];
    const subPages =
        pagesSubPages.length > 0 && includes.includes("subpage")
            ? await getPages(
                  database,
                  pagesSubPages.map((pagesSubPage) => pagesSubPage.subpage_id),
                  null,
                  null,
                  subIncludes(includes, "subpage")
              )
            : [];

    return [
        pagesSubPages.map((pagesSubPage) => ({
            page: pages[0]?.find((page) => page.id === pagesSubPage.page_id) ?? pagesSubPage.page_id,
            subPage: subPages[0]?.find((subPage) => subPage.id === pagesSubPage.subpage_id) ?? pagesSubPage.subpage_id
        })),
        pagesSubPages.map((pagesSubPage) => ({
            page: includes.includes("page")
                ? pages[1][pages[0].findIndex((page) => page.id === pagesSubPage.page_id)]
                : null,
            subPage: includes.includes("subpage")
                ? subPages[1][subPages[0].findIndex((page) => page.id === pagesSubPage.subpage_id)]
                : null
        }))
    ];
};

export const getPagesServices = async (
    database: Pool,
    pageId: number[] | null = null,
    includes: string[] = []
): Promise<[PrivatePageService[], PublicPageService[]]> => {
    const args = [];
    let sql = "SELECT * FROM pages_services";
    if (pageId) {
        sql += (sql.includes("WHERE") ? " ||" : " WHERE") + " page_id IN (?)";
        args.push(pageId);
    }

    let pagesServices: any[];
    try {
        [pagesServices] = await database.query<RowDataPacket[][]>(sql, args);
    } catch (error) {
        console.log(`SQL Error - ${__filename} - ${error}`);
        throw new Error("Database error");
    }

    const pages =
        pagesServices.length > 0 && includes.includes("page")
            ? await getPages(
                  database,
                  pagesServices.map((pageService) => pageService.page_id),
                  null,
                  null,
                  subIncludes(includes, "page")
              )
            : [];
    const services =
        pagesServices.length > 0 && includes.includes("service")
            ? await getServices(
                  database,
                  pagesServices.map((pageService) => pageService.service_id),
                  subIncludes(includes, "service")
              )
            : [];

    return [
        pagesServices.map((pageService) => ({
            page: pages[0]?.find((page) => page.id === pageService.page_id) ?? pageService.page_id,
            service: services[0]?.find((service) => service.id === pageService.service_id) ?? pageService.service_id,
            position: pageService.position,
            displayName: pageService.display_name
        })),
        pagesServices.map((pageService) => ({
            page: includes.includes("page")
                ? pages[1][pages[0].findIndex((page) => page.id === pageService.page_id)]
                : null,
            service: services[1]?.find((service) => service.id === pageService.service_id) ?? pageService.service_id,
            position: pageService.position,
            displayName: pageService.display_name
        }))
    ];
};

export const getCheckers = async (
    database: Pool,
    checkerId: number[] | null = null,
    includes: string[] = []
): Promise<Checker[]> => {
    const args = [];
    let sql = "SELECT * FROM checkers";
    if (checkerId) {
        sql += (sql.includes("WHERE") ? " ||" : " WHERE") + " checker_id IN (?)";
        args.push(checkerId);
    }

    let checkers: any[];
    try {
        [checkers] = await database.query<RowDataPacket[][]>(sql, args);
    } catch (error) {
        console.log(`SQL Error - ${__filename} - ${error}`);
        throw new Error("Database error");
    }

    return checkers.map((checker) => ({
        id: checker.checker_id,
        name: checker.name,
        description: checker.description,
        location: checker.location,
        checkSecond: checker.check_second
    }));
};

export const getGroups = async (
    database: Pool,
    groupId: number[] | null = null,
    includes: string[] = []
): Promise<Group[]> => {
    const args = [];
    let sql = "SELECT * FROM groups";
    if (groupId) {
        sql += (sql.includes("WHERE") ? " ||" : " WHERE") + " group_id IN (?)";
        args.push(groupId);
    }

    let groups: any[];
    try {
        [groups] = await database.query<RowDataPacket[][]>(sql, args);
    } catch (error) {
        console.log(`SQL Error - ${__filename} - ${error}`);
        throw new Error("Database error");
    }

    if (groups.length > 0 && includes.includes("services")) {
        const groupsServices = await getGroupsServices(
            database,
            groups.map((group) => group.group_id),
            subIncludes(includes, "services")
        );
        for (const group of groups) {
            const servicesIndexes = groupsServices
                .map((s, i) => i)
                .filter((i) => ((groupsServices[i].group as Group).id ?? groupsServices[i].group) === group.group_id);
            group.services = servicesIndexes.map((i) => groupsServices[i]);
        }
    }

    if (groups.length > 0 && includes.includes("checkers")) {
        const groupsCheckers = await getGroupsCheckers(
            database,
            groups.map((group) => group.group_id),
            subIncludes(includes, "checkers")
        );
        for (const group of groups) {
            const checkersIndexes = groupsCheckers
                .map((c, i) => i)
                .filter((i) => ((groupsCheckers[i].group as Group).id ?? groupsCheckers[i].group) === group.group_id);
            group.checkers = checkersIndexes.map((i) => groupsCheckers[i]);
        }
    }

    return groups.map((group) => ({
        id: group.group_id,
        name: group.name,
        services: group.services,
        checkers: group.checkers
    }));
};

export const getGroupsServices = async (
    database: Pool,
    groupId: number[] | null = null,
    includes: string[] = []
): Promise<GroupService[]> => {
    const args = [];
    let sql = "SELECT * FROM groups_services";
    if (groupId) {
        sql += (sql.includes("WHERE") ? " ||" : " WHERE") + " group_id IN (?)";
        args.push(groupId);
    }

    let groupsServices: any[];
    try {
        [groupsServices] = await database.query<RowDataPacket[][]>(sql, args);
    } catch (error) {
        console.log(`SQL Error - ${__filename} - ${error}`);
        throw new Error("Database error");
    }

    const groups =
        groupsServices.length > 0 && includes.includes("group")
            ? await getGroups(
                  database,
                  groupsServices.map((gs) => gs.group_id),
                  subIncludes(includes, "group")
              )
            : null;
    const services =
        groupsServices.length > 0 && includes.includes("service")
            ? await getServices(
                  database,
                  groupsServices.map((gs) => gs.service_id),
                  subIncludes(includes, "service")
              )
            : [];

    return groupsServices.map((gs) => ({
        group: groups?.find((g) => g.id === gs.group_id) ?? gs.group_id,
        service: services[0]?.find((s) => s.id === gs.service_id) ?? gs.service_id
    }));
};

export const getGroupsCheckers = async (
    database: Pool,
    groupId: number[] | null = null,
    includes: string[] = []
): Promise<GroupChecker[]> => {
    const args = [];
    let sql = "SELECT * FROM groups_checkers";
    if (groupId) {
        sql += (sql.includes("WHERE") ? " ||" : " WHERE") + " group_id IN (?)";
        args.push(groupId);
    }

    let groupsCheckers: any[];
    try {
        [groupsCheckers] = await database.query<RowDataPacket[][]>(sql, args);
    } catch (error) {
        console.log(`SQL Error - ${__filename} - ${error}`);
        throw new Error("Database error");
    }

    const groups =
        groupsCheckers.length > 0 && includes.includes("group")
            ? await getGroups(
                  database,
                  groupsCheckers.map((gc) => gc.group_id),
                  subIncludes(includes, "group")
              )
            : null;
    const checkers =
        groupsCheckers.length > 0 && includes.includes("checker")
            ? await getCheckers(
                  database,
                  groupsCheckers.map((gc) => gc.checker_id),
                  subIncludes(includes, "checker")
              )
            : null;

    return groupsCheckers.map((gc) => ({
        group: groups?.find((g) => g.id === gc.group_id) ?? gc.group_id,
        checker: checkers?.find((c) => c.id === gc.checker_id) ?? gc.checker_id
    }));
};

const subIncludes = (includes: string[], name: string) =>
    includes.filter((include) => include.startsWith(name + ".")).map((include) => include.replace(name + ".", ""));

export type PrivateService = {
    id: number;
    name: string;
    disabled: boolean;
    online?: Boolean;
};

export type PublicService = {
    id: number;
    name: string;
    disabled: boolean;
    online?: Boolean;
};

export type PrivatePage = {
    id: number;
    shortName: string;
    title: string;
    url: string;
    logoUrl: string;
    domain: string | null;
    subPages?: PrivatePageSubPage[];
    services?: PrivatePageService[];
};

export type PublicPage = {
    shortName: string;
    title: string;
    url: string;
    logoUrl: string;
    subPages?: PublicPageSubPage[];
    services?: PublicPageService[];
};

export type PrivatePageSubPage = {
    page: PrivatePage | number;
    subPage: PrivatePage | number;
};

export type PublicPageSubPage = {
    page: PublicPage | null;
    subPage: PublicPage | null;
};

export type PrivatePageService = {
    page: PrivatePage | number;
    service: PrivateService | number;
    position: number;
    displayName: string;
};

export type PublicPageService = {
    page: PublicPage | null;
    service: PublicService | number;
    position: number;
    displayName: string;
};

export type Checker = {
    id: number;
    name: string;
    description: string;
    location: string;
    checkSecond: number;
};

export type Group = {
    id: number;
    name: string;
};

export type GroupService = {
    group: Group | number;
    service: PrivateService | number;
};

export type GroupChecker = {
    group: Group | number;
    checker: Checker | number;
};
