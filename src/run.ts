/**
 * PBS Exporter — process entrypoint.
 *
 * This is the thin CLI bootstrap and the single place that uses commander: it
 * declares the `--pbs.*` flags (with their defaults), parses `process.argv`,
 * hands the parsed options to `loadConfig` to produce the {@link Config}, and
 * then runs the application via `main()`.
 *
 * Keeping all argv/commander handling here lets `config.ts` stay a pure
 * options+env → Config mapper, and `main.ts` focus on wiring/serving.
 */

import { program } from "commander";
import { type CliOptions, loadConfig, type Config } from "./config.ts";
import { log } from "./log.ts";
import { main } from "./main.ts";

program
  .name("pbs-exporter")
  .description("Export Proxmox Backup Server metrics for Prometheus")
  .option("--pbs.endpoint <endpoint>", "Proxmox Backup Server endpoint", "")
  .option(
    "--pbs.username <username>",
    "Proxmox Backup Server username",
    "root@pam",
  )
  .option("--pbs.api.token <token>", "Proxmox Backup Server API token", "")
  .option(
    "--pbs.api.token.name <name>",
    "Proxmox Backup Server API token name",
    "pbs-exporter",
  )
  .option("--pbs.timeout <duration>", "Proxmox Backup Server timeout", "5s")
  .option("--pbs.insecure <bool>", "Proxmox Backup Server insecure", "false")
  .option(
    "--pbs.metrics-path <path>",
    "Path under which to expose metrics",
    "/metrics",
  )
  .option(
    "--pbs.listen-address <address>",
    "Address on which to expose metrics",
    ":10019",
  )
  .option("--pbs.loglevel <level>", "Loglevel", "info")
  .option("--pbs.logformat <format>", "Log format (text|json)", "text")
  .option("--version", "Show version and exit", false)
  .parse();

const opts = program.opts<CliOptions>();

let config: Config;
try {
  config = loadConfig(opts, process.env);
} catch (err) {
  log.error(
    `Unable to load configuration: ${err instanceof Error ? err.message : String(err)}`,
  );
  process.exit(1);
}

main(config);
