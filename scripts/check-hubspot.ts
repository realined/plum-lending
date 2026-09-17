import { checkHubSpotConnection } from "../src/server/hubspot-check";

const result = await checkHubSpotConnection({
  APP_MODE: process.env.APP_MODE,
  HUBSPOT_PRIVATE_APP_TOKEN: process.env.HUBSPOT_PRIVATE_APP_TOKEN,
  HUBSPOT_SPONSOR_PROPERTY: process.env.HUBSPOT_SPONSOR_PROPERTY,
  HUBSPOT_SPONSOR_VALUE: process.env.HUBSPOT_SPONSOR_VALUE,
});
if (result.ok) console.info(result.message);
else console.error(result.message);
process.exitCode = result.ok ? 0 : 1;
