// Type declarations for the bsv library
declare module 'bsv' {
  export class PrivKey {
    static fromWif(wif: string): PrivKey
    toWif(): string
  }

  export class PubKey {
    static fromPrivKey(privKey: PrivKey): PubKey
    toHex(): string
    toBuffer(): Buffer
  }

  export class KeyPair {
    static fromPrivKey(privKey: PrivKey): KeyPair
    privKey: PrivKey
    pubKey: PubKey
  }

  export class Address {
    static fromPubKey(pubKey: PubKey): Address
    static fromString(address: string): Address
    toString(): string
    hashBuf: Buffer
  }

  export class Bip39 {
    static fromRandom(): Bip39
    static fromString(mnemonic: string): Bip39
    toString(): string
    toSeed(): Buffer
  }

  export class Bip32 {
    static fromSeed(seed: Buffer): Bip32
    derive(path: string): Bip32
    privKey: PrivKey
  }

  export class Tx {
    constructor()
    addTxIn(txHashBuf: Buffer, txOutNum: number, script: Script, nSequence: number): void
    addTxOut(bn: Bn, script: Script): void
    sign(keyPair: KeyPair, sighashType: number, nIn: number, script: Script, valueBn: Bn): Sig
    toHex(): string
    txIns: TxIn[]
  }

  export class TxIn {
    setScript(script: Script): void
  }

  export class Script {
    static fromString(str: string): Script
    static fromPubKeyHash(hashBuf: Buffer): Script
    constructor()
    writeOpCode(opCode: number): Script
    writeBuffer(buf: Buffer): Script
    chunks: unknown[]
  }

  export class Sig {
    static SIGHASH_ALL: number
    static SIGHASH_FORKID: number
    toTxFormat(): Buffer
  }

  export function Bn(value: number): Bn
  export class Bn {
    constructor(value: number)
  }

  export class OpCode {
    static OP_FALSE: number
    static OP_IF: number
    static OP_ENDIF: number
    static OP_RETURN: number
    static OP_0: number
    static OP_1: number
  }

  export class Bsm {
    static sign(message: Buffer, keyPair: KeyPair): Buffer
  }
}
