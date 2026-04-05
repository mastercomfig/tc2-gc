import {
	create as protoCreate,
	DescMessage,
	fromBinary as protoFromBinary,
	toBinary as protoToBinary,
	MessageInitShape,
	MessageShape,
} from "@bufbuild/protobuf";
import type { AppContext } from "../types";

export type RawMessageEncoding = "protobuf" | "struct";

export class RawMessage {
	emsg: number;
	encoding: RawMessageEncoding;
	body: Uint8Array;

	constructor(
		emsg: number,
		encoding: RawMessageEncoding,
		body: Uint8Array,
	) {
		this.emsg = emsg;
		this.encoding = encoding;
		this.body = body;
	}

	intoRawMessage(): RawMessage {
		return this;
	}
}

export type IntoRawMessage = {
	intoRawMessage(): RawMessage;
};

export class ProtoMessage<Desc extends DescMessage> implements IntoRawMessage {
	emsg: number;
	schema: Desc;
	body: MessageShape<Desc>;

	constructor(
		emsg: number,
		schema: Desc,
		body: MessageInitShape<Desc>,
	) {
		this.emsg = emsg;
		this.schema = schema;
		this.body = protoCreate(schema, body);
	}

	intoRawMessage(): RawMessage {
		const serializedBody = protoToBinary(this.schema, this.body);
		return new RawMessage(this.emsg, "protobuf", serializedBody);
	}

	static fromRawMessage<Desc extends DescMessage>(
		schema: Desc,
		raw: RawMessage,
	): ProtoMessage<Desc> {
		if (raw.encoding !== "protobuf") {
			throw new Error(
				`Message is not a protobuf message (${raw.emsg})`,
			);
		}

		const body = protoFromBinary(schema, raw.body);
		return new ProtoMessage(raw.emsg, schema, body);
	}
}

export type EMsgFilter = {
	type: "emsg";
	emsg: number;
};

export type Filter = EMsgFilter;

import { AuthContext, AuthRole } from "./auth";

export type SubscriptionOptions = {
	roles?: AuthRole[];
};

export class Subscription {
	filter: Filter;
	callback: (message: RawMessage, c: AppContext, auth: AuthContext) => Promise<any> | any;
	options?: SubscriptionOptions;

	constructor(
		filter: Filter,
		callback: (message: RawMessage, c: AppContext, auth: AuthContext) => Promise<any> | any,
		options?: SubscriptionOptions
	) {
		this.filter = filter;
		this.callback = callback;
		this.options = options;
	}
}

export class MessageDispatcher {
	private subscriptions: Set<Subscription> = new Set();

	subscribe(
		filter: Filter,
		callback: (message: RawMessage, c: AppContext, auth: AuthContext) => Promise<any> | any,
		options?: SubscriptionOptions
	): Subscription {
		const subscription = new Subscription(filter, callback, options);
		this.subscriptions.add(subscription);
		return subscription;
	}

	unsubscribe(subscription: Subscription) {
		this.subscriptions.delete(subscription);
	}

	async dispatch(rawMessage: RawMessage, c: AppContext, auth: AuthContext): Promise<any> {
		for (const subscription of this.subscriptions) {
			const filter = subscription.filter;
			if (filter.type === "emsg" && rawMessage.emsg === filter.emsg) {
				if (subscription.options?.roles) {
					for (const role of subscription.options.roles) {
						if (!auth.hasRole(role)) {
							throw new Error(`Unauthorized: Missing role '${role}' for message ${rawMessage.emsg}`);
						}
					}
				}
				return await subscription.callback(rawMessage, c, auth);
			}
		}
		throw new Error(`Unhandled message: ${rawMessage.emsg}`);
	}

	subscribeMessage<Desc extends DescMessage>(
		emsg: number,
		schema: Desc,
		callback: (message: MessageShape<Desc>, c: AppContext, auth: AuthContext) => Promise<any> | any,
		options?: SubscriptionOptions
	): Subscription {
		return this.subscribe(
			{ type: "emsg", emsg },
			(rawMessage: RawMessage, c: AppContext, auth: AuthContext) => {
				const messageDesc = ProtoMessage.fromRawMessage(schema, rawMessage);
				return callback(messageDesc.body, c, auth);
			},
			options
		);
	}
}
