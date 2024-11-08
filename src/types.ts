import { INSGeneric } from "@zondax/ledger-js";

export interface ResponseBase {
  errorMessage: string;
  returnCode: number;
}

export interface FlareIns extends INSGeneric {
  GET_VERSION: 0x00;
  GET_ADDR: 0x01;
  SIGN: 0x02;
  SIGN_HASH: 0x03;
}

export interface ResponseAddress extends ResponseBase {
  bech32_address: string;
  compressed_pk: Buffer;
}

export interface ResponseSign extends ResponseBase {
  r?: Buffer;
  s?: Buffer;
  v?: Buffer;
}
