const { query } = require("raraph84-lib");

/**
 * @param {import("raraph84-lib/src/Request")} request 
 * @param {import("mysql").Pool} database 
 */
module.exports.run = async (request, database) => {

    let page;
    try {
        page = (await query(database, "SELECT * FROM Pages WHERE Short_Name=?", [request.urlParams.shortName]))[0];
    } catch (error) {
        request.end(500, "Internal server error");
        console.log(`SQL Error - ${__filename} - ${error}`);
        return;
    }

    if (!page) {
        request.end(400, "This page does not exist");
        return;
    }

    const getLastStatus = async (node) => {

        let lastStatus;
        try {
            lastStatus = (await query(database, "SELECT * FROM Nodes_Events WHERE Node_ID=? ORDER BY Minute DESC LIMIT 1", [node.Node_ID]))[0];
        } catch (error) {
            request.end(500, "Internal server error");
            console.log(`SQL Error - ${__filename} - ${error}`);
            return;
        }

        return lastStatus && lastStatus.Online;
    }

    const getPage = async (page) => {

        let subPages;
        try {
            subPages = await query(database, "SELECT * FROM Pages_Subpages INNER JOIN Pages ON Pages.Page_ID=Pages_Subpages.Subpage_ID WHERE Pages_Subpages.Page_ID=?", [page.Page_ID]);
        } catch (error) {
            request.end(500, "Internal server error");
            console.log(`SQL Error - ${__filename} - ${error}`);
            return;
        }

        subPages = await Promise.all(subPages.map((subpage) => getPage(subpage)));

        let nodes;
        try {
            nodes = await query(database, "SELECT Nodes.*, Pages_Nodes.Position FROM Pages_Nodes INNER JOIN Nodes ON Pages_Nodes.Node_ID=Nodes.Node_ID WHERE Page_ID=?", [page.Page_ID]);
        } catch (error) {
            request.end(500, "Internal server error");
            console.log(`SQL Error - ${__filename} - ${error}`);
            return;
        }

        nodes = await Promise.all(nodes.map(async (node) => ({ id: node.Node_ID, name: node.Name, online: await getLastStatus(node), position: node.Position, disabled: !!node.Disabled })));

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
    }

    request.end(200, await getPage(page));
}

module.exports.infos = {
    path: "/pages/:shortName",
    method: "GET"
}
