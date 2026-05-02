export interface CommandInfo {
  key: string;
  template: string;
  parameters: string[];
}

export interface CommandExecution {
  id: number;
  commandName: string;
  fullCommand: string;
  output: string;
  status: string;
  executedAt: string;
}

export interface CommandRequest {
  command: string;
  params?: { [key: string]: string };
}
