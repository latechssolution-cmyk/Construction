import Counter from "@/models/Counter";

/**
 * Atomically increment and return the next number in a named sequence
 * (e.g. "invoice-2026"). Using $inc via findOneAndUpdate is atomic at the
 * MongoDB level, so concurrent requests can never be handed the same
 * number — unlike the previous Math.random() suffix, which had roughly a
 * 1-in-9000 chance of colliding per key and produced non-sequential numbers.
 */
export async function nextSequence(key: string): Promise<number> {
  const doc = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );
  return doc.seq;
}

export async function nextInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await nextSequence(`invoice-${year}`);
  return `INV-${year}-${String(seq).padStart(5, "0")}`;
}

export async function nextContractNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await nextSequence(`contract-${year}`);
  return `CNT-${year}-${String(seq).padStart(5, "0")}`;
}
