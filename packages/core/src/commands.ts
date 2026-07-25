import { defineEnum, type EnumValue } from "./enums";

export const CommandType = defineEnum({
  CONNECT: 1,
  ACK: 2,
});

export type CommandType = EnumValue<typeof CommandType>;

export const ApplicationCommand = defineEnum({
  REFRESH: 1,
  REFRESH_ALL: 2,
});

export type ApplicationCommand = EnumValue<typeof ApplicationCommand>;

export const CommandResult = defineEnum({
  REFRESH: 50,
  REFRESH_ALL: 51,
});

export type CommandResult = EnumValue<typeof CommandResult>;

export const RefreshStatus = defineEnum({
  ACCEPTED: 1,
  UNKNOWN_COLLECTION: 2,
  UNAUTHORIZED: 3,
  MALFORMED: 4,
  QUOTA_OR_BACKPRESSURE: 5,
});

export type RefreshStatus = EnumValue<typeof RefreshStatus>;

export type ConnectCommand = {
  type: typeof CommandType.CONNECT;
  key: Buffer;
};

export type AckCommand = {
  type: typeof CommandType.ACK;
  itemId: Buffer;
};

export type Command = ConnectCommand | AckCommand;
export type ControlCommand = Command;
