/**
 * @param {import("raraph84-lib/src/Request")} request 
 * @param {import("mysql2/promise").Pool} database 
 */
module.exports.run = async (request, database) => {

    let rawPage;
    try {
        [rawPage] = await database.query("SELECT * FROM Pages WHERE Short_Name=? || Domain=?", [request.urlParams.shortName, request.urlParams.shortName]);
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

    const getLastStatus = async (node) => {

        let [lastEvent] = await database.query("SELECT * FROM services_events WHERE service_id=? ORDER BY minute DESC LIMIT 1", [node.Node_ID]);
        lastEvent = lastEvent[0];

        return !!lastEvent?.online || false;
    };

    const getPage = async (page) => {

        let [subPages] = await database.query("SELECT * FROM Pages_Subpages INNER JOIN Pages ON Pages.Page_ID=Pages_Subpages.Subpage_ID WHERE Pages_Subpages.Page_ID=?", [page.Page_ID]);
        subPages = await Promise.all(subPages.map((subpage) => getPage(subpage)));

        let [nodes] = await database.query("SELECT Nodes.*, Pages_Nodes.Position, Pages_Nodes.Display_Name FROM Pages_Nodes INNER JOIN Nodes ON Pages_Nodes.Node_ID=Nodes.Node_ID WHERE Page_ID=?", [page.Page_ID]);
        nodes = await Promise.all(nodes.map(async (node) => ({
            id: node.Node_ID,
            name: node.Name,
            online: await getLastStatus(node),
            position: node.Position,
            displayName: node.Display_Name,
            disabled: !!node.Disabled
        })));

        const totalNodes = nodes.filter((node) => !node.disabled).length + subPages.reduce((total, subPages) => total + subPages.totalNodes, 0);
        const onlineNodes = nodes.filter((node) => !node.disabled && node.online).length + subPages.reduce((total, subPages) => total + subPages.onlineNodes, 0);
        const offlineNodes = nodes.filter((node) => !node.disabled && !node.online).length + subPages.reduce((total, subPages) => total + subPages.offlineNodes, 0);

        return {
            shortName: page.Short_Name,
            title: page.Title,
            url: page.URL,
            logoUrl: page.Logo_URL,
            subPages: subPages,
            nodes: nodes,
            totalNodes,
            onlineNodes,
            offlineNodes
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
