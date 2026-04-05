import { D1ReadEndpoint } from "chanfana";
import { matchDataMeta } from "../types";

export class GetMatchData extends D1ReadEndpoint {
    _meta = matchDataMeta;
    dbName = "tc2_match_db";
}