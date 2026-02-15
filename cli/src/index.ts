#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

// SpectraOps CLI entry point

yargs(hideBin(process.argv))
  .scriptName('spectraops')
  .usage('$0 <cmd> [args]')
  .command(
    'hello',
    'Prints hello from SpectraOps CLI',
    () => {},
    () => {
      console.log('Hello from SpectraOps CLI!');
    },
  )
  .help().argv;
