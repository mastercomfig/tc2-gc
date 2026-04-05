import { fromHono } from "chanfana";
import { Hono } from "hono";
import { WebAPIRuntimeEndpoint } from "./endpoints/webapi";
import "./api/ISDK";
import { GetMatchData } from "./endpoints/getMatchData";
import { ListMatchIds } from "./endpoints/listMatchIds";
import { cors } from "hono/cors";

// Start a Hono app
const app = new Hono<{ Bindings: Env }>();

app.use(
	"*",
	cors({
		origin: [
			"https://comfig.app",
			"https://develop.mastercomfig-site.pages.dev",
			"http://localhost:4321",
			"http://127.0.0.1:4321",
			"http://localhost:8787",
			"https://teamcomtress.com",
		],
	}),
);

// Setup OpenAPI registry
const openapi = fromHono(app, {
	docs_url: "/",
});

// Register OpenAPI endpoints
openapi.post("/webapi/:interfaceName/:methodName/v:version", WebAPIRuntimeEndpoint);

openapi.get("/match/:match_id", GetMatchData);
openapi.post("/matches", ListMatchIds);

// Export the Hono app
export default app;
