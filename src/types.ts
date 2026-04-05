import { Str, Int } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";

export type AppContext = Context<{ Bindings: Env }>;

export const Message = z.object({
	msg: Int(),
	data: Str(),
	token: Str(),
});

export const MatchDataModel = z.object({
	match_id: z.string(),
	match_data: z.string(),
});

export const matchDataMeta = {
	model: {
		schema: MatchDataModel,
		primaryKeys: ['match_id'],
		tableName: 'match_results',
	},
};
