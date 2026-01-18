export interface Groth16Proof {
  a: [bigint, bigint];
  b: [[bigint, bigint], [bigint, bigint]];
  c: [bigint, bigint];
  publicSignals: bigint[];
}

export interface LicensePlateProofInput {
  plateChars: bigint[];
  salt: bigint;
  wasmUrl: string;
  zkeyUrl: string;
}

function parseSolidityCallData(calldata: string): bigint[] {
  return calldata
    .replace(/["[\]\s]/g, "")
    .split(",")
    .filter(Boolean)
    .map((value) => BigInt(value));
}

export async function generateLicensePlateProof({
  plateChars,
  salt,
  wasmUrl,
  zkeyUrl,
}: LicensePlateProofInput): Promise<Groth16Proof> {
  const snarkjs = await import("snarkjs");
  const circomlibjs = await import("circomlibjs");

  const poseidon = await circomlibjs.buildPoseidon();
  const poseidonHash = poseidon([...plateChars, salt]);
  const commitment = BigInt(poseidon.F.toString(poseidonHash));

  const input = {
    plateChars: plateChars.map((value) => value.toString()),
    salt: salt.toString(),
    publicCommitment: commitment.toString(),
  };

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    wasmUrl,
    zkeyUrl,
  );

  const calldata = await snarkjs.groth16.exportSolidityCallData(
    proof,
    publicSignals,
  );
  const args = parseSolidityCallData(calldata);

  if (args.length < 8) {
    throw new Error("ZK証明のパラメータが不正です");
  }

  const parsed: Groth16Proof = {
    a: [args[0], args[1]],
    b: [
      [args[2], args[3]],
      [args[4], args[5]],
    ],
    c: [args[6], args[7]],
    publicSignals: publicSignals.map((value: string) => BigInt(value)),
  };

  return parsed;
}
