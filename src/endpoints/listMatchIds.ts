import { Bool, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext, Message } from "../types";

export class ListMatchIds extends OpenAPIRoute {
    schema = {
        tags: ["Match"],
        summary: "Lists all match ids",
        responses: {
            "200": {
                description: "Returns success",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: Bool(),
                        }),
                    },
                },
            },
        },
    };

    async handle(c: AppContext) {
        const query = "SELECT match_id FROM match_results";
        const { results } = await c.env.tc2_match_db.prepare(query).all();
        return {
            success: true,
            data: results,
        };
    }
}
