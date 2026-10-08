// A sense's corrected `form_of` edge (ADR 0030, #722), as every lookup read of
// edges takes it. A `corrected_edge` row stands in for the edges its sense
// declares: `aerei`'s noun sense declares none and gets one to `aereo`;
// `parti`'s senses about `parto` declare `neonato` and `Parti` and read
// `parto` instead. So a read of edges on a master with corrected edges is two
// arms joined by UNION: the source's `form_of_edge` rows of every sense no
// correction sets, and the `corrected_edge` rows of every served record, each
// read through the same index as the source's (by record, or
// `corrected_edge_by_target` by word). A master without the table
// (`DictionaryTables.edgeCorrections`) is sent the source arm alone, as before
// #722.

/**
 * The condition that keeps a `form_of_edge` row, aliased `alias`, whose sense
 * no corrected edge stands in for: one probe of the table's primary key.
 */
export const sourceEdgeServed = (alias: string): string =>
  `NOT EXISTS (SELECT 1 FROM corrected_edge ce WHERE ce.record_id = ${alias}.record_id AND ce.sense_index = ${alias}.sense_index)`;

/**
 * The condition that keeps a `corrected_edge` row, aliased `alias`, whose
 * record is served. A record a later release's change retired, or a hiding
 * rule hid, loses its `form_of_edge` rows but keeps its corrected edges, as
 * every row written by hand beside it (ADR 0025, ADR 0027, ADR 0023); this is
 * what keeps a lookup from listing it as a form through them. One probe each
 * of `applied_change`'s unique `replaced_record_id` and `hidden_record`'s key,
 * both of which every master with `corrected_edge` holds.
 */
export const correctedEdgeServed = (alias: string): string =>
  `NOT EXISTS (SELECT 1 FROM applied_change ac WHERE ac.replaced_record_id = ${alias}.record_id)
        AND NOT EXISTS (SELECT 1 FROM hidden_record hr WHERE hr.record_id = ${alias}.record_id)`;
