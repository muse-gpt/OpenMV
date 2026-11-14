#!/usr/bin/env node
import { buildMvCli } from './cli.js';

const exitCode = await buildMvCli().parse(process.argv.slice(2));
process.exit(exitCode);
