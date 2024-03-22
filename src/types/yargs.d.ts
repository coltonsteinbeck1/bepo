import yargs from "yargs";

interface ExtendedArguments extends yargs.Arguments {
  prompt?: string;
}
