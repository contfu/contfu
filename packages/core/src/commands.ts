export enum CommandType {
  CONNECT = 1,
  ACK = 2,
}

export type ConnectCommand = {
  type: CommandType.CONNECT;
  key: Buffer;
};

export type AckCommand = {
  type: CommandType.ACK;
  itemId: Buffer;
};

export type Command = ConnectCommand | AckCommand;
