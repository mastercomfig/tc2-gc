import type { Context } from "hono";

export interface AuthContext {
	isSteam: boolean;
	actorId: string | bigint;
}

export async function authenticateToken(token: string, c: Context<{ Bindings: any }>): Promise<AuthContext | null> {
	if (!token) return null;

	try {
		// First, try checking the DB for an API key registered to an actor
		const query = "SELECT actor_id FROM api_keys WHERE key = $1 LIMIT 1";
		const result = await c.env.tc2_actor_db.prepare(query).bind(token).first();

		if (result && result.actor_id) {
			return {
				isSteam: false,
				actorId: result.actor_id as string
			};
		}
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
					return {
						isSteam: true,
						actorId: params.steamid
					};
				}
			}
		} catch (err) {
			console.error("Steam ticket failed", err);
		}
	}

	// No valid auth found
	return null;
}
