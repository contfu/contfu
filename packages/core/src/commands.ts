import { defineEnum, type EnumValue } from "./enums";

export const CommandType = defineEnum({
  CONNECT: 1,
  ACK: 2,
});

export type CommandType = EnumValue<typeof CommandType>;

export type ConnectCommand = {
  type: typeof CommandType.CONNECT;
  key: Buffer;
};

export type AckCommand = {
  type: typeof CommandType.ACK;
  itemId: Buffer;
};

export type Command = ConnectCommand | AckCommand;
