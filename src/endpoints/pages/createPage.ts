import { Pool, ResultSetHeader } from "mysql2/promise";
import { Request } from "raraph84-lib";

export const run = async (request: Request, database: Pool) => {
    if (!request.jsonBody) {
        request.end(400, "Invalid JSON");
        return;
    }

    if (typeof request.jsonBody.shortName === "undefined") {
        request.end(400, "Missing short name");
        return;
    }

    if (typeof request.jsonBody.shortName !== "string") {
        request.end(400, "Short name must be a string");
        return;
    }

    if (typeof request.jsonBody.title === "undefined") {
        request.end(400, "Missing title");
        return;
    }

    if (typeof request.jsonBody.title !== "string") {
        request.end(400, "Title must be a string");
        return;
    }

    if (typeof request.jsonBody.url === "undefined") {
        request.end(400, "Missing url");
        return;
    }

    if (typeof request.jsonBody.url !== "string") {
        request.end(400, "Url must be a string");
        return;
    }

    if (typeof request.jsonBody.logoUrl === "undefined") {
        request.end(400, "Missing logo url");
        return;
    }

    if (typeof request.jsonBody.logoUrl !== "string") {
        request.end(400, "Logo url must be a string");
        return;
    }

    if (typeof request.jsonBody.domain === "undefined") {
        request.end(400, "Missing domain");
        return;
    }

    if (typeof request.jsonBody.domain !== "string" && request.jsonBody.domain !== null) {
        request.end(400, "Domain must be a string or null");
        return;
    }

    let pageId;
    try {
        pageId = (
            await database.query<ResultSetHeader>(
                "INSERT INTO pages (short_name, title, url, logo_url, domain) VALUES (?, ?, ?, ?, ?)",
                [
                    request.jsonBody.shortName,
                    request.jsonBody.title,
                    request.jsonBody.url,
                    request.jsonBody.logoUrl,
                    request.jsonBody.domain
                ]
            )
        )[0].insertId;
    } catch (error) {
        request.end(500, "Internal server error");
        console.log(`SQL Error - ${__filename} - ${error}`);
        return;
    }

    request.end(200, { id: pageId });
};

export const infos = {
    path: "/pages",
    method: "POST",
    requiresAuth: true
};
