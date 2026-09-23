/**
 * This is a single-user app for now — every row belongs to this fixed id
 * rather than a real authenticated account. The column is still named
 * user_id and kept on every table so real multi-user auth can be added
 * later without a schema change.
 */
export const OWNER_ID = "00000000-0000-0000-0000-000000000001";
