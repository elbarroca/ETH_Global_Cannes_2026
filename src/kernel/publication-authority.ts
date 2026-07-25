import {
  createEnsPublicationAuthority,
  type EnsPublicationAuthority,
} from "../ens/authority";
import { getEnsPublicationDb } from "../config/database";

export function createProductionEnsPublicationAuthority(): EnsPublicationAuthority {
  return async (request, signal) => {
    try {
      return createEnsPublicationAuthority({
        sql: await getEnsPublicationDb(),
        // Direct ENSv2 production resolution stays closed until its exact
        // deployment policy and resolver are admitted server-side.
        runtime: null,
      })(request, signal);
    } catch {
      return {
        allowed: false,
        decisionId: null,
        errorCode: "ENS_PUBLICATION_NOT_CONFIGURED",
      };
    }
  };
}
