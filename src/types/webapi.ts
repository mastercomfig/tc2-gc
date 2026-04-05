import type { AppContext } from "../types";
import { AuthContext } from "./auth";

export type WebAPIHandler = (c: AppContext, data: any, auth: AuthContext) => Promise<any> | any;

export interface WebAPIMethodDef {
	name: string;
	version: number;
	handler: WebAPIHandler;
}

export class WebAPIInterface {
	name: string;
	methods: Map<string, Map<number, WebAPIMethodDef>>;

	constructor(name: string) {
		this.name = name;
		this.methods = new Map();
	}

	registerMethod(method: WebAPIMethodDef) {
		if (!this.methods.has(method.name)) {
			this.methods.set(method.name, new Map());
		}
		this.methods.get(method.name)!.set(method.version, method);
	}
}

export class WebAPIRegistry {
	interfaces: Map<string, WebAPIInterface> = new Map();

	registerInterface(iface: WebAPIInterface) {
		this.interfaces.set(iface.name, iface);
	}

	getInterface(name: string) {
		return this.interfaces.get(name);
	}
}

export const webApiRegistry = new WebAPIRegistry();
