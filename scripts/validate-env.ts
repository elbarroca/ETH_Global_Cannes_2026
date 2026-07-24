import { EnvironmentValidationError, validateEnvironment } from "../src/config/env";

try {
  const requireDatabase = process.argv.includes("--require-database");
  const environment = validateEnvironment(process.env, { requireDatabase });
  console.log(
    `Environment valid: mode=${requireDatabase ? "database" : "offline"} ` +
      `database=${environment.databaseUrl ? "set" : "unset"} ` +
      `backgroundWorkers=${environment.enableBackgroundWorkers}`,
  );
} catch (error) {
  if (error instanceof EnvironmentValidationError) {
    console.error(error.message);
  } else {
    console.error("Environment validation failed unexpectedly");
  }
  process.exitCode = 1;
}
