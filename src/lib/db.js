import { supabase, PHOTO_BUCKET } from "./supabaseClient.js";

/* ------------------------------------------------------------------ */
/*  Mapping helpers: DB row shape <-> the in-app record shape          */
/*  the tracker's rendering/progression logic already expects.         */
/* ------------------------------------------------------------------ */
function rowToSession(row) {
  return {
    id: row.id,
    date: new Date(row.session_date),
    type: row.session_type,
    phase: row.phase,
    logs: row.logs || {},
    carryLogs: row.carry_logs || {},
    volume: row.volume || 0,
  };
}

function rowToCarry(row) {
  return {
    id: row.id,
    exId: row.ex_id,
    type: row.session_type,
    fromDate: new Date(row.from_date),
    sets: row.sets || [],
  };
}

function rowToBodyLog(row) {
  return {
    id: row.id,
    date: new Date(row.entry_date),
    feel: row.feel || "",
    note: row.note || "",
    meas: row.measurements || "",
    photoRef: row.photo_ref || "",
    photoPath: row.photo_path || null,
  };
}

/* ------------------------------------------------------------------ */
/*  Sessions                                                           */
/* ------------------------------------------------------------------ */
export async function fetchSessions(userId) {
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_id", userId)
    .order("session_date", { ascending: true });
  if (error) throw error;
  return (data || []).map(rowToSession);
}

export async function countSessions(userId) {
  const { count, error } = await supabase
    .from("sessions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) throw error;
  return count || 0;
}

/* Insert a finished session. `record` is the app's in-memory shape:
   { date, type, phase, logs, carryLogs, volume } */
export async function insertSession(userId, record) {
  const { data, error } = await supabase
    .from("sessions")
    .insert({
      user_id: userId,
      session_date: new Date(record.date).toISOString(),
      session_type: record.type,
      phase: record.phase,
      logs: record.logs || {},
      carry_logs: record.carryLogs || {},
      volume: Math.round(record.volume || 0),
    })
    .select()
    .single();
  if (error) throw error;
  return rowToSession(data);
}

export async function deleteSession(userId, id) {
  const { error } = await supabase
    .from("sessions")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw error;
}

/* Bulk-insert the user's seed history (used once, on first login). */
export async function bulkInsertSessions(userId, records) {
  if (!records.length) return [];
  const rows = records.map((h) => ({
    user_id: userId,
    session_date: new Date(h.date).toISOString(),
    session_type: h.type,
    phase: h.phase || 0,
    logs: h.logs || {},
    carry_logs: h.carryLogs || {},
    volume: Math.round(h.volume || 0),
  }));
  const { data, error } = await supabase.from("sessions").insert(rows).select();
  if (error) throw error;
  return (data || []).map(rowToSession);
}

/* ------------------------------------------------------------------ */
/*  Pending carry (rolled-over exercises)                              */
/* ------------------------------------------------------------------ */
export async function fetchPendingCarry(userId) {
  const { data, error } = await supabase
    .from("pending_carry")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map(rowToCarry);
}

/* The in-memory `carry` array is always fully recomputed by finishSession
   (old entries are either completed and dropped, or re-rolled with fresh
   sets). We mirror that: wipe this user's pending_carry rows and insert
   the freshly computed set in one go, so the DB matches the in-memory
   state exactly — an insert for anything still unticked, nothing left
   behind for anything completed. */
export async function replacePendingCarry(userId, carryList) {
  const { error: delErr } = await supabase
    .from("pending_carry")
    .delete()
    .eq("user_id", userId);
  if (delErr) throw delErr;

  if (!carryList.length) return [];
  const rows = carryList.map((c) => ({
    user_id: userId,
    ex_id: c.exId,
    session_type: c.type,
    from_date: new Date(c.fromDate).toISOString(),
    sets: c.sets || [],
  }));
  const { data, error } = await supabase.from("pending_carry").insert(rows).select();
  if (error) throw error;
  return (data || []).map(rowToCarry);
}

/* ------------------------------------------------------------------ */
/*  Body log + photos                                                  */
/* ------------------------------------------------------------------ */
export async function fetchBodyLog(userId) {
  const { data, error } = await supabase
    .from("body_log")
    .select("*")
    .eq("user_id", userId)
    .order("entry_date", { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToBodyLog);
}

/* Uploads a photo (as a Blob/File) to the user's own folder in the
   body-photos bucket and returns the storage path. */
export async function uploadBodyPhoto(userId, blob, extension = "jpg") {
  const path = `${userId}/${Date.now()}.${extension}`;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, {
    contentType: blob.type || "image/jpeg",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function getBodyPhotoUrl(path) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function insertBodyLogEntry(userId, entry) {
  const { data, error } = await supabase
    .from("body_log")
    .insert({
      user_id: userId,
      entry_date: new Date(entry.date).toISOString(),
      feel: entry.feel || null,
      note: entry.note || null,
      measurements: entry.meas || null,
      photo_ref: entry.photoRef || null,
      photo_path: entry.photoPath || null,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToBodyLog(data);
}

export async function deleteBodyLogEntry(userId, id, photoPath) {
  const { error } = await supabase.from("body_log").delete().eq("user_id", userId).eq("id", id);
  if (error) throw error;
  if (photoPath) {
    // Best-effort: don't block the UI delete on storage cleanup succeeding.
    await supabase.storage.from(PHOTO_BUCKET).remove([photoPath]).catch(() => {});
  }
}

/* ------------------------------------------------------------------ */
/*  One-time seed migration                                            */
/* ------------------------------------------------------------------ */
/* If this user has no sessions yet, import seed-history.json's history
   array as their starting log so real training data isn't lost. */
export async function seedHistoryIfEmpty(userId, seedHistory) {
  const existing = await countSessions(userId);
  if (existing > 0) return { seeded: false, count: 0 };
  const inserted = await bulkInsertSessions(userId, seedHistory);
  return { seeded: true, count: inserted.length };
}

/* ------------------------------------------------------------------ */
/*  Full reset (used by the "Reset all saved data" button)             */
/* ------------------------------------------------------------------ */
export async function deleteAllUserData(userId) {
  const [sessions, carry, bodyLog] = await Promise.all([
    supabase.from("sessions").delete().eq("user_id", userId),
    supabase.from("pending_carry").delete().eq("user_id", userId),
    supabase.from("body_log").delete().eq("user_id", userId),
  ]);
  if (sessions.error) throw sessions.error;
  if (carry.error) throw carry.error;
  if (bodyLog.error) throw bodyLog.error;
}
