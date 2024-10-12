export enum CommandType {
  CONNECT = 1,
}

export type ConnectCommand = {
  type: CommandType.CONNECT;
  key: Buffer;
};

export type Command = ConnectCommand;
