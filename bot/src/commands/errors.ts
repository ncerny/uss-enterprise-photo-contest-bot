export class CommandPermissionError extends Error {
  constructor(message = 'You do not have permission to run this command.') {
    super(message);
    this.name = 'CommandPermissionError';
  }
}

export class CommandValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CommandValidationError';
  }
}

export class CommandExecutionError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'CommandExecutionError';
  }
}
