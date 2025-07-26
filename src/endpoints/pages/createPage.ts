import { Pool, ResultSetHeader } from "mysql2/promise";
import { Request } from "raraph84-lib";

export const run = async (request: Request, database: Pool) => {
    if (!request.jsonBody) {
        request.end(400, "Invalid JSON");
        return;
    }

    if (typeof request.jsonBody.shortName !== "string") {
        request.end(400, "Short name must be a string");
        return;
    }

    request.jsonBody.shortName = request.jsonBody.shortName.trim();

    if (request.jsonBody.shortName.length < 2 || request.jsonBody.shortName.length > 15) {
        request.end(400, "Short name must be between 2 and 15 characters");
        return;
    }

    if (typeof request.jsonBody.title !== "string") {
        request.end(400, "Title must be a string");
        return;
    }

    request.jsonBody.title = request.jsonBody.title.trim();

    if (request.jsonBody.title.length < 2 || request.jsonBody.title.length > 50) {
        request.end(400, "Title must be between 2 and 50 characters");
        return;
    }

    if (typeof request.jsonBody.url !== "string") {
        request.end(400, "Url must be a string");
        return;
    }

    request.jsonBody.url = request.jsonBody.url.trim();

    if (request.jsonBody.url.length < 2 || request.jsonBody.url.length > 500) {
        request.end(400, "Url must be between 2 and 500 characters");
        return;
    }

    if (typeof request.jsonBody.logoUrl !== "string") {
        request.end(400, "Logo url must be a string");
        return;
    }

    request.jsonBody.logoUrl = request.jsonBody.logoUrl.trim();

    if (request.jsonBody.logoUrl.length < 2 || request.jsonBody.logoUrl.length > 500) {
        request.end(400, "Logo url must be between 2 and 500 characters");
        return;
    }

    if (typeof request.jsonBody.domain !== "string" && request.jsonBody.domain !== null) {
        request.end(400, "Domain must be a string or null");
        return;
    }

    if (request.jsonBody.domain !== null) {
        request.jsonBody.domain = request.jsonBody.domain.trim();

        if (request.jsonBody.domain.length < 2 || request.jsonBody.domain.length > 50) {
            request.end(400, "Domain must be between 2 et 50 caractères ou null");
            return;
        }
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
