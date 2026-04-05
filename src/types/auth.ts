import type { Context } from "hono";

class DefaultableBoolean {
	value: boolean;
	isDefault: boolean;

	constructor(value: boolean, isDefault: boolean = false) {
		this.value = value;
		this.isDefault = isDefault;
	}

	emit(value: boolean): boolean {
		if (value === undefined || value === null) return this.value;
		return this.isDefault ? value : (this.value || value);
	}

	set(value: boolean): void {
		if (value === undefined || value === null) return;
		this.value = value;
		this.isDefault = false;
	}

	merge(value: boolean): void {
		if (value === undefined || value === null) return;
		this.value = this.emit(value);
		this.isDefault = false;
	}

	get(): boolean {
		return this.value;
	}

	toJSON(): boolean {
		return this.get();
	}
}

const AuthRoleDefaults = {
	result_poster: false,
}
export type AuthRole = keyof typeof AuthRoleDefaults;
const AuthRoleKeys = Object.keys(AuthRoleDefaults) as AuthRole[];

export class AuthRoles {
	container: Record<AuthRole, DefaultableBoolean>;

	constructor() {
		this.container = {} as Record<AuthRole, DefaultableBoolean>;
		for (const role of AuthRoleKeys) {
			this.container[role] = new DefaultableBoolean(AuthRoleDefaults[role]);
		}
	}

	set(roles: Partial<Record<AuthRole, boolean>>): void {
		if (!roles) return;
		for (const role of AuthRoleKeys) {
			if (roles[role] !== undefined) {
				this[role].set(roles[role] as boolean);
			}
		}
	}

	get(role: AuthRole): boolean {
		return this[role].get();
	}

	merge(record: Partial<Record<AuthRole, boolean>>): void {
		if (!record) return;
		for (const role of AuthRoleKeys) {
			if (record[role] !== undefined) {
				this[role].merge(record[role] as boolean);
			}
		}
	}

	toJSON(): Partial<Record<AuthRole, boolean>> {
		const result: Partial<Record<AuthRole, boolean>> = {};
		for (const role of AuthRoleKeys) {
			result[role] = this[role].get();
		}
		return result;
	}
}

export class AuthContext {
	isSteam: boolean;
	actorId: string | bigint;
	roles: AuthRoles = new AuthRoles();

	constructor(isSteam: boolean, actorId: string | bigint, roles?: Partial<Record<AuthRole, boolean>>) {
		this.isSteam = isSteam;
		this.actorId = actorId;

		if (roles) {
			this.roles.merge(roles);
		}
	}

	hasRole(role: AuthRole): boolean {
		return this.roles.get(role);
	}
}

async function getActorAuthFromRow(row: any, isSteam: boolean = false): Promise<AuthContext | null> {
	if (!row || !row.actor_id) return null;
	let roles: Partial<Record<AuthRole, boolean>> = {};
	if (row.roles) {
		try {
			roles = JSON.parse(row.roles as string);
		} catch (e) {
			console.error("Failed to parse actor roles", e);
		}
	}
	return new AuthContext(isSteam, row.actor_id as string, roles);
}

async function getActorAuthById(actorId: string, c: Context<{ Bindings: any }>, isSteam: boolean = false): Promise<AuthContext | null> {
	const query = "SELECT actor_id, roles FROM actors WHERE actor_id = $1 LIMIT 1";
	const result = await c.env.tc2_actor_db.prepare(query).bind(actorId).first();

	return getActorAuthFromRow(result, isSteam);
}

export async function authenticateToken(token: string, c: Context<{ Bindings: any }>): Promise<AuthContext | null> {
	if (!token) return null;

	try {
		// First, try checking the DB for an API key registered to an actor
		const query = "SELECT actor_id, roles FROM actors WHERE key = $1 LIMIT 1";
		const result = await c.env.tc2_actor_db.prepare(query).bind(token).first();

		const actorAuth = await getActorAuthFromRow(result, false);
		if (actorAuth) return actorAuth;
	} catch (err) {
		console.warn("Actor lookup failed:", err);
	}

	// If it didn't match the DB, it might be a Steam session ticket.
	const steamApiKey = c.env.STEAM_API_KEY;
	const appId = c.env.STEAM_APP_ID || "440";

	if (steamApiKey) {
		try {
			const steamApiUrl = `https://api.steampowered.com/ISteamUserAuth/AuthenticateUserTicket/v1/?key=${steamApiKey}&appid=${appId}&ticket=${token}`;
			const response = await fetch(steamApiUrl);
			if (response.ok) {
				const json = await response.json() as any;
				const params = json?.response?.params;
				if (params && params.result === "OK" && params.steamid) {
					const actorAuth = await getActorAuthById(params.steamid, c, true);
					if (actorAuth) return actorAuth;
					return new AuthContext(true, params.steamid);
				}
			}
		} catch (err) {
			console.error("Steam ticket failed", err);
		}
	}

	// No valid auth found
	return null;
}
