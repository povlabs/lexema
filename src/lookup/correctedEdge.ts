// A sense's corrected `form_of` edge (ADR 0030, #722), as every lookup read of
// edges takes it. A `corrected_edge` row stands in for the edges its sense
// declares: `aerei`'s noun sense declares none and gets one to `aereo`;
// `parti`'s senses about `parto` declare `neonato` and `Parti` and read
// `parto` instead. So a read of edges on a master with corrected edges is two
// arms joined by UNION: the source's `form_of_edge` rows of every sense no
// correction sets, and the `corrected_edge` rows, each read through the same
// index as the source's (by record, or `corrected_edge_by_target` by word).
// A master without the table (`DictionaryTables.edgeCorrections`) is sent the
// source arm alone, as before #722.

/**
 * The condition that keeps a `form_of_edge` row, aliased `alias`, whose sense
 * no corrected edge stands in for: one probe of the table's primary key.
 */
export const sourceEdgeServed = (alias: string): string =>
  `NOT EXISTS (SELECT 1 FROM corrected_edge ce WHERE ce.record_id = ${alias}.record_id AND ce.sense_index = ${alias}.sense_index)`;
