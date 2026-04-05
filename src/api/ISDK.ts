import { WebAPIInterface } from "../types/webapi";
import { MessageDispatcher, ProtoMessage, RawMessage } from "../types/message";
import { ETFGCMsg, CMsgGC_Match_ResultSchema } from "../gen/tf_gcmessages_pb";
import { Snowflake } from "@sapphire/snowflake";
import type { AppContext } from "../types";

const steamIndividualAccount = 76561197960265728n;
const epoch = new Date('2000-01-01T00:00:00.000Z');
const snowflake = new Snowflake(epoch);

const dispatcher = new MessageDispatcher();

import { AuthContext } from "../types/auth";

dispatcher.subscribeMessage(
	ETFGCMsg.k_EMsgGC_Match_Result,
	CMsgGC_Match_ResultSchema,
	async (message, c, auth) => {

		if (message.matchId == BigInt(0)) {
			message.matchId = snowflake.generate();
		}

		function processKV(obj: Record<string, any>, key: string, value: any) {
			if (value instanceof Object) {
				obj[key] = processKVs(value);
				return;
			}
			if (key == "matchId" || key == "ping" || key.startsWith("$")) {
				return;
			}
			if (typeof value == "bigint") {
				if (key == "steamId") {
					obj[key] = Number(value - steamIndividualAccount);
					return;
				}
				obj[key] = value.toString();
				return;
			}
			obj[key] = value;
		}

		console.log(message);
		function processKVs(obj: object) {
			let data: Record<string, any> = {};
			for (const [key, value] of Object.entries(obj)) {
				processKV(data, key, value);
			}
			return data;
		}

		let matchData = processKVs(message);
		console.log(matchData);

		const query = "INSERT INTO match_results (match_id, match_data) VALUES ($1, $2)";
		const match_id = message.matchId.toString();

		await c.env.tc2_match_db.prepare(query).bind(match_id, JSON.stringify(matchData)).run();

		return {
			match_id,
		};
	}
);

export const ISDK = new WebAPIInterface("ISDK");

ISDK.registerMethod({
	name: "SendMessage",
	version: 1,
	handler: async (c: AppContext, data: any, auth: AuthContext) => {
		const inMsgId = data.msg;
		if (!inMsgId || !ETFGCMsg[inMsgId]) {
			return { success: false };
		}

		console.log(data);

		const binaryData = Uint8Array.from(atob(data.data), char => char.charCodeAt(0));
		const rawMessage = new RawMessage(inMsgId, "protobuf", binaryData);

		try {
			const dispatchData = await dispatcher.dispatch(rawMessage, c, auth);
			return {
				success: true,
				data: dispatchData
			};
		} catch (err) {
			console.error(err);
			return { success: false };
		}
	}
});

import { webApiRegistry } from "../types/webapi";
webApiRegistry.registerInterface(ISDK);
