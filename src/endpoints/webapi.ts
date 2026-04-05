import { OpenAPIRoute, Str } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";
import { webApiRegistry } from "../types/webapi";

import { authenticateToken } from "../types/auth";

export class WebAPIRuntimeEndpoint extends OpenAPIRoute {
	schema = {
		tags: ["WebAPI"],
		summary: "Dynamic WebAPI Handler",
		request: {
			params: z.object({
				interfaceName: Str({ description: "WebAPI Interface Name" }),
				methodName: Str({ description: "WebAPI Method Name" }),
				version: Str({ description: "WebAPI Method Version" }),
			}),
			body: {
				content: {
					"application/json": {
						schema: z.any(),
					},
				},
			},
		},
		responses: {
			"200": {
				description: "Returns the result of the WebAPI call",
				content: {
					"application/json": {
						schema: z.any(),
					},
				},
			},
			"400": {
				description: "Bad Request",
				content: {
					"application/json": {
						schema: z.object({
							success: z.boolean(),
							error: z.string(),
						}),
					},
				},
			},
			"401": {
				description: "Unauthorized",
				content: {
					"application/json": {
						schema: z.object({
							success: z.boolean(),
							error: z.string(),
						}),
					},
				},
			},
			"404": {
				description: "Not Found",
				content: {
					"application/json": {
						schema: z.object({
							success: z.boolean(),
							error: z.string(),
						}),
					},
				},
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		
		const { interfaceName, methodName, version } = data.params;
		const parsedVersion = parseInt(version, 10);
		
		if (isNaN(parsedVersion)) {
			c.status(400);
			return { success: false, error: "Invalid version number" };
		}

		const body = data.body;

		const iface = webApiRegistry.getInterface(interfaceName);
		if (!iface) {
			c.status(404);
			return { success: false, error: "Interface not found" };
		}

		const versionMap = iface.methods.get(methodName);
		if (!versionMap) {
			c.status(404);
			return { success: false, error: "Method not found" };
		}

		const method = versionMap.get(parsedVersion);
		if (!method) {
			c.status(404);
			return { success: false, error: "Version not found" };
		}

		let token = c.req.header("Authorization")?.replace("Bearer ", "");
		if (!token && body && typeof body === "object" && "token" in body) {
			token = body.token;
		}

		if (!token) {
			c.status(401);
			return { success: false, error: "Missing authentication token" };
		}

		const auth = await authenticateToken(token, c);
		if (!auth) {
			c.status(401);
			return { success: false, error: "Invalid authentication token" };
		}

		try {
			const result = await method.handler(c, body, auth);
			return result;
		} catch (err) {
			console.error(`Error executing WebAPI ${interfaceName}.${methodName} v${parsedVersion}:`, err);
			c.status(500);
			return { success: false, error: "Internal Server Error" };
		}
	}
}
